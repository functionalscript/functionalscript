# 166. Capture reporter in `./fs/emergent_testing/proof.f.ts` must not use mutable arrays

**Priority:** P3
**Status:** done

## Problem

`makeReporter` in `./fs/emergent_testing/proof.f.ts` originally accumulated events by mutating a local array:

```ts
const makeReporter = (): readonly [TestReporter, () => readonly Event[]] => {
    const events: Event[] = []
    const reporter: TestReporter = {
        result: (file, path, r, _throws) => { events.push(['result', file, [...path], r]); return pure(undefined) },
        summary: (pass, fail, time) => { events.push(['summary', pass, fail, time]); return pure(undefined) },
        test: defaultTest,
    }
    return [reporter, () => events]
}
```

`.push()` on a mutable array violates the project's no-mutation rule (see `AGENTS.md`). The fact that the array is local does not change this — the principle applies uniformly.

The reporter is also test-only: it exists to let `proof.f.ts` assert semantic `testAll` events while the virtual runner controls sandbox results and output capture. The fix should therefore avoid adding production effects or virtual-runner state that no real program needs.

## Accepted design

Reuse the existing `Write` effect and the virtual runner's immutable `stdout` accumulation:

1. The capture reporter is `Reporter<Sandbox | Write>`.
2. `result` and `summary` serialize each structured event as one JSON line and emit it with `log`.
3. The test helper runs `testAll` with `virtual(state)` and parses `finalState.stdout` back into `readonly Event[]`.

This keeps event capture effectful and immutable without introducing a new operation. The virtual runner already handles `Write` by returning a new state with appended `stdout`/`stderr`, so the reporter benefits from the existing immutable state path.

## Why this is better than a dedicated `Capture` effect

A dedicated `Capture` effect would make the virtual runner's operation map and `State` more complex only for this proof helper. It would also create a second event-storage channel (`events`) next to the existing output channels even though the test only needs an ordered transcript after the run.

The write-based design is better here because:

- it does not extend `NodeOp` or add a real-runtime no-op handler;
- it does not add a new virtual-runner operation or permanent `State.events` field;
- it reuses the already-tested `Write` implementation that immutably appends to `stdout`;
- newline-delimited JSON is sufficient for this internal test fixture because the event producer and consumer live in the same proof file;
- it keeps the production test-runner API smaller while still removing all local array mutation.

## Related

- `AGENTS.md` — no-mutation rule: avoid `.push`, `.pop`, index assignment, etc. on accumulators.
- i156 — introduced the capture reporter; the mutable array was a pragmatic shortcut.
- i163 — landed `Reporter<O>` generic, which lets the test reporter use `Reporter<Sandbox | Write>`.
