# Command output: one design for every destination

**Priority:** P2
**Status:** open

> A design document, not a task list for one command. It exists because three
> `fjs/emergent_testing/todo/` issues each proposed a *mode* for the proof
> runner's output, and the modes are not the runner's — every `fjs` command
> writes to the same destinations, and a structure invented per command is
> three structures a reader has to learn.

## Problem

`fjs t` picked one output shape, for one audience: a terminal reader watching a
suite go by. That was the right first answer and it is now the only one. Each
of the other audiences has been noticed separately, and each got its own issue
proposing its own mode:

- a **pipe or log collector**, which sees nothing until a line is closed
  ([tty-and-line-consumers](../../fjs/emergent_testing/todo/tty-and-line-consumers.md));
- a reader who wants **brief progress and the failures**, not a line per test
  ([test-framework-silent-mode](../../fjs/emergent_testing/todo/test-framework-silent-mode.md));
- and the **mode system** those two would each need
  ([211-reporter-modes](../../fjs/emergent_testing/todo/211-reporter-modes.md)).

Answering them one at a time gives the proof runner a mode system that no other
command shares, invented from whichever audience was asked about first. The
enumeration below is the whole space; the design is what covers it.

## The space to enumerate

Each is an axis, and the axes are **not** one flag. TTY-ness and CI-ness are
already known to be independent — a CI log collector is a non-TTY destination
that also wants GitHub annotations — and collapsing them was the first mistake
this document exists to prevent.

| axis | values |
| --- | --- |
| destination | TTY · pipe or file · CI (GitHub annotations) · browser page · in-memory (a proof reading a run back) |
| verbosity | a record per event · a record per outcome · compact progress · failures only · silent |
| progress | static (append-only) · dynamic (cursor movement, a line rewritten in place) |
| scheduling | sequential · parallel — a parallel run's records interleave, so what identifies a record is part of the format rather than an afterthought |
| surface | one stream · a browser document · several windows or elements at once |

Two things that look like axes and are not, and the design should say so rather
than leave them to be rediscovered: **colour** is a property of the TTY
destination that `csiWrite` already strips elsewhere, and **exit code** is not
output at all.

## What a good answer looks like

- **One structure, named once.** What a command emits is a value with a shape,
  and each destination is a renderer of it. `emergent_testing`'s `Reporter` is
  one instance of that shape, not the shape.
- **Compact.** The reason to design rather than accumulate: a mode per audience
  per command is a matrix nobody maintains. The axes above want a small product,
  not an enumeration of combinations.
- **Selectable from what a program already holds.** `options.std[stream].isTTY`
  and `options.env` are there; a new flag is a last resort and a *new mechanism*
  is a redesign.
- **Provable without the destination.** `effects/node/virtual` is neither a TTY
  nor a pipe and answers `isTTY` either way, so every mode has to be observable
  through it. A format that can only be checked by looking at a real terminal
  has no proof.
- **It applies to more than one command.** If the answer only makes sense for
  `fjs t`, it is the proof runner's mode system again under a new name.

## Constraints inherited from what has landed

These are settled and are inputs, not questions:

- **One stream per run.** Every record goes to `stdout`; `stderr` is for a
  runner crash, after there is no longer a run to correlate with
  (functionalscript#1790).
- **Not two records per leaf on a TTY.** Tried and reverted: it doubles every
  line of every run to guard a case that announces itself. The reason is on
  `defaultReporter`'s `start` in
  [`../../fjs/emergent_testing/module.f.mjs`](../../fjs/emergent_testing/module.f.mjs).
  A *non-TTY* format may still choose it; that is the point of having two.
- **The browser is a destination, not a variant.** It renders a pending row on
  the start event and settles it in place, and a design that only distinguishes
  TTY from pipe must not make it harder to add — see
  [the emergent_testing README](../../fjs/emergent_testing/README.md#the-two-runners-and-what-sharing-them-cost).

## Tasks

- [ ] Enumerate what every `fjs` command emits today, not only `fjs t`, and
      which cell of the table above each output already occupies.
- [ ] Design the shape and its renderers, against that enumeration.
- [ ] Say which existing issues the design subsumes, and retire them in the
      change that implements it rather than leaving both.

### Related

- [tty-and-line-consumers](../../fjs/emergent_testing/todo/tty-and-line-consumers.md)
  — the pipe destination, blocked on this.
- [211-reporter-modes](../../fjs/emergent_testing/todo/211-reporter-modes.md)
  — the proof runner's own mode system, which this generalises.
- [test-framework-silent-mode](../../fjs/emergent_testing/todo/test-framework-silent-mode.md)
  — a verbosity, on the axis above.
