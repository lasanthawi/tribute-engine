import { useState } from 'react'
import { QuestDto } from '@/lib/api-client'
import { haptic, hapticNotify } from '@/lib/telegram-webapp'
import Confetti from './Confetti'

const PERK_LABEL: Record<string, string> = {
  confidence_boost: 'Confidence Boost',
  streak_freeze: 'Streak Freeze',
}

const PERK_ICON: Record<string, string> = {
  confidence_boost: '⚡',
  streak_freeze: '❄️',
}

function rewardChip(
  rewardType: QuestDto['rewardType'],
  rewardAmount: number,
  rewardPerkType: QuestDto['rewardPerkType']
): { icon: string; label: string } | null {
  switch (rewardType) {
    case 'points':
      return { icon: '⭐', label: `+${rewardAmount}` }
    case 'coins':
      return { icon: '🪙', label: `+${rewardAmount}` }
    case 'tickets':
      return { icon: '🎟️', label: `+${rewardAmount}` }
    case 'perk':
      return rewardPerkType ? { icon: PERK_ICON[rewardPerkType] ?? '✨', label: PERK_LABEL[rewardPerkType] ?? 'Perk' } : null
    default:
      return null
  }
}

export default function QuestCard({
  quest,
  compact = false,
  onClaimed,
}: {
  quest: QuestDto
  compact?: boolean
  onClaimed?: () => void
}) {
  const [claiming, setClaiming] = useState(false)
  const [claimed, setClaimed] = useState(quest.claimed)
  const [confetti, setConfetti] = useState(false)

  const pct = quest.target > 0 ? Math.min(100, Math.round((quest.progress / quest.target) * 100)) : 0
  const chip1 = rewardChip(quest.rewardType, quest.rewardAmount, quest.rewardPerkType)
  const chip2 = quest.rewardType2 ? rewardChip(quest.rewardType2, quest.rewardAmount2 ?? 0, quest.rewardPerkType2) : null

  const handleClaim = async () => {
    if (claiming || claimed || !quest.completed) return
    haptic('medium')
    setClaiming(true)
    try {
      const { api } = await import('@/lib/api-client')
      await api.claimQuest(quest.id)
      hapticNotify('success')
      setClaimed(true)
      setConfetti(true)
      setTimeout(() => setConfetti(false), 1400)
      onClaimed?.()
    } catch {
      hapticNotify('error')
    } finally {
      setClaiming(false)
    }
  }

  return (
    <div className={`quest-card ${compact ? 'compact' : ''} ${claimed ? 'claimed' : ''}`}>
      {confetti && <Confetti />}
      <div className="quest-card-head">
        <span className="quest-card-type">{quest.type === 'daily' ? 'Daily' : 'Weekly'}</span>
        <div className="quest-card-rewards">
          {chip1 && (
            <span className="quest-reward-chip">
              {chip1.icon} {chip1.label}
            </span>
          )}
          {chip2 && (
            <span className="quest-reward-chip">
              {chip2.icon} {chip2.label}
            </span>
          )}
        </div>
      </div>
      <div className="quest-card-title">{quest.title}</div>
      {!compact && <div className="quest-card-desc">{quest.description}</div>}
      <div className="quest-progress-track">
        <div className="quest-progress-fill" style={{ width: `${Math.max(pct > 0 ? 4 : 0, pct)}%` }} />
      </div>
      <div className="quest-card-footer">
        <span className="quest-progress-label">
          {quest.progress}/{quest.target}
        </span>
        {claimed ? (
          <span className="quest-claimed-label">✅ Claimed</span>
        ) : quest.completed ? (
          <button className="quest-claim-btn" onClick={handleClaim} disabled={claiming}>
            {claiming ? '...' : 'Claim'}
          </button>
        ) : (
          <span className="quest-progress-pct">{pct}%</span>
        )}
      </div>
    </div>
  )
}
