export interface TelegramWebApp {
  initData: string
  initDataUnsafe: {
    user?: {
      id: number
      username?: string
      first_name?: string
      last_name?: string
    }
    start_param?: string
  }
  themeParams: Record<string, string>
  colorScheme: 'light' | 'dark'
  ready: () => void
  expand: () => void
  enableClosingConfirmation?: () => void
  setHeaderColor?: (color: string) => void
  setBackgroundColor?: (color: string) => void
  HapticFeedback?: {
    impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void
    notificationOccurred: (type: 'error' | 'success' | 'warning') => void
  }
  MainButton: {
    text: string
    show: () => void
    hide: () => void
    onClick: (cb: () => void) => void
    offClick: (cb: () => void) => void
    setText: (text: string) => void
    enable: () => void
    disable: () => void
  }
  BackButton: {
    show: () => void
    hide: () => void
    onClick: (cb: () => void) => void
    offClick: (cb: () => void) => void
  }
  openTelegramLink?: (url: string) => void
  openLink?: (url: string, options?: { try_instant_view?: boolean }) => void
  switchInlineQuery?: (query: string, types?: string[]) => void
  openInvoice?: (url: string, callback: (status: 'paid' | 'cancelled' | 'failed' | 'pending') => void) => void
}

declare global {
  interface Window {
    Telegram?: {
      WebApp: TelegramWebApp
    }
  }
}

export function getTelegramWebApp(): TelegramWebApp | null {
  if (typeof window === 'undefined') return null
  return window.Telegram?.WebApp ?? null
}

export function initTelegramWebApp(): TelegramWebApp | null {
  const tg = getTelegramWebApp()
  if (!tg) return null
  tg.ready()
  tg.expand()
  return tg
}

export function haptic(style: 'light' | 'medium' | 'heavy' = 'light') {
  getTelegramWebApp()?.HapticFeedback?.impactOccurred(style)
}

export function hapticNotify(type: 'error' | 'success' | 'warning') {
  getTelegramWebApp()?.HapticFeedback?.notificationOccurred(type)
}

export function getInitData(): string {
  return getTelegramWebApp()?.initData ?? ''
}

/** Opens an external URL via Telegram's link handler, falling back to window.open. */
export function openExternalLink(url: string): void {
  const tg = getTelegramWebApp()
  if (tg?.openLink) {
    tg.openLink(url)
  } else if (typeof window !== 'undefined') {
    window.open(url, '_blank', 'noopener,noreferrer')
  }
}

/** Opens a Telegram Stars invoice; resolves with the final payment status. */
export function openInvoice(url: string): Promise<'paid' | 'cancelled' | 'failed' | 'pending'> {
  return new Promise((resolve) => {
    const tg = getTelegramWebApp()
    if (!tg?.openInvoice) {
      resolve('failed')
      return
    }
    tg.openInvoice(url, (status) => resolve(status))
  })
}
