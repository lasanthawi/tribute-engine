import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityDto,
  CommentAccessDto,
  DashboardDto,
  EventDto,
  MeDto,
  MemberProfileDto,
  MemberRowDto,
  PlanDto,
  ProductDto,
  PurchaseDto,
  ReferralCampaignDto,
  RewardRuleDto,
  RewardTriggerType,
  ScheduledPostDto,
  SubscriptionDto,
  TelegramChatDto,
  api,
  emptyDashboardForCommunity,
  money,
} from '@/lib/api-client'
import { copyText, getInitData, getStartParam, haptic, initTelegramShell, openExternalLink, openInvoiceLink, openTelegramLink } from '@/lib/telegram-webapp'
import { centsToStars, formatUsdApprox, starsToCents } from '@/lib/star-rate'
import { parseOfferCode, parseReferralCode as parseReferralStartCode } from '@/lib/start-params'
import { NextAction, computeAccountNextAction, computeNextAction } from '@/lib/next-action'

type Mode = 'publisher' | 'member'
type RevenueModel = 'membership' | 'product' | 'event' | 'referral' | 'ai'
type CheckoutIntent = { kind: 'plan' | 'product' | 'event'; id: number } | null
type Screen =
  | 'intro'
  | 'start'
  | 'account'
  | 'communities'
  | 'home'
  | 'members'
  | 'access'
  | 'growth'
  | 'rewards'
  | 'more'
  | 'createDetails'
  | 'publish'
  | 'shareGuide'
  | 'productBuilder'
  | 'productPublish'
  | 'eventBuilder'
  | 'eventPublish'
  | 'referralBuilder'
  | 'communityProfile'
  | 'offerWizard'
  | 'aiManager'
  | 'settings'

const introSlides = [
  {
    title: 'Run your Telegram community like a business',
    text: 'Memberships, products, events, referrals, and access control in one Mini App.',
    icon: 'business' as IconName,
  },
  {
    title: 'Sell access without manual admin work',
    text: 'Telegram Stars payments, renewal tracking, and invite links stay connected.',
    icon: 'stars' as IconName,
  },
  {
    title: 'The bot manages access for you',
    text: 'Approve members, revoke expired access, and share offers directly inside Telegram.',
    icon: 'bot' as IconName,
  },
]

function xtrLabel(stars: number): string {
  return `${stars.toLocaleString()} XTR (${formatUsdApprox(stars)})`
}

function xtrLabelOrFree(stars: number): string {
  return stars > 0 ? xtrLabel(stars) : 'Free'
}

function paymentStatusMessage(status: string, itemTitle: string): string {
  if (status === 'paid') return `Payment complete — ${itemTitle} is unlocked`
  if (status === 'cancelled') return 'Payment cancelled — nothing was charged'
  if (status === 'failed') return 'Payment failed — tap the button again to retry'
  if (status === 'pending') return 'Payment pending — this will update once it clears'
  return `Payment ${status}`
}

