import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityDto,
  CommentAccessDto,
  DashboardDto,
  EventDto,
  FaqEntryDto,
  HealthSignalDto,
  KnowledgeSourceDto,
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
  WeeklyReportDto,
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
  | 'monetization'

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

function formatCommissionRate(bps: number): string {
  const percent = bps / 100
  return `${percent % 1 === 0 ? percent.toFixed(0) : percent.toFixed(1)}%`
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
  const [selectedPlan, setSelectedPlan] = useState<PlanDto | null>(null)
  const [editingPlanId, setEditingPlanId] = useState<number | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [campaignTitle, setCampaignTitle] = useState('Invite 3 members')
  const [rewardTitle, setRewardTitle] = useState('Founding Member Badge')
  const [rewardTriggerType, setRewardTriggerType] = useState<RewardTriggerType>('member_joined')
  const [rewardTriggerCount, setRewardTriggerCount] = useState('1')
  const [catalogTitle, setCatalogTitle] = useState('Top Supporter Badge')
  const [catalogType, setCatalogType] = useState<'badge' | 'certificate' | 'digital_product' | 'premium_access' | 'sponsor' | 'manual'>('badge')
  const [catalogMinXp, setCatalogMinXp] = useState('')
  const [aiQuestion, setAiQuestion] = useState('')
  const [aiAnswer, setAiAnswer] = useState<string | null>(null)
  const [aiBusy, setAiBusy] = useState(false)
  const [aiHistory, setAiHistory] = useState<{ question: string; answer: string }[]>([])
  const [faqEntries, setFaqEntries] = useState<FaqEntryDto[] | null>(null)
  const [knowledgeSources, setKnowledgeSources] = useState<KnowledgeSourceDto[] | null>(null)
  const [weeklyReports, setWeeklyReports] = useState<WeeklyReportDto[] | null>(null)
  const [aiUsageCount, setAiUsageCount] = useState<number | null>(null)
  const [faqQuestion, setFaqQuestion] = useState('')
  const [faqAnswer, setFaqAnswer] = useState('')
  const [knowledgeTitle, setKnowledgeTitle] = useState('')
  const [knowledgeContent, setKnowledgeContent] = useState('')
  const [reportsOpen, setReportsOpen] = useState(false)
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
  const [editingProductId, setEditingProductId] = useState<number | null>(null)
  const [eventTitle, setEventTitle] = useState('Live Community Session')
  const [eventDescription, setEventDescription] = useState('Join us live inside Telegram.')
  const [eventType, setEventType] = useState<EventDto['type']>('webinar')
  const [eventStartsAt, setEventStartsAt] = useState(() => new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 16))
  const [eventPriceStars, setEventPriceStars] = useState('0')
  const [eventAccessLink, setEventAccessLink] = useState('')
  const [eventCover, setEventCover] = useState<{ path: string | null; preview: string | null; name: string | null }>({ path: null, preview: null, name: null })
  const [createdEvent, setCreatedEvent] = useState<EventDto | null>(null)
  const [selectedEvent, setSelectedEvent] = useState<EventDto | null>(null)
  const [editingEventId, setEditingEventId] = useState<number | null>(null)
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
  const [shareGuideReturnTo, setShareGuideReturnTo] = useState<Screen>('home')
  const [shareGuideLink, setShareGuideLink] = useState('')
  const [actionSheet, setActionSheet] = useState<'plan' | 'product' | 'event' | null>(null)
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
  const activePlan = selectedPlan ?? createdPlan ?? data?.plans[0] ?? null
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

  function openGeneralGuide() {
    setShareGuideLink('')
    setShareGuideReturnTo(screen)
    go('shareGuide')
  }

  // Cover/file/text state lives at the page level and is reused across every
  // create/edit session, so it must be reset whenever a *new* item is started
  // or an *existing* item is opened for viewing — otherwise a cover uploaded
  // for one plan/product/event silently leaks into the next one's submission.
  function resetMembershipForm() {
    setMembershipTitle('Premium Circle')
    setMembershipDescription('Get private Telegram access, weekly sessions, and member-only resources.')
    setButtonText('Subscribe')
    setMonthlyStars('299')
    setYearlyStars('2990')
    setCoverPath(null)
    setCoverPreview(null)
    setCoverName(null)
  }

  function resetProductForm() {
    setProductTitle('Premium Download')
    setProductDescription('A paid resource for your Telegram community.')
    setProductType('download')
    setProductPriceStars('199')
    setProductButtonText('Buy')
    setProductDeliveryType('url')
    setProductDeliveryText('Access instructions will appear after purchase.')
    setProductDeliveryUrl('')
    setProductCover({ path: null, preview: null, name: null })
    setProductFile({ path: null, name: null })
  }

  function resetEventForm() {
    setEventTitle('Live Community Session')
    setEventDescription('Join us live inside Telegram.')
    setEventType('webinar')
    setEventStartsAt(new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 16))
    setEventPriceStars('0')
    setEventAccessLink('')
    setEventCover({ path: null, preview: null, name: null })
  }

  function chooseRevenueModel(model: RevenueModel) {
    setPendingModel(model)
    setEditingPlanId(null)
    setEditingProductId(null)
    setEditingEventId(null)
    if (model === 'membership') resetMembershipForm()
    if (model === 'product') resetProductForm()
    if (model === 'event') resetEventForm()
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
      if (editingPlanId) {
        const response = await api.updatePlan(communityId, editingPlanId, {
          name: body.name,
          description: body.description,
          priceCents: body.priceCents,
          buttonText: body.buttonText,
          ...(coverPath ? { coverPath } : {}),
        })

        // A single "Create Membership" submission with both a monthly and a
        // yearly price creates two independent plan rows (see the yStars
        // branch below), linked only by the "(Annual)" name suffix. Without
        // this, editing one row's cover/description/buttonText silently
        // leaves its sibling permanently out of sync.
        const editedPlan = data.plans.find((p) => p.id === editingPlanId)
        if (editedPlan) {
          const baseName = editedPlan.name.replace(/ \(Annual\)$/, '')
          const siblingName = editedPlan.name.endsWith(' (Annual)') ? baseName : `${baseName} (Annual)`
          const sibling = data.plans.find((p) => p.id !== editingPlanId && p.name === siblingName)
          if (sibling) {
            await api
              .updatePlan(communityId, sibling.id, {
                description: body.description,
                buttonText: body.buttonText,
                ...(coverPath ? { coverPath } : {}),
              })
              .catch(() => undefined)
          }
        }

        const plan = { ...response.plan, name: body.name, description: body.description }
        setSelectedPlan(plan)
        setCreatedPlan(null)
        setEditingPlanId(null)
        setMembershipTitle(plan.name)
        setMembershipDescription(plan.description ?? '')
        await refreshDashboard()
        setScreen('publish')
        showToast('Membership updated')
        return
      }

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
      setSelectedPlan(null)

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
      showToast(error.message || (editingPlanId ? 'Membership update failed' : 'Membership creation failed'))
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
      setSelectedPlan(null)
      setEditingPlanId(null)
      await refreshDashboard()
      setScreen('home')
      showToast('Membership package deleted')
    } catch (error: any) {
      showToast(error.message || 'Delete failed')
    }
  }

  async function duplicatePlan() {
    if (!communityId || !activePlan) return
    try {
      const response = await api.createPlan(communityId, {
        name: `${activePlan.name} (Copy)`,
        description: activePlan.description ?? '',
        priceCents: activePlan.priceCents,
        stars: activePlan.stars,
        interval: activePlan.interval,
        coverPath: null,
        buttonText: activePlan.buttonText ?? 'Subscribe',
      })
      setSelectedPlan(response.plan)
      setCreatedPlan(null)
      setEditingPlanId(null)
      setMembershipTitle(response.plan.name)
      setMembershipDescription(response.plan.description ?? '')
      await refreshDashboard()
      setScreen('publish')
      showToast('Membership duplicated')
    } catch (error: any) {
      showToast(error.message || 'Duplicate failed')
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
      if (editingProductId) {
        const { product } = await api.updateProduct(communityId, editingProductId, {
          title: productTitle.trim(),
          type: productType,
          description: productDescription.trim(),
          buttonText: productButtonText.trim() || 'Buy',
          priceStars: Math.max(0, Number(productPriceStars || 0)),
          ...(productCover.path ? { coverPath: productCover.path } : {}),
          deliveryType: productDeliveryType,
          deliveryText: productDeliveryText.trim(),
          deliveryUrl: productDeliveryUrl.trim(),
          ...(productFile.path ? { filePath: productFile.path, fileName: productFile.name } : {}),
        })
        setSelectedProduct(product)
        setCreatedProduct(null)
        setEditingProductId(null)
        setData({ ...data, products: data.products.map((p) => (p.id === product.id ? product : p)) })
        setScreen('productPublish')
        showToast('Product updated')
        return
      }

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
      showToast(error.message || (editingProductId ? 'Product update failed' : 'Product creation failed'))
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
    const confirmed = window.confirm(`Delete "${activeProduct.title}"? This product will no longer be offered.`)
    if (!confirmed) return

    try {
      await api.deleteProduct(communityId, activeProduct.id)
      await refreshDashboard()
      setCreatedProduct((product) => (product?.id === activeProduct.id ? null : product))
      setSelectedProduct(null)
      setEditingProductId(null)
      setScreen('home')
      showToast('Product deleted')
    } catch (error: any) {
      showToast(error.message || 'Delete failed')
    }
  }

  async function duplicateProduct() {
    if (!communityId || !data || !activeProduct) return
    try {
      const { product } = await api.createProduct(communityId, {
        title: `${activeProduct.title} (Copy)`,
        type: activeProduct.type,
        description: activeProduct.description ?? '',
        buttonText: activeProduct.buttonText ?? 'Buy',
        priceStars: activeProduct.priceStars,
        coverPath: null,
        deliveryType: activeProduct.deliveryType,
        deliveryText: activeProduct.deliveryText ?? '',
        deliveryUrl: activeProduct.deliveryUrl ?? '',
        filePath: null,
        fileName: null,
      })
      setCreatedProduct(null)
      setSelectedProduct(product)
      setEditingProductId(null)
      setData({ ...data, products: [product, ...data.products] })
      setScreen('productPublish')
      showToast('Product duplicated')
    } catch (error: any) {
      showToast(error.message || 'Duplicate failed')
    }
  }

  async function toggleProductStatus() {
    if (!communityId || !data || !activeProduct) return
    const nextStatus = activeProduct.status === 'active' ? 'draft' : 'active'
    try {
      const { product } = await api.updateProduct(communityId, activeProduct.id, { status: nextStatus })
      setSelectedProduct(product)
      setCreatedProduct(null)
      setData({ ...data, products: data.products.map((p) => (p.id === product.id ? product : p)) })
      showToast(nextStatus === 'active' ? 'Product published' : 'Product moved to draft')
    } catch (error: any) {
      showToast(error.message || 'Update failed')
    }
  }

  async function createEventOffer(event?: FormEvent) {
    event?.preventDefault()
    if (!communityId || !data || !eventTitle.trim() || submitting) return
    setSubmitting(true)
    try {
      if (editingEventId) {
        const { event: updated } = await api.updateEvent(communityId, editingEventId, {
          title: eventTitle.trim(),
          type: eventType,
          description: eventDescription.trim(),
          startsAt: new Date(eventStartsAt).toISOString(),
          priceStars: Math.max(0, Number(eventPriceStars || 0)),
          ...(eventCover.path ? { coverPath: eventCover.path } : {}),
          accessLink: eventAccessLink.trim(),
        })
        setSelectedEvent(updated)
        setCreatedEvent(null)
        setEditingEventId(null)
        setData({ ...data, events: data.events.map((e) => (e.id === updated.id ? updated : e)) })
        setScreen('eventPublish')
        showToast('Event updated')
        return
      }

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
      showToast(error.message || (editingEventId ? 'Event update failed' : 'Event creation failed'))
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
    const confirmed = window.confirm(`Delete "${activeEvent.title}"? Existing registrations are kept, but this event will no longer be offered.`)
    if (!confirmed) return

    try {
      await api.deleteEvent(communityId, activeEvent.id)
      await refreshDashboard()
      setCreatedEvent((event) => (event?.id === activeEvent.id ? null : event))
      setSelectedEvent(null)
      setEditingEventId(null)
      setScreen('home')
      showToast('Event deleted')
    } catch (error: any) {
      showToast(error.message || 'Delete failed')
    }
  }

  async function duplicateEvent() {
    if (!communityId || !data || !activeEvent) return
    try {
      const { event } = await api.createEvent(communityId, {
        title: `${activeEvent.title} (Copy)`,
        type: activeEvent.type,
        startsAt: activeEvent.startsAt,
        priceStars: activeEvent.priceStars,
        description: activeEvent.description ?? '',
        coverPath: null,
        accessLink: activeEvent.accessLink ?? '',
      })
      setCreatedEvent(null)
      setSelectedEvent(event)
      setEditingEventId(null)
      setData({ ...data, events: [event, ...data.events] })
      setScreen('eventPublish')
      showToast('Event duplicated')
    } catch (error: any) {
      showToast(error.message || 'Duplicate failed')
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

  async function toggleReferralCampaignStatus(campaign: ReferralCampaignDto) {
    if (!data || !communityId) return
    const nextStatus = campaign.status === 'paused' ? 'active' : 'paused'
    const verb = nextStatus === 'paused' ? 'Pause' : 'Resume'
    if (!window.confirm(`${verb} "${campaign.title}"?`)) return
    try {
      const { campaign: updated } = await api.updateReferralCampaign(communityId, campaign.id, nextStatus)
      setData({
        ...data,
        referralCampaigns: data.referralCampaigns.map((row) => (row.id === updated.id ? updated : row)),
      })
      haptic('medium')
      showToast(nextStatus === 'paused' ? 'Campaign paused' : 'Campaign resumed')
    } catch (error: any) {
      showToast(error.message || 'Campaign update failed')
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

  function openReferralRewardForItem(targetType: 'product' | 'event', item: { id: number; name?: string; title?: string } | null) {
    if (!item) {
      showToast('Save it first')
      return
    }
    const label = item.name ?? item.title ?? 'this item'
    setReferralPresetTarget({ type: targetType, id: item.id, label })
    setCampaignTitle(`Invite 3 friends to ${label}`)
    setReferralMetric('joins')
    go('referralBuilder')
  }

  function startReferralCampaign() {
    setReferralPresetTarget(null)
    setCampaignTitle('Invite 3 members')
    setReferralThreshold('3')
    setReferralReward('Unlock bonus content')
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

  async function toggleRewardRuleStatus(rule: RewardRuleDto) {
    if (!data || !communityId) return
    const nextStatus = rule.status === 'draft' ? 'active' : 'draft'
    const verb = nextStatus === 'draft' ? 'Pause' : 'Resume'
    if (!window.confirm(`${verb} "${rule.title}"?`)) return
    try {
      const { rule: updated } = await api.updateRewardRule(communityId, rule.id, nextStatus)
      setData({ ...data, rewardRules: data.rewardRules.map((row) => (row.id === updated.id ? updated : row)) })
      haptic('medium')
      showToast(nextStatus === 'draft' ? 'Reward rule paused' : 'Reward rule resumed')
    } catch (error: any) {
      showToast(error.message || 'Reward rule update failed')
    }
  }

  async function createCatalogReward(event: FormEvent) {
    event.preventDefault()
    if (!data || !communityId || !catalogTitle.trim()) return
    const minXp = Number(catalogMinXp)
    try {
      const { reward } = await api.createReward(communityId, {
        title: catalogTitle.trim(),
        type: catalogType,
        criteria: Number.isFinite(minXp) && minXp > 0 ? { min_xp: minXp } : {},
      })
      setData({ ...data, rewards: [reward, ...data.rewards] })
      setCatalogTitle('')
      setCatalogMinXp('')
      showToast('Reward added to catalog')
    } catch (error: any) {
      showToast(error.message || 'Reward creation failed')
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
    const askedQuestion = aiQuestion.trim()
    setAiBusy(true)
    try {
      const { answer } = await api.askAi(communityId, askedQuestion)
      setAiAnswer(answer)
      setAiHistory((history) => [{ question: askedQuestion, answer }, ...history].slice(0, 5))
      setAiUsageCount((count) => (count === null ? count : count + 1))
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

  async function loadAiManagerExtras() {
    if (!communityId) return
    try {
      const [{ faqs }, { sources }, { reports }, { count }] = await Promise.all([
        api.listFaqEntries(communityId),
        api.listKnowledgeSources(communityId),
        api.listWeeklyReports(communityId),
        api.getAiUsage(communityId),
      ])
      setFaqEntries(faqs)
      setKnowledgeSources(sources)
      setWeeklyReports(reports)
      setAiUsageCount(count)
    } catch (error: any) {
      showToast(error.message || 'Failed to load AI Manager details')
    }
  }

  async function createFaqEntry(event: FormEvent) {
    event.preventDefault()
    if (!communityId || !faqQuestion.trim() || !faqAnswer.trim()) return
    try {
      const { faq } = await api.createFaqEntry(communityId, { question: faqQuestion.trim(), answer: faqAnswer.trim() })
      setFaqEntries((entries) => [faq, ...(entries ?? [])])
      setData((current) => (current ? { ...current, ai: { ...current.ai, faqCount: current.ai.faqCount + 1 } } : current))
      setFaqQuestion('')
      setFaqAnswer('')
      showToast('FAQ entry added')
    } catch (error: any) {
      showToast(error.message || 'FAQ creation failed')
    }
  }

  async function deleteFaqEntry(faq: FaqEntryDto) {
    if (!communityId) return
    if (!window.confirm(`Delete the FAQ entry "${faq.question}"?`)) return
    try {
      await api.deleteFaqEntry(communityId, faq.id)
      setFaqEntries((entries) => (entries ?? []).filter((row) => row.id !== faq.id))
      setData((current) => (current ? { ...current, ai: { ...current.ai, faqCount: Math.max(0, current.ai.faqCount - 1) } } : current))
      haptic('medium')
      showToast('FAQ entry deleted')
    } catch (error: any) {
      showToast(error.message || 'FAQ deletion failed')
    }
  }

  async function createKnowledgeSource(event: FormEvent) {
    event.preventDefault()
    if (!communityId || !knowledgeTitle.trim()) return
    try {
      const { source } = await api.createKnowledgeSource(communityId, {
        title: knowledgeTitle.trim(),
        content: knowledgeContent.trim() || undefined,
      })
      setKnowledgeSources((sources) => [source, ...(sources ?? [])])
      setKnowledgeTitle('')
      setKnowledgeContent('')
      showToast('Knowledge source added')
    } catch (error: any) {
      showToast(error.message || 'Knowledge source creation failed')
    }
  }

  async function deleteKnowledgeSource(source: KnowledgeSourceDto) {
    if (!communityId) return
    if (!window.confirm(`Delete the knowledge source "${source.title}"?`)) return
    try {
      await api.deleteKnowledgeSource(communityId, source.id)
      setKnowledgeSources((sources) => (sources ?? []).filter((row) => row.id !== source.id))
      haptic('medium')
      showToast('Knowledge source deleted')
    } catch (error: any) {
      showToast(error.message || 'Knowledge source deletion failed')
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

  async function updateCommunityStatus(status: 'active' | 'paused' | 'archived') {
    if (!data || !communityId) return
    try {
      const { community } = await api.updateCommunityProfile(communityId, { status })
      setData({ ...data, community: { ...data.community, status: community.status ?? status } })
      haptic('medium')
      showToast(
        status === 'active' ? 'Community reactivated' : status === 'paused' ? 'Community paused' : 'Community archived'
      )
    } catch (error: any) {
      showToast(error.message || 'Status update failed')
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
    const url = communityStartLink(communityId)
    if (!url) {
      showToast('Set NEXT_PUBLIC_TELEGRAM_BOT_USERNAME first')
      return
    }
    await copyText(url).catch(() => false)
    setShareGuideLink(url)
    setShareGuideReturnTo('home')
    showToast('Link copied')
    go('shareGuide')
  }

  async function copyShareGuideLink() {
    if (!shareGuideLink) return
    await copyText(shareGuideLink).catch(() => false)
    showToast('Link copied')
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
    if (!link) {
      showToast('Set NEXT_PUBLIC_TELEGRAM_BOT_USERNAME first')
      return
    }
    await copyText(link).catch(() => false)
    showToast('Referral link copied')
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

  async function claimReward(rewardId: number) {
    if (!communityId) return
    try {
      const result = await api.claimReward(communityId, rewardId)
      if (!result.ok) {
        showToast((result as any).reason || 'Reward not available yet')
        return
      }
      await refreshMemberDashboard()
      showToast('Reward claimed')
    } catch (error: any) {
      showToast(error.message || 'Could not claim reward')
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
        ) : screen === 'shareGuide' ? (
          <ShareGuide
            link={shareGuideLink}
            onCopyLink={copyShareGuideLink}
            onBack={() => go(shareGuideReturnTo)}
            onDone={() => go(shareGuideReturnTo)}
          />
        ) : (
          <AppFrame
            hideBack={screen === 'start' || screen === 'account'}
            onBack={() => { if (screen === 'communities' || screen === 'more') go('account'); if (screen === 'monetization') go('more') }}
            onProfile={screen !== 'account' && screen !== 'start' ? () => go('account') : undefined}
            onGuide={screen !== 'start' ? openGeneralGuide : undefined}
            onMore={screen === 'account' ? () => go('more') : undefined}
          >
            {screen === 'account' && me && (
              <AccountHome
                me={me}
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
                onNavigate={go}
                onOpenCommunity={(id) => selectCommunity(id, 'home')}
                onOpenMemberCommunity={openMemberCommunity}
              />
            )}
            {screen === 'monetization' && me && <MonetizationScreen me={me} />}
            {screen !== 'account' && screen !== 'start' && screen !== 'communities' && screen !== 'more' && screen !== 'monetization' && (
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
            onClaimReward={claimReward}
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
        <ShareGuide
          link={shareGuideLink}
          onCopyLink={copyShareGuideLink}
          onBack={() => go(shareGuideReturnTo)}
          onDone={() => go(shareGuideReturnTo)}
        />
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
              monetization: 'more',
            }
            go(previous[screen])
          }}
          onProfile={screen === 'home' ? () => go('account') : undefined}
          onGuide={screen === 'home' || screen === 'account' ? openGeneralGuide : undefined}
          onMore={screen === 'home' || screen === 'account' ? () => go('more') : undefined}
        >
          {screen === 'start' && <StartPicker onSelect={go} onSelectModel={chooseRevenueModel} />}
          {screen === 'account' && me && (
            <AccountHome
              me={me}
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
              onCreateMembership={() => {
                setEditingPlanId(null)
                resetMembershipForm()
                go('createDetails')
              }}
              onShareCommunity={shareCommunity}
              onSelectModel={chooseRevenueModel}
              onEditProfile={editCommunityProfile}
              onOpenPlan={(plan) => {
                setSelectedPlan(plan)
                setCreatedPlan(null)
                setEditingPlanId(null)
                setMembershipTitle(plan.name)
                setMembershipDescription(plan.description ?? '')
                setCoverPath(null)
                setCoverPreview(null)
                setCoverName(null)
                go('publish')
              }}
              onOpenProduct={(product) => {
                setSelectedProduct(product)
                setCreatedProduct(null)
                setEditingProductId(null)
                setProductCover({ path: null, preview: null, name: null })
                go('productPublish')
              }}
              onOpenEvent={(event) => {
                setSelectedEvent(event)
                setCreatedEvent(null)
                setEditingEventId(null)
                setEventCover({ path: null, preview: null, name: null })
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
              onStartCampaign={startReferralCampaign}
              onToggleCampaignStatus={toggleReferralCampaignStatus}
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
              onToggleRuleStatus={toggleRewardRuleStatus}
              catalogTitle={catalogTitle}
              onCatalogTitle={setCatalogTitle}
              catalogType={catalogType}
              onCatalogType={setCatalogType}
              catalogMinXp={catalogMinXp}
              onCatalogMinXp={setCatalogMinXp}
              onCreateCatalogReward={createCatalogReward}
            />
          )}
          {screen === 'more' && (
            <MoreScreen
              data={data}
              me={me ?? undefined}
              onToast={showToast}
              onNavigate={go}
              onCreateEvent={() => {
                setEditingEventId(null)
                resetEventForm()
                go('eventBuilder')
              }}
              onCreateProduct={() => {
                setEditingProductId(null)
                resetProductForm()
                go('productBuilder')
              }}
              onOpenAiManager={() => {
                go('aiManager')
                loadAiManagerExtras()
              }}
              onOpenSettings={() => go('settings')}
              onOpenCommunity={(id) => selectCommunity(id, 'home')}
              onOpenMemberCommunity={openMemberCommunity}
            />
          )}
          {screen === 'settings' && (
            <SettingsScreen data={data} onUpdateSetting={updateCommunitySetting} onUpdateStatus={updateCommunityStatus} />
          )}
          {screen === 'monetization' && me && <MonetizationScreen me={me} />}
          {screen === 'aiManager' && (
            <AiManagerScreen
              data={data}
              question={aiQuestion}
              answer={aiAnswer}
              history={aiHistory}
              busy={aiBusy}
              onQuestion={setAiQuestion}
              onAsk={askAiQuestion}
              onGenerateReport={generateAiReport}
              onUpdateSettings={updateAiSetting}
              faqEntries={faqEntries}
              knowledgeSources={knowledgeSources}
              weeklyReports={weeklyReports}
              usageCount={aiUsageCount}
              reportsOpen={reportsOpen}
              onToggleReportsOpen={() => setReportsOpen((open) => !open)}
              faqQuestion={faqQuestion}
              onFaqQuestion={setFaqQuestion}
              faqAnswer={faqAnswer}
              onFaqAnswer={setFaqAnswer}
              onCreateFaq={createFaqEntry}
              onDeleteFaq={deleteFaqEntry}
              knowledgeTitle={knowledgeTitle}
              onKnowledgeTitle={setKnowledgeTitle}
              knowledgeContent={knowledgeContent}
              onKnowledgeContent={setKnowledgeContent}
              onCreateKnowledge={createKnowledgeSource}
              onDeleteKnowledge={deleteKnowledgeSource}
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
              isEditing={editingProductId != null}
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
              onEdit={() => {
                setEditingProductId(activeProduct.id)
                setProductTitle(activeProduct.title)
                setProductDescription(activeProduct.description ?? '')
                setProductType(activeProduct.type)
                setProductPriceStars(String(activeProduct.priceStars ?? 0))
                setProductButtonText(activeProduct.buttonText ?? 'Buy')
                setProductDeliveryType(activeProduct.deliveryType ?? 'none')
                setProductDeliveryText(activeProduct.deliveryText ?? '')
                setProductDeliveryUrl(activeProduct.deliveryUrl ?? '')
                setProductCover({ path: null, preview: activeProduct.coverUrl ?? null, name: null })
                setProductFile({ path: null, name: activeProduct.fileName ?? null })
                go('productBuilder')
              }}
              onShare={shareProductCard}
              onGuide={() => {
                if (communityId) setShareGuideLink(offerStartLink(communityId, 'product', activeProduct.id))
                setShareGuideReturnTo('productPublish')
                go('shareGuide')
              }}
              onDelete={deleteProductOffer}
              onMore={() => setActionSheet('product')}
              onReferralReward={() => openReferralRewardForItem('product', activeProduct)}
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
              isEditing={editingEventId != null}
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
              onEdit={() => {
                setEditingEventId(activeEvent.id)
                setEventTitle(activeEvent.title)
                setEventDescription(activeEvent.description ?? '')
                setEventType(activeEvent.type)
                setEventStartsAt(new Date(activeEvent.startsAt).toISOString().slice(0, 16))
                setEventPriceStars(String(activeEvent.priceStars ?? 0))
                setEventAccessLink(activeEvent.accessLink ?? '')
                setEventCover({ path: null, preview: activeEvent.coverUrl ?? null, name: null })
                go('eventBuilder')
              }}
              onShare={shareEventCard}
              onGuide={() => {
                if (communityId) setShareGuideLink(offerStartLink(communityId, 'event', activeEvent.id))
                setShareGuideReturnTo('eventPublish')
                go('shareGuide')
              }}
              onDelete={deleteEventOffer}
              onMore={() => setActionSheet('event')}
              onReferralReward={() => openReferralRewardForItem('event', activeEvent)}
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
              isEditing={editingPlanId != null}
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
              onEdit={() => {
                if (!activePlan) return
                setEditingPlanId(activePlan.id)
                setMembershipTitle(activePlan.name)
                setMembershipDescription(activePlan.description ?? '')
                setButtonText(activePlan.buttonText ?? 'Subscribe')
                setMonthlyStars(String(activePlan.stars || centsToStars(activePlan.priceCents)))
                setCoverPath(null)
                setCoverPreview(activePlan.coverUrl ?? null)
                setCoverName(null)
                go('createDetails')
              }}
              coverPreview={activePlan?.coverUrl ?? coverPreview}
              onShare={shareMembershipCard}
              onGuide={() => {
                if (communityId && activePlan) setShareGuideLink(membershipStartLink(communityId, activePlan.id))
                setShareGuideReturnTo('publish')
                go('shareGuide')
              }}
              onCopyLink={copyMembershipLink}
              onDelete={deleteMembershipPackage}
              onReferralReward={() => openReferralRewardForPlan(activePlan)}
              commentAccess={data.commentAccess}
              onToggleCommentAccess={toggleCommentAccess}
              autoPost={activePlan ? data.scheduledPosts.find((post) => post.targetType === 'plan' && post.targetId === activePlan.id) ?? null : null}
              onToggleAutoPosting={() => activePlan && toggleAutoPosting('plan', activePlan.id)}
              onMore={() => setActionSheet('plan')}
            />
          )}
        </AppFrame>
      )}
      {actionSheet && (
        <ActionSheet
          kind={actionSheet}
          productStatus={actionSheet === 'product' ? activeProduct?.status ?? 'active' : undefined}
          onDuplicate={() => {
            setActionSheet(null)
            if (actionSheet === 'plan') duplicatePlan()
            if (actionSheet === 'product') duplicateProduct()
            if (actionSheet === 'event') duplicateEvent()
          }}
          onToggleStatus={
            actionSheet === 'product'
              ? () => {
                  setActionSheet(null)
                  toggleProductStatus()
                }
              : undefined
          }
          onClose={() => setActionSheet(null)}
        />
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
  onProfile,
  onGuide,
  onMore,
}: {
  children: React.ReactNode
  hideBack?: boolean
  onBack?: () => void
  rightLabel?: string
  onRightAction?: () => void
  onProfile?: () => void
  onGuide?: () => void
  onMore?: () => void
}) {
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 2)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <main className="tg-app">
      <header className={`tg-topbar${scrolled ? ' is-scrolled' : ''}`}>
        {!hideBack && (
          <button className="tg-nav-button" type="button" onClick={onBack} aria-label="Back">
            Back
          </button>
        )}
        {(onProfile || onGuide || onMore) && (
          <div className="tg-topbar-actions">
            {onGuide && (
              <button
                className="tg-topbar-icon-button"
                type="button"
                onClick={() => { haptic('light'); onGuide() }}
                aria-label="Guide"
              >
                <RowIcon name="guide" />
              </button>
            )}
            {onProfile && (
              <button
                className="tg-topbar-icon-button"
                type="button"
                onClick={() => { haptic('light'); onProfile() }}
                aria-label="Profile"
              >
                <RowIcon name="member" />
              </button>
            )}
            {onMore && (
              <button
                className="tg-topbar-icon-button"
                type="button"
                onClick={() => { haptic('light'); onMore() }}
                aria-label="More"
              >
                <RowIcon name="more" />
              </button>
            )}
          </div>
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

function activityIcon(eventType: string): { icon: IconName; tone: 'blue' | 'red' | 'purple' | 'green' | 'amber' } {
  if (eventType.includes('product')) return { icon: 'product', tone: 'red' }
  if (eventType.includes('plan') || eventType.includes('subscription')) return { icon: 'membership', tone: 'blue' }
  if (eventType.includes('event')) return { icon: 'event', tone: 'purple' }
  if (eventType.includes('reward')) return { icon: 'rewards', tone: 'amber' }
  if (eventType.includes('access')) return { icon: 'access', tone: 'green' }
  if (eventType.includes('member') || eventType.includes('join')) return { icon: 'member', tone: 'green' }
  if (eventType.includes('shared')) return { icon: 'share', tone: 'blue' }
  if (eventType.includes('purchase') || eventType.includes('unlocked')) return { icon: 'stars', tone: 'amber' }
  return { icon: 'growth', tone: 'blue' }
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
      <button
        type="button"
        onClick={() => {
          haptic('medium')
          onClick()
        }}
      >
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
        <button
          key={item.key}
          className="tg-revenue-card"
          type="button"
          onClick={() => {
            haptic('light')
            item.onClick()
          }}
        >
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

function QuickAccessRow({
  items,
}: {
  items: { key: string; icon: IconName; label: string; badge?: number; onClick: () => void }[]
}) {
  return (
    <div className="tg-quick-access-row">
      {items.map((item) => (
        <button
          key={item.key}
          className="tg-quick-access-chip"
          type="button"
          onClick={() => {
            haptic('light')
            item.onClick()
          }}
        >
          <RowIcon name={item.icon} />
          <span>{item.label}</span>
          {typeof item.badge === 'number' && item.badge > 0 && <strong>{item.badge}</strong>}
        </button>
      ))}
    </div>
  )
}

function AccountHome({
  me,
  onOpenCommunity,
  onAddCommunity,
}: {
  me: MeDto
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
          <span>{me.accountStats.monthlyStars.toLocaleString()} XTR this month</span>
          <span>{me.accountStats.accessIssues > 0 ? `${me.accountStats.accessIssues} access issue(s)` : 'Access all clear'}</span>
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

      {me.communities.length > 0 && (
        <>
          <SectionLabel>Your Communities</SectionLabel>
          <ListGroup>
            {me.communities.map((community) => (
              <ListRow
                key={community.id}
                avatar={initials(community.name)}
                image={community.avatarUrl}
                title={community.name}
                detail={`${(community.members ?? 0).toLocaleString()} members · ${(community.monthlyStars ?? 0).toLocaleString()} XTR this month`}
                meta={community.accessIssues ? `${community.accessIssues} issue${community.accessIssues > 1 ? 's' : ''}` : `${community.healthScore ?? 0}% health`}
                onClick={() => onOpenCommunity(community.id)}
              />
            ))}
          </ListGroup>
        </>
      )}

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
  onOpenPlan,
  onOpenProduct,
  onOpenEvent,
  onEditProfile,
}: {
  data: DashboardDto
  onNavigate: (screen: Screen) => void
  onCreateMembership: () => void
  onShareCommunity: () => void
  onSelectModel: (model: RevenueModel) => void
  onOpenPlan: (plan: PlanDto) => void
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

      <QuickAccessRow
        items={[
          { key: 'access', icon: 'access', label: 'Access', badge: data.metrics.accessIssues, onClick: () => onNavigate('access') },
          { key: 'growth', icon: 'growth', label: 'Growth', onClick: () => onNavigate('growth') },
          { key: 'rewards', icon: 'rewards', label: 'Rewards', onClick: () => onNavigate('rewards') },
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
            onClick={() => onOpenPlan(plan)}
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

      <SectionLabel>Recent Activity</SectionLabel>
      <ListGroup>
        {data.activity.slice(0, 3).map((item) => {
          const { icon, tone } = activityIcon(item.eventType)
          return <ListRow key={item.id} tone={tone} icon={icon} title={item.title} detail={dateShort(item.createdAt)} />
        })}
        {data.activity.length === 0 && <EmptyBlock title="No activity yet" detail="Payments, joins, access changes, and reward grants will show here." />}
      </ListGroup>
      {data.activity.length > 0 && (
        <button className="tg-text-button" type="button" onClick={() => onNavigate('more')}>
          View all activity
        </button>
      )}

      <FixedButton label={data.plans.length ? 'Share' : 'Create Membership'} onClick={data.plans.length ? onShareCommunity : onCreateMembership} />
    </section>
  )
}

function CommunityHeader({ data, onEdit }: { data: DashboardDto; onEdit?: () => void }) {
  return (
    <section className="tg-community-header">
      <div className="tg-avatar-wrap">
        <AvatarMark className="tg-large-avatar" image={data.community.avatarUrl} label={data.community.name} />
        <button
          className="tg-header-edit-button"
          type="button"
          onClick={() => {
            haptic('light')
            onEdit?.()
          }}
          title="Edit profile"
        >
          ✎
        </button>
      </div>
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
  onStartCampaign,
  onToggleCampaignStatus,
}: {
  data: DashboardDto
  onStartCampaign: () => void
  onToggleCampaignStatus: (campaign: ReferralCampaignDto) => void
}) {
  function targetLabel(campaign: ReferralCampaignDto) {
    if (!campaign.targetType || !campaign.targetId) return null
    const source = campaign.targetType === 'plan' ? data.plans : campaign.targetType === 'product' ? data.products : data.events
    const item = (source as ({ id: number } & Record<string, any>)[]).find((row) => row.id === campaign.targetId)
    return item ? item.name ?? item.title ?? null : null
  }
  function campaignDetail(campaign: ReferralCampaignDto, prefix?: string | null) {
    const status = campaign.status === 'paused' ? ' · Paused' : ''
    const lead = prefix ? `${prefix} · ` : ''
    return `${lead}${campaign.clicks} clicks, ${campaign.joins} joins, ${campaign.purchases} purchases${status}`
  }
  const itemCampaigns = data.referralCampaigns.filter((campaign) => campaign.targetType && campaign.targetId)
  const communityCampaigns = data.referralCampaigns.filter((campaign) => !campaign.targetType || !campaign.targetId)
  const topReferrers = [...data.referrals].sort((a, b) => b.revenueCents - a.revenueCents).slice(0, 10)
  return (
    <section className="tg-screen">
      <h1 className="tg-left-title">Growth</h1>
      <ListGroup>
        <ListRow
          tone="green"
          icon="referral"
          title="Create Referral Campaign"
          detail="Launch a reward loop for invites, joins, or purchases"
          onClick={onStartCampaign}
        />
      </ListGroup>
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
                detail={campaignDetail(campaign, targetLabel(campaign) ?? 'Item')}
                meta={money(campaign.revenueCents)}
                onClick={() => onToggleCampaignStatus(campaign)}
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
            detail={campaignDetail(campaign)}
            meta={money(campaign.revenueCents)}
            onClick={() => onToggleCampaignStatus(campaign)}
          />
        ))}
        {communityCampaigns.length === 0 && <EmptyBlock title="No campaigns yet" detail="Create a reward loop for invites, joins, and purchases." />}
      </ListGroup>
      <SectionLabel>Top Referrers</SectionLabel>
      <ListGroup>
        {topReferrers.map((referral) => (
          <ListRow
            key={referral.id}
            tone="green"
            icon="referral"
            title={referral.referrer}
            detail={`${referral.joins} joins · ${referral.purchases} purchases`}
            meta={money(referral.revenueCents)}
          />
        ))}
        {topReferrers.length === 0 && <EmptyBlock title="No referrals yet" detail="Once members start inviting others, the leaderboard shows up here." />}
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
  onToggleRuleStatus,
  catalogTitle,
  onCatalogTitle,
  catalogType,
  onCatalogType,
  catalogMinXp,
  onCatalogMinXp,
  onCreateCatalogReward,
}: {
  data: DashboardDto
  rewardTitle: string
  onRewardTitle: (value: string) => void
  triggerType: RewardTriggerType
  onTriggerType: (value: RewardTriggerType) => void
  triggerCount: string
  onTriggerCount: (value: string) => void
  onCreateReward: (event: FormEvent) => void
  onToggleRuleStatus: (rule: RewardRuleDto) => void
  catalogTitle: string
  onCatalogTitle: (value: string) => void
  catalogType: 'badge' | 'certificate' | 'digital_product' | 'premium_access' | 'sponsor' | 'manual'
  onCatalogType: (value: 'badge' | 'certificate' | 'digital_product' | 'premium_access' | 'sponsor' | 'manual') => void
  catalogMinXp: string
  onCatalogMinXp: (value: string) => void
  onCreateCatalogReward: (event: FormEvent) => void
}) {
  const leaderboard = [...data.members].sort((a, b) => b.xp - a.xp).slice(0, 10)
  const topMember = leaderboard[0]
  const topProgress = topMember ? Math.min(100, Math.round((topMember.xp % 1200) / 12)) : 0
  const triggerLabel = REWARD_TRIGGER_OPTIONS.find((option) => option.value === triggerType)?.label ?? 'this action'
  const safeTriggerCount = Math.max(1, Math.round(Number(triggerCount) || 1))

  return (
    <section className="tg-screen">
      <h1 className="tg-left-title">Rewards</h1>

      <SectionLabel>Leaderboard</SectionLabel>
      {topMember && (
        <section className="tg-progress-card">
          <div>
            <strong>@{topMember.username} · {topMember.xp} XP</strong>
            <span>{topProgress}% to next level</span>
          </div>
          <div className="tg-progress"><span style={{ width: `${topProgress}%` }} /></div>
        </section>
      )}
      <ListGroup>
        {leaderboard.map((member) => (
          <ListRow
            key={member.id}
            tone="amber"
            icon="rewards"
            title={`@${member.username}`}
            detail={`Level ${member.level} · ${member.referralCount} referrals`}
            meta={`${member.xp} XP`}
          />
        ))}
        {leaderboard.length === 0 && <EmptyBlock title="No members yet" detail="XP and levels show up here once members start engaging." />}
      </ListGroup>

      <SectionLabel>Reward Catalog</SectionLabel>
      <form className="tg-form-card" onSubmit={onCreateCatalogReward}>
        <div className="tg-input-group">
          <input value={catalogTitle} onChange={(event) => onCatalogTitle(event.target.value)} aria-label="Reward title" placeholder="Reward title" />
          <label>
            <span>Type</span>
            <select value={catalogType} onChange={(event) => onCatalogType(event.target.value as typeof catalogType)}>
              <option value="badge">Badge</option>
              <option value="certificate">Certificate</option>
              <option value="digital_product">Digital product</option>
              <option value="premium_access">Premium access</option>
              <option value="sponsor">Sponsor perk</option>
              <option value="manual">Manual unlock</option>
            </select>
          </label>
          <label>
            <span>Minimum XP to unlock (optional)</span>
            <input type="number" min={0} value={catalogMinXp} onChange={(event) => onCatalogMinXp(event.target.value)} inputMode="numeric" />
          </label>
        </div>
        <button type="submit" onClick={() => haptic('medium')}>Add to Catalog</button>
      </form>
      <ListGroup>
        {data.rewards.map((reward) => (
          <ListRow key={reward.id} tone="purple" icon="rewards" title={reward.title} detail={reward.type.replace(/_/g, ' ')} />
        ))}
        {data.rewards.length === 0 && <EmptyBlock title="No catalog rewards yet" detail="Add badges, certificates, or perks members can unlock." />}
      </ListGroup>

      <SectionLabel>Create Reward Rule</SectionLabel>
      <form className="tg-form-card" onSubmit={onCreateReward}>
        <div className="tg-input-group">
          <input value={rewardTitle} onChange={(event) => onRewardTitle(event.target.value)} aria-label="Reward rule title" placeholder="Reward rule title" />
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
        </div>
        <section className="tg-callout">
          <span>MEMBER JOURNEY</span>
          <h2>{triggerType === 'manual' ? 'Manual unlock' : `${triggerLabel} (every ${safeTriggerCount}x)`}</h2>
          <p>Members who do this will earn +150 XP.</p>
        </section>
        <button type="submit" onClick={() => haptic('medium')}>Create Rule</button>
      </form>
      <ListGroup>
        {data.rewardRules.map((rule) => (
          <ListRow
            key={rule.id}
            tone="amber"
            icon="rewards"
            title={rule.title}
            detail={`${rule.trigger}. ${rule.reward}`}
            meta={rule.status === 'draft' ? 'Paused' : 'Active'}
            onClick={() => onToggleRuleStatus(rule)}
          />
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
            {data.activity.slice(0, 4).map((item) => {
              const { icon, tone } = activityIcon(item.eventType)
              return <ListRow key={item.id} tone={tone} icon={icon} title={item.title} detail={dateShort(item.createdAt)} />
            })}
            {data.activity.length === 0 && <EmptyBlock title="No activity yet" detail="Payments, joins, access changes, and reward grants will show here." />}
          </ListGroup>

          <SectionLabel>Events</SectionLabel>
          <ListGroup>
            {data.events.map((event) => (
              <ListRow key={event.id} tone="purple" icon="event" title={event.title} detail={`${event.type} on ${dateShort(event.startsAt)}`} meta={xtrLabelOrFree(event.priceStars ?? 0)} />
            ))}
            {data.events.length === 0 && <EmptyBlock title="No events yet" detail="Create webinars, AMAs, meetups, or challenges." />}
          </ListGroup>

          <SectionLabel>Products</SectionLabel>
          <ListGroup>
            {data.products.map((product) => (
              <ListRow key={product.id} tone="red" icon="product" title={product.title} detail={`${product.type.replace('_', ' ')}. ${product.purchases} purchases`} meta={xtrLabel(product.priceStars)} />
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
            <ListRow
              tone="amber"
              icon="stars"
              title="Monetization & Payouts"
              detail="How revenue, commission, and payouts work"
              meta={`${formatCommissionRate(me.commissionRateBps)} fee`}
              onClick={() => onNavigate?.('monetization')}
            />
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
        <ListRow tone="blue" icon="bot" title="Restart intro" detail="Replay the onboarding walkthrough" onClick={() => router.push('/')} />
        {data && (
          <ListRow tone="green" icon="member" title="Member preview" detail="See this community the way a member does" onClick={() => router.push(`/member/${data.community.id}`)} />
        )}
        {me?.isPlatformAdmin && (
          <ListRow tone="purple" icon="settings" title="Platform admin" detail="Open the CommunityOS admin dashboard" onClick={() => router.push('/admin')} />
        )}
      </ListGroup>
    </section>
  )
}

function MonetizationScreen({ me }: { me: MeDto }) {
  const rateLabel = formatCommissionRate(me.commissionRateBps)
  const exampleGross = 1000
  const exampleCommission = Math.round((exampleGross * me.commissionRateBps) / 10000)
  const exampleNet = exampleGross - exampleCommission

  return (
    <section className="tg-screen">
      <h1 className="tg-left-title">Monetization & Payouts</h1>

      <SectionLabel>How you earn</SectionLabel>
      <ListGroup>
        <ListRow tone="blue" icon="membership" title="Memberships" detail="Recurring Stars subscriptions, billed automatically by Telegram" />
        <ListRow tone="red" icon="product" title="Products" detail="One-time digital products, downloads, and consultations" />
        <ListRow tone="purple" icon="event" title="Events" detail="Paid webinars, AMAs, and meetups" />
        <ListRow tone="green" icon="referral" title="Referrals" detail="Reward members who bring in new joins, purchases, or revenue" />
      </ListGroup>

      <SectionLabel>Platform commission</SectionLabel>
      <div className="tg-form-card">
        <p>
          CommunityOS keeps <strong>{rateLabel}</strong> of every Telegram Stars payment to cover payment processing, hosting, and support.
          The rest is credited straight to your balance — automatically, on every payment.
        </p>
      </div>

      <SectionLabel>Example calculation</SectionLabel>
      <ListGroup>
        <ListRow tone="blue" icon="stars" title="Member pays" detail="Gross Stars payment" meta={`${exampleGross.toLocaleString()} XTR`} />
        <ListRow tone="amber" icon="stars" title={`Platform commission (${rateLabel})`} detail="Deducted automatically" meta={`-${exampleCommission.toLocaleString()} XTR`} />
        <ListRow tone="green" icon="stars" title="You receive" detail="Credited to your balance" meta={`${exampleNet.toLocaleString()} XTR`} />
      </ListGroup>

      <p style={{ opacity: 0.6, fontSize: 13, padding: '0 16px 16px' }}>
        Commission is deducted the moment a payment is confirmed, so your balance always reflects exactly what&apos;s yours to withdraw.
      </p>
    </section>
  )
}

function SettingsScreen({
  data,
  onUpdateSetting,
  onUpdateStatus,
}: {
  data: DashboardDto
  onUpdateSetting: (partial: Partial<{ starsCheckoutEnabled: boolean; notificationsEnabled: boolean }>) => void
  onUpdateStatus: (status: 'active' | 'paused' | 'archived') => void
}) {
  const settings = data.community.settings ?? { starsCheckoutEnabled: true, notificationsEnabled: true }
  const status = data.community.status
  return (
    <section className="tg-screen">
      <h1 className="tg-left-title">Settings</h1>
      {status !== 'active' && (
        <section className="tg-callout">
          <span>{status === 'archived' ? 'ARCHIVED' : 'PAUSED'}</span>
          <h2>{status === 'archived' ? 'This community is archived' : 'This community is paused'}</h2>
          <p>Members can&apos;t access new content until you reactivate it.</p>
          <button
            type="button"
            onClick={() => {
              haptic('medium')
              if (window.confirm('Reactivate this community? Members will regain access immediately.')) onUpdateStatus('active')
            }}
          >
            Reactivate community
          </button>
        </section>
      )}
      <SectionLabel>Bot connection</SectionLabel>
      <ListGroup>
        {data.chats.map((chat) => <ChatRow key={chat.id} chat={chat} image={data.community.avatarUrl} />)}
        {data.chats.length === 0 && <EmptyBlock title="No group connected" detail="Add the bot as admin in a Telegram group or channel, then share a membership to confirm the connection." />}
      </ListGroup>
      <SectionLabel>Checkout and notifications</SectionLabel>
      <ListGroup>
        <ListRow
          tone={settings.starsCheckoutEnabled ? 'green' : 'amber'}
          icon="stars"
          title="Stars checkout"
          detail="Let members pay with Telegram Stars"
          meta={settings.starsCheckoutEnabled ? 'on' : 'off'}
          onClick={() => onUpdateSetting({ starsCheckoutEnabled: !settings.starsCheckoutEnabled })}
        />
        <ListRow
          tone={settings.notificationsEnabled ? 'green' : 'amber'}
          icon="comment"
          title="Notifications"
          detail="Bot messages for renewals, access changes, and join requests"
          meta={settings.notificationsEnabled ? 'on' : 'off'}
          onClick={() => onUpdateSetting({ notificationsEnabled: !settings.notificationsEnabled })}
        />
      </ListGroup>
      {status === 'active' && (
        <>
          <SectionLabel>Danger zone</SectionLabel>
          <ListGroup>
            <ListRow
              tone="amber"
              icon="settings"
              title="Pause community"
              detail="Temporarily block new member access. You can reactivate anytime."
              onClick={() => {
                if (window.confirm('Pause this community? Members will lose access to new content until you reactivate it.')) {
                  onUpdateStatus('paused')
                }
              }}
            />
            <ListRow
              tone="red"
              icon="delete"
              title="Archive community"
              detail="Hide this community and stop all member access."
              onClick={() => {
                if (
                  window.confirm(
                    'Archive this community? This stops all member access and hides it from your account. This is hard to undo — only continue if you are sure.'
                  )
                ) {
                  onUpdateStatus('archived')
                }
              }}
            />
          </ListGroup>
        </>
      )}
    </section>
  )
}

function signalTone(tone: HealthSignalDto['tone']): 'blue' | 'red' | 'purple' | 'green' | 'amber' {
  if (tone === 'ok') return 'green'
  if (tone === 'warn') return 'amber'
  if (tone === 'danger') return 'red'
  return 'blue'
}

function AiManagerScreen({
  data,
  question,
  answer,
  history,
  busy,
  onQuestion,
  onAsk,
  onGenerateReport,
  onUpdateSettings,
  faqEntries,
  knowledgeSources,
  weeklyReports,
  usageCount,
  reportsOpen,
  onToggleReportsOpen,
  faqQuestion,
  onFaqQuestion,
  faqAnswer,
  onFaqAnswer,
  onCreateFaq,
  onDeleteFaq,
  knowledgeTitle,
  onKnowledgeTitle,
  knowledgeContent,
  onKnowledgeContent,
  onCreateKnowledge,
  onDeleteKnowledge,
}: {
  data: DashboardDto
  question: string
  answer: string | null
  history: { question: string; answer: string }[]
  busy: boolean
  onQuestion: (value: string) => void
  onAsk: (event: FormEvent) => void
  onGenerateReport: () => void
  onUpdateSettings: (partial: Partial<DashboardDto['ai']['settings']>) => void
  faqEntries: FaqEntryDto[] | null
  knowledgeSources: KnowledgeSourceDto[] | null
  weeklyReports: WeeklyReportDto[] | null
  usageCount: number | null
  reportsOpen: boolean
  onToggleReportsOpen: () => void
  faqQuestion: string
  onFaqQuestion: (value: string) => void
  faqAnswer: string
  onFaqAnswer: (value: string) => void
  onCreateFaq: (event: FormEvent) => void
  onDeleteFaq: (faq: FaqEntryDto) => void
  knowledgeTitle: string
  onKnowledgeTitle: (value: string) => void
  knowledgeContent: string
  onKnowledgeContent: (value: string) => void
  onCreateKnowledge: (event: FormEvent) => void
  onDeleteKnowledge: (source: KnowledgeSourceDto) => void
}) {
  const { settings } = data.ai
  return (
    <section className="tg-screen">
      <h1 className="tg-left-title">AI Community Manager</h1>

      {data.ai.suggestions.length > 0 && (
        <>
          <SectionLabel>Suggestions</SectionLabel>
          <ListGroup>
            {data.ai.suggestions.map((signal) => (
              <ListRow key={signal.id} tone={signalTone(signal.tone)} icon="ai" title={signal.title} detail={signal.detail} />
            ))}
          </ListGroup>
        </>
      )}

      <SectionLabel>Weekly Report</SectionLabel>
      <div className="tg-form-card">
        <p>Status: {data.ai.weeklyReportStatus}</p>
        <button type="button" onClick={() => { haptic('medium'); onGenerateReport() }} disabled={busy}>
          {busy ? 'Working…' : 'Generate Report'}
        </button>
      </div>
      <ListGroup>
        <ListRow
          tone="blue"
          icon="growth"
          title="AI usage this month"
          detail="Calls made through the AI gateway"
          meta={usageCount === null ? '…' : String(usageCount)}
        />
        <ListRow
          tone="purple"
          icon="ai"
          title="Report history"
          detail={`${weeklyReports?.length ?? 0} past reports`}
          meta={weeklyReports && weeklyReports.length > 0 ? (reportsOpen ? 'Hide' : 'View') : undefined}
          onClick={weeklyReports && weeklyReports.length > 0 ? onToggleReportsOpen : undefined}
        />
      </ListGroup>
      {reportsOpen && weeklyReports && weeklyReports.length > 0 && (
        <ListGroup>
          {weeklyReports.map((report) => (
            <ListRow key={report.id} tone="blue" icon="ai" title={dateShort(report.createdAt)} detail={report.summary ?? 'No summary'} meta={report.status} />
          ))}
        </ListGroup>
      )}

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
      {history.length > 0 && (
        <ListGroup>
          {history.map((entry, index) => (
            <ListRow key={index} tone="blue" icon="ai" title={entry.question} detail={entry.answer} />
          ))}
        </ListGroup>
      )}

      <SectionLabel>FAQ</SectionLabel>
      <form className="tg-form-card" onSubmit={onCreateFaq}>
        <div className="tg-input-group">
          <input
            value={faqQuestion}
            onChange={(event) => onFaqQuestion(event.target.value)}
            placeholder="Question members ask"
            aria-label="FAQ question"
          />
          <textarea
            value={faqAnswer}
            onChange={(event) => onFaqAnswer(event.target.value)}
            placeholder="Answer"
            aria-label="FAQ answer"
          />
        </div>
        <button type="submit" onClick={() => haptic('medium')}>Add FAQ</button>
      </form>
      <ListGroup>
        {(faqEntries ?? []).map((faq) => (
          <ListRow key={faq.id} tone="red" icon="delete" title={faq.question} detail={faq.answer} onClick={() => onDeleteFaq(faq)} />
        ))}
        {faqEntries !== null && faqEntries.length === 0 && (
          <EmptyBlock title="No FAQ entries yet" detail="Add answers to the questions members ask most." />
        )}
        {faqEntries === null && <EmptyBlock title="Loading…" detail="Fetching your FAQ entries." />}
      </ListGroup>

      <SectionLabel>Knowledge Sources</SectionLabel>
      <form className="tg-form-card" onSubmit={onCreateKnowledge}>
        <div className="tg-input-group">
          <input
            value={knowledgeTitle}
            onChange={(event) => onKnowledgeTitle(event.target.value)}
            placeholder="Source title"
            aria-label="Knowledge source title"
          />
          <textarea
            value={knowledgeContent}
            onChange={(event) => onKnowledgeContent(event.target.value)}
            placeholder="Notes or context the AI can reference"
            aria-label="Knowledge source content"
          />
        </div>
        <button type="submit" onClick={() => haptic('medium')}>Add Source</button>
      </form>
      <ListGroup>
        {(knowledgeSources ?? []).map((source) => (
          <ListRow
            key={source.id}
            tone="red"
            icon="delete"
            title={source.title}
            detail={source.content ?? source.sourceType}
            onClick={() => onDeleteKnowledge(source)}
          />
        ))}
        {knowledgeSources !== null && knowledgeSources.length === 0 && (
          <EmptyBlock title="No knowledge sources yet" detail="Add context the AI can use when answering questions." />
        )}
        {knowledgeSources === null && <EmptyBlock title="Loading…" detail="Fetching your knowledge sources." />}
      </ListGroup>

      <SectionLabel>Settings</SectionLabel>
      <ListGroup>
        <ListRow
          tone={settings.faqEnabled ? 'green' : 'amber'}
          icon="ai"
          title="FAQ answers"
          detail={`${data.ai.faqCount} curated entries`}
          meta={settings.faqEnabled ? 'on' : 'off'}
          onClick={() => onUpdateSettings({ faqEnabled: !settings.faqEnabled })}
        />
        <ListRow
          tone={settings.welcomeEnabled ? 'green' : 'amber'}
          icon="comment"
          title="Welcome messages"
          detail="Greet members on their first access grant"
          meta={settings.welcomeEnabled ? 'on' : 'off'}
          onClick={() => onUpdateSettings({ welcomeEnabled: !settings.welcomeEnabled })}
        />
        <ListRow
          tone={settings.reportsEnabled ? 'green' : 'amber'}
          icon="growth"
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
  isEditing,
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
  isEditing?: boolean
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
        <h1>{isEditing ? 'Edit Product' : 'Create Product'}</h1>
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
      <FixedButton label={isEditing ? 'Save Changes' : 'Create Product'} submit disabled={submitting} />
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
  isEditing,
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
  isEditing?: boolean
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
        <h1>{isEditing ? 'Edit Event' : 'Create Event'}</h1>
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
      <FixedButton label={isEditing ? 'Save Changes' : 'Create Event'} submit disabled={submitting} />
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
  onGuide,
  onDelete,
  onMore,
  onReferralReward,
}: {
  kind: 'product' | 'event'
  title: string
  description: string
  price: string
  coverUrl?: string | null
  primaryLabel: string
  onEdit: () => void
  onShare: () => void
  onGuide: () => void
  onDelete: () => void
  onMore: () => void
  onReferralReward?: () => void
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
        <ActionTile label="Share" icon="share" onClick={onShare} />
        <ActionTile label="More" icon="more" onClick={onMore} />
      </div>
      <ListGroup>
        <ListRow tone="green" icon="share" title="Telegram Card" detail="Share sends a bot message with a Web App button." onClick={onShare} />
        <ListRow tone="blue" icon="business" title="How Sharing Works" detail="See what recipients see when they tap your link." onClick={onGuide} />
        {onReferralReward && (
          <ListRow tone="green" icon="referral" title="Referral Reward" detail="Reward members who invite friends to this offer." onClick={onReferralReward} />
        )}
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
  isEditing,
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
  isEditing?: boolean
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
        <h1>{isEditing ? 'Edit Membership' : 'Create Membership'}</h1>
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
      <FixedButton label={isEditing ? 'Save Changes' : 'Create Membership'} submit disabled={submitting} />
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
  onMore,
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
  onMore: () => void
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
        <ActionTile label="Copy" icon="copy" onClick={onCopyLink} />
        <ActionTile label="More" icon="more" onClick={onMore} />
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

function ShareGuide({
  link,
  onCopyLink,
  onBack,
  onDone,
}: {
  link?: string
  onCopyLink?: () => void
  onBack: () => void
  onDone: () => void
}) {
  const [step, setStep] = useState(0)
  const slides = [
    { title: 'Tap Share on any membership, product, or event', icon: 'share' as IconName },
    { title: 'We send a message with a button to your group or your DMs', icon: 'comment' as IconName },
    { title: 'Tapping it opens CommunityOS straight into the offer', icon: 'business' as IconName },
  ]
  const isLast = step === slides.length - 1
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
        {isLast && link && <p className="tg-share-link-preview">{link}</p>}
      </section>
      <footer className="tg-story-footer">
        {isLast && link && onCopyLink && (
          <button className="tg-copy-link-button" type="button" onClick={onCopyLink}>
            Copy link again
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            if (!isLast) setStep(step + 1)
            else onDone()
          }}
        >
          {isLast ? 'Done' : 'Next'}
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
  onClaimReward,
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
  onClaimReward: (rewardId: number) => void
  onToast: (message: string) => void
}) {
  const [rewardsOpen, setRewardsOpen] = useState(false)
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
        <ListRow
          tone="amber"
          icon="rewards"
          title="Rewards"
          detail={`${data.rewards.length} available`}
          meta={data.rewards.length > 0 ? (rewardsOpen ? 'Hide' : 'View') : undefined}
          onClick={data.rewards.length > 0 ? () => setRewardsOpen((open) => !open) : undefined}
        />
      </ListGroup>
      {rewardsOpen && data.rewards.length > 0 && (
        <ListGroup>
          {data.rewards.map((reward) => (
            <ListRow
              key={reward.id}
              tone={reward.claimed ? 'green' : 'amber'}
              icon="rewards"
              title={reward.title}
              detail={reward.description ?? reward.type.replace('_', ' ')}
              meta={reward.claimed ? 'Claimed' : 'Claim'}
              onClick={reward.claimed ? undefined : () => onClaimReward(reward.id)}
            />
          ))}
        </ListGroup>
      )}
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

function RowIcon({ name }: { name: IconName }) {
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
      <button
        className="tg-list-row"
        type="button"
        onClick={() => {
          haptic('light')
          onClick()
        }}
      >
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

function ActionTile({ label, icon, onClick }: { label: string; icon: 'edit' | 'copy' | 'share' | 'more'; onClick: () => void }) {
  return (
    <button
      className="tg-action-tile"
      type="button"
      onClick={() => {
        haptic('light')
        onClick()
      }}
    >
      <span className="tg-action-icon" aria-hidden="true">
        <RowIcon name={icon} />
      </span>
      <strong>{label}</strong>
    </button>
  )
}

function ActionSheet({
  kind,
  productStatus,
  onDuplicate,
  onToggleStatus,
  onClose,
}: {
  kind: 'plan' | 'product' | 'event'
  productStatus?: 'draft' | 'active'
  onDuplicate: () => void
  onToggleStatus?: () => void
  onClose: () => void
}) {
  const kindLabel = kind === 'plan' ? 'Membership' : kind === 'product' ? 'Product' : 'Event'
  return (
    <div className="tg-action-sheet-overlay" onClick={onClose}>
      <div className="tg-action-sheet" role="dialog" aria-label="More Options" onClick={(event) => event.stopPropagation()}>
        <h2>More Options</h2>
        <p>{kindLabel} actions</p>
        {onToggleStatus && (
          <button type="button" onClick={onToggleStatus}>
            {productStatus === 'active' ? 'Move to Draft' : 'Publish'}
          </button>
        )}
        <button type="button" onClick={onDuplicate}>
          Duplicate {kindLabel}
        </button>
        <button type="button" className="cancel" onClick={onClose}>
          Cancel
        </button>
      </div>
    </div>
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
      <button
        type={submit ? 'submit' : 'button'}
        onClick={() => {
          haptic('medium')
          onClick?.()
        }}
        disabled={disabled}
      >
        {disabled && <span className="tg-button-spinner" aria-hidden="true" />}
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

function offerStartLink(communityId: number, kind: 'product' | 'event', itemId: number | string) {
  return botUrl(`?startapp=co_${communityId}_${kind}_${itemId}`)
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
