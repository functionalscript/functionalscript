## The helper functions as one table

**Priority:** P3
**Status:** open

### Problem

An EDAG has a few function nodes that are not lambdas: `entry`, `hasEntry`
and the intrinsics. Only the intrinsics are a table —
[`module.f.mjs`](../module.f.mjs)'s `intrinsics`, `isIntrinsic`,
`intrinsicLength` — so every question about the whole set is answered by
listing it. Their arity, in two sibling modules:

```js
// value/call `prepare`
const length = fn[0] === '=>' ? fn[1] : fn[0] === 'entry' || fn[0] === 'hasEntry' ? 2 : isIntrinsic(fn) ? intrinsicLength(fn[0]) : 0
// value/property `read`
case 'entry': case 'hasEntry': { return ok(key === 'length' ? 2 : ['undefined']) }
```

and once more as `num('2')` in `rust/serializer`'s `operation`. "Is this a
function node", four times:

```js
value[0] === '=>' || value[0] === 'entry' || value[0] === 'hasEntry' || isIntrinsic(value) || isStatic(value)   // value/semantics isFunction
node[0] === '=>' || node[0] === 'entry' || node[0] === 'hasEntry' || isIntrinsic(node)                          // edag/rust holdsFunction
e[0] !== '=>' && e[0] !== 'entry' && e[0] !== 'hasEntry' && !isIntrinsic(e)                                     // compiler/serializer tryFunctionText
op === 'function' || op === 'entry' || op === 'hasEntry' || (value.length === 1 && isIntrinsic(value))          // js/ast/serializer precedence
```

And the dispatch from a helper to its text, three times, in
`compiler/serializer`'s `functionText`, `js/ast/serializer` and
`rust/serializer`'s `operation`, each an `entry`/`hasEntry`/`isIntrinsic`
ladder over `_entryText`, `_hasEntryText` and `_intrinsicText`.

### Proposal

Widen `intrinsics` into a helper table, `helpers = [['entry', 2],
['hasEntry', 2], ['slice', 3], ['charCodeAt', 2]]`, with `isHelper` and
`helperLength`, and add `isFunctionNode` (an EDAG lambda, `'=>'`, or a
helper) beside `isStatic`. In `js/ast/serializer/intrinsic`, one
`_helperChunks(id)` does the three-way text dispatch. The call binder, the
property reader and the Rust emitter then read one arity; the Rust emitter
keeps only its native body per helper.

The shared predicate replaces the helper *list* at each site, not the site's
own case. `value/semantics`'s `isFunction` also admits a static function —
`Object.is` is a function to `typeOf` — so it stays `isFunctionNode(value) ||
isStatic(value)`; and the FAST writer names a lambda `'function'`, not
`'=>'`, so `js/ast/serializer`'s `precedence` keeps that case and asks
`isHelper` for the rest. What the four sites stop doing is spelling `entry`,
`hasEntry` and `isIntrinsic` out for themselves.

### Tasks

- [ ] `helpers`, `isHelper`, `helperLength`, `isFunctionNode`; types pinned.
- [ ] The arity sites, the predicates and the text dispatches over them,
      each keeping the case above that is its own.

### Related

- [operand-classification-owner](./operand-classification-owner.md) — the
  operand walk, a different classification.
- [runtime-members](../../js/todo/runtime-members.md) — what `entry` and
  `hasEntry` mean, not where they are listed.
