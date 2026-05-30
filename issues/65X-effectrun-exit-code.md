# 65X-effectrun-exit-code. `effectRun` discards exit code

**Priority:** P2
**Status:** done

## Problem

`fs/fjs/module.ts` calls `effectRun(main)` but discards the returned `Promise<number>`:

```ts
effectRun(main)   // Promise<number> is never awaited or used
```

`effectRun` is typed as `(p: NodeProgram) => Promise<number>` — the number is the
exit code returned by the program (0 = success, 1 = failure). Since nobody calls
`process.exit` with it, Node exits naturally with code 0 regardless of test results.

Consequence: `fjs t` always exits 0, even when tests fail. This makes it unusable
as a scenario runner and masks failures in any script that checks the exit code.

## Proposal

Move `process.exit` into `effectRun` itself in `fs/io/module.ts`. `effectRun` is a
process entry point — its job is to run a program and exit. Consumers that need the
raw exit code can use `runProgram` directly.

```ts
// io/module.ts
const effectRun = async (p: NodeProgram): Promise<never> => {
    const code = await runProgram(io)(io.process.argv.slice(2))(p)
    return process.exit(code)
}
```

The return type changes from `Promise<number>` to `Promise<never>` (since
`process.exit` never returns), and `NodeRun` is updated accordingly. Call sites stay
as the clean one-liner `effectRun(main)` with no chaining required. Mirrors the
behaviour of `run` in `fs/io/module.f.ts`, which already calls `process.exit`.

## Related

- [i65X-async-test-functions](./65X-async-test-functions.md) — discovered while
  adding `fjs` as a runner in the scenario test matrix
