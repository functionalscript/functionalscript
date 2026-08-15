# `mockRun`'s operation map needs `Parameters<typeof mockRun<…>>` to type-check

**Priority:** P4
**Status:** open

### Problem

Two proofs in `fjs/emergent_testing/proof.f.mjs` build an operation map for
`mockRun` and cast it to the parameter type, spelled through the function's own
type:

- line 333 — `/** @type {Parameters<typeof mockRun<_RegisterMockOps, _RegisterMockState>>[0]} */`
- line 434 — `/** @type {Parameters<typeof mockRun<_RegisterMockOps | Readdir | Import, undefined>>[0]} */`

Reaching for `Parameters<typeof f<A, B>>[0]` to name an argument type is a sign
the call cannot infer it: the map is an object literal whose handlers should be
contextually typed by `mockRun`'s parameter, and instead the literal is typed
first and then forced.

As with any cast around a value handed to a generic parameter, the enclosing
cast strips the context the callee relies on, so a drifted handler shape is
absorbed rather than reported — the failure mode
[`fjs/AGENTS.md`](../../AGENTS.md) describes for `ToAsyncOperationMap<O>`.

### Proposal

Find why `mockRun`'s type arguments are not inferred from the map, and let the
literal be checked at the call site. If explicit type arguments are genuinely
needed, a named helper with the two parameters bound would express that better
than `Parameters<typeof …>` at each site.

### Related

- [`todo/inline-type-casts.md`](../../../todo/inline-type-casts.md)
