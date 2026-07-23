## Scenario Testing

**Priority:** P3
**Status:** open

A scenario is an extended unit test: a declarative description of an initial system state, an effect to run, and an expected result. The same scenario can be executed in two ways:

1. **As a unit test** — a mock effect interpreter runs the effect against a pure in-memory initial state. No real files, network, or processes. Fast, portable, runs anywhere.
2. **As an integration test** — the initial state is materialised on a real machine, the actual command is executed, and the result is checked. This is what CI integration jobs do (see [669-ci-integration-tests.md](669-ci-integration-tests.md)).

### Design

The scenario type will evolve as more complex cases are encountered rather than being designed upfront for all possible scenarios. A starting shape:

```ts
type Scenario<O extends Operation, R> = {
    readonly state: InitialState        // pure data description of files, env vars, etc.
    readonly effect: Effect<O, R>
    readonly expected: Effect<O, void>  // reads resulting state and checks hypotheses
}
```

`InitialState` is a pure data description of the starting conditions. The test and scenario runners read it and apply it to either a virtual or real system — the scenario itself has no knowledge of which.

`expected` is an effect rather than a plain value so it can read the resulting state after `effect` has been applied, allowing complex post-condition checks (e.g. assert a file was written with specific contents).

The two interpreters test different things:
- The mock tells you the logic is correct.
- The real run tells you the platform, install, and environment work.

Both failure modes are distinct and complementary — a scenario that passes both gives high confidence.

### Key constraint

The mock interpreter must be faithful to the real one. If they drift (e.g. file path casing differences on Windows), scenarios pass locally but fail in CI — the exact problem this design is meant to prevent. Ideally the mock is derived from the same spec as the real interpreter.

### Migration path

Existing proof tests that use the virtual filesystem interpreter are already implicit scenarios — they have a state (`emptyState + root: dir`), an effect (`testAll(reporter)(options(...))`), and an expected result (exit code + events). Once the formal `Scenario` type is defined, these tests can be lifted into it directly, replacing the ad-hoc `run()` / `runMain()` helpers in `proof.f.ts` with typed scenario declarations.

### Plan

- [ ] Define the `Scenario` type and `InitialState` effect in `fjs/testing/scenario/module.f.ts`.
- [ ] Implement a mock interpreter for the scenario effect system.
- [ ] Integrate scenarios with the existing unit test runner (`node --test`).
- [ ] Define how CI integration jobs consume scenario modules (see [669-ci-integration-tests.md](669-ci-integration-tests.md)).
