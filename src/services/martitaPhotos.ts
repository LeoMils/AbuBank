// Pool of Martita photos — randomly selected per component mount.
// Add photos as: /martita.jpg, /martita-2.jpg ... /martita-11.jpg

const PHOTOS = [
  '/martita.jpg',
  '/martita-2.jpg',
  '/martita-3.jpg',
  '/martita-4.jpg',
  '/martita-5.jpg',
  '/martita-6.jpg',
  '/martita-7.jpg',
  '/martita-8.jpg',
  '/martita-9.jpg',
  '/martita-10.jpg',
  '/martita-11.jpg',
]

const FALLBACK = '/martita.jpg'

/** Returns a random Martita photo path. Falls back to martita.jpg if only one exists. */
export function getRandomMartitaPhoto(): string {
  return PHOTOS[Math.floor(Math.random() * PHOTOS.length)] ?? FALLBACK
}

/** Fallback handler for <img onError> — tries martita.jpg, then hides */
export function handleMartitaImgError(e: React.SyntheticEvent<HTMLImageElement>): void {
  const el = e.currentTarget
  if (!el.src.endsWith('/martita.jpg') && !el.src.endsWith('/martita.png')) {
    el.src = '/martita.jpg'
  } else if (el.src.endsWith('/martita.jpg')) {
    el.src = '/martita.png'
  } else {
    el.style.display = 'none'
  }
}
