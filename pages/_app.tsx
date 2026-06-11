import type { AppProps } from 'next/app'
import { useEffect } from 'react'
import { initTelegramWebApp } from '@/lib/telegram-webapp'
import '@/styles/globals.css'

export default function App({ Component, pageProps }: AppProps) {
  useEffect(() => {
    const tg = initTelegramWebApp()
    tg?.setBackgroundColor?.('#0a0e17')
    tg?.setHeaderColor?.('#0a0e17')
  }, [])

  return <Component {...pageProps} />
}
