import { useState, useEffect, useCallback, useMemo } from 'react'
import { useAppStore } from '../../state/store'
import { Screen } from '../../state/types'
import { BackButton } from '../../components/BackButton'
import { getRandomMartitaPhoto, handleMartitaImgError } from '../../services/martitaPhotos'
import {
  fetchWeather,
  codeToMood,
  codeToHebrew,
  codeToEmoji,
  tempColor,
  skyGradient,
  getTimePeriods,
  martitaDayDescription,
  martitaBriefing,
  type WeatherData,
  type WeatherMood,
  type TimePeriod,
  type Briefing,
} from './service'

// ─── Animated overlays ───────────────────────────────────────────────────────

const RAIN_DROPS = Array.from({ length: 26 }, (_, i) => ({
  left:  `${(i * 3.9) % 100}%`,
  delay: `${((i * 0.11) % 1.6).toFixed(2)}s`,
  height: 14 + (i % 5) * 3,
  opacity: 0.45 + (i % 3) * 0.15,
}))

function RainOverlay({ heavy }: { heavy?: boolean }) {
  return (
    <div style={{ position:'absolute', inset:0, pointerEvents:'none', overflow:'hidden', zIndex:1 }}>
      {RAIN_DROPS.map((d, i) => (
        <div key={i} style={{
          position:'absolute', left:d.left, top:-20,
          width: heavy ? 2 : 1.5,
          height: d.height,
          background: 'rgba(147,210,253,0.65)',
          borderRadius: 2,
          transform: 'rotate(12deg)',
          opacity: d.opacity,
          animation: `wxRain ${heavy ? 0.9 : 1.3}s ${d.delay} linear infinite`,
        }}/>
      ))}
    </div>
  )
}

const SNOW_FLAKES = Array.from({ length: 18 }, (_, i) => ({
  left:  `${(i * 5.6) % 98}%`,
  delay: `${((i * 0.22) % 3).toFixed(2)}s`,
  size:  4 + (i % 4) * 2,
}))

function SnowOverlay() {
  return (
    <div style={{ position:'absolute', inset:0, pointerEvents:'none', overflow:'hidden', zIndex:1 }}>
      {SNOW_FLAKES.map((f, i) => (
        <div key={i} style={{
          position:'absolute', left:f.left, top:-10,
          width:f.size, height:f.size, borderRadius:'50%',
          background:'rgba(224,242,254,0.85)',
          animation:`wxSnow 3.5s ${f.delay} ease-in infinite`,
        }}/>
      ))}
    </div>
  )
}

const STARS = Array.from({ length: 30 }, (_, i) => ({
  left:  `${(i * 3.37 + 2) % 96}%`,
  top:   `${(i * 6.11 + 4) % 55}%`,
  size:  1.5 + (i % 3),
  delay: `${((i * 0.3) % 2.5).toFixed(1)}s`,
}))

function StarsOverlay() {
  return (
    <div style={{ position:'absolute', inset:0, pointerEvents:'none', zIndex:1 }}>
      {STARS.map((s, i) => (
        <div key={i} style={{
          position:'absolute', left:s.left, top:s.top,
          width:s.size, height:s.size, borderRadius:'50%',
          background:'rgba(255,255,255,0.90)',
          animation:`wxStar ${2.2 + (i%3)*0.6}s ${s.delay} ease-in-out infinite`,
        }}/>
      ))}
    </div>
  )
}

// Rotating golden rays for sunny
function SunRaysOverlay() {
  return (
    <div style={{
      position:'absolute', top:'50%', left:'50%',
      width:260, height:260,
      marginTop:-130, marginLeft:-130,
      pointerEvents:'none', zIndex:0,
      animation:'wxSunRot 28s linear infinite',
    }}>
      {Array.from({ length: 12 }, (_, i) => (
        <div key={i} style={{
          position:'absolute', top:'50%', left:'50%',
          width:2, height:100,
          marginLeft:-1, marginTop:-110,
          background:'linear-gradient(to top, rgba(253,211,77,0.25), transparent)',
          borderRadius:2,
          transform:`rotate(${i * 30}deg)`,
          transformOrigin:'50% 110px',
        }}/>
      ))}
    </div>
  )
}

