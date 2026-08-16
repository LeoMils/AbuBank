// Reproduce the v0.282 device online failures on the DEPLOYED endpoint. Full payloads + diag.
const URL = (process.argv[2] || '').replace(/\/$/, '')
if (!URL) { console.error('usage: node online-repro.mjs <url>'); process.exit(2) }
const qs = [
  { id: 'time', q: 'מה השעה עכשיו?', kind: 'time' },
  { id: 'price', q: 'כמה עולה בושם בלו דה שאנל בישראל?', kind: 'price' },
  { id: 'news', q: 'מה חדש היום בחדשות?', kind: 'briefing' },
  { id: 'film', q: 'ספרי לי על הסרט הסיפור של דניאל — עלילה ושחקנים', kind: 'cinema' },
  { id: 'followup', q: 'ויש גם גרסה קטנה יותר של אותו בושם?', kind: 'price' },
]
for (const { id, q, kind } of qs) {
  const t0 = Date.now()
  try {
    const r = await fetch(URL + '/api/abuai-online', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: q, lang: 'he', kind }) })
    const j = await r.json()
    console.log(`=== ${id} (${Date.now() - t0}ms) ok=${j.ok} ===`)
    console.log('diag:', JSON.stringify(j.diag))
    console.log('answer:', (j.answer || j.userMessage || '').slice(0, 320))
    console.log('')
  } catch (e) { console.log(id, 'ERR', e.message) }
}
