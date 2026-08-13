# Scenario fixtures

External-runner scenario fixtures used to live in
`fjs/emergent_testing/scenarios/`. They have been **removed**. This file records
what they were and how to rebuild them, so the capability can be recreated
deliberately rather than reconstructed from git archaeology.

## What they were

Nine one-module fixtures plus a shell harness. Each fixture exported a `proof`
whose outcome under an external runner (`node --test`, `bun test`,
`deno test`) was known in advance from its filename: `*.pass.ts` had to exit
`0`, `*.fail.ts` had to exit `1`. The harness ran one fixture at a time and
compared the runner's exit status against that expectation.

They tested the framework end to end — registration, async handling, sub-tests,
throw tests, thenable handling — through a real runner in a real process, which
is the one thing the in-process proofs in
[`proof.f.mjs`](./proof.f.mjs) cannot do for themselves.

## Why they were removed

- **Nothing ran them.** No CI job and no generated workflow invoked
  `scenarios/run.sh`; it was a manual, undocumented step.
- **Part of it had already rotted.** `run.sh`'s `fjs` runner branch ran
  `npm run fst`, a script that no longer exists in `package.json`, so that
  quarter of the matrix reported `FAIL` for every fixture regardless of the
  fixture. Nobody noticed, which is the clearest evidence they were unrun.
- **They blocked a migration.** `scenarios/*.ts` and `scenarios/all.ts` were,
  with [`all.test.ts`](./all.test.ts), the last authored non-`types.ts`
  TypeScript in the repository — see
  [`todo/migrate-typescript-to-mjs.md`](../../todo/migrate-typescript-to-mjs.md).

Removing them deletes real coverage. That is the trade being accepted: the
coverage was not being collected anyway. Recreate it — from this file — if it
is wanted back, ideally wired into CI in the same change.

## What they covered

| Fixture | Expected exit | What it proved |
| --- | --- | --- |
| `fail.fail.ts` | `1` | A throwing test case fails the run. |
| `async.pass.ts` | `0` | An `async` test case is awaited and passes. |
| `async.fail.ts` | `1` | An `async` test case that rejects fails the run. |
| `async-subtests.pass.ts` | `0` | An `async` case returning an object of test cases has them run as sub-tests. |
| `async-subtests.fail.ts` | `1` | One failing sub-test of an `async` case fails the run. |
| `return-value.pass.ts` | `0` | A case returning an object is walked as a sub-tree. |
| `throw.pass.ts` | `0` | A case under a `throw` key passes *because* it throws. |
| `thenable.pass.ts` | `0` | A thenable is treated as a plain value, not awaited: its only key `then` is a function *with parameters*, so no leaf test is found and the run trivially passes. |
| `thenable2.pass.ts` | `0` | Same, for a zero-parameter `then` returning a value. |

The two thenable cases are the subtle ones and the reason to keep the set if it
is ever rebuilt: they pin FunctionalScript's decision that thenables are *not*
awaited, a rule no other test states.

## How to recreate

### 1. The fixtures

Each is a standalone module exporting `proof`, with no imports. Recreate them
verbatim:

```ts
// fail.fail.ts
export const proof = {
    failing: () => { throw 'intentional failure' }
}
```

```ts
// async.pass.ts
export const proof = {
    sleep: async () => {
        await new Promise<void>(resolve => setTimeout(resolve, 10))
    }
}
```

```ts
// async.fail.ts
export const proof = {
    sleep_fail: async () => {
        await new Promise<void>(resolve => setTimeout(resolve, 10))
        throw 'async failure'
    }
}
```

```ts
// async-subtests.pass.ts
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

```ts
// async-subtests.fail.ts
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

```ts
// return-value.pass.ts
const inner = () => {}

export const proof = {
    outer: (): unknown => ({ inner })
}
```

```ts
// throw.pass.ts
export const proof = {
    throw: { a: () => { throw 'expected' } }
}
```

```ts
// thenable.pass.ts
export const proof = {
    thenableResolves: () => ({
        then(resolve: (v: undefined) => void) { resolve(undefined) }
    })
}
```

```ts
// thenable2.pass.ts
export const proof = {
    shouldPass: () => ({ then: () => 'ok' })
}
```

### 2. The entry-point shim

```ts
// all.ts
import '../all.test.ts'
```

This one-line file is **not** redundant with `all.test.ts`, and the reason is
the single most easily lost piece of this design — see
[Two traps](#two-traps) below.

### 3. The harness

```sh
#!/bin/sh
# Usage: run.sh <runner> <scenario>
# runner: fjs | bun | node | deno
# scenario: path to a *.pass.ts or *.fail.ts file
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

Invoked as `sh run.sh node ./fail.fail.ts`. Fix the `fjs` branch before
reusing it: `npm run fst` does not exist. Whatever replaces it must run the
built-in runner over the scenario directory and exit non-zero on failure.

The harness hard-links exactly two files into the scenario directory,
`_scenario.proof.ts` (the fixture, renamed so the built-in runner's
`proof`-module discovery finds it) and `_all.test.ts` (the shim, renamed so the
external runner's `*.test.*` discovery finds it), runs the runner with the
directory as its working directory, and removes both links on exit.

## Two traps

Anyone rebuilding this will hit both.

### The shim cannot be replaced by hard-linking `all.test.ts`

A hard link has no "original": both names are equal directory entries to one
inode, and Node resolves a module's relative specifiers from whichever path it
was reached through. `all.test.ts` imports `../effects/node/module.mjs`, which
is correct at `fjs/emergent_testing/` and wrong one level deeper. Hard-linking
it into `scenarios/` fails at load:

```
Error [ERR_MODULE_NOT_FOUND]: Cannot find module
  '.../fjs/emergent_testing/effects/node/module.mjs'
  imported from .../scenarios/_all.test.ts
```

The shim works because it *lives in the directory it is linked into*, so its
own `../all.test.ts` stays correct at both paths. A symlink would resolve to
its realpath and avoid the shim entirely — a legitimate simplification if the
harness is rewritten, and one worth taking, since it collapses two files into
one.

### The shim must not be named `*.test.*` at rest

External runners scan the directory. If the at-rest shim also matched
`*.test.*`, the runner would discover both it and the `_all.test.ts` hard link
and register the whole suite twice — Node caches modules by resolved URL, not
by inode. That is why the file is `all.ts` and the link is `_all.test.ts`.
See [`todo/65z-singleton-effect.md`](./todo/65z-singleton-effect.md), which
proposes a general fix for duplicate proof execution under multiple paths.

## If you rebuild it

- **Wire it into CI in the same change.** An unrun harness rots silently, which
  is how this one ended up with a permanently failing runner branch.
- **Decide the language deliberately.** These fixtures were TypeScript on
  purpose: they proved Node, Bun and Deno execute a *TypeScript* proof
  natively. If that property no longer needs testing, `.mjs` fixtures are
  simpler and drop the fixtures from the `prepack` emit pass.
- **Prefer a symlink or a generated file** over the hard link, and the shim
  disappears.
- **Keep the thenable cases.** They are the only statement of the
  not-awaited rule.
