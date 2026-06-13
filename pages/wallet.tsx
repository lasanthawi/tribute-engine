import { useEffect, useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import BottomNav from '@/components/ui/BottomNav'
import Logo from '@/components/ui/Logo'
import Tabs from '@/components/ui/Tabs'
import { api, CoinPackageDto, MeDto, RedeemOption } from '@/lib/api-client'
import { haptic, hapticNotify, openInvoice } from '@/lib/telegram-webapp'
import {
  COINS_TO_POINTS_RATE,
  EXTRA_TICKET_COST,
  CONFIDENCE_BOOST_COST,
  STREAK_FREEZE_COST,
  MIN_POINTS_REDEEM,
} from '@/lib/coins'

export default function Wallet() {
  const [me, setMe] = useState<MeDto | null>(null)
  const [packages, setPackages] = useState<CoinPackageDto[] | null>(null)
  const [tab, setTab] = useState<'buy' | 'earn' | 'redeem'>('buy')
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [pointsToRedeem, setPointsToRedeem] = useState(MIN_POINTS_REDEEM)

  const refresh = async () => {
    try {
      const [meData, pkgData] = await Promise.all([api.getMe(), api.getCoinPackages()])
      setMe(meData)
      setPackages(pkgData.packages)
    } catch {
      setMe(null)
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  const flash = (text: string) => {
    setMessage(text)
    setTimeout(() => setMessage(null), 2500)
  }

  const handleBuy = async (pkg: CoinPackageDto) => {
    haptic('medium')
    setBusy(pkg.id)
    try {
      const { url } = await api.createCoinInvoice(pkg.id)
      if (!url) {
        flash('Coin purchases are only available inside Telegram.')
        return
      }
      const status = await openInvoice(url)
      if (status === 'paid') {
        hapticNotify('success')
        flash(`+${pkg.coins} coins added 🎉`)
        setTimeout(refresh, 1200)
      } else if (status === 'failed') {
        flash('Payment failed — please try again.')
      }
    } catch (e: any) {
      flash(e.message || 'Could not start checkout')
    } finally {
      setBusy(null)
    }
  }

  const handleRedeem = async (option: RedeemOption, coins?: number) => {
    if (!me) return
    haptic('medium')
    setBusy(option)
    try {
      const result = await api.redeemCoins(option, coins)
      hapticNotify('success')
      if (option === 'points' && result.pointsAwarded) {
        flash(`+${result.pointsAwarded} points 🎯`)
      } else if (option === 'ticket') {
        flash('+1 vote ticket 🎟️')
      } else if (option === 'confidence_boost') {
        flash('Confidence boost ready ⚡')
      } else if (option === 'streak_freeze') {
        flash('Streak freeze ready ❄️')
      }
      await refresh()
    } catch (e: any) {
      hapticNotify('error')
      flash(e.message || 'Redeem failed')
    } finally {
      setBusy(null)
    }
  }

  const coins = me?.coins ?? 0

  return (
    <>
      <Head>
        <title>Wallet · VOTE LEAGUE</title>
      </Head>
      <div className="screen">
        <div className="topbar">
          <div className="brand">
            <span className="brand-dot"><Logo size={26} /></span> Wallet
          </div>
        </div>

        <div className="wallet-balance-card">
          <span className="wallet-balance-icon">🪙</span>
          <div className="wallet-balance-value">{me ? coins.toLocaleString() : '—'}</div>
          <div className="wallet-balance-label">coins</div>
        </div>

        {message && <div className="wallet-toast">{message}</div>}

        <Tabs
          tabs={[
            { key: 'buy', label: 'Buy' },
            { key: 'earn', label: 'Earn' },
            { key: 'redeem', label: 'Redeem' },
          ]}
          active={tab}
          onChange={(k) => setTab(k as 'buy' | 'earn' | 'redeem')}
        />

        {tab === 'buy' && (
          <>
            <div className="section-title">Buy coins with Telegram Stars</div>
            {packages === null && (
              <>
                <div className="skeleton" style={{ height: 76, marginBottom: 10 }} />
                <div className="skeleton" style={{ height: 76, marginBottom: 10 }} />
                <div className="skeleton" style={{ height: 76, marginBottom: 10 }} />
              </>
            )}
            {packages?.map((pkg) => (
              <div key={pkg.id} className="coin-package-card">
                <div className="coin-package-icon">🪙</div>
                <div className="coin-package-info">
                  <div className="coin-package-title">{pkg.label}</div>
                  {pkg.bonus && <div className="coin-package-bonus">{pkg.bonus}</div>}
                </div>
                <button className="btn-primary coin-package-btn" disabled={busy !== null} onClick={() => handleBuy(pkg)}>
                  {busy === pkg.id ? '…' : `⭐ ${pkg.stars}`}
                </button>
              </div>
            ))}
          </>
        )}

        {tab === 'earn' && (
          <>
            <div className="section-title">Earn coins</div>
            <Link href="/invite" className="promo-banner">
              <span className="promo-icon">🔗</span>
              <span className="promo-text">
                <span className="promo-title">Invite friends</span>
                <span className="promo-sub">Earn 50 coins when a friend&apos;s referral activates</span>
              </span>
              <span className="promo-arrow">→</span>
            </Link>
            <div className="empty-state">
              More ways to earn coins are coming soon — daily streaks, challenges, and special events.
            </div>
          </>
        )}

        {tab === 'redeem' && (
          <>
            <div className="section-title">Redeem coins</div>

            <div className="redeem-card">
              <div className="redeem-info">
                <div className="redeem-title">🎯 Coins → Points</div>
                <div className="redeem-sub">{COINS_TO_POINTS_RATE} pts per coin</div>
              </div>
              <div className="redeem-stepper">
                <button
                  className="redeem-step-btn"
                  disabled={pointsToRedeem <= MIN_POINTS_REDEEM}
                  onClick={() => setPointsToRedeem((v) => Math.max(MIN_POINTS_REDEEM, v - 10))}
                >
                  −
                </button>
                <span className="redeem-step-value">{pointsToRedeem}</span>
                <button
                  className="redeem-step-btn"
                  disabled={pointsToRedeem >= coins}
                  onClick={() => setPointsToRedeem((v) => Math.min(coins, v + 10))}
                >
                  +
                </button>
              </div>
              <button
                className="btn-primary redeem-btn"
                disabled={busy !== null || coins < pointsToRedeem || pointsToRedeem < MIN_POINTS_REDEEM}
                onClick={() => handleRedeem('points', pointsToRedeem)}
              >
                {busy === 'points' ? '…' : `Redeem`}
              </button>
            </div>

            <div className="redeem-card">
              <div className="redeem-info">
                <div className="redeem-title">🎟️ Extra vote ticket</div>
                <div className="redeem-sub">{EXTRA_TICKET_COST} coins · +1 ticket today</div>
              </div>
              <button
                className="btn-primary redeem-btn"
                disabled={busy !== null || coins < EXTRA_TICKET_COST}
                onClick={() => handleRedeem('ticket')}
              >
                {busy === 'ticket' ? '…' : 'Redeem'}
              </button>
            </div>

            <div className="redeem-card">
              <div className="redeem-info">
                <div className="redeem-title">⚡ Confidence boost</div>
                <div className="redeem-sub">{CONFIDENCE_BOOST_COST} coins · stake up to 1000 pts on your next vote</div>
                {me !== null && me.confidenceBoosts > 0 && (
                  <div className="redeem-owned">You have {me.confidenceBoosts}</div>
                )}
              </div>
              <button
                className="btn-primary redeem-btn"
                disabled={busy !== null || coins < CONFIDENCE_BOOST_COST}
                onClick={() => handleRedeem('confidence_boost')}
              >
                {busy === 'confidence_boost' ? '…' : 'Redeem'}
              </button>
            </div>

            <div className="redeem-card">
              <div className="redeem-info">
                <div className="redeem-title">❄️ Streak freeze</div>
                <div className="redeem-sub">{STREAK_FREEZE_COST} coins · protects your streak after one miss</div>
                {me !== null && me.streakFreezes > 0 && (
                  <div className="redeem-owned">You have {me.streakFreezes}</div>
                )}
              </div>
              <button
                className="btn-primary redeem-btn"
                disabled={busy !== null || coins < STREAK_FREEZE_COST}
                onClick={() => handleRedeem('streak_freeze')}
              >
                {busy === 'streak_freeze' ? '…' : 'Redeem'}
              </button>
            </div>
          </>
        )}
      </div>
      <BottomNav />
    </>
  )
}
