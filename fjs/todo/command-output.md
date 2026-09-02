## Command output: one design for every destination

**Priority:** P2
**Status:** open

> A design document, not a task list for one command. It exists because four
> `fjs/emergent_testing/todo/` issues each proposed a *mode* for the proof
> runner's output, and the modes are not the runner's — every `fjs` command
> writes to the same destinations, and a structure invented per command is one
> more structure a reader has to learn.

### Problem

`fjs t` picked one output shape, for one audience: a terminal reader watching a
suite go by. That was the right first answer and it is now the only one. Each
of the other audiences has been noticed separately, and each got its own issue
proposing its own mode:

- a **pipe or log collector**, which sees nothing until a line is closed
  ([tty-and-line-consumers](../emergent_testing/todo/tty-and-line-consumers.md));
- a reader who wants **brief progress and the failures**, not a line per test
  ([test-framework-silent-mode](../emergent_testing/todo/test-framework-silent-mode.md));
- a **GitHub CI log**, which wants colour on a stream that is not a TTY
  ([github-color-modes](../emergent_testing/todo/github-color-modes.md));
- and the **mode system** those would each need
  ([211-reporter-modes](../emergent_testing/todo/211-reporter-modes.md)).

Answering them one at a time gives the proof runner a mode system that no other
command shares, invented from whichever audience was asked about first. The
enumeration below is the whole space; the design is what covers it.

### The space to enumerate

Each is an axis, and **the axes compose** — a destination is a point in the
product, not a value on one list. TTY-ness and CI-ness are already known to be
independent, and collapsing them is the first mistake this document exists to
prevent, so they are two rows here rather than two values in one:

| axis | values |
| --- | --- |
| transport | TTY · pipe or file · browser page · another framework's API (a *bridge*: `node:test`/Bun `ctx.test` calls rather than text) · in-memory (a proof reading a run back) |
| annotation | plain · GitHub workflow commands (`::error …`) |
| colour | on · off |
| verbosity | a record per event · a record per outcome · compact progress · failures only · silent |
| progress | static (append-only) · dynamic (cursor movement, a line rewritten in place) |
| scheduling | sequential · parallel — interleaved records make identity part of the format rather than an afterthought |
| surface | one · several at once (windows, elements, files) |

**A GitHub CI log is the cell that proves the axes have to compose**: transport
*pipe*, annotation *GitHub*, colour *on*. Today it cannot be expressed —
`csiWrite` strips colour on any non-TTY stream, which is why
[github-color-modes](../emergent_testing/todo/github-color-modes.md)
exists and asks for exactly this cell. Colour is therefore a **decision per
cell, not a property of the TTY transport**; writing it off as the latter is
how that requirement would have been silently dropped.

One thing that looks like an axis and is not, and the design should say so
rather than leave it to be rediscovered: **an exit code is not output**. It is
one value per run, it is not written to a stream, and no destination renders
it.

**Not every cell is meaningful, and the design has to say which are excluded
and why.** `transport` and `surface` are independent in principle — a page can
render into several elements, a stream cannot — so a combination like
*transport = TTY × surface = several at once* has no meaning and must be ruled
out in the design rather than left for a renderer to discover. An enumeration
whose product contains cells nobody can implement is not an enumeration.

**A bridge is a renderer whose output is calls rather than characters**, and it
is in the transport row for that reason:
[211-reporter-modes](../emergent_testing/todo/211-reporter-modes.md) specifies
one that turns walker events into another framework's `subTest` calls, and
keeps Playwright reporting in the browser adapter consuming the page's
serializable report. If the shape below cannot be rendered as API calls, the
claim that each destination is a renderer of one structure is false, and that
issue is blocked on a design that does not cover it.

