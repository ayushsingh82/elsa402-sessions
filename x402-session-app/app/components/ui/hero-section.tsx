"use client"

import React from "react"
import { Button } from "./button"
import { ArrowRight } from "lucide-react"
import { ParticleTextEffect } from "./particle-text-effect"
import { InfiniteSlider } from "./infinite-slider"
import { ProgressiveBlur } from "./progressive-blur"

export function HeroSection() {
  return (
    <section className="py-20 px-4 relative overflow-hidden min-h-screen flex flex-col justify-between">
      <div className="flex-1 flex items-start justify-center pt-36">
        <ParticleTextEffect words={[ "STELLAR", "X402", "Sessions"]} />
      </div>

      <div className="container mx-auto text-center relative z-10 pb-8">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-6 text-balance">
            Build and ship <span className="text-gray-300">x402-powered dapps on Stellar</span>. 
            Now featuring <span className="text-primary">Sign once, settle many times</span>.
          </h2>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
            <Button
              size="lg"
              className="bg-white hover:bg-gray-200 text-black group"
              onClick={() =>
                window.open(
                  "https://www.youtube.com/watch?v=kbwVi9IpOy8",
                  "_blank",
                  "noopener,noreferrer"
                )
              }
            >
              Demo Video
              <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </Button>
           
            <Button
              size="lg"
              variant="outline"
              className="group border-gray-600 text-white hover:bg-gray-800 bg-transparent"
              onClick={() =>
                window.open(
                  "https://www.npmjs.com/package/x402-sessions",
                  "_blank",
                  "noopener,noreferrer"
                )
              }
            >
             npm-package
              <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </Button>
          </div>

          <div className="mt-16 mb-8">
            <div className="group relative m-auto max-w-6xl">
              <div className="relative py-6 w-full">
                <InfiniteSlider durationOnHover={20} duration={40} gap={112}>
                    <div className="flex">
                      <img
                        className="mx-auto h-4 w-fit invert opacity-60 hover:opacity-100 transition-opacity"
                        src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/design-mode-images/github-twQNbc5nAy2jUs7yh5xic8hsEfBYpQ.svg"
                        alt="GitHub Logo"
                        height="16"
                        width="auto"
                      />
                    </div>
                    <div className="flex">
                      <img
                        className="mx-auto h-5 w-fit invert opacity-60 hover:opacity-100 transition-opacity"
                        src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/design-mode-images/nike-H0OCso4JdUtllUTdAverMAjJmcKVXU.svg"
                        alt="Nike Logo"
                        height="20"
                        width="auto"
                      />
                    </div>
                    <div className="flex">
                      <img
                        className="mx-auto h-5 w-fit invert opacity-60 hover:opacity-100 transition-opacity"
                        src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/design-mode-images/lemonsqueezy-ZL7mmIzqR10hWcodoO19ajha8AS9VK.svg"
                        alt="Lemon Squeezy Logo"
                        height="20"
                        width="auto"
                      />
                    </div>
                    <div className="flex">
                      <img
                        className="mx-auto h-4 w-fit invert opacity-60 hover:opacity-100 transition-opacity"
                        src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/design-mode-images/laravel-sDCMR3A82V8F6ycZymrDlmiFpxyUd4.svg"
                        alt="Laravel Logo"
                        height="16"
                        width="auto"
                      />
                    </div>
                    <div className="flex">
                      <img
                        className="mx-auto h-7 w-fit invert opacity-60 hover:opacity-100 transition-opacity"
                        src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/design-mode-images/lilly-Jhslk9VPUVAVK2SCJmCGTEbqKMef5v.svg"
                        alt="Lilly Logo"
                        height="28"
                        width="auto"
                      />
                    </div>

                    <div className="flex">
                      <img
                        className="mx-auto h-6 w-fit invert opacity-60 hover:opacity-100 transition-opacity"
                        src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/design-mode-images/openai-5TPubXl1hnLxeIs4ygVSLjJcUoBOCB.svg"
                        alt="OpenAI Logo"
                        height="24"
                        width="auto"
                      />
                    </div>
                </InfiniteSlider>

                <ProgressiveBlur
                  className="pointer-events-none absolute left-0 top-0 h-full w-20"
                  direction="left"
                  blurIntensity={1}
                />
                <ProgressiveBlur
                  className="pointer-events-none absolute right-0 top-0 h-full w-20"
                  direction="right"
                  blurIntensity={1}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
