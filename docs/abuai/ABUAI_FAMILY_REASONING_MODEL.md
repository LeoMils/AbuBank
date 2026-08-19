# ABUAI_FAMILY_REASONING_MODEL

**Stage 5 (REASON) for family.** Subordinate to [[ABUAI_COGNITIVE_MODEL]].
How AbuAI *reasons* about family — not how she stores it.

Source of truth: `knowledge/family_data.json` → in-memory graph (`familyGraph.ts`).
**Truth is grounded here; never guessed by the LLM** (Cognitive Model §2, Principle 3).

---

## 1. Family as cognition, not lookup

A lookup returns a stored string ("מור — הבת"). Cognition **traverses relationships** and **decides
how much to say**. Family reasoning has three sub-decisions on every family turn:

1. **Is family even the frame?** If EMOTION dominates (Decision Tree §1), family is *suppressed*.
   "אני דואגת למור" is worry, not a relationship query — REFLECT, do not describe Mor.
2. **What relation/identity is being asked?** Resolve via the graph.
3. **At what depth?** Concise vs rich — driven by the verb and the need (§3 below).

## 2. The relational graph (what it can infer)

Bidirectional edges: parent↔child, spouse/partner/ex (symmetric), with structural backfill
(matriarch→children, ex-father→children, same-sex parents→great-grandchildren). The resolver
walks edges in priority order and emits a **human kinship label**, never a path:

1. spouse / partner / ex
2. parent ↔ child
3. siblings (shared parent)
4. in-law (sibling-of-spouse) — "former brothers-in-law"
5. parent-of-spouse (mother/father-in-law)
6. **aunt / uncle** (sibling of a parent) — *added RC5*
7. **first cousins** (parents are siblings) — *added RC5*
8. **ancestor at any depth** — grandparent (2 hops), great-grandparent (3 hops) — *generalized RC5*

Gender drives the Hebrew/Spanish label (סבתא/סבא, דודה/דוד, בנות/בני דוד, abuela/abuelo,
bisabuela, tía/tío, primas/primos). **Honesty contract:** no representable path → return NULL →
AbuAI says "אין קשר ישיר", never invents one. Friends (Mirta, Shoshana, Sharon) are **not** family
and must resolve NULL against family members.

> Inference, not memorization: "מי סבתא רבתא של אנאבל?" is computed (Martita→Mor→Ofir→Anabel),
> not stored. This is the difference between a mind and a table.

## 3. Depth decision — concise vs rich (the verb tells you)

| Trigger | Depth | Shape |
|---------|-------|-------|
| "מי זאת X?" | **concise** | role + ONE anchor: "מור, הבת שלך. בהוד השרון עם יעל." |
| "ספרי לי על X" | **rich** | location + context + recent/known detail; *must differ* from the concise answer |
| relation Q ("מי אמא של X", "מי בת הזוג של X") | **single fact** | the inferred relation, one line |
| pronoun ("ספרי עליה") | continue `last_person` | rich, picking a *new* facet (no repeat) |

Never dump the whole record. Never read a comma-list of four children as "1… 2… 3…" in voice —
say "ארבעה ילדים" and name them only if asked.

## 4. Emotional gating (the Papi rule, generalized)

Before any family reasoning runs, check `emotional_context` (Conversation Engine §4):
- If grief/longing about a person is active → **skip the lookup**, hold the feeling. "אני מתגעגעת
  לפאפי" → presence, not a profile, never a date, always "פאפי".
- Pride/joy about a person → reflect the joy first, *then* optionally add a known warm detail.
- Worry about a person → reassure/engage; offer a concrete bridge ("רוצה שנשלח לה הודעה?") only
  if she's open.

## 5. Special people & rules

- **Papi/פאפי** — deceased; always "פאפי" (never פפה/פאפא); emotional dignity; memorial tone gentle.
  *(Open data issue: memorial date 01-01 in JSON vs 12-26 in rules — human decision pending; the
  cognitive model does not pick a date.)*
- **Mor** — central; "מי זאת" vs "ספרי על" must yield different answers (Identity Spec §7.1/7.3).
- **Yael** — Mor's partner, **family**, never "friend."
- **Same-sex parents** (Ofir+Gilad → Anabel, Ari) reason normally; both are parents.
- **Twins** (Adi, Noam) — siblings; cousins of Mor's children.

## 6. Integration with other engines

- Family ↔ calendar: a person in a calendar event triggers an offer bridge (Conversation Engine §5).
- Family ↔ memory: episodic facts ("נועם נסע לבואנוס איירס") enrich rich-mode answers and feed leads.
- Family answer always updates `last_person` for pronoun continuity.
