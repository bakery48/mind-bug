import { useState } from 'react';
import { CardDef, Keyword, AbilityTrigger, AbilityEffect } from '../types';

interface CardBuilderProps {
  cards: CardDef[];
  onAdd: (card: CardDef) => void;
  onRemove: (id: string) => void;
  maxCards?: number;
}

const KW_INFO: { value: Keyword; ja: string; en: string; desc: string }[] = [
  { value: 'FRENZY',    ja: '狂乱', en: 'FRENZY',    desc: '攻撃後生き残ったら再攻撃できる' },
  { value: 'HUNTER',   ja: '狩人', en: 'HUNTER',   desc: '攻撃時にブロッカーを指定できる' },
  { value: 'POISONOUS', ja: '毒',   en: 'POISONOUS', desc: '戦闘した相手クリーチャーを倒す' },
  { value: 'SNEAKY',   ja: '隠密', en: 'SNEAKY',   desc: '隠密クリーチャーにしかブロックされない' },
  { value: 'TOUGH',    ja: '強靭', en: 'TOUGH',    desc: '2回倒されるまで破壊されない' },
];

const TRIGGER_OPTIONS: { value: AbilityTrigger; ja: string }[] = [
  { value: 'PLAY',     ja: 'プレイ時' },
  { value: 'ATTACK',   ja: '攻撃時' },
  { value: 'DEFEATED', ja: '破壊時' },
];

type EffectOption = { value: AbilityEffect; ja: string };
const EFFECTS_BY_TRIGGER: Record<AbilityTrigger, EffectOption[]> = {
  PLAY: [
    { value: 'DRAW_CARD',       ja: 'カードを1枚引く' },
    { value: 'GAIN_LIFE',       ja: 'ライフを1回復する' },
    { value: 'DAMAGE_CREATURE', ja: 'クリーチャー1体にダメージ' },
    { value: 'WIPE_WEAK',       ja: 'パワー4以下を全滅させる' },
  ],
  ATTACK: [
    { value: 'DIRECT_DAMAGE', ja: '相手に1ダメージ' },
    { value: 'DRAW_CARD',     ja: 'カードを1枚引く' },
  ],
  DEFEATED: [
    { value: 'DRAW_CARD',      ja: 'カードを1枚引く' },
    { value: 'GAIN_LIFE',      ja: 'ライフを1回復する' },
    { value: 'RETURN_TO_HAND', ja: '手札に戻る' },
  ],
};

const KW_COLORS: Record<Keyword, string> = {
  FRENZY:    '#e74c3c',
  HUNTER:    '#e67e22',
  POISONOUS: '#27ae60',
  SNEAKY:    '#8e44ad',
  TOUGH:     '#2980b9',
};

function buildDescription(trigger: AbilityTrigger, effect: AbilityEffect): string {
  const t = TRIGGER_OPTIONS.find(x => x.value === trigger)?.ja ?? trigger;
  const e = EFFECTS_BY_TRIGGER[trigger].find(x => x.value === effect)?.ja ?? effect;
  return `${t}: ${e}`;
}

function MiniCard({ card }: { card: CardDef }) {
  return (
    <div className="cb-mini-card" title={card.name}>
      <div className="cb-mini-power">{card.power}</div>
      <div className="cb-mini-name">{card.name}</div>
      {card.keywords.length > 0 && (
        <div className="cb-mini-kws">
          {card.keywords.map(k => (
            <span key={k} className="cb-mini-kw" style={{ background: KW_COLORS[k] }}>
              {KW_INFO.find(x => x.value === k)?.ja ?? k}
            </span>
          ))}
        </div>
      )}
      {card.ability && (
        <div className="cb-mini-ability">{card.ability.description}</div>
      )}
    </div>
  );
}

