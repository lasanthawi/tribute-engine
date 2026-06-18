import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { FormEvent, useEffect, useMemo, useState } from 'react'
import {
  ActivityDto,
  DashboardDto,
  EventDto,
  MemberProfileDto,
  MemberRowDto,
  PlanDto,
  ProductDto,
  ReferralCampaignDto,
  RewardRuleDto,
  TelegramChatDto,
  api,
  emptyDashboardForCommunity,
  money,
} from '@/lib/api-client'
import { copyText, getInitData, haptic, initTelegramShell, openExternalLink, openInvoiceLink, openTelegramLink } from '@/lib/telegram-webapp'

type Mode = 'publisher' | 'member'
type RevenueModel = 'membership' | 'product' | 'event' | 'referral' | 'ai'
type Screen =
  | 'intro'
  | 'start'
  | 'communities'
  | 'home'
  | 'members'
  | 'access'
  | 'growth'
  | 'rewards'
  | 'more'
  | 'createDetails'
  | 'preview'
  | 'payments'
  | 'publish'
  | 'shareGuide'
  | 'productBuilder'
  | 'productPublish'
  | 'eventBuilder'
  | 'eventPublish'
  | 'referralBuilder'

const introSlides = [
  {
    title: 'Run your Telegram community like a business',
    text: 'Memberships, products, events, referrals, and access control in one Mini App.',
    art: 'CO',
  },
  {
    title: 'Sell access without manual admin work',
    text: 'Telegram Stars payments, renewal tracking, and invite links stay connected.',
    art: 'XTR',
  },
  {
    title: 'The bot manages access for you',
    text: 'Approve members, revoke expired access, and share offers directly inside Telegram.',
    art: 'BOT',
  },
]

