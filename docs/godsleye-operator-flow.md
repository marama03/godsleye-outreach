# God's L'Eye — operator flow

*God's L'Eye — GenTeam (Genspark) Edition*

From a sheet to your first message sent. Follow it in order. Steps marked **you** cannot be done by an
agent. `godsleye-start-here.md` explains why each step exists; this is the checklist. On a first setup,
give that file to an agent called **LinkedIn Prospect Scout** and let it run this list with you, one
step at a time — this page is what you come back to the second time, or when you want the shape of it
at a glance.

---

## Part 1 — Make it yours (about ten minutes, once)

1. **Have your sheet built.** Give the template link to the Scout as the shape you want, and let it
   create your own spreadsheet: `Pipeline` with the twenty-two column header, plus an `Events` log.
   Nothing is copied by hand unless the agent cannot create files in your Drive (section 6 of the
   manual is the fallback).
2. **Approve Google Drive for your agent.** The first time it touches Google it asks you to connect
   Drive. Approve it once, on your own account. That approval is the only credential in the system:
   no script, no deployment, no token, nothing to paste.
3. **Open the dashboard** (`npm install`, `npm run dev` in `app/`). It has no Google credential of its
   own — it reads and writes local files on the same machine and never talks to Google.
4. **Give the Tracker the sheet link** in its conversation, with the words *"This is my sheet. Keep it
   in your notes."* It confirms the header shape and reports the row count. That reply is your
   equivalent of a health check: if it cannot read the sheet, you hear it now, not on a client call.

## Part 2 — Create the five agents (you)

Five, each with one job. Create them in this order — LinkedIn Prospect Scout first, so you can be finding prospects while
you set up the rest.

| # | Agent | Its one job | Give it |
|---|---|---|---|
| 1 | **LinkedIn Prospect Scout** | finds prospects, appends rows | `agent-briefs/linkedin-prospect-scout.md` |
| 2 | **LinkedIn Outreach Tracker** | sweeps the sheet, owns every status write, dispatches and reconciles | `agent-briefs/linkedin-outreach-tracker.md` |
| 3 | **LinkedIn Intel Researcher** | one accepted prospect in, one dossier out | `agent-briefs/linkedin-intel-researcher.md` |
| 4 | **LinkedIn Strategy Prioritizer** | scores and routes: attention, nurture, archive | `agent-briefs/linkedin-strategy-prioritizer.md` |
| 5 | **LinkedIn Outreach Copywriter** | three openings and the five-rung ladder | `agent-briefs/linkedin-outreach-copywriter.md` |

The display name must be exactly as written. The agent before each one wakes it by typing that name,
and a near-miss is a handoff that silently fails. Every README checks its own name first and tells you
what to do if it is wrong — which, in the worst case, is to delete the agent and create it again.

**Giving an agent its instructions.** Two ways, both fine:

- Paste the README into the agent's Instructions field when you create it. Cleanest: the agent starts
  knowing its job.
- Or send the README as the agent's first message with: *"Read this and follow it from now on."*
  Agents keep their own notes, so they carry it forward.

**Then give it your sheet.** The Tracker is the one agent that reads and writes the sheet, and it is
given the link — never a password, because there is no password in this design. The other four reach
the sheet through it: the Scout appends prospect rows, the Researcher attaches a dossier link, the
Prioritizer and the Copywriter read what they need. If you are giving a second agent the link directly,
tell it plainly that it may read but that only the Tracker writes state.

**Then make it say its job back.** *"In one line: what is your job, who wakes you, and who do you
wake?"* If the answer is wrong, fix it now. While you are still creating them, the agent after it will
not exist yet — the README tells it exactly what to say about that.

Where they run is your choice. An agent on your own machine using your own model subscription costs
nothing per run beyond the subscription, but it only works while that machine is awake, and it handles
one turn at a time — so five of them take turns rather than working in parallel. Hosted agents run
whether your laptop is open and cost per turn. For a first week, LinkedIn Prospect Scout plus LinkedIn Outreach Tracker is the
minimum that produces anything; add the other three before the first accepted prospect, or the row will
sit at `queued` with nobody to hand it to.

