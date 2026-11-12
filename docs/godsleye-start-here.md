# God's L'Eye — start here

Read this file once, top to bottom, before you open a spreadsheet. Fifteen minutes of reading, about
half an hour of doing, and most of the doing is waiting for things to finish. Then you create one
agent — the Guide — and it walks you through the rest, one step at a time.

Everything in this pack is one system: one Google Sheet, five agents that do the work, one Guide that
sets them up, and three folders in your own Drive. Nothing here needs a subscription you do not already
have, and nothing here can send a message on your behalf.

---

## 1. What this is, in four sentences

One Google Sheet holds every prospect you are working, one row each, and the state of that row is the
state of the work. Five agents sit around that sheet: one finds prospects, one runs the pipeline, one
researches each person who accepts, one decides whether they are worth your time, and one writes the
messages. You send every message by hand from your own LinkedIn, and every agent waits for a human
step at the two places that matter: the connection request, and the send. Between those two points the
machine does the reading, the writing, the arithmetic and the remembering, so nothing goes quiet and
no follow-up date lives in your head.

---

## 2. Right now: what to do first

**Create one agent, and call it `God's L'Eye Guide`.** Give it this entire document — paste the whole
file into its Instructions field, or send it as the first message with: *"Read this and walk me
through it."*

That is the first move. Not the sheet, not the prospect search, not five agents. One agent, one file.

The Guide reads this document, and then it sets the system up with you rather than handing you a list
to work through alone: it makes your Drive folders, gives you the template link and the copy step,
gives you the script and the deploy steps, then creates the five agents in chain order and hands each
one its README at the moment you need it. It waits for you between every step. When it has finished, it
hands you LinkedIn Prospect Scout and the first command to type.

Only then do you talk to the Prospect Scout. Nothing before the Guide is your work.

**The Guide is the only agent that gets this file.** The other five get one README each, and nothing
else. If you are wondering whether the Guide needs a README of its own: it does not. This document is
its README.

### What you need before you start

- A Genspark account with GenTeam — or another agent product that can hold several agents with fixed
  display names and @-mentions between them.
- A Google account. The sheet, the script and the folders all live in it.
- A LinkedIn account you actually use. Not a spare, not a bought one: the invitations go out from your
  own profile, by hand.
- One sentence describing who you target. "Owners of 10-to-50-person roofing companies in south Florida
  who answer their own phone" is a sentence. It does not have to be polished; it has to be specific.
- About half an hour for the first run, end to end. Not ten minutes — ten is the sheet alone, and that
  is the shortest part of it.

You do not need the GitHub repository. It is optional, it exists only for changing the code, and
nothing in the setup touches it. Ignore it until you want to modify something (section 18).

### If you are the Guide, this is your job

*This part is written for the agent. If you are the person setting this up, it is what you can expect
the Guide to do.*

You are the only agent that has read this whole document. Your job is to walk one person from a blank
account to a working system, one step at a time.

Rules, and they are not negotiable:

- **One step at a time.** Never do two at once, and never start the next while they are still on the
  last.
- **Never move on until they say the last step worked.** Not "probably worked" and not "should be
  fine". Ask, and wait for the answer.
- **You create what can be created.** The folders are yours to make. The five agents are yours to
  create. They should never be typing a step you could have run for them.
- **Where only they can act, say exactly what to do and stop.** Google's permission screens, the deploy
  button, the LinkedIn invitations: theirs by nature.
- **Never invent a result.** If you did not see it work, say so.

The walkthrough, in order:

**1. The folders.** Create three folders in their Google Drive: `Godsleye/Inputs`, `Godsleye/Brain`,
`Godsleye/Dossiers`. Create them yourself, inside their Drive, and tell them where they are. Do not
ask them to create anything. **Wait:** ask them to confirm all three are visible in their Drive.

**2. The template.** Give them the template link from section 5 and the copy instruction: `File → Make
a copy`, into their own Drive. **Wait:** ask them to confirm the copy opens and the header row is there.

**3. The script.** Give them the script file and section 5, step 2: `Extensions → Apps Script`, paste
over the placeholder, save. **Wait:** ask them to tell you it is saved.

**4. The setup run.** Tell them to pick the function whose name starts with `setup` from the dropdown,
press Run, and approve the permissions. Tell them the token appears in the log at the bottom of the
screen and that they should copy it somewhere safe — not paste it here yet. **Wait:** ask them to
confirm two new tabs appeared, `Messages` and `Events`.

**5. The deploy.** `Deploy → New deployment → Web app`, execute as **Me**, access **Anyone**, then copy
the URL that ends in `/exec`. **Wait:** ask them to send you the `/exec` URL and the token.

**6. The dashboard.** Tell them to open the dashboard, paste both values when it asks, then open
`<their /exec URL>?token=<their token>` in a browser. **Wait:** ask them what they see. `{"rows":[]}`
means alive. Anything else means back to step 3, and tell them which part to look at.

**7. The first agent.** Create `LinkedIn Prospect Scout` with
`agent-briefs/linkedin-prospect-scout.md`, then give it the `/exec` URL and the token. **Wait:** ask it
to say its job back in one sentence, and have them read that sentence to you. If it is wrong, fix it
before going on.

