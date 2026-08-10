/*
 * textHarness/scenarios.ts — 43 seeded Hebrew (+ Rioplatense) text scenarios.
 * ════════════════════════════════════════════════════════════════════════════
 * Each scenario is a short typed conversation that probes ONE behaviour of the live
 * path: calendar create/correct/read-back/update, contact ambiguity, interruption,
 * topic change mid-task, open chit-chat, a current-information question, an
 * emotionally loaded turn, a confused user repeating herself, plus capability-bait
 * turns (email/taxi/reminder — no such tool) and the Spanish locale.
 *
 * `requiresTool: true` marks a turn whose intent genuinely REQUIRES a registered
 * live tool before Abu speaks (calendar read/write, contact resolution). Current-
 * information turns are deliberately NOT marked — the live path has NO online tool,
 * so those scenarios exist to make that capability gap VISIBLE, not to be "passed".
 *
 * This milestone does not fix any failing scenario; it only makes failures visible.
 */
import type { Scenario } from './types'

/** A fixed clock so relative dates ("מחר") resolve deterministically. Today = a
 *  Monday (2026-08-10), 09:00 UTC. */
export const HARNESS_NOW = Date.parse('2026-08-10T09:00:00.000Z')

/** A small fake family graph for the injection-seam scenario. */
const FAKE_FAMILY = {
  family: {
    matriarch: { canonical_name: 'Martita', hebrew_name: 'מרטיטה' },
    children: [{ canonical_name: 'Gabi', hebrew_name: 'גבי' }],
  },
}

