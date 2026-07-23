## todo-property. Add a `todo` test marker for captured-but-unfixed bugs

**Priority:** P3
**Status:** open

### Problem

When we discover a bug we want to capture the *desired* behaviour as a proof
immediately, while the fix lands later. Today there is no way to do this without
either breaking CI or hiding the test:

- Writing the proof as a normal test (`add: () => assertEq(add(2)(3), 5)`) makes
  CI red until the bug is fixed — so the test cannot be committed alongside the
  bug report.
- Commenting it out, or moving it to a markdown note, means the captured
  behaviour is not executable and silently rots: nothing tells us when the bug
  is fixed.

A proof author needs a way to say "this test documents a known bug; it is
*expected to fail today*, so a failure must not break CI — but the moment the
behaviour is fixed, flip the test red so we are reminded to remove the marker."

The existing `throw` marker (`fjs/emergent_testing/module.f.ts`) already
demonstrates the mechanism: a structural property in the proof tree that
*inverts* a leaf's pass/fail expectation.

### Proposal

Add a second marker, `todo`. It is a property key whose value is a single
zero-argument function — a **leaf** test that is expected to currently fail:

```ts
export const proof = {
    // currently buggy: add(2)(3) !== 5, so the assert throws.
    // Under `todo`, throwing is the EXPECTED outcome → CI stays green.
    todo: () => { assertEq(add(2)(3), 5) },
}
```

**The signal on fix.** A `todo` leaf passes (CI green) only while it throws. Once
the bug is fixed the assertion stops throwing and the leaf returns normally —
which under `todo` is now a **failure (red)**. That red is the reminder: rename
the `todo` key and the proof becomes an ordinary, permanently-green test.

#### Two flags, XOR for inversion, OR for leaf-ness

Two booleans are derived from a leaf's position in the tree:

- **`throws`** — *inherited*: at least one ancestor key on the path is `throw`
  (OR-accumulated, exactly as today).
- **`todo`** — *local*: the leaf's own last key is `todo`. Not inherited, not
  accumulated.

Everything follows from these two:

| derived        | formula            | drives                                                                        |
|----------------|--------------------|-------------------------------------------------------------------------------|
| `expectFailure`| `throws !== todo`  | result inversion; the `expectFailure` bit passed to external runners          |
| `leafOnly`     | `throws \|\| todo` | skip the return-value walk; don't register subtests; no ` ...` star suffix     |

`throw` already sets both (`expectFailure` when `throws && !todo`, `leafOnly`
when `throws`); `todo` simply adds the second bit.

The XOR truth table:

| proof                      | `throws` (parent `throw`) | `todo` (last key) | `expectFailure` | green today when… |
|----------------------------|---------------------------|-------------------|-----------------|-------------------|
| `{ add: fn }`              | false                     | false             | **false**       | returns normally  |
| `{ throw: { x: fn } }`     | true                      | false             | **true**        | throws            |
| `{ todo: fn }`             | false                     | true              | **true**        | throws            |
| `{ throw: { todo: fn } }`  | true                      | true              | **false**       | returns normally  |

The last row is a `throw` proof whose throw is itself the unfinished work: it is
expected to currently *not* throw, so today's non-throwing behaviour keeps CI
green, and the day it starts throwing it flips red.

```ts
export const proof = {
    throw: {
        // a throw-proof that is not implemented yet: the function does NOT
        // throw today. Under throw+todo the expectation is "returns normally",
        // so the current non-throwing behaviour keeps CI green.
        todo: () => doesNotThrowYet(),
    },
}
```

#### `todo` is always a pure leaf

`todo` is strictly local to the leaf, and **its return value is never walked**,
in either XOR direction:

- `{ todo: fn }` — must throw; if it returns, that is the fixed-signal (red).
- `{ throw: { todo: fn } }` — must return; if it throws, red. The return value
  is still ignored — `todo` never spawns subtests.

This makes `todo` simpler than `throw`: `throw` skips the walk only as a side
effect of being inverted, whereas `todo` skips it as its own rule. It also
resolves the generator case unambiguously — `todo: () => ({ a, b, c })` returns
instead of throwing, so it is **red**, and `{ a, b, c }` are never run. To
capture *generated* todo cases, nest the key inside a *normal* generator's
output, which is walked as usual:

```ts
export const proof = {
    gen: () => ({           // a normal test: its return value IS walked
        works: okCase,
        broken: { todo: brokenCase },   // the `todo` key is picked up by the walk
    }),
}
```

#### Static guard

Because `todo` is a *local* last-key rule (not an inherited region), the
invariant "a `todo` key holds a zero-argument function" is checkable
structurally at `collectTests` time. `todo: { … }` or `todo: (x) => …` should be
a clear structural error rather than a silent no-op. (A generator
`todo: () => ({…})` still passes this static check — it *is* a zero-arg
function — and still reds at runtime, as above.)

#### Counting as technical debt

A `todo` leaf is still a real test: its pass/fail verdict (after XOR inversion)
goes into the **common `pass` / `fail` counters**, exactly like any other leaf.
On top of that, the built-in `fjs t` runner counts **every** `todo` leaf — both
the green (still-failing) and the red (now-fixed) ones — into a separate `todo`
tally and prints it in the summary (`pass / fail / todo`). That number is a
visible technical-debt indicator: how many captured-but-unfinished behaviours
the codebase is carrying.

This extra tally lives only in the self-hosted runner. The `register` path hands
each leaf to an external framework one at a time and has no place to accumulate a
cross-test count, so external runners report only their native pass/fail — the
`todo` tally is a `fjs t`-only summary enrichment, not a verdict, so it does not
diverge runner behaviour.

#### Pairing with `todo/` design docs

