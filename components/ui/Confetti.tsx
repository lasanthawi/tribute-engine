const COLORS = ['var(--up)', 'var(--gold)', 'var(--accent)', 'var(--ton)', 'var(--down)', '#ff9f43']
const SHAPES = ['rect', 'circle', 'ribbon'] as const

/** A soft, physics-flavoured confetti burst — varied shapes, drift and tumble. */
export default function Confetti() {
  const pieces = Array.from({ length: 32 })

  return (
    <div className="confetti" aria-hidden>
      {pieces.map((_, i) => {
        const shape = SHAPES[i % SHAPES.length]
        const size = 6 + Math.random() * 6
        const drift = Math.round((Math.random() - 0.5) * 180)
        const rotStart = Math.round(Math.random() * 360)
        const rotEnd = rotStart + 360 + Math.round(Math.random() * 360)
        const duration = (2.1 + Math.random() * 1.3).toFixed(2)
        const delay = (Math.random() * 0.35).toFixed(2)

        return (
          <span
            key={i}
            className={`confetti-piece confetti-${shape}`}
            style={
              {
                left: `${Math.random() * 100}%`,
                top: `${-20 - Math.random() * 30}px`,
                width: shape === 'ribbon' ? size * 0.4 : size,
                height: shape === 'circle' ? size : size * 1.8,
                background: COLORS[i % COLORS.length],
                '--drift': `${drift}px`,
                '--rot-start': `${rotStart}deg`,
                '--rot-end': `${rotEnd}deg`,
                animationDuration: `${duration}s`,
                animationDelay: `${delay}s`,
              } as React.CSSProperties
            }
          />
        )
      })}
    </div>
  )
}
