import { useState, useEffect } from 'react';
import { Wand2 } from 'lucide-react';

interface ProcessingScreenProps {
  statusText?: string;
  progressPercentage?: number;
  isError?: boolean;
}

export function ProcessingScreen({ 
  statusText = "Transcribing with Faster-Whisper Base...", 
  progressPercentage,
  isError = false
}: ProcessingScreenProps) {
   const [internalProgress, setInternalProgress] = useState(0);

  useEffect(() => {
    if (progressPercentage !== undefined) return;
    const interval = setInterval(() => {
      setInternalProgress(prev => {
        if (prev >= 88) { clearInterval(interval); return prev; }
        return prev + (Math.random() * 2);
      });
    }, 800);
    return () => clearInterval(interval);
  }, [progressPercentage]);

  const displayProgress = progressPercentage ?? internalProgress;

  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="glass-panel animate-fade-in" style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        justifyContent: 'center',
        padding: '32px 40px',
        width: '100%',
        maxWidth: '680px',
        minHeight: '320px',
        maxHeight: '380px',
        borderRadius: '20px',
        position: 'relative'
      }}>
        <div className={isError ? "" : "pulse"} style={{
          width: '64px',
          height: '64px',
          borderRadius: '50%',
          background: isError ? 'rgba(239, 68, 68, 0.1)' : 'rgba(168, 85, 247, 0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '20px',
          border: `1px solid ${isError ? 'rgba(239, 68, 68, 0.2)' : 'rgba(168, 85, 247, 0.2)'}`,
          boxShadow: `0 0 20px ${isError ? 'rgba(239, 68, 68, 0.1)' : 'rgba(168, 85, 247, 0.1)'}`
        }}>
          {isError ? (
            <span style={{ fontSize: '24px' }}>⚠️</span>
          ) : (
            <Wand2 size={28} color="var(--accent-secondary)" />
          )}
        </div>

        <h2 style={{ fontSize: '1.4rem', marginBottom: '4px', color: isError ? '#ef4444' : 'inherit' }}>
          {isError ? 'AI Engine Blocked' : 'AI Magic in Progress...'}
        </h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: '32px', fontSize: '0.85rem' }}>
          {isError ? 'Something went wrong while communicating with the sidecars' : 'Analyzing patterns and generating viral hooks'}
        </p>
        
        <div style={{ width: '100%', maxWidth: '400px' }}>
          <div style={{ 
            background: 'rgba(255,255,255,0.02)', 
            height: '8px', 
            borderRadius: '4px', 
            overflow: 'hidden', 
            position: 'relative',
            border: '1px solid var(--border-subtle)'
          }}>
            <div style={{ 
              width: `${displayProgress}%`, 
              background: 'linear-gradient(90deg, var(--accent-primary), var(--accent-secondary))', 
              height: '100%', 
              borderRadius: '4px', 
              transition: 'width 0.4s cubic-bezier(0.1, 0.7, 0.1, 1)',
              boxShadow: '0 0 10px var(--accent-glow)'
            }}></div>
          </div>
          
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            marginTop: '10px',
            alignItems: 'center'
          }}>
            <span style={{ color: isError ? '#ef4444' : 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: 500, maxWidth: '80%' }}>
              {statusText}
            </span>
            <span style={{ color: isError ? '#ef4444' : 'var(--accent-primary)', fontSize: '0.9rem', fontWeight: 700 }}>
              {isError ? 'FAILED' : `${Math.round(displayProgress)}%`}
            </span>
          </div>
        </div>

        <div style={{ 
          marginTop: 'auto', 
          fontSize: '0.7rem', 
          color: 'var(--text-muted)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          paddingTop: '20px'
        }}>
          <div className="spinner-small" style={{
            width: '10px',
            height: '10px',
            border: '1.5px solid rgba(255,255,255,0.1)',
            borderTopColor: 'var(--accent-primary)',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }}></div>
          Powering by local sidecar engines
        </div>

        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    </div>
  );
}