export default function CardBuilder({ cards, onAdd, onRemove, maxCards = 10 }: CardBuilderProps) {
  const [name, setName] = useState('');
  const [power, setPower] = useState(5);
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [hasAbility, setHasAbility] = useState(false);
  const [trigger, setTrigger] = useState<AbilityTrigger>('PLAY');
  const [effect, setEffect] = useState<AbilityEffect>('DRAW_CARD');

  const toggleKw = (kw: Keyword) => {
    if (keywords.includes(kw)) {
      setKeywords(prev => prev.filter(k => k !== kw));
    } else if (keywords.length < 3) {
      setKeywords(prev => [...prev, kw]);
    }
  };

  const handleTriggerChange = (t: AbilityTrigger) => {
    setTrigger(t);
    const first = EFFECTS_BY_TRIGGER[t][0].value;
    if (!EFFECTS_BY_TRIGGER[t].find(e => e.value === effect)) {
      setEffect(first);
    }
  };

  const handleAdd = () => {
    const n = name.trim();
    if (!n || cards.length >= maxCards) return;

    const abilityDesc = hasAbility ? buildDescription(trigger, effect) : '';
    const card: CardDef = {
      id: `custom-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name: n.slice(0, 28),
      power,
      keywords: [...keywords],
      ability: hasAbility
        ? { trigger, effect, description: abilityDesc }
        : undefined,
    };
    onAdd(card);
    setName('');
  };

  // Preview card
  const preview: CardDef = {
    id: 'preview',
    name: name.trim() || 'カード名',
    power,
    keywords: [...keywords],
    ability: hasAbility ? { trigger, effect, description: buildDescription(trigger, effect) } : undefined,
  };

  const availableEffects = EFFECTS_BY_TRIGGER[trigger];

  return (
    <div className="card-builder">
      <div className="cb-split">
        {/* ── LEFT: form ── */}
        <div className="cb-form">
          <div className="cb-row">
            <label className="cb-label">カード名</label>
            <input
              className="cb-input"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="例: 炎の竜..."
              maxLength={28}
            />
          </div>

          <div className="cb-row">
            <label className="cb-label">パワー: <strong style={{ color: '#f1c40f', fontSize: '1.1em' }}>{power}</strong></label>
            <input
              type="range"
              min={1} max={10}
              value={power}
              onChange={e => setPower(Number(e.target.value))}
              className="cb-slider"
            />
            <div className="cb-power-marks">
              {[1,2,3,4,5,6,7,8,9,10].map(n => (
                <span key={n} className={n === power ? 'active' : ''}>{n}</span>
              ))}
            </div>
          </div>

          <div className="cb-row">
            <label className="cb-label">キーワード <span className="cb-hint">（最大3つ）</span></label>
            <div className="cb-kw-grid">
              {KW_INFO.map(k => {
                const selected = keywords.includes(k.value);
                const disabled = !selected && keywords.length >= 3;
                return (
                  <button
                    key={k.value}
                    type="button"
                    className={`cb-kw-btn ${selected ? 'selected' : ''} ${disabled ? 'disabled' : ''}`}
                    style={selected ? { background: KW_COLORS[k.value], borderColor: KW_COLORS[k.value] } : {}}
                    onClick={() => !disabled && toggleKw(k.value)}
                    title={k.desc}
                  >
                    <span className="cb-kw-ja">{k.ja}</span>
                    <span className="cb-kw-en">{k.en}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="cb-row">
            <label className="cb-label">
              アビリティ
              <button
                type="button"
                className={`cb-toggle ${hasAbility ? 'on' : ''}`}
                onClick={() => setHasAbility(v => !v)}
              >
                {hasAbility ? 'ON' : 'OFF'}
              </button>
            </label>

            {hasAbility && (
              <div className="cb-ability-form">
                <div className="cb-ability-row">
                  <span className="cb-sub-label">タイミング</span>
                  <div className="cb-btn-group">
                    {TRIGGER_OPTIONS.map(t => (
                      <button
                        key={t.value}
                        type="button"
                        className={`cb-seg ${trigger === t.value ? 'active' : ''}`}
                        onClick={() => handleTriggerChange(t.value)}
                      >
                        {t.ja}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="cb-ability-row">
                  <span className="cb-sub-label">効果</span>
                  <div className="cb-btn-group">
                    {availableEffects.map(e => (
                      <button
                        key={e.value}
                        type="button"
                        className={`cb-seg ${effect === e.value ? 'active' : ''}`}
                        onClick={() => setEffect(e.value)}
                      >
                        {e.ja}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          <button
            type="button"
            className="btn btn-primary cb-add-btn"
            disabled={!name.trim() || cards.length >= maxCards}
            onClick={handleAdd}
          >
            ＋ カードを追加 ({cards.length}/{maxCards})
          </button>
        </div>

        {/* ── RIGHT: preview ── */}
        <div className="cb-preview">
          <div className="cb-preview-label">プレビュー</div>
          <div className="cb-preview-card">
            <div className="cb-card-power">{preview.power}</div>
            <div className="cb-card-name">{preview.name}</div>
            <div className="cb-card-art">🃏</div>
            {preview.keywords.length > 0 && (
              <div className="cb-card-kws">
                {preview.keywords.map(k => (
                  <span key={k} className="kw-badge" style={{ background: KW_COLORS[k] }}>
                    {KW_INFO.find(x => x.value === k)?.ja}
                  </span>
                ))}
              </div>
            )}
            {preview.ability && (
              <div className="cb-card-ability">{preview.ability.description}</div>
            )}
          </div>
        </div>
      </div>

      {/* ── Created cards list ── */}
      {cards.length > 0 && (
        <div className="cb-created">
          <div className="cb-created-label">作成したカード ({cards.length}枚)</div>
          <div className="cb-created-list">
            {cards.map(c => (
              <div key={c.id} className="cb-created-item">
                <MiniCard card={c} />
                <button
                  type="button"
                  className="cb-remove-btn"
                  onClick={() => onRemove(c.id)}
                  title="削除"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