A `todo` test and a `todo/{slug}.md` issue document are two halves of the same
act: the markdown captures the *design* of an unfinished behaviour, the `todo`
test captures it *executably*. Filing one without the other loses something —
the doc alone rots silently, the test alone has no rationale. So when an agent
files a `todo/{slug}.md`, it should, where the behaviour is testable, also add a
`todo` test that fails today and will flip red when the behaviour lands.

Group related `todo` leaves under descriptive parent keys so the path reads as a
specification of the not-yet-working surface:

```ts
export const proof = {
    mcpShouldWork: {
        cas_add: { todo: () => { mcp.cas_add() } },
        cas_get: { todo: () => { mcp.cas_get() } },
    },
}
```

Paths `.mcpShouldWork.cas_add.todo` and `.mcpShouldWork.cas_get.todo` each name a
single expected-to-currently-fail leaf; each flips red independently as its
behaviour is implemented.

`AGENTS.md` should be updated to encourage this pairing alongside the existing
`todo/` issue-filing guidance (the section beginning "Issues are tracked in
`todo/` directories"): when filing a `todo/{slug}.md` for a testable behaviour,
add a matching `todo` test, and when fixing it, remove the `todo` marker in the
same change that deletes the issue file.

### Implementation

All changes are local to `fjs/emergent_testing/module.f.ts` plus its proof and
docs, mirroring the existing `throws` plumbing:

- **`TestEntry`** — add a `readonly todo: boolean` next to `throws`. Derive
  `expectFailure = throws !== todo` (XOR) and `leafOnly = throws || todo` (OR).
- **`parseTestSet` / `collectTests`** — keep `throws` inherited
  (`throws || ck === 'throw'`); set `todo` from the leaf's own last key only.
  Enforce the static guard when a `todo` key is encountered.
- **`defaultTest`** — `invert` the sandbox result when `expectFailure` (instead
  of `throws`).
- **`runModule`** — skip the return-value walk when `leafOnly` (instead of
  `throws`).
- **`registerModule`** — register with `expectFailure`; skip subtest
  registration when `leafOnly`; drop the ` ...` star suffix when `leafOnly`.
- **Reporter** — give `Reporter.result` the entry flags (pass the `TestEntry`
  instead of a bare `throws` boolean) so `defaultReporter` can annotate a passing
  leaf with `# TODO` when `todo` is set, otherwise keep `# EXPECTED TO THROW`.
  The GitHub/error path is unchanged.
- **`TestState` / summary (`fjs t` only)** — add a `todo` counter to `TestState`,
  incremented for every `todo` leaf in `runModule` (independently of whether it
  passed or failed; its pass/fail still increments `pass`/`fail` as usual).
  Extend `Reporter.summary` to receive the `todo` count and have `defaultReporter`
  print it (`pass / fail / todo`). The `register` path is unchanged — no
  cross-test tally there.
- **No `fn.name === 'todo'` check** — `todo` is structural-key-only, matching the
  guidance around the legacy `fn.name === 'throw'` path.

### Migration

This rule reinterprets existing `fjs/emergent_testing/example.f.ts`:

```ts
export const todo = () => { throw "not implemented" }
// …
throw: {
    todo,                       // ← last key is now `todo`
    divByZero: () => 5n / 0n,
},
```

Today `throw.todo` passes (it throws, throw-context expects a throw). Under the
new rule it becomes `throws=true XOR todo=true = false` → expected to *return* →
but it throws → **red**. The example must be migrated (rename the key, or move it
out from under `throw`) as part of landing this change.

### Open questions

- Annotation wording: `# TODO` vs `# KNOWN BUG`. `# TODO` is proposed.

### Tasks

- [ ] Add `todo` to `TestEntry`; derive `expectFailure` (XOR) and `leafOnly`
      (OR) in `fjs/emergent_testing/module.f.ts`.
- [ ] Set `todo` from the leaf's last key in `parseTestSet` / `collectTests`,
      keep `throws` inherited, and add the "`todo` key holds a zero-arg function"
      static guard.
- [ ] Switch inversion to `expectFailure` (`defaultTest`) and walk/registration
      skipping + star suffix to `leafOnly` (`runModule`, `registerModule`).
- [ ] Update `Reporter.result` to receive the entry flags and annotate passing
      `todo` leaves with `# TODO`.
- [ ] Add a `todo` counter to `TestState`/`Reporter.summary` and print
      `pass / fail / todo` in `defaultReporter` (`fjs t` only; `register`
      unchanged).
- [ ] Migrate `fjs/emergent_testing/example.f.ts` off `throw: { todo }`.
- [ ] Add proofs in `fjs/emergent_testing/proof.f.ts` for: `todo` green on throw,
      `todo` red when it returns, `throw.todo` green on return / red on throw, the
      never-walk-subtests rule, and the static guard rejecting a non-function
      `todo`.
- [ ] Document `todo` in `fjs/emergent_testing/README.md` next to the
      "Throw tests" section.
- [ ] Update `AGENTS.md` to encourage pairing a `todo` test with a
      `todo/{slug}.md` issue (and removing the `todo` marker when the issue file
      is deleted on fix).
- [ ] Confirm `fjs t` proofs pass with full branch coverage and `npx tsc` is
      clean.

### Related

- `fjs/emergent_testing/module.f.ts` "Throw tests" — `todo` reuses the same
  structural-key inversion mechanism; this proposal adds a second, *local* flag
  combined with the inherited `throws` flag via XOR (inversion) and OR
  (leaf-ness).
- [skip-property](./skip-property.md) — `todo` assumes the expectation is
  uniform across engines and the test is safe to execute; `skip` covers the
  cases where it is not (engine-dependent outcomes, harmful-to-run tests).
