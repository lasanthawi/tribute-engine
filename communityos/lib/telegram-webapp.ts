export interface TelegramMainButton {
  text: string
  color?: string
  textColor?: string
  isVisible?: boolean
  isActive?: boolean
  isProgressVisible?: boolean
  setText?: (text: string) => void
  onClick?: (callback: () => void) => void
  offClick?: (callback: () => void) => void
  show?: () => void
  hide?: () => void
  enable?: () => void
  disable?: () => void
  showProgress?: (leaveActive?: boolean) => void
  hideProgress?: () => void
  setParams?: (params: { text?: string; color?: string; text_color?: string; is_active?: boolean; is_visible?: boolean }) => void
}

export interface TelegramBackButton {
  isVisible?: boolean
  show?: () => void
  hide?: () => void
  onClick?: (callback: () => void) => void
  offClick?: (callback: () => void) => void
}

export interface TelegramThemeParams {
  bg_color?: string
  text_color?: string
  hint_color?: string
  link_color?: string
  button_color?: string
  button_text_color?: string
  secondary_bg_color?: string
  header_bg_color?: string
  accent_text_color?: string
  section_bg_color?: string
  section_header_text_color?: string
  subtitle_text_color?: string
  destructive_text_color?: string
}

export type TelegramThemeChangedEvent = 'themeChanged'
export type TelegramViewportChangedEvent = 'viewportChanged'
export type TelegramWebAppEventType = TelegramThemeChangedEvent | TelegramViewportChangedEvent | 'backButtonClicked' | 'mainButtonClicked'

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
  MainButton?: TelegramMainButton
  BackButton?: TelegramBackButton
  themeParams?: TelegramThemeParams
  colorScheme?: 'light' | 'dark'
  onEvent?: (eventType: TelegramWebAppEventType, callback: (...args: any[]) => void) => void
  offEvent?: (eventType: TelegramWebAppEventType, callback: (...args: any[]) => void) => void
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

// Tracks Telegram's own background color in both light and dark client themes,
// so the native chrome bar always matches this app's header (which is themed via
// the --tg-theme-bg-color CSS var that telegram-web-app.js injects automatically).
export function initTelegramShell() {
  const tg = getTelegramWebApp()
  tg?.ready?.()
  tg?.expand?.()
  // The 'bg_color'/'secondary_bg_color' keyword form needs Bot API 6.9+; older
  // clients throw WebAppMethodUnsupported instead of no-op-ing, so guard it.
  try {
    tg?.setHeaderColor?.('bg_color')
    tg?.setBackgroundColor?.('bg_color')
  } catch {
    // Older client without keyword support — Telegram chrome simply stays default.
  }
}

let backButtonClickHandler: (() => void) | null = null

export function showBackButton(onClick: () => void) {
  const tg = getTelegramWebApp()
  const back = tg?.BackButton
  if (!back) return false
  if (backButtonClickHandler) back.offClick?.(backButtonClickHandler)
  backButtonClickHandler = onClick
  back.onClick?.(onClick)
  back.show?.()
  return true
}

export function hideBackButton() {
  const tg = getTelegramWebApp()
  const back = tg?.BackButton
  if (!back) return
  if (backButtonClickHandler) {
    back.offClick?.(backButtonClickHandler)
    backButtonClickHandler = null
  }
  back.hide?.()
}

export interface MainButtonOptions {
  text: string
  onClick: () => void
  visible?: boolean
  active?: boolean
  color?: string
  textColor?: string
}

let mainButtonClickHandler: (() => void) | null = null

export function setMainButton(opts: MainButtonOptions) {
  const tg = getTelegramWebApp()
  const main = tg?.MainButton
  if (!main) return false
  if (mainButtonClickHandler) main.offClick?.(mainButtonClickHandler)
  mainButtonClickHandler = opts.onClick
  main.onClick?.(opts.onClick)
  main.setParams?.({
    text: opts.text,
    color: opts.color,
    text_color: opts.textColor,
    is_active: opts.active ?? true,
    is_visible: opts.visible ?? true,
  })
  return true
}

export function hideMainButton() {
  const tg = getTelegramWebApp()
  const main = tg?.MainButton
  if (!main) return
  if (mainButtonClickHandler) {
    main.offClick?.(mainButtonClickHandler)
    mainButtonClickHandler = null
  }
  main.hide?.()
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
