import { Download, Palette, Play, Pause, Volume2, VolumeX } from 'lucide-react';
import { convertFileSrc } from '@tauri-apps/api/tauri';
import { useRef, useState, useEffect } from 'react';

interface VideoClip {
  id: string;
  hook: string;
  summary: string;
  start_time: number;
  end_time: number;
  score: number;
}

interface EditorScreenProps {
  videoPath: string;
  clips: VideoClip[];
  selectedClipIndex: number;
  onSelectClip: (index: number) => void;
  subtitleStyle: string;
  onStyleChange: (style: string) => void;
  onExport: () => void;
  onExportAll: () => void;
}

export function EditorScreen({ 
  videoPath, 
  clips, 
  selectedClipIndex,
  onSelectClip,
  subtitleStyle, 
  onStyleChange, 
  onExport,
  onExportAll
}: EditorScreenProps) {
  const fileName = videoPath.split(/[\\/]/).pop() || "Video";
  const selectedClip = clips[selectedClipIndex] || clips[0];
  
  // Convert local OS path to Tauri asset URL
  const videoSrc = videoPath ? convertFileSrc(videoPath) : '';

  const styles = [
    { id: 'CLEAN_WHITE', name: 'Clean White', color: '#FFFFFF', desc: 'Minimalist & Professional' },
    { id: 'VIRAL_YELLOW', name: 'Viral Yellow', color: '#FFFF00', desc: 'High Engagement' },
    { id: 'NEON_BLUE', name: 'Neon Blue', color: '#00FFFF', desc: 'Tech & Futuristic' }
  ];

  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(selectedClip?.start_time || 0);

  useEffect(() => {
    if (videoRef.current && selectedClip) {
      videoRef.current.currentTime = selectedClip.start_time;
      setCurrentTime(selectedClip.start_time);
      setIsPlaying(false);
    }
  }, [selectedClip]);

  const handleTimeUpdate = () => {
    if (videoRef.current && selectedClip) {
      setCurrentTime(videoRef.current.currentTime);
      if (videoRef.current.currentTime >= selectedClip.end_time) {
        videoRef.current.pause();
        videoRef.current.currentTime = selectedClip.start_time;
        setIsPlaying(false);
      }
    }
  };

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const clipDuration = (selectedClip?.end_time || 0) - (selectedClip?.start_time || 0);
  const progressPercent = clipDuration > 0 ? ((currentTime - (selectedClip?.start_time || 0)) / clipDuration) * 100 : 0;

  return (
    <div className="glass-panel animate-fade-in" style={{ 
      flex: 1, 
      display: 'flex', 
      padding: '16px', 
      gap: '16px', 
      minHeight: 0, 
      overflow: 'hidden',
      margin: '4px 0'
    }}>
      
      {/* LEFT: Clip Selector Sidebar */}
      <div style={{ 
        width: '240px', 
        display: 'flex', 
        flexDirection: 'column', 
        gap: '10px', 
        borderRight: '1px solid var(--border-subtle)',
        paddingRight: '12px',
        overflowY: 'auto'
      }}>
        <h3 style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>AI Identified Clips</h3>
        {clips.map((clip, index) => (
          <button
            key={clip.id}
            onClick={() => onSelectClip(index)}
            style={{
              padding: '12px',
              borderRadius: '10px',
              background: selectedClipIndex === index ? 'rgba(99, 102, 241, 0.1)' : 'rgba(255,255,255,0.02)',
              border: `1px solid ${selectedClipIndex === index ? 'var(--accent-primary)' : 'transparent'}`,
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'all 0.2s',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.65rem', color: 'var(--accent-primary)', fontWeight: 700 }}>#{clip.id}</span>
              <span style={{ fontSize: '0.65rem', background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: '4px' }}>Score: {clip.score}</span>
            </div>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {clip.hook.substring(clip.hook.indexOf(':') + 1)}
            </div>
            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
              {Math.floor(clip.start_time)}s - {Math.floor(clip.end_time)}s
            </div>
          </button>
        ))}
      </div>

      {/* CENTER: Video Preview Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px', minWidth: 0 }}>
        <div style={{ 
          flex: 1, 
          background: '#000', 
          borderRadius: '12px', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          position: 'relative', 
          overflow: 'hidden', 
          minHeight: 0,
          border: '1px solid rgba(255,255,255,0.05)',
          boxShadow: '0 10px 30px rgba(0,0,0,0.5)'
        }}>
          {videoSrc ? (
             <div style={{ height: '100%', aspectRatio: '9/16', position: 'relative', overflow: 'hidden', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: '#000', boxShadow: '0 5px 20px rgba(0,0,0,0.6)' }}>
              <video 
                ref={videoRef}
                key={`${selectedClip?.id}-${videoSrc}`}
                src={`${videoSrc}#t=${selectedClip?.start_time || 0},${selectedClip?.end_time || 0}`} 
                onTimeUpdate={handleTimeUpdate}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onClick={togglePlay}
                style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'pointer' }}
              />
            </div>
          ) : (
            <div style={{ textAlign: 'center' }}>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '4px', fontSize: '0.8rem' }}>Previewing:</p>
              <p style={{ color: 'var(--accent-primary)', fontWeight: 600, fontSize: '0.9rem' }}>{fileName}</p>
            </div>
          )}
        </div>

        {/* Customized Video Timeline View */}
        <div style={{ 
          height: '56px', 
          background: 'rgba(15, 23, 42, 0.4)', 
          borderRadius: '10px', 
          border: '1px solid var(--border-subtle)', 
          display: 'flex', 
          alignItems: 'center', 
          padding: '0 16px', 
          gap: '12px', 
          flexShrink: 0 
        }}>
          <button className="btn-secondary" onClick={togglePlay} style={{ padding: '8px', minWidth: '40px', display: 'flex', justifyContent: 'center' }}>
            {isPlaying ? <Pause size={18} /> : <Play size={18} />}
          </button>
          
          <div style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
             {Math.max(0, currentTime - (selectedClip?.start_time || 0)).toFixed(1)}s / {clipDuration.toFixed(1)}s
          </div>
          
          <div style={{ flex: 1, height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', position: 'relative', overflow: 'hidden' }}>
            <div style={{ 
              position: 'absolute', 
              left: 0, 
              width: `${Math.min(100, Math.max(0, progressPercent))}%`, 
              height: '100%', 
              background: 'var(--accent-primary)', 
              borderRadius: '4px' 
            }}></div>
          </div>
          
          <button className="btn-secondary" onClick={toggleMute} style={{ padding: '8px', minWidth: '40px', display: 'flex', justifyContent: 'center' }}>
            {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>
        </div>
      </div>

      {/* RIGHT: Selected Clip Details & Export */}
      <div style={{ width: '280px', display: 'flex', flexDirection: 'column', gap: '12px', minHeight: 0 }}>
        
        {/* Scrollable Info & Themes */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto', paddingRight: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
            <h3 style={{ margin: 0, fontSize: '0.95rem' }}>Clip Editor</h3>
            <Palette size={16} color="var(--text-muted)" />
          </div>
          
          <div style={{ 
            background: 'rgba(255,255,255,0.02)', 
            padding: '12px', 
            borderRadius: '10px', 
            border: '1px solid var(--border-subtle)', 
            flexShrink: 0 
          }}>
            <h4 style={{ color: 'var(--accent-primary)', margin: '0 0 6px 0', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}>Viral Hook</h4>
            <p style={{ margin: 0, fontSize: '0.85rem', lineHeight: '1.4', fontWeight: 500 }}>
              {selectedClip?.hook || "Analyzing video hook..."}
            </p>
          </div>
          
          <div style={{ 
            background: 'rgba(255,255,255,0.02)', 
            padding: '12px', 
            borderRadius: '10px', 
            border: '1px solid var(--border-subtle)', 
            flexShrink: 0 
          }}>
            <h4 style={{ color: 'var(--text-muted)', margin: '0 0 6px 0', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}>Context</h4>
            <p style={{ margin: 0, fontSize: '0.8rem', lineHeight: '1.4', color: 'var(--text-secondary)' }}>
              {selectedClip?.summary || "Generating summary..."}
            </p>
          </div>

          {/* Subtitle Style Selector */}
          <div style={{ marginTop: 'auto', flexShrink: 0 }}>
            <h4 style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '10px', fontWeight: 700, textTransform: 'uppercase' }}>Visual Theme</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {styles.map(s => (
                <button 
                  key={s.id}
                  onClick={() => onStyleChange(s.id)}
                  style={{
                    background: subtitleStyle === s.id ? 'rgba(99, 102, 241, 0.1)' : 'rgba(255,255,255,0.01)',
                    border: `1px solid ${subtitleStyle === s.id ? 'var(--accent-primary)' : 'var(--border-subtle)'}`,
                    padding: '10px',
                    borderRadius: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <div style={{ width: '8px', height: '100%', background: s.color, borderRadius: '3px', boxShadow: `0 0 8px ${s.color}33` }}>&nbsp;</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: subtitleStyle === s.id ? 'var(--text-primary)' : 'var(--text-secondary)' }}>{s.name}</div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{s.desc}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
        
        {/* Fixed Export Buttons Container */}
        <div style={{ paddingTop: '12px', borderTop: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: '8px', flexShrink: 0 }}>
          <button className="btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '12px' }} onClick={onExport}>
            <Download size={18} />
            Export This Clip
          </button>
          <button className="btn-secondary" style={{ width: '100%', justifyContent: 'center', padding: '10px', fontSize: '0.85rem' }} onClick={onExportAll}>
            <Download size={16} />
            Export All Clips
          </button>
        </div>
      </div>
    </div>
  );
}
