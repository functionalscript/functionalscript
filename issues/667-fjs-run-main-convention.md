# 667-fjs-run-main-convention. Use `export const main` for FunctionalScript applications

**Priority:** P3
**Status:** done

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

## Extension: `main` as `Commands`

Once `main` is the recognised entry-point name, `fjs r` can also accept a `Commands`
array instead of a `NodeProgram` function. If `typeof v.main === 'function'` the runner
calls it as a `NodeProgram`; if it is an array it calls `dispatch(v.main)(args)`.
This lets a module declare its CLI structure as data:

```ts
export const main: Commands = [
    { names: ['add'], description: '...', handler: ... },
    { names: ['list'], description: '...', handler: ... },
]
```

and get help, aliases, and error messages from `dispatch` for free.

## Related

- `fs/fjs/module.f.ts:28` — current `v.default` lookup
- `fs/effects/node/module.f.ts` — `NodeProgram` type definition
- [667-cli-nested-commands.md](./667-cli-nested-commands.md) — nested `Commands` in `Command`
