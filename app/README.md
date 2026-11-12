# God’s L’Eye — GenTeam (Genspark) Edition: dashboard

A standalone demo of a LinkedIn-prospecting tracker. It reads and writes **local JSON files only**.
No LinkedIn automation, no browser automation, no scheduler, no outbound HTTP, no telemetry,
no credentials. Sending on LinkedIn stays manual; this app only records it.

```
package.json
server/     Express API (port 8787)        app.ts · store.ts · queries.ts · index.ts
shared/     pure domain code               types · dates (weekend roll) · derive (ONE writer of next_due_date) · chain-gtm
web/        Vite + React 18 + Tailwind     port 5173, proxies /api -> 8787
scripts/    seed.ts · verify.ts
data/       JSON files + dossiers/         created on first run, gitignored
```

## Run

```bash
npm install
npm run seed -- --campaign=demo   # wipes /data, writes the demo campaign + 12 leads + dossier
npm run dev                       # server on :8787 + web on :5173 (open http://localhost:5173)
npm run verify                    # 8 acceptance checks, PASS/FAIL per line, re-seeds afterwards
npm run build                     # builds web/dist; then `npm start` serves it from the API on :8787
```

If port 8787 is taken on your machine: `PORT=8788 npm run dev` — the web proxy follows `PORT`.

## The five screens

| Route | What it is |
|---|---|
| `/campaigns/new` | name · ICP one-liner (200 chars) · chain@version (frozen after create) · daily cap · start date. Create = one campaign row + one `campaign_created` event. |
| `/campaigns/:id` | header + four big counters (invited / accepted / docs ready / due today), all computed from events on each load. |
| `/scout` | this campaign's uninvited leads, proposed variant, one button **Invitation sent** (+ **Mark accepted** for the warm lead). Banner: sending stays manual. |
| `/today` | the centerpiece. One card per due lead: step N of 10, variant, days since last touch, exact body with **Copy**, dossier + profile links, and the four exits **Sent · Replied · Skip · Not a fit**. Sent shows a 5-second **Undo** toast. Zero cards = full all-clear state with "Next due". |
| `/ledger` | dark panel. Top: last 50 event rows (ts local + UTC, lead, kind, step, variant, body_hash, idempotency_key, corrects). New rows flash in. Bottom tab: Lead state table derived from those rows. |

## Hand-off: set this up for a new user

1. `npm install` then `npm run seed -- --campaign=demo` then `npm run dev`, and open http://localhost:5173.
2. Click **Brand** (top-right) and set your own colours. They are saved in your browser only. Copy-as-JSON lets you move a palette between machines. To change what new users see first, edit `DEFAULT_THEME` in `web/src/lib/theme.tsx`.
3. Create your campaign on **New campaign**: name, one-line ideal customer, message chain, daily cap.
4. Connect the Google Sheet (optional, needed for the agent loop): open `sheet/Code.gs` in the sheet's Apps Script, run the setup function, deploy as a web app, then copy `.env.example` to `.env` and fill in `SHEET_BRIDGE_URL` and `SHEET_BRIDGE_TOKEN`. The **Sync sheet** button then appears on the Scout page.
5. Column contract and agent roles are in `sheet/SCHEMA.md`.

Without step 4 the app runs entirely on local JSON files.

## Branding

Every colour in the UI is a CSS variable. The **Brand** button (top-right) opens a panel with nine
hex fields (primary, accent, highlight, chrome, soft panel, neutral, background, card, text), a colour
picker per field, live preview, **Reset to default**, copy-as-JSON and paste-JSON. Changes are kept in
`localStorage` for that browser only — no data file is written.

The default palette is "Orange meets Navy":

| Role | Hex |
|---|---|
| primary (buttons, active nav, Sent) | `#ef4124` |
| accent (variant B, warm secondary) | `#ec7323` |
| highlight (new ledger rows, Undo) | `#efca08` |
| chrome / navy (ledger panel) | `#000022` |
| soft panel (waiting-on-you strip) | `#ece4b7` |
| neutral | `#666666` |
| background | `#f3f3f3` |
| card | `#ffffff` |

To change the shipped default, edit `DEFAULT_THEME` in `web/src/lib/theme.tsx`. Text-on-colour (white vs navy)
is picked automatically by luminance so a pasted palette stays readable.

## Frozen rules (where each one lives)

| Rule | Where |
|---|---|
| R1 one writer of `next_due_date` | `shared/derive.ts` → `deriveLeadState`. Nothing else computes or stores it. |
| R2 append-only events | `server/app.ts` — no PUT/PATCH/DELETE on `/api/events` (405). Undo and corrections are new rows with `corrects_event_id`. |
| R3 variant by hash | `shared/variant.ts` → `parseInt(lead_id[0],16) % 2 === 0 ? "A" : "B"`. |
| R4 weekend roll | `shared/dates.ts` → `rollWeekend`. Single helper. |
| R5 every card has an exit | `web/src/pages/Today.tsx` — four buttons, always. Skip is an event, not a filter. |
| R6 nothing derived is stored | `server/queries.ts` recomputes stage/step/due/counters per request; `verify` greps the JSON for derived keys. |
| R7 do-not-contact hard stop | `server/queries.ts` → `todayQueue` filters it first; `deriveLeadState.eligible` is false. |
| R8 daily cap | `todayQueue` slices to `daily_cap`, oldest `days_since_touch` first; overflow reports the next weekday. |
| R9 reply stops the sequence | `eligible=false` once a live `replied` exists; lead moves to the "Waiting on you" strip. |

Idempotency: every tap in the UI mints one key per (lead, step, action) and reuses it on a double-tap,
so the server writes one row and returns `{ duplicate: true }` for the second. Writes are serialised
through one mutex and written temp-file-then-rename.

## Demo run of show (about four minutes)

0. Night before: `npm run seed -- --campaign=demo`, swap `data/dossiers/<id>.md` for a real dossier
   if you want, edit copy in `shared/chain-gtm.ts` as `gtm@2` if you change it, `npm run verify`.
1. **New campaign** → Create. One row, one id on screen.
2. **Scout** → Invitation sent ×2. Watch the undo toast; the row greys.
3. The accepted lead (Priya Raman) — dossier ready, card in Today. Open dossier.
4. **Today** → Copy → paste into LinkedIn by hand → **Sent**. Undo toast for 5s. Open **Ledger** in a
   second tab and watch the row land: UTC timestamp, step, variant, body hash, idempotency key.
5. Clear the last card → **Nothing due today**. Hold two seconds. Then the ledger footer.

## Data files

- `campaigns.json` — `{ id, name, icp_sentence, chain_id, chain_version, daily_cap, start_date, created_at, status }`
- `chains.json` — `{ "gtm@1": { steps: [{ step, offset_days, angle, template, variant_a, variant_b }] } }`
- `leads.json` — facts only (`invited_at`, `accepted_at`, `withdrawn_at`, `do_not_contact`, `dossier_path`, `reply_status`)
- `events.json` — `{ event_id, ts_utc, campaign_id, lead_id, kind, step, variant, body_hash, idempotency_key, corrects_event_id, payload }`
- `touched-paths.json` — every path the app has written, for verify check 8
