export default function Logo({ size = 22 }: { size?: number }) {
  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src="/logo.png"
      width={size}
      height={size}
      alt="VOTE LEAGUE"
      className="vl-logo"
    />
  )
}
