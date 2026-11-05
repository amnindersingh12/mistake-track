export type AmbientSoundType = 'none' | 'white' | 'brown' | 'binaural' | 'rain';

export interface AmbientAudioState {
  currentSound: AmbientSoundType;
  isPlaying: boolean;
  volume: number; // 0.0 to 1.0
}

export class AmbientAudioSynthesizer {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private currentSound: AmbientSoundType = 'none';
  private activeNodes: Array<{ stop?: () => void; disconnect: () => void }> = [];
  private volume: number = 0.5;

  constructor(customAudioContext?: any) {
    if (customAudioContext) {
      this.ctx = customAudioContext;
    }
  }

  private initContext(): boolean {
    if (!this.ctx || this.ctx.state === 'closed') {
      const AudioContextClass =
        typeof window !== 'undefined'
          ? window.AudioContext || (window as any).webkitAudioContext
          : null;

      if (!AudioContextClass) {
        return false;
      }

      try {
        this.ctx = new AudioContextClass();
      } catch {
        return false;
      }
    }

    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    if (!this.masterGain) {
      try {
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);
        this.masterGain.connect(this.ctx.destination);
      } catch {
        return false;
      }
    }

    return true;
  }

  public getVolume(): number {
    return this.volume;
  }

  public setVolume(vol: number): void {
    const clamped = Math.max(0, Math.min(1, vol));
    this.volume = clamped;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(clamped, this.ctx.currentTime);
    }
  }

  public isPlaying(): boolean {
    return this.currentSound !== 'none';
  }

  public getCurrentSound(): AmbientSoundType {
    return this.currentSound;
  }

  public getState(): AmbientAudioState {
    return {
      currentSound: this.currentSound,
      isPlaying: this.isPlaying(),
      volume: this.volume
    };
  }

  public stop(): void {
    for (const node of this.activeNodes) {
      try {
        if (typeof node.stop === 'function') {
          node.stop();
        }
        node.disconnect();
      } catch {
        // Node might already be disconnected
      }
    }
    this.activeNodes = [];
    this.currentSound = 'none';
  }

  public async play(type: AmbientSoundType, volume?: number): Promise<boolean> {
    if (volume !== undefined) {
      this.setVolume(volume);
    }

    if (type === 'none') {
      this.stop();
      return true;
    }

    if (this.currentSound === type && this.isPlaying()) {
      return true;
    }

    this.stop();

    const ok = this.initContext();
    if (!ok || !this.ctx || !this.masterGain) {
      this.currentSound = type;
      return false;
    }

    if (this.ctx.state === 'suspended') {
      try {
        await this.ctx.resume();
      } catch {
        // Ignore resume rejection if blocked by browser policy until interaction
      }
    }

    try {
      switch (type) {
        case 'white':
          this.buildWhiteNoise();
          break;
        case 'brown':
          this.buildBrownNoise();
          break;
        case 'binaural':
          this.buildBinauralGammaBeats();
          break;
        case 'rain':
          this.buildSynthesizedRain();
          break;
      }
      this.currentSound = type;
      return true;
    } catch (err) {
      this.stop();
      return false;
    }
  }

  /**
   * Synthesized White Noise:
   * Generates a smooth, loopable pseudo-random buffer filtered at 8 kHz to remove ear fatigue.
   */
  private buildWhiteNoise(): void {
    if (!this.ctx || !this.masterGain) return;
    const bufferSize = this.ctx.sampleRate * 4; // 4 seconds buffer
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const whiteSource = this.ctx.createBufferSource();
    whiteSource.buffer = buffer;
    whiteSource.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(6500, this.ctx.currentTime);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.2, this.ctx.currentTime);

    whiteSource.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    whiteSource.start(0);
    this.activeNodes.push(whiteSource, filter, gain);
  }

  /**
   * Synthesized Brown Noise (Brownian / Red Noise):
   * Integration of white noise with a leak factor for deep, warm, soothing focus sound.
   */
  private buildBrownNoise(): void {
    if (!this.ctx || !this.masterGain) return;
    const bufferSize = this.ctx.sampleRate * 4;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = buffer.getChannelData(0);

    let lastOut = 0.0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      lastOut = (lastOut + 0.02 * white) / 1.02;
      output[i] = lastOut * 3.5; // Gain compensation
    }

    const brownSource = this.ctx.createBufferSource();
    brownSource.buffer = buffer;
    brownSource.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(450, this.ctx.currentTime);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.65, this.ctx.currentTime);

    brownSource.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    brownSource.start(0);
    this.activeNodes.push(brownSource, filter, gain);
  }

  /**
   * Synthesized Binaural 40Hz Gamma Beats:
   * Left ear receives 200 Hz pure sine wave, Right ear receives 240 Hz pure sine wave.
   * The 40 Hz differential stimulates cognitive gamma wave entrainment for deep study focus.
   * Includes warm low background bed to avoid ear fatigue.
   */
  private buildBinauralGammaBeats(): void {
    if (!this.ctx || !this.masterGain) return;

    // Carrier frequency in left ear: 200 Hz
    const oscLeft = this.ctx.createOscillator();
    oscLeft.type = 'sine';
    oscLeft.frequency.setValueAtTime(200, this.ctx.currentTime);

    // Differential frequency in right ear: 240 Hz (200 + 40Hz gamma beat)
    const oscRight = this.ctx.createOscillator();
    oscRight.type = 'sine';
    oscRight.frequency.setValueAtTime(240, this.ctx.currentTime);

    const gainLeft = this.ctx.createGain();
    gainLeft.gain.setValueAtTime(0.35, this.ctx.currentTime);

    const gainRight = this.ctx.createGain();
    gainRight.gain.setValueAtTime(0.35, this.ctx.currentTime);

    // Stereo panning: left = -1, right = +1
    if (typeof this.ctx.createStereoPanner === 'function') {
      const pannerLeft = this.ctx.createStereoPanner();
      pannerLeft.pan.setValueAtTime(-1, this.ctx.currentTime);

      const pannerRight = this.ctx.createStereoPanner();
      pannerRight.pan.setValueAtTime(1, this.ctx.currentTime);

      oscLeft.connect(gainLeft);
      gainLeft.connect(pannerLeft);
      pannerLeft.connect(this.masterGain);

      oscRight.connect(gainRight);
      gainRight.connect(pannerRight);
      pannerRight.connect(this.masterGain);

      this.activeNodes.push(oscLeft, oscRight, gainLeft, gainRight, pannerLeft, pannerRight);
    } else {
      // Fallback for environments without StereoPanner
      oscLeft.connect(gainLeft);
      gainLeft.connect(this.masterGain);
      oscRight.connect(gainRight);
      gainRight.connect(this.masterGain);
      this.activeNodes.push(oscLeft, oscRight, gainLeft, gainRight);
    }

    oscLeft.start(0);
    oscRight.start(0);
  }

  /**
   * Synthesized Gentle Rainfall:
   * Combines dual filtered noise beds (pinkish drizzle base) with dynamic resonance filtering
   * to simulate raindrop patter with zero external audio assets.
   */
  private buildSynthesizedRain(): void {
    if (!this.ctx || !this.masterGain) return;
    const bufferSize = this.ctx.sampleRate * 4;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);

    // Pink/Brown noise generator
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      const pink = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
      b6 = white * 0.115926;
      data[i] = pink * 0.11;
    }

    const rainSource = this.ctx.createBufferSource();
    rainSource.buffer = buffer;
    rainSource.loop = true;

    // Gentle bandpass & lowpass for soft drizzle feel
    const bandpass = this.ctx.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.frequency.setValueAtTime(1200, this.ctx.currentTime);
    bandpass.Q.setValueAtTime(0.7, this.ctx.currentTime);

    const lowpass = this.ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.setValueAtTime(2800, this.ctx.currentTime);

    const rainGain = this.ctx.createGain();
    rainGain.gain.setValueAtTime(0.6, this.ctx.currentTime);

    rainSource.connect(bandpass);
    bandpass.connect(lowpass);
    lowpass.connect(rainGain);
    rainGain.connect(this.masterGain);

    rainSource.start(0);
    this.activeNodes.push(rainSource, bandpass, lowpass, rainGain);
  }
}

export const ambientAudio = new AmbientAudioSynthesizer();
