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
creates declaration and package noise. JSDoc private typedefs in `module.f.mjs`
can be emitted into `module.f.d.mts`, while private declarations in `types.ts`
are emitted into the shipped `types.d.ts`.

Moving private types to a separate TypeScript file should make the source
boundary explicit and allow package declaration generation to omit private type
artifacts entirely. The leading `_` convention should remain: file placement and
name visibility are complementary signals.

### Proposal

Use this directory convention where private named types are needed:

```text
module.f.mjs  # implementation
proof.f.mjs   # proofs
types.ts      # public types
private.ts    # private types
```

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

`private.ts` is source-only. It must be type-checked, but package declaration
emission must not generate or ship `private.d.ts`, and the package must not ship
`private.ts` itself.

Generated declarations such as `module.f.d.mts` may be produced from source that
uses `private.ts`, but no shipped declaration may reference `private.ts` or a
`private.d.ts` artifact. If an exported declaration needs a private type, either
that type is actually public and belongs in `types.ts`, or the public declaration
must be expressible without exposing the private type name.

This should be enforced by the build/package checks rather than relying only on
review convention.

### Tasks

- [ ] Document `private.ts` beside the existing `types.ts`, `module.*`, and
      `proof.*` file conventions.
- [ ] Keep the leading `_` convention for every type declared in `private.ts`.
- [ ] Move private named types out of `types.ts`, `module.f.mjs`, and
      `proof.f.mjs` into each directory's `private.ts` where applicable.
- [ ] Keep `private.ts` in normal TypeScript type-checking without generating a
      runtime JavaScript file for it.
- [ ] Exclude `private.ts` from declaration/package output: do not generate or
      ship `private.d.ts` and do not ship `private.ts`.
- [ ] Reject shipped generated declarations that reference `private.ts` or
      `private.d.ts`.
- [ ] Add a fixture where `module.f.mjs` and `proof.f.mjs` use `_`-prefixed types
      from `private.ts` while the generated public declarations and packed
      package contain no private type file.
- [ ] Verify a clean TypeScript consumer can use the packed public API without
      any private artifact present.

### Related

- [`detect-unexported-types-referenced-by-exported-types.md`](./detect-unexported-types-referenced-by-exported-types.md) — detect private type names that leak through exported types.
- [`document-file-type-naming-conventions.md`](./document-file-type-naming-conventions.md) — document the repository's source-file roles.
- [`../../todo/migrate-typescript-to-mjs.md`](../../todo/migrate-typescript-to-mjs.md) — current JavaScript/JSDoc implementation migration and `_` private-type convention.
- [`../ci/todo/f-mjs-package-support.md`](../ci/todo/f-mjs-package-support.md) — declaration emission and clean packed-package validation.
