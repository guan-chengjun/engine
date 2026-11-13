import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// ============================================================
// 相机控制：OrbitControls 环绕 / 缩放 / 平移 + 自动旋转 + 重置视角
// ============================================================
export class CameraControls {
  /**
   * @param {THREE.PerspectiveCamera} camera
   * @param {HTMLElement} domElement 渲染画布
   * @param {object} cfg config.js 里的 camera 配置
   */
  constructor(camera, domElement, cfg) {
    camera.position.set(...cfg.position);

    this.controls = new OrbitControls(camera, domElement);
    this.controls.target.set(...cfg.target);

    this.controls.enableDamping = true;      // 阻尼惯性，转动更顺滑
    this.controls.dampingFactor = 0.06;
    this.controls.minDistance = 2.2;         // 最近距离（防止钻进模型）
    this.controls.maxDistance = 24;          // 最远距离
    this.controls.maxPolarAngle = Math.PI * 0.495; // 不允许钻到地面以下
    this.controls.autoRotateSpeed = 1.4;     // 自动旋转速度

    this.controls.update();
    this.controls.saveState(); // 记住初始视角，供「重置视角」使用
  }

  setAutoRotate(enabled) {
    this.controls.autoRotate = enabled;
  }

  // 恢复到初始相机位置与观察目标
  reset() {
    this.controls.reset();
  }

  update() {
    this.controls.update(); // 阻尼开启后必须每帧调用
  }
}
