
import { SonificationMode, WikipediaArticle } from '../types';

class AudioManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private oscillators: Set<{ stop: () => void; disconnect: () => void }> = new Set();
  private melodyTimeout: number | null = null;
  private activeUpdateId: number = 0;
  private chatterInterval: number | null = null;
  private voices: SpeechSynthesisVoice[] = [];

  constructor() {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      const loadVoices = () => {
        this.voices = window.speechSynthesis.getVoices();
      };
      loadVoices();
      if (window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = loadVoices;
      }
    }
  }

  public init() {
    if (this.ctx) return;
    try {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)({
        latencyHint: 'interactive'
      });
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 1.0; // Full volume for master
      this.masterGain.connect(this.ctx.destination);
      console.log("Audio Context Initialized. State:", this.ctx.state);
    } catch (e) {
      console.error("Audio initialization failed", e);
    }
  }

  public async resume() {
    if (!this.ctx) this.init();
    if (this.ctx && this.ctx.state === 'suspended') {
      await this.ctx.resume();
      console.log("Audio Context Resumed. State:", this.ctx.state);
    }
  }

  public stopAll() {
    this.activeUpdateId++; // Increment to invalidate previous async loops
    
    // Stop Web Audio
    this.oscillators.forEach(node => {
      try {
        node.stop();
        node.disconnect();
      } catch (e) {}
    });
    this.oscillators.clear();

    // Clear Timouts/Intervals
    if (this.melodyTimeout) {
      window.clearTimeout(this.melodyTimeout);
      this.melodyTimeout = null;
    }
    if (this.chatterInterval) {
      window.clearInterval(this.chatterInterval);
      this.chatterInterval = null;
    }

    // Cancel Speech
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  }

  public async update(mode: SonificationMode, articles: WikipediaArticle[], radius: number) {
    if (!this.ctx) this.init();
    await this.resume();

    const currentUpdateId = ++this.activeUpdateId;
    this.stopAll();
    
    // Re-verify current update ID after stopAll (which increments it)
    const activeId = this.activeUpdateId;
    if (articles.length === 0) return;

    switch (mode) {
      case SonificationMode.AMBIENT:
        this.startAmbient(articles, radius, activeId);
        break;
      case SonificationMode.CACOPHONY:
        this.startCacophony(articles, radius, activeId);
        break;
      case SonificationMode.MELODY:
        this.startMelody(articles, radius, activeId);
        break;
    }
  }

  private startAmbient(articles: WikipediaArticle[], radius: number, activeId: number) {
    if (!this.ctx || !this.masterGain) return;

    articles.slice(0, 15).forEach(article => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      const panner = this.ctx!.createStereoPanner();

      const distRatio = Math.max(0, Math.min(1, 1 - article.dist / radius));
      
      // Audible Mid-Low range (150Hz - 450Hz)
      osc.type = 'sine';
      osc.frequency.setValueAtTime(150 + (distRatio * 300), this.ctx!.currentTime);
      
      const volume = 0.25 * distRatio;
      gain.gain.setValueAtTime(0, this.ctx!.currentTime);
      gain.gain.linearRampToValueAtTime(volume, this.ctx!.currentTime + 0.5);

      const pan = Math.sin((article.bearing || 0) * Math.PI / 180);
      panner.pan.setValueAtTime(pan, this.ctx!.currentTime);

      osc.connect(gain);
      gain.connect(panner);
      panner.connect(this.masterGain!);
      
      osc.start();
      this.oscillators.add({
        stop: () => {
          try {
            gain.gain.linearRampToValueAtTime(0, this.ctx!.currentTime + 0.2);
            osc.stop(this.ctx!.currentTime + 0.25);
          } catch(e) {}
        },
        disconnect: () => { osc.disconnect(); gain.disconnect(); panner.disconnect(); }
      });
    });
  }

  private startCacophony(articles: WikipediaArticle[], radius: number, activeId: number) {
    if (!this.ctx || !this.masterGain) return;

    // 1. Background "Vocal Buzz" (Sawtooth Low-Pass)
    const drone = this.ctx.createOscillator();
    const droneGain = this.ctx.createGain();
    const lp = this.ctx.createBiquadFilter();
    
    drone.type = 'sawtooth';
    drone.frequency.setValueAtTime(65, this.ctx.currentTime); // C2 frequency
    
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(400, this.ctx.currentTime);
    lp.Q.setValueAtTime(10, this.ctx.currentTime); // Resonant "talky" peak

    droneGain.gain.setValueAtTime(0, this.ctx.currentTime);
    droneGain.gain.linearRampToValueAtTime(0.08, this.ctx.currentTime + 1);

    drone.connect(lp);
    lp.connect(droneGain);
    droneGain.connect(this.masterGain);
    drone.start();

    this.oscillators.add({
      stop: () => { try { drone.stop(); } catch(e) {} },
      disconnect: () => { drone.disconnect(); droneGain.disconnect(); lp.disconnect(); }
    });

    // 2. Multi-vocal Speech Synthesis Loop
    const chatter = () => {
      // Logic Check: Ensure we haven't switched modes or locations
      if (this.activeUpdateId !== activeId || !window.speechSynthesis) return;

      const article = articles[Math.floor(Math.random() * articles.length)];
      const text = article.extract || article.title;
      const sentences = text.split(/[.!?]/).filter(s => s.trim().length > 5);
      const sentence = sentences[Math.floor(Math.random() * sentences.length)]?.trim() || article.title;
      
      const utter = new SpeechSynthesisUtterance(sentence);
      
      // Dynamic Voice Variation for "Friction"
      utter.pitch = 0.4 + Math.random() * 1.6;
      utter.rate = 0.9 + Math.random() * 0.6;
      utter.volume = Math.max(0.5, 1 - (article.dist / radius));
      
      if (this.voices.length > 0) {
        // Filter for diverse voices if available
        utter.voice = this.voices[Math.floor(Math.random() * this.voices.length)];
      }

      window.speechSynthesis.speak(utter);
    };

    chatter();
    this.chatterInterval = window.setInterval(chatter, 2000);
  }

  private startMelody(articles: WikipediaArticle[], radius: number, activeId: number) {
    if (!this.ctx || !this.masterGain) return;

    let index = 0;
    const playNext = () => {
      if (this.activeUpdateId !== activeId || !this.ctx) return;
      
      const article = articles[index];
      const distRatio = Math.max(0.1, 1 - article.dist / radius);
      
      // Bright Pentatonic Scale (C4-C5)
      const scale = [261.63, 293.66, 329.63, 392.00, 440.00, 523.25]; 
      const freq = scale[(article.pageid || 0) % scale.length];

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const panner = this.ctx.createStereoPanner();

      osc.type = 'triangle'; // Softer than square, richer than sine
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      
      const pan = Math.sin((article.bearing || 0) * Math.PI / 180);
      panner.pan.setValueAtTime(pan, this.ctx.currentTime);

      gain.gain.setValueAtTime(0, this.ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.4 * distRatio, this.ctx.currentTime + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 1.2);

      osc.connect(panner);
      panner.connect(gain);
      gain.connect(this.masterGain!);

      osc.start();
      osc.stop(this.ctx.currentTime + 1.3);
      
      this.oscillators.add({
        stop: () => { try { osc.stop(); } catch(e) {} },
        disconnect: () => { osc.disconnect(); panner.disconnect(); gain.disconnect(); }
      });

      index = (index + 1) % articles.length;
      this.melodyTimeout = window.setTimeout(playNext, 600 + Math.random() * 800);
    };

    playNext();
  }
}

export const audioManager = new AudioManager();
