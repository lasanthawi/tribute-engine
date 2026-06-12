const COLORS = ['var(--up)', 'var(--gold)', 'var(--accent)', 'var(--ton)', 'var(--down)']

export default function Confetti() {
  const pieces = Array.from({ length: 28 })

  return (
    <div className="confetti" aria-hidden>
      {pieces.map((_, i) => (
        <span
          key={i}
          className="confetti-piece"
          style={{
            left: `${Math.random() * 100}%`,
            background: COLORS[i % COLORS.length],
            animationDelay: `${Math.random() * 0.3}s`,
            animationDuration: `${0.9 + Math.random() * 0.7}s`,
            transform: `rotate(${Math.random() * 360}deg)`,
          }}
        />
      ))}
    </div>
  )
}
