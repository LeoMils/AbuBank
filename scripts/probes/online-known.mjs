const URL = (process.argv[2] || '').replace(/\/$/, '')
const qs = [
  { id: 'film-known', q: 'ספרי לי על הסרט אופנהיימר — עלילה ושחקנים', kind: 'cinema' },
  { id: 'followup-ctx', q: 'כמה עולה בושם בלו דה שאנל של 50 מ"ל בישראל?', kind: 'price' },
  { id: 'news-events', q: 'מה קרה היום בחדשות בישראל?', kind: 'briefing' },
]
for (const { id, q, kind } of qs) {
  const t0 = Date.now()
  try {
    const r = await fetch(URL + '/api/abuai-online', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: q, lang: 'he', kind }) })
    const j = await r.json()
    console.log(`=== ${id} (${Date.now() - t0}ms) ok=${j.ok} path=${j.diag?.answerPath} ===`)
    console.log('answer:', (j.answer || j.userMessage || '').slice(0, 260))
  } catch (e) { console.log(id, 'ERR', e.message) }
}
