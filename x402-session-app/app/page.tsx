import React from "react"
import { Header } from "@/components/ui/header"
import { HeroSection } from "@/components/ui/hero-section"
import { AnimatedFeaturesSection } from "@/components/ui/animated-features-section"
import { AnimatedCTASection } from "@/components/ui/animated-cta-section"
import { Footer } from "@/components/ui/footer"

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="pt-32">
        <HeroSection />
        <AnimatedFeaturesSection />
        <AnimatedCTASection />
      </main>
      <Footer />
    </div>
  )
}
