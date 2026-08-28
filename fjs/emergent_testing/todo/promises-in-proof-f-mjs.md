## Remove the `Promise` construction from `proof.f.mjs`

**Priority:** P3
**Status:** open

### Problem

FunctionalScript has no `Promise`, and [`../proof.f.mjs`](../proof.f.mjs)
constructs two:

- line 356, `registerNoopCtx` — a stand-in `TestContext` whose `test` answers
  `Promise.resolve()`;
- line 430 — a fixture proof `{ a: () => Promise.resolve(undefined) }`, checking
  that a leaf returning a promise is awaited.

Both are fixtures for behaviour the *runner* has, not FunctionalScript the
language, and the file they live in is authored `.f.mjs` — which the browser
suite selects, since selection is by suffix and a named `proof` export. So the
repository's own proof file breaks the rule the runners rely on, and is loaded
into a browser while doing it.

This is the only such file. The other `.f.mjs` matches for "Promise" are the
identifier `awaitIfPromise`, the effect constructor `awaitPromise`, and the word
inside a JSDoc comment — none of them the global.

### Preliminary design

Both fixtures exist to test *impure* behaviour, so the straightforward move is
into an impure `.mjs` proof beside the existing ones. Two things to decide while
doing it:

- **What covers the awaited-leaf path afterwards.** Deleting the fixture without
  replacing it drops coverage of a real runner behaviour, which is worse than
  the violation. The replacement is what makes this change safe, not the
  deletion.
- **Whether the effect layer already offers a promise-free way to express it.**
  `awaitIfPromise` takes a value and answers an effect; a virtual interpreter
  can supply the settled result without a `Promise` existing anywhere in the
  proof. If that works, the fixture stays pure and nothing moves.

### Constraints

- Do not weaken the rule to accommodate the file. A `.f.mjs` that constructs a
  `Promise` is a defect; this issue removes it.
- Coverage does not drop: the runner behaviour these fixtures pin has to stay
  pinned.

### Related

- [Imports, promises and realms](imports-promises-realms.md) — what the runners
  do and do not handle, and why the rule matters.
- [The framework's scope](../README.md#scope).
