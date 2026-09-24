# Function length pattern

**Priority:** P2
**Status:** wip — approved by `sergey-shandar`, the language designer, who
directed the implementation in
[#2213](https://github.com/functionalscript/functionalscript/pull/2213)
([DESIGN.md §12](../../doc/DESIGN.md#new-language-features-start-with-a-todo)).
The EDAG node, the executors, the printer and the writer are done; what is
left waits on the parser.

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
that grows with the host surface, so this proposal does not guard. A host
function's text was reachable before it too, the executors having always
built host functions, so the pattern regresses nothing; rendering the
graph's text, a second admitted key in the same pattern, waits on the
[serialization](./serialization.md#function-text-and-serialization)
decisions.

**Drawbacks.** The language admits a spelling containing a mutation, pure
only because the matcher admits the whole definition. Under an interpreter
a positive-arity function is one call frame deeper.

## Tasks

- [x] Record the designer's approval.
- [x] `['=>', count, frame, body]` in the schema, the analysis, the
  executors, whose `=>` is built through the pattern, and the Rust printer,
  which prints the count and refuses one its `u32` cannot hold.
- [x] Writer: a count of `0` renders as the rest parameter it always did;
  any other is refused, explicitly, until the compiler reads the pattern.
- [x] Proofs: `f.length` for constant and run-time counts; `g()` sees an
  empty `['args']`.
- [x] Documents: [`fjs/edag/README.md`](../../fjs/edag/README.md), the
  [specification](../README.md#functions), and the parameter plan.
- [ ] Compiler: recognize the complete pattern; refuse every variation.
  Blocked on the parser, which reads no `Object`
  ([global names](./2365-global-names.md)); the pattern's own source is
  `(f, length) => Object.defineProperty(…)`.
- [ ] Writer: the pattern rendering, once the compiler reads it back.
- [ ] Function text rendered from the graph, the second admitted key, when
  the [serialization](./serialization.md#function-text-and-serialization)
  decisions close.

## Related

- [Functions](../README.md#functions),
  [arity and complete arguments](./arity-complete-arguments.md) — the
  named parameter syntax and the writer boundary.
- [Statement-aware intrinsics](../../fjs/fsc/parser/todo/statement-aware-intrinsics.md),
  [built-in](./2360-built-in.md) — how a pattern is recognized; `defineProperty`
  stays prohibited outside it.
- [new-array-out-of-subset](../../todo/new-array-out-of-subset.md) —
  `tupleRebuild`'s `defineProperty`, which this pattern does not cover.
