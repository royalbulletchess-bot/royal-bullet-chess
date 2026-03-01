'use client';

type SoundType =
  | 'move'
  | 'capture'
  | 'check'
  | 'castle'
  | 'checkmate'
  | 'gameStart'
  | 'lowTime'
  | 'promote';

class SoundManager {
  private ctx: AudioContext | null = null;
  private enabled = true;

  private getContext(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  private playTone(
    frequency: number,
    duration: number,
    type: OscillatorType = 'sine',
    gain = 0.3
  ) {
    if (!this.enabled) return;
    try {
      const ctx = this.getContext();
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();
      osc.type = type;
      osc.frequency.value = frequency;
      gainNode.gain.setValueAtTime(gain, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(
        0.01,
        ctx.currentTime + duration
      );
      osc.connect(gainNode);
      gainNode.connect(ctx.destination);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + duration);
    } catch {
      // Audio not available
    }
  }

  play(sound: SoundType) {
    switch (sound) {
      case 'move':
        this.playTone(200, 0.05, 'sine', 0.2);
        break;
      case 'capture':
        this.playTone(300, 0.08, 'square', 0.25);
        break;
      case 'check':
        this.playTone(400, 0.06, 'sine', 0.3);
        setTimeout(() => this.playTone(500, 0.06, 'sine', 0.3), 80);
        break;
      case 'castle':
        this.playTone(250, 0.06, 'sine', 0.2);
        setTimeout(() => this.playTone(350, 0.06, 'sine', 0.2), 70);
        break;
      case 'checkmate':
        this.playTone(500, 0.1, 'sine', 0.3);
        setTimeout(() => this.playTone(400, 0.1, 'sine', 0.3), 120);
        setTimeout(() => this.playTone(300, 0.15, 'sine', 0.3), 240);
        break;
      case 'gameStart':
        this.playTone(300, 0.08, 'sine', 0.2);
        setTimeout(() => this.playTone(400, 0.08, 'sine', 0.2), 100);
        setTimeout(() => this.playTone(500, 0.1, 'sine', 0.2), 200);
        break;
      case 'lowTime':
        this.playTone(600, 0.03, 'sine', 0.15);
        break;
      case 'promote':
        this.playTone(400, 0.06, 'sine', 0.25);
        setTimeout(() => this.playTone(600, 0.08, 'sine', 0.25), 80);
        break;
    }
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
  }
}

export const soundManager = new SoundManager();
