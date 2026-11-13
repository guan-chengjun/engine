import * as THREE from 'three';

// ============================================================
// 蒸汽粒子：固定大小的粒子池（环形复用，零运行时内存分配）
// - 自定义 ShaderMaterial：软圆点精灵，随距离衰减大小
// - 发射强度跟随引擎速度，喷汽节拍时额外爆发一团
// - setBudget() 控制活跃粒子上限，配合自动降质保证 60 帧
// ============================================================

const VERT = /* glsl */ `
  attribute float aSize;
  attribute float aAlpha;
  varying float vAlpha;
  void main() {
    vAlpha = aAlpha;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * (240.0 / -mv.z); // 透视衰减
    gl_Position = projectionMatrix * mv;
  }
`;

const FRAG = /* glsl */ `
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - vec2(0.5));
    float a = smoothstep(0.5, 0.05, d) * vAlpha; // 软边圆形
    if (a < 0.003) discard;
    gl_FragColor = vec4(vec3(0.92, 0.93, 0.95), a);
  }
`;

export class SteamParticles {
  /**
   * @param {THREE.Scene} scene
   * @param {number} maxCount 粒子池硬上限
   */
  constructor(scene, maxCount) {
    this.max = maxCount;
    this.budget = maxCount; // 当前允许活跃的上限（动态调整）
    this._emitAcc = 0;      // 发射累积器（把小数粒子攒成整数）
    this._burst = 0;        // 喷汽脉冲带来的额外发射量

    // 粒子数据（JS 侧结构体数组，避免每帧分配）
    this._pool = Array.from({ length: maxCount }, () => ({
      alive: false,
      x: 0, y: 0, z: 0,
      vx: 0, vy: 0, vz: 0,
      age: 0, life: 1, size: 0.2, alpha: 0.5,
    }));
    this._cursor = 0; // 环形游标：新粒子覆盖最老的槽位

    // GPU 缓冲区
    this._positions = new Float32Array(maxCount * 3);
    this._sizes = new Float32Array(maxCount);
    this._alphas = new Float32Array(maxCount);

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(this._positions, 3));
    geometry.setAttribute('aSize', new THREE.BufferAttribute(this._sizes, 1));
    geometry.setAttribute('aAlpha', new THREE.BufferAttribute(this._alphas, 1));
    geometry.setDrawRange(0, 0);

    const material = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false, // 半透明粒子不写深度，避免互相遮挡
    });

    this.points = new THREE.Points(geometry, material);
    this.points.frustumCulled = false; // 粒子位置动态变化，关闭视锥剔除
    scene.add(this.points);

    this.aliveCount = 0;
  }

  // 设置活跃粒子上限（性能调节）
  setBudget(n) {
    this.budget = Math.min(Math.max(0, n), this.max);
  }

  // 喷汽脉冲：一次性多喷一团
  puff(amount = 12) {
    this._burst += amount;
  }

  _spawnOne(emitter, intensity) {
    const p = this._pool[this._cursor];
    this._cursor = (this._cursor + 1) % this.max;

    p.alive = true;
    p.age = 0;
    p.life = 1.6 + Math.random() * 1.4;
    // 出生点：烟囱口附近小范围随机
    p.x = emitter.x + (Math.random() - 0.5) * 0.12;
    p.y = emitter.y + Math.random() * 0.05;
    p.z = emitter.z + (Math.random() - 0.5) * 0.12;
    // 初速度：向上为主，随引擎速度加快
    const up = 1.0 + Math.random() * 0.9 + intensity * 0.8;
    p.vx = (Math.random() - 0.5) * 0.3;
    p.vy = up;
    p.vz = (Math.random() - 0.5) * 0.3;
    p.size = 0.12 + Math.random() * 0.16;
    p.alpha = 0.45 + intensity * 0.25;
  }

  /**
   * 每帧更新
   * @param {number} dt
   * @param {THREE.Vector3} emitter 烟囱口世界坐标
   * @param {number} intensity 引擎速度 0~1
   */
  update(dt, emitter, intensity) {
    // —— 1. 发射新粒子（速率随引擎速度，停机时不喷）——
    if (intensity > 0.02) {
      this._emitAcc += dt * (20 + 160 * intensity) + this._burst;
      this._burst = 0;
      let n = Math.floor(this._emitAcc);
      this._emitAcc -= n;
      while (n-- > 0 && this.aliveCount < this.budget) {
        this._spawnOne(emitter, intensity);
      }
    } else {
      this._burst = 0;
    }

    // —— 2. 更新存活的粒子并紧凑写入 GPU 缓冲区 ——
    let count = 0;
    for (let i = 0; i < this.max; i++) {
      const p = this._pool[i];
      if (!p.alive) continue;

      p.age += dt;
      if (p.age >= p.life) { p.alive = false; continue; }

      // 运动：上浮加速 + 空气阻力 + 轻微侧风
      p.vy += 0.25 * dt;
      const drag = 1 - 0.4 * dt;
      p.vx = p.vx * drag + 0.1 * dt; // 侧风
      p.vz *= drag;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;

      // 生命周期曲线：尺寸不断膨胀，透明度正弦淡入淡出
      const k = p.age / p.life;
      const fade = Math.sin(k * Math.PI);

      this._positions[count * 3] = p.x;
      this._positions[count * 3 + 1] = p.y;
      this._positions[count * 3 + 2] = p.z;
      this._sizes[count] = p.size * (1 + k * 2.2);
      this._alphas[count] = p.alpha * fade;
      count++;
    }

    this.aliveCount = count;
    const g = this.points.geometry;
    g.attributes.position.needsUpdate = true;
    g.attributes.aSize.needsUpdate = true;
    g.attributes.aAlpha.needsUpdate = true;
    g.setDrawRange(0, count);
  }
}
