/*
 * AbuWhatsApp Family Contacts — local scaffold.
 *
 * This file is the ONLY place per-person phone/photo data lives for AbuWhatsApp.
 * It is consumed exclusively by the Family Bubble Board UI for direct user-initiated
 * WhatsApp / phone-call actions. It is NOT loaded into AbuAI prompts, NOT mirrored
 * into knowledge/* or memory/*, and NOT exported to any LLM context.
 *
 * To enable a person:
 *   1. Set `phoneE164` to a real E.164 number (e.g. "+972501234567").
 *   2. Optionally set `whatsappE164` if WhatsApp uses a different number.
 *   3. Optionally set `photoFile` to a real path under public/ that exists.
 *   4. Set `enabled: true`.
 *
 * The UI silently skips any entry where `enabled !== true` or `phoneE164` fails
 * the basic validator in familyQuickFaces.tsx.
 */

export type FamilyQuickFace =
  | {
      type: 'group'
      id: 'family-group'
      label: 'המשפחה'
      photoFile?: string
      whatsappUrl: string
      enabled: boolean
    }
  | {
      type: 'person'
      id: string
      displayName: string
      relationshipHebrew?: string
      phoneE164: string
      whatsappE164?: string
      photoFile?: string
      enabled: boolean
    }

const FAMILY_GROUP_WHATSAPP_URL = 'https://chat.whatsapp.com/JqqGpPKTCq3L0JnitU5y5f'

export const FAMILY_QUICK_FACES: ReadonlyArray<FamilyQuickFace> = [
  {
    type: 'group',
    id: 'family-group',
    label: 'המשפחה',
    whatsappUrl: FAMILY_GROUP_WHATSAPP_URL,
    enabled: true,
  },
  {
    type: 'person',
    id: 'mor',
    displayName: 'מור',
    relationshipHebrew: 'הבת',
    phoneE164: '+972545606084',
    whatsappE164: '+972545606084',
    enabled: true,
  },
  {
    type: 'person',
    id: 'leo',
    displayName: 'ליאו',
    relationshipHebrew: 'הבן שלך',
    phoneE164: '+972542555814',
    whatsappE164: '+972542555814',
    enabled: true,
  },
  {
    type: 'person',
    id: 'yael',
    displayName: 'יעל',
    relationshipHebrew: 'בת זוג של מור',
    phoneE164: '',
    enabled: false,
  },
  {
    type: 'person',
    id: 'raphi',
    displayName: 'רפי',
    relationshipHebrew: 'אבא של הנכדים',
    phoneE164: '+972505708900',
    whatsappE164: '+972505708900',
    enabled: true,
  },
  {
    type: 'person',
    id: 'ofir',
    displayName: 'אופיר',
    relationshipHebrew: 'נכד',
    phoneE164: '+972547966833',
    whatsappE164: '+972547966833',
    enabled: true,
  },
  {
    type: 'person',
    id: 'ayalon',
    displayName: 'איילון',
    relationshipHebrew: 'נכד',
    phoneE164: '+972545559167',
    whatsappE164: '+972545559167',
    enabled: true,
  },
  {
    type: 'person',
    id: 'eili',
    displayName: 'עילי',
    relationshipHebrew: 'נכד',
    phoneE164: '+972508558488',
    whatsappE164: '+972508558488',
    enabled: true,
  },
  {
    type: 'person',
    id: 'adar',
    displayName: 'אדר',
    relationshipHebrew: 'נכד',
    phoneE164: '+972546223557',
    whatsappE164: '+972546223557',
    enabled: true,
  },
  {
    type: 'person',
    id: 'adi',
    displayName: 'עדי',
    relationshipHebrew: 'נכדה',
    phoneE164: '+972524717646',
    whatsappE164: '+972524717646',
    enabled: true,
  },
  {
    type: 'person',
    id: 'noam',
    displayName: 'נועם',
    relationshipHebrew: 'נכד',
    phoneE164: '+972524733490',
    whatsappE164: '+972524733490',
    enabled: true,
  },
  {
    type: 'person',
    id: 'yarden',
    displayName: 'ירדן',
    relationshipHebrew: 'אשת עילי',
    phoneE164: '+972508825626',
    whatsappE164: '+972508825626',
    enabled: true,
  },
  {
    type: 'person',
    id: 'gilad',
    displayName: 'גלעד',
    relationshipHebrew: 'בן זוג של אופיר',
    phoneE164: '+972546816534',
    whatsappE164: '+972546816534',
    enabled: true,
  },
  {
    type: 'person',
    id: 'anabel',
    displayName: 'אנאבל',
    relationshipHebrew: 'נינה',
    phoneE164: '',
    enabled: false,
  },
  {
    type: 'person',
    id: 'ari',
    displayName: 'ארי',
    relationshipHebrew: 'נין',
    phoneE164: '',
    enabled: false,
  },
]
