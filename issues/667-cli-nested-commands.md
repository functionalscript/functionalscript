# 667-cli-nested-commands. Allow `Commands` as an alternative to `handler` in `Command`

**Priority:** P3
**Status:** open

## Problem

`Command` currently requires a `handler` function. Subcommand groups like `cas` are
wired up by delegating to a separate `main` function:

```ts
{
    names: ['cas', 's'],
    description: 'Content-addressable storage operations',
    handler: casMain,
}
```

`dispatch` has no knowledge of the nested structure, so `fjs help` cannot enumerate
`cas` subcommands, and `fjs help cas` is not possible.

## Proposal

Allow `Command` to carry either a `handler` or a nested `Commands` list:

```ts
export type Command =
    | { readonly names: readonly string[], readonly description: string, readonly handler: Handler }
    | { readonly names: readonly string[], readonly description: string, readonly commands: Commands }

type Handler = (args: readonly string[]) => Effect<NodeOp, number>
```

When `dispatch` matches a group command it recursively calls `dispatch(command.commands)`
with the remaining args, making subcommand routing and help generation uniform.

`fjs help` would show a flat listing as today. `fjs help cas` (or `fjs cas help`)
would show the `cas` subcommands. Nested `help` is generated automatically by the
recursive `dispatch`.

## Impact

- `fs/cli/module.f.ts` — extend `Command` type; update `dispatch` to handle both cases.
- `fs/fjs/module.f.ts` — replace `handler: casMain` with `commands: casCommands`.
- `fs/cas/module.f.ts` — export a `commands` constant instead of (or in addition to) `main`.

## Related

- `fs/cli/module.f.ts` — current implementation
- [665-command-line-parsing-refactor.md](./665-command-line-parsing-refactor.md) — parent issue
- [667-fjs-run-main-convention.md](./667-fjs-run-main-convention.md) — `fjs r` could detect `main: Commands` vs `main: NodeProgram` and call `dispatch` automatically
