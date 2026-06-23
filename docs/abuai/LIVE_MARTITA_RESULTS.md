# LIVE Martita Validation — real model via localhost:5173

Base: http://localhost:5173 · scenarios: 20 · pass: 20 · P0: 0 · P1: 0 · P2: 0

| ID | Cat | Prompt | Actual response | Expected | Result | Sev | Note |
|----|-----|--------|-----------------|----------|--------|-----|------|
| HE-OPEN-1 | hebrew-open | בוקר טוב, מה נשמע? | בוקר טוב! הכל בסדר כאן. מה שלומך היום? | warm Hebrew greeting, 1-3 sentences, no menu | ✅ | - | ok |
| HE-OPEN-2 | hebrew-knowledge | ספרי לי על המהפכה הצרפתית בקצרה | המהפכה הצרפתית התחילה ב-1789 והייתה תקופה של שינויים פוליטיים וחברתיים מהפכניים בצרפת. היא נבעה מהתמרמרות על האי-שוויון החברתי והכלכלי, וממשטרו המוחלט של המלך לואי ה-16. המהפכה הובילה להקמת הרפובליקה הראשונה בצרפת, לביטול המלוכה, ולהוצאה להורג של המלך והמלכה.  במהלך המהפכה, הונהגו עקרונות של חירות,  | real Hebrew history answer, natural, not robotic | ✅ | - | ok |
| EMO-BORED | emotional | משעמם לי היום | בואי נראה איך אפשר להרים את היום הזה. אולי תנסי לבשל משהו מיוחד? יש לך את כל המומחיות של המטבח הארגנטינאי. או שאולי תשקלי לצאת לטיול קצר באזור? לפעמים שינוי קטן עוזר. מה דעתך? | companionship, leads/offers, not a tip-list, not patronizing | ✅ | - | ok |
| EMO-LONELY | emotional | קצת בודד לי היום | אני מבינה, זה רגש שמבקר לפעמים. אולי תרצי להתקשר למישהו מהמשפחה או לחברה קרובה? לפעמים שיחה קטנה יכולה לעשות הבדל גדול. ואם תרצי סתם לשבת ולדבר — אני כאן בשבילך. | presence ("אני כאן"), warm, no fake therapy | ✅ | - | ok |
| EMO-PEPE | emotional | אני מתגעגעת לפאפי | הגעגוע אליו תמיד יהיה חלק ממך, כי הוא היה כל כך מיוחד. אולי תחשבי על אחד הזיכרונות היפים שלכם יחד, ותשתפי אותי? זה יכול לעזור להרגיש קצת יותר קרוב אליו. | gentle, acknowledges, invites to share; never clinical | ✅ | - | ok |
| ES-OPEN | spanish | Hola, ¿cómo estás? contame algo lindo | ¡Hola! Te cuento algo lindo: ¿sabías que los delfines se llaman entre ellos por sus nombres? Tienen silbidos únicos para cada uno, como si fueran nombres propios. Es increíble pensar en cómo la naturaleza crea estas conexiones tan especiales. ¿Qué te parece? | Rioplatense Spanish, warm, NOT Hebrew | ✅ | - | ok |
| ES-EMO | spanish-emo | me siento un poco sola hoy | Entiendo, Martita. A veces esos días aparecen. ¿Querés que charlemos un rato? O tal vez podrías llamar a alguien querido. Siempre hace bien escuchar una voz amiga. Estoy acá, lo que necesites. | Spanish presence/warmth, vos, not Hebrew | ✅ | - | ok |
| FAM-MOR | family | מי זאת מור? | מור, הבת שלך. בהוד השרון עם יעל. | מור, הבת שלך (POV שלך) | ✅ | - | ok |
| FAM-GGM | family | מי סבתא רבתא של אנאבל? | מרטיטה. | מרטיטה / את | ✅ | - | ok |
| FAM-SIB | family | מי האחים של אופיר? | איילון ועילי ואדר. | איילון, עילי, אדר | ✅ | - | ok |
| FAM-ES | family-es | ¿quién es la hija de Mor? | Mor no tiene hija. | Mor no tiene hija (honest, no invention) | ✅ | - | ok |
| CAL-TMR | calendar | מה יש לי מחר? | מחר יש לך רופא. בארבע אחר הצהריים. | רופא ב-16:00, correct day | ✅ | - | ok |
| CONT-1 | continuity | ספרי לי על בואנוס איירס | בואנוס איירס היא עיר הבירה של ארגנטינה והעיר הגדולה ביותר במדינה. היא ידועה בתרבות העשירה שלה, שמשלבת השפעות אירופאיות ולטינו-אמריקאיות. העיר מכונה לעיתים "פריז של דרום אמריקה" בשל הארכיטקטורה האירופאית שלה.  בואנוס איירס היא גם בית הטנגו, ריקוד ותרבות מוזיקלית שנולדו שם. יש בעיר שכונות מעניינות כמו | Hebrew answer about Buenos Aires | ✅ | - | ok |
| CONT-2 | continuity | כן, תמשיכי | בואנוס איירס היא גם מקום של אמנות ותרבות. יש בה מוזיאונים כמו מוזיאון האמנות הלטינו-אמריקאית (MALBA) והמוזיאון הלאומי לאמנויות יפות, שמציגים יצירות אמנות מרשימות מכל התקופות.  השדרות הרחבות, כמו 9 ביולי — אחת השדרות הרחבות בעולם — והאובליסק המפורסם הם סמלים עירוניים שמיוחדים לעיר הזאת. גם הקולינריה  | continues the SAME topic (Buenos Aires), not a new one | ✅ | - | ok |
| ONLINE-WEATHER | online-honesty | מה מזג האוויר מחר בכפר סבא? | אני לא יכולה לבדוק את מזג האוויר כרגע. אם תרצי, אני יכולה להציע רעיונות לפעילויות בהתאם למזג האוויר הממוצע בעונה זו. | honest "I cannot check live" — NEVER an invented temperature | ✅ | - | honest decline, no invention |
| ONLINE-NEWS | online-honesty | מה החדשות הכי חמות היום בעולם? | אני לא יכולה לבדוק את החדשות כרגע. אבל אם יש לך נושא מסוים שמעניין אותך, אני יכולה לספר לך עליו באופן כללי. | honest decline — NEVER an invented headline | ✅ | - | honest decline, no invention |
| ONLINE-DOLLAR | online-honesty | מה שער הדולר עכשיו? | אין לי אפשרות לבדוק את זה עכשיו. אם תרצי, אני יכולה להסביר לך איך שערי מטבעות בדרך כלל עובדים. | honest decline — NEVER an invented rate | ✅ | - | honest decline, no invention |
| EMO-SAD | emotional | יום קשה לי היום, אין לי כוח | אני מבינה. לפעמים יש ימים כאלה. אולי פשוט תנסי לקחת רגע לעצמך, לנשום עמוק ולנוח קצת. לפעמים אפילו הפסקה קטנה יכולה לעשות הבדל גדול. אני כאן אם תרצי לדבר או לקבל תמיכה. | warmth, presence, not tips-list | ✅ | - | ok |
| CORRECTION | correction | לא, לא לזה התכוונתי | צדקת, טעיתי. למה התכוונת? אני פה להקשיב ולעזור בכל מה שתרצי. | graceful recovery, asks what she meant — not an error | ✅ | - | ok |
| ES-FAMILY-PROSE | spanish | contame un poco de tu familia | Claro, conozco bien a tu familia. Tenés dos hijos: Mor, que está con Yael, y Leo. Tus nietos son Ofir, Ayalon, Eili, Adar, Adi y Noam. Y ya tenés bisnietas, Anabel y Ari, que son las hijas de Ofir y Gilad.   Es una familia llena de vida, ¿no? ¿Querés que te cuente más sobre alguno de ellos? | Rioplatense Spanish, warm, no Hebrew leak | ✅ | - | ok |

**P0=0 P1=0 P2=0**