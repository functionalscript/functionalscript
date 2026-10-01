## A named value's contents refused under a lazy operand

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
that mints identity triggers it, and so does one that holds such a node under
a lazy operand of its own:

```js
export default v => { const x = [[v]]; return x.a === 1 || x.a === 2 }
export default (f, v, c) => { const x = f(v); return [x.a, c ? x.a : 0] }
export default (f, v, d) => { const x = d ? f(v) : 0; return d === 0 || x.a === 1 || x.a === 2 }
export default (v, c, d) => { const x = c ? [v] : v; return d ? x.a : [x.a] }
```

A call holds one such node, its argument array, even when it takes no
arguments (`f()`). The same module compiles when the `const` holds a flat array
(`const x = [v]`) or when `x` is a parameter.

### Cause

[`block`](../module.f.mjs) decides whether a lazy operand can be written as
its own block. Its `outside` test looks for an entry `w` under the operand
that is unnamed and reached from outside too (here the access `x.a`, held by
both operands of `||`). It refuses when anything `w` reaches is a
`hoistedKind` node or a comma. Two walks behind that test follow edges into
entries the scope around the block has already named:

- the reach from `w` itself, `reachableFrom`, which goes on into the call's
  argument array, or the nested `[v]`;
- the walks inside `hoistedKind`, `eagerFrom` and then `reachableFrom` over
  lazy operands. They count `x.a` as a node that needs a `const` because `x`
  holds an array or a call under its own `?:`.

`x` is such an entry: the scope writes it as `const $a0=…`, and every
occurrence reads it by name. Its subgraph is written once, in that `const`, and
never at an occurrence. So the test refuses an operand whose text would be
`$a0.a===2`, which builds nothing.

### Proposal

Look only at what the block's text would write: in the `outside` test, walk
from `w` through unnamed entries alone, and ask of each node it meets whether it
mints identity or is a comma, not whether it is `hoistedKind`. The walk
already visits every unnamed node under `w`, eagerly or lazily, so the only
thing `hoistedKind` adds there is what lies behind a name, which is the false
positive.

```js
// in `block`
reachableThrough(s.a, unnamed)(['#', w]).some(i => minting(s.a.nodes[i]) || s.a.nodes[i][0] === ',')
```

`reachableThrough(a, through)` is `reachableFrom` with a predicate that the
walk must pass to enter an entry. Keep one walk: `reachableFrom` becomes
`reachableThrough` with a predicate that admits every entry.

A prototype of exactly this was checked against the current writer:

- every repro above writes text that reads back to the same graph, for example
  `export default ($a_0,$a_1)=>{const $a0=$a_0($a_1);return $a0.a===1||$a0.a===2;};`;
- every intended refusal with this message still refuses. `refuses` cases in
  [`../proof.f.mjs`](../proof.f.mjs) such as `['?:', true, c, c]` check them;
- all compiler proofs pass, and so does `npm run cov` at 100%;
- across several thousand generated modules, it refuses nothing the current
  writer accepts. Every module it newly accepts reads back with the same nodes
  that mint identity, and evaluates the same, calls included.

Two answers this settles:

- **The candidate walk and `referencesWithin` stay as they are.** Whatever a
  named entry holds eagerly belongs to the scope that names it, and that scope
  names it where it is shared. Whatever the entry holds lazily is checked when
  the entry's own `const` is written. Stopping those walks at names, too,
  changed no output on the generated modules.
- **`hoistedKind` keeps its own walks in `hoists`.** There it decides which
  values a statement names, before those names exist. It sometimes names an
  access it need not, such as `const $b0=$a0.a;`. That costs text, not
  correctness, and is not this issue.

What else changes, observably:

- The `.rs` writer embeds the `.js` writer's function text through
  `tryFunctionText` and writes `None` where that refuses. Functions like the
  repro now carry `Some(text)`. In the rewritten `fjs/git/config`, every
  function that was `None` gets text. The `nanvm-harness` fixtures are
  byte-identical.
- A module whose single default export the compact writer refused fell back to
  the module walk in `tryModuleSerialize`. It now gets the compact text:
  `const k = [[1]]; const j = k.a; export default j === 1 || j === 2` writes
  `const $0=[[1]];export default $0.a===1||$0.a===2;`.

### Tasks

- [ ] In `block`, walk from `w` through unnamed entries and test `minting`
      or comma, as above. Define `reachableFrom` through `reachableThrough`.
- [ ] `writes` proofs in [`../proof.f.mjs`](../proof.f.mjs), next to the
      `refuses` cases for this message: a call-held `const` under `||`,
      under one `?:` arm, and under both arms; a nested-container `const`;
      and a named `const` holding a call or an array under its own `?:`.
      Keep every existing `refuses` case.
- [ ] Update the JSDoc of `block`, and the comment on its `outside` test, to
      say that what a named value holds is not looked at, and why the
      candidate walk and `referencesWithin` still go through names.
- [ ] `tsc`, `fjs test`, `npm start compile`, `npm run cov` at 100%,
      `node --test`.

### Related

- [`../module.f.mjs`](../module.f.mjs): `block`, `reachableFrom`,
  `hoistedKind`, `minting`, `referencesWithin`, `tryModuleSerialize`.
- [`../../../edag/rust/module.f.mjs`](../../../edag/rust/module.f.mjs):
  embeds the function text this writer produces.
- [spec: functions](../../../../spec/README.md#functions): the writer's
  block-in-a-lazy-operand idiom this check guards.
