import React, { useState } from 'react';
import { OpponentProfile, OpponentProfileType } from '../../../../packages/shared-types/src';
import {
  buildRangeMatrix,
  OPPONENT_PROFILES,
  getCombosForPercentage
} from '../decision/RangeModel';
import { Users, Sliders, CheckCircle2, RotateCcw } from 'lucide-react';

interface RangeMatrixPanelProps {
  activeProfile: OpponentProfile;
  onChangeProfile: (profile: OpponentProfile) => void;
}

export const RangeMatrixPanel: React.FC<RangeMatrixPanelProps> = ({
  activeProfile,
  onChangeProfile
}) => {
  const matrix = buildRangeMatrix();
  const [selectedCombos, setSelectedCombos] = useState<Set<string>>(new Set(activeProfile.combos));
  const [sliderPct, setSliderPct] = useState<number>(activeProfile.rangePercentage);

  const handleSelectProfile = (p: OpponentProfile) => {
    setSelectedCombos(new Set(p.combos));
    setSliderPct(p.rangePercentage);
    onChangeProfile(p);
  };

  const handleToggleCell = (combo: string) => {
    const next = new Set(selectedCombos);
    if (next.has(combo)) {
      next.delete(combo);
    } else {
      next.add(combo);
    }
    setSelectedCombos(next);
    const customProfile: OpponentProfile = {
      id: 'profile_custom',
      name: 'Customizado (Manual)',
      type: 'CUSTOM',
      description: 'Range ajustado manualmente pelo operador na matriz.',
      vpip: Math.round((next.size / 169) * 100),
      pfr: Math.round((next.size / 169) * 80),
      aggressionFactor: 2.0,
      rangePercentage: Math.round((next.size / 169) * 100),
      combos: Array.from(next)
    };
    onChangeProfile(customProfile);
  };

  const handleSliderChange = (pct: number) => {
    setSliderPct(pct);
    const newCombos = getCombosForPercentage(pct);
    setSelectedCombos(new Set(newCombos));

    const customProfile: OpponentProfile = {
      id: 'profile_custom',
      name: `Customizado (${pct}%)`,
      type: 'CUSTOM',
      description: `Top ${pct}% das melhores mãos iniciais.`,
      vpip: pct,
      pfr: Math.round(pct * 0.8),
      aggressionFactor: 2.0,
      rangePercentage: pct,
      combos: newCombos
    };
    onChangeProfile(customProfile);
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        background: 'rgba(255, 255, 255, 0.02)',
        borderRadius: 10,
        padding: 12,
        border: '1px solid var(--border-subtle)'
      }}
    >
      {/* Header & Profiles */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Users size={14} style={{ color: '#a78bfa' }} />
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', color: 'var(--text-dim)' }}>
            PERFIL DO ADVERSÁRIO & MATRIZ DE RANGES
          </span>
        </div>

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {OPPONENT_PROFILES.map(prof => (
            <button
              key={prof.id}
              className="btn-secondary"
              style={{
                padding: '3px 8px',
                fontSize: 10,
                background: activeProfile.type === prof.type ? 'rgba(167, 139, 250, 0.2)' : 'rgba(0,0,0,0.3)',
                borderColor: activeProfile.type === prof.type ? '#a78bfa' : 'var(--border-subtle)',
                color: activeProfile.type === prof.type ? '#c4b5fd' : 'var(--text-muted)'
              }}
              onClick={() => handleSelectProfile(prof)}
            >
              {prof.name.split(' ')[0]} ({prof.rangePercentage}%)
            </button>
          ))}
        </div>
      </div>

      {/* Description & Slider */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', flex: 1, minWidth: 200 }}>
          <strong style={{ color: 'var(--text-main)' }}>{activeProfile.name}:</strong> {activeProfile.description}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 200 }}>
          <Sliders size={12} style={{ color: '#a78bfa' }} />
          <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-dim)' }}>Top:</span>
          <input
            type="range"
            min="1"
            max="100"
            value={sliderPct}
            onChange={e => handleSliderChange(parseInt(e.target.value))}
            style={{ width: 100 }}
          />
          <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: '#38bdf8', minWidth: 32 }}>
            {sliderPct}%
          </span>
        </div>
      </div>

      {/* 13x13 Interactive Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(13, 1fr)',
          gap: 2,
          padding: 4,
          background: 'rgba(0,0,0,0.4)',
          borderRadius: 6,
          maxHeight: 280,
          overflowY: 'auto'
        }}
      >
        {matrix.map((row, r) =>
          row.map((cell, c) => {
            const isPair = r === c;
            const isSuited = r < c;
            const isSelected = selectedCombos.has(cell);

            // Theme colors based on hand category
            const baseBorder = isPair ? '#fbbf24' : isSuited ? '#10b981' : '#38bdf8';
            const baseBg = isSelected
              ? isPair
                ? 'rgba(245, 158, 11, 0.45)'
                : isSuited
                ? 'rgba(16, 185, 129, 0.45)'
                : 'rgba(56, 189, 248, 0.45)'
              : 'rgba(255, 255, 255, 0.02)';

            return (
              <div
                key={cell}
                onClick={() => handleToggleCell(cell)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: 18,
                  fontSize: 9,
                  fontWeight: isSelected ? 700 : 500,
                  fontFamily: 'var(--font-mono)',
                  color: isSelected ? '#ffffff' : 'rgba(255, 255, 255, 0.4)',
                  backgroundColor: baseBg,
                  border: `1px solid ${isSelected ? baseBorder : 'rgba(255,255,255,0.06)'}`,
                  borderRadius: 3,
                  cursor: 'pointer',
                  userSelect: 'none',
                  transition: 'all 0.1s ease'
                }}
                title={`${cell} (${isSelected ? 'Ativo' : 'Inativo'})`}
              >
                {cell}
              </div>
            );
          })
        )}
      </div>

      {/* Footer stats */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
        <div>
          Combos ativos: <span style={{ color: '#38bdf8', fontWeight: 600 }}>{selectedCombos.size}</span>/169 (
          {Math.round((selectedCombos.size / 169) * 100)}%)
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <span>VPIP: ~{activeProfile.vpip}%</span>
          <span>PFR: ~{activeProfile.pfr}%</span>
          <span>AF: {activeProfile.aggressionFactor}</span>
        </div>
      </div>
    </div>
  );
};
