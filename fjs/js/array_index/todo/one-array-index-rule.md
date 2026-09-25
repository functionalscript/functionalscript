## one-array-index-rule. Two modules each decide what an array index is

**Priority:** P4
**Status:** open

### Problem

"Does this key name an element?" is ECMAScript's *array index* rule — the
canonical decimal spelling of an integer in `0 .. 2 ** 32 - 2` — and two
modules answer it with their own copy, only one of them drawing the bound:

```js
// fjs/rtti/common/module.f.mjs, arrayIndex
const arrayIndex = k => {
    const i = Number(k)
    return Number.isInteger(i) && i >= 0 && i < 2 ** 32 - 1 && String(i) === k ? i : undefined
}
// fjs/fsc/ast/module.f.mjs, arrayIndex
const arrayIndex = key => {
    const n = Number(key)
    return isInteger(n) && n >= 0 && `${n}` === key ? n : undefined
}
```

The round-trip idea is the same in both, and `fsc/ast`'s doc says so in
prose — it ends "as `fjs/rtti/common` reads an index too" — but nothing links
the code. Only `rtti/common` carries the upper bound, because only it has been
bitten: the changelog for `0.47.0` records that a canonical key at or above
`2 ** 32 - 1` rode through a closed container as neither an index nor a
property. `fsc/ast` argues the bound away in a comment instead of having
it — a later `< length` test makes the omission harmless, which is true today
and is exactly the kind of invariant a copy loses when its caller changes. A
third copy, `isCanonicalIndex` and `arrayIndexOf` in `fjs/edag/rust`, has
since gone from that module.

The Rust copy, `canonical_index` / `string_to_index` in
`nanvm-lib/src/vm/member_access.rs`, draws the bound at another place,
`<= u32::MAX` — one past the language's. That is not this issue's to fix, but
it is what independent spellings of one rule look like.

### Proposal

One owner under `fjs/js/`, beside `keywords`, whose module doc already
states the principle — "every consumer … derives its set from this module
instead of keeping a copy". A new `fjs/js/array_index/module.f.mjs` with
one export:

```ts
/**
 * The array index a property key names, or `null`: the canonical decimal
 * spelling of an integer in `0 .. 2 ** 32 - 2`
 * ([ECMA-262 §6.1.7](https://tc39.es/ecma262/#array-index)). `'-1'`, `'01'`,
 * `'1.5'`, `'1e3'`, `' 1'`, `'-0'` and `'4294967295'` are ordinary properties.
 */
export const arrayIndex: (key: string) => Nullable<number>
```

A numeric-key twin, `numberArrayIndex`, was proposed for `edag/rust`'s copy;
that copy is gone, so it waits for a consumer.

The bound lives in one place and every consumer inherits it: `rtti/common`
loses nothing, `fsc/ast` gains the bound it argued away and can drop the
paragraph that argued it. `Nullable` is the repository's absence type
(`fjs/types/nullable`), so the two `undefined`-returning copies switch to
`null`; their callers already spell absence as `?? length` and `!== undefined`,
which become `?? length` and `!== null`.

`String(Number(key)) === key` stays the test: it *is* `Number::toString`
run by the engine that defines it, and it rejects every non-canonical
spelling at once rather than one at a time. The module's proof pins the
boundary cases by name — `'4294967294'` in, `'4294967295'` out, `'-0'` out.

### Tasks

- [ ] `fjs/js/array_index/module.f.mjs` with `arrayIndex`, `types.ts`, and a
      `proof.f.mjs` at 100% with the boundary cases above. No `deno.json`
      `exports` entry: the file has
      no map today, and [group-fs-subdirectories-by-concern](../../../todo/group-fs-subdirectories-by-concern.md)
      reserves introducing one for the change that enumerates every
      module, since a partial map restricts what is unrestricted now.
- [ ] `fjs/rtti/common`: import `arrayIndex`; `readIndices` and the
      undeclared scans read `null` for absence.
- [ ] `fjs/fsc/ast`: import `arrayIndex`; `literalAt` unchanged but for the
      import; its `isInteger` binding goes if nothing else uses it.
- [ ] `tsc`, `fjs test`; both modules' proofs pass unchanged.

### Related

- [`../../identifier/todo/lexical-predicates-from-text-ascii.md`](../../identifier/todo/lexical-predicates-from-text-ascii.md) —
  the sibling plan that gives `fjs/js/` the identifier and integer rules;
  the array-index rule is the same kind of fact and belongs next to them.
- [`../../keywords/module.f.mjs`](../../keywords/module.f.mjs) — the
  existing `fjs/js/` owner whose module doc states the one-source rule.
- [`../../../../nanvm-lib/src/vm/member_access.rs`](../../../../nanvm-lib/src/vm/member_access.rs) —
  `canonical_index` admits `u32::MAX`, which the language does not; worth
  a `nanvm-lib/todo/` of its own if the VM's `Array`/`String::member_access`
  is meant to match `[[DefineOwnProperty]]` on that key.
