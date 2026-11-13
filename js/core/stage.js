import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

// ============================================================
// 舞台：渲染器 / 场景 / 相机 / 柔光 PBR 布光 / 反射地面
// ============================================================
export class Stage {
  constructor(container) {
    // —— 渲染器 ——
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // 限制 DPR 保帧率
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;   // 柔和阴影
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping; // 电影级色调映射
    this.renderer.toneMappingExposure = 1.1;
    // 允许材质级裁剪（剖切透视用）；注意：这里用「逐材质裁剪」而不是全局裁剪，
    // 否则竖直裁剪面会把反射地面也切成两半
    this.renderer.localClippingEnabled = true;
    container.appendChild(this.renderer.domElement);

    // —— 场景与相机 ——
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0b0e13);
    this.scene.fog = new THREE.Fog(0x0b0e13, 18, 42); // 远处雾化，突出主体

    this.camera = new THREE.PerspectiveCamera(
      45, window.innerWidth / window.innerHeight, 0.1, 120
    );

    // —— PBR 环境贴图（让金属/漆面有真实反射）——
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

    this._setupLights();
    this._setupFloor();

    window.addEventListener('resize', () => this._onResize());
  }

  // 柔光 PBR 布光：环境光 + 主光（投影）+ 补光
  _setupLights() {
    // 半球环境光：天空冷色 / 地面暖色，整体提亮暗部
    this.scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x2a241c, 0.55));

    // 主光（暖色，产生柔和阴影）
    const key = new THREE.DirectionalLight(0xfff1de, 1.6);
    key.position.set(6, 9, 5);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.left = key.shadow.camera.bottom = -8;
    key.shadow.camera.right = key.shadow.camera.top = 8;
    key.shadow.camera.near = 1;
    key.shadow.camera.far = 30;
    key.shadow.bias = -0.0004;
    this.scene.add(key);

    // 补光（冷色，从另一侧填亮轮廓）
    const fill = new THREE.DirectionalLight(0xbfd4ff, 0.45);
    fill.position.set(-7, 5, -6);
    this.scene.add(fill);
  }

  // 反射地面：圆形镜面 + 半透明压暗层 + 外圈哑光地面
  _setupFloor() {
    // 镜面（Reflector 会把场景镜像渲染一次）
    const mirror = new Reflector(new THREE.CircleGeometry(7.5, 72), {
      clipBias: 0.003,
      textureWidth: 1024,
      textureHeight: 1024,
      color: 0x9aa4ad, // 调暗反射亮度
    });
    mirror.rotation.x = -Math.PI / 2;
    mirror.position.y = 0;
    this.scene.add(mirror);

    // 压在镜面上的半透明深色层：让反射变含蓄，并承接阴影
    const dimmer = new THREE.Mesh(
      new THREE.CircleGeometry(7.5, 72),
      new THREE.MeshStandardMaterial({
        color: 0x0d1016, transparent: true, opacity: 0.62, roughness: 0.9,
      })
    );
    dimmer.rotation.x = -Math.PI / 2;
    dimmer.position.y = 0.002;
    dimmer.receiveShadow = true;
    this.scene.add(dimmer);

    // 镜面外圈的装饰光环
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(7.5, 7.62, 96),
      new THREE.MeshBasicMaterial({ color: 0x2e3a4d })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.004;
    this.scene.add(ring);

    // 外圈哑光地面（融入背景）
    const outer = new THREE.Mesh(
      new THREE.CircleGeometry(45, 64),
      new THREE.MeshStandardMaterial({ color: 0x0e1117, roughness: 1 })
    );
    outer.rotation.x = -Math.PI / 2;
    outer.position.y = -0.002;
    outer.receiveShadow = true;
    this.scene.add(outer);
  }

  _onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}
