import React, { useState, useRef, useEffect } from 'react';
import {
  GameState,
  TableLayoutProfile,
  CapturedFrame,
  RecommendationGateResult,
  DecisionRecommendation,
  GameEvent,
  OpponentProfile,
  AIExplanationResult,
  RectRegion
} from '../../../../packages/shared-types/src';
import { DEFAULT_LAYOUT_PROFILE, POKERSTARS_LAYOUT_PROFILE, SUPREMA_POKER_LAYOUT_PROFILE } from '../../../../packages/test-fixtures/src';
import { PlayingCard } from '../components/PlayingCard';
import { FrameMetrics } from '../capture/CircularFrameBuffer';
import { WindowStatus } from '../capture/WindowLifecycleMonitor';
import { RangeMatrixPanel } from './RangeMatrixPanel';
import { AIExplanationPanel } from './AIExplanationPanel';
import { OPPONENT_PROFILES } from '../decision/RangeModel';
import {
  Layers,
  AlertTriangle,
  CheckCircle2,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  Eye,
  EyeOff,
  Database,
  History,
  Users,
  Smartphone,
  Monitor,
  Crosshair,
  Move,
  Check,
  Save,
  X,
  Search
} from 'lucide-react';
import { SlotDebugInfo } from '../vision/TableVisionAnalyzer';

interface LiveSplitViewProps {
  gameState: GameState;
  gateResult: RecommendationGateResult;
  recommendation: DecisionRecommendation | null;
  activeProfile: TableLayoutProfile;
  lastFrame: CapturedFrame | null;
  isCapturing: boolean;
  bufferMetrics?: FrameMetrics;
  windowStatus?: WindowStatus;
  windowStatusReason?: string;
  eventHistory?: GameEvent[];
  opponentProfile?: OpponentProfile;
  explanation?: AIExplanationResult | null;
  enableAIExplanations?: boolean;
  onRefreshExplanation?: () => void;
  onPauseToggle: () => void;
  onOpenCorrection: () => void;
  onTriggerScenario?: (scenarioName: string) => void;
  onReconstructState?: () => void;
  onChangeOpponentProfile?: (profile: OpponentProfile) => void;
  onChangeProfile?: (profile: TableLayoutProfile) => void;
  slotsDebug?: SlotDebugInfo[];
}

