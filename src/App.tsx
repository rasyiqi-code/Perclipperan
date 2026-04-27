import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { ImportScreen } from './components/ImportScreen';
import { ProcessingScreen } from './components/ProcessingScreen';
import { EditorScreen } from './components/EditorScreen';
import { DownloadScreen } from './components/DownloadScreen';
import { ResultScreen } from './components/ResultScreen';

type AppState = 'SETUP' | 'IMPORT' | 'PROCESSING' | 'EDITOR' | 'SUCCESS';

interface VideoClip {
  id: string;
  hook: string;
  summary: string;
  start_time: number;
  end_time: number;
  score: number;
}

interface AnalysisResult {
  clips: VideoClip[];
  total_clips: number;
}

function App() {
  const [appState, setAppState] = useState<AppState>('SETUP');
  const [videoPath, setVideoPath] = useState('');
  const [processStatus, setProcessStatus] = useState('Transcribing with Faster-Whisper Base...');
  const [processProgress, setProcessProgress] = useState(0);
  const [subtitleStyle, setSubtitleStyle] = useState('CLEAN_WHITE');
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [selectedClipIndex, setSelectedClipIndex] = useState(0);
  const [exportedPath, setExportedPath] = useState('');
  const [isError, setIsError] = useState(false);

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [modelType, setModelType] = useState('base');
  const [llmProvider, setLlmProvider] = useState('openrouter');
  const [apiKey, setApiKey] = useState('');
  const [llmModel, setLlmModel] = useState('openrouter/free');

  const [ollamaDownloadProgress, setOllamaDownloadProgress] = useState('');
  const [isOllamaDownloading, setIsOllamaDownloading] = useState(false);

  useEffect(() => {
    let unlistenPromises: Promise<UnlistenFn>[] = [];

    // Listen for real-time logs from AI sidecars
    const setupListeners = () => {
      unlistenPromises.push(listen('process_log', (event: any) => {
        setProcessStatus(event.payload);
      }));
      
      unlistenPromises.push(listen('process_progress', (event: any) => {
        setProcessProgress(event.payload);
      }));

      unlistenPromises.push(listen('ollama_download_progress', (event: any) => {
        setOllamaDownloadProgress(event.payload);
        if (event.payload.includes("completed successfully") || event.payload.includes("failed")) {
            setIsOllamaDownloading(false);
        }
      }));
    };

    setupListeners();

    return () => { 
      Promise.all(unlistenPromises).then(unlisteners => {
        unlisteners.forEach(unlisten => unlisten());
      }).catch(console.error);
    };
  }, []);

  const handleSetupComplete = () => {
    setAppState('IMPORT');
  };

  const handleDownloadOllama = async () => {
    setIsOllamaDownloading(true);
    setOllamaDownloadProgress('Starting download...');
    try {
      await invoke('download_standalone_model');
    } catch (err: any) {
      setOllamaDownloadProgress(`Error: ${err}`);
      setIsOllamaDownloading(false);
    }
  };

  const handleVideoDrop = useCallback(async (path: string) => {
    console.log("SMART-ENGINE: Processing request for ->", path);
    setIsError(false);
    
    // UI Feedback: Immediately signal that input was received
    setVideoPath(path);
    setAppState('PROCESSING');
    setProcessStatus(`Transcribing with Faster-Whisper ${modelType.toUpperCase()}...`);
    setProcessProgress(0);
    
    try {
      // Trigger the real Rust backend pipeline - using camelCase for Tauri v1 naming convention
      const result: AnalysisResult = await invoke('run_whisper_analysis', { videoPath: path, modelSize: modelType, llmProvider, apiKey, llmModel });
      setAnalysisResult(result);
      setAppState('EDITOR');
    } catch (err) {
      console.error("AI Pipeline Error:", err);
      setIsError(true);
      setProcessStatus("FATAL ERROR: " + err);
      // We do NOT revert to IMPORT so the user can see this error
    }
  }, [modelType, llmProvider, apiKey]);

  const handleReset = () => {
    if (window.confirm("Start a new session? Current progress will be reset.")) {
      setAppState('IMPORT');
      setVideoPath('');
      setAnalysisResult(null);
      setExportedPath('');
    }
  };

  const handleExport = async () => {
    setIsError(false);
    setAppState('PROCESSING');
    setProcessStatus(`Preparing AI Rendering Engine...`);

    try {
      const selectedClip = analysisResult?.clips[selectedClipIndex];
      if (!selectedClip) throw new Error("No clip selected");

      const pathNoExt = videoPath.replace(/\.[^/.]+$/, "");
      const finalExportPath = `${pathNoExt}_clip_${selectedClip.id}.mp4`;
      
      await invoke('render_final_video', { 
        videoPath: videoPath, 
        exportPath: finalExportPath, 
        style: subtitleStyle,
        startTime: selectedClip.start_time,
        endTime: selectedClip.end_time,
        clipHook: selectedClip.hook
      });
      
      setExportedPath(finalExportPath);
      setAppState('SUCCESS');
    } catch (err) {
      console.error("Render failed:", err);
      setIsError(true);
      setProcessStatus("RENDER ERROR: " + err);
      // We do NOT revert to EDITOR so the user can see this error
    }
  };

  const handleExportAll = async () => {
    if (!analysisResult?.clips || analysisResult.clips.length === 0) return;
    
    setIsError(false);
    setAppState('PROCESSING');
    
    let lastExportPath = '';
    
    try {
      for (let i = 0; i < analysisResult.clips.length; i++) {
        const clip = analysisResult.clips[i];
        setProcessStatus(`Rendering Clip ${i + 1} of ${analysisResult.clips.length}...`);
  
        const pathNoExt = videoPath.replace(/\.[^/.]+$/, "");
        const finalExportPath = `${pathNoExt}_clip_${clip.id}.mp4`;
        
        await invoke('render_final_video', { 
          videoPath: videoPath, 
          exportPath: finalExportPath, 
          style: subtitleStyle,
          startTime: clip.start_time,
          endTime: clip.end_time,
          clipHook: clip.hook
        });
        
        lastExportPath = finalExportPath;
      }
      
      setExportedPath(lastExportPath);
      setAppState('SUCCESS');
    } catch (err) {
      console.error("Batch render failed:", err);
      setIsError(true);
      setProcessStatus("BATCH RENDER ERROR: " + err);
    }
  };

  return (
    <div className="container">
      <header className="header animate-slide-down">
        <div className="logo-section">
          <div className="logo-icon ripple">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
               <path d="M15 10L10 13V7L15 10Z" fill="white" />
               <rect x="3" y="4" width="18" height="12" rx="3" stroke="white" strokeWidth="2" />
               <path d="M7 20H17" stroke="white" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <h1 style={{ lineHeight: '1', marginBottom: '2px' }}>ClipGenius AI</h1>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: 500 }}>v1.3 Ultra-Lite</span>
              <span className="badge">PRO</span>
            </div>
          </div>
        </div>
        <button className="btn-secondary" onClick={() => setIsSettingsOpen(true)}>Settings</button>
      </header>

      {/* Settings Modal */}
      {isSettingsOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000
        }}>
          <div className="glass-panel" style={{
            padding: '30px', borderRadius: '20px', width: '100%', maxWidth: '450px',
            backgroundColor: '#0f172a', border: '1px solid var(--border-subtle)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '1.3rem', margin: 0 }}>⚙️ AI Settings</h2>
              <button onClick={() => setIsSettingsOpen(false)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontSize: '1.2rem' }}>✕</button>
            </div>
            
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>
                Whisper Transcription Model
              </label>
              <select 
                value={modelType}
                onChange={(e) => setModelType(e.target.value)}
                style={{
                   width: '100%', padding: '12px 14px', borderRadius: '10px',
                   background: 'rgba(15, 23, 42, 0.4)', border: '1px solid var(--border-subtle)',
                   color: 'var(--text-primary)', fontSize: '0.9rem', outline: 'none'
                }}
              >
                <option value="base" style={{ background: '#0f172a' }}>Base 🚀 (Ngebut)</option>
                <option value="small" style={{ background: '#0f172a' }}>Small ⚖️ (Seimbang)</option>
                <option value="medium" style={{ background: '#0f172a' }}>Medium 🎯 (Akurat)</option>
              </select>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>
                AI Analysis Provider
              </label>
              <select 
                value={llmProvider}
                onChange={(e) => setLlmProvider(e.target.value)}
                style={{
                   width: '100%', padding: '12px 14px', borderRadius: '10px',
                   background: 'rgba(15, 23, 42, 0.4)', border: '1px solid var(--border-subtle)',
                   color: 'var(--text-primary)', fontSize: '0.9rem', outline: 'none'
                }}
              >
                <option value="openrouter" style={{ background: '#0f172a' }}>OpenRouter (Fast, Cloud)</option>
                <option value="local_standalone" style={{ background: '#0f172a' }}>Local AI (Standalone - Phi-3)</option>
              </select>
            </div>

            {llmProvider === 'openrouter' && (
              <>
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>
                    OpenRouter Model
                  </label>
                  <select 
                    value={llmModel}
                    onChange={(e) => setLlmModel(e.target.value)}
                    style={{
                       width: '100%', padding: '12px 14px', borderRadius: '10px',
                       background: 'rgba(15, 23, 42, 0.4)', border: '1px solid var(--border-subtle)',
                       color: 'var(--text-primary)', fontSize: '0.9rem', outline: 'none'
                    }}
                  >
                    <option value="openrouter/free" style={{ background: '#0f172a' }}>OpenRouter Free Router (Best Free)</option>
                    <option value="google/gemini-2.0-flash-lite-preview-02-05:free" style={{ background: '#0f172a' }}>Gemini 2.0 Flash Lite (Free)</option>
                    <option value="meta-llama/llama-3.3-70b-instruct:free" style={{ background: '#0f172a' }}>Llama 3.3 70B (Free)</option>
                    <option value="mistralai/mistral-7b-instruct:free" style={{ background: '#0f172a' }}>Mistral 7B (Free)</option>
                    <option value="openai/gpt-4o-mini" style={{ background: '#0f172a' }}>GPT-4o Mini (Paid/Fast)</option>
                  </select>
                </div>

                <div style={{ marginBottom: '24px' }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>
                    OpenRouter API Key
                  </label>
                  <input 
                    type="password"
                    placeholder="sk-or-v1-..."
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    style={{
                       width: '100%', padding: '12px 14px', borderRadius: '10px',
                       background: 'rgba(15, 23, 42, 0.4)', border: '1px solid var(--border-subtle)',
                       color: 'var(--text-primary)', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box'
                    }}
                  />
                </div>
              </>
            )}

            {llmProvider === 'local_standalone' && (
              <div style={{ marginBottom: '24px', padding: '16px', background: 'rgba(0,0,0,0.2)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>
                  Download AI Engine & Model
                </label>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                  <div style={{ flex: 1, padding: '10px', borderRadius: '8px', background: 'rgba(15, 23, 42, 0.6)', border: '1px solid var(--border-subtle)', color: 'white', fontSize: '0.85rem', display: 'flex', alignItems: 'center' }}>
                    Phi-3 Mini (2.3GB)
                  </div>
                  <button 
                    onClick={handleDownloadOllama} 
                    disabled={isOllamaDownloading}
                    style={{ padding: '10px 16px', borderRadius: '8px', background: 'var(--accent-primary)', border: 'none', color: 'white', cursor: isOllamaDownloading ? 'not-allowed' : 'pointer', fontSize: '0.85rem', fontWeight: 600, opacity: isOllamaDownloading ? 0.7 : 1 }}
                  >
                    {isOllamaDownloading ? 'Downloading...' : 'Download'}
                  </button>
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
                  This will download the llama-cli engine and Phi-3 model into the app's local directory. No installation required.
                </div>
                {ollamaDownloadProgress && (
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontFamily: 'monospace', background: 'rgba(0,0,0,0.3)', padding: '8px', borderRadius: '6px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {ollamaDownloadProgress}
                  </div>
                )}
              </div>
            )}

            <button className="btn-primary" onClick={() => setIsSettingsOpen(false)} style={{ width: '100%', padding: '12px' }}>
              Save & Close
            </button>
          </div>
        </div>
      )}

      {appState === 'SETUP' && (
        <DownloadScreen onComplete={handleSetupComplete} />
      )}

      {appState === 'IMPORT' && (
        <ImportScreen onVideoDrop={handleVideoDrop} />
      )}

      {appState === 'PROCESSING' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <ProcessingScreen statusText={processStatus} progressPercentage={processProgress} isError={isError} />
          {isError && (
             <button 
               className="btn-secondary" 
               onClick={() => setAppState('IMPORT')}
               style={{ margin: '0 auto', padding: '10px 32px' }}
             >
               Go Back to Import
             </button>
          )}
        </div>
      )}

      {appState === 'EDITOR' && analysisResult && (
        <EditorScreen 
          videoPath={videoPath} 
          clips={analysisResult.clips}
          selectedClipIndex={selectedClipIndex}
          onSelectClip={setSelectedClipIndex}
          subtitleStyle={subtitleStyle}
          onStyleChange={setSubtitleStyle}
          onExport={handleExport}
          onExportAll={handleExportAll}
        />
      )}

      {appState === 'SUCCESS' && (
        <ResultScreen 
          exportedPath={exportedPath} 
          onReset={handleReset} 
        />
      )}
    </div>
  );
}

export default App;
