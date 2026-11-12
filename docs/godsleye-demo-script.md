# God's L'Eye — six clicks on stage

For you, on demo day. Every click you make, the sentence you say while you make it, and what to do
if it does not do what it should. Read the fallback line at the bottom once before you start.

**One thing to know before you click.** As of this writing, no click has touched a live sheet yet.
The sheet loop is built and tested against a simulator, not against a deployed sheet. So the
honest position on stage is: the sequence below is the sequence; if a step does not answer, say the
fallback sentence and keep moving. Do not debug on stage.

The six clicks, for glancing at: **open the sheet → tick Accepted? → Sync → open the dossier → copy a
variant → mark sent and show the sheet recording it.**

---

## Before you start (not on stage)

- The app is running and the Today page is open in a tab. The sheet is open in a second tab, on the
  `Pipeline` tab, with one or two prospects you recognise at the top.
- Pick your person the night before: someone with an Accepted? = Yes row, research already finished,
  and three variants on the card. Write their name on a sticky note. Do not pick on stage.
- Have a second row ready, untouched, in case the first one misbehaves.
- Know your ladder numbers by heart, because you will say them: **4, 10, 18, 30, 45, done.**

---

## 1. Open the sheet

**Click:** the sheet tab.

**Say:** "This is the whole system. One Google Sheet. Every prospect lives on one row, and the
state of that row is the state of the work: who they are, whether they accepted, where research is
up to, what was sent and when the next message is due."

**If it is slow or will not load:** keep talking for ten seconds. If it is still blank, switch
tabs and say: "I'll show you the dashboard instead" and go to step 4.

---

## 2. Tick Accepted? to Yes

**Click:** the Accepted? cell on your chosen row, and choose Yes.

**Say:** "A prospect accepted my connection request. I am the only one who can know that, so that
is the one thing I type. Watch this cell."

**What should happen:** the Accepted At cell fills with a timestamp, and Research Status fills with
`queued`. That is the sheet noticing for itself, not me.

**If nothing fills:** do not touch it again. Say: "It stamps on its own; the write goes through the
script behind the sheet, and I'll come back to that." Move to step 3 — the Sync press does not
depend on the stamp.

---

## 3. Press Sync

**Click:** Sync on the dashboard.

**Say:** "That press wakes the pipeline agent. It reads the sheet, finds
the row I just queued, and hands it to research. Everything after this is the machine's work; the sheet
is where I can see it happened."

**What should happen:** the row's Research Status moves `queued` to `dispatched`, then to `ready`, and
the dossier appears on the row. On a live run this takes the length of a research turn, so in the demo
the research for this person is already done — the press shows the row landing on the dashboard, and
the dossier is already there.

**If Sync errors or the row does not appear:** say the fallback line (below) and go straight to
step 4 using the person you prepared in advance.

---

## 4. Open the dossier

**Click:** the dossier link on the row (or the card on the dashboard).

**Say:** "This is what research produces before I write a word. Who they are, what the company
actually does, what they have posted about recently, the one thing worth opening with, the score with
the evidence under it, and the cautions: what not to say to this person. The last section is the one I
care about most. It tells me what the research could not verify — and the scoring agent up there reads
it before it decides whether this person gets my morning."

**Point at:** the hook, then the cautions section. Two seconds each, no scrolling.

**If it will not open:** say "It's a document per person, linked from the row" and move on. Do not
read it aloud from a blank screen.

---

## 5. Copy a variant

**Click:** Copy on one of the three messages.

**Say:** "Three openings, written from that dossier, not from a template. I pick the one that sounds
like me. Copy puts it on my clipboard with nothing else attached, so I paste it straight into
LinkedIn."

**What should happen:** the message box turns yellow and tells you to come back after you have
posted it. That yellow is the system reminding me it does not send anything on its own.

**If Copy does nothing:** select the text by hand and copy it. The demo does not depend on the
button, only on the words being there.

---

## 6. Mark sent, and show the sheet recording it

**Click:** I posted it, on that card. Then switch to the sheet.

**Say:** "One tap. I have told it what I did. Now watch the sheet, because this is the part that
makes the whole thing trustworthy."

**Point at, on the same row:** Variant (which message went), Sent At (when), Stage (`day4`), and
Next Due (four days out).

**Say:** "I never touch those four columns. The system wrote them, from one tap, and it wrote them
into the sheet, not into some database you cannot see. On day four this person comes back to the top of
my list on their own. Day ten, a second nudge. Day eighteen, I ask for a call. Day thirty, I come back
with something new. Day forty-five, the last touch — and then they are done, six weeks after I first
said hello, without me holding a single date in my head."

**If the row does not update:** this is the one that matters, so do not paper over it. Say the
fallback line.

---

## The fallback line

Use this, word for word, if any sheet write does not happen:

> "The sheet is the part I have not switched on live yet. The sequence you just watched is real,
> and every one of those writes is tested, but the thing that connects this dashboard to that sheet
> is a deployment on my own Google account and I have not pressed it. So what I am showing you is
> the design working, not the wire being live. That is a ten minute job, and it is mine, not yours."

Then keep going. Do not apologise twice and do not offer to fix it on stage.

---

## The three questions you will get, and the short answers

**"Does it send the messages?"** No. It writes them and it never sends. You paste into LinkedIn
yourself. That is a deliberate limit, not a gap: nothing here can get an account restricted, and
nothing leaves without you seeing the words first.

**"What does it cost to run?"** One research pass, one prioritisation and one writing pass per accepted
prospect, and nothing per click. The sheet reads and writes are free.

**"Can somebody else use it?"** Yes, and that is the second half of tomorrow: a template sheet they
copy, a half-hour setup, five questions about their business, and five agents that then know what
they sell, who they are talking to, and who hands to whom. One README per agent — they paste it in and
the agent asks them the questions. And one agent at the front, the Guide, that reads the whole manual
and walks them through it a step at a time. The pack is in the room.

---

Built by **Daniel Marama**
[maramamarketing.com](https://www.maramamarketing.com) · [portfolio.maramamarketing.com](https://portfolio.maramamarketing.com) · [daniel@maramamarketing.com](mailto:daniel@maramamarketing.com)
