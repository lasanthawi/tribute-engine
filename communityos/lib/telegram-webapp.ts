export interface TelegramWebApp {
  initData?: string
  initDataUnsafe?: { start_param?: string }
  ready?: () => void
  expand?: () => void
  openTelegramLink?: (url: string) => void
  openLink?: (url: string) => void
  openInvoice?: (url: string, callback?: (status: string) => void) => void
  setHeaderColor?: (color: string) => void
  setBackgroundColor?: (color: string) => void
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

export function getStartParam(): string {
  return getTelegramWebApp()?.initDataUnsafe?.start_param ?? ''
}

// Matches --tg-bg in globals.css. The app is light-theme-only, so a fixed hex
// (rather than Telegram's theme-relative 'bg_color' keyword) keeps Telegram's
// native chrome bar the same color as this app's own header in every client theme.
const APP_BG_COLOR = '#efeff4'

export function initTelegramShell() {
  const tg = getTelegramWebApp()
  tg?.ready?.()
  tg?.expand?.()
  tg?.setHeaderColor?.(APP_BG_COLOR)
  tg?.setBackgroundColor?.(APP_BG_COLOR)
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
