
import { SonificationMode, WikipediaArticle } from '../types';

class AudioManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private oscillators: Set<{ 
    stop: () => void; 
    disconnect: () => void; 
    updatePanning: (heading: number) => void;
  }> = new Set();
  private melodyTimeout: number | null = null;
  private activeUpdateId: number = 0;
  private chatterInterval: number | null = null;
  private voices: SpeechSynthesisVoice[] = [];
  private currentHeading: number = 0;

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
      this.masterGain.gain.value = 1.0;
      this.masterGain.connect(this.ctx.destination);
    } catch (e) {
      console.error("Audio initialization failed", e);
    }
  }

  public async resume() {
    if (!this.ctx) this.init();
    if (this.ctx && this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
  }

  public setHeading(heading: number) {
    this.currentHeading = heading;
    this.oscillators.forEach(osc => osc.updatePanning(heading));
  }

  public stopAll() {
    this.activeUpdateId++;
    
    this.oscillators.forEach(node => {
      try {
        node.stop();
        node.disconnect();
      } catch (e) {}
    });
    this.oscillators.clear();

    if (this.melodyTimeout) {
      window.clearTimeout(this.melodyTimeout);
      this.melodyTimeout = null;
    }
    if (this.chatterInterval) {
      window.clearInterval(this.chatterInterval);
      this.chatterInterval = null;
    }

    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  }

  public async update(mode: SonificationMode, articles: WikipediaArticle[], radius: number, heading: number) {
    this.currentHeading = heading;
    if (!this.ctx) this.init();
    await this.resume();

    this.stopAll();
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

    articles.slice(0, 12).forEach(article => {
      const distRatio = Math.max(0, Math.min(1, 1 - article.dist / radius));
      const activityScore = Math.min(1, Math.log10((article.editCount || 0) + 1) / 4);
      
      const groupGain = this.ctx!.createGain();
      const panner = this.ctx!.createStereoPanner();
      const breathingLfo = this.ctx!.createOscillator();
      const lfoGain = this.ctx!.createGain();

      // Create a small cluster of partials for a "ghostly" choir effect
      const partialsCount = 1 + Math.floor(activityScore * 3);
      const oscNodes: OscillatorNode[] = [];

      for (let i = 0; i < partialsCount; i++) {
        const osc = this.ctx!.createOscillator();
        const baseFreq = 120 + (distRatio * 200);
        // Harmonic series + slight detune based on activity
        const freq = baseFreq * (i + 1) + (activityScore * 2 * Math.random());
        osc.frequency.setValueAtTime(freq, this.ctx!.currentTime);
        osc.type = i === 0 ? 'sine' : 'triangle';
        
        const partialGain = this.ctx!.createGain();
        partialGain.gain.setValueAtTime(0.1 / (i + 1), this.ctx!.currentTime);
        
        osc.connect(partialGain);
        partialGain.connect(groupGain);
        osc.start();
        oscNodes.push(osc);
      }

      // Breathing effect
      breathingLfo.frequency.setValueAtTime(0.1 + (Math.random() * 0.2), this.ctx!.currentTime);
      lfoGain.gain.setValueAtTime(0.2, this.ctx!.currentTime);
      breathingLfo.connect(lfoGain);
      lfoGain.connect(groupGain.gain);
      breathingLfo.start();

      groupGain.gain.setValueAtTime(0, this.ctx!.currentTime);
      const targetVolume = 0.25 * distRatio * (0.3 + 0.7 * activityScore);
      groupGain.gain.linearRampToValueAtTime(targetVolume, this.ctx!.currentTime + 1.5);

      const updatePanning = (h: number) => {
        const relativeBearing = (article.bearing! - h + 360) % 360;
        panner.pan.setTargetAtTime(Math.sin(relativeBearing * Math.PI / 180), this.ctx!.currentTime, 0.2);
      };
      updatePanning(this.currentHeading);

      groupGain.connect(panner);
      panner.connect(this.masterGain!);

      this.oscillators.add({
        stop: () => {
          try {
            groupGain.gain.linearRampToValueAtTime(0, this.ctx!.currentTime + 0.5);
            oscNodes.forEach(o => o.stop(this.ctx!.currentTime + 0.6));
            breathingLfo.stop(this.ctx!.currentTime + 0.6);
          } catch(e) {}
        },
        disconnect: () => { 
          oscNodes.forEach(o => o.disconnect()); 
          groupGain.disconnect(); 
          panner.disconnect(); 
          breathingLfo.disconnect();
          lfoGain.disconnect();
        },
        updatePanning
      });
    });
  }

  private startCacophony(articles: WikipediaArticle[], radius: number, activeId: number) {
    if (!this.ctx || !this.masterGain) return;

    // 1. Base Low-End Drone
    const drone = this.ctx.createOscillator();
    const droneGain = this.ctx.createGain();
    const lp = this.ctx.createBiquadFilter();
    drone.type = 'sawtooth';
    drone.frequency.setValueAtTime(55, this.ctx.currentTime);
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(300, this.ctx.currentTime);
    droneGain.gain.setValueAtTime(0, this.ctx.currentTime);
    droneGain.gain.linearRampToValueAtTime(0.06, this.ctx.currentTime + 2);
    drone.connect(lp);
    lp.connect(droneGain);
    droneGain.connect(this.masterGain);
    drone.start();

    this.oscillators.add({
      stop: () => { try { drone.stop(); } catch(e) {} },
      disconnect: () => { drone.disconnect(); droneGain.disconnect(); lp.disconnect(); },
      updatePanning: () => {}
    });

    // 2. Crowd Murmur
    const murmurDensity = Math.min(Math.floor(articles.length / 2), 10);
    for (let i = 0; i < murmurDensity; i++) {
      const babbleOsc = this.ctx.createOscillator();
      const babbleGain = this.ctx.createGain();
      const formantFilter = this.ctx.createBiquadFilter();
      const panner = this.ctx.createStereoPanner();

      babbleOsc.type = 'sawtooth';
      const baseFreq = 80 + Math.random() * 120;
      babbleOsc.frequency.setValueAtTime(baseFreq, this.ctx.currentTime);

      formantFilter.type = 'bandpass';
      formantFilter.frequency.setValueAtTime(400 + Math.random() * 1000, this.ctx.currentTime);
      formantFilter.Q.setValueAtTime(5, this.ctx.currentTime);

      babbleGain.gain.setValueAtTime(0, this.ctx.currentTime);
      babbleGain.gain.linearRampToValueAtTime(0.025, this.ctx.currentTime + 1.5);

      const targetArticle = articles[i % articles.length];
      const updatePanning = (h: number) => {
        const relativeBearing = (targetArticle.bearing! - h + 360) % 360;
        panner.pan.setTargetAtTime(Math.sin(relativeBearing * Math.PI / 180), this.ctx.currentTime, 0.2);
      };
      updatePanning(this.currentHeading);

      const lfo = this.ctx.createOscillator();
      const lfoGain = this.ctx.createGain();
      lfo.frequency.setValueAtTime(0.5 + Math.random() * 2, this.ctx.currentTime);
      lfoGain.gain.setValueAtTime(150, this.ctx.currentTime);
      lfo.connect(lfoGain);
      lfoGain.connect(formantFilter.frequency);
      lfo.start();

      babbleOsc.connect(formantFilter);
      formantFilter.connect(babbleGain);
      babbleGain.connect(panner);
      panner.connect(this.masterGain);
      babbleOsc.start();

      this.oscillators.add({
        stop: () => { try { babbleOsc.stop(); lfo.stop(); } catch(e) {} },
        disconnect: () => { babbleOsc.disconnect(); formantFilter.disconnect(); babbleGain.disconnect(); lfo.disconnect(); panner.disconnect(); },
        updatePanning
      });
    }

    // 3. Whisper Layer (Noise)
    const noiseBuffer = this.ctx.createBuffer(1, this.ctx.sampleRate * 2, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < this.ctx.sampleRate * 2; i++) {
      output[i] = Math.random() * 2 - 1;
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = noiseBuffer;
    noise.loop = true;
    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.setValueAtTime(2000, this.ctx.currentTime);
    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0, this.ctx.currentTime);
    noiseGain.gain.linearRampToValueAtTime(Math.min(0.012 * (articles.length / 5), 0.04), this.ctx.currentTime + 3);
    
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.masterGain);
    noise.start();
    this.oscillators.add({
      stop: () => { try { noise.stop(); } catch(e) {} },
      disconnect: () => { noise.disconnect(); noiseFilter.disconnect(); noiseGain.disconnect(); },
      updatePanning: () => {}
    });

    // 4. Speech Synthesis
    const chatter = () => {
      if (this.activeUpdateId !== activeId || !window.speechSynthesis) return;
      const article = articles[Math.floor(Math.random() * articles.length)];
      if (!article) return;
      const sentences = (article.extract || article.title).split(/[.!?]/).filter(s => s.trim().length > 5);
      const sentence = sentences[Math.floor(Math.random() * sentences.length)]?.trim() || article.title;
      const utter = new SpeechSynthesisUtterance(sentence);
      utter.pitch = 0.5 + Math.random() * 1.5;
      utter.rate = 0.8 + Math.random() * 0.7;
      utter.volume = Math.max(0.3, 1 - (article.dist / radius));
      if (this.voices.length > 0) utter.voice = this.voices[Math.floor(Math.random() * this.voices.length)];
      window.speechSynthesis.speak(utter);
    };

    chatter();
    const intervalTime = Math.max(1200, 4500 - (articles.length * 120));
    this.chatterInterval = window.setInterval(chatter, intervalTime);
  }

  private startMelody(articles: WikipediaArticle[], radius: number, activeId: number) {
    if (!this.ctx || !this.masterGain) return;

    let index = 0;
    const playNext = () => {
      if (this.activeUpdateId !== activeId || !this.ctx) return;
      const article = articles[index];
      if (!article) return;

      const distRatio = Math.max(0.1, 1 - article.dist / radius);
      const activityScore = Math.min(1, Math.log10((article.editCount || 0) + 1) / 4);
      
      const scale = [261.63, 293.66, 329.63, 349.23, 392.00, 440.00, 493.88, 523.25]; 
      const freq = scale[(article.pageid || 0) % scale.length];

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const panner = this.ctx.createStereoPanner();
      const filter = this.ctx.createBiquadFilter();
      
      // Timbre shifts based on activity
      osc.type = activityScore > 0.6 ? 'square' : activityScore > 0.3 ? 'sawtooth' : 'triangle';
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      
      // Filter for resonance
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(activityScore * 2000 + 400, this.ctx.currentTime);
      filter.Q.setValueAtTime(activityScore * 10, this.ctx.currentTime);

      const updatePanning = (h: number) => {
        const relativeBearing = (article.bearing! - h + 360) % 360;
        panner.pan.setTargetAtTime(Math.sin(relativeBearing * Math.PI / 180), this.ctx.currentTime, 0.1);
      };
      updatePanning(this.currentHeading);

      const noteDuration = 0.5 + (activityScore * 2.0);
      const noteVolume = 0.35 * distRatio * (0.2 + 0.8 * activityScore);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(panner);
      panner.connect(this.masterGain!);
      
      // Simple Envelope
      gain.gain.setValueAtTime(0, this.ctx.currentTime);
      gain.gain.linearRampToValueAtTime(noteVolume, this.ctx.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + noteDuration);

      // Simple Echo/Delay for interest
      const delay = this.ctx.createDelay();
      const delayGain = this.ctx.createGain();
      delay.delayTime.value = 0.4;
      delayGain.gain.value = 0.3;
      panner.connect(delay);
      delay.connect(delayGain);
      delayGain.connect(this.masterGain!);

      osc.start();
      osc.stop(this.ctx.currentTime + noteDuration + 0.2);
      
      this.oscillators.add({
        stop: () => { try { osc.stop(); } catch(e) {} },
        disconnect: () => { 
          osc.disconnect(); 
          filter.disconnect(); 
          gain.disconnect(); 
          panner.disconnect(); 
          delay.disconnect(); 
          delayGain.disconnect(); 
        },
        updatePanning
      });

      index = (index + 1) % articles.length;
      const nextDelay = Math.max(300, (1200 - (activityScore * 600)) + Math.random() * 400);
      this.melodyTimeout = window.setTimeout(playNext, nextDelay);
    };

    playNext();
  }
}

export const audioManager = new AudioManager();
