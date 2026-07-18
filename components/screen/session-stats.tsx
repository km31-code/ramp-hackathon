type SessionStatsProps = {
  rounds: number;
  attempts: number;
  held: number;
  breaches: number;
  hardened: number;
};

export function SessionStats({ rounds, attempts, held, breaches, hardened }: SessionStatsProps) {
  return (
    <section className="panel rail-block" id="runs" aria-label="Session stats">
      <div className="panel-header">
        <h2>Session</h2>
      </div>
      <div className="stats-row">
        <div className="stat">
          <span>Rounds</span>
          <strong>{rounds}</strong>
        </div>
        <div className="stat">
          <span>Attacks</span>
          <strong>{attempts}</strong>
        </div>
        <div className="stat">
          <span>Held</span>
          <strong>{held}</strong>
        </div>
        <div className="stat">
          <span>Breaches</span>
          <strong>{breaches}</strong>
        </div>
        <div className="stat">
          <span>Hardened</span>
          <strong>{hardened}</strong>
        </div>
      </div>
    </section>
  );
}
