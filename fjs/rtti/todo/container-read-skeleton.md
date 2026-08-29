## One container-read skeleton for `validate` and `parse`

**Priority:** P3
**Status:** open

### Problem

`../validate/module.f.mjs` and `../parse/module.f.mjs` are the same reader
written twice. Both implement the identical container protocol — the
`isContainer` gate, the `fits` bound, the absence pass, the
`hasUndeclaredMember` check, the member read, the `presenceUnchanged` re-ask —
and differ only in what a success carries. Factory for factory:

| `validate` | `parse` | substantive difference |
|---|---|---|
| `containerValidate` (`../validate/module.f.mjs:131`) | `containerParse` (`../parse/module.f.mjs:261`) | per-item wrap, `noAccumulate` vs `consEntry`, `ok(value)` vs `ok(rebuild(…))` |
| `constContainerValidate` (`:200`) | `constContainerParse` (`:325`) | item lambda (`ok(true)` vs `ok([p[1]])`), finish (`ok(value)` vs `rebuild` + `omittedStillAbsent`) |
| `restContainerValidate` (`:328`) | `restContainerParse` (`:420`) | same two |
| `restValidate` (`:393`), `orValidate` (`:398`), the visitor (`:407`) | `restParse` (`:491`), `orParse` (`:497`), the visitor (`:536`) | the recursive entry point's name |

The uniform-container factory, diffed, differs in three lines
(`../validate/module.f.mjs:153-159` vs `../parse/module.f.mjs:284-286`);
everything around them is line for line the same. Smaller pieces are
copy-pasted outright:

- `noAccumulate` — `../validate/module.f.mjs:108`,
  `../parse/module.f.mjs:302`, and a third copy in
  `../data/module.f.mjs:1172` whose comment still says `` `validate` ``.
- `noDeclared` — `../validate/module.f.mjs:112`, `../parse/module.f.mjs:220`,
  identical doc comment included.
- The array kind's empty-rest length bound, twice each:
  `../validate/module.f.mjs:167-168` ≡ `../parse/module.f.mjs:295-296`
  (identical cast-justification comment included) and
  `../validate/module.f.mjs:382` ≡ `../parse/module.f.mjs:480`.

The cost is not just size. The read **order** — bound, absence, undeclared,
reads, re-ask — is the load-bearing part: it is what keeps an `or` of two
arities linear instead of exponential, and what makes the three readers agree
on every acceptance question. That order is currently pinned by proof tables
(`../host.proof.mjs`, `../validate/proof.f.mjs`) rather than by construction,
so any change must land identically in two files, and the design commentary
already shows the drift: `../parse/module.f.mjs:347-358` is a stub pointing at
`../validate/module.f.mjs`'s 50-line rationale, `../common/module.f.mjs:5-8`
names `parse` and `data` as the consumers while `../common/types.ts:2` says
"`validate`, `parse`".

Two sibling issues used to point at this duplication and now record it as
resolved — "resolved by deleting `validate`" in
[kindset-eliminator.md](./kindset-eliminator.md) and
[export-node-accessors.md](./export-node-accessors.md) — but no commit ever
deleted `fjs/rtti/validate/`, and it is actively developed. This file
re-tracks the issue; the stale parentheticals are corrected to link here.

### Proposal

Hoist one skeleton per kind into `../common/module.f.mjs`, parameterized by
the three things that actually differ:

- `present` — what a successfully read member contributes (`ok(true)` /
  `ok([p[1]])`) together with the matching `eachEntry` seed and cons
  (`emptyPresence`/`consPresence` vs `emptyDeclared`/`consDeclared`);
- `finish` — what a fully checked container becomes (`ok(value)` vs
  `rebuild(entries)` guarded by `omittedStillAbsent`);
- the recursive entry point (`validate` vs `parse`), which the factories
  already receive implicitly through their item lambdas.

`../common/types.ts` already owns the parameter vocabulary (`Fits`,
`IsContainer`, `SchemaEntries`, `Presence`). Each reader module keeps its
visitor, its JSDoc contract, and its `finish`; the protocol — order included —
is stated once. Move `noAccumulate`, `noDeclared`, and the two array
length-bound builders into `common` as part of the same change, and keep the
one full copy of the read-order rationale on the shared skeleton, where both
readers inherit it.

The data form's `arraySetValidate`/`objectSetValidate` pair repeats the same
shape over `Data` and is tracked separately in
[data-set-validate-shared.md](./data-set-validate-shared.md); sharing between
the schema-form skeleton and the data form is a possible follow-up, not part
of this issue.

### Tasks

- [ ] Extract the shared container/const-container/rest-container skeletons
      into `../common/module.f.mjs`; rewrite both readers through them.
- [ ] Move `noAccumulate`, `noDeclared`, and the array empty-rest length
      bounds into `common`; delete the five copies.
- [ ] Consolidate the read-order commentary on the shared skeleton; fix
      `../common/types.ts:2` vs `../common/module.f.mjs:5-8` to name the same
      consumer set.
- [ ] `npx tsc`, `fjs t`; the acceptance tables in `../validate/proof.f.mjs`
      and `../host.proof.mjs` pass unchanged.

### Related

- [kindset-eliminator.md](./kindset-eliminator.md),
  [export-node-accessors.md](./export-node-accessors.md) — their closing
  parentheticals mis-recorded this issue as resolved; corrected to link here.
- [data-set-validate-shared.md](./data-set-validate-shared.md) — the same
  duplication theme inside the data form.
- [proof-shared-asserts.md](./proof-shared-asserts.md) — the proof-side
  counterpart: the readers' proofs also copy their helpers.
