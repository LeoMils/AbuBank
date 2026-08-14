/*
 * nodeShim.ts — MUST be imported FIRST (before any src/ import).
 * The live pipeline modules (liveSession → LiveTools → AbuCalendar/service →
 * durableStore) assume a browser. Under Node/tsx there is no localStorage. We
 * inject a minimal in-memory localStorage so the modules import + run. This does
 * NOT change behavior — the eval injects its own calendar store + online fetch; the
 * shim only stops a bare module-load reference from throwing.
 */
const g = globalThis as unknown as { localStorage?: unknown; indexedDB?: unknown }

if (typeof g.localStorage === 'undefined') {
  const m = new Map<string, string>()
  g.localStorage = {
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    setItem: (k: string, v: string) => { m.set(k, String(v)) },
    removeItem: (k: string) => { m.delete(k) },
    clear: () => { m.clear() },
    key: (i: number) => [...m.keys()][i] ?? null,
    get length() { return m.size },
  }
}
