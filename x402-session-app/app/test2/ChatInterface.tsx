"use client"

import React, { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Bot,
  User,
  ArrowRight,
  Check,
  AlertCircle,
  Loader2,
  Wallet,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAccount, useConnect, useDisconnect, useWalletClient } from "wagmi"
import { createSession } from "elsax402-sessions"
import type { SessionHandle } from "elsax402-sessions"

// ─── Config (browser env) ───────────────────────────────────────────
const FACILITATOR_URL =
  process.env.NEXT_PUBLIC_SESSION_FACILITATOR_URL ?? "http://localhost:4021"
const USDC_ADDRESS = (process.env.NEXT_PUBLIC_USDC_ADDRESS ??
  "0x036CbD53842c5426634e7929541eC2318f3dCF7e") as `0x${string}`
const RECIPIENT = (process.env.NEXT_PUBLIC_RECIPIENT_ADDRESS ?? "") as `0x${string}` | ""
const PER_CALL_USDC = parseFloat(process.env.NEXT_PUBLIC_PER_CALL_USDC ?? "0.10")
const NETWORK = (process.env.NEXT_PUBLIC_NETWORK ?? "base:sepolia") as
  | "base:sepolia"
  | "base:mainnet"

const USDC_DECIMALS = 6n
const ONE_USDC = 10n ** USDC_DECIMALS

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: Date
}

function baseUnitsToUsdc(units: string): string {
  const bi = BigInt(units)
  const whole = bi / ONE_USDC
  const frac = (bi % ONE_USDC).toString().padStart(Number(USDC_DECIMALS), "0")
  return `${whole}.${frac}`
}

