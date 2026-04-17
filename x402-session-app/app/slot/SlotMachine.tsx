"use client"

import React, { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Wallet,
  Check,
  AlertCircle,
  Loader2,
  Sparkles,
  Coins,
  TrendingUp,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAccount, useConnect, useDisconnect, useWalletClient } from "wagmi"
import { createSession } from "elsa-x402-sessions"
import type { SessionHandle } from "elsa-x402-sessions"

// ─── Config (browser env) ───────────────────────────────────────────
const FACILITATOR_URL =
  process.env.NEXT_PUBLIC_SESSION_FACILITATOR_URL ?? "http://localhost:4021"
const USDC_ADDRESS = (process.env.NEXT_PUBLIC_USDC_ADDRESS ??
  "0x036CbD53842c5426634e7929541eC2318f3dCF7e") as `0x${string}`
const RECIPIENT = (process.env.NEXT_PUBLIC_RECIPIENT_ADDRESS ?? "") as `0x${string}` | ""
const PER_PULL_USDC = parseFloat(process.env.NEXT_PUBLIC_PER_CALL_USDC ?? "0.10")
const NETWORK = (process.env.NEXT_PUBLIC_NETWORK ?? "base:sepolia") as
  | "base:sepolia"
  | "base:mainnet"

const USDC_DECIMALS = 6n
const ONE_USDC = 10n ** USDC_DECIMALS

type PullResult = {
  reels: [string, string, string]
  win: boolean
  multiplier: number
  payoutLabel: string
}

const PLACEHOLDER_REELS: [string, string, string] = ["❓", "❓", "❓"]

function baseUnitsToUsdc(units: string): string {
  const bi = BigInt(units)
  const whole = bi / ONE_USDC
  const frac = (bi % ONE_USDC).toString().padStart(Number(USDC_DECIMALS), "0")
  return `${whole}.${frac}`
}

