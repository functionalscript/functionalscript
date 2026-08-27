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

Use this directory convention where named types or RTTI type definitions are
needed:

```text
module.f.mjs  # implementation; no @typedef
proof.f.mjs   # proofs; no @typedef
rtti.f.mjs    # runtime type definitions used by RTTI
types.ts      # public named TypeScript types
private.ts    # private named TypeScript types
```

`module.f.mjs` and `proof.f.mjs` may use JSDoc annotations and `@import`, but
must not declare named types with `@typedef`. Named TypeScript types have exactly
two homes:

- `types.ts` for public types;
- `private.ts` for implementation-only types.

`private.ts` contains implementation-only TypeScript types used by either the
module or its proofs. Every private type continues to start with `_`.

#### RTTI type definitions

Some TypeScript types are derived from runtime RTTI definitions, for example:

```ts
import { type } from './rtti.f.mjs'

export type Value = Ts<typeof type>
```

Put runtime values whose primary purpose is to represent types in `rtti.f.mjs`.
This keeps runtime type definitions distinct from normal implementation code and
from their compile-time TypeScript views:

```text
rtti.f.mjs  # runtime representation of types
types.ts    # public compile-time types
private.ts  # private compile-time types
```

Both `types.ts` and `private.ts` may depend on `rtti.f.mjs` when defining types
such as `Ts<typeof type>`. This is an intentional dependency on a runtime value,
not a violation of the public/private type boundary. `rtti.f.mjs` is ordinary
runtime FunctionalScript source and is packaged like other required `.f.mjs`
modules; it is not a private type artifact merely because `private.ts` may use
it.

Do not move an RTTI value into `types.ts` or `private.ts` merely to avoid this
dependency: the RTTI definition is a runtime value and belongs in `.f.mjs`.
Normal runtime values whose primary purpose is not type representation remain in
`module.f.mjs` rather than being moved mechanically to `rtti.f.mjs`.

Dependency rules:

- `module.f.mjs` and `proof.f.mjs` may use both `types.ts` and `private.ts`
  through JSDoc `@import`.
- `private.ts` may import public types from `types.ts`.
- `types.ts` and `private.ts` may depend on runtime type definitions from
  `rtti.f.mjs` for `Ts<typeof ...>` and similar type derivation.
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
3. run `npm pack`;
4. validate the actual packed artifact:
   - it contains neither authored `private.ts` nor generated `private.d.ts`;
   - every shipped `.d.ts` / `.d.mts` is scanned and must not contain a module
     reference to the directory's `private` type module;
5. install the tarball in the existing clean TypeScript consumer and type-check
   it as an independent semantic validation.

The declaration scan should reject the private module rather than only one
particular emitted spelling. For example, `./private.ts`, `./private.d.ts`, or a
future equivalent spelling must all be treated as the same forbidden public
dependency. This is a structural package check over the packed file set and the
contents of all packed declarations, not a check limited to whichever public
entry points the clean consumer happens to import.

References from shipped declarations to a packaged `rtti.f.mjs` are allowed:
unlike `private.ts`, RTTI is a runtime module intentionally available to the
package and may be required to express public types derived with `Ts<typeof ...>`.

The cleanup must operate on generated artifacts only; authored `private.ts`
remains available for source-tree type-checking. Neither `private.ts` nor the
intermediate generated `private.d.ts` is shipped.

Generated declarations such as `module.f.d.mts` may be produced from source that
uses `private.ts`, but no shipped declaration may depend on the private type
module. If an exported declaration needs a private type, either that type is
actually public and belongs in `types.ts`, or the public declaration must be
expressible without exposing the private type name. The package check must fail
rather than retaining `private.d.ts` to make such a leak resolve.

### Tasks

- [ ] Document `private.ts` and `rtti.f.mjs` beside the existing `types.ts`,
      `module.*`, and `proof.*` file conventions.
- [ ] Prohibit JSDoc `@typedef` declarations in `module.f.mjs` and `proof.f.mjs`.
- [ ] Keep the leading `_` convention for every type declared in `private.ts`.
- [ ] Move public named types from implementation/proof JSDoc into `types.ts`.
- [ ] Move private named types out of `types.ts`, `module.f.mjs`, and
      `proof.f.mjs` into each directory's `private.ts` where applicable.
- [ ] Move runtime RTTI definitions whose primary purpose is type representation
      into `rtti.f.mjs` when `types.ts` or `private.ts` derives TypeScript types
      from them with `Ts<typeof ...>` or an equivalent type query.
- [ ] Keep `private.ts` in normal TypeScript type-checking without generating a
      runtime JavaScript file for it.
- [ ] Add a post-declaration-emit packaging step that deletes generated
      `private.d.ts` files before `npm pack`.
- [ ] Inspect the `npm pack` artifact and reject any packed `private.ts` or
      `private.d.ts` file.
- [ ] Scan every packed `.d.ts` / `.d.mts` and reject any module reference to a
      directory's private type module, independent of the exact emitted suffix.
- [ ] Add a fixture where `module.f.mjs` and `proof.f.mjs` use `_`-prefixed types
      from `private.ts` without declaring any `@typedef`; verify declaration emit
      creates the intermediate `private.d.ts`, cleanup removes it, generated
      public declarations contain no implementation-local typedef exports, and
      packed-artifact validation finds no private type file or declaration edge.
- [ ] Extend the fixture with `rtti.f.mjs` plus a `Ts<typeof ...>`-derived type in
      `types.ts` or `private.ts`; verify the source tree and packed consumer both
      resolve the RTTI dependency correctly.
- [ ] Verify a clean TypeScript consumer can install the packed tarball and use
      the public API without any private artifact present.

### Acceptance criteria

- `module.f.mjs` and `proof.f.mjs` contain no JSDoc `@typedef` declarations.
- All public named TypeScript types live in `types.ts`.
- All private named TypeScript types live in `private.ts` and keep their leading
  `_`.
- Runtime values whose primary purpose is RTTI type representation live in
  `rtti.f.mjs`; `types.ts` and `private.ts` may depend on them for
  `Ts<typeof ...>`-style type derivation.
- Generated public declarations do not expose private named typedefs merely as a
  consequence of declaration emission.
- Declaration emission may create `private.d.ts`, but the packaging cleanup
  removes it before package contents are selected.
- The packed tarball contains neither `private.ts` nor `private.d.ts`.
- No packed `.d.ts` / `.d.mts` file depends on a directory's private type module,
  regardless of the exact emitted module-specifier suffix.
- Required references to packaged `rtti.f.mjs` modules remain valid in the
  packed artifact and clean consumer.
- A clean TypeScript consumer type-checks successfully against the packed
  tarball after all private artifacts have been removed.

### Related

- [`detect-unexported-types-referenced-by-exported-types.md`](./detect-unexported-types-referenced-by-exported-types.md) — detect private type names that leak through exported types.
- [`document-file-type-naming-conventions.md`](./document-file-type-naming-conventions.md) — document the repository's source-file roles.
- [`../../todo/migrate-typescript-to-mjs.md`](../../todo/migrate-typescript-to-mjs.md) — current JavaScript/JSDoc implementation migration and `_` private-type convention.
- [`../ci/todo/f-mjs-package-support.md`](../ci/todo/f-mjs-package-support.md) — declaration emission and clean packed-package validation.
