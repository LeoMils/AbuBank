import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import pkg from './package.json'

/**
 * Dev-only middleware: proxies /api/tts requests to Google Translate TTS.
 * Runs server-side → no CORS issues.
 */
import { WebSocket } from 'ws'
import { randomUUID } from 'crypto'
import https from 'https'
import fs from 'fs'
import path from 'path'

// Load .env into process.env for server-side middleware (Vite only injects to client bundle)
;(function loadDotEnv() {
  try {
    const envPath = path.resolve(process.cwd(), '.env')
    const content = fs.readFileSync(envPath, 'utf8')
    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eq = trimmed.indexOf('=')
      if (eq === -1) continue
      const key = trimmed.slice(0, eq).trim()
      const val = trimmed.slice(eq + 1).trim()
      if (!process.env[key]) process.env[key] = val
    }
  } catch { /* no .env file */ }
})()

/**
 * Google Translate TTS — free, reliable, clear Hebrew female voice.
 * No API key needed. Server-side proxy avoids CORS.
 */
async function googleTTS(text: string, lang: string): Promise<Buffer> {
  const tl = lang === 'es' ? 'es' : 'iw'
  const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=${tl}&client=gtx&ttsspeed=0.9`
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    const req = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://translate.google.com/',
        'Accept': '*/*',
      }
    }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        const loc = res.headers.location
        if (!loc) { reject(new Error('redirect without location')); return }
        https.get(loc, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Referer': 'https://translate.google.com/',
          }
        }, (r2) => {
          r2.on('data', (c: Buffer) => chunks.push(c))
          r2.on('end', () => resolve(Buffer.concat(chunks)))
          r2.on('error', reject)
        }).on('error', reject)
        return
      }
      if (res.statusCode !== 200) { reject(new Error(`Google TTS ${res.statusCode}`)); return }
      res.on('data', (c: Buffer) => chunks.push(c))
      res.on('end', () => resolve(Buffer.concat(chunks)))
      res.on('error', reject)
    })
    req.on('error', reject)
    req.setTimeout(8000, () => { req.destroy(); reject(new Error('timeout')) })
  })
}

/**
 * Azure Cognitive Services TTS — official REST API.
 * Same HilaNeural / ElenaNeural voices as Edge TTS but via reliable HTTP.
 * Free tier: 500,000 chars/month. Needs VITE_AZURE_TTS_KEY (+ VITE_AZURE_TTS_REGION, default "eastus").
 */
async function azureTTS(text: string, lang: string): Promise<Buffer> {
  const azureKey = process.env.VITE_AZURE_TTS_KEY
  const azureRegion = process.env.VITE_AZURE_TTS_REGION ?? 'eastus'
  if (!azureKey) throw new Error('no azure key')

  const voice = lang === 'es' ? 'es-AR-ElenaNeural' : 'he-IL-HilaNeural'
  const prosodyRate = lang === 'he' ? '-8%' : '-3%'
  const langTag = lang === 'es' ? 'es-AR' : 'he-IL'
  const safe = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const ssml =
    `<speak version='1.0' xml:lang='${langTag}' xmlns='http://www.w3.org/2001/10/synthesis'>` +
    `<voice name='${voice}'><prosody rate='${prosodyRate}'>${safe}</prosody></voice></speak>`

  const body = Buffer.from(ssml, 'utf8')
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: `${azureRegion}.tts.speech.microsoft.com`,
        path: '/cognitiveservices/v1',
        method: 'POST',
        headers: {
          'Ocp-Apim-Subscription-Key': azureKey,
          'Content-Type': 'application/ssml+xml',
          'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
          'Content-Length': body.length,
          'User-Agent': 'AbuBank/1.0',
        },
      },
      (res) => {
        if (res.statusCode !== 200) { reject(new Error(`Azure TTS ${res.statusCode}`)); return }
        const chunks: Buffer[] = []
        res.on('data', (c: Buffer) => chunks.push(c))
        res.on('end', () => resolve(Buffer.concat(chunks)))
        res.on('error', reject)
      }
    )
    req.on('error', reject)
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('timeout')) })
    req.write(body)
    req.end()
  })
}

/**
 * Microsoft Edge TTS via WebSocket — high quality neural voices.
 * Voices: he-IL-HilaNeural (female Hebrew), es-AR-ElenaNeural (female Argentine Spanish)
 */
async function edgeTTS(text: string, voice: string): Promise<Buffer> {
  const connId = randomUUID().replace(/-/g, '')
  const wsUrl = `wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=6A5AA1D4EAFF4E9FB37E23D68491D6F4&ConnectionId=${connId}`

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    const ws = new WebSocket(wsUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0',
        'Origin': 'chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold',
        'Pragma': 'no-cache',
        'Cache-Control': 'no-cache',
      }
    })
    const timeout = setTimeout(() => { ws.close(); reject(new Error('timeout')) }, 14000)

    ws.on('open', () => {
      // Send config
      ws.send(`Content-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n{"context":{"synthesis":{"audio":{"metadataoptions":{"sentenceBoundaryEnabled":"false","wordBoundaryEnabled":"false"},"outputFormat":"audio-24khz-48kbitrate-mono-mp3"}}}}`)
      // Send SSML
      const prosodyRate = voice.startsWith('he') ? '-8%' : '-3%'
      const ssml = `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='${voice.substring(0,5)}'><voice name='${voice}'><prosody pitch='+0Hz' rate='${prosodyRate}' volume='+0%'>${text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</prosody></voice></speak>`
      ws.send(`X-RequestId:${connId}\r\nContent-Type:application/ssml+xml\r\nPath:ssml\r\n\r\n${ssml}`)
    })

    ws.on('message', (data: Buffer | string) => {
      const raw = Buffer.isBuffer(data) ? data : Buffer.from(data as string)
      const str = raw.toString('utf8', 0, Math.min(raw.length, 200))
      if (str.includes('Path:turn.end')) {
        clearTimeout(timeout)
        ws.close()
        resolve(Buffer.concat(chunks))
      } else if (str.includes('Path:audio')) {
        // Binary audio data — find the separator (two newlines)
        const sep = raw.indexOf(Buffer.from('\r\n\r\n'))
        if (sep !== -1 && sep + 4 < raw.length) {
          chunks.push(raw.subarray(sep + 4))
        }
      }
    })

    ws.on('error', (e) => { clearTimeout(timeout); reject(e) })
    ws.on('close', () => { clearTimeout(timeout); if (chunks.length === 0) reject(new Error('no audio')) })
  })
}

/**
 * Stitch (Google Labs) — AI UI generation proxy.
 * Runs server-side so the Node-only SDK (MCP transport) never ships to the browser.
 *
 * POST /api/stitch/generate  { prompt, projectId? }
 *   → { html, projectId, screenId }
 *
 * POST /api/stitch/edit      { prompt, projectId, screenId }
 *   → { html, projectId, screenId }
 *
 * Requires VITE_STITCH_API_KEY in .env (Google Labs API key).
 */
function stitchProxyPlugin(): Plugin {
  return {
    name: 'stitch-proxy',
    enforce: 'pre',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/stitch/')) return next()

        const apiKey = process.env.VITE_STITCH_API_KEY
        if (!apiKey) {
          res.writeHead(503, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'VITE_STITCH_API_KEY not set in .env' }))
          return
        }

        // Read body
        let body = ''
        req.on('data', (chunk: Buffer) => { body += chunk.toString() })
        await new Promise<void>(resolve => req.on('end', resolve))

        let parsed: Record<string, string>
        try { parsed = JSON.parse(body) } catch {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'invalid JSON body' }))
          return
        }

        try {
          // Dynamic import keeps it out of the client bundle
          const { StitchToolClient } = await import('@google/stitch-sdk')

          const client = new StitchToolClient({ apiKey })

          if (req.url === '/api/stitch/generate') {
            const { prompt, projectId: incomingProjectId } = parsed
            if (!prompt) { res.writeHead(400); res.end(JSON.stringify({ error: 'prompt required' })); return }

            // Step 1: get or create project
            let resolvedProjectId = incomingProjectId
            if (!resolvedProjectId) {
              const created = await client.callTool<Record<string,unknown>>('create_project', { title: 'AbuBank' })
              const nameField = (created as Record<string,unknown>)?.name as string | undefined
              resolvedProjectId = nameField?.replace('projects/', '') ?? String((created as Record<string,unknown>)?.projectId ?? '')
            }

            // Step 2: generate screen
            const genRaw = await client.callTool<Record<string,unknown>>('generate_screen_from_text', {
              projectId: resolvedProjectId,
              prompt,
              deviceType: 'MOBILE',
              modelId: 'GEMINI_3_FLASH',
            })

            // Step 3: extract screenId — it's in outputComponents[1].design.screens[0].id
            const outputComponents = (genRaw?.outputComponents as unknown[]) ?? []
            let screenId: string | undefined
            for (const comp of outputComponents) {
              const design = (comp as Record<string,unknown>)?.design as Record<string,unknown> | undefined
              const screens = design?.screens as unknown[] | undefined
              if (screens?.[0]) {
                screenId = ((screens[0] as Record<string,unknown>)?.id as string)
                  ?? ((screens[0] as Record<string,unknown>)?.name as string)?.split('/').pop()
                break
              }
            }

            if (!screenId) {
              res.writeHead(502, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ error: 'Could not find screenId in Stitch response', raw: JSON.stringify(genRaw).slice(0, 300) }))
              return
            }

            // Step 4: get_screen to obtain the htmlCode download URL
            const scrRaw = await client.callTool<Record<string,unknown>>('get_screen', {
              projectId: resolvedProjectId,
              screenId,
              name: `projects/${resolvedProjectId}/screens/${screenId}`,
            })

            const htmlCodeObj = (scrRaw as Record<string,unknown>)?.htmlCode as Record<string,unknown> | undefined
            const downloadUrl = htmlCodeObj?.downloadUrl as string | undefined

            if (!downloadUrl) {
              res.writeHead(502, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ error: 'No downloadUrl in htmlCode', keys: Object.keys(scrRaw || {}) }))
              return
            }

            // Step 5: download the actual HTML from the signed URL
            const htmlResp = await fetch(downloadUrl)
            const html = await htmlResp.text()

            console.log(`[stitch] generated screen ${screenId}, html ${html.length} chars`)
            res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' })
            res.end(JSON.stringify({ html, projectId: resolvedProjectId, screenId }))

          } else if (req.url === '/api/stitch/debug') {
            // Raw tool introspection — lists available tools
            const tools = await client.listTools()
            res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' })
            res.end(JSON.stringify(tools))

          } else if (req.url === '/api/stitch/edit') {
            const { prompt, projectId, screenId } = parsed
            if (!prompt || !projectId || !screenId) {
              res.writeHead(400); res.end(JSON.stringify({ error: 'prompt, projectId, screenId required' })); return
            }

            const editRaw = await client.callTool<Record<string,unknown>>('edit_screens', {
              projectId,
              screenIds: [screenId],
              prompt,
              deviceType: 'MOBILE',
              modelId: 'GEMINI_3_FLASH',
            })

            // Extract new screenId from edit response (same structure as generate)
            const editComps = (editRaw?.outputComponents as unknown[]) ?? []
            let editedScreenId = screenId
            for (const comp of editComps) {
              const design = (comp as Record<string,unknown>)?.design as Record<string,unknown> | undefined
              const screens = design?.screens as unknown[] | undefined
              if (screens?.[0]) {
                editedScreenId = ((screens[0] as Record<string,unknown>)?.id as string)
                  ?? ((screens[0] as Record<string,unknown>)?.name as string)?.split('/').pop()
                  ?? screenId
                break
              }
            }

            const getScr = await client.callTool<Record<string,unknown>>('get_screen', {
              projectId,
              screenId: editedScreenId,
              name: `projects/${projectId}/screens/${editedScreenId}`,
            })

            const editHtmlUrl = ((getScr as Record<string,unknown>)?.htmlCode as Record<string,unknown>)?.downloadUrl as string
            const editHtmlResp = await fetch(editHtmlUrl)
            const editHtml = await editHtmlResp.text()

            console.log(`[stitch] edited screen ${editedScreenId}, html ${editHtml.length} chars`)
            res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' })
            res.end(JSON.stringify({ html: editHtml, projectId, screenId: editedScreenId }))

          } else {
            res.writeHead(404); res.end(JSON.stringify({ error: 'unknown stitch route' }))
          }

        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : String(e)
          const stack = e instanceof Error ? e.stack : ''
          console.error('[stitch-proxy] Error:', msg)
          console.error('[stitch-proxy] Stack:', stack?.slice(0, 400))
          res.writeHead(502, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: msg }))
        }
      })
    },
  }
}

function ttsProxyPlugin(): Plugin {
  return {
    name: 'tts-proxy',
    enforce: 'pre',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        // ── Azure Cognitive Services TTS (primary — official, most reliable) ──
        if (req.url?.startsWith('/api/aztts')) {
          const params = new URL(req.url, 'http://localhost').searchParams
          const text = params.get('text') || ''
          const lang = params.get('lang') || 'he'
          if (!text) { res.writeHead(400); res.end('missing text'); return }
          if (!process.env.VITE_AZURE_TTS_KEY) { res.writeHead(503); res.end('no azure key'); return }
          console.log(`[azure-tts] "${text.substring(0, 40)}..." lang=${lang}`)
          try {
            const audio = await azureTTS(text, lang)
            res.writeHead(200, {
              'Content-Type': 'audio/mpeg',
              'Content-Length': String(audio.length),
              'Access-Control-Allow-Origin': '*',
            })
            res.end(audio)
            console.log(`[azure-tts] OK, ${audio.length} bytes`)
          } catch (e) {
            console.log('[azure-tts] Error:', e)
            res.writeHead(502); res.end()
          }
          return
        }

        // Google Translate TTS proxy
        if (req.url?.startsWith('/api/gtts')) {
          const params = new URL(req.url, 'http://localhost').searchParams
          const text = params.get('text') || ''
          const lang = params.get('lang') || 'he'
          if (!text) { res.writeHead(400); res.end('missing text'); return }
          console.log(`[google-tts] "${text.substring(0, 40)}..." lang=${lang}`)
          try {
            const audio = await googleTTS(text, lang)
            res.writeHead(200, {
              'Content-Type': 'audio/mpeg',
              'Content-Length': String(audio.length),
              'Access-Control-Allow-Origin': '*',
            })
            res.end(audio)
            console.log(`[google-tts] OK, ${audio.length} bytes`)
          } catch (e) {
            console.log('[google-tts] Error:', e)
            res.writeHead(502); res.end()
          }
          return
        }

        if (!req.url?.startsWith('/api/tts')) return next()

          const params = new URL(req.url, 'http://localhost').searchParams
          const text = params.get('text') || ''
          const lang = params.get('lang') || 'he'

          if (!text) { res.writeHead(400); res.end('missing text'); return }

          const voice = lang === 'es' ? 'es-AR-ElenaNeural' : 'he-IL-HilaNeural'
          console.log(`[edge-tts] "${text.substring(0, 40)}..." voice=${voice}`)

          try {
            let audio: Buffer
            try {
              audio = await edgeTTS(text, voice)
            } catch (firstErr) {
              console.log('[edge-tts] First attempt failed, retrying in 800ms:', firstErr)
              await new Promise(r => setTimeout(r, 800))
              audio = await edgeTTS(text, voice)
            }
            res.writeHead(200, {
              'Content-Type': 'audio/mpeg',
              'Content-Length': String(audio.length),
              'Access-Control-Allow-Origin': '*',
            })
            res.end(audio)
            console.log(`[edge-tts] OK, ${audio.length} bytes`)
          } catch (e) {
            console.log('[edge-tts] Error (both attempts):', e)
            res.writeHead(502); res.end()
          }
        })
    },
  }
}

export default defineConfig({
  plugins: [
    stitchProxyPlugin(),
    ttsProxyPlugin(),
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      devOptions: { enabled: false },   // no SW interference during dev
      workbox: {
        runtimeCaching: [],
        cleanupOutdatedCaches: true,
        skipWaiting: true,              // new SW installs immediately
        clientsClaim: true,             // new SW takes control of ALL open tabs/windows immediately
      },
      manifest: {
        name: 'AbuBank',
        short_name: 'AbuBank',
        description: 'הפורטל הפרטי של Martita',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        theme_color: '#050A18',
        background_color: '#050A18',
        dir: 'rtl',
        lang: 'he',
        icons: [
          {
            src: '/app-icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/app-icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
    }),
  ],
  server: {
    host: true,   // listen on all interfaces (LAN access from iPhone)
    headers: {
      // Prevent iPhone Safari from serving stale JS/CSS during development
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Pragma': 'no-cache',
    },
  },
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(pkg.version),
  },
  // H6-FIX: explicit build target and minify for bundle control
  build: {
    target: 'es2020',
    minify: 'esbuild',
    rollupOptions: {
      output: {
        manualChunks: undefined,
      },
    },
  },
})
