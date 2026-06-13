import { CardDef, Keyword } from '../types';

interface CardComponentProps {
  card: CardDef;
  onClick?: () => void;
  isPlayable?: boolean;
  isSelected?: boolean;
  className?: string;
}

const KEYWORD_COLORS: Record<Keyword, string> = {
  FRENZY: 'keyword-FRENZY',
  HUNTER: 'keyword-HUNTER',
  POISONOUS: 'keyword-POISONOUS',
  SNEAKY: 'keyword-SNEAKY',
  TOUGH: 'keyword-TOUGH',
};

export default function CardComponent({ card, onClick, isPlayable = false, isSelected = false, className = '' }: CardComponentProps) {
  const classes = [
    'hand-card',
    isPlayable ? 'playable' : 'not-playable',
    isSelected ? 'selected' : '',
    className,
  ].filter(Boolean).join(' ');

  return (
    <div className={classes} onClick={isPlayable ? onClick : undefined} title={card.ability?.description}>
      <div className="card-power">{card.power}</div>
      <div className="card-name">{card.name}</div>
      <div className="card-keywords">
        {card.keywords.map(kw => (
          <span key={kw} className={`keyword-badge ${KEYWORD_COLORS[kw]}`}>
            {kw}
          </span>
        ))}
      </div>
      {card.ability && (
        <div className="card-ability">{card.ability.description}</div>
      )}
    </div>
  );
}
