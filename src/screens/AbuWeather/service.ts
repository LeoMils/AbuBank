// Open-Meteo — completely free, no API key needed
// Docs: https://open-meteo.com/en/docs

const BASE_URL = 'https://api.open-meteo.com/v1/forecast'

export const KFAR_SABA_LAT = 32.1781
export const KFAR_SABA_LNG = 34.9077

export interface CurrentWeather {
  temperature: number
  windspeed:   number
  weathercode: number
  is_day:      number   // 1 = day, 0 = night
  time:        string
}

export interface HourlyData {
  time:                       string[]
  temperature_2m:             number[]
  apparent_temperature:       number[]
  precipitation_probability:  number[]
  weathercode:                number[]
  windspeed_10m:              number[]
}

export interface DailyData {
  time:               string[]  // "YYYY-MM-DD"
  weathercode:        number[]
  temperature_2m_max: number[]
  temperature_2m_min: number[]
  precipitation_sum:  number[]
  sunrise:            string[]
  sunset:             string[]
}

export interface WeatherData {
  current_weather: CurrentWeather
  hourly:          HourlyData
  daily:           DailyData
}

export async function fetchWeather(
  lat = KFAR_SABA_LAT,
  lng = KFAR_SABA_LNG,
): Promise<WeatherData> {
  const params = new URLSearchParams({
    latitude:        lat.toString(),
    longitude:       lng.toString(),
    hourly:          'temperature_2m,apparent_temperature,precipitation_probability,weathercode,windspeed_10m',
    daily:           'weathercode,temperature_2m_max,temperature_2m_min,precipitation_sum,sunrise,sunset',
    current_weather: 'true',
    timezone:        'Asia/Jerusalem',
    forecast_days:   '4',
  })

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10000)
  try {
    const res = await fetch(`${BASE_URL}?${params}`, { signal: controller.signal })
    if (!res.ok) throw new Error(`שגיאה (${res.status})`)
    return (await res.json()) as WeatherData
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === 'AbortError')
      throw new Error('הבקשה נמשכה יותר מדי זמן. נסי שוב.')
    throw err
  } finally {
    clearTimeout(timeout)
  }
}

// ─── WMO code helpers ───────────────────────────────────────────────────────

export type WeatherMood =
  | 'sunny' | 'partlyCloudy' | 'cloudy' | 'foggy'
  | 'drizzle' | 'rain' | 'snow' | 'thunderstorm'

export function codeToMood(code: number): WeatherMood {
  if (code === 0)                    return 'sunny'
  if (code <= 2)                     return 'partlyCloudy'
  if (code === 3)                    return 'cloudy'
  if (code === 45 || code === 48)    return 'foggy'
  if (code >= 51 && code <= 57)      return 'drizzle'
  if (code >= 61 && code <= 67)      return 'rain'
  if (code >= 71 && code <= 77)      return 'snow'
  if (code >= 80 && code <= 82)      return 'rain'
  if (code >= 85 && code <= 86)      return 'snow'
  if (code >= 95)                    return 'thunderstorm'
  return 'cloudy'
}

export function codeToHebrew(code: number): string {
  if (code === 0)                    return 'שמיים בהירים'
  if (code === 1)                    return 'בהיר בעיקר'
  if (code === 2)                    return 'מעונן חלקית'
  if (code === 3)                    return 'מעונן'
  if (code === 45 || code === 48)    return 'ערפל'
  if (code === 51)                   return 'טפטוף קל'
  if (code === 53)                   return 'טפטוף'
  if (code === 55)                   return 'טפטוף כבד'
  if (code === 61)                   return 'גשם קל'
  if (code === 63)                   return 'גשם'
  if (code === 65)                   return 'גשם כבד'
  if (code >= 71 && code <= 77)      return 'שלג'
  if (code === 80)                   return 'מטר קל'
  if (code === 81)                   return 'מטר'
  if (code === 82)                   return 'מטר כבד'
  if (code === 95)                   return 'סופת רעמים'
  if (code >= 96)                    return 'סופת רעמים עם ברד'
  return 'מעונן'
}

export function codeToEmoji(code: number, isDay = true): string {
  if (code === 0)                    return isDay ? '☀️' : '🌙'
  if (code === 1)                    return isDay ? '🌤️' : '🌙'
  if (code === 2)                    return '⛅'
  if (code === 3)                    return '☁️'
  if (code === 45 || code === 48)    return '🌫️'
  if (code >= 51 && code <= 57)      return '🌦️'
  if (code >= 61 && code <= 67)      return '🌧️'
  if (code >= 71 && code <= 77)      return '❄️'
  if (code >= 80 && code <= 82)      return '🌧️'
  if (code >= 95)                    return '⛈️'
  return '🌤️'
}

