import React from "react"
import { LeLoLogo } from "./lelo-logo"

export function Footer() {
  return (
    <footer className="bg-black border-t border-white/10 py-12 px-4">
      <div className="container mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="md:col-span-2">
            <LeLoLogo className="mb-4" />
            <p className="text-white/70 mb-4 max-w-md">
              <span className="text-white font-medium">x402-sessions</span> is the Stellar session SDK for x402: sign
              once with USDC approval, then let a facilitator settle many micropayments without per-request wallet
              prompts.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-white mb-4">Code</h3>
            <ul className="space-y-2 text-white/70">
              <li>
                <a
                  href="https://github.com/x402-sessions"
                  className="hover:text-white transition-colors"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  GitHub
                </a>
              </li>
              <li>
                <a
                  href="https://www.npmjs.com/package/x402-sessions"
                  className="hover:text-white transition-colors"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  npm package
                </a>
              </li>
            </ul>
          </div>
        </div>

       
      </div>
    </footer>
  )
}