export default function Home() {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>('publisher')
  const [screen, setScreen] = useState<Screen>('intro')
  const [introIndex, setIntroIndex] = useState(0)
  const [data, setData] = useState<DashboardDto | null>(null)
  const [memberProfile, setMemberProfile] = useState<MemberProfileDto | null>(null)
  const [ownedCommunities, setOwnedCommunities] = useState<DashboardDto['community'][]>([])
  const [communityId, setCommunityId] = useState<number | null>(null)
  const [authError, setAuthError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [pendingModel, setPendingModel] = useState<RevenueModel>('membership')
  const [membershipTitle, setMembershipTitle] = useState('Premium Circle')
  const [membershipDescription, setMembershipDescription] = useState(
    'Get private Telegram access, weekly sessions, and member-only resources.'
  )
  const [buttonText, setButtonText] = useState('Subscribe')
  const [monthlyStars, setMonthlyStars] = useState('299')
  const [yearlyStars, setYearlyStars] = useState('2990')
  const [coverPreview, setCoverPreview] = useState<string | null>(null)
  const [coverName, setCoverName] = useState<string | null>(null)
  const [createdPlan, setCreatedPlan] = useState<PlanDto | null>(null)
  const [campaignTitle, setCampaignTitle] = useState('Invite 3 members')
  const [rewardTitle, setRewardTitle] = useState('Founding Member Badge')
  const [productTitle, setProductTitle] = useState('Premium Download')
  const [productDescription, setProductDescription] = useState('A paid resource for your Telegram community.')
  const [productType, setProductType] = useState<ProductDto['type']>('download')
  const [productPriceStars, setProductPriceStars] = useState('199')
  const [productButtonText, setProductButtonText] = useState('Buy')
  const [productDeliveryType, setProductDeliveryType] = useState<ProductDto['deliveryType']>('url')
  const [productDeliveryText, setProductDeliveryText] = useState('Access instructions will appear after purchase.')
  const [productDeliveryUrl, setProductDeliveryUrl] = useState('')
  const [productCover, setProductCover] = useState<{ path: string | null; preview: string | null; name: string | null }>({ path: null, preview: null, name: null })
  const [productFile, setProductFile] = useState<{ path: string | null; name: string | null }>({ path: null, name: null })
  const [createdProduct, setCreatedProduct] = useState<ProductDto | null>(null)
  const [selectedProduct, setSelectedProduct] = useState<ProductDto | null>(null)
  const [eventTitle, setEventTitle] = useState('Live Community Session')
  const [eventDescription, setEventDescription] = useState('Join us live inside Telegram.')
  const [eventType, setEventType] = useState<EventDto['type']>('webinar')
  const [eventStartsAt, setEventStartsAt] = useState(() => new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 16))
  const [eventPriceStars, setEventPriceStars] = useState('0')
  const [eventAccessLink, setEventAccessLink] = useState('')
  const [eventCover, setEventCover] = useState<{ path: string | null; preview: string | null; name: string | null }>({ path: null, preview: null, name: null })
  const [createdEvent, setCreatedEvent] = useState<EventDto | null>(null)
  const [selectedEvent, setSelectedEvent] = useState<EventDto | null>(null)
  const [referralThreshold, setReferralThreshold] = useState('3')
  const [referralReward, setReferralReward] = useState('Unlock bonus content')

  useEffect(() => {
    if (!router.isReady) return

    let cancelled = false

    async function load() {
      initTelegramShell()
      const routeCommunityId = getRouteCommunityId(router.query.id ?? router.query.communityId)
      const isMemberRoute = router.pathname.startsWith('/member')

      try {
        if (isMemberRoute) {
          const targetId = routeCommunityId ?? 1
          const profile = await api.getMemberProfile(targetId)
          if (cancelled) return
          setMemberProfile(profile)
          setCommunityId(profile.community.id)
          setData(dashboardFromMemberProfile(profile))
          setMode('member')
          setScreen('home')
          return
        }

        const me = await api.getMe()
        if (cancelled) return
        setOwnedCommunities(me.communities)

        // New user: no communities yet, show intro without fetching a dashboard
        if (!routeCommunityId && me.communities.length === 0) {
          setMode('publisher')
          setScreen('intro')
          return
        }

        const targetId = routeCommunityId ?? me.communities[0]?.id
        if (!targetId) {
          setMode('publisher')
          setScreen('intro')
          return
        }
        const dashboard = await api.getDashboard(targetId)
        if (cancelled) return
        setCommunityId(dashboard.community.id)
        setData(normalizeDashboard(dashboard))
        setMode('publisher')
        setScreen('home')
      } catch (err: any) {
        if (cancelled) return
        const status = err?.status ?? 0
        if (status === 401 || status === 403) {
          // Empty initData → user opened outside Telegram (or SDK hasn't loaded yet)
          if (!getInitData()) {
            setAuthError('not_in_telegram')
          } else {
            // initData present but server rejected it — usually wrong/missing TELEGRAM_BOT_TOKEN
            setAuthError('auth_failed')
          }
        } else {
          setAuthError(err?.message || 'unknown_error')
        }
      }
    }

    load()

    return () => {
      cancelled = true
    }
  }, [router.isReady, router.pathname, router.query.id, router.query.communityId])

  useEffect(() => {
    if (!toast) return
    const timeout = window.setTimeout(() => setToast(null), 1800)
    return () => window.clearTimeout(timeout)
  }, [toast])

  const member = memberProfile?.member ?? data?.members[0]
  const activePlan = createdPlan ?? data?.plans[0] ?? null
  const activeProduct = selectedProduct ?? createdProduct ?? data?.products[0] ?? null
  const activeEvent = selectedEvent ?? createdEvent ?? data?.events[0] ?? null
  const nextSetupStep = data?.setup.find((step) => step.status !== 'done') ?? null
  const filteredCommunities = useMemo(() => {
    const needle = search.trim().toLowerCase()
    if (!needle) return ownedCommunities
    return ownedCommunities.filter((community) =>
      [community.name, community.handle, community.description].filter(Boolean).join(' ').toLowerCase().includes(needle)
    )
  }, [ownedCommunities, search])

  function showToast(message: string) {
    setToast(message)
  }

  function go(next: Screen) {
    haptic('light')
    setScreen(next)
  }

  async function selectCommunity(id: number) {
    try {
      const dashboard = await api.getDashboard(id)
      setCommunityId(id)
      setData(normalizeDashboard(dashboard))
      setScreen(screenForModel(pendingModel))
    } catch (error: any) {
      showToast(error.message || 'Community could not be loaded')
    }
  }

  function chooseRevenueModel(model: RevenueModel) {
    setPendingModel(model)
    if (data && communityId) {
      go(screenForModel(model))
    } else {
      go('communities')
    }
  }

  async function refreshDashboard() {
    if (!communityId) return
    const dashboard = await api.getDashboard(communityId)
    setData(normalizeDashboard(dashboard))
  }

  async function createMembership(event?: FormEvent) {
    event?.preventDefault()
    if (!data || !communityId || !membershipTitle.trim()) return
    const stars = Math.max(1, Number(monthlyStars || 0))
    const body = {
      name: membershipTitle.trim(),
      description: membershipDescription.trim(),
      priceCents: stars * 10,
      stars,
      interval: 'month',
    }

    try {
      const response = await api.createPlan(communityId, body)
      const plan = {
        ...response.plan,
        name: body.name,
        description: body.description,
        priceCents: body.priceCents,
        stars,
        interval: body.interval,
      }
      setCreatedPlan(plan)
      await refreshDashboard()
      setScreen('publish')
      showToast('Membership created')
    } catch (error: any) {
      showToast(error.message || 'Membership creation failed')
    }
  }

  function handleCoverFile(file: File | null) {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      showToast('Choose an image file')
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setCoverPreview(reader.result)
        setCoverName(file.name)
        showToast('Cover added')
      }
    }
    reader.onerror = () => showToast('Cover could not be loaded')
    reader.readAsDataURL(file)
  }

  async function uploadAssetFile(file: File | null, assetType: 'cover' | 'delivery') {
    if (!file || !communityId) return null
    const dataUrl = await readFileAsDataUrl(file)
    const { asset } = await api.uploadAsset(communityId, {
      fileName: file.name,
      mimeType: file.type || 'application/octet-stream',
      dataUrl,
      assetType,
    })
    return { asset, dataUrl }
  }

  async function handleProductCover(file: File | null) {
    try {
      const result = await uploadAssetFile(file, 'cover')
      if (!result) return
      setProductCover({ path: result.asset.path, preview: result.asset.url ?? result.dataUrl, name: result.asset.fileName })
      showToast('Product cover uploaded')
    } catch (error: any) {
      showToast(error.message || 'Upload failed')
    }
  }

  async function handleProductFile(file: File | null) {
    try {
      const result = await uploadAssetFile(file, 'delivery')
      if (!result) return
      setProductFile({ path: result.asset.path, name: result.asset.fileName })
      setProductDeliveryType('file')
      showToast('Delivery file uploaded')
    } catch (error: any) {
      showToast(error.message || 'Upload failed')
    }
  }

  async function handleEventCover(file: File | null) {
    try {
      const result = await uploadAssetFile(file, 'cover')
      if (!result) return
      setEventCover({ path: result.asset.path, preview: result.asset.url ?? result.dataUrl, name: result.asset.fileName })
      showToast('Event cover uploaded')
    } catch (error: any) {
      showToast(error.message || 'Upload failed')
    }
  }

  async function deleteMembershipPackage() {
    if (!communityId || !activePlan) {
      showToast('No membership package selected')
      return
    }
    const confirmed = window.confirm(`Delete "${activePlan.name}"? Existing subscriptions are kept, but this package will no longer be offered.`)
    if (!confirmed) return

    try {
      await api.deletePlan(communityId, activePlan.id)
      setCreatedPlan((plan) => (plan?.id === activePlan.id ? null : plan))
      await refreshDashboard()
      setScreen('home')
      showToast('Membership package deleted')
    } catch (error: any) {
      showToast(error.message || 'Delete failed')
    }
  }

  async function shareMembershipCard() {
    if (!communityId || !activePlan) {
      showToast('Create a membership first')
      return
    }

    try {
      const result = await api.sharePlanCard(communityId, { planId: activePlan.id, buttonText })
      await copyText(result.url).catch(() => false)
      showToast(result.target === 'community_chat' ? 'Subscription card sent to community' : 'Subscription card sent to bot chat')
    } catch (error: any) {
      await copyMembershipLink()
      showToast(error.message || 'Card send failed. Link copied instead')
    }
  }

  async function createProductOffer(event?: FormEvent) {
    event?.preventDefault()
    if (!communityId || !data || !productTitle.trim()) return
    try {
      const { product } = await api.createProduct(communityId, {
        title: productTitle.trim(),
        type: productType,
        description: productDescription.trim(),
        buttonText: productButtonText.trim() || 'Buy',
        priceStars: Math.max(0, Number(productPriceStars || 0)),
        coverPath: productCover.path,
        deliveryType: productDeliveryType,
        deliveryText: productDeliveryText.trim(),
        deliveryUrl: productDeliveryUrl.trim(),
        filePath: productFile.path,
        fileName: productFile.name,
      })
      setCreatedProduct(product)
      setSelectedProduct(product)
      setData({ ...data, products: [product, ...data.products] })
      setScreen('productPublish')
      showToast('Product created')
    } catch (error: any) {
      showToast(error.message || 'Product creation failed')
    }
  }

  async function shareProductCard() {
    if (!communityId || !activeProduct) return showToast('Create a product first')
    try {
      const result = await api.shareProductCard(communityId, { productId: activeProduct.id, buttonText: activeProduct.buttonText ?? productButtonText })
      await copyText(result.url).catch(() => false)
      showToast(result.target === 'community_chat' ? 'Product card sent to community' : 'Product card sent to bot chat')
    } catch (error: any) {
      showToast(error.message || 'Product share failed')
    }
  }

  async function deleteProductOffer() {
    if (!communityId || !activeProduct) return
    try {
      await api.deleteProduct(communityId, activeProduct.id)
      await refreshDashboard()
      setCreatedProduct((product) => (product?.id === activeProduct.id ? null : product))
      setSelectedProduct(null)
      setScreen('home')
      showToast('Product deleted')
    } catch (error: any) {
      showToast(error.message || 'Delete failed')
    }
  }

  async function createEventOffer(event?: FormEvent) {
    event?.preventDefault()
    if (!communityId || !data || !eventTitle.trim()) return
    try {
      const { event: created } = await api.createEvent(communityId, {
        title: eventTitle.trim(),
        type: eventType,
        description: eventDescription.trim(),
        startsAt: new Date(eventStartsAt).toISOString(),
        priceStars: Math.max(0, Number(eventPriceStars || 0)),
        coverPath: eventCover.path,
        accessLink: eventAccessLink.trim(),
      })
      setCreatedEvent(created)
      setSelectedEvent(created)
      setData({ ...data, events: [created, ...data.events] })
      setScreen('eventPublish')
      showToast('Event created')
    } catch (error: any) {
      showToast(error.message || 'Event creation failed')
    }
  }

  async function shareEventCard() {
    if (!communityId || !activeEvent) return showToast('Create an event first')
    try {
      const result = await api.shareEventCard(communityId, {
        eventId: activeEvent.id,
        buttonText: activeEvent.priceStars ? 'Get Ticket' : 'Register',
      })
      await copyText(result.url).catch(() => false)
      showToast(result.target === 'community_chat' ? 'Event card sent to community' : 'Event card sent to bot chat')
    } catch (error: any) {
      showToast(error.message || 'Event share failed')
    }
  }

  async function deleteEventOffer() {
    if (!communityId || !activeEvent) return
    try {
      await api.deleteEvent(communityId, activeEvent.id)
      await refreshDashboard()
      setCreatedEvent((event) => (event?.id === activeEvent.id ? null : event))
      setSelectedEvent(null)
      setScreen('home')
      showToast('Event deleted')
    } catch (error: any) {
      showToast(error.message || 'Delete failed')
    }
  }

  async function grantAccess(row: MemberRowDto) {
    if (!communityId) return
    try {
      await api.grantAccess(communityId, row.id)
      await refreshDashboard()
      showToast(`Access granted to @${row.username}`)
    } catch (error: any) {
      showToast(error.message || 'Access grant failed')
    }
  }

  async function revokeAccess(row: MemberRowDto) {
    if (!communityId) return
    try {
      await api.revokeAccess(communityId, row.id)
      await refreshDashboard()
      showToast(`Access revoked for @${row.username}`)
    } catch (error: any) {
      showToast(error.message || 'Access revoke failed')
    }
  }

  async function createCampaign(event: FormEvent) {
    event.preventDefault()
    if (!data || !communityId || !campaignTitle.trim()) return
    const body = {
      title: campaignTitle.trim(),
      reward: referralReward.trim() || 'Unlock bonus content',
      threshold: Math.max(1, Number(referralThreshold || 3)),
      metric: 'joins' as const,
      status: 'active' as const,
    }
    try {
      const { campaign } = await api.createReferralCampaign(communityId, body)
      setData({ ...data, referralCampaigns: [campaign, ...data.referralCampaigns] })
      setCampaignTitle('')
      setScreen('growth')
      showToast('Referral campaign created')
    } catch (error: any) {
      showToast(error.message || 'Campaign creation failed')
    }
  }

  async function createRewardRule(event: FormEvent) {
    event.preventDefault()
    if (!data || !communityId || !rewardTitle.trim()) return
    const body = {
      title: rewardTitle.trim(),
      trigger: 'Member reaches an XP or referral milestone',
      reward: '+150 XP and badge',
      status: 'active' as const,
    }
    try {
      const { rule } = await api.createRewardRule(communityId, body)
      setData({ ...data, rewardRules: [rule, ...data.rewardRules] })
      setRewardTitle('')
      showToast('Reward rule created')
    } catch (error: any) {
      showToast(error.message || 'Reward rule creation failed')
    }
  }

  async function createEventDraft() {
    if (!data || !communityId) return
    const body = {
      title: 'Weekly Community Session',
      type: 'webinar' as const,
      startsAt: new Date(Date.now() + 86400000 * 7).toISOString(),
      priceStars: 0,
    }
    try {
      const { event } = await api.createEvent(communityId, body)
      setData({ ...data, events: [event, ...data.events] })
      showToast('Event draft created')
    } catch (error: any) {
      showToast(error.message || 'Event creation failed')
    }
  }

  async function createProductDraft() {
    if (!data || !communityId) return
    const body = {
      title: 'Premium Download',
      type: 'download' as const,
      priceStars: 199,
    }
    try {
      const { product } = await api.createProduct(communityId, body)
      setData({ ...data, products: [product, ...data.products] })
      showToast('Product draft created')
    } catch (error: any) {
      showToast(error.message || 'Product creation failed')
    }
  }

  async function copyOrOpenTelegramUrl(url: string, successMessage: string) {
    if (!url) {
      showToast('Set NEXT_PUBLIC_TELEGRAM_BOT_USERNAME first')
      return
    }
    await copyText(url).catch(() => false)
    openTelegramLink(url)
    showToast(successMessage)
  }

  async function shareCommunity() {
    if (!data || !communityId) return
    await copyOrOpenTelegramUrl(communityStartLink(communityId), 'Community link copied')
  }

  async function copyMembershipLink() {
    if (!communityId) return
    const planId = activePlan?.id ?? 'new'
    await copyOrOpenTelegramUrl(membershipStartLink(communityId, planId), 'Membership link copied')
  }

  async function syncAccessNow() {
    if (!communityId) return
    try {
      const result = await api.syncAccess(communityId)
      await refreshDashboard()
      showToast(`Synced ${result.synced ?? 0} of ${result.scanned ?? 0} pending members`)
    } catch (error: any) {
      showToast(error.message || 'Access sync failed')
    }
  }

  async function copyReferralLink() {
    if (!communityId) return
    await copyOrOpenTelegramUrl(referralStartLink(communityId, member?.id), 'Referral link copied')
  }

  async function openSupport() {
    await copyOrOpenTelegramUrl(botUrl(), 'Support chat opened')
  }

  async function handleAddCommunity() {
    const url = botGroupLink()
    if (!url) {
      showToast('Set NEXT_PUBLIC_TELEGRAM_BOT_USERNAME first')
      return
    }
    openTelegramLink(url)
    showToast('Add the bot as admin — your community will appear here')

    // Refresh community list when user comes back to the Mini App
    const onReturn = async () => {
      if (document.hidden) return
      document.removeEventListener('visibilitychange', onReturn)
      try {
        const me = await api.getMe()
        setOwnedCommunities(me.communities)
        if (me.communities.length > 0) showToast('Community connected')
      } catch {}
    }
    document.addEventListener('visibilitychange', onReturn)
  }

  async function buyProduct(product: ProductDto) {
    if (!communityId || !data) return
    try {
      if (product.owned) {
        if (product.deliveryUrl) {
          await copyText(product.deliveryUrl).catch(() => false)
          openExternalLink(product.deliveryUrl)
          showToast('Product access opened')
          return
        }
        if (product.deliveryText) {
          await copyText(product.deliveryText).catch(() => false)
          showToast('Delivery instructions copied')
          return
        }
        showToast('Product already unlocked')
        return
      }

      if (product.priceStars <= 0) {
        showToast('Free product delivery is not configured yet')
        return
      }

      const response = await api.createInvoice(communityId, {
        title: product.title,
        description: `${product.title} from ${data.community.name}`,
        stars: product.priceStars,
        productId: product.id,
      })
      if (response.invoice.invoiceLink) {
        openInvoiceLink(response.invoice.invoiceLink, (status) => showToast(`Payment ${status}`))
        showToast('Opening Telegram invoice')
      } else {
        showToast('Invoice stored, but bot invoice link is not configured')
      }
    } catch (error: any) {
      showToast(error.message || 'Invoice creation failed')
    }
  }

  async function registerOrBuyEvent(event: EventDto) {
    if (!communityId || !data) return
    try {
      if (event.priceStars > 0 && !event.registered) {
        const response = await api.createInvoice(communityId, {
          title: event.title,
          description: `${event.title} from ${data.community.name}`,
          stars: event.priceStars,
          eventId: event.id,
        })
        if (response.invoice.invoiceLink) {
          openInvoiceLink(response.invoice.invoiceLink, (status) => showToast(`Payment ${status}`))
          showToast('Opening Telegram invoice')
        } else {
          showToast('Invoice stored, but bot invoice link is not configured')
        }
        return
      }
      if (!event.registered) {
        await api.registerEvent(communityId, event.id)
        const profile = await api.getMemberProfile(communityId)
        setMemberProfile(profile)
        setData(dashboardFromMemberProfile(profile))
        showToast('Event registered')
      } else if (event.accessLink) {
        await copyText(event.accessLink).catch(() => false)
        openExternalLink(event.accessLink)
        showToast('Event access opened')
      } else {
        showToast('Event registered')
      }
    } catch (error: any) {
      showToast(error.message || 'Event registration failed')
    }
  }

  // Error — show appropriate message based on error type
  if (authError) {
    const isNotInTelegram = authError === 'not_in_telegram'
    const isAuthFailed = authError === 'auth_failed'
    const heading = isNotInTelegram ? 'Open in Telegram' : isAuthFailed ? 'Authentication failed' : 'Something went wrong'
    const detail = isNotInTelegram
      ? 'This app runs inside Telegram. Open it via the bot menu or a t.me link.'
      : isAuthFailed
      ? 'The server could not verify your identity. Check that TELEGRAM_BOT_TOKEN is set in Vercel env vars.'
      : authError
    return (
      <>
        <Head>
          <title>CommunityOS</title>
          <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        </Head>
        <main className="tg-app">
          <header className="tg-topbar">
            <button className="tg-nav-button" type="button" disabled aria-label="Back" />
            <div className="tg-title">
              <strong>CommunityOS</strong>
              <span>mini app</span>
            </div>
            <MenuButton communityId={1} />
          </header>
          <section className="tg-screen centered">
            <div className="tg-hero-mark">TG</div>
            <h1>{heading}</h1>
            <p className="tg-subtitle">{detail}</p>
          </section>
        </main>
        {toast && <div className="tg-toast">{toast}</div>}
      </>
    )
  }

  // No dashboard yet — allow onboarding screens to render, spinner for everything else
  if (!data) {
    return (
      <>
        <Head>
          <title>CommunityOS</title>
          <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        </Head>
        {screen === 'intro' ? (
          <IntroScreen
            index={introIndex}
            onBack={introIndex > 0 ? () => setIntroIndex((v) => v - 1) : undefined}
            menuCommunityId={communityId ?? 1}
            onNext={() => {
              if (introIndex < introSlides.length - 1) setIntroIndex((v) => v + 1)
              else go('start')
            }}
          />
        ) : (
          <AppFrame
            title="CommunityOS"
            subtitle="mini app"
            hideBack={screen === 'start'}
            menuCommunityId={communityId ?? 1}
            onBack={() => { if (screen === 'communities') go('start') }}
          >
            {screen === 'start' && <StartPicker onSelect={go} onSelectModel={chooseRevenueModel} />}
            {screen === 'communities' && (
              <CommunityPicker
                communities={filteredCommunities}
                search={search}
                onSearch={setSearch}
                onSelect={selectCommunity}
                onAdd={handleAddCommunity}
              />
            )}
            {screen !== 'start' && screen !== 'communities' && (
              <div className="tg-loading">
                <div className="tg-loader" />
                <p>Loading CommunityOS</p>
              </div>
            )}
          </AppFrame>
        )}
        {toast && <div className="tg-toast">{toast}</div>}
      </>
    )
  }

  return (
    <>
      <Head>
        <title>CommunityOS</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </Head>

      {mode === 'member' ? (
        <AppFrame title="CommunityOS" subtitle="member app" hideBack={screen === 'home'} onBack={() => go('home')} menuCommunityId={communityId ?? 1}>
          <MemberHome data={data} member={member} onReferral={copyReferralLink} onSupport={openSupport} onBuyProduct={buyProduct} onEvent={registerOrBuyEvent} onToast={showToast} />
        </AppFrame>
      ) : screen === 'intro' ? (
        <IntroScreen
          index={introIndex}
          onBack={introIndex > 0 ? () => setIntroIndex((value) => value - 1) : undefined}
          menuCommunityId={communityId ?? 1}
          onNext={() => {
            if (introIndex < introSlides.length - 1) {
              setIntroIndex((value) => value + 1)
            } else {
              go('start')
            }
          }}
        />
      ) : screen === 'shareGuide' ? (
        <ShareGuide onBack={() => go('publish')} onDone={() => go('home')} menuCommunityId={communityId ?? 1} />
      ) : (
        <AppFrame
          title="CommunityOS"
          subtitle="mini app"
          hideBack={screen === 'start'}
          menuCommunityId={communityId ?? 1}
          onBack={() => {
            const previous: Record<Screen, Screen> = {
              intro: 'intro',
              start: 'intro',
              communities: 'start',
              home: 'communities',
              members: 'home',
              access: 'home',
              growth: 'home',
              rewards: 'home',
              more: 'home',
              createDetails: 'home',
              preview: 'createDetails',
              payments: 'preview',
              publish: 'home',
              shareGuide: 'publish',
              productBuilder: 'home',
              productPublish: 'productBuilder',
              eventBuilder: 'home',
              eventPublish: 'eventBuilder',
              referralBuilder: 'growth',
            }
            go(previous[screen])
          }}
        >
          {screen === 'start' && <StartPicker onSelect={go} onSelectModel={chooseRevenueModel} />}
          {screen === 'communities' && (
            <CommunityPicker
              communities={filteredCommunities}
              search={search}
              onSearch={setSearch}
              onSelect={selectCommunity}
              onAdd={handleAddCommunity}
            />
          )}
          {screen === 'home' && (
            <CommunityHome
              data={data}
              nextSetupStep={nextSetupStep}
              onNavigate={go}
              onCreateMembership={() => go('createDetails')}
              onShareCommunity={shareCommunity}
              onSelectModel={chooseRevenueModel}
              onOpenProduct={(product) => {
                setSelectedProduct(product)
                setCreatedProduct(null)
                go('productPublish')
              }}
              onOpenEvent={(event) => {
                setSelectedEvent(event)
                setCreatedEvent(null)
                go('eventPublish')
              }}
            />
          )}
          {screen === 'members' && <MembersScreen members={data.members} onGrant={grantAccess} onRevoke={revokeAccess} />}
          {screen === 'access' && (
            <AccessScreen data={data} onGrant={grantAccess} onRevoke={revokeAccess} onSync={syncAccessNow} />
          )}
          {screen === 'growth' && (
            <GrowthScreen
              data={data}
              campaignTitle={campaignTitle}
              onCampaignTitle={setCampaignTitle}
              onCreateCampaign={createCampaign}
            />
          )}
          {screen === 'rewards' && (
            <RewardsScreen
              data={data}
              rewardTitle={rewardTitle}
              onRewardTitle={setRewardTitle}
              onCreateReward={createRewardRule}
            />
          )}
          {screen === 'more' && (
            <MoreScreen
              data={data}
              onToast={showToast}
              onCreateEvent={() => go('eventBuilder')}
              onCreateProduct={() => go('productBuilder')}
            />
          )}
          {screen === 'productBuilder' && (
            <ProductBuilderScreen
              title={productTitle}
              description={productDescription}
              type={productType}
              priceStars={productPriceStars}
              buttonText={productButtonText}
              deliveryType={productDeliveryType ?? 'none'}
              deliveryText={productDeliveryText}
              deliveryUrl={productDeliveryUrl}
              cover={productCover}
              file={productFile}
              onTitle={setProductTitle}
              onDescription={setProductDescription}
              onType={setProductType}
              onPriceStars={setProductPriceStars}
              onButtonText={setProductButtonText}
              onDeliveryType={setProductDeliveryType}
              onDeliveryText={setProductDeliveryText}
              onDeliveryUrl={setProductDeliveryUrl}
              onCoverFile={handleProductCover}
              onDeliveryFile={handleProductFile}
              onCancel={() => go('home')}
              onSubmit={createProductOffer}
            />
          )}
          {screen === 'productPublish' && activeProduct && (
            <RevenuePublishScreen
              kind="product"
              title={activeProduct.title}
              description={activeProduct.description ?? productDescription}
              price={`${activeProduct.priceStars} XTR`}
              coverUrl={activeProduct.coverUrl ?? productCover.preview}
              primaryLabel="Share Product"
              onEdit={() => go('productBuilder')}
              onShare={shareProductCard}
              onDelete={deleteProductOffer}
              onToast={showToast}
            />
          )}
          {screen === 'eventBuilder' && (
            <EventBuilderScreen
              title={eventTitle}
              description={eventDescription}
              type={eventType}
              startsAt={eventStartsAt}
              priceStars={eventPriceStars}
              accessLink={eventAccessLink}
              cover={eventCover}
              onTitle={setEventTitle}
              onDescription={setEventDescription}
              onType={setEventType}
              onStartsAt={setEventStartsAt}
              onPriceStars={setEventPriceStars}
              onAccessLink={setEventAccessLink}
              onCoverFile={handleEventCover}
              onCancel={() => go('home')}
              onSubmit={createEventOffer}
            />
          )}
          {screen === 'eventPublish' && activeEvent && (
            <RevenuePublishScreen
              kind="event"
              title={activeEvent.title}
              description={activeEvent.description ?? eventDescription}
              price={activeEvent.priceStars ? `${activeEvent.priceStars} XTR` : 'Free'}
              coverUrl={activeEvent.coverUrl ?? eventCover.preview}
              primaryLabel="Share Event"
              onEdit={() => go('eventBuilder')}
              onShare={shareEventCard}
              onDelete={deleteEventOffer}
              onToast={showToast}
            />
          )}
          {screen === 'referralBuilder' && (
            <ReferralBuilderScreen
              campaignTitle={campaignTitle}
              threshold={referralThreshold}
              reward={referralReward}
              onCampaignTitle={setCampaignTitle}
              onThreshold={setReferralThreshold}
              onReward={setReferralReward}
              onCancel={() => go('growth')}
              onSubmit={createCampaign}
            />
          )}
          {screen === 'createDetails' && (
            <CreateDetailsScreen
              title={membershipTitle}
              description={membershipDescription}
              buttonText={buttonText}
              coverPreview={coverPreview}
              coverName={coverName}
              onTitle={setMembershipTitle}
              onDescription={setMembershipDescription}
              onButtonText={setButtonText}
              onCoverFile={handleCoverFile}
              onCancel={() => go('home')}
              onSubmit={() => go('preview')}
            />
          )}
          {screen === 'preview' && (
            <PreviewScreen
              communityName={data.community.name}
              title={membershipTitle}
              description={membershipDescription}
              buttonText={buttonText}
              coverPreview={coverPreview}
              onNext={() => go('payments')}
            />
          )}
          {screen === 'payments' && (
            <PaymentScreen
              monthlyStars={monthlyStars}
              yearlyStars={yearlyStars}
              onMonthlyStars={setMonthlyStars}
              onYearlyStars={setYearlyStars}
              onCancel={() => go('preview')}
              onCreate={createMembership}
            />
          )}
          {screen === 'publish' && (
            <PublishScreen
              community={data.community}
              plan={activePlan}
              title={membershipTitle}
              description={membershipDescription}
              onEdit={() => go('createDetails')}
              coverPreview={coverPreview}
              onShare={shareMembershipCard}
              onGuide={() => go('shareGuide')}
              onCopyLink={copyMembershipLink}
              onDelete={deleteMembershipPackage}
              onToast={showToast}
            />
          )}
        </AppFrame>
      )}
      {toast && <div className="tg-toast">{toast}</div>}
    </>
  )
}

