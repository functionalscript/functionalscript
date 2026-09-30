## Prove each module's coverage by its own proof

**Priority:** P2
**Status:** open

### Problem

Two things are wrong with how proof coverage is checked today.

**It asks the wrong question.** `npm run cov` runs every proof in one
`node --test` run and then checks 100% line, branch and function coverage of
every `module.f.mjs`. A module passes when *any* proof in the repository
reaches its code, not when its own proof does. The rule is that each module
ships a co-located `proof.f.mjs` with 100% proof coverage
([`fjs/AGENTS.md`](../../AGENTS.md#12-proof-coverage-is-mandatory)); the
aggregate run cannot see a module whose proof leans on other modules' proofs.
At `78c51a1d`, `fjs/types/list/module.f.mjs` is 100% covered in the aggregate
run, while its own proof alone leaves a branch of `lengthList` unreached.

**It is too slow to run locally.** The whole suite runs under coverage in one
go, so nobody runs it before pushing and only CI enforces it
([check-set-ci-parity](../../../todo/check-set-ci-parity.md)). At `78c51a1d`,
on a four-core machine with Node 22, `fjs t` took about 2m45s and
`npm run cov` about 6m15s, while one module's proof under coverage took about
half a second. A developer or agent needs coverage only for the modules they
changed; CI needs it for all of them, and all of them are independent, so CI
can run them in parallel.

### Proposal

Check each module in its own run, where only its co-located proof executes and
only the module itself is measured. Deliver it in stages.

**Stage 1 — a single-module entry, `fjs/emergent_testing/one.mjs`.** The
counterpart of `all.test.mjs`: it registers exactly the `proof.f.mjs` in the
working directory with whichever runner imports it — not the proofs in
subdirectories, which `fjs t` run from a directory still picks up. The working
directory is the only input; the entry reads no environment variable and no
argument. It is useful without coverage, as "test this one module":

```sh
cd fjs/types/list
node --test ../../emergent_testing/one.mjs
```

and it is the coverage check when the thresholds are added:

```sh
cd fjs/types/list
node --test --experimental-test-coverage \
    --test-coverage-include='**/fjs/types/list/module.f.mjs' \
    --test-coverage-lines=100 --test-coverage-branches=100 \
    --test-coverage-functions=100 \
    ../../emergent_testing/one.mjs
```

The name matters. It must match none of the default discovery patterns —
Node's `*.test.*`, `*-test.*`, `*_test.*`, `test-*.*`, `test.*` and `test/`;
Deno's `*_test.*`, `*.test.*` and `test.*`; Bun's, which add `*.spec.*` and
`*_spec.*` — so a bare `node --test`, `deno test` or `bun test` never picks it
up. It must not end in `proof.mjs` or `.f.mjs` either, or `shouldLoad` in
[`fjs/dev/module.f.mjs`](../../dev/module.f.mjs) makes `fjs t` import it. A
file named explicitly on the command line runs regardless of its name.

A directory without a `proof.f.mjs` is an error, not an empty run that exits 0
([DESIGN.md §10](../../../doc/DESIGN.md#10-refuse-what-you-cannot-handle)).
`one.mjs` stays a thin effectful wrapper like `all.test.mjs`; choosing and
validating the one proof to register is FunctionalScript with a proof.

**Stage 2 — `fjs cov node [dir…]`.** Runs stage 1's command once per module,
each in its own process with that module's directory as the working directory:
handing one `node --test` run several entry files merges their coverage and
reintroduces the aggregate problem. With directories, it checks those modules —
what a developer or agent runs for the modules they changed. With none, it
checks every module, several processes at a time — what CI runs, as one step.
It replaces `npm run cov` in the generated workflow (`fjs/ci`).

**Stage 3 — `fjs cov deno` and `fjs cov bun`.** The same contract on the
other runners, replacing `deno task cov` and `bun test --coverage` in CI.

**Close the gaps the switch exposes.** Every module whose proof relies on
other proofs today fails its own run. Fix those proofs rather than keep an
allowlist of exceptions.

### Open questions

- **What counts as a module.** Today's include is `module.f.mjs` and
  `module.f.js`. Other FunctionalScript files — `testlib.f.mjs`, `demo.f.mjs`,
  `*.proof.f.mjs` — are either measured through the module that owns them or
  given a rule of their own.
- **Directories that do not pair up.** A few modules have no proof (for
  example `effects/mock`) and a few proofs have no module (for example
  `types/range`). Each is refused, or exempted with a stated reason.
- **Spawning processes.** `fjs cov` starts child processes. Whether the Node
  effects already have an operation for that, or it needs one, decides where
  the command lives.
- **Deno and Bun specifics.** Whether each measures a single file and enforces
  thresholds from the command line, and whether Bun runs an explicitly named
  file whose name matches none of its patterns.
- **Changed modules.** Finding "the modules I changed" from `git` is an
  external tool and needs approval first
  ([AGENTS.md §6](../../../AGENTS.md#6-external-tools)); until then the
  directories are named explicitly.

A change to module A can lower module B's coverage by its own proof when B's
branches depend on what A returns. A local run over A misses that; CI's full
run catches it, which is enough.

### Tasks

- [ ] Stage 1: add `one.mjs`, its FunctionalScript core with a proof, and
      document the single-module test and coverage commands in
      [`../README.md`](../README.md)
- [ ] Stage 2: add `fjs cov node`, switch the generated CI to it, and remove
      `cov` from `package.json` once nothing calls it
- [ ] Fix every module the per-module run exposes
- [ ] Stage 3: `fjs cov deno` and `fjs cov bun`, replacing their CI steps
- [ ] Add the local command to the pre-submit check set

### Related

- [run-subset-of-tests](./run-subset-of-tests.md) — the general selector for
  `fjs t` and the external-runner adapters; `one.mjs` is a narrow first case
  of module selection, and the selector's eventual syntax should be able to
  express it
- [check-set-ci-parity](../../../todo/check-set-ci-parity.md) — whether
  coverage belongs in the local check set; a per-module command makes it
  cheap enough to
- [`fjs/ci/README.md`](../../ci/README.md) — the `cov` script, the
  `all.test.mjs` entry, and the CI jobs that run coverage
