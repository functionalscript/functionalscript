## Preserve Effects variance in JSDoc

**Priority:** P1
**Status:** open

### Problem

The stage-1 TypeScript-to-`.mjs` migration moves static types from TypeScript
syntax into JSDoc. Most syntax can be translated directly, but the Effects API
currently relies on explicit TypeScript variance annotations that JSDoc cannot
express.

In `fjs/effects/module.f.ts`, both `Cont<out O, T>` and `Do<out O, T>` use
`out O` deliberately. The surrounding documentation explains that TypeScript
cannot infer the required covariance through `Pr`: the effect operation set may
widen (`Effect<A, T>` to `Effect<A | B, T>`) but must not narrow. Removing the
annotations mechanically would therefore change assignability even if the
runtime JavaScript stayed identical.

Migrating this file to `.f.mjs` without preserving that contract would violate
the repository migration requirement to preserve type checking and generated
declarations.

### Proposal

Keep `fjs/effects/module.f.ts` as TypeScript until the Effects type surface can
express the same covariance using JSDoc-supported types. Its `.f.ts` -> `.f.mjs`
migration is **blocked by** this task.

Preserve the current semantic contract rather than the current spelling:

- widening an operation set remains assignable;
- narrowing an operation set remains rejected;
- `Cont`, `Do`, and `Effect` keep their current public behavior;
- generated declarations preserve the same assignability for package consumers.

Use the simplest JSDoc-representable type design that satisfies those proofs.
The implementation may refactor `Cont`, `Do`, `Pr`, or related type aliases if
needed; this TODO does not require a particular representation. Avoid changing
the runtime effect representation unless preserving the type contract requires
it.

Add focused type proofs before removing the explicit `out` annotations. The
proofs must exercise both the allowed widening direction and the rejected
narrowing direction, and must continue to pass after the source is converted to
JSDoc and declaration emission produces `.d.mts`.

### Tasks

- [ ] Add type proofs for operation-set covariance and rejected narrowing around
      `Effect`, `Do`, and `Cont`.
- [ ] Find a JSDoc-supported representation that passes those proofs without
      explicit TypeScript variance annotations.
- [ ] Keep the existing runtime representation unless a type-preserving redesign
      requires a runtime change.
- [ ] Verify repository type checking and emitted declarations preserve the
      current public assignability contract.
- [ ] Only then migrate `fjs/effects/module.f.ts` and any coupled Effects files
      to `.f.mjs`.

### Acceptance criteria

- No explicit TypeScript variance annotation is required by the authored Effects
  source.
- The allowed operation-set widening direction still type-checks.
- The corresponding narrowing direction is still rejected.
- `Cont`, `Do`, and `Effect` preserve their public type behavior.
- Emitted declarations from the JSDoc source preserve the same contract for a
  clean package consumer.
- `fjs/effects/module.f.ts` can then participate in the repository-wide `.f.ts`
  -> `.f.mjs` migration without weakening type safety.

### Related

- [`todo/migrate-typescript-to-mjs.md`](../../../todo/migrate-typescript-to-mjs.md)
  — repository-wide migration blocked on this task for the Effects module.
- [`fjs/effects/module.f.ts`](../module.f.ts) — current explicit `out O`
  annotations and their soundness rationale.
