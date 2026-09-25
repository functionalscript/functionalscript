## Move the arrow factories to `fjs/types/function`, without a generator

**Priority:** P3
**Status:** open

### Problem

`table.f.mjs` holds one arrow factory per function length —
`g => (a0, a1, ...rest) => g([a0, a1], rest)` — and exists because a
function's `length` comes only from a written parameter list:
FunctionalScript has no `defineProperty`, `eval` or `Function` to set it
otherwise. Two things about where it lives are wrong.

**It used to be generated, and nothing needed it to be.** A generator
module, its proof and an `npm run gen` step existed for a table of short lines
that never changes on its own: its capacity is a constant, and
[function-length-limit](../../../../spec/todo/function-length-limit.md) proposes
fixing that constant in the language. The table is now written by hand —
[generated-file-conventions](../../../../todo/generated-file-conventions.md)
needs the CLI, which imports it, to run with every generated file deleted.

**It is not about the EDAG.** A factory takes a `(fixed, rest) => …` body
and answers an arrow with the given `length`. Nothing in it reads a node,
an operand or a scope: it is a function combinator, and `fjs/types/function`
is where the repository keeps those. `fjs/edag/operations` is one consumer;
any FunctionalScript evaluator that has to build a callable of a given
length — one written in FunctionalScript, the point of the fixed/rest design
in [3120](../../../../spec/todo/3120-parameters.md) — is another, and should
not import an EDAG package to do it.

### Proposal

- The table is written once, by hand, and checked in as source.
- It moves, with `callable` and its `Body`/`Callable`/`Factory` types, to
  `fjs/types/function`. `isIndex`, the canonical-length predicate
  `callable` asserts and `fjs/edag/analysis` validates with, moves with
  them.
- `fjs/edag/callable` is deleted; `fjs/edag/operations` and
  `fjs/edag/analysis` import from the new place.

This is independent of the length limit: done first, the hand-written table
keeps lengths 0 through 32, and function-length-limit trims it to 16.

Open question: the module and export names — `fjs/types/function` itself,
or a submodule of it such as `fjs/types/function/length` — are part of the
public API and the owner's call.

### Tasks

- [ ] Decide the module and export names.
- [ ] Move the table, `callable`, `isIndex` and the types, with the table
      written by hand and the proofs moved alongside; `fjs/edag/operations`
      and `fjs/edag/analysis` import them from there.
- [x] Delete `fjs/edag/callable/generate` and its step in `npm run gen`.
- [x] `fjs/fsc/parameters`' `generatedTable` proof compiled the generator's
      text; its `factoryTable` proof now compiles the same shape, built from
      the table's length.
- [ ] Update the prose that points here: [`fjs/edag/README.md`](../../README.md),
      [`../README.md`](../README.md) (moved with the code),
      [3120](../../../../spec/todo/3120-parameters.md) and
      [interpret-edag](../../../fsc/todo/interpret-edag.md).

### Related

- [function-length-limit](../../../../spec/todo/function-length-limit.md) —
  fixes the table's size in the language.
- [3120 — named and rest parameters](../../../../spec/todo/3120-parameters.md)
  — where the factories were designed.
