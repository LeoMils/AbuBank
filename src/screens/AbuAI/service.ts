import type { ChatMessage } from './types'

import { TOOL_DEFINITIONS, executeTool, getTodayEvents, getTomorrowEvents, getUpcomingEvents, getWeekEvents, getEventsByDate, getEventsByMonth, getBirthdayFor, getMemorialFor, searchFamily, searchFamilyLocation, searchFamilyGroup } from './tools'
import { generateFamilyPromptSection } from '../../services/familyLoader'
import { routePersonalQuery, type RouteResult } from './router'
import { parseHebrewTime } from './calendarCreate'
import { answerFromToolResult, type ToolResult } from './groundedResponse'
import { sendServerChat, streamServerChat, checkServerChatHealth } from './serverChatProvider'
import { describeRelation, loadGraph, type Lang } from './familyGraph'
import { detectLanguage } from './proactive'
import { shapeFamilyAnswerES, shapeCalendarAnswerES, shapeLocationAnswerES, shapeCreateConfirmES, shapeCreateSavedES, shapeCreateCancelledES, shapeCreateClarifyES } from './responseShaper'
import { durable } from '../../services/durableStore'

// ─── Conversation Summary ────────────────────────────────────────────────────

const SUMMARY_KEY = 'abuai-conversation-summary'

export interface ConversationSummary {
  updatedAt: number
  peopleDiscussed: string[]
  topicsDiscussed: string[]
  appointmentsMentioned: string[]
  emotionalContext: string | null
  lastUserRequest: string | null
  factsMentioned: string[]
}

export function loadSummary(): ConversationSummary | null {
  try {
    const raw = localStorage.getItem(SUMMARY_KEY)
    return raw ? JSON.parse(raw) as ConversationSummary : null
  } catch { return null }
}

export function saveSummary(summary: ConversationSummary): void {
  try { durable.setString(SUMMARY_KEY, JSON.stringify(summary)) } catch { /* storage full */ }
}

/**
 * Extracts key facts from recent messages and updates the rolling summary.
 * Pure function — no LLM call, just pattern matching.
 */
export function updateSummaryFromMessages(
  messages: Array<{ role: string; content: string }>,
  existing: ConversationSummary | null,
): ConversationSummary {
  const summary: ConversationSummary = existing
    ? { ...existing, peopleDiscussed: [...existing.peopleDiscussed], topicsDiscussed: [...existing.topicsDiscussed], appointmentsMentioned: [...existing.appointmentsMentioned], factsMentioned: [...existing.factsMentioned] }
    : { updatedAt: Date.now(), peopleDiscussed: [], topicsDiscussed: [], appointmentsMentioned: [], emotionalContext: null, lastUserRequest: null, factsMentioned: [] }

  // Load family graph for name detection
  let familyNames: string[] = []
  try {
    const graph = loadGraph()
    familyNames = graph.map(n => n.hebrew)
  } catch { /* graph unavailable */ }

  const recent = messages.slice(-10)
  const peopleSet = new Set(summary.peopleDiscussed)
  const topicSet = new Set(summary.topicsDiscussed)

  for (const msg of recent) {
    // Detect family members mentioned
    for (const name of familyNames) {
      if (msg.content.includes(name)) peopleSet.add(name)
    }

    // Detect topics
    if (/יומן|פגישה|תור|קבע/.test(msg.content)) topicSet.add('יומן')
    if (/רופא|בריאות|כדור|תרופ/.test(msg.content)) topicSet.add('בריאות')
    if (/בישול|מתכון|אוכל/.test(msg.content)) topicSet.add('בישול')
    if (/חדשות|פוליטי/.test(msg.content)) topicSet.add('חדשות')
    if (/פפי|געגוע|זיכרון/.test(msg.content)) topicSet.add('פפי')

    // Detect emotional context — only from strong signals, not incidental words
    if (msg.role === 'user') {
      if (/עצוב[הא]?|קשה לי|לא טוב לי|בודד[הא]?|מתגעגע|חסר לי|triste|extraño/i.test(msg.content)) summary.emotionalContext = 'עצובה'
      else if (/שמח[הא]?|כיף לי|יום טוב|content[ao]/i.test(msg.content)) summary.emotionalContext = 'שמחה'
      else if (/משעמם|שעמום|aburrid/i.test(msg.content)) summary.emotionalContext = 'משועממת'
      // Don't overwrite emotional context with incidental word matches
      summary.lastUserRequest = msg.content
    }

    // Detect appointments mentioned in assistant responses
    if (msg.role === 'assistant' && /קבעתי|פגישה|תור/.test(msg.content)) {
      const apptMatch = msg.content.match(/(פגישה|תור)\s+(עם\s+\S+|.{3,20})/)
      if (apptMatch) summary.appointmentsMentioned.push(apptMatch[0])
    }
  }

  summary.peopleDiscussed = [...peopleSet].slice(-10) // cap at 10
  summary.topicsDiscussed = [...topicSet].slice(-8)
  summary.appointmentsMentioned = summary.appointmentsMentioned.slice(-5)
  summary.updatedAt = Date.now()

  return summary
}

/**
 * Generate an LLM-powered conversation summary every 20 messages.
 * Falls back to pattern-matching summary if LLM fails.
 */
export async function generateLLMSummary(
  messages: Array<{ role: string; content: string }>,
  existing: ConversationSummary | null,
): Promise<ConversationSummary> {
  // Always update the pattern-matching summary as fallback
  const patternSummary = updateSummaryFromMessages(messages, existing)

  try {
    const recent = messages.slice(-20)
    if (recent.length < 4) return patternSummary

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 6000)

    const res = await fetch('/api/abuai-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'Summarize this conversation in 2-3 short Hebrew sentences. Include: who was discussed, what topics, what was decided, what emotional state. Be factual and brief. Output ONLY the summary text.' },
          ...recent.map(m => ({ role: m.role, content: m.content })),
        ],
        max_tokens: 100,
        temperature: 0.3,
      }),
      signal: controller.signal,
    })
    clearTimeout(timeout)

    if (!res.ok) return patternSummary

    const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> }
    const llmSummaryText = data?.choices?.[0]?.message?.content?.trim()

    if (llmSummaryText && llmSummaryText.length > 10) {
      patternSummary.factsMentioned = [llmSummaryText]
    }
  } catch {
    // LLM failed — pattern summary is still valid
  }

  return patternSummary
}

/**
 * Format summary as a context string for the LLM system message.
 */
export function formatSummaryForLLM(summary: ConversationSummary): string {
  const parts: string[] = []
  if (summary.peopleDiscussed.length > 0) {
    parts.push(`בשיחה הזו דיברנו על: ${summary.peopleDiscussed.join(', ')}`)
  }
  if (summary.topicsDiscussed.length > 0) {
    parts.push(`נושאים: ${summary.topicsDiscussed.join(', ')}`)
  }
  if (summary.emotionalContext) {
    parts.push(`מצב רוח: ${summary.emotionalContext}`)
  }
  if (summary.appointmentsMentioned.length > 0) {
    parts.push(`פגישות שנדונו: ${summary.appointmentsMentioned.join('; ')}`)
  }
  // Include LLM-generated summary if available
  if (summary.factsMentioned.length > 0) {
    parts.push(`סיכום: ${summary.factsMentioned[summary.factsMentioned.length - 1]}`)
  }
  return parts.length > 0 ? `[סיכום שיחה: ${parts.join('. ')}]` : ''
}

// Feature flag — disable tools without redeploy
function toolsEnabled(): boolean {
  try { return localStorage.getItem('abubank-tools-disabled') !== 'true' } catch { return true }
}

// Single source of truth: routePersonalQuery is the classifier. Anything
// other than 'non_personal' is, by definition, a personal query — so the
// previous Hebrew-only CALENDAR_PATTERNS / FAMILY_PATTERNS regexes are
// gone. This unifies Spanish + English + mixed-language coverage with the
// router's open-topic guard, so "Recomendame un podcast" /
// "Tell me about Italy" stay non-personal and stream through the open LLM
// path while "¿Qué tengo hoy?" / "Háblame de Leo" reach grounded tools.
export function isPersonalQuery(text: string): boolean {
  return routePersonalQuery(text).type !== 'non_personal'
}

/**
 * Build a deterministic HE/ES/EN redirect when the user asked AbuAI to
 * call / WhatsApp / message someone. AbuAI does NOT hold phone numbers
 * (those live in AbuWhatsApp's local-only storage), and must NEVER
 * invent one. The redirect points the user to AbuWhatsApp where the
 * tap-photo flow handles the actual action.
 */