// Colour representing a temperature (for bars and numbers)
export function tempColor(t: number): string {
  if (t <= 5)   return '#7DD3FA'
  if (t <= 12)  return '#38BDF8'
  if (t <= 18)  return '#34D399'
  if (t <= 24)  return '#FCD34D'
  if (t <= 30)  return '#FB923C'
  return '#EF4444'
}

// Sky gradient based on mood + time of day
export function skyGradient(mood: WeatherMood, isDay: boolean): string {
  if (!isDay) return 'linear-gradient(180deg, #020818 0%, #060e2e 45%, #0d1a48 100%)'
  switch (mood) {
    case 'sunny':
      return 'linear-gradient(180deg, #0b3d7a 0%, #1a6db5 28%, #3b8fd4 58%, #7ec8e3 82%, #b8e4f2 100%)'
    case 'partlyCloudy':
      return 'linear-gradient(180deg, #0f3e6e 0%, #1d6098 32%, #3a82bc 62%, #6aadce 100%)'
    case 'cloudy':
      return 'linear-gradient(180deg, #1c2d42 0%, #2d4460 38%, #3e5a78 65%, #5a7a92 100%)'
    case 'foggy':
      return 'linear-gradient(180deg, #2a3a4a 0%, #3d5060 40%, #5a6e7e 70%, #8a9ea8 100%)'
    case 'drizzle':
      return 'linear-gradient(180deg, #162a42 0%, #244464 36%, #3460880%, #4a7090 100%)'
    case 'rain':
      return 'linear-gradient(180deg, #0a1a30 0%, #172e50 35%, #264870 60%, #3a6088 100%)'
    case 'snow':
      return 'linear-gradient(180deg, #182638 0%, #28384e 40%, #3a5068 68%, #5a7080 100%)'
    case 'thunderstorm':
      return 'linear-gradient(180deg, #0a0a22 0%, #18103a 35%, #2a1a50 65%, #3c2268 100%)'
  }
}

// ─── Per-period Martita commentary ───────────────────────────────────────────

export interface TimePeriod {
  label:   string
  icon:    string
  hour:    string
  temp:    number
  appTemp: number
  code:    number
}

export function getTimePeriods(dayIso: string, hourly: HourlyData): TimePeriod[] {
  const PERIODS = [
    { label: 'בוקר',    icon: '🌅', hour: '07' },
    { label: 'צהריים',  icon: '🌞', hour: '13' },
    { label: 'ערב',     icon: '🌆', hour: '18' },
    { label: 'לילה',    icon: '🌙', hour: '22' },
  ]
  return PERIODS.map(p => {
    const target = `${dayIso}T${p.hour}:00`
    const idx = hourly.time.findIndex(t => t === target)
    return {
      ...p,
      temp:    idx >= 0 ? Math.round(hourly.temperature_2m[idx]     ?? 0) : 0,
      appTemp: idx >= 0 ? Math.round(hourly.apparent_temperature[idx] ?? 0) : 0,
      code:    idx >= 0 ? (hourly.weathercode[idx] ?? 0) : 0,
    }
  })
}

// Martita's full-day description paragraph
export function martitaDayDescription(
  maxTemp: number,
  minTemp: number,
  code: number,
  periods: TimePeriod[],
  dayLabel: string,
): string {
  const mood = codeToMood(code)
  const day  = dayLabel === 'היום' ? 'היום' : dayLabel === 'מחר' ? 'מחר' : dayLabel

  const morning = periods[0]!
  const noon    = periods[1]!
  const evening = periods[2]!

  const parts: string[] = []

  // Intro sentence
  if (mood === 'thunderstorm')
    parts.push(`${day} יהיה סוער ועם רעמים! ⛈️ מרטיטה, עדיף להישאר בבית וללא יציאה.`)
  else if (mood === 'rain')
    parts.push(`${day} יהיה גשום. ☂️ מטרייה בכיס — חובה!`)
  else if (mood === 'drizzle')
    parts.push(`${day} עם טפטוף קל. אפשר לצאת, אבל כדאי לקחת מטרייה קטנה.`)
  else if (mood === 'snow')
    parts.push(`${day} עם שלג! ❄️ מרטיטה, זה נדיר — תסתכלי מהחלון עם כוס חמה!`)
  else if (mood === 'foggy')
    parts.push(`${day} בוקר עם ערפל. ☁️ הנראות נמוכה — נסיעה בזהירות.`)
  else if (noon.temp >= 34)
    parts.push(`${day} — חום כבד! 🌡️ ${noon.temp}° בצהריים. מרטיטה, תשתי מים ולא לצאת בשיא החום.`)
  else if (noon.temp >= 28)
    parts.push(`${day} — יום חמים ושמשי. ☀️ ${noon.temp}° בצהריים. כיף, אבל תשמרי על שתייה.`)
  else if (noon.temp >= 22)
    parts.push(`${day} — מזג אוויר נעים ומושלם. 😊 טוב לצאת ולטייל עם Tutsi!`)
  else if (noon.temp >= 15)
    parts.push(`${day} — קצת קריר, אבל נעים. 🧥 תלבשי שכבה על עצמך.`)
  else
    parts.push(`${day} — קרר מרטיטה! ❄️ ${minTemp}° בלילה. יום לשמיכה ולתה חם.`)

  // Time-period details
  parts.push(``)
  parts.push(`🌅 בוקר (${morning.hour}:00) — ${morning.temp}°${morning.temp <= 16 ? ', קצת קריר. תלבשי ג\'קט.' : morning.temp >= 28 ? ', כבר חמים! שתי מים.' : ', נעים.'}`)
  parts.push(`🌞 צהריים — ${noon.temp}°${noon.temp >= 32 ? ' — חם מאוד! הישארי בצל.' : noon.temp >= 26 ? ' — חמים, אחלה יום.' : noon.temp < 15 ? ' — קריר, תישארי בפנים.' : ' — נחמד בחוץ.'}`)
  parts.push(`🌆 ערב (${evening.hour}:00) — ${evening.temp}°${evening.temp <= 16 ? '. מתקרר! קחי ג\'קט לפני שיוצאים.' : evening.temp >= 26 ? '. עדיין חמים בערב.' : '. מזג אוויר נעים לערב.'}`)

  return parts.join('\n')
}

