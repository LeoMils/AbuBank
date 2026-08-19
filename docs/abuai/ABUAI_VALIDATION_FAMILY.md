# ABUAI_VALIDATION_FAMILY — Family Suite (S016–S045)

Family validation of the cognitive architecture ([[ABUAI_COGNITIVE_MODEL]] and its five
subordinate documents). Continues the master set in [[ABUAI_COGNITIVE_VALIDATION]] (S001–S015).
Each scenario proves the model produces correct **reasoning → behavior → response** — that family
is *cognition* ([[ABUAI_FAMILY_REASONING_MODEL]]), not a table lookup.

**Scenario format (every entry):**
- **Reasoning** — the cognitive trace: APPRAISE (need) → PRIORITIZE (frame) → REASON (engine) → DECIDE (act) → memory write.
- **Behavior** — the chosen act and why (from [[ABUAI_DECISION_TREE]]).
- **Response** — the exact words AbuAI should say (Hebrew unless marked; Identity Spec register).

Acts: LISTEN/REFLECT · STAY-QUIET · ANSWER · CONFIRM · ASK · EXPLAIN · LEAD.
Frames: COMPANIONSHIP > EMOTION > TASK > FACT.

Graph facts used (from `knowledge/family_data.json`): Martita→{Mor, Leo}; Mor→{Ofir, Ayalon/איילון,
Eili/עילי, Adar}, partner Yael, ex Rafi; Leo→{Adi, Noam} (twins); Ofir+Gilad→{Anabel, Ari};
Eili+Yarden. Friends Mirta/Shoshana/Sharon are **not** family → resolve NULL against family.

---

### S016 — "מי זאת איילון?" (concise identity)
- **Reasoning:** APPRAISE→orientation+warmth (relational, calm). FRAME=FACT(family). Verb "מי זאת" → depth=concise ([[ABUAI_FAMILY_REASONING_MODEL]] §3). REASON: graph → grandson, son of Mor; anchor=one detail (moving to Hod HaSharon). DECIDE=ANSWER. Write last_person=Ayalon.
- **Behavior:** ANSWER concise — role + ONE anchor; no dump, no list intonation.
- **Response:** "איילון, הנכד שלך — הבן של מור. עובר בקרוב להוד השרון."

### S017 — "ספרי לי על איילון." (rich — must differ from S016)
- **Reasoning:** APPRAISE→reminiscence/closeness. FRAME=FACT(family). Verb "ספרי על" → depth=rich; MUST differ from S016 (§3 + Identity Spec §7.1/7.3). REASON: same node, *new* facets — his brothers, his place among Mor's four. DECIDE=ANSWER, then optional LEAD. last_person=Ayalon.
- **Behavior:** ANSWER rich with a new facet vs S016; open a gentle thread.
- **Response:** "איילון הוא אחד מארבעת הבנים של מור — עם אופיר, עילי ואדר. גם הוא עובר להוד השרון, אז כולם יתקרבו. שמעת ממנו לאחרונה?"

### S018 — "מי סבתא של נועם?" (grandmother inference, 2-hop)
- **Reasoning:** APPRAISE→fact/relation. FRAME=FACT(family). REASON: graph 2-hop ancestor Martita→Leo→Noam → grandmother; inferred, not stored ([[ABUAI_FAMILY_REASONING_MODEL]] §2). DECIDE=ANSWER one line. last_person=Noam.
- **Behavior:** ANSWER the inferred relation warmly, single fact.
- **Response:** "זאת את, מרטיטה — נועם הוא הנכד שלך, הבן של לאו."

### S019 — "מי סבתא רבתא של ארי?" (great-grandmother inference, 3-hop)
- **Reasoning:** APPRAISE→fact/relation. FRAME=FACT(family). REASON: graph 3-hop ancestor Martita→Mor→Ofir→Ari → great-grandmother (§2, generalized RC5). DECIDE=ANSWER one line. last_person=Ari.
- **Behavior:** ANSWER the inferred 3-hop relation; inference, not stored.
- **Response:** "זאת את — ארי היא הנינה שלך, דרך מור ואופיר."

### S020 — "מי הדודה של אנאבל?" (aunt inference, sibling-of-parent)
- **Reasoning:** APPRAISE→fact/relation. FRAME=FACT(family). REASON: Anabel's parent=Ofir; Ofir's siblings={Ayalon, Eili, Adar} — all male → no דודה in that line; the only aunt-relation is through the wider graph and none is female. Graph yields no female sibling-of-parent → honest NULL on "דודה" specifically, but offer the true uncles (§2 gender label; §4 honesty NULL). DECIDE=ANSWER honest + the real relation. last_person=Anabel.
- **Behavior:** ANSWER honestly — no female aunt exists; name the actual uncles instead of inventing one.
- **Response:** "דודה אין לה — אבל יש לה שלושה דודים, איילון, עילי ואדר, האחים של אופיר."

