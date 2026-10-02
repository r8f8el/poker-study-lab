import React from 'react';
import { CardString } from '../../../../packages/shared-types/src';

interface PlayingCardProps {
  card?: CardString | null;
  confidence?: number;
  isEmpty?: boolean;
  isBack?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const SUIT_SYMBOLS: Record<string, { symbol: string; color: string; isRed: boolean }> = {
  c: { symbol: '♣', color: '#10b981', isRed: false }, // Green in 4-color
  d: { symbol: '♦', color: '#3b82f6', isRed: true },  // Blue in 4-color
  h: { symbol: '♥', color: '#ef4444', isRed: true },  // Red
  s: { symbol: '♠', color: '#0f172a', isRed: false }  // Black
};

export const PlayingCard: React.FC<PlayingCardProps> = ({
  card,
  confidence,
  isEmpty = false,
  isBack = false,
  size = 'md'
}) => {
  if (isEmpty || !card) {
    return (
      <div
        className="glass-panel"
        style={{
          width: size === 'sm' ? 44 : size === 'lg' ? 72 : 58,
          height: size === 'sm' ? 64 : size === 'lg' ? 104 : 84,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: '1px dashed rgba(255, 255, 255, 0.15)',
          color: 'var(--text-dim)',
          fontSize: 12
        }}
      >
        <span>—</span>
      </div>
    );
  }

  if (isBack) {
    return (
      <div
        className="poker-card poker-card-back"
        style={{
          width: size === 'sm' ? 44 : size === 'lg' ? 72 : 58,
          height: size === 'sm' ? 64 : size === 'lg' ? 104 : 84
        }}
      />
    );
  }

  const rawRank = card.slice(0, 1);
  const displayRank = rawRank === 'T' ? '10' : rawRank;
  const suitChar = card.slice(1, 2).toLowerCase();
  const suitInfo = SUIT_SYMBOLS[suitChar] || { symbol: suitChar, color: '#0f172a', isRed: false };

  const dimensions =
    size === 'sm'
      ? { w: 44, h: 64, fontRank: 13, fontSuit: 16 }
      : size === 'lg'
      ? { w: 72, h: 104, fontRank: 22, fontSuit: 28 }
      : { w: 58, h: 84, fontRank: 17, fontSuit: 20 };

  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <div
        className={`poker-card ${suitInfo.isRed ? 'suit-red' : 'suit-black'}`}
        style={{ width: dimensions.w, height: dimensions.h, color: suitInfo.color }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: rawRank === 'T' ? dimensions.fontRank - 2 : dimensions.fontRank, lineHeight: 1, fontWeight: 700 }}>
            {displayRank}
          </span>
          <span style={{ fontSize: dimensions.fontSuit - 4, lineHeight: 1 }}>{suitInfo.symbol}</span>
        </div>
        <div style={{ textAlign: 'center', fontSize: dimensions.fontSuit, lineHeight: 1 }}>
          {suitInfo.symbol}
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            transform: 'rotate(180deg)'
          }}
        >
          <span style={{ fontSize: rawRank === 'T' ? dimensions.fontRank - 2 : dimensions.fontRank, lineHeight: 1, fontWeight: 700 }}>
            {displayRank}
          </span>
          <span style={{ fontSize: dimensions.fontSuit - 4, lineHeight: 1 }}>{suitInfo.symbol}</span>
        </div>
      </div>
      {confidence !== undefined && (
        <span
          style={{
            fontSize: 10,
            fontFamily: 'var(--font-mono)',
            padding: '1px 5px',
            borderRadius: 4,
            backgroundColor:
              confidence >= 0.98
                ? 'rgba(16, 185, 129, 0.2)'
                : confidence >= 0.9
                ? 'rgba(245, 158, 11, 0.2)'
                : 'rgba(244, 63, 94, 0.2)',
            color:
              confidence >= 0.98
                ? '#34d399'
                : confidence >= 0.9
                ? '#fbbf24'
                : '#fb7185',
            border: `1px solid ${
              confidence >= 0.98
                ? 'rgba(16, 185, 129, 0.3)'
                : confidence >= 0.9
                ? 'rgba(245, 158, 11, 0.3)'
                : 'rgba(244, 63, 94, 0.3)'
            }`
          }}
        >
          {(confidence * 100).toFixed(0)}%
        </span>
      )}
    </div>
  );
};
