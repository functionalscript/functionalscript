# 667-test-conventions. Test conventions

**Priority:** P2
**Status:** open

## Problem

The current `npm test` command conflates type-checking, Node's built-in test runner, and coverage into one slow command. The FunctionalScript-native test runner (`fjs t`) is a separate `npm run fst` that developers must remember to run manually. CI has no dedicated coverage step.

Current state:
```json
"test": "tsc && node --test --experimental-test-coverage --test-coverage-include=**/module.f.ts"
"fst":  "node ./fs/fjs/module.ts t"
```

Desired split:
- **`npm test`** — fast feedback loop: `tsc && node ./fs/fjs/module.ts t`
  - Type-checks, then runs the FunctionalScript-native test suite.
  - Replaces the need for a separate `npm run fst`.
- **`node --test`** — Node's built-in test runner; run by CI as a separate job/step.
- **`npm run cov`** — coverage: `node --test --experimental-test-coverage --test-coverage-include=**/module.f.ts`; run by CI as a dedicated step.

## Proposal

1. Change `"test"` in `package.json` to `tsc && node ./fs/fjs/module.ts t`.
2. Add `"cov": "node --test --experimental-test-coverage --test-coverage-include=**/module.f.ts"`.
3. Remove `"fst"` (superseded by the new `npm test`).
4. Update CI (`fs/ci/module.f.ts`) to run both `node --test` and `npm run cov` as separate steps.

## Related

- `package.json` — scripts
- `fs/ci/module.f.ts` — CI workflow generator
