import { useState } from 'react';
import { Upload, FileVideo } from 'lucide-react';
import { open } from '@tauri-apps/api/dialog';
import { listen } from '@tauri-apps/api/event';
import { useEffect } from 'react';

interface ImportScreenProps {
  onVideoDrop: (path: string, model: string) => void;
}

export function ImportScreen({ onVideoDrop }: ImportScreenProps) {
  const [isHovering, setIsHovering] = useState(false);
  const [modelType, setModelType] = useState('base');

  // BUG-04 Fix: Use Tauri's file-drop event to get the real OS filesystem path
  useEffect(() => {
    let unlistenPromises: Promise<() => void>[] = [];

    const setupListeners = () => {
      try {
        unlistenPromises.push(listen('tauri://file-drop', (event: any) => {
          const paths: string[] = event.payload;
          if (paths && paths.length > 0) {
            const path = paths[0];
            const ext = path.split('.').pop()?.toLowerCase();
            if (['mp4', 'mov', 'mkv', 'avi', 'webm'].includes(ext || '')) {
              console.log("File dropped:", path);
              onVideoDrop(path, modelType);
            }
          }
        }));

        unlistenPromises.push(listen('tauri://file-drop-hover', () => setIsHovering(true)));
        unlistenPromises.push(listen('tauri://file-drop-cancelled', () => setIsHovering(false)));
      } catch (err) {
        console.error("Failed to setup Tauri listeners", err);
      }
    };

    setupListeners();

    return () => {
      Promise.all(unlistenPromises).then(unlisteners => {
        unlisteners.forEach(unlisten => unlisten());
      }).catch(console.error);
    };
  }, [onVideoDrop, modelType]); // Added modelType to lexical scope deps

  const handleBrowse = async () => {
    try {
      console.log("Opening file dialog...");
      const selected = await open({
        multiple: false,
        filters: [{
          name: 'Video',
          extensions: ['mp4', 'mov', 'mkv', 'avi', 'webm']
        }]
      });
      
      console.log("Tauri Dialog returned:", selected);
      
      if (selected) {
        const path = Array.isArray(selected) ? selected[0] : selected;
        if (typeof path === 'string' && path.length > 0) {
          console.log("Valid path selected, triggering onVideoDrop:", path);
          onVideoDrop(path, modelType);
        } else {
          console.warn("Selected item is not a valid path string:", path);
          alert("Selection error: The picked item did not provide a valid file path.");
        }
      } else {
        console.log("File selection cancelled by user.");
      }
    } catch (err) {
      console.error("Error in handleBrowse:", err);
      // Avoid alerting if the dialog was just cancelled/closed in some OSes where it rejects instead of returning null
    }
  };

  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div 
        className={`glass-panel drop-zone animate-fade-in ${isHovering ? 'active' : ''}`}
        style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          justifyContent: 'center',
          border: isHovering ? '2px dashed var(--accent-primary)' : '2px dashed var(--border-subtle)',
          background: isHovering ? 'rgba(99, 102, 241, 0.05)' : 'var(--bg-glass)',
          padding: '24px 40px',
          width: '100%',
          maxWidth: '680px',
          minHeight: '300px',
          maxHeight: '360px',
          borderRadius: '20px',
          position: 'relative'
        }}
      >
      <div className="icon-glow" style={{
        width: '56px',
        height: '56px',
        borderRadius: '50%',
        background: 'rgba(99, 102, 241, 0.1)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: '16px'
      }}>
        <Upload size={28} color="var(--accent-primary)" />
      </div>
      
      <h2 style={{ fontSize: '1.4rem', marginBottom: '4px' }}>
        {isHovering ? 'Drop to Start Magic 🎬' : 'Import Your Video'}
      </h2>
      
      <p style={{ color: 'var(--text-secondary)', marginBottom: '20px', fontSize: '0.85rem', textAlign: 'center', maxWidth: '360px' }}>
        Drag & drop any video file here or use the manual browser.
      </p>
      
      <button className="btn-primary" onClick={handleBrowse} style={{ gap: '8px', padding: '10px 24px', fontSize: '0.9rem' }}>
        <FileVideo size={18} />
        Browse Video File
      </button>

      {/* Model Selection Dropdown */}
      <div style={{ marginTop: '24px', width: '100%', maxWidth: '320px', textAlign: 'left' }}>
        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          AI Transcription Model
        </label>
        <select 
          value={modelType}
          onChange={(e) => setModelType(e.target.value)}
          style={{
             width: '100%',
             padding: '12px 14px',
             borderRadius: '10px',
             background: 'rgba(15, 23, 42, 0.4)',
             border: '1px solid var(--border-subtle)',
             color: 'var(--text-primary)',
             fontSize: '0.85rem',
             outline: 'none',
             cursor: 'pointer',
             appearance: 'auto'
          }}
        >
          <option value="base" style={{ background: '#0f172a' }}>Base 🚀 (Ngebut, Akurasi Standar)</option>
          <option value="small" style={{ background: '#0f172a' }}>Small ⚖️ (Seimbang & Cukup Akurat)</option>
          <option value="medium" style={{ background: '#0f172a' }}>Medium 🎯 (Lambat, Sangat Akurat)</option>
        </select>
      </div>

      <div style={{ 
        marginTop: 'auto', 
        padding: '6px 14px', 
        borderRadius: '20px', 
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid var(--border-subtle)',
        fontSize: '0.7rem',
        color: 'var(--text-muted)'
      }}>
        Supports MP4, MOV, MKV & more
      </div>
    </div>
    </div>
  );
}
