## "Which names repeat" is computed three ways

**Priority:** P4
**Status:** open

### Problem

Three modules ask which members of a list of names occur more than once,
and each answers for itself:

- `twiceNamed` in [`fjs/git/refstore`](../../../git/refstore/module.f.mjs)
  builds a map of last positions and finds the first name that is not the
  last of its kind — one pass, with a doc explaining why a quadratic answer
  is not acceptable over a busy `refs/heads`.
- `twiceNamed` in
  [`fjs/media/datajs/vectors/matrix`](../../../media/datajs/vectors/matrix/module.f.mjs)
  compares `indexOf` against `lastIndexOf` for every element — quadratic,
  and reporting at the last occurrence, as its doc says.
- `checkPattern` in [`fjs/media/nix`](../../../media/nix/module.f.mjs)
  tests `names.indexOf(name) !== index` per element — quadratic.

[`fjs/types/array`](../module.f.mjs)'s own `dedup` is the fourth spelling of
the same scan, `a.slice(0, i).every(x => x !== v)` per element, also
quadratic. The one linear answer sits in a Git module nobody else imports
for it.

### Proposal

`fjs/types/array` exports `repeated` — the names a list holds more than
once, each once, in one pass over a map of last positions as `refstore`
does it. The three callers map their messages over the result; `dedup`
shares the pass.

### Tasks

- [ ] `repeated` with a proof at 100%; `dedup` over the same scan.
- [ ] Move the three callers onto it, keeping each one's message.
- [ ] `tsc`, `fjs test`, `npm run cov` at 100%.
