import { USDC_ADDRESSES } from "../../x402/paywall/evm"

export default function TestVideoPage() {
  return (
    <div
      style={{
        fontFamily: "system-ui, -apple-system, sans-serif",
        background: "#0a0a0a",
        color: "#fafafa",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        margin: 0,
      }}
    >
      <div
        style={{
          textAlign: "center",
          padding: 48,
          maxWidth: 960,
          width: "100%",
        }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            background: "rgba(48, 164, 108, 0.15)",
            color: "#30a46c",
            padding: "6px 16px",
            borderRadius: 9999,
            fontSize: 14,
            fontWeight: 600,
            border: "1px solid rgba(48, 164, 108, 0.3)",
            marginBottom: 32,
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: "#30a46c",
              display: "inline-block",
            }}
          />
          Payment Verified
        </div>

        <h1
          style={{
            fontSize: 48,
            fontWeight: 800,
            letterSpacing: -2,
            background: "linear-gradient(135deg, #7c66dc, #5746af, #30a46c)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            marginBottom: 24,
            lineHeight: 1.1,
          }}
        >
          Enjoy the Video
        </h1>

        <p style={{ fontSize: 16, color: "#a1a1a1", marginBottom: 32, lineHeight: 1.6 }}>
          You paid $1.00 USDC on Base Sepolia to unlock this content.
        </p>

        <div
          style={{
            textAlign: "left",
            border: "1px solid rgba(255,255,255,0.14)",
            background: "rgba(255,255,255,0.03)",
            borderRadius: 10,
            padding: 14,
            marginBottom: 20,
            fontSize: 12,
            color: "#a1a1a1",
          }}
        >
          <div style={{ marginBottom: 6 }}>
            x402 local config: <strong style={{ color: "#fafafa" }}>elsax402/x402/paywall</strong>
          </div>
          <div style={{ wordBreak: "break-all" }}>
            Base Sepolia USDC: <span style={{ color: "#fafafa" }}>{USDC_ADDRESSES["base:sepolia"]}</span>
          </div>
          <div style={{ wordBreak: "break-all" }}>
            Base Mainnet USDC: <span style={{ color: "#fafafa" }}>{USDC_ADDRESSES["base:mainnet"]}</span>
          </div>
        </div>

        <div
          style={{
            position: "relative",
            width: "100%",
            paddingBottom: "56.25%",
            borderRadius: 12,
            overflow: "hidden",
            border: "1px solid rgba(255,255,255,0.1)",
          }}
        >
          <iframe
            src="https://www.youtube.com/embed/hMLcKtVwF-A"
            title="Premium Video"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              border: "none",
            }}
          />
        </div>
      </div>

      <div style={{ position: "fixed", bottom: 24, fontSize: 13, color: "#525252" }}>
        Powered by{" "}
        <a
          href="https://www.x402.org/"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: "#7c66dc", textDecoration: "none" }}
        >
          x402
        </a>{" "}
        on{" "}
        <a
          href="https://base.org/"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: "#7c66dc", textDecoration: "none" }}
        >
          Base
        </a>
      </div>
    </div>
  )
}
