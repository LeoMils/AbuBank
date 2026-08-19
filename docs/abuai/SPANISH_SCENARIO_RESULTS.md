# Rioplatense Spanish — Deterministic Scenario Results

_Proves the Spanish SHAPING layer (resolver + shapers) is well-formed. NOT a live-model prose score._

| ID | Category | Query | Output | Checks |
|----|----------|-------|--------|--------|
| ES-FAM-1 | family | la mamá de Ofir | La mamá de Ofir es Mor. | ✅ non-empty; ✅ no Hebrew leakage; ✅ no Iberian forms; ✅ names Mor |
| ES-FAM-2 | family | la bisabuela de Anabel | La bisabuela de Annabel es Abu. | ✅ non-empty; ✅ no Hebrew leakage; ✅ no Iberian forms; ✅ names Abu/Martita |
| ES-FAM-3 | family | Mor y Leo (hermanos) | Mor y Leo son hermanos, ambos hijos de Abu. | ✅ non-empty; ✅ no Hebrew leakage; ✅ no Iberian forms; ✅ hermanos |
| ES-FAM-4 | family | Martita ~ Ari (bisabuela) | Abu es bisabuela de Ari (a través de Mor). | ✅ non-empty; ✅ no Hebrew leakage; ✅ no Iberian forms; ✅ bisabuela |
| ES-HON-1 | honesty | la hija de Mor (no existe) | Mor no tiene hija. | ✅ non-empty; ✅ no Hebrew leakage; ✅ no Iberian forms; ✅ honest "no tiene" |
| ES-HON-2 | honesty | persona desconocida | ∅ | ✅ declines (null) |
| ES-CAL-1 | calendar | confirmar cita | Te agendo médico hoy a las 16:00. / ¿Está bien? | ✅ non-empty; ✅ no Hebrew leakage; ✅ no Iberian forms; ✅ voseo/agendar |
| ES-CAL-2 | calendar | guardado | Listo, te agendé médico hoy a las 16:00. | ✅ non-empty; ✅ no Hebrew leakage; ✅ no Iberian forms; ✅ Listo/agendé |
| ES-CAL-3 | calendar | cancelado | Dale, lo cancelé. Decime cuando quieras agendar algo. | ✅ non-empty; ✅ no Hebrew leakage; ✅ no Iberian forms |
| ES-CAL-4 | calendar | aclarar hora | ¿A qué hora? | ✅ non-empty; ✅ no Hebrew leakage; ✅ no Iberian forms; ✅ pide hora |
| ES-CAL-5 | calendar | hoy vacío | Hoy no tenés nada en el calendario. | ✅ non-empty; ✅ no Hebrew leakage; ✅ no Iberian forms; ✅ voseo tenés |

**Total: 11 · pass 11 · fail 0**

> Live conversational Spanish (warmth, mixed He/Es turns, real-model register) remains BLOCKED_BY_REAL_RUN — see dashboard §6.