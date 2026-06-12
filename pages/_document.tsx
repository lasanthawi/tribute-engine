import { Html, Head, Main, NextScript } from 'next/document'

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <script src="https://telegram.org/js/telegram-web-app.js" async />
        <meta name="theme-color" content="#0a0e17" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  )
}
