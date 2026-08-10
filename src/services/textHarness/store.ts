/*
 * textHarness/store.ts — a deterministic in-memory LiveCalendarStore.
 * ════════════════════════════════════════════════════════════════════════════
 * The live path writes calendar events through the LiveCalendarStore seam
 * (durableCalendarStore() in production). The harness injects THIS in-memory store
 * so scenarios start from a known fake calendar state and read-after-write is
 * provable without IndexedDB or a browser. Same seam, same LiveTools code path.
 */
import type { LiveCalendarStore, LiveEvent } from '../liveTools'

/** Build an in-memory store seeded with optional fake events. Ids are assigned
 *  deterministically (mem-1, mem-2, …) so transcripts/results are reproducible. */
export function inMemoryCalendarStore(
  seed: Array<Omit<LiveEvent, 'id'> & { id?: string }> = [],
): LiveCalendarStore & { events: LiveEvent[] } {
  let counter = 0
  const events: LiveEvent[] = seed.map((e) => ({
    id: e.id ?? `seed-${++counter}`,
    title: e.title,
    date: e.date,
    time: e.time,
    ...(e.participant ? { participant: e.participant } : {}),
    ...(e.location ? { location: e.location } : {}),
    ...(e.notes ? { notes: e.notes } : {}),
  }))
  return {
    events,
    list(): LiveEvent[] {
      return events.map((e) => ({ ...e }))
    },
    add(e): LiveEvent | null {
      const stored: LiveEvent = {
        id: `mem-${++counter}`,
        title: e.title,
        date: e.date,
        time: e.time,
        ...(e.participant ? { participant: e.participant } : {}),
        ...(e.location ? { location: e.location } : {}),
        ...(e.notes ? { notes: e.notes } : {}),
      }
      events.push(stored)
      // Round-trip verify against the same array (never a false "saved").
      return events.find((x) => x.id === stored.id) ? { ...stored } : null
    },
    update(id, patch): LiveEvent | null {
      const e = events.find((x) => x.id === id)
      if (!e) return null
      // Apply only defined keys; blank string clears an optional field.
      for (const [k, v] of Object.entries(patch)) {
        if (v === undefined) continue
        ;(e as unknown as Record<string, unknown>)[k] = v
      }
      return { ...e }
    },
  }
}
