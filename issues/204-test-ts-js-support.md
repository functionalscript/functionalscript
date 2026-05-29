# 204. A new suffix for plain TS/JS files using FunctionalScript conventions

## Problem

FunctionalScript's test conventions (zero-argument exported functions, `throw` key,
return-value sub-trees) are useful beyond FunctionalScript modules. A plain TypeScript
or JavaScript project should be able to adopt `fjs t` or the `register` bridge without
renaming all files to `.f.ts`.

Extending `isTest` to also match `*.test.ts` / `*.test.js` is **not** the right fix:
those suffixes are auto-discovered by bun, node `--test`, and Playwright. The
`all.test.ts` entry point itself ends in `.test.ts` — loading it as a test module
would cause double registration.

## Proposal

Define a new infix convention for plain TS/JS files that follow FunctionalScript's
test conventions but are not FunctionalScript modules (no `.f.`):

| Kind | Suffix | Auto-discovered by frameworks? | Loaded by `loadModuleMap`? |
|------|--------|-------------------------------|---------------------------|
| FunctionalScript module | `.test.f.ts` / `.test.f.js` | No | Yes |
| Plain TS/JS (FunctionalScript conventions) | `.<new>.ts` / `.<new>.js` | No | Yes (after this issue) |
| Framework entry point | `.test.ts` | Yes | No (must stay excluded) |

### Suffixes already claimed by other frameworks (must not use)

| Suffix | Claimed by |
|--------|-----------|
| `*.test.ts` / `*.test.js` | Node `--test`, Bun, Playwright, Jest, Vitest, Deno |
| `*.spec.ts` / `*.spec.js` | Bun, Playwright, Jest, Vitest |
| `*_test.ts` / `*_test.js` | Deno |
| `test.ts` / `test.js` (filename) | Node `--test` |
| `*.test.tsx` / `*.test.jsx` | Bun, Playwright, Jest, Vitest |
| `*.spec.tsx` / `*.spec.jsx` | Bun, Playwright, Jest, Vitest |
| anything inside `__tests__/` | Jest, Bun |
| anything inside `test/` or `tests/` | Bun, Node `--test` |

### Candidate suffixes (safe)

Any suffix that does not end in `.test.ts`, `.spec.ts`, `_test.ts` (and `.js` variants)
is safe. The `.f.` infix trick works because frameworks match the *ending*, not a
substring.

| Suffix | Notes |
|--------|-------|
| `.ftest.ts` / `.ftest.js` | compact; `f` for FunctionalScript convention |
| `.fstest.ts` / `.fstest.js` | more explicit `fs` prefix |
| `.test.f.ts` | already used — FunctionalScript pure-functional modules only |
| `.test.r.ts` / `.test.r.js` | mirrors `.test.f.ts`; `r` for "regular" (non-pure-functional) |
| `.test.p.ts` / `.test.p.js` | `p` for "plain" |
| `.t.ts` / `.t.js` | minimal; mirrors `.f.ts`; risk of collision with hand-written abbreviations |
| `.check.ts` / `.check.js` | avoids the word "test" entirely; no framework claims it |
| `.exam.ts` / `.exam.js` | short for "examination"; no framework claims it |
| `.proof.ts` / `.proof.js` | fits FunctionalScript's functional philosophy — proving correctness rather than "testing" imperatively; mirrors the formal-proof connotation of type theory; no framework claims it |
| `.law.ts` / `.law.js` | very FP-idiomatic — algebraic structures satisfy "laws" (functor laws, monad laws); a zero-argument function that doesn't throw is literally a law holding; no framework claims it |
| `.prop.ts` / `.prop.js` | "property" as in property-based testing; properties that must hold; no framework claims it |
| `.theorem.ts` / `.theorem.js` | a proven mathematical statement; heavier than `.proof.ts` but precise; no framework claims it |
| `.lemma.ts` / `.lemma.js` | a supporting proven result; fits test files that are building blocks for larger proofs; no framework claims it |

**Avoid:**
- `.test.m.ts` — `.mts` is a Node ESM extension; confusing even if technically safe

Note: `.test.f.ts` is already safe because frameworks match `*.test.ts` (ends in `.test.ts`),
and `foo.test.f.ts` ends in `.f.ts`, not `.test.ts`.

### Recommended candidate

**`.proof.f.ts` / `.proof.f.js`** for FunctionalScript modules and **`.proof.ts` / `.proof.js`** for plain TS/JS files.

This creates a clean parallel naming scheme:

| Kind | Suffix |
|------|--------|
| FunctionalScript module (existing) | `.test.f.ts` / `.test.f.js` |
| FunctionalScript proof | `.proof.f.ts` / `.proof.f.js` |
| Plain TS/JS proof | `.proof.ts` / `.proof.js` |

The `.f.` infix carries its standard meaning (FunctionalScript module); "proof" replaces
"test" throughout. Neither suffix is auto-discovered by any framework. `isTest` would be
extended to match all four suffixes.

The chosen suffix is added to `isTest` alongside `.test.f.ts` / `.test.f.js`.

## Related

- [i205](./205-rename-all-test.md) — `all.test.ts` naming; must keep `.test.ts` for
  auto-discovery
- [i183](./183-tf-framework-scenario-tests.md) — scenario runner
