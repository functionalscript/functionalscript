## Separate private types into `private.ts`

**Priority:** P2
**Status:** open

### Problem

FunctionalScript directories currently mix private types with implementation and
public type declarations:

```text
module.f.mjs  # implementation + private JSDoc types
proof.f.mjs   # proofs + private JSDoc types
types.ts      # public + private TypeScript types
```

Private types already use a leading `_` by convention, but their location still
creates declaration and package noise. In particular, JSDoc `@typedef`s in
`module.f.mjs` and `proof.f.mjs` escape into generated `.d.mts` files: TypeScript
emits them as exported type aliases even when they were intended to be private.
Private declarations in `types.ts` likewise appear in the shipped `types.d.ts`.

Moving all named types out of implementation/proof files and splitting public
from private TypeScript types removes the JSDoc typedef leakage structurally.
TypeScript will still emit a declaration for an imported `private.ts`, because
that source file is part of the declaration program; that generated private
declaration must be removed before packaging.

The leading `_` convention should remain: file placement and name visibility are
complementary signals.

### Proposal

Use this directory convention where named types are needed:

```text
module.f.mjs  # implementation; no @typedef
proof.f.mjs   # proofs; no @typedef
types.ts      # public named types
private.ts    # private named types
```

`module.f.mjs` and `proof.f.mjs` may use JSDoc annotations and `@import`, but
must not declare named types with `@typedef`. Named types have exactly two homes:

- `types.ts` for public types;
- `private.ts` for implementation-only types.

`private.ts` contains implementation-only TypeScript types used by either the
module or its proofs. Every private type continues to start with `_`.

Dependency direction:

```text
              types.ts
              ^      ^
              |      |
private.ts <- module.f.mjs / proof.f.mjs
```

- `module.f.mjs` and `proof.f.mjs` may use both `types.ts` and `private.ts`
  through JSDoc `@import`.
- `private.ts` may import public types from `types.ts`.
- `types.ts` must not depend on `private.ts`.
- A public exported API must not require a `private.ts` type by name.

This leaves generated declarations free to describe the public API, including
structural types inferred from exported values/functions, without also exporting
implementation-local typedef names simply because they were declared in JSDoc.

#### Declaration emission and packaging

`private.ts` is source-only and remains in the normal TypeScript program so its
types and all `@import` users are checked. Consequently, the existing
`tsc --emitDeclarationOnly` pass will also generate `private.d.ts`; `exclude`
cannot suppress that output once another program input imports `private.ts`.

Do not require TypeScript to avoid generating that intermediate file. Instead,
make private declaration cleanup an explicit packaging step:

1. run normal declaration emission and the existing declaration round-trip
   type-check;
2. delete every generated `private.d.ts` before `npm pack` selects package
   contents;
3. verify that no declaration which remains in the package references
   `private.ts` or `private.d.ts`.

The cleanup must operate on generated artifacts only; authored `private.ts`
remains available for source-tree type-checking. Neither `private.ts` nor the
intermediate generated `private.d.ts` is shipped.

Generated declarations such as `module.f.d.mts` may be produced from source that
uses `private.ts`, but no shipped declaration may reference `private.ts` or a
`private.d.ts` artifact. If an exported declaration needs a private type, either
that type is actually public and belongs in `types.ts`, or the public declaration
must be expressible without exposing the private type name. The package check
must fail rather than retaining `private.d.ts` to make such a leak resolve.

### Tasks

- [ ] Document `private.ts` beside the existing `types.ts`, `module.*`, and
      `proof.*` file conventions.
- [ ] Prohibit JSDoc `@typedef` declarations in `module.f.mjs` and `proof.f.mjs`.
- [ ] Keep the leading `_` convention for every type declared in `private.ts`.
- [ ] Move public named types from implementation/proof JSDoc into `types.ts`.
- [ ] Move private named types out of `types.ts`, `module.f.mjs`, and
      `proof.f.mjs` into each directory's `private.ts` where applicable.
- [ ] Keep `private.ts` in normal TypeScript type-checking without generating a
      runtime JavaScript file for it.
- [ ] Add a post-declaration-emit packaging step that deletes generated
      `private.d.ts` files before `npm pack`.
- [ ] Do not ship authored `private.ts`.
- [ ] Reject shipped generated declarations that reference `private.ts` or
      `private.d.ts`; do not preserve `private.d.ts` merely to satisfy such a
      reference.
- [ ] Add a fixture where `module.f.mjs` and `proof.f.mjs` use `_`-prefixed types
      from `private.ts` without declaring any `@typedef`; verify declaration emit
      creates the intermediate `private.d.ts`, cleanup removes it, generated
      public declarations contain no implementation-local typedef exports, and
      the packed package contains no private type file.
- [ ] Verify a clean TypeScript consumer can use the packed public API without
      any private artifact present.

### Acceptance criteria

- `module.f.mjs` and `proof.f.mjs` contain no JSDoc `@typedef` declarations.
- All public named types live in `types.ts`.
- All private named types live in `private.ts` and keep their leading `_`.
- Generated public declarations do not expose private named typedefs merely as a
  consequence of declaration emission.
- Declaration emission may create `private.d.ts`, but the packaging cleanup
  removes it before package contents are selected.
- Neither `private.ts` nor `private.d.ts` is shipped.
- No shipped `.d.ts` / `.d.mts` file references `private.ts` or `private.d.ts`.

### Related

- [`detect-unexported-types-referenced-by-exported-types.md`](./detect-unexported-types-referenced-by-exported-types.md) — detect private type names that leak through exported types.
- [`document-file-type-naming-conventions.md`](./document-file-type-naming-conventions.md) — document the repository's source-file roles.
- [`../../todo/migrate-typescript-to-mjs.md`](../../todo/migrate-typescript-to-mjs.md) — current JavaScript/JSDoc implementation migration and `_` private-type convention.
- [`../ci/todo/f-mjs-package-support.md`](../ci/todo/f-mjs-package-support.md) — declaration emission and clean packed-package validation.
