"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { critiqueAction, applyAndRunAction, type ApplyAndRunResult } from "./actions";
import type { CritiqueResult, Suggestion, RunBothResult } from "./critique.schema";
import "./tokens.css";
import "./diagnose.css";

const ACCESS_TOKEN_KEY = "diagnose_access_token";

const tokenStore = {
  subscribe(listener: () => void) {
    if (typeof window === "undefined") return () => {};
    window.addEventListener("storage", listener);
    return () => window.removeEventListener("storage", listener);
  },
  getSnapshot(): string {
    if (typeof window === "undefined") return "";
    return window.localStorage.getItem(ACCESS_TOKEN_KEY) ?? "";
  },
  getServerSnapshot(): string {
    return "";
  },
};

type Phase =
  | { kind: "idle" }
  | { kind: "critiquing" }
  | { kind: "critique_failed"; message: string }
  | { kind: "suggestions"; category: string; suggestions: Suggestion[] }
  | {
      kind: "applying";
      category: string;
      suggestions: Suggestion[];
      activeIndex: number;
      startedAt: number;
    }
  | {
      kind: "diff";
      category: string;
      suggestions: Suggestion[];
      activeIndex: number;
      result: RunBothResult;
    };

function Elapsed({ startedAt }: { startedAt: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, []);
  const seconds = Math.max(0, Math.floor((now - startedAt) / 1000));
  return <span aria-label={`Elapsed ${seconds} seconds`}>{seconds}s</span>;
}

