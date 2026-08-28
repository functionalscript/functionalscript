## Use `result`'s `unwrap` in the parse proof

**Priority:** P5
**Status:** open

### Problem

`fjs/rtti/parse/proof.f.mjs:28` hand-rolls an `unwrap` that duplicates
`unwrap` from `fjs/types/result/module.f.mjs:53` — assert `'ok'`, return the
payload.

### History

This issue used to be about sharing `assertOk` / `assertError` /
`assertErrorPath` and roughly 80% of the proof tree between
`fjs/rtti/validate/proof.f.mjs` and `fjs/rtti/parse/proof.f.mjs`,
which were copy-pasted modulo the checker name. That duplication is gone:
`validate` was deleted and `parse` is the only schema-form reader, so there is
one proof file and nothing to share it with.

`assertDeepEqual` was already resolved in favour of `structurallySame` /
`assertStructurallySame`.

What is left is the one duplication that was never about the two-proof split.

Do **not** hoist `assertOk` / `assertError` to `fjs/asserts/module.f.mjs` on
the strength of the old proposal — with one consumer there is nothing to
share, and the repo's rule is to hoist when a second consumer exists.

### Tasks

- [ ] Replace the local `unwrap` in `parse/proof.f.mjs` with `unwrap` from
      `fjs/types/result/module.f.mjs`.
- [ ] `npx tsc`, `fjs t`.

### Related

- `fjs/types/result/module.f.mjs` — the `unwrap` to reuse.
