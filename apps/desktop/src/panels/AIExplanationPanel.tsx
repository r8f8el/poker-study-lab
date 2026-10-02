import React, { useState } from 'react';
import { AIExplanationResult } from '../../../../packages/shared-types/src';
import {
  Sparkles,
  ChevronDown,
  ChevronUp,
  Brain,
  ShieldAlert,
  HelpCircle,
  RefreshCw,
  Lightbulb,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';

interface AIExplanationPanelProps {
  explanation: AIExplanationResult | null;
  isLoading?: boolean;
  onRefresh?: () => void;
  enableAIExplanations?: boolean;
}

export const AIExplanationPanel: React.FC<AIExplanationPanelProps> = ({
  explanation,
  isLoading = false,
  onRefresh,
  enableAIExplanations = true
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(true);

  if (!enableAIExplanations) {
    return (
      <div
        style={{
          background: 'rgba(255, 255, 255, 0.02)',
          borderRadius: 10,
          padding: 12,
          border: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          color: 'var(--text-muted)',
          fontSize: 12
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Brain size={14} style={{ color: 'var(--text-dim)' }} />
          <span>IA Explicadora desativada nas configurações.</span>
        </div>
      </div>
    );
  }

  if (!explanation) {
    return (
      <div
        style={{
          background: 'rgba(255, 255, 255, 0.02)',
          borderRadius: 10,
          padding: 14,
          border: '1px solid var(--border-subtle)',
          textAlign: 'center',
          color: 'var(--text-dim)',
          fontSize: 12
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 4 }}>
          <Brain size={15} style={{ color: '#818cf8' }} />
          <span style={{ fontWeight: 600 }}>IA EXPLICADORA DIDÁTICA</span>
        </div>
        <span>Aguardando próxima decisão determinística para gerar contextualização didática.</span>
      </div>
    );
  }

  const isGateBlocked = explanation.source_label === 'offline_heuristic' &&
    explanation.concept_summary.includes('Salvaguarda');

  return (
    <div
      style={{
        background: isGateBlocked
          ? 'linear-gradient(180deg, rgba(244, 63, 94, 0.05) 0%, rgba(20, 24, 39, 0.6) 100%)'
          : 'linear-gradient(180deg, rgba(99, 102, 241, 0.08) 0%, rgba(20, 24, 39, 0.6) 100%)',
        borderRadius: 10,
        padding: 14,
        border: `1px solid ${
          isGateBlocked ? 'rgba(244, 63, 94, 0.3)' : 'rgba(99, 102, 241, 0.3)'
        }`,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.25)',
        transition: 'all 0.2s ease'
      }}
      id="ai-explanation-panel"
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              width: 24,
              height: 24,
              borderRadius: 6,
              background: isGateBlocked
                ? 'rgba(244, 63, 94, 0.15)'
                : 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            {isGateBlocked ? (
              <ShieldAlert size={14} color="#f43f5e" />
            ) : (
              <Sparkles size={14} color="#ffffff" />
            )}
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.04em', color: '#f8fafc' }}>
                IA EXPLICADORA DIDÁTICA
              </span>
              <span
                style={{
                  fontSize: 10,
                  fontFamily: 'var(--font-mono)',
                  padding: '1px 6px',
                  borderRadius: 4,
                  background: explanation.is_ai_generated
                    ? 'rgba(168, 85, 247, 0.15)'
                    : 'rgba(56, 189, 248, 0.15)',
                  color: explanation.is_ai_generated ? '#c084fc' : '#38bdf8'
                }}
              >
                {explanation.is_ai_generated ? 'ONLINE ASSISTANT' : 'HEURÍSTICA LOCAL'}
              </span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-dim)' }}>
            {explanation.latency_ms}ms
          </span>

          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={isLoading}
              className="btn-secondary"
              style={{ padding: '3px 6px', height: 22 }}
              title="Re-gerar explicação"
              id="btn-refresh-ai-explanation"
            >
              <RefreshCw size={11} className={isLoading ? 'animate-spin' : ''} />
            </button>
          )}

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="btn-secondary"
            style={{ padding: '3px 6px', height: 22 }}
            id="btn-toggle-ai-explanation"
          >
            {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
        </div>
      </div>

      {/* Main Concept Highlight */}
      <div
        style={{
          background: isGateBlocked
            ? 'rgba(244, 63, 94, 0.1)'
            : 'rgba(99, 102, 241, 0.12)',
          borderRadius: 6,
          padding: '8px 10px',
          borderLeft: `3px solid ${isGateBlocked ? '#f43f5e' : '#818cf8'}`
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <Lightbulb size={13} color={isGateBlocked ? '#f43f5e' : '#a5b4fc'} />
          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: isGateBlocked ? '#fca5a5' : '#c7d2fe'
            }}
          >
            {explanation.concept_summary}
          </span>
        </div>
      </div>

      {isExpanded && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 2 }}>
          {/* Tactical Rationale */}
          <div style={{ fontSize: 12, lineHeight: 1.5, color: 'var(--text-main)' }}>
            {explanation.tactical_rationale}
          </div>

          {/* Alternative Lines */}
          {explanation.alternative_lines && explanation.alternative_lines.length > 0 && (
            <div
              style={{
                background: 'rgba(0, 0, 0, 0.25)',
                borderRadius: 6,
                padding: '8px 10px',
                border: '1px solid var(--border-subtle)'
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: 'var(--text-muted)',
                  marginBottom: 6,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4
                }}
              >
                <span>Cenários & Adaptações Estratégicas</span>
              </div>
              <ul style={{ margin: 0, paddingLeft: 16, fontSize: 11, color: 'var(--text-dim)' }}>
                {explanation.alternative_lines.map((line, idx) => (
                  <li key={idx} style={{ marginBottom: 4, lineHeight: 1.4 }}>
                    {line}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Risks & Uncertainty */}
          {explanation.risk_and_uncertainty && explanation.risk_and_uncertainty.length > 0 && (
            <div
              style={{
                background: 'rgba(245, 158, 11, 0.05)',
                borderRadius: 6,
                padding: '6px 10px',
                border: '1px solid rgba(245, 158, 11, 0.2)',
                display: 'flex',
                flexDirection: 'column',
                gap: 4
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: '#fbbf24',
                  letterSpacing: '0.04em',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4
                }}
              >
                <AlertTriangle size={11} />
                <span>RISCOS & PONTOS DE ATENÇÃO</span>
              </div>
              {explanation.risk_and_uncertainty.map((risk, idx) => (
                <div key={idx} style={{ fontSize: 11, color: '#fde68a', lineHeight: 1.35 }}>
                  • {risk}
                </div>
              ))}
            </div>
          )}

          {/* Strict AI disclaimer */}
          <div
            style={{
              fontSize: 10,
              color: 'var(--text-dim)',
              textAlign: 'center',
              borderTop: '1px dashed var(--border-subtle)',
              paddingTop: 6
            }}
          >
            A IA atua puramente como mentora pedagógica e não altera a recomendação determinística calculada pelo motor.
          </div>
        </div>
      )}
    </div>
  );
};
