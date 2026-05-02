const STORAGE_KEY = 'abutime-memory'

export interface AbuTimeMemory {
  doctorReminders: string[]
  notifyContacts: string[]
  lastUsedAction: string | null
  behaviorLog: BehaviorEntry[]
}

interface BehaviorEntry {
  action: string
  eventMeaning: string
  timestamp: number
}

function loadMemory(): AbuTimeMemory {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultMemory()
    return { ...defaultMemory(), ...JSON.parse(raw) }
  } catch {
    return defaultMemory()
  }
}

function defaultMemory(): AbuTimeMemory {
  return {
    doctorReminders: ['תעודת זהות', 'כרטיס קופה', 'רשימת תרופות'],
    notifyContacts: ['מור', 'לאו'],
    lastUsedAction: null,
    behaviorLog: [],
  }
}

function saveMemory(memory: AbuTimeMemory): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(memory)) } catch {}
}

export function getPersonalReminders(eventType: string): string[] {
  const mem = loadMemory()
  if (/רופא|בדיקה|בית חולים/.test(eventType)) return mem.doctorReminders
  return []
}

export function getNotifyContacts(): string[] {
  return loadMemory().notifyContacts
}

/**
 * @workbench-keep FUTURE_API
 * reason: planned write-side mutation for AbuCalendar reminder customisation; pairs with getPersonalReminders and getNotifyContacts
 * owner: leo
 * reviewAfter: 2026-08-01
 */
export function addDoctorReminder(item: string): void {
  const mem = loadMemory()
  if (!mem.doctorReminders.includes(item)) {
    mem.doctorReminders.push(item)
    saveMemory(mem)
  }
}

export function recordAction(action: string, eventMeaning?: string): void {
  const mem = loadMemory()
  mem.lastUsedAction = action
  mem.behaviorLog.push({ action, eventMeaning: eventMeaning ?? 'unknown', timestamp: Date.now() })
  if (mem.behaviorLog.length > 50) mem.behaviorLog = mem.behaviorLog.slice(-50)
  saveMemory(mem)
}

export function getPatternPrediction(eventMeaning: string): string | null {
  const mem = loadMemory()
  const relevant = mem.behaviorLog.filter(e => e.eventMeaning === eventMeaning)
  if (relevant.length < 2) return null

  const actionCounts: Record<string, number> = {}
  for (const e of relevant) {
    actionCounts[e.action] = (actionCounts[e.action] ?? 0) + 1
  }

  const topAction = Object.entries(actionCounts).sort((a, b) => b[1] - a[1])[0]
  if (!topAction || topAction[1] < 2) return null

  const [action, count] = topAction
  const confidence = count / relevant.length

  if (confidence < 0.6) return null

  if (action === 'prepare_list' && eventMeaning === 'medical') return 'בפעמים הקודמות הכנת רשימה לפני הרופא. רוצה גם הפעם?'
  if (action === 'log_outcome' && eventMeaning === 'medical') return 'תמיד רשמת מה הרופא אמר. אל תשכחי גם הפעם.'
  if (action === 'notify_contact' && eventMeaning === 'social') return 'תמיד הודעת למשפחה לפני ביקורים. רוצה גם עכשיו?'
  if (action === 'set_reminder') return 'בדרך כלל ביקשת תזכורת. לקבוע?'

  return null
}
