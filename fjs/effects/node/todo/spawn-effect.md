## Long-lived subprocess effect

**Priority:** P3
**Status:** open

### Problem

`Exec` is the only subprocess primitive:

```ts
export type ExecResult = { readonly stdout: string; readonly stderr: string }
export type Exec = readonly['exec', (command: string, stdin?: string) => IoResult<ExecResult>]
```

One shell command string, one `stdin` string handed over up front, and a single
answer once the child has exited with the whole of `stdout`/`stderr` collected.
For "run this, wait, give me what it printed" that is the right shape and it
stays.

It cannot express a child that is talked to *while it runs*. A caller that has
to write a first batch, read the answer to it, then write a second batch before
the child exits has no operation to reach for — `exec` has already committed
its whole input and will not answer until the process is gone. There is no
handle, no incremental read or write, no close-stdin and no wait anywhere in
`./types.ts`; `Fs` is `Mkdir | ReadFile | ReadBytes | Readdir | WriteFile | Rm |
Rename | Exec | Access | CreateExclusive | WriteBytes | Stat`.

That shape is what a *protocol* over a child process needs, and this repo ships
one: `fjs/protocol/mcp/stdio` frames newline-delimited JSON-RPC over stdin and
stdout, and `fjs mcp` runs a server that speaks it. Driving such a server from
FunctionalScript — an end-to-end proof of `casMcpServer` over a real pipe, or
any client of somebody else's MCP server — needs exactly initialize-write,
read, write-again, close, wait. Today that test can only be written as impure
JavaScript outside the effect system, which is where a downstream consumer of
this package already had to put it.

### Proposal

A `Spawn` family beside `Exec`, not replacing it. The 0.46 effect system can
carry it: `Operation` is `readonly[string, (..._: readonly never[]) =>
Result<unknown, unknown>]`, and `CreateServer`/`Listen` already establish the
pattern for an opaque host handle — a `Nominal` brand minted by the runner with
`asNominal`, threaded back in by later operations.

```ts
export type Child = Nominal<'child', `<brand>`, unknown>

export type Spawn = readonly['spawn', (cmd: string, args: readonly string[], options?: SpawnOptions) => IoResult<Child>]
export type SpawnOptions = { readonly cwd?: string; readonly env?: Env }

export type ChildWrite = readonly['childWrite', (child: Child, data: Vec) => IoResult<void>]
export type ChildRead = readonly['childRead', (child: Child, stream: ChildStreams) => IoResult<Vec | null>]
export type ChildStreams = 'stdout' | 'stderr'
export type ChildEnd = readonly['childEnd', (child: Child) => IoResult<void>]
export type ChildWait = readonly['childWait', (child: Child) => IoResult<number>]
```

Notes on the shape:

- **Every return is a `Result`.** `Operation` requires it — a runner may decline
  any command it was given no handler for, and `notImplemented` needs somewhere
  to go. `spawn → Child` and `childEnd → void` written bare do not type-check;
  they are `IoResult<Child>` and `IoResult<void>`.
- **`Vec` in and out, not `string`.** `Read`/`Write` (the console pair) are
  byte-granular and encoding-agnostic for the same reason: framing is pure code,
  not the interpreter's business. Chunks are bounded like `readBytes`/
  `writeBytes` — ≤128 KiB, the Bun `bigint` limit — and `childWrite` writes the
  whole vector or fails, the runner looping over short writes.
- **`null` is EOF**, matching `Read`'s `number | null`.
- **`childRead` names the stream** rather than shipping two operations; `exec`'s
  callers want `stderr` separately and so will these.
- **`argv`, not a shell string.** A `cmd`/`args` split has no shell to quote for.
  That is a side benefit, not the reason for the issue.
- **`childWait` answers the exit code**, in the `ok` branch — an exit code is not
  an IO failure, and a caller that treats non-zero as fatal has `Program`'s
  `error(n)` convention to convert into.

The virtual runner (`./virtual/`) does not implement this family, for the same
reason it does not implement `exec`, `createServer`, `listen`, `forever` or
`test`: there is no in-memory meaning for a real child process. Its module
documentation lists what it leaves out and gains these names.

Open for review before code:

- Whether `childWait` should also be the only way to observe the exit code, or
  whether `childRead` returning `null` on both streams plus a `wait` is one
  operation too many.
- Whether `spawn` should take the initial `cwd`/`env` at all, given no other
  operation in this module reads `NodeProgramOptions`.

### Tasks

- [ ] Settle the signatures above.
- [ ] `./types.ts`: the five operations, `Child`, `SpawnOptions`; add them to
      `NodeOp`.
- [ ] `./module.f.mjs`: `do_` constructors and the `nodeCommandSet` keys.
- [ ] `./module.mjs`: the runner over `node:child_process.spawn`, with the
      handle table and backpressure.
- [ ] A runner test in the shape of `./memory/proof.mjs` — spawn `node -e`,
      round-trip two batches, close, wait.
- [ ] `./virtual/module.f.mjs`: extend the not-implemented list in its docs.
- [ ] `npx tsc`, `npm test`, `npm run cov`.

### Related

- `./types.ts` — `Exec`, and `Server`/`CreateServer`/`Listen`, the handle
  precedent.
- `./module.mjs:296` — the `exec` runner, the closest existing implementation.
- `../../protocol/mcp/stdio/` — the framing a spawned MCP server speaks; the
  first caller.
- [requestlistener-stateful](./requestlistener-stateful.md) — the other place a
  long-lived host object needs state threaded through effects.
