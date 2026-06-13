import { useEffect, useState } from 'react'
import Head from 'next/head'
import BottomNav from '@/components/ui/BottomNav'
import QuestCard from '@/components/ui/QuestCard'
import { api, QuestDto } from '@/lib/api-client'

export default function Quests() {
  const [quests, setQuests] = useState<QuestDto[] | null>(null)

  const refresh = async () => {
    try {
      const data = await api.getQuests()
      setQuests(data.quests)
    } catch {
      setQuests([])
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  const daily = (quests ?? []).filter((q) => q.type === 'daily')
  const weekly = (quests ?? []).filter((q) => q.type === 'weekly')

  return (
    <>
      <Head>
        <title>Quests · VOTE LEAGUE</title>
      </Head>
      <div className="screen">
        <div className="topbar">
          <div className="brand">
            <span className="brand-wordmark">🎯 Quests</span>
          </div>
        </div>

        {quests === null && (
          <>
            <div className="skeleton" style={{ height: 100, marginBottom: 12 }} />
            <div className="skeleton" style={{ height: 100, marginBottom: 12 }} />
          </>
        )}

        {daily.length > 0 && (
          <>
            <div className="section-title">☀️ Daily Quests</div>
            {daily.map((q) => (
              <div key={q.id} className="card-in" style={{ marginBottom: 10 }}>
                <QuestCard quest={q} onClaimed={refresh} />
              </div>
            ))}
          </>
        )}

        {weekly.length > 0 && (
          <>
            <div className="section-title">📅 Weekly Quests</div>
            {weekly.map((q) => (
              <div key={q.id} className="card-in" style={{ marginBottom: 10 }}>
                <QuestCard quest={q} onClaimed={refresh} />
              </div>
            ))}
          </>
        )}

        {quests !== null && quests.length === 0 && (
          <div className="empty-state">No quests available right now.</div>
        )}
      </div>

      <BottomNav />
    </>
  )
}
