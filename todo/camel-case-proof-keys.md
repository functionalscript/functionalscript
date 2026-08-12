## camel-case-proof-keys. 42 `proof` test keys are snake_case

**Priority:** P4
**Status:** open

### Problem

A `proof` object's keys are the test names the runner prints
(`proof.historyStep.overDo()`), and the repository writes identifiers in
camelCase everywhere else. 42 keys across 6 files are snake_case instead:

| file | count |
| --- | --- |
| `fjs/sul/id/proof.f.mjs` | 18 |
| `fjs/sul/level/hash/proof.f.mjs` | 11 |
| `fjs/sul/proof.f.mjs` | 5 |
| `fjs/types/bit_vec/proof.f.ts` | 4 |
| `fjs/types/prime_field/proof.f.mjs` | 3 |
| `fjs/fsc/proof.f.mjs` | 1 |

They are only names, so nothing is broken — but the split means a new proof
has no single convention to copy from, which is how the inconsistency keeps
reproducing. It was pointed out on
[#1374](https://github.com/functionalscript/functionalscript/pull/1374),
whose own new keys were converted there; the rest of the repository was left
alone to keep that PR to one change.

### Proposal

Rename the remaining keys to camelCase, and state the rule in `AGENTS.md`
next to the other proof-writing rules so it is checkable in review rather
than inferred from neighbours.

A key that names a language keyword or an export it exercises stays as it is
spelled — `do_` in `fjs/effects/proof.f.ts` names the `do_` export, and
`throw` is the runner's structural marker (see `AGENTS.md`), not a word to
re-case.

Purely a rename: no assertion, structure, or coverage changes. Worth doing in
one pass per directory rather than opportunistically, so the convention lands
everywhere at once.

### Tasks

- [ ] Rename the keys in the six files above.
- [ ] Add the convention to `AGENTS.md`, noting the keyword/export exception.
- [ ] `npx tsc` clean; `fjs t` passes (test names change, counts do not).

### Related

- [#1374](https://github.com/functionalscript/functionalscript/pull/1374) —
  where the convention was stated and applied to `fjs/effects`.
