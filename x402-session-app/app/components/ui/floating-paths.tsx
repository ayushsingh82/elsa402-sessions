"use client"

import React from "react"

export function BackgroundPaths() {
  return (
    <div className="absolute inset-0 overflow-hidden">
      <svg
        className="absolute inset-0 w-full h-full opacity-30"
        viewBox="0 0 1200 800"
        preserveAspectRatio="xMidYMid slice"
      >
        {/* Animated paths */}
        <path
          d="M0,400 Q300,300 600,400 T1200,400"
          stroke="rgba(255,255,255,0.1)"
          strokeWidth="2"
          fill="none"
          className="animate-draw-path"
          style={{
            animation: "drawPath 20s ease-in-out infinite",
          }}
        />
        <path
          d="M0,200 Q400,350 800,200 T1200,200"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="2"
          fill="none"
          className="animate-draw-path"
          style={{
            animation: "drawPath 25s ease-in-out infinite",
            animationDelay: "2s",
          }}
        />
        <path
          d="M0,600 Q350,500 700,600 T1200,600"
          stroke="rgba(255,255,255,0.1)"
          strokeWidth="2"
          fill="none"
          className="animate-draw-path"
          style={{
            animation: "drawPath 22s ease-in-out infinite",
            animationDelay: "1s",
          }}
        />
      </svg>
      <style jsx>{`
        @keyframes drawPath {
          0% {
            stroke-dasharray: 0 1000;
            opacity: 0;
          }
          10% {
            opacity: 1;
          }
          90% {
            opacity: 1;
          }
          100% {
            stroke-dasharray: 1000 0;
            opacity: 0;
          }
        }
      `}</style>
    </div>
  )
}

