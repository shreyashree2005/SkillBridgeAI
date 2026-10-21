import { Badge, Chips, ScoreRing } from './ui';
import { titleCase } from '../lib/format';

const LABELS = { required: 'Required skills', nice_to_have: 'Nice-to-have skills', experience: 'Experience', similarity: 'Text similarity' };

export default function MatchResult({ match }) {
  return (
    <div className="stack">
      <div className="row" style={{ gap: 16 }}>
        <ScoreRing score={match.score} label="Match score" />
        <div>
          <h3>{match.label}</h3>
          <p className="subtle">{match.method}</p>
        </div>
      </div>
      <div className="stack" style={{ gap: 6 }}>
        {match.breakdown.map((b) => (
          <div key={b.criterion} className="row-between panel" style={{ padding: '8px 12px' }}>
            <span>{LABELS[b.criterion] || titleCase(b.criterion)} <span className="subtle">· {b.detail}</span></span>
            <span className="tnum"><strong>{b.score}</strong> / {b.max}</span>
          </div>
        ))}
      </div>
      <div className="grid-2">
        <div><div className="label" style={{ marginBottom: 6 }}>Required — you have</div>
          <Chips items={[...match.matched_required, ...match.inferred_required.map((s) => `${s} (inferred)`)]} tone="match" empty="None yet" /></div>
        <div><div className="label" style={{ marginBottom: 6 }}>Required — missing</div><Chips items={match.missing_required} tone="missing" empty="Nothing missing 🎉" /></div>
        <div><div className="label" style={{ marginBottom: 6 }}>Nice to have — you have</div><Chips items={match.matched_nice_to_have} tone="match" /></div>
        <div><div className="label" style={{ marginBottom: 6 }}>Nice to have — missing</div><Chips items={match.missing_nice_to_have} /></div>
      </div>
      {match.suggestions.length > 0 && (
        <div className="alert alert-info" style={{ display: 'block' }}>
          <strong>How to improve</strong>
          <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>{match.suggestions.map((s) => <li key={s}>{s}</li>)}</ul>
        </div>
      )}
      {match.inferred_required.length > 0 && <Badge>“Inferred” = implied by a more advanced skill you listed (e.g. PostgreSQL ⇒ SQL)</Badge>}
    </div>
  );
}
