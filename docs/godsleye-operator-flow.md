# God's L'Eye — operator flow

From a copy of the sheet to your first message sent. Follow it in order. Steps marked **you** cannot
be done by an agent.

---

## Part 1 — Make it yours (about ten minutes, once)

1. **Copy the template sheet** into your own Drive. `File → Make a copy`.
2. **Open the copy's script editor** and paste `godseye-Code.gs` over the placeholder.
3. **Run `setupBridge`** once. It writes the headers, installs the dropdowns, creates the `Messages`
   and `Events` tabs and prints a token. Authorising your own unpublished script is expected.
4. **Deploy it as a web app**: execute as you, access "Anyone". Copy the URL that ends in `/exec`.
   The token is the only password — treat the pair like one and don't post them anywhere public.
5. **Open the dashboard** and paste the URL and the token when it asks. It keeps them in your
   browser; you should not have to do this again.
6. **Check it's alive**: open `<your /exec URL>?token=<your token>` in a browser. You should see
   `{"rows":[]}`. An error here is worth ten minutes now rather than on a client call.

## Part 2 — Create the agents (you)

You need four agents, or three if you would rather write the briefs yourself.

| Agent | Its one job | Create it with |
|---|---|---|
| **Setup** | interviews you, fills the briefs | the `setup` brief |
| **Runner** | sweeps the sheet, owns every write | `runner` brief |
| **Researcher** | writes the dossier and the hook | `researcher` brief |
| **Copywriter** | three variants, Day 4, Day 10 | `copywriter` brief |

Where they run is your choice. An agent on your own machine using your own model subscription costs
you nothing per run beyond the subscription, but it only works while that machine is awake and it
handles one turn at a time — so three of them take turns rather than working in parallel. Hosted
agents run whether your laptop is open, and cost per turn. For a first week, one operator agent that
holds all three role briefs is the least moving parts; split into three when the volume earns it.
Either way the briefs are the same files.

**Giving an agent its instructions.** Two ways, both fine:

- Paste the brief into the agent's Instructions field when you create it. This is the cleanest: the
  agent starts knowing its job.
- Or send the brief as the agent's first message with: *"Save this to your notes and follow it from
  now on."* Agents keep their own notes, so they carry it forward.

Every agent that touches the sheet also needs two facts in its brief: **the sheet's `/exec` URL and
the token**. Put them under a heading "My sheet" in each brief. They are a password; that is why they
live in the agent's own notes and not in the document you hand around.

## Part 3 — Onboarding (you + Setup agent, ten minutes)

1. Open a conversation with the **Setup** agent and say: *"Run onboarding."*
2. It asks five questions, one at a time, and plays each answer back before moving on.
3. It produces `Inputs/brand.md` and three filled briefs with every slot replaced.
4. It hands you three copy blocks. Paste each into the matching agent (Instructions field, or as a
   first message with "save this to your notes").
5. Anything it could not get out of you appears under "Still open" — decide those before the first
   real run, or the brief carries a visible gap rather than a plausible guess.

Create the `Inputs/` folder in your Drive first and drop in anything you want the writer to be able
to quote: a one-pager, a case note, pricing. Add `Inputs/INDEX.md` with one line per file saying what
it is and when to use it — the agent reads the index, not the folder.

## Part 4 — The first run (you + agents)

1. **Ask the Scout** (or the Runner, if you kept one agent): *"Find 12 <your target> in <place> for
   the <campaign> campaign."* It appends rows with name, title, company, LinkedIn URL and its fit
   score. Rows without a working personal profile URL are dropped by rule — expect fewer than you
   asked for, and check the count before you send anything.
2. **You** send the connection requests in LinkedIn, by hand. The sheet does not and will not do
   this.
3. **You** set `Accepted?` to `Yes` when someone accepts. That is the only tick the system needs from
   you, and it is what starts the research.
4. **Press Sync** on the dashboard (or say "process accepted" to the Runner). Within a pass, the
   dossier appears as a document and the row goes to `ready`.
5. **Read the dossier.** It carries a fit score with its reasons and a cautions section — read the
   cautions before you send anything.
6. **Pick a variant**, copy it, open the profile from the same card, paste, send by hand.
7. **Mark it sent.** The sheet records which variant, when, and sets Day 4 and Day 10 for you.
8. **Open Today each morning.** It shows only people who are ready or due. Nothing else needs your
   attention, and nothing goes quiet because you forgot it.

## What stays manual, and why

Sending and accepting on LinkedIn; choosing the words; deciding who is worth pursuing; and every
claim you make. The system removes the blank page and the bookkeeping. It does not pretend to own the
relationship — and that is the reason it is safe to run on your own account.