function AppFrame({
  title,
  subtitle,
  children,
  hideBack,
  onBack,
  menuCommunityId,
}: {
  title: string
  subtitle: string
  children: React.ReactNode
  hideBack?: boolean
  onBack?: () => void
  menuCommunityId: number
}) {
  return (
    <main className="tg-app">
      <header className="tg-topbar">
        <button className="tg-nav-button" type="button" onClick={onBack} disabled={hideBack} aria-label="Back">
          {hideBack ? '' : 'Back'}
        </button>
        <div className="tg-title">
          <strong>{title}</strong>
          <span>{subtitle}</span>
        </div>
        <MenuButton communityId={menuCommunityId} />
      </header>
      {children}
    </main>
  )
}

function IntroScreen({ index, onBack, onNext, menuCommunityId }: { index: number; onBack?: () => void; onNext: () => void; menuCommunityId: number }) {
  const slide = introSlides[index]
  return (
    <main className="tg-story">
      <header className="tg-story-topbar">
        <button type="button" onClick={onBack} disabled={!onBack}>
          {onBack ? 'Back' : ''}
        </button>
        <div>
          <strong>CommunityOS</strong>
          <span>mini app</span>
        </div>
        <MenuButton communityId={menuCommunityId} />
      </header>
      <div className="tg-progress-bars" aria-label={`Slide ${index + 1} of ${introSlides.length}`}>
        {introSlides.map((item, itemIndex) => (
          <span key={item.title} className={itemIndex <= index ? 'active' : ''} />
        ))}
      </div>
      <section className="tg-story-content">
        <h1>{slide.title}</h1>
        <p>{slide.text}</p>
        <StoryArt label={slide.art} />
      </section>
      <footer className="tg-story-footer">
        <button type="button" onClick={onNext}>
          {index === introSlides.length - 1 ? 'Start' : 'Next'}
        </button>
      </footer>
    </main>
  )
}

