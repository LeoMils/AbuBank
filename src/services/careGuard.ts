/*
 * careGuard.ts — NO_HARM (queue #5). The single worst thing this product could do is
 * improvise a medical, medication, safety, or financial answer for an 81-year-old
 * woman living alone. This makes the safe answer STRUCTURAL: a deterministic
 * classifier + a FIXED response that always points her to a real person (family or
 * the emergency number), never advice. The live tool `care_concern` returns this
 * locked text — the model speaks it and is forbidden from adding any instruction.
 *
 * Conservative by design: it triggers only on genuine health-symptom / medication-
 * dose / physical-safety / money-movement intent — never on a price question
 * ("how much does perfume cost"), sadness (that is distress → warmth, not NO_HARM),
 * or a normal "call Leo".
 */
export type CareRisk = 'health' | 'medication' | 'safety' | 'money'

// ── Patterns (Hebrew + Rioplatense Spanish). Safety is checked first (most urgent). ──
const SAFETY = /נפלתי|לא מצליחה לקום|לא יכולה לקום|נחנקת|לא נושמת|קשה לי לנשום|שריפה|ריח גז|דלף גז|התמוטט|איבדתי הכרה|דימום חזק|חירום|הצילו|me ca[íi]|no puedo levantarme|no puedo respirar|incendio|olor a gas|emergencia|socorro/i
// medication: a dose/skip/change decision about a drug — NOT "what is this pill for" trivia
const MEDICATION = /(?:כמה|איזה מינון|מינון|לדלג|לפספס|כפול|פעמיים|להכפיל|להפסיק|להוסיף|לשנות).{0,20}(?:תרופה|כדור|כדורים|גלולה|אינסולין|זריקה|טיפ(?:ה|ות))|(?:תרופה|כדור|גלולה|אינסולין).{0,20}(?:כמה|מינון|לדלג|כפול|להפסיק)|שכחתי (?:לקחת )?(?:את )?(?:הכדור|התרופה)|cu[áa]nt[ao].{0,15}(?:pastilla|medicamento|insulina|dosis)|salt(?:ear|arme).{0,10}(?:pastilla|dosis)|doble dosis/i
// health symptom needing judgement — a body/symptom term + a help/worry cue
const HEALTH = /(?:כאב|כואב|כואבת|חום גבוה|סחרחור|סחרחורת|בחילה|הקאה|לחץ בחזה|כאב בחזה|קוצר נשימה|חבל[הו]|נפיחות|דופק|לחץ דם|סוכר).{0,30}(?:מה לעשות|מה כדאי|זה נורמלי|לדאוג|מסוכן|רגיל|\?|עכשיו|מהבוקר|כל היום)|(?:מה לעשות|לדאוג|מסוכן).{0,20}(?:כאב|חום|סחרחור|בחזה|נשימה)|dolor.{0,20}(?:pecho|cabeza|qu[eé] hago|normal)|me duele.{0,15}(?:pecho|mucho)|mareo|falta de aire/i
// money MOVEMENT / account / credentials — NOT a price question
const MONEY = /(?:תעביר|להעביר|מעביר|תשלח[יי]?|לשלם|תשלמ[יי]).{0,20}(?:כסף|שקל|שקלים|לחשבון|מהחשבון)|חשבון (?:בנק|העו"?ש)|כרטיס אשראי|מספר כרטיס|קוד סודי|סיסמ[הא]|העברה בנקאית|transfer(?:ir|[ií]).{0,15}(?:plata|dinero|pesos)|tarjeta de cr[ée]dito|cuenta bancaria|contrase[ñn]a/i

export interface CareResult { risk: CareRisk | null }

/** Deterministic NO_HARM classifier. Returns the highest-urgency matching risk, or null. */
export function classifyCareRisk(text: string): CareResult {
  const t = (text ?? '').trim()
  if (!t) return { risk: null }
  if (SAFETY.test(t)) return { risk: 'safety' }
  if (MEDICATION.test(t)) return { risk: 'medication' }
  if (HEALTH.test(t)) return { risk: 'health' }
  if (MONEY.test(t)) return { risk: 'money' }
  return { risk: null }
}

export type CareLang = 'he' | 'es'

/** The FIXED safe response. Points to a real person (Leo/Mor) and, for anything
 *  urgent/medical, the emergency number (101 = Magen David Adom, Israel). No advice,
 *  no dose, no financial action — ever. */
export function safeCareResponse(risk: CareRisk, lang: CareLang = 'he'): string {
  const HE: Record<CareRisk, string> = {
    safety: 'אני דואגת לך מאוד. תתקשרי עכשיו למד״א, מאה ואחת, ואם את יכולה גם ללאו או למור שיבואו אלייך מהר. אני נשארת איתך.',
    medication: 'אני לא יכולה להגיד לך כמה תרופה לקחת — מסוכן שאני אנחש בזה. תתקשרי לרופאה שלך או לבית המרקחת, או שלאו או מור יבדקו איתך יחד. אני כאן איתך.',
    health: 'אני לא רופאה ולא אתן עצה רפואית, אבל חשוב שתדברי עכשיו עם הרופאה שלך או עם לאו או מור. אם זה מרגיש דחוף או מפחיד, תתקשרי למד״א, מאה ואחת.',
    money: 'את הדברים של כסף וחשבון אני לא עושה — זה חשוב מדי בשביל שאני אעשה לבד. תבקשי מלאו או ממור שיעזרו לך עם זה יחד. אני כאן אם בא לך לדבר.',
  }
  const ES: Record<CareRisk, string> = {
    safety: 'Estoy muy preocupada por vos. Llamá ya a emergencias, y si podés también a Leo o a Mor para que vengan. Me quedo con vos.',
    medication: 'No puedo decirte cuánta medicación tomar, sería peligroso que adivine. Llamá a tu médica o a la farmacia, o que Leo o Mor lo vean con vos. Estoy con vos.',
    health: 'No soy médica y no te voy a dar un consejo médico, pero es importante que hables ya con tu médica o con Leo o Mor. Si se siente urgente, llamá a emergencias.',
    money: 'Las cosas de plata y de la cuenta no las hago yo, es demasiado importante para que lo haga sola. Pedile a Leo o a Mor que te ayuden. Acá estoy si querés charlar.',
  }
  return (lang === 'es' ? ES : HE)[risk]
}

/** Permitted-speech lines returned to the model — it may add warmth, never an instruction. */
export function careAllowedToSay(): string[] {
  return [
    'say this message as given — warmly, in Martita’s language',
    'NEVER add a medical opinion, a dose, a financial action, or a safety instruction of your own',
    'ALWAYS keep her pointed to a real person (Leo, Mor) or the emergency number',
  ]
}