export function SlotMachine() {
  const { address: walletAddress, isConnected } = useAccount()
  const { connectors, connect, isPending: isConnectPending } = useConnect()
  const { disconnect } = useDisconnect()
  const { data: walletClient } = useWalletClient()

  // session
  const [session, setSession] = useState<SessionHandle | null>(null)
  const [authAmount, setAuthAmount] = useState<"1" | "2" | "manual">("1")
  const [manualAmount, setManualAmount] = useState("5")
  const [spent, setSpent] = useState(0)
  const [isAuthorizing, setIsAuthorizing] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // slot state
  const [reels, setReels] = useState<[string, string, string]>(PLACEHOLDER_REELS)
  const [spinningReels, setSpinningReels] = useState<[boolean, boolean, boolean]>([
    false,
    false,
    false,
  ])
  const [lastResult, setLastResult] = useState<PullResult | null>(null)
  const [isPulling, setIsPulling] = useState(false)
  const [pulls, setPulls] = useState(0)
  const [wins, setWins] = useState(0)
  const [biggestMultiplier, setBiggestMultiplier] = useState(0)

  const cap =
    authAmount === "manual" ? parseFloat(manualAmount || "0") : parseFloat(authAmount)
  const displayedCap = session ? parseFloat(baseUnitsToUsdc(session.cap)) : cap
  const remaining = Math.max(0, displayedCap - spent)
  const canPull = session !== null && remaining >= PER_PULL_USDC && !isPulling

  function connectWallet() {
    setErrorMsg(null)
    const injected = connectors.find((c) => c.id === "injected") ?? connectors[0]
    if (!injected) {
      setErrorMsg("No wallet connector available. Install MetaMask or Coinbase Wallet.")
      return
    }
    connect({ connector: injected })
  }

  async function handleAuthorize() {
    setErrorMsg(null)
    if (!isConnected || !walletAddress) {
      connectWallet()
      return
    }
    if (!walletClient) {
      setErrorMsg("Wallet client not ready yet — try again in a moment.")
      return
    }
    if (!RECIPIENT) {
      setErrorMsg("Missing env: NEXT_PUBLIC_RECIPIENT_ADDRESS")
      return
    }
    if (!isFinite(cap) || cap <= 0) {
      setErrorMsg("Cap must be a positive number")
      return
    }

    setIsAuthorizing(true)
    try {
      const s = await createSession({
        walletClient,
        facilitatorUrl: FACILITATOR_URL,
        network: NETWORK,
        asset: USDC_ADDRESS,
        decimals: 6,
        spendingCap: cap.toFixed(2),
        expiresIn: 3600,
        recipient: RECIPIENT as `0x${string}`,
      })
      setSession(s)
      setSpent(0)
      setPulls(0)
      setWins(0)
      setBiggestMultiplier(0)
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err))
    } finally {
      setIsAuthorizing(false)
    }
  }

  async function handlePull() {
    if (!canPull || !session) return
    setErrorMsg(null)
    setIsPulling(true)
    setSpinningReels([true, true, true])
    setLastResult(null)

    try {
      const res = await session.fetch("/slot/pull", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })

      if (!res.ok) {
        const paymentRespB64 = res.headers.get("payment-response")
        if (paymentRespB64) {
          try {
            const decoded = JSON.parse(
              typeof Buffer !== "undefined"
                ? Buffer.from(paymentRespB64, "base64").toString("utf-8")
                : decodeURIComponent(escape(atob(paymentRespB64))),
            ) as { errorReason?: string; errorMessage?: string }
            const reason = decoded.errorReason ?? "unknown"
            const msg = (decoded.errorMessage ?? "").split("\n")[0]
            throw new Error(`${reason}${msg ? ": " + msg : ""}`)
          } catch (e) {
            if (e instanceof Error && e.message.includes(":")) throw e
          }
        }
        const errText = await res.text().catch(() => res.statusText)
        throw new Error(`pull ${res.status}: ${errText.slice(0, 200)}`)
      }

      const data = (await res.json()) as PullResult
      setSpent((s) => s + PER_PULL_USDC)
      setPulls((p) => p + 1)
      if (data.win) {
        setWins((w) => w + 1)
        if (data.multiplier > biggestMultiplier) setBiggestMultiplier(data.multiplier)
      }

      // Staggered reel reveal for drama
      setTimeout(() => {
        setReels((prev) => [data.reels[0], prev[1], prev[2]])
        setSpinningReels([false, true, true])
      }, 500)
      setTimeout(() => {
        setReels((prev) => [data.reels[0], data.reels[1], prev[2]])
        setSpinningReels([false, false, true])
      }, 900)
      setTimeout(() => {
        setReels(data.reels)
        setSpinningReels([false, false, false])
        setLastResult(data)
        setIsPulling(false)
      }, 1300)
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err))
      setSpinningReels([false, false, false])
      setReels(PLACEHOLDER_REELS)
      setIsPulling(false)
    }
  }

  const winRate = pulls > 0 ? ((wins / pulls) * 100).toFixed(0) : "0"

  return (
    <div className="max-w-3xl mx-auto w-full flex flex-col gap-6 p-4">
      {/* Wallet / authorization panel */}
      <div className="bg-card/50 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <Wallet className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">
                {walletAddress ? "Payment Session" : "Connect Wallet"}
              </h3>
              <p className="text-sm text-white/50">
                {walletAddress
                  ? `${walletAddress.slice(0, 8)}…${walletAddress.slice(-6)}`
                  : "Sign one approve tx, pay per lever pull"}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {!isConnected ? (
              <Button
                onClick={connectWallet}
                disabled={isConnectPending}
                className="rounded-xl px-6"
              >
                {isConnectPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Connecting…
                  </>
                ) : (
                  "Connect Wallet"
                )}
              </Button>
            ) : (
              <>
                <div className="flex bg-white/5 p-1 rounded-xl border border-white/10">
                  {(["1", "2", "manual"] as const).map((amount) => (
                    <button
                      key={amount}
                      onClick={() => setAuthAmount(amount)}
                      disabled={!!session}
                      className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all disabled:opacity-50
                        ${authAmount === amount ? "bg-white text-black shadow-lg" : "text-white/60 hover:text-white hover:bg-white/5"}`}
                    >
                      {amount === "manual" ? "Manual" : `$${amount}`}
                    </button>
                  ))}
                </div>

                {authAmount === "manual" && (
                  <input
                    type="number"
                    value={manualAmount}
                    onChange={(e) => setManualAmount(e.target.value)}
                    disabled={!!session}
                    className="w-20 bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
                    placeholder="5.00"
                  />
                )}

                <Button
                  onClick={handleAuthorize}
                  disabled={isAuthorizing || !!session}
                  className="rounded-xl px-6"
                >
                  {isAuthorizing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Signing…
                    </>
                  ) : session ? (
                    <>
                      <Check className="mr-2 h-4 w-4" />
                      Authorized
                    </>
                  ) : (
                    "Authorize Session"
                  )}
                </Button>

                {!session && (
                  <button
                    onClick={() => disconnect()}
                    className="text-xs text-white/40 hover:text-white/70 underline-offset-2 hover:underline"
                  >
                    disconnect
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {session && (
          <div className="mt-6 pt-6 border-t border-white/5 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Stat label="Authorized" value={`$${displayedCap.toFixed(2)}`} />
            <Stat label="Spent" value={`$${spent.toFixed(2)}`} color="primary" />
            <Stat label="Remaining" value={`$${remaining.toFixed(2)}`} />
            <Stat
              label="Pulls left"
              value={Math.floor(remaining / PER_PULL_USDC).toString()}
            />
          </div>
        )}

        {errorMsg && (
          <div className="mt-4 flex items-start gap-2 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg p-3">
            <AlertCircle size={14} className="mt-0.5 shrink-0" />
            <span className="break-all">{errorMsg}</span>
          </div>
        )}
      </div>

      {/* Slot machine */}
      <div className="bg-gradient-to-b from-card/50 to-card/20 backdrop-blur-md border border-white/10 rounded-2xl p-8 shadow-xl">
        <div className="flex justify-center gap-3 sm:gap-6 mb-8">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-24 h-28 sm:w-32 sm:h-36 rounded-2xl bg-black/60 border-2 border-white/10 flex items-center justify-center overflow-hidden relative shadow-inner"
            >
              <AnimatePresence mode="wait">
                {spinningReels[i] ? (
                  <motion.div
                    key="spin"
                    animate={{ y: [0, -20, 0] }}
                    transition={{ duration: 0.15, repeat: Infinity }}
                    className="text-5xl sm:text-6xl"
                  >
                    🎰
                  </motion.div>
                ) : (
                  <motion.div
                    key={reels[i] + i}
                    initial={{ y: 40, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -40, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 200, damping: 15 }}
                    className="text-5xl sm:text-6xl"
                  >
                    {reels[i]}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>

        <div className="flex flex-col items-center gap-3">
          <Button
            onClick={handlePull}
            disabled={!canPull}
            className="rounded-xl px-10 py-6 text-lg font-bold disabled:opacity-50"
          >
            {isPulling ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Spinning…
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-5 w-5" />
                Pull Lever · ${PER_PULL_USDC.toFixed(2)}
              </>
            )}
          </Button>

          {lastResult && !isPulling && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`text-center text-sm font-semibold mt-2 px-4 py-2 rounded-lg ${
                lastResult.win
                  ? "text-green-400 bg-green-500/10 border border-green-500/30"
                  : "text-white/40"
              }`}
            >
              {lastResult.payoutLabel}
            </motion.div>
          )}

          {!session && (
            <p className="text-xs text-white/30 text-center mt-2">
              Connect your wallet and authorize a session to start pulling
            </p>
          )}
          {session && remaining < PER_PULL_USDC && (
            <p className="text-xs text-red-400/70 text-center mt-2">
              Session balance exhausted — reload the page to start a new one
            </p>
          )}
        </div>
      </div>

      {/* Stats */}
      {pulls > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <StatCard icon={<Coins className="h-4 w-4" />} label="Pulls" value={pulls.toString()} />
          <StatCard
            icon={<TrendingUp className="h-4 w-4" />}
            label="Wins"
            value={`${wins} (${winRate}%)`}
          />
          <StatCard
            icon={<Sparkles className="h-4 w-4" />}
            label="Best"
            value={biggestMultiplier > 0 ? `×${biggestMultiplier}` : "—"}
          />
        </div>
      )}
    </div>
  )
}

function Stat({
  label,
  value,
  color,
}: {
  label: string
  value: string
  color?: "primary"
}) {
  return (
    <div className="bg-white/5 rounded-xl p-3 border border-white/10">
      <span className="text-[10px] uppercase tracking-wider text-white/25 block mb-1">
        {label}
      </span>
      <span
        className={`text-lg font-mono ${color === "primary" ? "text-primary" : "text-white"}`}
      >
        {value}
      </span>
    </div>
  )
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <div className="bg-card/30 backdrop-blur-md border border-white/5 rounded-xl p-4 flex items-center gap-3">
      <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div>
        <div className="text-[10px] uppercase tracking-wider text-white/30">{label}</div>
        <div className="text-sm font-mono text-white">{value}</div>
      </div>
    </div>
  )
}
