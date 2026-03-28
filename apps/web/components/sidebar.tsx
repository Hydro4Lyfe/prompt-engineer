"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface SessionSummary {
  id: string;
  rawPrompt: string;
  status: string;
  category: string | null;
  createdAt: string;
}

interface SidebarProps {
  isOpen: boolean;
  anonymousId: string | null;
  activeSessionId: string | null;
  onSelectSession: (sessionId: string) => void;
}

function timeAgo(dateStr: string): string {
  const seconds = Math.floor(
    (Date.now() - new Date(dateStr).getTime()) / 1000
  );
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function Sidebar({
  isOpen,
  anonymousId,
  activeSessionId,
  onSelectSession,
}: SidebarProps) {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);

  useEffect(() => {
    if (!isOpen || !anonymousId) return;

    const fetchSessions = async () => {
      try {
        const res = await fetch(
          `/api/sessions?anonymousId=${encodeURIComponent(anonymousId)}`
        );
        if (res.ok) {
          const data = await res.json();
          setSessions(
            data.sessions.filter(
              (s: SessionSummary) => s.status === "COMPLETED"
            )
          );
        }
      } catch {
        // Silently fail — sidebar is non-critical
      }
    };

    fetchSessions();
  }, [isOpen, anonymousId]);

  return (
    <aside
      className={cn(
        "border-r border-zinc-200 bg-zinc-50 transition-all duration-200 overflow-hidden flex-shrink-0",
        isOpen ? "w-72" : "w-0"
      )}
    >
      <div className="flex flex-col h-full w-72">
        <div className="px-4 py-3 border-b border-zinc-200">
          <h2 className="text-sm font-semibold text-zinc-700">History</h2>
        </div>
        <div className="flex-1 overflow-y-auto">
          {sessions.length === 0 ? (
            <p className="px-4 py-8 text-sm text-zinc-400 text-center">
              No sessions yet
            </p>
          ) : (
            <ul className="py-1">
              {sessions.map((session) => (
                <li key={session.id}>
                  <button
                    onClick={() => onSelectSession(session.id)}
                    className={cn(
                      "w-full text-left px-4 py-3 hover:bg-zinc-100 transition-colors",
                      activeSessionId === session.id && "bg-zinc-100"
                    )}
                  >
                    <p className="text-sm text-zinc-800 truncate">
                      {session.rawPrompt || "Untitled"}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      {session.category && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                          {session.category}
                        </Badge>
                      )}
                      <span className="text-[10px] text-zinc-400">
                        {timeAgo(session.createdAt)}
                      </span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </aside>
  );
}
