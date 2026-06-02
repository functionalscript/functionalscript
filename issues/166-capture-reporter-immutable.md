# 166. Capture reporter in `./fs/emergent-testing/test.f.ts` must not use mutable arrays

**Priority:** P3
**Status:** open

## Problem

`makeReporter` in `./fs/emergent-testing/test.f.ts` accumulates events by mutating a local array:

```ts
const makeReporter = (): readonly[TestReporter, () => readonly Event[]] => {
    const events: Event[] = []
    const reporter: TestReporter = {
        moduleStart: file => { events.push(['moduleStart', file]); return pure(undefined) },
        enter: path => { events.push(['enter', [...path]]); return pure(undefined) },
        // ...
    }
    return [reporter, () => events]
}
```

`.push()` on a mutable array violates the project's no-mutation rule (see `AGENTS.md`). The fact that the array is local does not change this — the principle applies uniformly.

## Proposed design

Event capture should be modelled as an Effect so that the virtual runner accumulates events into its immutable `State`, just as `write` accumulates stdout/stderr strings.

### Option A — a dedicated `Capture` effect

Define a new operation:

```ts
type CaptureOp = readonly['capture', (event: Event) => void]
```

The virtual runner adds an `events: readonly Event[]` field to `State` and handles `capture` by returning `[{ ...state, events: [...state.events, event] }, undefined]`. The capture reporter becomes `Reporter<CaptureOp>` with each method emitting `capture(event)` instead of `pure(undefined)`.

After `virtual(state)(test(reporter)(options))`, `finalState.events` holds the ordered list of events — no mutable variable needed.

### Option B — reuse the existing `Write` effect

Serialize each event to a string (e.g. JSON) and write it to a dedicated stream, then parse it back from `state.stdout` after the run. Simpler to implement but couples the event format to string serialization.

Option A is preferred: it keeps events structured, avoids serialization, and integrates cleanly with the virtual runner's state extension pattern already used for `stdout`/`stderr`/`internet`/`epochNs`.

## Related

- `AGENTS.md` — no-mutation rule: avoid `.push`, `.pop`, index assignment, etc. on accumulators.
- [i156](./156-tf-virtual-tests.md) — introduced the capture reporter; the mutable array was a pragmatic shortcut.
- [i163](./163-reporter-test-method.md) — `Reporter<O>` generic; `O` would become `CaptureOp` for the capture reporter.