function StartPicker({ onSelect, onSelectModel }: { onSelect: (screen: Screen) => void; onSelectModel: (model: RevenueModel) => void }) {
  return (
    <section className="tg-screen centered">
      <div className="tg-hero-mark">CO</div>
      <h1>Where would you like to start?</h1>
      <p className="tg-subtitle">Pick the first thing you want to launch. You can add other formats later.</p>
      <ListGroup>
        <ListRow tone="blue" icon="M" title="Paid Membership" detail="Sell access to a private group or channel." onClick={() => onSelectModel('membership')} />
        <ListRow tone="red" icon="D" title="Digital Product" detail="Sell courses, files, downloads, or guides." onClick={() => onSelectModel('product')} />
        <ListRow tone="purple" icon="E" title="Event or AMA" detail="Sell tickets or manage registrations." onClick={() => onSelectModel('event')} />
        <ListRow tone="green" icon="R" title="Referral Rewards" detail="Reward members for inviting others." onClick={() => onSelectModel('referral')} />
        <ListRow tone="amber" icon="AI" title="AI Community Manager" detail="Automate FAQ, welcome messages, and reports." onClick={() => onSelectModel('ai')} />
      </ListGroup>
      <button className="tg-link-button" type="button" onClick={() => onSelect('communities')}>
        I will choose later
      </button>
    </section>
  )
}

