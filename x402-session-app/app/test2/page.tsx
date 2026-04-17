import React from "react"
import { Header } from "@/components/ui/header"
import { Footer } from "@/components/ui/footer"
import { ChatInterface } from "./ChatInterface"
import { BackgroundPaths } from "@/components/ui/floating-paths"

export default function Test2Page() {
  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 z-0 opacity-40">
        <BackgroundPaths />
      </div>
      
      <Header />
      
      <main className="relative z-10 pt-36 pb-20 px-6">
        <div className="container mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-white mb-4 bg-clip-text text-transparent bg-gradient-to-r from-white via-white/80 to-white/40">
              Sign Once, Settle Many 
            </h1>
            <p className="text-lg text-white/40 max-w-2xl mx-auto">
              Experience the power of x402 <span className="text-primary font-semibold font-mono">upto</span> scheme. 
              Authorize a session once and enjoy uninterrupted AI interactions with automatic micro-payments.
            </p>
          </div>
          
          <ChatInterface />
        </div>
      </main>
      
      <Footer />
    </div>
  )
}
