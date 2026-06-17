export function MetricStrip({
  items,
}: {
  items: Array<{ label: string; value: string; note: string; tone?: 'ok' | 'warn' | 'danger' | 'info' }>
}) {
  return (
    <section className="co-metric-strip">
      {items.map((item) => (
        <article className={`co-metric ${item.tone ?? ''}`} key={item.label}>
          <span>{item.label}</span>
          <strong>{item.value}</strong>
          <p>{item.note}</p>
        </article>
      ))}
    </section>
  )
}

export function StarsRevenueCard({ stars, revenue }: { stars: number; revenue: string }) {
  return (
    <section className="co-stars-card">
      <div>
        <span className="co-overline">Stars revenue</span>
        <strong>{stars.toLocaleString()} XTR</strong>
        <p>{revenue} equivalent this month</p>
      </div>
      <span className="co-stars-orb">XTR</span>
    </section>
  )
}