function CommunityPicker({
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

function CommunityHome({
  data,
  nextSetupStep,
  onNavigate,
  onCreateMembership,
  onShareCommunity,
  onSelectModel,
  onOpenProduct,
  onOpenEvent,
}: {
  data: DashboardDto
  nextSetupStep: DashboardDto['setup'][number] | null
  onNavigate: (screen: Screen) => void
  onCreateMembership: () => void
  onShareCommunity: () => void
  onSelectModel: (model: RevenueModel) => void
  onOpenProduct: (product: ProductDto) => void
  onOpenEvent: (event: EventDto) => void
}) {
  return (
    <section className="tg-screen with-fixed-button">
      <CommunityHeader data={data} />
      <div className="tg-action-grid">
        <ActionTile label="Membership" icon="plus" onClick={onCreateMembership} />
        <ActionTile label="Product" icon="link" onClick={() => onSelectModel('product')} />
        <ActionTile label="More" icon="more" onClick={() => onNavigate('more')} />
      </div>

      {nextSetupStep && (
        <section className="tg-callout">
          <span>NEXT STEP</span>
          <h2>{nextSetupStep.title}</h2>
          <p>{nextSetupStep.detail}</p>
          <button type="button" onClick={onCreateMembership}>
            Continue setup
          </button>
        </section>
      )}

      <SectionLabel>Memberships</SectionLabel>
      <ListGroup>
        {data.plans.map((plan) => (
          <ListRow
            key={plan.id}
            tone="blue"
            icon="M"
            title={plan.name}
            detail={`${plan.subscribers} subscribers`}
            meta={`${plan.stars || Math.round(plan.priceCents / 10)} XTR`}
            onClick={() => onNavigate('publish')}
          />
        ))}
        {data.plans.length === 0 && <EmptyBlock title="Transactions will appear here" detail="Create a membership or product to get the money flowing." />}
      </ListGroup>

      <SectionLabel>Products</SectionLabel>
      <ListGroup>
        {data.products.map((product) => (
          <ListRow
            key={product.id}
            tone="red"
            icon="D"
            title={product.title}
            detail={`${product.type.replace('_', ' ')} · ${product.purchases} purchases`}
            meta={`${product.priceStars} XTR`}
            onClick={() => onOpenProduct(product)}
          />
        ))}
        {data.products.length === 0 && <ListRow tone="red" icon="D" title="Create Digital Product" detail="Sell files, links, courses, or consultations." onClick={() => onSelectModel('product')} />}
      </ListGroup>

      <SectionLabel>Events</SectionLabel>
      <ListGroup>
        {data.events.slice(0, 3).map((event) => (
          <ListRow
            key={event.id}
            tone="purple"
            icon="E"
            title={event.title}
            detail={`${event.type} · ${dateShort(event.startsAt)}`}
            meta={event.priceStars ? `${event.priceStars} XTR` : 'Free'}
            onClick={() => onOpenEvent(event)}
          />
        ))}
        {data.events.length === 0 && <ListRow tone="purple" icon="E" title="Create Event or AMA" detail="Sell tickets or collect registrations." onClick={() => onSelectModel('event')} />}
      </ListGroup>

      <SectionLabel>Operations</SectionLabel>
      <ListGroup>
        <ListRow tone="green" icon="A" title="Access" detail={`${data.metrics.accessIssues} issues need review`} onClick={() => onNavigate('access')} />
        <ListRow tone="purple" icon="G" title="Growth" detail={`${data.metrics.referralActivations} referral activations`} onClick={() => onNavigate('growth')} />
        <ListRow tone="amber" icon="R" title="Rewards" detail={`${data.rewardRules.length} reward rules`} onClick={() => onNavigate('rewards')} />
      </ListGroup>

      <SectionLabel>Recent Activity</SectionLabel>
      <ListGroup>
        {data.activity.slice(0, 4).map((item) => (
          <ListRow key={item.id} title={item.title} detail={dateShort(item.createdAt)} />
        ))}
        {data.activity.length === 0 && <EmptyBlock title="No activity yet" detail="Payments, joins, access changes, and reward grants will show here." />}
      </ListGroup>

      <FixedButton label={data.plans.length ? 'Share' : 'Create Membership'} onClick={data.plans.length ? onShareCommunity : onCreateMembership} />
    </section>
  )
}

function CommunityHeader({ data }: { data: DashboardDto }) {
  return (
    <section className="tg-community-header">
      <div className="tg-large-avatar">{initials(data.community.name)}</div>
      <h1>{data.community.name}</h1>
      <p>{data.metrics.members} members</p>
      <div className="tg-mini-stats">
        <span>{data.metrics.monthlyStars.toLocaleString()} XTR</span>
        <span>{data.metrics.healthScore || data.ai.healthScore}% health</span>
      </div>
    </section>
  )
}

function MembersScreen({
  members,
  onGrant,
  onRevoke,
}: {
  members: MemberRowDto[]
  onGrant: (member: MemberRowDto) => void
  onRevoke: (member: MemberRowDto) => void
}) {
  return (
    <section className="tg-screen">
      <h1 className="tg-left-title">Members</h1>
      <ListGroup>
        {members.map((member) => (
          <MemberRow key={member.id} member={member} onGrant={() => onGrant(member)} onRevoke={() => onRevoke(member)} />
        ))}
        {members.length === 0 && <EmptyBlock title="No members yet" detail="Members will appear when they join through Telegram or a referral link." />}
      </ListGroup>
    </section>
  )
}

function AccessScreen({
  data,
  onGrant,
  onRevoke,
  onSync,
}: {
  data: DashboardDto
  onGrant: (member: MemberRowDto) => void
  onRevoke: (member: MemberRowDto) => void
  onSync: () => void
}) {
  const pendingMembers = data.members.filter((member) => member.accessStatus !== 'granted')
  return (
    <section className="tg-screen with-fixed-button">
      <h1 className="tg-left-title">Access</h1>
      <SectionLabel>Connected Telegram</SectionLabel>
      <ListGroup>
        {data.chats.map((chat) => <ChatRow key={chat.id} chat={chat} />)}
        {data.chats.length === 0 && <EmptyBlock title="No group connected" detail="Add the bot as admin in a Telegram group or channel." />}
      </ListGroup>
      <SectionLabel>Pending Access</SectionLabel>
      <ListGroup>
        {pendingMembers.map((member) => (
          <MemberRow key={member.id} member={member} onGrant={() => onGrant(member)} onRevoke={() => onRevoke(member)} compact />
        ))}
        {pendingMembers.length === 0 && <EmptyBlock title="Access is clean" detail="No pending grants or failed syncs right now." />}
      </ListGroup>
      <FixedButton label="Sync Access" onClick={onSync} />
    </section>
  )
}

function GrowthScreen({
  data,
  campaignTitle,
  onCampaignTitle,
  onCreateCampaign,
}: {
  data: DashboardDto
  campaignTitle: string
  onCampaignTitle: (value: string) => void
  onCreateCampaign: (event: FormEvent) => void
}) {
  return (
    <section className="tg-screen">
      <h1 className="tg-left-title">Growth</h1>
      <form className="tg-form-card" onSubmit={onCreateCampaign}>
        <SectionLabel>Create Referral Campaign</SectionLabel>
        <input value={campaignTitle} onChange={(event) => onCampaignTitle(event.target.value)} />
        <p>Invite 3 friends, unlock bonus content.</p>
        <button type="submit">Create Campaign</button>
      </form>
      <SectionLabel>Campaigns</SectionLabel>
      <ListGroup>
        {data.referralCampaigns.map((campaign) => (
          <ListRow
            key={campaign.id}
            tone="green"
            icon="R"
            title={campaign.title}
            detail={`${campaign.clicks} clicks, ${campaign.joins} joins, ${campaign.purchases} purchases`}
            meta={money(campaign.revenueCents)}
          />
        ))}
        {data.referralCampaigns.length === 0 && <EmptyBlock title="No campaigns yet" detail="Create a reward loop for invites, joins, and purchases." />}
      </ListGroup>
    </section>
  )
}

function RewardsScreen({
  data,
  rewardTitle,
  onRewardTitle,
  onCreateReward,
}: {
  data: DashboardDto
  rewardTitle: string
  onRewardTitle: (value: string) => void
  onCreateReward: (event: FormEvent) => void
}) {
  return (
    <section className="tg-screen">
      <h1 className="tg-left-title">Rewards</h1>
      <form className="tg-form-card" onSubmit={onCreateReward}>
        <SectionLabel>Create Reward Rule</SectionLabel>
        <input value={rewardTitle} onChange={(event) => onRewardTitle(event.target.value)} />
        <p>Grant XP, points, levels, badges, or perks when members complete an action.</p>
        <button type="submit">Create Reward</button>
      </form>
      <SectionLabel>Rules</SectionLabel>
      <ListGroup>
        {data.rewardRules.map((rule) => (
          <ListRow key={rule.id} tone="amber" icon="XP" title={rule.title} detail={`${rule.trigger}. ${rule.reward}`} meta={rule.status} />
        ))}
        {data.rewardRules.length === 0 && <EmptyBlock title="No reward rules yet" detail="Create an XP or badge rule to keep members engaged." />}
      </ListGroup>
    </section>
  )
}

function MoreScreen({
  data,
  onToast,
  onCreateEvent,
  onCreateProduct,
}: {
  data: DashboardDto
  onToast: (message: string) => void
  onCreateEvent: () => void
  onCreateProduct: () => void
}) {
  return (
    <section className="tg-screen">
      <h1 className="tg-left-title">More</h1>
      <ListGroup>
        <ListRow tone="amber" icon="AI" title="AI Community Manager" detail={`${data.ai.faqCount} FAQ answers, report ${data.ai.weeklyReportStatus}`} onClick={() => onToast('AI manager opened')} />
        <ListRow tone="purple" icon="E" title="Events" detail={`${data.events.length} events`} onClick={onCreateEvent} />
        <ListRow tone="red" icon="P" title="Products and Services" detail={`${data.products.length} products`} onClick={onCreateProduct} />
        <ListRow tone="blue" icon="S" title="Settings" detail="Bot permissions, Stars checkout, notifications" onClick={() => onToast('Settings opened')} />
      </ListGroup>
      <SectionLabel>Events</SectionLabel>
      <ListGroup>
        {data.events.map((event) => (
          <ListRow key={event.id} title={event.title} detail={`${event.type} on ${dateShort(event.startsAt)}`} meta={event.priceStars ? `${event.priceStars} XTR` : 'Free'} />
        ))}
        {data.events.length === 0 && <EmptyBlock title="No events yet" detail="Create webinars, AMAs, meetups, or challenges." />}
      </ListGroup>
      <SectionLabel>Products</SectionLabel>
      <ListGroup>
        {data.products.map((product) => (
          <ListRow key={product.id} title={product.title} detail={`${product.type.replace('_', ' ')}. ${product.purchases} purchases`} meta={`${product.priceStars} XTR`} />
        ))}
        {data.products.length === 0 && <EmptyBlock title="No products yet" detail="Sell courses, downloads, premium content, and consultations." />}
      </ListGroup>
    </section>
  )
}

function ProductBuilderScreen({
  title,
  description,
  type,
  priceStars,
  buttonText,
  deliveryType,
  deliveryText,
  deliveryUrl,
  cover,
  file,
  onTitle,
  onDescription,
  onType,
  onPriceStars,
  onButtonText,
  onDeliveryType,
  onDeliveryText,
  onDeliveryUrl,
  onCoverFile,
  onDeliveryFile,
  onCancel,
  onSubmit,
}: {
  title: string
  description: string
  type: ProductDto['type']
  priceStars: string
  buttonText: string
  deliveryType: NonNullable<ProductDto['deliveryType']>
  deliveryText: string
  deliveryUrl: string
  cover: { path: string | null; preview: string | null; name: string | null }
  file: { path: string | null; name: string | null }
  onTitle: (value: string) => void
  onDescription: (value: string) => void
  onType: (value: ProductDto['type']) => void
  onPriceStars: (value: string) => void
  onButtonText: (value: string) => void
  onDeliveryType: (value: NonNullable<ProductDto['deliveryType']>) => void
  onDeliveryText: (value: string) => void
  onDeliveryUrl: (value: string) => void
  onCoverFile: (file: File | null) => void
  onDeliveryFile: (file: File | null) => void
  onCancel: () => void
  onSubmit: (event?: FormEvent) => void
}) {
  return (
    <form className="tg-screen with-fixed-button" onSubmit={onSubmit}>
      <div className="tg-form-title">
        <h1>Create Product</h1>
        <p>Sell a download, course, premium post, or consultation through Telegram Stars.</p>
        <button className="tg-text-button" type="button" onClick={onCancel}>Cancel</button>
      </div>
      <SectionLabel>Details</SectionLabel>
      <div className="tg-input-group">
        <input value={title} onChange={(event) => onTitle(event.target.value)} aria-label="Product title" />
        <textarea value={description} onChange={(event) => onDescription(event.target.value)} aria-label="Product description" />
        <label>
          <span>Type</span>
          <select value={type} onChange={(event) => onType(event.target.value as ProductDto['type'])}>
            <option value="download">Download</option>
            <option value="course">Course</option>
            <option value="premium_content">Premium Content</option>
            <option value="consultation">Consultation</option>
          </select>
        </label>
      </div>
      <SectionLabel>Cover</SectionLabel>
      <UploadBox label="Upload Cover" preview={cover.preview} fileName={cover.name} accept="image/*" onFile={onCoverFile} />
      <SectionLabel>Delivery</SectionLabel>
      <div className="tg-input-group">
        <label>
          <span>Delivery Type</span>
          <select value={deliveryType} onChange={(event) => onDeliveryType(event.target.value as NonNullable<ProductDto['deliveryType']>)}>
            <option value="url">URL</option>
            <option value="text">Text</option>
            <option value="file">File</option>
            <option value="none">None</option>
          </select>
        </label>
        {deliveryType === 'url' && <input value={deliveryUrl} onChange={(event) => onDeliveryUrl(event.target.value)} placeholder="https://..." aria-label="Delivery URL" />}
        {deliveryType === 'text' && <textarea value={deliveryText} onChange={(event) => onDeliveryText(event.target.value)} aria-label="Delivery text" />}
        {deliveryType === 'file' && <UploadBox label="Upload File" fileName={file.name} accept=".pdf,.zip,.txt,.mp4,.mp3,image/*" onFile={onDeliveryFile} />}
      </div>
      <SectionLabel>Payment</SectionLabel>
      <div className="tg-input-group">
        <input value={priceStars} onChange={(event) => onPriceStars(event.target.value)} inputMode="numeric" aria-label="Product price in Stars" />
        <input value={buttonText} onChange={(event) => onButtonText(event.target.value)} aria-label="Button text" />
      </div>
      <PreviewCard title={title} description={description} buttonText={buttonText || 'Buy'} coverUrl={cover.preview} />
      <FixedButton label="Create Product" submit />
    </form>
  )
}

function EventBuilderScreen({
  title,
  description,
  type,
  startsAt,
  priceStars,
  accessLink,
  cover,
  onTitle,
  onDescription,
  onType,
  onStartsAt,
  onPriceStars,
  onAccessLink,
  onCoverFile,
  onCancel,
  onSubmit,
}: {
  title: string
  description: string
  type: EventDto['type']
  startsAt: string
  priceStars: string
  accessLink: string
  cover: { path: string | null; preview: string | null; name: string | null }
  onTitle: (value: string) => void
  onDescription: (value: string) => void
  onType: (value: EventDto['type']) => void
  onStartsAt: (value: string) => void
  onPriceStars: (value: string) => void
  onAccessLink: (value: string) => void
  onCoverFile: (file: File | null) => void
  onCancel: () => void
  onSubmit: (event?: FormEvent) => void
}) {
  return (
    <form className="tg-screen with-fixed-button" onSubmit={onSubmit}>
      <div className="tg-form-title">
        <h1>Create Event</h1>
        <p>Sell tickets or collect registrations for webinars, AMAs, challenges, and meetups.</p>
        <button className="tg-text-button" type="button" onClick={onCancel}>Cancel</button>
      </div>
      <SectionLabel>Details</SectionLabel>
      <div className="tg-input-group">
        <input value={title} onChange={(event) => onTitle(event.target.value)} aria-label="Event title" />
        <textarea value={description} onChange={(event) => onDescription(event.target.value)} aria-label="Event description" />
        <label>
          <span>Type</span>
          <select value={type} onChange={(event) => onType(event.target.value as EventDto['type'])}>
            <option value="webinar">Webinar</option>
            <option value="ama">AMA</option>
            <option value="challenge">Challenge</option>
            <option value="meetup">Meetup</option>
          </select>
        </label>
        <label>
          <span>Starts At</span>
          <input type="datetime-local" value={startsAt} onChange={(event) => onStartsAt(event.target.value)} />
        </label>
      </div>
      <SectionLabel>Access</SectionLabel>
      <div className="tg-input-group">
        <input value={accessLink} onChange={(event) => onAccessLink(event.target.value)} placeholder="Telegram invite, meeting link, or instructions" aria-label="Event access link" />
      </div>
      <SectionLabel>Cover</SectionLabel>
      <UploadBox label="Upload Cover" preview={cover.preview} fileName={cover.name} accept="image/*" onFile={onCoverFile} />
      <SectionLabel>Payment</SectionLabel>
      <div className="tg-input-group single">
        <input value={priceStars} onChange={(event) => onPriceStars(event.target.value)} inputMode="numeric" aria-label="Event price in Stars" />
      </div>
      <PreviewCard title={title} description={description} buttonText={Number(priceStars) > 0 ? 'Get Ticket' : 'Register'} coverUrl={cover.preview} />
      <FixedButton label="Create Event" submit />
    </form>
  )
}

function ReferralBuilderScreen({
  campaignTitle,
  threshold,
  reward,
  onCampaignTitle,
  onThreshold,
  onReward,
  onCancel,
  onSubmit,
}: {
  campaignTitle: string
  threshold: string
  reward: string
  onCampaignTitle: (value: string) => void
  onThreshold: (value: string) => void
  onReward: (value: string) => void
  onCancel: () => void
  onSubmit: (event: FormEvent) => void
}) {
  return (
    <form className="tg-screen with-fixed-button" onSubmit={onSubmit}>
      <div className="tg-form-title">
        <h1>Referral Reward</h1>
        <p>Create a simple milestone loop members can understand and share.</p>
        <button className="tg-text-button" type="button" onClick={onCancel}>Cancel</button>
      </div>
      <SectionLabel>Campaign</SectionLabel>
      <div className="tg-input-group">
        <input value={campaignTitle} onChange={(event) => onCampaignTitle(event.target.value)} aria-label="Campaign title" />
        <label>
          <span>Join Milestone</span>
          <input value={threshold} onChange={(event) => onThreshold(event.target.value)} inputMode="numeric" />
        </label>
        <textarea value={reward} onChange={(event) => onReward(event.target.value)} aria-label="Reward" />
      </div>
      <section className="tg-callout">
        <span>MEMBER JOURNEY</span>
        <h2>Invite {threshold || 3} members</h2>
        <p>{reward}</p>
      </section>
      <FixedButton label="Create Campaign" submit />
    </form>
  )
}

function RevenuePublishScreen({
  kind,
  title,
  description,
  price,
  coverUrl,
  primaryLabel,
  onEdit,
  onShare,
  onDelete,
  onToast,
}: {
  kind: 'product' | 'event'
  title: string
  description: string
  price: string
  coverUrl?: string | null
  primaryLabel: string
  onEdit: () => void
  onShare: () => void
  onDelete: () => void
  onToast: (message: string) => void
}) {
  return (
    <section className="tg-screen with-fixed-button">
      <h1 className="tg-publish-title">{title}</h1>
      <div className="tg-description-card">
        {coverUrl && <span className="tg-description-cover" style={{ backgroundImage: `url(${coverUrl})` }} />}
        <p>{description}</p>
        <div>
          <span>{kind === 'product' ? 'Digital product' : 'Event'}</span>
          <span>{price}</span>
        </div>
      </div>
      <div className="tg-action-grid">
        <ActionTile label="Edit" icon="edit" onClick={onEdit} />
        <ActionTile label="Share" icon="link" onClick={onShare} />
        <ActionTile label="More" icon="more" onClick={() => onToast('More options opened')} />
      </div>
      <ListGroup>
        <ListRow tone="green" icon="S" title="Telegram Card" detail="Share sends a bot message with a Web App button." onClick={onShare} />
        <ListRow tone="red" icon="D" title={`Delete ${kind === 'product' ? 'Product' : 'Event'}`} detail="Remove it from active offers." onClick={onDelete} />
      </ListGroup>
      <FixedButton label={primaryLabel} onClick={onShare} />
    </section>
  )
}

function UploadBox({ label, preview, fileName, accept, onFile }: { label: string; preview?: string | null; fileName?: string | null; accept: string; onFile: (file: File | null) => void }) {
  return (
    <label className="tg-upload-card">
      <input type="file" accept={accept} onChange={(event) => onFile(event.currentTarget.files?.[0] ?? null)} />
      <div>{preview ? <span className="tg-cover-preview" style={{ backgroundImage: `url(${preview})` }} /> : <span>{label}</span>}</div>
      {fileName && <small>{fileName}</small>}
    </label>
  )
}

function PreviewCard({ title, description, buttonText, coverUrl }: { title: string; description: string; buttonText: string; coverUrl?: string | null }) {
  return (
    <div className="tg-message-preview">
      <div className={coverUrl ? 'tg-preview-cover has-image' : 'tg-preview-cover'}>
        {coverUrl ? <span style={{ backgroundImage: `url(${coverUrl})` }} /> : <span>CommunityOS</span>}
      </div>
      <div className="tg-preview-body">
        <small>Telegram preview</small>
        <strong>{title}</strong>
        <p>{description}</p>
        <button type="button">{buttonText}</button>
      </div>
    </div>
  )
}

function CreateDetailsScreen({
  title,
  description,
  buttonText,
  coverPreview,
  coverName,
  onTitle,
  onDescription,
  onButtonText,
  onCoverFile,
  onCancel,
  onSubmit,
}: {
  title: string
  description: string
  buttonText: string
  coverPreview: string | null
  coverName: string | null
  onTitle: (value: string) => void
  onDescription: (value: string) => void
  onButtonText: (value: string) => void
  onCoverFile: (file: File | null) => void
  onCancel: () => void
  onSubmit: () => void
}) {
  return (
    <form
      className="tg-screen with-fixed-button"
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit()
      }}
    >
      <div className="tg-form-title">
        <h1>Create Membership</h1>
        <p>Add clear details. New members will see this in Telegram before they subscribe.</p>
        <button className="tg-text-button" type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
      <SectionLabel>Title and Description</SectionLabel>
      <div className="tg-input-group">
        <input value={title} onChange={(event) => onTitle(event.target.value)} aria-label="Membership title" />
        <textarea value={description} onChange={(event) => onDescription(event.target.value)} aria-label="Membership description" />
      </div>
      <SectionLabel>Button Text</SectionLabel>
      <div className="tg-input-group single">
        <input value={buttonText} onChange={(event) => onButtonText(event.target.value)} aria-label="Button text" />
      </div>
      <SectionLabel>Membership Cover</SectionLabel>
      <label className="tg-upload-card">
        <input type="file" accept="image/*" onChange={(event) => onCoverFile(event.currentTarget.files?.[0] ?? null)} />
        <div>
          {coverPreview ? <span className="tg-cover-preview" style={{ backgroundImage: `url(${coverPreview})` }} /> : <span>Upload Cover</span>}
        </div>
        {coverName && <small>{coverName}</small>}
      </label>
      <FixedButton label="Done" submit />
    </form>
  )
}

