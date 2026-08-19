# PRODUCTION_STATUS

Overall: 🟢 CODE-READY for PWA beta; 🟡 gated on physical-voice + realtime provider.

| Criterion | Status | Evidence |
|---|---|---|
| App runs | 🟢 | Vercel 0.8.1 root 200; vite dev |
| Build passes | 🟢 | tsc && vite build exit 0 |
| Validations | 🟢 | npm run check: 5971 tests, tsc clean |
| Voice E2E / fallback | 🟡 | pipeline fallback validated; realtime down; device unproven |
| Hebrew | 🟢 | deterministic tests + chat 200 |
| Spanish | 🟢 | Rioplatense path + ES voice profile |
| Memory persistence | 🟢 | durableStore + persistence e2e |
| Family graph | 🟢 | family_data.json + validate:family |
| Calendar | 🟢 | create/read/confirm/update + tests |
| Mobile path | 🟢 | PWA installable; native out of scope |
| Observability | 🟢 | [AbuAI] structured logs + diag panel |
| No secrets | 🟢 | .env* gitignored; no sk- in src/api |
| No fake-as-prod | 🟢 | realtime down is honest, fallback real |
| No P0 | 🟢 | no code P0; see P0_BLOCKERS for non-code |

PRODUCTION PROBABILITY TODAY: LIKELY (PWA beta) — code green & deployed.
Full "voice production" gated on: (1) Leo device retest, (2) realtime provider quota/key.
