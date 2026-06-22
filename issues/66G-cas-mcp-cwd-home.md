# 66G-cas-mcp-cwd-home. Use HOME as the default CAS root instead of `process.cwd()`

**Priority:** P3
**Status:** open

## Problem

The CAS commands (`cas add`, `cas get`, `cas list`, `cas mcp`) root the store at
`'.'` — `process.cwd()` as resolved by the Node effects runner. When launched by
an MCP host such as Claude Desktop or Codex Desktop, `cwd` is whatever the host
decides to set it to; it is not the user's home directory, nor any directory the
user has meaningful control over. The result is that the CAS silently stores or
reads from an unpredictable location, making it effectively unusable without
manual configuration.

Concretely, `fs/cas/module.f.ts` line 110 hard-codes:

```ts
const c = cas(sha256)(fileKvStore('.'))
```

and the MCP server in `fs/cas/mcp/module.f.ts` inherits that store unchanged.

## Proposal

Use `HOME` (from `process.env.HOME`) as the default CAS root for all CAS
commands, including the MCP subcommand.

`NodeProgramOptions` (`fs/effects/node/module.f.ts`) already carries `env`, but
no home-directory field is exposed to command handlers. The fix has two layers:

### 1. Add a `home` field to `NodeProgramOptions`

```ts
export type NodeProgramOptions = {
    readonly args: readonly string[]
    readonly env: Env
    readonly home: string          // <— new: HOME resolved at startup
    readonly std: { ... }
    ...
}
```

Populate it in `module.ts` from `process.env.HOME ?? process.cwd()` (fallback to
`cwd` on platforms without HOME). This gives handlers a stable, well-defined root
without coupling them to `process.env` directly.

### 2. Thread `home` through `Commands` handlers

Command handlers currently receive `NodeProgramOptions` via the `handler`
parameter signature (the `options` argument from which `args` is destructured).
Pass `home` through the same object so handlers can use it without global state.

### 3. Update CAS commands to use `home`

Replace the module-level `const c = cas(sha256)(fileKvStore('.'))` with a
handler-local store rooted at `home`:

```ts
{
    names: ['add'],
    handler: ({ home, args: [path, ...rest] }) => {
        const c = cas(sha256)(fileKvStore(home))
        ...
    },
}
```

Apply the same change to `get`, `list`, and `mcp`.

### Future: `-p` / `--path` option

`home` is the right default for MCP use. For CLI use a user may want to override
it (e.g. to share a project-local CAS). A future `-p PATH` / `--path PATH`
global option on the `cas` subcommand group would let users specify the root
explicitly. That option is out of scope for this issue but should be kept in mind
when structuring the handler refactor — routing `home` through the options object
(rather than reading `HOME` deep in each handler) makes the eventual `-p` flag
easy to thread in.

## Tasks

- [ ] Add `home: string` to `NodeProgramOptions` in `fs/effects/node/module.f.ts`.
- [ ] Populate `home` from `process.env.HOME ?? process.cwd()` in `fs/effects/node/module.ts`.
- [ ] Update the four CAS command handlers (`add`, `get`, `list`, `mcp`) in
      `fs/cas/module.f.ts` to root `fileKvStore` at `home` instead of `'.'`.
- [ ] Update any proof or test fixtures that construct `NodeProgramOptions`
      directly to include a `home` field.

## Related

- [i66E-fjs-cas-mcp-subcommand](./66E-fjs-cas-mcp-subcommand.md) — the `cas mcp`
  subcommand whose unpredictable `cwd` is the immediate trigger for this issue.
- `fs/cas/module.f.ts` — `fileKvStore('.')` is the root of the bug.
- `fs/effects/node/module.f.ts` — `NodeProgramOptions` type to be extended.
- `fs/effects/node/module.ts` — `options` object to be populated with `home`.
