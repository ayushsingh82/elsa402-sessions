// /test2/chat — x402-protected chat endpoint backed by RunPod vLLM.
//
// The x402 middleware in proxy.ts intercepts this route with the `session` scheme
// at $0.10/request. By the time this handler runs, the payment has been verified
// (but not yet settled — that happens after the handler returns on the way out).

import { NextResponse } from "next/server";

const VLLM_URL = "https://0ziii4vt975sjd-8000.proxy.runpod.net";
const VLLM_MODEL = "Qwen/Qwen3-VL-8B-Instruct";

type ChatMessage = { role: string; content: string };
type VLLMResponse = {
  choices?: { message?: { content?: string } }[];
  error?: { message?: string };
};

export async function POST(req: Request) {
  let prompt: string;
  try {
    const body = (await req.json()) as { prompt?: string };
    prompt = (body.prompt ?? "").trim();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  if (!prompt) {
    return NextResponse.json({ error: "prompt is required" }, { status: 400 });
  }

  try {
    const messages: ChatMessage[] = [
      { role: "user", content: prompt },
    ];

    const vllmRes = await fetch(`${VLLM_URL}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: VLLM_MODEL,
        messages,
        max_tokens: 512,
      }),
    });

    if (!vllmRes.ok) {
      const text = await vllmRes.text();
      return NextResponse.json(
        { error: `vllm ${vllmRes.status}: ${text.slice(0, 400)}` },
        { status: 502 },
      );
    }

    const data = (await vllmRes.json()) as VLLMResponse;
    if (data.error) {
      return NextResponse.json({ error: data.error.message }, { status: 502 });
    }

    const reply = data.choices?.[0]?.message?.content ?? "(empty response)";

    return NextResponse.json({
      reply,
      model: VLLM_MODEL,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "unknown error reaching vLLM",
        hint: `RunPod vLLM endpoint: ${VLLM_URL}`,
      },
      { status: 502 },
    );
  }
}
