const VARIANT_COUNT = 6;

interface NoiseSpec {
  dur: number;
  gain: number;
  type: BiquadFilterType;
  freq: number;
  q?: number;
  at?: number;
  decay?: number;
  gainCurve?: "linear" | "exponential";
}

interface ToneSpec {
  freq: number;
  freqEnd?: number;
  dur: number;
  gain: number;
  type: OscillatorType;
  at?: number;
  decay?: number;
}

export type SoundEvent =
  | "keyDown"
  | "linkage"
  | "swish"
  | "impact"
  | "rest"
  | "escapement"
  | "space"
  | "backspace"
  | "bell"
  | "returnPull"
  | "returnFly"
  | "ratchet"
  | "paperIn"
  | "paperOut"
  | "shift"
  | "clash"
  | "explodeMove"
  | "assembleMove";

/**
 * Procedural mechanical audio. No sound files: every effect is built from
 * a shared noise buffer plus oscillators, filters and gain envelopes.
 */
export class MechanicalAudio {
  enabled = true;
  volume = 0.55;
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private variant = 0;
  private activeVoices = 0;
  private maxVoices = 32;
  private lastPlay = new Map<string, number>();

  /** Create or resume the AudioContext after user interaction. */
  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === "suspended") void this.ctx.resume();
      return;
    }
    try {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor({ latencyHint: "interactive" });
      this.master = this.ctx.createGain();
      this.master.gain.value = this.enabled ? this.volume : 0;
      this.master.connect(this.ctx.destination);
      const length = this.ctx.sampleRate;
      this.noiseBuffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
      const data = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    } catch {
      this.ctx = null;
    }
  }

  /** Smoothly ramps master gain instead of destroying the graph. */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(enabled ? this.volume : 0, this.ctx.currentTime, 0.03);
    }
  }

  private nextVariant(): number {
    this.variant = (this.variant + 1) % VARIANT_COUNT;
    return this.variant;
  }

  private get ready(): boolean {
    return !!(
      this.ctx &&
      this.master &&
      this.noiseBuffer &&
      this.enabled &&
      this.ctx.state === "running"
    );
  }

  private throttled(event: string, minGapMs: number): boolean {
    const now = performance.now();
    const last = this.lastPlay.get(event) ?? -Infinity;
    if (now - last < minGapMs) return true;
    this.lastPlay.set(event, now);
    return false;
  }

  private noise(spec: NoiseSpec): void {
    if (!this.ready || this.activeVoices >= this.maxVoices) return;
    const ctx = this.ctx!;
    const at = ctx.currentTime + (spec.at ?? 0);
    const source = ctx.createBufferSource();
    source.buffer = this.noiseBuffer;
    source.loop = true;
    source.playbackRate.value = 0.7 + Math.random() * 0.6;
    const filter = ctx.createBiquadFilter();
    filter.type = spec.type;
    filter.frequency.value = spec.freq;
    filter.Q.value = spec.q ?? 0.8;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(spec.gain, at);
    if (spec.gainCurve === "linear") gain.gain.linearRampToValueAtTime(1e-4, at + spec.dur);
    else gain.gain.exponentialRampToValueAtTime(1e-4, at + (spec.decay ?? spec.dur));
    source.connect(filter).connect(gain).connect(this.master!);
    source.start(at, Math.random());
    source.stop(at + spec.dur + 0.02);
    this.track();
  }

  private tone(spec: ToneSpec): void {
    if (!this.ready || this.activeVoices >= this.maxVoices) return;
    const ctx = this.ctx!;
    const at = ctx.currentTime + (spec.at ?? 0);
    const osc = ctx.createOscillator();
    osc.type = spec.type;
    osc.frequency.setValueAtTime(spec.freq, at);
    if (spec.freqEnd) osc.frequency.exponentialRampToValueAtTime(spec.freqEnd, at + spec.dur);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(spec.gain, at);
    gain.gain.exponentialRampToValueAtTime(1e-4, at + (spec.decay ?? spec.dur));
    osc.connect(gain).connect(this.master!);
    osc.start(at);
    osc.stop(at + spec.dur + 0.02);
    this.track();
  }

  private track(): void {
    this.activeVoices++;
    window.setTimeout(() => this.activeVoices--, 100);
  }

  play(event: SoundEvent, intensity = 1): void {
    if (!this.ready) return;
    const level = Math.min(1, intensity);
    const variantScale = 1 + (this.nextVariant() - 2.5) * 0.018;
    switch (event) {
      case "keyDown":
        if (this.throttled(event, 8)) return;
        // Crisp tactile mechanical click transient (instant switch strike)
        this.noise({ dur: 0.014, gain: 0.28 * level, type: "bandpass", freq: 3800 * variantScale, q: 2.5 });
        // Keycap bottoming thud
        this.noise({ dur: 0.02, gain: 0.2 * level, type: "lowpass", freq: 1200 * variantScale });
        this.tone({ freq: 180 * variantScale, freqEnd: 100, dur: 0.025, gain: 0.08 * level, type: "triangle" });
        break;
      case "linkage":
        if (this.throttled(event, 10)) return;
        this.noise({ dur: 0.012, gain: 0.06 * level, type: "bandpass", freq: 3400 * variantScale, q: 3 });
        break;
      case "swish":
        if (this.throttled(event, 15)) return;
        this.noise({ dur: 0.03, gain: 0.05 * level, type: "bandpass", freq: 1500 * variantScale, q: 1.4 });
        break;
      case "impact":
        if (this.throttled(event, 10)) return;
        // Solid platen strike hammer crack
        this.noise({ dur: 0.035, gain: 0.65 * level, type: "lowpass", freq: 2800 * variantScale, decay: 0.03 });
        // Resonant cast-iron body thud
        this.tone({ freq: 240 * variantScale, freqEnd: 85, dur: 0.05, gain: 0.35 * level, type: "triangle", decay: 0.045 });
        // Crisp paper punch transient
        this.noise({ dur: 0.01, gain: 0.42 * level, type: "highpass", freq: 4200 * variantScale });
        break;
      case "rest":
        if (this.throttled(event, 10)) return;
        this.noise({ dur: 0.02, gain: 0.08 * level, type: "lowpass", freq: 650 * variantScale });
        break;
      case "escapement":
        if (this.throttled(event, 10)) return;
        this.noise({ dur: 0.015, gain: 0.16 * level, type: "bandpass", freq: 2800 * variantScale, q: 4 });
        this.tone({ freq: 2100 * variantScale, dur: 0.015, gain: 0.05 * level, type: "square", decay: 0.012 });
        break;
      case "space":
        if (this.throttled(event, 10)) return;
        this.noise({ dur: 0.035, gain: 0.38 * level, type: "lowpass", freq: 600 * variantScale });
        this.noise({ dur: 0.015, gain: 0.22 * level, type: "bandpass", freq: 2600 * variantScale, q: 2.8 });
        this.tone({ freq: 105 * variantScale, dur: 0.045, gain: 0.2 * level, type: "sine" });
        break;
      case "backspace":
        if (this.throttled(event, 10)) return;
        this.noise({ dur: 0.03, gain: 0.26 * level, type: "lowpass", freq: 800 * variantScale });
        this.noise({ dur: 0.02, gain: 0.2 * level, type: "bandpass", freq: 3000 * variantScale, q: 3.5 });
        this.tone({ freq: 420 * variantScale, freqEnd: 200, dur: 0.035, gain: 0.12 * level, type: "sawtooth" });
        break;
      case "bell": {
        const base = 2080 * variantScale;
        this.tone({ freq: base, dur: 0.9, gain: 0.16, type: "sine", decay: 0.7 });
        this.tone({ freq: base * 2.76, dur: 0.4, gain: 0.05, type: "sine", decay: 0.35 });
        this.noise({ dur: 0.008, gain: 0.1, type: "highpass", freq: 5000 });
        break;
      }
      case "returnPull":
        this.noise({ dur: 0.12, gain: 0.18 * level, type: "bandpass", freq: 900, q: 1.2 });
        break;
      case "returnFly": {
        this.noise({ dur: 0.3, gain: 0.3 * level, type: "bandpass", freq: 1300, q: 0.9, gainCurve: "linear" });
        for (let i = 0; i < 6; i++) {
          this.noise({ at: 0.05 + i * 0.045, dur: 0.015, gain: 0.12, type: "bandpass", freq: 2500 * variantScale, q: 5 });
        }
        this.noise({ at: 0.32, dur: 0.05, gain: 0.4 * level, type: "lowpass", freq: 900 });
        break;
      }
      case "ratchet":
        this.noise({ dur: 0.02, gain: 0.16, type: "bandpass", freq: 1900, q: 5 });
        this.noise({ at: 0.05, dur: 0.02, gain: 0.16, type: "bandpass", freq: 2300, q: 5 });
        break;
      case "paperIn":
        this.noise({ dur: 0.25, gain: 0.12, type: "bandpass", freq: 2400, q: 0.6, gainCurve: "linear" });
        break;
      case "paperOut":
        this.noise({ dur: 0.35, gain: 0.16, type: "bandpass", freq: 3000, q: 0.6, gainCurve: "linear" });
        break;
      case "shift":
        this.tone({ freq: 80, dur: 0.09, gain: 0.12, type: "sine" });
        this.noise({ dur: 0.07, gain: 0.1, type: "lowpass", freq: 600 });
        break;
      case "clash":
        this.noise({ dur: 0.03, gain: 0.2, type: "bandpass", freq: 1600, q: 2.5 });
        this.tone({ freq: 320, dur: 0.05, gain: 0.08, type: "triangle" });
        break;
      case "explodeMove":
        if (this.throttled(event, 90)) return;
        this.noise({ dur: 0.18, gain: 0.07, type: "bandpass", freq: 1100 * variantScale, q: 1.6 });
        break;
      case "assembleMove":
        if (this.throttled(event, 90)) return;
        this.noise({ dur: 0.15, gain: 0.06, type: "bandpass", freq: 850 * variantScale, q: 1.6 });
        break;
    }
  }
}
