export default function Logo({ size = 22 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="vl-logo"
      aria-hidden="true"
    >
      <defs>
        <radialGradient id="vl-logo-glow" cx="50%" cy="42%" r="62%">
          <stop offset="0%" stopColor="#fff6d8" />
          <stop offset="45%" stopColor="#ffc94d" />
          <stop offset="100%" stopColor="#e07a1a" />
        </radialGradient>
        <radialGradient id="vl-logo-ring" cx="50%" cy="50%" r="50%">
          <stop offset="78%" stopColor="#ff9f43" stopOpacity="0" />
          <stop offset="100%" stopColor="#ff7a18" stopOpacity="0.55" />
        </radialGradient>
      </defs>
      <circle cx="20" cy="20" r="20" fill="url(#vl-logo-ring)" />
      <circle cx="20" cy="20" r="17.5" fill="url(#vl-logo-glow)" stroke="#a8590a" strokeWidth="1" />
      <path
        d="M13.5 12h13v3.2a6.5 6.5 0 0 1-13 0z"
        fill="#fffdf6"
      />
      <path
        d="M13.5 12.5h-2.6a3.4 3.4 0 0 0 3.4 3.4"
        fill="none"
        stroke="#fffdf6"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M26.5 12.5h2.6a3.4 3.4 0 0 1-3.4 3.4"
        fill="none"
        stroke="#fffdf6"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <rect x="18.5" y="21" width="3" height="3.5" fill="#fffdf6" />
      <rect x="15.5" y="25.5" width="9" height="2" rx="1" fill="#fffdf6" />
    </svg>
  )
}
