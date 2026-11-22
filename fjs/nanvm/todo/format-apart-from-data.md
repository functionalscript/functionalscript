## The corpus format apart from the corpus data

**Priority:** P3
**Status:** open

### Problem

[`module.f.js`](../module.f.js) is three things in one file — about
seventeen hundred lines and 91 KB at `e4cd5b3e`:

1. **The format**: the constructors, the
   eliminators — `isThrows`, `hasUnreached`, `orders`, `groupKey`,
   `casesOf`, `arityOf` — and the lowering — `lambdaExp`, `functionExp`,
   `callbackExp`, `valueExp`, `sharedExp`, `caseExp` and their kin.
2. **The operator cases**, the bulk of the file: `numberCoercionCases` to
   `strictEqualityCases`, as data.
3. **`data`**, which joins the operator groups with
   [`member`](../member/module.f.js)'s.

The mix has already cost two workarounds.

[`constructors`](../constructors/module.f.js) exists to break a cycle:
its header says the constructors "live here, apart from the data, so
that the case modules can use them without importing the module that
imports those cases". `module.f.js` then imports them under
aliases and exports each again by hand:

```js
export const callback = constructorsCallback
export const functionValue = constructorsFunctionValue
…
```

[`rust`](../rust/module.f.js) takes `data` as a parameter of `generate`
and imports only format functions — `caseExp`, `casesOf`, `groupKey`,
`isThrows`, `orders`, `sharedExp`, `valueExp` — yet loads every operator
case to get them.

And `member` was split out, by its own header, "only so that no one
source file outgrows what the repository's file reader accepts". The
operator half is most of the way to that limit and grows with every case.

### Proposal

- `fjs/nanvm/format` holds the constructors, the eliminators and the
  lowering, and `constructors` folds into it: the cycle goes because the
  format no longer imports the data.
- `fjs/nanvm/operator` exports the operator groups and `shared`, as
  `member` exports its groups.
- `module.f.js` is `export const data = { shared, groups: [...operatorGroups, ...memberGroups] }`.

The printer, the updater and the proofs of the format then depend on the
format; only what walks the corpus depends on the corpus.

### Drawbacks

- Import paths change for `rust`, `update`, `member` and the proof, and
  the [README](../README.md)'s "Files" table and its first step, which
  calls `module.f.js` "the single source of truth", are rewritten. One
  source of truth for the *cases* survives the split; whether one *file*
  was the point is the owner's call.
- Each new module needs its own proof at full coverage, so the existing
  proof is partitioned rather than moved.

### Related

- [the generated header](./generated-header.md)
