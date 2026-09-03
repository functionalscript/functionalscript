## JSDoc `@typedef` documentation is dropped by tsgo declaration emit

> Authored `.mjs` no longer carries file-scope `@typedef`s (root
> [`AGENTS.md`](../../AGENTS.md), [`fjs/AGENTS.md`](../../fjs/AGENTS.md) §3.2),
> so no authored typedef documentation reaches declaration emit any more; this
> upstream behavior matters again only if that rule is ever relaxed.

**Priority:** P2
**Status:** blocked

### Trigger

The upstream issue below is filed at
[microsoft/typescript-go](https://github.com/microsoft/typescript-go/issues),
fixed, and a TypeScript release containing the fix is picked up by this
repository's `devDependencies`. Until then, substantial documented type APIs
live in `types.ts`, whose declaration comments emit through the normal
TypeScript pipeline.

### Problem

Documentation written on a JSDoc `@typedef` in authored `.mjs` can vanish from
the emitted `.d.mts`, so the published package loses exactly its type
documentation while the repository stays green. `fjs/crypto/sha2` was the
original case (its documented `V8`/`V16`/`State`/`Sha2` types have since moved
to `types.ts`, which is the workaround, not the fix). As of
[#1530](https://github.com/functionalscript/functionalscript/pull/1530) the
repository's exposure is limited to future code: the last three documented
public typedefs authored in `.mjs` (`ParseContext`/`djsResult` in
`fjs/djs/transpiler`, `Step` in `fjs/protocol/mcp/stdio`) moved to sibling
`types.ts` files, and a sweep measures zero remaining. Implementation-local
`_`-prefixed typedefs keep their (fewer) doc comments in `.mjs` and are still
subject to the bug.

Measured with the minimal reproduction below, the loss is *shape-dependent*,
which the earlier record did not know:

| typedef block shape | tsc 5.9.3 (strada) | tsc 7.0.2 (tsgo) |
| --- | --- | --- |
| first thing in the file, blank line before what follows (comment block or statement) | prose kept on `export type`, trimmed (tags such as `@example` stripped from the attached copy) | **full block kept, verbatim** |
| standalone — last comment block in the file | prose kept on `export type`, trimmed | **`export type` emitted bare; the block dangles detached** |
| two comment blocks with no blank line between them | prose kept on both `export type`s, trimmed | **both emitted bare; the adjacent blocks form one trivia run and neither attaches** |
| block directly followed by a declaration | prose kept on `export type`, trimmed; the original block also emitted in full on the declaration, duplicated | **`export type` emitted bare; the doc attaches to the *following* declaration** |
| one block declaring two `@typedef`s | prose kept on both `export type`s, trimmed | **both emitted bare; the block dangles detached** |

(Where a detached block lands varies with the surrounding statements; the
per-reproduction statements below are each measured. "Emitted bare" is the
invariant.)

The rule that fits every measured case on tsgo (review's 2×5 matrix of
{file-start, statement-preceded} × {EOF, adjacent statement, blank+statement,
adjacent comment, blank+comment}, plus the header-preceded case below): **a
typedef block attaches to its emitted `export type` only when it is the first
thing in the file *and* a blank line separates it from whatever follows** —
statement or comment block alike; both conditions are necessary, and in every
other measured shape the type is emitted bare. Since a real module starts
with its header comment, no typedef block in one is the first thing in the
file, so in practice a module's typedef documentation never attaches on tsgo
(measured: with a header block preceding, the header rides above the bare
`export type` while the typedef's own block mis-attaches to the following
declaration). All of it is a regression relative to strada, which kept the
prose in every measured shape.
(Strada's own tag-stripping and duplication are the older, adjacent bugs:
microsoft/TypeScript#43534, fixed for the services layer only, and
microsoft/TypeScript#61664.)

### Reproduction

`repro.mjs`, compiled with
`tsc --allowJs --checkJs --declaration --emitDeclarationOnly --strict`:

```js
/**
 * Doc on a typedef whose block also precedes a declaration.
 *
 * @typedef {8 | 16} Width
 */
export const width = 8

/**
 * Multi-tag block doc.
 *
 * @typedef {{ readonly a: number }} Rec
 * @typedef {{ readonly b: number }} Rec2
 */

export {}
```

tsgo 7.0.2 emits:

```ts
export type Width = 8 | 16;
/**
 * Doc on a typedef whose block also precedes a declaration.
 *
 * @typedef {8 | 16} Width
 */
export declare const width = 8;
export type Rec = {
    readonly a: number;
};
export type Rec2 = {
    readonly b: number;
};
/**
 * Multi-tag block doc.
 *
 * @typedef {{ readonly a: number }} Rec
 * @typedef {{ readonly b: number }} Rec2
 */
export {};
```

`Width`, `Rec`, and `Rec2` are bare; `Width`'s documentation decorates
`width` instead. strada 5.9.3 on the same input keeps (trimmed) prose on all
three `export type`s.

The smallest reproduction is a file containing nothing but one documented
typedef block:

```js
/**
 * Only block, then EOF.
 *
 * @typedef {8} Only
 */
```

tsgo 7.0.2 emits `export type Only = 8;` bare, with the block dangling after
it; strada 5.9.3 attaches the (trimmed) prose to the type.

The practically important case is a file that begins with a module header —
the shape of every real module:

```js
/**
 * Module header.
 */

/**
 * doc
 *
 * @typedef {8} T
 */

export const post = 1
```

tsgo 7.0.2 emits:

```ts
/**
 * Module header.
 */
export type T = 8;
/**
 * doc
 *
 * @typedef {8} T
 */
export declare const post = 1;
```

`T`'s own documentation never attaches — the header rides above the bare
type, and the doc block lands on `post`. Delete the header block (making the
typedef block the first thing in the file) and the same input attaches the
doc to `export type T` in full.

### Ready-to-file upstream issue

Title: **Declaration emit loses JSDoc `@typedef` documentation when the block
precedes a declaration or declares multiple typedefs**

Body:

> **Repro:** the `repro.mjs` + flags above (also reproduces with a
> `tsconfig.json` carrying the same options).
>
> **Expected:** each emitted `export type` carries the documentation written
> on its `@typedef`, as TypeScript 5.9.3 does (modulo #43534-style tag
> stripping), and as tsgo itself already does when the typedef block is
> followed by another comment block.
>
> **Actual (tsgo 7.0.2):** `export type Width = 8 | 16;` is emitted with no
> documentation and the block attaches to the following `export declare const
> width`; a block declaring two typedefs loses its documentation on both; a
> file whose only content is one documented typedef block emits the type bare
> with the block dangling after it. The rule that fits every case measured so
> far: a typedef block attaches to its emitted type only when it is the first
> thing in the file *and* a blank line separates it from whatever follows —
> both conditions necessary. In particular, in a file that begins with a
> module header comment, no typedef documentation ever attaches: the header
> rides above the bare `export type` while the typedef's own block
> mis-attaches to the following declaration.
>
> **Impact:** for JavaScript-authored packages (JSDoc types, `declaration:
> true`), the published `.d.mts` silently loses its type documentation; the
> authoring repository sees no error. Related: #43534 (services-layer fix,
> declaration emit untouched), #61664 (proposes stripping redundant JSDoc
> type directives while keeping documentation).

### Tasks

- [ ] File the issue at `microsoft/typescript-go` (the regression is in tsgo;
      strada's milder trimming/duplication is already tracked upstream) and
      record the issue link here.
- [ ] When the trigger fires, re-run the reproduction, then reconsider which
      type-level APIs still need the `types.ts` placement solely for
      documentation fidelity.

### Related

- [`../../fjs/AGENTS.md`](../../fjs/AGENTS.md) §3.2 — private-type placement;
  superseded the wait-for-`@internal` strategy.
- [microsoft/TypeScript#43534](https://github.com/microsoft/TypeScript/issues/43534),
  [microsoft/TypeScript#61664](https://github.com/microsoft/TypeScript/issues/61664)
  — adjacent strada behaviors.
