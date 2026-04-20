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

  const handleVideoDrop = useCallback(async (path: string, model: string = 'base') => {
    console.log("SMART-ENGINE: Processing request for ->", path);
    setIsError(false);
    
    // UI Feedback: Immediately signal that input was received
    setVideoPath(path);
    setAppState('PROCESSING');
    setProcessStatus(`Transcribing with Faster-Whisper ${model.toUpperCase()}...`);
    setProcessProgress(0);
    
    try {
      // Trigger the real Rust backend pipeline - using camelCase for Tauri v1 naming convention
      const result: AnalysisResult = await invoke('run_whisper_analysis', { videoPath: path, modelSize: model });
      setAnalysisResult(result);
      setAppState('EDITOR');
    } catch (err) {
      console.error("AI Pipeline Error:", err);
      setIsError(true);
      setProcessStatus("FATAL ERROR: " + err);
      // We do NOT revert to IMPORT so the user can see this error
    }
  }, []);

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
  
        const pathNoExt = videoPath.replace(/\\.[^/.]+$/, "");
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
        <button className="btn-secondary">Settings</button>
      </header>

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