// ─── Short personal briefing card (top of screen) ────────────────────────────

export type BriefingLevel = 'ok' | 'rain' | 'alert'

export interface Briefing {
  level:   BriefingLevel
  badge:   string   // short label e.g. "☔ גשם צפוי" | "⚠️ אזהרה" | "✅ בסדר גמור"
  message: string   // 1–2 warm sentences personal to Martita
}

export function martitaBriefing(
  maxTemp: number,
  minTemp: number,
  code:     number,
  rainSum:  number,
  dayLabel: string,
): Briefing {
  const mood = codeToMood(code)
  const day  = dayLabel === 'היום' ? 'היום'
             : dayLabel === 'מחר'  ? 'מחר'
             : `ב${dayLabel}`

  if (mood === 'thunderstorm') return {
    level:   'alert',
    badge:   '⛈️ סופת רעמים',
    message: `מרטיטה, ${day} יש ברקים ורעמים! עדיף להישאר בבית. אם חייבים לצאת — רק כשייפסק.`,
  }

  if (mood === 'rain') return {
    level:   'rain',
    badge:   '☔ גשם צפוי',
    message: `${day} יורד גשם, מרטיטה. לפני שיוצאים מהבית — מטרייה בידיים! ${rainSum > 5 ? 'גשם כבד, שווה לחכות.' : 'גשם בינוני.'}`,
  }

  if (mood === 'drizzle') return {
    level:   'rain',
    badge:   '🌦️ טפטוף',
    message: `${day} עם טפטוף, מרטיטה. מטרייה קטנה בתיק זה הכל מה שצריך. אפשר לצאת רגיל.`,
  }

  if (mood === 'snow') return {
    level:   'alert',
    badge:   '❄️ שלג',
    message: `שלג ${day}, מרטיטה! ${maxTemp}° בשיא. לבשי חם, הזהרי מחלקה בחוץ.`,
  }

  if (mood === 'foggy') return {
    level:   'rain',
    badge:   '🌫️ ערפל',
    message: `${day} בוקר עם ערפל, מרטיטה. בנסיעה תיזהרי — הנראות נמוכה. בהמשך היום מתבהר.`,
  }

  if (maxTemp >= 35) return {
    level:   'alert',
    badge:   '🌡️ חום כבד',
    message: `מרטיטה, ${day} חום כבד — ${maxTemp}°! לא לצאת בצהריים. מים כל הזמן, מנוחה בצל.`,
  }

  if (maxTemp >= 28) return {
    level:   'ok',
    badge:   '☀️ יום יפה',
    message: `${day} שמשי ונחמד, מרטיטה — ${maxTemp}° בשיא. אין גשם. יום מצוין לטייל עם Tutsi! ✅`,
  }

  if (maxTemp >= 20) return {
    level:   'ok',
    badge:   '🌤️ נעים',
    message: `מזג אוויר נעים ${day}, מרטיטה. ${maxTemp}° בשיא, ${minTemp}° בלילה. אין גשם — אפשר לצאת בנחת. ✅`,
  }

  if (maxTemp >= 12) return {
    level:   'ok',
    badge:   '🧥 קריר',
    message: `${day} קצת קריר, מרטיטה — ${maxTemp}°. תלבשי ג'קט לפני שיוצאים. אין גשם. ✅`,
  }

  return {
    level:   'alert',
    badge:   '🥶 קפוא',
    message: `${day} קר מאוד, מרטיטה! ${minTemp}° בלילה ו${maxTemp}° בשיא. יום של בית, שמיכה וקפה חם.`,
  }
}