export default function DiagnosePage() {
  const [prompt, setPrompt] = useState("");
  const [taskContext, setTaskContext] = useState("");
  const accessToken = useSyncExternalStore(
    tokenStore.subscribe,
    tokenStore.getSnapshot,
    tokenStore.getServerSnapshot
  );
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const promptRef = useRef<HTMLTextAreaElement | null>(null);
  const taskRef = useRef<HTMLTextAreaElement | null>(null);
  const cardRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    promptRef.current?.focus();
  }, []);

  const persistToken = useCallback((token: string) => {
    try {
      localStorage.setItem(ACCESS_TOKEN_KEY, token);
      // Trigger the store's subscribers on same-tab write
      window.dispatchEvent(new StorageEvent("storage", { key: ACCESS_TOKEN_KEY }));
    } catch {
      /* noop */
    }
  }, []);

  const canCritique =
    prompt.trim().length > 0 &&
    taskContext.trim().length > 0 &&
    phase.kind !== "critiquing" &&
    phase.kind !== "applying";

  const mapFailureMessage = (result: CritiqueResult & { ok: false }): string => {
    switch (result.reason) {
      case "parse_error":
      case "schema_violation":
      case "empty_suggestions":
        return "The critique engine returned nothing useful. This is a bug, not your fault.";
      case "rate_limited":
        return "Rate limit hit. Wait a moment and try again.";
      case "timeout":
        return "Critique timed out after 45 seconds.";
      case "unauthorized":
        return "Access token missing or invalid. Paste the token into the field above.";
      default:
        return "Critique failed. Try again.";
    }
  };

  const handleCritique = useCallback(async () => {
    if (!canCritique) return;
    setPhase({ kind: "critiquing" });
    const result = await critiqueAction(accessToken, prompt, taskContext);
    if (result.ok) {
      setPhase({
        kind: "suggestions",
        category: result.category,
        suggestions: result.suggestions,
      });
    } else {
      setPhase({ kind: "critique_failed", message: mapFailureMessage(result) });
    }
  }, [accessToken, canCritique, prompt, taskContext]);

  const handleApply = useCallback(
    async (index: number) => {
      if (phase.kind !== "suggestions" && phase.kind !== "diff") return;
      const suggestions =
        phase.kind === "suggestions" ? phase.suggestions : phase.suggestions;
      const category = phase.category;
      const patched = suggestions[index];
      if (!patched) return;

      setPhase({
        kind: "applying",
        category,
        suggestions,
        activeIndex: index,
        startedAt: Date.now(),
      });

      const result: ApplyAndRunResult = await applyAndRunAction(
        accessToken,
        prompt,
        patched.patchedPrompt,
        taskContext
      );

      if ("error" in result) {
        setPhase({
          kind: "critique_failed",
          message:
            result.error === "unauthorized"
              ? "Access token missing or invalid."
              : "Rate limit hit. Wait a moment and try again.",
        });
        return;
      }

      setPhase({
        kind: "diff",
        category,
        suggestions,
        activeIndex: index,
        result,
      });
    },
    [accessToken, phase, prompt, taskContext]
  );

  // Keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const inTextarea = target?.tagName === "TEXTAREA";
      const inInput = target?.tagName === "INPUT";

      // Cmd/Ctrl + Enter in a textarea submits Critique
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && inTextarea) {
        e.preventDefault();
        void handleCritique();
        return;
      }

      // Escape during critique/apply flips to idle (UI-only; server deadline governs actual cancel)
      if (e.key === "Escape") {
        if (phase.kind === "critiquing") {
          setPhase({ kind: "idle" });
        } else if (phase.kind === "applying") {
          setPhase({
            kind: "suggestions",
            category: phase.category,
            suggestions: phase.suggestions,
          });
        }
        return;
      }

      // 1/2/3 focuses suggestion card when visible and not in textarea/input
      if (
        !inTextarea &&
        !inInput &&
        (phase.kind === "suggestions" || phase.kind === "diff") &&
        ["1", "2", "3"].includes(e.key)
      ) {
        const idx = Number(e.key) - 1;
        cardRefs.current[idx]?.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleCritique, phase]);

  const renderRight = () => {
    switch (phase.kind) {
      case "idle":
        return (
          <div className="diagnose-empty">Your suggestions will appear here.</div>
        );
      case "critiquing":
        return (
          <div className="diagnose-progress" aria-live="polite">
            <span>Classifying your prompt...</span>
            <span>~3s</span>
          </div>
        );
      case "critique_failed":
        return (
          <div className="error-banner" role="alert">
            {phase.message}
            <button
              type="button"
              className="retry-btn"
              onClick={handleCritique}
            >
              Retry
            </button>
          </div>
        );
      case "suggestions":
        return renderSuggestions(phase.suggestions, null);
      case "applying":
        return (
          <>
            {renderBreadcrumb(phase.suggestions, phase.activeIndex)}
            <div className="diagnose-progress" aria-live="polite">
              <span>Running both versions on your task... ~15s</span>
              <span>
                <Elapsed startedAt={phase.startedAt} />
              </span>
            </div>
          </>
        );
      case "diff":
        return (
          <>
            {renderBreadcrumb(phase.suggestions, phase.activeIndex)}
            {renderDiff(phase.result)}
            <button
              type="button"
              className="retry-btn"
              onClick={() =>
                setPhase({
                  kind: "suggestions",
                  category: phase.category,
                  suggestions: phase.suggestions,
                })
              }
              style={{ alignSelf: "flex-start", marginLeft: 0 }}
            >
              Apply another
            </button>
          </>
        );
    }
  };

  const renderSuggestions = (suggestions: Suggestion[], activeIdx: number | null) => (
    <section
      className="suggestion-cards"
      aria-label="Critique suggestions"
    >
      {suggestions.map((s, i) => (
        <button
          key={i}
          ref={(el) => {
            cardRefs.current[i] = el;
          }}
          className={`suggestion-card${activeIdx === i ? " active" : ""}`}
          onClick={() => handleApply(i)}
          type="button"
        >
          <span className="suggestion-rank">{`Suggestion ${i + 1}`}</span>
          <span className="suggestion-title">{s.title}</span>
          <span className="suggestion-rationale">{s.rationale}</span>
          <span className="suggestion-apply" aria-hidden="true">
            Apply & Run
          </span>
        </button>
      ))}
    </section>
  );

  const renderBreadcrumb = (suggestions: Suggestion[], activeIdx: number) => (
    <nav className="breadcrumb" aria-label="Active suggestion">
      {suggestions.map((_, i) => (
        <button
          key={i}
          type="button"
          className={`breadcrumb-pill${i === activeIdx ? " active" : ""}`}
          onClick={() => handleApply(i)}
        >
          {i + 1}
          {i === activeIdx ? "•" : ""}
        </button>
      ))}
    </nav>
  );

  const renderDiff = (r: RunBothResult) => (
    <div className="diff-grid">
      <div className="diff-col">
        <span className="diff-col-label">Original output</span>
        {r.original.ok ? (
          <>
            <pre className="diff-output">{r.original.output}</pre>
            {r.original.truncated && (
              <span className="diff-warning">
                Output truncated at 4096 tokens — tool limit, not model failure.
              </span>
            )}
          </>
        ) : (
          <div className="diff-error">
            Error: {r.original.reason}
            <button
              type="button"
              className="retry-btn"
              onClick={() => {
                if (phase.kind === "diff") handleApply(phase.activeIndex);
              }}
            >
              Retry this side
            </button>
          </div>
        )}
      </div>
      <div className="diff-col">
        <span className="diff-col-label new">New output</span>
        {r.patched.ok ? (
          <>
            <pre className="diff-output">{r.patched.output}</pre>
            {r.patched.truncated && (
              <span className="diff-warning">
                Output truncated at 4096 tokens — tool limit, not model failure.
              </span>
            )}
            <button
              type="button"
              className="diff-copy"
              onClick={() => {
                void navigator.clipboard
                  .writeText(r.patched.output ?? "")
                  .catch(() => {});
              }}
            >
              Copy
            </button>
          </>
        ) : (
          <div className="diff-error">
            Error: {r.patched.reason}
            <button
              type="button"
              className="retry-btn"
              onClick={() => {
                if (phase.kind === "diff") handleApply(phase.activeIndex);
              }}
            >
              Retry this side
            </button>
          </div>
        )}
      </div>
    </div>
  );

  const critiqueButtonLabel = useMemo(() => {
    if (phase.kind === "critiquing") return "Classifying your prompt... ~3s";
    return "Critique";
  }, [phase.kind]);

  return (
    <div className="diagnose-root">
      <main className="diagnose-shell">
        <span className="diagnose-title">Diagnose & Run</span>

        {/* Access-token paste zone — quiet, only shown if empty */}
        {!accessToken && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label className="field-label" htmlFor="diagnose-token">
              Access token
            </label>
            <input
              id="diagnose-token"
              type="password"
              className="mono-textarea"
              style={{ minHeight: 40, fontSize: 13 }}
              placeholder="Paste the token the founder sent you."
              onBlur={(e) => persistToken(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  persistToken((e.target as HTMLInputElement).value);
                }
              }}
            />
          </div>
        )}

        <div className="diagnose-columns">
          <section
            className="diagnose-col-left"
            aria-label="Prompt input"
          >
            <label className="field-label" htmlFor="diagnose-prompt">
              Paste your prompt here
            </label>
            <textarea
              id="diagnose-prompt"
              ref={promptRef}
              className="mono-textarea prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Paste the prompt you want to improve..."
              aria-label="Prompt to critique"
            />

            <label className="field-label" htmlFor="diagnose-task">
              Task context
            </label>
            <textarea
              id="diagnose-task"
              ref={taskRef}
              className="mono-textarea task"
              value={taskContext}
              onChange={(e) => setTaskContext(e.target.value)}
              placeholder={`e.g. "Parse a 40MB CSV billing export, validate against this schema, return JSON."`}
              aria-label="Task context"
            />

            <button
              type="button"
              className="diagnose-critique-btn"
              onClick={handleCritique}
              disabled={!canCritique}
              aria-busy={phase.kind === "critiquing"}
            >
              {critiqueButtonLabel}
            </button>
          </section>

          <section
            className="diagnose-col-right"
            aria-label="Critique results"
            aria-live="polite"
          >
            {renderRight()}
          </section>
        </div>
      </main>
    </div>
  );
}
