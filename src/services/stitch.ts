/**
 * Stitch (Google Labs) — AI UI generation service.
 *
 * Browser-side wrapper that calls the Vite dev-proxy at /api/stitch/*.
 * The actual SDK (Node/MCP) runs entirely server-side.
 *
 * Requires: VITE_STITCH_API_KEY set in .env
 *
 * Usage:
 *   const { html, projectId, screenId } = await generateScreen('A weather page for elderly users in Hebrew')
 *   const { html: edited } = await editScreen('Make the font larger', projectId, screenId)
 */

export interface StitchResult {
  html:      string
  projectId: string
  screenId:  string
}

export type StitchError = { error: string }

async function stitchPost(
  route: 'generate' | 'edit',
  payload: Record<string, string>
): Promise<StitchResult> {
  const res = await fetch(`/api/stitch/${route}`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(payload),
  })
  const data = await res.json() as StitchResult | StitchError
  if (!res.ok || 'error' in data) {
    throw new Error(('error' in data ? data.error : undefined) ?? `Stitch ${res.status}`)
  }
  return data as StitchResult
}

/**
 * Generate a new mobile UI screen from a text prompt.
 * Optionally pass an existing projectId to reuse a Stitch project.
 */
export async function generateScreen(
  prompt:    string,
  projectId?: string
): Promise<StitchResult> {
  return stitchPost('generate', projectId ? { prompt, projectId } : { prompt })
}

/**
 * Edit an existing Stitch screen with a follow-up prompt.
 */
export async function editScreen(
  prompt:    string,
  projectId: string,
  screenId:  string
): Promise<StitchResult> {
  return stitchPost('edit', { prompt, projectId, screenId })
}

/** True if VITE_STITCH_API_KEY is configured (non-empty). */
export const stitchAvailable =
  typeof import.meta.env.VITE_STITCH_API_KEY === 'string' &&
  import.meta.env.VITE_STITCH_API_KEY.length > 0
