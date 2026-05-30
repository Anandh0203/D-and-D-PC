// Cinematic Web Audio API sound synthesizer
// No external assets required — 100% stable, offline-capable synthesized high-end soundscapes!

class CinematicSynth {
  private ctx: AudioContext | null = null;

  private init() {
    if (!this.ctx) {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtxClass) {
        this.ctx = new AudioCtxClass();
      }
    }
    // Resume if suspended
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume();
    }
  }

  // 1. Grand Opening Theater Intro (Rising sub-bass and celestial major chord)
  public playGrandOpening() {
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    
    // Sub-bass drone running from 45Hz moving up to 90Hz (The Cinematic Hum)
    const subOsc = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    const subFilter = this.ctx.createBiquadFilter();

    subOsc.type = "sawtooth";
    subOsc.frequency.setValueAtTime(45, now);
    // Move pitch up slowly
    subOsc.frequency.exponentialRampToValueAtTime(85, now + 4);

    subFilter.type = "lowpass";
    subFilter.frequency.setValueAtTime(100, now);
    subFilter.frequency.exponentialRampToValueAtTime(180, now + 4.5);

    subGain.gain.setValueAtTime(0, now);
    subGain.gain.linearRampToValueAtTime(0.40, now + 2);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 5.5);

    subOsc.connect(subFilter);
    subFilter.connect(subGain);
    subGain.connect(this.ctx.destination);

    subOsc.start(now);
    subOsc.stop(now + 6);

    // Orchestral Golden Major Chord (Frequencies of C major celestial spread: C3, G3, C4, E4, G4, C5)
    const chordFreqs = [130.81, 196.00, 261.63, 329.63, 392.00, 523.25];
    
    chordFreqs.forEach((freq, idx) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      // Warm sawtooth/triangle blend
      osc.type = idx % 2 === 0 ? "sawtooth" : "triangle";
      osc.frequency.setValueAtTime(freq - 5, now); // slightly flat for chorus
      osc.frequency.exponentialRampToValueAtTime(freq, now + 3);

      gain.gain.setValueAtTime(0, now);
      // Stagger entrance slightly for dramatic build
      const startOffset = idx * 0.15;
      gain.gain.setValueAtTime(0, now + startOffset);
      gain.gain.linearRampToValueAtTime(0.12, now + startOffset + 1.5);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 4.5 + startOffset);

      // Connect to lowpass to keep it warm and analog
      const filter = this.ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(300, now);
      filter.frequency.exponentialRampToValueAtTime(1200, now + 3);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now + startOffset);
      osc.stop(now + 5.5 + startOffset);
    });

    // Twinkling cosmic shimmer in background (bell-like high pass)
    for (let i = 0; i < 4; i++) {
      const tOsc = this.ctx.createOscillator();
      const tGain = this.ctx.createGain();
      tOsc.type = "sine";
      tOsc.frequency.setValueAtTime(1200 + i * 400, now + 2.5 + i * 0.2);
      
      tGain.gain.setValueAtTime(0, now);
      tGain.gain.setValueAtTime(0, now + 2.5 + i * 0.2);
      tGain.gain.linearRampToValueAtTime(0.03, now + 2.7 + i * 0.2);
      tGain.gain.exponentialRampToValueAtTime(0.0001, now + 3.8 + i * 0.2);

      tOsc.connect(tGain);
      tGain.connect(this.ctx.destination);

      tOsc.start(now + 2.5 + i * 0.2);
      tOsc.stop(now + 4);
    }
  }

  // 2. Thrilling Tension FX (For fading text)
  public playTensionSwell() {
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = "sine";
    // Pitch rises and oscillates (tremolo vibrato effect)
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.linearRampToValueAtTime(220, now + 3);

    // Filter frequency sweeps down for tension
    filter.type = "peaking";
    filter.frequency.setValueAtTime(400, now);
    filter.frequency.exponentialRampToValueAtTime(100, now + 3);
    filter.Q.setValueAtTime(10, now);

    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.15, now + 1.5);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 3.5);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 3.6);
  }

  // 3. Emotional/Cutesy Duckie Emoji Chime (Bright bouncy bell sound)
  public playDuckieSound() {
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    
    // Play a delightful cute high major chime
    const freqs = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    
    freqs.forEach((f, idx) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = "sine";
      osc.frequency.setValueAtTime(f, now + idx * 0.05);

      gain.gain.setValueAtTime(0, now);
      gain.gain.setValueAtTime(0, now + idx * 0.05);
      gain.gain.linearRampToValueAtTime(0.12, now + idx * 0.05 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.05 + 0.6);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now + idx * 0.05);
      osc.stop(now + idx * 0.05 + 0.7);
    });
  }

  // 4. Energetic Dobby Emoji Sparkle (Magical ringing synthesiser sound)
  public playDobbySound() {
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    
    const freqs = [293.66, 440.00, 587.33, 880.00]; // D4, A4, D5, A5 (Gold Fifth Interval)
    
    freqs.forEach((f, idx) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = "triangle";
      osc.frequency.setValueAtTime(f, now + idx * 0.04);
      osc.frequency.exponentialRampToValueAtTime(f * 2, now + idx * 0.04 + 0.3); // Pitch slide up!

      gain.gain.setValueAtTime(0, now);
      gain.gain.setValueAtTime(0, now + idx * 0.04);
      gain.gain.linearRampToValueAtTime(0.08, now + idx * 0.04 + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.04 + 0.5);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now + idx * 0.04);
      osc.stop(now + idx * 0.04 + 0.6);
    });
  }

  // 5. Normal UI Click (Soft pop)
  public playSoftClick() {
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = "sine";
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.exponentialRampToValueAtTime(100, now + 0.1);
    
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    
    osc.start(now);
    osc.stop(now + 0.15);
  }
}

export const audioSynth = new CinematicSynth();