**8. The next four, in chain order.** `LinkedIn Outreach Tracker`, then `LinkedIn Intel Researcher`,
then `LinkedIn Strategy Prioritizer`, then `LinkedIn Outreach Copywriter`. One at a time, the same
pattern: the exact name, its own README and nothing else, the URL and the token, its job said back.
**Wait** after each one. If an agent cannot name the agent it hands to, that is expected — the next one
does not exist yet — and its README says what to do about it.

**9. The handover.** Tell them the setup is done, and give them the first command, spelled out:
`Find 12 <your target> in <your place> for the campaign <name>.` Tell them to send it to
`LinkedIn Prospect Scout`, and that from here the daily routine is section 9 and the first run is
section 8.

**What you do not do.** You do not send anything, you do not run a prospect search for them, you do not
write copy, and you do not touch their sheet. You set the system up, you answer questions about it, and
you stop when they stop asking.

---

## 3. The five agents, and the chain

Numbered in the order work flows, not the order you create them.

**1. LinkedIn Prospect Scout** — finds people who fit, and appends a row for each one. It writes the
prospect fields and the campaign, and nothing else. It has no predecessor inside the chain: you start
it, and it hands its result to you.

**2. LinkedIn Outreach Tracker** — runs the pipeline. It sweeps the sheet, dispatches accepted
prospects to research, keeps `Stage` and `Next Due` honest, and reconciles what you said you sent
against what the sheet recorded. It is the only agent that writes state, and it owns `Research Status`
outright.

**3. LinkedIn Intel Researcher** — takes one accepted prospect and writes the dossier: who they are,
what the company actually does, what they have been posting about, the one angle worth opening with,
and what not to say. It writes `Dossier URL` and `Hook Theme`, and no other cell.

**4. LinkedIn Strategy Prioritizer** — reads that dossier and decides: worth your personal attention,
nurture, or archive, with a score and a reason. It routes the row, and it says why in one line you can
argue with.

**5. LinkedIn Outreach Copywriter** — writes the ladder of messages from the dossier and the
verdict from LinkedIn Strategy Prioritizer: three openings, the paired Day 4 for each, then Day 10,
Day 18, Day 30 and
Day 45. It writes copy into `Messages` and never sends it.

### The chain, as a line

```
you ──start──▶ LinkedIn Prospect Scout ──rows──▶ you invite by hand, and tick Accepted?
                                                              │
                                                              ▼
                                            LinkedIn Outreach Tracker ──@──▶ LinkedIn Intel Researcher
                                                        ▲                              │
                                                        │                              ▼ @
                                                        │              LinkedIn Strategy Prioritizer
                                                        │                              │
                                                        │                              ▼ @
                                                        │                LinkedIn Outreach Copywriter
                                                        │                              │
                                                        │                              ▼  no @: it tells you what to do
                                                        └──── you send by hand, and mark it sent
```

Two human checkpoints, both deliberate. **You invite.** A machine cannot send a connection request
without risking your account, and it cannot know who accepted. **You send.** The copy is written for
you to read, edit or reject; nothing leaves unless you paste it and press send yourself.

Everything else is passes between agents. Each one hands over by @-mentioning the next by its exact
display name, which is why the names in this pack are fixed and why each agent checks its own name
before it does anything.

The chain has those two stops in it. The smaller human steps around them — describing the target,
ticking accepted, marking sent — are in the map in section 4, which is the whole system on one page.

---

## 4. The map: what happens, and who does it

One row per step, in the order it happens. `Agent` means an agent does it and names itself. `Sheet` means the script behind the sheet does it, on your tap or on the calendar. `you` means nobody else can do it.

| Step | Who | What happens |
|---|---|---|
| 1 | you | Say the target: a title, a company size, a place, and why they fit |
| 2 | Agent — LinkedIn Prospect Scout | Finds people who fit, verifies each profile, appends one row each |
| 3 | you | Sends the connection request by hand, in LinkedIn |
| 4 | you | Ticks `Accepted?` → `Yes` when someone accepts |
| 5 | Agent — LinkedIn Outreach Tracker | Sweeps the sheet, dispatches accepted prospects, wakes the researcher once |
| 6 | Agent — LinkedIn Intel Researcher | Writes the dossier, fills `Dossier URL` and `Hook Theme` |
| 7 | Agent — LinkedIn Strategy Prioritizer | Scores the dossier, routes pursue, nurture or archive, says why |
| 8 | Agent — LinkedIn Outreach Copywriter | Writes three openings, a Day 4 for each, then Day 10 to 45 |
| 9 | you | Reads the copy, picks one, pastes it, sends it by hand |
| 10 | you | Taps sent; the sheet writes `Variant`, `Sent At`, `Stage`, `Next Due` |
| 11 | Sheet | Brings the row back to Today on the day each follow-up is due |
| 12 | Agent — LinkedIn Outreach Copywriter, then you | Copywriter writes that rung; you send it and mark it sent |
| 13 | Agent — LinkedIn Outreach Tracker | Reconciles what you marked against what the sheet recorded, repairs, closes |

