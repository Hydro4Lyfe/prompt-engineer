const CEILING_PER_IP = 30;

// Process-global map. Cleared on server restart — acceptable for prototype.
const counts = new Map<string, number>();

export function checkAndIncrement(ip: string): { ok: boolean; count: number } {
  const current = counts.get(ip) ?? 0;
  if (current >= CEILING_PER_IP) {
    return { ok: false, count: current };
  }
  counts.set(ip, current + 1);
  return { ok: true, count: current + 1 };
}

export function resetIpForTesting(ip?: string) {
  if (ip) counts.delete(ip);
  else counts.clear();
}