function PreviewScreen({
  communityName,
  title,
  description,
  buttonText,
  coverPreview,
  onNext,
}: {
  communityName: string
  title: string
  description: string
  buttonText: string
  coverPreview: string | null
  onNext: () => void
}) {
  return (
    <section className="tg-screen with-fixed-button">
      <h1 className="tg-center-title">Membership Preview</h1>
      <div className="tg-message-preview">
        <div className={coverPreview ? 'tg-preview-cover has-image' : 'tg-preview-cover'}>
          {coverPreview ? <span style={{ backgroundImage: `url(${coverPreview})` }} /> : <span>CommunityOS</span>}
        </div>
        <div className="tg-preview-body">
          <small>{communityName}</small>
          <strong>{title}</strong>
          <p>{description}</p>
          <button type="button">{buttonText}</button>
        </div>
      </div>
      <FixedButton label="Next" onClick={onNext} />
    </section>
  )
}

function PaymentScreen({
  monthlyStars,
  yearlyStars,
  onMonthlyStars,
  onYearlyStars,
  onCancel,
  onCreate,
}: {
  monthlyStars: string
  yearlyStars: string
  onMonthlyStars: (value: string) => void
  onYearlyStars: (value: string) => void
  onCancel: () => void
  onCreate: (event?: FormEvent) => void
}) {
  return (
    <form className="tg-screen with-fixed-button" onSubmit={onCreate}>
      <div className="tg-form-title">
        <h1>Set Up Payments</h1>
        <p>Set your Stars price, billing periods, and checkout options.</p>
        <button className="tg-text-button" type="button" onClick={onCancel}>
          Back
        </button>
      </div>
      <ListGroup>
        <ListRow title="Currency" detail="Telegram Stars" meta="XTR" />
        <ListRow title="Payment Methods" detail="Telegram native checkout" meta="All" />
      </ListGroup>
      <SectionLabel>Subscription Periods</SectionLabel>
      <div className="tg-input-group">
        <label>
          <span>1 Month</span>
          <input value={monthlyStars} onChange={(event) => onMonthlyStars(event.target.value)} inputMode="numeric" />
        </label>
        <label>
          <span>1 Year</span>
          <input value={yearlyStars} onChange={(event) => onYearlyStars(event.target.value)} inputMode="numeric" />
        </label>
        <button className="tg-soft-button" type="button">
          Add Another Period
        </button>
      </div>
      <FixedButton label="Create" onClick={() => onCreate()} />
    </form>
  )
}

