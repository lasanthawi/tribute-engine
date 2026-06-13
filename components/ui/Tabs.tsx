import type { CSSProperties } from 'react'
import { haptic } from '@/lib/telegram-webapp'

export interface TabDef {
  key: string
  label: string
}

/** Pill tab bar with a sliding active indicator. */
export default function Tabs({
  tabs,
  active,
  onChange,
}: {
  tabs: TabDef[]
  active: string
  onChange: (key: string) => void
}) {
  const idx = Math.max(0, tabs.findIndex((t) => t.key === active))

  return (
    <div className="tab-row" style={{ '--tab-count': tabs.length } as CSSProperties}>
      <div
        className="tab-indicator"
        style={{
          width: `calc(${100 / tabs.length}% - 4px)`,
          transform: `translateX(${idx * 100}%)`,
        }}
      />
      {tabs.map((t) => (
        <button
          key={t.key}
          className={`tab-btn ${t.key === active ? 'active' : ''}`}
          onClick={() => {
            if (t.key !== active) {
              haptic('light')
              onChange(t.key)
            }
          }}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}
