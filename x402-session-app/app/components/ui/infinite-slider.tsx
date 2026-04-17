"use client"

import React, { useEffect, useRef, useState, type ReactNode } from "react"

interface InfiniteSliderProps {
  children: ReactNode
  duration?: number
  durationOnHover?: number
  gap?: number
}

export function InfiniteSlider({
  children,
  duration = 40,
  durationOnHover = 20,
  gap = 16,
}: InfiniteSliderProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isHovered, setIsHovered] = useState(false)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const scroll = () => {
      if (isHovered) return
      container.scrollLeft += 1

      if (
        container.scrollLeft >=
        container.scrollWidth / 2 - container.clientWidth
      ) {
        container.scrollLeft = 0
      }
    }

    const interval = setInterval(scroll, (isHovered ? durationOnHover : duration) * 10)

    return () => clearInterval(interval)
  }, [duration, durationOnHover, isHovered])

  return (
    <div
      ref={containerRef}
      className="flex overflow-x-hidden scrollbar-hide"
      style={{
        gap: `${gap}px`,
        scrollBehavior: "auto",
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="flex" style={{ gap: `${gap}px` }}>
        {children}
      </div>
      <div className="flex" style={{ gap: `${gap}px` }}>
        {children}
      </div>
    </div>
  )
}

