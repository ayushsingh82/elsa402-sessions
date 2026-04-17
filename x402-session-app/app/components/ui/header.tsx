"use client"

import React, { useState, useEffect } from "react"
import { LeLoLogo } from "./lelo-logo"
import { Button } from "./button"
import { Loader2, Wallet, LogOut } from "lucide-react"
import { useAccount, useConnect, useDisconnect } from "wagmi"

export function Header() {
  const [isScrolled, setIsScrolled] = useState(false)
  const [isVisible, setIsVisible] = useState(true)
  const [lastScrollY, setLastScrollY] = useState(0)

  const { address: walletAddress } = useAccount()
  const { connectors, connect, isPending: isConnecting } = useConnect()
  const { disconnect } = useDisconnect()

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY
      setIsScrolled(currentScrollY > 50)
      if (currentScrollY > lastScrollY && currentScrollY > 100) {
        setIsVisible(false)
      } else {
        setIsVisible(true)
      }
      setLastScrollY(currentScrollY)
    }

    window.addEventListener("scroll", handleScroll, { passive: true })
    return () => window.removeEventListener("scroll", handleScroll)
  }, [lastScrollY])

  const handleConnect = () => {
    const injected = connectors.find((c) => c.id === "injected") ?? connectors[0]
    if (injected) connect({ connector: injected })
  }

  const truncateAddress = (ad: string) => `${ad.slice(0, 4)}...${ad.slice(-4)}`

  return (
    <header
      className={`
        fixed top-4 left-1/2 transform -translate-x-1/2 z-50 transition-all duration-300 ease-in-out w-full px-4 max-w-7xl
        ${isVisible ? "translate-y-0 opacity-100" : "-translate-y-full opacity-0"}
      `}
    >
      <div
        className={`
          flex items-center justify-between gap-6 px-8 py-3 rounded-2xl border transition-all duration-300 w-full
          ${
            isScrolled
              ? "bg-background/90 backdrop-blur-xl border-border/40 shadow-2xl"
              : "bg-background/95 backdrop-blur-lg border-border/30 shadow-lg"
          }
        `}
      >
        <div className="flex items-center gap-8">
          <div className="transform transition-transform duration-200 hover:scale-105 cursor-pointer" onClick={() => window.location.href = "/"}>
            <LeLoLogo />
          </div>

          <nav className="hidden md:flex items-center gap-6">

            <a
              href="/test2"
              className="relative text-foreground/80 hover:text-foreground transition-all duration-300 group px-3 py-1 rounded-lg hover:bg-foreground/5 transform hover:scale-110 hover:rotate-1 hover:skew-x-1"
            >
              Chat
              <span className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-0 h-0.5 bg-primary transition-all duration-200 group-hover:w-4"></span>
            </a>
            <a
              href="/slot"
              className="relative text-foreground/80 hover:text-foreground transition-all duration-300 group px-3 py-1 rounded-lg hover:bg-foreground/5 transform hover:scale-110 hover:-rotate-1 hover:-skew-x-1"
            >
              Slot
              <span className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-0 h-0.5 bg-primary transition-all duration-200 group-hover:w-4"></span>
            </a>
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 bg-foreground/5 px-3 py-1.5 rounded-xl border border-foreground/10 mr-2">
            <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-[10px] font-mono font-bold text-foreground/40 uppercase tracking-widest">Base Sepolia</span>
          </div>

          <Button
            variant="ghost"
            size="sm"
            className="text-foreground/80 hover:text-foreground hover:bg-foreground/10 transition-all duration-200 rounded-xl"
            onClick={() => window.location.href = "https://www.x402.org/docs"}
          >
            x402 Docs
          </Button>

          {walletAddress ? (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="bg-foreground/5 border-foreground/10 text-foreground/80 hover:text-foreground rounded-xl flex items-center gap-2"
              >
                <Wallet className="h-4 w-4" />
                {truncateAddress(walletAddress)}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-xl text-foreground/40 hover:text-destructive hover:bg-destructive/10"
                onClick={() => disconnect()}
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <Button
              size="sm"
              disabled={isConnecting}
              className="bg-primary hover:bg-primary/90 text-primary-foreground transform transition-all duration-200 hover:scale-105 hover:shadow-lg rounded-xl flex items-center gap-2"
              onClick={handleConnect}
            >
              {isConnecting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Wallet className="h-4 w-4" />
              )}
              {isConnecting ? "Connecting..." : "Connect Wallet"}
            </Button>
          )}
        </div>
      </div>
    </header>
  )
}
