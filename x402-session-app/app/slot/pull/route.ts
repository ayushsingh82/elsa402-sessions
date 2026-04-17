// /slot/pull — x402-protected slot machine backend.
//
// The x402 middleware in proxy.ts gates this route with the `session` scheme
// at $0.10/pull. By the time this handler runs, payment has been verified and
// will be settled on the response path.
//
// Returns: { reels: [string, string, string], win: boolean, multiplier: number,
//            payoutLabel: string, seed: string }

import { NextResponse } from "next/server";

// Weighted reel strip — rarer symbols are weighted less.
// (This is cosmetic only; no real payout is transferred back to the user in v1.)
const REEL: { symbol: string; weight: number; multiplier: number }[] = [
  { symbol: "🍋", weight: 25, multiplier: 1 },
  { symbol: "🍒", weight: 20, multiplier: 2 },
  { symbol: "🍊", weight: 18, multiplier: 3 },
  { symbol: "🍇", weight: 15, multiplier: 5 },
  { symbol: "🔔", weight: 10, multiplier: 10 },
  { symbol: "⭐", weight: 7, multiplier: 25 },
  { symbol: "💎", weight: 4, multiplier: 100 },
  { symbol: "7️⃣", weight: 1, multiplier: 777 },
];

function spinReel(): { symbol: string; multiplier: number } {
  const total = REEL.reduce((s, r) => s + r.weight, 0);
  let roll = Math.random() * total;
  for (const r of REEL) {
    roll -= r.weight;
    if (roll <= 0) return { symbol: r.symbol, multiplier: r.multiplier };
  }
  return REEL[0];
}

export async function POST() {
  const a = spinReel();
  const b = spinReel();
  const c = spinReel();
  const allSame = a.symbol === b.symbol && b.symbol === c.symbol;
  const twoSame = !allSame && (a.symbol === b.symbol || b.symbol === c.symbol || a.symbol === c.symbol);

  let multiplier = 0;
  let payoutLabel: string;
  if (allSame) {
    multiplier = a.multiplier;
    payoutLabel = `JACKPOT ${a.symbol}${a.symbol}${a.symbol} ×${multiplier}`;
  } else if (twoSame) {
    multiplier = 0; // cosmetic near-miss
    payoutLabel = "So close! 2 of a kind (no payout)";
  } else {
    payoutLabel = "No win — try again";
  }

  return NextResponse.json({
    reels: [a.symbol, b.symbol, c.symbol],
    win: allSame,
    multiplier,
    payoutLabel,
    seed: Math.random().toString(36).slice(2, 10),
  });
}
