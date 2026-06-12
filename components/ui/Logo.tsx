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
        <linearGradient id="vl-logo-grad" x1="0" y1="0" x2="40" y2="40">
          <stop offset="0%" stopColor="#6c5ce7" />
          <stop offset="55%" stopColor="#21d07a" />
          <stop offset="100%" stopColor="#ffc94d" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="11" fill="url(#vl-logo-grad)" />
      <path
        d="M11 21 L18 28 L29 13"
        stroke="#0a0e17"
        strokeWidth="4.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  )
}
