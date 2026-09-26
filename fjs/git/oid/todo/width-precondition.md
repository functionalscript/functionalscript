## width-precondition. "The id must be this repository's width" is asserted five times, in two wordings

**Priority:** P4
**Status:** open

### Problem

`isOidOf` centralised the predicate — every holder of a width binds
`const isOid = isOidOf(oidBytes)` — but not the contract built on it.
Each reader restates the assertion and its `@throws` paragraph:

```js
// fjs/git/store, readIn and tryRead; fjs/git/packstore, tryRead; fjs/git/walk, peel
assert(isOid(id), ['not an id of the width', id])
// fjs/git/packidx, offsetOf
assert(isOid(id), ['not an id of the index width', id])
```

The message has already drifted, and the five doc paragraphs saying
that a caller mixing widths has a bug are five copies of one sentence.

### Proposal

`fjs/git/oid` exports the precondition beside the predicate:

```ts
/**
 * `f` on an id of this width.
 * @throws On an id that is not `oidBytes` wide: a caller that mixes the widths has a bug.
 */
export const ofWidth: (oidBytes: OidBytes) => <R>(f: (id: Oid) => R) => (id: Oid) => R
```

Each reader wraps its `id => …` once, the message is spelled once, and
the `@throws` paragraph lives on the export.

### Tasks

- [ ] `ofWidth` with a proof of both outcomes.
- [ ] The five readers through it; their `@throws` paragraphs point at it.
- [ ] `tsc`, `fjs test`.

### Related

- [../../todo/header-field-accessors.md](../../todo/header-field-accessors.md)
  — the same move for the positional accessors: a skeleton where each
  site had a copy.
