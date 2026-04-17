import React from "react"
import { Header } from "@/components/ui/header"
import { Footer } from "@/components/ui/footer"
import { SlotMachine } from "./SlotMachine"
import { BackgroundPaths } from "@/components/ui/floating-paths"

export default function SlotPage() {
  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <div className="absolute inset-0 z-0 opacity-40">
        <BackgroundPaths />
      </div>

      <Header />

      <main className="relative z-10 pt-36 pb-20 px-6">
        <div className="container mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-white mb-4 bg-clip-text text-transparent bg-gradient-to-r from-white via-white/80 to-white/40">
              Pull Once, Settle Many
            </h1>
            <p className="text-lg text-white/40 max-w-2xl mx-auto">
              A slot machine powered by x402{" "}
              <span className="text-primary font-semibold font-mono">session</span> scheme.
              Authorize once, then every lever pull is settled on-chain with Circle USDC on
              Base Sepolia via ERC20 <span className="font-mono">transferFrom</span>.
            </p>
          </div>

          <SlotMachine />
        </div>
      </main>

      <Footer />
    </div>
  )
}
