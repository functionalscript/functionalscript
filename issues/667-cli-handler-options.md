# 667-cli-handler-options. Pass full options to Command handlers

**Priority:** P3
**Status:** done

## Background

`Command<O>` and `Commands<O>` are already generic over the effect type `O`:

```ts
export type Command<O extends NodeOp> = {
    readonly names: readonly string[]
    readonly description: string
    readonly handler: (args: readonly string[]) => Effect<O, number>
}
```

Each handler declares only the effects it actually needs — a handler that only
writes to stdout uses `Write`, not the full `NodeOp`. This also means `dispatch`
is forward-compatible with non-Node environments (browser, worker) where only a
subset of effects is available.

## Problem

The handler receives only `args`. It has no access to `env`, `std`, `engine`,
or test contexts. In `fs/fjs/module.f.ts` the `test` and `run` commands work
around this by closing over the outer `options` value:

```ts
handler: args => testMain({ ...options, args }),
```

This is a leaky coupling — the handler list must be built inside `main` on
every call just to capture `options`.

## Proposal

Introduce a generic `ProgramOptions<O>` (analogous to `NodeProgramOptions` but
parameterised over the effect type) and change `handler` to receive the full
options, with `args` already trimmed to the arguments after the matched command
name:

```ts
export type Command<O extends Operation> = {
    readonly names: readonly string[]
    readonly description: string
    readonly handler: (options: ProgramOptions<O>) => Effect<O, number>
}
```

`handler` becomes `Program<O>` (same signature). `dispatch` forwards the
options with `args` replaced by the remainder:

```ts
return found.handler({ ...options, args: rest })
```

`dispatch` itself takes the full options:

```ts
export const dispatch = <O extends Operation>(commands: Commands<O>) =>
    (options: ProgramOptions<O>): Effect<O | Write, number>
```

Because `O` is a type parameter rather than a fixed `NodeOp`, this keeps the
door open for running a `Commands` list in any environment that supplies the
required effects — including a browser, where filesystem and process operations
are absent.

## Impact

- `fs/effects/node/module.f.ts` — introduce generic `ProgramOptions<O>` (or lift the relevant fields out of `NodeProgramOptions`).
- `fs/cli/module.f.ts` — update `Command<O>`, `dispatch`.
- `fs/fjs/module.f.ts` — handlers receive `options` directly; `Commands` list can become a module-level constant.
- `fs/cas/module.f.ts` — handlers gain access to `options` (currently unused; no behaviour change).
- `fs/cli/proof.f.ts` — update test helpers.

## Related

- `fs/cli/module.f.ts` — current implementation
- `fs/effects/node/module.f.ts` — `NodeProgramOptions`, `NodeProgram`
