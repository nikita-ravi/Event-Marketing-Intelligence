export interface SessionStats {
  queries: number;
  eventsFound: number;
  guardrailStatus: 'pass' | 'fail' | 'pending';
  savedEvents: number;
}

interface SessionStatsProps {
  stats: SessionStats;
}

export function SessionStatsComponent({ stats }: SessionStatsProps) {
  return (
    <div className="session-stats">
      <h4 className="stats-title">SESSION STATS</h4>

      <div className="stats-grid">
        <div className="stat-box">
          <div className="stat-label">Queries</div>
          <div className="stat-value">{stats.queries}</div>
        </div>

        <div className="stat-box">
          <div className="stat-label">Events found</div>
          <div className="stat-value">{stats.eventsFound}</div>
        </div>

        <div className="stat-box">
          <div className="stat-label">Guardrail</div>
          <div className={`stat-value guardrail-${stats.guardrailStatus}`}>
            {stats.guardrailStatus === 'pass' && 'Pass'}
            {stats.guardrailStatus === 'fail' && 'Fail'}
            {stats.guardrailStatus === 'pending' && '—'}
          </div>
        </div>

        <div className="stat-box">
          <div className="stat-label">Saved</div>
          <div className="stat-value">{stats.savedEvents}</div>
        </div>
      </div>
    </div>
  );
}
