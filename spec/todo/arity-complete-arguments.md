## Serialize arity and complete arguments

**Priority:** P3
**Status:** open

### Scope: an alternative, not a parameter blocker

The [named-and-rest parameter plan](./3120-parameters.md), implemented in #2237, separates
`['arg', N]` from `['rest']` and uses pre-generated arrow factories. It does
not expose the original supplied argument count inside a positive-length
fixed prefix. This file tracks the stronger, alternative requirement below;
it is not a prerequisite for the fixed/rest implementation.

The current function shape is `['=>', length, frame, body]`, with fixed
`['arg', N]` and per-invocation `['rest']` bindings. The old three-element,
zero-arity tuple and its function-owned `['args']` are historical. Unresolved
modules retain their separate ordered import binding under `['args']`;
function bodies cannot read it. A function's frame belongs to its enclosing
scope, while only its body opens a new invocation.

### Problem

The earlier hypothetical format combined positive declared arity with the
complete supplied argument list. A graph such as
`['=>', 2, ['[]', []], ['.', ['args'], 'length']]` would need a callable `f`
with `f.length === 2`, `f() === 0`, `f(undefined) === 1` and `f(1, 2, 3) === 3`.
This is invalid under the implemented fixed/rest binding rules; the tuple's
four elements do not make the complete-arguments interpretation valid.

A named-plus-rest arrow cannot recover that complete list: rebuilding
`[a, b, ...rest]` pads omitted fixed positions with `undefined`. That is a
problem for this stronger contract, not for the implemented parameter-binding contract.
The length pattern below is one possible mechanism for the stronger contract.

### Candidate mechanism: the `withLength` pattern

Proposed in [#2213](https://github.com/functionalscript/functionalscript/pull/2213),
whose GitHub description reports the language designer's approval of this
earlier pattern; the file that PR committed still said approval was pending,
so the attribution is to the PR description only. Its implementations,
[#2216](https://github.com/functionalscript/functionalscript/pull/2216) and
[#2217](https://github.com/functionalscript/functionalscript/pull/2217), were
closed unmerged: the fixed/rest plan replaced them for named-parameter arity.
The pattern is therefore not an additional runtime mechanism; it stays here
only as a way to build a callable with an arbitrary `length` that still
receives the complete original argument list.

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

- **Lowering.** The pattern evaluates its count as an expression when the
  function is built. That must not be mixed silently with the implemented
  node's integer `length` metadata and fixed/rest bindings; reconciling the
  two is the task below.
- **No restrictions on `length` or `f`.** `withLength` is a value: once it
  exists, any program can call it with anything, so the pattern restricts
  neither argument, and a count is whatever JavaScript accepts as a `length`.
  An executor that cannot represent one refuses it as its own limit.
- **Function text.** A host function carries the wrapper's source as its
  text, and every host conversion can reach it. Rendering the graph's text,
  a second admitted key in the same pattern, is a prerequisite, and the
  [serialization](./serialization.md#function-text-and-serialization)
  decisions it depends on are open.
- **Drawbacks.** The language admits a spelling containing a mutation, pure
  only because the matcher admits the whole definition. Under an interpreter
  a positive-arity function is one call frame deeper. It cannot land before
  the function-text decisions.

### Tasks

- [ ] Revisit only if positive arity plus the complete original supplied list
      is needed independently of the named-and-rest parameter work. Obtain an
      explicit language-design decision before restoring that EDAG capability.
- [ ] If retained, propose a source representation preserving both properties,
      state its benefits and costs, and reconcile it with the parameter plan;
      do not silently give `['rest']` or `['arg', N]` different meanings.
- [ ] Prove omitted, explicit `undefined` and extra-argument round trips for
      any such extension. Unsupported legacy/proposed graphs must be refused,
      not normalized and described as lossless.

### Related

- [function-length-limit](./function-length-limit.md) — proposes at most 16
  fixed parameters, which the pattern's unrestricted `length` conflicts with;
  the open question is recorded there.
- [Review finding](https://github.com/functionalscript/functionalscript/pull/2133#discussion_r4054015547)
  — the complete-list writer obstruction that motivated the earlier task.
- [Serialization](./serialization.md#function-text-and-serialization) —
  callable serialization and default function text have separate open questions.
- [Statement-aware intrinsics](../../fjs/fsc/parser/todo/statement-aware-intrinsics.md),
  [built-in](./2360-built-in.md) — how a pattern such as `withLength` is
  recognized; `defineProperty` stays prohibited outside it.
- [new-array-out-of-subset](../../todo/new-array-out-of-subset.md) —
  `tupleRebuild`'s `defineProperty`, which the `withLength` pattern does not
  cover.