### S021 — "מי הדוד של אנאבל?" (uncle inference, sibling-of-parent)
- **Reasoning:** APPRAISE→fact/relation. FRAME=FACT(family). REASON: Anabel's parent=Ofir; Ofir's brothers={Ayalon, Eili, Adar} → uncles (דוד), male label (§2 RC5 aunt/uncle). DECIDE=ANSWER one line, name them since asked. last_person=Anabel.
- **Behavior:** ANSWER the inferred uncle relation; name the three brothers.
- **Response:** "הדודים שלה הם איילון, עילי ואדר — האחים של אבא שלה אופיר."

### S022 — "מי בני הדוד של אדי?" (first cousins inference)
- **Reasoning:** APPRAISE→fact/relation. FRAME=FACT(family). REASON: Adi's parent=Leo; Leo's sibling=Mor; Mor's children={Ofir, Ayalon, Eili, Adar} → first cousins (בני דוד), parents are siblings (§2 RC5 first cousins). DECIDE=ANSWER one line; say "ארבעה" not a counted list (§3). last_person=Adi.
- **Behavior:** ANSWER the inferred cousin relation; summarize as four, name them as a natural phrase.
- **Response:** "בני הדוד שלו הם הילדים של מור — אופיר, איילון, עילי ואדר. ונועם, התאום שלו, כמובן."

### S023 — "מי אח של עילי?" (siblings inference)
- **Reasoning:** APPRAISE→fact/relation. FRAME=FACT(family). REASON: Eili's parent=Mor; Mor's other children={Ofir, Ayalon, Adar} → brothers (§2 siblings, shared parent). DECIDE=ANSWER one line. last_person=Eili.
- **Behavior:** ANSWER the sibling relation, named naturally, not as a numbered list.
- **Response:** "האחים שלו הם אופיר, איילון ואדר — כולם הבנים של מור."

### S024 — "מה הקשר בין רפי ללאו?" (in-law inference — former brothers-in-law)
- **Reasoning:** APPRAISE→relation. FRAME=FACT(family). REASON: Rafi=ex-husband of Mor; Leo=Mor's brother → Rafi is Leo's former brother-in-law (§2 in-law, sibling-of-spouse; Identity Spec context). Past-tense because Mor and Rafi are divorced. DECIDE=ANSWER one honest line. last_person=Rafi.
- **Behavior:** ANSWER the inferred in-law relation, marking it as former.
- **Response:** "רפי היה הגיס של לאו — היה נשוי למור, אז הם היו גיסים. היום הם גרושים, אבל רפי עדיין אבא של הנכדים."

### S025 — "מי ההורים של אנאבל?" (same-sex parents reasoning)
- **Reasoning:** APPRAISE→relation. FRAME=FACT(family). REASON: Anabel's parents={Ofir, Gilad} — same-sex parents, both reason normally as parents (§5; [[ABUAI_FAMILY_REASONING_MODEL]] §2 backfill). DECIDE=ANSWER one line, natural, no special framing. last_person=Anabel.
- **Behavior:** ANSWER both parents plainly; never qualify or single out the couple.
- **Response:** "אנאבל היא הבת של אופיר וגלעד. ארי האחות שלה."

### S026 — "מי בת הזוג של מור?" (partner correctness — Yael is family)
- **Reasoning:** APPRAISE→relation. FRAME=FACT(family). REASON: Mor's partner=Yael (edge priority 1, spouse/partner; §2). Yael is **family/partner, never "friend"** (§5). DECIDE=ANSWER one line. last_person=Yael.
- **Behavior:** ANSWER the partner relation; affirm togetherness, never "חברה".
- **Response:** "יעל, בת הזוג של מור. גרות יחד בוילה בהוד השרון."

### S027 — "ספרי לי על יעל." (rich — partner, family register)
- **Reasoning:** APPRAISE→closeness about a loved person. FRAME=FACT(family). Verb "ספרי על" → rich (§3). REASON: Yael=Mor's partner, lives with her in Hod HaSharon villa; she is part of the family, not a friend (§5). DECIDE=ANSWER rich + gentle opener. last_person=Yael.
- **Behavior:** ANSWER rich, warm, family register; open a thread.
- **Response:** "יעל ומור חולקות חיים יחד בוילה בהוד השרון. היא חלק מהמשפחה לכל דבר. מתי ראית את שתיהן לאחרונה?"

