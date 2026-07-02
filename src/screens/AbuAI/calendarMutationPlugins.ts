/*
 * Calendar mutation domains as Domain Plugins
 * ═══════════════════════════════════════════
 * reminders / recurring / delete / modify, each a self-selecting DomainPlugin.
 * They call the reasoner functions (which are the TOOLS) and return structured
 * PluginResults — they never emit user text. Registered into the global planner;
 * the Executive Controller finalizes their candidate answers.
 */
import type { DomainPlugin, PluginResult } from './domainPlugin'
import {
  reminderReasoner, recurringReasoner, deleteReasoner, modifyReasoner,
  isReminderIntent, isRecurringIntent, isDeleteIntent, isModifyIntent,
} from './calendarMutationReasoner'
import { isCreateIntent } from './calendarCreate'
import { registerPlugin } from './domainPlanner'

const AUDIO = /(?:לא\s+שומע|לא\s+שמעתי|הקול\s+נעלם|אין\s+קול)/u

export const reminderPlugin: DomainPlugin = {
  name: 'reminder',
  domains: ['reminder'],
  match(ctx) {
    if (AUDIO.test(ctx.input)) return 0            // audio never cancels a reminder
    if (ctx.state.pendingReminder) return 0.99     // resolve the pending draft
    return isReminderIntent(ctx.input) ? 0.9 : 0
  },
  reason(ctx): PluginResult {
    const r = reminderReasoner(ctx.input, ctx.now, ctx.state.pendingReminder)
    return {
      handled: true, answer: r.text, sideEffect: r.sideEffect,
      statePatch: { pendingReminder: r.pendingReminder === undefined ? ctx.state.pendingReminder : r.pendingReminder },
      confidence: 0.95,
    }
  },
}

export const recurringPlugin: DomainPlugin = {
  name: 'recurring',
  domains: ['calendar_recurring'],
  match(ctx) { return isCreateIntent(ctx.input) && isRecurringIntent(ctx.input) ? 0.9 : 0 },
  reason(ctx): PluginResult { const r = recurringReasoner(ctx.input); return { handled: true, answer: r.text, sideEffect: r.sideEffect, confidence: 0.9 } },
}

export const deletePlugin: DomainPlugin = {
  name: 'delete',
  domains: ['calendar_delete'],
  match(ctx) { return isDeleteIntent(ctx.input) ? 0.9 : 0 },
  reason(ctx): PluginResult { const r = deleteReasoner(ctx.input); return { handled: true, answer: r.text, sideEffect: r.sideEffect, confidence: 0.9 } },
}

export const modifyPlugin: DomainPlugin = {
  name: 'modify',
  domains: ['calendar_update'],
  match(ctx) { return isModifyIntent(ctx.input) ? 0.9 : 0 },
  reason(ctx): PluginResult { const r = modifyReasoner(ctx.input); return { handled: true, answer: r.text, sideEffect: r.sideEffect, confidence: 0.9 } },
}

export const CALENDAR_MUTATION_PLUGINS: readonly DomainPlugin[] = [reminderPlugin, recurringPlugin, deletePlugin, modifyPlugin]

export function registerCalendarMutationPlugins(): void {
  for (const p of CALENDAR_MUTATION_PLUGINS) registerPlugin(p)
}
