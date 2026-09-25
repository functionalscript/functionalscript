# Function length pattern

**Priority:** P2
**Status:** open — implementation pending.

**Approval source:** [PR #2213's current GitHub description](https://github.com/functionalscript/functionalscript/pull/2213)
reports approval of the earlier pattern by the language designer. In contrast,
[the file committed by #2213](https://github.com/functionalscript/functionalscript/blob/161e003ffea2d05c8d3b0d3b71939371764853d6/spec/todo/3130-function-length-pattern.md)
still says approval is pending. The approval attribution here is specifically
to the PR description, not the merged document or merge commit.
[PR #2220](https://github.com/functionalscript/functionalscript/pull/2220) proposes
a fixed/rest replacement for named-parameter arity. Approval of that replacement
is separate ([DESIGN.md §12](../../doc/DESIGN.md#new-language-features-start-with-a-todo)).

## Implementation follow-up

The September 24 implementation request explicitly selects #2220's fixed/rest
model and pre-generated arrow factories. The implementation is stacked on
#2220; it reuses the LL(1) parser factoring from #2217 and replaces its earlier
argument lowering. The shared default-text renderer remains an integration
gate, tracked in [3120](./3120-parameters.md). This does not authorize merging
or closing #2216 or #2217, whose full-argument contracts differ.

## Alternative scope

The [named-and-rest parameter plan](./3120-parameters.md) now proposes
`['arg', N]`, `['rest']` and pre-generated arrow factories. For that contract,
padding missing fixed arguments is unobservable, so the pattern below is
**not a prerequisite for named parameters or their arity**. This document
remains an alternative for construction with arbitrary `length` values and
the complete original argument list. Its expression-valued count and
full-`['args']` model must not be mixed silently with the parameter plan's
integer metadata and fixed/rest bindings. The current implementation follows the fixed/rest plan; this pattern remains
an alternative, not an additional runtime mechanism.

## Parallel implementations and rollout

**The target proposed by #2220 is fixed/rest, not complete invocation arguments.**
It proposes replacing the earlier pattern-based route for named-parameter arity,
not adding a second meaning to the same function-node shape. PR #2213 merged
the proposal without a surviving implementation. Its GitHub description reports
the earlier approval, as cited above; this does not assert that its merged file
or merge commit records approval, nor approve the different fixed/rest contract.

The parallel implementation heads reviewed on September 24, 2026 are not
implementations of this replacement:

- [#2216](https://github.com/functionalscript/functionalscript/pull/2216) at
  `e153afe4` evaluates `count` as an expression, constructs through `withLength`,
  and retains the complete invocation `['args']`.
- [#2217](https://github.com/functionalscript/functionalscript/pull/2217) at
  `aaf716b5` builds on #2216, binds names through indexed `['args']`, refuses
  mixed named/rest syntax, and deletes `3120-parameters.md`.

**Proposed merge sequence:** record the designer's explicit replacement and
rollout decision, land #2220's design, then rework #2216's representation and
executors and #2217's parser/writer against that design. Reusable parser work
need not be discarded. Keep `3120-parameters.md`, or explicitly move its remaining
requirements to another TODO, until the fixed/rest, mixed-parameter and migration
work it tracks is complete. Do not accept its deletion merely because fixed-only
parsing landed under the earlier contract.

Until that decision is recorded, the three PRs must not be merged as if their
contracts agree. Resolving textual merge conflicts is insufficient. If an earlier
implementation lands first, rebase this proposal on the landed behavior and
specify the subsequent breaking migration; do not silently reinterpret its
expression-valued count or promise a lossless conversion of arbitrary
positive-arity/full-argument graphs. The retained module-import `['args']` binding
is separate from invocation arguments, as the parameter plan specifies.

This is a proposed integration order, not a new designer approval, an
implementation commit, or authorization to merge or close the other PRs. The
remaining sections describe the earlier pattern alternative only; their task
list does not override the fixed/rest plan or its default-rendering obligations.

## Problem

A function compiled from `(a, b) => a` must have `length === 2`. The
FunctionalScript executors, [amnesia](../../fjs/edag/amnesia/module.f.mjs)
and [memo](../../fjs/edag/memo/module.f.mjs), build a host function per `=>`
node, and no FunctionalScript expression can build one with a positive
`length`: the `=>` operation makes `(...args) => invoke(frame, args, body)`,
whose `length` is `0`; an arrow wrapper such as `(a0, ...rest) => f(a0, ...rest)`
pads `g()` to `f(undefined)`, losing the distinction `['args']` keeps; and a
`.f.mjs` cannot import a host helper.

## Proposal

Admit one complete source pattern, the way
[enumerable presence](./2345-has-own-property.md) plans `hasEntity`: the
`defineProperty` exists only inside the matched definition.

```js
const withLength = (f, length) =>
    Object.defineProperty((...args) => f(args), 'length', { value: length })
```

`withLength(f, n)` hands `f` its complete argument list as one array and
has `length` `n`. `defineProperty` returns its object, so the pattern is one
expression, and the matcher admits exactly it: an arrow passing its rest
parameter to a call of the first parameter, key `'length'`, descriptor
`{ value: <second parameter> }`, `Object` resolved to the intrinsic. Any
variation is refused as `defineProperty` is everywhere else. The descriptor
omits the attributes on purpose: an arrow already owns a `length`, so the
omitted ones are the native ones.

**Lowering.** `['=>', count, frame, body]`, count and frame evaluated when
the function is built, in the enclosing scope. Compiled source has a
constant; `withLength` itself has a read of its second argument. One node,
one meaning.

**No restrictions on `length` or `f`.** `withLength` is a value: once it
exists, any program can call it with anything, so the pattern restricts
neither argument, and a count is whatever JavaScript accepts as a `length`.
An executor that cannot represent one refuses it as its own limit.

**Executors.** The `=>` operation becomes
`withLength(args => invoke(frame, args, body), count)`. A JavaScript
host runs the pattern as written; a VM treats it as its intrinsic; NaNVM
and the Rust printer store the arity in their own representation.

**Writer.** Every function renders as `withLength(args => …, <count>)`,
the helper emitted once per module. A writer may render a named parameter
list instead where it can see that the list means the same; that is the
writer's choice, not a rule of the language.

**Function text.** A host function carries the wrapper's source as its
text, and every host conversion can reach it: `String`, a computed key, an
array's join, a string method's argument. Guarding all of them is a check
that grows with the host surface, so this proposal does not guard; it waits.
Rendering the graph's text, a second admitted key in the same pattern, is a
prerequisite, and the
[serialization](./serialization.md#function-text-and-serialization)
decisions it depends on are open.

**Drawbacks.** The language admits a spelling containing a mutation, pure
only because the matcher admits the whole definition. Under an interpreter
a positive-arity function is one call frame deeper. It cannot land before
the function-text decisions.

## Tasks

- [x] Attribute the earlier approval report to
  [PR #2213's GitHub description](https://github.com/functionalscript/functionalscript/pull/2213),
  distinguishing it from the pending status in the committed file.
- [ ] Record the designer's replacement/rollout decision and reconcile #2216
  and #2217 as described above before merging conflicting contracts.
- [ ] Compiler: recognize the complete pattern; refuse every variation.
- [ ] Function text rendered from the graph, then `operations`' `=>` built
  through the pattern.
- [ ] Writer: the pattern rendering.
- [ ] Proofs: `f.length` for constant and run-time counts; `g()` sees an
  empty `['args']`; a shadowed `Object` and each pattern variation refused.
- [ ] Documents: [`fjs/edag/README.md`](../../fjs/edag/README.md),
  [execution-models](../../fjs/edag/execution-models.md), the
  [specification](../README.md#functions), and the parameter plan's
  "metadata, not an expression operand".

## Related

- [Parameters](./3120-parameters.md),
  [arity and complete arguments](./arity-complete-arguments.md) — the
  fixed/rest plan and the stronger alternative complete-list requirement.
- [Statement-aware intrinsics](../../fjs/fsc/parser/todo/statement-aware-intrinsics.md),
  [built-in](./2360-built-in.md) — how a pattern is recognized; `defineProperty`
  stays prohibited outside it.
- [new-array-out-of-subset](../../todo/new-array-out-of-subset.md) —
  `tupleRebuild`'s `defineProperty`, which this pattern does not cover.
