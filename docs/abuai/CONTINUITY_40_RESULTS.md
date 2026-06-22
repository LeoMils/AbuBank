# 40-Turn Bilingual Continuity — Deterministic Results

_Context retention + follow-ups + emotion stickiness + topic switch/return + NO hallucinated family facts, across HE/ES/mixed. Felt warmth is Martita-subjective._

| # | User | Response | Result | Detail |
|---|------|----------|--------|--------|
| K1 | בוקר טוב | היי! מה קורה? | ✅ | emotional/non_personal |
| K2 | מי זאת מור? | מור, הבת שלך. בהוד השרון עם יעל. | ✅ | מור, הבת שלך. בהוד השרון עם יעל. |
| K3 | ספרי לי עליה | (general:non_personal) | ✅ | lastPerson=מור |
| K4 | מי הילדים של מור? | למור יש 4 ילדים — אופיר, איילון, עילי, אדר. | ✅ | למור יש 4 ילדים — אופיר, איילון, עילי, אדר. |
| K5 | מי סבתא רבתא של אנאבל? | מרטיטה. | ✅ | מרטיטה. |
| K6 | מה יש לי מחר? | מחר יש לך רופא. בארבע אחר הצהריים. | ✅ | מחר יש לך רופא. בארבע אחר הצהריים. |
| K7 | ומה אחרי זה? | יום שלישי (23/06): 🏥 רופא בשעה 16:00 | ✅ | true:מה יש לי השבוע? |
| K8 | ומה ביום הבא? | מחר יש לך רופא. בארבע אחר הצהריים. | ✅ | true:מה יש לי מחר? |
| K9 | מתי המהפכה הצרפתית? | (general:non_personal) | ✅ | route=non_personal |
| K10 | תמשיכי | (general:non_personal) | ✅ | act=continue |
| K11 | מי זאת מור? | מור, הבת שלך. בהוד השרון עם יעל. | ✅ | RETURN מור, הבת שלך. בהוד השרון עם יעל. |
| K12 | עליה | (general:non_personal) | ✅ | lastPerson=מור |
| K13 | אני מתגעגעת לפאפי | כן, פאפי היה מיוחד. את רוצה לספר לי עליו? | ✅ | emotional |
| K14 | מה השעה? | (general:non_personal) | ✅ | frame=emotion |
| K15 | contame de Leo | Leo, tu hijo. Sus hijos son Adi y Noam. ¿Cuándo hablaste con él la última vez? | ✅ | Leo, tu hijo. Sus hijos son Adi y Noam. ¿Cuándo hablaste con él la última vez? |
| K16 | ¿quién es la hija de Mor? | Mor no tiene hija. | ✅ | Mor no tiene hija. |
| K17 | ¿dónde vive Mor? | Mor, tu hija. vive en Hod HaSharon, con Yael. | ✅ | Mor, tu hija. vive en Hod HaSharon, con Yael. |
| K18 | מי דוד של אופיר? | לאו. | ✅ | לאו. |
| K19 | מי סבתא רבתא של ארי? | מרטיטה. | ✅ | מרטיטה. |
| K20 | מי זה זבולון הקוסם? | לא יודעת. | ✅ | no-invention: "לא יודעת." |
| K21 | ¿quién es la hija de Zúñiga? | (general:non_personal) | ✅ | decline=null |
| K22 | מה יש לי השבוע? | יום שלישי (23/06): 🏥 רופא בשעה 16:00 | ✅ | יום שלישי (23/06): 🏥 רופא בשעה 16:00 |
| K23 | משעמם לי | ידעת שדבורים מזהות פנים של בני אדם? מטורף, לא? | ✅ | ידעת שדבורים מזהות פנים של בני אדם? מטורף, לא? |
| K24 | estoy aburrida | ¿Sabías que hay un tiburón que vive 400 años? Increíble, ¿no? | ✅ | ¿Sabías que hay un tiburón que vive 400 años? Increíble, ¿no? |
| K25 | תשארי איתי | אני כאן. ספרי לי מה היה לך היום, או שאני אספר לך משהו — מה שנוח. | ✅ | אני כאן. ספרי לי מה היה לך היום, או שאני אספר לך משהו — מה שנוח. |
| K26 | מי החברה של מור? | יעל. | ✅ | יעל. |
| K27 | איפה גרה מור? | מור גרה בהוד השרון, וילה עם יעל. | ✅ | מור גרה בהוד השרון, וילה עם יעל. |
| K28 | ¿quién es la bisabuela de Anabel? | La bisabuela de Annabel es Abu. | ✅ | La bisabuela de Annabel es Abu. |
| K29 | ספרי לי על המהפכה הצרפתית | (general:non_personal) | ✅ | route=non_personal |
| K30 | תמשיכי | (general:non_personal) | ✅ | act=continue |
| K31 | מי הילדים של לאו? | ללאו יש 2 ילדים — עדי, נועם. | ✅ | ללאו יש 2 ילדים — עדי, נועם. |
| K32 | מי סבתא רבתא של אנאבל? | מרטיטה. | ✅ | מרטיטה. |
| K33 | ¿quién es la mamá de Ofir? | La mamá de Ofir es Mor. | ✅ | La mamá de Ofir es Mor. |
| K34 | תקבעי לי רופא מחר בעשר | (general:calendar_create) | ✅ | route=calendar_create |
| K35 | מי הבן של מור? | לא יודעת. | ✅ | לא יודעת. |
| K36 | estoy triste | Sí, es difícil. ¿Querés contarme? | ✅ | Sí, es difícil. ¿Querés contarme? |
| K37 | gracias | De nada. | ✅ | De nada. |
| K38 | מי זאת יעל? | יעל, בת הזוג של מור. בהוד השרון. | ✅ | יעל, בת הזוג של מור. בהוד השרון. |
| K39 | תודה לך | (general:non_personal) | ✅ | general/non_personal |
| K40 | לילה טוב | (general:non_personal) | ✅ | general/non_personal |

**Total 40 · pass 40 · fail 0**