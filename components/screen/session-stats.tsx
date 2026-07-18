type SessionStatsProps = {
  probes: number;
  held: number;
  coverage: number;
  patches: number;
};

export function SessionStats({ probes, held, coverage, patches }: SessionStatsProps) {
  return (
    <section className="panel rail-block" id="runs" aria-label="Session stats">
      <div className="panel-header">
        <h2>Session</h2>
      </div>
      <div className="stats-row">
        <div className="stat">
          <span>Probes</span>
          <strong>{probes}</strong>
        </div>
        <div className="stat">
          <span>Held</span>
          <strong>{held}</strong>
        </div>
        <div className="stat">
          <span>Coverage</span>
          <strong>{coverage}</strong>
        </div>
        <div className="stat">
          <span>Patches</span>
          <strong>{patches}</strong>
        </div>
      </div>
    </section>
  );
}
