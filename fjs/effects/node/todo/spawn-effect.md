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
`../types.ts`; `Fs` is `Mkdir | ReadFile | ReadBytes | Readdir | WriteFile | Rm |
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
export type ChildReadAny = readonly['childReadAny', (child: Child) => IoResult<readonly[ChildStreams, Vec] | null>]
export type ChildStreams = 'stdout' | 'stderr'
export type ChildEnd = readonly['childEnd', (child: Child) => IoResult<void>]
export type ChildKill = readonly['childKill', (child: Child, signal: string) => IoResult<void>]
export type ChildWait = readonly['childWait', (child: Child) => IoResult<ExitStatus>]
export type ExitStatus = readonly['exited', number] | readonly['signaled', string]
```

Notes on the shape:

- **Every return is a `Result`.** `Operation` requires it — a runner may decline
  any command it was given no handler for, and `notImplemented` needs somewhere
  to go. `spawn → Child` and `childEnd → void` written bare do not type-check;
  they are `IoResult<Child>` and `IoResult<void>`.
- **`Vec` in and out, not `string`.** `Read`/`Write` (the console pair) are
  byte-granular and encoding-agnostic for the same reason: framing is pure code,
  not the interpreter's business. Chunks are bounded like `readBytes`/
  `writeBytes` — ≤128 KiB, the Bun `bigint` limit.
- **`childWrite` submits its vector once and never resubmits it.** Node's
  `Writable.write()` returning `false` is not a short write — the whole chunk
  has already been accepted into the stream's buffer, and `false` means only
  "do not write again until `'drain'`". A runner that looped "over short
  writes" would resend bytes the child already holds, which over a framed
  protocol duplicates frames. This module settled it once already:
  `../module.mjs:156-175`'s `writeAll` says *"the data is already buffered at
  that point (no retry needed) but the caller must not issue more writes until
  the `'drain'` event fires"*, and issues exactly one `write`.
- **But `childWrite` awaits its completion callback, which `writeAll` does
  not.** A console pipe that closes is fatal to the process anyway; a child's
  stdin closing is ordinary, and Node reports it asynchronously — `write()` can
  return `true` and the `EPIPE` arrive afterwards, through the callback or an
  `'error'` event. An operation that resolved on the `true` path has already
  answered ok by then, and no listener added later can retract it. So:
  `write(chunk, callback)`, resolve when the callback fires, wait for `'drain'`
  as well when the return was `false`, and answer `IoError` on `'error'` or a
  closed stream — checked BEFORE subscribing, since a destroyed stream emits
  nothing further.
- **`null` is EOF and ONLY EOF.** `Readable.read()` answers `null` both at
  end-of-stream and when nothing is buffered yet, so a `childRead` that
  returned it directly would report EOF while the child was still composing its
  reply — and the very first MCP exchange, write-then-read, would end before the
  response arrived. This module has already solved it: `readStdinByte`
  (`../module.mjs:197-219`) loops, checks `readableEnded`, and waits on
  `'readable'` versus `'end'` to tell the two apart. `childRead` does the same,
  and answers `null` only after EOF.
- **`childReadAny` exists because two pipes deadlock.** A child that fills its
  stderr buffer before writing the stdout reply blocks; a caller sitting in
  `childRead(child, 'stdout')` cannot drain stderr, and neither side moves.
  `all` does not solve it — it awaits BOTH reads and cannot re-schedule one
  while the other is pending — so the family needs an operation that answers
  whichever stream became ready. This is why `exec` collects both streams
  itself, and it is not optional for an interactive caller.
- **`childReadAny` answers `null` only after BOTH streams have ended.** Its ok
  branch tags the data with the stream it came from; the `null` is untagged, so
  there is nowhere to say *which* stream ended. A runner that forwarded the
  first per-stream EOF would therefore tell a caller whose child closed stdout
  while it was still writing stderr that there is nothing left, and the rest of
  that stderr would be lost. `childReadAny` suppresses individual EOFs instead:
  an ended stream drops out of the race and is never waited on again — leaving
  it in would wake on the ended stream forever and starve the live one — and the
  single `null` comes once the last stream ends. Per-stream EOF stays observable
  through `childRead(child, stream)`, which sharpens the last open question
  below: if `childReadAny` replaces `childRead` outright, nothing can observe one
  stream ending before the other.
