## Shared result asserts for the proofs

**Priority:** P4
**Status:** open

### Problem

The assertion helpers for the `['ok' | 'error', payload]` result convention
are copy-pasted across proof files:

- `../validate/proof.f.mjs:17-29` — `assertOk`, `assertError`,
  `assertErrorPath`.
- `../parse/proof.f.mjs:19-41` — the same three, character for character,
  plus a hand-rolled `unwrap` (`:30-33`) that duplicates `unwrap` from
  `fjs/types/result/module.f.mjs` — which the sibling
  `../validate/proof.f.mjs:14` already imports.
- `../host.proof.mjs:43-46` — `assertOk`, `assertError` a third time.
- `../../edag/proof.f.mjs:75-92` — `assertOk` a fourth time, and
  `assertNoMatch`, which is `assertErrorPath([])` plus one message check.
- `../../effects/proof.f.mjs:136-139` and
  `../../effects/node/proof.f.mjs:47-50` — a differently-shaped
  `assertOk(r, expected)` pair, byte-identical to each other.

An earlier version of this issue said the `assertOk`/`assertError` half was
moot — "`validate` was deleted and `parse` is the only schema-form reader, so
there is one proof file and nothing to share it with" — and instructed *not*
to hoist. That recorded a deletion that never landed: `fjs/rtti/validate/`
exists and is actively developed, so by the repo's own rule — hoist when a
second consumer exists — the hoist is due, with four consumers of the exact
shape and two more of a variant.

### Proposal

`fjs/asserts/module.f.mjs` already owns `assert`, `assertEq`, and
`assertStructurallySame`; add `assertOk` and `assertError` there and delete
the local copies. `assertErrorPath` needs only a structural
`{ readonly path: readonly string[] }` on the error payload, so it can live
in `fjs/asserts` too without importing rtti types; if that reads as too
rtti-specific, `../common/module.f.mjs` is the fallback owner, with
`edag`'s `assertNoMatch` rewritten over it either way. The `effects` pair's
`assertOk(r, expected)` is `assertOk` + `assertEq` and can be expressed
through the hoisted helpers or left as one shared local — decide there.

Independently of the hoist, `../parse/proof.f.mjs`'s local `unwrap` is
replaced by `unwrap` from `fjs/types/result/module.f.mjs`.

### Tasks

- [ ] Add `assertOk` / `assertError` (and `assertErrorPath`, owner per
      above) to `fjs/asserts/module.f.mjs`.
- [ ] Rewrite the six proof files through them; express `edag`'s
      `assertNoMatch` via `assertErrorPath([])`.
- [ ] Replace the local `unwrap` in `../parse/proof.f.mjs` with `unwrap`
      from `fjs/types/result/module.f.mjs`.
- [ ] `npx tsc`, `fjs t`.

### Related

- `fjs/types/result/module.f.mjs` — the `unwrap` to reuse.
- [container-read-skeleton.md](./container-read-skeleton.md) — the module
  side of the same copy: the readers themselves are duplicated, not just
  their proofs' helpers.