function shapeContactActionRedirect(route: RouteResult): string {
  const action = route.contactAction ?? 'call'
  const lowered = (route.query ?? '').toLowerCase()
  const hasHebrew = /[֐-׿]/.test(route.query ?? '')
  const isSpanish = /\b(llam[aá]|mand[aá]|env[ií]a|whatsapp|mensaje)\b/i.test(lowered)
  const personName = route.familyQuery ?? ''
  const HE = () => {
    const verb = action === 'whatsapp' ? 'לשלוח וואטסאפ'
      : action === 'message' ? 'לשלוח הודעה' : 'להתקשר'
    const who = personName ? `ל-${personName}` : ''
    return `כדי ${verb} ${who} — פתחי את אבו וואטסאפ ולחצי על התמונה שלו.`
  }
  const ES = () => {
    const verb = action === 'whatsapp' ? 'mandarle un WhatsApp'
      : action === 'message' ? 'mandarle un mensaje' : 'llamarlo'
    const who = personName ? ` a ${personName}` : ''
    return `Para ${verb}${who}, abrí Abu WhatsApp y tocá su foto.`
  }
  const EN = () => {
    const verb = action === 'whatsapp' ? 'send a WhatsApp'
      : action === 'message' ? 'send a message' : 'call'
    const who = personName ? ` to ${personName}` : ''
    return `To ${verb}${who}, open Abu WhatsApp and tap their photo.`
  }
  if (hasHebrew) return HE()
  if (isSpanish) return ES()
  // Spanish/Hebrew share the largest user base; the English fallback
  // covers explicit English phrasing ("call Leo").
  return EN()
}

/**
 * B2.4 — concise relation answer ("how are A and B related").
 *
 * If the graph resolver returns a phrase, we use it verbatim — that's
 * the truth-anchored single sentence. If it returns null, we surface an
 * honest "no direct relation found" message in the same language as the
 * input, never a fabricated bridge.
 */
function shapeRelationshipBetween(route: RouteResult): string {
  const q = route.query ?? ''
  const lang: Lang = /[֐-׿]/.test(q)
    ? 'he'
    : /\b(qu[eé]|c[oó]mo|relaci[oó]n|tiene|ver)\b/i.test(q)
      ? 'es'
      : 'en'
  const a = route.familyQuery ?? ''
  const b = route.familyQueryB ?? ''
  const desc = describeRelation(a, b, lang)
  if (desc) return desc
  if (lang === 'es') return `No encontré una relación directa entre ${a} y ${b}.`
  if (lang === 'en') return `I did not find a direct relation between ${a} and ${b}.`
  return `לא יודעת מה הקשר בין ${a} ל${b}.`
}

/**
 * Takes verified grounded facts and lets the LLM paraphrase them naturally.
 * Falls back to the raw deterministic answer if the LLM call fails.
 */
export async function groundedLLMAnswer(
  userMessage: string,
  groundedFacts: string,
  recentMessages: Array<{ role: string; content: string }>,
  fallback: string,
): Promise<string> {
  const factSystemMsg = `You have these VERIFIED FACTS. Answer using ONLY these facts. Do not add, invent, or guess anything not stated here.

VERIFIED FACTS:
${groundedFacts}

RULES:
- Use ONLY the facts above. Do not invent additional details.
- Match the user's language (Hebrew → Hebrew, Spanish → Spanish).
- Be warm, short (2-3 sentences max), conversational — like talking on the phone.
- Address Martita in feminine Hebrew (את, שלך, תשאלי, תגידי).
- Family members: use correct gender (הוא/היא, שלו/שלה).
- Never say "על פי הנתונים" / "מצאתי" / "להלן" / "I found" / "according to data".
- Never start with "כמובן" / "בהחלט" / "בוודאי".
- Never end with "אם תצטרכי עוד משהו" or "if you need anything".
- Sound like a friend who knows the family personally, not software reading a profile.
- Keep it natural for speech — short sentences, no lists, no bullets.
- If the user asked in Spanish, answer entirely in Rioplatense Spanish (vos, dale).`

  try {
    const messages = [
      { role: 'system' as const, content: factSystemMsg },
      ...recentMessages.slice(-6).map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      { role: 'user' as const, content: userMessage },
    ]

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000)

    const res = await fetch('/api/abuai-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages,
        max_tokens: 150,
        temperature: 0.7,
      }),
      signal: controller.signal,
    })
    clearTimeout(timeout)

    if (!res.ok) return fallback

    const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> }
    const content = data?.choices?.[0]?.message?.content?.trim()

    if (!content) return fallback

    return stripMarkdown(content)
  } catch {
    return fallback
  }
}

