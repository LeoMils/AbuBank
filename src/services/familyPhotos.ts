// Pool of family photos — randomly selected per component mount.
// Photos live in /public/family/ with original filenames.

const PHOTOS = [
  '/family/FAmilly%201.JPG',
  '/family/FAmilly%202.PNG',
  '/family/FAmilly%203.PNG',
  '/family/FAmilly%204.PNG',
  '/family/FAmilly%205.PNG',
  '/family/FAmilly%206.JPG',
  '/family/FAmilly.JPG',
]

const FALLBACK = '/martita.jpg'

/** Returns a random family photo path */
export function getRandomFamilyPhoto(): string {
  return PHOTOS[Math.floor(Math.random() * PHOTOS.length)] ?? FALLBACK
}

/** Fallback handler for <img onError> — tries martita.jpg, then hides */
export function handleFamilyImgError(e: React.SyntheticEvent<HTMLImageElement>): void {
  const el = e.currentTarget
  if (!el.src.endsWith('/martita.jpg')) {
    el.src = '/martita.jpg'
  } else {
    el.style.display = 'none'
  }
}

// Gallery metadata for FamilyGallery screen
export interface FamilyMediaItem {
  src: string
  type: 'photo' | 'video'
  dominantColor: string
  caption: string
  description: string
  layout: 'full' | 'half'
}

export const FAMILY_GALLERY_ITEMS: FamilyMediaItem[] = [
  {
    src: '/family/FAmilly%206.JPG',
    type: 'photo',
    dominantColor: '#2a3040',
    caption: 'המשפחה במרפסת',
    description: 'כל המשפחה ביחד — רגע יפה על המרפסת עם נוף מדהים',
    layout: 'full',
  },
  {
    src: '/family/FAmilly%205.PNG',
    type: 'photo',
    dominantColor: '#3a4a3a',
    caption: 'שלושה דורות',
    description: 'Martita, הבן והנכד — שלושה דורות של אהבה במרפסת',
    layout: 'half',
  },
  {
    src: '/family/FAmilly%204.PNG',
    type: 'photo',
    dominantColor: '#2a3545',
    caption: 'סבא וסבתא עם הנכד',
    description: 'חיוכים מהלב — סבא, סבתא והנכד הקטן',
    layout: 'half',
  },
  {
    src: '/family/FAmilly%203.PNG',
    type: 'photo',
    dominantColor: '#1a2830',
    caption: 'שלישייה מחובקת',
    description: 'חיבוק משפחתי חם — שלושתם ביחד, ראש בראש',
    layout: 'full',
  },
  {
    src: '/family/FAmilly%202.PNG',
    type: 'photo',
    dominantColor: '#2a2018',
    caption: 'ערב רומנטי',
    description: 'סלפי של האב והאם — ערב יפה בחוץ',
    layout: 'half',
  },
  {
    src: '/family/FAmilly%201.JPG',
    type: 'photo',
    dominantColor: '#3a3530',
    caption: 'חברות אמיתית',
    description: 'שתי חברות מחייכות — רגע של שמחה ואהבה',
    layout: 'half',
  },
  {
    src: '/family/FAmilly.JPG',
    type: 'photo',
    dominantColor: '#1a2a28',
    caption: 'ערב במסעדה',
    description: 'ארוחת ערב רומנטית — הזוג במסעדה יפהפייה',
    layout: 'full',
  },
]
