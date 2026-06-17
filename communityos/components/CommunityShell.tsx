import { ReactNode } from 'react'
import { CommunitySummaryDto } from '@/lib/api-client'

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

export default function CommunityShell({
  community,
  label,
  right,
  children,
}: {
  community: CommunitySummaryDto
  label: string
  right?: ReactNode
  children: ReactNode
}) {
  return (
    <main className="co-shell">
      <header className="co-topbar">
        <div className="co-community-chip">
          <span className="co-avatar">{initials(community.name)}</span>
          <div>
            <span>{label}</span>
            <strong>{community.name}</strong>
          </div>
        </div>
        {right}
      </header>
      {children}
    </main>
  )
}