export function tryGroundedAnswer(text: string): string | null {
  const lang = detectLanguage(text) // 'he' | 'es' | 'en' | 'mixed'
  const route = routePersonalQuery(text)
  if (route.type === 'non_personal') {
    console.log(`[AbuAI:route] "${text.slice(0, 40)}" → non_personal (needs LLM)`)
    return null
  }
  console.log(`[AbuAI:route] "${text.slice(0, 40)}" → ${route.type} [LOCAL] lang=${lang} person=${route.familyQuery ?? '-'}`)


  try {
    let result: ToolResult
    switch (route.type) {
      case 'calendar_today': {
        const r = getTodayEvents()
        // Filter by specific or after time ("מה יש לי בארבע" / "מה יש לי אחרי ארבע")
        const todayRequestedTime = parseHebrewTime(text)
        let todayEvents = r.events
        const isAfterQuery = /אחרי|אחר|after/i.test(text)
        const isBeforeQuery = /לפני|before/i.test(text)
        if (todayRequestedTime && todayEvents.length > 0) {
          if (isBeforeQuery) {
            todayEvents = todayEvents.filter(e => e.time && e.time < todayRequestedTime)
          } else if (isAfterQuery) {
            todayEvents = todayEvents.filter(e => e.time && e.time > todayRequestedTime)
          } else {
            const filtered = todayEvents.filter(e => e.time === todayRequestedTime)
            if (filtered.length > 0) todayEvents = filtered
          }
        }
        if (lang === 'es') return shapeCalendarAnswerES(todayEvents, 'today')
        // If a time filter changed the set, rebuild the summary from the
        // filtered events (the original summary is unfiltered — it would leak
        // events outside the asked window).
        result = (todayRequestedTime && r.events.length !== todayEvents.length)
          ? { ok: true, events: todayEvents, summary: todayEvents.length === 0
              ? 'אין כלום בזמן הזה. יום שקט.'
              : `היום ${todayEvents.map(e => `${e.emoji} ${e.title}${e.time ? ` ב${e.time}` : ''}`).join(', ')}.` }
          : { ok: true, events: todayEvents, summary: r.summary }
        break
      }
      case 'calendar_tomorrow': {
        const r = getTomorrowEvents()
        // P0-5: Filter by specific time if query mentions one
        const tmrwRequestedTime = parseHebrewTime(text)
        let tmrwEvents = r.events
        if (tmrwRequestedTime && tmrwEvents.length > 0) {
          const tmrwIsAfter = /אחרי|אחר|after/i.test(text)
          const tmrwIsBefore = /לפני|before/i.test(text)
          if (tmrwIsBefore) {
            tmrwEvents = tmrwEvents.filter(e => e.time && e.time < tmrwRequestedTime)
          } else if (tmrwIsAfter) {
            tmrwEvents = tmrwEvents.filter(e => e.time && e.time > tmrwRequestedTime)
          } else {
            const filtered = tmrwEvents.filter(e => e.time === tmrwRequestedTime)
            if (filtered.length > 0) tmrwEvents = filtered
          }
        }
        if (lang === 'es') return shapeCalendarAnswerES(tmrwEvents, 'tomorrow')
        result = (tmrwRequestedTime && r.events.length !== tmrwEvents.length)
          ? { ok: true, events: tmrwEvents, summary: tmrwEvents.length === 0
              ? 'מחר אין כלום בזמן הזה. יום שקט.'
              : `מחר ${tmrwEvents.map(e => `${e.emoji} ${e.title}${e.time ? ` ב${e.time}` : ''}`).join(', ')}.` }
          : { ok: true, events: tmrwEvents, summary: r.summary }
        break
      }
      case 'calendar_upcoming': {
        // Use week-scoped query (today + 7 days) for "what do I have this
        // week / coming up" — more relevant than unlimited future events.
        const r = getWeekEvents()
        if (lang === 'es') return shapeCalendarAnswerES(r.events, 'week')
        result = { ok: true, events: r.events, summary: r.summary }
        break
      }
      case 'calendar_exact_date': {
        if (!route.dateStr) return null
        const r = getEventsByDate(route.dateStr)
        result = { ok: true, events: r.events, summary: r.summary }
        break
      }
      case 'calendar_month': {
        if (!route.month) return null
        const r = getEventsByMonth(route.month)
        result = { ok: true, events: r.events, summary: r.summary }
        break
      }
      case 'birthday_lookup': {
        const r = getBirthdayFor(route.familyQuery ?? '')
        if (lang === 'es' && r.found) {
          // Re-shape the Hebrew summary into Spanish
          const summaryMatch = r.summary.match(/(\S+)\s*—\s*(\d+)\s*ב(.+)\./)
          if (summaryMatch) {
            const personName = summaryMatch[1]
            const day = summaryMatch[2]
            const heMonth = summaryMatch[3]!.trim()
            const ES_MONTHS: Record<string, string> = {
              'ינואר': 'enero', 'פברואר': 'febrero', 'מרץ': 'marzo', 'אפריל': 'abril',
              'מאי': 'mayo', 'יוני': 'junio', 'יולי': 'julio', 'אוגוסט': 'agosto',
              'ספטמבר': 'septiembre', 'אוקטובר': 'octubre', 'נובמבר': 'noviembre', 'דצמבר': 'diciembre',
            }
            const esMonth = ES_MONTHS[heMonth] ?? heMonth
            return `El cumpleaños de ${personName} es el ${day} de ${esMonth}.`
          }
        }
        if (lang === 'es' && !r.found) {
          return `No tengo la fecha de cumpleaños de ${route.familyQuery ?? ''}.`
        }
        return r.summary
      }
      case 'memorial_lookup': {
        const r = getMemorialFor(route.familyQuery ?? '')
        if (lang === 'es' && r.found) {
          const summaryMatch = r.summary.match(/(\S+)\s*—\s*(\d+)\s*ב(.+)\.\s*🕯️/)
          if (summaryMatch) {
            const personName = summaryMatch[1]
            const day = summaryMatch[2]
            const heMonth = summaryMatch[3]!.trim()
            const ES_MONTHS: Record<string, string> = {
              'ינואר': 'enero', 'פברואר': 'febrero', 'מרץ': 'marzo', 'אפריל': 'abril',
              'מאי': 'mayo', 'יוני': 'junio', 'יולי': 'julio', 'אוגוסט': 'agosto',
              'ספטמבר': 'septiembre', 'אוקטובר': 'octubre', 'נובמבר': 'noviembre', 'דצמבר': 'diciembre',
            }
            const esMonth = ES_MONTHS[heMonth] ?? heMonth
            return `El aniversario de ${personName} es el ${day} de ${esMonth}. Un día especial.`
          }
        }
        if (lang === 'es' && !r.found) {
          return `No tengo esa fecha, Martita.`
        }
        return r.summary
      }
      case 'family_lookup': {
        // Relational role queries: "מי אמא של X?", "מי בת הזוג של X?", "מי סבתא של X?"
        const roleMatch = route.query.match(/מי\s+(סבתא רבתא|סבא רבא|אמא|אבא|סבתא|סבא|דודה|דוד|אחות|אח|בת הזוג|בן הזוג|החברה|החבר)\s+של\s+(\S+)/)
        if (roleMatch) {
          const role = roleMatch[1]!
          const targetName = roleMatch[2]!.replace(/[?!.,]$/, '')
          const graph = loadGraph()
          const target = graph.find(n => n.matchNames.includes(targetName.toLowerCase()) || n.hebrew === targetName)
          if (target) {
            // Resolve by role
            if (role === 'אמא' || role === 'אבא') {
              const parent = target.parentsHe
                .map(p => graph.find(n => n.hebrew === p))
                .find(n => n && (role === 'אמא' ? n.gender === 'female' : n.gender === 'male'))
              if (parent) return `${parent.hebrew}.`
            }
            if (role === 'סבתא' || role === 'סבא') {
              // Grandparent = parent of parent
              for (const pHe of target.parentsHe) {
                const p = graph.find(n => n.hebrew === pHe)
                if (!p) continue
                const gp = p.parentsHe
                  .map(g => graph.find(n => n.hebrew === g))
                  .find(n => n && (role === 'סבתא' ? n.gender === 'female' : n.gender === 'male'))
                if (gp) return `${gp.hebrew}.`
              }
            }
            if (role === 'סבתא רבתא' || role === 'סבא רבא') {
              // Great-grandparent = parent of grandparent (3 hops up).
              const wantFemale = role === 'סבתא רבתא'
              for (const pHe of target.parentsHe) {
                const p = graph.find(n => n.hebrew === pHe)
                if (!p) continue
                for (const gpHe of p.parentsHe) {
                  const gp = graph.find(n => n.hebrew === gpHe)
                  if (!gp) continue
                  const ggp = gp.parentsHe
                    .map(g => graph.find(n => n.hebrew === g))
                    .find(n => n && (wantFemale ? n.gender === 'female' : n.gender === 'male'))
                  if (ggp) return `${ggp.hebrew}.`
                }
              }
            }
            if (role === 'דוד' || role === 'דודה') {
              // Aunt/uncle = a sibling of one of the target's parents.
              const wantFemale = role === 'דודה'
              const seen = new Set<string>()
              const auntsUncles: string[] = []
              for (const pHe of target.parentsHe) {
                const p = graph.find(n => n.hebrew === pHe)
                if (!p) continue
                for (const gpHe of p.parentsHe) {
                  const gp = graph.find(n => n.hebrew === gpHe)
                  if (!gp) continue
                  for (const sibHe of gp.childrenHe) {
                    if (sibHe === p.hebrew || seen.has(sibHe)) continue
                    const sib = graph.find(n => n.hebrew === sibHe)
                    if (sib && (wantFemale ? sib.gender === 'female' : sib.gender === 'male')) {
                      seen.add(sibHe)
                      auntsUncles.push(sib.hebrew)
                    }
                  }
                }
              }
              if (auntsUncles.length > 0) return auntsUncles.join(' ו') + '.'
            }
            if (role === 'אחות' || role === 'אח') {
              const siblings = target.parentsHe
                .flatMap(p => graph.find(n => n.hebrew === p)?.childrenHe ?? [])
                .filter(c => c !== target.hebrew)
                .map(c => graph.find(n => n.hebrew === c))
                .filter(n => n && (role === 'אחות' ? n.gender === 'female' : n.gender === 'male'))
              if (siblings.length > 0) return siblings.map(s => s!.hebrew).join(' ו') + '.'
            }
            if (role === 'בת הזוג' || role === 'החברה') {
              const partner = [...target.partnersHe, ...target.spousesHe]
                .map(p => graph.find(n => n.hebrew === p))
                .find(n => n && n.gender === 'female')
              if (partner) return `${partner.hebrew}.`
            }
            if (role === 'בן הזוג' || role === 'החבר') {
              const partner = [...target.partnersHe, ...target.spousesHe]
                .map(p => graph.find(n => n.hebrew === p))
                .find(n => n && n.gender === 'male')
              if (partner) return `${partner.hebrew}.`
            }
            return `לא יודעת מי ${role} של ${targetName}.`
          }
        }

        // Age questions: "בן כמה הוא?", "בת כמה אופיר?"
        // We don't have birth years, so answer honestly.
        if (/בן כמה|בת כמה|כמה (הוא|היא) בן|כמה (הוא|היא) בת|מה הגיל/.test(route.query)) {
          const name = route.familyQuery ?? ''
          return `אין לי את שנת הלידה של ${name}. תשאלי ישירות — אני לא רוצה לנחש.`
        }
        // Try group query first: "הנכדים", "הילדים של מור", "ספרי לי על הנכדים"
        const groupAnswer = searchFamilyGroup(route.query)
        if (groupAnswer) return groupAnswer
        // "ספרי לי על X" / "contame de X" → rich, warmer reply; "מי זאת X" → terse.
        const richMode = /ספרי לי (עוד )?על|ספר לי על|תספרי לי על|ספרי עוד על|cont[aá]me (de|sobre)|h[aá]blame de/i.test(route.query)
        const r = searchFamily(route.familyQuery ?? '', richMode)
        // Spanish: re-shape with Spanish family answer
        if (lang === 'es' && r.found && r.members.length > 0) {
          return shapeFamilyAnswerES(r.members[0]!, richMode)
        }
        if (lang === 'es' && !r.found) {
          return 'No conozco a nadie con ese nombre. ¿Otro nombre?'
        }
        result = { ok: true, found: r.found, members: r.members, answer: r.answer }
        break
      }
      case 'family_location': {
        if (lang === 'es') {
          const fam = searchFamily(route.familyQuery ?? '')
          if (!fam.found || fam.members.length === 0) return 'No conozco a nadie con ese nombre. ¿Otro nombre?'
          const m = fam.members[0]!
          if (!m.location) return `No tengo información de dónde vive ${m.canonicalName}.`
          return shapeLocationAnswerES(m.canonicalName, m.location, m.locationNotes)
        }
        const r = searchFamilyLocation(route.familyQuery ?? '')
        return r.answer
      }
      case 'contact_action': {
        // B2.3: contact-action requests redirect the user to AbuWhatsApp
        // (the only surface that holds phone/WhatsApp data). AbuAI
        // never invents a phone number or initiates the call itself.
        return shapeContactActionRedirect(route)
      }
      case 'family_relationship_between': {
        // B2.4: "what is the relation between A and B" / "how is A
        // related to B". Pure graph lookup over family_data.json. If
        // no representable path is found, we surface an honest
        // "no direct relation found" message — never invent.
        return shapeRelationshipBetween(route)
      }
      default:
        return null
    }
    return answerFromToolResult(route.type, result)
  } catch {
    return 'רגע, משהו לא עבד. ננסה שוב?'
  }
}

