# 667-fjs-run-main-convention. Use `export const main` for FunctionalScript applications

**Priority:** P3
**Status:** open

## Problem

`fjs r ${module}` currently identifies the entry point by importing the module and reading its `default` export as a `NodeProgram`:

```ts
// fs/fjs/module.f.ts
return (v.default as NodeProgram)({ ...options, args })
```

`default` is not self-descriptive — it does not communicate that this export is the application entry point.

## Proposal

Adopt `export const main` as the entry-point convention for FunctionalScript applications, mirroring:

- The `export const proof` convention already used for proof modules.
- The `main` convention from C, C++, and Rust.
- `fs/fjs/module.f.ts` itself, which already exports `export const main: NodeProgram`.

Change `fjs r` to look up `main` instead of `default`:

```ts
return (v.main as NodeProgram)({ ...options, args })
```

## Impact

Any module intended to be run with `fjs r` must export `export const main: NodeProgram` instead of `export default`.

## Related

- `fs/fjs/module.f.ts:28` — current `v.default` lookup
- `fs/effects/node/module.f.ts` — `NodeProgram` type definition
