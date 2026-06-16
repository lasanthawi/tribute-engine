export interface TelegramWebApp {
  initData?: string
  initDataUnsafe?: { start_param?: string }
  ready?: () => void
  expand?: () => void
  HapticFeedback?: {
    impactOccurred?: (style: 'light' | 'medium' | 'heavy') => void
    notificationOccurred?: (type: 'success' | 'warning' | 'error') => void
  }
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp }
  }
}

export function getTelegramWebApp(): TelegramWebApp | null {
  if (typeof window === 'undefined') return null
  return window.Telegram?.WebApp ?? null
}

export function getInitData(): string {
  return getTelegramWebApp()?.initData ?? ''
}

export function initTelegramShell() {
  const tg = getTelegramWebApp()
  tg?.ready?.()
  tg?.expand?.()
}

export function haptic(style: 'light' | 'medium' | 'heavy' = 'light') {
  getTelegramWebApp()?.HapticFeedback?.impactOccurred?.(style)
}

export function hapticNotify(type: 'success' | 'warning' | 'error') {
  getTelegramWebApp()?.HapticFeedback?.notificationOccurred?.(type)
}
