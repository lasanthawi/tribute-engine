import type { CommunityMetrics } from './analytics'
import type { HealthSignalDto, NextActionDto } from './api-client'

// Turns raw metrics into the prioritised signals and next-actions the publisher
// home renders. Deterministic for the beta; can be replaced by AI later.
export function buildHealthSignals(metrics: CommunityMetrics): HealthSignalDto[] {
  const signals: HealthSignalDto[] = []

  if (metrics.accessIssues > 0) {
    signals.push({
      id: 1,
      title: 'Access queue needs attention',
      detail: `${metrics.accessIssues} member(s) do not have clean Telegram access yet.`,
      tone: 'warn',
    })
  }
  if (metrics.pendingRenewals > 0) {
    signals.push({
      id: 2,
      title: 'Renewals at risk',
      detail: `${metrics.pendingRenewals} subscription(s) are past due.`,
      tone: 'danger',
    })
  }
  if (metrics.referralActivations > 0) {
    signals.push({
      id: 3,
      title: 'Referral loop is converting',
      detail: `${metrics.referralActivations} activated member(s) came through invites.`,
      tone: 'ok',
    })
  }
  if (signals.length === 0) {
    signals.push({ id: 4, title: 'Community is healthy', detail: 'No access or renewal issues right now.', tone: 'ok' })
  }
  return signals
}

export function buildNextActions(metrics: CommunityMetrics): NextActionDto[] {
  const actions: NextActionDto[] = []

  if (metrics.accessIssues > 0) {
    actions.push({
      id: 'access-review',
      title: 'Review access queue',
      detail: `Grant or repair ${metrics.accessIssues} pending member(s).`,
      target: 'access',
      priority: 'high',
    })
  }
  if (metrics.pendingRenewals > 0) {
    actions.push({
      id: 'renewal-followup',
      title: 'Fix failed renewals',
      detail: `${metrics.pendingRenewals} member(s) need payment follow-up.`,
      target: 'members',
      priority: 'high',
    })
  }
  if (metrics.referralActivations === 0) {
    actions.push({
      id: 'campaign',
      title: 'Publish a referral campaign',
      detail: 'Reward members for inviting others.',
      target: 'growth',
      priority: 'medium',
    })
  }
  if (metrics.productsSold === 0) {
    actions.push({
      id: 'product',
      title: 'Create a paid product',
      detail: 'Turn your best content into a Stars purchase.',
      target: 'more',
      priority: 'low',
    })
  }
  return actions
}
