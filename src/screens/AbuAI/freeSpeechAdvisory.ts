/**
 * Free Speech Advisory — safe first-pass routing for AbuAI.
 *
 * Runs routeFreeSpeech() on the user's input and returns either:
 *   • a senior-friendly Hebrew response string (intercepted domain), or
 *   • null — meaning "fall through to existing AbuAI routing".
 *
 * This is ADVISORY. It does not replace AbuAI's router.ts, grounded
 * answer path, or online layer. It intercepts cross-domain intents
 * (calendar create, WhatsApp send, navigation) with safe, no-side-effect
 * responses before they reach paths that could trigger writes.
 *
 * Pure function — no side effects, no API calls, no state mutations.
 */

import { routeFreeSpeech } from '../../services/freeSpeech/freeSpeechRouter'
import type { FreeSpeechRoute } from '../../services/freeSpeech/freeSpeechTypes'

export interface FreeSpeechAdvisoryResult {
  /** Non-null when the advisory intercepts; null when AbuAI should handle normally. */
  response: string | null
  /** The underlying route classification (always present for observability). */
  route: FreeSpeechRoute
}

/**
 * Classify the user's text and optionally intercept with a safe response.
 *
 * Intercepted domains:
 *   • calendar/create → handoff message (no event creation)
 *   • whatsapp/*      → handoff message (no send, no draft)
 *   • navigation/*    → informational message
 *   • unclear/*       → Hebrew clarification question
 *
 * Pass-through domains (return null):
 *   • calendar/query  → AbuAI already reads calendar safely
 *   • abuai/*         → personal/family grounded path
 *   • general/*       → greetings, open conversation
 */
export function adviseFreeSpeech(text: string): FreeSpeechAdvisoryResult {
  const route = routeFreeSpeech(text)

  switch (route.domain) {
    case 'calendar':
      if (route.action === 'create') {
        return {
          response: 'זה נשמע כמו בקשה ליומן. כדי לקבוע את זה, נעבור ליומן.',
          route,
        }
      }
      // calendar/query → fall through to existing AbuAI calendar read path
      return { response: null, route }

    case 'whatsapp':
      return {
        response: 'זה נשמע כמו הודעה. לפני שליחה צריך לבחור איש קשר ולאשר.',
        route,
      }

    case 'navigation':
      if (route.safety === 'clarify') {
        return {
          response: 'לאן רצית לעבור? יש יומן, הודעות, משחקים, והגדרות.',
          route,
        }
      }
      return {
        response: 'אני כאן לשוחח — אם רצית לעבור למסך אחר, לחצי על הכפתור למטה.',
        route,
      }

    case 'unclear':
      return {
        response: 'לא הבנתי. מה רצית לעשות?',
        route,
      }

    // abuai, general → fall through to existing path
    default:
      return { response: null, route }
  }
}
