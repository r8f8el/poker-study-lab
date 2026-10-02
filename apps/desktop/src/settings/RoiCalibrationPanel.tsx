import React, { useState } from 'react';
import { TableLayoutProfile, RectRegion } from '../../../../packages/shared-types/src';
import { Save, RotateCcw, Check } from 'lucide-react';

interface RoiCalibrationPanelProps {
  profile: TableLayoutProfile;
  frameDataUrl?: string;
  onSaveProfile: (updatedProfile: TableLayoutProfile) => void;
}

export const RoiCalibrationPanel: React.FC<RoiCalibrationPanelProps> = ({
  profile,
  frameDataUrl: _frameDataUrl,
  onSaveProfile
}) => {
  const [selectedRoi, setSelectedRoi] = useState<keyof TableLayoutProfile['regions']>('hero_cards');
  const [regions, setRegions] = useState(profile.regions);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const activeRect = regions[selectedRoi] as RectRegion;

  const handleCoordinateChange = (field: keyof RectRegion, value: number) => {
    setRegions((prev: TableLayoutProfile['regions']) => ({
      ...prev,
      [selectedRoi]: {
        ...(prev[selectedRoi] as RectRegion),
        [field]: Math.max(0, value)
      }
    }));
    setSavedSuccess(false);
  };

  const handleSave = () => {
    onSaveProfile({
      ...profile,
      regions
    });
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  const handleReset = () => {
    setRegions(profile.regions);
    setSavedSuccess(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h3 style={{ fontSize: 14, fontWeight: 700 }}>Modo de Calibração de Regiões de Interesse (ROI)</h3>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            Ajuste as coordenadas para o layout do seu aplicativo ({profile.referenceResolution.width}x{profile.referenceResolution.height}).
          </span>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-secondary" style={{ padding: '6px 12px', fontSize: 11 }} onClick={handleReset}>
            <RotateCcw size={12} />
            <span>Resetar</span>
          </button>
          <button className="btn-primary" style={{ padding: '6px 14px', fontSize: 11 }} onClick={handleSave}>
            {savedSuccess ? <Check size={12} color="#ffffff" /> : <Save size={12} />}
            <span>{savedSuccess ? 'Salvo!' : 'Salvar Perfil'}</span>
          </button>
        </div>
      </div>

      {/* Selector of which region to edit */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {[
          { key: 'hero_cards', label: 'Cartas Próprias (Hero)' },
          { key: 'board', label: 'Board Comunitário' },
          { key: 'pot', label: 'Pote da Mesa' },
          { key: 'action_buttons', label: 'Botões de Ação' },
          { key: 'active_player_indicator', label: 'Indicador Jogador Ativo' }
        ].map(item => (
          <button
            key={item.key}
            onClick={() => setSelectedRoi(item.key as any)}
            className="btn-secondary"
            style={{
              padding: '5px 10px',
              fontSize: 11,
              background: selectedRoi === item.key ? 'rgba(16, 185, 129, 0.2)' : 'rgba(0,0,0,0.3)',
              borderColor: selectedRoi === item.key ? '#10b981' : 'var(--border-subtle)',
              color: selectedRoi === item.key ? '#34d399' : 'var(--text-main)',
              fontWeight: selectedRoi === item.key ? 700 : 500
            }}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Coordinate Input Controls */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 12,
          padding: 12,
          borderRadius: 8,
          background: 'rgba(0,0,0,0.3)',
          border: '1px solid var(--border-subtle)'
        }}
      >
        <div>
          <label style={{ fontSize: 11, color: 'var(--text-dim)', display: 'block', marginBottom: 4 }}>
            Posição X:
          </label>
          <input
            type="number"
            value={activeRect.x}
            onChange={e => handleCoordinateChange('x', parseInt(e.target.value) || 0)}
            style={{
              width: '100%',
              padding: '6px 8px',
              borderRadius: 6,
              background: 'rgba(0,0,0,0.4)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-main)',
              fontSize: 12
            }}
          />
        </div>
        <div>
          <label style={{ fontSize: 11, color: 'var(--text-dim)', display: 'block', marginBottom: 4 }}>
            Posição Y:
          </label>
          <input
            type="number"
            value={activeRect.y}
            onChange={e => handleCoordinateChange('y', parseInt(e.target.value) || 0)}
            style={{
              width: '100%',
              padding: '6px 8px',
              borderRadius: 6,
              background: 'rgba(0,0,0,0.4)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-main)',
              fontSize: 12
            }}
          />
        </div>
        <div>
          <label style={{ fontSize: 11, color: 'var(--text-dim)', display: 'block', marginBottom: 4 }}>
            Largura (Width):
          </label>
          <input
            type="number"
            value={activeRect.width}
            onChange={e => handleCoordinateChange('width', parseInt(e.target.value) || 1)}
            style={{
              width: '100%',
              padding: '6px 8px',
              borderRadius: 6,
              background: 'rgba(0,0,0,0.4)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-main)',
              fontSize: 12
            }}
          />
        </div>
        <div>
          <label style={{ fontSize: 11, color: 'var(--text-dim)', display: 'block', marginBottom: 4 }}>
            Altura (Height):
          </label>
          <input
            type="number"
            value={activeRect.height}
            onChange={e => handleCoordinateChange('height', parseInt(e.target.value) || 1)}
            style={{
              width: '100%',
              padding: '6px 8px',
              borderRadius: 6,
              background: 'rgba(0,0,0,0.4)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-main)',
              fontSize: 12
            }}
          />
        </div>
      </div>
    </div>
  );
};
