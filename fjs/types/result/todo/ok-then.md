## Add `okThen`, the pure `Result` bind

**Priority:** P2
**Status:** open

### Problem

The pure `Result` short-circuit is hand-rolled at roughly ten sites.
`fjs/cas/evo/module.f.mjs:396-415` has five consecutive copies in one
function:

```js
if (parentsResult[0] === 'error') { return pure(parentsResult) }
const subjectResult = resolveSubject(input)(parentsResult[1])
if (subjectResult[0] === 'error') { return pure(subjectResult) }
...
```

plus `resolveParents` (`:283-287`), `resolveParent` (`:259-265`),
`decodeReadRevision` (`:495-505`), and
`fjs/dev/package_json/module.f.mjs:145-150`.

`fjs/types/result` exports only `ok`, `error`, `unwrap`, `invert`, `mapOk` —
the functor map but not the monad bind. `fjs/effects` already ships the
effectful twin, `okStep` (`fjs/effects/module.f.mjs:300-309`), whose JSDoc
states the case verbatim: "Collapses the hand-written
`r[0] === 'error' ? pure(r) : f(r[1])` check that recurs at every site."
The pure sibling was never written, so every pure chain re-derives it.

### Proposal

```js
/** @type {<T, E, R>(f: (value: T) => Result<R, E>) => (r: Result<T, E>) => Result<R, E>} */
export const okThen = f => r => r[0] === 'error' ? r : f(r[1])
```

next to `mapOk`. `addRevision`'s five guards become one composition, and the
`[0]`/`[1]` index accesses disappear per §6.3's destructuring rule.

### Tasks

- [ ] Add `okThen` to `fjs/types/result` with proof coverage
- [ ] Convert the `cas/evo` and `dev/package_json` sites

### Related

- [044-error-handling-pattern](../../../../todo/044-error-handling-pattern.md)
  — the `?` operator as a future language feature; this is today's library
  form
