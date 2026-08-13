# Recreating the native-TypeScript scenario fixtures

`fjs/emergent_testing/scenarios/` was deleted in
[#1520](https://github.com/functionalscript/functionalscript/pull/1520): the
suite never ran in CI, and the repository decided that the one-time record
below is enough. This file preserves everything needed to recreate it —
sources verbatim — should native-TypeScript execution testing be wanted again.
The deletion commit is findable with
`git log --diff-filter=D -- fjs/emergent_testing/scenarios`.

## What the suite proved

Each scenario is a tiny proof module executed through a real test runner, with
an expected process exit code encoded in its file name: `*.pass.ts` must exit
`0`, `*.fail.ts` must exit non-zero. Because the fixtures are authored
TypeScript, running them proved two things at once:

1. `node --test`, `bun test`, and `deno test` execute a **TypeScript** proof
   natively (no compile step); and
2. emergent-testing semantics hold under external runners — async proofs,
   sub-tests returned from an async test, thenables treated as plain values,
   throw-tests, and intentional failures failing.

Since the deletion, the only authored TypeScript in the repository is
`types.ts`; the test entry `fjs/emergent_testing/all.test.mjs` is JavaScript.
A recreated `all.ts` therefore imports `../all.test.mjs` (the original
imported `../all.test.ts`) — the natively-executed TypeScript surface is then
the scenario files and the hard-linked entry itself.

## The harness: `run.sh`

`run.sh <runner> <scenario>` hard-links the scenario to `_scenario.proof.ts`
(so `loadModuleMap` discovers it as a proof) and `all.ts` to `_all.test.ts`
(so the runner discovers the registration entry), runs the runner in the
scenario directory, and compares the exit code with the expectation:

```sh
#!/bin/sh
# Usage: run.sh <runner> <scenario>
# runner: fjs | bun | node | deno
# scenario: path to a *.pass.f.ts, *.fail.f.ts, *.pass.ts or *.fail.ts file
set -e

runner=$1
scenario=$(realpath "$2")

scendir=$(cd "$(dirname "$0")" && pwd)

case "$scenario" in
    *.pass.ts) expected=0; scenfile="$scendir/_scenario.proof.ts" ;;
    *.fail.ts) expected=1; scenfile="$scendir/_scenario.proof.ts" ;;
    *) echo "unknown suffix: $scenario" >&2; exit 2 ;;
esac
allfile="$scendir/_all.test.ts"

ln "$scenario" "$scenfile"
ln "$scendir/all.ts" "$allfile"

cleanup() { rm -f "$scenfile" "$allfile"; }
trap cleanup EXIT

case "$runner" in
    fjs)        cmd="npm run fst" ;;
    bun)        cmd="bun test" ;;
    node)       cmd="node --test" ;;
    deno)       cmd="deno test --allow-read --allow-env --allow-sys" ;;
    *) echo "unknown runner: $runner" >&2; exit 2 ;;
esac

actual=0
(cd "$scendir" && $cmd) > /dev/null 2>&1 || actual=$?

if [ "$actual" -eq "$expected" ]; then
    echo "pass: $(basename "$scenario") [exit $actual]"
    exit 0
else
    echo "FAIL: $(basename "$scenario") [expected $expected, got $actual]"
    exit 1
fi
```

Two pre-existing caveats, recorded so a recreation does not rediscover them:
the `fjs` runner arm invokes `npm run fst`, a script that no longer exists in
`package.json`, and a framework that scans the directory may discover both
`all.ts` and the hard-linked `_all.test.ts` and run the suite twice (Node
caches modules by resolved URL, not inode) — the double-load concern noted in
[`todo/65z-singleton-effect.md`](./todo/65z-singleton-effect.md).

## The entry: `all.ts`

```ts
import '../all.test.mjs'
```

(Originally `import '../all.test.ts'`, when the entry was TypeScript.)

## The nine scenarios

`async.pass.ts` — an async proof awaits and passes:

```ts
export const proof = {
    sleep: async () => {
        await new Promise<void>(resolve => setTimeout(resolve, 10))
    }
}
```

`async.fail.ts` — an async proof throws after awaiting:

```ts
export const proof = {
    sleep_fail: async () => {
        await new Promise<void>(resolve => setTimeout(resolve, 10))
        throw 'async failure'
    }
}
```

`async-subtests.pass.ts` — an async test returns sub-tests, all passing:

```ts
export const proof = {
    withSubtests: async () => {
        await new Promise<void>(resolve => setTimeout(resolve, 10))
        return {
            sub1: () => {},
            sub2: () => {},
        }
    }
}
```

`async-subtests.fail.ts` — one returned sub-test throws:

```ts
export const proof = {
    withSubtests: async () => {
        await new Promise<void>(resolve => setTimeout(resolve, 10))
        return {
            sub1: () => {},
            sub2: () => { throw 'sub-test failure' },
        }
    }
}
```

`fail.fail.ts` — a plain intentional failure:

```ts
export const proof = {
    failing: () => { throw 'intentional failure' }
}
```

`return-value.pass.ts` — a returned object tree is walked, not rejected:

```ts
const inner = () => {}

export const proof = {
    outer: (): unknown => ({ inner })
}
```

`thenable.pass.ts` — a thenable is a plain value, not awaited:

```ts
// A test that returns a thenable (Promise-like object, not a real Promise).
// Per FunctionalScript convention, thenables are treated as plain values —
// not awaited. Both sandbox (fjs) and registerModule (node/bun/deno)
// must exit 0: the thenable object is walked as a sub-tree whose only key
// `then` is a function with parameters, so no leaf tests are found and the
// test trivially passes.
export const proof = {
    thenableResolves: () => ({
        then(resolve: (v: undefined) => void) { resolve(undefined) }
    })
}
```

`thenable2.pass.ts` — the shorter thenable variant:

```ts
export const proof = {
    shouldPass: () => ({ then: () => 'ok' })
}
```

`throw.pass.ts` — the `throw` key asserts that a test throws:

```ts
export const proof = {
    throw: { a: () => { throw 'expected' } }
}
```
