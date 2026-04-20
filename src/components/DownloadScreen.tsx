import { useEffect, useState } from 'react';
import { CheckCircle, Cpu, Zap, Brain } from 'lucide-react';

interface DownloadScreenProps {
  onComplete: () => void;
}

export function DownloadScreen({ onComplete }: DownloadScreenProps) {
  const [step, setStep] = useState(0);

  const steps = [
    { icon: Cpu,   label: 'Verifying Whisper AI Engine...' },
    { icon: Brain, label: 'Verifying Llama Analysis Engine...' },
    { icon: Zap,   label: 'Verifying FFmpeg Renderer...' },
  ];

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    timers.push(setTimeout(() => setStep(1), 600));
    timers.push(setTimeout(() => setStep(2), 1200));
    timers.push(setTimeout(() => setStep(3), 1800));
    timers.push(setTimeout(() => onComplete(), 2600));
    return () => timers.forEach(clearTimeout);
  }, [onComplete]);

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
        maxHeight: '400px',
        borderRadius: '20px',
        position: 'relative',
        gap: '20px'
      }}>
        
        {step < 3 ? (
          <>
            <div className="pulse" style={{ background: 'var(--accent-primary)', borderRadius: '50%', padding: '12px', marginBottom: '4px' }}>
              <Cpu size={28} color="white" />
            </div>
            <div style={{ textAlign: 'center' }}>
              <h2 style={{ fontSize: '1.4rem', marginBottom: '4px' }}>Initializing ClipGenius AI</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Setting up your local AI environment...</p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: '320px', width: '100%', maxWidth: '400px' }}>
              {steps.map((s, i) => {
                const Icon = s.icon;
                const done = step > i;
                const active = step === i;
                return (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: '12px',
                    background: done ? 'rgba(16, 185, 129, 0.08)' : active ? 'rgba(99,102,241,0.08)' : 'rgba(255,255,255,0.02)',
                    border: `1px solid ${done ? 'rgba(16,185,129,0.3)' : active ? 'var(--accent-primary)' : 'var(--border-subtle)'}`,
                    padding: '10px 14px', borderRadius: '12px',
                    transition: 'all 0.3s ease'
                  }}>
                    {done
                      ? <CheckCircle size={18} color="#10b981" />
                      : <Icon size={18} color={active ? 'var(--accent-primary)' : 'rgba(255,255,255,0.2)'} className={active ? 'pulse' : ''} />
                    }
                    <span style={{ fontSize: '0.8rem', color: done ? '#10b981' : active ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                      {s.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
            <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: '20px', borderRadius: '50%' }}>
              <CheckCircle size={48} color="#10b981" className="animate-fade-in" />
            </div>
            <div>
              <h2 style={{ color: '#10b981', fontSize: '1.6rem', marginBottom: '4px' }}>All Systems Ready!</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>AI Engines verified. 100% Offline Mode active.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
