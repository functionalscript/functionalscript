## One line per test serves a terminal, not a line-oriented consumer

**Priority:** P2
**Status:** blocked
**Blocked by:** [Command output: one design for every destination](../../todo/command-output.md)

> **Why blocked.** Nothing demands this second format now, and answering this one
> alone would give the proof runner a mode system no other command shares —
> invented from whichever audience happened to be asked about first. The
> destinations, verbosities and scheduling shapes are enumerated and designed
> together in the epic above. This issue is the **line-framing** concern there,
> not a transport cell — the audience is a property of the reader, and what
> names it is an open question in the epic. What is *below* stays as the input
> it is: the two reasons a consumer needs the announcement, and the constraints
> any answer must satisfy.

### Problem

`fjs t` opens a leaf's line before the leaf runs — `name: ` with no newline —
and closes it when the leaf lands: `ok, 1.2345 ms`. That is the right shape for
someone watching a terminal, and it is what the start event landed — see
`defaultReporter`'s `start` in [`../module.f.mjs`](../module.f.mjs).

It is not a record until the newline arrives, and two of the reasons the
announcement exists are reasons a *consumer* needs it, not a reader:

- **A slow test is invisible again to anything that reads lines.** A pipe, a CI
  log collector, a controller watching the stream: none of them see `name: `
  until the leaf finishes and the line is closed, which is exactly when the
  result would have told them anyway.
- **A killed run can lose the name.** The unterminated final line is the one
  fact worth having when a proof takes the process down, and a consumer that
  discards an incomplete final line drops it.

Neither costs a terminal reader anything — a terminal shows an unterminated
line the moment it is written — so this is not an argument for going back to
two complete records per leaf. It is the observation that **the two audiences
want different output**, and that `fjs t` currently picks one.

### The design question

A terminal reader and a line-oriented reader do not want the same thing, and
the difference is bigger than a newline:

- **On a TTY** the runner may move the cursor. Rewriting a line in place,
  overwriting a running test's name with its result, a counter that stays on
  one row, a spinner, colour: the terminal is a canvas, and the announcement is
  transient rather than part of the log.
- **For a line-oriented reader** every event has to be a complete,
  self-contained record, written once and never revised, because a closed line
  is all such a reader can observe — unlike a bytewise reader of the same pipe,
  which sees the open write. What is transient on a TTY has to be *emitted* here — or framed
  some other way the consumer can act on immediately.

So the answer is not a flag on the current format. It is that the reporter has
two modes with different event shapes, and the run's records — which a reader
of [reporter modes](211-reporter-modes.md) will recognise as one more mode
question — have to be defined for each rather than derived from the other.

`options.std` already carries `isTTY` per stream, which distinguishes a
terminal from a redirected stream at no cost — but **not** the line-oriented
reader of that stream from a bytewise one, which is the audience this issue is
about; what selects *that* is the epic's open question. What is missing here is
the second format and the decision about what each mode owes a consumer. Note that a CI log collector is
a non-TTY destination that also wants the GitHub annotation format, so the two
axes — TTY-ness and CI-ness — are not the same axis and should not be collapsed
into one flag.

### Constraints

- **Not two records on a TTY.** Doubling every line to keep a rare splice tidy
  is a trade that was made once and reverted deliberately — the reason is on
  `defaultReporter`'s `start` — and another reader's requirement is not a
  reason to reinstate it where it was rejected.
- **One stream.** Whatever each mode emits still goes to `stdout`, for the
  ordering reason in [reporter modes](211-reporter-modes.md). `stderr` stays
  for a runner crash.
- **The browser is a third destination**, not a variant of these two: it
  renders a pending row on the same start event and settles it in place. A mode
  system that only distinguishes TTY from pipe should not make a third
  destination harder to add.
- **A format that can only be observed by looking at a real terminal has no
  proof.** For the **stream** modes this issue is about, the prover is
  `effects/node/virtual`, which is neither a TTY nor a pipe but answers
  `isTTY` either way. Scoped to those deliberately: the browser destination
  above is proven by its own DOM stand-in, which plain Node runs and the
  **virtual** runner cannot observe at all.

### Tasks

- [ ] Decide what a run emits per leaf **for a line-oriented reader**, and
      whether the announcement is a record of its own there. Not "a non-TTY
      run": that is the transport, and it includes readers this format is not
      for.
- [ ] Decide what a TTY run may do with the cursor, and whether the current
      open-line format is already that answer or a step towards it.
- [ ] Settle the selector with the epic rather than here. `isTTY` separates a
      terminal from a redirected stream and **cannot** identify a line-oriented
      consumer of that stream, which is the audience above; CI-ness stays a
      separate axis either way.
- [ ] Prove both modes through the virtual runner.

### Related

- `defaultReporter`'s `start` in [`../module.f.mjs`](../module.f.mjs) — where
  the open-line format is, and the trade it made
- [reporter modes](211-reporter-modes.md) — the mode system this belongs in,
  including the dynamic-progress reporter a TTY mode overlaps with
- [test framework silent mode](test-framework-silent-mode.md) — brief progress
  output, the other consumer of a TTY-aware format
