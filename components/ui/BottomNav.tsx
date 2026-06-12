import Link from 'next/link'
import { useRouter } from 'next/router'

const TABS = [
  { href: '/', icon: '🏠', label: 'Home' },
  { href: '/calls', icon: '🗳️', label: 'My Votes' },
  { href: '/leaderboard', icon: '🏆', label: 'League' },
  { href: '/invite', icon: '🔗', label: 'Invite' },
]

export default function BottomNav() {
  const router = useRouter()

  return (
    <nav className="bottom-nav">
      <div className="bottom-nav-inner">
        {TABS.map((tab) => {
          const active = router.pathname === tab.href
          return (
            <Link key={tab.href} href={tab.href} className={`nav-item ${active ? 'active' : ''}`}>
              <span className="nav-icon">{tab.icon}</span>
              <span>{tab.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
