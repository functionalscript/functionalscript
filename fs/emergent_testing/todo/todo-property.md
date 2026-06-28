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

The existing `throw` marker (`fs/emergent_testing/module.f.ts`) already
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

### Implementation

All changes are local to `fs/emergent_testing/module.f.ts` plus its proof and
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
- **No `fn.name === 'todo'` check** — `todo` is structural-key-only, matching the
  guidance around the legacy `fn.name === 'throw'` path.

### Migration

This rule reinterprets existing `fs/emergent_testing/example.f.ts`:

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
- Whether `todo` leaves should be counted separately in the summary
  (`pass / fail / todo`) instead of silently counting as a pass. Starting simple
  (counts as pass) is proposed; a dedicated counter can be a follow-up.

### Tasks

- [ ] Add `todo` to `TestEntry`; derive `expectFailure` (XOR) and `leafOnly`
      (OR) in `fs/emergent_testing/module.f.ts`.
- [ ] Set `todo` from the leaf's last key in `parseTestSet` / `collectTests`,
      keep `throws` inherited, and add the "`todo` key holds a zero-arg function"
      static guard.
- [ ] Switch inversion to `expectFailure` (`defaultTest`) and walk/registration
      skipping + star suffix to `leafOnly` (`runModule`, `registerModule`).
- [ ] Update `Reporter.result` to receive the entry flags and annotate passing
      `todo` leaves with `# TODO`.
- [ ] Migrate `fs/emergent_testing/example.f.ts` off `throw: { todo }`.
- [ ] Add proofs in `fs/emergent_testing/proof.f.ts` for: `todo` green on throw,
      `todo` red when it returns, `throw.todo` green on return / red on throw, the
      never-walk-subtests rule, and the static guard rejecting a non-function
      `todo`.
- [ ] Document `todo` in `fs/emergent_testing/README.md` next to the
      "Throw tests" section.
- [ ] Confirm `fjs t` proofs pass with full branch coverage and `npx tsc` is
      clean.

### Related

- `fs/emergent_testing/module.f.ts` "Throw tests" — `todo` reuses the same
  structural-key inversion mechanism; this proposal adds a second, *local* flag
  combined with the inherited `throws` flag via XOR (inversion) and OR
  (leaf-ness).
