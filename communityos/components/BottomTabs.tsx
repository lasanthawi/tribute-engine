export interface BottomTab<T extends string> {
  key: T
  label: string
  icon: string
}

export default function BottomTabs<T extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: BottomTab<T>[]
  active: T
  onChange: (key: T) => void
}) {
  return (
    <nav className="co-tabbar" aria-label="CommunityOS sections">
      {tabs.map((tab) => (
        <button key={tab.key} className={active === tab.key ? 'active' : ''} type="button" onClick={() => onChange(tab.key)}>
          <span>{tab.icon}</span>
          <strong>{tab.label}</strong>
        </button>
      ))}
    </nav>
  )
}
