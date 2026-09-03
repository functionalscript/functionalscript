## Command output: one design for every destination

**Priority:** P2
**Status:** open

> A design document, not a task list for one command. Four
> `fjs/emergent_testing/todo/` issues each proposed a *mode* for the proof
> runner's output, and the modes are not the runner's — every `fjs` command
> writes to the same destinations, and a structure invented per command is one
> more structure a reader has to learn.

### Problem

`fjs t` picked one output shape for one audience: a terminal reader watching a
suite go by. The other audiences were each noticed separately, and each got its
own issue proposing its own mode:

- a **line-oriented consumer** — a log collector, a `readline` reader — which
  sees an open line only once it is closed, unlike a bytewise reader of the
  same pipe
  ([tty-and-line-consumers](../emergent_testing/todo/tty-and-line-consumers.md));
- a reader who wants **brief progress and the failures**
  ([test-framework-silent-mode](../emergent_testing/todo/test-framework-silent-mode.md));
- a **GitHub CI log**, which wants colour on a stream that is not a TTY
  ([github-color-modes](../emergent_testing/todo/github-color-modes.md));
- and the **mode system** those would each need
  ([211-reporter-modes](../emergent_testing/todo/211-reporter-modes.md)).

Answered one at a time, they give the proof runner a mode system no other
command shares, shaped by whichever audience was asked about first.

### The space to enumerate

Each row is an axis, and **the axes compose** — a destination is a point in the
product, not a value on one list:

| axis | values |
| --- | --- |
| transport | TTY · pipe or file · browser page · another framework's API (a *bridge*: `ctx.test` calls rather than text) |
| annotation | plain · GitHub workflow commands (`::error …`) |
| colour | on · off |
| verbosity | a record per event · a record per outcome · compact progress · failures only · silent |
| progress | static (append-only) · dynamic (a line rewritten in place) |
| scheduling | sequential · parallel |
| surface | one · several at once (windows, elements, files) |

**A GitHub CI log is the cell that proves the axes have to compose**: transport
*pipe*, annotation *GitHub*, colour *on*. It cannot be expressed today, because
`csiWrite` strips colour on any non-TTY stream — which is exactly what
[github-color-modes](../emergent_testing/todo/github-color-modes.md) asks for.
So colour is a decision per cell, not a property of the TTY transport.

Two things the design should state rather than leave to be rediscovered:

- **An exit code is not output.** One value per run, written to no stream,
  rendered by no destination.
- **Capture is not a transport.** Proving the TTY renderer means a run with
  `isTTY` true whose writes land in `State.stdout` — TTY *and* captured at
  once, which exclusive values on one row cannot express. Capture is how a run
  is observed, orthogonal to where it goes.

**Not every cell is meaningful.** A page can render into several elements and a
stream cannot, so *transport = TTY × surface = several at once* means nothing.
An enumeration whose product contains cells nobody can implement is not an
enumeration, so the design owes its exclusions.