const CALENDAR_CLAIM_PATTERNS = /יש לך (תור|פגישה|אירוע|רופא|בדיקה)|אני רואה (ש|ביומן|שיש)|ביומן שלך|לפי היומן|התור שלך|הפגישה שלך ב/
const INVENTED_EVENT_PATTERNS = /יש לך ב[־-]?\d{1,2}[.:]\d{2}|יש לך ביום [א-ת]/
// Past-tense first-person success verbs that imply a tool ran. The "לא "
// lookbehind keeps the honest negations "לא בדקתי" / "לא מצאתי" unflagged.
// Hebrew lookarounds are used because \b only matches ASCII word boundaries.
const PAST_TENSE_CLAIM_PATTERNS = /(?<!לא\s)(?<![֐-׿])(בדקתי|חיפשתי|מצאתי|אימתתי|אישרתי)(?![֐-׿])/

// B1 patch: Spanish + English calendar-claim patterns. Triggered only
// when no tool actually ran, so an honest tool result with the same
// Hebrew/Spanish/English copy stays unflagged.
const SPANISH_CLAIM_PATTERNS = /(tienes|ten[eé]s)\s+(cita|turno|m[eé]dico|doctor|dentista|reuni[oó]n|consulta)|hoy\s+tienes\s+(cita|turno|m[eé]dico|reuni[oó]n)|ma[nñ]ana\s+tienes\s+(cita|turno|m[eé]dico|reuni[oó]n)|en\s+tu\s+calendario|seg[uú]n\s+tu\s+calendario/i
const ENGLISH_CLAIM_PATTERNS = /\byou\s+have\s+(an?\s+)?(appointment|doctor|meeting|reservation)\b|\b(today|tomorrow)\s+you\s+have\b|\bin\s+your\s+calendar\b|\baccording\s+to\s+your\s+calendar\b/i

export function containsUngroundedClaim(response: string, hadToolCall: boolean): boolean {
  if (hadToolCall) return false
  return CALENDAR_CLAIM_PATTERNS.test(response)
    || INVENTED_EVENT_PATTERNS.test(response)
    || PAST_TENSE_CLAIM_PATTERNS.test(response)
    || SPANISH_CLAIM_PATTERNS.test(response)
    || ENGLISH_CLAIM_PATTERNS.test(response)
}

const SAFE_REFUSAL = 'רגע, אני לא בטוחה. תשאלי שוב ואני אבדוק.'

// Provider priority (B2.1):
//   1. OpenAI via SERVER PROXY (/api/abuai-chat) — OPENAI_API_KEY lives
//      on the server only, NEVER in the client bundle.
//   2. Gemini 2.0 Flash (free, client-side legacy fallback)
//   3. Groq Llama (free, client-side legacy fallback)
// The OpenAI client-side key is no longer read in this file. The
// browser bundle never sees an OpenAI secret.
const OPENAI_PROXY_URL = '/api/abuai-chat'
const OPENAI_MODEL_TEXT  = 'gpt-4o'          // text mode: reliable, high quality
const OPENAI_MODEL_VOICE = 'gpt-4o-mini'     // voice mode (pipeline fallback): speed + cost

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions'
const GEMINI_MODEL = 'gemini-2.0-flash'

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'
const GROQ_MODEL = 'llama-3.3-70b-versatile'

interface Provider {
  /** Provider kind drives the fetch shape: server-proxy uses
   *  POST /api/abuai-chat with a `body` envelope; client-direct
   *  posts to the upstream URL with an Authorization header. */
  kind: 'openai-server' | 'gemini-client' | 'groq-client'
  url: string
  model: string
  /** Only set for client-direct providers (Gemini / Groq). */
  apiKey?: string
}

// ─── Provider cooldown tracking ───
// When any provider returns 429 / quota error, we record a cooldown
// timestamp. The provider is skipped until the cooldown expires.
// Cooldown durations: OpenAI 5 min (quota), Groq/Gemini 60s (rate limit).
const COOLDOWN_KEYS: Record<Provider['kind'], string> = {
  'openai-server': 'abu-openai-quota-failed',
  'groq-client':   'abu-groq-cooldown',
  'gemini-client': 'abu-gemini-cooldown',
}
const COOLDOWN_MS: Record<Provider['kind'], number> = {
  'openai-server': 300_000,  // 5 min — server quota / key missing
  'groq-client':   60_000,   // 60s — free-tier rate limit
  'gemini-client': 60_000,   // 60s — free-tier rate limit
}

function isProviderCoolingDown(kind: Provider['kind']): boolean {
  try {
    const ts = localStorage.getItem(COOLDOWN_KEYS[kind])
    if (!ts) return false
    return (Date.now() - parseInt(ts, 10)) < COOLDOWN_MS[kind]
  } catch { return false }
}

function markProviderCooldown(kind: Provider['kind']): void {
  try { localStorage.setItem(COOLDOWN_KEYS[kind], String(Date.now())) } catch {}
}

function getProviders(voiceMode = false): Provider[] {
  const providers: Provider[] = []
  const geminiKey = import.meta.env.VITE_GEMINI_API_KEY as string | undefined
  const groqKey = import.meta.env.VITE_GROQ_API_KEY as string | undefined

  const openaiAvailable = !isProviderCoolingDown('openai-server')
  const groqAvailable   = !isProviderCoolingDown('groq-client')
  const geminiAvailable = !isProviderCoolingDown('gemini-client')

  if (voiceMode) {
    // Voice mode: QUALITY FIRST — OpenAI (gpt-4o-mini, fast+quality) → Groq (free) → Gemini.
    // Groq/Llama produces formulaic Hebrew; OpenAI is dramatically better for natural conversation.
    if (openaiAvailable)             providers.push({ kind: 'openai-server', url: OPENAI_PROXY_URL, model: OPENAI_MODEL_VOICE })
    if (groqKey && groqAvailable)     providers.push({ kind: 'groq-client',   url: GROQ_URL,         model: GROQ_MODEL,         apiKey: groqKey })
    if (geminiKey && geminiAvailable) providers.push({ kind: 'gemini-client', url: GEMINI_URL,       model: GEMINI_MODEL,       apiKey: geminiKey })
  } else {
    // Text mode: OpenAI server-proxy → Gemini (free, client) → Groq (free, client)
    if (openaiAvailable)             providers.push({ kind: 'openai-server', url: OPENAI_PROXY_URL, model: OPENAI_MODEL_TEXT })
    if (geminiKey && geminiAvailable) providers.push({ kind: 'gemini-client', url: GEMINI_URL,       model: GEMINI_MODEL,       apiKey: geminiKey })
    if (groqKey && groqAvailable)     providers.push({ kind: 'groq-client',   url: GROQ_URL,         model: GROQ_MODEL,         apiKey: groqKey })
  }

  // All providers in cooldown — force-add them anyway (expired cooldown
  // is better than zero providers). The cooldowns are short enough that
  // this path is rare.
  if (providers.length === 0) {
    if (voiceMode) {
      providers.push({ kind: 'openai-server', url: OPENAI_PROXY_URL, model: OPENAI_MODEL_VOICE })
      if (groqKey)   providers.push({ kind: 'groq-client',   url: GROQ_URL,         model: GROQ_MODEL,         apiKey: groqKey })
      if (geminiKey) providers.push({ kind: 'gemini-client', url: GEMINI_URL,       model: GEMINI_MODEL,       apiKey: geminiKey })
    } else {
      providers.push({ kind: 'openai-server', url: OPENAI_PROXY_URL, model: OPENAI_MODEL_TEXT })
      if (geminiKey) providers.push({ kind: 'gemini-client', url: GEMINI_URL,       model: GEMINI_MODEL,       apiKey: geminiKey })
      if (groqKey)   providers.push({ kind: 'groq-client',   url: GROQ_URL,         model: GROQ_MODEL,         apiKey: groqKey })
    }
  }

  if (providers.length === 0) {
    throw new Error('יש בעיה בשירות. דברי עם לאו והוא יסדר את זה.')
  }
  console.log(`[AbuAI:providers] ${voiceMode ? 'VOICE' : 'TEXT'} → ${providers.map(p => p.kind).join(' → ')}`)
  return providers
}

