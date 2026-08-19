# Abu character — commissioned illustration spec

**Honest finding:** two refinement passes (variants A "Warm Gold" and B "Starlight
Depth") made the bust warmer and softer, but hand-authored SVG has hit its ceiling —
it still reads as a *refined vector*, not a *painterly, lovely* illustration, and
pushing the shading further makes the face muddy rather than sculpted. To reach the
quality this screen deserves, order a real illustration to the spec below; it is
built so I can animate it directly (amplitude-driven mouth, blink, breathing, states).

## Style
- Warm, dignified, **semi-realistic painterly illustration** of a grandmother — soft
  painted shading and form. **Not** flat vector, **not** photorealistic, **not** a 3D
  render. Think a warm portrait painter / high-end storybook.
- Silver hair (soft, with real strands and flyaways, not a helmet), warm skin, kind
  eyes with genuine warmth, a gentle closed-mouth smile, a shawl in warm gold /
  terracotta. Optional small warm earring.
- Neutral pose: facing slightly toward the viewer, eyes open, serene.

## Format & size
- **Deliverable: a single layered SVG** (strongly preferred — crisp at any size, small
  for a PWA, per-layer animation). If raster is unavoidable, deliver **separate
  transparent PNGs per layer at 3× (design 360×400 → export 1080×1200)**.
- **Transparent background** — the app draws the Night-Garden starfield behind her.
- Target SVG weight < 80 KB.
- Design canvas **360 × 400** (portrait bust). Registration: head top ≈ y 55, eye line
  ≈ y 158, chin ≈ y 232, shoulders fill to y 400; face centred on x 180.

## Layer structure (REQUIRED — this is what makes her animatable)
Each a named group `<g id="...">` in the SVG (or a same-named PNG):
1. `hair-back` — hair behind the head
2. `base` — face/skin, neck, shoulders, shawl (the static body)
3. `cheeks` — blush (optional, warmth)
4. `brows` — eyebrows (separate, for micro-expression)
5. `eyes-open` — eyeballs + irises + catchlights (I move/scale for gaze + life)
6. `eyelids` — upper lids as a shape that can lower fully over the eyes to **blink**
   (must be able to cover `eyes-open` completely; do not merge into `base`)
7. `mouth` — provide **three registered viseme shapes** on the same anchor:
   `mouth-closed` (smile), `mouth-mid`, `mouth-open` — amplitude cross-fades these
8. `hair-front` — framing strands / flyaways in front of the face edges
9. `rim-light` — a soft light-edge overlay (optional; I can also add this at runtime)

Rules: no clip-path that stops a lid lowering over the eyes; the three mouth shapes
must share one origin so swapping them does not shift position; keep hair-front above
the face so blinks/mouth read correctly.

## Reference
- The two SVG attempts: `docs/design/abu-bust-A.svg`, `abu-bust-B.svg`
  (composition + palette + starfield context are right; the *rendering quality* is
  what a commissioned asset should lift).
- Palette anchors: skin `#EEBE94→#B87A54`, hair `#FFFBF2→#AFA79E`, shawl
  `#F0B87E→#9B5236`, warm rim `#FFE6B0`, gold accent `#E8B563`, on the Night-Garden
  dark `#070B1E`.
