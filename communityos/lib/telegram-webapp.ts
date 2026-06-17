export interface TelegramWebApp {
  initData?: string
  initDataUnsafe?: { start_param?: string }
  ready?: () => void
  expand?: () => void
  openTelegramLink?: (url: string) => void
  openLink?: (url: string) => void
  openInvoice?: (url: string, callback?: (status: string) => void) => void
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

export function openTelegramLink(url: string) {
  const tg = getTelegramWebApp()
  if (tg?.openTelegramLink) {
    tg.openTelegramLink(url)
    return true
  }
  if (typeof window !== 'undefined') {
    window.open(url, '_blank', 'noopener,noreferrer')
    return true
  }
  return false
}

export function openExternalLink(url: string) {
  const tg = getTelegramWebApp()
  if (tg?.openLink) {
    tg.openLink(url)
    return true
  }
  if (typeof window !== 'undefined') {
    window.open(url, '_blank', 'noopener,noreferrer')
    return true
  }
  return false
}

export function openInvoiceLink(url: string, callback?: (status: string) => void) {
  const tg = getTelegramWebApp()
  if (tg?.openInvoice) {
    tg.openInvoice(url, callback)
    return true
  }
  return openExternalLink(url)
}

export async function copyText(value: string) {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value)
    return true
  }
  return false
}
