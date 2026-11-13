import * as THREE from 'three';

// ============================================================
// 引擎：启停状态机 + 车轮旋转 + 连杆联动 + 车身震动
//
// 状态机：stopped → starting → running → stopping → stopped
//   starting：速度沿斜坡上升（rampUpTime 秒到全速）
//   stopping：速度沿斜坡下降（rampDownTime 秒缓慢停机）
// ============================================================
export class Engine {
  /**
   * @param {THREE.Object3D} modelRoot 模型根节点（局部坐标系，勿缩放后再改）
   * @param {object} cfg  config.js 里的 engine 配置
   * @param {object} patterns { wheelPattern, rodPattern, chimneyNode }
   */
  constructor(modelRoot, cfg, patterns) {
    this.root = modelRoot;
    this.cfg = cfg;
    this.patterns = patterns;

    this.state = 'stopped'; // stopped | starting | running | stopping
    this.speed = 0;         // 当前速度 0~1
    this.wheelAngle = 0;    // 车轮累计转角（弧度）

    this.onChuff = null;    // 喷汽回调（由外部接音效与粒子脉冲）
    this._chuffCounter = 0; // 已触发的喷汽次数

    this._detectParts();
  }

  // —— 部件识别：车轮 / 连杆 / 烟囱 ——
  _detectParts() {
    this.wheels = [];
    this.rods = [];

    this.root.traverse((o) => {
      if (this.patterns.wheelPattern.test(o.name)) this.wheels.push(o);
      else if (this.patterns.rodPattern.test(o.name)) this.rods.push(o);
    });

    // 兜底：正则不匹配时按名字里含 wheel / rod 粗筛（换模型时提高容错）
    if (this.wheels.length === 0) {
      this.root.traverse((o) => {
        if (/wheel/i.test(o.name) && !o.name.includes('/')) this.wheels.push(o);
      });
    }
    if (this.rods.length === 0) {
      this.root.traverse((o) => {
        if (/rod/i.test(o.name) && !o.name.includes('/')) this.rods.push(o);
      });
    }
    if (this.wheels.length === 0) {
      console.warn('[Engine] 未识别到车轮节点，请修改 config.js 中的 wheelPattern');
    }

    // 为每根连杆找到「同侧最近的车轮」，记录曲柄偏移（静止时连杆相对车轮中心的位移）
    for (const rod of this.rods) {
      let nearest = null;
      let minDist = Infinity;
      for (const w of this.wheels) {
        // 同侧：x 坐标同号（左/右）
        if (Math.sign(w.position.x) !== Math.sign(rod.position.x)) continue;
        const d = rod.position.distanceTo(w.position);
        if (d < minDist) { minDist = d; nearest = w; }
      }
      rod.userData.wheel = nearest;
      rod.userData.rest = rod.position.clone(); // 静止位置
      // 曲柄偏移：在车轮横截面（Y-Z 平面）内随车轮一起转动的位移向量
      rod.userData.crank = nearest
        ? rod.position.clone().sub(nearest.position)
        : new THREE.Vector3();
    }

    // 烟囱：优先用配置里的节点名，否则取「位置最高的子节点」
    this.chimney = null;
    if (this.patterns.chimneyNode) {
      this.root.traverse((o) => {
        if (o.name === this.patterns.chimneyNode) this.chimney = o;
      });
    }
    if (!this.chimney) {
      let maxY = -Infinity;
      const candidates = this.root.children.length > 1
        ? this.root.children
        : (() => { const all = []; this.root.traverse((o) => all.push(o)); return all; })();
      for (const o of candidates) {
        if (o.position.y > maxY) { maxY = o.position.y; this.chimney = o; }
      }
    }
  }

  // 震动载体（包裹模型的外层 Group，由 main.js 传入）
  setRig(rig) {
    this.rig = rig;
  }

  start() {
    if (this.state === 'stopped' || this.state === 'stopping') {
      this.state = 'starting';
    }
  }

  stop() {
    if (this.state === 'running' || this.state === 'starting') {
      this.state = 'stopping';
    }
  }

  toggle() {
    if (this.state === 'running' || this.state === 'starting') this.stop();
    else this.start();
  }

  // 烟囱口的世界坐标（粒子发射点），结果写入 out
  getChimneyWorldPos(out) {
    if (!this.chimney) return out.set(0, 2, 0);
    return this.chimney.getWorldPosition(out);
  }

  /**
   * 每帧更新
   * @param {number} dt 距上一帧的秒数
   * @param {number} t  累计时间（秒）
   */
  update(dt, t) {
    // —— 1. 速度斜坡（启停都走渐变，不会瞬间跳变）——
    if (this.state === 'starting') {
      this.speed += dt / this.cfg.rampUpTime;
      if (this.speed >= 1) { this.speed = 1; this.state = 'running'; }
    } else if (this.state === 'stopping') {
      this.speed -= dt / this.cfg.rampDownTime;
      if (this.speed <= 0) { this.speed = 0; this.state = 'stopped'; }
    }

    // —— 2. 车轮转动（绕车轴 X 轴）——
    const angularVel = this.speed * this.cfg.maxWheelRps * Math.PI * 2; // 弧度/秒
    this.wheelAngle = (this.wheelAngle + angularVel * dt) % (Math.PI * 2);
    for (const w of this.wheels) w.rotation.x = this.wheelAngle;

    // —— 3. 连杆联动：曲柄偏移随车轮角绕 X 轴旋转，连杆整体平移（自身不转）——
    const c = Math.cos(this.wheelAngle);
    const s = Math.sin(this.wheelAngle);
    for (const rod of this.rods) {
      const { rest, crank } = rod.userData;
      // rest 位置已含 θ=0 时的曲柄偏移，这里叠加旋转后的增量
      rod.position.y = rest.y + (crank.y * (c - 1) - crank.z * s);
      rod.position.z = rest.z + (crank.y * s + crank.z * (c - 1));
    }

    // —— 4. 车身轻微震动（两路不同频率的正弦叠加，模拟机械抖动）——
    if (this.rig) {
      const amp = this.cfg.vibration * this.speed;
      this.rig.position.y = Math.sin(t * 23) * amp + Math.sin(t * 37.7) * amp * 0.6;
      this.rig.rotation.z = Math.sin(t * 17.3) * amp * 0.15;
      this.rig.rotation.x = Math.sin(t * 29.1) * amp * 0.1;
    }

    // —— 5. 喷汽节拍：车轮每转过 1/chuffsPerRev 圈触发一次 ——
    const chuffIndex = Math.floor(
      (this.wheelAngle / (Math.PI * 2)) * this.cfg.chuffsPerRev
    );
    if (chuffIndex !== this._chuffCounter) {
      this._chuffCounter = chuffIndex;
      if (this.speed > 0.05 && this.onChuff) this.onChuff(this.speed);
    }
  }
}
