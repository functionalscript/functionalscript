## A named container's children refused under a lazy operand

**Priority:** P2
**Status:** open

### Problem

The FunctionalScript writer refuses a valid module whose body `const` holds
a call, and whose access over that `const` is read both outside a lazy operand
and inside one:

```js
export default (f, v) => { const x = f(v); return x.a === 1 || x.a === 2 }
```

`fjs compile` writes the same module to `.edag.data.js` and `.rs`, but the
`.js` output fails with `a shared node reached from outside the lazy operand
that establishes it` and writes nothing. The same failure stops two real modules
from compiling to `.js`: `fjs/git/config`, once its syntax is rewritten into
what the compiler accepts, and `fjs/website/browser-source`, the same way. The
pattern is common: an `||` of two comparisons on one field, or a field read
in a condition and again in one arm.

A call is not the cause. Any named `const` whose value holds an unnamed node
that mints identity triggers it:

```js
export default v => { const x = [[v]]; return x.a === 1 || x.a === 2 }
export default v => { const x = { b: [v] }; return x.a === 1 || x.a === 2 }
export default (f, v, c) => { const x = f(v); return [x.a, c ? x.a : 0] }
```

A call holds one such node, its argument array, even when it takes no
arguments (`f()`). The same module compiles when the `const` holds a flat array
(`const x = [v]`) or when `x` is a parameter.

### Cause

[`block`](../module.f.mjs) decides whether a lazy operand can be written as
its own block. It looks for an entry `w` under the operand that is unnamed and
reached from outside too (here the access `x.a`, held by both operands of `||`),
and refuses when `w` reaches a node that keeps a `const` (`hoistedKind`) or a
comma. It finds those nodes with `reachableFrom`, which follows every edge,
including edges into entries the scope around the block has already named.

`x` is such an entry: the scope writes it as `const $a0=$a_0($a_1)`, and every
occurrence reads it by name. Its subgraph is written once, in that `const`, and
never at an occurrence. The walk does not stop at the name: it goes on into the
call's argument array, or the nested `[v]`. That node is unnamed, because only
its parent's `const` writes it, and it mints identity. So the walk refuses an
operand whose text would be `$a0.a===2`, which builds nothing.

### Proposal

Stop the inner walk at entries the scope around the block has named: walk
`['#', w]` through unnamed entries only. A named entry is read by name wherever
it occurs, so what lies under it cannot be built twice through `w`.

A prototype makes exactly that change. A walk that takes a predicate,
`reachableThrough(a, through)`, is used with `unnamed` in place of
`reachableFrom(s.a)(['#', w])`. With it:

- every repro above writes, for example
  `export default ($a_0,$a_1)=>{const $a0=$a_0($a_1);return $a0.a===1||$a0.a===2;};`,
  and reads back to the same graph;
- every proof under `fjs/compiler` still passes, the existing `refuses` cases
  with this message included;
- both modules above compile to `.js`. Their round trip keeps every node that
  mints identity (each array, object, function and call stays one node). Only
  the object sharing of accesses and operators differs, which the writer
  already writes in place and the reader merges.

Open questions for the implementation:

- Whether the outer candidate walk, `reachableFrom(s.a)(v)`, and
  `referencesWithin` should stop at named entries as well. A place inside a
  named entry's `const` is outside the block's text, but both count it as
  inside.
- Whether `reachableFrom` should become `reachableThrough` with an always-true
  predicate rather than keeping two walks.

### Tasks

- [ ] Stop the `outside` walk in `block` at entries the outer scope names.
- [ ] Proofs in [`../proof.f.mjs`](../proof.f.mjs) that the writer now
      writes: a call-held `const` read eagerly and under a lazy operand, a
      nested-container `const`, and two `?:` arms. Keep the existing
      `refuses` cases.
- [ ] Settle the two open questions above, with a proof for each answer.
- [ ] Update the JSDoc of `block`, which describes this refusal.
- [ ] `tsc`, `fjs test`, `npm run cov` at 100%, `node --test`.

### Related

- [`../module.f.mjs`](../module.f.mjs): `block`, `reachableFrom`,
  `referencesWithin`, `hoistedKind`.
- [`../proof.f.mjs`](../proof.f.mjs): the `refuses` cases for this
  message, which are intended refusals and must stay.
- [spec: functions](../../../../spec/README.md#functions): the writer's
  block-in-a-lazy-operand idiom this check guards.
