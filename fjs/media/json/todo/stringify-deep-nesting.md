## `stringify` overflows the stack on deeply nested values

**Priority:** P2
**Status:** open

### Problem

`parse` was made stack-safe for deep documents in
[#1435](https://github.com/functionalscript/functionalscript/pull/1435).
`stringify` was not, so the two directions disagree about what this module can
handle: a value nested about **800** levels deep throws
`RangeError: Maximum call stack size exceeded`, while `parse` reads a document
nested 100000 deep without trouble.

```ts
const toJson = stringify(identity)
const nest = (n) => { let s = '8'; for (let i = 0; i < n; ++i) { s = { B: s } }; return s }
toJson(nest(800))   // ok
toJson(nest(850))   // RangeError
```

`objectSerialize`/`arraySerialize` recurse per level, so depth costs stack.

It is reachable from untrusted input. `fjs/cas/evo`'s `addRevision` serializes
the revision it is about to store with `stringify`, and a revision's `lock` map
([`fjs/media/revision`](../../revision/README.md)) is caller-supplied and
nestable to any depth — validation accepts it, serialization then throws.
FunctionalScript has no `try`/`catch`, so an MCP `evo_add` handler cannot turn
that into an error response.

The asymmetry is the sharper part of the bug: a lock map this module can *read*
is one it cannot *write back*, so a value that round-trips through `parse` does
not necessarily round-trip through `stringify`.

### Proposal

Make serialization iterative, the same transformation `parse` took: drive an
explicit work list instead of recursing per container, emitting tokens as
levels are entered and left.

Then add `tryStringify` returning `Nullable<string>` so callers branch on a
value instead of a throw — the convention this repo already uses for fallible
encoding (`tryUtf8`, `tryListToVec`; see AGENTS §5.6). `addRevision` already
pairs `toJson` with `tryUtf8` and handles the `null`; it would handle this the
same way.

### Tasks

- [ ] Convert `objectSerialize`/`arraySerialize` to an explicit work list.
- [ ] Prove a value nested ≥ 20000 deep serializes, and that it round-trips
      through `parse`.
- [ ] Add `tryStringify` and use it at `fjs/cas/evo`'s write boundary.

### Related

- [#1435](https://github.com/functionalscript/functionalscript/pull/1435) — the
  same fix on the parsing side; the pattern to follow
- [fjs/cas/evo/module.f.ts](../../../cas/evo/module.f.ts) — `addRevision`, the
  reachable caller
- [fjs/types/rtti recursive-validation-stack-safety](../../../types/rtti/todo/recursive-validation-stack-safety.md)
  — the mirror-image limit on the way in