// ─── Weather hero icon (large, animated) ─────────────────────────────────────

function WeatherHeroIcon({ mood, emoji, isDay }: {
  mood: WeatherMood; emoji: string; isDay: boolean
}) {
  const glow: Record<WeatherMood, string> = {
    sunny:        '0 0 60px rgba(253,211,77,0.60), 0 0 120px rgba(253,211,77,0.25)',
    partlyCloudy: '0 0 40px rgba(147,197,253,0.40), 0 0 80px rgba(147,197,253,0.15)',
    cloudy:       '0 0 30px rgba(148,163,184,0.30)',
    foggy:        '0 0 30px rgba(203,213,225,0.25)',
    drizzle:      '0 0 40px rgba(56,189,248,0.35)',
    rain:         '0 0 50px rgba(14,165,233,0.45)',
    snow:         '0 0 40px rgba(224,242,254,0.50)',
    thunderstorm: '0 0 60px rgba(167,139,250,0.55), 0 0 20px rgba(255,255,255,0.30)',
  }
  return (
    <div style={{
      fontSize: 110,
      lineHeight: 1,
      filter: `drop-shadow(${glow[mood].replace('0 0', '0px 0px').split(', ')[0]})`,
      animation: 'wxFloat 4s ease-in-out infinite',
      userSelect: 'none',
      position: 'relative', zIndex: 2,
    }}>
      {emoji}
    </div>
  )
}

// ─── Personal briefing card (top of content) ─────────────────────────────────

function BriefingCard({ briefing }: { briefing: Briefing }) {
  const isAlert = briefing.level === 'alert'
  const isRain  = briefing.level === 'rain'

  const bg     = isAlert ? 'rgba(239,68,68,0.14)'
               : isRain  ? 'rgba(56,189,248,0.13)'
               :            'rgba(52,211,153,0.10)'

  const border = isAlert ? '1.5px solid rgba(239,68,68,0.50)'
               : isRain  ? '1.5px solid rgba(56,189,248,0.48)'
               :            '1.5px solid rgba(52,211,153,0.38)'

  const badgeColor = isAlert ? '#EF4444'
                   : isRain  ? '#38BDF8'
                   :            '#34D399'

  const badgeBg    = isAlert ? 'rgba(239,68,68,0.18)'
                   : isRain  ? 'rgba(56,189,248,0.15)'
                   :            'rgba(52,211,153,0.14)'

  return (
    <div style={{
      margin: '14px 20px 0',
      padding: '16px 18px',
      borderRadius: 22,
      background: bg,
      border: border,
      display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      {/* Badge */}
      <div style={{
        display: 'inline-flex', alignItems: 'center', alignSelf: 'flex-start',
        padding: '4px 12px', borderRadius: 20,
        background: badgeBg,
      }}>
        <span style={{
          fontSize: 12, fontWeight: 800,
          color: badgeColor,
          fontFamily: "'Heebo',sans-serif",
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
        }}>
          {briefing.badge}
        </span>
      </div>

      {/* Message */}
      <div style={{
        fontSize: 17, lineHeight: 1.65,
        color: 'rgba(255,255,255,0.93)',
        fontFamily: "'Heebo',sans-serif",
        fontWeight: 500,
        direction: 'rtl',
      }}>
        {briefing.message}
      </div>
    </div>
  )
}

// ─── Temperature range bar ───────────────────────────────────────────────────

function TempRangeBar({ min, max, current }: { min: number; max: number; current: number }) {
  const range  = Math.max(max - min, 1)
  const pct    = Math.min(100, Math.max(0, ((current - min) / range) * 100))
  const minCol = tempColor(min)
  const maxCol = tempColor(max)
  const curCol = tempColor(current)
  return (
    <div style={{ padding: '0 20px', marginTop: 8 }}>
      <div style={{
        background:'rgba(255,255,255,0.06)',
        border:'1px solid rgba(255,255,255,0.10)',
        borderRadius:20, padding:'16px 18px',
      }}>
        <div style={{
          display:'flex', alignItems:'center', justifyContent:'space-between',
          marginBottom:10,
        }}>
          <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-start', gap:2 }}>
            <span style={{ fontSize:11, color:'rgba(255,255,255,0.40)', fontFamily:"'Heebo',sans-serif" }}>מינימום</span>
            <span style={{ fontSize:22, fontWeight:700, color:minCol, fontFamily:"'Heebo',sans-serif" }}>{min}°</span>
          </div>
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:2 }}>
            <span style={{ fontSize:11, color:'rgba(255,255,255,0.40)', fontFamily:"'Heebo',sans-serif" }}>עכשיו</span>
            <span style={{ fontSize:26, fontWeight:800, color:curCol, fontFamily:"'Heebo',sans-serif", letterSpacing:'-0.02em' }}>{current}°</span>
          </div>
          <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:2 }}>
            <span style={{ fontSize:11, color:'rgba(255,255,255,0.40)', fontFamily:"'Heebo',sans-serif" }}>מקסימום</span>
            <span style={{ fontSize:22, fontWeight:700, color:maxCol, fontFamily:"'Heebo',sans-serif" }}>{max}°</span>
          </div>
        </div>
        {/* Gradient bar */}
        <div style={{ position:'relative', height:10, borderRadius:5, overflow:'visible' }}>
          <div style={{
            position:'absolute', inset:0, borderRadius:5,
            background:`linear-gradient(90deg, ${minCol}, ${tempColor((min+max)/2)}, ${maxCol})`,
          }}/>
          {/* Current temp marker */}
          <div style={{
            position:'absolute', top:'50%',
            left:`${pct}%`, transform:'translate(-50%,-50%)',
            width:20, height:20, borderRadius:'50%',
            background:'white',
            border:`3px solid ${curCol}`,
            boxShadow:`0 0 10px ${curCol}80`,
            zIndex:2,
            transition:'left 0.5s ease',
          }}/>
        </div>
      </div>
    </div>
  )
}

