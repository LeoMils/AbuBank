// Pool of Martita photos — randomly selected per component mount.
// Photos live in /public/martita/ with original filenames.

const PHOTOS = [
  '/martita/Martita%201.JPG',
  '/martita/Martita%202.jpg',
  '/martita/Martita%203.JPG',
  '/martita/Martita%204.JPG',
  '/martita/Martita%205.JPG',
  '/martita/Martita%206.JPG',
  '/martita/Martita%207.JPG',
  '/martita/Martita%208.JPG',
  '/martita/Martita%209.JPG',
  '/martita/Martita%2010.JPG',
  '/martita/Martita%2011.JPG',
  '/martita/Martita%2012.JPG',
  '/martita/Martita%2013.JPG',
  '/martita/Martita%2014.JPG',
  '/martita/Martita%2015.JPG',
  '/martita/Martita%2016.JPG',
  '/martita/Martita%2017.JPG',
  '/martita/Martita%2018.JPG',
  '/martita/Martita%2019.JPG',
  '/martita/Martita%2020.JPG',
  '/martita/Martita%2021.JPG',
  '/martita/Martita%2022.JPG',
  '/martita/Martita%2023.jpg',
  '/martita/Martita%2024.jpg',
  '/martita/Martita%2026.JPG',
]

const FAMILY_PHOTOS = [
  '/family/family1.jpg',
  '/family/family2.jpg',
  '/family/family3.jpg',
]

const FALLBACK = '/martita.jpg'

/** Returns a random Martita photo path */
export function getRandomMartitaPhoto(): string {
  return PHOTOS[Math.floor(Math.random() * PHOTOS.length)] ?? FALLBACK
}

/** Fallback handler for <img onError> — tries martita.jpg, then hides */
export function handleMartitaImgError(e: React.SyntheticEvent<HTMLImageElement>): void {
  const el = e.currentTarget
  if (!el.src.endsWith('/martita.jpg')) {
    el.src = '/martita.jpg'
  } else {
    el.style.display = 'none'
  }
}
