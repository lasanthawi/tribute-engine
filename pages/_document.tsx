import { Html, Head, Main, NextScript } from 'next/document'

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <script src="https://telegram.org/js/telegram-web-app.js" async />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
        <meta name="theme-color" content="#0a0e17" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  )
}
