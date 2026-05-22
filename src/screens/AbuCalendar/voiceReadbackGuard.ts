/**
 * Decides whether the voice confirmation readback text should be shown.
 *
 * Readback requires ALL of:
 * - voiceState is not 'error'
 * - parsed exists
 * - title is non-empty after trim
 * - date exists
 * - time exists
 *
 * Incomplete drafts (title-only, date-only, etc.) must NOT trigger readback
 * because shapeCreateConfirmReadback would produce misleading confirmation
 * copy for partial data.
 */
export function shouldShowConfirmationReadback(
  voiceState: string,
  parsed: { title?: string; date?: string | null; time?: string | null } | null,
): boolean {
  if (!parsed) return false
  if (voiceState === 'error') return false
  return Boolean(parsed.title?.trim() && parsed.date && parsed.time)
}
