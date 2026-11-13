import * as THREE from 'three';
import { CONFIG } from './config.js';
import { Stage } from './core/stage.js';
import { loadModel } from './core/loader.js';
import { CameraControls } from './features/cameraControls.js';
import { Engine } from './features/engine.js';
import { Cutaway } from './features/cutaway.js';
import { SteamParticles } from './features/steamParticles.js';
import { SteamSound } from './features/steamSound.js';
import { Panel } from './ui/panel.js';

// ============================================================
// 入口：组装各模块 + 主循环
// ============================================================

// —— 加载界面元素 ——
const overlay = document.getElementById('loading-overlay');
const progressBar = document.getElementById('progress-bar');
const progressText = document.getElementById('progress-text');
const loadError = document.getElementById('load-error');
const loadErrorMsg = document.getElementById('load-error-msg');
document.getElementById('btn-retry').addEventListener('click', () => location.reload());

// —— 舞台与相机 ——
const stage = new Stage(document.getElementById('app'));
const camCtl = new CameraControls(stage.camera, stage.renderer.domElement, CONFIG.camera);

// —— 模块引用（模型加载完成后初始化）——
let engine, cutaway, particles, panel;
const sound = new SteamSound();
const chimneyPos = new THREE.Vector3();

// 粒子性能调节：userCap 是用户滑块设定值，budget 是自动降质后的实际值
let particleUserCap = CONFIG.particles.initial;
let particleBudget = CONFIG.particles.initial;

boot();

// —— 加载模型 ——
async function boot() {
  try {
    const gltf = await loadModel(CONFIG.modelUrl, {
      onProgress(percent, loaded) {
        if (percent !== null) {
          progressBar.style.width = `${percent}%`;
          progressText.textContent = `正在加载模型… ${percent}%`;
        } else {
          // 服务器未返回总长度时，显示已下载体积
          progressText.textContent = `正在加载模型… ${(loaded / 1048576).toFixed(1)} MB`;
        }
      },
    });
    setup(gltf.scene);
    overlay.classList.add('hidden'); // 淡出加载遮罩
  } catch (err) {
    // 加载失败：显示错误信息与重试按钮
    progressBar.parentElement.style.display = 'none';
    progressText.style.display = 'none';
    loadError.hidden = false;
    loadErrorMsg.textContent = err.message;
  }
}

// —— 模型就位：归一化、落地、初始化各功能模块 ——
function setup(model) {
  // 1. 归一化缩放：最长边缩放到 targetLength 米
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const scale = CONFIG.model.targetLength / Math.max(size.x, size.z);
  model.scale.setScalar(scale);

  // 2. 居中并放到地面上
  box.setFromObject(model);
  const center = box.getCenter(new THREE.Vector3());
  model.position.x -= center.x;
  model.position.z -= center.z;
  model.position.y -= box.min.y;

  // 3. 阴影
  model.traverse((o) => {
    if (o.isMesh) o.castShadow = true;
  });

  // 4. 震动载体：引擎震动作用在 rig 上，不污染模型自身坐标
  const rig = new THREE.Group();
  rig.add(model);
  stage.scene.add(rig);

  // 5. 功能模块
  engine = new Engine(model, CONFIG.engine, {
    wheelPattern: CONFIG.model.wheelPattern,
    rodPattern: CONFIG.model.rodPattern,
    chimneyNode: CONFIG.model.chimneyNode,
  });
  engine.setRig(rig);

  cutaway = new Cutaway(model, CONFIG.cutaway, [
    CONFIG.model.wheelPattern,
    CONFIG.model.rodPattern,
  ]);

  particles = new SteamParticles(stage.scene, CONFIG.particles.max);
  particles.setBudget(particleBudget);

  // 喷汽节拍 → 音效 + 粒子脉冲
  engine.onChuff = (speed) => {
    sound.chuff(speed);
    particles.puff(Math.round(8 + 14 * speed));
  };

  // 6. 控制面板
  panel = new Panel(document.getElementById('panel'), {
    onEngineToggle() {
      engine.toggle();
      // 音频必须在用户手势中启动（浏览器自动播放策略）
      if (engine.state === 'starting') sound.start();
      else sound.stop();
    },
    onCutawayToggle() {
      panel.setCutaway(cutaway.toggle());
    },
    onRotateToggle() {
      camCtl.controls.autoRotate = !camCtl.controls.autoRotate;
      panel.setAutoRotate(camCtl.controls.autoRotate);
    },
    onReset() {
      camCtl.reset();
    },
    onParticleChange(n) {
      particleUserCap = n;
      particleBudget = n;
      particles.setBudget(n);
    },
    onClipChange(v) {
      cutaway.setOffset(v);
    },
  }, { particleInit: CONFIG.particles.initial, particleMax: CONFIG.particles.max });
  panel.setEngineState(engine.state);

  requestAnimationFrame(tick);
}

// —— 主循环 ——
const clock = new THREE.Clock();
let lastState = '';
let fpsFrames = 0;
let fpsTimer = 0;
let currentFps = 60;
let qualityTimer = 0;

function tick() {
  requestAnimationFrame(tick);
  const dt = Math.min(clock.getDelta(), 0.05); // 截断长帧，防止切后台后跳变
  const t = clock.elapsedTime;

  // 引擎（车轮/连杆/震动/喷汽节拍）
  engine.update(dt, t);
  if (engine.state !== lastState) { // 状态变化时同步面板按钮
    lastState = engine.state;
    panel.setEngineState(engine.state);
  }

  // 蒸汽粒子（发射口跟随烟囱世界坐标）
  engine.getChimneyWorldPos(chimneyPos);
  particles.update(dt, chimneyPos, engine.speed);

  // 音效响度跟随引擎速度
  sound.setSpeed(engine.speed);

  camCtl.update();
  stage.render();

  updateStats(dt);
}

// —— FPS 统计 + 自动降质（优先保 60 帧）——
function updateStats(dt) {
  fpsFrames++;
  fpsTimer += dt;
  qualityTimer += dt;

  if (fpsTimer >= 0.5) {
    currentFps = Math.round(fpsFrames / fpsTimer);
    fpsFrames = 0;
    fpsTimer = 0;
    panel.setStats({ fps: currentFps, particles: particles.aliveCount });
  }

  // 每 2 秒评估一次：帧率不足就削减粒子预算，宽裕则逐步恢复
  if (qualityTimer >= 2) {
    qualityTimer = 0;
    if (currentFps < 50 && particleBudget > CONFIG.particles.min) {
      particleBudget = Math.max(CONFIG.particles.min, Math.floor(particleBudget * 0.75));
      particles.setBudget(particleBudget);
    } else if (currentFps > 57 && particleBudget < particleUserCap) {
      particleBudget = Math.min(particleUserCap, Math.floor(particleBudget * 1.15) + 10);
      particles.setBudget(particleBudget);
    }
  }
}