## Part 3 — Onboarding (you + each agent, in its own conversation)

There is no separate interview step. Each README ends with the questions that agent needs, and the agent
asks them itself, one at a time, playing each answer back in a line before moving on.

1. **LinkedIn Prospect Scout:** what you sell; who you target and who you refuse; how many is a run.
2. **LinkedIn Outreach Tracker:** your rhythm — the days, your timezone, the days you work — and where prospects come
   from.
3. **LinkedIn Intel Researcher:** what you sell; what counts as proof and what may never be claimed; the size floor
   and the "already has it" test.
4. **LinkedIn Strategy Prioritizer:** what you sell and what a good fit looks like; what "worth your time" means, and how
   many personal messages you can actually send in a week.
5. **LinkedIn Outreach Copywriter:** what you sell; three real messages in your voice and the never-say list; the proof
   you may use.

You will answer "what do you sell" four times. That is expected — the agents do not share memory, and
an agent that was never told will guess. Keep the answers short and identical.

**Before the first research run**, create `Inputs/` in your Drive and drop in anything you want the
writer to be able to quote: a one-pager, a case note, pricing. Add `Inputs/INDEX.md` with one line per
file saying what it is and when to use it — the agent reads the index, not the folder. LinkedIn Outreach Copywriter
gives you the text of `Inputs/brand.md`; save it there yourself, so the file is yours to correct.

Anything an agent could not get out of you appears in its notes as `[DECIDE: the question]` and is said
out loud. Decide those before the first real run, or the agent carries a visible gap rather than a
plausible guess.

## Part 4 — The first run (you + the chain)

1. **Ask LinkedIn Prospect Scout:** *"Find 12 <your target> in <your market> for the <campaign> campaign."* It
   appends rows with the prospect fields and the campaign. Rows without a working personal profile URL
   are dropped by rule — expect fewer than you asked for, and read the shortfall before you move on.
2. **You** send the connection requests in LinkedIn, by hand. The sheet does not and will not do this.
3. **You** set `Accepted?` to `Yes` when someone accepts. `Accepted At` and `Research Status = queued`
   fill in on their own. That is the only tick the system needs from you, and it is what starts the
   research.
4. **Ask for a pass** — say "run a pass" to LinkedIn Outreach Tracker (there is nothing to press: the dashboard has no sheet connection of its own). LinkedIn Outreach Tracker sweeps,
   stamps the batch `dispatched`, and wakes LinkedIn Intel Researcher once for the whole batch.
5. **Wait for the dossier and the verdict.** LinkedIn Intel Researcher writes the dossier and sets `Dossier URL`
   and `Hook Theme`; LinkedIn Outreach Tracker moves the row to `ready`. LinkedIn Strategy Prioritizer scores it, routes it, and
   hands it to LinkedIn Outreach Copywriter for attention and nurture — or to LinkedIn Outreach Tracker to close, for archive.
6. **Read the dossier.** It carries the score with its reasons and a cautions section. Read the
   cautions before you send anything.
7. **Open Today**, pick one of the three openings, copy it, open the profile from the same card, paste,
   and send by hand.
8. **Mark it sent.** The sheet records which variant, when, `Stage = day4`, and `Next Due` four days
   out. You never type those.
9. **Open Today each morning.** It shows only people who are ready or due: Day 4, Day 10, Day 18,
   Day 30, Day 45, then done — all counted from the day of your first message. Nothing else needs your
   attention, and nothing goes quiet because you forgot it.

## What stays manual, and why

Sending and accepting on LinkedIn; choosing the words; deciding who is worth pursuing; and every claim
you make. The system removes the blank page and the bookkeeping. It does not pretend to own the
relationship — and that is the reason it is safe to run on your own account.

---

Built by **Daniel Marama**
[maramamarketing.com](https://www.maramamarketing.com) · [portfolio.maramamarketing.com](https://portfolio.maramamarketing.com) · [daniel@maramamarketing.com](mailto:daniel@maramamarketing.com)
