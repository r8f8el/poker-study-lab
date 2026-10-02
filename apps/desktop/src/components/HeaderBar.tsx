import React from 'react';
import { Play, Pause, Square, Settings, Edit3, ShieldCheck, ShieldAlert, Monitor } from 'lucide-react';
import { CaptureSource } from '../../../../packages/shared-types/src';

interface HeaderBarProps {
  isCapturing: boolean;
  isPaused: boolean;
  fps: number;
  activeSource: CaptureSource | null;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onEmergencyStop: () => void;
  onOpenSettings: () => void;
  onOpenCorrection: () => void;
  onOpenSourceSelector: () => void;
}

export const HeaderBar: React.FC<HeaderBarProps> = ({
  isCapturing,
  isPaused,
  fps,
  activeSource,
  onStart,
  onPause,
  onResume,
  onEmergencyStop,
  onOpenSettings,
  onOpenCorrection,
  onOpenSourceSelector
}) => {
  const isAuthorized = activeSource ? activeSource.isAuthorized : false;

  return (
    <header
      className="glass-panel"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 24px',
        margin: '12px 16px',
        borderRadius: 14,
        border: '1px solid rgba(255, 255, 255, 0.08)'
      }}
    >
      {/* Branding and Capture Status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 16px rgba(16, 185, 129, 0.4)'
            }}
          >
            <span style={{ fontWeight: 800, fontSize: 18, color: '#ffffff' }}>♠</span>
          </div>
          <div>
            <h1 style={{ fontSize: 16, fontWeight: 700, letterSpacing: '0.02em', lineHeight: 1.2 }}>
              POKER STUDY LAB
            </h1>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              Assistente de Análise em Tempo Real
            </span>
          </div>
        </div>

        {/* Vertical divider */}
        <div style={{ width: 1, height: 28, background: 'var(--border-subtle)' }} />

        {/* Visible Capture Indicator (Mandatory Security Rule) */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 12px',
            borderRadius: 20,
            background: isCapturing
              ? isPaused
                ? 'rgba(245, 158, 11, 0.12)'
                : 'rgba(16, 185, 129, 0.12)'
              : 'rgba(244, 63, 94, 0.12)',
            border: `1px solid ${
              isCapturing
                ? isPaused
                  ? 'rgba(245, 158, 11, 0.3)'
                  : 'rgba(16, 185, 129, 0.3)'
                : 'rgba(244, 63, 94, 0.3)'
            }`
          }}
        >
          <div
            className={isCapturing && !isPaused ? 'capture-pulse-active' : ''}
            style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              backgroundColor: isCapturing
                ? isPaused
                  ? '#f59e0b'
                  : '#10b981'
                : '#f43f5e'
            }}
          />
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: isCapturing
                ? isPaused
                  ? '#fbbf24'
                  : '#34d399'
                : '#fb7185'
            }}
          >
            {isCapturing
              ? isPaused
                ? 'CAPTURA PAUSADA'
                : 'CAPTURA ATIVA'
              : 'CAPTURA INATIVA'}
          </span>
          {isCapturing && !isPaused && (
            <span
              style={{
                fontSize: 11,
                fontFamily: 'var(--font-mono)',
                color: 'var(--text-muted)',
                marginLeft: 4
              }}
            >
              ({fps} FPS)
            </span>
          )}
        </div>

        {/* Authorized Window Status */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 12,
            color: isAuthorized ? '#38bdf8' : '#fb7185',
            padding: '4px 10px',
            borderRadius: 6,
            background: isAuthorized ? 'rgba(56, 189, 248, 0.08)' : 'rgba(244, 63, 94, 0.08)'
          }}
        >
          {isAuthorized ? <ShieldCheck size={14} /> : <ShieldAlert size={14} />}
          <span>
            {activeSource ? activeSource.name.slice(0, 32) : 'Nenhuma janela selecionada'}
          </span>
        </div>
      </div>

      {/* Control Actions & Kill Switch */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {!isCapturing ? (
          <button className="btn-primary" onClick={onStart} id="btn-start-capture">
            <Play size={15} />
            <span>Iniciar Captura</span>
          </button>
        ) : isPaused ? (
          <button className="btn-primary" onClick={onResume} id="btn-resume-capture">
            <Play size={15} />
            <span>Retomar</span>
          </button>
        ) : (
          <button className="btn-secondary" onClick={onPause} id="btn-pause-capture">
            <Pause size={15} />
            <span>Pausar</span>
          </button>
        )}

        {/* Emergency Stop / Kill Switch (Mandatory Safety Rule) */}
        {isCapturing && (
          <button
            className="btn-danger"
            onClick={onEmergencyStop}
            id="btn-emergency-stop"
            title="Desligamento Imediato de Emergência"
          >
            <Square size={14} fill="currentColor" />
            <span>Desligar</span>
          </button>
        )}

        <button className="btn-secondary" onClick={onOpenSourceSelector} id="btn-open-source-selector">
          <Monitor size={15} />
          <span>Janela</span>
        </button>

        <button className="btn-secondary" onClick={onOpenCorrection} id="btn-open-correction">
          <Edit3 size={15} />
          <span>Corrigir</span>
        </button>

        <button className="btn-secondary" onClick={onOpenSettings} id="btn-open-settings">
          <Settings size={15} />
          <span>Configurações</span>
        </button>
      </div>
    </header>
  );
};
