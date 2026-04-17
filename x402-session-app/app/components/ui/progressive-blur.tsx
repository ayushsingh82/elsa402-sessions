"use client"

import React from "react"
import { cn } from "@/lib/utils"

interface ProgressiveBlurProps {
  className?: string
  direction?: "left" | "right"
  blurIntensity?: number
}

export function ProgressiveBlur({
  className,
  direction = "left",
  blurIntensity = 1,
}: ProgressiveBlurProps) {
  const gradientDirection =
    direction === "left"
      ? "to-r from-transparent to-black"
      : "to-l from-transparent to-black"

  return (
    <div
      className={cn("absolute inset-0 pointer-events-none", className)}
      style={{
        background: `linear-gradient(${direction === "left" ? "to right" : "to left"}, transparent, rgba(0, 0, 0, ${blurIntensity}))`,
      }}
    />
  )
}