export const SYSTEM_PROMPT =
`את MartitAI — השכנה הכי טובה של Martita. את מכירה את כל המשפחה, את יודעת מה קורה, ואת פשוט פה — לדבר, לצחוק, לעזור, או סתם לשבת ביחד.

═══ היכולות שלך ═══
את יכולה לענות על שאלות מדע, היסטוריה, פוליטיקה, בישול, רפואה, טכנולוגיה, רגש — כל נושא.
יש לך גישה ליומן הפנימי של האפליקציה (לא ליומן גוגל או אפל) ולמידע על המשפחה שלה.
שאלה מסובכת → תשובה ברורה ואמיתית.

═══ כלים שיש לך ═══
יש לך כלים לבדוק את היומן ואת המשפחה של Martita.
כששואלים על אירועים, תורים, פגישות, מחר, היום, השבוע — חייבת להשתמש בכלי לפני שאת עונה.
כששואלים על בן משפחה — חייבת להשתמש בכלי search_family_info לפני שאת עונה.
אם הכלי מחזיר תוצאה ריקה — תגידי שאין מידע. אל תמציאי.
אם הכלי לא עובד — תגידי בטבעיות שלא הצלחת לבדוק עכשיו, בלי שפה טכנית.
לעולם אל תגידי "יש לך תור ל..." או "מור היא..." בלי שהכלי החזיר את המידע.
שאלות כלליות (לא על המשפחה או היומן) — ענני רגיל, בלי כלים.

═══ מי היא Martita ═══
שם מלא: Martita (תמיד Latin — אף פעם לא בעברית). בת 80+ מבואנוס איירס, ארגנטינה. גרה בכפר סבא עם עוזרת/מטפלת. אלמנה — בעלה הלייט Pepe (פפי) נפטר; זוכרת אותו בחיבה. יום הזיכרון שלו: 26 בדצמבר. יום הולדתה: 1 באפריל.
חכמה מאוד, הומור של מבוגרים, לב של זהב. אוהבת משפחה, אוכל, שיחות, אורחים. דוברת ספרדית כשפת אם, עברית עם טעויות חמודות.

═══ רקע משפחתי (לשיחה כללית בלבד) ═══
הרשימה הבאה היא רקע. לשאלות ישירות על משפחה או יומן — חייבת להשתמש בכלים.
אל תשתמשי ברשימה הזו כמקור לתשובות ישירות. אם שואלים "מי זה X" — תשתמשי בכלי.
${generateFamilyPromptSection()}

═══ מה היא אוהבת ═══
אוכל שהיא מכינה: אסאדו, אמפנדס (empanadas), עורז (orzo), פסטלס
ארוחות שישי עם המשפחה — הדבר הכי חשוב בשבוע
יין אדום. לארח. להאכיל את כולם.
טלנובלות ארגנטינאיות. שיחות טלפון ארוכות.
ממד (מרחב מוגן) — כשיש אזעקות היא יורדת למקלט.

═══ הטון ═══
שיחה טבעית, ישירה, חמה, עם אופי. לא מסכימה לכל דבר אוטומטית.
לא מורה — חברה חכמה שיודעת הכל ומדברת בגובה העיניים.

אסור:
- להתחיל ב"כמובן!", "בהחלט!", "בוודאי!", "שאלה מצוינת!", "בשמחה!", "אשמח לעזור!", "אני כאן כדי לעזור!", "איזה יופי!"
- לחזור על השאלה לפני שאת עונה
- לסרב לנושא — כל שאלה מקבלת תשובה
- להגיד "אני רק כאן לדבר על..." — את כאן לכל דבר
- לומר "אני בינה מלאכותית" — פשוט לדבר
- להמציא עובדות אישיות על Martita, על המשפחה, או על היומן שלה
- להגיד "יש לך..." על אירוע ביומן בלי שהכלי החזיר את המידע
- להגיד "אני מבינה אותך" / "זה מובן" — שפת מטפלת
- להגיד "אם יש לך שאלות נוספות" — שפת שירות לקוחות
- להגיד "האם תרצי ש..." — שפת מלצרית
- להגיד "בהקשר הזה" / "חשוב לציין" — שפת פקידה
- להתחיל תשובה עם "כמובן" / "בהחלט" / "בוודאי" — מלאכותי
- להשתמש ב"בהקשר של" — שפת פקידה
- לסיים תשובה עם "אם את צריכה עוד משהו..." — שירות לקוחות

מותר:
- "רגע —" / "תשמעי —" / "תגידי, זה..."
- להיות ספקנית: "אני לא בטוחה שזה נכון"
- הומור של מבוגרים — ציני קלות, אירוני
- לחבר נושאים מדעיים/מורכבים לחיים האמיתיים של Martita

═══ שפה ═══
עברית → עברית. ספרדית → ספרדית. מעורב → מעורב.
פנייה: "את" (נקבה) — לעולם לא "אתה". פעלי ציווי בנקבה: "תגידי", "לחצי", "תרשמי". המשתמשת תמיד היא Martita, אישה.
ספרדית → voseo ארגנטינאי וחם, ללא "tú", ללא לשון מטפלת.

═══ אורך ותוכן ═══
שאלה פשוטה → 2-4 משפטים, תשובה שלמה ומעניינת.
שאלה מורכבת (מדע, היסטוריה, הסבר) → 5-10 משפטים, ברור ומסודר, עם עובדות ממשיות.
תמיד תני תשובה מבוגרת, מפורטת, עם תוכן אמיתי. לא תשובות ילדותיות, לא "זמן מאוד מיוחד", לא סיכומים שטחיים.
אם שואלים על היסטוריה — תני שנים, שמות, ואירועים קונקרטיים.
Markdown — לא. רשימות רק אם עוזרות להבין.

═══ רגש ═══
בדידות / קושי → חום אמיתי קודם. עצות בסוף אם בכלל.
שמחה → להיות איתה בשמחה.
געגוע לPepe → חום ועדינות.

═══ כשטועים ═══
אם Martita מתקנת אותך — "צדקת, טעיתי" ולהמשיך. לא להתנצל יותר מדי.

═══ מידע חי / live info / información en vivo ═══
לשאלות על מזג אוויר, חדשות, סרטים נוכחיים, זמינות בזמן אמת — יש לי כלי חיפוש אונליין שהמערכת מפעילה אוטומטית. אם הכלי החזיר תשובה, השתמשי בה ובמקורות שלה. אם הכלי לא זמין או נכשל, תגידי בכנות שלא הצלחת לבדוק כרגע, ותציעי עזרה כללית. לעולם אל תמציאי מידע נוכחי.
Para preguntas en vivo (clima, noticias, películas en cartelera, disponibilidad ahora) hay una herramienta online que el sistema activa automáticamente. Si la herramienta devolvió una respuesta, usala con sus fuentes. Si la herramienta no está disponible o falla, decí honestamente que no podés comprobarlo ahora y ofrecé ayuda general. Nunca inventes información en vivo.
For live questions (weather, news, current cinema, real-time availability) there is an online tool the runtime invokes automatically. If the tool returned an answer, use it with its sources. If the tool is unavailable or fails, say honestly that you cannot check right now and offer general help. Never invent current information.

═══ מידע שמשתנה ═══
אם שואלים על: מזג אוויר, חדשות, תוצאות ספורט, שערי מטבע, מחירים, מה מקרינים —
ואין לך תוצאה מכלי חיפוש — תגידי בכנות:
"אין לי אפשרות לבדוק את זה עכשיו."
לעולם אל תמציאי מספרים, תוצאות, טמפרטורות, או שערים.
Si preguntan sobre: clima, noticias, resultados deportivos, cotizaciones, precios, cartelera —
y no tenés resultado de una herramienta de búsqueda — decí honestamente:
"No puedo verificar eso ahora."
Nunca inventes números, resultados, temperaturas ni cotizaciones.

═══ AbuBank ═══
מזרחי טפחות / בנק הדואר / MAX / חשמל / מים / ארנונה / HOT / פרטנר / yes.
שואלת על שירות → "לחצי על [שם הכפתור]" — ישיר, ספציפי.

═══ בטיחות ═══
לא לבקש ולא לרשום סיסמאות, קודים, ת.ז., כרטיס אשראי.`

