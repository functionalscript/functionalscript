## Limit a function's `length` to 16

**Priority:** P2
**Status:** open — approved by the language designer, `sergey-shandar`
([approval](https://github.com/functionalscript/functionalscript/pull/2295#issuecomment-5831266299))

### Problem

A function's fixed parameter count — its `length`, `['=>', length, frame,
body]` in the EDAG — has no limit in the language. The
[parameter plan](./3120-parameters.md) chose that on purpose: the JavaScript
executor's factory table ([`fjs/types/function/length`](../../fjs/types/function/length/README.md))
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
that uses more than 16. In this repository the one such source is the factory
table itself, and it shrinks to the limit with the rest of this change.

**Where it is refused.** Over-limit length is a binding error: analysis's
`bindingError` names it, so every writer returns it as an error Result, as
the Rust writer already does for its own bound. The malformed-metadata cases
`isIndex` asserts today — negative, fractional, `-0` — stay asserted: they are
not EDAG at all, a different fault from a well-formed length the language
refuses, and no compiler produces them (decided by the language designer).

### Tasks

- [x] Record the language designer's approval here
      ([DESIGN.md §12](../../doc/DESIGN.md#new-language-features-start-with-a-todo)).
- [ ] `fjs/edag/analysis`: a function length above 16 is a binding error,
      with a proof at 16 (accepted) and 17 (refused).
- [ ] `fjs/fsc/parser`: a parameter list with more than 16 fixed names is
      refused, naming the limit, with a proof. `fjs/fsc/parameters`'
      `capacity` proof, which compiles one parameter past the table and
      expects it to round-trip, becomes that refusal.
- [ ] `fjs/fsc/serializer`: all four entry points return the error Result
      for `['=>', 2 ** 32, null, 1]`, top-level and nested in a function
      graph, without allocating the parameter names; length 16 round-trips.
- [ ] The arrow factory table covers lengths 0 through 16, and its README
      and module comment stop calling the capacity "not a language or EDAG
      limit" and "an executor resource limit". The table is written by hand
      in `fjs/types/function/length`. The executor
      refusals past the table — `callable`'s `uncovered` proof and
      `fjs/fsc/parameters`' `throw.capacity` — become refusals of invalid
      metadata, since no valid length is past it.
- [ ] Rust: the `u32` refusal gives way to the language limit in both
      `fjs/edag/rust` (its `lengthLimit` proof) and `fjs/fsc/rust` (its
      refusals of `2 ** 32`, direct, nested and through `generate`, and its
      acceptance of `0xffff_ffff`). `fjs/fsc/rust`'s
      `fixedAndCapturedBindings` proof writes `['=>', 33, null, ['arg', 32]]`
      as valid; it moves to 16 and 15, and 17 is refused.
- [ ] NaNVM: [callable-function-objects](../../nanvm-lib/todo/callable-function-objects.md)
      states length 33 valid "independently of the JavaScript factory table's
      capacity", and its Stage 6 task keeps native capacity separate from
      the table. Both follow the language limit. `IStaticFunction` keeps its
      `u32` length: it holds every valid length, so nothing in Rust changes.
- [ ] [`spec/README.md`](../README.md#functions) states the limit where it
      describes `f.length`, in place of "larger lengths remain valid for
      compilation and source output". The same claim goes from
      [`fjs/edag/README.md`](../../fjs/edag/README.md) ("it does not bound
      valid EDAG or source output") and
      [interpret-edag](../../fjs/fsc/todo/interpret-edag.md) ("that executor
      capacity does not limit valid EDAG metadata or source compilation").
- [ ] [3120](./3120-parameters.md) drops every obligation that keeps arity
      unbounded — the plan separates language validity from executor
      capacity throughout, and this proposal merges them:
      - *Implementation status* and *Proposal*: "valid source and EDAG remain
        independent of that capacity", "without imposing a language-level
        arity limit", and the costs paragraph's otherwise-valid functions
        beyond the table;
      - *Source serialization boundary*: "must not inherit that table's
        limit" — the writer inherits the language's, which the table equals;
      - *Executor capacity and migration*: "no shared language-level maximum
        arity", `16` as "only a candidate … not an approved language limit",
        and the example of a first uncovered arity that still round-trips;
      - *Tasks*: the approval task's "without imposing a language cap", the
        validation task's "a count beyond a factory table is not a validation
        error", and the open task proving that the first uncovered arity
        round-trips through source and EDAG. Under the limit no valid arity
        is uncovered; that task becomes the proof that 17 is refused at
        every entry point, which the tasks above already list.
- [ ] The [`withLength` pattern](./arity-complete-arguments.md#candidate-mechanism-the-withlength-pattern), formerly 3130, is
      reconciled. It is still an open alternative, and its proposal says the
      opposite: "no restrictions on `length`", a count "whatever JavaScript
      accepts", refused only as an executor's own limit. Its count is an
      expression evaluated when the function is built, so the limit cannot
      be checked at compile time there. Decided by the language designer:
      the pattern is retired. The fixed/rest plan is what shipped, and the
      pattern is an unimplemented alternative that contradicts the language;
      its section in
      [arity-complete-arguments](./arity-complete-arguments.md) is removed,
      and git history keeps it. Every reference to it is reconciled in the
      same change, pointing at its last text at a fixed commit and saying it
      is retired, so no surviving todo directs a reader to it as a proposal
      or through a broken anchor. The references are what a search for
      `withLength`, `2213` and "length pattern" finds:
      - `arity-complete-arguments.md` itself: "the length pattern below",
        and its Related entries on `withLength`;
      - [3120](./3120-parameters.md): "the `withLength` pattern may still be
        unnecessary for arity" and "its candidate `withLength` length
        pattern";
      - [`spec/todo/README.md`](./README.md): the arity-and-complete-arguments
        entry, "including the `withLength` pattern";
      - [`todo/new-array-out-of-subset.md`](../../todo/new-array-out-of-subset.md):
        its Related entry on the pattern;
      - [`nanvm-lib/todo/callable-function-objects.md`](../../nanvm-lib/todo/callable-function-objects.md):
        "the proposed `withLength` pattern for arity";
      - [`fjs/rtti/parse/todo/tuple-rebuild-out-of-subset.md`](../../fjs/rtti/parse/todo/tuple-rebuild-out-of-subset.md):
        "the function length pattern proposed in #2213", the admitted-pattern
        option's "the way #2213 proposes one for a function's `length`",
        and its Related link to the section's anchor;
      - [`todo/edag-stage1-discussion.md`](../../todo/edag-stage1-discussion.md):
        "without the length pattern", and the sentence after it, "That
        capacity limits materialization, not valid source or EDAG", which
        the limit contradicts: a length above 16 is invalid EDAG, and the
        table covers every valid one.

### Related

- [3120 — named and rest parameters](./3120-parameters.md) — the plan that
  left the length unbounded, and the factory table this shrinks.
- [`withLength` pattern](./arity-complete-arguments.md#candidate-mechanism-the-withlength-pattern)
  — the alternative that leaves `length` unrestricted (formerly 3130),
  retired by this change.
- [PR #2237 review](https://github.com/functionalscript/functionalscript/pull/2237#discussion_r4097887854)
  — the source writer's crash, first tracked as a writer-only issue and
  folded in here.
- [DESIGN.md §10](../../doc/DESIGN.md#10-refuse-what-you-cannot-handle) —
  why the over-limit length is refused rather than written.
