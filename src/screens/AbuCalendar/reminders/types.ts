export type ReminderCategory =
  | 'medication'
  | 'call'
  | 'home'
  | 'appointment_prep'
  | 'water'
  | 'general'

export type ReminderStatus =
  | 'scheduled'
  | 'due'
  | 'snoozed'
  | 'done'
  | 'overdue'
  | 'cancelled'

export type Reminder = {
  id: string
  kind: 'reminder'
  category: ReminderCategory
  title: string
  originalText?: string
  dueAt: string
  displayDateLabel: string
  displayTimeLabel: string
  recurrence?: {
    frequency: 'daily' | 'weekly' | 'custom'
    daysOfWeek?: number[]
    time: string
  }
  alertPolicy: {
    sound: boolean
    voice: boolean
    repeatUntilConfirmed: boolean
    snoozeMinutes: number
    remindBeforeMinutes?: number
    maxRepeats?: number
  }
  status: ReminderStatus
  snoozedUntil?: string
  confirmedAt?: string
  createdAt: string
  updatedAt: string
}

export type ReminderDraft = {
  intent: 'reminder'
  title?: string
  category: ReminderCategory
  dueAt?: string
  displayDateLabel?: string
  displayTimeLabel?: string
  recurrence?: Reminder['recurrence']
  alertPolicyDraft: Partial<Reminder['alertPolicy']>
  missingFields: Array<'title' | 'date' | 'time'>
  ambiguity?: {
    type: 'time' | 'date' | 'person' | 'route'
    question: string
    options: Array<{ label: string; value: string }>
  }
  familyResolution?: {
    status: 'resolved' | 'missing' | 'ambiguous'
    originalPhrase?: string
    resolvedName?: string
    candidates?: string[]
  }
  readbackText: string
}
