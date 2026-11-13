// ============================================================
// 悬浮侧边控制面板：按钮状态与引擎/透视/自动旋转联动
// 纯 DOM 实现（不占用 WebGL 渲染开销），样式见 css/style.css
// ============================================================

const ENGINE_LABEL = {
  stopped: '启动引擎',
  starting: '启动中…',
  running: '停止引擎',
  stopping: '停机中…',
};

export class Panel {
  /**
   * @param {HTMLElement} container #panel 容器
   * @param {object} actions 各控件回调
   * @param {object} opts { particleInit, particleMax }
   */
  constructor(container, actions, opts) {
    this.actions = actions;

    container.innerHTML = `
      <div class="panel-title">蒸汽机车 · 控制台</div>

      <button id="btn-engine" class="btn btn-primary">启动引擎</button>
      <button id="btn-cutaway" class="btn">透视剖切：关</button>
      <button id="btn-rotate" class="btn">自动旋转：关</button>
      <button id="btn-reset" class="btn">重置视角</button>

      <div class="slider-row">
        <label>粒子数量 <span id="particle-val">${opts.particleInit}</span></label>
        <input id="slider-particles" type="range"
               min="0" max="${opts.particleMax}" step="50" value="${opts.particleInit}" />
      </div>

      <div class="slider-row" id="clip-row" hidden>
        <label>剖切位置</label>
        <input id="slider-clip" type="range" min="-0.6" max="0.6" step="0.01" value="0" />
      </div>

      <div class="stats">
        <div>状态：<span id="stat-state">已停机</span></div>
        <div>FPS：<span id="stat-fps">--</span>　粒子：<span id="stat-particles">0</span></div>
      </div>

      <div class="hint">左键旋转 · 滚轮缩放 · 右键平移</div>
    `;

    // —— 元素引用 ——
    this.btnEngine = container.querySelector('#btn-engine');
    this.btnCutaway = container.querySelector('#btn-cutaway');
    this.btnRotate = container.querySelector('#btn-rotate');
    this.btnReset = container.querySelector('#btn-reset');
    this.sliderParticles = container.querySelector('#slider-particles');
    this.particleVal = container.querySelector('#particle-val');
    this.clipRow = container.querySelector('#clip-row');
    this.sliderClip = container.querySelector('#slider-clip');
    this.statState = container.querySelector('#stat-state');
    this.statFps = container.querySelector('#stat-fps');
    this.statParticles = container.querySelector('#stat-particles');

    // —— 事件绑定 ——
    this.btnEngine.addEventListener('click', () => actions.onEngineToggle());
    this.btnCutaway.addEventListener('click', () => actions.onCutawayToggle());
    this.btnRotate.addEventListener('click', () => actions.onRotateToggle());
    this.btnReset.addEventListener('click', () => actions.onReset());
    this.sliderParticles.addEventListener('input', (e) => {
      const n = Number(e.target.value);
      this.particleVal.textContent = n;
      actions.onParticleChange(n);
    });
    this.sliderClip.addEventListener('input', (e) => {
      actions.onClipChange(Number(e.target.value));
    });
  }

  // 引擎状态联动：文案 + 禁用（加减速过程中禁止重复点击）
  setEngineState(state) {
    this.btnEngine.textContent = ENGINE_LABEL[state] || state;
    this.btnEngine.disabled = state === 'starting' || state === 'stopping';
    this.btnEngine.classList.toggle('active', state === 'running');
    this.statState.textContent = {
      stopped: '已停机', starting: '启动中…',
      running: '运转中', stopping: '减速停机中…',
    }[state] || state;
  }

  setCutaway(enabled) {
    this.btnCutaway.textContent = `透视剖切：${enabled ? '开' : '关'}`;
    this.btnCutaway.classList.toggle('active', enabled);
    this.clipRow.hidden = !enabled; // 透视开启时才显示剖切位置滑块
  }

  setAutoRotate(enabled) {
    this.btnRotate.textContent = `自动旋转：${enabled ? '开' : '关'}`;
    this.btnRotate.classList.toggle('active', enabled);
  }

  setStats({ fps, particles }) {
    this.statFps.textContent = fps;
    this.statParticles.textContent = particles;
  }
}
