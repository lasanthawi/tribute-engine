import { useEffect, useState } from 'react'
import { haptic } from '@/lib/telegram-webapp'
import { RowIcon } from '@/components/icons'

export function AppFrame({
  children,
  hideBack,
  onBack,
  rightLabel,
  onRightAction,
  onProfile,
  onGuide,
  onMore,
}: {
  children: React.ReactNode
  hideBack?: boolean
  onBack?: () => void
  rightLabel?: string
  onRightAction?: () => void
  onProfile?: () => void
  onGuide?: () => void
  onMore?: () => void
}) {
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 2)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <main className="tg-app">
      <header className={`tg-topbar${scrolled ? ' is-scrolled' : ''}`}>
        {!hideBack && (
          <button className="tg-nav-button" type="button" onClick={onBack} aria-label="Back">
            Back
          </button>
        )}
        {(onProfile || onGuide || onMore) && (
          <div className="tg-topbar-actions">
            {onGuide && (
              <button
                className="tg-topbar-icon-button"
                type="button"
                onClick={() => { haptic('light'); onGuide() }}
                aria-label="Guide"
              >
                <RowIcon name="guide" />
              </button>
            )}
            {onProfile && (
              <button
                className="tg-topbar-icon-button"
                type="button"
                onClick={() => { haptic('light'); onProfile() }}
                aria-label="Profile"
              >
                <RowIcon name="member" />
              </button>
            )}
            {onMore && (
              <button
                className="tg-topbar-icon-button"
                type="button"
                onClick={() => { haptic('light'); onMore() }}
                aria-label="More"
              >
                <RowIcon name="more" />
              </button>
            )}
          </div>
        )}
        {rightLabel && onRightAction && (
          <button className="tg-nav-button tg-nav-button-right" type="button" onClick={onRightAction}>
            {rightLabel}
          </button>
        )}
      </header>
      {children}
    </main>
  )
}
