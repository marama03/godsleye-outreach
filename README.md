# God's L'Eye — GenTeam (Genspark) Edition

God's L'Eye — GenTeam (Genspark) Edition is a Google Sheet and five narrow agents for LinkedIn outreach you send by hand.

You describe the buyer. The agents find prospects, research everyone who accepts, decide who is worth
your time, and write the messages. You send every message yourself, from your own LinkedIn. Nothing in
this repo can send anything.

**Read `docs/godsleye-start-here.md` first.** It is the manual: setup, the map of who does what, the
first run, the daily rhythm, and an honest list of what has and has not been tested. Then give the
whole file to one agent called **LinkedIn Prospect Scout** and let it run the setup with you — that is
what the document tells the reader to do, and this README should not contradict it.

## What it needs

- A Google account, and a spreadsheet you own. An agent builds it for you; nothing needs a script,
  a deployment or a token.
- An agent product that can hold five agents with fixed display names and @-mention between them.
  Any product with instructions, a name, and agent-to-agent mentions will do.
- A model subscription or a hosted agent for those five agents to run on.
- Somewhere to run the dashboard. It keeps the data in local files on that machine and never talks to
  Google at all, so a laptop is enough — and a static host is not, because that is not where the data is.

## Setup

About half an hour the first time. Step 1 is the one people skip, and it is the one that matters.

1. Create one agent, display name **LinkedIn Prospect Scout**, and give it this whole manual —
   `docs/godsleye-start-here.md` — as its instructions. It walks you through the rest, one step at a
   time, and it creates the other four agents for you.
2. Approve its access to your Google Drive when it asks. That approval is the whole credential: there
   is no script to paste, no deployment to publish and no token to keep.
3. Let it build the sheet: `Pipeline` with the twenty-two column header, plus an `Events` log. Open it
   once to confirm the header row.
4. `npm install` then `npm run dev` in `app/`, and open the dashboard. It has no Google credential of
   its own and nothing to configure.
5. Give the sheet link to **LinkedIn Outreach Tracker**. It is the only thing that reads and writes the
   sheet, and it reports the row count back. From then on a pass is a request, not a click.
6. The five agents: `docs/agent-briefs/` holds one README each, and the Scout creates them in chain
   order for you. If you are doing it by hand, the order and the exact names are section 6 of the
   manual — the name matters more than it looks, because each agent wakes the next by typing it.

The repository is not needed for any of this.

## What is deliberately manual

- Sending connection requests, and accepting them.
- Sending every message.
- Choosing the wording.
- Deciding who is worth your time.
- Every claim made about the business.

Each one is a decision, not a gap. `docs/godsleye-start-here.md`, section 4, says why.

## What is in here

- `docs/` — the manual, the demo script, the operator checklist, the five agent READMEs.
- `sheet/` — an **optional** Apps Script that stamps the sheet the instant you tick a cell. It is not
  part of the setup, and a sheet wired to it must not also be swept by the Tracker: two writers on one
  row is the one thing this design refuses. Section 6 of the manual explains when it is worth having.
- `app/` — the dashboard: Today, the row cards, the send and undo path.
- `tests/` holds the sheet-script checks. `node tests/apps_script_sim.js` runs 119 checks against `sheet/Code.gs` inside a stubbed Apps Script runtime; `python3 tests/e2e.py` runs 117 end-to-end checks (needs node). `node tests/local-app.mjs` runs 20 checks on the dashboard's local store (needs `npm install` in `app/`): sent, skip, undo, double-click and restart, with no sheet or token. None of the three touches a real sheet; none of them needs a Google credential.

## Status

Demo build, not a product. What is proven: the dashboard on its own store with no Google credential
(20 checks, including a restart), the sheet-side round trip by an agent with no script in the path
(pull, push, a second pass that writes nothing, and two deliberate conflicts that were reported rather
than written), and the ladder arithmetic from `Sent At`. What is not: a stranger following the setup end
to end, and a browser clicking the buttons rather than the API underneath them. Nothing here has sent a
message, and nothing here can. Read `docs/godsleye-start-here.md`, section 17, before you trust it with
a real list.

## Licence

See `LICENSE`. If there is no `LICENSE` file, the code is not licensed for reuse.