export const LiveSplitView: React.FC<LiveSplitViewProps> = ({
  gameState,
  gateResult,
  recommendation,
  activeProfile,
  lastFrame,
  isCapturing,
  bufferMetrics: _bufferMetrics,
  windowStatus = 'NORMAL',
  windowStatusReason,
  eventHistory = [],
  opponentProfile = OPPONENT_PROFILES[1],
  explanation = null,
  enableAIExplanations = true,
  onRefreshExplanation,
  onPauseToggle,
  onOpenCorrection,
  onTriggerScenario,
  onReconstructState,
  onChangeOpponentProfile,
  onChangeProfile,
  slotsDebug = []
}) => {
  const [showRoiBoxes, setShowRoiBoxes] = useState(true);
  const [showEventLog, setShowEventLog] = useState(false);
  const [showRangePanel, setShowRangePanel] = useState(false);
  const [showCropInspector, setShowCropInspector] = useState(false);
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [selectedRoi, setSelectedRoi] = useState<'hero_cards' | 'board' | 'pot' | 'action_buttons'>('board');
  const [saveSuccess, setSaveSuccess] = useState(false);

  const videoContainerRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef<{
    isDragging: boolean;
    type: 'move' | 'resize';
    regionKey: 'hero_cards' | 'board' | 'pot' | 'action_buttons';
    handle?: 'nw' | 'ne' | 'se' | 'sw' | 'n' | 's' | 'e' | 'w';
    startX: number;
    startY: number;
    initialRect: RectRegion;
    containerRect: DOMRect;
  } | null>(null);

  const refW = activeProfile.referenceResolution?.width || 540;
  const refH = activeProfile.referenceResolution?.height || 960;

  useEffect(() => {
    if (!isCalibrating) return;

    const handleWindowMouseMove = (e: MouseEvent) => {
      if (!dragStateRef.current || !dragStateRef.current.isDragging) return;
      const { type, regionKey, handle, startX, startY, initialRect, containerRect } = dragStateRef.current;

      const deltaScreenX = e.clientX - startX;
      const deltaScreenY = e.clientY - startY;

      const deltaRefX = Math.round((deltaScreenX / containerRect.width) * refW);
      const deltaRefY = Math.round((deltaScreenY / containerRect.height) * refH);

      let nextX = initialRect.x;
      let nextY = initialRect.y;
      let nextW = initialRect.width;
      let nextH = initialRect.height;

      if (type === 'move') {
        nextX = Math.max(0, Math.min(refW - initialRect.width, initialRect.x + deltaRefX));
        nextY = Math.max(0, Math.min(refH - initialRect.height, initialRect.y + deltaRefY));
      } else if (type === 'resize') {
        const minW = 30;
        const minH = 20;

        if (handle?.includes('e')) {
          nextW = Math.max(minW, Math.min(refW - initialRect.x, initialRect.width + deltaRefX));
        } else if (handle?.includes('w')) {
          const rawX = initialRect.x + deltaRefX;
          const maxX = initialRect.x + initialRect.width - minW;
          nextX = Math.max(0, Math.min(maxX, rawX));
          nextW = initialRect.width - (nextX - initialRect.x);
        }

        if (handle?.includes('s')) {
          nextH = Math.max(minH, Math.min(refH - initialRect.y, initialRect.height + deltaRefY));
        } else if (handle?.includes('n')) {
          const rawY = initialRect.y + deltaRefY;
          const maxY = initialRect.y + initialRect.height - minH;
          nextY = Math.max(0, Math.min(maxY, rawY));
          nextH = initialRect.height - (nextY - initialRect.y);
        }
      }

      const updatedProfile: TableLayoutProfile = {
        ...activeProfile,
        regions: {
          ...activeProfile.regions,
          [regionKey]: {
            x: Math.round(nextX),
            y: Math.round(nextY),
            width: Math.round(nextW),
            height: Math.round(nextH)
          }
        }
      };

      onChangeProfile?.(updatedProfile);
    };

    const handleWindowMouseUp = () => {
      if (dragStateRef.current?.isDragging) {
        dragStateRef.current = null;
        try {
          localStorage.setItem('poker_study_lab_calibrated_profile', JSON.stringify(activeProfile));
        } catch {}
      }
    };

    window.addEventListener('mousemove', handleWindowMouseMove);
    window.addEventListener('mouseup', handleWindowMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('mouseup', handleWindowMouseUp);
    };
  }, [isCalibrating, activeProfile, onChangeProfile, refW, refH]);

  const handleStartDrag = (
    e: React.MouseEvent,
    regionKey: 'hero_cards' | 'board' | 'pot' | 'action_buttons',
    type: 'move' | 'resize',
    handle?: 'nw' | 'ne' | 'se' | 'sw' | 'n' | 's' | 'e' | 'w'
  ) => {
    if (!isCalibrating) return;
    e.preventDefault();
    e.stopPropagation();

    if (!videoContainerRef.current) return;
    const containerRect = videoContainerRef.current.getBoundingClientRect();
    const currentRegion = activeProfile.regions[regionKey];
    if (!currentRegion) return;

    setSelectedRoi(regionKey);

    dragStateRef.current = {
      isDragging: true,
      type,
      regionKey,
      handle,
      startX: e.clientX,
      startY: e.clientY,
      initialRect: { ...currentRegion },
      containerRect
    };
  };

  const handleSaveCalibration = () => {
    const updatedProfile: TableLayoutProfile = {
      ...activeProfile,
      id: activeProfile.id === 'profile_suprema_poker_vertical' ? 'profile_suprema_poker_vertical' : 'profile_custom_calibrated',
      name: activeProfile.name.includes('(Calibrado)') ? activeProfile.name : `${activeProfile.name} (Calibrado)`
    };
    onChangeProfile?.(updatedProfile);
    try {
      localStorage.setItem('poker_study_lab_calibrated_profile', JSON.stringify(updatedProfile));
    } catch (err) {
      console.warn('Failed to save calibrated profile', err);
    }
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2200);
  };

  const cornerHandleStyle = (pos: 'nw' | 'ne' | 'se' | 'sw', color: string): React.CSSProperties => {
    const cursorMap = {
      nw: 'nwse-resize',
      ne: 'nesw-resize',
      se: 'nwse-resize',
      sw: 'nesw-resize'
    };
    return {
      position: 'absolute',
      width: 10,
      height: 10,
      background: '#ffffff',
      border: `2px solid ${color}`,
      borderRadius: 2,
      zIndex: 15,
      cursor: cursorMap[pos],
      top: pos.includes('n') ? -5 : undefined,
      bottom: pos.includes('s') ? -5 : undefined,
      left: pos.includes('w') ? -5 : undefined,
      right: pos.includes('e') ? -5 : undefined,
      boxShadow: '0 1px 3px rgba(0,0,0,0.6)'
    };
  };

  const edgeHandleStyle = (pos: 'n' | 's' | 'e' | 'w', color: string): React.CSSProperties => {
    const cursorMap = {
      n: 'ns-resize',
      s: 'ns-resize',
      e: 'ew-resize',
      w: 'ew-resize'
    };
    const isHoriz = pos === 'n' || pos === 's';
    return {
      position: 'absolute',
      width: isHoriz ? 18 : 8,
      height: isHoriz ? 8 : 18,
      background: color,
      border: '1.5px solid #ffffff',
      borderRadius: 2,
      zIndex: 14,
      cursor: cursorMap[pos],
      top: pos === 'n' ? -4 : pos === 's' ? undefined : '50%',
      bottom: pos === 's' ? -4 : undefined,
      left: pos === 'w' ? -4 : pos === 'e' ? undefined : '50%',
      right: pos === 'e' ? -4 : undefined,
      transform: isHoriz ? 'translateX(-50%)' : 'translateY(-50%)',
      boxShadow: '0 1px 3px rgba(0,0,0,0.5)'
    };
  };

  const renderRoiBox = (
    regionKey: 'hero_cards' | 'board' | 'pot' | 'action_buttons',
    title: string,
    color: string,
    region: RectRegion
  ) => {
    if (!region) return null;
    const isSelected = selectedRoi === regionKey;
    const leftPct = (region.x / refW) * 100;
    const topPct = (region.y / refH) * 100;
    const widthPct = (region.width / refW) * 100;
    const heightPct = (region.height / refH) * 100;

    return (
      <div
        key={regionKey}
        id={`roi-${regionKey}`}
        style={{
          position: 'absolute',
          left: `${leftPct}%`,
          top: `${topPct}%`,
          width: `${widthPct}%`,
          height: `${heightPct}%`,
          border: isCalibrating
            ? `2px solid ${color}`
            : `2px dashed ${color}`,
          background: isCalibrating
            ? isSelected
              ? `${color}35`
              : `${color}18`
            : `${color}12`,
          borderRadius: 4,
          boxShadow: isCalibrating && isSelected
            ? `0 0 0 2px rgba(255,255,255,0.6), 0 0 16px ${color}`
            : 'none',
          zIndex: isSelected ? 30 : 20,
          cursor: isCalibrating ? 'move' : 'default',
          pointerEvents: isCalibrating ? 'auto' : 'none'
        }}
        onMouseDown={(e) => {
          if (!isCalibrating) return;
          handleStartDrag(e, regionKey, 'move');
        }}
      >
        {/* Title / Header Badge */}
        <div
          style={{
            position: 'absolute',
            top: isCalibrating ? 0 : -20,
            left: 0,
            right: 0,
            height: isCalibrating ? 20 : 'auto',
            background: isCalibrating ? color : '#07090e',
            color: isCalibrating ? '#ffffff' : color,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 6px',
            fontSize: 10,
            fontWeight: 700,
            fontFamily: 'var(--font-mono)',
            cursor: isCalibrating ? 'move' : 'default',
            userSelect: 'none',
            borderTopLeftRadius: 2,
            borderTopRightRadius: 2,
            zIndex: 5
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {isCalibrating && <Move size={10} />}
            <span>{title}</span>
          </div>
          {isCalibrating && (
            <span style={{ fontSize: 9, opacity: 0.95 }}>
              {Math.round(region.width)}x{Math.round(region.height)}
            </span>
          )}
        </div>

        {/* Internal Slot Guides for Board (5 slots) */}
        {regionKey === 'board' && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', pointerEvents: 'none', paddingTop: isCalibrating ? 20 : 0 }}>
            {['Flop 1', 'Flop 2', 'Flop 3', 'Turn', 'River'].map((name, idx) => {
              const detected = gameState.board[idx];
              return (
                <div
                  key={name}
                  style={{
                    flex: 1,
                    borderRight: idx < 4 ? `1px dashed ${color}70` : 'none',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 8,
                    color,
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 600,
                    opacity: 0.9,
                    gap: 1
                  }}
                >
                  {isCalibrating && (
                    <>
                      <span>{name}</span>
                      {detected && (
                        <span style={{ background: '#000000cc', padding: '1px 3px', borderRadius: 2, color: '#38bdf8', fontSize: 9 }}>
                          {detected[0] === 'T' ? '10' : detected[0]}
                          {detected[1] === 'h' ? '♥' : detected[1] === 'd' ? '♦' : detected[1] === 'c' ? '♣' : detected[1] === 's' ? '♠' : ''}
                        </span>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Internal Slot Guides for Hero Cards (2 slots) */}
        {regionKey === 'hero_cards' && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', pointerEvents: 'none', paddingTop: isCalibrating ? 20 : 0 }}>
            {['Carta 1', 'Carta 2'].map((name, idx) => {
              const detected = gameState.hero.cards[idx];
              return (
                <div
                  key={name}
                  style={{
                    flex: 1,
                    borderRight: idx === 0 ? `1px dashed ${color}70` : 'none',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 8,
                    color,
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 600,
                    opacity: 0.9,
                    gap: 1
                  }}
                >
                  {isCalibrating && (
                    <>
                      <span>{name}</span>
                      {detected && (
                        <span style={{ background: '#000000cc', padding: '1px 3px', borderRadius: 2, color: '#34d399', fontSize: 9 }}>
                          {detected[0] === 'T' ? '10' : detected[0]}
                          {detected[1] === 'h' ? '♥' : detected[1] === 'd' ? '♦' : detected[1] === 'c' ? '♣' : detected[1] === 's' ? '♠' : ''}
                        </span>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* 8 Resize Handles (only shown in calibration mode) */}
        {isCalibrating && (
          <>
            {/* 4 Corners */}
            <div
              style={cornerHandleStyle('nw', color)}
              onMouseDown={(e) => handleStartDrag(e, regionKey, 'resize', 'nw')}
              title="Redimensionar Canto Noroeste"
            />
            <div
              style={cornerHandleStyle('ne', color)}
              onMouseDown={(e) => handleStartDrag(e, regionKey, 'resize', 'ne')}
              title="Redimensionar Canto Nordeste"
            />
            <div
              style={cornerHandleStyle('se', color)}
              onMouseDown={(e) => handleStartDrag(e, regionKey, 'resize', 'se')}
              title="Redimensionar Canto Sudeste"
            />
            <div
              style={cornerHandleStyle('sw', color)}
              onMouseDown={(e) => handleStartDrag(e, regionKey, 'resize', 'sw')}
              title="Redimensionar Canto Sudoeste"
            />

            {/* 4 Edges */}
            <div
              style={edgeHandleStyle('n', color)}
              onMouseDown={(e) => handleStartDrag(e, regionKey, 'resize', 'n')}
              title="Redimensionar Altura Superior"
            />
            <div
              style={edgeHandleStyle('s', color)}
              onMouseDown={(e) => handleStartDrag(e, regionKey, 'resize', 's')}
              title="Redimensionar Altura Inferior"
            />
            <div
              style={edgeHandleStyle('e', color)}
              onMouseDown={(e) => handleStartDrag(e, regionKey, 'resize', 'e')}
              title="Redimensionar Largura Direita"
            />
            <div
              style={edgeHandleStyle('w', color)}
              onMouseDown={(e) => handleStartDrag(e, regionKey, 'resize', 'w')}
              title="Redimensionar Largura Esquerda"
            />
          </>
        )}
      </div>
    );
  };

  const isSupremaActive = activeProfile.id.includes('suprema');
  const isPokerStarsActive = activeProfile.id.includes('pokerstars');
  const isDefaultActive = !isSupremaActive && !isPokerStarsActive;

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(500px, 1.25fr) minmax(420px, 1fr)',
        gap: 16,
        padding: '0 16px 16px 16px',
        flex: 1,
        minHeight: 0
      }}
    >
      {/* LEFT COLUMN: POKER APP / CAPTURED FEED */}
      <div
        className="glass-panel"
        style={{
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          borderRadius: 14,
          position: 'relative'
        }}
      >
        {/* Left Sub-Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 18px',
            borderBottom: '1px solid var(--border-subtle)',
            background: 'rgba(0,0,0,0.2)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.04em', color: 'var(--text-main)' }}>
              MEU JOGO DE PÔQUER
            </span>
            <span
              style={{
                fontSize: 11,
                fontFamily: 'var(--font-mono)',
                color: '#34d399',
                background: 'rgba(16, 185, 129, 0.1)',
                padding: '2px 8px',
                borderRadius: 4
              }}
            >
              JANELA AUTORIZADA
            </span>

            {/* Layout Profile Quick Switcher */}
            {onChangeProfile && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(0,0,0,0.3)', padding: '2px 4px', borderRadius: 6 }}>
                <button
                  onClick={() => onChangeProfile(POKERSTARS_LAYOUT_PROFILE)}
                  style={{
                    padding: '2px 8px',
                    fontSize: 10,
                    fontWeight: isPokerStarsActive ? 700 : 400,
                    color: isPokerStarsActive ? '#f43f5e' : 'var(--text-muted)',
                    background: isPokerStarsActive ? 'rgba(244, 63, 94, 0.2)' : 'transparent',
                    border: 'none',
                    borderRadius: 4,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4
                  }}
                  title="Layout PokerStars Mesa Horizontal Desktop 16:9"
                  id="btn-layout-pokerstars"
                >
                  <Sparkles size={11} />
                  <span>PokerStars</span>
                </button>
                <button
                  onClick={() => {
                    onChangeProfile(SUPREMA_POKER_LAYOUT_PROFILE);
                    onTriggerScenario?.('suprema_hand');
                  }}
                  style={{
                    padding: '2px 8px',
                    fontSize: 10,
                    fontWeight: isSupremaActive ? 700 : 400,
                    color: isSupremaActive ? '#a855f7' : 'var(--text-muted)',
                    background: isSupremaActive ? 'rgba(168, 85, 247, 0.2)' : 'transparent',
                    border: 'none',
                    borderRadius: 4,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4
                  }}
                  title="Layout Vertical Suprema Poker"
                  id="btn-layout-suprema"
                >
                  <Smartphone size={11} />
                  <span>Suprema</span>
                </button>
                <button
                  onClick={() => onChangeProfile(DEFAULT_LAYOUT_PROFILE)}
                  style={{
                    padding: '2px 8px',
                    fontSize: 10,
                    fontWeight: isDefaultActive ? 700 : 400,
                    color: isDefaultActive ? '#38bdf8' : 'var(--text-muted)',
                    background: isDefaultActive ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
                    border: 'none',
                    borderRadius: 4,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4
                  }}
                  title="Layout Desktop Widescreen Padrão"
                  id="btn-layout-desktop"
                >
                  <Monitor size={11} />
                  <span>Desktop</span>
                </button>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              className="btn-secondary"
              style={{
                padding: '4px 10px',
                fontSize: 11,
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                background: isCalibrating ? 'rgba(56, 189, 248, 0.2)' : undefined,
                borderColor: isCalibrating ? '#38bdf8' : undefined,
                color: isCalibrating ? '#38bdf8' : undefined
              }}
              onClick={() => {
                setIsCalibrating(!isCalibrating);
                if (!isCalibrating) setShowRoiBoxes(true);
              }}
              id="btn-calibrate-roi"
              title="Permite arrastar e redimensionar os retângulos de detecção das cartas e pote diretamente com o mouse"
            >
              <Crosshair size={12} />
              <span>{isCalibrating ? 'Calibrando ROIs...' : 'Calibrar ROIs'}</span>
            </button>

            <button
              className="btn-secondary"
              style={{ padding: '4px 10px', fontSize: 11 }}
              onClick={() => setShowRoiBoxes(!showRoiBoxes)}
              id="btn-toggle-roi"
            >
              {showRoiBoxes ? <Eye size={12} /> : <EyeOff size={12} />}
              <span>{showRoiBoxes ? 'Ocultar ROIs' : 'Mostrar ROIs'}</span>
            </button>

            <button
              className="btn-secondary"
              style={{
                padding: '4px 10px',
                fontSize: 11,
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                background: showCropInspector ? 'rgba(56, 189, 248, 0.25)' : undefined,
                borderColor: showCropInspector ? '#38bdf8' : undefined,
                color: showCropInspector ? '#38bdf8' : undefined
              }}
              onClick={() => setShowCropInspector(!showCropInspector)}
              id="btn-toggle-crop-inspector"
              title="Exibir recortes ampliados e análise óptica de cada carta em tempo real"
            >
              <Search size={12} />
              <span>{showCropInspector ? 'Ocultar Inspetor' : 'Inspetor de Recortes'}</span>
              {slotsDebug.length > 0 && (
                <span
                  style={{
                    background: '#38bdf8',
                    color: '#07090e',
                    borderRadius: 10,
                    padding: '0 5px',
                    fontSize: 9,
                    fontWeight: 800
                  }}
                >
                  {slotsDebug.filter(s => s.visualState === 'VISIBLE_CARD').length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Floating Calibration Toolbar Banner */}
        {isCalibrating && (
          <div
            style={{
              padding: '8px 14px',
              background: 'rgba(8, 14, 26, 0.95)',
              backdropFilter: 'blur(8px)',
              borderBottom: '1px solid rgba(56, 189, 248, 0.3)',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              zIndex: 35
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    background: 'rgba(56, 189, 248, 0.15)',
                    border: '1px solid rgba(56, 189, 248, 0.4)',
                    padding: '3px 8px',
                    borderRadius: 6,
                    color: '#38bdf8',
                    fontSize: 11,
                    fontWeight: 700
                  }}
                >
                  <Crosshair size={13} />
                  <span>MODO DE CALIBRAÇÃO VISUAL</span>
                </div>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  Arraste os quadrados para mover e puxe as alças nos cantos para dimensionar
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <button
                  className="btn-secondary"
                  style={{
                    padding: '4px 10px',
                    fontSize: 11,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    color: '#10b981',
                    borderColor: 'rgba(16, 185, 129, 0.4)'
                  }}
                  onClick={() => {
                    if (onChangeProfile) {
                      onChangeProfile({
                        ...activeProfile,
                        regions: {
                          ...activeProfile.regions,
                          hero_cards: { x: 270, y: 720, width: 110, height: 80 }
                        }
                      });
                      setSelectedRoi('hero_cards');
                    }
                  }}
                  title="Enquadra o retângulo das cartas do Hero diretamente à direita do avatar inferior do Suprema"
                  id="btn-snap-hero-cards"
                >
                  <Crosshair size={11} />
                  <span>Enquadrar Hero</span>
                </button>

                <button
                  className="btn-secondary"
                  style={{
                    padding: '4px 10px',
                    fontSize: 11,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    color: '#38bdf8',
                    borderColor: 'rgba(56, 189, 248, 0.4)'
                  }}
                  onClick={() => {
                    if (onChangeProfile) {
                      onChangeProfile({
                        ...activeProfile,
                        regions: {
                          ...activeProfile.regions,
                          board: { x: 82, y: 297, width: 368, height: 137 }
                        }
                      });
                      setSelectedRoi('board');
                    }
                  }}
                  title="Enquadra o retângulo do board comunitário central do Suprema"
                  id="btn-snap-board-cards"
                >
                  <Crosshair size={11} />
                  <span>Enquadrar Board</span>
                </button>

                <button
                  className="btn-secondary"
                  style={{ padding: '4px 10px', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}
                  onClick={() => {
                    if (isPokerStarsActive) {
                      onChangeProfile?.(POKERSTARS_LAYOUT_PROFILE);
                    } else if (isSupremaActive) {
                      onChangeProfile?.(SUPREMA_POKER_LAYOUT_PROFILE);
                    } else {
                      onChangeProfile?.(DEFAULT_LAYOUT_PROFILE);
                    }
                  }}
                  title="Restaurar posições originais pré-definidas"
                  id="btn-reset-calibration"
                >
                  <RotateCcw size={11} />
                  <span>Resetar</span>
                </button>

                <button
                  className="btn-primary"
                  style={{
                    padding: '4px 12px',
                    fontSize: 11,
                    background: saveSuccess ? '#10b981' : 'linear-gradient(135deg, #10b981, #059669)',
                    border: 'none',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4
                  }}
                  onClick={handleSaveCalibration}
                  id="btn-save-calibration"
                >
                  {saveSuccess ? <Check size={12} /> : <Save size={12} />}
                  <span>{saveSuccess ? '✓ Calibração Salva!' : 'Salvar Calibração'}</span>
                </button>

                <button
                  className="btn-secondary"
                  style={{ padding: '4px 10px', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}
                  onClick={() => setIsCalibrating(false)}
                  title="Concluir e sair do modo de calibração"
                >
                  <X size={12} />
                  <span>Concluir</span>
                </button>
              </div>
            </div>

            {/* Region Selector Pills & Active Coordinates readout */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>SELECIONAR:</span>
                {[
                  { key: 'board', label: 'Board (Mesa)', color: '#38bdf8' },
                  { key: 'hero_cards', label: 'Cartas Hero', color: '#10b981' },
                  { key: 'pot', label: 'Pote', color: '#f59e0b' },
                  { key: 'action_buttons', label: 'Botões', color: '#a855f7' }
                ].map(r => {
                  const isSelected = selectedRoi === r.key;
                  return (
                    <button
                      key={r.key}
                      onClick={() => setSelectedRoi(r.key as any)}
                      style={{
                        padding: '2px 8px',
                        fontSize: 10,
                        borderRadius: 4,
                        cursor: 'pointer',
                        border: isSelected ? `1.5px solid ${r.color}` : '1px solid rgba(255,255,255,0.1)',
                        background: isSelected ? `${r.color}25` : 'rgba(0,0,0,0.3)',
                        color: isSelected ? r.color : 'var(--text-muted)',
                        fontWeight: isSelected ? 700 : 500,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4
                      }}
                    >
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: r.color }} />
                      <span>{r.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Selected Coordinates Readout */}
              {selectedRoi && activeProfile.regions[selectedRoi] && (
                <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                  {selectedRoi.toUpperCase()}:{' '}
                  <strong style={{ color: 'var(--text-main)' }}>
                    X: {activeProfile.regions[selectedRoi].x}, Y: {activeProfile.regions[selectedRoi].y}
                  </strong>{' '}
                  |{' '}
                  <strong style={{ color: 'var(--text-main)' }}>
                    {activeProfile.regions[selectedRoi].width} x {activeProfile.regions[selectedRoi].height} px
                  </strong>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Window Lifecycle Health Banner */}
        {windowStatus !== 'NORMAL' && (
          <div
            style={{
              padding: '8px 16px',
              background: windowStatus === 'UNAUTHORIZED' ? 'rgba(244, 63, 94, 0.2)' : 'rgba(245, 158, 11, 0.2)',
              borderBottom: `1px solid ${
                windowStatus === 'UNAUTHORIZED' ? 'rgba(244, 63, 94, 0.4)' : 'rgba(245, 158, 11, 0.4)'
              }`,
              color: windowStatus === 'UNAUTHORIZED' ? '#fb7185' : '#fbbf24',
              fontSize: 12,
              display: 'flex',
              alignItems: 'center',
              gap: 8
            }}
          >
            <AlertTriangle size={15} />
            <span>
              <strong>Aviso de Janela ({windowStatus}):</strong>{' '}
              {windowStatusReason || 'Mudança no estado da janela detectada.'}
            </span>
          </div>
        )}

        {/* Viewport / Frame Canvas Area */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            background: '#04070d',
            overflow: 'hidden',
            minHeight: 460
          }}
        >
          {lastFrame?.dataUrl ? (
            (() => {
              const frameAspect = (lastFrame && lastFrame.width && lastFrame.height)
                ? `${lastFrame.width} / ${lastFrame.height}`
                : `${refW} / ${refH}`;

              return (
                <div
                  ref={videoContainerRef}
                  style={{
                    position: 'relative',
                    height: '100%',
                    aspectRatio: frameAspect,
                    maxHeight: '100%',
                    maxWidth: '100%',
                    margin: '0 auto',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <img
                    src={lastFrame.dataUrl}
                    alt="Captured Poker Frame"
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'contain',
                      display: 'block',
                      userSelect: 'none',
                      pointerEvents: 'none'
                    }}
                  />

                  {/* ROI Calibration Overlay Bounding Boxes */}
                  {(showRoiBoxes || isCalibrating) && (
                    <div
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        pointerEvents: isCalibrating ? 'auto' : 'none'
                      }}
                    >
                      {/* Hero Cards ROI */}
                      {renderRoiBox('hero_cards', 'Hero Cards', '#10b981', activeProfile.regions.hero_cards)}

                      {/* Board Community Cards ROI */}
                      {renderRoiBox('board', 'Board Comunitário', '#38bdf8', activeProfile.regions.board)}

                      {/* Pot ROI */}
                      {renderRoiBox('pot', 'Pote da Mesa', '#f59e0b', activeProfile.regions.pot)}

                      {/* Action Buttons ROI */}
                      {renderRoiBox('action_buttons', 'Botões de Ação', '#a855f7', activeProfile.regions.action_buttons)}
                    </div>
                  )}
                </div>
              );
            })()
          ) : (
            <div style={{ textAlign: 'center', padding: 24 }}>
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: '50%',
                  background: 'rgba(255, 255, 255, 0.04)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 16px auto'
                }}
              >
                <Layers size={26} color="var(--text-dim)" />
              </div>
              <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>
                Captura Aguardando Inicialização
              </h3>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', maxWidth: 360, margin: '0 auto 16px auto' }}>
                Clique em Iniciar Captura para conectar ao feed da janela autorizada ou selecione um cenário controlado abaixo.
              </p>
            </div>
          )}
        </div>

        {/* Live Visual Crop Inspector Drawer */}
        {showCropInspector && (
          <div
            id="crop-inspector-drawer"
            style={{
              background: 'rgba(5, 8, 16, 0.96)',
              backdropFilter: 'blur(12px)',
              borderTop: '2px solid rgba(56, 189, 248, 0.4)',
              borderBottom: '1px solid var(--border-subtle)',
              padding: '12px 14px',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
              zIndex: 35,
              maxHeight: 280,
              overflowY: 'auto'
            }}
          >
            {/* Inspector Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 4,
                    background: 'rgba(56, 189, 248, 0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#38bdf8'
                  }}
                >
                  <Search size={13} />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-main)', letterSpacing: '0.03em' }}>
                      INSPETOR DE RECORTES DAS CARTAS (TEMPO REAL)
                    </span>
                    <span
                      style={{
                        fontSize: 9,
                        fontFamily: 'var(--font-mono)',
                        padding: '1px 6px',
                        borderRadius: 10,
                        background: 'rgba(16, 185, 129, 0.15)',
                        color: '#34d399',
                        fontWeight: 700
                      }}
                    >
                      ● LIVE FEED
                    </span>
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                    Visualização óptica de cada slot da mesa para validação imediata do enquadramento e das cores
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  className="btn-secondary"
                  style={{ padding: '3px 8px', fontSize: 10 }}
                  onClick={() => setIsCalibrating(true)}
                  title="Abrir calibração para mover os retângulos de captura"
                >
                  <Crosshair size={11} />
                  <span>Ajustar Enquadramento</span>
                </button>
                <button
                  onClick={() => setShowCropInspector(false)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    padding: 2
                  }}
                  title="Fechar Inspetor"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* 7 Slots Inspection Cards */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(7, 1fr)',
                gap: 8
              }}
            >
              {[
                { id: 'hero_1', label: 'Hero 1', group: 'hero_cards', defaultCard: gameState.hero.cards[0] },
                { id: 'hero_2', label: 'Hero 2', group: 'hero_cards', defaultCard: gameState.hero.cards[1] },
                { id: 'flop_1', label: 'Flop 1', group: 'board', defaultCard: gameState.board[0] },
                { id: 'flop_2', label: 'Flop 2', group: 'board', defaultCard: gameState.board[1] },
                { id: 'flop_3', label: 'Flop 3', group: 'board', defaultCard: gameState.board[2] },
                { id: 'turn', label: 'Turn', group: 'board', defaultCard: gameState.board[3] },
                { id: 'river', label: 'River', group: 'board', defaultCard: gameState.board[4] }
              ].map(slotMeta => {
                const liveSlot = slotsDebug.find(s => s.id === slotMeta.id);
                const visualState = liveSlot ? liveSlot.visualState : (slotMeta.defaultCard ? 'VISIBLE_CARD' : 'EMPTY');
                const card = liveSlot ? liveSlot.card : slotMeta.defaultCard;
                const confidence = liveSlot ? liveSlot.confidence : (card ? 0.98 : 0);
                const colors = liveSlot?.colors;
                const cropUrl = liveSlot?.cropDataUrl;

                const isHero = slotMeta.group === 'hero_cards';
                const statusColor =
                  visualState === 'VISIBLE_CARD' ? '#10b981' :
                  visualState === 'CARD_BACK' ? '#3b82f6' :
                  visualState === 'EMPTY' ? '#64748b' : '#f59e0b';

                const statusLabel =
                  visualState === 'VISIBLE_CARD' ? 'CARTA' :
                  visualState === 'CARD_BACK' ? 'DORSO' :
                  visualState === 'EMPTY' ? 'VAZIO' : 'RUÍDO';

                const rank = card ? card.slice(0, -1) : null;
                const suit = card ? card.slice(-1) : null;
                const suitSymbol = suit === 'h' ? '♥' : suit === 'd' ? '♦' : suit === 'c' ? '♣' : suit === 's' ? '♠' : '';
                const suitColor = suit === 'h' ? '#ef4444' : suit === 'd' ? '#38bdf8' : suit === 'c' ? '#10b981' : '#f1f5f9';

                return (
                  <div
                    key={slotMeta.id}
                    style={{
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: `1px solid ${statusColor}40`,
                      borderRadius: 6,
                      padding: 6,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4,
                      minWidth: 0
                    }}
                  >
                    {/* Slot Name & State Pill */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: isHero ? '#34d399' : '#38bdf8', fontFamily: 'var(--font-mono)' }}>
                        {slotMeta.label}
                      </span>
                      <span
                        style={{
                          fontSize: 8,
                          fontWeight: 700,
                          padding: '1px 4px',
                          borderRadius: 3,
                          background: `${statusColor}25`,
                          color: statusColor
                        }}
                      >
                        {statusLabel}
                      </span>
                    </div>

                    {/* Magnified Optical Thumbnail Preview */}
                    <div
                      style={{
                        height: 64,
                        background: '#020408',
                        borderRadius: 4,
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        position: 'relative',
                        overflow: 'hidden',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      {cropUrl ? (
                        <>
                          <img
                            src={cropUrl}
                            alt={slotMeta.label}
                            style={{
                              width: '100%',
                              height: '100%',
                              objectFit: 'contain',
                              imageRendering: 'pixelated'
                            }}
                          />
                          {/* Corner Rank/Suit Zone Boundary Lines */}
                          <div
                            style={{
                              position: 'absolute',
                              top: 0,
                              left: 0,
                              width: '42%',
                              height: '24%',
                              borderRight: '1px dashed #38bdf880',
                              borderBottom: '1px dashed #38bdf880',
                              pointerEvents: 'none'
                            }}
                            title="Zona Óptica do Dígito (Rank)"
                          />
                          <div
                            style={{
                              position: 'absolute',
                              top: '24%',
                              left: 0,
                              width: '46%',
                              height: '28%',
                              borderRight: '1px dashed #ec489980',
                              borderBottom: '1px dashed #ec489980',
                              pointerEvents: 'none'
                            }}
                            title="Zona Óptica do Naipe (Suit)"
                          />
                        </>
                      ) : (
                        <div style={{ fontSize: 9, color: 'var(--text-muted)', textAlign: 'center', padding: 4 }}>
                          Sem imagem
                        </div>
                      )}
                    </div>

                    {/* Detected Output Badge */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '2px 4px',
                        background: 'rgba(0, 0, 0, 0.4)',
                        borderRadius: 3
                      }}
                    >
                      {card ? (
                        <span style={{ fontSize: 11, fontWeight: 800, color: suitColor, fontFamily: 'var(--font-mono)' }}>
                          {rank === 'T' ? '10' : rank}{suitSymbol}
                        </span>
                      ) : (
                        <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>--</span>
                      )}
                      <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                        {card ? `${Math.round(confidence * 100)}%` : '0%'}
                      </span>
                    </div>

                    {/* Color Histogram Mini-Bar */}
                    {colors && (
                      <div
                        style={{
                          height: 3,
                          borderRadius: 2,
                          display: 'flex',
                          overflow: 'hidden',
                          background: 'rgba(255,255,255,0.05)',
                          marginTop: 1
                        }}
                        title={`R: ${colors.red} | B: ${colors.blue} | G: ${colors.green} | K: ${colors.black}`}
                      >
                        <div style={{ flex: colors.red, background: '#ef4444' }} />
                        <div style={{ flex: colors.blue, background: '#3b82f6' }} />
                        <div style={{ flex: colors.green, background: '#10b981' }} />
                        <div style={{ flex: colors.black, background: '#475569' }} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Controlled Scenario Switcher (Crucial for reproducible validation and testing) */}
        <div
          style={{
            padding: '10px 16px',
            borderTop: '1px solid var(--border-subtle)',
            background: 'rgba(0, 0, 0, 0.3)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            overflowX: 'auto'
          }}
        >
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-dim)', whiteSpace: 'nowrap' }}>
            Simular Cenários:
          </span>
          <button
            className="btn-secondary"
            style={{
              padding: '3px 8px',
              fontSize: 11,
              background: 'rgba(239, 68, 68, 0.15)',
              borderColor: 'rgba(239, 68, 68, 0.4)',
              color: '#f87171',
              display: 'flex',
              alignItems: 'center',
              gap: 4
            }}
            onClick={() => onTriggerScenario?.('empty_table')}
            title="Limpar todas as cartas e resetar a mesa para estado vazio"
            id="btn-clear-table"
          >
            <RotateCcw size={11} />
            <span>Limpar Mesa (Vazio)</span>
          </button>
          <button
            className="btn-secondary"
            style={{
              padding: '3px 8px',
              fontSize: 11,
              background: isSupremaActive ? 'rgba(168, 85, 247, 0.25)' : undefined,
              color: isSupremaActive ? '#c084fc' : undefined,
              borderColor: isSupremaActive ? 'rgba(168, 85, 247, 0.5)' : undefined
            }}
            onClick={() => {
              onChangeProfile?.(SUPREMA_POKER_LAYOUT_PROFILE);
              onTriggerScenario?.('suprema_hand');
            }}
            id="btn-scenario-suprema"
          >
            📱 Suprema (Mão Real)
          </button>
          <button
            className="btn-secondary"
            style={{ padding: '3px 8px', fontSize: 11 }}
            onClick={() => onTriggerScenario?.('preflop_clean')}
          >
            Preflop Limpo
          </button>
          <button
            className="btn-secondary"
            style={{ padding: '3px 8px', fontSize: 11 }}
            onClick={() => onTriggerScenario?.('flop_clean')}
          >
            Flop Consistente
          </button>
          <button
            className="btn-secondary"
            style={{ padding: '3px 8px', fontSize: 11 }}
            onClick={() => onTriggerScenario?.('duplicate_card_error')}
          >
            Carta Duplicada
          </button>
          <button
            className="btn-secondary"
            style={{ padding: '3px 8px', fontSize: 11 }}
            onClick={() => onTriggerScenario?.('low_confidence')}
          >
            Baixa Confiança
          </button>
          <button
            className="btn-secondary"
            style={{ padding: '3px 8px', fontSize: 11 }}
            onClick={() => onTriggerScenario?.('animation_active')}
          >
            Animação Ativa
          </button>
          <button
            className="btn-secondary"
            style={{ padding: '3px 8px', fontSize: 11 }}
            onClick={() => onTriggerScenario?.('unauthorized_app')}
          >
            App Desautorizado
          </button>
        </div>
      </div>

      {/* RIGHT COLUMN: REAL-TIME STUDY LAB ANALYSIS */}
      <div
        className="glass-panel"
        style={{
          display: 'flex',
          flexDirection: 'column',
          borderRadius: 14,
          overflowY: 'auto',
          padding: 20,
          gap: 16
        }}
      >
        {/* Right Sub-Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ fontSize: 15, fontWeight: 700, letterSpacing: '0.03em' }}>
              PAINEL POKER STUDY LAB
            </h2>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              Análise Determinística em Tempo Real
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div
              style={{
                padding: '4px 10px',
                borderRadius: 20,
                fontSize: 11,
                fontFamily: 'var(--font-mono)',
                fontWeight: 700,
                background:
                  gameState.confidence.temporal_consistency >= 0.95
                    ? 'rgba(56, 189, 248, 0.15)'
                    : 'rgba(245, 158, 11, 0.15)',
                color:
                  gameState.confidence.temporal_consistency >= 0.95
                    ? '#38bdf8'
                    : '#fbbf24',
                border: '1px solid rgba(56, 189, 248, 0.3)'
              }}
              title="Consistência temporal calculada pela janela móvel de frames (histerese e consenso)"
            >
              Consistência: {(gameState.confidence.temporal_consistency * 100).toFixed(0)}%
            </div>

            <div
              style={{
                padding: '4px 10px',
                borderRadius: 20,
                fontSize: 11,
                fontFamily: 'var(--font-mono)',
                fontWeight: 700,
                background:
                  gameState.confidence.overall_confidence >= 0.98
                    ? 'rgba(16, 185, 129, 0.15)'
                    : gameState.confidence.overall_confidence >= 0.9
                    ? 'rgba(245, 158, 11, 0.15)'
                    : 'rgba(244, 63, 94, 0.15)',
                color:
                  gameState.confidence.overall_confidence >= 0.98
                    ? '#34d399'
                    : gameState.confidence.overall_confidence >= 0.9
                    ? '#fbbf24'
                    : '#fb7185',
                border: `1px solid ${
                  gameState.confidence.overall_confidence >= 0.98
                    ? 'rgba(16, 185, 129, 0.3)'
                    : 'rgba(244, 63, 94, 0.3)'
                }`
              }}
            >
              Confiança: {(gameState.confidence.overall_confidence * 100).toFixed(1)}%
            </div>
          </div>
        </div>

        {/* 1. ESTADO DA MESA */}
        <div
          style={{
            background: 'rgba(255, 255, 255, 0.03)',
            borderRadius: 10,
            padding: 12,
            border: '1px solid var(--border-subtle)'
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.05em',
              color: 'var(--text-dim)',
              marginBottom: 8
            }}
          >
            ESTADO DA MESA
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 8,
              textAlign: 'center'
            }}
          >
            <div style={{ background: 'rgba(0,0,0,0.3)', padding: '8px 4px', borderRadius: 8 }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Street</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#38bdf8' }}>{gameState.street}</div>
            </div>
            <div style={{ background: 'rgba(0,0,0,0.3)', padding: '8px 4px', borderRadius: 8 }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Pote</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#fbbf24' }}>${gameState.pot}</div>
            </div>
            <div style={{ background: 'rgba(0,0,0,0.3)', padding: '8px 4px', borderRadius: 8 }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Posição</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#a78bfa' }}>
                {gameState.hero.position || '—'}
              </div>
            </div>
            <div style={{ background: 'rgba(0,0,0,0.3)', padding: '8px 4px', borderRadius: 8 }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Ativo</div>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: gameState.active_player.toLowerCase() === 'hero' ? '#34d399' : '#94a3b8'
                }}
              >
                {gameState.active_player.toUpperCase()}
              </div>
            </div>
          </div>
        </div>

        {/* 2. CARTAS E BOARD */}
        <div
          style={{
            background: 'rgba(255, 255, 255, 0.03)',
            borderRadius: 10,
            padding: 12,
            border: '1px solid var(--border-subtle)'
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.05em',
              color: 'var(--text-dim)',
              marginBottom: 10
            }}
          >
            CARTAS E BOARD
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around', gap: 12 }}>
            {/* Hero cards */}
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, textAlign: 'center' }}>
                Mão Própria (Hero)
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <PlayingCard
                  card={gameState.hero.cards[0]}
                  confidence={gameState.confidence.hero_cards[0]?.confidence}
                  isEmpty={!gameState.hero.cards[0]}
                />
                <PlayingCard
                  card={gameState.hero.cards[1]}
                  confidence={gameState.confidence.hero_cards[1]?.confidence}
                  isEmpty={!gameState.hero.cards[1]}
                />
              </div>

              {/* Live Optical Crop Thumbnails (visual proof of real-time camera/screen capture) */}
              {isCapturing && (
                <div style={{ display: 'flex', gap: 8, marginTop: 6, justifyContent: 'center' }}>
                  {['hero_1', 'hero_2'].map(slotId => {
                    const slot = slotsDebug.find(s => s.id === slotId);
                    return (
                      <div
                        key={slotId}
                        style={{
                          width: 58,
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: 2
                        }}
                      >
                        {slot?.cropDataUrl ? (
                          <div
                            style={{
                              width: '100%',
                              height: 36,
                              borderRadius: 4,
                              overflow: 'hidden',
                              border: slot.visualState === 'VISIBLE_CARD' ? '1px solid #10b981' : '1px dashed #64748b',
                              background: '#07090e',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                            title={`Recorte real do slot ${slotId}: ${slot.card || slot.visualState} (${Math.round(slot.confidence * 100)}%)`}
                          >
                            <img
                              src={slot.cropDataUrl}
                              alt={slotId}
                              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                            />
                          </div>
                        ) : (
                          <div
                            style={{
                              width: '100%',
                              height: 36,
                              borderRadius: 4,
                              background: 'rgba(255,255,255,0.03)',
                              border: '1px dashed rgba(255,255,255,0.1)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: 9,
                              color: 'var(--text-dim)'
                            }}
                          >
                            aguardando
                          </div>
                        )}
                        <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: slot?.card ? '#34d399' : 'var(--text-muted)' }}>
                          {slot?.card ? `● ${slot.card}` : (slot?.visualState || 'slot')}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Vertical separator */}
            <div style={{ width: 1, height: 70, background: 'var(--border-subtle)' }} />

            {/* Board cards */}
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, textAlign: 'center' }}>
                Cartas Comunitárias
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                {[0, 1, 2, 3, 4].map(idx => (
                  <PlayingCard
                    key={idx}
                    card={gameState.board[idx]}
                    confidence={gameState.confidence.board.confidence}
                    isEmpty={!gameState.board[idx]}
                    size="sm"
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* 3. HISTÓRICO DE AÇÕES */}
        <div
          style={{
            background: 'rgba(255, 255, 255, 0.03)',
            borderRadius: 10,
            padding: 12,
            border: '1px solid var(--border-subtle)'
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.05em',
              color: 'var(--text-dim)',
              marginBottom: 8
            }}
          >
            HISTÓRICO DA MÃO
          </div>

          <div style={{ maxHeight: 90, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {gameState.action_history.length > 0 ? (
              gameState.action_history.map((entry, index) => (
                <div
                  key={index}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: 12,
                    padding: '3px 8px',
                    borderRadius: 4,
                    background: 'rgba(0,0,0,0.2)'
                  }}
                >
                  <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                    [{entry.street}]
                  </span>
                  <span style={{ fontWeight: 600, color: entry.player === 'Hero' ? '#34d399' : '#f8fafc' }}>
                    {entry.player}
                  </span>
                  <span style={{ textTransform: 'uppercase', color: '#38bdf8' }}>
                    {entry.action} {entry.amount ? `$${entry.amount}` : ''}
                  </span>
                </div>
              ))
            ) : (
              <span style={{ fontSize: 12, color: 'var(--text-dim)', textAlign: 'center', padding: 8 }}>
                {isCapturing ? 'Mesa ao vivo conectada. Aguardando detecção óptica de ações...' : 'Nenhuma ação confirmada registrada nesta mão.'}
              </span>
            )}
          </div>
        </div>

        {/* 4. SUA DECISÃO (Recommendation Gate Protected) */}
        <div
          style={{
            background: gateResult.allowed ? 'rgba(16, 185, 129, 0.06)' : 'rgba(244, 63, 94, 0.06)',
            borderRadius: 10,
            padding: 14,
            border: `1px solid ${
              gateResult.allowed ? 'rgba(16, 185, 129, 0.3)' : 'rgba(244, 63, 94, 0.3)'
            }`
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 10
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {gateResult.allowed ? (
                <CheckCircle2 size={16} color="#10b981" />
              ) : (
                <AlertTriangle size={16} color="#f43f5e" />
              )}
              <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.04em' }}>
                SUA DECISÃO RECOMENDADA
              </span>
            </div>

            <span
              style={{
                fontSize: 10,
                fontFamily: 'var(--font-mono)',
                color: gateResult.allowed ? '#10b981' : '#f43f5e',
                background: gateResult.allowed ? 'rgba(16, 185, 129, 0.15)' : 'rgba(244, 63, 94, 0.15)',
                padding: '2px 6px',
                borderRadius: 4
              }}
            >
              GATE: {gateResult.allowed ? 'LIBERADO' : 'BLOQUEADO'}
            </span>
          </div>

          {gateResult.allowed && recommendation ? (
            <div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 8, flexWrap: 'wrap' }}>
                <span
                  style={{
                    fontSize: 26,
                    fontWeight: 800,
                    color: '#34d399',
                    letterSpacing: '0.03em'
                  }}
                >
                  {recommendation.action.toUpperCase()}
                </span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  Estratégia: {recommendation.source} ({(recommendation.confidence * 100).toFixed(0)}%)
                </span>
                {recommendation.equity_estimate !== undefined && (
                  <span
                    style={{
                      fontSize: 11,
                      fontFamily: 'var(--font-mono)',
                      color: '#38bdf8',
                      background: 'rgba(56, 189, 248, 0.1)',
                      padding: '2px 8px',
                      borderRadius: 4
                    }}
                  >
                    Equity: {(recommendation.equity_estimate * 100).toFixed(1)}%
                  </span>
                )}
                {recommendation.pot_odds !== undefined && (
                  <span
                    style={{
                      fontSize: 11,
                      fontFamily: 'var(--font-mono)',
                      color: '#fbbf24',
                      background: 'rgba(245, 158, 11, 0.1)',
                      padding: '2px 8px',
                      borderRadius: 4
                    }}
                  >
                    {recommendation.pot_odds > 0
                      ? `Pot Odds: ${(recommendation.pot_odds * 100).toFixed(1)}%`
                      : 'Check Livre'}
                  </span>
                )}
              </div>

              {/* Frequencies bar */}
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 4 }}>
                  Frequência Teórica:
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {Object.entries(recommendation.frequencies).map(([act, freq]) => (
                    <div
                      key={act}
                      style={{
                        padding: '4px 8px',
                        borderRadius: 6,
                        background: 'rgba(0,0,0,0.3)',
                        fontSize: 11,
                        fontFamily: 'var(--font-mono)'
                      }}
                    >
                      <span style={{ color: '#38bdf8', fontWeight: 600 }}>{act.toUpperCase()}</span>:{' '}
                      <span>{(freq * 100).toFixed(0)}%</span>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                Fatores: {recommendation.explanation_factors.join(' • ')}
              </div>
            </div>
          ) : (
            <div>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: '#fb7185',
                  marginBottom: 6
                }}
              >
                Análise pausada
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
                Motivo: aguardando confirmação do estado da mesa.
              </div>
              <ul style={{ paddingLeft: 18, fontSize: 11, color: 'var(--text-dim)' }}>
                {gateResult.reasons.map((r, i) => (
                  <li key={i} style={{ marginBottom: 2 }}>
                    {r}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* 4.5. IA EXPLICADORA DIDÁTICA (Pedagogical Strategy Mentor) */}
        <AIExplanationPanel
          explanation={explanation}
          enableAIExplanations={enableAIExplanations}
          onRefresh={onRefreshExplanation}
        />

        {/* 5. PERFIL DO ADVERSÁRIO & MATRIZ DE RANGES */}
        <div
          style={{
            background: 'rgba(255, 255, 255, 0.02)',
            borderRadius: 10,
            padding: 12,
            border: '1px solid var(--border-subtle)',
            display: 'flex',
            flexDirection: 'column',
            gap: 8
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Users size={13} style={{ color: '#a78bfa' }} />
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: '0.05em',
                  color: 'var(--text-dim)'
                }}
              >
                PERFIL DO VILÃO: {opponentProfile.name.split(' ')[0]} ({opponentProfile.rangePercentage}% • {opponentProfile.combos.length} combos)
              </span>
            </div>

            <button
              className="btn-secondary"
              style={{ padding: '2px 8px', fontSize: 10, height: 22 }}
              onClick={() => setShowRangePanel(!showRangePanel)}
            >
              {showRangePanel ? 'Ocultar Matriz' : 'Ajustar Range 13x13'}
            </button>
          </div>

          {showRangePanel && onChangeOpponentProfile && (
            <RangeMatrixPanel
              activeProfile={opponentProfile}
              onChangeProfile={onChangeOpponentProfile}
            />
          )}
        </div>

        {/* 6. EVENTSTORE — LOG IMUTÁVEL DE EVENTOS */}
        <div
          style={{
            background: 'rgba(255, 255, 255, 0.02)',
            borderRadius: 10,
            padding: 12,
            border: '1px solid var(--border-subtle)',
            display: 'flex',
            flexDirection: 'column',
            gap: 8
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Database size={13} style={{ color: '#38bdf8' }} />
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: '0.05em',
                  color: 'var(--text-dim)'
                }}
              >
                EVENTSTORE — AUDITORIA ({eventHistory.length})
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {onReconstructState && (
                <button
                  className="btn-secondary"
                  style={{ padding: '2px 8px', fontSize: 10, height: 22 }}
                  onClick={onReconstructState}
                  title="Reconstruir estado da mão determinísticamente a partir dos eventos gravados"
                >
                  <History size={11} />
                  Reconstruir Estado
                </button>
              )}
              <button
                className="btn-secondary"
                style={{ padding: '2px 8px', fontSize: 10, height: 22 }}
                onClick={() => setShowEventLog(!showEventLog)}
              >
                {showEventLog ? 'Ocultar' : 'Expandir'}
              </button>
            </div>
          </div>

          {showEventLog && (
            <div
              style={{
                maxHeight: 160,
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
                background: 'rgba(0,0,0,0.3)',
                padding: 8,
                borderRadius: 6,
                fontFamily: 'var(--font-mono)',
                fontSize: 10
              }}
            >
              {eventHistory.length === 0 ? (
                <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 8 }}>
                  Nenhum evento registrado ainda.
                </div>
              ) : (
                eventHistory.map((ev, idx) => (
                  <div
                    key={ev.event_id || idx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '3px 6px',
                      borderRadius: 4,
                      background: 'rgba(255, 255, 255, 0.03)',
                      borderLeft: `3px solid ${
                        ev.type === 'MANUAL_CORRECTION'
                          ? '#f59e0b'
                          : ev.type === 'HOLE_CARDS_CONFIRMED' || ev.type === 'BOARD_CARD_CONFIRMED'
                          ? '#38bdf8'
                          : '#34d399'
                      }`
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ color: 'var(--text-muted)' }}>#{ev.sequence}</span>
                      <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{ev.type}</span>
                      <span style={{ color: 'var(--text-dim)' }}>[{ev.street}]</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ color: '#34d399' }}>{(ev.confidence * 100).toFixed(0)}%</span>
                      <span style={{ color: 'var(--text-muted)' }}>
                        {new Date(ev.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* 6. BOTTOM ACTIONS */}
        <div style={{ display: 'flex', gap: 10, marginTop: 'auto' }}>
          <button
            className="btn-secondary"
            style={{ flex: 1, justifyContent: 'center' }}
            onClick={onPauseToggle}
            id="btn-bottom-pause"
          >
            {gameState.isPaused ? <Play size={14} /> : <Pause size={14} />}
            <span>{gameState.isPaused ? 'Retomar Análise' : 'Pausar Análise'}</span>
          </button>
          <button
            className="btn-secondary"
            style={{ flex: 1, justifyContent: 'center' }}
            onClick={onOpenCorrection}
            id="btn-bottom-correct"
          >
            <RotateCcw size={14} />
            <span>Corrigir Leitura</span>
          </button>
        </div>
      </div>
    </div>
  );
};
