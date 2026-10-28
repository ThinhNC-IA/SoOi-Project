"use client";

import { useEffect, useState } from "react";
import { seedDatabase } from "@/lib/ledger/seed";
import type { LedgerDatabase } from "@/lib/ledger/types";

const STORAGE_KEY = "sooi-next-ledger-v1";

export function useLedger() {
  const [database, setDatabase] = useState<LedgerDatabase>(seedDatabase);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let restored = seedDatabase;
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as LedgerDatabase;
        restored = { ...parsed, debtEntries: parsed.debtEntries ?? [] };
      }
    } catch {
      restored = seedDatabase;
    }
    queueMicrotask(() => {
      setDatabase(restored);
      setReady(true);
    });
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(database));
    } catch {
      // Một số trình duyệt riêng tư chặn localStorage; app vẫn tiếp tục chạy trong phiên hiện tại.
    }
  }, [database, ready]);

  const reset = () => {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Không chặn thao tác reset nếu trình duyệt không cho truy cập localStorage.
    }
    setDatabase(seedDatabase);
  };

  return { database, setDatabase, reset, ready };
}
