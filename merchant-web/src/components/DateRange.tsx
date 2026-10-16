export function DateRange({
  from,
  to,
  onFrom,
  onTo,
}: {
  from: string;
  to: string;
  onFrom: (value: string) => void;
  onTo: (value: string) => void;
}) {
  return (
    <div className="date-range">
      <span className="date-range-label"><span aria-hidden="true">◷</span> Reporting period</span>
      <label>
        <span>From</span>
        <input
          aria-label="Report start date"
          type="date"
          value={from}
          max={to || undefined}
          onChange={(event) => onFrom(event.target.value)}
        />
      </label>
      <span className="date-dash" aria-hidden="true">—</span>
      <label>
        <span>To</span>
        <input
          aria-label="Report end date"
          type="date"
          value={to}
          min={from || undefined}
          onChange={(event) => onTo(event.target.value)}
        />
      </label>
      <span className="timezone-note">East Africa Time</span>
    </div>
  );
}
