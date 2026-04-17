import type {
  PaywallNetworkHandler,
  PaywallConfig,
  PaymentRequirements,
  PaymentRequired,
} from "./types"

export const USDC_ADDRESSES = {
  "base:mainnet": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  "base:sepolia": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
} as const

interface EvmPaywallOptions {
  amount: number
  testnet: boolean
  paymentRequired: PaymentRequired
  currentUrl?: string
  appName?: string
}

function jsonForScript(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c")
}

function getEvmPaywallHtml(options: EvmPaywallOptions): string {
  const { amount, testnet, paymentRequired, currentUrl, appName } = options

  const currentUrlLine = currentUrl ? `\n      currentUrl: ${jsonForScript(currentUrl)},` : ""

  const usdc = testnet ? USDC_ADDRESSES["base:sepolia"] : USDC_ADDRESSES["base:mainnet"]
  const network = testnet ? "base:sepolia" : "base:mainnet"

  const configScript = `
  <script>
    window.x402 = {
      amount: ${amount},
      paymentRequired: ${jsonForScript(paymentRequired)},
      testnet: ${testnet},${currentUrlLine}
      config: {
        network: ${jsonForScript(network)},
        usdcAddress: ${jsonForScript(usdc)},
      },
      appName: ${jsonForScript(appName || "")},
    };
  </script>`

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Payment Required</title>
    ${configScript}
    <style>
      body { font-family: system-ui, sans-serif; background: #0a0a0a; color: #fafafa; margin: 0; }
      .wrap { min-height: 100vh; display: grid; place-items: center; padding: 24px; }
      .card { max-width: 720px; border: 1px solid rgba(255,255,255,.15); border-radius: 14px; padding: 24px; background: rgba(255,255,255,.03); }
      .muted { color: #a1a1a1; }
      code { color: #8ab4ff; word-break: break-all; }
    </style>
  </head>
  <body>
    <div class="wrap">
      <div class="card">
        <h2>elsax402 payment required</h2>
        <p class="muted">Local x402 paywall module is wired. Continue payment through your x402 client wallet flow.</p>
        <p><strong>Amount:</strong> ${amount} USDC</p>
        <p><strong>Network:</strong> ${network}</p>
        <p><strong>USDC contract:</strong> <code>${usdc}</code></p>
      </div>
    </div>
  </body>
</html>`
}

export const evmPaywall: PaywallNetworkHandler = {
  supports(requirement: PaymentRequirements): boolean {
    return (
      requirement.network.startsWith("base:") ||
      requirement.network.startsWith("eip155:")
    )
  },

  generateHtml(
    requirement: PaymentRequirements,
    paymentRequired: PaymentRequired,
    config: PaywallConfig,
  ): string {
    // USDC has 6 decimals on Base.
    const amount = requirement.amount
      ? parseFloat(requirement.amount) / 1e6
      : requirement.maxAmountRequired
      ? parseFloat(requirement.maxAmountRequired) / 1e6
      : 0

    return getEvmPaywallHtml({
      amount,
      paymentRequired,
      currentUrl: paymentRequired.resource?.url || config.currentUrl || undefined,
      testnet: config.testnet ?? true,
      appName: config.appName,
    })
  },
}

// Backwards-compat alias for any old import sites that still say "stellar".
export const stellarPaywall = evmPaywall
