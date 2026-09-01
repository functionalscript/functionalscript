# Current Priority Tasks

> Keep this file in the repository.

- [ ] Browser Test
- [ ] NiX:
  - [ ] NiX lockfile should be generate in `npm run ci-update` for the drift test in CI.
- [ ] Investigate `npm run dev-update`. It updates unrelated to development files but doesn't update Rust generated files. Proposal: two scripts:
  - [ ] `npm run dev-update` scripts: run code generator
  - [ ] `npm run update` additionally to `npm run dev-update` it should also regenerate lock files (NiX, package-lock.json, deno.lock, bun.lock, Cargo.lock).
- [ ] FunctionalScript
  - [ ] AST to EDAG
- [ ] DataJS
  - [ ] LL1 parser should support `Meta` propagation.
  - [ ] Check the `repeat` rule
  - [ ] Rule Transformers in the flow style (SHA2 and BNF.Map.Repeat)
  - [ ] Map creation helpers
  - [ ] checkMap should support `Meta`
  - [ ] rename `checkMap`.
  - [ ] Consider `checkMap` returns simplified map using DataRules. We may need root rule in this case.
  - [ ] Parser that apply map rules.
  - [ ] LL1 parser preparation should fail on non-LL1 grammar.
- [ ] Website Module Browsing