- **The race consumes only the stream it answers with.** Readiness and
  consumption are separate steps, and a runner that raced two `childRead` calls
  collapses them: each call takes a chunk out of its own stream, only one of
  them is returned, and the loser's bytes are gone — a later `childReadAny`
  resumes after the chunk it already swallowed and never delivers it. Two
  streams buffered before the first call would answer one chunk and silently
  drop the other. So `childReadAny` waits on the readiness events of the
  still-open streams — `'readable'` against `'end'`, as `childRead` already
  does — and calls `read()` on the winner ALONE. The loser needs no buffer and
  no cancellation of an in-flight read, because no read was ever issued against
  it: its bytes stay where they were, in its own stream, and the next call
  finds them. That is what keeps "no table" (above) true of this operation too
  — the only state is the child's.
- **`childKill` exists because a child may ignore EOF.** `childEnd` closes
  stdin and nothing more. A server that keeps running, a protocol exchange that
  stalls, a client-side failure needing cleanup — in each, `childWait` waits
  forever and the caller has no way out. Any API that can start a process must
  be able to stop one.
- **The handle IS the branded child — there is no table.** `createServer` sets
  the precedent exactly: `ok(asNominal(createServer(nodeRl)))`
  (`../module.mjs:321`) mints the brand around the host object itself and
  `listen` recovers it with `asBase(server)` (`:324`). A `Map` from an integer
  id to a `ChildProcess` would need `Map#set` on every spawn and a delete on
  every exit path — in-place mutation of shared state, which
  [`fjs/AGENTS.md`](../../../AGENTS.md) §3.1 forbids outright — and it would buy
  nothing the brand does not already give.
- **`spawn` resolves the lifecycle BEFORE it answers.** Node reports a missing
  executable through an asynchronous `'error'` event (`ENOENT`) and emits no
  `'exit'` at all, so a runner that returns a handle immediately hands the
  caller something that can only hang. `spawn` races `'spawn'` against that
  first `'error'` and answers `error(...)` on the latter, minting no handle: a
  command that does not exist cannot reach `childWrite` or `childWait`.
- **`childWait` reads before it listens.** A child may exit before anyone waits
  on it, and an `'exit'` listener attached afterwards never fires. Node keeps
  the outcome on the object — `exitCode` and `signalCode` are non-null once the
  process is gone — so `childWait` checks those first and only subscribes when
  both are `null`. That is what keeps "no table" honest: the state a cache would
  have held is already held by the child, and the brand can reach it.
- **`childRead` names the stream** rather than shipping two operations; `exec`'s
  callers want `stderr` separately and so will these.
- **`argv`, not a shell string.** A `cmd`/`args` split has no shell to quote for.
  That is a side benefit, not the reason for the issue.
- **`childWait` answers an exit *status*, not a number.** Node reports
  `('exit', code, signal)` with `code === null` whenever the child was
  terminated by a signal — `SIGTERM` from a supervisor, or one it sent itself.
  `IoResult<number>` cannot represent that outcome, so a runner would have to
  invent a code (`128 + n` is a shell convention, not a Node one, and not
  portable) or misreport an ordinary termination as an IO failure. `ExitStatus`
  is a tagged pair in this module's own idiom — `IoError` is
  `readonly['ioError', IoErrorInfo]` (`../types.ts:31`). Both tags live in the
  `ok` branch: a child that exited non-zero or was killed still ran, which is
  all the operation promised. A caller that treats either as fatal has
  `Program`'s `error(n)` convention to convert into.

The virtual runner (`../virtual/`) does not implement this family, for the same
reason it does not implement `exec`, `createServer`, `listen`, `forever` or
`test`: there is no in-memory meaning for a real child process. Its module
documentation lists what it leaves out and gains these names.

Open for review before code:

- Whether `childWait` should be the only way to observe the exit status, or
  whether `childRead` returning `null` on both streams plus a `wait` is one
  operation too many.
