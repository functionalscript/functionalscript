## One container-read skeleton for `validate` and `parse`

**Priority:** P3
**Status:** open

### Problem

`../validate/module.f.mjs` and `../parse/module.f.mjs` are the same reader
written twice. Each `validate` factory has a `parse` twin implementing the
identical protocol, differing only in what a success carries. Factory for
factory:

| `validate` | `parse` | substantive difference |
|---|---|---|
| `containerValidate` | `containerParse` | per-item wrap, `noAccumulate` vs `consEntry`, `ok(value)` vs `ok(rebuild(…))` |
| `constContainerValidate` | `constContainerParse` | item lambda (`ok(true)` vs `ok([p[1]])`), finish (`ok(value)` vs `rebuild` + `omittedStillAbsent`) |
| `restContainerValidate` | `restContainerParse` | same two |
| `restValidate`, `orValidate`, the visitor | `restParse`, `orParse`, the visitor | the recursive entry point's name |

The uniform-container factory, diffed, differs in three lines
(inside `containerValidate` vs `containerParse`);
everything around them is line for line the same. Smaller pieces are
copy-pasted outright:

- `noAccumulate` — in `../validate/module.f.mjs`,
  `../parse/module.f.mjs`, and a third copy in
  `../data/module.f.mjs` whose comment still says `` `validate` ``.
- The array kind's empty-rest length bound, twice each:
  `arrayValidate` ≡ `arrayParse`
  (identical cast-justification comment included) and
  `restTupleValidate` ≡ `restTupleParse`.

The cost is not just size. The read **order** is the load-bearing part: it is
what keeps an `or` of two arities linear instead of exponential, and what
makes the three readers agree on every acceptance question. Crucially there
are **two** orders, one per shape, and they are not interchangeable:

- the *const-container* pair settles the shape first —
  `fits` bound, absence pass, `hasUndeclaredMember` — and only then reads the
  members;
- the *rest-container* pair reads the declared members
  **first** (deciding absence inline as it goes), then computes
  `undeclaredMembers`, then applies `fits` or the `rest` check.

The difference is which error a value failing both ways reports first, so the
skeleton must be per shape, preserving each order exactly — the goal is one
copy of each order, not one order for both.

Both orders are currently pinned by the proof tables in
`../validate/proof.f.mjs` rather than by construction, so any change must land
identically in both readers, and the design commentary already shows the
drift: `constContainerParse`'s comments are stubs pointing at
`constContainerValidate`'s long rationale in `../validate/module.f.mjs`, and
`../common/module.f.mjs`'s header names `parse` and `data` as the consumers
while `../common/types.ts`'s says
"`validate`, `parse`".

Two sibling issues used to point at this duplication and now record it as
resolved — "resolved by deleting `validate`" in
[kindset-eliminator.md](./kindset-eliminator.md) and
[export-node-accessors.md](./export-node-accessors.md) — but no commit ever
deleted `fjs/rtti/validate/`, and it is actively developed. This file
re-tracks the issue; the stale parentheticals are corrected to link here.

### Proposal

Hoist one skeleton **per shape** — uniform container, const container, rest
container — into `../common/module.f.mjs`. Three skeletons, not one: each
keeps its own order verbatim, and the sharing is strictly between a
`validate` factory and its `parse` twin. Each is parameterized by the three
things that actually differ:

- `present` — what a successfully read member contributes (`ok(true)` /
  `ok([p[1]])`) together with the matching `eachEntry` seed and cons
  (`emptyPresence`/`consPresence` vs `emptyDeclared`/`consDeclared`);
- `finish` — what a fully checked container becomes (`ok(value)` vs
  `rebuild(entries)` guarded by `omittedStillAbsent`);
- the recursive entry point (`validate` vs `parse`), which the factories
  already receive implicitly through their item lambdas.

`../common/types.ts` already owns the parameter vocabulary (`Fits`,
`IsContainer`, `SchemaEntries`, `Presence`). Each reader module keeps its
visitor, its JSDoc contract, and its `finish`; each shape's protocol — its own
order included — is then stated once instead of twice. Move `noAccumulate`
into `common` as part of the same change (`noDeclared` already lives there),
and put each shape's read-order rationale on its skeleton, where both readers
inherit it.

The array length-bound builders **stay out of `common`**. They are written in
terms of `emptyRest`, which lives in `../data/module.f.mjs`, and
`../data/module.f.mjs` already imports `eachEntry`, `undeclaredMembers`
and friends from `../common/module.f.mjs` — so hoisting them would make the
shared kernel import its own consumer and close a `common` ↔ `data` runtime
cycle. They are already passed in as the `fits`/`restFits` parameter, which
is the right seam: the skeleton takes the predicate and stays ignorant of
`emptyRest`. Deduplicating the two identical builder bodies, if worth doing
at all, belongs in a module that may depend on `data`, not in `common`.

Do **not** unify the const-container and rest-container orders while doing
this: the rest readers' read-before-leftovers order is load-bearing (see
above), and collapsing the two would be a behavior change wearing a
refactor's clothes.

The data form's `arraySetValidate`/`objectSetValidate` pair repeats the same
shape over `Data` and is tracked separately in
[data-set-validate-shared.md](./data-set-validate-shared.md); sharing between
the schema-form skeleton and the data form is a possible follow-up, not part
of this issue.

### Tasks

- [ ] Extract the three per-shape skeletons (uniform, const, rest) into
      `../common/module.f.mjs`, each preserving its own order; rewrite both
      readers through them.
- [ ] Give each new `common` export its own entry in
      `../common/proof.f.mjs`. That file already imports and calls every
      export it covers (`eachEntry`, `structSchemaEntries`,
      `tupleSchemaEntries`, `undeclaredMembers`), and
      `fjs/AGENTS.md` §1.2 asks the same of a new one: the three skeletons
      and the hoisted `noAccumulate` are newly published callables, so being
      exercised only through `validate` and `parse` would leave the exported
      names themselves uncalled.
- [ ] Add a proof row pinning the rest readers' order: a declared member
      whose getter installs a leftover the `rest` rejects must still be
      rejected. It passes today and would fail under a leftovers-first
      skeleton, so it is the regression test for this refactor.
- [ ] Move `noAccumulate` into `common`; delete its three copies. Leave the
      `emptyRest`-based length bounds in the readers, passed in as
      `fits`/`restFits` — `common` must not import `data`.
- [ ] Consolidate the read-order commentary on the shared skeleton; fix
      `../common/types.ts`'s header vs `../common/module.f.mjs`'s to name the same
      consumer set.
- [ ] `tsc`, `fjs t`; the acceptance tables in `../validate/proof.f.mjs`
      pass unchanged.

### Related

- [kindset-eliminator.md](./kindset-eliminator.md),
  [export-node-accessors.md](./export-node-accessors.md) — their closing
  parentheticals mis-recorded this issue as resolved; corrected to link here.
- [data-set-validate-shared.md](./data-set-validate-shared.md) — the same
  duplication theme inside the data form.
- [proof-shared-asserts.md](./proof-shared-asserts.md) — the proof-side
  counterpart: the readers' proofs also copy their helpers.