function PublishScreen({
  community,
  plan,
  title,
  description,
  coverPreview,
  onEdit,
  onShare,
  onGuide,
  onCopyLink,
  onDelete,
  onToast,
}: {
  community: DashboardDto['community']
  plan: PlanDto | null
  title: string
  description: string
  coverPreview: string | null
  onEdit: () => void
  onShare: () => void
  onGuide: () => void
  onCopyLink: () => void
  onDelete: () => void
  onToast: (message: string) => void
}) {
  return (
    <section className="tg-screen with-fixed-button">
      <h1 className="tg-publish-title">{plan?.name ?? title}</h1>
      <div className="tg-description-card">
        {coverPreview && <span className="tg-description-cover" style={{ backgroundImage: `url(${coverPreview})` }} />}
        <p>{plan?.description ?? description}</p>
        <div>
          <span>{community.name}</span>
          <span>{plan ? `${plan.stars || Math.round(plan.priceCents / 10)} XTR` : 'Draft'}</span>
        </div>
      </div>
      <div className="tg-action-grid">
        <ActionTile label="Edit" icon="edit" onClick={onEdit} />
        <ActionTile label="Links" icon="link" onClick={onCopyLink} />
        <ActionTile label="More" icon="more" onClick={() => onToast('More options opened')} />
      </div>
      <ListGroup>
        <ListRow tone="green" icon="C" title="Comment Access" detail="Off" onClick={() => onToast('Comment access opened')} />
        <ListRow tone="blue" icon="A" title="Auto-posting" detail="Off" onClick={() => onToast('Auto-posting opened')} />
        <ListRow tone="purple" icon="R" title="Referral Reward" detail="Invite 3 friends" onClick={() => onToast('Referral reward opened')} />
        {plan && <ListRow tone="red" icon="D" title="Delete Membership" detail="Remove this package from active offers" onClick={onDelete} />}
      </ListGroup>
      <div className="tg-empty-illustration">
        <div>Share</div>
        <h2>Share to get first subscribers</h2>
        <p>Send a Telegram card with a Subscribe button, copy the link, or open the publishing guide.</p>
        <button className="tg-link-button" type="button" onClick={onGuide}>
          How to publish
        </button>
      </div>
      <FixedButton label="Share" onClick={onShare} />
    </section>
  )
}

function ShareGuide({ onBack, onDone, menuCommunityId }: { onBack: () => void; onDone: () => void; menuCommunityId: number }) {
  const [step, setStep] = useState(0)
  const botUsername = configuredBotUsername() || 'CommunityOSBot'
  const slides = [
    { title: 'How to share a membership', art: 'Share' },
    { title: `Type @${botUsername} in any channel or chat`, art: '@bot' },
    { title: 'Select a membership to share', art: 'Pick' },
  ]
  return (
    <main className="tg-story">
      <header className="tg-story-topbar">
        <button type="button" onClick={onBack}>
          Back
        </button>
        <div>
          <strong>CommunityOS</strong>
          <span>mini app</span>
        </div>
        <MenuButton communityId={menuCommunityId} />
      </header>
      <div className="tg-progress-bars" aria-label={`Slide ${step + 1} of ${slides.length}`}>
        {slides.map((item, index) => (
          <span key={item.title} className={index <= step ? 'active' : ''} />
        ))}
      </div>
      <section className="tg-story-content simple">
        <StoryArt label={slides[step].art} compact />
        <h1>{slides[step].title}</h1>
      </section>
      <footer className="tg-story-footer">
        <button
          type="button"
          onClick={() => {
            if (step < slides.length - 1) setStep(step + 1)
            else onDone()
          }}
        >
          {step === slides.length - 1 ? 'Done' : 'Next'}
        </button>
      </footer>
    </main>
  )
}

