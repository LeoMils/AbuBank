# Skill: Memory Update Protocol

## Purpose
Safely add new information to the memory system without creating duplicates, inconsistencies, or bloat.

## When to Use
When new facts about Martita, her family, or her preferences are discovered through conversation, user input, or code inspection.

## Steps
1. **Identify the fact type**: identity, family, preference, birthday, pattern, alias
2. **Check for duplicates**: Search aliases_and_names.yaml first to find canonical name
3. **Find the right file**:
   - Identity facts → martita_profile.yaml
   - Family relationships → family_graph.yaml
   - Name variants → aliases_and_names.yaml
   - Birthdays/dates → birthdays_registry.yaml
   - Writing patterns → whatsapp_patterns.yaml
   - Preferences → martita_profile.yaml (preferences section)
4. **Update, don't append blindly**: If an entry exists, update it. Don't create a second entry.
5. **Mark confidence**: confirmed / inferred / unknown
6. **Note source**: Where did this information come from?
7. **Minimize**: Only store if it materially improves product behavior.

## What NOT to Do
- Don't add to CLAUDE.md — it's for rules, not data.
- Don't create a new file for one fact — use existing files.
- Don't store raw WhatsApp messages — extract patterns instead.
- Don't store medical, financial, or address details.
- Don't invent dates or certainty.