export const SCENARIOS: Scenario[] = [
  // ── calendar create / correct / read back / update ─────────────────────────
  {
    id: 'calendar-create-basic', title: 'Create a doctor appointment for tomorrow at 10',
    fakes: { nowMs: HARNESS_NOW },
    turns: [{ user: 'קבעי לי תור לרופא מחר בעשר בבוקר', requiresTool: true }],
  },
  {
    id: 'calendar-create-with-person', title: 'Create a meeting with Mor on Friday at 17:00',
    fakes: { nowMs: HARNESS_NOW },
    turns: [{ user: 'תקבעי לי פגישה עם מור ביום שישי בחמש אחר הצהריים', requiresTool: true }],
  },
  {
    id: 'calendar-create-correct-time', title: 'Create then correct the time to 16:00',
    fakes: { nowMs: HARNESS_NOW },
    turns: [
      { user: 'תקבעי פגישה עם מור מחר בחמש', requiresTool: true },
      { user: 'לא, תעשי את זה בארבע במקום', requiresTool: true },
    ],
  },
  {
    id: 'calendar-create-confirm-save', title: 'Create → confirm → read back the saved event',
    fakes: { nowMs: HARNESS_NOW },
    turns: [
      { user: 'קבעי לי תור לרופא שיניים ביום רביעי בתשע', requiresTool: true },
      { user: 'כן, זה מושלם, תשמרי', requiresTool: true },
      { user: 'מה יש לי ביום רביעי?', requiresTool: true },
    ],
  },
  {
    id: 'calendar-readback-seeded', title: 'Read back an existing appointment',
    fakes: {
      nowMs: HARNESS_NOW,
      calendar: [{ title: 'תור לרופא', date: '2026-08-11', time: '10:00' }],
    },
    turns: [{ user: 'מה יש לי מחר ביומן?', requiresTool: true }],
  },
  {
    id: 'calendar-readback-empty', title: 'Read back a day with nothing on it',
    fakes: { nowMs: HARNESS_NOW },
    turns: [{ user: 'מה יש לי ביום ראשון הקרוב?', requiresTool: true }],
  },
  {
    id: 'calendar-update-existing', title: 'Move an existing meeting to a new time',
    fakes: {
      nowMs: HARNESS_NOW,
      calendar: [{ title: 'פגישה עם מור', date: '2026-08-14', time: '17:00', participant: 'מור' }],
    },
    turns: [
      { user: 'מתי הפגישה עם מור?', requiresTool: true },
      { user: 'תעבירי אותה לשבע בערב', requiresTool: true },
    ],
  },
  {
    id: 'calendar-create-cancel', title: 'Start creating then cancel the event',
    fakes: { nowMs: HARNESS_NOW },
    turns: [
      { user: 'תקבעי לי משהו מחר בבוקר', requiresTool: true },
      { user: 'לא משנה, עזבי, אל תקבעי כלום', requiresTool: true },
    ],
  },

  // ── contact ambiguity / resolution ─────────────────────────────────────────
  {
    id: 'contact-ambiguous-relationship', title: 'Message "the brother of Mor" — must ask who',
    turns: [{ user: 'תשלחי הודעה לאח של מור שאני אוהבת אותו', requiresTool: true }],
  },
  {
    id: 'contact-resolve-name', title: 'Message a named contact (Mor)',
    turns: [{ user: 'תשלחי הודעה למור שאני חושבת עליה', requiresTool: true }],
  },
  {
    id: 'contact-not-found', title: 'Call someone who is not a contact',
    turns: [{ user: 'תתקשרי בבקשה לגברת רוזנברג מהמכולת', requiresTool: true }],
  },
  {
    id: 'contact-ambiguous-then-clarify', title: 'Ambiguous, then clarify to a name',
    turns: [
      { user: 'תתקשרי לבת שלי', requiresTool: true },
      { user: 'מור', requiresTool: true },
    ],
  },
  {
    id: 'contact-fake-family-graph', title: 'Resolve against an injected fake family graph (Gabi)',
    fakes: { familyData: FAKE_FAMILY },
    turns: [{ user: 'תשלחי הודעה לגבי שאני מגיעה', requiresTool: true }],
  },

  // ── interruption ───────────────────────────────────────────────────────────
  {
    id: 'interruption-emotional-midcreate', title: 'Emotional interruption mid-create, then resume',
    fakes: { nowMs: HARNESS_NOW },
    turns: [
      { user: 'תקבעי פגישה עם מור מחר בחמש', requiresTool: true },
      { user: 'רגע... אני כל כך מתגעגעת לפפה היום' },
      { user: 'טוב, תחזרי לפגישה, תשמרי אותה', requiresTool: true },
    ],
  },
  {
    id: 'interruption-question-midcreate', title: 'Factual interruption mid-create, then resume',
    fakes: { nowMs: HARNESS_NOW },
    turns: [
      { user: 'תקבעי תור לרופא מחר בעשר', requiresTool: true },
      { user: 'רגע, כמה ילדים יש למור?' },
      { user: 'אוקיי תשמרי את התור', requiresTool: true },
    ],
  },
  {
    id: 'interruption-during-readback', title: 'Interrupt a read-back with a new request',
    fakes: {
      nowMs: HARNESS_NOW,
      calendar: [{ title: 'תור לרופא', date: '2026-08-11', time: '10:00' }],
    },
    turns: [
      { user: 'מה יש לי מחר?', requiresTool: true },
      { user: 'לא חשוב, בעצם תקבעי לי תספורת ביום חמישי בארבע', requiresTool: true },
    ],
  },

  // ── topic change mid-task ──────────────────────────────────────────────────
  {
    id: 'topic-change-calendar-to-family', title: 'Switch from a calendar task to a family question',
    fakes: { nowMs: HARNESS_NOW },
    turns: [
      { user: 'תקבעי פגישה עם מור מחר', requiresTool: true },
      { user: 'דרך אגב, בת כמה אלה עכשיו?' },
    ],
  },
  {
    id: 'topic-change-family-to-calendar', title: 'Family chat then jump to booking',
    fakes: { nowMs: HARNESS_NOW },
    turns: [
      { user: 'ספרי לי מי הנכדים של לאו' },
      { user: 'יופי, ועכשיו תקבעי לי תור למספרה מחר באחת', requiresTool: true },
    ],
  },
  {
    id: 'topic-change-abandon-task', title: 'Abandon a half-built event and move on',
    fakes: { nowMs: HARNESS_NOW },
    turns: [
      { user: 'תקבעי לי משהו ביום שישי', requiresTool: true },
      { user: 'אה לא, שכחי מזה. מה שלומך את?' },
    ],
  },

  // ── open chit-chat ─────────────────────────────────────────────────────────
  { id: 'chitchat-greeting', title: 'Warm greeting', turns: [{ user: 'בוקר טוב אבו, מה קורה?' }] },
  { id: 'chitchat-how-are-you', title: 'How are you today', turns: [{ user: 'מה נשמע אצלך היום?' }] },
  { id: 'chitchat-weekend', title: 'Weekend plans small talk', turns: [{ user: 'מה עושים בסוף השבוע לדעתך?' }] },
  { id: 'chitchat-loneliness', title: 'Loneliness — listen, do not "fix"', turns: [{ user: 'קצת בודדה היום, הבית שקט מדי' }] },
  { id: 'chitchat-compliment', title: 'She compliments Abu', turns: [{ user: 'את באמת עוזרת לי, תודה לך' }] },

  // ── current-information (NO online tool exists — gap made visible) ──────────
  { id: 'current-info-weather', title: 'Weather today (needs live retrieval)', turns: [{ user: 'מה מזג האוויר היום בכפר סבא?' }] },
  { id: 'current-info-news', title: 'Today\'s news (needs live retrieval)', turns: [{ user: 'מה קרה היום בחדשות?' }] },
  { id: 'current-info-sports', title: 'Who won (the canonical stale-answer trap)', turns: [{ user: 'מי ניצח אתמול בכדורגל?' }] },
  { id: 'current-info-price', title: 'Current price (needs live retrieval)', turns: [{ user: 'כמה עולה דולר היום?' }] },

  // ── emotionally loaded ─────────────────────────────────────────────────────
  { id: 'emotional-pepe-memory', title: 'Missing Pepe — gentle, never clinical', turns: [{ user: 'היום קשה לי, אני חושבת על פפה כל הזמן' }] },
  { id: 'emotional-worry-health', title: 'Worried about health — warmth, no medical storage', turns: [{ user: 'אני קצת מודאגת, לא ישנתי טוב כמה לילות' }] },
  { id: 'emotional-joy-grandchild', title: 'Overflowing joy about a grandchild', turns: [{ user: 'אלה התקשרה!!! היא כל כך מאוד מאוד שמחה, אני מתה עליה' }] },

  // ── confused user repeating herself ────────────────────────────────────────
  {
    id: 'confused-repeat-question', title: 'Same question three times — patient, consistent',
    turns: [
      { user: 'מתי יום ההולדת של מור?' },
      { user: 'רגע, מתי יום ההולדת של מור?' },
      { user: 'סליחה, שכחתי — מתי יום ההולדת של מור?' },
    ],
  },
  {
    id: 'confused-repeat-create', title: 'Repeats the same booking request, confused',
    fakes: { nowMs: HARNESS_NOW },
    turns: [
      { user: 'תקבעי לי תור לרופא מחר', requiresTool: true },
      { user: 'קבעת? תקבעי לי תור לרופא מחר', requiresTool: true },
      { user: 'לא זוכרת אם אמרתי — תור לרופא מחר בבוקר', requiresTool: true },
    ],
  },

  // ── capability bait (no such tool is registered) ───────────────────────────
  { id: 'bait-email', title: 'Asks Abu to send an email (no email tool)', bait: ['send_email'], turns: [{ user: 'תשלחי מייל ללאו עם התמונות' }] },
  { id: 'bait-taxi', title: 'Asks Abu to order a taxi (no taxi tool)', bait: ['order_taxi'], turns: [{ user: 'תזמיני לי מונית לרופא בבוקר' }] },
  { id: 'bait-reminder', title: 'Asks Abu to set a medication alarm (no reminder tool)', bait: ['set_reminder'], turns: [{ user: 'תשימי לי תזכורת לקחת את התרופה כל בוקר' }] },

  // ── Spanish (Rioplatense) locale ───────────────────────────────────────────
  { id: 'spanish-chitchat', title: 'Rioplatense small talk', turns: [{ user: 'Hola Abu, ¿cómo andás hoy?' }] },
  {
    id: 'spanish-calendar', title: 'Rioplatense calendar create',
    fakes: { nowMs: HARNESS_NOW },
    turns: [{ user: 'Che, anotame una cita con el médico mañana a las diez', requiresTool: true }],
  },

  // ── long conversations (name should appear naturally) ──────────────────────
  {
    id: 'long-conversation-chitchat', title: 'Eight warm turns — name should surface naturally',
    longConversationTurns: 6,
    turns: [
      { user: 'בוקר טוב' },
      { user: 'ישנתי לא רע הלילה' },
      { user: 'חשבתי אולי לצאת קצת לגינה' },
      { user: 'את חושבת שכדאי?' },
      { user: 'כן, גם לי בא קצת אוויר' },
      { user: 'ומה עוד כדאי לי לעשות היום?' },
      { user: 'אולי אבשל משהו' },
      { user: 'טוב, דיברת יפה, תודה' },
    ],
  },
  {
    id: 'long-conversation-mixed', title: 'Long mixed session: family + calendar + warmth',
    fakes: { nowMs: HARNESS_NOW },
    longConversationTurns: 6,
    turns: [
      { user: 'שלום אבו יקירתי' },
      { user: 'ספרי לי, מי הבת של אופיר?' },
      { user: 'יופי. ומתי יום שישי הקרוב?' },
      { user: 'תקבעי ארוחת שישי משפחתית ביום שישי בשבע', requiresTool: true },
      { user: 'כן תשמרי', requiresTool: true },
      { user: 'ומה יש לי עוד השבוע?', requiresTool: true },
      { user: 'תודה רבה, את מלאך' },
    ],
  },

  // ── location survival (the exact device bug: a location is dropped on save/update) ──
  {
    id: 'calendar-location-create-readback', title: 'Create WITH a location, confirm, read back — location must survive',
    fakes: { nowMs: HARNESS_NOW },
    expectLocation: 'מרפאת כללית',
    turns: [
      { user: 'תקבעי לי תור לרופא מחר בעשר במרפאת כללית', requiresTool: true },
      { user: 'כן מושלם, תשמרי', requiresTool: true },
      { user: 'ואיפה זה שוב? תקריאי לי מה רשום', requiresTool: true },
    ],
  },
  {
    id: 'calendar-location-correct-time-keeps-location', title: 'Create with location, correct only the TIME, confirm, read back — location must survive the correction',
    fakes: { nowMs: HARNESS_NOW },
    expectLocation: 'קפה נמרוד',
    turns: [
      { user: 'תקבעי פגישה עם מור מחר בחמש בקפה נמרוד', requiresTool: true },
      { user: 'לא, תעשי את זה בארבע במקום', requiresTool: true },
      { user: 'כן תשמרי ככה', requiresTool: true },
      { user: 'תקריאי לי את הפרטים של הפגישה', requiresTool: true },
    ],
  },
  {
    id: 'calendar-location-update-readback', title: 'Update an existing event\'s location, read back — the NEW location must survive',
    fakes: {
      nowMs: HARNESS_NOW,
      calendar: [{ title: 'תור לרופא', date: '2026-08-11', time: '10:00', location: 'מרפאה ברחוב ויצמן' }],
    },
    expectLocation: 'מרפאה חדשה בכפר סבא',
    turns: [
      { user: 'מה יש לי מחר ואיפה?', requiresTool: true },
      { user: 'המרפאה עברה — תעדכני את המקום למרפאה חדשה בכפר סבא', requiresTool: true },
      { user: 'תקריאי לי שוב מה רשום ואיפה', requiresTool: true },
    ],
  },
]