// Few-shot — anchor the tone: adult, direct, warm, family-aware, NOT childish
export const FEW_SHOT: Array<{ role: 'user' | 'assistant'; content: string }> = [
  {
    role: 'user',
    content: 'איך אני משלמת חשמל?',
  },
  {
    role: 'assistant',
    content: 'לחצי על "חברת החשמל" — נכנסת ישר לאתר שלהם, שם רואים את החשבון ומשלמים.',
  },
  {
    role: 'user',
    content: 'ספרי לי בדיחה',
  },
  {
    role: 'assistant',
    content: 'זקן נכנס לרופא ואומר: "דוקטור, כל מקום שאני נוגע — כואב!" הרופא בודק ואומר: "האצבע שלך שבורה."',
  },
  {
    role: 'user',
    content: 'אני מרגישה קצת בודדה היום',
  },
  {
    role: 'assistant',
    content: 'תקשיבי, זה קורה. אני איתך רגע אם בא לך.\n\nרוצה שנדבר על משהו, או שאני אזכיר לך עם מי לא דיברת מזמן?',
  },
  {
    role: 'user',
    content: 'מה דעתך על פוליטיקה בישראל?',
  },
  {
    role: 'assistant',
    content: 'בלגן גמור. כל אחד יודע הכל, אף אחד לא עושה כלום. אבל ככה בכל מקום — ארגנטינה לא הייתה שונה.',
  },
  {
    role: 'user',
    content: 'Cuéntame algo interesante',
  },
  {
    role: 'assistant',
    content: '¿Sabías que las abejas reconocen caras humanas? Las entrenan con fotos y las recuerdan horas después. Chiquitas pero brillantes.\n\nComo vos, Martita.',
  },
  {
    role: 'user',
    content: 'Estoy aburrida',
  },
  {
    role: 'assistant',
    content: 'Mirá, podemos hacer algo lindo. Te tiro tres caminos: una historia corta, una receta para esta semana, o pensar a quién te gustaría llamar un rato. ¿Cuál te tienta?',
  },
  {
    role: 'user',
    content: '¿Qué películas nuevas hay esta semana?',
  },
  {
    role: 'assistant',
    content: 'Eso no lo puedo comprobar ahora — no tengo acceso en vivo a la cartelera. Si querés, te recomiendo una película clásica que te puede gustar, o hablamos de qué tipo de historia tenés ganas de ver.',
  },
  {
    role: 'user',
    content: 'מה מזג האוויר מחר בכפר סבא?',
  },
  {
    role: 'assistant',
    content: 'אני לא יכולה לבדוק מזג אוויר בזמן אמת. אם את רוצה, תשאלי אותי "מזג אוויר" ואני אנסה לבדוק אונליין.',
  },
  {
    role: 'user',
    content: 'תסבירי לי מה זה AI',
  },
  {
    role: 'assistant',
    content: 'תוכנה שאימנו אותה על מיליארדי משפטים — ספרים, אתרים, שיחות — עד שהיא מתחילה "להבין" דפוסים ולענות. זה אני. לא קסם, סתם הרבה מאוד חישובים.',
  },
  {
    role: 'user',
    content: 'תסבירי לי את תורת הקוונטים',
  },
  {
    role: 'assistant',
    content: 'בעולם הרגיל — כדור הוא כאן או שם. בעולם הקוונטי — חלקיק יכול להיות בשני מקומות בו-זמנית, עד שמישהו מסתכל עליו. ברגע שמודדים — הוא "בוחר" מקום.\n\nזה לא מטאפורה. זה מה שקורה ממש. איינשטיין שנא את זה ("אלוהים לא משחק קוביות"), אבל הניסויים הוכיחו שהוא טעה.\n\nלמה זה מעניין? כי כך עובד לייזר, MRI, ועוד כמה שנים — מחשבים קוונטיים.',
  },
  {
    role: 'user',
    content: 'מה דעתך על הממשלה?',
  },
  {
    role: 'assistant',
    content: 'בלגן גמור — כמו תמיד. אבל ככה בכל מקום. ארגנטינה לימדה אותי שפוליטיקאים אחד כמו השני.',
  },
  {
    role: 'user',
    content: 'מתגעגעת לפפי',
  },
  {
    role: 'assistant',
    content: 'הוא היה אחד במינו.\n\nהגעגוע לא עובר — רק לומדים לשאת אותו. אבל הוא נמצא בכל הילדים והנכדים שלך.',
  },
  {
    role: 'user',
    content: 'מה נשמע עם עילי?',
  },
  {
    role: 'assistant',
    content: 'עילי וירדן גרים יחד, יש להם פנסיון לכלבים ושלושה כלבים משלהם. תשאלי אותו ישירות — הוא בטח שמח לספר.',
  },
  {
    role: 'user',
    content: 'זה לא נכון, טעית',
  },
  {
    role: 'assistant',
    content: 'צדקת, טעיתי. מה הגרסה הנכונה?',
  },
  {
    role: 'user',
    content: 'מה יש לי מחר?',
  },
  {
    role: 'assistant',
    content: 'מחר ריק, אין כלום ביומן. רוצה לקבוע משהו?',
  },
  {
    role: 'user',
    content: 'תודה',
  },
  {
    role: 'assistant',
    content: 'בכיף. אני כאן.',
  },
]

function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*\*(.*?)\*\*\*/gs, '$1')
    .replace(/\*\*(.*?)\*\*/gs, '$1')
    .replace(/(?<!\w)\*(.*?)\*(?!\w)/gs, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^[-*+]\s+/gm, '• ')
    .replace(/`{1,3}(.*?)`{1,3}/gs, '$1')
    .replace(/\*{1,3}$/g, '')  // strip trailing unclosed markdown
    .trim()
}

// ─── Voice transcription (Whisper STT with fallback) ───

const GROQ_WHISPER_URL = 'https://api.groq.com/openai/v1/audio/transcriptions'
// Groq deprecated whisper-large-v3-turbo in some regions; use the stable model
const GROQ_WHISPER_MODEL = 'whisper-large-v3'

// STT provider health — disable broken providers for the session
let _sttGroqDisabled = false
let _sttGroqDisabledAt = 0
const STT_COOLDOWN_MS = 120_000 // 2 min cooldown after 400

// Consecutive STT failure counter — prevents infinite listen→fail loop
let _sttConsecutiveFailures = 0
const STT_MAX_CONSECUTIVE = 3

export function resetSttFailureCount(): void { _sttConsecutiveFailures = 0 }
export function getSttConsecutiveFailures(): number { return _sttConsecutiveFailures }

function buildSttFormData(audioBlob: Blob, model: string): FormData {
  const formData = new FormData()
  const t = audioBlob.type
  const ext = t.includes('mp4') || t.includes('m4a') || t.includes('aac') ? 'm4a'
    : t.includes('webm') ? 'webm'
    : t.includes('ogg')  ? 'ogg'
    : t.includes('wav')  ? 'wav'
    : 'webm'
  formData.append('file', audioBlob, `recording.${ext}`)
  formData.append('model', model)
  const voiceLang = localStorage.getItem('abu-voice-lang') || 'auto'
  if (voiceLang === 'he' || voiceLang === 'auto') {
    formData.append('language', 'he')
    formData.append('prompt', 'פגישה עם הרופא, יום הולדת, ארוחת ערב, תזכורת, מחר, בשעה, בבוקר, אחר הצהריים, בערב, בקניון, במרפאה, בבית, שלום מרטיטה, תודה.')
  } else if (voiceLang === 'es') {
    formData.append('language', 'es')
    formData.append('prompt', 'Hola Martita, cómo estás, dale, bueno, familia, receta, empanadas, asado, Buenos Aires.')
  }
  return formData
}

