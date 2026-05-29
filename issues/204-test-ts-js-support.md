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

- `.ftest.ts` / `.ftest.js` — compact, no framework uses this pattern
- `.test.r.ts` / `.test.r.js` — mirrors `.test.f.ts`; `r` for "regular" (not pure functional)
- `.test.m.ts` — avoid: `.mts` is a valid Node ESM extension and may cause confusion

Note: `.test.f.ts` is already safe because frameworks match `*.test.ts` (ends in `.test.ts`),
and `foo.test.f.ts` ends in `.f.ts`, not `.test.ts`.

The chosen suffix is added to `isTest` alongside `.test.f.ts` / `.test.f.js`.

## Related

- [i205](./205-rename-all-test.md) — `all.test.ts` naming; must keep `.test.ts` for
  auto-discovery
- [i183](./183-tf-framework-scenario-tests.md) — scenario runner
