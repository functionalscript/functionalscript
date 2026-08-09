# Rename private JSDoc typedefs in migrated modules

**Priority:** P1
**Status:** open

### Problem

The first Stage-1 `.f.ts` -> `.f.mjs` migrations landed before the repository
adopted the leading-`_` convention for implementation-only JSDoc typedefs.
TypeScript emits module-scope JSDoc `@typedef`s as exported declaration aliases,
so an implementation-only type that kept its old unprefixed name now appears to
be public in generated `.d.mts` even though it was not public before migration.

Audit the already migrated `.f.mjs` modules against the `.f.ts` source immediately
before each migration. A type is private when either:

- the corresponding module-scope TypeScript alias was not exported before the
  migration; or
- the JSDoc migration introduced a new alias solely as an implementation helper
  for another type.

This cleanup restores the intended visibility contract; it must not redesign or
weaken public types. Renaming a private alias is not a breaking change when the
expanded/structural contract of every public declaration remains unchanged.

### Audit

The audit covers all 14 current `.f.mjs` FunctionalScript modules. Historical
visibility was checked against the parent revision of the migration that created
each `.f.mjs` file: PRs
[#1452](https://github.com/functionalscript/functionalscript/pull/1452),
[#1453](https://github.com/functionalscript/functionalscript/pull/1453),
[#1454](https://github.com/functionalscript/functionalscript/pull/1454),
[#1456](https://github.com/functionalscript/functionalscript/pull/1456),
[#1458](https://github.com/functionalscript/functionalscript/pull/1458), and
[#1460](https://github.com/functionalscript/functionalscript/pull/1460).

| Migrated module | Migration | Private typedef cleanup |
|---|---|---|
| `fjs/asserts/module.f.mjs` | #1452 | None; `Assert` was public. |
| `fjs/types/function/module.f.mjs` | #1453 | `Fn` -> `_Fn` (the old `Fn` alias was not exported). |
| `fjs/types/option/module.f.mjs` | #1453 | None; `Option` was public. |
| `fjs/types/nullable/module.f.mjs` | #1453 | None; `Nullable` was public. |
| `fjs/types/array/module.f.mjs` | #1454 | `TupleX` -> `_TupleX`, `IndexX` -> `_IndexX`; both are migration-introduced recursive helpers. Existing `_X0`, `_X1`, `_X2` already follow the private convention. |
| `fjs/types/ts/module.f.mjs` | #1454 | None; `Equal` and `Printer` were public. |
| `fjs/types/function/compare/module.f.mjs` | #1456 | None; all module-scope type aliases were public. |
| `fjs/types/function/operator/module.f.mjs` | #1456 | None; all module-scope type aliases were public. |
| `fjs/types/list/module.f.mjs` | #1458 | `NotLazy` -> `_NotLazy`, `Empty` -> `_Empty`, `Concat` -> `_Concat`; all three old aliases were non-exported. |
| `fjs/types/result/module.f.mjs` | #1458 | None; `Ok`, `Error`, and `Result` were public. |
| `fjs/common/monoid/module.f.mjs` | #1458 | None; `Monoid` was public. |
| `fjs/types/bigint/module.f.mjs` | #1458 | None; `Unary` and `Reduce` were public. |
| `fjs/types/nominal/module.f.mjs` | #1458 | None; `Nominal` was public. |
| `fjs/types/bit_vec/module.f.mjs` | #1460 | `Revision` -> `_Revision` (migration-introduced helper); `Norm` -> `_Norm`, `NormOp` -> `_NormOp`, `Base` -> `_Base`, `UnpackConcat` -> `_UnpackConcat`, `ListToVecState` -> `_ListToVecState`, `ListToVecOp` -> `_ListToVecOp` (all corresponding old aliases were non-exported). |

This gives 13 aliases to rename across four modules.

Function-local JSDoc aliases such as the local `T` typedefs used inside functions
are not part of this cleanup: they correspond to local TypeScript aliases and do
not define module-level package API. If declaration emission ever promotes one
of them to a module-level alias, add it to this task using the same visibility
rule.

### Proposal

Rename only the audited private module-scope typedefs and all references to those
names. Keep every public typedef name unchanged.

For aliases referenced by public declarations, preserve the expanded public
contract. For example, changing a public declaration from
`readonly [Private]` to `readonly [_Private]` is only a visibility cleanup when
`Private` and `_Private` denote the same type. A change to the underlying type
that changes public assignability is a separate breaking API change.

The cleanup should not add a `**BREAKING CHANGES:**` entry solely because an
accidentally emitted implementation alias changes name: those aliases were
non-public before migration or were introduced only as private migration
helpers. Add normal breaking-change documentation if implementation of this task
also changes an expanded public contract.

### Tasks

- [x] Audit every current `.f.mjs` FunctionalScript module against its
      pre-migration `.f.ts` source.
- [ ] In `fjs/types/function/module.f.mjs`, rename `Fn` to `_Fn` and update its
      recursive/self references and the `fn` annotation.
- [ ] In `fjs/types/array/module.f.mjs`, rename `TupleX` to `_TupleX` and
      `IndexX` to `_IndexX`, updating the public `Tuple` / `Index` definitions
      without changing their resulting types.
- [ ] In `fjs/types/list/module.f.mjs`, rename `NotLazy` to `_NotLazy`, `Empty`
      to `_Empty`, and `Concat` to `_Concat`, updating all internal and public
      references without changing expanded public types.
- [ ] In `fjs/types/bit_vec/module.f.mjs`, rename `Revision`, `Norm`, `NormOp`,
      `Base`, `UnpackConcat`, `ListToVecState`, and `ListToVecOp` to their
      leading-`_` forms and update all references.
- [ ] Search all `.mjs` / `.f.mjs` sources and JSDoc imports for references to
      the old private names; update internal references and confirm no supported
      consumer API depends on them.
- [ ] Emit `.d.mts` declarations before/after the cleanup and verify that public
      declaration assignability is unchanged after expanding private aliases.
- [ ] Run type checking, tests/proofs, declaration emission, and package consumer
      validation required by the Stage-1 migration.

### Acceptance criteria

- Every audited implementation-only module-scope JSDoc typedef uses a leading
  `_`.
- Public aliases that existed before migration retain their public names.
- Migration-introduced helper aliases are `_`-prefixed unless intentionally
  promoted to documented public API.
- Generated declarations may still emit `_` aliases, but public declarations
  preserve the same expanded/structural type contracts as before this cleanup.
- No source or test imports an old private alias as supported package API.
- No `**BREAKING CHANGES:**` entry is required solely for these visibility
  renames; any actual public assignability change is treated separately as
  breaking.

### Related

- [`migrate-typescript-to-mjs.md`](./migrate-typescript-to-mjs.md) — Stage-1
  TypeScript-to-JSDoc migration and the leading-`_` visibility convention.
- [`../fjs/fsc/README.md`](../fjs/fsc/README.md) — authoritative migration and
  private-JSDoc typedef contract.
- [`blocked/jsdoc-typedef-strip-internal.md`](./blocked/jsdoc-typedef-strip-internal.md)
  — eventual replacement of the `_` workaround with `@internal` and
  `stripInternal`.