export function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      role: "assistant",
      content:
        "Hi! Connect your wallet, authorize a USDC session, and every message you send is settled on-chain for $" +
        PER_CALL_USDC.toFixed(2) +
        " via ERC20 transferFrom on Base Sepolia. No per-message signing.",
      timestamp: new Date(),
    },
  ])
  const [input, setInput] = useState("")
  const [isTyping, setIsTyping] = useState(false)

  const { address: walletAddress, isConnected } = useAccount()
  const { connectors, connect, isPending: isConnectPending } = useConnect()
  const { disconnect } = useDisconnect()
  const { data: walletClient } = useWalletClient()

  const [session, setSession] = useState<SessionHandle | null>(null)
  const [authAmount, setAuthAmount] = useState<"1" | "2" | "manual">("1")
  const [manualAmount, setManualAmount] = useState("5")
  const [spent, setSpent] = useState(0) // decimal USDC
  const [isAuthorizing, setIsAuthorizing] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, isTyping])

  const cap =
    authAmount === "manual" ? parseFloat(manualAmount || "0") : parseFloat(authAmount)
  const displayedCap = session ? parseFloat(baseUnitsToUsdc(session.cap)) : cap
  const remaining = Math.max(0, displayedCap - spent)

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

    const capStr = cap.toFixed(2)
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
        spendingCap: capStr,
        expiresIn: 3600,
        recipient: RECIPIENT as `0x${string}`,
      })
      setSession(s)
      setSpent(0)
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: "assistant",
          content: `Session created ✓ on-chain approve for $${capStr} USDC. id: ${s.sessionId.slice(0, 8)}…`,
          timestamp: new Date(),
        },
      ])
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err))
    } finally {
      setIsAuthorizing(false)
    }
  }

  async function handleSend() {
    if (!input.trim() || isTyping) return
    if (!session) {
      setErrorMsg("Authorize a session first")
      return
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
      timestamp: new Date(),
    }
    const prompt = input
    setMessages((prev) => [...prev, userMessage])
    setInput("")
    setIsTyping(true)
    setErrorMsg(null)

    try {
      const res = await session.fetch("/test2/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      })

      if (!res.ok) {
        const paymentRespB64 = res.headers.get("payment-response")
        if (paymentRespB64) {
          try {
            const decoded = JSON.parse(
              typeof Buffer !== "undefined"
                ? Buffer.from(paymentRespB64, "base64").toString("utf-8")
                : decodeURIComponent(escape(atob(paymentRespB64))),
            ) as {
              success?: boolean
              errorReason?: string
              errorMessage?: string
            }
            const reason = decoded.errorReason ?? "unknown"
            const msg = (decoded.errorMessage ?? "").split("\n")[0]
            throw new Error(`${reason}${msg ? ": " + msg : ""}`)
          } catch (parseErr) {
            if (parseErr instanceof Error && parseErr.message.includes(":"))
              throw parseErr
          }
        }
        const payReqB64 = res.headers.get("payment-required")
        if (payReqB64) {
          try {
            const decoded = JSON.parse(
              typeof Buffer !== "undefined"
                ? Buffer.from(payReqB64, "base64").toString("utf-8")
                : decodeURIComponent(escape(atob(payReqB64))),
            ) as { error?: string }
            if (decoded.error) throw new Error(`payment required: ${decoded.error}`)
          } catch (parseErr) {
            if (parseErr instanceof Error && parseErr.message.includes("payment"))
              throw parseErr
          }
        }
        const errText = await res.text().catch(() => res.statusText)
        throw new Error(`chat ${res.status}: ${errText.slice(0, 300)}`)
      }

      const data = (await res.json()) as { reply?: string; error?: string }
      if (data.error) throw new Error(data.error)

      setSpent((s) => s + PER_CALL_USDC)
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: data.reply ?? "(no reply)",
          timestamp: new Date(),
        },
      ])
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err))
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 2).toString(),
          role: "assistant",
          content: "⚠️ " + (err instanceof Error ? err.message : "request failed"),
          timestamp: new Date(),
        },
      ])
    } finally {
      setIsTyping(false)
    }
  }

  const canChat = session !== null && remaining >= PER_CALL_USDC

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] max-w-4xl mx-auto w-full gap-4 p-4">
      {/* Wallet / Authorization Section */}
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
                  : "Sign one approve tx, pay per message via ERC20 transferFrom"}
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
                      className={`
                        px-4 py-1.5 rounded-lg text-sm font-medium transition-all disabled:opacity-50
                        ${
                          authAmount === amount
                            ? "bg-white text-black shadow-lg"
                            : "text-white/60 hover:text-white hover:bg-white/5"
                        }
                      `}
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
                      Signing approve…
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
          <div className="mt-6 pt-6 border-t border-white/5 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white/5 rounded-xl p-3 border border-white/10">
              <span className="text-[10px] uppercase tracking-wider text-white/25 block mb-1">
                Authorized
              </span>
              <span className="text-lg font-mono text-white">
                ${displayedCap.toFixed(2)}
              </span>
            </div>
            <div className="bg-white/5 rounded-xl p-3 border border-white/10">
              <span className="text-[10px] uppercase tracking-wider text-white/25 block mb-1">
                Spent
              </span>
              <span className="text-lg font-mono text-primary">
                ${spent.toFixed(2)}
              </span>
            </div>
            <div className="bg-white/5 rounded-xl p-3 border border-white/10 relative overflow-hidden">
              <div
                className="absolute left-0 bottom-0 h-1 bg-primary/20 transition-all duration-500"
                style={{
                  width: `${displayedCap > 0 ? (remaining / displayedCap) * 100 : 0}%`,
                }}
              />
              <span className="text-[10px] uppercase tracking-wider text-white/25 block mb-1">
                Remaining
              </span>
              <span className="text-lg font-mono text-white">
                ${remaining.toFixed(2)}
              </span>
            </div>
          </div>
        )}

        {errorMsg && (
          <div className="mt-4 flex items-start gap-2 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg p-3">
            <AlertCircle size={14} className="mt-0.5 shrink-0" />
            <span className="break-all">{errorMsg}</span>
          </div>
        )}
      </div>

      {/* Chat History Section */}
      <div className="flex-1 min-h-0 bg-card/30 backdrop-blur-md border border-white/5 rounded-2xl flex flex-col overflow-hidden shadow-xl">
        <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-hide">
          <AnimatePresence initial={false}>
            {messages.map((message) => (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`flex gap-4 max-w-[80%] ${message.role === "user" ? "flex-row-reverse" : ""}`}
                >
                  <div
                    className={`
                      h-8 w-8 rounded-lg flex items-center justify-center shrink-0
                      ${message.role === "user" ? "bg-white text-black" : "bg-primary/20 text-primary"}
                    `}
                  >
                    {message.role === "user" ? <User size={16} /> : <Bot size={16} />}
                  </div>
                  <div
                    className={`
                      p-4 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap
                      ${
                        message.role === "user"
                          ? "bg-white text-black shadow-lg rounded-tr-none"
                          : "bg-white/5 text-white/90 border border-white/10 rounded-tl-none"
                      }
                    `}
                  >
                    {message.content}
                    <div
                      className={`text-[10px] mt-2 opacity-40 ${message.role === "user" ? "text-black/60" : "text-white/60"}`}
                    >
                      {message.timestamp.toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          {isTyping && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex justify-start gap-4"
            >
              <div className="h-8 w-8 rounded-lg bg-primary/20 text-primary flex items-center justify-center shrink-0">
                <Bot size={16} />
              </div>
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10 rounded-tl-none">
                <div className="flex gap-1">
                  {[0, 1, 2].map((i) => (
                    <motion.div
                      key={i}
                      animate={{ opacity: [0.2, 1, 0.2] }}
                      transition={{
                        duration: 1,
                        repeat: Infinity,
                        delay: i * 0.2,
                      }}
                      className="h-1.5 w-1.5 rounded-full bg-white/40"
                    />
                  ))}
                </div>
              </div>
            </motion.div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <div className="p-4 border-t border-white/5 bg-black/20">
          <div className="relative">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder={
                !walletAddress
                  ? "Connect your wallet to start…"
                  : !session
                    ? "Authorize a session to start chatting…"
                    : !canChat
                      ? "Session balance exhausted — authorize again"
                      : "Type your message…"
              }
              disabled={!canChat || isTyping}
              className={`
                w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-4 pr-12 text-sm text-white
                placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all
                ${!canChat || isTyping ? "opacity-50 cursor-not-allowed" : "hover:bg-white/10"}
              `}
            />
            <button
              onClick={handleSend}
              disabled={!canChat || isTyping || !input.trim()}
              className={`
                absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-lg flex items-center justify-center
                transition-all
                ${
                  input.trim() && canChat
                    ? "bg-white text-black hover:scale-105"
                    : "bg-white/5 text-white/20"
                }
              `}
            >
              <ArrowRight size={18} />
            </button>
          </div>
          <div className="flex items-center justify-between mt-2 px-1">
            <span className="text-[10px] text-white/20 flex items-center gap-1">
              <AlertCircle size={10} />
              Each message settles ${PER_CALL_USDC.toFixed(2)} USDC on Base Sepolia via transferFrom
            </span>
            {session && remaining < PER_CALL_USDC && (
              <span className="text-[10px] text-destructive flex items-center gap-1">
                Balance exhausted. Start a new session.
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
