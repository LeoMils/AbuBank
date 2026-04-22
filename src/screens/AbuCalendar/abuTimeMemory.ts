const STORAGE_KEY = 'abutime-memory'

export interface AbuTimeMemory {
  doctorReminders: string[]
  notifyContacts: string[]
  lastUsedAction: string | null
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

export function addDoctorReminder(item: string): void {
  const mem = loadMemory()
  if (!mem.doctorReminders.includes(item)) {
    mem.doctorReminders.push(item)
    saveMemory(mem)
  }
}

export function recordAction(action: string): void {
  const mem = loadMemory()
  mem.lastUsedAction = action
  saveMemory(mem)
}