// ─── Time-of-day card ─────────────────────────────────────────────────────────

function TimeCard({ period, accent }: { period: TimePeriod; accent: string }) {
  const col = tempColor(period.temp)
  const isNight = period.hour === '22'
  return (
    <div style={{
      display:'flex', flexDirection:'column', alignItems:'center', gap:6,
      padding:'14px 16px', borderRadius:20, minWidth:88, flexShrink:0,
      background: `linear-gradient(160deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.06) 100%)`,
      border:`1px solid ${accent}30`,
      backdropFilter:'blur(8px)',
      boxShadow: `0 4px 16px rgba(0,0,0,0.25), 0 0 10px ${accent}14`,
    }}>
      <span style={{ fontSize:12, fontWeight:700, color:'rgba(255,255,255,0.55)',
        fontFamily:"'Heebo',sans-serif", letterSpacing:'0.04em' }}>
        {period.label}
      </span>
      <span style={{ fontSize:28, lineHeight:1 }}>
        {codeToEmoji(period.code, !isNight)}
      </span>
      <span style={{ fontSize:22, fontWeight:800, color:col, fontFamily:"'Heebo',sans-serif",
        letterSpacing:'-0.02em', lineHeight:1 }}>
        {period.temp}°
      </span>
      <span style={{ fontSize:10, color:'rgba(255,255,255,0.35)', fontFamily:"'Heebo',sans-serif",
        textAlign:'center', lineHeight:1.3 }}>
        {codeToHebrew(period.code)}
      </span>
      {period.appTemp !== period.temp && (
        <span style={{ fontSize:10, color:'rgba(255,255,255,0.28)', fontFamily:"'Heebo',sans-serif" }}>
          מרגיש {period.appTemp}°
        </span>
      )}
    </div>
  )
}

// ─── Hourly card ──────────────────────────────────────────────────────────────

