## Smart CI follow-ups

**Priority:** P3
**Status:** open

### Problem

The [success cache](../cache/README.md) skips individual CI checks. Generator
checks remain uncached, and local execution of the same gated steps is not yet
implemented.

Source enumeration uses one native `git ls-tree` call rather than reparsing
pack indexes for every source directory. Cache lookup and addition still use
the custom Git CAS reader and writer; their cost remains to be measured.

The [CI run 40016215099](https://github.com/functionalscript/functionalscript/actions/runs/40016215099)
showed a concurrent push advancing `build-cache` before another job published,
so that job's reports were lost. Publication now fetches and merges the remote
tip in a temporary cache worktree and retries, with a limit of ten total push
attempts. Network operations use the source checkout's configured credentials;
the source tree stays untouched.

### Tasks

- [x] Enumerate committed source inputs with one native Git invocation while
      preserving cache identities and literal paths.
- [ ] Enumerate every input read by the generators before caching the
      generated-file drift check. Keep generation and its comparison together.
- [ ] Implement local execution of the same step and gate data, recording the
      actual host tool versions and working-tree bytes. Reuse CI entries only
      when the resulting contract and inputs agree.
- [ ] Measure setup cost for macOS and Windows jobs whose checks all hit,
      and native CAS lookup/add cost at CI scale.
      Add a gate job or replace the remaining CAS operations with Git CLI calls
      only if those measurements justify the extra machinery.

### Related

- [Coverage over FunctionalScript proofs only](../../emergent_testing/todo/coverage-over-fjs-only.md)
- [Six CI jobs](./six-ci-jobs.md)
