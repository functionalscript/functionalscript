## resolve-file-helper. Extract the single-segment file resolver

**Priority:** P3
**Status:** open

### Problem

Four operation handlers in `fs/effects/node/virtual/module.f.ts` open-code
the identical preamble "this is a 1-segment path resolving to a chunk-list
file, otherwise produce the right `IoResult` error":

- `readFile` — `:105-110`
- `readBytesOp` — `:249-253, 259`
- `writeBytesOp` — `:299-303, 305` (tuple-wrapped in `[dir, …]`)
- `statOp` — `:313-317`

```ts
if (path.length !== 1) { return enoent }
const file = dir[path[0]]
if (typeof file === 'function') { throw new Error(`'${path[0]}' is a JsModule; readFile not supported`) }
if (file === undefined) { return enoent }
if (!Array.isArray(file)) { return error(`'${path[0]}' is not a file`) }
const chunks = file as readonly Vec[]
```

Each site repeats the path-length guard, the enoent-vs-JsModule-throw-vs-
not-a-file error selection, and an `as readonly Vec[]` cast (AGENTS.md
treats `as` as a last resort; four copies of one is worse than none).
`statOp` and `writeBytesOp` omit the JsModule throw, so the copies have
already drifted slightly.

This is distinct from
[name-entity-kind-discrimination-once](./name-entity-kind-discrimination-once.md):
that issue extracts low-level *type predicates* (`isBinFile`/`isJsModule`/
`isDir`); even after it lands, each site still repeats this mid-level
guard-and-select block.

### Proposal

A private resolver next to the operation handlers, returning the chunk list
or the appropriate error:

```ts
// the file's chunks, or the right IoResult error; throws only for a JsModule
const resolveFile = (op: string) => (dir: Dir, path: readonly string[]): IoResult<readonly Vec[]> => {
    if (path.length !== 1) { return enoent }
    const file = dir[path[0]]
    if (typeof file === 'function') { throw new Error(`'${path[0]}' is a JsModule; ${op} not supported`) }
    if (file === undefined) { return enoent }
    if (!Array.isArray(file)) { return error(`'${path[0]}' is not a file`) }
    return ok(file)
}
```

`readFile`/`readBytesOp`/`statOp` destructure the result and continue on
`ok`; `writeBytesOp` additionally wraps errors in its `[dir, …]` tuple.
Decide during implementation whether `statOp`/`writeBytesOp` adopting the
JsModule throw is acceptable (it makes their behavior on a JsModule loud
instead of `'not a file'`) — if not, thread the JsModule policy as a
parameter rather than keeping four copies.

If `resolveFile` narrows via `Array.isArray`, the four `as readonly Vec[]`
casts disappear with it.

### Tasks

- [ ] Add `resolveFile`; rewrite the four handlers on top of it, settling
      the JsModule policy for `statOp`/`writeBytesOp` explicitly.
- [ ] `npx tsc`, `fjs t`; virtual-FS proofs pass unchanged (or with
      deliberate, documented JsModule-policy updates).

### Related

- [name-entity-kind-discrimination-once](./name-entity-kind-discrimination-once.md)
  — lower-level predicates; composes with this.
- [dir-spine-descend](./dir-spine-descend.md) — the leaf functions there
  would call this resolver.
