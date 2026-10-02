import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  GameState,
  AppSettings,
  TableLayoutProfile,
  CapturedFrame,
  CaptureSource,
  GameEvent,
  OpponentProfile,
  AIExplanationResult
} from '../../../packages/shared-types/src';
import {
  MOCK_VALID_PREFLOP_STATE,
  MOCK_VALID_FLOP_STATE,
  MOCK_INCONSISTENT_DUPLICATE_CARD_STATE,
  MOCK_UNCERTAIN_STATE,
  POKERSTARS_LAYOUT_PROFILE,
  SUPREMA_POKER_LAYOUT_PROFILE,
  MOCK_SUPREMA_POKER_STATE,
  MOCK_AUTHORIZED_SOURCE
} from '../../../packages/test-fixtures/src';
import { BaseScreenCapture, SyntheticPokerCapture } from './capture/ScreenCaptureAdapter';
import { WindowMediaStreamCapture } from './capture/WindowMediaStreamCapture';
import { FrameMetrics, CircularFrameBuffer } from './capture/CircularFrameBuffer';
import { WindowStatus, WindowLifecycleMonitor } from './capture/WindowLifecycleMonitor';
import { RecommendationGate } from './app-state/RecommendationGate';
import { HeaderBar } from './components/HeaderBar';
import { LiveSplitView } from './panels/LiveSplitView';
import { SettingsModal } from './settings/SettingsModal';
import { ManualCorrectionModal } from './panels/ManualCorrectionModal';
import { WindowSelectorModal } from './capture/WindowSelectorModal';
import { TemporalTableValidator } from './vision/TemporalValidator';
import { InMemoryEventStore, generateEventId } from './event-store/EventStore';
import { HandStateEngine } from './event-store/HandStateEngine';
import { DeterministicDecisionEngine } from './decision/DeterministicDecisionEngine';
import { OPPONENT_PROFILES } from './decision/RangeModel';
import { AIExplanationService } from './ai/AIExplanationService';
import { TableVisionAnalyzer, SlotDebugInfo } from './vision/TableVisionAnalyzer';

const INITIAL_SETTINGS: AppSettings = {
  authorizedAppIdentifier: 'com.auth.poker.client',
  fps: 15,
  minConfidenceAutoAccept: 0.98,
  minConfidenceTemporalAccept: 0.95,
  minConfidenceProbable: 0.85,
  temporalWindowFrames: 7,
  temporalMinConsensusFrames: 5,
  enableAIExplanations: true,
  theme: 'midnight',
  activeProfileId: 'profile_suprema_poker_vertical'
};

