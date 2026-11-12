# God's L'Eye

A Google Sheet and five narrow agents for LinkedIn outreach you send by hand.

You describe the buyer. The agents find prospects, research everyone who accepts, decide who is worth
your time, and write the messages. You send every message yourself, from your own LinkedIn. Nothing in
this repo can send anything.

**Read `docs/godsleye-start-here.md` first.** It is the manual: setup, the map of who does what, the
first run, the daily rhythm, and an honest list of what has and has not been tested. Then give the
whole file to one agent called **God's L'Eye Guide** and let it run the setup with you — that is what
the document tells the reader to do, and this README should not contradict it.

## What it needs

- A Google account, and a spreadsheet you own.
- An agent product that can hold five agents with fixed display names and @-mention between them.
  Any product with instructions, a name, and agent-to-agent mentions will do.
- A model subscription or a hosted agent for those five agents to run on.
- Somewhere to run the dashboard. It talks to the sheet through its own server, so it is not a static
  page — a laptop and a tunnel is enough to start.

## Setup

About half an hour the first time. Step 1 is the one people skip, and it is the one that matters.

1. Create one agent, display name **God's L'Eye Guide**, and give it this whole manual —
   `docs/godsleye-start-here.md` — as its instructions. It walks you through the rest, one step at a
   time, and it creates the five agents for you.
2. Copy the template sheet. `File → Make a copy`.
3. `Extensions → Apps Script`, paste `sheet/Code.gs`, save.
4. Run `setupBridge` once, approve the permissions, copy the token it prints.
5. `Deploy → New deployment → Web app`, execute as **Me**, access **Anyone**, copy the `/exec` URL.
6. Put the URL and the token into the dashboard when it asks.
7. Open `<exec URL>?token=<token>`. You should see `{"rows":[]}`.
8. The five agents: `docs/agent-briefs/` holds one README each, and the Guide creates them in that
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
- `sheet/` — the Apps Script that backs the sheet. It owns state and dates. No agent writes state.
- `app/` — the dashboard: Today, the row cards, the send and undo path.
- `tests/` holds the sheet-script checks. `node tests/apps_script_sim.js` runs 119 checks against `sheet/Code.gs` inside a stubbed Apps Script runtime; `python3 tests/e2e.py` runs 117 end-to-end checks (needs node). Neither touches a real sheet.
- The pack's `godsleye-Code.gs` is `sheet/Code.gs` here.

## Status

Demo build, not a product. The script logic passes its simulator suite; the dashboard has not been run
against a live deployment on a hosted account. Nothing here has sent a message, and nothing here can.
Read `docs/godsleye-start-here.md`, section 16, before you trust it with a real list.

## Licence

See `LICENSE`. If there is no `LICENSE` file, the code is not licensed for reuse.
