export interface PaywallConfig {
  appName?: string
  appLogo?: string
  currentUrl?: string
  testnet?: boolean
  stellarRpcUrl?: string
}

export interface PaymentRequirements {
  scheme: string
  network: string
  asset: string
  payTo: string
  maxTimeoutSeconds: number
  extra?: Record<string, unknown>
  maxAmountRequired?: string
  description?: string
  resource?: string
  mimeType?: string
  amount?: string
}

export interface PaymentRequired {
  x402Version: number
  error?: string
  resource?: {
    url: string
    description: string
    mimeType: string
  }
  accepts: PaymentRequirements[]
  extensions?: Record<string, unknown>
}

export interface PaywallProvider {
  generateHtml(paymentRequired: PaymentRequired, config?: PaywallConfig): string
}

export interface PaywallNetworkHandler {
  supports(requirement: PaymentRequirements): boolean
  generateHtml(
    requirement: PaymentRequirements,
    paymentRequired: PaymentRequired,
    config: PaywallConfig
  ): string
}