function HourCard({ hour, temp, code }: { hour: string; temp: number; code: number }) {
  const h   = parseInt(hour, 10)
  const col = tempColor(temp)
  return (
    <div style={{
      display:'flex', flexDirection:'column', alignItems:'center', gap:4,
      padding:'10px 8px', borderRadius:14, minWidth:54, flexShrink:0,
      background:'rgba(255,255,255,0.08)',
      border:'1px solid rgba(255,255,255,0.12)',
      boxShadow:'0 2px 8px rgba(0,0,0,0.20)',
    }}>
      <span style={{ fontSize:11, color:'rgba(255,255,255,0.40)', fontFamily:"'Heebo',sans-serif",
        fontWeight:600 }}>
        {hour}
      </span>
      <span style={{ fontSize:20, lineHeight:1 }}>{codeToEmoji(code, h >= 6 && h < 20)}</span>
      <span style={{ fontSize:15, fontWeight:700, color:col, fontFamily:"'Heebo',sans-serif" }}>
        {temp}°
      </span>
    </div>
  )
}

// ─── Martita description card ─────────────────────────────────────────────────

function MartitaCard({ text, accent }: { text: string; accent: string }) {
  const lines = text.split('\n').filter(Boolean)
  return (
    <div style={{
      margin:'0 20px',
      padding:'18px 20px',
      borderRadius:22,
      background:`linear-gradient(160deg, rgba(255,255,255,0.09) 0%, rgba(255,255,255,0.05) 100%)`,
      border:`1.5px solid ${accent}40`,
      backdropFilter:'blur(10px)',
      boxShadow:`0 6px 24px rgba(0,0,0,0.28), 0 0 16px ${accent}12`,
    }}>
      <div style={{
        fontSize:11, fontWeight:800,
        color:`${accent}`,
        letterSpacing:'0.10em', marginBottom:12,
        fontFamily:"'Heebo',sans-serif",
        textTransform:'uppercase', opacity:0.75,
      }}>
        ✨ MartitAI אומרת:
      </div>
      {lines.map((line, i) => (
        <div key={i} style={{
          fontSize: i === 0 ? 17 : 15,
          lineHeight: 1.72,
          color: i === 0 ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.72)',
          fontFamily:"'Heebo',sans-serif",
          fontWeight: i === 0 ? 700 : 400,
          marginTop: i > 0 && line.startsWith('🌅') ? 8 : 0,
          whiteSpace: 'pre-wrap',
        }}>
          {line}
        </div>
      ))}
    </div>
  )
}

// ─── Day tab button ───────────────────────────────────────────────────────────

function DayTab({ label, active, accent, onClick }: {
  label: string; active: boolean; accent: string; onClick: () => void
}) {
  return (
    <button onClick={onClick} style={{
      padding:'8px 15px', borderRadius:20, cursor:'pointer',
      border: active ? `1.5px solid ${accent}` : '1.5px solid rgba(255,255,255,0.16)',
      background: active ? `${accent}30` : 'rgba(255,255,255,0.08)',
      color: active ? accent : 'rgba(255,255,255,0.60)',
      fontSize:13, fontWeight: active ? 800 : 500,
      fontFamily:"'Heebo',sans-serif",
      whiteSpace:'nowrap',
      boxShadow: active ? `0 0 14px ${accent}30` : 'none',
      transition:'all 0.18s',
    }}>
      {label}
    </button>
  )
}

// ─── Mood-based accent colour ─────────────────────────────────────────────────

const MOOD_ACCENT: Record<WeatherMood, string> = {
  sunny:        '#FCD34D',
  partlyCloudy: '#93C5FD',
  cloudy:       '#94A3B8',
  foggy:        '#CBD5E1',
  drizzle:      '#38BDF8',
  rain:         '#38BDF8',
  snow:         '#BAE6FD',
  thunderstorm: '#A78BFA',
}

// ─── Main component ───────────────────────────────────────────────────────────

function formatDayLabel(iso: string, i: number): string {
  if (i === 0) return 'היום'
  if (i === 1) return 'מחר'
  if (i === 2) return 'מחרתיים'
  const d    = new Date(iso)
  const days = ['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת']
  return `יום ${days[d.getDay()] ?? ''}`
}

function getTimeGreeting(): string {
  const h = new Date().getHours()
  if (h < 5)  return 'לילה טוב'
  if (h < 12) return 'בוקר טוב'
  if (h < 17) return 'צהריים טובים'
  if (h < 21) return 'ערב טוב'
  return 'לילה טוב'
}

