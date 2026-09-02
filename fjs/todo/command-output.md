# Command output: one design for every destination

**Priority:** P2
**Status:** open

> A design document, not a task list for one command. It exists because four
> `fjs/emergent_testing/todo/` issues each proposed a *mode* for the proof
> runner's output, and the modes are not the runner's — every `fjs` command
> writes to the same destinations, and a structure invented per command is one
> more structure a reader has to learn.

## Problem

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

## The space to enumerate

Each is an axis, and **the axes compose** — a destination is a point in the
product, not a value on one list. TTY-ness and CI-ness are already known to be
independent, and collapsing them is the first mistake this document exists to
prevent, so they are two rows here rather than two values in one:

| axis | values |
| --- | --- |
| transport | TTY · pipe or file · browser page · another framework's API (a *bridge*: `node:test`/Bun `subTest` calls rather than text) · in-memory (a proof reading a run back) |
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
render into several elements, a stream cannot — so a combination like *TTY ×
several documents* has no meaning and must be ruled out in the design rather
than left for a renderer to discover. An enumeration whose product contains
cells nobody can implement is not an enumeration.

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

## What a good answer looks like

- **One structure, named once.** What a command emits is a value with a shape,
  and each destination is a renderer of it. `emergent_testing`'s `Reporter` is
  one instance of that shape, not the shape.
- **Compact.** The reason to design rather than accumulate: a mode per audience
  per command is a matrix nobody maintains. The axes above want a small product,
  not an enumeration of combinations.
- **Selectable from what a program already holds**, and the axes divide by who
  chooses. *Environment-derived* — transport, annotation, colour — come from
  `options.std[stream].isTTY` and `options.env`, which are there. *User-chosen* —
  verbosity above all — come from `options.args`, which is also there, and a CLI
  option is a **first-class selector** for those rather than a last resort:
  `test-framework-silent-mode` promises `--verbose`, and no amount of `isTTY`
  can express whether a person wants it. What is a last resort is a *new
  mechanism*, which is a redesign.
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

## Constraints inherited from what has landed

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

## Tasks

- [ ] Enumerate what every `fjs` command emits today, not only `fjs t`, and
      which cell of the table above each output already occupies.
- [ ] Design the shape and its renderers, against that enumeration.
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