- Whether `spawn` should take the initial `cwd`/`env` at all, given no other
  operation in this module reads `NodeProgramOptions`.
- Whether `childEnd` on an already-closed stdin is an idempotent `ok` or an
  `IoError`. **It must be one or the other, stated.** A child that has exited
  may have had `child.stdin` destroyed already, and then `end(callback)` neither
  calls back nor emits: an implementation that awaits hangs, and one that
  returns at once loses a real close error. The recommendation is idempotent
  `ok` — closing what is already closed achieved what was asked — with the
  stream's state checked before anything is subscribed to.
- Whether `childReadAny` replaces `childRead` outright rather than joining it.
  Two ways to read one child is a wider API than the problem needs, if every
  real caller must use the multiplexed one anyway.

### Tasks

- [ ] Settle the signatures above.
- [ ] `../types.ts`: the seven operations, `Child`, `SpawnOptions`,
      `ExitStatus`; add them to `NodeOp`.
- [ ] `../module.f.mjs`: `do_` constructors and the `nodeCommandSet` keys.
- [ ] `../module.mjs`: the runner over `node:child_process.spawn` — brand the
      `ChildProcess` itself with `asNominal`, recover it with `asBase`, no
      table; `writeAll`-style backpressure; the `('exit', code, signal)`
      mapping onto `ExitStatus`.
- [ ] A runner test in the shape of `../memory/proof.mjs` — spawn `node -e`,
      round-trip two batches, close, wait; one that kills the child through
      `childKill`, so the `signaled` branch is exercised rather than assumed;
      one that spawns a command that does not exist; one that calls `childWait`
      AFTER the child has already exited; one that calls `childEnd` after the
      child has exited; one whose child writes to stderr and stdout in an order
      that deadlocks a single-stream reader; one whose child ends stdout and
      keeps writing to stderr afterwards, where `childReadAny` must deliver
      every later stderr chunk and answer `null` only once both streams have
      ended; one whose child writes to BOTH streams and lets both chunks
      buffer before the first `childReadAny` — distinct from the case above,
      which is about EOF, this one is about simultaneous readiness, and
      successive calls must deliver both chunks rather than lose the one that
      did not win the race; and one that reads before the child has replied,
      which must NOT read as EOF.
- [ ] **Give every hang-regression case its own deadline**, one that kills the
      child and fails the case. The self-hosted runner has no hard timeout
      (`../../../emergent_testing/todo/206.md:43-55`), so a returning
      regression would hang `fjs test` rather than redden it — a guard against
      hanging that hangs is worth less than no guard, because it stops the
      whole suite instead of one case.
- [ ] `deno.json`: add `--allow-run` to the tasks that run the suite. `test`,
      `cov` and `cov-html` (`../../../../deno.json:4-6`) grant only
      `--allow-read --allow-env --allow-sys`, and the `deno` CI job runs
      `deno task cov` (`../../../../.github/workflows/ci.yml:404`), so the
      first discovered proof to reach `node:child_process.spawn` fails there on
      a permission error before a single case runs. Scope the grant to what the
      proofs actually spawn if that suffices — under a scoped
      `--allow-run=node` the "command that does not exist" case above surfaces
      as a Deno permission error rather than `ENOENT`, so scope or assert
      accordingly. The `ci.yml:398` step already runs with `-A` and needs
      nothing. This belongs to the implementation, not to this note: nothing
      spawns yet, so widening the grant now would loosen CI for code that does
      not exist.
- [ ] `../virtual/module.f.mjs`: extend the not-implemented list in its docs.
- [ ] `npx tsc`, `npm test`, `npm run cov`.

### Related

- `../types.ts` — `Exec`, and `Server`/`CreateServer`/`Listen`, the handle
  precedent.
- `../module.mjs:296` — the `exec` runner, the closest existing implementation.
- `../../../protocol/mcp/stdio/` — the framing a spawned MCP server speaks; the
  first caller.
- [requestlistener-stateful](./requestlistener-stateful.md) — the other place a
  long-lived host object needs state threaded through effects.
