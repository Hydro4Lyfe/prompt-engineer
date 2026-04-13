"use server";

import { headers } from "next/headers";
import { getModelProvider } from "@prompt-engineer/ai";
import { classifyAndSuggest } from "./classify-and-suggest";
import { runBoth } from "./run-both";
import { checkAndIncrement } from "./rate-limit";
import type { CritiqueResult, RunBothResult } from "./critique.schema";

const ABORT_MS = 45_000;

function unauthorized(): CritiqueResult {
  return { ok: false, reason: "unauthorized" };
}

function rateLimitedResult(): CritiqueResult {
  return { ok: false, reason: "rate_limited" };
}

async function gate(
  accessToken: string
): Promise<{ ok: true } | { ok: false; result: CritiqueResult }> {
  const expected = process.env.DIAGNOSE_ACCESS_TOKEN;
  if (!expected) {
    console.warn("[diagnose] DIAGNOSE_ACCESS_TOKEN not set — refusing all requests");
    return { ok: false, result: unauthorized() };
  }
  if (accessToken !== expected) {
    return { ok: false, result: unauthorized() };
  }
  const hdrs = await headers();
  const ip =
    hdrs.get("x-forwarded-for")?.split(",")[0].trim() ??
    hdrs.get("x-real-ip") ??
    "unknown";
  const check = checkAndIncrement(ip);
  if (!check.ok) {
    return { ok: false, result: rateLimitedResult() };
  }
  return { ok: true };
}

export async function critiqueAction(
  accessToken: string,
  prompt: string,
  taskContext: string
): Promise<CritiqueResult> {
  const gateResult = await gate(accessToken);
  if (!gateResult.ok) return gateResult.result;

  if (!prompt.trim() || !taskContext.trim()) {
    return { ok: false, reason: "schema_violation" };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ABORT_MS);

  try {
    return await classifyAndSuggest({
      prompt,
      taskContext,
      provider: getModelProvider(),
      signal: controller.signal,
    });
  } catch (error) {
    console.warn("[diagnose] critique unexpected error", error);
    return { ok: false, reason: "unknown" };
  } finally {
    clearTimeout(timer);
  }
}

export type ApplyAndRunResult =
  | RunBothResult
  | { error: "unauthorized" | "rate_limited" };

export async function applyAndRunAction(
  accessToken: string,
  originalPrompt: string,
  patchedPrompt: string,
  taskContext: string
): Promise<ApplyAndRunResult> {
  const gateResult = await gate(accessToken);
  if (!gateResult.ok) {
    if (gateResult.result.ok === false && gateResult.result.reason === "unauthorized") {
      return { error: "unauthorized" };
    }
    return { error: "rate_limited" };
  }

  if (!originalPrompt.trim() || !patchedPrompt.trim() || !taskContext.trim()) {
    return {
      original: { ok: false, reason: "schema_violation" },
      patched: { ok: false, reason: "schema_violation" },
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ABORT_MS);

  try {
    return await runBoth({
      originalPrompt,
      patchedPrompt,
      taskContext,
      provider: getModelProvider(),
      signal: controller.signal,
    });
  } catch (error) {
    console.warn("[diagnose] applyAndRun unexpected error", error);
    return {
      original: { ok: false, reason: "unknown" },
      patched: { ok: false, reason: "unknown" },
    };
  } finally {
    clearTimeout(timer);
  }
}
