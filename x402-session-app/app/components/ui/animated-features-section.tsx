"use client"

import React from "react"
import { motion } from "framer-motion"
import { Gamepad2, MessageSquare, Cpu, Coins, Route, Sparkles } from "lucide-react"

const features = [
  {
    icon: Gamepad2,
    title: "Games & interactive apps",
    description:
      "Arcade flows, loot boxes, and turn-based play: each action can settle against a session cap instead of signing every move.",
  },
  {
    icon: MessageSquare,
    title: "Chat-based sessions",
    description:
      "Authorize USDC once; every message or tool call debits the session off-chain and on-chain via the facilitator—no per-message Freighter popups.",
  },
  {
    icon: Cpu,
    title: "AI inference & APIs",
    description:
      "Meter LLM and backend endpoints with x402: clients attach a session id; you price per token, per call, or per minute.",
  },
  {
    icon: Coins,
    title: "Micropayments at scale",
    description:
      "Soroban SAC approvals bound total spend; the facilitator enforces per-call limits and recipient binding for many small settlements.",
  },
  {
    icon: Route,
    title: "Paywalled routes",
    description:
      "Protect Next.js routes and APIs with the same session scheme—verify and settle through a standard facilitator HTTP API.",
  },
  {
    icon: Sparkles,
    title: "Composable experiences",
    description:
      "Mix chat, games, and inference in one product: one session wallet UX, consistent headers, shared facilitator infrastructure.",
  },
]

export function AnimatedFeaturesSection() {
  return (
    <section id="features" className="py-20 px-4 bg-black">
      <div className="container mx-auto">
        <div className="text-center mb-16">
          <motion.h2
            className="text-4xl md:text-5xl font-bold text-white mb-4"
            style={{ fontFamily: "var(--font-playfair)" }}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
          >
            More possibilities
          </motion.h2>
          <motion.p
            className="text-xl text-gray-300 max-w-2xl mx-auto"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            viewport={{ once: true }}
          >
            Applications you can build when payments are a session, not a popup—games, chat, and AI on Stellar.
          </motion.p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {features.map((feature, index) => {
            const Icon = feature.icon
            return (
              <motion.div
                key={feature.title}
                className="bg-card border border-border/20 rounded-lg p-6 hover:border-white/30 transition-all duration-300 group"
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                viewport={{ once: true }}
                whileHover={{ y: -5 }}
              >
                <div className="w-12 h-12 bg-white/10 rounded-lg flex items-center justify-center mb-4 group-hover:bg-white/20 transition-colors">
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">{feature.title}</h3>
                <p className="text-gray-400 leading-relaxed">{feature.description}</p>
              </motion.div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

