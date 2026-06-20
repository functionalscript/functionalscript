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

Name the discrimination **once**, but as something that *narrows* rather than a
`boolean`. A boolean helper would force the union's kind to be re-discovered (or
re-asserted with `as`) at every consumer; the current code already does the
latter, pairing each inline check with a cast — `subDir as Dir` (`:72`),
`file as readonly Vec[]` (`:110`), `content as Dir` (`:155`), `sub as Dir`
(`:191`, `:224`), `existing as Dir` (`:211`), `file as readonly Vec[]` (`:259`).
`AGENTS.md` treats `as` like Rust's `unsafe`, so those casts are the thing to
remove.

Define three predicate helpers next to the `Entity` declarations, where each
predicate's body **is** exactly the narrowing condition it asserts:

```ts
const isFile     = (e: Entity): e is readonly Vec[] => e instanceof Array
const isJsModule = (e: Entity): e is JsModule       => typeof e === 'function'
const isDir      = (e: Entity): e is Dir            => typeof e === 'object' && !(e instanceof Array)
```

`AGENTS.md` discourages type predicates because the compiler trusts the `is`
annotation unconditionally, so a predicate whose runtime check *diverges* from the
declared type fails silently. That hazard does not apply here: `e instanceof
Array` is the canonical narrowing for `readonly Vec[]`, `typeof e === 'function'`
for `JsModule`, and their negation for `Dir` — the check and the asserted type are
the same statement. A predicate that matches its implementation is exactly the
case the guidance can admit, so these narrow safely without any `as`.

Consumers then collapse to a single guard that *also* narrows the value:

```ts
// :67-72  operation — descend only into directories
const sub = dir[first]
if (sub === undefined || !isDir(sub)) { return op(dir, path) }
const [newSubDir, r] = f(sub, rest)   // sub is Dir here — no `as Dir`

// :104-109  readFile
const file = dir[path[0]]
if (file === undefined) { return enoent }
if (isJsModule(file)) { throw new Error(`'${path[0]}' is a JsModule; readFile not supported`) }
if (!isFile(file)) { return error(`'${path[0]}' is not a file`) }
// file is readonly Vec[] here — no `as readonly Vec[]`
```

Note the `||`/`!` guards narrow the fall-through automatically: after
`if (sub === undefined || !isDir(sub)) return …`, `sub` is a `Dir`; after the two
negative `readFile` guards, `file` is a `readonly Vec[]`. The remaining sites
(`import_` `:127`, `writeFile` `:137`, `readdir` `:152`, `rm` `:174`,
`extractEntity` `:190`, `insertEntityAt` `:202-203`/`:223`, `readBytesOp` `:251`)
follow the same shape. The four inconsistent "is a directory" spellings collapse
to the one `isDir` definition, every `as Dir` / `as readonly Vec[]` disappears
because the guards narrow, and a future fourth `Entity` kind is one new predicate.

### Why a type predicate is acceptable here

The general rule against `x is U` exists to stop predicates whose runtime test
drifts from the type they claim. These three do not drift: each body is the
exact structural check that defines membership in the narrowed type, so there is
nothing for the compiler to "trust" beyond what it could verify itself. That
makes this a sanctioned exception rather than a violation — and it is strictly
safer than the status quo, which asserts the same narrowing with unchecked `as`.
The win: the three-way contract is defined once, the four inconsistent
dir-spellings and all the casts are gone, and each consumer stays a single
combined guard (no extra `switch`).

## Tasks

- [ ] Add `isFile` / `isJsModule` / `isDir` (predicate form, body matching the
      asserted type) next to the `Entity` type in
      `fs/effects/node/virtual/module.f.ts`.
- [ ] Rewrite the twelve inline kind-tests to handle `undefined` then guard on the
      predicates, removing the `as Dir` / `as readonly Vec[]` casts now made
      unnecessary by narrowing.
- [ ] Run `npx tsc` and `fjs t`; confirm `fs/effects/node/virtual/proof.f.ts`
      still passes with full line/branch coverage (behaviour is unchanged).

## Related

- A sibling cleanup in the same file: the `result[0] === 'error'` short-circuit
  is hand-written four times (`:192`, `:225`, `:237`, `:244`) to thread an
  `IoResult` error back up the recursion. That is a `Result`-propagation concern
  rather than an `Entity`-kind one; worth a small `propagateError` helper but
  out of scope here.
