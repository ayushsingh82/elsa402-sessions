import { paymentProxy, x402ResourceServer } from "@x402/next"
import { HTTPFacilitatorClient } from "@x402/core/server"
import { SessionEvmScheme } from "elsa-x402-sessions"
import { NextResponse, type NextRequest } from "next/server"
import { createPaywall } from "./x402/paywall"
import { evmPaywall } from "./x402/paywall/evm"

const network = (process.env.NETWORK ?? "base:sepolia") as
  | "base:sepolia"
  | "base:mainnet"

// USDC contract address. Override with USDC_CONTRACT_ADDRESS env if needed.
const usdcAddress =
  process.env.USDC_CONTRACT_ADDRESS ??
  (network === "base:mainnet"
    ? "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
    : "0x036CbD53842c5426634e7929541eC2318f3dCF7e")

// Session facilitator (our local elsax402-sessions service).
const sessionFacilitatorUrl =
  process.env.SESSION_FACILITATOR_URL ?? "http://localhost:4021"

const missingEnvVars: string[] = []
if (!process.env.SERVER_WALLET_ADDRESS) missingEnvVars.push("SERVER_WALLET_ADDRESS")
const devBypassEnabled = process.env.X402_DEV_BYPASS !== "false"

let paymentHandler: ReturnType<typeof paymentProxy> | null = null

if (missingEnvVars.length === 0) {
  const sessionFacilitatorClient = new HTTPFacilitatorClient({
    url: sessionFacilitatorUrl,
  })

  const server = new x402ResourceServer(sessionFacilitatorClient).register(
    network,
    new SessionEvmScheme({
      assetAddress: usdcAddress,
      facilitatorUrl: sessionFacilitatorUrl,
    }),
  )

  const paywall = createPaywall()
    .withNetwork(evmPaywall)
    .withConfig({
      appName: "elsax402",
      testnet: network === "base:sepolia",
    })
    .build()

  paymentHandler = paymentProxy(
    {
      "/test2/chat": {
        accepts: [
          {
            scheme: "session" as const,
            price: process.env.PER_CALL_USDC ?? "0.10",
            network,
            payTo: process.env.SERVER_WALLET_ADDRESS!,
          },
        ],
        description: "AI chat message — settled per request via session",
      },
      "/slot/pull": {
        accepts: [
          {
            scheme: "session" as const,
            price: process.env.PER_CALL_USDC ?? "0.10",
            network,
            payTo: process.env.SERVER_WALLET_ADDRESS!,
          },
        ],
        description: "Slot machine pull — settled per pull via session",
      },
    },
    server,
    undefined,
    paywall as any,
  )
}

export function proxy(request: NextRequest) {
  if (paymentHandler) {
    return paymentHandler(request)
  }

  if (devBypassEnabled) {
    return NextResponse.next()
  }

  const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>elsax402 setup required</title>
    <style>
      body { margin: 0; background: #0a0a0a; color: #fafafa; font-family: system-ui, -apple-system, sans-serif; }
      .wrap { min-height: 100vh; display: grid; place-items: center; padding: 24px; }
      .card { width: 100%; max-width: 820px; border: 1px solid rgba(255,255,255,.14); border-radius: 14px; padding: 22px; background: rgba(255,255,255,.03); }
      h1 { margin: 0 0 8px 0; font-size: 24px; }
      p { color: #a1a1a1; margin: 0 0 14px 0; }
      .pill { display: inline-block; background: rgba(245,158,11,.16); color: #f59e0b; border: 1px solid rgba(245,158,11,.35); padding: 6px 10px; border-radius: 9999px; font-size: 12px; margin-bottom: 14px; }
      code { color: #9ac7ff; }
      ul { margin: 8px 0 14px 20px; }
      li { margin: 6px 0; }
      pre { margin: 0; padding: 12px; background: #111; border: 1px solid rgba(255,255,255,.12); border-radius: 10px; overflow: auto; color: #d1d5db; }
    </style>
  </head>
  <body>
    <div class="wrap">
      <div class="card">
        <div class="pill">x402 setup incomplete</div>
        <h1>elsax402</h1>
        <p>The paywall is wired, but a required env key is missing. Add it and restart dev server.</p>
        <ul>
          <li><strong>Missing:</strong> <code>${missingEnvVars.join(", ") || "none"}</code></li>
          <li><strong>Session facilitator:</strong> <code>${sessionFacilitatorUrl}</code></li>
          <li><strong>Tip:</strong> set <code>X402_DEV_BYPASS=true</code> to bypass payment while developing</li>
        </ul>
        <p>Put this in <code>.env.local</code> (project root):</p>
        <pre>NETWORK=base:sepolia
SESSION_FACILITATOR_URL=http://localhost:4021
SERVER_WALLET_ADDRESS=0xYourRecipientAddress
PER_CALL_USDC=0.10
X402_DEV_BYPASS=true</pre>
      </div>
    </div>
  </body>
</html>`

  return new NextResponse(html, {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8" },
  })
}

export const config = {
  matcher: ["/test/:path*", "/test2/:path*", "/slot/:path*"],
}
