## corpus-eliminators. The operator-corpus rules are re-implemented by both consumers

**Priority:** P4
**Status:** open

### Problem

`fjs/nanvm/module.f.mjs` declares itself the single source of truth for the
operator test corpus ("a new case is written once and checked twice"). The
*cases* are — but two *rules of the corpus format* are written twice, once in
each consumer, with each copy's comment pointing at the other:

Commutative-order expansion, byte-identical including the JSDoc type
(`fjs/nanvm/proof.f.mjs:78-80` vs `fjs/nanvm/rust/module.f.mjs:119-121`):

```js
const orders = commutative => c => commutative
    ? [[c.name, c.args], [`${c.name}Swapped`, c.args.toReversed()]]
    : [[c.name, c.args]]
```

The `Swapped` suffix is a test-*name* convention: change it in one file and
the JS and Rust test names for the same case silently diverge.

The `throws`-marker probe (`proof.f.mjs:69-70` as `isThrows` vs inlined in
`rust/module.f.mjs:125`):

```js
typeof expected === 'function' && expected()[0] === 'throw'
```

And the same guard again at `proof.f.mjs:36` / `rust/module.f.mjs:70`
(`` case 'throw': { throw ['`throws` is not a value', info] } ``).

### Proposal

The corpus module already exports the format's *constructors* (`throws`,
`ref`, `functionValue`); export its *eliminators* beside them:

```js
// fjs/nanvm/module.f.mjs
export const isThrows = ...
export const orders = ...
```

Both consumers import them; the `Swapped` naming rule and the marker encoding
get one owner each.

### Tasks

- [ ] Move `orders` and `isThrows` into `fjs/nanvm/module.f.mjs` (exported,
      proof-covered); import them from `proof.f.mjs` and `rust/module.f.mjs`.
- [ ] `npx tsc`, `fjs t`; `npm run update` if the generated Rust output is
      affected (it should be byte-identical).

### Related

- `nanvm-lib/todo/operator-test-operation-model.md` — rewrites the corpus
  model (semantic operations + arity) across the same three files and keeps
  the `Swapped` disambiguation; if it lands first, `orders`/`isThrows` should
  be extracted as part of that rewrite rather than separately.
