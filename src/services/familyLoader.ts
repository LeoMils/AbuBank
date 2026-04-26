import familyRaw from '../../knowledge/family_data.json'

export interface FamilyMember {
  canonicalName: string
  hebrew: string
  aliases: string[]
  relationship: string
  relationshipHebrew: string
  spouse?: string
  children?: string[]
  notes?: string
  birthday?: string
  location?: string
  locationNotes?: string
}

interface FamilyJsonMember {
  canonical_name: string
  hebrew_name: string
  aliases?: string[]
  relationship: string
  relationship_hebrew: string
  spouse?: string
  partner?: string
  children?: string[]
  notes?: string
  birthday?: string
  location?: string
  location_notes?: string
  ex_spouse?: string
}

let _cache: FamilyMember[] | null = null

function toFamilyMember(m: FamilyJsonMember): FamilyMember {
  const result: FamilyMember = {
    canonicalName: m.canonical_name,
    hebrew: m.hebrew_name,
    aliases: [m.hebrew_name, ...(m.aliases ?? [])],
    relationship: m.relationship,
    relationshipHebrew: m.relationship_hebrew,
  }
  if (m.spouse && !m.relationship_hebrew.includes(m.spouse)) result.spouse = m.spouse
  if (m.children) result.children = m.children
  if (m.notes) result.notes = m.notes
  if (m.birthday) result.birthday = m.birthday
  if (m.location) result.location = m.location
  if (m.location_notes) result.locationNotes = m.location_notes
  return result
}

export function loadFamilyData(): FamilyMember[] {
  if (_cache) return _cache

  const f = familyRaw.family
  const members: FamilyMember[] = []

  // Matriarch
  if (f.matriarch) {
    members.push(toFamilyMember({
      ...f.matriarch,
      relationship_hebrew: 'סבתא',
    } as FamilyJsonMember))
  }

  // Deceased
  if (f.deceased) {
    members.push(toFamilyMember(f.deceased as FamilyJsonMember))
  }

  // Children
  for (const c of f.children ?? []) {
    members.push(toFamilyMember(c as FamilyJsonMember))
  }

  // Children-related (ex-spouses, partners)
  for (const c of f.children_related ?? []) {
    members.push(toFamilyMember(c as FamilyJsonMember))
  }

  // Grandchildren (Mor side)
  for (const g of f.grandchildren_mor ?? []) {
    members.push(toFamilyMember(g as FamilyJsonMember))
  }

  // Grandchildren (Leo side)
  for (const g of f.grandchildren_leo ?? []) {
    members.push(toFamilyMember(g as FamilyJsonMember))
  }

  // Grandchildren spouses
  for (const g of f.grandchildren_spouses ?? []) {
    members.push(toFamilyMember(g as FamilyJsonMember))
  }

  // Great-grandchildren
  for (const g of f.great_grandchildren ?? []) {
    members.push(toFamilyMember(g as FamilyJsonMember))
  }

  // Pets
  for (const p of f.pets ?? []) {
    members.push(toFamilyMember({
      canonical_name: p.canonical_name,
      hebrew_name: p.hebrew_name,
      aliases: p.aliases,
      relationship: 'pet',
      relationship_hebrew: p.notes ?? 'חיית מחמד',
      notes: p.notes,
    } as FamilyJsonMember))
  }

  // Close friends
  for (const fr of f.close_friends ?? []) {
    members.push(toFamilyMember(fr as FamilyJsonMember))
  }

  _cache = members
  return members
}

export function generateFamilyPromptSection(): string {
  const members = loadFamilyData()
  const children = members.filter(m => m.relationship === 'daughter' || m.relationship === 'son')
  const grandchildren = members.filter(m => m.relationship === 'grandson' || m.relationship === 'granddaughter')
  const greatGrandchildren = members.filter(m => m.relationship === 'great_granddaughter')
  const deceased = members.filter(m => m.relationship === 'husband_deceased')
  const friends = members.filter(m => m.relationship === 'close_friend' || m.relationship === 'family_friend')
  const pets = members.filter(m => m.relationship === 'pet')
  const partners = members.filter(m => m.relationship === 'daughter-partner' || m.relationship === 'daughter_partner')
  const exSpouses = members.filter(m => m.relationship === 'ex-son-in-law' || m.relationship === 'ex_son_in_law')

  const lines: string[] = ['═══ המשפחה שלה ═══']

  lines.push('ילדים:')
  for (const c of children) {
    lines.push(`• ${c.canonicalName} (${c.hebrew}) — ${c.relationshipHebrew}${c.notes ? '. ' + c.notes : ''}`)
  }

  if (partners.length > 0 || exSpouses.length > 0) {
    for (const p of partners) lines.push(`• ${p.canonicalName} (${p.hebrew}) — ${p.relationshipHebrew}`)
    for (const e of exSpouses) lines.push(`• ${e.canonicalName} (${e.hebrew}) — ${e.relationshipHebrew}`)
  }

  lines.push('')
  lines.push('נכדים:')
  for (const g of grandchildren) {
    const spouseStr = g.spouse ? `, ${g.relationship === 'grandson' ? 'נשוי' : 'נשואה'} ל${g.spouse}` : ''
    const childrenStr = g.children?.length ? `. ילדים: ${g.children.join(', ')}` : ''
    const notesStr = g.notes ? `. ${g.notes}` : ''
    lines.push(`• ${g.canonicalName} (${g.hebrew}) — ${g.relationshipHebrew}${spouseStr}${childrenStr}${notesStr}`)
  }

  if (greatGrandchildren.length > 0) {
    lines.push('')
    lines.push('נינות:')
    for (const gg of greatGrandchildren) {
      lines.push(`• ${gg.canonicalName} (${gg.hebrew}) — ${gg.relationshipHebrew}`)
    }
  }

  if (deceased.length > 0) {
    lines.push('')
    for (const d of deceased) lines.push(`בעל מנוח: ${d.canonicalName} (${d.hebrew}) — ${d.notes ?? ''}`)
  }

  const petNames = pets.map(p => `${p.canonicalName} (${p.hebrew})`).join(', ')
  if (petNames) lines.push(`חיות: ${petNames}`)

  const friendNames = friends.map(f => `${f.canonicalName} (${f.hebrew})`).join(', ')
  if (friendNames) lines.push(`חברות: ${friendNames}`)

  return lines.join('\n')
}