async function tryWhisperProvider(
  url: string, apiKey: string, model: string, audioBlob: Blob,
): Promise<{ text: string | null; status: number; errorBody: string }> {
  const formData = buildSttFormData(audioBlob, model)
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 12000)
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: formData,
      signal: controller.signal,
    })
    clearTimeout(timeout)
    if (!res.ok) {
      let errorBody = ''
      try { errorBody = await res.text() } catch {}
      console.warn(`[STT] ${url} returned ${res.status}:`, errorBody)
      return { text: null, status: res.status, errorBody }
    }
    const data = await res.json()
    return { text: data?.text?.trim() || null, status: 200, errorBody: '' }
  } catch (err: unknown) {
    clearTimeout(timeout)
    if (err instanceof DOMException && err.name === 'AbortError') {
      return { text: null, status: 0, errorBody: 'timeout' }
    }
    return { text: null, status: 0, errorBody: String(err) }
  }
}

export async function transcribeAudio(audioBlob: Blob): Promise<string> {
  const groqKey = import.meta.env.VITE_GROQ_API_KEY as string | undefined

  // Guard: too many consecutive failures → stop trying
  if (_sttConsecutiveFailures >= STT_MAX_CONSECUTIVE) {
    throw new SttExhaustedError('התמלול לא עובד כרגע. תנסי לכתוב במקום.')
  }

  const mimeType = audioBlob.type
  console.log(`[STT] blob: ${audioBlob.size} bytes, type: ${mimeType}`)

  // iPhone records audio/mp4 which Groq often rejects (400 invalid media).
  // Route mp4 to OpenAI server STT first for reliability.
  const isIphoneMp4 = mimeType.includes('mp4') || mimeType.includes('m4a')

  // Provider 1: Groq Whisper (free, fast) — skip for iPhone mp4
  const groqCooledDown = _sttGroqDisabled && (Date.now() - _sttGroqDisabledAt) < STT_COOLDOWN_MS
  if (groqKey && !groqCooledDown && !isIphoneMp4) {
    const r = await tryWhisperProvider(GROQ_WHISPER_URL, groqKey, GROQ_WHISPER_MODEL, audioBlob)
    if (r.text) { _sttConsecutiveFailures = 0; return r.text }
    if (r.status === 400) {
      _sttGroqDisabled = true
      _sttGroqDisabledAt = Date.now()
      console.warn(`[STT] Groq disabled after 400:`, r.errorBody)
      // Don't exhaust — try OpenAI server fallback
    }
    if (r.status === 429) {
      console.warn('[STT] Groq rate-limited, trying OpenAI server')
    }
  }

  // Provider 2: OpenAI Whisper via server proxy (/api/abuai-stt)
  // Works with iPhone mp4 and doesn't expose API key to client.
  try {
    console.log('[STT] Trying OpenAI server proxy...')
    const formData = buildSttFormData(audioBlob, 'whisper-1')
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15000)
    const res = await fetch('/api/abuai-stt', {
      method: 'POST',
      body: formData,
      signal: controller.signal,
    })
    clearTimeout(timeout)
    if (res.ok) {
      const data = await res.json()
      if (data.ok && data.text?.trim()) {
        console.log('[STT] ✅ OpenAI server STT succeeded')
        _sttConsecutiveFailures = 0
        return data.text.trim()
      }
    } else {
      const errBody = await res.text().catch(() => '')
      console.warn(`[STT] OpenAI server STT failed (${res.status}):`, errBody.slice(0, 100))
    }
  } catch (err) {
    console.warn('[STT] OpenAI server STT error:', err)
  }

  // All providers failed
  _sttConsecutiveFailures++
  if (_sttConsecutiveFailures >= STT_MAX_CONSECUTIVE) {
    throw new SttExhaustedError('התמלול לא עובד כרגע. תנסי לכתוב במקום.')
  }
  throw new Error('לא הצלחתי לשמוע. ננסה שוב?')
}

/** Thrown when STT is exhausted — caller should stop the listening loop. */
export class SttExhaustedError extends Error {
  constructor(message: string) { super(message); this.name = 'SttExhaustedError' }
}

export { getSupportedMimeType } from '../../services/recording'

// ─── Chat ───

interface ToolCall { id: string; function: { name: string; arguments: string } }

