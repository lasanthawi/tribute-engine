import { useEffect, useMemo } from 'react'

export default function XpToast({
  xp,
  leveledUp,
  newLevel,
  isCatchup,
  onDone,
}: {
  xp: number
  leveledUp: boolean
  newLevel: number
  isCatchup?: boolean
  onDone: () => void
}) {
  useEffect(() => {
    const t = setTimeout(onDone, 2200)
    return () => clearTimeout(t)
  }, [onDone])

  const confetti = useMemo(
    () =>
      Array.from({ length: 14 }, () => ({
        left: Math.random() * 100,
        delay: Math.random() * 0.3,
        emoji: ['🎉', '✨', '⭐', '🎊'][Math.floor(Math.random() * 4)],
      })),
    []
  )

  return (
    <div className="xp-toast-overlay">
      <div className="xp-toast">
        <div className="xp-toast-value">+{xp} XP</div>
        {isCatchup && <div className="xp-toast-sub">Catch-up complete 💪</div>}
        {leveledUp && <div className="xp-toast-levelup">🎉 Level {newLevel}!</div>}
      </div>
      {leveledUp &&
        confetti.map((c, i) => (
          <span key={i} className="xp-confetti" style={{ left: `${c.left}%`, animationDelay: `${c.delay}s` }}>
            {c.emoji}
          </span>
        ))}
    </div>
  )
}
