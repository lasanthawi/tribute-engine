import { DashboardDto } from '@/lib/api-client'
import { initials } from '@/lib/format'
import { RevenueModel, Screen, introSlides } from '@/lib/screens'
import { EmptyBlock, FixedButton, ListGroup, ListRow, StoryArt } from '@/components/ListPrimitives'

export function IntroScreen({ index, onBack, onNext }: { index: number; onBack?: () => void; onNext: () => void }) {
  const slide = introSlides[index]
  return (
    <main className="tg-story">
      <header className="tg-story-topbar">
        {onBack && (
          <button type="button" onClick={onBack}>
            Back
          </button>
        )}
      </header>
      <div className="tg-progress-bars" aria-label={`Slide ${index + 1} of ${introSlides.length}`}>
        {introSlides.map((item, itemIndex) => (
          <span key={item.title} className={itemIndex <= index ? 'active' : ''} />
        ))}
      </div>
      <section className="tg-story-content">
        <h1>{slide.title}</h1>
        <p>{slide.text}</p>
        <StoryArt label={slide.title} icon={slide.icon} />
      </section>
      <footer className="tg-story-footer">
        <button type="button" onClick={onNext}>
          {index === introSlides.length - 1 ? 'Start' : 'Next'}
        </button>
      </footer>
    </main>
  )
}

export function StartPicker({ onSelect, onSelectModel }: { onSelect: (screen: Screen) => void; onSelectModel: (model: RevenueModel) => void }) {
  return (
    <section className="tg-screen centered">
      <div className="tg-hero-mark">CO</div>
      <h1>Where would you like to start?</h1>
      <p className="tg-subtitle">Pick the first thing you want to launch. You can add other formats later.</p>
      <ListGroup>
        <ListRow tone="blue" icon="membership" title="Paid Membership" detail="Sell access to a private group or channel." onClick={() => onSelectModel('membership')} />
        <ListRow tone="red" icon="product" title="Digital Product" detail="Sell courses, files, downloads, or guides." onClick={() => onSelectModel('product')} />
        <ListRow tone="purple" icon="event" title="Event or AMA" detail="Sell tickets or manage registrations." onClick={() => onSelectModel('event')} />
        <ListRow tone="green" icon="referral" title="Referral Rewards" detail="Reward members for inviting others." onClick={() => onSelectModel('referral')} />
        <ListRow tone="amber" icon="ai" title="AI Community Manager" detail="Automate FAQ, welcome messages, and reports." onClick={() => onSelectModel('ai')} />
      </ListGroup>
      <button className="tg-link-button" type="button" onClick={() => onSelect('communities')}>
        I will choose later
      </button>
    </section>
  )
}

export function CommunityPicker({
  communities,
  search,
  onSearch,
  onSelect,
  onAdd,
}: {
  communities: DashboardDto['community'][]
  search: string
  onSearch: (value: string) => void
  onSelect: (id: number) => void
  onAdd: () => void
}) {
  return (
    <section className="tg-screen with-fixed-button">
      <h1 className="tg-left-title">Channels and Groups</h1>
      <label className="tg-search">
        <span>Search</span>
        <input value={search} onChange={(event) => onSearch(event.target.value)} aria-label="Search communities" />
      </label>
      <ListGroup>
        {communities.map((community) => (
          <ListRow
            key={community.id}
            avatar={initials(community.name)}
            image={community.avatarUrl}
            title={community.name}
            detail={`${community.status === 'active' ? 'Active' : 'Setup'} community`}
            onClick={() => onSelect(community.id)}
          />
        ))}
        {communities.length === 0 && <EmptyBlock title="No communities found" detail="Connect a Telegram group or channel to continue." />}
      </ListGroup>
      <FixedButton label="Add" onClick={onAdd} />
    </section>
  )
}
