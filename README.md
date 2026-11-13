# 蒸汽机车 3D 展厅（Three.js）

基于 Three.js 的蒸汽机车 3D 交互展厅：在线加载公共 GLB 模型（GLTFLoader），
简约展厅场景 + 柔光 PBR 布光 + 反射地面，支持剖切透视、引擎启停联动动画、
蒸汽粒子与程序化音效。

## 功能一览

| 功能 | 说明 |
| --- | --- |
| 模型加载 | GLTFLoader 在线加载公共 GLB，进度条显示，失败弹出提示与重试按钮 |
| 相机 | OrbitControls：左键 360° 环绕、滚轮缩放、右键平移；支持自动旋转、一键重置视角 |
| 剖切透视 | 裁剪平面纵向剖开车体 + **仅外壳半透明**（车轮/连杆等内部件保持不透明），透视中动画照常播放，剖切位置可用滑块微调 |
| 引擎启停 | 启动后活塞连杆节奏的车轮联动、烟囱喷蒸汽粒子、车身轻微震动、蒸汽音效；停止时沿斜坡缓慢减速停机 |
| 侧边面板 | 启动/停止引擎、透视剖切、自动旋转、重置视角、粒子数量滑块，按钮状态实时联动 |
| 性能 | 粒子池零运行时分配、粒子数量可调、FPS 过低自动降质，优先保 60 帧 |

## 目录结构

```
engine/
├── index.html                  # 入口页面（import map + 加载遮罩 + 面板容器）
├── css/
│   └── style.css               # 界面样式（加载遮罩 / 悬浮面板）
├── js/
│   ├── config.js               # ★ 全局配置：模型链接、节点名正则、引擎/粒子参数
│   ├── main.js                 # 入口：组装各模块 + 主循环 + 自动降质
│   ├── core/
│   │   ├── stage.js            # 渲染器 / 场景 / 相机 / 柔光 PBR 布光 / 反射地面
│   │   └── loader.js           # GLTFLoader 加载（进度 / 失败回调）
│   ├── features/
│   │   ├── cameraControls.js   # OrbitControls 环绕缩放平移 / 自动旋转 / 重置
│   │   ├── cutaway.js          # 剖切透视：裁剪平面 + 外壳半透明
│   │   ├── engine.js           # 引擎状态机 + 车轮/连杆联动 + 车身震动
│   │   ├── steamParticles.js   # 蒸汽粒子池（自定义 shader）
│   │   └── steamSound.js       # WebAudio 程序化蒸汽音效（无外部音频文件）
│   └── ui/
│       └── panel.js            # 悬浮侧边控制面板
├── models/
│   └── steam-locomotive.glb    # 本地备用模型（默认走在线链接，见下文）
└── README.md
```

## 启动命令

ES Module + import map 必须通过 HTTP 访问，**双击 index.html（file://）无法运行**。
任选一种方式，在项目根目录执行：

```bash
# 方式一：Python（推荐，无需安装依赖）
python -m http.server 8080

# 方式二：Node.js
npx serve . -l 8080

# 方式三：VS Code 插件 Live Server，右键 index.html → Open with Live Server
```

然后浏览器打开 <http://localhost:8080> 。

> 首次打开需要联网：three.js 从 jsDelivr CDN 加载，机车模型从 3dassets.dev CDN 加载。

## 模型替换方法

所有模型相关配置集中在 **`js/config.js`**：

```js
// ★ 模型链接（js/config.js 第 10 行）
modelUrl: 'https://cdn.3dassets.dev/assets/14715/v1/model.glb',
```

1. **换成另一个在线 GLB**：把 `modelUrl` 改成新地址即可（要求服务器允许跨域，
   响应头带 `Access-Control-Allow-Origin`）。
2. **换成本地模型**：把 `.glb` 文件放进 `models/` 目录，改为
   `modelUrl: './models/你的模型.glb'`。仓库已内置一份备用模型
   `models/steam-locomotive.glb`，断网时可直接切换。
3. **让车轮/连杆动起来**：动画靠节点名识别。用 <https://gltf.report> 打开你的模型，
   在左侧节点树里找到车轮、连杆的节点名，然后修改 `config.js` 里的正则：

   ```js
   wheelPattern: /^wheel-driver-\d+-(left|right)$/i, // 改成你的车轮节点名规律
   rodPattern:   /^coupling-rod-(left|right)$/i,     // 改成你的连杆节点名规律
   ```

   正则不匹配时会退化为按名字包含 `wheel` / `rod` 粗筛；仍找不到时，
   引擎启动后只有震动/粒子/音效，控制台会输出 `[Engine] 未识别到车轮节点` 警告。
4. **烟囱位置**：默认自动取「位置最高的子节点」作为出烟口；不准时在
   `config.js` 里指定 `chimneyNode: '节点名'`。
5. **模型大小**：加载后自动归一化到 `model.targetLength`（默认 4.5 米），
   一般无需调整。

**当前模型信息**：Steam goods locomotive 0-6-0，出自 3dassets.dev
「Steam Era Railway and Rolling Stock」资产包，许可证 **CC0 1.0**（可自由商用/修改）。
节点结构：`wheel-driver-1/2-left/right`（动轮）、`coupling-rod-left/right`（连杆）、
`tank-shunter-0-4-0_*`（车身外壳）。

## 常见问题排查

**1. 页面空白 / 控制台报 `Failed to resolve module specifier "three"`**
浏览器不支持 import map（需 Chrome 89+ / Edge 89+ / Safari 16.4+），或 CDN 被网络拦截。
换现代浏览器；公司内网拦截 jsDelivr 时，可把 three.js 下载到本地并修改
`index.html` 中 import map 的路径。

**2. 显示「模型加载失败」**
- 在线模型地址失效或网络不通 → 改用本地备用模型：`config.js` 中
  `modelUrl: './models/steam-locomotive.glb'`；
- 自建模型地址报 CORS 错误 → 服务器需返回 `Access-Control-Allow-Origin: *`；
- 确认是用 HTTP 服务打开的页面，而不是双击文件（file:// 协议会被浏览器拦截）。

**3. 引擎启动后车轮不转 / 连杆不动**
节点名与 `config.js` 的正则不匹配。按「模型替换方法」第 3 步，
用 gltf.report 查节点名并修改 `wheelPattern` / `rodPattern`。

**4. 没有声音**
浏览器自动播放策略要求声音必须由用户操作触发——先点一次「启动引擎」。
若仍无声，检查系统/标签页是否静音。音效为 WebAudio 实时合成，不加载外部音频文件。

**5. 卡顿 / 帧率低**
- 拖低面板「粒子数量」滑块；
- 程序已内置自动降质：FPS 持续低于 50 时自动削减粒子预算，恢复后逐步回升；
- 集显设备可再把 `js/config.js` 的 `particles.max` 调小。

**6. 透视后看不到内部结构**
剖切方向沿车轴（X 轴）。用面板里出现的「剖切位置」滑块移动裁剪面；
若模型本身不是沿 X 轴布局，可在 `js/features/cutaway.js` 中修改裁剪平面法线方向。

**7. 模型太大/太小/沉到地面下**
加载流程会自动按包围盒归一化尺寸并落地；异常时检查模型本身是否带有
极大的缩放或偏移（可用 gltf.report 查看）。

## 环境快照基线说明

本仓库的第一次提交（commit `initial environment snapshot`）代表工作区配置就绪的状态基线，
后续所有改动都可与该基线对比。组织 / 仓库：`guan-chengjun/engine`。
