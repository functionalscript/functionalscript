## 028-unit-test-examples-api. Distinguish proofs, examples, and public API coverage

**Priority:** P3
**Status:** open

### Problem

FunctionalScript has several related but different validation/documentation
needs:

- cheap deterministic invariants that should run whenever a module is loaded;
- executable proofs that the emergent testing runner discovers and runs;
- public examples that document how exported API values are intended to be used;
- black-box API coverage that should only depend on public exports.

The old `*test.f.ts` / `*example.f.ts` split does not match the current proof
runner conventions. The repository now discovers proof modules by their
`export const proof` value, while examples still lack a clear convention.

### Proposal

Use these conventions:

- **Module-level assertions** are allowed for tiny, deterministic invariants
  that should run on every import.
- **Executable proofs** use `export const proof = ...`.
  - Co-located `proof` values are white-box unit proofs and may test private
    implementation details.
  - Separate `proof.f.ts` modules are black-box/API proofs and should import
    only the public API.
- **Examples** use `export const examples = ...` in the module that defines the
  public API.

Example keys should match the names of exported values. That gives tooling a
simple invariant: every top-level example group describes a real public export,
and renaming an export forces the matching example name to change too.

```ts
import { assertEq } from '../asserts/module.f.ts'

const normalizeRoot = (s: string): string => s === '' ? '.' : s

export const normalize = (path: string): string => normalizeRoot(path)

assertEq(normalizeRoot(''), '.')

export const examples = {
    normalize: {
        emptyPath: () => assertEq(normalize(''), '.'),
        unchangedPath: () => assertEq(normalize('a/b'), 'a/b'),
    },
}

export const proof = {
    normalizeRoot: {
        empty: () => assertEq(normalizeRoot(''), '.'),
        nonEmpty: () => assertEq(normalizeRoot('a'), 'a'),
    },
}
```

In this example:

- `normalize` is public API.
- `examples.normalize` matches the exported `normalize` name and uses only the
  public function.
- `proof.normalizeRoot` is a white-box proof for a private helper.
- The module-level assertion is intentionally tiny because it runs on every
  import.

### Tasks

- [ ] Define the `export const examples = ...` shape.
- [ ] Decide whether examples are executable by the proof runner, extracted by
  documentation tooling, or both.
- [ ] Add tooling that checks top-level example keys against exported names.
- [ ] Document how examples differ from `export const proof`.
- [ ] Update one small module as the reference example.

### Related

- [i664-file-type-conventions](../../issues/664-file-type-conventions.md) — file naming
  conventions for modules and proof modules.
- [i668-emergent-testing-proof-type](todo.md) —
  explicit proof-tree type.
