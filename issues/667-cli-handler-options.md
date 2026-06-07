# 667-cli-handler-options. Pass full NodeProgramOptions to Command handlers

**Priority:** P3
**Status:** open

## Problem

`Command.handler` currently receives only `args`:

```ts
export type Command = {
    readonly names: readonly string[]
    readonly description: string
    readonly handler: (args: readonly string[]) => Effect<NodeOp, number>
}
```

Handlers have no access to `env`, `std`, `engine`, or the test contexts from
`NodeProgramOptions`. In `fs/fjs/module.f.ts` the `test` and `run` commands
work around this by closing over the outer `options` value:

```ts
handler: args => testMain({ ...options, args }),
```

This is a leaky coupling — the handler list must be built inside `main` just to
capture `options`.

## Proposal

Change `handler` to receive the full `NodeProgramOptions`, with `args` already
trimmed to the arguments after the matched command name (as `dispatch` does
today):

```ts
export type Command = {
    readonly names: readonly string[]
    readonly description: string
    readonly handler: (options: NodeProgramOptions) => Effect<NodeOp, number>
}
```

`handler` becomes `NodeProgram` (same signature). `dispatch` forwards the
options with `args` replaced by the remainder:

```ts
return found.handler({ ...options, args: rest })
```

`dispatch` itself changes signature to accept the full options:

```ts
export const dispatch = (commands: Commands) => (options: NodeProgramOptions): Effect<NodeOp, number>
```

## Impact

- `fs/cli/module.f.ts` — update `Command`, `dispatch`.
- `fs/fjs/module.f.ts` — handlers receive `options` directly; no more closure over outer `options`; `Commands` list can be module-level constant.
- `fs/cas/module.f.ts` — handlers gain access to `options` (currently unused; no behaviour change).
- `fs/cli/proof.f.ts` — update test helpers.

## Related

- `fs/cli/module.f.ts` — current implementation
- `fs/effects/node/module.f.ts` — `NodeProgramOptions`, `NodeProgram`
