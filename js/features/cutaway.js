import * as THREE from 'three';

// ============================================================
// 剖切透视：裁剪平面（沿车体纵向剖开）+ 外壳半透明
// 关键点：
//   1. 只对「外壳」网格做半透明，车轮/连杆等内部零件保持不透明，
//      这样剖开后能看清内部结构，而不是整体变透明；
//   2. 裁剪面挂在材质上（局部裁剪），不影响反射地面；
//   3. 透视开启时引擎动画照常运行（动画与裁剪互不干扰）。
// ============================================================
export class Cutaway {
  /**
   * @param {THREE.Object3D} modelRoot 模型根节点
   * @param {object} cfg config.js 里的 cutaway 配置
   * @param {RegExp[]} interiorPatterns 内部零件（车轮/连杆）的节点名正则
   */
  constructor(modelRoot, cfg, interiorPatterns) {
    this.cfg = cfg;
    this.enabled = false;

    // 裁剪平面：法线沿车轴方向（X 轴），把车体一侧「削掉」露出内部
    this.plane = new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0);

    // —— 收集内部零件子树（车轮/连杆及其所有子孙）——
    const interiorSet = new Set();
    modelRoot.traverse((o) => {
      if (interiorPatterns.some((p) => p.test(o.name))) {
        o.traverse((child) => interiorSet.add(child));
      }
    });

    // —— 遍历所有网格：克隆材质（避免共享材质互相影响），并区分外壳/内部 ——
    this.shellMats = []; // 外壳材质（透视时半透明）
    this.allMats = [];   // 全部材质（透视时挂裁剪面）
    modelRoot.traverse((o) => {
      if (!o.isMesh) return;
      const isInterior = interiorSet.has(o);
      // 克隆材质：同一个材质可能被外壳和车轮共用，克隆后才能只让外壳变透明
      o.material = Array.isArray(o.material)
        ? o.material.map((m) => m.clone())
        : o.material.clone();
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) {
        this.allMats.push(m);
        if (!isInterior) this.shellMats.push(m);
      }
    });

    // 记录外壳材质的原始参数，关闭透视时还原
    this._originals = this.shellMats.map((m) => ({
      transparent: m.transparent,
      opacity: m.opacity,
      depthWrite: m.depthWrite,
    }));
  }

  // 开启/关闭透视
  setEnabled(enabled) {
    this.enabled = enabled;
    if (enabled) {
      // 所有材质挂裁剪面（含内部零件，剖面整齐）
      for (const m of this.allMats) {
        m.clippingPlanes = [this.plane];
        m.clipShadows = true;
      }
      // 仅外壳半透明
      this.shellMats.forEach((m) => {
        m.transparent = true;
        m.opacity = this.cfg.shellOpacity;
        m.depthWrite = false; // 防止半透明外壳互相遮挡排序错误
        m.needsUpdate = true;
      });
    } else {
      for (const m of this.allMats) {
        m.clippingPlanes = null;
        m.clipShadows = false;
      }
      this.shellMats.forEach((m, i) => {
        m.transparent = this._originals[i].transparent;
        m.opacity = this._originals[i].opacity;
        m.depthWrite = this._originals[i].depthWrite;
        m.needsUpdate = true;
      });
    }
  }

  toggle() {
    this.setEnabled(!this.enabled);
    return this.enabled;
  }

  // 移动剖切位置（沿车轴方向平移裁剪面）
  setOffset(v) {
    this.plane.constant = v;
  }
}
