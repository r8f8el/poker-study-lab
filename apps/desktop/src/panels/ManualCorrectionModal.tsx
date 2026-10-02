import React, { useState } from 'react';
import { GameState, CardString, Street, PokerActionType } from '../../../../packages/shared-types/src';
import { X, Check, RotateCcw, AlertCircle } from 'lucide-react';

interface ManualCorrectionModalProps {
  isOpen: boolean;
  gameState: GameState;
  onClose: () => void;
  onApplyCorrection: (correctedState: Partial<GameState>, reason: string) => void;
}

export const ManualCorrectionModal: React.FC<ManualCorrectionModalProps> = ({
  isOpen,
  gameState,
  onClose,
  onApplyCorrection
}) => {
  const [heroCard1, setHeroCard1] = useState(gameState.hero.cards[0] || '');
  const [heroCard2, setHeroCard2] = useState(gameState.hero.cards[1] || '');
  const [boardCards, setBoardCards] = useState(gameState.board.join(' '));
  const [potValue, setPotValue] = useState(gameState.pot.toString());
  const [heroStack, setHeroStack] = useState(gameState.hero.stack.toString());
  const [heroPosition, setHeroPosition] = useState(gameState.hero.position);
  const [street, setStreet] = useState<Street>(gameState.street);
  const [activePlayer, setActivePlayer] = useState(gameState.active_player);
  const [reason, setReason] = useState('Ajuste de leitura visual pelo operador');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const parsedBoard = boardCards
      .trim()
      .split(/\s+/)
      .filter(c => c.length === 2) as CardString[];

    const correctedHoleCards: [CardString, CardString] | [] =
      heroCard1 && heroCard2 ? [heroCard1 as CardString, heroCard2 as CardString] : [];

    const updatedPartial: Partial<GameState> = {
      street,
      pot: parseFloat(potValue) || 0,
      active_player: activePlayer,
      hero: {
        ...gameState.hero,
        position: heroPosition,
        cards: correctedHoleCards,
        stack: parseFloat(heroStack) || gameState.hero.stack
      },
      board: parsedBoard
    };

    onApplyCorrection(updatedPartial, reason);
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
          width: 580,
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: 16,
          border: '1px solid var(--border-active)'
        }}
      >
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
            <RotateCcw size={18} color="#38bdf8" />
            <h2 style={{ fontSize: 16, fontWeight: 700 }}>Correção Manual da Leitura Visual</h2>
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

        <form onSubmit={handleSubmit} style={{ padding: 24, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div
            style={{
              background: 'rgba(56, 189, 248, 0.08)',
              border: '1px solid rgba(56, 189, 248, 0.25)',
              borderRadius: 8,
              padding: 10,
              fontSize: 12,
              color: '#7dd3fc',
              display: 'flex',
              gap: 8,
              alignItems: 'center'
            }}
          >
            <AlertCircle size={16} />
            <span>
              A correção manual emitirá um evento imutável `MANUAL_CORRECTION` e reavaliará o RecommendationGate.
            </span>
          </div>

          {/* Hero cards */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-dim)', display: 'block', marginBottom: 4 }}>
                Hero Carta 1 (ex: As):
              </label>
              <input
                type="text"
                maxLength={2}
                value={heroCard1}
                onChange={e => setHeroCard1(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: 8,
                  background: 'rgba(0,0,0,0.4)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-main)',
                  fontFamily: 'var(--font-mono)'
                }}
              />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-dim)', display: 'block', marginBottom: 4 }}>
                Hero Carta 2 (ex: Kc):
              </label>
              <input
                type="text"
                maxLength={2}
                value={heroCard2}
                onChange={e => setHeroCard2(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: 8,
                  background: 'rgba(0,0,0,0.4)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-main)',
                  fontFamily: 'var(--font-mono)'
                }}
              />
            </div>
          </div>

          {/* Board cards */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-dim)', display: 'block', marginBottom: 4 }}>
              Cartas Comunitárias do Board (separadas por espaço, ex: 7h 8h Qs):
            </label>
            <input
              type="text"
              value={boardCards}
              onChange={e => setBoardCards(e.target.value)}
              placeholder="7h 8h Qs"
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: 8,
                background: 'rgba(0,0,0,0.4)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-main)',
                fontFamily: 'var(--font-mono)'
              }}
            />
          </div>

          {/* Pot and Street */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-dim)', display: 'block', marginBottom: 4 }}>
                Pote ($):
              </label>
              <input
                type="number"
                value={potValue}
                onChange={e => setPotValue(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: 8,
                  background: 'rgba(0,0,0,0.4)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-main)'
                }}
              />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-dim)', display: 'block', marginBottom: 4 }}>
                Street Atual:
              </label>
              <select
                value={street}
                onChange={e => setStreet(e.target.value as Street)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: 8,
                  background: '#0d121d',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-main)'
                }}
              >
                <option value="PREFLOP">PREFLOP</option>
                <option value="FLOP">FLOP</option>
                <option value="TURN">TURN</option>
                <option value="RIVER">RIVER</option>
                <option value="SHOWDOWN">SHOWDOWN</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-dim)', display: 'block', marginBottom: 4 }}>
                Posição Hero:
              </label>
              <input
                type="text"
                value={heroPosition}
                onChange={e => setHeroPosition(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: 8,
                  background: 'rgba(0,0,0,0.4)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-main)'
                }}
              />
            </div>
          </div>

          {/* Active player and reason */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-dim)', display: 'block', marginBottom: 4 }}>
                Jogador Ativo:
              </label>
              <input
                type="text"
                value={activePlayer}
                onChange={e => setActivePlayer(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: 8,
                  background: 'rgba(0,0,0,0.4)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-main)'
                }}
              />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-dim)', display: 'block', marginBottom: 4 }}>
                Motivo da Correção:
              </label>
              <input
                type="text"
                value={reason}
                onChange={e => setReason(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: 8,
                  background: 'rgba(0,0,0,0.4)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-main)'
                }}
              />
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 12,
              marginTop: 12
            }}
          >
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary">
              <Check size={14} />
              <span>Aplicar Correção</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