### S028 — "מה הקשר בין שרון למור?" (honesty NULL — friend, not family)
- **Reasoning:** APPRAISE→relation. FRAME=FACT(family). REASON: Sharon=family_friend, **not** family; graph yields no representable family path to Mor → NULL (§2 honesty contract, §5 friends resolve NULL). DECIDE=ANSWER honest NULL, never invent. last_person=Mor (named entity).
- **Behavior:** ANSWER honest — no family relation; place Sharon correctly as a friend.
- **Response:** "אין ביניהן קשר משפחתי — שרון היא חברה של המשפחה, לא קרובה. מור היא הבת שלך."

### S029 — "מירטה זאת דודה שלי?" (honesty NULL — friend mistaken for kin)
- **Reasoning:** APPRAISE→relation check. FRAME=FACT(family). REASON: Mirta=close_friend, not in family graph → no kinship edge → NULL (§4 honesty). Must not affirm a false relation (Decision Tree G0: never assert a family fact not in the graph). DECIDE=ANSWER honest, warm. last_person=Mirta.
- **Behavior:** ANSWER honest correction, gently — friend, not family.
- **Response:** "לא דודה, מרטיטה — מירטה היא חברה קרובה שלך, לא מהמשפחה. אבל קרובה ללב, זה בטוח."

### S030 — "מי זאת מירטה?" (concise — friend, not kin, no NULL drama)
- **Reasoning:** APPRAISE→orientation. FRAME=FACT(identity, not a relation query). REASON: Mirta=close friend (stored role, not a family edge). Identity ≠ kinship; answer her role honestly without forcing a family label (§2, §5). DECIDE=ANSWER concise. last_person=Mirta.
- **Behavior:** ANSWER concise — her real role (friend), one warm anchor.
- **Response:** "מירטה היא חברה קרובה שלך, מהוותיקות. לא מהמשפחה, אבל מהלב."

### S031 — "ומי זאת אנאבל?" then "ספרי עליה." (pronoun continuity — female)
- **Reasoning:** READ-STATE: turn 1 sets last_person=Anabel (§1 working memory). Turn 2 "ספרי עליה" → resolve pronoun to last_person=Anabel (Conversation Engine §4, deterministic). FRAME=FACT(family). Verb "ספרי" → rich, pick a *new* facet (great-granddaughter via Mor→Ofir+Gilad), no repeat (§3 pronoun row). DECIDE=ANSWER rich. last_person stays Anabel.
- **Behavior:** ANSWER rich on the carried-over pronoun target; new facet, no repeat.
- **Response:** "אנאבל היא הנינה שלך, הבת של אופיר וגלעד. יש לה אחות, ארי — שתיהן הקטנטנות של המשפחה."