function MemberHome({
  data,
  member,
  onReferral,
  onSupport,
  onBuyProduct,
  onEvent,
  onToast,
}: {
  data: DashboardDto
  member?: MemberRowDto
  onReferral: () => void
  onSupport: () => void
  onBuyProduct: (product: ProductDto) => void
  onEvent: (event: EventDto) => void
  onToast: (message: string) => void
}) {
  const progress = member ? Math.min(100, Math.round((member.xp % 1200) / 12)) : 0
  return (
    <section className="tg-screen with-fixed-button">
      <div className="tg-community-header">
        <div className="tg-large-avatar">{initials(member?.username ?? data.community.name)}</div>
        <h1>@{member?.username ?? 'member'}</h1>
        <p>{member?.planName ?? data.community.name}</p>
        <div className="tg-mini-stats">
          <span>{member?.accessStatus ?? 'pending'} access</span>
          <span>Level {member?.level ?? 1}</span>
        </div>
      </div>
      <section className="tg-progress-card">
        <div>
          <strong>{member?.xp ?? 0} XP</strong>
          <span>{progress}% to next level</span>
        </div>
        <div className="tg-progress"><span style={{ width: `${progress}%` }} /></div>
      </section>
      <ListGroup>
        <ListRow tone="blue" icon="A" title="Telegram Access" detail={member?.accessStatus ?? 'Pending'} />
        <ListRow tone="green" icon="R" title="Referral Link" detail="Invite friends and unlock rewards" onClick={onReferral} />
        <ListRow tone="amber" icon="XP" title="Rewards" detail={`${data.rewards.length} available`} />
      </ListGroup>
      <SectionLabel>Premium Content</SectionLabel>
      <ListGroup>
        {data.products.map((product) => (
          <ListRow
            key={product.id}
            title={product.title}
            detail={product.owned ? 'Unlocked' : product.type.replace('_', ' ')}
            meta={product.owned ? 'Open' : `${product.priceStars} XTR`}
            onClick={() => onBuyProduct(product)}
          />
        ))}
        {data.products.length === 0 && <EmptyBlock title="No premium content yet" detail="Products and downloads from this community will appear here." />}
      </ListGroup>
      <SectionLabel>Events</SectionLabel>
      <ListGroup>
        {data.events.map((event) => (
          <ListRow
            key={event.id}
            title={event.title}
            detail={`${event.type} on ${dateShort(event.startsAt)}`}
            meta={event.registered ? 'Open' : event.priceStars ? `${event.priceStars} XTR` : 'Free'}
            onClick={() => onEvent(event)}
          />
        ))}
        {data.events.length === 0 && <EmptyBlock title="No upcoming events" detail="Webinars, AMAs, and meetups will appear here." />}
      </ListGroup>
      <SectionLabel>Referral Rewards</SectionLabel>
      <ListGroup>
        {data.referralCampaigns.map((campaign) => (
          <ListRow
            key={campaign.id}
            tone={campaign.claimable ? 'green' : 'blue'}
            icon="R"
            title={campaign.title}
            detail={`${campaign.current ?? 0}/${campaign.threshold ?? 3} invites · ${campaign.reward}`}
            meta={campaign.claimable ? 'Claimable' : 'Progress'}
            onClick={() => {
              onReferral()
              onToast(campaign.claimable ? 'Reward is ready to claim' : 'Referral link copied')
            }}
          />
        ))}
        {data.referralCampaigns.length === 0 && <EmptyBlock title="No referral rewards yet" detail="Invite rewards from this community will appear here." />}
      </ListGroup>
      <FixedButton label="Get Support" onClick={onSupport} />
    </section>
  )
}

function ListGroup({ children }: { children: React.ReactNode }) {
  return <div className="tg-list-group">{children}</div>
}

function ListRow({
  title,
  detail,
  meta,
  icon,
  avatar,
  tone = 'blue',
  onClick,
}: {
  title: string
  detail?: string
  meta?: string
  icon?: string
  avatar?: string
  tone?: 'blue' | 'red' | 'purple' | 'green' | 'amber'
  onClick?: () => void
}) {
  const content = (
    <>
      {(icon || avatar) && <span className={`tg-row-icon ${tone}`}>{avatar ?? icon}</span>}
      <span className="tg-row-main">
        <strong>{title}</strong>
        {detail && <small>{detail}</small>}
      </span>
      {meta && <em>{meta}</em>}
      {onClick && <b aria-hidden="true">›</b>}
    </>
  )

  if (onClick) {
    return (
      <button className="tg-list-row" type="button" onClick={onClick}>
        {content}
      </button>
    )
  }

  return <div className="tg-list-row">{content}</div>
}

function MemberRow({
  member,
  onGrant,
  onRevoke,
  compact,
}: {
  member: MemberRowDto
  onGrant: () => void
  onRevoke: () => void
  compact?: boolean
}) {
  return (
    <article className={`tg-member-row ${compact ? 'compact' : ''}`}>
      <div className="tg-row-icon blue">{initials(member.username)}</div>
      <div>
        <strong>@{member.username}</strong>
        <small>
          {member.planName ?? 'No plan'} · {member.accessStatus} · {member.xp} XP
        </small>
      </div>
      <div className="tg-member-actions">
        <button type="button" onClick={onGrant}>Grant</button>
        <button type="button" onClick={onRevoke}>Revoke</button>
      </div>
    </article>
  )
}

function ChatRow({ chat }: { chat: TelegramChatDto }) {
  const status = chat.botStatus === 'admin' ? 'Ready' : chat.botStatus === 'missing_permissions' ? 'Needs permissions' : 'Not connected'
  return <ListRow tone={chat.botStatus === 'admin' ? 'green' : 'amber'} icon="T" title={chat.title} detail={`${chat.type}. ${chat.activeMembers} active members`} meta={status} />
}

function StoryArt({ label, compact }: { label: string; compact?: boolean }) {
  return (
    <div className={`tg-story-art ${compact ? 'compact' : ''}`} aria-hidden="true">
      <span className="tg-story-art-card">
        <i />
        <b>{label}</b>
      </span>
    </div>
  )
}

function ActionTile({ label, icon, onClick }: { label: string; icon: 'plus' | 'stats' | 'more' | 'edit' | 'link'; onClick: () => void }) {
  return (
    <button className="tg-action-tile" type="button" onClick={onClick}>
      <IconGlyph icon={icon} />
      <strong>{label}</strong>
    </button>
  )
}

function IconGlyph({ icon }: { icon: 'plus' | 'stats' | 'more' | 'edit' | 'link' }) {
  return (
    <span className={`tg-action-icon ${icon}`} aria-hidden="true">
      <i />
      <i />
      <i />
    </span>
  )
}

function MenuButton({ communityId }: { communityId: number }) {
  return (
    <details className="tg-menu-details">
      <summary className="tg-menu-button" aria-label="More options">
        <span />
        <span />
        <span />
      </summary>
      <nav className="tg-menu-sheet" aria-label="CommunityOS menu">
        <Link href="/">Restart intro</Link>
        <Link href={`/member/${communityId}`}>Member preview</Link>
        <Link href="/admin">Platform admin</Link>
      </nav>
    </details>
  )
}

function FixedButton({ label, onClick, submit }: { label: string; onClick?: () => void; submit?: boolean }) {
  return (
    <div className="tg-fixed-button">
      <button type={submit ? 'submit' : 'button'} onClick={onClick}>
        {label}
      </button>
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <h2 className="tg-section-label">{children}</h2>
}

function EmptyBlock({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="tg-empty-block">
      <strong>{title}</strong>
      <p>{detail}</p>
    </div>
  )
}

function screenForModel(model: RevenueModel): Screen {
  if (model === 'product') return 'productBuilder'
  if (model === 'event') return 'eventBuilder'
  if (model === 'referral') return 'referralBuilder'
  if (model === 'ai') return 'more'
  return 'createDetails'
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(reader.error ?? new Error('File read failed'))
    reader.readAsDataURL(file)
  })
}

function getRouteCommunityId(value: string | string[] | undefined): number | null {
  const raw = Array.isArray(value) ? value[0] : value
  if (!raw) return null
  const id = Number(raw)
  return Number.isFinite(id) ? id : null
}

function normalizeDashboard(dashboard: DashboardDto): DashboardDto {
  const empty = emptyDashboardForCommunity(dashboard.community)
  return {
    ...empty,
    ...dashboard,
    metrics: { ...empty.metrics, ...dashboard.metrics },
    ai: { ...empty.ai, ...dashboard.ai, suggestions: dashboard.ai?.suggestions ?? [] },
    setup: dashboard.setup ?? [],
    healthSignals: dashboard.healthSignals ?? [],
    nextActions: dashboard.nextActions ?? [],
    members: dashboard.members ?? [],
    chats: dashboard.chats ?? [],
    plans: (dashboard.plans ?? []).map((plan) => ({ ...plan, stars: plan.stars ?? Math.round(plan.priceCents / 10) })),
    referrals: dashboard.referrals ?? [],
    referralCampaigns: dashboard.referralCampaigns ?? [],
    rewards: dashboard.rewards ?? [],
    rewardRules: dashboard.rewardRules ?? [],
    activity: dashboard.activity ?? [],
    accessLogs: dashboard.accessLogs ?? [],
    events: dashboard.events ?? [],
    products: dashboard.products ?? [],
  }
}

function configuredBotUsername() {
  return (process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || '').replace(/^@/, '').trim()
}

function botUrl(path = '') {
  const username = configuredBotUsername()
  return username ? `https://t.me/${username}${path}` : ''
}

function communityStartLink(communityId: number) {
  return botUrl(`?startapp=community_${communityId}`)
}

function botGroupLink() {
  const username = configuredBotUsername()
  if (!username) return ''
  return `https://t.me/${username}?startgroup=setup&admin=manage_chat+invite_users+pin_messages`
}

function membershipStartLink(communityId: number, planId: number | string) {
  return botUrl(`?start=co_${communityId}_plan_${planId}`)
}

function referralStartLink(communityId: number, userId?: number) {
  return botUrl(`?start=co_${communityId}_${userId ?? 'member'}`)
}

function dashboardFromMemberProfile(profile: MemberProfileDto): DashboardDto {
  const dashboard = emptyDashboardForCommunity(profile.community)
  return {
    ...dashboard,
    metrics: {
      ...dashboard.metrics,
      members: 1,
      activeSubscriptions: profile.member.subscriptionStatus === 'active' ? 1 : 0,
      healthScore: profile.member.accessStatus === 'granted' ? 100 : 60,
    },
    members: [profile.member],
    rewards: profile.rewards,
    referralCampaigns: profile.referralCampaigns ?? [],
    events: profile.events,
    products: profile.products,
    activity: profile.activity,
  }
}

function initials(value: string) {
  return value
    .split(/[\s_@-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'CO'
}

function dateShort(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}
