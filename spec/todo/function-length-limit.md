## Limit a function's `length` to 16

**Priority:** P2
**Status:** open — proposal, awaiting the language designer's recorded approval

### Problem

A function's fixed parameter count — its `length`, `['=>', length, frame,
body]` in the EDAG — has no limit in the language. The
[parameter plan](./3120-parameters.md) chose that on purpose: the JavaScript
executor's factory table ([`fjs/edag/callable`](../../fjs/edag/callable/README.md))
covers lengths 0 through 32, and a larger length stays valid for compilation
and source output.

So every consumer of the EDAG has to decide what an unbounded integer means,
and each has decided differently:

- the executor asserts, past the end of its table;
- the Rust writer ([`fjs/edag/rust`](../../fjs/edag/rust/module.f.mjs)) refuses
  what `IStaticFunction`'s `u32` cannot hold;
- the FunctionalScript source writer
  ([`fjs/fsc/serializer`](../../fjs/fsc/serializer/module.f.mjs)) has no bound
  at all. Its `entry` builds the parameter names with
  `Array.from({ length }, …)`, so `['=>', 2 ** 32, null, 1]` — valid length
  metadata that passes binding analysis — throws `RangeError: Invalid array
  length` out of `trySerialize`, `tryStringify`, `tryModuleSerialize` and
  `tryModuleStringify` instead of returning an error Result. Reproduced at
  `f2a98b0c`, `5affe40a` and `697897f`
  ([PR #2237 review](https://github.com/functionalscript/functionalscript/pull/2237#discussion_r4097887854)).
- the hosts disagree among themselves. Measured at `697897f`: V8 (node 22)
  refuses more than 65,534 formal parameters, and from 32,768 on it reports a
  wrong, negative `f.length`; Bun accepts 100,000.

A writer-specific bound would fix the crash, and it was the first proposal. It
was rejected: it picks one more number for one more consumer, when no program
needs the range any of them are arguing over.

### Proposal

A function has at most **16** fixed parameters. The limit is part of the
language, so it is stated once, in the EDAG, and every consumer inherits it.

Nothing is lost by it. FunctionalScript's first draft gave a function a single
parameter, and the fixed/rest list came later for JavaScript familiarity
([DESIGN.md §12](../../doc/DESIGN.md#12-preserve-harmless-javascript-conventions)),
not because a program needed many positions. Data wider than 16 positions
reads better as an array or an object, which the language has, and a rest
parameter still takes any number of arguments.

**The guarantee it protects** (§12 asks a restriction for one): every valid
function is materializable, with the right `length`, by every backend — the
executor's table, the Rust `u32`, and every host that reads the source writer's
output. Today "valid EDAG" and "a function this backend can build" are
different sets, and each backend's gap is a failure mode of its own.

**Benefits:** one limit instead of one per backend; the source writer's crash
disappears with the range it came from; the factory table shrinks to the
lengths the language admits, so its capacity assertion can no longer fire on
a valid graph.

**Drawbacks:** a JavaScript function with more than 16 fixed parameters is
valid JavaScript and not FunctionalScript. The subset still holds — every
FunctionalScript program stays a JavaScript program — but a port of such code
has to regroup its parameters. It is a breaking change for any EDAG or source
that uses more than 16, and none in this repository does.

**Where it is refused.** Over-limit length is a binding error: analysis's
`bindingError` names it, so every writer returns it as an error Result, as
the Rust writer already does for its own bound. Open question: whether the
malformed-metadata cases `isIndex` asserts today — negative, fractional,
`-0` — move with it from a throw to the same error, or stay asserted as "no
EDAG".

### Tasks

- [ ] Record the language designer's approval here
      ([DESIGN.md §12](../../doc/DESIGN.md#new-language-features-start-with-a-todo)).
- [ ] `fjs/edag/analysis`: a function length above 16 is a binding error,
      with a proof at 16 (accepted) and 17 (refused).
- [ ] `fjs/fsc/parser`: a parameter list with more than 16 fixed names is
      refused, naming the limit, with a proof.
- [ ] `fjs/fsc/serializer`: all four entry points return the error Result
      for `['=>', 2 ** 32, null, 1]`, top-level and nested in a function
      graph, without allocating the parameter names; length 16 round-trips.
- [ ] `fjs/edag/callable`: `table.f.mjs` is written once, by hand, for
      lengths 0 through 16, and `callable/generate` is deleted with its step
      in `npm run gen`. The table exists because a function's `length` comes
      only from a written parameter list — FunctionalScript has no
      `defineProperty`, `eval` or `Function` to set it otherwise — and with
      the length fixed by the language there is nothing left to generate.
      `fjs/fsc/parameters`' `generatedTable` proof, which compiles the
      generator's text, compiles the hand-written table instead, and the
      callable README stops calling the capacity "not a language or EDAG
      limit".
- [ ] `fjs/edag/rust`: the `u32` refusal and its `lengthLimit` proof give way
      to the language limit.
- [ ] [`spec/README.md`](../README.md#functions) states the limit where it
      describes `f.length`; [3120](./3120-parameters.md)'s "without imposing
      a language-level arity limit" follows.

### Related

- [3120 — named and rest parameters](./3120-parameters.md) — the plan that
  left the length unbounded, and the factory table this shrinks.
- [PR #2237 review](https://github.com/functionalscript/functionalscript/pull/2237#discussion_r4097887854)
  — the source writer's crash, first tracked as a writer-only issue and
  folded in here.
- [DESIGN.md §10](../../doc/DESIGN.md#10-refuse-what-you-cannot-handle) —
  why the over-limit length is refused rather than written.