### S032 — "ומי זה אדר?" then "ספרי עליו." (pronoun continuity — male)
- **Reasoning:** READ-STATE: turn 1 sets last_person=Adar. Turn 2 "ספרי עליו" → masculine pronoun → last_person=Adar (§4 deterministic). FRAME=FACT(family). Verb "ספרי" → rich, new facet (the youngest of Mor's four, moving to Hod HaSharon). DECIDE=ANSWER rich. last_person=Adar.
- **Behavior:** ANSWER rich on the masculine pronoun target; new facet, gender-correct verbs.
- **Response:** "אדר הוא הצעיר מבין הבנים של מור. גם הוא עובר להוד השרון, אז כל האחים יהיו קרוב. בא לך לשמוע מה איתו?"

### S033 — "מי ההורה של יעל?" pronoun-free unknown (honesty NULL — unknown data)
- **Reasoning:** APPRAISE→relation. FRAME=FACT(family). REASON: graph has no parent edge for Yael (not stored) → unknown, not inferable → honest NULL/unknown (Decision Tree G0; §4 honesty). DECIDE=ANSWER honest "don't know", never invent. last_person=Yael.
- **Behavior:** ANSWER honest — the graph doesn't hold that; offer no fabrication.
- **Response:** "את ההורים של יעל אני לא מכירה, מרטיטה — זה לא משהו שאני יודעת עליה. אבל היא בת הזוג של מור, חלק מהמשפחה."

### S034 — "אני כל כך גאה בעילי, פתחו פנסיון לכלבים!" (pride about a grandchild → reflect, then warm detail)
- **Reasoning:** APPRAISE→pride/joy (high emotional_valence) about a person. FRAME=EMOTION (§4). REASON: family lookup *gated* — reflect the joy first, **then** optionally one known warm detail (§4 Papi rule generalized: pride→reflect then add). DECIDE=REFLECT + share joy, then optional LEAD. emotional_context=proud; last_person=Eili.
- **Behavior:** REFLECT the pride first; add a genuine known detail (the dogs) as warmth, not a profile.
- **Response:** "יש לך ממה להיות גאה — הוא וירדן עם הכלבים שלהם, איזה יופי. הם בנו משהו משלהם."

### S035 — "אני דואגת לאדר, עובר דירה לבד." (worry about a grandchild → suppress lookup, reassure)
- **Reasoning:** APPRAISE→worry (high valence) about a person. FRAME=EMOTION → **suppress** the Adar family lookup even though he's an entity (§4 suppression rule; Decision Tree §1). REASON: none. DECIDE=REFLECT; offer a concrete bridge only if she's open (§4). emotional_context=worried; last_person=Adar.
- **Behavior:** REFLECT the worry; do NOT describe Adar; offer a gentle bridge.
- **Response:** "זה מרגש ומלחיץ, מעבר דירה. רוצה שנשלח לו הודעה קטנה לשמוע איך הולך?"

### S036 — "עצוב לי, מור לא התקשרה כל השבוע." (hurt/loneliness → suppress family lookup)
- **Reasoning:** APPRAISE→hurt/loneliness (high valence) about a person. FRAME=EMOTION → **suppress** the Mor lookup (§4; mirrors S014). REASON: none. DECIDE=REFLECT; gentle bridge only if open. emotional_context=lonely(sticky); last_person=Mor.
- **Behavior:** REFLECT the feeling first; do NOT describe Mor; offer to reach her.
- **Response:** "זה כואב כשמתגעגעים ושקט. רוצה שנשלח למור הודעה, או שנדבר רגע על זה?"

### S037 — "מי הנינים שלי?" (great-grandchildren — say count, name only as asked)
- **Reasoning:** APPRAISE→relation/orientation. FRAME=FACT(family). REASON: graph → great-grandchildren={Anabel, Ari}, via Mor→Ofir+Gilad (§2). DECIDE=ANSWER; two of them, name naturally (not "1… 2…", §3). last_person=null→set to the pair's salient node.
- **Behavior:** ANSWER the inferred set warmly; name the two as a phrase, not a counted list.
- **Response:** "הנינות שלך הן אנאבל וארי, הבנות של אופיר וגלעד. שתי הקטנטנות של המשפחה."

### S038 — "כמה ילדים יש למור?" (count, not a read-aloud list)
- **Reasoning:** APPRAISE→orientation/fact. FRAME=FACT(family). REASON: Mor's children={Ofir, Ayalon, Eili, Adar} → four. §3 rule: say "ארבעה", do not read a comma-list as "1… 2… 3…" in voice. DECIDE=ANSWER count + names as natural phrase. last_person=Mor.
- **Behavior:** ANSWER "ארבעה" first; name them only because four flows naturally, no list intonation.
- **Response:** "ארבעה — אופיר, איילון, עילי ואדר. כולם הבנים שלה."

### S039 — "Mor es mi hija?" (Rioplatense Spanish — relation confirm)
- **Reasoning:** APPRAISE→relation confirm, in Spanish. FRAME=FACT(family). REASON: Mor=Martita's daughter (edge priority 2; §2). Language=Rioplatense (vos, register per Identity Spec §1/§3). DECIDE=ANSWER one warm line in Spanish. last_person=Mor.
- **Behavior:** ANSWER in Rioplatense Spanish; confirm the relation warmly.
- **Response (Spanish):** "Sí, Mor es tu hija. Vive en Hod HaSharon con Yael, con sus cuatro hijos."

### S040 — "¿Quién es la abuela de Anabel?" (Spanish — grandmother inference)
- **Reasoning:** APPRAISE→relation. FRAME=FACT(family). REASON: graph 2-hop Martita→Mor→Ofir→Anabel; but "abuela de Anabel" = Anabel's grandmother = Mor (Anabel's parent is Ofir; Ofir's mother is Mor). Inference, not stored (§2). DECIDE=ANSWER Spanish, one line. last_person=Anabel.
- **Behavior:** ANSWER in Rioplatense Spanish; the inferred grandmother is Mor.
- **Response (Spanish):** "La abuela de Anabel es Mor — Anabel es hija de Ofir, y Ofir es hijo de Mor."

### S041 — "¿Y yo qué soy de Anabel?" (Spanish — great-grandmother, pronoun continuity)
- **Reasoning:** READ-STATE: last_person=Anabel from S040. APPRAISE→her own relation to Anabel. FRAME=FACT(family). REASON: 3-hop Martita→Mor→Ofir→Anabel → bisabuela (§2, gender label Spanish). DECIDE=ANSWER Spanish one line. last_person=Anabel.
- **Behavior:** ANSWER in Rioplatense Spanish; the inferred relation is bisabuela.
- **Response (Spanish):** "Vos sos la bisabuela de Anabel, mi querida — por Mor y Ofir."

### S042 — "¿Quiénes son los primos de Adi?" (Spanish — first cousins inference)
- **Reasoning:** APPRAISE→relation. FRAME=FACT(family). REASON: Adi's parent=Leo; Leo's sibling=Mor; Mor's children → primos (§2 RC5 first cousins). Spanish label "primos". DECIDE=ANSWER Spanish, named as a phrase, plus twin Noam. last_person=Adi.
- **Behavior:** ANSWER in Rioplatense Spanish; the inferred cousins are Mor's four children.
- **Response (Spanish):** "Los primos de Adi son los hijos de Mor — Ofir, Ayalon, Eili y Adar. Y Noam, su mellizo, claro."

### S043 — "Who is Yael to Mor?" (English — partner correctness)
- **Reasoning:** APPRAISE→relation, in English. FRAME=FACT(family). REASON: Yael=Mor's partner (edge priority 1). Must be **partner/family, never "friend"** (§5). DECIDE=ANSWER one warm English line. last_person=Yael.
- **Behavior:** ANSWER in English; affirm partner/family, never "friend".
- **Response (English):** "Yael is Mor's partner — they live together in Hod HaSharon. She's family, through and through."

### S044 — "Who is Ari's great-grandmother?" (English — great-grandmother inference)
- **Reasoning:** APPRAISE→relation, in English. FRAME=FACT(family). REASON: 3-hop Martita→Mor→Ofir→Ari → great-grandmother; inference, not stored (§2). DECIDE=ANSWER one English line. last_person=Ari.
- **Behavior:** ANSWER in English; the inferred relation is Martita herself.
- **Response (English):** "That's you, Martita — Ari is your great-granddaughter, through Mor and Ofir."

### S045 — "מי זאת מור?" then "ספרי עליה." then "ועוד?" (concise → rich → continue, no repeat)
- **Reasoning:** Turn 1 "מי זאת" → concise, last_person=Mor, hash answer into said_already (§1). Turn 2 "ספרי עליה" → pronoun→Mor, rich, *new* facets, must differ from turn 1 (§3, §4). Turn 3 "ועוד?" → last_topic=Mor, continue with yet another facet, no-repeat guard fires (Conversation Engine §4 said_already). FRAME=FACT(family) throughout. DECIDE=ANSWER concise → ANSWER rich → ANSWER one more facet + optional LEAD.
- **Behavior:** Three ANSWERs, each a distinct facet; never reuse a sentence frame or repeat content (§3 no-repeat).
- **Response (turn 1):** "מור, הבת שלך. גרה בהוד השרון עם יעל, ארבעה ילדים."
- **Response (turn 2):** "מור ויעל חולקות וילה בהוד השרון, תמיד באמצע משהו. הבנים — אופיר, איילון, עילי ואדר."
- **Response (turn 3):** "ועילי כבר עם פנסיון לכלבים משלו, ואיילון ואדר מתקרבים אליה להוד השרון. מתי דיברת איתה לאחרונה?"

---

## Coverage check (S016–S045)

| Theme | Scenarios |
|-------|-----------|
| Concise "מי זאת" vs rich "ספרי על" (different answers) | S016/S017, S027, S030, S045 |
| Grandmother (2-hop) | S018, S040 |
| Great-grandmother (3-hop) | S019, S041, S044 |
| Aunt/uncle (sibling-of-parent) | S020, S021 |
| First cousins (בני דוד / primos) | S022, S042 |
| Siblings | S023 |
| In-law / former brothers-in-law (Rafi↔Leo) | S024 |
| Parent-of-partner / unknown | S033 |
| Pronoun continuity (עליה/עליו) | S031, S032, S041, S045 |
| Partner correctness (Yael ≠ friend) | S026, S027, S043 |
| Honesty NULL (friend-vs-family / unknown) | S028, S029, S030, S033 |
| Emotional-family gating (pride/worry/hurt) | S034, S035, S036 |
| Same-sex parents (Ofir+Gilad) | S025 |
| Count not list | S037, S038 |
| Spanish (≥4) | S039, S040, S041, S042 |
| English (≥2) | S043, S044 |

## MODEL GAPS FOUND: none
