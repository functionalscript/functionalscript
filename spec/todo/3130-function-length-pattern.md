# Function length pattern

**Priority:** P2
**Status:** open — a language feature, waiting on the designer's approval
([DESIGN.md §12](../../doc/DESIGN.md#new-language-features-start-with-a-todo)).
That approval is also a choice between this pattern and the closure record
of [#2206](https://github.com/functionalscript/functionalscript/pull/2206).

## Problem

A function compiled from `(a, b) => a` must have `length === 2`. On `main`
the FunctionalScript executors, [amnesia](../../fjs/edag/amnesia/module.f.mjs)
and [memo](../../fjs/edag/memo/module.f.mjs), build a host function per `=>`
node, and no FunctionalScript expression can build one with a positive
`length`: the `=>` operation makes `(...args) => invoke(frame, args, body)`,
whose `length` is `0`; an arrow wrapper such as `(a0, ...rest) => f(a0, ...rest)`
pads `g()` to `f(undefined)`, losing the distinction `['args']` keeps; and a
`.f.mjs` cannot import a host helper.

#2206 and [#2200](https://github.com/functionalscript/functionalscript/pull/2200)
answer this the other way: a `=>` node evaluates to a record
`{ mark, length, frame, body }` the executors interpret, called through an
exported `call`, and #2200 already makes the count an operand of `=>`.

## Proposal

Admit one complete source pattern, the way
[enumerable presence](./2345-has-own-property.md) plans `hasEntity`: the
`defineProperty` exists only inside the matched definition.

```js
const withLength = (length, f) => {
    const r = (...args) => f(...args)
    Object.defineProperty(r, 'length', { value: length })
    return r
}
```

`withLength(n, f)` forwards its complete argument list to `f` and has
`length` `n`. The matcher admits exactly this definition: two parameters, a
`const` bound to an arrow spreading its rest into a call of the second, one
`defineProperty` on it with key `'length'` and descriptor `{ value: <first
parameter> }`, `return` of the constant, `Object` resolved to the intrinsic.
Any variation is refused as `defineProperty` is everywhere else. The
descriptor omits the attributes on purpose: an arrow already owns a
`length`, so the omitted ones are the native ones.

**Lowering.** `['=>', count, frame, body]`, count and frame evaluated when
the function is built, in the enclosing scope. Compiled source has a
constant; `withLength` itself has a read of its first argument. One node,
one meaning. #2200 implements this node; if it lands first, the lowering is
not this proposal's work.

**Count.** Whatever JavaScript accepts as a `length`; a compiled parameter
list yields a nonnegative integer. An executor that cannot represent a
count refuses it as its own documented limit, as the Rust printer does
today past `u32`. The language adds no bound.

**Executors.** The `=>` operation becomes
`withLength(count, (...args) => invoke(frame, args, body))`. A JavaScript
host runs the pattern as written; a VM treats it as its intrinsic; NaNVM
and the Rust printer store the arity in their own representation.

**Writer.** Named parameters where the count is a constant, every
`['args']` read is a direct index below it, and the count is under a
documented bound below the hosts' parameter-list limit. Otherwise
`withLength(<count>, (...args) => …)`, the helper emitted once per module.
That second rendering is what keeps a graph observing its complete
arguments renderable.

**Function text.** A host function carries the wrapper's source as its
text, and every host conversion can reach it: `String`, a computed key, an
array's join, a string method's argument. Guarding all of them is a check
that grows with the host surface, so this arm does not guard; it waits.
Rendering the graph's text, a second admitted key in the same pattern, is a
prerequisite, and the
[serialization](./serialization.md#function-text-and-serialization)
decisions it depends on are open.

## The decision

If #2206 and #2200 land, one question remains: **what a `=>` node evaluates
to in the JavaScript executors.**

| | closure record (#2206) | host function through the pattern |
|---|---|---|
| language | unchanged | one admitted pattern containing a `defineProperty` |
| the value | a record the executors interpret | a real function |
| `typeof`, reads, calls, spread, coercion | operations of the executor's | the host's |
| a host method calling its argument | bridged at the positions `callbacks` lists | native |
| consumers | call through the executor's `call` | call natively |
| function text | refused until rendered | rendered first; a prerequisite |

The record keeps the language closed and puts the cost in the executors;
the pattern opens the language by one spelling and takes the cost out of
them. The designer decides.

**Drawbacks of the pattern.** The language admits a spelling containing a
mutation, pure only because the matcher admits the whole definition. The
writer has two renderings. Under an interpreter a positive-arity function is
one call frame deeper. It cannot land before the function-text decisions.

## Tasks

- [ ] Record the designer's approval and the choice between record and
  pattern.
- [ ] Compiler: recognize the complete pattern; refuse every variation.
- [ ] Function text rendered from the graph, then `operations`' `=>` built
  through the pattern.
- [ ] Writer: the two renderings and the documented bound.
- [ ] Proofs: `f.length` for constant and run-time counts; `g()` sees an
  empty `['args']`; a shadowed `Object` and each pattern variation refused.
- [ ] Documents: [`fjs/edag/README.md`](../../fjs/edag/README.md),
  [execution-models](../../fjs/edag/execution-models.md), the
  [specification](../README.md#functions), and the parameter plan's
  "metadata, not an expression operand" if this lands before #2200.

## Related

- [#2206](https://github.com/functionalscript/functionalscript/pull/2206),
  [#2200](https://github.com/functionalscript/functionalscript/pull/2200) —
  the record and the count operand, implemented.
- [Parameters](./3120-parameters.md),
  [arity and complete arguments](./arity-complete-arguments.md) — the
  syntax and the writer boundary.
- [Statement-aware intrinsics](../../fjs/fsc/parser/todo/statement-aware-intrinsics.md),
  [built-in](./2360-built-in.md) — how a pattern is recognized; `defineProperty`
  stays prohibited outside it.
- [new-array-out-of-subset](../../todo/new-array-out-of-subset.md) —
  `tupleRebuild`'s `defineProperty`, which this pattern does not cover.
