## none-quantifier. `isEmpty`/`every`/`includes` are unnamed instances of two combinators

**Priority:** P4
**Status:** open

### Problem

`module.f.mjs:181-198`:

```js
export const some = find(false)(identity)

export const isEmpty = fn(map(() => true))
    .map(some)
    .map(logicalNot)
    .result

export const every = fn(map(logicalNot))
    .map(some)
    .map(logicalNot)
    .result

export const includes = value =>
    compose(map(strictEqual(value)))(some)
```

`isEmpty` and `every` are character-identical apart from the predicate
handed to `map`; `includes` is the un-negated half of the same shape
(`map(p)` then `some`); the `.map(some).map(logicalNot)` suffix appears
twice verbatim. The shared concept — "some/no element satisfies `p`" —
has no name, so each site reads as four lines of plumbing to re-derive.

### Proposal

Name the two quantifiers beside `some`:

```js
export const someBy = p => compose(map(p))(some)
export const none = p => fn(someBy(p)).map(logicalNot).result
```

Then `includes = value => someBy(strictEqual(value))`,
`isEmpty = none(() => true)`, and `every = none(logicalNot)` — each one
line naming its quantifier, with the plumbing and its negation each
written once. `someBy`/`none` are plausible exports in their own right: a
list module without "any element satisfying `p`" is an odd gap, so this
is a net API addition rather than only a tidy-up.

### Tasks

- [ ] Add `someBy`/`none` with proofs; re-express the three exports.
- [ ] `tsc`, `fjs test`.

### Related

- [simplify-list-type.md](./simplify-list-type.md) — touches the `List`
  type, not these combinators; independent.
