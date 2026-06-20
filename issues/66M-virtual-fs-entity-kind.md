# 66M-virtual-fs-entity-kind. Name the `Entity` three-way discrimination once in the virtual FS

**Priority:** P3
**Status:** open

## Problem

`fs/effects/node/virtual/module.f.ts` models every filesystem node as a single
union:

```ts
// fs/effects/node/virtual/module.f.ts:23-29
export type JsModule = () => Module
export type Entity = readonly Vec[] | Dir | JsModule
export type Dir = {
    readonly[name in string]?: Entity
}
```

so an `Entity` is exactly one of three kinds:

| kind       | representation     | structural test            |
|------------|--------------------|----------------------------|
| file       | `readonly Vec[]`   | `e instanceof Array`       |
| JS module  | `() => Module`     | `typeof e === 'function'`  |
| directory  | `Dir` (object)     | object, not array, not fn  |

That contract — *which structural shape means which kind* — is a single concept,
but it is **re-derived inline at twelve call sites**, in at least four different
spellings, instead of living in one place next to the type. Today the
discrimination is copy-pasted ad hoc:

```ts
// :69   operation — "subDir is NOT a directory"
if (typeof subDir !== 'object' || Array.isArray(subDir)) { return op(dir, path) }

// :107  readFile — isJsModule
if (typeof file === 'function') { throw new Error(`'${path[0]}' is a JsModule; readFile not supported`) }
// :109  readFile — not a file
if (!Array.isArray(file)) { return error(`'${path[0]}' is not a file`) }

// :127  import_ — not a JsModule
if (typeof entry !== 'function') { return error(`'${path[0]}' is not a JsModule`) }

// :137  writeFile — exists and not a file
if (file !== undefined && !Array.isArray(file)) { return [dir, writeFileError] }

// :152  readdir — isFile (treats a JsModule as a "file")
const isFile = Array.isArray(content) || typeof content !== 'object'

// :174  rm — isDir
if (!Array.isArray(entry) && typeof entry === 'object') { return [dir, error('is a directory')] }

// :190  extractEntity — undefined or not a directory
if (sub === undefined || Array.isArray(sub) || typeof sub === 'function') { return [dir, enoent] }

// :202-203  insertEntityAt — isDir, twice
const entityIsDir   = !Array.isArray(entity)   && typeof entity   === 'object'
const existingIsDir = !Array.isArray(existing) && typeof existing === 'object'

// :223  insertEntityAt — not a directory
if (Array.isArray(sub) || typeof sub === 'function') { return [dir, error('not a directory')] }

// :251  readBytesOp — isJsModule
if (typeof file === 'function') { throw new Error(`'${p[0]}' is a JsModule; readBytes not supported`) }
// :253  readBytesOp — not a file
if (!Array.isArray(file)) { return error(`'${p[0]}' is not a file`) }
```

"Is a directory" alone appears as **four non-identical expressions**:

- `typeof x === 'object' && !Array.isArray(x)` (`:174`, `:202`, `:203`)
- its De Morgan negation `typeof x !== 'object' || Array.isArray(x)` (`:69`)
- `Array.isArray(x) || typeof x === 'function'` (`:223`, as "not a dir")
- `sub === undefined || Array.isArray(sub) || typeof sub === 'function'` (`:190`)

These happen to agree — a `JsModule` is `typeof 'function'`, so every form
correctly excludes it from "directory" — but the reader has to *prove* that
agreement four times. Each form is a separate place a future edit can drift out
of sync (e.g. adding a fourth `Entity` kind would silently misclassify under
some spellings but not others). This is exactly the separation-of-concerns case
`AGENTS.md` calls out: the structural contract of a union belongs with the
union, not scattered across every consumer, and "when two code branches share
most of their structure, refactor so the shared part appears once."

The DRY trigger is met many times over: there are far more than two real
consumers of each kind-test, and they are not trivial one-liners — each combines
a `typeof` with an `Array.isArray` (and sometimes an `undefined` check).

## Proposal

Define the three kind-tests **once**, right after the `Entity` / `Dir` /
`JsModule` declarations, and have every site call them. No type predicates
(`x is U`) — per `AGENTS.md` those are error-prone — just plain booleans that
name the structural intent:

```ts
const isJsModule = (e: Entity): boolean => typeof e === 'function'
const isFile     = (e: Entity): boolean => e instanceof Array
const isDir      = (e: Entity): boolean => typeof e === 'object' && !(e instanceof Array)
```

Then the call sites read as intent rather than as bit-twiddling:

```ts
// :69
if (!isDir(subDir)) { return op(dir, path) }
// :107 / :251
if (isJsModule(file)) { throw ... }
// :109 / :253
if (!isFile(file)) { return error(...) }
// :174
if (isDir(entry)) { return [dir, error('is a directory')] }
// :202-203
const entityIsDir   = isDir(entity)
const existingIsDir = isDir(existing)
// :190
if (sub === undefined || !isDir(sub)) { return [dir, enoent] }
// :223
if (!isDir(sub)) { return [dir, error('not a directory')] }
```

Now "what shape is a directory" is stated in exactly one line; the eleven
remaining sites cannot drift apart, and a future fourth `Entity` kind is a
one-place change.

### Caveat: narrowing and the existing `as` casts

The current code already pairs these inline checks with `as` casts to recover the
narrowed type — `subDir as Dir` (`:72`), `file as readonly Vec[]` (`:110`),
`content as Dir` (`:155`), `sub as Dir` (`:191`, `:224`), `existing as Dir`
(`:211`), `file as readonly Vec[]` (`:259`). `AGENTS.md` treats `as` like Rust's
`unsafe`, so these casts are themselves a smell, and a boolean helper does not
remove them (a function-boundary boolean does not narrow its argument). Two
honest options:

1. **Minimal (this issue):** introduce the three helpers for the *boolean
   decision* and keep `instanceof Array` / `typeof === 'function'` inline only at
   the few spots that immediately need the narrowed value, so the casts are no
   worse than today while the scattered, inconsistent dir-tests collapse to one
   definition. This is a pure readability/consistency win with zero behaviour
   change.
2. **Fuller (follow-up):** restructure the descent helpers so the kind is
   discovered once and the narrowed `Dir` / `Vec[]` is threaded through, removing
   the `as Dir` / `as readonly Vec[]` casts entirely. This is a larger change and
   should be its own issue if pursued.

Recommend landing (1) first — it is small, safe, and removes the four-way
inconsistency that is the real hazard.

## Tasks

- [ ] Add `isJsModule` / `isFile` / `isDir` next to the `Entity` type in
      `fs/effects/node/virtual/module.f.ts`.
- [ ] Replace the twelve inline kind-tests listed above with calls to them,
      preserving each site's exact boolean.
- [ ] Run `npx tsc` and `fjs t`; confirm `fs/effects/node/virtual/proof.f.ts`
      still passes with full line/branch coverage (behaviour is unchanged).

## Related

- A sibling cleanup in the same file: the `result[0] === 'error'` short-circuit
  is hand-written four times (`:192`, `:225`, `:237`, `:244`) to thread an
  `IoResult` error back up the recursion. That is a `Result`-propagation concern
  rather than an `Entity`-kind one; worth a small `propagateError` helper but
  out of scope here.