export function AbuWeather() {
  const setScreen = useAppStore(s => s.setScreen)
  const martitaPhoto = useMemo(() => getRandomMartitaPhoto(), [])

  const [data,    setData]    = useState<WeatherData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)
  const [dayIdx,  setDayIdx]  = useState(0)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try   { setData(await fetchWeather()) }
    catch (e: unknown) { setError(e instanceof Error ? e.message : 'שגיאה בטעינת מזג האוויר') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  // ── derived ─────────────────────────────────────────────────────────────────
  const dayIso    = data?.daily.time[dayIdx]             ?? ''
  const dailyCode = data?.daily.weathercode[dayIdx]      ?? 0
  const maxTemp   = Math.round(data?.daily.temperature_2m_max[dayIdx] ?? 0)
  const minTemp   = Math.round(data?.daily.temperature_2m_min[dayIdx] ?? 0)
  const sunrise   = data?.daily.sunrise[dayIdx]?.slice(11,16) ?? '--:--'
  const sunset    = data?.daily.sunset[dayIdx]?.slice(11,16)  ?? '--:--'
  const rainSum   = data?.daily.precipitation_sum[dayIdx]      ?? 0

  // For "now" on today, use current_weather; for other days show max/noon
  const curCode = dayIdx === 0 ? (data?.current_weather.weathercode ?? dailyCode) : dailyCode
  const isDay   = dayIdx === 0 ? (data?.current_weather.is_day ?? 1) : 1

  // Current displayed temperature
  const curTemp = dayIdx === 0
    ? Math.round(data?.current_weather.temperature ?? maxTemp)
    : maxTemp

  // Feels like — use current hour for today, noon for other days
  const nowHour = new Date().getHours()
  const curHourKey = `${dayIso}T${String(nowHour).padStart(2,'0')}:00`
  const noonKey    = `${dayIso}T13:00`
  const feelsIdx   = data?.hourly.time.findIndex(t => t === (dayIdx === 0 ? curHourKey : noonKey)) ?? -1
  const feelsLike  = feelsIdx >= 0
    ? Math.round(data?.hourly.apparent_temperature[feelsIdx] ?? curTemp)
    : curTemp

  const mood    = codeToMood(curCode)
  const accent  = MOOD_ACCENT[mood]
  const skyGrad = skyGradient(mood, isDay === 1)
  const heroEmoji = codeToEmoji(curCode, isDay === 1)

  // Hourly strip for selected day
  const hours = useMemo(() => {
    if (!data) return []
    const result: Array<{ hour: string; temp: number; code: number }> = []
    for (let i = 0; i < data.hourly.time.length; i++) {
      const t = data.hourly.time[i]
      if (!t?.startsWith(dayIso)) continue
      const h = parseInt(t.slice(11,13), 10)
      if (h < 6) continue
      result.push({
        hour: t.slice(11,16),
        temp: Math.round(data.hourly.temperature_2m[i] ?? 0),
        code: data.hourly.weathercode[i] ?? 0,
      })
    }
    return result
  }, [data, dayIso])

  // Time-of-day periods
  const timePeriods: TimePeriod[] = useMemo(() =>
    data ? getTimePeriods(dayIso, data.hourly) : []
  , [data, dayIso])

  // Martita description (full breakdown at bottom)
  const martitaText = useMemo(() =>
    data ? martitaDayDescription(maxTemp, minTemp, dailyCode, timePeriods, formatDayLabel(dayIso, dayIdx)) : ''
  , [data, maxTemp, minTemp, dailyCode, timePeriods, dayIso, dayIdx])

  // Short personal briefing (top of content, most important)
  const briefing = useMemo(() =>
    data ? martitaBriefing(maxTemp, minTemp, dailyCode, data.daily.precipitation_sum[dayIdx] ?? 0, formatDayLabel(dayIso, dayIdx)) : null
  , [data, maxTemp, minTemp, dailyCode, dayIdx, dayIso])

  const dayLabels = (data?.daily.time ?? []).slice(0,4).map(formatDayLabel)

  // ── loading ──────────────────────────────────────────────────────────────────
  if (loading) return (
    <div style={{
      flex:1, display:'flex', flexDirection:'column', alignItems:'center',
      justifyContent:'center', gap:18, minHeight:'100dvh',
      background:'linear-gradient(180deg, #0a1a30 0%, #050A18 100%)',
    }}>
      <div style={{ fontSize:80, animation:'wxFloat 2s ease-in-out infinite' }}>⛅</div>
      <div style={{ fontSize:17, color:'rgba(255,255,255,0.50)',
        fontFamily:"'Heebo',sans-serif", direction:'rtl' }}>
        טוענת מזג אוויר…
      </div>
    </div>
  )

  if (error) return (
    <div style={{
      flex:1, display:'flex', flexDirection:'column', alignItems:'center',
      justifyContent:'center', gap:20, padding:'0 32px', minHeight:'100dvh',
      background:'linear-gradient(180deg, #0a1a30 0%, #050A18 100%)',
    }}>
      <div style={{ fontSize:64 }}>😔</div>
      <div style={{ fontSize:16, color:'rgba(255,255,255,0.60)',
        fontFamily:"'Heebo',sans-serif", direction:'rtl', textAlign:'center' }}>
        {error}
      </div>
      <button onClick={load} style={{
        padding:'12px 28px', borderRadius:14, border:'none',
        background:'rgba(147,197,253,0.15)', color:'#93c5fd',
        fontSize:15, fontWeight:700, fontFamily:"'Heebo',sans-serif", cursor:'pointer',
      }}>
        נסי שוב
      </button>
    </div>
  )

  // ── render ───────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        @keyframes wxFloat   { 0%,100%{transform:translateY(0)}  50%{transform:translateY(-10px)} }
        @keyframes wxRain    { 0%{transform:translateY(-24px) rotate(12deg);opacity:0}
                               15%{opacity:0.8} 100%{transform:translateY(110%);opacity:0} }
        @keyframes wxSnow    { 0%{transform:translateY(-10px) rotate(0deg);opacity:0}
                               15%{opacity:0.9} 100%{transform:translateY(110%) rotate(360deg);opacity:0} }
        @keyframes wxStar    { 0%,100%{opacity:0.25;transform:scale(0.7)} 50%{opacity:1;transform:scale(1.3)} }
        @keyframes wxSunRot  { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes wxFadeUp  { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
        @keyframes wxLightning{ 0%,88%,100%{opacity:0} 90%,96%{opacity:1} 93%,98%{opacity:0.2} }
        .wx-hour-strip::-webkit-scrollbar { display:none }
        .wx-time-strip::-webkit-scrollbar { display:none }
        .wx-day-tab:active { transform:scale(0.92) }
      `}</style>

      <div style={{
        display:'flex', flexDirection:'column', minHeight:'100dvh',
        overflowY:'auto', overflowX:'hidden',
        background:'#050A18', direction:'rtl',
        fontFamily:"'Heebo',sans-serif",
      }}>

        {/* ═══ SKY HERO ═══════════════════════════════════════════════════ */}
        <div style={{
          position:'relative', minHeight:360,
          background: skyGrad,
          display:'flex', flexDirection:'column',
          alignItems:'center', overflow:'hidden',
          paddingBottom:32,
        }}>
          {/* Atmospheric overlays */}
          {mood === 'sunny'        && <SunRaysOverlay />}
          {(mood === 'rain' || mood === 'drizzle') && <RainOverlay heavy={mood==='rain'}/>}
          {mood === 'thunderstorm' && <RainOverlay heavy />}
          {mood === 'snow'         && <SnowOverlay />}
          {isDay === 0             && <StarsOverlay />}
          {/* Lightning flash */}
          {mood === 'thunderstorm' && (
            <div style={{
              position:'absolute', inset:0, zIndex:1, pointerEvents:'none',
              background:'rgba(200,180,255,0.12)',
              animation:'wxLightning 5s ease-in-out infinite',
            }}/>
          )}

          {/* ── Header bar ───────────────────────────────────────────── */}
          <div style={{
            position:'relative', zIndex:4, width:'100%',
            display:'flex', alignItems:'center', justifyContent:'space-between',
            padding: '16px 16px 8px',
            gap:8,
          }}>
            <BackButton />

            {/* Martita portrait */}
            <div style={{
              width: 44, height: 44, borderRadius: '50%',
              border: '2px solid rgba(255,255,255,0.25)',
              boxShadow: '0 2px 10px rgba(0,0,0,0.35)',
              overflow: 'hidden',
              background: 'rgba(0,0,0,0.3)',
              flexShrink: 0,
            }}>
              <img
                src={martitaPhoto}
                alt="Martita"
                loading="eager"
                style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 15%', display: 'block' }}
                onError={handleMartitaImgError}
              />
            </div>

            {/* Day tabs */}
            <div style={{
              display:'flex', gap:6, overflowX:'auto', scrollbarWidth:'none',
              flexShrink:1,
            }}>
              {dayLabels.map((label, i) => (
                <DayTab key={i} label={label} active={dayIdx===i}
                  accent={accent} onClick={() => setDayIdx(i)}/>
              ))}
            </div>

            <button onClick={load} style={{
              background:'rgba(0,0,0,0.25)',
              border:'1px solid rgba(255,255,255,0.18)',
              borderRadius:12, padding:'8px 11px',
              color:'rgba(255,255,255,0.75)', fontSize:17,
              cursor:'pointer', backdropFilter:'blur(8px)', flexShrink:0,
            }}>
              ↻
            </button>
          </div>

          {/* ── Greeting + location ──────────────────────────────────── */}
          <div style={{
            position:'relative', zIndex:3, textAlign:'center',
            marginTop:12, animation:'wxFadeUp 0.5s ease both',
          }}>
            <div style={{
              fontSize:13, fontWeight:600, letterSpacing:'0.05em',
              color:`${accent}CC`,
            }}>
              {getTimeGreeting()}, Martita ✨
            </div>
            <div style={{
              fontSize:11, color:'rgba(255,255,255,0.35)',
              letterSpacing:'0.10em', marginTop:2,
              textTransform:'uppercase',
            }}>
              כפר סבא · ישראל
            </div>
          </div>

          {/* ── Big weather icon ─────────────────────────────────────── */}
          <div style={{
            position:'relative', zIndex:3, marginTop:14,
            animation:'wxFadeUp 0.58s ease both',
          }}>
            <WeatherHeroIcon mood={mood} emoji={heroEmoji} isDay={isDay===1}/>
          </div>

          {/* ── Huge temperature ─────────────────────────────────────── */}
          <div style={{
            position:'relative', zIndex:3,
            marginTop:6, textAlign:'center',
            animation:'wxFadeUp 0.65s ease both',
          }}>
            <div style={{
              fontSize:100, fontWeight:800, lineHeight:1,
              color:'rgba(255,255,255,0.97)',
              letterSpacing:'-0.04em',
              textShadow:`0 4px 30px rgba(0,0,0,0.35), 0 0 60px ${accent}40`,
            }}>
              {curTemp}
              <span style={{ fontSize:44, fontWeight:300, verticalAlign:'super', opacity:0.75 }}>°</span>
            </div>
          </div>

          {/* ── Feels like ───────────────────────────────────────────── */}
          {feelsLike !== curTemp && (
            <div style={{
              position:'relative', zIndex:3,
              fontSize:14, color:'rgba(255,255,255,0.55)',
              marginTop:2, fontWeight:500,
              animation:'wxFadeUp 0.70s ease both',
            }}>
              מרגיש כמו <span style={{ color:tempColor(feelsLike), fontWeight:700 }}>{feelsLike}°</span>
            </div>
          )}

          {/* ── Condition label ──────────────────────────────────────── */}
          <div style={{
            position:'relative', zIndex:3,
            fontSize:20, fontWeight:700,
            color:accent,
            marginTop:4, letterSpacing:'0.01em',
            textShadow:'0 2px 12px rgba(0,0,0,0.40)',
            animation:'wxFadeUp 0.75s ease both',
          }}>
            {codeToHebrew(curCode)}
          </div>

          {/* ── Sunrise / sunset strip ───────────────────────────────── */}
          <div style={{
            position:'relative', zIndex:3,
            display:'flex', gap:20, marginTop:16,
            animation:'wxFadeUp 0.80s ease both',
          }}>
            {[
              { icon:'🌅', label:'זריחה', val:sunrise },
              { icon:'🌧️', label:`גשם`, val: rainSum > 0.1 ? `${rainSum.toFixed(1)} מ״מ` : 'אין' },
              { icon:'🌇', label:'שקיעה', val:sunset },
            ].map(s => (
              <div key={s.label} style={{
                display:'flex', flexDirection:'column', alignItems:'center', gap:2,
                padding:'9px 14px', borderRadius:14,
                background:'rgba(0,0,0,0.22)',
                border:'1px solid rgba(255,255,255,0.12)',
                backdropFilter:'blur(6px)',
              }}>
                <span style={{ fontSize:16 }}>{s.icon}</span>
                <span style={{ fontSize:13, fontWeight:700, color:'rgba(255,255,255,0.88)' }}>{s.val}</span>
                <span style={{ fontSize:10, color:'rgba(255,255,255,0.38)', letterSpacing:'0.04em' }}>{s.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ═══ CONTENT SECTION ════════════════════════════════════════════ */}
        <div style={{ background:'#050A18', paddingTop:4, paddingBottom:40 }}>

          {/* ── Personal briefing — first thing she reads ────────────── */}
          {briefing && (
            <div style={{ animation:'wxFadeUp 0.45s 0.05s ease both', opacity:0,
              animationFillMode:'forwards' }}>
              <BriefingCard briefing={briefing}/>
            </div>
          )}

          {/* ── Temp range bar ───────────────────────────────────────── */}
          <div style={{ animation:'wxFadeUp 0.55s 0.15s ease both', opacity:0,
            animationFillMode:'forwards' }}>
            <TempRangeBar min={minTemp} max={maxTemp} current={curTemp}/>
          </div>

          {/* ── Section label ────────────────────────────────────────── */}
          <div style={{
            padding:'18px 22px 8px',
            fontSize:12, fontWeight:700,
            color:'rgba(255,255,255,0.30)',
            letterSpacing:'0.10em', textTransform:'uppercase',
            animation:'wxFadeUp 0.55s 0.15s ease both', opacity:0,
            animationFillMode:'forwards',
          }}>
            לאורך היום
          </div>

          {/* ── Time-of-day cards ────────────────────────────────────── */}
          <div
            className="wx-time-strip"
            style={{
              display:'flex', gap:10, overflowX:'auto',
              padding:'0 20px 4px', scrollbarWidth:'none',
              animation:'wxFadeUp 0.55s 0.20s ease both', opacity:0,
              animationFillMode:'forwards',
            }}
          >
            {timePeriods.map(p => (
              <TimeCard key={p.label} period={p} accent={accent}/>
            ))}
          </div>

          {/* ── Section label ────────────────────────────────────────── */}
          <div style={{
            padding:'20px 22px 8px',
            fontSize:12, fontWeight:700,
            color:'rgba(255,255,255,0.30)',
            letterSpacing:'0.10em', textTransform:'uppercase',
            animation:'wxFadeUp 0.55s 0.25s ease both', opacity:0,
            animationFillMode:'forwards',
          }}>
            שעה שעה
          </div>

          {/* ── Hourly strip ─────────────────────────────────────────── */}
          <div
            className="wx-hour-strip"
            style={{
              display:'flex', gap:8, overflowX:'auto',
              padding:'0 20px 4px', scrollbarWidth:'none',
              animation:'wxFadeUp 0.55s 0.30s ease both', opacity:0,
              animationFillMode:'forwards',
            }}
          >
            {hours.map((h, i) => (
              <HourCard key={i} hour={h.hour} temp={h.temp} code={h.code}/>
            ))}
          </div>

          {/* ── Martita description ──────────────────────────────────── */}
          <div style={{
            marginTop:20,
            animation:'wxFadeUp 0.55s 0.35s ease both', opacity:0,
            animationFillMode:'forwards',
          }}>
            <MartitaCard text={martitaText} accent={accent}/>
          </div>

        </div>
      </div>
      <div style={{ position: 'fixed', bottom: 8, left: 12, fontSize: 10, fontWeight: 700, letterSpacing: '0.8px', color: 'rgba(201,168,76,0.30)', fontFamily: "'DM Sans',monospace", pointerEvents: 'none', zIndex: 1 }}>v15.0</div>
    </>
  )
}
