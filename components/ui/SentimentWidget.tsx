import { useEffect, useState } from 'react'
import { api, SentimentDto } from '@/lib/api-client'
import { haptic, openExternalLink } from '@/lib/telegram-webapp'

function gaugeClass(score: number): string {
  if (score <= 25) return 'extreme-fear'
  if (score <= 45) return 'fear'
  if (score <= 55) return 'neutral'
  if (score <= 75) return 'greed'
  return 'extreme-greed'
}

function relativeTime(isoString: string): string {
  const diffMs = Date.now() - new Date(isoString).getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export default function SentimentWidget() {
  const [data, setData] = useState<SentimentDto | null | undefined>(undefined)

  useEffect(() => {
    api
      .getSentiment()
      .then(setData)
      .catch(() => setData(null))
  }, [])

  if (data === undefined) return <div className="skeleton" style={{ height: 96, marginBottom: 12 }} />
  if (data === null) return null
  if (data.fearGreed === null && data.headlines.length === 0) return null

  return (
    <div className="sentiment-widget card-in">
      {data.fearGreed && (
        <div className="sentiment-gauge">
          <div className="sentiment-gauge-head">
            <span className="sentiment-gauge-title">📰 Market Mood</span>
            <span className={`sentiment-gauge-label ${gaugeClass(data.fearGreed.score)}`}>
              {data.fearGreed.label} · {data.fearGreed.score}
            </span>
          </div>
          <div className="sentiment-gauge-bar">
            <div className="sentiment-gauge-marker" style={{ left: `${data.fearGreed.score}%` }} />
          </div>
          <div className="sentiment-gauge-scale">
            <span>Extreme Fear</span>
            <span>Extreme Greed</span>
          </div>
        </div>
      )}

      {data.headlines.length > 0 && (
        <div className="sentiment-news">
          {data.headlines.slice(0, 5).map((h) => (
            <div
              key={h.id}
              className="sentiment-news-item"
              role="button"
              tabIndex={0}
              onClick={() => {
                haptic('light')
                openExternalLink(h.url)
              }}
            >
              <span className={`sentiment-news-tag ${h.sentiment}`}>
                {h.sentiment === 'positive' ? '▲' : h.sentiment === 'negative' ? '▼' : '•'}
              </span>
              <span className="sentiment-news-title">{h.title}</span>
              <span className="sentiment-news-meta">
                {h.source} · {relativeTime(h.publishedAt)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
