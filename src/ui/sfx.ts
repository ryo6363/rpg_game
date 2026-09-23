// 効果音（素材を使わず WebAudio で合成する）。
// iPhone では最初のタップで unlock() しないと音が出ない。

let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  return ctx;
}

/** 白色雑音のバッファ */
function noiseBuffer(ac: AudioContext, seconds: number): AudioBuffer {
  const buf = ac.createBuffer(1, Math.floor(ac.sampleRate * seconds), ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

export const Sfx = {
  /** ユーザー操作の中で呼ぶ（iOS の制限対策） */
  unlock() {
    const ac = audio();
    if (ac && ac.state === 'suspended') void ac.resume();
  },

  /** 爆発音。strength 0〜1 で大きさと長さが変わる */
  boom(strength = 1) {
    const ac = audio();
    if (!ac || ac.state !== 'running') return;
    const t = ac.currentTime;
    const len = 0.4 + strength * 1.2;

    // 低いうなり（ピッチが下がる）
    const osc = ac.createOscillator();
    const og = ac.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(120, t);
    osc.frequency.exponentialRampToValueAtTime(30, t + len);
    og.gain.setValueAtTime(0.6 * strength, t);
    og.gain.exponentialRampToValueAtTime(0.001, t + len);
    osc.connect(og).connect(ac.destination);
    osc.start(t);
    osc.stop(t + len);

    // 砕ける音（雑音を低域通過でこもらせていく）
    const src = ac.createBufferSource();
    src.buffer = noiseBuffer(ac, len);
    const lp = ac.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(3000, t);
    lp.frequency.exponentialRampToValueAtTime(120, t + len);
    const ng = ac.createGain();
    ng.gain.setValueAtTime(0.5 * strength, t);
    ng.gain.exponentialRampToValueAtTime(0.001, t + len);
    src.connect(lp).connect(ng).connect(ac.destination);
    src.start(t);
  },

  /** 時間停止の「キーン」という音 */
  chime() {
    const ac = audio();
    if (!ac || ac.state !== 'running') return;
    const t = ac.currentTime;
    for (const [freq, delay] of [
      [1320, 0],
      [1760, 0.08],
    ] as const) {
      const o = ac.createOscillator();
      const g = ac.createGain();
      o.type = 'triangle';
      o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, t + delay);
      g.gain.exponentialRampToValueAtTime(0.18, t + delay + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t + delay + 1.2);
      o.connect(g).connect(ac.destination);
      o.start(t + delay);
      o.stop(t + delay + 1.3);
    }
  },
};
