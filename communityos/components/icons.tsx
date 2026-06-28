export type IconName =
  | 'membership'
  | 'product'
  | 'event'
  | 'referral'
  | 'ai'
  | 'stars'
  | 'access'
  | 'growth'
  | 'rewards'
  | 'settings'
  | 'share'
  | 'delete'
  | 'comment'
  | 'autopost'
  | 'subscription'
  | 'channel'
  | 'group'
  | 'business'
  | 'bot'
  | 'member'
  | 'edit'
  | 'copy'
  | 'more'
  | 'guide'

const ICON_SVG_PROPS = {
  viewBox: '0 0 24 24',
  fill: 'none' as const,
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

export function RowIcon({ name }: { name: IconName }) {
  switch (name) {
    case 'membership':
      return (
        <svg {...ICON_SVG_PROPS}>
          <rect x="2.5" y="5.5" width="19" height="13" rx="2.5" />
          <path d="M2.5 10h19" />
          <path d="M6 14.5h5" />
        </svg>
      )
    case 'product':
      return (
        <svg {...ICON_SVG_PROPS}>
          <path d="M21 7.5v9l-9 5-9-5v-9l9-5 9 5z" />
          <path d="M3 7.5l9 5 9-5" />
          <path d="M12 12.5V21.5" />
        </svg>
      )
    case 'event':
      return (
        <svg {...ICON_SVG_PROPS}>
          <rect x="3.5" y="5" width="17" height="16" rx="2.5" />
          <path d="M8 3v4M16 3v4M3.5 9.5h17" />
          <circle cx="12" cy="14.5" r="1.2" fill="currentColor" stroke="none" />
        </svg>
      )
    case 'referral':
      return (
        <svg {...ICON_SVG_PROPS}>
          <circle cx="18" cy="5" r="2.6" />
          <circle cx="6" cy="12" r="2.6" />
          <circle cx="18" cy="19" r="2.6" />
          <path d="M8.4 10.6l7.2-4.2M8.4 13.4l7.2 4.2" />
        </svg>
      )
    case 'ai':
      return (
        <svg {...ICON_SVG_PROPS}>
          <path d="M12 3l1.7 4.3L18 9l-4.3 1.7L12 15l-1.7-4.3L6 9l4.3-1.7L12 3z" />
          <path d="M5 16v3M3.5 17.5h3" />
        </svg>
      )
    case 'stars':
      return (
        <svg {...ICON_SVG_PROPS}>
          <path d="M12 3.5l2.6 5.3 5.9.8-4.3 4.1 1 5.8-5.2-2.8-5.2 2.8 1-5.8-4.3-4.1 5.9-.8L12 3.5z" />
        </svg>
      )
    case 'access':
      return (
        <svg {...ICON_SVG_PROPS}>
          <path d="M12 3l7 3v6c0 5-3.5 8-7 9-3.5-1-7-4-7-9V6l7-3z" />
          <path d="M9 12l2 2 4-4.5" />
        </svg>
      )
    case 'growth':
      return (
        <svg {...ICON_SVG_PROPS}>
          <path d="M3 17l6-6.5 4 3.5 7-8" />
          <path d="M15 6h5v5" />
        </svg>
      )
    case 'rewards':
      return (
        <svg {...ICON_SVG_PROPS}>
          <circle cx="12" cy="8.5" r="5.2" />
          <path d="M9 13l-1.4 7.5L12 18l4.4 2.5L15 13" />
        </svg>
      )
    case 'settings':
      return (
        <svg {...ICON_SVG_PROPS}>
          <path d="M4 7h7M15 7h5" />
          <circle cx="13" cy="7" r="1.8" fill="currentColor" stroke="none" />
          <path d="M4 12h3M11 12h9" />
          <circle cx="9" cy="12" r="1.8" fill="currentColor" stroke="none" />
          <path d="M4 17h10M18 17h2" />
          <circle cx="16" cy="17" r="1.8" fill="currentColor" stroke="none" />
        </svg>
      )
    case 'share':
      return (
        <svg {...ICON_SVG_PROPS}>
          <path d="M21 3L10.5 13.5" />
          <path d="M21 3L14 21l-3.5-7.5L3 10 21 3z" />
        </svg>
      )
    case 'delete':
      return (
        <svg {...ICON_SVG_PROPS}>
          <path d="M4 6.5h16" />
          <path d="M18 6.5l-.8 13a2 2 0 01-2 1.9H8.8a2 2 0 01-2-1.9l-.8-13" />
          <path d="M9.5 6.5V4.8a1.3 1.3 0 011.3-1.3h2.4a1.3 1.3 0 011.3 1.3v1.7" />
          <path d="M10.3 10.5v6.5M13.7 10.5v6.5" />
        </svg>
      )
    case 'comment':
      return (
        <svg {...ICON_SVG_PROPS}>
          <path d="M21 11.5a8.4 8.4 0 01-1.2 4.4 8.5 8.5 0 01-7.3 4.1 8.4 8.4 0 01-4.4-1.2L3 21l2.2-5.1A8.4 8.4 0 014 11.5 8.5 8.5 0 0112.5 3a8.5 8.5 0 018.5 8.5z" />
        </svg>
      )
    case 'autopost':
      return (
        <svg {...ICON_SVG_PROPS}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3.5 2" />
        </svg>
      )
    case 'subscription':
      return (
        <svg {...ICON_SVG_PROPS}>
          <path d="M17 2l4 4-4 4" />
          <path d="M3 11v-1a4 4 0 014-4h14" />
          <path d="M7 22l-4-4 4-4" />
          <path d="M21 13v1a4 4 0 01-4 4H3" />
        </svg>
      )
    case 'channel':
      return (
        <svg {...ICON_SVG_PROPS}>
          <path d="M3 10.5l16-5v13l-16-5v-3z" />
          <path d="M10.5 15.5a3 3 0 105.5-1.6" />
        </svg>
      )
    case 'group':
      return (
        <svg {...ICON_SVG_PROPS}>
          <circle cx="9" cy="8" r="3.3" />
          <path d="M3.5 19.5a5.7 5.7 0 0111 0" />
          <path d="M15.5 8.3a3.3 3.3 0 010 6.4" />
          <path d="M16 14.7a5.6 5.6 0 014.5 4.8" />
        </svg>
      )
    case 'business':
      return (
        <svg {...ICON_SVG_PROPS}>
          <path d="M5 21V5.2a1 1 0 011-1h7.4a1 1 0 011 1V21" />
          <path d="M14.4 9.5H19a1 1 0 011 1V21" />
          <path d="M3 21h18" />
          <path d="M8.5 8h1M8.5 11.5h1M8.5 15h1" />
        </svg>
      )
    case 'bot':
      return (
        <svg {...ICON_SVG_PROPS}>
          <rect x="4.5" y="8.5" width="15" height="11" rx="2.5" />
          <path d="M12 8.5V5" />
          <circle cx="12" cy="3.5" r="1" fill="currentColor" stroke="none" />
          <path d="M2.5 13.5h2M19.5 13.5h2" />
          <path d="M9 13.5v1.6M15 13.5v1.6" />
        </svg>
      )
    case 'member':
      return (
        <svg {...ICON_SVG_PROPS}>
          <circle cx="12" cy="8" r="4" />
          <path d="M4.5 20.5a7.5 7.5 0 0115 0" />
        </svg>
      )
    case 'edit':
      return (
        <svg {...ICON_SVG_PROPS}>
          <path d="M12 20h8" />
          <path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
        </svg>
      )
    case 'copy':
      return (
        <svg {...ICON_SVG_PROPS}>
          <rect x="9" y="9" width="12" height="12" rx="2.2" />
          <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
        </svg>
      )
    case 'more':
      return (
        <svg {...ICON_SVG_PROPS}>
          <circle cx="5" cy="12" r="1.3" fill="currentColor" stroke="none" />
          <circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none" />
          <circle cx="19" cy="12" r="1.3" fill="currentColor" stroke="none" />
        </svg>
      )
    case 'guide':
      return (
        <svg {...ICON_SVG_PROPS}>
          <circle cx="12" cy="12" r="9" />
          <path d="M9.6 9.4a2.4 2.4 0 114 1.8c-1 .9-1.6 1.5-1.6 2.7" />
          <circle cx="12" cy="17.2" r="1" fill="currentColor" stroke="none" />
        </svg>
      )
    default:
      return null
  }
}
