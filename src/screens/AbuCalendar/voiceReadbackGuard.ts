/**
 * Decides whether the voice confirmation readback text should be shown.
 *
 * Readback is suppressed when:
 * - voiceState is 'error' (the pipeline failed)
 * - the parsed draft has no meaningful content (empty title + no date + no time)
 *
 * This prevents misleading confirmation-style copy from appearing next to
 * a failure message (e.g. "הבנתי. לקבוע משהו..." alongside "לא הצלחתי להבין").
 */
export function shouldShowConfirmationReadback(
  voiceState: string,
  parsed: { title?: string; date?: string | null; time?: string | null } | null,
): boolean {
  if (!parsed) return false
  if (voiceState === 'error') return false
  return Boolean(parsed.title?.trim() || parsed.date || parsed.time)
}
