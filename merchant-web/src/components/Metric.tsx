export function Metric({
  label,
  value,
  note,
  icon,
  accent = false,
}: {
  label: string;
  value: string;
  note: string;
  icon: string;
  accent?: boolean;
}) {
  return (
    <article className={`metric-card ${accent ? 'metric-accent' : ''}`}>
      <div className="metric-top"><span>{label}</span><i aria-hidden="true">{icon}</i></div>
      <strong>{value}</strong>
      <p>{note}</p>
    </article>
  );
}
