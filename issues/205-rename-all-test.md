# 205. Rename `all.test.ts` entry point

**Priority:** P3
**Status:** open

## Problem

The `fs/dev/tf/scenarios/all.ts` file (renamed to `all.test.ts` by `run.sh` at test
time) is named `all`, which suggests "run all tests" rather than "register tests with
an external framework".

The `.test.ts` suffix **must be kept** — bun, node `--test`, and Playwright
auto-discover files ending in `.test.ts`. A name like `register.ts` (without the
`.test.ts` suffix) would not be found by any framework.

## Options

### Option A — `register.test.ts`

Rename `all.ts` → `register.ts` (at rest); `run.sh` links it as `register.test.ts`.
The `.test.ts` suffix preserves auto-discovery; the `register` prefix communicates
the file's role.

Note: `loadModuleMap` only matches `*.test.f.ts` / `*.test.f.js`, so `register.test.ts`
would not be loaded as a test module — no double-load risk, even if [i204](./204-test-ts-js-support.md)
adds plain `*.test.ts` support (since the guard would need to explicitly exclude
`register.test.ts` or use a different mechanism).

### Option B — keep `all.ts` / `all.test.ts`

Accept the current name. `all` is short and familiar; the entry-point role is clear
from context.

## Related

- [i204](./204-test-ts-js-support.md) — new suffix for plain TS/JS FunctionalScript
  convention files; `all.test.ts` must stay `.test.ts` for framework discovery
- [i183](./183-tf-framework-scenario-tests.md) — scenario runner that uses this file
