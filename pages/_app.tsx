import type { AppProps } from 'next/app'
import Head from 'next/head'
import { useEffect } from 'react'
import { initTelegramWebApp } from '@/lib/telegram-webapp'
import '@/styles/globals.css'

export default function App({ Component, pageProps }: AppProps) {
  useEffect(() => {
    const tg = initTelegramWebApp()
    tg?.setBackgroundColor?.('#0a0e17')
    tg?.setHeaderColor?.('#0a0e17')
  }, [])

  return (
    <>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
      </Head>
      <div className="bg-orbs" aria-hidden>
        <div className="orb orb-1" />
        <div className="orb orb-2" />
        <div className="orb orb-3" />
      </div>
      <Component {...pageProps} />
    </>
  )
}
