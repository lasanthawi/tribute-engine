import type { DashboardDto, MeDto } from './api-client'
import { pickPrimary } from './format'

export type NextActionTarget = 'access' | 'growth' | 'rewards' | 'more' | 'members' | 'share' | 'setup'

export interface NextAction {
  title: string
  detail: string
  cta: string
  target: NextActionTarget
}

const PRIORITY_RANK: Record<'high' | 'medium' | 'low', number> = { high: 0, medium: 1, low: 2 }

export function computeNextAction(data: DashboardDto): NextAction | null {
  const activeStep = data.setup.find((step) => step.status === 'active')
  if (activeStep) {
    return { title: activeStep.title, detail: activeStep.detail, cta: 'Continue setup', target: 'setup' }
  }

  const topAction = [...data.nextActions].sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority])[0]
  if (topAction) {
    return { title: topAction.title, detail: topAction.detail, cta: 'Review', target: topAction.target }
  }

  const latest = pickPrimary(data.plans)?.name ?? pickPrimary(data.products)?.title ?? data.events[0]?.title ?? null
  if (latest) {
    return { title: `Share ${latest}`, detail: 'Send it to your Telegram audience to bring in joins or sales.', cta: 'Share', target: 'share' }
  }

  return null
}

export type AccountNextActionTarget = 'addCommunity' | 'openCommunity'

export interface AccountNextAction {
  title: string
  detail: string
  cta: string
  target: AccountNextActionTarget
}

export function computeAccountNextAction(me: MeDto): AccountNextAction | null {
  if (me.communities.length === 0) {
    return {
      title: 'Connect your first community',
      detail: 'Add the bot to a Telegram group or channel to start selling.',
      cta: 'Connect Telegram',
      target: 'addCommunity',
    }
  }

  if (me.accountStats.accessIssues > 0) {
    return {
      title: 'Review access issues',
      detail: `${me.accountStats.accessIssues} member(s) need attention across your communities.`,
      cta: 'Open',
      target: 'openCommunity',
    }
  }

  return {
    title: 'Grow your communities',
    detail: 'Open a community to share an offer or launch a referral campaign.',
    cta: 'Open',
    target: 'openCommunity',
  }
}
