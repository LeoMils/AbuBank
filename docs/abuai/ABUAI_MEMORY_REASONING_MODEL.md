# ABUAI_MEMORY_REASONING_MODEL

**Stage 2 (READ-STATE) and the write half of Stage 7 (REMEMBER).** Subordinate to
[[ABUAI_COGNITIVE_MODEL]]. How AbuAI *remembers* — because memory is the substance of warmth.
A companion who forgets is not a companion.

---

## 1. Three tiers of memory

| Tier | Horizon | Holds | Cleared by |
|------|---------|-------|-----------|
| **Working** | this turn ↔ next | `SessionState` (last_person/topic/mood, emotional_context, open_loops, topic_graph) | "clear conversation" |
| **Episodic** | days–weeks | events in Martita's life ("נועם נסע לבואנוס איירס", "היה רופא ביום ג'") | decay (§4) / correction |
| **Semantic** | permanent | who the family is, her routines, preferences, Papi | source-of-truth edits only |

**Semantic memory** = `knowledge/family_data.json` + `martita_personality.yaml` (graph, routines,
Tutsi, Shabbat dinners, Argentine roots). It is **read, never written** by conversation.
**Episodic + working** are conversational memory and are the new build surface.

## 2. Write policy — what is worth remembering (answers "how AbuAI decides")

Remember only what **changes future behavior or warmth**. Write an episodic memory when:
- it names a **person event** ("מור עברה דירה", "עדי מתחתן"),
- it states a **preference or plan** ("רוצה לקבוע עם מור", "לא אוהבת את הרופא הזה"),
- it carries **emotional weight** (a fear, a pride, a grief moment),
- it opens a **loop** (an intention not yet closed).

Do **not** store: idle chit-chat, the literal transcript, anything medical/financial (privacy law),
phone numbers, street address. Abstract to the minimum that improves the relationship
(Privacy rule: "close friend", not a dossier).

## 3. Recall triggers — when memory surfaces

- **Pronoun / continuity**: `last_person`/`last_topic` resolve references (Conversation Engine §4).
- **Entity re-mention**: a name returns → pull its episodic facts to enrich a rich-mode answer.
- **Open-loop due**: time passes or a trigger entity appears → LEAD to close the loop
  ("אמרת שתתקשרי למור — דיברתן?").
- **Mood echo**: `emotional_context` persists across turns so AbuAI doesn't "reset" her tone.
- **Recap request**: "מה אמרתי קודם?" → natural prose from `turn_history`, never a log.

## 4. Decay & correction

- Episodic facts **decay** on a concrete **salience horizon** (closes the decay-horizon gap):
  - **foreground** (~0–14 days, or any age if reinforced ≥2×) — eligible to be volunteered in a LEAD.
  - **background** (~15–30 days, single mention) — recalled only if she raises the entity/topic.
  - **archived** (>30 days, unreinforced) — retained but not surfaced proactively.
  Each new mention or correction resets the fact to foreground and increments its reinforcement count.
  **Salience decay ≠ deletion.** Decay only governs what AbuAI *volunteers*; durability (§6) keeps the
  fact in the store and recallable on direct ask regardless of age. AbuAI prefers recent, reinforced
  memories when leading.
- **Correction wins**: if Martita corrects a fact ("לא, נועם בהרצליה"), the new value overrides and
  the old is retired. Never argue with her about her own life.
- **Memory worry**: if she repeats a question, treat as possible memory anxiety — answer gently and
  **never** point out that she already asked.

## 5. Mood persistence (the anti-reset rule)

`emotional_context` is sticky (Conversation Engine §4): grief or loneliness set in one turn colors the
next turns until a genuine shift. This is what stops AbuAI from cheerfully pivoting to trivia ten
seconds after Martita said she misses Papi.

## 6. Durability & truth (implementation mandate, not optional)

- Working memory may live in session; **episodic memory must be durable** (survive reload, origin
  change) — current localStorage-only storage is a known defect; the cognitive model requires a
  durable, versioned store with export/import. A companion that forgets everything on refresh fails §0 thesis.
- Memory is **grounded**: AbuAI never "remembers" something that wasn't said or stored. A fabricated
  memory is the same sin as a fabricated fact (Cognitive Model §2, Principle 3).

## 7. How memory produces warmth & initiative

- Warmth = recalling the specific ("ראית שנועם חזר?") over the generic ("איזה יופי").
- Initiative = surfacing a remembered loop at the right moment (Decision Tree §Lead).
- Continuity = the felt sense that AbuAI was *here yesterday too* — the core of being a companion.
