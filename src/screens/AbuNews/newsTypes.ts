/*
 * newsTypes.ts — the Abu News story shape + completeness guard (shared, pure).
 * ════════════════════════════════════════════════════════════════════════════
 * Imported by BOTH the edge endpoint (api/abuai-news.ts) and the client, so the
 * client never pulls in server-only handler code. The completeness guard is the
 * honesty rule made mechanical: a story is shown ONLY if every field is present —
 * headline, plain-Hebrew summary, source name, a real url, AND a time. A half-blank
 * card (a headline with no source, a story with no time) is NEVER shown.
 */
export interface NewsStory {
  headline: string
  summary: string
  source: string
  url: string
  published: string
}

/** True only when a story is safe to show: every field present, url is a real link. */
export function isCompleteStory(s: unknown): s is NewsStory {
  if (!s || typeof s !== 'object') return false
  const o = s as Record<string, unknown>
  const str = (k: string) => typeof o[k] === 'string' && (o[k] as string).trim().length > 0
  return (
    str('headline') && str('summary') && str('source') && str('url') && str('published') &&
    /^https?:\/\//.test((o.url as string).trim())
  )
}
