# JSDoc `@typedef` documentation is dropped by tsgo declaration emit

**Priority:** P2
**Status:** blocked

## Trigger

The upstream issue below is filed at
[microsoft/typescript-go](https://github.com/microsoft/typescript-go/issues),
fixed, and a TypeScript release containing the fix is picked up by this
repository's `devDependencies`. Until then, substantial documented type APIs
live in `types.ts` (whose declaration comments emit through the normal
TypeScript pipeline), per `todo/migrate-typescript-to-mjs.md`.

## Problem

Documentation written on a JSDoc `@typedef` in authored `.mjs` can vanish from
the emitted `.d.mts`, so the published package loses exactly its type
documentation while the repository stays green. `fjs/crypto/sha2` was the
original case (its documented `V8`/`V16`/`State`/`Sha2` types have since moved
to `types.ts`, which is the workaround, not the fix).

Measured with the minimal reproduction below, the loss is *shape-dependent*,
which the earlier record did not know:

| typedef block shape | tsc 5.9.3 (strada) | tsc 7.0.2 (tsgo) |
| --- | --- | --- |
| standalone — next line is another comment block or EOF | prose kept on `export type` (tags such as `@example` stripped from the attached copy; original block also emitted, duplicated and misplaced) | **full block kept, verbatim** |
| block directly followed by a declaration | prose kept on `export type`, trimmed | **`export type` emitted bare; the doc attaches to the *following* declaration** |
| one block declaring two `@typedef`s | prose kept on both `export type`s, trimmed | **both emitted bare; the block dangles after them** |

So on tsgo — this repository's compiler — the documentation is lost whenever
the typedef block touches a following statement or declares more than one
type, and that is a regression relative to strada, which kept the prose in
every shape. (Strada's own tag-stripping and duplication are the older,
adjacent bugs: microsoft/TypeScript#43534, fixed for the services layer only,
and microsoft/TypeScript#61664.)

## Reproduction

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

## Ready-to-file upstream issue

Title: **Declaration emit loses JSDoc `@typedef` documentation when the block
precedes a declaration or declares multiple typedefs**

Body:

> **Repro:** the `repro.mjs` + flags above (also reproduces with a
> `tsconfig.json` carrying the same options).
>
> **Expected:** each emitted `export type` carries the documentation written
> on its `@typedef`, as TypeScript 5.9.3 does (modulo #43534-style tag
> stripping), and as tsgo itself already does when the typedef block is
> standalone.
>
> **Actual (tsgo 7.0.2):** `export type Width = 8 | 16;` is emitted with no
> documentation and the block attaches to the following `export declare const
> width`; a block declaring two typedefs loses its documentation on both.
>
> **Impact:** for JavaScript-authored packages (JSDoc types, `declaration:
> true`), the published `.d.mts` silently loses its type documentation; the
> authoring repository sees no error. Related: #43534 (services-layer fix,
> declaration emit untouched), #61664 (proposes stripping redundant JSDoc
> type directives while keeping documentation).

## Tasks

- [ ] File the issue at `microsoft/typescript-go` (the regression is in tsgo;
      strada's milder trimming/duplication is already tracked upstream) and
      record the issue link here.
- [ ] When the trigger fires, re-run the reproduction, then reconsider which
      type-level APIs still need the `types.ts` placement solely for
      documentation fidelity.

## Related

- [`todo/migrate-typescript-to-mjs.md`](../migrate-typescript-to-mjs.md) —
  "Typedef documentation does not survive declaration emit".
- [`jsdoc-typedef-strip-internal.md`](./jsdoc-typedef-strip-internal.md) —
  the adjacent `@internal` + `stripInternal` gap for JSDoc typedefs.
- [microsoft/TypeScript#43534](https://github.com/microsoft/TypeScript/issues/43534),
  [microsoft/TypeScript#61664](https://github.com/microsoft/TypeScript/issues/61664)
  — adjacent strada behaviors.