**Scheduling is the axis with no producer yet, and the enumeration below
decides whether it survives.** The proof *traversal* is sequential by decision —
concurrency was the complexity, and speed is not a goal
([why](../emergent_testing/README.md#the-two-runners-and-what-sharing-them-cost)).
`registerModule` does fan out with `allOk`, but its records are **not this
design's**: it builds `Test` effects with no reporter and no `Write`, and
`effects/node`'s handler hands each to `ctx.test`, so the interleaving belongs
to Node's or Bun's renderer. **No renderer in this table produces interleaved
records today.**

It is listed rather than struck for one reason, and if that reason does not
survive the enumeration then neither should the row: a *bridge* emits calls into
a framework that may run them concurrently, and a record's identity is what lets
that framework attribute one. An axis with no producer should be struck rather
than designed around.

### What a good answer looks like

- **One structure, named once.** What a command emits is a value with a shape,
  and each destination is a renderer of it. `emergent_testing`'s `Reporter` is
  one instance of that shape, not the shape.
- **Compact.** The reason to design rather than accumulate: a mode per audience
  per command is a matrix nobody maintains. The axes above want a small product,
  not an enumeration of combinations.
- **Selectable from what a program already holds**, and the axes divide by who
  chooses — in three groups, not two.
  - *Environment-derived* — annotation, colour, and which **stream** transport
    a stream run got — come from `options.std[stream].isTTY` and `options.env`,
    which are there.
  - *Caller-selected* — the **browser page**, the **bridge** and **in-memory** —
    are chosen by calling their entry point, not by detection:
    `startBrowserTests(root, modules)` is the page's, `register` is the
    framework's, and in-memory is whatever a proof calls to read a run back.
    None reads `isTTY` or `env`, nor should be made to. Their cell is fixed at that API
    boundary, and a rule that derives every transport from the environment
    would either leave those cells unselectable or push Node's options across
    a boundary the architecture keeps. Three of the five transport values sit
    here, so *environment-derived* covers the choice **between the stream
    values** and not the transport row as a whole.
  - *User-chosen* — verbosity above all — comes from `options.args`, which is
    also there, and a CLI option is a **first-class selector** for those rather
    than a last resort: `test-framework-silent-mode` promises `--verbose`, and
    no amount of `isTTY` can express whether a person wants it. That flag is
    not a licence to hand-parse one:
    [options-edsl](../cli/todo/options-edsl.md) records what happens when a
    command does — invisible to the help table, an unknown flag silently
    becoming a positional — so a user-chosen axis is declared through the CLI
    eDSL, and a design that ships `--verbose` before that lands has built the
    parser that issue exists to remove.

  What is a last resort is a *new mechanism*, which is a redesign.

  **Three axes have no group yet** — `progress`, `scheduling`, `surface`. That
  is an omission and not a decision: detecting a TTY selects the transport and
  says nothing about static versus dynamic progress, so an implementation
  reading only the three groups above would have to invent a per-command
  default, which is the outcome this document exists to prevent. Each must end
  up classified, derived from an axis that is, or struck — see *Left open on
  purpose*.
- **Provable without the destination.** A format that can only be checked by
  looking at a real terminal has no proof. For the **stream** transports the
  prover is `effects/node/virtual`, which is neither a TTY nor a pipe and
  answers `isTTY` either way. A **host** renderer is proven by its host's own
  proof against a stand-in — the browser page by the DOM stand-in in
  `emergent_testing/browser/proof.mjs`, which the Node virtual runner cannot
  observe at all and must not be asked to. What every cell shares is the
  *value* being rendered, and that is provable without any destination.
- **It applies to more than one command — and the first task is what
  establishes that, not an assumption here.** Sharing a terminal is not sharing
  a structure: `fjs cas add` emits a hash and `fjs mcp` emits JSON-RPC, and
  neither obviously wants a verbosity. So the enumeration looks for a second
  command with the same needs, and **the falsifier is admitted in advance**: if
  it finds none, this is the proof runner's mode system after all, the four
  issues unblock, and this document says so rather than generalising anyway.

  One candidate is already visible, and it is named here as a lead for task 1
  rather than as a finding: `fjs/cas/todo/` wants an output format that is
  "scriptable in CI and cron" and a transport matrix over CLI, MCP and a Web
  API. If that survives inspection it is the second consumer; if it turns out
  to be an *exit code* and a *payload schema* rather than a rendering, it is
  not, and the falsifier fires. Task 1 decides which, on the evidence.

### Constraints inherited from what has landed

These are settled and are inputs, not questions:

- **One stream per run — for a run's *records*.** Every record of a run goes to
  `stdout`, and `stderr` is for a runner crash, after there is no longer a run
  to correlate with (functionalscript#1790). This is scoped deliberately: it is
  not a rule about every command's streams. `errorExit` writes an ordinary
  program failure to `stderr` and exits `1`, and `fjs cas` and `fjs mcp` put
  machine-readable output on `stdout` that a diagnostic must not contaminate. What
  each stream means per command is part of the design rather than settled by this
  line.
- **Not two records per leaf on a TTY.** Tried and reverted: it doubles every
  line of every run to guard a case that announces itself. The reason is on
  `defaultReporter`'s `start` in
  [`../../fjs/emergent_testing/module.f.mjs`](../emergent_testing/module.f.mjs).
  A *non-TTY* format may still choose it; that is the point of having two.
- **The browser is a destination, not a variant.** It renders a pending row on
  the start event and settles it in place, and a design that only distinguishes
  TTY from pipe must not make it harder to add — see
  [the emergent_testing README](../emergent_testing/README.md#the-two-runners-and-what-sharing-them-cost).

### Left open on purpose

Questions this document deliberately does **not** answer — no count, because
the list grows as review finds them. None has an answer that follows from what
has landed, and each is cheaper to settle against the enumeration than to argue
about in advance. They are recorded so a later reader knows they were seen and
postponed, not missed.

- **Is a bridge a `transport` value or its own axis?** It is placed on the
  transport row above because a renderer whose output is calls is still a
  renderer. But it is the one value that does not write characters, and it is
  also the only reason the `scheduling` row survives — so if the enumeration
  finds it interacts with the other axes differently from the stream values
  (a bridge with a *verbosity*? with *colour*?), it is a second dimension and
  the table is wrong. Needs the enumeration.
- **Is the exclusion set complete?** Only one exclusion is named — *transport =
  TTY × surface = several at once*. Whether `progress = dynamic` is meaningful
  on a bridge, or `annotation = GitHub` on a browser page, is unanswered.
  Naming exclusions one at a time as they are noticed is how the product
  acquires cells nobody can implement, so the design owes a rule rather than a
  list; what that rule is needs the enumeration first.
- **Where does `options-edsl` sit?** It is listed under Related rather than as
  a `**Blocked by:**`, because it blocks *shipping* `--verbose` and not
  *designing* the shape, and tasks 1 and 2 reach no flag. If the design's own
  answer turns out to need an option to express a cell, that judgement flips
  and this becomes a blocker. Revisit when the shape exists.
- **Is event granularity a separate axis from verbosity?** `verbosity` above
  lists `a record per event`, `a record per outcome` and `compact progress` as
  mutually exclusive, which conflates *how many events a renderer consumes*
  with *how much it emits per event*. `211-reporter-modes` has both a dot per
  outcome and a dynamic display of the current test, and the latter consumes
  the start event while emitting nothing lasting for it — a combination the
  row as written cannot express, and one that decides whether a renderer may
  discard start events at all. Splitting it is a change to the table, so it
  waits for the enumeration that says which granularities have a producer.
- **Who chooses `progress`, `scheduling` and `surface`?** Per the omission
  noted above. `scheduling` may not survive at all, and `surface` is plausibly
  caller-selected like the transport it is constrained by, but both are guesses
  and neither is worth fixing in the table before the enumeration.
- **What each stream means per command.** functionalscript#1790 settled it for a
  run's *records* and deliberately not further; `cas` and `mcp` put
  machine-readable output on `stdout`, and whether a diagnostic from those has
  anywhere to go is a question about them, not about this table. Task 1 is what
  surfaces it.

### Tasks

- [ ] Enumerate every output **producer**, not only what a CLI command prints:
      the browser page publishes `_BrowserEvent` and `BrowserTestReport`
      (`fjs/emergent_testing/types.ts`) outside the command list entirely, and a
      bridge emits calls. For each, which cell of the table above it occupies.
- [ ] Enumerate the report contracts **already designed but not yet emitted**,
      so the shape is not invalidated by an issue that is already open. The
      rule: *every open issue that specifies anything a destination must emit
      — a field, a status, a tally, an annotation on a record, a record that is
      not a result, or an ordering between records — is an input to the shape*.
      Deliberately not a list of three kinds:
      [throw-payload-assertions](../emergent_testing/todo/throw-payload-assertions.md)
      wants `# EXPECTED TO THROW (checked)` distinguishable from the plain
      annotation in both the CLI and the browser report, and
      [spidermonkey-test-runner](../emergent_testing/todo/spidermonkey-test-runner.md)
      wants rejected roots reported — neither is a field, a status or a tally,
      and both are contracts a renderer has to satisfy. **Read it as a sweep, not as a list
      here** — and across the `todo/` directory of **every producer task 1
      found**, not only `fjs/emergent_testing/todo/`. A test-only sweep would
      contradict this document's own claim to cover every command:
      `fjs/cas/todo/` alone has
      [command-architecture](../cas/todo/command-architecture.md) asking which
      transports expose which commands,
      [66g-cas-verify-command](../cas/todo/66g-cas-verify-command.md) asking
      for an "exit code / output format so it is scriptable in CI and cron",
      and [66j-cas-add-directory](../cas/todo/66j-cas-add-directory.md) making
      *printing nothing* the contract on partial failure. Bounded by task 1
      rather than by the whole tree — 274 `todo/` files under `fjs/` is not a
      sweep anyone runs — which is why the two tasks are in this order. An
      inline inventory was tried and grew in three consecutive review rounds —
      cancellation
      ([browser-test-controls](../emergent_testing/todo/browser-test-controls.md))
      and [skip](../emergent_testing/todo/skip-property.md), then
      [todo](../emergent_testing/todo/todo-property.md) and the
      [subset selector](../emergent_testing/todo/run-subset-of-tests.md), then
      the [property-test seed](../emergent_testing/todo/665-proof-property-tests.md)
      and the [timer resolution](../emergent_testing/todo/timer-precision.md) —
      which is what a hand-maintained list of a directory does. Every issue named
      on this task is a **lower bound found by review, not the inventory**; the
      design produces the
      inventory by running the rule over the directory at the time it is
      written.

      Two of them say something about the *shape* rather than adding to it,
      and are worth carrying across:
      [todo-property](../emergent_testing/todo/todo-property.md) scopes its
      tally to `fjs t` because the `register` path has nowhere to accumulate a
      cross-test count — a field one renderer has and another cannot, which the
      shape has no notion of; and
      [665-proof-property-tests](../emergent_testing/todo/665-proof-property-tests.md)
      needs its seed **before any result**, rendered three different ways —
      a plain line on `fjs t`, a synthetic first test through a bridge, and a
      field of `BrowserTestReport` — which is a per-run record that is not a
      result, and a renderer's freedom to express it differently.
- [ ] Design the shape and its renderers, against that enumeration.
- [ ] Answer **every** question under *Left open on purpose* — or record why
      each still has no answer — as part of the design, rather than leaving
      them to be rediscovered. Not a fixed count: whatever that section holds
      when the design is written.
- [ ] Say which existing issues the design subsumes, and retire them in the
      change that implements it rather than leaving both.

### Related

- [tty-and-line-consumers](../emergent_testing/todo/tty-and-line-consumers.md)
  — the pipe transport, blocked on this.
- [github-color-modes](../emergent_testing/todo/github-color-modes.md)
  — three cells of the product named as three modes, and the reason colour is
  an axis.
- [211-reporter-modes](../emergent_testing/todo/211-reporter-modes.md)
  — the proof runner's own mode system, which this generalises.
- [test-framework-silent-mode](../emergent_testing/todo/test-framework-silent-mode.md)
  — a verbosity, on the axis above.
- [options-edsl](../cli/todo/options-edsl.md)
  — how a user-chosen axis is declared. Not a blocker of this design, but a
  blocker of shipping the `--verbose` it promises.
