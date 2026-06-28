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
behaviour is fixed, flip the test green so we are reminded to remove the
marker."

The existing `throw` marker (`fs/emergent_testing/module.f.ts`) already
demonstrates the mechanism we want: a structural property key in the proof tree
that *inverts* the pass/fail expectation for every leaf reachable through it.

### Proposal

Add a second structural marker, `todo`, alongside `throw`. Like `throw`, it is a
property key anywhere in the proof tree; every test case reachable through it
inherits the expectation.

```ts
export const proof = {
    todo: {
        // currently buggy: add(2)(3) !== 5, so the assert throws.
        // Under `todo`, the throw is the EXPECTED outcome → CI stays green.
        add: () => { assertEq(add(2)(3), 5) },
    },
}
```

`todo` is an **inversion flag, independent of `throw`**. The effective
expectation of a leaf is the XOR of the two flags:

| path context        | `throws` | `todo` | leaf passes when | meaning |
|---------------------|----------|--------|------------------|---------|
| normal              | false    | false  | returns normally | ordinary proof |
| `throw`             | true     | false  | throws           | expected-to-throw proof |
| `todo`              | false    | true   | throws           | captured bug: expected to fail today |
| `todo` + `throw`    | true     | true   | returns normally | a `throw` proof whose throw is the bug |

So a plain `todo` test behaves like a `throw` test (it must currently fail/throw
to be green), and combining `todo` with `throw` cancels back to a normal
expectation:

```ts
export const proof = {
    todo: {
        throw: {
            // a throw-proof that is currently broken: the function does NOT
            // throw yet. Under todo+throw the expectation is "returns normally",
            // so today's non-throwing behaviour keeps CI green.
            divByZero: () => someValueThatShouldButDoesNotThrow(),
        },
    },
}
```

**The signal on fix.** Because `todo` inverts, once the underlying bug is fixed
the test starts *passing the assertion* (returning normally), which under `todo`
is now a **failure**. That red is the reminder: rename/remove the `todo` key and
the proof becomes a normal, permanently-green test.

### Implementation sketch

All changes are local to `fs/emergent_testing/module.f.ts` plus its proof and
docs. The shape mirrors the existing `throws` plumbing:

- **`TestEntry`** — add a `readonly todo: boolean` field next to `throws`, and a
  helper `expectFailure = ({ throws, todo }) => throws !== todo` (the XOR). Every
  current consumer of `set.throws` for *inversion* (`defaultTest`'s `invert`,
  `runModule`'s sub-tree-walk guard, `registerModule`'s name suffix and the
  `expectFailure` flag passed to `test(...)`) switches to `expectFailure(set)`.
- **`parseTestSet` / `collectTests`** — thread a parallel `todo` boolean exactly
  as `throws` is threaded, OR-accumulating it when a `todo` key is seen
  (`todo || ck === 'todo'`). Keep `throws` and `todo` as *separate*
  OR-accumulated flags so nested keys behave intuitively and only the final XOR
  decides inversion (folding both into one XOR'd flag would make `throw` nested
  in `throw` wrongly cancel).
- **Reporter** — give `Reporter.result` access to the entry's flags (pass the
  `TestEntry`/`set` instead of a bare `throws` boolean). `defaultReporter`
  annotates a passing leaf with `# TODO` when `todo` is set, otherwise keeps
  `# EXPECTED TO THROW` when it is a throw test. The GitHub/error path is
  unchanged.
- **No `fn.name === 'todo'` check.** Unlike the legacy `fn.name === 'throw'`
  path, `todo` is structural-key-only. Note `fs/emergent_testing/example.f.ts`
  already exports a function literally named `todo` and uses it under `throw:`;
  a name-based `todo` rule would collide with it.

### Open questions

- Annotation wording: `# TODO` vs `# KNOWN BUG` vs reusing
  `# EXPECTED TO THROW`. `# TODO` is proposed.
- Whether a `todo` count should be reported separately in the summary
  (`pass / fail / todo`) instead of silently counting as a pass. Starting simple
  (counts as pass) is proposed; a dedicated counter can be a follow-up.
- Whether to also support `todo` as a per-leaf wrapper rather than only a
  structural key. Structural-only (matching `throw`) is proposed for symmetry.

### Tasks

- [ ] Add `todo` to `TestEntry` and the `expectFailure` XOR helper in
      `fs/emergent_testing/module.f.ts`.
- [ ] Thread the `todo` flag through `parseTestSet` and `collectTests`
      alongside `throws`.
- [ ] Switch inversion sites (`defaultTest`, `runModule`, `registerModule`) from
      `throws` to `expectFailure`.
- [ ] Update `Reporter.result` to receive the entry flags and annotate passing
      `todo` leaves with `# TODO`.
- [ ] Add proofs in `fs/emergent_testing/proof.f.ts` for: plain `todo` passing on
      throw, `todo` failing when the function returns normally, and the
      `todo` + `throw` cancellation (both directions).
- [ ] Document `todo` in `fs/emergent_testing/README.md` next to the
      "Throw tests" section.
- [ ] Confirm `fjs t` proofs pass with full branch coverage and `npx tsc` is
      clean.

### Related

- `fs/emergent_testing/module.f.ts` "Throw tests" — `todo` reuses the same
  structural-key inversion mechanism; this proposal generalizes the single
  `throws` flag into a `throws`/`todo` XOR.
