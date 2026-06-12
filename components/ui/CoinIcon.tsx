export default function CoinIcon({ asset, size = 36 }: { asset: 'BTC' | 'ETH' | 'TON'; size?: number }) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 32 32',
    xmlns: 'http://www.w3.org/2000/svg',
    'aria-hidden': true as const,
  }

  if (asset === 'BTC') {
    return (
      <svg {...common}>
        <circle cx="16" cy="16" r="16" fill="#F7931A" />
        <path
          fill="#fff"
          d="M22.5 14.3c.3-2.2-1.3-3.4-3.6-4.2l.7-2.9-1.8-.4-.7 2.8c-.5-.1-1-.2-1.5-.3l.7-2.8-1.8-.4-.7 2.9c-.4-.1-.8-.2-1.2-.3l-2.5-.6-.5 1.9s1.3.3 1.3.3c.7.2.8.6.8 1l-1.9 7.5c-.1.2-.3.5-.7.4 0 0-1.3-.3-1.3-.3l-.9 2 2.4.6c.4.1.9.2 1.3.3l-.7 2.9 1.8.4.7-2.9c.5.1 1 .3 1.5.4l-.7 2.9 1.8.4.7-2.9c3.1.6 5.5.4 6.5-2.4.8-2.3 0-3.6-1.7-4.5 1.2-.3 2.1-1.1 2.4-2.7zm-4.2 5.9c-.6 2.3-4.5 1.1-5.8.8l1-4.2c1.3.3 5.4 1 4.8 3.4zm.6-5.9c-.5 2.1-3.8 1-4.9.8l1-3.8c1.1.3 4.4.9 3.9 3z"
        />
      </svg>
    )
  }

  if (asset === 'ETH') {
    return (
      <svg {...common}>
        <circle cx="16" cy="16" r="16" fill="#627EEA" />
        <path fill="#fff" fillOpacity="0.6" d="M16.5 4v8.4l7.5 3.4z" />
        <path fill="#fff" d="M16.5 4 9 15.8l7.5-3.4z" />
        <path fill="#fff" fillOpacity="0.6" d="M16.5 21.9V28l7.5-10.6z" />
        <path fill="#fff" d="M16.5 28v-6.1L9 17.4z" />
        <path fill="#fff" fillOpacity="0.2" d="M16.5 20.6 24 16.2l-7.5-3.4z" />
        <path fill="#fff" fillOpacity="0.6" d="M9 16.2l7.5 4.4v-7.8z" />
      </svg>
    )
  }

  return (
    <svg {...common}>
      <circle cx="16" cy="16" r="16" fill="#0098EA" />
      <path
        fill="#fff"
        d="M21.6 9.6H10.4c-1.9 0-3.1 2.1-2.1 3.7l6.4 10.3c.6 1 2.1 1 2.7 0l6.4-10.3c1-1.6-.1-3.7-2.2-3.7zM15 21.2 9.2 12c-.3-.5.1-1.2.7-1.2H15v10.4zm6.8-9.2-5.8 9.2V10.8h5.1c.6 0 1 .7.7 1.2z"
      />
    </svg>
  )
}
