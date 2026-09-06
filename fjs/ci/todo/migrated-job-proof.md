## migrated-job-proof. One definition of "this job migrated onto the shared Nix shell"

**Priority:** P5
**Status:** open

### Problem

What it means for an all-Nix CI job to have migrated onto the shared
shell — no `setup-<tool>` action, the Nix installer present, every command
through `runPath(nixShell)`, no flake of its own, no published-package
step — is a property of the migration, not of any one tool. It is not
every migration's invariant, though: the migrated Node job deliberately
runs its generated-file check runner-native
(`fjs/ci/node/module.f.mjs:140`'s
`git add -A && git diff --cached --exit-code`, whose presence
`fjs/ci/proof.f.mjs:248` pins — via the substring-matching `hasRunInJob`,
so the proof guards the command, not its unwrapped form), so "every
command through the shell" belongs to
the Bun/Deno-style jobs, not to migration as such. Today the all-Nix form
is stated twice, as near-identical proof entries:

- `fjs/ci/bun/proof.f.mjs` — `runs` extraction (`:7`),
  `noPublishedPackage` (`:20`), `installsNixOnly` (`:25`),
  `sharesTheShell` (`:32`), byte-identical to the Deno versions modulo
  `bun`/`oven-sh/setup-bun` vs `deno`/`denoland/setup-deno`;
- `fjs/ci/deno/proof.f.mjs` — the same three checks plus the `runs`
  extraction (`:7`, `:29`, `:41`, `:49`), with one genuinely Deno-specific
  extra assertion inside `noPublishedPackage` (the dependency-age flag).

With the Nix migration still `wip` ([65z-ci-nix.md](./65z-ci-nix.md),
[66b-dockerfile-nix-integration.md](./66b-dockerfile-nix-integration.md)),
the next migrated job forks a third copy.

### Proposal

One factory in `fjs/ci/common` (or `fjs/ci/nix`, next to the shell it
checks):

```js
export const _migratedJobChecks = ({ steps, jobId, retiredAction }) => ({
    noPublishedPackage: ..., installsNixOnly: ..., sharesTheShell: ...,
})
```

The `_` prefix is deliberate: the export exists only so the Bun and Deno
proofs can import it — module linkage, not a public CI API — which is
exactly what the private-runtime naming rule reserves `_` for
(`fjs/AGENTS.md`), so renaming or removing it later is not a breaking
change. **The factory is scoped to all-Nix jobs**: `sharesTheShell` as
defined here would reject the Node job's legitimate runner-native
generated-file check, so either the factory stays Bun/Deno-style-only
(the cheap answer while those are the only two consumers) or it grows an
explicit allow-list of permitted runner-native commands before a
mixed-style job adopts it — never a loosening of the check to "most
commands". Each tool's proof spreads the result and keeps only its
genuinely specific rows — `steps`, Deno's `coverageStep` and
dependency-age assertion, Bun's `pinSources`. The migration contract
becomes a single named thing the next job imports instead of re-deriving.

### Tasks

- [ ] Extract the factory; port the Bun and Deno proofs; keep their
      tool-specific checks local.
- [ ] `tsc`, `fjs t`.

### Related

- [65z-ci-nix.md](./65z-ci-nix.md) — the migration producing these jobs.
- [170-ci-tool-step-builder.md](./170-ci-tool-step-builder.md),
  [175-ci-setup-tool-factory.md](./175-ci-setup-tool-factory.md) — closed
  irrelevant; they concerned the step *builders*, which are factored where
  they share. This is the proof side, which survived that closure.
