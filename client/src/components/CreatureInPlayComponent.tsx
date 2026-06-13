import { CreatureInPlay, Keyword } from '../types';

interface CreatureInPlayProps {
  creature: CreatureInPlay;
  onClick?: () => void;
  isSelectable?: boolean;
  isAttacker?: boolean;
  isFrenzyAttacker?: boolean;
  isForcedBlocker?: boolean;
  className?: string;
}

const KEYWORD_COLORS: Record<Keyword, string> = {
  FRENZY: 'keyword-FRENZY',
  HUNTER: 'keyword-HUNTER',
  POISONOUS: 'keyword-POISONOUS',
  SNEAKY: 'keyword-SNEAKY',
  TOUGH: 'keyword-TOUGH',
};

export default function CreatureInPlayComponent({
  creature,
  onClick,
  isSelectable = false,
  isAttacker = false,
  isFrenzyAttacker = false,
  isForcedBlocker = false,
  className = '',
}: CreatureInPlayProps) {
  const classes = [
    'creature-card',
    isSelectable ? 'selectable' : '',
    isAttacker ? 'attacker' : '',
    isFrenzyAttacker ? 'frenzy-attacker' : '',
    isForcedBlocker ? 'forced-blocker' : '',
    creature.isDamaged ? 'damaged' : '',
    className,
  ].filter(Boolean).join(' ');

  return (
    <div
      className={classes}
      onClick={isSelectable ? onClick : undefined}
      title={creature.ability?.description}
    >
      <div className="creature-power">{creature.power}</div>
      <div className="creature-name">{creature.name}</div>
      <div className="creature-keywords">
        {creature.keywords.map(kw => (
          <span key={kw} className={`keyword-badge ${KEYWORD_COLORS[kw]}`}>
            {kw}
          </span>
        ))}
      </div>
      {creature.ability && (
        <div className="creature-ability">{creature.ability.description}</div>
      )}
      {creature.isDamaged && (
        <div style={{ fontSize: '0.55rem', color: '#ef4444', fontFamily: 'Cinzel, serif', marginTop: '2px' }}>
          ⚡ DAMAGED
        </div>
      )}
    </div>
  );
}
