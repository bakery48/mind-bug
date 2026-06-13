interface GameLogProps {
  lastEvent: string;
}

export default function GameLog({ lastEvent }: GameLogProps) {
  return (
    <div className="game-log">
      <span style={{ color: 'var(--text-accent)', fontFamily: 'Cinzel, serif', fontSize: '0.7rem', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
        Last Event:
      </span>
      {' '}
      {lastEvent}
    </div>
  );
}
