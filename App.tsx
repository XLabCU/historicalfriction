
import React, { useState, useEffect, useCallback } from 'react';
import { AppState, SonificationMode, Coordinates } from './types';
import { fetchArticlesNear } from './services/wikipediaService';
import { audioManager } from './services/audioManager';
import Visualizer from './components/Visualizer';

const App: React.FC = () => {
  const [state, setState] = useState<AppState>({
    location: { lat: 51.5074, lng: -0.1278 }, // London default
    radius: 1000,
    articles: [],
    mode: SonificationMode.AMBIENT,
    isAudioEnabled: false,
    isLoading: false,
  });

  const [manualInput, setManualInput] = useState({
    lat: '51.5074',
    lng: '-0.1278',
    radius: '1000'
  });

  const loadArticles = useCallback(async (lat: number, lng: number, radius: number) => {
    setState(prev => ({ ...prev, isLoading: true }));
    try {
      const articles = await fetchArticlesNear(lat, lng, radius);
      setState(prev => ({ ...prev, articles, isLoading: false }));
    } catch (error) {
      console.error("Failed to load articles", error);
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }, []);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setState(prev => ({ ...prev, location: coords }));
        setManualInput(prev => ({ ...prev, lat: coords.lat.toString(), lng: coords.lng.toString() }));
        loadArticles(coords.lat, coords.lng, state.radius);
      }, (err) => {
        console.warn("Geolocation denied, using default location.");
        loadArticles(state.location.lat, state.location.lng, state.radius);
      });
    }
  }, [loadArticles, state.radius, state.location.lat, state.location.lng]);

  useEffect(() => {
    if (state.isAudioEnabled) {
      audioManager.update(state.mode, state.articles, state.radius);
    } else {
      audioManager.stopAll();
    }
  }, [state.isAudioEnabled, state.mode, state.articles, state.radius]);

  const toggleAudio = async () => {
    if (!state.isAudioEnabled) {
      audioManager.init();
      await audioManager.resume();
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
    <div className="min-h-screen p-4 md:p-8 flex flex-col items-center bg-black selection:bg-violet-500 selection:text-white">
      <header className="max-w-2xl w-full text-center mb-12 space-y-6">
        <h1 className="text-4xl md:text-6xl font-light tracking-tighter serif text-violet-100">
          Historical Friction
        </h1>
        <p className="text-lg md:text-xl text-neutral-400 italic serif leading-relaxed px-4">
          "History is all around us. The voices of the past thicken the air, calling out for your attention. When it all gets too much, pull the ear-buds out, stop, and look at where you are with fresh eyes, in the new silence..."
        </p>
      </header>

      <main className="max-w-6xl w-full grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-4 space-y-8 bg-neutral-900/50 p-6 rounded-2xl border border-neutral-800 backdrop-blur-md">
          <section className="space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-violet-400">Environment</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-neutral-500">Latitude</label>
                <input 
                  type="text" 
                  value={manualInput.lat}
                  onChange={e => setManualInput({...manualInput, lat: e.target.value})}
                  className="bg-black border border-neutral-800 rounded px-3 py-2 text-sm focus:border-violet-500 outline-none transition-colors"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-neutral-500">Longitude</label>
                <input 
                  type="text" 
                  value={manualInput.lng}
                  onChange={e => setManualInput({...manualInput, lng: e.target.value})}
                  className="bg-black border border-neutral-800 rounded px-3 py-2 text-sm focus:border-violet-500 outline-none transition-colors"
                />
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-neutral-500">Radius (meters): {state.radius}</label>
              <input 
                type="range" 
                min="100" 
                max="10000" 
                step="100"
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
              className="w-full bg-violet-600 hover:bg-violet-700 disabled:bg-neutral-800 text-white font-medium py-3 rounded-lg transition-all transform active:scale-95"
            >
              {state.isLoading ? 'Searching Past...' : 'Shift Location'}
            </button>
          </section>

          <section className="space-y-4 border-t border-neutral-800 pt-6">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-violet-400">Sonification Mode</h2>
            <div className="flex flex-col gap-3">
              {(Object.keys(SonificationMode) as Array<keyof typeof SonificationMode>).map((m) => (
                <button
                  key={m}
                  onClick={() => setState(prev => ({ ...prev, mode: SonificationMode[m] }))}
                  className={`flex items-center justify-between px-4 py-3 rounded-lg border transition-all ${
                    state.mode === SonificationMode[m] 
                      ? 'bg-violet-900/30 border-violet-500 text-violet-100' 
                      : 'bg-black/50 border-neutral-800 text-neutral-500 hover:border-neutral-600'
                  }`}
                >
                  <span className="capitalize">{m.toLowerCase()}</span>
                  <div className={`w-2 h-2 rounded-full ${state.mode === SonificationMode[m] ? 'bg-violet-400 animate-pulse' : 'bg-transparent'}`} />
                </button>
              ))}
            </div>
          </section>

          <section className="pt-4">
            <button 
              onClick={toggleAudio}
              className={`w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-3 transition-all ${
                state.isAudioEnabled 
                  ? 'bg-red-500/20 text-red-400 border border-red-500/50 hover:bg-red-500/30 shadow-[0_0_20px_rgba(239,68,68,0.1)]' 
                  : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 hover:bg-emerald-500/30 shadow-[0_0_20px_rgba(16,185,129,0.1)]'
              }`}
            >
              {state.isAudioEnabled ? (
                <>
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                  Silence the Air
                </>
              ) : (
                <>
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                  Listen to the Void
                </>
              )}
            </button>
          </section>
        </div>

        <div className="lg:col-span-5 flex flex-col items-center">
          <Visualizer articles={state.articles} radius={state.radius} mode={state.mode} />
          <div className="mt-8 text-center w-full max-w-sm">
            {state.isAudioEnabled ? (
              <div className="flex flex-col items-center gap-2">
                <div className="flex gap-1 h-8 items-end">
                  {[...Array(8)].map((_, i) => (
                    <div 
                      key={i} 
                      className="w-1 bg-violet-500 animate-[bounce_1s_infinite]" 
                      style={{ animationDelay: `${i * 0.1}s`, height: `${Math.random() * 100}%` }}
                    />
                  ))}
                </div>
                <p className="text-violet-400 text-xs tracking-widest uppercase animate-pulse">Spectral Resonance Active</p>
                <p className="text-neutral-500 text-[10px] italic">Extracting {state.articles.length} historical nodes</p>
              </div>
            ) : (
              <p className="text-neutral-500 text-sm">Presence detected. Activate audio to begin sonification.</p>
            )}
          </div>
        </div>

        <div className="lg:col-span-3 h-[600px] overflow-y-auto pr-2 custom-scrollbar">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-violet-400 mb-6 sticky top-0 bg-black py-2">Nearby Echoes</h2>
          <div className="space-y-4">
            {state.articles.length === 0 && !state.isLoading && (
              <p className="text-neutral-600 text-sm italic">The area is silent. No history recorded within this radius.</p>
            )}
            {state.articles.map(article => (
              <div 
                key={article.pageid}
                className="group p-4 rounded-xl border border-neutral-800 bg-neutral-900/30 hover:bg-neutral-800/50 transition-all hover:-translate-y-1"
              >
                <h3 className="text-violet-200 font-medium text-sm group-hover:text-white transition-colors">{article.title}</h3>
                <div className="flex justify-between items-center mt-2 text-[10px] uppercase tracking-tighter text-neutral-500 font-bold">
                  <span>{Math.round(article.dist)}m away</span>
                  <span>{article.wordcount} words</span>
                </div>
                {article.extract && (
                  <p className="mt-2 text-xs text-neutral-500 line-clamp-2 leading-relaxed italic serif">
                    {article.extract}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      </main>

      <footer className="mt-20 py-8 border-t border-neutral-900 w-full text-center">
        <p className="text-neutral-700 text-xs tracking-[0.2em] uppercase">
          Powered by Wikipedia API & Spectral Formant Synthesis
        </p>
      </footer>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #262626; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #404040; }
        @keyframes bounce {
          0%, 100% { transform: scaleY(0.5); }
          50% { transform: scaleY(1.5); }
        }
      `}</style>
    </div>
  );
};

export default App;
