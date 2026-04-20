import { CheckCircle, FolderOpen, RefreshCcw, Share2 } from 'lucide-react';
import { convertFileSrc } from '@tauri-apps/api/tauri';
import { invoke } from '@tauri-apps/api/tauri';

interface ResultScreenProps {
  exportedPath: string;
  onReset: () => void;
}

export function ResultScreen({ exportedPath, onReset }: ResultScreenProps) {
  const videoUrl = convertFileSrc(exportedPath);

  const handleOpenFolder = async () => {
    await invoke('show_in_folder', { path: exportedPath });
  };

  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="glass-panel animate-fade-in" style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        justifyContent: 'center',
        padding: '24px 40px',
        width: '100%',
        maxWidth: '680px',
        minHeight: '400px',
        maxHeight: '600px',
        borderRadius: '20px',
        position: 'relative'
      }}>
        <div style={{ 
          width: '56px',
          height: '56px',
          background: 'rgba(16, 185, 129, 0.1)', 
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '16px',
          border: '1px solid rgba(16, 185, 129, 0.2)',
          boxShadow: '0 0 20px rgba(16, 185, 129, 0.1)'
        }}>
          <CheckCircle size={28} color="#10b981" />
        </div>

        <h2 style={{ fontSize: '1.4rem', marginBottom: '4px' }}>Viral Clip Exported!</h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: '24px', fontSize: '0.85rem' }}>Your video is optimized and ready for engagement</p>

        <div style={{ 
          width: '100%', 
          maxWidth: '280px', 
          aspectRatio: '9/16', 
          background: '#000',
          borderRadius: '16px',
          overflow: 'hidden',
          boxShadow: '0 20px 40px -10px rgba(0,0,0,0.7)',
          marginBottom: '24px',
          border: '1px solid var(--border-subtle)'
        }}>
          <video 
            src={videoUrl} 
            controls 
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        </div>

        <div style={{ display: 'flex', gap: '12px', width: '100%', maxWidth: '360px' }}>
          <button className="btn-secondary" onClick={handleOpenFolder} style={{ flex: 1, gap: '8px', height: '40px', fontSize: '0.9rem', padding: '0' }}>
            <FolderOpen size={18} />
            Open Folder
          </button>

          <button className="btn-primary" onClick={onReset} style={{ flex: 1, gap: '8px', height: '40px', justifyContent: 'center', fontSize: '0.9rem', padding: '0' }}>
            <RefreshCcw size={18} />
            Try Another
          </button>
        </div>

        <div style={{ 
          marginTop: 'auto', 
          padding: '8px 16px', 
          borderRadius: '12px', 
          background: 'rgba(255,255,255,0.01)',
          border: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <Share2 size={14} color="var(--accent-primary)" />
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            Ready for <strong>TikTok, Reels & Shorts</strong>
          </span>
        </div>
      </div>
    </div>
  );
}