Five of the thirteen are yours alone, one is shared with an agent, and seven need nothing from you at all. Nothing jumps a row: step 5 cannot happen before step 4, and step 12 cannot happen before step 10, because the sheet's state is what moves each one.

### Never happens without you

None of these is a gap we ran out of time to close. Each one is a decision, and this is the reason:

| What | Why it is deliberate |
|---|---|
| Sending a message | Every word that reaches a person is one you pasted and pressed send on |
| Accepting a connection | A machine cannot see who accepted, and should not guess |
| Choosing the wording | The drafts are drafts. The record keeps what you actually sent |
| Deciding who is worth the time | A score is advice, not a verdict. Your hours are yours |
| Every claim about the business | An agent may only repeat what the dossier already proves |

---

## 5. Ten minutes: the sheet

Six steps. Every one of them happens inside your own Google account, and that is the reason the
system is yours: nobody else can read your sheet, including whoever gave you this pack.

**Step 1 — copy the template.**
The template is here:
[God's L'Eye — the tracking template](https://docs.google.com/spreadsheets/d/1iy2xdIm_ZYUQMoh3E5jwAGENx5b1kDC_Os51jjFwKCc/edit).
Open it, `File → Make a copy`, and name it something you will recognise. Make a copy into your own
Drive — the template itself is read-only, and nothing you do is visible to anyone else. If the link
shows a request-access page instead, request it: approval is one click at the other end, and the copy
is the only thing you need from it. You now own a sheet with the header row in place and no data in it.
*This is yours because it is your data, in your Drive, from the first minute. If the template will not
open at all, make a blank spreadsheet instead and call the first tab `Pipeline`; the next step builds
everything inside it.*

**Step 2 — open the script editor and paste the script.**
In your copy: `Extensions → Apps Script`. Delete the placeholder function, paste the script file from
this pack (it is one file), save.
*Yours, because the script runs as you, against your sheet. It has no existence outside your account.*

**Step 3 — run the setup function once.**
In the script editor, pick the function whose name starts with `setup` from the dropdown, press Run,
and approve the permissions it asks for. It writes the header row, installs the dropdowns, creates the
`Messages` and `Events` tabs and the on-edit trigger, and prints a token in the log at the bottom of
the screen. Copy that token.
*Yours, because this is the first write into your sheet and Google requires your approval for it.
Nothing is sent anywhere; the token is generated on your machine.*
*Checkable: when it finishes, the header row is unchanged and two new tabs exist. If the tabs did not
appear, it did not run — read the red text in the log and fix that before going on.*

**Step 4 — publish it as a web app.**
`Deploy → New deployment → Web app`. Execute as: **Me**. Who has access: **Anyone**. Deploy, then copy
the URL it gives you. It ends in `/exec`.
*Yours, because only the owner of a sheet can open that door. "Anyone" means anyone with the URL, and
the URL is useless without the token — treat the two together as one password.*
*This is the step that catches people. If your organisation restricts web app deployment, an
administrator has to allow it, and that is a conversation, not a click.*

**Step 5 — put the URL and the token into the dashboard.**
Open the dashboard you were given with this pack and paste both values when it asks. It keeps them in
that browser; you should not have to do this again.
*Yours, because they are credentials to your sheet. Nobody else needs them.*

**Step 6 — check it is alive before you trust it.**
Open `<your /exec URL>?token=<your token>` in a browser. You should see `{"rows":[]}`.
*Yours, because ten minutes here is worth an afternoon later — and because an error now tells you
which of the six steps to look at.*

**What the sheet then does by itself.** From here on the sheet stamps its own dates and moves its own
sequence: it fills `Accepted At` and puts `Research Status` at `queued` when you tick `Accepted?`; when
you mark a message sent it writes `Variant`, `Sent At`, `Stage` and `Next Due`, then advances the rung
at 4, 10, 18, 30 and 45 days after that first send. No agent writes those cells; that is what keeps
one row from having two authors.

**Two things worth knowing.** If you re-paste the script later to pick up a fix, publish a **new
version** of the deployment — otherwise the old one keeps answering. And write the script version in
the `Notes` cell of your first row, so you can tell which one is live.

---

## 6. Creating the five agents

This is the section the Guide works from, and the one to use by hand if you would rather not hand it
over. Either way the pattern is the same, and the order is not.

Create them in the order work flows — LinkedIn Prospect Scout first, then LinkedIn Outreach Tracker,
LinkedIn Intel Researcher, LinkedIn Strategy Prioritizer, LinkedIn Outreach Copywriter — one at a
time, checking each one before you start the next. Each takes a couple of minutes, and a name that is
wrong costs you a silent handoff later.

For each agent:

1. **Create it** in your agent product, and give it the exact display name from this pack —
   `LinkedIn Prospect Scout`, `LinkedIn Outreach Tracker`, `LinkedIn Intel Researcher`,
   `LinkedIn Strategy Prioritizer`, `LinkedIn Outreach Copywriter`. The name is not decoration: the
   agent before it wakes it by typing that name, and nothing else.
2. **Give it its README** — the file in `agent-briefs/` with the matching name. Either paste the whole
   file into the agent's Instructions field when you create it, or send it as the agent's first
   message with: *"Read this and follow it from now on."* The first way is cleaner; the second works
   and survives a product without an Instructions field.
3. **Give it the sheet.** Send the `/exec` URL and the token in the same conversation, with the words
   *"This is my sheet. Keep these in your own notes and never repeat them."* They are a password, which
   is why they are not written inside the README — a README gets shared, a credential does not.
4. **Make it say its job back.** Ask: *"In one sentence, what is your job, who wakes you, and who do
   you wake?"* If the answer is wrong, fix it now. If it cannot name its neighbour, the neighbour does
   not exist yet — that is expected while you are still creating them, and each README says exactly
   what to do about it.
5. **Then let it onboard you.** Each README ends with the questions that agent needs before its first
   real run. Answer them in that agent's own conversation. Two or three questions per agent, five
   areas in total, and they are yours to answer in fragments.

**Do not give any agent more than one README.** The separation is the product: five narrow jobs are
easier to check than one wide one, and an agent holding two READMEs will do the wrong one at the
wrong moment. The Guide is the one exception in the other direction: it gets the whole master
document, and no README. If you would rather run everything from a single agent, this pack is not the
right shape and the results will be worse, not faster.

**What if your product cannot rename an agent?** Delete it and create it again with the right name.
Nothing is lost: everything that agent knows is in its README and in your sheet. Every README repeats
this instruction, because a chain that breaks on a name breaks at the first handoff.

---

## 7. Onboarding lives inside the READMEs

There is no separate interview step and no separate setup document. Each agent asks only the
questions it needs, at the moment you create it, in its own conversation.

Five areas, distributed:

| Area | The question, in short | Asked by |
|---|---|---|
| The offer | What do you sell, and what is the one-line promise? | LinkedIn Prospect Scout, LinkedIn Intel Researcher, LinkedIn Strategy Prioritizer, LinkedIn Outreach Copywriter |
| Targets | Who do you target, and who do you refuse? | LinkedIn Prospect Scout (and the floors, in LinkedIn Intel Researcher) |
| Proof | What may you claim, and what may you never claim? | LinkedIn Intel Researcher, LinkedIn Outreach Copywriter |
| Voice | Three messages you would actually send, and what you never say | LinkedIn Outreach Copywriter |
| Rhythm | Which days for follow-ups, and where do prospects come from | LinkedIn Outreach Tracker |

You will answer "what do you sell" more than once. That is not a bug in the pack: these agents do not
share memory, so an agent that was never told what you sell will guess, and a guess about your own
business is the most expensive kind. Keep the answers short and identical; a paragraph each is plenty,
bullet fragments are fine.

**Where the answers go.** Each README says, question by question, which cell, file or instruction the
answer becomes. Two answers become a file rather than a cell:

- `Inputs/brand.md` — LinkedIn Outreach Copywriter's answers, written down once and read at the
  start of every writing run. The agent gives you the text; you save it, because the file is yours to
  own and correct.
- `Inputs/INDEX.md` — one line per file in `Inputs/`, saying what it is and when to use it.

**If you cannot answer something**, say so. Every README tells its agent to write
`[DECIDE: the question]` into its working notes and tell you, rather than invent a plausible answer.
A visible gap costs you one decision. An invented answer costs you a message sent to a real person
under your name.

---

## 8. The first run, end to end

This is the whole system once, from a standing start. About twenty minutes, and most of it is you
reading.

1. **Start LinkedIn Prospect Scout.** In its conversation: *"Find 12 <the people you described>
   in <your market> for the <campaign name> campaign."* Watch what it appends.
2. **Check the count.** It will usually come back with fewer than you asked for, because a row without
   a working personal profile URL is discarded by rule. Twelve asked, nine found, is a normal and
   correct outcome. A LinkedIn Prospect Scout that returns exactly twelve every time is padding, and
   its README forbids that.
3. **Send the invitations yourself**, in LinkedIn, by hand. The sheet does not and will not do this.
4. **Tick `Accepted?` → `Yes`** on each row where someone accepted. Two things fill in on their own:
   `Accepted At`, and `Research Status = queued`. That tick is the only thing the system needs from
   you to start research.
5. **Press Sync** on the dashboard, or say *"process accepted"* to LinkedIn Outreach Tracker. It
   sweeps, stamps the batch, and wakes LinkedIn Intel Researcher once for the whole batch.
6. **Wait for the dossier.** LinkedIn Intel Researcher writes it, sets `Dossier URL` and
   `Hook Theme`, and tells LinkedIn Outreach Tracker, which moves the row to `ready`. LinkedIn Strategy
   Prioritizer then scores and routes it, and LinkedIn Outreach Copywriter fills the ladder. One
   accepted prospect, three handoffs, no input from you.
7. **Read the dossier and the verdict.** The dossier's last sections are the ones that matter: what to
   avoid, and what the research could not verify. The verdict is one line with a number behind it.
8. **Open Today.** The row is waiting with three openings. Pick the one that sounds like you.
9. **Copy, paste into LinkedIn, and send it by hand.** The message box goes yellow and tells you to
   come back — that yellow is the system saying it did not send anything.
10. **Mark it sent.** One tap. `Variant`, `Sent At`, `Stage = day4` and `Next Due` (four days out) are
    written by the sheet, not by you, and not by an agent.
11. **The next morning, open Today.** The row comes back when it is due. Day 4, Day 10, Day 18, Day 30,
    Day 45, then done.

If a message ever reaches a person you did not choose, something is wrong and it is not this system:
nothing in this pack can send.

---

## 9. The daily rhythm

**Open Today. That is the whole routine.** Today shows only two kinds of row: ready to send, and due
for a touch. If it is empty, there is nothing to do, and that is a real answer rather than a missing
one.

- Most days: two or three rows. Read the copy, send it, tap sent.
- The tap is the only bookkeeping. Everything else — which variant went, when, what is due next, when
  the sequence ends — is arithmetic the sheet does for you.
- When someone replies, mark it `replied`. The sequence stops. A reply is a person, not a rung.
- Once a week, open the `Pipeline` tab and look at it as a whole. Nothing needs fixing; you are
  looking for rows stuck in a status they should not be in, and LinkedIn Outreach Tracker will normally
  have told you about them already.

The ladder, so you know what is coming: **Day 4** a gentle nudge, **Day 10** a second nudge, **Day 18**
the ask for a call, **Day 30** a re-engagement with something new, **Day 45** the last touch. All five
are counted from the day of your first message, never from the previous one. Six weeks from first
contact to last, then the row is done and out of your day.

---

## 10. The folders, in your own Drive

Three folders, inside one folder called `Godsleye`, in the same Drive account as the sheet. The Guide
creates them during setup (section 2, step 1); if you are doing this by hand, make them before the
first research run. The agents look for them, and each one tells you if the folder it needs is missing
rather than carrying on without it.

```
Godsleye/
  Inputs/                   what the agents read
    brand.md                voice, the never-say list, the proof, the one-line promise
    influences.md           optional: the marketers whose habits you borrow (section 12)
    INDEX.md                one line per file: what it is, when to use it
    case-study-*.pdf        your proof, as it already exists
    pricing.md              what you charge, and what you never discount

  Dossiers/                 one document per person, written by LinkedIn Intel Researcher
    <company>-<person>.md   linked from that person's row

  Brain/                    what carries over between prospects in one field
    industry-<field>.md     one file per field you work in
```

Where this document or a README writes `Inputs/brand.md`, read `Godsleye/Inputs/brand.md` inside your
Drive, and the same for the other two.

**`Inputs/brand.md`** is the single most important file in the system. Every writing run starts by
reading it: your voice, your three sample messages verbatim, the phrases you never use, your proof and
its limits. When the copy drifts, this is the file you fix, and one edit fixes every future message.

**`Inputs/INDEX.md`** exists so an agent can decide what to read instead of reading everything. One
line per file plus the occasion — "use when the prospect is a manufacturer", "use when they ask about
price". Without it an agent either reads your whole library for every person or reads none of it,
and the second is worse.

**`Dossiers/`** is one document per person and the record of that relationship: who they are, why they
fit with the score, every touch with its date, what you sent and what they said word for word, the
research brief, and a `My notes` section no agent ever overwrites. The sheet is for state; the dossier
is for the story.

**`Brain/industry-<field>.md`** is what makes the second prospect in a field cheaper than the first:
what owners in that field care about, angles that got replies, lines worth reusing. One file per field.
De-identified — other prospects are never named in it. The research carries over; the attribution does
not.

**How the agents reach these folders.** The sheet is the only thing they reach by themselves, through
the URL and token. Dossiers and Brain files are documents in your Drive: if your agent has Drive
access it writes them, and if it does not it hands you the exact text and the exact filename, you save
it, and you paste the link into `Dossier URL`. Either way it tells you which of the two it is doing,
and it never claims to have saved a file it could not.

---

## 11. Optional: give it a brand guide

Nothing in this section is required. Skip it and the system works; the copy will simply be generic,
because the agents will write in a neutral professional voice rather than yours.

It is worth doing if you intend to send more than a handful of messages. It is the difference between
copy that could have been written about any company in your field and copy that sounds like you on a
good day.

**Where it goes:** `Inputs/brand.md`, in the `Godsleye` folder in your Drive. This is the single file
every writing run reads first — the copywriter before its first word, the researcher for the never-say
list, the prioritizer to know what a good fit is. One file, and one edit fixes every future message.

Three routes, cheapest first.

### Route 1 — answer twelve questions yourself

Cheapest, and usually the best, because the answers are already in your head. Write fragments, not
paragraphs. Ten minutes.

1. What do you sell, in one sentence?
2. What is the one-line promise — what changes for the person who buys?
3. Who buys, and who do you disqualify? Be specific about the disqualifier: it is what keeps the list
   clean.
4. What is the problem, in their words rather than yours?
5. What is your mechanism or method — the thing you do that others in your field do not?
6. Three proof points, each with a number in it.
7. What will you never claim?
8. Who are your competitors, and how do you differ, in one line each?
9. What is the offer, and what shape is its price — one-off, monthly, per project?
10. The three objections you hear most, and your honest answer to each.
11. Your tone in three adjectives, plus three phrases you would never use.
12. Three messages you have actually sent to a prospect, pasted verbatim.

Save the twelve answers as `Inputs/brand.md`. Fragments are fine. The three messages matter most,
because they are the only part an agent cannot invent.

### Route 2 — ask Jenny

**Jenny** is the agent that comes with Genspark. She is built for exactly this. Ask her:

> "Interview me and write a one-page brand guide: what I sell, the one-line promise, who buys and who
> does not, the problem in my buyer's words, three proof points with numbers, what I will never claim,
> my three biggest competitors, my offer and its price shape, the three objections I hear most, my tone
> in three adjectives and three phrases I would never use, and three messages I have actually sent."

Then paste her answer into `Inputs/brand.md` yourself. Read it before you save it — she will smooth
over the parts where you were vague, and the vague parts are the ones that matter.

### Route 3 — let a coordinator agent do it

If you already run a Chief of Staff or another coordinating agent, hand it this section and let it work
with Jenny and write `Inputs/brand.md` for you. You answer the questions; it does the assembling. This
is the route for someone who will never sit down with twelve questions, and it is better than no file
at all.

**One honest line, because it is true.** None of this is needed to start. Without `Inputs/brand.md` the
copy is generic — the agents write in a neutral voice, they cannot tell your proof from anyone else's,
and every message reads like it was written by someone who has never met you. That is a fine place to
begin and a poor place to stay.

---

## 12. Optional: borrow a voice you admire

The second optional file, and the more dangerous of the two, so it comes with rules at the end.

Pick one or two marketers whose writing you admire. Alex Hormozi, Oren Klaff and Russell Brunson are
the three people usually named, and they are good examples of three different things: short blunt
sentences, a story that builds tension, and an offer stated as a fact. Anyone whose sentences you would
be glad to have written will do.

For each one, write down what specifically you want from them, in your own words:

- **Sentence rhythm** — short and blunt, long and building, questions, fragments, one-line paragraphs.
- **How they open** — a number, a confession, an accusation, a story, a question they already know the
  answer to.
- **How they handle objections** — naming it before you do, reframing it, walking past it.
- **The phrases they lean on** — and the ones you would not use even coming from them.

Save it as `Inputs/influences.md`. LinkedIn Outreach Copywriter reads it immediately after
`brand.md`, on every writing run, and treats it as a register rather than a voice.

**Three rules, in bold, because people get this wrong:**

- **Borrow principles and phrasing habits, never passages.** No sentence, no paragraph, no close
  paraphrase of one. If you could put your line next to theirs and see the join, it is theirs and it
  does not go out under your name.
- **Never claim to be that person, and never imply their endorsement.** No "as Alex Hormozi says" in a
  message to a prospect. No borrowed authority, no hint that they taught you, no name-dropping into a
  first message.
- **Your own voice rules in `brand.md` win whenever the two disagree.** If your brand guide says never
  open with a number and your favourite marketer always opens with a number, you do not open with a
  number. Say which file wins if they ever conflict — `brand.md` does, every time, without discussion.

That is the whole file. A page is plenty; two names is plenty.

---

## 13. What stays human, and why

Section 4 lists these in one line each, in the middle of the map. This is the same list with the
reasoning; one of them is two separate steps in the map.

- **The invitation.** Sent from your account, by hand. This is the step that can get an account
  restricted, and the step where a person should decide.
- **The send.** Every message you send, you read first and paste yourself.
- **`Accepted?`, and the variant you chose.** Facts about the world, not about the sheet.
- **Who is worth your time.** LinkedIn Strategy Prioritizer scores and recommends. You decide, and you
  can overrule it by ignoring it.
- **Every claim you make.** The agents are built so that nothing reaches a message that is not in the
  dossier — but you are the one whose name is on it.

The system removes the blank page and the bookkeeping. It does not pretend to own the relationship,
and that is the reason it is safe to run on your own account.

---

## 14. When something goes wrong

| What you see | What it usually means | What to do |
|---|---|---|
| A row stays at `queued` for an hour after you ticked `Accepted?` | LinkedIn Outreach Tracker has not swept | Press Sync, or say "process accepted" to LinkedIn Outreach Tracker |
| A row stays at `dispatched` for hours | LinkedIn Intel Researcher never picked it up, or its result never came back | Say "what happened to <name>" to LinkedIn Outreach Tracker; it re-queues after two hours by rule |
| A row is `failed` with a reason in `Notes` | One person could not be researched; the reason is in the cell | Read the reason. Retry once by asking LinkedIn Outreach Tracker to re-queue it. If it fails again, decide by hand |
| The dossier link will not open | The file was never saved, or it is in another account | Ask LinkedIn Intel Researcher which of the two it did; it must answer plainly |
| A card in Today has no messages | LinkedIn Outreach Copywriter's write did not land | Ask LinkedIn Outreach Copywriter to write the ladder for that contact, by name |
| `Stage` says `day4` but `Sent At` is empty | A tap did not record | Tell LinkedIn Outreach Tracker; it repairs the stage back to `to_send` rather than inventing a send |
| `Next Due` is in the past on several rows | LinkedIn Outreach Tracker has not reconciled since the dates moved | Ask it to reconcile; it does not need an explanation |
| Every sheet call fails at once | The script was re-pasted without publishing a new version, or the token changed | Re-deploy, get a fresh token, give both to each agent again |
| An agent says it does not know who to hand to | The next agent in the chain does not exist, or is named differently | The README of the agent that is stuck names the exact agent to create. Create it with that name |
| An agent wants a folder that is not there | `Inputs/` or `Brain/` has not been made | Make it. The agent is required to stop rather than invent its contents |

Rule of thumb for all of them: **nothing is ever silently retried.** A stuck row stays visibly stuck
until you or a named agent deals with it. That is deliberate — a system that hides its failures looks
like a system that has no work.

---

## 15. The sheet's fields, in plain words

Twenty-two columns, in this order. The last column says who writes it; "sheet" means the script behind
the sheet, acting on your tap or the calendar, and no agent may write it.

| Field | What it means | Written by |
|---|---|---|
| `Contact ID` | A short unique id for this person. Every agent refers to a person by this, never by row number | LinkedIn Prospect Scout |
| `Full Name` | Their name as it appears on their profile | LinkedIn Prospect Scout |
| `Title` | Their current job title, in their own words | LinkedIn Prospect Scout |
| `Company` | The company they work for, as its own site writes it | LinkedIn Prospect Scout |
| `LinkedIn URL` | The personal profile URL, `linkedin.com/in/...`. No URL, no row | LinkedIn Prospect Scout |
| `Segment` | What kind of prospect this is, in your own vocabulary (for example a direct buyer or a referral partner) | LinkedIn Prospect Scout |
| `Campaign` | Which push this row belongs to, so you can tell campaigns apart later | LinkedIn Prospect Scout |
| `Date Added` | The day the row arrived in the sheet | LinkedIn Prospect Scout |
| `Invited` | Whether you have sent the connection request yet | You |
| `Invited At` | When you sent it | Sheet, on your tick |
| `Accepted?` | `Yes` when they accepted. This is the switch that starts the machine | You |
| `Accepted At` | When you ticked it | Sheet |
| `Research Status` | Where research has got to: `queued`, `dispatched`, `researching`, `ready`, `failed` | LinkedIn Outreach Tracker |
| `Research Started At` | When research was dispatched | Sheet |
| `Dossier URL` | Link to the one document about this person | LinkedIn Intel Researcher |
| `Hook Theme` | Two or three words naming the angle the messages open on | LinkedIn Intel Researcher |
| `Notes` | LinkedIn Outreach Tracker's reasons, your corrections, and any failure explanation. Free text | LinkedIn Outreach Tracker, you |
| `Variant` | Which opening you actually sent: A, B or C | Sheet, on your tap |
| `Sent At` | When you sent the first message. Every date in the ladder counts from here | Sheet, on your tap |
| `Stage` | Where the sequence is: `to_send`, `day4`, `day10`, `day18`, `day30`, `day45`, `done`, `replied` | Sheet, on your tap; LinkedIn Outreach Tracker repairs |
| `Next Due` | The date the next touch is due. Blank means nothing is due | Sheet; LinkedIn Outreach Tracker repairs |
| `Follow-up At` | The date of the last touch in the ladder, so you can see the end of the sequence from the row | Sheet |

Two tabs sit behind it. `Messages` holds the actual copy, one row per message with the contact and the
rung it belongs to. `Events` is an append-only log of every write, which is what makes a disputed row
answerable: you can always see what happened, in what order, and when.

---

## 16. What has been tested, and what has not

Say this honestly if anyone asks, because the answer is good.

**Tested:** the script's own logic, against a simulator that behaves like a real sheet — appends,
updates, the send flow, the ladder arithmetic rung by rung, undo, and conflicting taps. The
dashboard's request shapes, against the same script. What three variants and a five-rung ladder look
like on a card.

**Not tested:** a real browser, on a real deployment, against a real sheet, on your Google account.
That is machine-specific by nature — it is one deployment on one account — and it is the last step of
your setup for exactly that reason. If a sheet write does not happen on your first pass, the fault is
almost always in steps 2 to 4 of section 5, and the fix is there rather than in the agents.

Nothing in this pack has sent a message, and nothing in it can.

---

## 17. What this lets you do

This is the section to read if you are deciding whether any of this is worth your time.

Describe the kind of person you want to reach — a title, a company size, a place, a reason. The system builds a list of prospects and keeps it in one spreadsheet you own: readable from anywhere, driven from a computer.

For every person who accepts your connection request, it writes a short brief: who they are, what their company actually does, what they have said publicly lately, and the one angle worth opening with. Then the messages — three openings you could send, the Day 4 that pairs with each, and the later touches out to Day 45.

You work from one screen: copy a message, open the profile, paste it, send it, come back and mark it done. That is the whole job. Today only shows people who are genuinely ready — research waiting, or a follow-up now due.

### What runs on its own

- **The research**, every time someone accepts.
- **The writing** — three versions to choose between, not one you have to invent, and every follow-up after them.
- **The queue** — who is due today, who is overdue, which rung each person is on.
- **The arithmetic** — every date counted from the day you actually sent, not from the day the last one was meant to go.
- **The record** — every message logged with which version you sent and when, so a month later you can still see what worked.

You do not type a status into a spreadsheet: you tick invited, accepted and sent, and the sheet derives the rest. You do not wonder which of the four people you messaged last week still needs a nudge.

### Where you stay in the loop — deliberately

- **Sending connection requests, and accepting them.** By hand, on LinkedIn. This is not a gap we are working around: it keeps your account safe and keeps this a conversation rather than a broadcast.
- **Sending every message.** You read the copy first, and nothing leaves unless you paste it and press send.
- **Choosing the words.** The drafts are drafts. Most people change a line, and the system records what you actually sent.
- **Deciding who is worth your time at all.** It tells you a follow-up is due; you decide whether this person is worth the follow-up.
- **Anything you claim.** It can only repeat what is already public — the judgment about what you are willing to say stays yours.

### What it will not do

- It cannot see anything private on LinkedIn — only what is public, plus the person's company site, interviews and press.
- It will not message anyone for you, and nothing in it can send.
- It will not read or answer replies. When someone answers, you mark it `replied`, the sequence stops, and the conversation from there is yours.

### Why it is worth having

The blank page and the bookkeeping are what eat the day. This gives both back, so your time goes to the part that genuinely needs you: deciding who to talk to, and what to say to them. If you can describe your buyer in a sentence, "I should do more outreach" turns into twenty minutes of actually doing it.

### What you need

A Google account, a target you can describe in one sentence, a LinkedIn account you actually use, and
an agent product to create the agents in. About half an hour for the first run, end to end, of which
the sheet itself is ten minutes. Section 16 is honest about how much of this has been run against a
live sheet: read it before you plan an afternoon around it.

---

## 18. Build on it

Everything here — the dashboard, the sheet script, this document, the five READMEs — is meant to ship as a repository, so someone technical can pull it apart and make it theirs. Repository: `[REPO LINK]`. The link is filled in when the repository goes public; until then this section says what it will contain.

**What is in it**

- The dashboard app — the screen you work from, including Today and the row cards.
- The sheet script — the same file you paste in section 5, step 2.
- This document and the five READMEs, so the reasoning travels with the code.
- The demo script, so the build can be shown without reading all of the above first.

**What a developer can change**

- **The ladder dates.** Day 4, 10, 18, 30 and 45 are one list of offsets in one place. Change the numbers, keep the sequence.
- **The dossier sections.** Add or drop a section and the researcher writes to the new shape.
- **The scoring bands.** Where pursue stops and nurture starts is two numbers and a sentence.
- **The variant limits.** Three openings is a setting, not a law. Fewer, or more.
- **The dashboard screens.** The app is separate from the sheet, so a new view does not touch your data.

**What they must bring**

- Their own Google account and their own copy of the sheet. The repo ships with no sheet, no token and no data in it.
- Their own model subscription, or a hosted agent, for the five agents to run on.
- Somewhere to run the dashboard: it talks to the sheet through its own server, so it is not a page you can drop on free static hosting. A laptop and a tunnel is enough to start.

**Licence:** `[DECIDE: licence — chosen by whoever publishes this]`.

**One rule worth keeping if you fork it.** The sheet stays the single source of state, and only one writer touches each column. Everything that makes this thing trustworthy — the ladder arithmetic, the repair path, the reason a stuck row stays visibly stuck — comes from that rule, not from the code around it.

---

## 19. The files in this pack

| File | What it is |
|---|---|
| `godsleye-start-here.md` | This document. Read once |
| `agent-briefs/linkedin-prospect-scout.md` | LinkedIn Prospect Scout's README |
| `agent-briefs/linkedin-outreach-tracker.md` | LinkedIn Outreach Tracker's README |
| `agent-briefs/linkedin-intel-researcher.md` | LinkedIn Intel Researcher's README |
| `agent-briefs/linkedin-strategy-prioritizer.md` | LinkedIn Strategy Prioritizer's README |
| `agent-briefs/linkedin-outreach-copywriter.md` | LinkedIn Outreach Copywriter's README |
| `godsleye-operator-flow.md` | The same setup as a checklist, for the second time through |
| `godsleye-demo-script.md` | The six clicks, for showing this to someone |
| `godsleye-Code.gs` | The sheet script, pasted in step 2 |
| Template sheet | Header row in place, no data. Link in section 5 |

Each README is self-contained: an agent gets one file and needs nothing else from this pack. They are
written in the same order every time — who you are, what your name must be, the chain, what you read,
what you write, what you must ask, your first run, and how to fail — so that you can find the same
thing in the same place in all five.

One thing to check against your downloads. The script is one file, and it carried an earlier name
before this pack settled on `godsleye-`. If you downloaded it under that earlier name, it is the same
file — renamed only, contents unchanged. Nothing else in this pack was renamed at the same time.

---

Built by **Daniel Marama**
[maramamarketing.com](https://www.maramamarketing.com) · [portfolio.maramamarketing.com](https://portfolio.maramamarketing.com) · [daniel@maramamarketing.com](mailto:daniel@maramamarketing.com)