export const App: React.FC = () => {
  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const saved = localStorage.getItem('poker_study_lab_settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        // Security: Never load plaintext API key from disk into memory
        return { ...INITIAL_SETTINGS, ...parsed, aiApiKey: '' };
      }
    } catch {}
    return INITIAL_SETTINGS;
  });
  const [activeProfile, setActiveProfile] = useState<TableLayoutProfile>(() => {
    try {
      const saved = localStorage.getItem('poker_study_lab_calibrated_profile');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {}
    return SUPREMA_POKER_LAYOUT_PROFILE;
  });
  const activeProfileRef = useRef<TableLayoutProfile>(activeProfile);

  useEffect(() => {
    activeProfileRef.current = activeProfile;
  }, [activeProfile]);

  const handleUpdateProfile = (newProfile: TableLayoutProfile) => {
    setActiveProfile(newProfile);
    activeProfileRef.current = newProfile;
    try {
      localStorage.setItem('poker_study_lab_calibrated_profile', JSON.stringify(newProfile));
    } catch (e) {
      console.warn('Failed to save profile', e);
    }
  };

  const [activeSource, setActiveSource] = useState<CaptureSource | null>(MOCK_AUTHORIZED_SOURCE);
  const [isCapturing, setIsCapturing] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [measuredFps, setMeasuredFps] = useState<number>(0);
  const [lastFrame, setLastFrame] = useState<CapturedFrame | null>(null);

  // Incremento 2: Latency, buffer metrics and window lifecycle
  const [bufferMetrics, setBufferMetrics] = useState<FrameMetrics>({
    totalFramesIngested: 0,
    totalFramesDropped: 0,
    currentBufferOccupancy: 0,
    bufferCapacity: 5,
    latestFrameLatencyMs: 0,
    averageLatencyMs: 0
  });
  const [windowStatus, setWindowStatus] = useState<WindowStatus>('NORMAL');
  const [windowStatusReason, setWindowStatusReason] = useState<string>('');

  // Core Game State - Defaults to calibrated Suprema Poker table
  const [gameState, setGameState] = useState<GameState>(MOCK_SUPREMA_POKER_STATE);
  const [eventHistory, setEventHistory] = useState<GameEvent[]>([]);
  const [opponentProfile, setOpponentProfile] = useState<OpponentProfile>(OPPONENT_PROFILES[1]);

  // Modals
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isCorrectionOpen, setIsCorrectionOpen] = useState<boolean>(false);
  const [isSourceSelectorOpen, setIsSourceSelectorOpen] = useState<boolean>(false);
  const [aiExplanation, setAiExplanation] = useState<AIExplanationResult | null>(null);
  const [slotsDebug, setSlotsDebug] = useState<SlotDebugInfo[]>([]);

  // Capture Adapter Ref (BaseScreenCapture can be Synthetic or Native)
  const captureAdapterRef = useRef<BaseScreenCapture | null>(null);
  const ringBufferRef = useRef<CircularFrameBuffer>(new CircularFrameBuffer(5));
  const windowMonitorRef = useRef<WindowLifecycleMonitor>(new WindowLifecycleMonitor());
  const gateRef = useRef<RecommendationGate>(new RecommendationGate(INITIAL_SETTINGS));
  const eventStoreRef = useRef<InMemoryEventStore>(new InMemoryEventStore());
  const aiExplainerRef = useRef<AIExplanationService>(new AIExplanationService());
  const visionAnalyzerRef = useRef<TableVisionAnalyzer>(new TableVisionAnalyzer());
  const lastUiFrameTimeRef = useRef<number>(0);
  const tableValidatorRef = useRef<TemporalTableValidator>(
    new TemporalTableValidator(
      INITIAL_SETTINGS.temporalWindowFrames,
      INITIAL_SETTINGS.temporalMinConsensusFrames,
      INITIAL_SETTINGS.minConfidenceTemporalAccept
    )
  );

  useEffect(() => {
    gateRef.current.updateSettings(settings);
    tableValidatorRef.current = new TemporalTableValidator(
      settings.temporalWindowFrames,
      settings.temporalMinConsensusFrames,
      settings.minConfidenceTemporalAccept
    );
  }, [settings]);

  // Initialize WindowLifecycleMonitor listener
  useEffect(() => {
    const unbind = windowMonitorRef.current.addListener(event => {
      setWindowStatus(event.status);
      setWindowStatusReason(event.reason);

      if (event.status === 'MINIMIZED') {
        handlePauseCapture();
      } else if (event.status === 'UNAUTHORIZED') {
        handleEmergencyStop();
      } else if (event.status === 'UNAVAILABLE') {
        handleEmergencyStop();
      }
    });

    return () => {
      unbind();
    };
  }, []);

  // Initialize Default Adapter (Synthetic for reproducible development)
  useEffect(() => {
    setupAdapter(new SyntheticPokerCapture());
    return () => {
      captureAdapterRef.current?.stop();
    };
  }, []);

  const setupAdapter = (adapter: BaseScreenCapture) => {
    captureAdapterRef.current?.stop();
    captureAdapterRef.current = adapter;

    adapter.addListener({
      onFrame: frame => {
        // Buffer always receives all frames at full rate
        ringBufferRef.current.push(frame);

        // Auto-detect vertical client windows (like Suprema Poker)
        if (
          frame.height > frame.width &&
          !activeProfileRef.current.id.includes('suprema') &&
          activeProfileRef.current.id !== 'profile_custom_calibrated'
        ) {
          handleUpdateProfile(SUPREMA_POKER_LAYOUT_PROFILE);
        } else if (
          frame.width >= frame.height &&
          activeProfileRef.current.id.includes('suprema') &&
          activeProfileRef.current.id !== 'profile_custom_calibrated'
        ) {
          // Auto-detect horizontal widescreen client windows (like PokerStars / Desktop)
          handleUpdateProfile(POKERSTARS_LAYOUT_PROFILE);
        }

        // Throttle React state updates to at most ~8-10 FPS (120ms) to keep browser at smooth 60fps
        const now = performance.now();
        if (now - lastUiFrameTimeRef.current >= 120) {
          lastUiFrameTimeRef.current = now;
          setLastFrame(frame);
          setBufferMetrics(ringBufferRef.current.getMetrics());

          // Live Optical Detection from captured video frame using the latest profile ref
          visionAnalyzerRef.current
            .analyzeFrame(frame, activeProfileRef.current, tableValidatorRef.current)
            .then(detection => {
              if (detection) {
                if (detection.slotsDebug && detection.slotsDebug.length > 0) {
                  setSlotsDebug(detection.slotsDebug);
                }

                setGameState(prev => {
                  return {
                    ...prev,
                    hero: {
                      ...prev.hero,
                      cards: (detection.heroCards.length >= 2
                        ? [detection.heroCards[0], detection.heroCards[1]]
                        : detection.heroCards) as any
                    },
                    board: detection.boardCards,
                    pot: detection.potValue !== null ? detection.potValue : 0,
                    street: detection.street,
                    confidence: {
                      ...prev.confidence,
                      hero_cards: [
                        { value: detection.heroCards[0] || '', confidence: detection.heroCards[0] ? 0.98 : 0 },
                        { value: detection.heroCards[1] || '', confidence: detection.heroCards[1] ? 0.98 : 0 }
                      ],
                      board: {
                        value: detection.boardCards,
                        confidence: detection.boardCards.length > 0 ? 0.98 : 1.0
                      },
                      pot: {
                        value: detection.potValue ?? 0,
                        confidence: 0.95
                      },
                      overall_confidence: detection.confidence
                    }
                  };
                });
              }
            })
            .catch(() => {});
        }
      },
      onStatusChange: status => {
        setIsCapturing(status.isCapturing);
        setIsPaused(status.isPaused);
        setMeasuredFps(status.fps);
      }
    });
  };

  const resetLiveState = () => {
    setGameState(prev => ({
      ...prev,
      hero: { ...prev.hero, cards: [] },
      board: [],
      pot: 0,
      street: 'PREFLOP',
      action_history: [],
      players: [],
      confidence: {
        ...prev.confidence,
        hero_cards: [{ value: '', confidence: 0 }, { value: '', confidence: 0 }],
        board: { value: [], confidence: 1.0 },
        pot: { value: 0, confidence: 1.0 },
        overall_confidence: 1.0
      }
    }));
    setSlotsDebug([]);
  };

  const handleStartCapture = async () => {
    if (!captureAdapterRef.current || !activeSource) {
      setIsSourceSelectorOpen(true);
      return;
    }
    try {
      windowMonitorRef.current.setMonitoredSource(activeSource);
      ringBufferRef.current.clear();
      resetLiveState();
      await captureAdapterRef.current.start(activeSource, settings.fps);
      logEvent('APP_DETECTED', { appIdentifier: activeSource.appIdentifier }, 1.0);
      logEvent('TABLE_DETECTED', { tableId: gameState.table_id }, 0.99);
    } catch (err) {
      console.error('Failed to start capture:', err);
    }
  };

  const handleSelectAndStartSource = async (source: CaptureSource, targetFps: number) => {
    setActiveSource(source);
    setSettings(prev => ({ ...prev, fps: targetFps }));
    windowMonitorRef.current.setMonitoredSource(source);

    const adapter = new SyntheticPokerCapture();
    setupAdapter(adapter);
    resetLiveState();
    await adapter.start(source, targetFps);
    logEvent('APP_DETECTED', { appIdentifier: source.appIdentifier }, 1.0);
  };

  const handleRequestNativePicker = async () => {
    const nativeCapture = new WindowMediaStreamCapture(5);
    setupAdapter(nativeCapture);
    const source = await nativeCapture.select_source();
    if (source) {
      setActiveSource(source);
      windowMonitorRef.current.setMonitoredSource(source);
      resetLiveState();
      await nativeCapture.start(source, settings.fps);
      logEvent('APP_DETECTED', { appIdentifier: source.appIdentifier }, 1.0);
    }
  };

  const handlePauseCapture = () => {
    if (!captureAdapterRef.current) return;
    captureAdapterRef.current.pause();
    setGameState(prev => ({ ...prev, isPaused: true }));
  };

  const handleResumeCapture = () => {
    if (!captureAdapterRef.current) return;
    captureAdapterRef.current.resume();
    setGameState(prev => ({ ...prev, isPaused: false }));
  };

  // Emergency Kill Switch: Stops immediately, wipes frame cache, shuts off recommendation
  const handleEmergencyStop = () => {
    if (!captureAdapterRef.current) return;
    captureAdapterRef.current.stop();
    ringBufferRef.current.clear();
    setLastFrame(null);
    setBufferMetrics(ringBufferRef.current.getMetrics());
    setGameState(prev => ({ ...prev, isPaused: true, status: 'PAUSED' }));
  };

  const logEvent = (type: GameEvent['type'], data: Record<string, unknown>, confidence: number) => {
    const newEvent: GameEvent = {
      sequence: eventHistory.length + 1,
      event_id: generateEventId(),
      hand_id: gameState.hand_id,
      type,
      street: gameState.street,
      data,
      confidence,
      timestamp: new Date().toISOString()
    };
    eventStoreRef.current.appendEvent(newEvent);
    const handEvents = eventStoreRef.current.getEvents(gameState.hand_id);
    setEventHistory([...handEvents].reverse().slice(0, 50));
  };

  const handleReconstructFromEvents = () => {
    const events = eventStoreRef.current.getEvents(gameState.hand_id);
    if (events.length > 0) {
      const reconstructed = HandStateEngine.reconstructState(events);
      setGameState(reconstructed);
    }
  };

  const handleApplyManualCorrection = (correctedPartial: Partial<GameState>, reason: string) => {
    logEvent('MANUAL_CORRECTION', { reason, changes: correctedPartial }, 1.0);
    setGameState(prev => ({
      ...prev,
      ...correctedPartial,
      status: 'FLOP',
      confidence: {
        ...prev.confidence,
        overall_confidence: 0.99
      },
      lastUpdated: new Date().toISOString()
    }));
  };

  const handleTriggerScenario = (scenarioName: string) => {
    switch (scenarioName) {
      case 'empty_table':
        resetLiveState();
        break;
      case 'preflop_clean':
        setGameState({ ...MOCK_VALID_PREFLOP_STATE, isPaused: false });
        break;
      case 'flop_clean':
        setGameState({ ...MOCK_VALID_FLOP_STATE, isPaused: false });
        break;
      case 'duplicate_card_error':
        setGameState({ ...MOCK_INCONSISTENT_DUPLICATE_CARD_STATE, isPaused: false });
        break;
      case 'low_confidence':
        setGameState({ ...MOCK_UNCERTAIN_STATE, isPaused: false });
        break;
      case 'animation_active':
        setGameState(prev => ({ ...prev, isAnimationActive: true, isPaused: false }));
        setTimeout(() => {
          setGameState(prev => ({ ...prev, isAnimationActive: false }));
        }, 3000);
        break;
      case 'unauthorized_app':
        setGameState(prev => ({ ...prev, app_id: 'com.unauthorized.window' }));
        break;
      case 'suprema_hand':
        setActiveProfile(SUPREMA_POKER_LAYOUT_PROFILE);
        setGameState({ ...MOCK_SUPREMA_POKER_STATE, isPaused: false });
        break;
      default:
        break;
    }
  };

  // Evaluate the recommendation gate - memoized to prevent re-evaluating on minor frame jitter
  const isLatencyExceeded = isCapturing && bufferMetrics.latestFrameLatencyMs > 2000;
  const gateResult = useMemo(() => {
    return gateRef.current.evaluate(gameState, {
      frameLatencyMs: isCapturing ? bufferMetrics.latestFrameLatencyMs : 0,
      maxLatencyMs: 2000
    });
  }, [
    gameState,
    isCapturing,
    isLatencyExceeded
  ]);

  // Memoize stable keys for poker state to avoid running heavy Monte Carlo simulations on every video frame
  const heroCardsKey = gameState.hero.cards.join(',');
  const boardCardsKey = gameState.board.join(',');
  const actionHistoryLength = gameState.action_history.length;

  const recommendation = useMemo(() => {
    return DeterministicDecisionEngine.evaluate(gameState, gateResult, {
      opponentCombos: opponentProfile.combos,
      opponentProfileName: opponentProfile.name
    });
  }, [
    heroCardsKey,
    boardCardsKey,
    gameState.pot,
    gameState.street,
    gameState.hero.position,
    actionHistoryLength,
    gateResult.allowed,
    opponentProfile.id,
    opponentProfile.rangePercentage
  ]);

  // Re-generate pedagogical AI explanation asynchronously whenever decision/gate/opponent changes
  useEffect(() => {
    let isCancelled = false;

    const request = {
      hand_id: gameState.hand_id,
      stage: gameState.street,
      hero_cards: gameState.hero.cards,
      board: gameState.board,
      pot_size: gameState.pot,
      to_call: 0,
      equity: recommendation.equity_estimate ?? 0.5,
      pot_odds: recommendation.pot_odds ?? 0,
      primary_action: recommendation.action,
      action_frequencies: recommendation.frequencies,
      opponent_range_profile: opponentProfile.name,
      strategic_factors: recommendation.explanation_factors,
      is_gate_open: gateResult.allowed,
      gate_reasons: gateResult.reasons
    };

    aiExplainerRef.current
      .explain(request, {
        enableAI: settings.enableAIExplanations,
        externalApiConsent: settings.externalApiConsent,
        apiKey: settings.aiApiKey,
        endpoint: settings.aiApiEndpoint
      })
      .then(result => {
        if (!isCancelled) {
          setAiExplanation(result);
        }
      })
      .catch(() => {});

    return () => {
      isCancelled = true;
    };
  }, [
    gameState.hand_id,
    gameState.street,
    gameState.pot,
    heroCardsKey,
    boardCardsKey,
    gateResult.allowed,
    gateResult.reasons.join(';'),
    recommendation.action,
    recommendation.pot_odds,
    opponentProfile.id,
    settings.enableAIExplanations,
    settings.externalApiConsent,
    settings.aiProvider,
    settings.aiApiKey,
    settings.aiApiEndpoint
  ]);

  const handleRefreshExplanation = () => {
    aiExplainerRef.current.clearCache();
    const request = {
      hand_id: gameState.hand_id,
      stage: gameState.street,
      hero_cards: gameState.hero.cards,
      board: gameState.board,
      pot_size: gameState.pot,
      to_call: 0,
      equity: recommendation.equity_estimate ?? 0.5,
      pot_odds: recommendation.pot_odds ?? 0,
      primary_action: recommendation.action,
      action_frequencies: recommendation.frequencies,
      opponent_range_profile: opponentProfile.name,
      strategic_factors: recommendation.explanation_factors,
      is_gate_open: gateResult.allowed,
      gate_reasons: gateResult.reasons
    };
    aiExplainerRef.current
      .explain(request, {
        enableAI: settings.enableAIExplanations,
        externalApiConsent: settings.externalApiConsent,
        apiKey: settings.aiApiKey,
        endpoint: settings.aiApiEndpoint
      })
      .then(setAiExplanation)
      .catch(() => {});
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        backgroundColor: 'var(--bg-primary)',
        color: 'var(--text-main)',
        userSelect: 'none'
      }}
    >
      <HeaderBar
        isCapturing={isCapturing}
        isPaused={isPaused}
        fps={measuredFps}
        activeSource={activeSource}
        onStart={handleStartCapture}
        onPause={handlePauseCapture}
        onResume={handleResumeCapture}
        onEmergencyStop={handleEmergencyStop}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenCorrection={() => setIsCorrectionOpen(true)}
        onOpenSourceSelector={() => setIsSourceSelectorOpen(true)}
      />

      <LiveSplitView
        gameState={gameState}
        gateResult={gateResult}
        recommendation={gateResult.allowed ? recommendation : null}
        activeProfile={activeProfile}
        lastFrame={lastFrame}
        isCapturing={isCapturing}
        bufferMetrics={bufferMetrics}
        windowStatus={windowStatus}
        windowStatusReason={windowStatusReason}
        eventHistory={eventHistory}
        opponentProfile={opponentProfile}
        explanation={aiExplanation}
        enableAIExplanations={settings.enableAIExplanations}
        onRefreshExplanation={handleRefreshExplanation}
        onPauseToggle={isPaused ? handleResumeCapture : handlePauseCapture}
        onOpenCorrection={() => setIsCorrectionOpen(true)}
        onTriggerScenario={handleTriggerScenario}
        onReconstructState={handleReconstructFromEvents}
        onChangeOpponentProfile={setOpponentProfile}
        onChangeProfile={handleUpdateProfile}
        slotsDebug={slotsDebug}
      />

      <WindowSelectorModal
        isOpen={isSourceSelectorOpen}
        activeSource={activeSource}
        onClose={() => setIsSourceSelectorOpen(false)}
        onSelectAndStart={handleSelectAndStartSource}
        onRequestNativePicker={handleRequestNativePicker}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        settings={settings}
        activeProfile={activeProfile}
        frameDataUrl={lastFrame?.dataUrl}
        onClose={() => setIsSettingsOpen(false)}
        onSave={newSettings => {
          setSettings(newSettings);
          try {
            // Security safeguard: Strip sensitive API key before writing to localStorage
            const { aiApiKey: _strippedKey, ...safeSettingsToPersist } = newSettings;
            localStorage.setItem('poker_study_lab_settings', JSON.stringify(safeSettingsToPersist));
          } catch (e) {
            console.warn('Failed to persist settings:', e);
          }
        }}
        onSaveProfile={handleUpdateProfile}
      />

      <ManualCorrectionModal
        isOpen={isCorrectionOpen}
        gameState={gameState}
        onClose={() => setIsCorrectionOpen(false)}
        onApplyCorrection={handleApplyManualCorrection}
      />
    </div>
  );
};

export default App;
