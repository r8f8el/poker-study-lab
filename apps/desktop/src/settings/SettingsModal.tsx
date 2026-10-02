import React, { useState } from 'react';
import { AppSettings, TableLayoutProfile } from '../../../../packages/shared-types/src';
import { X, ShieldCheck, Sliders, Check } from 'lucide-react';
import { RoiCalibrationPanel } from './RoiCalibrationPanel';

interface SettingsModalProps {
  isOpen: boolean;
  settings: AppSettings;
  activeProfile: TableLayoutProfile;
  frameDataUrl?: string;
  onClose: () => void;
  onSave: (newSettings: AppSettings) => void;
  onSaveProfile?: (profile: TableLayoutProfile) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  settings,
  activeProfile,
  frameDataUrl,
  onClose,
  onSave,
  onSaveProfile
}) => {
  const [formData, setFormData] = useState<AppSettings>({ ...settings });
  const [activeTab, setActiveTab] = useState<'capture' | 'calibration' | 'confidence' | 'security' | 'ai'>('capture');

  if (!isOpen) return null;

  const handleSave = () => {
    onSave(formData);
    onClose();
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
          width: 720,
          maxHeight: '88vh',
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
            <Sliders size={18} color="#10b981" />
            <h2 style={{ fontSize: 16, fontWeight: 700 }}>Configurações do Poker Study Lab</h2>
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

        {/* Tab navigation */}
        <div
          style={{
            display: 'flex',
            padding: '0 24px',
            borderBottom: '1px solid var(--border-subtle)',
            background: 'rgba(0,0,0,0.2)'
          }}
        >
          {(['capture', 'calibration', 'confidence', 'security', 'ai'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '12px 14px',
                border: 'none',
                background: 'transparent',
                color: activeTab === tab ? '#10b981' : 'var(--text-muted)',
                fontWeight: activeTab === tab ? 600 : 400,
                borderBottom: activeTab === tab ? '2px solid #10b981' : '2px solid transparent',
                cursor: 'pointer',
                fontSize: 12,
                textTransform: 'capitalize'
              }}
            >
              {tab === 'capture' && 'Captura'}
              {tab === 'calibration' && 'Calibração ROI'}
              {tab === 'confidence' && 'Limites de Confiança'}
              {tab === 'security' && 'Segurança & Anti-Cheat'}
              {tab === 'ai' && 'IA Explicadora'}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div style={{ padding: 24, overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 20 }}>
          {activeTab === 'capture' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-dim)', display: 'block', marginBottom: 6 }}>
                  Identificador do Aplicativo Autorizado:
                </label>
                <input
                  type="text"
                  value={formData.authorizedAppIdentifier}
                  onChange={e => setFormData({ ...formData, authorizedAppIdentifier: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 8,
                    background: 'rgba(0,0,0,0.4)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-main)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 13
                  }}
                />
                <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>
                  A análise é bloqueada se a janela capturada não corresponder a este identificador.
                </span>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-dim)' }}>
                    Frequência de Captura (FPS):
                  </label>
                  <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: '#38bdf8' }}>
                    {formData.fps} FPS
                  </span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="30"
                  step="1"
                  value={formData.fps}
                  onChange={e => setFormData({ ...formData, fps: parseInt(e.target.value) })}
                  style={{ width: '100%' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-dim)' }}>
                  <span>5 FPS (Econômico)</span>
                  <span>15 FPS (Recomendado)</span>
                  <span>30 FPS (Alto Desempenho)</span>
                </div>
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-dim)', display: 'block', marginBottom: 6 }}>
                  Perfil de Regiões de Interesse (ROI):
                </label>
                <div
                  style={{
                    padding: 12,
                    borderRadius: 8,
                    background: 'rgba(0,0,0,0.3)',
                    border: '1px solid var(--border-subtle)',
                    fontSize: 12
                  }}
                >
                  <div style={{ fontWeight: 600, color: '#38bdf8', marginBottom: 4 }}>
                    {activeProfile.name} ({activeProfile.referenceResolution.width}x{activeProfile.referenceResolution.height})
                  </div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>
                    6 ROIs configuradas: Cartas Hero, Board, Pote, Botões de Ação, Jogadores e Indicador Ativo.
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'calibration' && (
            <RoiCalibrationPanel
              profile={activeProfile}
              frameDataUrl={frameDataUrl}
              onSaveProfile={updated => onSaveProfile?.(updated)}
            />
          )}

          {activeTab === 'confidence' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-dim)' }}>
                    Limite para Aceitação Automática Imediata:
                  </label>
                  <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: '#34d399' }}>
                    {(formData.minConfidenceAutoAccept * 100).toFixed(0)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0.90"
                  max="0.99"
                  step="0.01"
                  value={formData.minConfidenceAutoAccept}
                  onChange={e => setFormData({ ...formData, minConfidenceAutoAccept: parseFloat(e.target.value) })}
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-dim)' }}>
                    Limite para Aceitação com Confirmação Temporal:
                  </label>
                  <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: '#38bdf8' }}>
                    {(formData.minConfidenceTemporalAccept * 100).toFixed(0)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0.80"
                  max="0.98"
                  step="0.01"
                  value={formData.minConfidenceTemporalAccept}
                  onChange={e => setFormData({ ...formData, minConfidenceTemporalAccept: parseFloat(e.target.value) })}
                  style={{ width: '100%' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-dim)', display: 'block', marginBottom: 6 }}>
                    Janela Temporal (Frames):
                  </label>
                  <input
                    type="number"
                    min="3"
                    max="15"
                    value={formData.temporalWindowFrames}
                    onChange={e => setFormData({ ...formData, temporalWindowFrames: parseInt(e.target.value) || 7 })}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: 8,
                      background: 'rgba(0,0,0,0.4)',
                      border: '1px solid var(--border-subtle)',
                      color: 'var(--text-main)',
                      fontSize: 13
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-dim)', display: 'block', marginBottom: 6 }}>
                    Consenso Mínimo (Frames):
                  </label>
                  <input
                    type="number"
                    min="2"
                    max="12"
                    value={formData.temporalMinConsensusFrames}
                    onChange={e => setFormData({ ...formData, temporalMinConsensusFrames: parseInt(e.target.value) || 5 })}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: 8,
                      background: 'rgba(0,0,0,0.4)',
                      border: '1px solid var(--border-subtle)',
                      color: 'var(--text-main)',
                      fontSize: 13
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'security' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div
                style={{
                  background: 'rgba(16, 185, 129, 0.08)',
                  border: '1px solid rgba(16, 185, 129, 0.25)',
                  borderRadius: 8,
                  padding: 12,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10
                }}
              >
                <ShieldCheck size={24} color="#10b981" />
                <span style={{ fontSize: 12, color: '#34d399', fontWeight: 600 }}>
                  Diretrizes Técnicas de Segurança Ativas
                </span>
              </div>

              {[
                'Nenhum clique ou comando de mouse é gerado pelo sistema.',
                'Nenhuma digitação automática ou controle de janela externa.',
                'Captura restrita estritamente à janela e região autorizada.',
                'Indicador visível de captura ativa permanentemente exibido.',
                'Botão de pânico e desligamento imediato disponível.',
                'Descarte imediato de frames da memória após o ciclo de leitura.',
                'Processamento estritamente local (sem transmissão externa de telas).'
              ].map((rule, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12 }}>
                  <div
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: '50%',
                      background: 'rgba(16, 185, 129, 0.2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <Check size={12} color="#10b981" />
                  </div>
                  <span>{rule}</span>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'ai' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: 12,
                  borderRadius: 8,
                  background: 'rgba(0,0,0,0.3)',
                  border: '1px solid var(--border-subtle)'
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>Ativar Explicações Didáticas de IA</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    A IA gera resumos conceituais pedagógicos sem jamais alterar as recomendações do motor determinístico.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={formData.enableAIExplanations}
                  onChange={e => setFormData({ ...formData, enableAIExplanations: e.target.checked })}
                  style={{ transform: 'scale(1.3)', cursor: 'pointer' }}
                  id="chk-enable-ai"
                />
              </div>

              {formData.enableAIExplanations && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-dim)', display: 'block', marginBottom: 6 }}>
                      Provedor de Explicação:
                    </label>
                    <select
                      value={formData.aiProvider || 'offline_heuristic'}
                      onChange={e => setFormData({ ...formData, aiProvider: e.target.value as any })}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: 8,
                        background: 'rgba(0,0,0,0.4)',
                        border: '1px solid var(--border-subtle)',
                        color: 'var(--text-main)',
                        fontSize: 13
                      }}
                      id="select-ai-provider"
                    >
                      <option value="offline_heuristic">Heurística Local Offline (0ms, Seguro, Sem Chave)</option>
                      <option value="custom_api">API Externa LLM / Local Ollama (Gemini, Claude, GPT, Ollama)</option>
                    </select>
                  </div>

                  {formData.aiProvider === 'custom_api' && (
                    <>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: 10,
                          padding: 12,
                          borderRadius: 8,
                          background: 'rgba(234, 179, 8, 0.08)',
                          border: '1px solid rgba(234, 179, 8, 0.25)'
                        }}
                      >
                        <input
                          type="checkbox"
                          id="chk-external-api-consent"
                          checked={!!formData.externalApiConsent}
                          onChange={e => setFormData({ ...formData, externalApiConsent: e.target.checked })}
                          style={{ marginTop: 2, transform: 'scale(1.2)', cursor: 'pointer' }}
                        />
                        <label htmlFor="chk-external-api-consent" style={{ fontSize: 12, color: 'var(--text-main)', cursor: 'pointer' }}>
                          <strong style={{ color: '#eab308', display: 'block', marginBottom: 2 }}>
                            Consentimento de Envio Externo (Salvaguarda de Privacidade):
                          </strong>
                          Autorizo o envio de metadados anonimizados da mão (cartas normalizadas, pot odds, ação determinística calculada) para a API configurada abaixo.
                          <span style={{ display: 'block', marginTop: 4, color: 'var(--text-muted)' }}>
                            <strong>Garantia Estrita:</strong> Nenhuma imagem bruta, captura de tela ou frame da mesa é transmitido para a rede em hipótese alguma.
                          </span>
                        </label>
                      </div>

                      <div>
                        <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-dim)', display: 'block', marginBottom: 6 }}>
                          Endpoint da API (Exige HTTPS ou localhost):
                        </label>
                        <input
                          type="text"
                          placeholder="https://api.openai.com/v1/chat/completions ou http://localhost:11434/api/chat"
                          value={formData.aiApiEndpoint || ''}
                          onChange={e => setFormData({ ...formData, aiApiEndpoint: e.target.value })}
                          style={{
                            width: '100%',
                            padding: '8px 12px',
                            borderRadius: 8,
                            background: 'rgba(0,0,0,0.4)',
                            border: '1px solid var(--border-subtle)',
                            color: 'var(--text-main)',
                            fontSize: 13
                          }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-dim)', display: 'block', marginBottom: 6 }}>
                          Chave de API (Protegida na Sessão - não gravada em disco):
                        </label>
                        <input
                          type="password"
                          placeholder="sk-..."
                          value={formData.aiApiKey || ''}
                          onChange={e => setFormData({ ...formData, aiApiKey: e.target.value })}
                          style={{
                            width: '100%',
                            padding: '8px 12px',
                            borderRadius: 8,
                            background: 'rgba(0,0,0,0.4)',
                            border: '1px solid var(--border-subtle)',
                            color: 'var(--text-main)',
                            fontSize: 13
                          }}
                        />
                      </div>
                    </>
                  )}
                </div>
              )}

              <div
                style={{
                  padding: 12,
                  borderRadius: 8,
                  background: 'rgba(16, 185, 129, 0.05)',
                  border: '1px solid rgba(16, 185, 129, 0.2)',
                  fontSize: 11,
                  color: 'var(--text-muted)'
                }}
              >
                Garantia de Não-Interferência: O motor de recomendação opera de forma determinística independente da IA. Se a API externa estiver fora do ar ou desativada, a heurística local assume instantaneamente sem quebrar a interface.
              </div>
            </div>
          )}
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
          <button className="btn-primary" onClick={handleSave}>
            Salvar Configurações
          </button>
        </div>
      </div>
    </div>
  );
};
