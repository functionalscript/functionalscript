## Prove each module's coverage by its own proof

**Priority:** P2
**Status:** open

### Problem

`npm run cov` runs every proof at once and then checks coverage. A module
passes when *any* proof reaches its code, not when its own proof does, which is
what [`fjs/AGENTS.md`](../../AGENTS.md#12-proof-coverage-is-mandatory)
requires. At `78c51a1d`, `fjs/types/list/module.f.mjs` passes, but its own
proof leaves a branch of `lengthList` unreached.

It is also slow: at `78c51a1d`, about six minutes for the whole suite, so only
CI runs it. One module under coverage took about half a second.

### Proposal

Check each module in its own run: only its `proof.f.mjs` executes and only its
module is measured. The working directory selects the module; no arguments, no
environment variables.

1. **`fjs/emergent_testing/one.mjs`** registers the `proof.f.mjs` in the
   working directory, and nothing else, with the runner that imports it. With
   coverage flags it checks that module; without them it tests it:

   ```sh
   cd fjs/types/list
   node --test ../../emergent_testing/one.mjs
   ```

   Its name matches no runner's default discovery pattern and not
   `shouldLoad`, so only an explicit command runs it. A directory without a
   `proof.f.mjs` is an error.

2. **`fjs cov node`** runs `one.mjs` with 100% line, branch and function
   thresholds once per module under the working directory, each in its own
   process. Locally, run it in the module you changed; CI runs it from the
   root, in parallel, instead of `npm run cov`.

3. **`fjs cov deno`** and **`fjs cov bun`**, the same for the other runners.

Fix the proofs the switch exposes instead of allowing exceptions.

### Tasks

- [ ] `one.mjs`
- [ ] `fjs cov node`, used by CI
- [ ] Fix the exposed proofs
- [ ] `fjs cov deno`, `fjs cov bun`

### Related

- [run-subset-of-tests](./run-subset-of-tests.md) — general test selection
- [check-set-ci-parity](../../../todo/check-set-ci-parity.md) — coverage in the
  local check set
