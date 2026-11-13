// ============================================================
// 蒸汽音效：纯 WebAudio 程序化合成，不依赖任何外部音频文件
// - 持续的蒸汽嘶嘶声（循环白噪声 + 低通滤波）
// - 低频轰鸣（正弦振荡器）
// - 喷汽「哐哧」声（噪声脉冲 + 带通滤波 + 快速衰减包络）
// 注意：浏览器自动播放策略要求 AudioContext 必须在用户手势后创建/恢复，
//       因此首次点击「启动引擎」时才初始化。
// ============================================================
export class SteamSound {
  constructor() {
    this.ctx = null;
  }

  // 惰性初始化音频上下文与各节点
  _ensure() {
    if (this.ctx) return;
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.ctx = ctx;

    this.master = ctx.createGain();
    this.master.gain.value = 0.7;
    this.master.connect(ctx.destination);

    // 1.5 秒白噪声缓冲（嘶嘶声与喷汽共用）
    const len = Math.floor(ctx.sampleRate * 1.5);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    this._noiseBuf = buf;

    // 持续嘶嘶声：循环噪声 → 低通 → 增益（增益随引擎速度）
    const hiss = ctx.createBufferSource();
    hiss.buffer = buf;
    hiss.loop = true;
    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 900;
    this._hissGain = ctx.createGain();
    this._hissGain.gain.value = 0;
    hiss.connect(lowpass).connect(this._hissGain).connect(this.master);
    hiss.start();

    // 低频轰鸣：正弦波 → 增益
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 44;
    this._rumbleGain = ctx.createGain();
    this._rumbleGain.gain.value = 0;
    osc.connect(this._rumbleGain).connect(this.master);
    osc.start();
  }

  // 启动引擎时调用（必须在用户手势回调里触发）
  start() {
    this._ensure();
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  // 引擎速度 0~1：调节持续声的响度
  setSpeed(v) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this._hissGain.gain.setTargetAtTime(0.02 + 0.12 * v, t, 0.2);
    this._rumbleGain.gain.setTargetAtTime(0.06 * v, t, 0.2);
  }

  // 一次喷汽「哐哧」：strength 为引擎速度 0~1
  chuff(strength) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const ctx = this.ctx;
    const t = ctx.currentTime;

    const src = ctx.createBufferSource();
    src.buffer = this._noiseBuf;

    const bandpass = ctx.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.frequency.value = 600 + 500 * strength; // 速度越快音调越高
    bandpass.Q.value = 0.8;

    // 包络：20ms 快速起音，0.28s 指数衰减
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(0.5 * strength + 0.001, t + 0.02);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);

    src.connect(bandpass).connect(env).connect(this.master);
    src.start(t);
    src.stop(t + 0.3);
  }

  // 停机：持续声淡出（喷汽声随引擎减速自然减少，无需处理）
  stop() {
    this.setSpeed(0);
  }
}
