export function SkeletonTable({ rows = 5, cols = 4 }) {
  return (
    <div className="table-wrapper">
      <table>
        <tbody>
          {Array.from({ length: rows }).map((_, i) => (
            <tr key={i}>
              {Array.from({ length: cols }).map((_, j) => (
                <td key={j}>
                  <div className="skeleton skeleton-text" style={{ width: j === 0 ? '40%' : '70%' }} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function SkeletonCards({ count = 5 }) {
  return (
    <div className="card-grid">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="stat-card">
          <div className="skeleton skeleton-label" />
          <div className="skeleton skeleton-value" />
        </div>
      ))}
    </div>
  );
}
