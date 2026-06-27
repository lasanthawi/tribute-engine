import { IconName } from '@/components/icons'

export type RevenueModel = 'membership' | 'product' | 'event' | 'referral' | 'ai'

export type Screen =
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

export const introSlides = [
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
