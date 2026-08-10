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
        // If the caller ever passes a location, keep it — so a future LiveTools fix
        // makes the location scenarios go green without touching this store.
        ...(e.location ? { location: e.location } : {}),
      }
      events.push(stored)
      // Round-trip verify against the same array (never a false "saved").
      return events.find((x) => x.id === stored.id) ? { ...stored } : null
    },
  }
}
