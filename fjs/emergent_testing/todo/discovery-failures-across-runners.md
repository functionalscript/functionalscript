## discovery-failures-across-runners. Make discovery failures fail every runner alike

**Priority:** P2
**Status:** open

### Problem

A module that throws while loading is now a failed test on `fjs t`, Node,
Bun and Deno: `proofEntries` in `../module.f.mjs` turns the failed import
into a proof whose one leaf throws the load error. Two related gaps remain.

1. **`all.test.mjs` ignores `register`'s exit code.** It runs
   `await runEffect(register)` and discards the result. `register` reports a
   discovery failure that is still a whole-run failure — a source root that
   cannot be listed, an unrecognized effect — as exit code `1` with the
   reason on `stderr`. The external framework then counts `all.test.mjs`
   itself as passed, and the run exits `0` with zero proofs registered.
   Before load failures became tests, this is how `node --test` reported a
   failing module-level `assert` as a pass.
2. **The browser stops the whole suite when one module fails to load.**
   `loadProofs` in `../browser/module.f.mjs` answers `['failed', rejected]`
   when any module is rejected ("a partial suite reported as a whole one is
   worse than a refusal"). The Node-side runners now report the failure as
   one failed test and run the remaining modules. The two policies disagree,
   and the user sees a different answer depending on the runner.

### Proposal

1. Have `all.test.mjs` fail when `register` answers a non-zero code — for
   example, throw from the module's top level so the framework reports the
   entry file as failed — and keep the reason on `stderr`.
2. Pick one policy for load failures and apply it in both places. The
   conservative choice is the Node one: report a module that fails to load
   as a failed test and still run its neighbours. The browser would then keep
   the rejected modules as failed rows beside the leaves that ran, rather
   than answering `failed` for the whole suite.

### Tasks

- [ ] `all.test.mjs` fails the external run on a non-zero `register` code;
      prove it with a mocked `register` that answers an error.
- [ ] Decide the load-failure policy and record it in `../README.md`.
- [ ] Align `loadProofs` (or the Node path) with it, with proof coverage.

### Related

- [661-test-runner-behavior](./661-test-runner-behavior.md) — documents how
  each runner handles tests; the load-failure policy belongs there too.
- [browser-testing](./browser-testing.md) — browser runner design, including
  how module-loading failures are reported.
