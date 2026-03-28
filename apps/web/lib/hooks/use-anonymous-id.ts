"use client";

import { useState, useEffect } from "react";

const STORAGE_KEY = "pe-anon-id";

export function useAnonymousId(): string | null {
  const [id, setId] = useState<string | null>(null);

  useEffect(() => {
    let stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      stored = crypto.randomUUID();
      localStorage.setItem(STORAGE_KEY, stored);
    }
    setId(stored);
  }, []);

  return id;
}
