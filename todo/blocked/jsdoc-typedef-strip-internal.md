# Use `@internal` for private JSDoc typedefs

**Priority:** P3
**Status:** blocked

### Problem

During the TypeScript-to-JavaScript migration, implementation-only TypeScript
types become JSDoc `@typedef`s. TypeScript currently emits those typedefs as
exported type aliases in generated declarations even when they are not intended
to be public API.

Until the declaration emitter can strip private JSDoc typedefs, the repository
uses a leading `_` as an API convention: a typedef such as `_Node` is private by
contract even if the generated `.d.ts` / `.d.mts` contains `export type _Node`.
Consumers must not depend on that emitted name directly, so renaming or removing
the alias is not a breaking change solely because it was emitted. This does not
exempt changes propagated into public types: if a public declaration depends on
`_Node`, any change that alters that public declaration's assignability remains
a breaking API change.

The desired long-term representation is `@internal` plus `stripInternal`, so the
generated declaration does not expose the private type at all.

### Trigger

Unblocked when the TypeScript compiler used by this repository supports applying
`@internal` to JSDoc `@typedef` declarations and `stripInternal` reliably omits
those typedefs from generated `.d.ts` / `.d.mts` files.

The canonical blocker is
[microsoft/TypeScript#46407](https://github.com/microsoft/TypeScript/issues/46407),
which is still open and specifically requests `stripInternal` support for types
defined with JSDoc.

Another open TypeScript declaration/comment-emission issue,
[microsoft/TypeScript#62453](https://github.com/microsoft/TypeScript/issues/62453),
demonstrates the same JSDoc typedef-to-`export type` emission path while tracking
duplicated typedef comments. It is related context, not the visibility blocker.

A separate equivalent TypeScript 7 / Go issue was not found in
`microsoft/typescript-go`. The native compiler does implement `stripInternal`
in general, but the known JSDoc declaration-emission reports still show
`@typedef`s becoming exported aliases. Related TypeScript-Go issues are:

- [microsoft/typescript-go#4363](https://github.com/microsoft/typescript-go/issues/4363)
  — open; emitted JSDoc typedef aliases and their documentation ordering.
- [microsoft/typescript-go#4235](https://github.com/microsoft/typescript-go/issues/4235)
  — closed; JSDoc typedef/property documentation in declaration emit.
- [microsoft/typescript-go#4011](https://github.com/microsoft/typescript-go/issues/4011)
  — closed; correctness of generated declaration syntax for JSDoc typedefs.

These TypeScript-Go issues are adjacent declaration-emitter bugs, not substitutes
for #46407. Re-check the current TypeScript tracker when this task is unblocked,
especially as the native compiler work is consolidated with the main TypeScript
project.

### Proposal

Once the trigger is satisfied:

1. enable or retain `stripInternal` for declaration emission;
2. mark implementation-only JSDoc typedefs with `@internal`;
3. remove leading `_` from private typedef names where the prefix exists only as
   the current visibility workaround;
4. add a package/declaration fixture proving that private typedefs are absent
   from emitted declarations while public declarations remain valid;
5. update migration, compiler, package, and contributor documentation to remove
   the underscore workaround.

Do not strip a private typedef if a public declaration still depends on its name;
refactor the public declaration first so emitted declarations remain
self-contained and preserve the same public assignability contract.

### Acceptance criteria

- `@internal` on a JSDoc `@typedef` is honored by the repository's TypeScript
  declaration emitter when `stripInternal` is enabled.
- Generated `.d.ts` / `.d.mts` files omit implementation-only typedefs.
- Public emitted declarations never reference a stripped private type.
- Removing the `_` workaround does not weaken or otherwise change public
  assignability unless that change is explicitly treated as breaking.
- The `_`-prefix workaround is removed from repository documentation and from
  private typedefs that used it solely for visibility.
- Clean package-consumer type checking still passes.

### Related

- [`../migrate-typescript-to-mjs.md`](../migrate-typescript-to-mjs.md) — Stage 1
  TypeScript-to-JSDoc migration and the temporary `_` convention.
- [`../../fjs/fsc/README.md`](../../fjs/fsc/README.md) — source migration and
  JSDoc visibility contract.
- [`../../fjs/ci/todo/f-mjs-package-support.md`](../../fjs/ci/todo/f-mjs-package-support.md)
  — declaration-emission and clean-consumer validation.
- [microsoft/TypeScript#46407](https://github.com/microsoft/TypeScript/issues/46407)
  — canonical upstream feature request.
- [microsoft/TypeScript#62453](https://github.com/microsoft/TypeScript/issues/62453)
  — related JSDoc typedef declaration/comment emission bug.
