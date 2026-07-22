// 简易 WebAudio 合成音效，无外部音频资源
class Sfx {
  private ctx: AudioContext | null = null;
  private enabled = true;

  private ensure(): AudioContext | null {
    if (!this.enabled) return null;
    if (!this.ctx) {
      try { this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)(); }
      catch { this.enabled = false; return null; }
    }
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    return this.ctx;
  }

  tone(freq: number, dur: number, type: OscillatorType = 'square', vol = 0.06, delay = 0, slide = 0) {
    const ctx = this.ensure(); if (!ctx) return;
    const t0 = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t0 + dur);
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(ctx.destination);
    o.start(t0); o.stop(t0 + dur + 0.02);
  }

  pickup()  { this.tone(660, 0.09, 'square', 0.05); this.tone(990, 0.12, 'square', 0.05, 0.07); }
  sell()    { this.tone(880, 0.08); this.tone(1100, 0.08, 'square', 0.05, 0.06); this.tone(1320, 0.15, 'square', 0.05, 0.12); }
  talk()    { this.tone(500 + Math.random() * 300, 0.05, 'square', 0.035); }

  // 动森式「Animalese」：参考原版的发声方式——声带嗡嗡声（锯齿波+颤音）经过两道
  // 口腔共振滤波形成元音，音节开头带短促辅音噪声。每个汉字映射到固定音节，
  // 同一个字发音永远相同，听起来就像模模糊糊地在念台词
  private speakToken = 0;
  private activeGains = new Set<GainNode>(); // 正在播放的语音音节（用于立即静音）

  // 对话被点掉/关闭时：立刻停掉正在播放的语音
  stopSpeak() {
    if (!this.ctx) return;
    this.speakToken++;
    const now = this.ctx.currentTime;
    for (const g of this.activeGains) {
      g.gain.cancelScheduledValues(now);
      g.gain.setTargetAtTime(0, now, 0.02);
    }
    this.activeGains.clear();
  } // 新对话打断旧语音
  private noiseBuf: AudioBuffer | null = null;
  // 五个元音的共振峰对（F1/F2），近似 a/e/i/o/u
  private static VOWELS: [number, number][] = [[820, 1220], [560, 1850], [340, 2250], [520, 950], [430, 880]];

  private getNoise(ctx: AudioContext): AudioBuffer {
    if (!this.noiseBuf) {
      const buf = ctx.createBuffer(1, ctx.sampleRate * 0.1, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      this.noiseBuf = buf;
    }
    return this.noiseBuf;
  }

  private syllable(ctx: AudioContext, f0: number, f1: number, f2: number, ratio: number, dur: number, delay: number, cons: number, vol = 1) {
    const t0 = ctx.currentTime + delay;
    // ---- 元音：声源（锯齿波嗓音 + 快速轻颤音）→ 高通去低频咚咚感 → 两级带通共振 ----
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(f0, t0);
    if (ratio) o.frequency.exponentialRampToValueAtTime(Math.max(50, f0 * (1 + ratio)), t0 + dur);
    const vib = ctx.createOscillator();       // 嗓音的微颤，去掉电子味
    vib.frequency.value = 32;
    const vibG = ctx.createGain(); vibG.gain.value = f0 * 0.04;
    vib.connect(vibG).connect(o.frequency);
    const hp = ctx.createBiquadFilter();      // 切掉低频，避免「咚咚咚」的闷响
    hp.type = 'highpass'; hp.frequency.value = 320;
    o.connect(hp);
    const mix = ctx.createGain(); mix.gain.value = 1;
    for (const [f, v] of [[f1, 0.8], [f2, 1]] as [number, number][]) { // 偏高频共振，更亮更尖
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = 6;
      const g = ctx.createGain(); g.gain.value = v;
      hp.connect(bp).connect(g).connect(mix);
    }
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t0);
    env.gain.exponentialRampToValueAtTime(0.5, t0 + 0.01);
    env.gain.setValueAtTime(0.5, t0 + dur * 0.6);
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    const master = ctx.createGain(); master.gain.value = 0.15 * vol;
    this.activeGains.add(master);
    o.onended = () => this.activeGains.delete(master);
    mix.connect(env).connect(master).connect(ctx.destination);
    o.start(t0); o.stop(t0 + dur + 0.02);
    vib.start(t0); vib.stop(t0 + dur + 0.02);
    // ---- 辅音：高频短噪声（轻轻的「啧/唧」感，不是低频敲击）----
    const n = ctx.createBufferSource();
    n.buffer = this.getNoise(ctx);
    const nf = ctx.createBiquadFilter();
    nf.type = 'bandpass'; nf.frequency.value = cons; nf.Q.value = 2.2;
    const nEnv = ctx.createGain();
    nEnv.gain.setValueAtTime(0.0001, t0);
    nEnv.gain.exponentialRampToValueAtTime(0.1, t0 + 0.005);
    nEnv.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.018);
    n.connect(nf).connect(nEnv).connect(ctx.destination);
    n.start(t0); n.stop(t0 + 0.04);
  }

  speak(text: string, pitch = 230, vol = 1) {
    const ctx = this.ensure(); if (!ctx || vol <= 0.02) return;
    const token = ++this.speakToken;
    const chars = text.replace(/\s+/g, '').slice(0, 80); // 限长，避免超长语音
    const step = 0.058; // 加速后的语速（原版是加速念字）
    let t = 0.03;
    for (const c of chars) {
      if (token !== this.speakToken) return; // 被更新的对话打断
      if ('，。！？……、；：——~·（）「」!?,.…'.includes(c)) { t += step * 2; continue; } // 标点：停顿不发声
      const code = c.charCodeAt(0);
      // 确定性映射：字符 → 元音 + 声调轮廓 + 辅音位置（同字同音，像真的在念）
      const [vf1, vf2] = Sfx.VOWELS[code % 5];
      const contour = (code >> 3) % 4;                    // 平/扬/降/曲 四种声调
      const ratio = [0.06, 0.34, -0.24, 0.16][contour];   // 起伏加大，抑扬顿挫
      // 原版要点：音高提高一个八度以上 + 共振峰同步上移（花栗鼠式尖细）
      const f0 = pitch * 2 * (0.92 + ((code >> 5) % 5) * 0.05);
      const f1 = vf1 * 1.6, f2 = vf2 * 1.6;
      const cons = 2600 + (code % 6) * 900;               // 高频辅音噪声
      const dur = 0.042 + (code % 3) * 0.008;             // 短促音节
      this.syllable(ctx, f0, f1, f2, ratio, dur, t, cons, vol);
      t += step;
    }
  }
  // 唱歌：每个字对应旋律的一个音符，音高/时值都跟着曲子走（像原版 K.K. 演唱会）
  sing(text: string, notes: number[], noteDur = 0.42, delay = 0, vol = 1) {
    const ctx = this.ensure(); if (!ctx || vol <= 0.02) return;
    const token = ++this.speakToken;
    const chars = text.replace(/\s+/g, '').slice(0, notes.length);
    let t = delay + 0.03;
    Array.from(chars).forEach((c, i) => {
      if (token !== this.speakToken) return;
      const code = c.charCodeAt(0);
      const [vf1, vf2] = Sfx.VOWELS[code % 5];
      // 基频 = 当前音符（提高一个八度，保持花栗鼠式可爱嗓音），长音带一点颤音延伸感
      const f0 = notes[i] * 2;
      const f1 = vf1 * 1.6, f2 = vf2 * 1.6;
      const cons = 2600 + (code % 6) * 900;
      const dur = noteDur * 0.88;           // 占满时值、略微断奏，字与字连贯成曲调
      const ratio = 0.04;                    // 唱长音时音高基本平稳，不念声调
      this.syllable(ctx, f0, f1, f2, ratio, dur, t, cons, vol);
      t += noteDur;
    });
  }

  shake()   { this.tone(180, 0.06, 'sawtooth', 0.05); this.tone(140, 0.08, 'sawtooth', 0.05, 0.07); }
  dig()     { this.tone(120, 0.12, 'sawtooth', 0.07, 0, -60); }
  rock()    { this.tone(200, 0.08, 'triangle', 0.09, 0, -120); }
  splash()  { this.tone(300, 0.15, 'sine', 0.06, 0, -220); }
  nibble()  { this.tone(500, 0.05, 'sine', 0.05); }
  bite()    { this.tone(350, 0.2, 'sine', 0.09, 0, -250); this.tone(700, 0.1, 'square', 0.04, 0.02); }
  fanfare() { [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.14, 'square', 0.05, i * 0.09)); }
  fail()    { this.tone(300, 0.15, 'sawtooth', 0.05); this.tone(220, 0.25, 'sawtooth', 0.05, 0.12); }
  plant()   { this.tone(400, 0.08, 'triangle', 0.06); this.tone(600, 0.12, 'triangle', 0.06, 0.08); }
  step()    { this.tone(90 + Math.random() * 30, 0.04, 'triangle', 0.018); }
  ui()      { this.tone(700, 0.05, 'square', 0.03); }
  plop()    { this.tone(500, 0.1, 'sine', 0.07, 0, -350); }
}

export const sfx = new Sfx();