**Scheduling has no producer yet.** The proof traversal is sequential by
decision ([why](../emergent_testing/README.md#the-two-runners-and-what-sharing-them-cost)),
and while `registerModule` does fan out, its records are not this design's — it
builds `Test` effects with no reporter and no `Write`, and `effects/node` hands
each to `ctx.test`, so the interleaving belongs to Node's or Bun's renderer.
The row survives only because a *bridge* emits calls into a framework that may
run them concurrently, and identity is what lets it attribute one. If that does
not survive the enumeration, neither should the row.

### What a good answer looks like

- **One structure, named once.** What a command emits is a value with a shape,
  and each destination is a renderer of it. `emergent_testing`'s `Reporter` is
  one instance of that shape, not the shape.
- **Compact.** A mode per audience per command is a matrix nobody maintains.
  The axes want a small product, not an enumeration of combinations.
- **Selectable from what a program already holds**, in three groups by who
  chooses:
  - *environment-derived* — annotation, colour, and which of the **stream**
    transports a stream run got — from `options.std[stream].isTTY` and
    `options.env`;
  - *caller-selected* — the **browser page** and the **bridge** — fixed at the
    entry point called (`startBrowserTests`, `register`). Neither consults the
    environment *to pick a renderer*: `register` does read `o.env`, but to
    discover modules, and nothing in either path reads `isTTY`;
  - *user-chosen* — verbosity — from `options.args`, declared through the CLI
    eDSL rather than hand-parsed ([options-edsl](../cli/todo/options-edsl.md)).

  `progress`, `scheduling` and `surface` have no group, and whether verbosity
  is `args`-only is unsettled — both below. An omission, not a decision:
  detecting a TTY says nothing about static versus dynamic progress, so an
  implementation reading only these groups would invent a per-command default.
- **Provable without the destination.** Stream transports are proven through
  `effects/node/virtual`, which answers `isTTY` either way; a host renderer is
  proven by its host's own stand-in, the browser page by the DOM stand-in in
  `emergent_testing/browser/proof.mjs` — which plain Node runs, and which the
  **virtual** runner cannot observe at all and must not be asked to. What every
  cell shares is the *value* rendered, and that is provable without any
  destination.
- **It applies to more than one command — established by task 1, not assumed
  here.** Sharing a terminal is not sharing a structure: `fjs cas add` emits a
  hash and `fjs mcp` emits JSON-RPC. **The falsifier is admitted in advance**:
  if the enumeration finds no second consumer, this is the proof runner's mode
  system after all and **this** blocker comes off the four issues — off this
  one, which is not the same as actionable, since each issue's own
  `**Blocked by:**` says what remains. One lead for task 1, not a finding:
  `fjs/cas/todo/` wants output "scriptable in CI and cron" over a CLI/MCP/Web
  matrix; a rendering makes it the second consumer, an exit code plus a payload
  schema fires the falsifier.

### Constraints inherited from what has landed

- **One stream per run — for a run's *records*.** Every record goes to
  `stdout`; `stderr` is for a runner crash, when there is no longer a run to
  correlate with (functionalscript#1790). Deliberately not a rule about every
  command's streams: `errorExit` puts ordinary failures on `stderr`, and `cas`
  and `mcp` put machine-readable output on `stdout` that a diagnostic must not
  contaminate.
- **Not two records per leaf on a TTY.** Tried and reverted — it doubles every
  line to guard a case that announces itself; the reason is on
  `defaultReporter`'s `start` in
  [`module.f.mjs`](../emergent_testing/module.f.mjs). A non-TTY format may
  still choose it.
- **The browser is a destination, not a variant.** It renders a pending row on
  the start event and settles it in place, and a design that only distinguishes
  TTY from pipe must not make it harder to add
  ([why](../emergent_testing/README.md#the-two-runners-and-what-sharing-them-cost)).

### Left open on purpose

None of these follows from what has landed, and each is cheaper to settle
against the enumeration than to argue in advance. Recorded so they read as
postponed rather than missed.

- **Is a bridge a `transport` value or its own axis?** It is the one value that
  emits calls rather than characters, and the only reason `scheduling`
  survives. If it interacts with the other axes unlike the stream values — a
  bridge with a *verbosity*, with *colour*? — the table is wrong.
- **What rule excludes a cell?** Only one exclusion is named. Whether
  `progress = dynamic` means anything on a bridge, or `annotation = GitHub` on
  a page, is unanswered — and naming exclusions one at a time as they are
  noticed is how the product acquires cells nobody can implement.
- **How is capture modelled, if not as a transport?** An observation dimension
  crossing every cell, or nothing in this table because it belongs to the proof
  harness. Every stream cell is captured when proved and unwrapped when run, so
  it applies uniformly either way — an argument for leaving it out of the
  product entirely.
- **What names the audience that needs line framing?** It is not the
  transport: a redirected `stdout` read bytewise sees the open `name: ` write
  immediately, and only a line-oriented consumer of that same pipe does not.
  The table selects the stream transports by `isTTY`, which cannot tell the two
  apart, so either framing is its own axis or the two are one cell whose
  renderer must satisfy the stricter reader.
- **What counts as this design's output?** Three producers emit something the
  transport row cannot express: `fjs web` answers HTTP; `fjs compile` writes a
  user-named path; `fjs ci` writes fixed files (`.github/workflows/ci.yml` and
  others). None is a stream, so none has an `isTTY` to be selected by. Calling
  them internal effects is hard to hold while `fjs mcp`'s JSON-RPC counts as
  output, so the design owes a **boundary** — a rule for what is in, not a
  transport value per case — and then either the row grows or those producers
  are excluded with a reason.
- **Is event granularity separate from verbosity?** The row conflates how many
  events a renderer *consumes* with how much it *emits* per event: a dynamic
  current-test display consumes the start event while emitting nothing lasting
  for it. This decides whether a renderer may discard start events at all.
- **Who chooses the unassigned axes?** `progress`, `scheduling` and `surface`
  have no group; `scheduling` may not survive and `surface` is plausibly
  caller-selected like the transport constraining it, but both are guesses.
- **Is verbosity `args`-only?** `211-reporter-modes` selects its quiet reporter
  "via a CLI flag or env". Environment-selected verbosity crosses the
  environment/user split above, so one of the two designs gives way.
- **Does `options-edsl` block this design or only the flag?** Listed under
  *Related* on the second reading, since tasks 1 and 2 reach no flag. If a cell
  turns out to need an option to express it, that flips.
- **What does each stream mean per command?** functionalscript#1790 settled a
  run's records and no further. Whether a diagnostic from `cas` or `mcp` has
  anywhere to go is a question about those commands; task 1 surfaces it.

### Tasks

- [ ] Enumerate every output **producer**, not only what a CLI command prints —
      the browser page publishes `_BrowserEvent` and `BrowserTestReport`
      outside the command list, and a bridge emits calls. For each, **every
      cell it can occupy and the selector that picks between them** — not one
      configuration. `fjs t` alone already varies two axes independently:
      `defaultReporter` reads `options.env['GITHUB_ACTIONS']` for annotation,
      `csiWrite` reads `isTTY` for colour. And **what each producer emits
      today** — its fields, records, ordering and stream behaviour. Task 2
      covers only what is designed and not yet emitted, so without this the
      shape could be designed complete and still regress `BrowserTestReport`
      or a command's diagnostics. Bounded at a **delegation boundary**: `fjs
      run` imports a caller-named module and calls its `main`, so what that
      program writes is unknowable here and is not this design's. What is, is
      the dispatcher's own output — the two `errorExit` diagnostics it owns.
- [ ] Sweep the `todo/` directory of every producer task 1 found, **and the
      cross-cutting `todo/` above them** — a producer's issue need not sit in
      its directory, and an issue that creates a *new* producer cannot:
      [fjs-nanvm-integration](../../todo/fjs-nanvm-integration.md) adds a `.rs`
      target to `fjs compile` and a harness printing JSON, from the root.
      A sweep rather than a list here, which goes stale by construction. The
      rule:
      *every unresolved issue that **constrains or leaves open** what a
      destination emits is an input to the shape.*
      - *Constrains* covers a field, a status, a tally, an annotation, a record
        that is not a result, an ordering between records, and a requirement to
        emit **nothing** —
        [66j-cas-add-directory](../cas/todo/66j-cas-add-directory.md) forbids a
        manifest hash on partial failure.
      - *Leaves open* covers a question not yet answered:
        [timer-precision](../emergent_testing/todo/timer-precision.md) has not
        decided whether a row renders a duration at all. A shape settled
        without those is invalidated the moment they are.

      **Unresolved**, not `open`: one
      [status](../../todo/README.md#status-values) among several, and every
      issue this document blocks is `blocked`.
- [ ] Design the shape and its renderers against that enumeration.
- [ ] Answer every question under *Left open on purpose*, or record why it
      still has no answer.
- [ ] Say which existing issues the design subsumes, and retire them in the
      change that implements it rather than leaving both.

### Related

The four issues this blocks are linked from *Problem* above, and each carries a
`**Blocked by:**` back to here.

- [options-edsl](../cli/todo/options-edsl.md)
  — how a user-chosen axis is declared. Not a blocker of this design, but a
  blocker of shipping the `--verbose` `test-framework-silent-mode` promises.