export default function Home() {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>('publisher')
  const [screen, setScreen] = useState<Screen>('intro')
  const [booted, setBooted] = useState(false)
  const [introIndex, setIntroIndex] = useState(0)
  const [data, setData] = useState<DashboardDto | null>(null)
  const [memberProfile, setMemberProfile] = useState<MemberProfileDto | null>(null)
  const [checkoutIntent, setCheckoutIntent] = useState<CheckoutIntent>(null)
  const [me, setMe] = useState<MeDto | null>(null)
  const [ownedCommunities, setOwnedCommunities] = useState<DashboardDto['community'][]>([])
  const [communityId, setCommunityId] = useState<number | null>(null)
  const [authError, setAuthError] = useState<string | null>(null)
  const [loadKey, setLoadKey] = useState(0)
  const [toast, setToast] = useState<string | null>(null)
  const visibilityListenerRef = useRef<(() => void) | null>(null)
  const [search, setSearch] = useState('')
  const [pendingModel, setPendingModel] = useState<RevenueModel>('membership')
  const [membershipTitle, setMembershipTitle] = useState('Premium Circle')
  const [membershipDescription, setMembershipDescription] = useState(
    'Get private Telegram access, weekly sessions, and member-only resources.'
  )
  const [buttonText, setButtonText] = useState('Subscribe')
  const [monthlyStars, setMonthlyStars] = useState('299')
  const [yearlyStars, setYearlyStars] = useState('2990')
  const [coverPath, setCoverPath] = useState<string | null>(null)
  const [coverPreview, setCoverPreview] = useState<string | null>(null)
  const [coverName, setCoverName] = useState<string | null>(null)
  const [createdPlan, setCreatedPlan] = useState<PlanDto | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [campaignTitle, setCampaignTitle] = useState('Invite 3 members')
  const [rewardTitle, setRewardTitle] = useState('Founding Member Badge')
  const [rewardTriggerType, setRewardTriggerType] = useState<RewardTriggerType>('member_joined')
  const [rewardTriggerCount, setRewardTriggerCount] = useState('1')
  const [aiQuestion, setAiQuestion] = useState('')
  const [aiAnswer, setAiAnswer] = useState<string | null>(null)
  const [aiBusy, setAiBusy] = useState(false)
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
  const [referralMetric, setReferralMetric] = useState<'joins' | 'purchases' | 'revenue'>('joins')
  const [referralPresetTarget, setReferralPresetTarget] = useState<{ type: 'plan' | 'product' | 'event'; id: number; label: string } | null>(null)
  const [profileName, setProfileName] = useState('')
  const [profileHandle, setProfileHandle] = useState('')
  const [profileDescription, setProfileDescription] = useState('')
  const [profileInviteUrl, setProfileInviteUrl] = useState('')
  const [wizardStep, setWizardStep] = useState(0)
  const [wizardCompleted, setWizardCompleted] = useState(false)
  const routeIdQuery = router.query.id
  const routeCommunityIdQuery = router.query.communityId
  const routePlanQuery = router.query.plan
  const routeProductQuery = router.query.product
  const routeEventQuery = router.query.event

  useEffect(() => {
    // Show wizard when checkout intent becomes available
    if (checkoutIntent && !wizardCompleted && mode === 'member' && screen === 'home') {
      setWizardStep(0)
      setScreen('offerWizard')
    }
  }, [checkoutIntent, wizardCompleted, mode, screen])

  useEffect(() => {
    if (!router.isReady) return

    let cancelled = false

    async function load() {
      initTelegramShell()
      const routeCommunityId = getRouteCommunityId(routeIdQuery ?? routeCommunityIdQuery)
      const startIntent = parseStartParam(getStartParam())
      const queryIntent = parseCheckoutIntent({ plan: routePlanQuery, product: routeProductQuery, event: routeEventQuery })
      const resolvedIntent = queryIntent ?? startIntent.intent
      const isMemberRoute = router.pathname.startsWith('/member')
      const shouldOpenMemberMode = isMemberRoute || (!!startIntent.communityId && !routeCommunityId)

      try {
        // Track referral clicks from app deep links (start_param format: co_communityId_referrerId)
        const sp = getStartParam()
        const referralStart = sp ? parseReferralStartCode(sp) : null
        if (referralStart) {
          await fetch('/api/referrals/track', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-telegram-init-data': getInitData() },
            body: JSON.stringify({ communityId: referralStart.communityId, referrerId: referralStart.referrerId }),
          }).catch(() => undefined)
        }

        if (shouldOpenMemberMode) {
          const targetId = routeCommunityId ?? startIntent.communityId ?? 1
          const profile = await api.getMemberProfile(targetId)
          if (cancelled) return
          setMemberProfile(profile)
          setCheckoutIntent(resolvedIntent)
          setCommunityId(profile.community.id)
          setData(dashboardFromMemberProfile(profile))
          setMode('member')
          setScreen('home')
          // Opportunistically learn whether this user also owns communities, so the
          // member view can offer a way back to the publisher dashboard. Non-blocking:
          // member mode must not wait on (or fail because of) this lookup.
          api
            .getMe()
            .then((meResult) => {
              if (cancelled) return
              setMe(meResult)
              setOwnedCommunities(meResult.communities)
            })
            .catch(() => undefined)
          return
        }

        const me = await api.getMe()
        if (cancelled) return
        setMe(me)
        setOwnedCommunities(me.communities)

        if (!routeCommunityId && me.isFirstCommunityOSLogin) {
          setCheckoutIntent(null)
          setMode('publisher')
          setScreen('intro')
          return
        }

        if (!routeCommunityId) {
          setCheckoutIntent(null)
          setMode('publisher')
          setScreen('account')
          return
        }

        const targetId = routeCommunityId
        if (!targetId) {
          setMode('publisher')
          setScreen('account')
          return
        }
        const dashboard = await api.getDashboard(targetId)
        if (cancelled) return
        setCommunityId(dashboard.community.id)
        setData(normalizeDashboard(dashboard))
        setCheckoutIntent(null)
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
      } finally {
        if (!cancelled) setBooted(true)
      }
    }

    load()

    return () => {
      cancelled = true
    }
  }, [router.isReady, router.pathname, routeIdQuery, routeCommunityIdQuery, routePlanQuery, routeProductQuery, routeEventQuery, loadKey])

  useEffect(() => {
    if (!toast) return
    const timeout = window.setTimeout(() => setToast(null), Math.min(5000, Math.max(1800, toast.length * 60)))
    return () => window.clearTimeout(timeout)
  }, [toast])

  const member = memberProfile?.member ?? data?.members[0]
  const activePlan = createdPlan ?? data?.plans[0] ?? null
  const activeProduct = selectedProduct ?? createdProduct ?? data?.products[0] ?? null
  const activeEvent = selectedEvent ?? createdEvent ?? data?.events[0] ?? null
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

  async function selectCommunity(id: number, target: Screen = screenForModel(pendingModel)) {
    try {
      const dashboard = await api.getDashboard(id)
      setCommunityId(id)
      setData(normalizeDashboard(dashboard))
      setScreen(target)
    } catch (error: any) {
      showToast(error.message || 'Community could not be loaded')
    }
  }

  async function openMemberCommunity(id: number) {
    try {
      const profile = await api.getMemberProfile(id)
      setMemberProfile(profile)
      setCommunityId(profile.community.id)
      setData(dashboardFromMemberProfile(profile))
      setMode('member')
      setScreen('home')
    } catch (error: any) {
      showToast(error.message || 'Could not open community')
    }
  }

  async function switchToPublisherView() {
    setMemberProfile(null)
    setCheckoutIntent(null)
    setMode('publisher')
    const fallbackId = ownedCommunities.some((community) => community.id === communityId) ? communityId : ownedCommunities[0]?.id ?? null
    if (fallbackId) {
      await selectCommunity(fallbackId, 'home')
    } else {
      setCommunityId(null)
      setData(null)
      setScreen('account')
    }
  }

  async function finishIntro() {
    await api.completeOnboarding().catch(() => undefined)
    go('start')
  }

  function chooseRevenueModel(model: RevenueModel) {
    setPendingModel(model)
    api.completeOnboarding({ revenueModel: model }).catch(() => undefined)
    if (model === 'referral') {
      setReferralPresetTarget(null)
      setReferralMetric('joins')
      setCampaignTitle('Invite 3 members')
    }
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

  async function refreshMemberDashboard(targetCommunityId = communityId) {
    if (!targetCommunityId) return
    const profile = await api.getMemberProfile(targetCommunityId)
    setMemberProfile(profile)
    setData(dashboardFromMemberProfile(profile))
  }

  function editCommunityProfile() {
    if (!data) return
    setProfileName(data.community.name)
    setProfileHandle(data.community.handle || '')
    setProfileDescription(data.community.description || '')
    setProfileInviteUrl(data.community.telegramInviteUrl || '')
    go('communityProfile')
  }

  async function updateCommunityProfile(event?: FormEvent) {
    event?.preventDefault()
    if (!communityId || !profileName.trim()) return
    try {
      await api.updateCommunityProfile(communityId, {
        name: profileName.trim(),
        handle: profileHandle.trim() || null,
        description: profileDescription.trim() || null,
        telegramInviteUrl: profileInviteUrl.trim() || null,
      })
      await refreshDashboard()
      go('home')
      showToast('Community profile updated')
    } catch (error: any) {
      showToast(error.message || 'Profile update failed')
    }
  }

  async function createMembership(event?: FormEvent) {
    event?.preventDefault()
    if (!data || !communityId || !membershipTitle.trim() || submitting) return
    const stars = Math.max(1, Number(monthlyStars || 0))
    const body = {
      name: membershipTitle.trim(),
      description: membershipDescription.trim(),
      priceCents: starsToCents(stars),
      stars,
      interval: 'month',
      coverPath,
      buttonText: buttonText.trim() || 'Subscribe',
    }

    setSubmitting(true)
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

      const yStars = Number(yearlyStars || 0)
      if (yStars > 0) {
        await api.createPlan(communityId, {
          name: `${body.name} (Annual)`,
          description: body.description,
          priceCents: starsToCents(yStars),
          stars: yStars,
          interval: 'year',
          coverPath,
          buttonText: buttonText.trim() || 'Subscribe',
        }).catch(() => undefined)
      }

      await refreshDashboard()
      setScreen('publish')
      showToast('Membership created')
    } catch (error: any) {
      showToast(error.message || 'Membership creation failed')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleCoverFile(file: File | null) {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      showToast('Choose an image file')
      return
    }

    try {
      const result = await uploadAssetFile(file, 'cover')
      if (!result) return
      setCoverPath(result.asset.path)
      setCoverPreview(result.asset.url ?? result.dataUrl)
      setCoverName(result.asset.fileName)
      showToast('Cover uploaded')
    } catch (error: any) {
      showToast(error.message || 'Cover upload failed')
    }
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
    if (!communityId || !data || !productTitle.trim() || submitting) return
    setSubmitting(true)
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
    } finally {
      setSubmitting(false)
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
    if (!communityId || !data || !eventTitle.trim() || submitting) return
    setSubmitting(true)
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
    } finally {
      setSubmitting(false)
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

  async function suspendAccess(row: MemberRowDto) {
    if (!communityId) return
    try {
      await api.suspendAccess(communityId, row.id)
      await refreshDashboard()
      showToast(`Access suspended for @${row.username}`)
    } catch (error: any) {
      showToast(error.message || 'Access suspend failed')
    }
  }

  async function restoreAccess(row: MemberRowDto) {
    if (!communityId) return
    try {
      await api.restoreAccess(communityId, row.id)
      await refreshDashboard()
      showToast(`Access restored for @${row.username}`)
    } catch (error: any) {
      showToast(error.message || 'Access restore failed')
    }
  }

  async function decideJoinRequest(joinRequestId: number, decision: 'approve_join' | 'decline_join') {
    if (!communityId) return
    try {
      await api.decideJoinRequest(communityId, joinRequestId, decision)
      await refreshDashboard()
      showToast(decision === 'approve_join' ? 'Join request approved' : 'Join request declined')
    } catch (error: any) {
      showToast(error.message || 'Join request action failed')
    }
  }

  async function createCampaign(event: FormEvent) {
    event.preventDefault()
    if (!data || !communityId || !campaignTitle.trim()) return
    const body = {
      title: campaignTitle.trim(),
      reward: referralReward.trim() || 'Unlock bonus content',
      threshold: Math.max(1, Number(referralThreshold || 3)),
      metric: referralMetric,
      status: 'active' as const,
      ...(referralPresetTarget ? { targetType: referralPresetTarget.type, targetId: referralPresetTarget.id } : {}),
    }
    try {
      const { campaign } = await api.createReferralCampaign(communityId, body)
      setData({ ...data, referralCampaigns: [campaign, ...data.referralCampaigns] })
      setCampaignTitle('')
      setReferralPresetTarget(null)
      setReferralMetric('joins')
      setScreen('growth')
      showToast('Referral campaign created')
    } catch (error: any) {
      showToast(error.message || 'Campaign creation failed')
    }
  }

  function openReferralRewardForPlan(plan: PlanDto | null) {
    if (!plan) {
      showToast('Save the membership first')
      return
    }
    setReferralPresetTarget({ type: 'plan', id: plan.id, label: plan.name })
    setCampaignTitle(`Invite 3 friends to ${plan.name}`)
    setReferralMetric('joins')
    go('referralBuilder')
  }

  async function createRewardRule(event: FormEvent) {
    event.preventDefault()
    if (!data || !communityId || !rewardTitle.trim()) return
    const body = {
      title: rewardTitle.trim(),
      triggerType: rewardTriggerType,
      triggerCount: Math.max(1, Math.round(Number(rewardTriggerCount) || 1)),
      xpReward: 150,
      status: 'active' as const,
    }
    try {
      const { rule } = await api.createRewardRule(communityId, body)
      setData({ ...data, rewardRules: [rule, ...data.rewardRules] })
      setRewardTitle('')
      setRewardTriggerType('member_joined')
      setRewardTriggerCount('1')
      showToast('Reward rule created')
    } catch (error: any) {
      showToast(error.message || 'Reward rule creation failed')
    }
  }

  async function generateAiReport() {
    if (!data || !communityId) return
    setAiBusy(true)
    try {
      const { report } = await api.generateAiReport(communityId)
      setData({ ...data, ai: { ...data.ai, weeklyReportStatus: report.status } })
      showToast('Weekly report generated')
    } catch (error: any) {
      showToast(error.message || 'Report generation failed')
    } finally {
      setAiBusy(false)
    }
  }

  async function askAiQuestion(event: FormEvent) {
    event.preventDefault()
    if (!communityId || !aiQuestion.trim()) return
    setAiBusy(true)
    try {
      const { answer } = await api.askAi(communityId, aiQuestion.trim())
      setAiAnswer(answer)
    } catch (error: any) {
      showToast(error.message || 'AI request failed')
    } finally {
      setAiBusy(false)
    }
  }

  async function updateAiSetting(partial: Partial<DashboardDto['ai']['settings']>) {
    if (!data || !communityId) return
    try {
      const { settings } = await api.updateAiSettings(communityId, partial)
      setData({ ...data, ai: { ...data.ai, settings } })
    } catch (error: any) {
      showToast(error.message || 'Settings update failed')
    }
  }

  async function updateCommunitySetting(partial: Partial<{ starsCheckoutEnabled: boolean; notificationsEnabled: boolean }>) {
    if (!data || !communityId) return
    try {
      const { community } = await api.updateCommunityProfile(communityId, { settings: partial })
      setData({ ...data, community: { ...data.community, settings: community.settings ?? data.community.settings } })
    } catch (error: any) {
      showToast(error.message || 'Settings update failed')
    }
  }

  async function toggleCommentAccess() {
    if (!data || !communityId) return
    const next = !data.commentAccess.enabled
    if (!data.commentAccess.linked) {
      showToast('Link a discussion group to your channel first')
      return
    }
    if (data.commentAccess.discussionBotStatus !== 'admin') {
      showToast('Promote the bot to admin in your discussion group first')
      return
    }
    if (!window.confirm(`Turn ${next ? 'on' : 'off'} comment access? This applies to your whole channel, not just this item.`)) {
      return
    }
    try {
      const result = await api.setCommentAccess(communityId, next)
      if (!result.ok) {
        showToast(result.reason || 'Comment access update failed')
        return
      }
      setData({ ...data, commentAccess: { ...data.commentAccess, enabled: next } })
      showToast(`Comment access turned ${next ? 'on' : 'off'} for your whole channel`)
    } catch (error: any) {
      showToast(error.message || 'Comment access update failed')
    }
  }

  async function toggleAutoPosting(targetType: 'plan' | 'product' | 'event', targetId: number) {
    if (!data || !communityId) return
    const existing = data.scheduledPosts.find((post) => post.targetType === targetType && post.targetId === targetId) ?? null

    if (existing?.status === 'active') {
      try {
        const { scheduledPost } = await api.pauseAutoPosting(communityId, { targetType, targetId })
        setData({
          ...data,
          scheduledPosts: data.scheduledPosts.map((post) => (post.id === scheduledPost?.id ? scheduledPost : post)),
        })
        showToast('Auto-posting turned off')
      } catch (error: any) {
        showToast(error.message || 'Auto-posting update failed')
      }
      return
    }

    const input = window.prompt('Repost this every how many hours? (24 = daily, 168 = weekly)', String(existing?.intervalHours ?? 168))
    if (input === null) return
    const intervalHours = Math.max(1, Math.round(Number(input)) || 168)
    try {
      const { scheduledPost } = await api.activateAutoPosting(communityId, { targetType, targetId, intervalHours })
      setData({
        ...data,
        scheduledPosts: existing
          ? data.scheduledPosts.map((post) => (post.id === scheduledPost.id ? scheduledPost : post))
          : [...data.scheduledPosts, scheduledPost],
      })
      showToast(`Auto-posting turned on · every ${intervalHours}h`)
    } catch (error: any) {
      showToast(error.message || 'Auto-posting update failed')
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
    if (!activePlan?.id) {
      setScreen('createDetails')
      showToast('Create a membership before sharing a subscribe link')
      return
    }
    const link = membershipStartLink(communityId, activePlan.id)
    if (!link) {
      showToast('Set NEXT_PUBLIC_TELEGRAM_BOT_USERNAME first')
      return
    }
    await copyText(link).catch(() => false)
    showToast('Membership package link copied')
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
    const link = memberProfile?.referralLink || referralStartLink(communityId, member?.id)
    await copyOrOpenTelegramUrl(link, 'Referral link copied')
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

    // Remove any stale listener from a previous tap before adding a new one
    if (visibilityListenerRef.current) {
      document.removeEventListener('visibilitychange', visibilityListenerRef.current)
    }

    const onReturn = async () => {
      if (document.hidden) return
      document.removeEventListener('visibilitychange', onReturn)
      visibilityListenerRef.current = null
      try {
        const meData = await api.getMe()
        setMe(meData)
        setOwnedCommunities(meData.communities)
        if (meData.communities.length > 0) showToast('Community connected')
      } catch {}
    }

    visibilityListenerRef.current = onReturn
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
        const result = await api.unlockFreeProduct(communityId, product.id)
        await refreshMemberDashboard()
        if (result.product.deliveryUrl) {
          await copyText(result.product.deliveryUrl).catch(() => false)
          openExternalLink(result.product.deliveryUrl)
        } else if (result.product.deliveryText) {
          await copyText(result.product.deliveryText).catch(() => false)
        }
        showToast('Product unlocked')
        return
      }

      const response = await api.createInvoice(communityId, {
        kind: 'product',
        title: product.title,
        description: `${product.title} from ${data.community.name}`,
        stars: product.priceStars,
        productId: product.id,
      })
      if (response.invoice.invoiceLink) {
        openInvoiceLink(response.invoice.invoiceLink, async (status) => {
          showToast(paymentStatusMessage(status, product.title))
          if (status === 'paid') await refreshMemberDashboard()
        })
        showToast('Opening Telegram invoice')
      } else {
        showToast(response.invoice.invoiceError || 'Invoice stored, but the bot invoice link is not configured')
      }
    } catch (error: any) {
      showToast(error.message || 'Invoice creation failed')
    }
  }

  async function buyPlan(plan: PlanDto) {
    if (!communityId || !data) return
    const existingSubscription = memberProfile?.subscriptions.find(
      (subscription) => subscription.planId === plan.id && (subscription.status === 'active' || subscription.status === 'trialing')
    )
    if (existingSubscription) {
      await cancelSubscription(existingSubscription)
      return
    }
    try {
      const stars = plan.stars || Math.max(1, centsToStars(plan.priceCents))
      const response = await api.createInvoice(communityId, {
        kind: 'plan',
        planId: plan.id,
        title: plan.name,
        description: `${plan.name} membership for ${data.community.name}`,
        stars,
        interval: plan.interval,
      })
      if (response.invoice.invoiceLink) {
        openInvoiceLink(response.invoice.invoiceLink, async (status) => {
          showToast(paymentStatusMessage(status, plan.name))
          if (status === 'paid') await refreshMemberDashboard()
        })
        showToast('Opening Telegram invoice')
      } else {
        showToast(response.invoice.invoiceError || 'Invoice stored, but the bot invoice link is not configured')
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
          kind: 'event',
          title: event.title,
          description: `${event.title} from ${data.community.name}`,
          stars: event.priceStars,
          eventId: event.id,
        })
        if (response.invoice.invoiceLink) {
          openInvoiceLink(response.invoice.invoiceLink, async (status) => {
            showToast(paymentStatusMessage(status, event.title))
            if (status === 'paid') await refreshMemberDashboard()
          })
          showToast('Opening Telegram invoice')
        } else {
          showToast(response.invoice.invoiceError || 'Invoice stored, but the bot invoice link is not configured')
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

  async function cancelSubscription(subscription: SubscriptionDto) {
    if (!communityId) return
    const confirmed = window.confirm(`Cancel ${subscription.planName ?? 'this subscription'}? Access will be revoked.`)
    if (!confirmed) return
    try {
      await api.cancelSubscription(communityId, subscription.id)
      await refreshMemberDashboard()
      showToast('Subscription cancelled')
    } catch (error: any) {
      showToast(error.message || 'Subscription cancellation failed')
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
          <header className="tg-topbar centered">
            <div className="tg-title">
              <strong>CommunityOS</strong>
              <span>mini app</span>
            </div>
          </header>
          <section className="tg-screen centered">
            <div className="tg-hero-mark">TG</div>
            <h1>{heading}</h1>
            <p className="tg-subtitle">{detail}</p>
            {!isNotInTelegram && (
              <button
                className="tg-link-button"
                type="button"
                onClick={() => { setAuthError(null); setLoadKey((k) => k + 1) }}
              >
                Try again
              </button>
            )}
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
        {booted && screen === 'intro' ? (
          <IntroScreen
            index={introIndex}
            onBack={introIndex > 0 ? () => setIntroIndex((v) => v - 1) : undefined}
            onNext={() => {
              if (introIndex < introSlides.length - 1) setIntroIndex((v) => v + 1)
              else finishIntro()
            }}
          />
        ) : (
          <AppFrame
            hideBack={screen === 'start' || screen === 'account'}
            onBack={() => { if (screen === 'communities' || screen === 'more') go('account') }}
            rightLabel={screen === 'account' ? 'More' : undefined}
            onRightAction={screen === 'account' ? () => go('more') : undefined}
          >
            {screen === 'account' && me && (
              <AccountHome
                me={me}
                onSelectModel={chooseRevenueModel}
                onOpenCommunity={(id) => selectCommunity(id, 'home')}
                onAddCommunity={handleAddCommunity}
              />
            )}
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
            {screen === 'more' && me && (
              <MoreScreen
                me={me}
                onToast={showToast}
                onOpenCommunity={(id) => selectCommunity(id, 'home')}
                onOpenMemberCommunity={openMemberCommunity}
              />
            )}
            {screen !== 'account' && screen !== 'start' && screen !== 'communities' && screen !== 'more' && (
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

      {mode === 'member' && screen === 'offerWizard' && checkoutIntent && data ? (
        <OfferWizard
          intent={checkoutIntent}
          data={data}
          step={wizardStep}
          onStep={setWizardStep}
          onComplete={() => {
            setWizardCompleted(true)
            go('home')
          }}
          onCancel={() => {
            setCheckoutIntent(null)
            setWizardCompleted(false)
            go('home')
          }}
        />
      ) : mode === 'member' ? (
        <AppFrame
          hideBack={screen === 'home'}
          onBack={() => go('home')}
          rightLabel={ownedCommunities.length > 0 ? 'Publisher view' : undefined}
          onRightAction={ownedCommunities.length > 0 ? switchToPublisherView : undefined}
        >
          <MemberHome
            data={data}
            member={member}
            checkoutIntent={checkoutIntent}
            subscriptions={memberProfile?.subscriptions ?? []}
            purchases={memberProfile?.purchases ?? []}
            onReferral={copyReferralLink}
            onSupport={openSupport}
            onBuyPlan={buyPlan}
            onBuyProduct={buyProduct}
            onEvent={registerOrBuyEvent}
            onCancelSubscription={cancelSubscription}
            onToast={showToast}
          />
        </AppFrame>
      ) : screen === 'intro' ? (
        <IntroScreen
          index={introIndex}
          onBack={introIndex > 0 ? () => setIntroIndex((value) => value - 1) : undefined}
          onNext={() => {
            if (introIndex < introSlides.length - 1) {
              setIntroIndex((value) => value + 1)
            } else {
              finishIntro()
            }
          }}
        />
      ) : screen === 'shareGuide' ? (
        <ShareGuide onBack={() => go('publish')} onDone={() => go('home')} />
      ) : (
        <AppFrame
          hideBack={screen === 'start'}
          onBack={() => {
            const previous: Record<Screen, Screen> = {
              intro: 'intro',
              start: 'intro',
              account: 'account',
              communities: 'start',
              home: 'account',
              members: 'home',
              access: 'home',
              growth: 'home',
              rewards: 'home',
              more: 'home',
              createDetails: 'home',
              publish: 'home',
              shareGuide: 'publish',
              productBuilder: 'home',
              productPublish: 'productBuilder',
              eventBuilder: 'home',
              eventPublish: 'eventBuilder',
              referralBuilder: 'growth',
              communityProfile: 'home',
              offerWizard: 'home',
              aiManager: 'more',
              settings: 'more',
            }
            go(previous[screen])
          }}
          rightLabel={screen === 'home' || screen === 'account' ? 'More' : undefined}
          onRightAction={screen === 'home' || screen === 'account' ? () => go('more') : undefined}
        >
          {screen === 'start' && <StartPicker onSelect={go} onSelectModel={chooseRevenueModel} />}
          {screen === 'account' && me && (
            <AccountHome
              me={me}
              onSelectModel={chooseRevenueModel}
              onOpenCommunity={(id) => selectCommunity(id, 'home')}
              onAddCommunity={handleAddCommunity}
            />
          )}
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
              onNavigate={go}
              onCreateMembership={() => go('createDetails')}
              onShareCommunity={shareCommunity}
              onSelectModel={chooseRevenueModel}
              onEditProfile={editCommunityProfile}
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
          {screen === 'members' && <MembersScreen members={data.members} onGrant={grantAccess} onRevoke={revokeAccess} onSuspend={suspendAccess} onRestore={restoreAccess} />}
          {screen === 'access' && (
            <AccessScreen
              data={data}
              onGrant={grantAccess}
              onRevoke={revokeAccess}
              onSuspend={suspendAccess}
              onRestore={restoreAccess}
              onDecideJoin={decideJoinRequest}
              onSync={syncAccessNow}
            />
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
              triggerType={rewardTriggerType}
              onTriggerType={setRewardTriggerType}
              triggerCount={rewardTriggerCount}
              onTriggerCount={setRewardTriggerCount}
              onCreateReward={createRewardRule}
            />
          )}
          {screen === 'more' && (
            <MoreScreen
              data={data}
              onToast={showToast}
              onNavigate={go}
              onCreateEvent={() => go('eventBuilder')}
              onCreateProduct={() => go('productBuilder')}
              onOpenAiManager={() => go('aiManager')}
              onOpenSettings={() => go('settings')}
            />
          )}
          {screen === 'settings' && <SettingsScreen data={data} onUpdateSetting={updateCommunitySetting} />}
          {screen === 'aiManager' && (
            <AiManagerScreen
              data={data}
              question={aiQuestion}
              answer={aiAnswer}
              busy={aiBusy}
              onQuestion={setAiQuestion}
              onAsk={askAiQuestion}
              onGenerateReport={generateAiReport}
              onUpdateSettings={updateAiSetting}
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
              submitting={submitting}
            />
          )}
          {screen === 'productPublish' && activeProduct && (
            <RevenuePublishScreen
              kind="product"
              title={activeProduct.title}
              description={activeProduct.description ?? productDescription}
              price={xtrLabel(activeProduct.priceStars)}
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
              submitting={submitting}
            />
          )}
          {screen === 'eventPublish' && activeEvent && (
            <RevenuePublishScreen
              kind="event"
              title={activeEvent.title}
              description={activeEvent.description ?? eventDescription}
              price={xtrLabelOrFree(activeEvent.priceStars ?? 0)}
              coverUrl={activeEvent.coverUrl ?? eventCover.preview}
              primaryLabel="Share Event"
              onEdit={() => go('eventBuilder')}
              onShare={shareEventCard}
              onDelete={deleteEventOffer}
              onToast={showToast}
            />
          )}
          {screen === 'referralBuilder' && (
            <ReferralWizardScreen
              campaignTitle={campaignTitle}
              threshold={referralThreshold}
              reward={referralReward}
              metric={referralMetric}
              presetLabel={referralPresetTarget?.label ?? null}
              onCampaignTitle={setCampaignTitle}
              onThreshold={setReferralThreshold}
              onReward={setReferralReward}
              onMetric={setReferralMetric}
              onClearPreset={() => setReferralPresetTarget(null)}
              onCancel={() => {
                setReferralPresetTarget(null)
                go('growth')
              }}
              onSubmit={createCampaign}
            />
          )}
          {screen === 'communityProfile' && (
            <CommunityProfileScreen
              name={profileName}
              handle={profileHandle}
              description={profileDescription}
              inviteUrl={profileInviteUrl}
              onName={setProfileName}
              onHandle={setProfileHandle}
              onDescription={setProfileDescription}
              onInviteUrl={setProfileInviteUrl}
              onCancel={() => go('home')}
              onSubmit={updateCommunityProfile}
            />
          )}
          {screen === 'createDetails' && (
            <MembershipBuilderScreen
              title={membershipTitle}
              description={membershipDescription}
              buttonText={buttonText}
              coverPreview={coverPreview}
              coverName={coverName}
              monthlyStars={monthlyStars}
              yearlyStars={yearlyStars}
              onTitle={setMembershipTitle}
              onDescription={setMembershipDescription}
              onButtonText={setButtonText}
              onCoverFile={handleCoverFile}
              onMonthlyStars={setMonthlyStars}
              onYearlyStars={setYearlyStars}
              onCancel={() => go('home')}
              onSubmit={createMembership}
              submitting={submitting}
            />
          )}
          {screen === 'publish' && (
            <PublishScreen
              community={data.community}
              plan={activePlan}
              title={membershipTitle}
              description={membershipDescription}
              onEdit={() => go('createDetails')}
              coverPreview={activePlan?.coverUrl ?? coverPreview}
              onShare={shareMembershipCard}
              onGuide={() => go('shareGuide')}
              onCopyLink={copyMembershipLink}
              onDelete={deleteMembershipPackage}
              onReferralReward={() => openReferralRewardForPlan(activePlan)}
              commentAccess={data.commentAccess}
              onToggleCommentAccess={toggleCommentAccess}
              autoPost={activePlan ? data.scheduledPosts.find((post) => post.targetType === 'plan' && post.targetId === activePlan.id) ?? null : null}
              onToggleAutoPosting={() => activePlan && toggleAutoPosting('plan', activePlan.id)}
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
  children,
  hideBack,
  onBack,
  rightLabel,
  onRightAction,
}: {
  children: React.ReactNode
  hideBack?: boolean
  onBack?: () => void
  rightLabel?: string
  onRightAction?: () => void
}) {
  return (
    <main className="tg-app">
      <header className="tg-topbar">
        {!hideBack && (
          <button className="tg-nav-button" type="button" onClick={onBack} aria-label="Back">
            Back
          </button>
        )}
        {rightLabel && onRightAction && (
          <button className="tg-nav-button tg-nav-button-right" type="button" onClick={onRightAction}>
            {rightLabel}
          </button>
        )}
      </header>
      {children}
    </main>
  )
}

function IntroScreen({ index, onBack, onNext }: { index: number; onBack?: () => void; onNext: () => void }) {
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

function StartPicker({ onSelect, onSelectModel }: { onSelect: (screen: Screen) => void; onSelectModel: (model: RevenueModel) => void }) {
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

function nextActionIcon(target: NextAction['target']): IconName {
  switch (target) {
    case 'access':
      return 'access'
    case 'growth':
      return 'growth'
    case 'rewards':
      return 'rewards'
    case 'members':
      return 'group'
    case 'share':
      return 'share'
    case 'setup':
      return 'membership'
    case 'more':
    default:
      return 'settings'
  }
}

function NextActionCard({
  title,
  detail,
  cta,
  icon,
  onClick,
}: {
  title: string
  detail: string
  cta: string
  icon: IconName
  onClick: () => void
}) {
  return (
    <section className="tg-callout">
      <div className="tg-next-action-head">
        <span className="tg-next-action-icon">
          <RowIcon name={icon} />
        </span>
        <span>NEXT ACTION</span>
      </div>
      <h2>{title}</h2>
      <p>{detail}</p>
      <button type="button" onClick={onClick}>
        {cta}
      </button>
    </section>
  )
}

function RevenueSnapshotRow({
  items,
}: {
  items: { key: string; icon: IconName; label: string; count?: number; onClick: () => void }[]
}) {
  return (
    <div className="tg-revenue-grid">
      {items.map((item) => (
        <button key={item.key} className="tg-revenue-card" type="button" onClick={item.onClick}>
          <span className="tg-revenue-icon">
            <RowIcon name={item.icon} />
          </span>
          {typeof item.count === 'number' && <strong>{item.count}</strong>}
          <small>{item.label}</small>
        </button>
      ))}
    </div>
  )
}

function AccountHome({
  me,
  onSelectModel,
  onOpenCommunity,
  onAddCommunity,
}: {
  me: MeDto
  onSelectModel: (model: RevenueModel) => void
  onOpenCommunity: (id: number) => void
  onAddCommunity: () => void
}) {
  const nextAction = computeAccountNextAction(me)
  return (
    <section className="tg-screen with-fixed-button">
      <div className="tg-community-header">
        <AvatarMark className="tg-large-avatar" image={me.avatarUrl} label={me.username ?? 'CommunityOS'} />
        <h1>{me.username ? `@${me.username}` : 'CommunityOS'}</h1>
        <p>{me.accountStats.communities} owned communities</p>
        <div className="tg-mini-stats">
          <span>{me.accountStats.balanceStars.toLocaleString()} XTR balance</span>
          <span>{me.accountStats.totalMembers} members</span>
        </div>
      </div>

      {nextAction && (
        <NextActionCard
          title={nextAction.title}
          detail={nextAction.detail}
          cta={nextAction.cta}
          icon={nextAction.target === 'addCommunity' ? 'channel' : 'business'}
          onClick={() => {
            if (nextAction.target === 'addCommunity') onAddCommunity()
            else onOpenCommunity(me.communities[0].id)
          }}
        />
      )}

      <RevenueSnapshotRow
        items={[
          { key: 'membership', icon: 'membership', label: 'Memberships', onClick: () => onSelectModel('membership') },
          { key: 'product', icon: 'product', label: 'Products', onClick: () => onSelectModel('product') },
          { key: 'event', icon: 'event', label: 'Events', onClick: () => onSelectModel('event') },
          { key: 'referral', icon: 'referral', label: 'Referrals', onClick: () => onSelectModel('referral') },
        ]}
      />

      <FixedButton label={me.communities.length ? 'Add Community' : 'Connect Telegram'} onClick={onAddCommunity} />
    </section>
  )
}

function CommunityHome({
  data,
  onNavigate,
  onCreateMembership,
  onShareCommunity,
  onSelectModel,
  onOpenProduct,
  onOpenEvent,
  onEditProfile,
}: {
  data: DashboardDto
  onNavigate: (screen: Screen) => void
  onCreateMembership: () => void
  onShareCommunity: () => void
  onSelectModel: (model: RevenueModel) => void
  onOpenProduct: (product: ProductDto) => void
  onOpenEvent: (event: EventDto) => void
  onEditProfile: () => void
}) {
  const nextAction = computeNextAction(data)
  return (
    <section className="tg-screen with-fixed-button">
      <CommunityHeader data={data} onEdit={onEditProfile} />

      {nextAction && (
        <NextActionCard
          title={nextAction.title}
          detail={nextAction.detail}
          cta={nextAction.cta}
          icon={nextActionIcon(nextAction.target)}
          onClick={() => {
            if (nextAction.target === 'setup') onCreateMembership()
            else if (nextAction.target === 'share') onShareCommunity()
            else onNavigate(nextAction.target as Screen)
          }}
        />
      )}

      <RevenueSnapshotRow
        items={[
          { key: 'membership', icon: 'membership', label: 'Memberships', count: data.plans.length, onClick: onCreateMembership },
          { key: 'product', icon: 'product', label: 'Products', count: data.products.length, onClick: () => onSelectModel('product') },
          { key: 'event', icon: 'event', label: 'Events', count: data.events.length, onClick: () => onSelectModel('event') },
          { key: 'referral', icon: 'referral', label: 'Referrals', count: data.referralCampaigns.length, onClick: () => onSelectModel('referral') },
        ]}
      />

      <SectionLabel>Memberships</SectionLabel>
      <ListGroup>
        {data.plans.map((plan) => (
          <ListRow
            key={plan.id}
            tone="blue"
            icon="membership"
            image={plan.coverUrl}
            title={plan.name}
            detail={`${plan.subscribers} subscribers`}
            meta={xtrLabel(plan.stars || centsToStars(plan.priceCents))}
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
            icon="product"
            image={product.coverUrl}
            title={product.title}
            detail={`${product.type.replace('_', ' ')} · ${product.purchases} purchases`}
            meta={xtrLabel(product.priceStars)}
            onClick={() => onOpenProduct(product)}
          />
        ))}
        {data.products.length === 0 && <ListRow tone="red" icon="product" title="Create Digital Product" detail="Sell files, links, courses, or consultations." onClick={() => onSelectModel('product')} />}
      </ListGroup>

      <SectionLabel>Events</SectionLabel>
      <ListGroup>
        {data.events.slice(0, 3).map((event) => (
          <ListRow
            key={event.id}
            tone="purple"
            icon="event"
            image={event.coverUrl}
            title={event.title}
            detail={`${event.type} · ${dateShort(event.startsAt)}`}
            meta={xtrLabelOrFree(event.priceStars ?? 0)}
            onClick={() => onOpenEvent(event)}
          />
        ))}
        {data.events.length === 0 && <ListRow tone="purple" icon="event" title="Create Event or AMA" detail="Sell tickets or collect registrations." onClick={() => onSelectModel('event')} />}
      </ListGroup>

      <FixedButton label={data.plans.length ? 'Share' : 'Create Membership'} onClick={data.plans.length ? onShareCommunity : onCreateMembership} />
    </section>
  )
}

function CommunityHeader({ data, onEdit }: { data: DashboardDto; onEdit?: () => void }) {
  return (
    <section className="tg-community-header">
      <button className="tg-header-edit-button" type="button" onClick={onEdit} title="Edit profile">
        ✎
      </button>
      <AvatarMark className="tg-large-avatar" image={data.community.avatarUrl} label={data.community.name} />
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
  onSuspend,
  onRestore,
}: {
  members: MemberRowDto[]
  onGrant: (member: MemberRowDto) => void
  onRevoke: (member: MemberRowDto) => void
  onSuspend: (member: MemberRowDto) => void
  onRestore: (member: MemberRowDto) => void
}) {
  return (
    <section className="tg-screen">
      <h1 className="tg-left-title">Members</h1>
      <ListGroup>
        {members.map((member) => (
          <MemberRow key={member.id} member={member} onGrant={() => onGrant(member)} onRevoke={() => onRevoke(member)} onSuspend={() => onSuspend(member)} onRestore={() => onRestore(member)} />
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
  onSuspend,
  onRestore,
  onDecideJoin,
  onSync,
}: {
  data: DashboardDto
  onGrant: (member: MemberRowDto) => void
  onRevoke: (member: MemberRowDto) => void
  onSuspend: (member: MemberRowDto) => void
  onRestore: (member: MemberRowDto) => void
  onDecideJoin: (joinRequestId: number, decision: 'approve_join' | 'decline_join') => void
  onSync: () => void
}) {
  const pendingMembers = data.members.filter((member) => member.accessStatus !== 'granted')
  const pendingJoins = data.joinRequests.filter((request) => request.status === 'pending')
  return (
    <section className="tg-screen with-fixed-button">
      <h1 className="tg-left-title">Access</h1>
      <SectionLabel>Connected Telegram</SectionLabel>
      <ListGroup>
        {data.chats.map((chat) => <ChatRow key={chat.id} chat={chat} image={data.community.avatarUrl} />)}
        {data.chats.length === 0 && <EmptyBlock title="No group connected" detail="Add the bot as admin in a Telegram group or channel." />}
      </ListGroup>
      <SectionLabel>Pending Access</SectionLabel>
      <ListGroup>
        {pendingMembers.map((member) => (
          <MemberRow key={member.id} member={member} onGrant={() => onGrant(member)} onRevoke={() => onRevoke(member)} onSuspend={() => onSuspend(member)} onRestore={() => onRestore(member)} compact />
        ))}
        {pendingMembers.length === 0 && <EmptyBlock title="Access is clean" detail="No pending grants or failed syncs right now." />}
      </ListGroup>
      <SectionLabel>Join Requests</SectionLabel>
      <ListGroup>
        {pendingJoins.map((request) => (
          <JoinRequestRow
            key={request.id}
            request={request}
            onApprove={() => onDecideJoin(request.id, 'approve_join')}
            onDecline={() => onDecideJoin(request.id, 'decline_join')}
          />
        ))}
        {pendingJoins.length === 0 && <EmptyBlock title="No join requests" detail="Telegram join requests will appear here when access requires review." />}
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
  function targetLabel(campaign: ReferralCampaignDto) {
    if (!campaign.targetType || !campaign.targetId) return null
    const source = campaign.targetType === 'plan' ? data.plans : campaign.targetType === 'product' ? data.products : data.events
    const item = (source as ({ id: number } & Record<string, any>)[]).find((row) => row.id === campaign.targetId)
    return item ? item.name ?? item.title ?? null : null
  }
  const itemCampaigns = data.referralCampaigns.filter((campaign) => campaign.targetType && campaign.targetId)
  const communityCampaigns = data.referralCampaigns.filter((campaign) => !campaign.targetType || !campaign.targetId)
  return (
    <section className="tg-screen">
      <h1 className="tg-left-title">Growth</h1>
      <form className="tg-form-card" onSubmit={onCreateCampaign}>
        <SectionLabel>Create Referral Campaign</SectionLabel>
        <input value={campaignTitle} onChange={(event) => onCampaignTitle(event.target.value)} />
        <p>Invite 3 friends, unlock bonus content.</p>
        <button type="submit">Create Campaign</button>
      </form>
      {itemCampaigns.length > 0 && (
        <>
          <SectionLabel>For specific items</SectionLabel>
          <ListGroup>
            {itemCampaigns.map((campaign) => (
              <ListRow
                key={campaign.id}
                tone="green"
                icon="referral"
                title={campaign.title}
                detail={`${targetLabel(campaign) ?? 'Item'} · ${campaign.clicks} clicks, ${campaign.joins} joins, ${campaign.purchases} purchases`}
                meta={money(campaign.revenueCents)}
              />
            ))}
          </ListGroup>
        </>
      )}
      <SectionLabel>Community-wide</SectionLabel>
      <ListGroup>
        {communityCampaigns.map((campaign) => (
          <ListRow
            key={campaign.id}
            tone="green"
            icon="referral"
            title={campaign.title}
            detail={`${campaign.clicks} clicks, ${campaign.joins} joins, ${campaign.purchases} purchases`}
            meta={money(campaign.revenueCents)}
          />
        ))}
        {communityCampaigns.length === 0 && <EmptyBlock title="No campaigns yet" detail="Create a reward loop for invites, joins, and purchases." />}
      </ListGroup>
    </section>
  )
}

const REWARD_TRIGGER_OPTIONS: { value: RewardTriggerType; label: string }[] = [
  { value: 'member_joined', label: 'Member joins the community' },
  { value: 'referral_joined', label: 'Referred member joins' },
  { value: 'referral_activated', label: 'Referred member activates' },
  { value: 'purchase_completed', label: 'Member completes a purchase' },
  { value: 'event_registered', label: 'Member registers for an event' },
  { value: 'manual', label: 'Manual unlock' },
]

function RewardsScreen({
  data,
  rewardTitle,
  onRewardTitle,
  triggerType,
  onTriggerType,
  triggerCount,
  onTriggerCount,
  onCreateReward,
}: {
  data: DashboardDto
  rewardTitle: string
  onRewardTitle: (value: string) => void
  triggerType: RewardTriggerType
  onTriggerType: (value: RewardTriggerType) => void
  triggerCount: string
  onTriggerCount: (value: string) => void
  onCreateReward: (event: FormEvent) => void
}) {
  return (
    <section className="tg-screen">
      <h1 className="tg-left-title">Rewards</h1>
      <form className="tg-form-card" onSubmit={onCreateReward}>
        <SectionLabel>Create Reward Rule</SectionLabel>
        <input value={rewardTitle} onChange={(event) => onRewardTitle(event.target.value)} aria-label="Reward rule title" />
        <label>
          <span>Trigger</span>
          <select value={triggerType} onChange={(event) => onTriggerType(event.target.value as RewardTriggerType)}>
            {REWARD_TRIGGER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        {triggerType !== 'manual' && (
          <label>
            <span>After how many times</span>
            <input
              type="number"
              min={1}
              value={triggerCount}
              onChange={(event) => onTriggerCount(event.target.value)}
              aria-label="Trigger count"
            />
          </label>
        )}
        <p>Grant XP, points, levels, badges, or perks when members complete an action.</p>
        <button type="submit">Create Reward</button>
      </form>
      <SectionLabel>Rules</SectionLabel>
      <ListGroup>
        {data.rewardRules.map((rule) => (
          <ListRow key={rule.id} tone="amber" icon="rewards" title={rule.title} detail={`${rule.trigger}. ${rule.reward}`} meta={rule.status} />
        ))}
        {data.rewardRules.length === 0 && <EmptyBlock title="No reward rules yet" detail="Create an XP or badge rule to keep members engaged." />}
      </ListGroup>
    </section>
  )
}

function MoreScreen({
  data,
  me,
  onToast,
  onCreateEvent,
  onCreateProduct,
  onOpenAiManager,
  onOpenSettings,
  onNavigate,
  onOpenCommunity,
  onOpenMemberCommunity,
}: {
  data?: DashboardDto
  me?: MeDto
  onToast: (message: string) => void
  onCreateEvent?: () => void
  onCreateProduct?: () => void
  onOpenAiManager?: () => void
  onOpenSettings?: () => void
  onNavigate?: (screen: Screen) => void
  onOpenCommunity?: (id: number) => void
  onOpenMemberCommunity?: (id: number) => void
}) {
  const router = useRouter()
  return (
    <section className="tg-screen">
      <h1 className="tg-left-title">More</h1>

      {data && (
        <>
          <ListGroup>
            <ListRow tone="amber" icon="ai" title="AI Community Manager" detail={`${data.ai.faqCount} FAQ answers, report ${data.ai.weeklyReportStatus}`} onClick={onOpenAiManager} />
            <ListRow tone="purple" icon="event" title="Events" detail={`${data.events.length} events`} onClick={onCreateEvent} />
            <ListRow tone="red" icon="product" title="Products and Services" detail={`${data.products.length} products`} onClick={onCreateProduct} />
            <ListRow tone="blue" icon="settings" title="Settings" detail="Bot permissions, Stars checkout, notifications" onClick={onOpenSettings} />
          </ListGroup>

          <SectionLabel>Operations</SectionLabel>
          <ListGroup>
            <ListRow tone="green" icon="access" title="Access" detail={`${data.metrics.accessIssues} issues need review`} onClick={() => onNavigate?.('access')} />
            <ListRow tone="purple" icon="growth" title="Growth" detail={`${data.metrics.referralActivations} referral activations`} onClick={() => onNavigate?.('growth')} />
            <ListRow tone="amber" icon="rewards" title="Rewards" detail={`${data.rewardRules.length} reward rules`} onClick={() => onNavigate?.('rewards')} />
          </ListGroup>

          <SectionLabel>Recent Activity</SectionLabel>
          <ListGroup>
            {data.activity.slice(0, 4).map((item) => (
              <ListRow key={item.id} title={item.title} detail={dateShort(item.createdAt)} />
            ))}
            {data.activity.length === 0 && <EmptyBlock title="No activity yet" detail="Payments, joins, access changes, and reward grants will show here." />}
          </ListGroup>

          <SectionLabel>Events</SectionLabel>
          <ListGroup>
            {data.events.map((event) => (
              <ListRow key={event.id} title={event.title} detail={`${event.type} on ${dateShort(event.startsAt)}`} meta={xtrLabelOrFree(event.priceStars ?? 0)} />
            ))}
            {data.events.length === 0 && <EmptyBlock title="No events yet" detail="Create webinars, AMAs, meetups, or challenges." />}
          </ListGroup>

          <SectionLabel>Products</SectionLabel>
          <ListGroup>
            {data.products.map((product) => (
              <ListRow key={product.id} title={product.title} detail={`${product.type.replace('_', ' ')}. ${product.purchases} purchases`} meta={xtrLabel(product.priceStars)} />
            ))}
            {data.products.length === 0 && <EmptyBlock title="No products yet" detail="Sell courses, downloads, premium content, and consultations." />}
          </ListGroup>
        </>
      )}

      {me && (
        <>
          <SectionLabel>Account</SectionLabel>
          <ListGroup>
            <ListRow tone="blue" icon="stars" title="Stars Revenue" detail={`${me.accountStats.monthlyStars.toLocaleString()} XTR collected`} meta={`${me.accountStats.activeSubscriptions} subs`} />
            <ListRow tone={me.accountStats.accessIssues > 0 ? 'amber' : 'green'} icon="access" title="Access Health" detail={`${me.accountStats.accessIssues} access issue(s)`} />
          </ListGroup>

          <SectionLabel>Your Communities</SectionLabel>
          <ListGroup>
            {me.communities.map((community) => (
              <ListRow
                key={community.id}
                avatar={initials(community.name)}
                image={community.avatarUrl}
                title={community.name}
                detail={`${community.status === 'active' ? 'Active' : 'Setup'} community`}
                onClick={() => onOpenCommunity?.(community.id)}
              />
            ))}
            {me.communities.length === 0 && <EmptyBlock title="No community connected" detail="Add the bot to a group or channel to start." />}
          </ListGroup>

          {me.memberCommunities.length > 0 && (
            <>
              <SectionLabel>Member Access</SectionLabel>
              <ListGroup>
                {me.memberCommunities.map((community) => (
                  <ListRow
                    key={community.id}
                    avatar={initials(community.name)}
                    image={community.avatarUrl}
                    title={community.name}
                    detail="Open member view"
                    onClick={() => onOpenMemberCommunity?.(community.id)}
                  />
                ))}
              </ListGroup>
            </>
          )}
        </>
      )}

      <SectionLabel>Developer tools</SectionLabel>
      <ListGroup>
        <ListRow title="Restart intro" detail="Replay the onboarding walkthrough" onClick={() => router.push('/')} />
        {data && <ListRow title="Member preview" detail="See this community the way a member does" onClick={() => router.push(`/member/${data.community.id}`)} />}
        {me?.isPlatformAdmin && <ListRow title="Platform admin" detail="Open the CommunityOS admin dashboard" onClick={() => router.push('/admin')} />}
      </ListGroup>
    </section>
  )
}

function SettingsScreen({
  data,
  onUpdateSetting,
}: {
  data: DashboardDto
  onUpdateSetting: (partial: Partial<{ starsCheckoutEnabled: boolean; notificationsEnabled: boolean }>) => void
}) {
  const settings = data.community.settings ?? { starsCheckoutEnabled: true, notificationsEnabled: true }
  return (
    <section className="tg-screen">
      <h1 className="tg-left-title">Settings</h1>
      <SectionLabel>Bot connection</SectionLabel>
      <ListGroup>
        {data.chats.map((chat) => <ChatRow key={chat.id} chat={chat} image={data.community.avatarUrl} />)}
        {data.chats.length === 0 && <EmptyBlock title="No group connected" detail="Add the bot as admin in a Telegram group or channel, then share a membership to confirm the connection." />}
      </ListGroup>
      <SectionLabel>Checkout and notifications</SectionLabel>
      <ListGroup>
        <ListRow
          title="Stars checkout"
          detail="Let members pay with Telegram Stars"
          meta={settings.starsCheckoutEnabled ? 'on' : 'off'}
          onClick={() => onUpdateSetting({ starsCheckoutEnabled: !settings.starsCheckoutEnabled })}
        />
        <ListRow
          title="Notifications"
          detail="Bot messages for renewals, access changes, and join requests"
          meta={settings.notificationsEnabled ? 'on' : 'off'}
          onClick={() => onUpdateSetting({ notificationsEnabled: !settings.notificationsEnabled })}
        />
      </ListGroup>
    </section>
  )
}

function AiManagerScreen({
  data,
  question,
  answer,
  busy,
  onQuestion,
  onAsk,
  onGenerateReport,
  onUpdateSettings,
}: {
  data: DashboardDto
  question: string
  answer: string | null
  busy: boolean
  onQuestion: (value: string) => void
  onAsk: (event: FormEvent) => void
  onGenerateReport: () => void
  onUpdateSettings: (partial: Partial<DashboardDto['ai']['settings']>) => void
}) {
  const { settings } = data.ai
  return (
    <section className="tg-screen">
      <h1 className="tg-left-title">AI Community Manager</h1>

      <SectionLabel>Weekly Report</SectionLabel>
      <div className="tg-form-card">
        <p>Status: {data.ai.weeklyReportStatus}</p>
        <button type="button" onClick={onGenerateReport} disabled={busy}>
          {busy ? 'Working…' : 'Generate Report'}
        </button>
      </div>

      <SectionLabel>Ask AI</SectionLabel>
      <form className="tg-form-card" onSubmit={onAsk}>
        <input
          value={question}
          onChange={(event) => onQuestion(event.target.value)}
          placeholder="Ask a question a member might ask"
        />
        <button type="submit" disabled={busy || !question.trim()}>
          {busy ? 'Asking…' : 'Ask'}
        </button>
        {answer && <p>{answer}</p>}
      </form>

      <SectionLabel>Settings</SectionLabel>
      <ListGroup>
        <ListRow
          title="FAQ answers"
          detail={`${data.ai.faqCount} curated entries`}
          meta={settings.faqEnabled ? 'on' : 'off'}
          onClick={() => onUpdateSettings({ faqEnabled: !settings.faqEnabled })}
        />
        <ListRow
          title="Welcome messages"
          detail="Greet members on their first access grant"
          meta={settings.welcomeEnabled ? 'on' : 'off'}
          onClick={() => onUpdateSettings({ welcomeEnabled: !settings.welcomeEnabled })}
        />
        <ListRow
          title="Weekly reports"
          detail="Summarize activity for the owner each week"
          meta={settings.reportsEnabled ? 'on' : 'off'}
          onClick={() => onUpdateSettings({ reportsEnabled: !settings.reportsEnabled })}
        />
      </ListGroup>

      <SectionLabel>Tone</SectionLabel>
      <div className="tg-form-card">
        <select value={settings.tone} onChange={(event) => onUpdateSettings({ tone: event.target.value })}>
          <option value="friendly">Friendly</option>
          <option value="professional">Professional</option>
          <option value="casual">Casual</option>
          <option value="concise">Concise</option>
        </select>
      </div>
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
  submitting,
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
  submitting?: boolean
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
        {Number(priceStars) > 0 && <small className="tg-input-hint">≈ {formatUsdApprox(Number(priceStars))} for buyers</small>}
        <input value={buttonText} onChange={(event) => onButtonText(event.target.value)} aria-label="Button text" />
      </div>
      <PreviewCard title={title} description={description} buttonText={buttonText || 'Buy'} coverUrl={cover.preview} />
      <FixedButton label="Create Product" submit disabled={submitting} />
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
  submitting,
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
  submitting?: boolean
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
        {Number(priceStars) > 0 && <small className="tg-input-hint">≈ {formatUsdApprox(Number(priceStars))} for buyers</small>}
      </div>
      <PreviewCard title={title} description={description} buttonText={Number(priceStars) > 0 ? 'Get Ticket' : 'Register'} coverUrl={cover.preview} />
      <FixedButton label="Create Event" submit disabled={submitting} />
    </form>
  )
}

const REFERRAL_METRICS: { value: 'joins' | 'purchases' | 'revenue'; title: string; detail: string }[] = [
  { value: 'joins', title: 'Invite members', detail: 'Reward members when their invites join the community.' },
  { value: 'purchases', title: 'Drive purchases', detail: 'Reward members when their invites make a purchase.' },
  { value: 'revenue', title: 'Grow revenue', detail: 'Reward members based on the revenue their invites generate.' },
]

function referralThresholdLabel(metric: 'joins' | 'purchases' | 'revenue') {
  if (metric === 'purchases') return 'Purchase target'
  if (metric === 'revenue') return 'Revenue target (XTR)'
  return 'Invite milestone'
}

function referralGoalCopy(metric: 'joins' | 'purchases' | 'revenue', threshold: string) {
  const count = threshold || '3'
  if (metric === 'purchases') return `Drive ${count} purchases`
  if (metric === 'revenue') return `Reach ${count} XTR revenue`
  return `Invite ${count} members`
}

function ReferralWizardScreen({
  campaignTitle,
  threshold,
  reward,
  metric,
  presetLabel,
  onCampaignTitle,
  onThreshold,
  onReward,
  onMetric,
  onClearPreset,
  onCancel,
  onSubmit,
}: {
  campaignTitle: string
  threshold: string
  reward: string
  metric: 'joins' | 'purchases' | 'revenue'
  presetLabel?: string | null
  onCampaignTitle: (value: string) => void
  onThreshold: (value: string) => void
  onReward: (value: string) => void
  onMetric: (value: 'joins' | 'purchases' | 'revenue') => void
  onClearPreset: () => void
  onCancel: () => void
  onSubmit: (event: FormEvent) => void
}) {
  const [step, setStep] = useState(0)
  const steps = ['Goal', 'Target', 'Reward', 'Preview']

  function handleNext() {
    if (step < steps.length - 1) setStep(step + 1)
  }
  function handleBack() {
    if (step > 0) setStep(step - 1)
    else onCancel()
  }

  return (
    <form
      className="tg-screen with-fixed-button"
      onSubmit={(event) => {
        if (step < steps.length - 1) {
          event.preventDefault()
          handleNext()
        } else {
          onSubmit(event)
        }
      }}
    >
      <div className="tg-form-title">
        <h1>Referral Reward</h1>
        <p>{presetLabel ? `Create a referral reward just for ${presetLabel}.` : 'Create a simple milestone loop members can understand and share.'}</p>
        <button className="tg-text-button" type="button" onClick={handleBack}>
          {step === 0 ? 'Cancel' : 'Back'}
        </button>
      </div>
      <div className="tg-progress-bars" aria-label={`Step ${step + 1} of ${steps.length}`}>
        {steps.map((label, index) => (
          <span key={label} className={index <= step ? 'active' : ''} />
        ))}
      </div>

      {step === 0 && (
        <>
          <SectionLabel>Campaign name</SectionLabel>
          <div className="tg-input-group">
            <input value={campaignTitle} onChange={(event) => onCampaignTitle(event.target.value)} aria-label="Campaign title" />
          </div>
          <SectionLabel>Reward goal</SectionLabel>
          <ListGroup>
            {REFERRAL_METRICS.map((option) => (
              <ListRow
                key={option.value}
                tone="green"
                icon="referral"
                title={option.title}
                detail={option.detail}
                meta={metric === option.value ? 'Selected' : undefined}
                onClick={() => onMetric(option.value)}
              />
            ))}
          </ListGroup>
        </>
      )}

      {step === 1 && (
        <>
          <SectionLabel>{referralThresholdLabel(metric)}</SectionLabel>
          <div className="tg-input-group">
            <input value={threshold} onChange={(event) => onThreshold(event.target.value)} inputMode="numeric" aria-label={referralThresholdLabel(metric)} />
          </div>
          <SectionLabel>Applies to</SectionLabel>
          <ListGroup>
            {presetLabel ? (
              <>
                <ListRow tone="green" icon="referral" title={presetLabel} detail="This specific item" meta="Selected" />
                <ListRow tone="blue" icon="business" title="Whole community" detail="Switch to a community-wide reward" onClick={onClearPreset} />
              </>
            ) : (
              <ListRow tone="blue" icon="business" title="Whole community" detail="This reward applies to your entire community" meta="Selected" />
            )}
          </ListGroup>
        </>
      )}

      {step === 2 && (
        <>
          <SectionLabel>Reward</SectionLabel>
          <div className="tg-input-group">
            <textarea value={reward} onChange={(event) => onReward(event.target.value)} aria-label="Reward" />
          </div>
        </>
      )}

      {step === 3 && (
        <section className="tg-callout">
          <span>MEMBER JOURNEY</span>
          <h2>{referralGoalCopy(metric, threshold)}</h2>
          <p>{reward || 'Unlock bonus content'}</p>
          <p>{presetLabel ? `Applies to ${presetLabel}.` : 'Applies to your whole community.'}</p>
        </section>
      )}

      <FixedButton label={step === steps.length - 1 ? 'Activate Campaign' : 'Next'} submit />
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
        <ListRow tone="green" icon="share" title="Telegram Card" detail="Share sends a bot message with a Web App button." onClick={onShare} />
        <ListRow tone="red" icon="delete" title={`Delete ${kind === 'product' ? 'Product' : 'Event'}`} detail="Remove it from active offers." onClick={onDelete} />
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

function MembershipBuilderScreen({
  title,
  description,
  buttonText,
  coverPreview,
  coverName,
  monthlyStars,
  yearlyStars,
  onTitle,
  onDescription,
  onButtonText,
  onCoverFile,
  onMonthlyStars,
  onYearlyStars,
  onCancel,
  onSubmit,
  submitting,
}: {
  title: string
  description: string
  buttonText: string
  coverPreview: string | null
  coverName: string | null
  monthlyStars: string
  yearlyStars: string
  onTitle: (value: string) => void
  onDescription: (value: string) => void
  onButtonText: (value: string) => void
  onCoverFile: (file: File | null) => void
  onMonthlyStars: (value: string) => void
  onYearlyStars: (value: string) => void
  onCancel: () => void
  onSubmit: (event?: FormEvent) => void
  submitting?: boolean
}) {
  return (
    <form className="tg-screen with-fixed-button" onSubmit={onSubmit}>
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
      <SectionLabel>Cover</SectionLabel>
      <UploadBox label="Upload Cover" preview={coverPreview} fileName={coverName} accept="image/*" onFile={onCoverFile} />
      <SectionLabel>Pricing</SectionLabel>
      <div className="tg-input-group">
        <input
          value={monthlyStars}
          onChange={(event) => onMonthlyStars(event.target.value)}
          inputMode="numeric"
          placeholder="Monthly price in Stars"
          aria-label="Monthly price in Stars"
        />
        {Number(monthlyStars) > 0 && <small className="tg-input-hint">≈ {formatUsdApprox(Number(monthlyStars))}/month for subscribers</small>}
        <input
          value={yearlyStars}
          onChange={(event) => onYearlyStars(event.target.value)}
          inputMode="numeric"
          placeholder="Yearly price in Stars (optional)"
          aria-label="Yearly price in Stars (optional)"
        />
        {Number(yearlyStars) > 0 && <small className="tg-input-hint">≈ {formatUsdApprox(Number(yearlyStars))}/year for subscribers</small>}
      </div>
      <PreviewCard title={title} description={description} buttonText={buttonText || 'Subscribe'} coverUrl={coverPreview} />
      <FixedButton label="Create Membership" submit disabled={submitting} />
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
  onReferralReward,
  commentAccess,
  onToggleCommentAccess,
  autoPost,
  onToggleAutoPosting,
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
  onReferralReward: () => void
  commentAccess: CommentAccessDto
  onToggleCommentAccess: () => void
  autoPost: ScheduledPostDto | null
  onToggleAutoPosting: () => void
  onToast: (message: string) => void
}) {
  const commentAccessDetail = !commentAccess.linked
    ? 'Link a discussion group to enable'
    : commentAccess.discussionBotStatus !== 'admin'
    ? 'Promote the bot in your discussion group'
    : commentAccess.enabled
    ? 'On · applies to your whole channel'
    : 'Off · applies to your whole channel'
  const autoPostDetail =
    autoPost?.status === 'active'
      ? `Every ${autoPost.intervalHours}h · next ${new Date(autoPost.nextRunAt).toLocaleDateString()}`
      : 'Off'
  return (
    <section className="tg-screen with-fixed-button">
      <h1 className="tg-publish-title">{plan?.name ?? title}</h1>
      <div className="tg-description-card">
        {coverPreview && <span className="tg-description-cover" style={{ backgroundImage: `url(${coverPreview})` }} />}
        <p>{plan?.description ?? description}</p>
        <div>
          <span>{community.name}</span>
          <span>{plan ? xtrLabel(plan.stars || centsToStars(plan.priceCents)) : 'Draft'}</span>
        </div>
      </div>
      <div className="tg-action-grid">
        <ActionTile label="Edit" icon="edit" onClick={onEdit} />
        <ActionTile label="Links" icon="link" onClick={onCopyLink} />
        <ActionTile label="More" icon="more" onClick={() => onToast('More options opened')} />
      </div>
      <ListGroup>
        <ListRow
          tone="green"
          icon="comment"
          title="Comment Access"
          detail={commentAccessDetail}
          meta={commentAccess.linked && commentAccess.discussionBotStatus === 'admin' ? (commentAccess.enabled ? 'on' : 'off') : undefined}
          onClick={onToggleCommentAccess}
        />
        <ListRow
          tone="blue"
          icon="autopost"
          title="Auto-posting"
          detail={autoPostDetail}
          meta={autoPost?.status === 'active' ? 'on' : 'off'}
          onClick={onToggleAutoPosting}
        />
        <ListRow tone="purple" icon="referral" title="Referral Reward" detail="Invite 3 friends" onClick={onReferralReward} />
        {plan && <ListRow tone="red" icon="delete" title="Delete Membership" detail="Remove this package from active offers" onClick={onDelete} />}
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

function ShareGuide({ onBack, onDone }: { onBack: () => void; onDone: () => void }) {
  const [step, setStep] = useState(0)
  const slides = [
    { title: 'Tap Share on any membership, product, or event', icon: 'share' as IconName },
    { title: 'We send a message with a button to your group or your DMs', icon: 'comment' as IconName },
    { title: 'Tapping it opens CommunityOS straight into the offer', icon: 'business' as IconName },
  ]
  return (
    <main className="tg-story">
      <header className="tg-story-topbar">
        <button type="button" onClick={onBack}>
          Back
        </button>
      </header>
      <div className="tg-progress-bars" aria-label={`Slide ${step + 1} of ${slides.length}`}>
        {slides.map((item, index) => (
          <span key={item.title} className={index <= step ? 'active' : ''} />
        ))}
      </div>
      <section className="tg-story-content simple">
        <StoryArt label={slides[step].title} icon={slides[step].icon} compact />
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

function OfferWizard({
  intent,
  data,
  step,
  onStep,
  onComplete,
  onCancel,
}: {
  intent: CheckoutIntent
  data: DashboardDto
  step: number
  onStep: (step: number) => void
  onComplete: () => void
  onCancel: () => void
}) {
  if (!intent) return null

  const plan = intent.kind === 'plan' ? data.plans.find((p) => p.id === intent.id) : null
  const product = intent.kind === 'product' ? data.products.find((p) => p.id === intent.id) : null
  const event = intent.kind === 'event' ? data.events.find((e) => e.id === intent.id) : null
  const chat = data.chats[0] ?? null

  const title = plan?.name || product?.title || event?.title || 'Offer'
  const description = plan?.description || product?.description || event?.description || ''
  const price = plan ? xtrLabel(plan.stars || centsToStars(plan.priceCents)) : product ? xtrLabel(product.priceStars) : event ? xtrLabelOrFree(event.priceStars || 0) : 'Free'
  const imageUrl = plan?.coverUrl || product?.coverUrl || event?.coverUrl || data.community.avatarUrl || null

  const whatYoullGet = plan
    ? `Instant access to ${chat?.title ?? data.community.name}. Renews every ${plan.interval}.`
    : product
    ? product.deliveryType === 'file'
      ? 'Instant file download as soon as payment confirms.'
      : product.deliveryType === 'url'
      ? 'An access link unlocks immediately after payment.'
      : product.deliveryType === 'text'
      ? 'Delivery instructions unlock immediately after payment.'
      : 'Download or access your digital product.'
    : event
    ? `Register for this ${event.type} on ${dateShort(event.startsAt)}${event.accessLink ? ' — access link included.' : '.'}`
    : 'Register and get event details and access link.'

  const slides: { title: string; detail: string; icon: IconName }[] = [
    {
      title: `Get ${title}`,
      detail: [description, chat ? `Join ${chat.activeMembers} members in ${chat.title}.` : null].filter(Boolean).join(' '),
      icon: plan ? 'membership' : product ? 'product' : 'event',
    },
    {
      title: 'Pay with Telegram Stars',
      detail: `Only ${price} — fast, secure, and supported in Telegram.`,
      icon: 'stars',
    },
    {
      title: 'You\'ll get',
      detail: whatYoullGet,
      icon: 'channel',
    },
  ]

  return (
    <main className="tg-story">
      <header className="tg-story-topbar">
        <button type="button" onClick={onCancel}>
          Back
        </button>
        <div className="tg-story-topbar-identity">
          {data.community.avatarUrl ? (
            <img className="tg-story-topbar-avatar" src={data.community.avatarUrl} alt="" />
          ) : (
            <span className="tg-story-topbar-avatar fallback">{initials(data.community.name)}</span>
          )}
          <div>
            <strong>{chat ? chat.title : data.community.name}</strong>
            <span>{chat ? `${chat.type === 'channel' ? 'Telegram channel' : 'Telegram group'}` : 'offer preview'}</span>
          </div>
        </div>
      </header>
      <div className="tg-progress-bars" aria-label={`Step ${step + 1} of ${slides.length}`}>
        {slides.map((_, index) => (
          <span key={index} className={index <= step ? 'active' : ''} />
        ))}
      </div>
      <section className="tg-story-content">
        <StoryArt label={slides[step].title} icon={slides[step].icon} imageUrl={imageUrl} compact />
        <h1>{slides[step].title}</h1>
        <p>{slides[step].detail}</p>
      </section>
      <footer className="tg-story-footer">
        <button
          type="button"
          onClick={() => {
            if (step < slides.length - 1) {
              onStep(step + 1)
            } else {
              onComplete()
            }
          }}
        >
          {step === slides.length - 1 ? 'Continue' : 'Next'}
        </button>
      </footer>
    </main>
  )
}

function CommunityProfileScreen({
  name,
  handle,
  description,
  inviteUrl,
  onName,
  onHandle,
  onDescription,
  onInviteUrl,
  onCancel,
  onSubmit,
}: {
  name: string
  handle: string
  description: string
  inviteUrl: string
  onName: (value: string) => void
  onHandle: (value: string) => void
  onDescription: (value: string) => void
  onInviteUrl: (value: string) => void
  onCancel: () => void
  onSubmit: (event?: FormEvent) => void
}) {
  return (
    <form className="tg-screen with-fixed-button" onSubmit={onSubmit}>
      <div className="tg-form-title">
        <h1>Community Profile</h1>
        <p>Customize how your community appears to members.</p>
        <button className="tg-text-button" type="button" onClick={onCancel}>
          Back
        </button>
      </div>
      <div className="tg-input-group">
        <label>
          <span>Community Name</span>
          <input value={name} onChange={(e) => onName(e.target.value)} placeholder="My Community" />
        </label>
        <label>
          <span>Handle (@username)</span>
          <input value={handle} onChange={(e) => onHandle(e.target.value)} placeholder="mycommunity" />
        </label>
        <label>
          <span>Description</span>
          <textarea value={description} onChange={(e) => onDescription(e.target.value)} placeholder="A brief description of your community..." />
        </label>
        <label>
          <span>Telegram Invite Link</span>
          <input value={inviteUrl} onChange={(e) => onInviteUrl(e.target.value)} placeholder="https://t.me/+..." />
        </label>
      </div>
      <FixedButton label="Save" />
    </form>
  )
}

function MemberHome({
  data,
  member,
  checkoutIntent,
  subscriptions,
  purchases,
  onReferral,
  onSupport,
  onBuyPlan,
  onBuyProduct,
  onEvent,
  onCancelSubscription,
  onToast,
}: {
  data: DashboardDto
  member?: MemberRowDto
  checkoutIntent: CheckoutIntent
  subscriptions: SubscriptionDto[]
  purchases: PurchaseDto[]
  onReferral: () => void
  onSupport: () => void
  onBuyPlan: (plan: PlanDto) => void
  onBuyProduct: (product: ProductDto) => void
  onEvent: (event: EventDto) => void
  onCancelSubscription: (subscription: SubscriptionDto) => void
  onToast: (message: string) => void
}) {
  const progress = member ? Math.min(100, Math.round((member.xp % 1200) / 12)) : 0
  const activeSubscriptions = subscriptions.filter((subscription) => subscription.status === 'active' || subscription.status === 'trialing' || subscription.status === 'past_due' || subscription.status === 'expired')
  const unlockedProducts = data.products.filter((product) => product.owned)
  const registeredEvents = data.events.filter((event) => event.registered)
  const subscriptionForPlan = (planId: number) => activeSubscriptions.find((subscription) => subscription.planId === planId) ?? null
  const activeSubscriptionForPlan = (planId: number) =>
    activeSubscriptions.find((subscription) => subscription.planId === planId && (subscription.status === 'active' || subscription.status === 'trialing')) ?? null
  const planForSubscription = (subscription: SubscriptionDto) =>
    subscription.planId ? data.plans.find((plan) => plan.id === subscription.planId) ?? null : null
  const handlePlanAction = (plan: PlanDto) => {
    const existing = activeSubscriptionForPlan(plan.id)
    if (existing) {
      onCancelSubscription(existing)
      return
    }
    onBuyPlan(plan)
  }
  const handleSubscriptionAction = (subscription: SubscriptionDto) => {
    if (subscription.status === 'past_due' || subscription.status === 'expired') {
      const plan = planForSubscription(subscription)
      if (plan) {
        onBuyPlan(plan)
        return
      }
    }
    onCancelSubscription(subscription)
  }
  const checkoutPlan = checkoutIntent?.kind === 'plan' ? data.plans.find((plan) => plan.id === checkoutIntent.id) ?? null : null
  const checkoutProduct = checkoutIntent?.kind === 'product' ? data.products.find((product) => product.id === checkoutIntent.id) ?? null : null
  const checkoutEvent = checkoutIntent?.kind === 'event' ? data.events.find((event) => event.id === checkoutIntent.id) ?? null : null
  const checkoutSubscription = checkoutPlan ? activeSubscriptionForPlan(checkoutPlan.id) : null
  const checkoutMissing = checkoutIntent && !checkoutPlan && !checkoutProduct && !checkoutEvent
  const [supportOpen, setSupportOpen] = useState(false)
  const adminUsername = data.community.ownerUsername
  const channelUrl = data.community.telegramInviteUrl || (data.chats[0]?.handle ? `https://t.me/${data.chats[0].handle}` : null)
  const openSupportLink = (url: string, message: string) => {
    setSupportOpen(false)
    copyText(url).catch(() => undefined)
    openTelegramLink(url)
    onToast(message)
  }
  return (
    <section className="tg-screen with-fixed-button">
      <div className="tg-community-header">
        <AvatarMark className="tg-large-avatar" image={data.community.avatarUrl} label={data.community.name} />
        <h1>{data.community.name}</h1>
        <p>{member?.username ? `@${member.username}` : member?.planName ?? 'Member access'}</p>
        <div className="tg-mini-stats">
          <span>{member?.accessStatus ?? 'pending'} access</span>
          <span>Level {member?.level ?? 1}</span>
        </div>
      </div>
      {checkoutPlan && (
        <CheckoutPrompt
          tone="blue"
          eyebrow="Membership"
          title={checkoutPlan.name}
          detail={checkoutPlan.description ?? `${checkoutPlan.interval} access to ${data.community.name}`}
          secondary={data.chats[0] ? `${data.chats[0].title} · ${data.chats[0].activeMembers} members` : null}
          imageUrl={checkoutPlan.coverUrl ?? data.community.avatarUrl}
          meta={checkoutSubscription ? 'Active' : xtrLabel(checkoutPlan.stars || centsToStars(checkoutPlan.priceCents))}
          cta={checkoutSubscription ? 'Manage Subscription' : 'Continue to Subscribe'}
          onClick={() => handlePlanAction(checkoutPlan)}
        />
      )}
      {checkoutProduct && (
        <CheckoutPrompt
          tone={checkoutProduct.owned ? 'green' : 'red'}
          eyebrow="Digital Product"
          title={checkoutProduct.title}
          detail={checkoutProduct.owned ? 'Already unlocked on your dashboard.' : checkoutProduct.description ?? checkoutProduct.type.replace('_', ' ')}
          secondary={data.chats[0] ? `${data.chats[0].title} · ${data.chats[0].activeMembers} members` : null}
          imageUrl={checkoutProduct.coverUrl ?? data.community.avatarUrl}
          meta={checkoutProduct.owned ? 'Unlocked' : xtrLabel(checkoutProduct.priceStars)}
          cta={checkoutProduct.owned ? 'Open Product' : `Continue to ${checkoutProduct.buttonText ?? 'Buy'}`}
          onClick={() => onBuyProduct(checkoutProduct)}
        />
      )}
      {checkoutEvent && (
        <CheckoutPrompt
          tone={checkoutEvent.registered ? 'green' : 'purple'}
          eyebrow="Event"
          title={checkoutEvent.title}
          detail={`${checkoutEvent.type} on ${dateShort(checkoutEvent.startsAt)}`}
          secondary={data.chats[0] ? `${data.chats[0].title} · ${data.chats[0].activeMembers} members` : null}
          imageUrl={checkoutEvent.coverUrl ?? data.community.avatarUrl}
          meta={checkoutEvent.registered ? 'Registered' : xtrLabelOrFree(checkoutEvent.priceStars ?? 0)}
          cta={checkoutEvent.registered ? 'Open Event' : checkoutEvent.priceStars ? 'Continue to Get Ticket' : 'Continue to Register'}
          onClick={() => onEvent(checkoutEvent)}
        />
      )}
      {checkoutMissing && (
        <div className="tg-empty-block compact">
          <strong>Offer unavailable</strong>
          <p>This shared link points to an offer that is no longer active.</p>
        </div>
      )}
      <section className="tg-progress-card">
        <div>
          <strong>{member?.xp ?? 0} XP</strong>
          <span>{progress}% to next level</span>
        </div>
        <div className="tg-progress"><span style={{ width: `${progress}%` }} /></div>
      </section>
      <ListGroup>
        <ListRow tone="blue" icon="access" title="Telegram Access" detail={member?.accessStatus ?? 'Pending'} />
        <ListRow tone="green" icon="referral" title="Referral Link" detail="Invite friends and unlock rewards" onClick={onReferral} />
        <ListRow tone="amber" icon="rewards" title="Rewards" detail={`${data.rewards.length} available`} />
      </ListGroup>
      <SectionLabel>Your Access</SectionLabel>
      <ListGroup>
        {activeSubscriptions.map((subscription) => (
          <ListRow
            key={subscription.id}
            tone={subscription.status === 'past_due' || subscription.status === 'expired' ? 'amber' : 'green'}
            icon="subscription"
            title={subscription.planName ?? 'Membership'}
            detail={`${subscription.status}${subscription.currentPeriodEnd ? ` · until ${dateShort(subscription.currentPeriodEnd)}` : ''}`}
            meta={subscription.status === 'past_due' || subscription.status === 'expired' ? 'Renew' : 'Manage'}
            onClick={() => handleSubscriptionAction(subscription)}
          />
        ))}
        {unlockedProducts.slice(0, 3).map((product) => (
          <ListRow
            key={`product-${product.id}`}
            tone="red"
            icon="product"
            title={product.title}
            detail={product.deliveryUrl ? 'Unlocked link available' : product.deliveryText ? 'Delivery instructions available' : 'Unlocked'}
            meta="Open"
            onClick={() => onBuyProduct(product)}
          />
        ))}
        {registeredEvents.slice(0, 3).map((event) => (
          <ListRow
            key={`event-${event.id}`}
            tone="purple"
            icon="event"
            title={event.title}
            detail={`Registered · ${dateShort(event.startsAt)}`}
            meta={event.accessLink ? 'Open' : 'Ready'}
            onClick={() => onEvent(event)}
          />
        ))}
        {activeSubscriptions.length === 0 && unlockedProducts.length === 0 && registeredEvents.length === 0 && (
          <EmptyBlock title="Nothing unlocked yet" detail="Subscriptions, products, and event tickets will appear here after checkout." />
        )}
      </ListGroup>
      <SectionLabel>Memberships</SectionLabel>
      <ListGroup>
        {data.plans.map((plan) => {
          const existing = subscriptionForPlan(plan.id)
          const isActive = existing?.status === 'active' || existing?.status === 'trialing'
          const isPastDue = existing?.status === 'past_due'
          return (
          <ListRow
            key={plan.id}
            tone={isPastDue ? 'amber' : isActive ? 'green' : 'blue'}
            icon="membership"
            image={plan.coverUrl}
            title={plan.name}
            detail={isActive ? 'Active subscription' : isPastDue ? 'Payment needs attention' : plan.description ?? `${plan.interval} membership`}
            meta={isActive ? 'Manage' : isPastDue ? 'Renew' : xtrLabel(plan.stars || centsToStars(plan.priceCents))}
            onClick={() => (existing ? handleSubscriptionAction(existing) : onBuyPlan(plan))}
          />
          )
        })}
        {data.plans.length === 0 && <EmptyBlock title="No memberships yet" detail="Membership plans from this community will appear here." />}
      </ListGroup>
      <SectionLabel>Premium Content</SectionLabel>
      <ListGroup>
        {data.products.map((product) => (
          <ListRow
            key={product.id}
            icon="product"
            image={product.coverUrl}
            title={product.title}
            detail={product.owned ? 'Unlocked' : product.type.replace('_', ' ')}
            meta={product.owned ? 'Open' : xtrLabel(product.priceStars)}
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
            icon="event"
            image={event.coverUrl}
            title={event.title}
            detail={`${event.type} on ${dateShort(event.startsAt)}`}
            meta={event.registered ? 'Open' : xtrLabelOrFree(event.priceStars ?? 0)}
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
            icon="referral"
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
      <SectionLabel>Payment History</SectionLabel>
      <ListGroup>
        {purchases.slice(0, 5).map((purchase) => (
          <ListRow
            key={purchase.id}
            tone={purchase.kind === 'event' ? 'purple' : purchase.kind === 'product' ? 'red' : 'blue'}
            icon={purchase.kind === 'event' ? 'event' : purchase.kind === 'product' ? 'product' : 'membership'}
            title={purchase.title}
            detail={`${purchase.status}${purchase.paidAt ? ` · ${dateShort(purchase.paidAt)}` : ''}`}
            meta={xtrLabelOrFree(purchase.amountStars ?? 0)}
          />
        ))}
        {purchases.length === 0 && <EmptyBlock title="No payments yet" detail="Stars payments and free unlocks will appear here." />}
      </ListGroup>
      <FixedButton label="Get Support" onClick={() => setSupportOpen(true)} />
      {supportOpen && (
        <SupportActionSheet
          onClose={() => setSupportOpen(false)}
          onMessageAdmin={adminUsername ? () => openSupportLink(`https://t.me/${adminUsername}`, 'Admin chat opened') : undefined}
          onMessageBot={() => {
            setSupportOpen(false)
            onSupport()
          }}
          onOpenChannel={channelUrl ? () => openSupportLink(channelUrl, 'Community channel opened') : undefined}
        />
      )}
    </section>
  )
}

function SupportActionSheet({
  onMessageAdmin,
  onMessageBot,
  onOpenChannel,
  onClose,
}: {
  onMessageAdmin?: () => void
  onMessageBot: () => void
  onOpenChannel?: () => void
  onClose: () => void
}) {
  return (
    <div className="tg-action-sheet-overlay" onClick={onClose}>
      <div className="tg-action-sheet" role="dialog" aria-label="Get Support" onClick={(event) => event.stopPropagation()}>
        <h2>Get Support</h2>
        <p>How would you like to reach out?</p>
        {onMessageAdmin && (
          <button type="button" onClick={onMessageAdmin}>
            Message Community Admin
          </button>
        )}
        <button type="button" onClick={onMessageBot}>
          Message Support Bot
        </button>
        {onOpenChannel && (
          <button type="button" onClick={onOpenChannel}>
            Open Community Channel
          </button>
        )}
        <button type="button" className="cancel" onClick={onClose}>
          Cancel
        </button>
      </div>
    </div>
  )
}

function ListGroup({ children }: { children: React.ReactNode }) {
  return <div className="tg-list-group">{children}</div>
}

function CheckoutPrompt({
  tone,
  eyebrow,
  title,
  detail,
  secondary,
  imageUrl,
  meta,
  cta,
  onClick,
}: {
  tone: 'blue' | 'red' | 'purple' | 'green' | 'amber'
  eyebrow: string
  title: string
  detail: string
  secondary?: string | null
  imageUrl?: string | null
  meta: string
  cta: string
  onClick: () => void
}) {
  return (
    <section className={`tg-checkout-prompt ${tone}`}>
      <div className="tg-checkout-prompt-body">
        {imageUrl && <span className="tg-checkout-prompt-thumb" style={{ backgroundImage: `url(${imageUrl})` }} />}
        <div>
          <small>{eyebrow}</small>
          <h2>{title}</h2>
          <p>{detail}</p>
          {secondary && <span className="tg-checkout-prompt-secondary">{secondary}</span>}
        </div>
      </div>
      <strong>{meta}</strong>
      <button type="button" onClick={onClick}>
        {cta}
      </button>
    </section>
  )
}

type IconName =
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

function RowIcon({ name }: { name: IconName }) {
  switch (name) {
    case 'membership':
      return (
        <svg viewBox="0 0 24 24" fill="none">
          <rect x="3" y="6" width="18" height="13" rx="3" stroke="currentColor" strokeWidth="1.6" />
          <path d="M3 10h18" stroke="currentColor" strokeWidth="1.6" />
          <circle cx="17" cy="14.5" r="2.4" fill="currentColor" fillOpacity="0.85" />
          <path d="M7 14.5h5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      )
    case 'product':
      return (
        <svg viewBox="0 0 24 24" fill="none">
          <path d="M12 3l8 4.2v9.6L12 21l-8-4.2V7.2L12 3z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" fill="currentColor" fillOpacity="0.1" />
          <path d="M4 7.2L12 11l8-3.8" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M12 11v10" stroke="currentColor" strokeWidth="1.6" />
        </svg>
      )
    case 'event':
      return (
        <svg viewBox="0 0 24 24" fill="none">
          <rect x="3.5" y="5" width="17" height="15" rx="3" stroke="currentColor" strokeWidth="1.6" />
          <path d="M8 3v4M16 3v4M3.5 9.5h17" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          <path d="M12 12.3l1 2 2.2.3-1.6 1.5.4 2.2-2-1.1-2 1.1.4-2.2-1.6-1.5 2.2-.3 1-2z" fill="currentColor" fillOpacity="0.9" />
        </svg>
      )
    case 'referral':
      return (
        <svg viewBox="0 0 24 24" fill="none">
          <circle cx="8" cy="9" r="3" stroke="currentColor" strokeWidth="1.6" />
          <circle cx="17" cy="9" r="3" stroke="currentColor" strokeWidth="1.6" fill="currentColor" fillOpacity="0.14" />
          <path d="M3.5 19c.6-3 2.4-4.6 4.5-4.6s3.9 1.6 4.5 4.6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          <path d="M12.5 19c.6-3 2.4-4.6 4.5-4.6s3.9 1.6 4.5 4.6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          <path d="M11 9h3M12.3 7.7l1.3 1.3-1.3 1.3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    case 'ai':
      return (
        <svg viewBox="0 0 24 24" fill="none">
          <path d="M12 3l1.8 5.6L19.5 10.4 13.8 12.3 12 18l-1.8-5.7L4.5 10.4 10.2 8.6 12 3z" fill="currentColor" fillOpacity="0.85" />
          <circle cx="18.5" cy="6" r="1.3" fill="currentColor" />
          <circle cx="6" cy="17.5" r="1" fill="currentColor" fillOpacity="0.7" />
        </svg>
      )
    case 'stars':
      return (
        <svg viewBox="0 0 24 24" fill="none">
          <path d="M12 4l2.2 4.6 5 .6-3.6 3.5.9 5-4.5-2.4-4.5 2.4.9-5-3.6-3.5 5-.6L12 4z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" fill="currentColor" fillOpacity="0.18" />
          <circle cx="12" cy="11.6" r="6.8" stroke="currentColor" strokeWidth="1" strokeOpacity="0.35" />
        </svg>
      )
    case 'access':
      return (
        <svg viewBox="0 0 24 24" fill="none">
          <path d="M12 3.5l7 2.7v5.3c0 4.6-3 7.6-7 9-4-1.4-7-4.4-7-9V6.2l7-2.7z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" fill="currentColor" fillOpacity="0.12" />
          <circle cx="12" cy="11" r="1.6" fill="currentColor" />
          <path d="M12 12.6v2.6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      )
    case 'growth':
      return (
        <svg viewBox="0 0 24 24" fill="none">
          <path d="M4 17l4.5-5 3.5 3 6.5-8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M15 7h4v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="8.5" cy="12" r="1.1" fill="currentColor" />
        </svg>
      )
    case 'rewards':
      return (
        <svg viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="9" r="5" stroke="currentColor" strokeWidth="1.6" fill="currentColor" fillOpacity="0.14" />
          <path d="M9 13.2L7 21l5-2.6L17 21l-2-7.8" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M9.6 9l1 1.6 2.4-3.4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    case 'settings':
      return (
        <svg viewBox="0 0 24 24" fill="none">
          <path d="M4 7h9M17 7h3M4 12h3M9 12h11M4 17h13M19 17h1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          <circle cx="13" cy="7" r="2" fill="currentColor" fillOpacity="0.85" />
          <circle cx="6.5" cy="12" r="2" fill="currentColor" fillOpacity="0.85" />
          <circle cx="16" cy="17" r="2" fill="currentColor" fillOpacity="0.85" />
        </svg>
      )
    case 'share':
      return (
        <svg viewBox="0 0 24 24" fill="none">
          <path d="M3.5 12.5L20 4 13 20l-2.6-6.4-6.9-1.1z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" fill="currentColor" fillOpacity="0.14" />
          <path d="M10.4 13.6L20 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      )
    case 'delete':
      return (
        <svg viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.2" strokeOpacity="0.3" />
          <path d="M8 8l8 8M16 8l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      )
    case 'comment':
      return (
        <svg viewBox="0 0 24 24" fill="none">
          <path d="M4 6.5h16v9H10l-3.5 3v-3H4v-9z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" fill="currentColor" fillOpacity="0.12" />
          <rect x="10.4" y="9.6" width="3.2" height="2.6" rx="0.6" fill="currentColor" />
          <path d="M11.1 9.6V8.8a.9.9 0 011.8 0v.8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
      )
    case 'autopost':
      return (
        <svg viewBox="0 0 24 24" fill="none">
          <circle cx="11" cy="12" r="7.2" stroke="currentColor" strokeWidth="1.6" fill="currentColor" fillOpacity="0.12" />
          <path d="M11 8v4.2l3 1.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M17.5 5.5a4 4 0 11-1 6.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          <path d="M19.6 5.2l.3 2.6-2.5-.6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    case 'subscription':
      return (
        <svg viewBox="0 0 24 24" fill="none">
          <path d="M12 4a8 8 0 11-6.3 3.1" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          <path d="M4.2 4.6l.6 3.2 3-1.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <rect x="9" y="10" width="6" height="5.4" rx="1.2" fill="currentColor" fillOpacity="0.85" />
        </svg>
      )
    case 'channel':
      return (
        <svg viewBox="0 0 24 24" fill="none">
          <path d="M4 10v4l3 .6v3a1 1 0 001 1h1v-4.2l9 1.8V7.8L9 9.6V10H4z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" fill="currentColor" fillOpacity="0.14" />
          <path d="M18.5 9a4 4 0 010 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      )
    case 'group':
      return (
        <svg viewBox="0 0 24 24" fill="none">
          <circle cx="8.5" cy="9" r="3" stroke="currentColor" strokeWidth="1.6" fill="currentColor" fillOpacity="0.12" />
          <circle cx="15.5" cy="9" r="3" stroke="currentColor" strokeWidth="1.6" fill="currentColor" fillOpacity="0.12" />
          <path d="M3.6 18.6c.5-3 2.3-4.6 4.9-4.6s4.4 1.6 4.9 4.6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          <path d="M10.6 18.6c.5-3 2.3-4.6 4.9-4.6s4.4 1.6 4.9 4.6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      )
    case 'business':
      return (
        <svg viewBox="0 0 24 24" fill="none">
          <path d="M4 20V10.5l8-4.5 8 4.5V20" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" fill="currentColor" fillOpacity="0.1" />
          <path d="M9 20v-5.5h6V20" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M4 10.5h16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      )
    case 'bot':
      return (
        <svg viewBox="0 0 24 24" fill="none">
          <rect x="5" y="9" width="14" height="10" rx="3" stroke="currentColor" strokeWidth="1.6" fill="currentColor" fillOpacity="0.1" />
          <path d="M12 9V6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          <circle cx="12" cy="4.6" r="1.3" fill="currentColor" />
          <circle cx="9" cy="14" r="1.3" fill="currentColor" />
          <circle cx="15" cy="14" r="1.3" fill="currentColor" />
          <path d="M3.5 12.5h1.5M19 12.5h1.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      )
    case 'member':
      return (
        <svg viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="8.2" r="3.6" stroke="currentColor" strokeWidth="1.6" fill="currentColor" fillOpacity="0.14" />
          <path d="M4.3 19c.8-4.1 3.7-6.3 7.7-6.3s6.9 2.2 7.7 6.3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      )
    default:
      return null
  }
}

function ListRow({
  title,
  detail,
  meta,
  icon,
  avatar,
  image,
  tone = 'blue',
  onClick,
}: {
  title: string
  detail?: string
  meta?: string
  icon?: IconName
  avatar?: string
  image?: string | null
  tone?: 'blue' | 'red' | 'purple' | 'green' | 'amber'
  onClick?: () => void
}) {
  const content = (
    <>
      {image ? (
        <span className="tg-row-icon-image" style={{ backgroundImage: `url(${image})` }} />
      ) : avatar ? (
        <span className={`tg-row-icon ${tone}`}>{avatar}</span>
      ) : icon ? (
        <span className={`tg-row-glyph ${tone}`}>
          <RowIcon name={icon} />
        </span>
      ) : null}
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

function paymentStatusBadge(status: string): { label: string; tone: 'green' | 'amber' | 'muted' } | null {
  switch (status) {
    case 'active':
    case 'trialing':
      return { label: 'Paid', tone: 'green' }
    case 'past_due':
      return { label: 'Pending', tone: 'amber' }
    case 'expired':
    case 'cancelled':
      return { label: 'Unpaid', tone: 'muted' }
    default:
      return null
  }
}

function MemberRow({
  member,
  onGrant,
  onRevoke,
  onSuspend,
  onRestore,
  compact,
}: {
  member: MemberRowDto
  onGrant: () => void
  onRevoke: () => void
  onSuspend?: () => void
  onRestore?: () => void
  compact?: boolean
}) {
  const payment = paymentStatusBadge(member.subscriptionStatus)
  return (
    <article className={`tg-member-row ${compact ? 'compact' : ''}`}>
      <span className="tg-row-glyph blue">
        <RowIcon name="member" />
      </span>
      <div>
        <strong>@{member.username}</strong>
        <small>
          {member.planName ?? 'No plan'} · {member.accessStatus} · {member.xp} XP
        </small>
        {payment && <span className={`tg-status-chip ${payment.tone}`}>{payment.label}</span>}
      </div>
      <div className="tg-member-actions">
        {member.accessStatus === 'granted' ? (
          <>
            <button type="button" onClick={onSuspend ?? onRevoke}>Suspend</button>
            <button type="button" onClick={onRevoke}>Remove</button>
          </>
        ) : member.accessStatus === 'suspended' ? (
          <>
            <button type="button" onClick={onRestore ?? onGrant}>Restore</button>
            <button type="button" onClick={onRevoke}>Remove</button>
          </>
        ) : (
          <>
            <button type="button" onClick={onGrant}>Grant</button>
            <button type="button" onClick={onRevoke}>Remove</button>
          </>
        )}
      </div>
    </article>
  )
}

function JoinRequestRow({
  request,
  onApprove,
  onDecline,
}: {
  request: DashboardDto['joinRequests'][number]
  onApprove: () => void
  onDecline: () => void
}) {
  return (
    <article className="tg-member-row compact">
      <span className="tg-row-glyph green">
        <RowIcon name="member" />
      </span>
      <div>
        <strong>@{request.username ?? request.telegramUserId}</strong>
        <small>
          Join request · {request.referralCode ? `ref ${request.referralCode}` : dateShort(request.createdAt)}
        </small>
      </div>
      <div className="tg-member-actions">
        <button type="button" onClick={onApprove}>Approve</button>
        <button type="button" onClick={onDecline}>Decline</button>
      </div>
    </article>
  )
}

function ChatRow({ chat, image }: { chat: TelegramChatDto; image?: string | null }) {
  const status = chat.botStatus === 'admin' ? 'Ready' : chat.botStatus === 'missing_permissions' ? 'Needs permissions' : 'Not connected'
  return (
    <ListRow
      tone={chat.botStatus === 'admin' ? 'green' : 'amber'}
      icon={chat.type === 'channel' ? 'channel' : 'group'}
      image={image}
      title={chat.title}
      detail={`${chat.type}. ${chat.activeMembers} active members`}
      meta={status}
    />
  )
}

function AvatarMark({ className, image, label }: { className: string; image?: string | null; label: string }) {
  return (
    <span className={`${className} ${image ? 'has-image' : ''}`}>
      {image ? <img src={image} alt="" /> : initials(label)}
    </span>
  )
}

function StoryArt({
  label,
  compact,
  imageUrl,
  icon,
}: {
  label: string
  compact?: boolean
  imageUrl?: string | null
  icon?: IconName
}) {
  return (
    <div className={`tg-story-art ${compact ? 'compact' : ''}`} aria-hidden="true">
      <span className={`tg-story-art-card ${imageUrl ? 'has-image' : ''} ${!imageUrl && icon ? 'has-icon' : ''}`}>
        {imageUrl ? (
          <img src={imageUrl} alt="" />
        ) : icon ? (
          <RowIcon name={icon} />
        ) : (
          <><i /><b>{label}</b></>
        )}
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

function FixedButton({
  label,
  onClick,
  submit,
  disabled,
}: {
  label: string
  onClick?: () => void
  submit?: boolean
  disabled?: boolean
}) {
  return (
    <div className="tg-fixed-button">
      <button type={submit ? 'submit' : 'button'} onClick={onClick} disabled={disabled}>
        {disabled ? 'Working…' : label}
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

function parseCheckoutIntent(query: Record<string, string | string[] | undefined>): CheckoutIntent {
  const planId = getRouteCommunityId(query.plan)
  if (planId) return { kind: 'plan', id: planId }
  const productId = getRouteCommunityId(query.product)
  if (productId) return { kind: 'product', id: productId }
  const eventId = getRouteCommunityId(query.event)
  if (eventId) return { kind: 'event', id: eventId }
  return null
}

function parseStartParam(value: string): { communityId: number | null; intent: CheckoutIntent } {
  if (!value) return { communityId: null, intent: null }

  const offer = parseOfferCode(value)
  if (offer) {
    return { communityId: offer.communityId, intent: { kind: offer.kind, id: offer.itemId } }
  }

  const community = /^(?:community_|co_)(\d+)(?:_\d+)?$/.exec(value)
  if (community) {
    const communityId = Number(community[1])
    if (Number.isFinite(communityId)) return { communityId, intent: null }
  }

  return { communityId: null, intent: null }
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
    plans: (dashboard.plans ?? []).map((plan) => ({ ...plan, stars: plan.stars ?? centsToStars(plan.priceCents) })),
    referrals: dashboard.referrals ?? [],
    referralCampaigns: dashboard.referralCampaigns ?? [],
    rewards: dashboard.rewards ?? [],
    rewardRules: dashboard.rewardRules ?? [],
    activity: dashboard.activity ?? [],
    accessLogs: dashboard.accessLogs ?? [],
    joinRequests: dashboard.joinRequests ?? [],
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
  return botUrl(`?startapp=co_${communityId}_plan_${planId}`)
}

function referralStartLink(communityId: number, userId?: number) {
  return botUrl(`?startapp=co_${communityId}_${userId ?? 'member'}`)
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
    chats: profile.chats ?? [],
    plans: profile.plans ?? [],
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
