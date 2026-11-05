import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AmbientAudioSynthesizer, ambientAudio } from './ambientAudio';

// Create a mock AudioContext for unit tests
function createMockAudioContext() {
  const dummyGain = {
    gain: { setValueAtTime: vi.fn(), value: 0.5 },
    connect: vi.fn(),
    disconnect: vi.fn()
  };

  const dummyFilter = {
    type: 'lowpass',
    frequency: { setValueAtTime: vi.fn() },
    Q: { setValueAtTime: vi.fn() },
    connect: vi.fn(),
    disconnect: vi.fn()
  };

  const dummySource = {
    buffer: null,
    loop: false,
    connect: vi.fn(),
    disconnect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn()
  };

  const dummyOsc = {
    type: 'sine',
    frequency: { setValueAtTime: vi.fn() },
    connect: vi.fn(),
    disconnect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn()
  };

  const dummyPanner = {
    pan: { setValueAtTime: vi.fn() },
    connect: vi.fn(),
    disconnect: vi.fn()
  };

  return {
    state: 'running',
    currentTime: 10,
    sampleRate: 44100,
    destination: {},
    resume: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    createGain: vi.fn(() => ({ ...dummyGain })),
    createBiquadFilter: vi.fn(() => ({ ...dummyFilter })),
    createBufferSource: vi.fn(() => ({ ...dummySource })),
    createOscillator: vi.fn(() => ({ ...dummyOsc })),
    createStereoPanner: vi.fn(() => ({ ...dummyPanner })),
    createBuffer: vi.fn((channels, size, rate) => ({
      getChannelData: vi.fn(() => new Float32Array(size))
    }))
  };
}

describe('AmbientAudioSynthesizer', () => {
  let mockCtx: any;
  let synth: AmbientAudioSynthesizer;

  beforeEach(() => {
    mockCtx = createMockAudioContext();
    synth = new AmbientAudioSynthesizer(mockCtx);
  });

  it('initializes with default volume 0.5 and no sound playing', () => {
    expect(synth.isPlaying()).toBe(false);
    expect(synth.getCurrentSound()).toBe('none');
    expect(synth.getVolume()).toBe(0.5);
  });

  it('clamps volume between 0.0 and 1.0', () => {
    synth.setVolume(1.5);
    expect(synth.getVolume()).toBe(1.0);

    synth.setVolume(-0.2);
    expect(synth.getVolume()).toBe(0.0);

    synth.setVolume(0.75);
    expect(synth.getVolume()).toBe(0.75);
  });

  it('synthesizes white noise with buffer and filter', async () => {
    const success = await synth.play('white');
    expect(success).toBe(true);
    expect(synth.isPlaying()).toBe(true);
    expect(synth.getCurrentSound()).toBe('white');
    expect(mockCtx.createBufferSource).toHaveBeenCalled();
    expect(mockCtx.createBiquadFilter).toHaveBeenCalled();
  });

  it('synthesizes brown noise with integration buffer', async () => {
    const success = await synth.play('brown');
    expect(success).toBe(true);
    expect(synth.getCurrentSound()).toBe('brown');
    expect(mockCtx.createBuffer).toHaveBeenCalled();
  });

  it('synthesizes binaural 40Hz gamma beats with 2 oscillators', async () => {
    const success = await synth.play('binaural');
    expect(success).toBe(true);
    expect(synth.getCurrentSound()).toBe('binaural');
    expect(mockCtx.createOscillator).toHaveBeenCalledTimes(2);
    expect(mockCtx.createStereoPanner).toHaveBeenCalledTimes(2);
  });

  it('synthesizes rain with noise bed and dual filters', async () => {
    const success = await synth.play('rain');
    expect(success).toBe(true);
    expect(synth.getCurrentSound()).toBe('rain');
    expect(mockCtx.createBiquadFilter).toHaveBeenCalled();
  });

  it('stops and cleans up active nodes cleanly', async () => {
    await synth.play('white');
    expect(synth.isPlaying()).toBe(true);

    synth.stop();
    expect(synth.isPlaying()).toBe(false);
    expect(synth.getCurrentSound()).toBe('none');
  });

  it('handles play(none) by stopping playback', async () => {
    await synth.play('rain');
    await synth.play('none');
    expect(synth.isPlaying()).toBe(false);
    expect(synth.getCurrentSound()).toBe('none');
  });

  it('exported singleton ambientAudio exists and has proper API', () => {
    expect(ambientAudio).toBeDefined();
    expect(typeof ambientAudio.play).toBe('function');
    expect(typeof ambientAudio.stop).toBe('function');
    expect(typeof ambientAudio.setVolume).toBe('function');
  });
});
