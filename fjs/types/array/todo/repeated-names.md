## Consumers find repeated names differently

**Priority:** P4
**Status:** open

### Problem

Several modules ask which members of a list of names occur more than once,
and each answers for itself:

- `twiceNamed` in [`fjs/git/refstore`](../../../git/refstore/module.f.mjs)
  builds a map of last positions and finds the first name that is not the
  last of its kind — linear work, with a doc explaining why a quadratic answer
  is not acceptable over a busy `refs/heads`.
- `twiceNamed` in
  [`fjs/media/datajs/vectors/matrix`](../../../media/datajs/vectors/matrix/module.f.mjs)
  compares `indexOf` against `lastIndexOf` for every element — quadratic,
  and reporting at the last occurrence, as its doc says.
- `checkPattern` in [`fjs/media/nix`](../../../media/nix/module.f.mjs)
  tests `names.indexOf(name) !== index` per element — quadratic, and stops
  at the first identifier or duplicate-name error in input order.

The one linear answer sits in a Git module nobody else imports for it.
[`fjs/types/array`](../module.f.mjs)'s `dedup` is related but generic: it
compares with `===` and keeps every `NaN`, so `dedup([NaN, NaN])` keeps both
entries. A `Map` uses SameValueZero and would combine them; leave `dedup`
unchanged in this task.

### Proposal

`fjs/types/array` exports shared string-name occurrence analysis, exposing
each name's first and last positions in linear work. Callers retain their
own selection and order rather than mapping over one ordered list:

- `refstore` selects the first occurrence of a name that repeats.
- The matrix reports each repeated name once, at its last occurrence.
- Nix reports the first repeated occurrence, keeping identifier validation
  ahead of the duplicate check at each position and stopping at the first
  error.

For `['a', 'b', 'b', 'a']`, `refstore` reports `a`, the matrix reports `b`
then `a`, and Nix reports duplicate `b`. For `['a', 'a', 'not valid']`,
Nix reports duplicate `a` before reaching the invalid identifier. The
shared analysis must preserve these results and each caller's messages.

### Tasks

- [ ] Shared name-occurrence analysis with a proof at 100%.
- [ ] Move the listed callers onto it, preserving selection, ordering,
      validation precedence and messages; pin the examples above in proofs.
- [ ] `tsc`, `fjs test`, `npm run cov` at 100%.
