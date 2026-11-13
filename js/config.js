// ============================================================
// 全局配置：模型地址 / 节点名匹配 / 引擎 / 粒子 / 相机参数
// 改模型只需要改这一个文件（详见 README「模型替换方法」）
// ============================================================

export const CONFIG = {
  // ★★★ 模型链接（在线公共 GLB，要求支持 CORS）★★★
  // 当前模型：Steam goods locomotive 0-6-0
  // 来源：3dassets.dev「Steam Era Railway and Rolling Stock」CC0 1.0
  modelUrl: 'https://cdn.3dassets.dev/assets/14715/v1/model.glb',
  // 离线备用：把模型放到 models/ 目录后改用下面这行
  // modelUrl: './models/steam-locomotive.glb',

  model: {
    targetLength: 4.5, // 加载后把模型最长边归一化到该长度（米），保证相机/地面比例一致

    // —— 可动部件节点名（正则，区分大小写无所谓）——
    // 换模型后用 gltf.report 查看节点名，再改这两个正则即可
    wheelPattern: /^wheel-driver-\d+-(left|right)$/i, // 车轮：wheel-driver-1-left …
    rodPattern: /^coupling-rod-(left|right)$/i,       // 连杆：coupling-rod-left …

    chimneyNode: '', // 烟囱节点名；留空则自动取「位置最高的子节点」作为出烟口
  },

  engine: {
    maxWheelRps: 1.8,   // 全速时车轮转速（圈/秒）
    rampUpTime: 4.0,    // 启动加速时长（秒）：缓慢提速
    rampDownTime: 6.0,  // 停机减速时长（秒）：缓慢减速停机
    chuffsPerRev: 4,    // 车轮每圈的喷汽次数（真实蒸汽机为 4 次/圈）
    vibration: 0.012,   // 全速时车身震动幅度（米）
  },

  particles: {
    max: 2000,   // 粒子池硬上限（性能天花板）
    initial: 900, // 初始粒子预算
    min: 200,    // 自动降质时的下限
  },

  cutaway: {
    shellOpacity: 0.28, // 透视模式下外壳的不透明度（内部零件保持不透明）
  },

  camera: {
    fov: 45,
    position: [6.5, 3.2, 7.5], // 初始相机位置
    target: [0, 1.1, 0],       // 初始观察目标
  },
};
