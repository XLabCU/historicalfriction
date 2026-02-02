
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AppState, SonificationMode, Coordinates, WikipediaArticle } from './types';
import { fetchArticlesNear } from './services/wikipediaService';
import { audioManager } from './services/audioManager';
import Visualizer from './components/Visualizer';

const getDistance = (c1: Coordinates, c2: Coordinates) => {
  const R = 6371e3;
  const φ1 = c1.lat * Math.PI / 180;
  const φ2 = c2.lat * Math.PI / 180;
  const Δφ = (c2.lat - c1.lat) * Math.PI / 180;
  const Δλ = (c2.lng - c1.lng) * Math.PI / 180;
  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
          Math.cos(φ1) * Math.cos(φ2) *
          Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const App: React.FC = () => {
  const [state, setState] = useState<AppState>({
    location: { lat: 51.5074, lng: -0.1278 },
    radius: 1000,
    articles: [],
    mode: SonificationMode.AMBIENT,
    isAudioEnabled: false,
    isLoading: false,
    heading: 0,
  });

  const lastFetchedLocation = useRef<Coordinates | null>(null);
  const [manualInput, setManualInput] = useState({
    lat: '51.5074',
    lng: '-0.1278',
    radius: '1000'
  });

  const [orientationPermission, setOrientationPermission] = useState<'prompt' | 'granted' | 'denied'>(
    typeof DeviceOrientationEvent !== 'undefined' && 'requestPermission' in DeviceOrientationEvent ? 'prompt' : 'granted'
  );

  const loadArticles = useCallback(async (lat: number, lng: number, radius: number) => {
    setState(prev => ({ ...prev, isLoading: true }));
    try {
      const articles = await fetchArticlesNear(lat, lng, radius);
      lastFetchedLocation.current = { lat, lng };
      setState(prev => ({ ...prev, articles, isLoading: false }));
    } catch (error) {
      console.error("Failed to load articles", error);
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }, []);

  useEffect(() => {
    if (navigator.geolocation) {
      const watchId = navigator.geolocation.watchPosition((pos) => {
        const currentCoords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setState(prev => {
          const dist = lastFetchedLocation.current ? getDistance(lastFetchedLocation.current, currentCoords) : Infinity;
          if (dist > 30) {
            loadArticles(currentCoords.lat, currentCoords.lng, prev.radius);
          }
          return { ...prev, location: currentCoords };
        });
        setManualInput(prev => ({ ...prev, lat: currentCoords.lat.toString(), lng: currentCoords.lng.toString() }));
      }, (err) => {
        console.warn("Geolocation watch error or denied.", err);
      }, { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 });
      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, [loadArticles]);

  useEffect(() => {
    const handleOrientation = (e: DeviceOrientationEvent) => {
      let h = 0;
      if ('webkitCompassHeading' in e) {
        h = (e as any).webkitCompassHeading;
      } else if (e.alpha !== null) {
        h = 360 - e.alpha;
      }
      setState(prev => ({ ...prev, heading: h }));
      if (state.isAudioEnabled) {
        audioManager.setHeading(h);
      }
    };
    if (orientationPermission === 'granted') {
      window.addEventListener('deviceorientation', handleOrientation);
      return () => window.removeEventListener('deviceorientation', handleOrientation);
    }
  }, [orientationPermission, state.isAudioEnabled]);

  const requestOrientationPermission = async () => {
    if (typeof DeviceOrientationEvent !== 'undefined' && 'requestPermission' in DeviceOrientationEvent) {
      try {
        const permission = await (DeviceOrientationEvent as any).requestPermission();
        setOrientationPermission(permission === 'granted' ? 'granted' : 'denied');
      } catch (e) {
        console.error("Permission request failed", e);
      }
    } else {
      setOrientationPermission('granted');
    }
  };

  useEffect(() => {
    if (state.isAudioEnabled && state.articles.length > 0) {
      audioManager.update(state.mode, state.articles, state.radius, state.heading);
    } else if (!state.isAudioEnabled) {
      audioManager.stopAll();
    }
  }, [state.isAudioEnabled, state.mode, state.articles, state.radius]); 

  const toggleAudio = async () => {
    if (!state.isAudioEnabled) {
      audioManager.init();
      await audioManager.resume();
      if (orientationPermission === 'prompt') {
        await requestOrientationPermission();
      }
    }
    setState(prev => ({ ...prev, isAudioEnabled: !prev.isAudioEnabled }));
  };

  const handleUpdateLocation = () => {
    const lat = parseFloat(manualInput.lat);
    const lng = parseFloat(manualInput.lng);
    const rad = parseInt(manualInput.radius);
    if (!isNaN(lat) && !isNaN(lng) && !isNaN(rad)) {
      setState(prev => ({ ...prev, location: { lat, lng }, radius: rad }));
      loadArticles(lat, lng, rad);
    }
  };

  return (
    <div className="min-h-screen p-4 md:p-8 flex flex-col items-center bg-black selection:bg-violet-500 selection:text-white font-sans">
      <header className="max-w-2xl w-full text-center mb-12 space-y-6">
        <h1 className="text-4xl md:text-6xl font-normal tracking-tight serif text-violet-100 font-serif italic">
          Historical Friction
        </h1>
        <p className="text-lg md:text-xl text-neutral-400 font-serif leading-relaxed px-4 opacity-80">
          "History is all around us. The voices of the past thicken the air, calling out for your attention. When it all gets too much, pull the ear-buds out, stop, and look at where you are with fresh eyes, in the new silence..."
        </p>
      </header>

      <main className="max-w-6xl w-full grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-4 space-y-8 bg-neutral-900/40 p-6 rounded-2xl border border-neutral-800/60 backdrop-blur-md">
          <section className="space-y-4">
            <h2 className="text-[10px] font-bold uppercase tracking-[0.3em] text-violet-400 font-mono">Environment</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-[9px] text-neutral-500 font-mono uppercase tracking-wider">Lat</label>
                <input 
                  type="text" 
                  value={manualInput.lat}
                  onChange={e => setManualInput({...manualInput, lat: e.target.value})}
                  className="bg-black border border-neutral-800 rounded px-3 py-2 text-xs focus:border-violet-500 outline-none transition-colors font-mono"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[9px] text-neutral-500 font-mono uppercase tracking-wider">Lng</label>
                <input 
                  type="text" 
                  value={manualInput.lng}
                  onChange={e => setManualInput({...manualInput, lng: e.target.value})}
                  className="bg-black border border-neutral-800 rounded px-3 py-2 text-xs focus:border-violet-500 outline-none transition-colors font-mono"
                />
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[9px] text-neutral-500 font-mono uppercase tracking-wider">Radius (m): {state.radius}</label>
              <input 
                type="range" min="100" max="10000" step="100"
                value={state.radius}
                onChange={e => {
                  const r = parseInt(e.target.value);
                  setManualInput({...manualInput, radius: r.toString()});
                  setState(prev => ({...prev, radius: r}));
                }}
                className="w-full accent-violet-500"
              />
            </div>
            <button 
              onClick={handleUpdateLocation}
              disabled={state.isLoading}
              className="w-full bg-violet-600/90 hover:bg-violet-600 disabled:bg-neutral-800 text-white font-mono text-[11px] uppercase tracking-widest py-3 rounded-lg transition-all"
            >
              {state.isLoading ? 'Searching Past...' : 'Shift Location'}
            </button>
            {orientationPermission === 'prompt' && (
              <button 
                onClick={requestOrientationPermission}
                className="w-full mt-2 text-[9px] text-violet-400 uppercase tracking-widest font-mono border border-violet-900/30 py-2 rounded hover:bg-violet-900/10 transition-colors"
              >
                Sync Device Orientation
              </button>
            )}
          </section>

          <section className="space-y-4 border-t border-neutral-800 pt-6">
            <h2 className="text-[10px] font-bold uppercase tracking-[0.3em] text-violet-400 font-mono">Sonification Mode</h2>
            <div className="flex flex-col gap-2">
              {(Object.keys(SonificationMode) as Array<keyof typeof SonificationMode>).map((m) => (
                <button
                  key={m}
                  onClick={() => setState(prev => ({ ...prev, mode: SonificationMode[m] }))}
                  className={`flex items-center justify-between px-4 py-3 rounded border transition-all font-mono text-[10px] uppercase tracking-wider ${
                    state.mode === SonificationMode[m] 
                      ? 'bg-violet-900/20 border-violet-500/50 text-violet-100' 
                      : 'bg-black/30 border-neutral-800/40 text-neutral-500 hover:border-neutral-700'
                  }`}
                >
                  <span>{m}</span>
                  <div className={`w-1.5 h-1.5 rounded-full ${state.mode === SonificationMode[m] ? 'bg-violet-400 shadow-[0_0_8px_rgba(167,139,250,0.8)]' : 'bg-transparent'}`} />
                </button>
              ))}
            </div>
          </section>

          <section className="pt-4">
            <button 
              onClick={toggleAudio}
              className={`w-full py-4 rounded font-mono uppercase tracking-[0.2em] text-xs flex items-center justify-center gap-3 transition-all ${
                state.isAudioEnabled 
                  ? 'bg-red-950/20 text-red-400 border border-red-900/30 hover:bg-red-900/30' 
                  : 'bg-emerald-950/20 text-emerald-400 border border-emerald-900/30 hover:bg-emerald-900/30'
              }`}
            >
              {state.isAudioEnabled ? "Silence" : "Listen"}
            </button>
          </section>
        </div>

        <div className="lg:col-span-5 flex flex-col items-center">
          <Visualizer articles={state.articles} radius={state.radius} mode={state.mode} heading={state.heading} />
          <div className="mt-8 text-center w-full max-sm:px-4">
            {state.isAudioEnabled ? (
              <div className="flex flex-col items-center gap-3">
                <div className="flex gap-1.5 h-6 items-end">
                  {[...Array(12)].map((_, i) => (
                    <div 
                      key={i} 
                      className="w-0.5 bg-violet-500/60 animate-[bounce_1.2s_infinite]" 
                      style={{ animationDelay: `${i * 0.08}s`, height: `${30 + Math.random() * 70}%` }}
                    />
                  ))}
                </div>
                <p className="text-violet-400 text-[9px] tracking-[0.4em] uppercase font-mono animate-pulse">Spectral Resonance Active</p>
                <div className="flex gap-6 text-neutral-600 text-[9px] uppercase font-mono tracking-widest">
                   <span>Nodes: {state.articles.length}</span>
                   <span>Head: {Math.round(state.heading)}°</span>
                </div>
              </div>
            ) : (
              <p className="text-neutral-500 text-[10px] font-mono uppercase tracking-widest opacity-60">System Ready. Initiation Required.</p>
            )}
          </div>
        </div>

        <div className="lg:col-span-3 h-[600px] overflow-y-auto pr-2 custom-scrollbar">
          <h2 className="text-[10px] font-bold uppercase tracking-[0.3em] text-violet-400 mb-6 sticky top-0 bg-black py-2 z-10 font-mono">Nearby Echoes</h2>
          <div className="space-y-4">
            {state.articles.length === 0 && !state.isLoading && (
              <p className="text-neutral-600 text-[11px] italic font-serif opacity-70">The area is silent. No history found.</p>
            )}
            {state.articles.map(article => (
              <div 
                key={article.pageid}
                className="group p-4 rounded-lg border border-neutral-900 bg-neutral-900/20 hover:bg-neutral-900/50 transition-all"
              >
                <h3 className="text-violet-100 font-serif text-base font-normal leading-tight group-hover:text-white">{article.title}</h3>
                <div className="flex justify-between items-center mt-3 text-[9px] uppercase tracking-widest text-neutral-600 font-mono">
                  <span>{Math.round(article.dist)}M</span>
                  <span>{Math.round(article.bearing!)}°</span>
                </div>
                {article.extract && (
                  <p className="mt-2 text-xs text-neutral-500 line-clamp-3 leading-relaxed font-serif italic opacity-80">
                    {article.extract}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      </main>

      <footer className="mt-20 py-8 border-t border-neutral-900/50 w-full text-center">
        <p className="text-neutral-700 text-[9px] tracking-[0.3em] uppercase font-mono">
          Wikipedia Geodata • Spectral Synthesis • Friction v2.4
        </p>
      </footer>
    </div>
  );
};

export default App;
