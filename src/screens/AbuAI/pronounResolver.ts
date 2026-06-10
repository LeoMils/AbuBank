/*
 * Cross-turn pronoun resolver for AbuAI conversations.
 *
 * When the user says "תזכירי לי להתקשר אליו" after talking about Noam,
 * this module resolves "אליו" → "נועם" by scanning recent messages for
 * the last mentioned family member.
 *
 * Pure function — no side effects, no API calls.
 */

import { loadGraph, type GraphNode } from './familyGraph'

// Hebrew pronoun patterns that refer to a previously mentioned person.
// Captures: אליו/אליה/לו/לה/שלו/שלה/אותו/אותה/איתו/איתה
const HE_PRONOUN = /(?<![֐-׿])(אליו|אליה|לו|לה|שלו|שלה|אותו|אותה|איתו|איתה)(?![֐-׿])/

// Gender from pronoun
function pronounGender(pronoun: string): 'male' | 'female' {
  return /אליה|לה|שלה|אותה|איתה/.test(pronoun) ? 'female' : 'male'
}

/**
 * Find the last family member mentioned in recent messages.
 * Scans user + assistant messages from newest to oldest.
 * Returns the Hebrew name of the most recently mentioned person,
 * filtered by gender if a pronoun is specified.
 */
export function findLastMentionedPerson(
  messages: Array<{ content: string }>,
  gender?: 'male' | 'female',
): string | null {
  const graph = loadGraph()
  // Build a set of all Hebrew names for fast lookup
  const nameToNode = new Map<string, GraphNode>()
  for (const node of graph) {
    nameToNode.set(node.hebrew, node)
    for (const alias of node.aliases) {
      if (/[֐-׿]/.test(alias)) nameToNode.set(alias, node)
    }
  }

  // Pass 1: Scan USER messages from newest to oldest (highest priority —
  // the user explicitly mentioned this person).
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i]!
    if ((msg as { role?: string }).role !== 'user') continue
    for (const [name, node] of nameToNode) {
      if (msg.content.includes(name)) {
        if (gender && node.gender !== gender) continue
        return node.hebrew
      }
    }
  }

  // Pass 2: Scan ALL messages (including assistant responses that mention
  // names) as fallback — e.g. when the user never typed the name but the
  // assistant mentioned it.
  for (let i = messages.length - 1; i >= 0; i--) {
    const content = messages[i]!.content
    for (const [name, node] of nameToNode) {
      if (content.includes(name)) {
        if (gender && node.gender !== gender) continue
        return node.hebrew
      }
    }
  }
  return null
}

/**
 * If the user's text contains a pronoun reference (אליו, שלה, etc.),
 * resolve it to a family member name from conversation history.
 * Returns the text with the pronoun replaced, or the original text
 * if no resolution is possible.
 */
export function resolvePronouns(
  text: string,
  recentMessages: Array<{ content: string }>,
): { resolved: string; personName: string | null } {
  const match = text.match(HE_PRONOUN)
  if (!match) return { resolved: text, personName: null }

  const pronoun = match[1]!
  const gender = pronounGender(pronoun)
  const person = findLastMentionedPerson(recentMessages, gender)

  if (!person) return { resolved: text, personName: null }

  // Replace pronoun with the resolved name
  // "להתקשר אליו" → "להתקשר לנועם"
  // "יום ההולדת שלה" → "יום ההולדת של מור"
  const replacements: Record<string, string> = {
    'אליו': `ל${person}`,
    'אליה': `ל${person}`,
    'לו': `ל${person}`,
    'לה': `ל${person}`,
    'שלו': `של ${person}`,
    'שלה': `של ${person}`,
    'אותו': `את ${person}`,
    'אותה': `את ${person}`,
    'איתו': `עם ${person}`,
    'איתה': `עם ${person}`,
  }

  const replacement = replacements[pronoun] ?? person
  const resolved = text.replace(HE_PRONOUN, replacement)
  return { resolved, personName: person }
}
