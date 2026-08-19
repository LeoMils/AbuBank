/*
 * corpus.ts — 30 real questions Martita would ask, in Hebrew (+ Spanish variants),
 * for the provider bake-off. Grounded on the categories from the M1 brief. Kept as
 * data so the harness and a test both read the same list.
 */
export interface CorpusQuestion { id: string; lang: 'he' | 'es'; category: string; q: string }

export const BAKEOFF_CORPUS: readonly CorpusQuestion[] = [
  // news
  { id: 'news-today',      lang: 'he', category: 'news',    q: 'מה החדשות המרכזיות היום?' },
  { id: 'news-israel',     lang: 'he', category: 'news',    q: 'מה קורה עכשיו בחדשות בישראל?' },
  { id: 'news-week',       lang: 'he', category: 'news',    q: 'מה היו החדשות הגדולות השבוע?' },
  { id: 'news-world',      lang: 'he', category: 'news',    q: 'מה קורה בעולם היום?' },
  { id: 'news-economy',    lang: 'he', category: 'news',    q: 'מה חדש בכלכלה בישראל היום?' },
  // sports
  { id: 'sport-lastnight', lang: 'he', category: 'sports',  q: 'מי ניצח אתמול בכדורגל?' },
  { id: 'sport-maccabi',   lang: 'he', category: 'sports',  q: 'מה התוצאה של מכבי תל אביב במשחק האחרון?' },
  { id: 'sport-standings', lang: 'he', category: 'sports',  q: 'מה מצב הטבלה בליגת העל בכדורגל?' },
  { id: 'sport-fight',     lang: 'he', category: 'sports',  q: 'מה היתה התוצאה של קרב האיגרוף האחרון?' },
  { id: 'sport-nba',       lang: 'he', category: 'sports',  q: 'מי ניצח אתמול ב-NBA?' },
  // weather
  { id: 'weather-now-tlv', lang: 'he', category: 'weather', q: 'מה מזג האוויר עכשיו בתל אביב?' },
  { id: 'weather-ks',      lang: 'he', category: 'weather', q: 'מה מזג האוויר עכשיו בכפר סבא?' },
  { id: 'weather-tmrw',    lang: 'he', category: 'weather', q: 'איך מזג האוויר מחר בירושלים?' },
  { id: 'weather-rain',    lang: 'he', category: 'weather', q: 'האם ירד גשם מחר בשרון?' },
  { id: 'weather-haifa',   lang: 'he', category: 'weather', q: 'כמה מעלות עכשיו בחיפה?' },
  // cinema
  { id: 'cinema-ks',       lang: 'he', category: 'cinema',  q: 'איזה סרטים מוקרנים עכשיו בקולנוע בכפר סבא?' },
  { id: 'cinema-new',      lang: 'he', category: 'cinema',  q: 'אילו סרטים חדשים יצאו השבוע?' },
  // prices
  { id: 'price-usd',       lang: 'he', category: 'prices',  q: 'כמה עולה דולר היום בשקלים?' },
  { id: 'price-gas',       lang: 'he', category: 'prices',  q: 'מה מחיר הדלק היום בישראל?' },
  { id: 'price-gold',      lang: 'he', category: 'prices',  q: 'מה מחיר הזהב היום?' },
  // hours / open now
  { id: 'hours-super',     lang: 'he', category: 'hours',   q: 'עד איזו שעה פתוח הסופר בכפר סבא היום?' },
  { id: 'hours-pharmacy',  lang: 'he', category: 'hours',   q: 'האם יש בית מרקחת פתוח עכשיו בכפר סבא?' },
  { id: 'hours-bank',      lang: 'he', category: 'hours',   q: 'מתי פתוח הבנק מחר בבוקר?' },
  { id: 'hours-mall',      lang: 'he', category: 'hours',   q: 'עד מתי פתוח הקניון היום?' },
  // live events / misc current
  { id: 'live-eurovision', lang: 'he', category: 'live',    q: 'מתי אירוע הזמר הקרוב ומי משתתף?' },
  { id: 'live-holiday',    lang: 'he', category: 'live',    q: 'מתי החג הקרוב בישראל?' },
  { id: 'live-traffic',    lang: 'he', category: 'live',    q: 'איך התנועה עכשיו בכביש 6?' },
  { id: 'live-election',   lang: 'he', category: 'news',    q: 'מה חדש בפוליטיקה בישראל היום?' },
  { id: 'live-covid',      lang: 'he', category: 'news',    q: 'האם יש התפרצות מחלה כרגע בישראל?' },
  { id: 'live-shabbat',    lang: 'he', category: 'hours',   q: 'מתי כניסת שבת השבוע בכפר סבא?' },
  // Spanish variants of the same intents (Rioplatense-friendly)
  { id: 'es-news',         lang: 'es', category: 'news',    q: '¿Qué noticias hay hoy en Israel?' },
  { id: 'es-weather',      lang: 'es', category: 'weather', q: '¿Qué tiempo hace ahora en Tel Aviv?' },
  { id: 'es-sport',        lang: 'es', category: 'sports',  q: '¿Quién ganó anoche el partido de fútbol?' },
  { id: 'es-cinema',       lang: 'es', category: 'cinema',  q: '¿Qué películas dan ahora en el cine?' },
  { id: 'es-price',        lang: 'es', category: 'prices',  q: '¿Cuánto está el dólar hoy?' },
  { id: 'es-hours',        lang: 'es', category: 'hours',   q: '¿Está abierta la farmacia ahora?' },
] as const
