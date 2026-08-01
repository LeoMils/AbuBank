/*
 * Client-side contact-photo processing. 100% on-device: decode → normalize
 * orientation (EXIF) → resize → JPEG-compress → data URL. A contact photo NEVER
 * leaves the device: no network, no external provider, no telemetry.
 *
 * The pure helpers (validateImageFile, approxDataUrlBytes) are unit-tested in
 * node; the canvas/bitmap path (resizeImageToDataUrl) is browser-only and is
 * exercised by the built-app browser tests with a synthetic image.
 */

/** Reject absurd inputs before we even decode (sanity, not the stored cap). */
export const MAX_INPUT_IMAGE_BYTES = 25 * 1024 * 1024 // 25 MB
/** Longest edge of the stored photo — mobile-safe, crisp in an 80px bubble. */
export const CONTACT_PHOTO_MAX_DIM = 320
/** Starting JPEG quality; lowered adaptively if the result is still too big. */
export const CONTACT_PHOTO_QUALITY = 0.82
/** Hard cap on the STORED data-URL (keeps localStorage well under quota). */
export const CONTACT_PHOTO_MAX_BYTES = 600 * 1024 // ~600 KB

export type ImageValidation = { ok: true } | { ok: false; error: string }

/** Validate a picked file is an image of sane size (plain-Hebrew errors). */
export function validateImageFile(file: { type?: string; size?: number } | null | undefined): ImageValidation {
  if (!file) return { ok: false, error: 'לא נבחר קובץ' }
  if (typeof file.type !== 'string' || !file.type.startsWith('image/')) {
    return { ok: false, error: 'הקובץ שנבחר אינו תמונה' }
  }
  if (typeof file.size === 'number' && file.size > MAX_INPUT_IMAGE_BYTES) {
    return { ok: false, error: 'התמונה גדולה מדי (מעל 25MB). בחרי תמונה קטנה יותר.' }
  }
  return { ok: true }
}

/** Approximate the decoded byte size of a base64 data URL. */
export function approxDataUrlBytes(dataUrl: string): number {
  const comma = dataUrl.indexOf(',')
  const b64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl
  // 4 base64 chars → 3 bytes; ignore padding for an approximation.
  return Math.floor((b64.length * 3) / 4)
}

export interface ResizeOptions {
  maxDim?: number
  quality?: number
  maxBytes?: number
}

interface Drawable { src: CanvasImageSource; w: number; h: number; close?: () => void }

/**
 * Decode an image file to a drawable source, tolerant across engines:
 *  1. createImageBitmap with EXIF orientation (best — Chromium),
 *  2. createImageBitmap without options (some engines reject the option bag),
 *  3. an <img> element (most portable — Safari; modern browsers auto-orient).
 * Throws a specific Hebrew error only if every path fails.
 */
async function decodeDrawable(file: Blob): Promise<Drawable> {
  try {
    const bm = await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions)
    return { src: bm, w: bm.width, h: bm.height, close: () => bm.close?.() }
  } catch { /* try next */ }
  try {
    const bm = await createImageBitmap(file)
    return { src: bm, w: bm.width, h: bm.height, close: () => bm.close?.() }
  } catch { /* try next */ }
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.decoding = 'async'
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error('decode'))
      img.src = url
    })
    return { src: img, w: img.naturalWidth || img.width || 1, h: img.naturalHeight || img.height || 1, close: () => URL.revokeObjectURL(url) }
  } catch {
    URL.revokeObjectURL(url)
    throw new Error('לא הצלחתי לפתוח את התמונה. ייתכן שהקובץ פגום.')
  }
}

/**
 * Resize + compress an image file to a device-local JPEG data URL. Applies EXIF
 * orientation where the engine supports it, so iPhone photos are not sideways.
 * Throws a specific Hebrew Error on a decode failure or if the image cannot be
 * shrunk under the cap — the caller keeps the existing contact untouched.
 * Browser-only (needs canvas).
 */
export async function resizeImageToDataUrl(file: Blob, opts: ResizeOptions = {}): Promise<string> {
  const maxDim = opts.maxDim ?? CONTACT_PHOTO_MAX_DIM
  const startQuality = opts.quality ?? CONTACT_PHOTO_QUALITY
  const maxBytes = opts.maxBytes ?? CONTACT_PHOTO_MAX_BYTES

  const drawable = await decodeDrawable(file)
  try {
    const longest = Math.max(drawable.w, drawable.h) || 1
    const scale = Math.min(1, maxDim / longest)
    const w = Math.max(1, Math.round(drawable.w * scale))
    const h = Math.max(1, Math.round(drawable.h * scale))
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('לא ניתן לעבד את התמונה במכשיר הזה.')
    // White matte so a transparent PNG doesn't become a black JPEG square.
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, w, h)
    ctx.drawImage(drawable.src, 0, 0, w, h)
    let q = startQuality
    let dataUrl = canvas.toDataURL('image/jpeg', q)
    while (approxDataUrlBytes(dataUrl) > maxBytes && q > 0.4) {
      q = Math.max(0.4, q - 0.15)
      dataUrl = canvas.toDataURL('image/jpeg', q)
    }
    if (approxDataUrlBytes(dataUrl) > maxBytes) {
      throw new Error('לא הצלחתי להקטין את התמונה מספיק. נסי תמונה אחרת.')
    }
    return dataUrl
  } finally {
    drawable.close?.()
  }
}
