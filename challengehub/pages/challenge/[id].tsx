import { useEffect, useState } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import BottomNav from '@/components/ui/BottomNav'
import TaskItem from '@/components/ui/TaskItem'
import ProgressBar from '@/components/ui/ProgressBar'
import CategoryBadge from '@/components/ui/CategoryBadge'
import { getCategoryMeta } from '@/lib/categories'
import { api, ChallengeDto, TaskDto } from '@/lib/api-client'
import { haptic, hapticNotify } from '@/lib/telegram-webapp'

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function ChallengeDetail() {
  const router = useRouter()
  const { id } = router.query

  const [challenge, setChallenge] = useState<ChallengeDto | null>(null)
  const [tasks, setTasks] = useState<TaskDto[] | null>(null)
  const [joining, setJoining] = useState(false)
  const [activeTask, setActiveTask] = useState<TaskDto | null>(null)
  const [evidence, setEvidence] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = () => {
    if (!id) return
    api
      .getChallenge(id as string)
      .then((data) => setChallenge(data.challenge))
      .catch(() => setChallenge(null))
    api
      .getChallengeTasks(id as string)
      .then((data) => setTasks(data.tasks))
      .catch(() => setTasks([]))
  }

  useEffect(() => {
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const handleJoin = async () => {
    if (!id) return
    haptic('medium')
    setJoining(true)
    try {
      await api.joinChallenge(id as string)
      hapticNotify('success')
      refresh()
    } catch {
      hapticNotify('error')
    } finally {
      setJoining(false)
    }
  }

  const handleSubmit = async () => {
    if (!activeTask) return
    setSubmitting(true)
    setError(null)
    try {
      await api.submitTask(activeTask.id, { evidenceType: 'text', evidenceContent: evidence })
      hapticNotify('success')
      setActiveTask(null)
      setEvidence('')
      refresh()
    } catch (e: any) {
      hapticNotify('error')
      setError(e.message || 'Failed to submit')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <Head>
        <title>{challenge ? `${challenge.title} · ChallengeHub` : 'ChallengeHub'}</title>
      </Head>
      <div className="screen">
        <div className="topbar">
          <div className="brand">
            <a href="/" style={{ fontSize: 18 }}>
              ←
            </a>{' '}
            Challenge
          </div>
        </div>

        {challenge === null && <div className="skeleton" style={{ height: 160, marginBottom: 16 }} />}

        {challenge && (
          <div className={`detail-hero cat-${getCategoryMeta(challenge.category).className.replace('cat-', '')}-soft`}>
            <div style={{ marginBottom: 10, position: 'relative' }}>
              <CategoryBadge category={challenge.category} size={44} />
            </div>
            <h1 className="detail-title">{challenge.title}</h1>
            <p className="detail-desc">{challenge.description}</p>
            {challenge.rules && <p className="detail-desc">{challenge.rules}</p>}
            <div className="detail-meta">
              <span>📅 {formatDate(challenge.startDate)} – {formatDate(challenge.endDate)}</span>
              <span>👥 {challenge.memberCount ?? 0} joined</span>
              <span className={`challenge-status ${challenge.status}`}>{challenge.status}</span>
            </div>
          </div>
        )}

        {challenge && tasks && tasks.length > 0 && (
          <ProgressBar label="Progress" done={tasks.filter((t) => t.submission).length} total={tasks.length} />
        )}

        {challenge && !challenge.isMember && (
          <button className="btn-primary" onClick={handleJoin} disabled={joining} style={{ marginBottom: 16 }}>
            {joining ? 'Joining…' : 'Join Challenge (+10 XP)'}
          </button>
        )}

        {challenge && challenge.isMember && (
          <div className="empty-state" style={{ padding: '12px 0', fontSize: 12.5 }}>
            ✅ You're in this challenge — complete daily tasks to earn XP.
          </div>
        )}

        <div className="section-title">Daily Tasks</div>

        {tasks === null && (
          <>
            <div className="skeleton" style={{ height: 60, marginBottom: 10 }} />
            <div className="skeleton" style={{ height: 60, marginBottom: 10 }} />
          </>
        )}

        {tasks !== null && tasks.length === 0 && (
          <div className="empty-state">
            <div className="empty-emoji">📋</div>
            No tasks have been added to this challenge yet.
          </div>
        )}

        {tasks?.map((task) => (
          <TaskItem
            key={task.id}
            task={task}
            category={challenge?.category}
            onSelect={(t) => {
              if (!challenge?.isMember) return
              haptic('light')
              setActiveTask(t)
              setEvidence('')
              setError(null)
            }}
          />
        ))}

        {activeTask && (
          <div className="checkin-form card-in">
            <div className="task-item-title" style={{ marginBottom: 8 }}>
              Check in: {activeTask.title}
            </div>
            <textarea
              className="checkin-textarea"
              placeholder="Describe what you did today (optional)…"
              value={evidence}
              onChange={(e) => setEvidence(e.target.value)}
            />
            {error && <div style={{ color: 'var(--error)', fontSize: 12, marginBottom: 8 }}>{error}</div>}
            <button className="btn-primary" onClick={handleSubmit} disabled={submitting} style={{ marginBottom: 8 }}>
              {submitting ? 'Submitting…' : `Submit Check-in (+${activeTask.xpReward} XP)`}
            </button>
            <button className="btn-ghost" onClick={() => setActiveTask(null)}>
              Cancel
            </button>
          </div>
        )}
      </div>
      <BottomNav />
    </>
  )
}
