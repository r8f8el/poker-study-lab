import React, { useState } from 'react';
import { CaptureSource } from '../../../../packages/shared-types/src';
import { MOCK_AUTHORIZED_SOURCE } from '../../../../packages/test-fixtures/src';
import { Monitor, ShieldCheck, X, Play } from 'lucide-react';

interface WindowSelectorModalProps {
  isOpen: boolean;
  activeSource: CaptureSource | null;
  onClose: () => void;
  onSelectAndStart: (source: CaptureSource, fps: number) => void;
  onRequestNativePicker: () => Promise<void>;
}

export const WindowSelectorModal: React.FC<WindowSelectorModalProps> = ({
  isOpen,
  activeSource: _activeSource,
  onClose,
  onSelectAndStart,
  onRequestNativePicker
}) => {
  const [selectedSourceType, setSelectedSourceType] = useState<'synthetic' | 'native'>('synthetic');
  const [fps, setFps] = useState(15);

  // Mandatory Safety Checklist state
  const [check1, setCheck1] = useState(false);
  const [check2, setCheck2] = useState(false);
  const [check3, setCheck3] = useState(false);

  if (!isOpen) return null;

  const isFormValid = check1 && check2 && check3;

  const handleConfirm = async () => {
    if (!isFormValid) return;

    if (selectedSourceType === 'native') {
      await onRequestNativePicker();
      onClose();
    } else {
      onSelectAndStart(MOCK_AUTHORIZED_SOURCE, fps);
      onClose();
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000
      }}
    >
      <div
        className="glass-panel"
        style={{
          width: 620,
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: 16,
          border: '1px solid var(--border-active)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)'
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 24px',
            borderBottom: '1px solid var(--border-subtle)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Monitor size={18} color="#10b981" />
            <h2 style={{ fontSize: 16, fontWeight: 700 }}>Selecionar Janela e Confirmar Permissão</h2>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: 24, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* Source options */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-dim)', display: 'block', marginBottom: 8 }}>
              Escolha a Origem de Captura:
            </label>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div
                onClick={() => setSelectedSourceType('synthetic')}
                style={{
                  padding: 14,
                  borderRadius: 10,
                  cursor: 'pointer',
                  background: selectedSourceType === 'synthetic' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(0,0,0,0.3)',
                  border: `2px solid ${
                    selectedSourceType === 'synthetic' ? '#10b981' : 'var(--border-subtle)'
                  }`
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 700, color: '#34d399', marginBottom: 4 }}>
                  Mesa Simulada (Fixture)
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  Ambiente reproduzível isolado com frames sintéticos e cenários de teste controlados.
                </div>
              </div>

              <div
                onClick={() => setSelectedSourceType('native')}
                style={{
                  padding: 14,
                  borderRadius: 10,
                  cursor: 'pointer',
                  background: selectedSourceType === 'native' ? 'rgba(56, 189, 248, 0.12)' : 'rgba(0,0,0,0.3)',
                  border: `2px solid ${selectedSourceType === 'native' ? '#38bdf8' : 'var(--border-subtle)'}`
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 700, color: '#38bdf8', marginBottom: 4 }}>
                  Janela Nativa do SO
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  Captura direta de janela via API do sistema com verificação estrita de autorização.
                </div>
              </div>
            </div>
          </div>

          {/* FPS Slider */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-dim)' }}>
                Taxa de Quadros da Captura:
              </label>
              <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: '#38bdf8' }}>
                {fps} FPS
              </span>
            </div>
            <input
              type="range"
              min="10"
              max="30"
              value={fps}
              onChange={e => setFps(parseInt(e.target.value))}
              style={{ width: '100%' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-dim)' }}>
              <span>10 FPS (Econômico)</span>
              <span>15-20 FPS (Recomendado)</span>
              <span>30 FPS (Fluidez Máxima)</span>
            </div>
          </div>

          {/* Mandatory Security Checklist */}
          <div
            style={{
              background: 'rgba(0, 0, 0, 0.4)',
              borderRadius: 10,
              padding: 16,
              border: '1px solid var(--border-subtle)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <ShieldCheck size={18} color="#10b981" />
              <span style={{ fontSize: 12, fontWeight: 700, color: '#f8fafc' }}>
                Confirmação de Permissão e Conformidade (Obrigatório)
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 10,
                  fontSize: 12,
                  color: 'var(--text-muted)',
                  cursor: 'pointer'
                }}
              >
                <input
                  type="checkbox"
                  checked={check1}
                  onChange={e => setCheck1(e.target.checked)}
                  style={{ marginTop: 2 }}
                />
                <span>
                  Confirmo que a janela capturada pertence ao meu próprio aplicativo de pôquer autorizado e estou em conformidade com as regras de estudo.
                </span>
              </label>

              <label
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 10,
                  fontSize: 12,
                  color: 'var(--text-muted)',
                  cursor: 'pointer'
                }}
              >
                <input
                  type="checkbox"
                  checked={check2}
                  onChange={e => setCheck2(e.target.checked)}
                  style={{ marginTop: 2 }}
                />
                <span>
                  Estou ciente de que o indicador visual de captura permanecerá ativado na tela e que a captura pode ser encerrada a qualquer momento.
                </span>
              </label>

              <label
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 10,
                  fontSize: 12,
                  color: 'var(--text-muted)',
                  cursor: 'pointer'
                }}
              >
                <input
                  type="checkbox"
                  checked={check3}
                  onChange={e => setCheck3(e.target.checked)}
                  style={{ marginTop: 2 }}
                />
                <span>
                  Reconheço que o Poker Study Lab não gera cliques, movimentações de mouse, atalhos de teclado ou controle sobre outros softwares.
                </span>
              </label>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: 12,
            padding: '16px 24px',
            borderTop: '1px solid var(--border-subtle)',
            background: 'rgba(0,0,0,0.2)'
          }}
        >
          <button className="btn-secondary" onClick={onClose}>
            Cancelar
          </button>
          <button
            className="btn-primary"
            onClick={handleConfirm}
            disabled={!isFormValid}
            style={{
              opacity: isFormValid ? 1 : 0.45,
              cursor: isFormValid ? 'pointer' : 'not-allowed'
            }}
          >
            <Play size={14} />
            <span>Confirmar e Iniciar Captura</span>
          </button>
        </div>
      </div>
    </div>
  );
};
