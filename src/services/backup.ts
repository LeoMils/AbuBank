/**
 * AbuBank data backup/restore utility.
 * Exports all user data as a single JSON file.
 * Imports from a previously exported JSON file.
 */

const BACKUP_KEYS = [
  'abubank-calendar-appointments',
  'abu_reminders_v1',
  'abuai-conversation-history',
  'abubank.familyContacts.v1',
  'martita-contacts-v1',
  'martita-loc-contacts-v1',
  'abubank-alert-minutes',
  'abu-voice-speed',
  'abu-voice-lang',
] as const

export interface BackupData {
  version: 1
  exportedAt: string
  data: Record<string, string | null>
}

export function exportBackup(): BackupData {
  const data: Record<string, string | null> = {}
  for (const key of BACKUP_KEYS) {
    data[key] = localStorage.getItem(key)
  }
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    data,
  }
}

export function downloadBackup(): void {
  const backup = exportBackup()
  const json = JSON.stringify(backup, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `abubank-backup-${new Date().toISOString().split('T')[0]}.json`
  a.click()
  URL.revokeObjectURL(url)
  // Save backup timestamp for reminder system
  try { localStorage.setItem('abubank-last-backup', new Date().toISOString()) } catch {}
}

export function importBackup(file: File): Promise<{ restored: number; skipped: number }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const backup = JSON.parse(reader.result as string) as BackupData
        if (backup.version !== 1) {
          reject(new Error('גרסת גיבוי לא מוכרת'))
          return
        }
        let restored = 0
        let skipped = 0
        for (const [key, value] of Object.entries(backup.data)) {
          if (value !== null) {
            try {
              localStorage.setItem(key, value)
              restored++
            } catch {
              skipped++
            }
          }
        }
        resolve({ restored, skipped })
      } catch {
        reject(new Error('קובץ גיבוי לא תקין'))
      }
    }
    reader.onerror = () => reject(new Error('שגיאה בקריאת הקובץ'))
    reader.readAsText(file)
  })
}
