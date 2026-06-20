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
`AGENTS.md` treats `as` like Rust's `unsafe`, and also forbids type predicates
(`x is U`). The way out it prescribes is to "restructure the union so a
structural check narrows correctly without a predicate."

So define a single tagged classifier next to the `Entity` declarations. Inside
the ternary, `e instanceof Array` narrows `e` to `readonly Vec[]`,
`typeof e === 'function'` narrows it to `JsModule`, and the final arm narrows to
`Dir` — all automatically, no predicate and no `as`:

```ts
type Classified =
    | readonly ['file', readonly Vec[]]
    | readonly ['module', JsModule]
    | readonly ['dir', Dir]

const classify = (e: Entity): Classified =>
    e instanceof Array      ? ['file', e]   :
    typeof e === 'function' ? ['module', e] :
                              ['dir', e]
```

Consumers destructure the tag, and the tuple discriminant narrows the payload, so
the recursive descent threads a real `Dir`/`Vec[]` with the casts gone:

```ts
// :67-72  operation — descend only into directories
const sub = dir[first]
if (sub === undefined) { return op(dir, path) }
const c = classify(sub)
if (c[0] !== 'dir') { return op(dir, path) }
const [newSubDir, r] = f(c[1], rest)   // c[1] is Dir — no `as Dir`

// :104-109  readFile
const file = dir[path[0]]
if (file === undefined) { return enoent }
const c = classify(file)
switch (c[0]) {
    case 'module': { throw new Error(`'${path[0]}' is a JsModule; readFile not supported`) }
    case 'dir':    { return error(`'${path[0]}' is not a file`) }
    case 'file':   { /* c[1] is readonly Vec[] — no `as readonly Vec[]` */ }
}
```

The remaining sites (`import_` `:127`, `writeFile` `:137`, `readdir` `:152`,
`rm` `:174`, `extractEntity` `:190`, `insertEntityAt` `:202-203`/`:223`,
`readBytesOp` `:251`) follow the same shape: handle `undefined` first, then
`switch` on `classify(e)[0]`. The four inconsistent "is a directory" spellings
collapse to the one `'dir'` arm of `classify`, every `as Dir` / `as readonly
Vec[]` disappears (the payload is already narrowed), and a future fourth `Entity`
kind is one new tuple variant plus exhaustiveness errors at each `switch` — the
compiler points at every site that must handle it.

(If a particular site genuinely only needs a yes/no answer and no narrowed value,
a thin `kind = (e: Entity) => classify(e)[0]` reads fine — but the value-carrying
`classify` is what removes the casts, which is the reviewer's point: narrow,
don't return `boolean`.)

### Why narrow here, against the usual guidance

This codebase generally avoids leaning on type narrowing. This module is a
deliberate exception: the alternative is the present `as Dir` / `as readonly
Vec[]` casts, and trading a discouraged pattern for an *outright unsafe* one
(`as` is "Rust `unsafe`" per `AGENTS.md`) is the worse deal. `classify` is the
narrowing that the type system can actually check.

The cost is honest and accepted: `classify` does **not** collapse each site to a
single test. Because the union excludes `undefined` but `dir[name]` is `Entity |
undefined`, every consumer keeps an explicit `undefined` guard *before* calling
`classify`, and then branches on the tag — so a site that today is one
combined `if` becomes an `undefined` check plus a `switch`/destructure, i.e.
slightly more `if`s, not fewer lines. The win is not line count: it is that the
three-way contract is defined once, the four inconsistent dir-spellings are gone,
the casts are gone, and a fourth `Entity` kind surfaces as exhaustiveness errors
at each `switch` instead of silent misclassification.

## Tasks

- [ ] Add the `Classified` tagged union and `classify` next to the `Entity` type
      in `fs/effects/node/virtual/module.f.ts`.
- [ ] Rewrite the twelve inline kind-tests to handle `undefined` and then
      `switch`/destructure on `classify(...)`, removing the `as Dir` /
      `as readonly Vec[]` casts now made unnecessary by narrowing.
- [ ] Run `npx tsc` and `fjs t`; confirm `fs/effects/node/virtual/proof.f.ts`
      still passes with full line/branch coverage (behaviour is unchanged).

## Related

- A sibling cleanup in the same file: the `result[0] === 'error'` short-circuit
  is hand-written four times (`:192`, `:225`, `:237`, `:244`) to thread an
  `IoResult` error back up the recursion. That is a `Result`-propagation concern
  rather than an `Entity`-kind one; worth a small `propagateError` helper but
  out of scope here.