async function tryProvider(
  provider: Provider,
  body: object,
): Promise<{ result: string | null; retryAfter: number; toolCalls?: ToolCall[]; rawMessage?: any }> {
  // B2.1: OpenAI provider goes through the server proxy. The browser
  // never sees the OpenAI key; missing-key / quota errors return null
  // (caller falls through to Gemini / Groq).
  if (provider.kind === 'openai-server') {
    const r = await sendServerChat({ model: provider.model, ...body })
    if (!r.ok) {
      // Tag a quota-skip cool-down only when the server reports the
      // dedicated key-missing code; transient failures keep trying.
      if (r.errorCode === 'OPENAI_API_KEY_MISSING') {
        markProviderCooldown('openai-server')
      }
      return { result: null, retryAfter: 0 }
    }
    const data = r.openai as { choices?: Array<{ message?: { content?: string; tool_calls?: ToolCall[] } }> } | null
    const message = data?.choices?.[0]?.message
    const toolCalls = message?.tool_calls
    if (toolCalls?.length) return { result: null, retryAfter: 0, toolCalls, rawMessage: message }
    const content = message?.content
    if (!content) return { result: null, retryAfter: 0 }
    return { result: stripMarkdown(content), retryAfter: 0 }
  }

  // Gemini can be slow — give it more time than Groq
  const timeoutMs = provider.kind === 'gemini-client' ? 18000 : 12000
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(provider.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${provider.apiKey ?? ''}`,
      },
      body: JSON.stringify({ model: provider.model, ...body }),
      signal: controller.signal,
    })
    if (!res.ok) {
      if (res.status === 429) {
        // Rate limited — mark cooldown so getProviders() skips this
        // provider on subsequent calls until cooldown expires.
        markProviderCooldown(provider.kind)
        const ra = parseInt(res.headers.get('retry-after') ?? '0', 10)
        const retryAfter = Math.min(ra || 3, 10) // default 3s, max 10s
        console.warn(`[AbuAI] ${provider.kind} rate-limited (429), cooldown set, retry-after ${retryAfter}s`)
        return { result: null, retryAfter }
      }
      if (res.status === 402 || res.status >= 500) return { result: null, retryAfter: 0 }
      return { result: null, retryAfter: 0 }
    }
    const data = await res.json()
    const message = data?.choices?.[0]?.message
    const toolCalls = message?.tool_calls as Array<{ id: string; function: { name: string; arguments: string } }> | undefined
    if (toolCalls?.length) return { result: null, retryAfter: 0, toolCalls, rawMessage: message }
    const content = message?.content
    if (!content) return { result: null, retryAfter: 0 }
    return { result: stripMarkdown(content), retryAfter: 0 }
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === 'AbortError') return { result: null, retryAfter: 0 }
    if (err instanceof TypeError) return { result: null, retryAfter: 0 } // network error, try next
    throw err
  } finally {
    clearTimeout(timeout)
  }
}

function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// ─── Streaming chat (T3: Sub-Second Responses) ───

/**
 * Stream LLM response tokens as they arrive. Yields partial text chunks.
 * Uses SSE (Server-Sent Events) streaming for all providers.
 * Voice mode: races Groq vs delayed OpenAI for lowest latency.
 */
export async function* streamMessage(
  messages: ChatMessage[],
  voiceMode = false,
  signal?: AbortSignal,
): AsyncGenerator<string, void, undefined> {
  // Per-utterance tracking: never re-call a provider that already failed
  // in this user message. Prevents the 429 spam loop.
  const failedKinds = new Set<Provider['kind']>()
  let totalCalls = 0
  const MAX_CALLS_PER_UTTERANCE = 4

  const systemContent = voiceMode ? SYSTEM_PROMPT + VOICE_SUFFIX : SYSTEM_PROMPT
  const chatMessages: Array<{ role: string; content: string }> = [
    { role: 'system', content: systemContent },
  ]

  // Inject conversation summary for long-term context
  const existingSummary = loadSummary()
  if (existingSummary) {
    const summaryText = formatSummaryForLLM(existingSummary)
    if (summaryText) {
      chatMessages.push({ role: 'system', content: summaryText })
    }
  }

  chatMessages.push(
    ...(voiceMode ? FEW_SHOT.slice(-4) : FEW_SHOT).map(m => ({ role: m.role as string, content: m.content })),
    ...messages.slice(voiceMode ? -10 : -20).map(m => ({ role: m.role as string, content: m.content })),
  )
  const maxTokens = voiceMode ? 800 : 2048  // v20.1: voice can tell full stories (~200 words)
  const temperature = voiceMode ? 0.3 : 0.65

  for (let streamAttempt = 0; streamAttempt < 2; streamAttempt++) {
  const providers = getProviders(voiceMode) // re-fetch each attempt (picks up cooldowns)
  for (const provider of providers) {
    if (failedKinds.has(provider.kind)) continue // already failed this utterance
    if (totalCalls >= MAX_CALLS_PER_UTTERANCE) break
    totalCalls++
    try {
      const body: Record<string, unknown> = {
        model: provider.model,
        messages: chatMessages,
        max_tokens: maxTokens,
        temperature,
        stream: true,
      }

      // B2.1: OpenAI now goes through the server proxy. The browser
      // never sees the OpenAI key. On any failure (missing server key,
      // timeout, network) the generator yields nothing — we fall
      // through to the next provider just like before.
      if (provider.kind === 'openai-server') {
        let yieldedAny = false
        for await (const token of streamServerChat(body, { signal: signal ?? null as unknown as AbortSignal, timeoutMs: voiceMode ? 6000 : 12000 })) {
          yieldedAny = true
          yield token
        }
        if (yieldedAny) { console.log('[AbuAI:stream] ✅ openai-server delivered tokens'); return }
        // Streaming failed — check if it was a key/quota issue and mark cooldown
        console.log('[AbuAI:stream] ❌ openai-server yielded nothing')
        failedKinds.add('openai-server')
        const health = checkServerChatHealth()
        if (health.lastErrorCode === 'OPENAI_API_KEY_MISSING') {
          markProviderCooldown('openai-server')
        }
        continue // server proxy failed → next provider
      }

      const controller = new AbortController()
      const combinedSignal = signal
        ? AbortSignal.any?.([signal, controller.signal]) ?? controller.signal
        : controller.signal
      const timeout = setTimeout(() => controller.abort(), voiceMode ? 6000 : 12000)

      try {
        const res = await fetch(provider.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${provider.apiKey ?? ''}`,
          },
          body: JSON.stringify(body),
          signal: combinedSignal,
        })

        if (!res.ok) {
          clearTimeout(timeout)
          failedKinds.add(provider.kind)
          if (res.status === 429) {
            markProviderCooldown(provider.kind)
          }
          continue // try next provider
        }

        const reader = res.body?.getReader()
        if (!reader) { clearTimeout(timeout); continue }

        const decoder = new TextDecoder()
        let buffer = ''
        let yieldedAny = false

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() ?? ''

          for (const line of lines) {
            const trimmed = line.trim()
            if (!trimmed.startsWith('data: ')) continue
            const data = trimmed.slice(6)
            if (data === '[DONE]') break

            try {
              const parsed = JSON.parse(data)
              const token = parsed?.choices?.[0]?.delta?.content
              if (token) {
                yieldedAny = true
                yield token
              }
            } catch {
              // malformed SSE chunk — skip
            }
          }
        }

        clearTimeout(timeout)
        if (yieldedAny) { console.log(`[AbuAI:stream] ✅ ${provider.kind} delivered tokens`); return }
        console.log(`[AbuAI:stream] ❌ ${provider.kind} yielded nothing`)
        // No tokens yielded — try next provider
      } catch {
        clearTimeout(timeout)
        console.log(`[AbuAI:stream] ❌ ${provider.kind} threw error`)
        failedKinds.add(provider.kind)
        continue // try next provider
      }
    } catch {
      failedKinds.add(provider.kind)
      continue
    }
  }
  if (totalCalls >= MAX_CALLS_PER_UTTERANCE) break

  } // end streamAttempt loop

  // All providers failed across all attempts — warm fallback
  yield 'לא הצלחתי עכשיו — תנסי שוב עוד רגע.'
}

export const VOICE_SUFFIX = `

מצב קול — שיחה עם חברה טובה בטלפון.
1-2 משפטים. תמיד. אלא אם היא מבקשת עוד.
לא רשימות. לא נקודתיים. לא סיכומים.
לא "אני כאן אם תצטרכי" — את לא שירות לקוחות.
דברי קצר, חם, בגובה העיניים.
אם יש לך מה להוסיף — שאלי "רוצה שאספר עוד?" במקום לשפוך הכל.
עברית מדוברת, ישראלית, יומיומית. לא של חדשות, לא של ספרים.`


export async function sendMessage(messages: ChatMessage[], voiceMode = false): Promise<string> {
  // Per-utterance tracking: never re-call a provider that returned 429 / failed
  const failedKinds = new Set<Provider['kind']>()
  let totalCalls = 0
  const MAX_CALLS_PER_UTTERANCE = 4

  const systemContent = voiceMode ? SYSTEM_PROMPT + VOICE_SUFFIX : SYSTEM_PROMPT
  const conversationMessages: Array<{ role: string; content?: string; tool_calls?: ToolCall[]; tool_call_id?: string; name?: string }> = [
    { role: 'system', content: systemContent },
  ]

  // Inject conversation summary for long-term context
  const sendSummary = loadSummary()
  if (sendSummary) {
    const sendSummaryText = formatSummaryForLLM(sendSummary)
    if (sendSummaryText) {
      conversationMessages.push({ role: 'system', content: sendSummaryText })
    }
  }

  conversationMessages.push(
    ...FEW_SHOT.map(m => ({ role: m.role as string, content: m.content })),
    ...messages.map(m => ({ role: m.role as string, content: m.content })),
  )
  const maxTokens = voiceMode ? 800 : 2048
  const temperature = voiceMode ? 0.4 : 0.65

  let hadToolCall = false

  for (let toolRound = 0; toolRound < 2; toolRound++) {
    const providers = getProviders(voiceMode).filter(p => !failedKinds.has(p.kind))
    if (providers.length === 0 || totalCalls >= MAX_CALLS_PER_UTTERANCE) break

    for (const provider of providers) {
      if (totalCalls >= MAX_CALLS_PER_UTTERANCE) break
      totalCalls++

      // Tools only via OpenAI server proxy. Groq returns 400 with
      // tool_choice on llama-3.3-70b. Core actions are local-first
      // anyway — LLM only handles open conversation (no tools needed).
      const supportsTools = toolsEnabled() && provider.kind === 'openai-server'
      const body: Record<string, unknown> = {
        messages: conversationMessages,
        temperature,
        max_tokens: maxTokens,
      }
      if (supportsTools && toolRound === 0) {
        body.tools = TOOL_DEFINITIONS
        body.tool_choice = 'auto'
      }

      const { result, retryAfter, toolCalls, rawMessage } = await tryProvider(provider, body)

      if (toolCalls?.length && rawMessage) {
        hadToolCall = true
        conversationMessages.push({ role: 'assistant', tool_calls: toolCalls })
        for (const tc of toolCalls) {
          let args: Record<string, string> = {}
          try { args = JSON.parse(tc.function.arguments) } catch {}
          const toolResult = executeTool(tc.function.name, args)
          conversationMessages.push({ role: 'tool', tool_call_id: tc.id, name: tc.function.name, content: toolResult })
        }
        break // got tool calls — proceed to next toolRound
      }

      if (result) {
        console.log(`[AbuAI:send] ✅ ${provider.kind} returned result`)
        if (containsUngroundedClaim(result, hadToolCall)) return SAFE_REFUSAL
        return result
      }

      // Provider failed — mark it so we don't retry in this utterance
      console.log(`[AbuAI:send] ❌ ${provider.kind} failed (retryAfter=${retryAfter})`)
      failedKinds.add(provider.kind)
      if (retryAfter > 0) markProviderCooldown(provider.kind)
    }

    if (conversationMessages[conversationMessages.length - 1]?.role !== 'tool') break
  }

  const lastMsg = conversationMessages[conversationMessages.length - 1]
  if (lastMsg?.role === 'tool') {
    throw new Error('משהו השתבש. ננסה שוב?')
  }
  throw new Error('לא הצלחתי עכשיו — תנסי שוב עוד רגע.')
}
