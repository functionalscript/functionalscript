# The readers' verdict path dispatches overridable operations after a read

**Priority:** P2
**Status:** open

## Problem

Reading a member of a hostile value can run **arbitrary code** — an accessor
— and everything a reader does after that read trusts whatever the accessor
left behind. `parse`'s *rebuilds* no longer dispatch anything overridable
(see `defineProperty` in [`../parse/module.f.mjs`](../parse/module.f.mjs)
and `hostileIntrinsicPatchesDoNotReachTheRebuild` in
[`../host.proof.mjs`](../host.proof.mjs)), but the **verdict** path still
does, in [`../common/module.f.mjs`](../common/module.f.mjs) and its callers:

- `undeclaredMembers`/`readIndices` build their member list with
  `Object.entries`, `.filter`, `.map`, `.flatMap`, `.toSorted`, `.indexOf`
  and array spreads — for the const kinds this runs *after* the declared
  members were read, so a patching accessor steers which members the closed
  check or a `rest` sees. The tuple length bound catches the simplest
  variant, but a `rest` kind can be steered into accepting a value whose
  undeclared members were never held to the rest.
- `visit` and `absenceIn` destructure the schema thunk's descriptor
  (`const [tag, ...operands] = rtti()`), which dispatches
  `Array.prototype[Symbol.iterator]` — patched, the accessor chooses the
  tag, and with it the verdict. `absenceIn` also relies on `.some` and an
  array spread; `orVisit` iterates its variants with `for..of`.
- `prependPath` spreads `r.path`, so a patched iterator can throw from the
  error path, escaping the `Result` API.
- Globals resolved at call time — `Number`, `String`, `Object`, `Array` —
  are reassignable through `globalThis` by the same accessor
  (`arrayIndex`, `getItem`, `Object.entries` call sites).

A wrong *accept* here is a plausible wrong value; the boundary is that the
accessor has already run arbitrary code in the host, so this hardening is
about the readers' own answers staying theirs, not about containing the
host.

## Tasks

- [ ] Extend the discipline the rebuilds and `eachEntry` state to the
      post-read functions of `common/module.f.mjs`: capture the intrinsics
      used (`Object.entries`, `Object.getOwnPropertyNames`,
      `Object.getPrototypeOf`, `Object.hasOwn`, `Number.isInteger`, the
      `Array`/`Number`/`String` bindings) at module load, and replace
      `for..of`, destructuring, spreads and array methods on those paths
      with index walks and cons/`defineProperty` construction.
- [ ] `readIndices`' sort for inherited indices needs a captured or
      hand-rolled ordering; the dedup's shape is pinned by its JSDoc.
- [ ] Keep behavior bit-identical for non-patching values: the three-reader
      tables and `../host.proof.mjs` pin member order and the
      non-index/beyond-`length` rules.
- [ ] Pin each closed hole in `../host.proof.mjs` the way the rebuild fix
      is pinned, restoring every patched intrinsic before asserting.
