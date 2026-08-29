## 170. `fjs/ci`: a shared tool step builder for bun/deno/node

**Priority:** P3
**Status:** irrelevant — two of the three consumers no longer have this shape

### Why this closed

The abstraction was justified by its own count: "Three real consumers (bun, deno,
node), all shipping — past the 'second real consumer' bar." Two of those three are
gone. `deno` moved to a generated Nix flake, so it begins with
`cachix/install-nix-action` and a version check and every command after that is a
`nix develop --command` step. `bun` kept its setup action — its migration is blocked,
see [bun-nix-blocked-on-nixpkgs](bun-nix-blocked-on-nixpkgs.md). Both also lost the
global install and the smoke test it fed, so each is now two commands about this
repository. The skeleton this issue extracted,
`[install(setup action), install(global fjs), …test commands]`, describes neither.

What the migrated jobs share is factored where they share it: `nixInstall`, `nixSteps`
and `nixVersionStep` in [`fjs/ci/nix/module.f.mjs`](../nix/module.f.mjs), used by all
four. That is the same idea — data-parameterized step construction — arrived at from
what the migration actually left in common, rather than from the setup actions it
removed.

`platformNodeSteps` still has the original shape, and is the last thing that does. One
consumer is below this issue's own bar, and
[built-package-checks](built-package-checks.md) proposes reworking it anyway. Reopen
this only if a runtime lands that reintroduces the pattern — which neither `bun`'s
pending migration nor anything in
[built-package-checks](built-package-checks.md) should.

The sibling factory [i175](./175-ci-setup-tool-factory.md) is unaffected and stays
open: `setupTool` constructs a pinned-version install step, and four call sites for
that remain — `setup-node`, `setup-bun`, wasmtime and wasmer.

### Original report

The three runtime-specific CI modules each build the same job shape — "set up
the runtime, globally install `functionalscript`, run the smoke test and the
runtime's own install/test commands":

```ts
// ci/bun/module.f.mjs:10
export const bunSteps = (version: string): readonly MetaStep[] => [
    install(uses('oven-sh/setup-bun', { 'bun-version': bun })),
    install({ run: `bun install -g functionalscript@${version}` }),
    test({ run: 'bun install --frozen-lockfile' }),
    test({ run: `bunx functionalscript@${version} t` }),
    test({ run: 'bun test --coverage' }),
]

// ci/deno/module.f.mjs:12
export const denoSteps = (version: string): readonly MetaStep[] => [
    install(uses('denoland/setup-deno', { 'deno-version': deno })),
    install({ run: `deno install -g -A --minimum-dependency-age=0 npm:functionalscript@${version}` }),
    test({ run: `deno run -A --minimum-dependency-age=0 npm:functionalscript@${version} t` }),
    test({ run: 'deno install --frozen' }),
    test({ run: `${denoTest} --coverage && deno coverage --include='.*module\\.f\\.ts'` }),
]

// ci/node/module.f.mjs:25-53 — same ingredients, split into composable pieces
const nodeInstall = (v: string) => [install(installNode(v)), test({ run: 'npm ci' })]
export const basicNode = (version) => (extra) => [...nodeInstall(version), ...extra]
const fjsGlobalInstall = (version) => install({ run: `npm install -g functionalscript@${version}` })
export const platformNodeSteps = (version) => [...nodeInstall(node.default), fjsGlobalInstall(version), test({ run: 'fjs t' })]
const node22Steps = (version) => [...nodeInstall(node.node22), fjsGlobalInstall(version), test({ run: 'fjs t' })]
```

The skeleton `[ install(setup action), install(global fjs), …test commands ]`
is repeated across the three runtimes. The deltas are data: the
setup action + version key, the global-install command syntax, and the
test-command strings:

| | setup action | global install | commands |
|---|---|---|---|
| bun | `oven-sh/setup-bun` / `bun-version` | `bun install -g functionalscript@v` | `bun install --frozen-lockfile`, `bunx … t`, `bun test --coverage` |
| deno | `denoland/setup-deno` / `deno-version` | `deno install -g -A … npm:functionalscript@v` | `deno run … t`, `deno install --frozen`, coverage |
| node | `actions/setup-node` / `node-version` | `npm install -g functionalscript@v` | `npm ci`, `fjs t`, per-job tails |

### Proposed abstraction

A per-runtime data record consumed by one factory in
`fjs/ci/common/module.f.mjs`:

```ts
export type ToolRecipe = {
    readonly setup: MetaStep,                      // pre-built: bun's varies per (Os, Arch)
    readonly globalInstall: (version: string) => string,
    readonly tests: readonly string[],
}
export const toolSteps = (r: ToolRecipe) => (version: string): readonly MetaStep[] =>
    [r.setup, install({ run: r.globalInstall(version) }), ...r.tests.map(run => test({ run }))]
```

- `bunSteps`/`denoSteps` become `toolSteps(bunRecipe)`/`toolSteps(denoRecipe)`.
- node builds its variants from the same pieces: `nodeInstall` stays (its
  `npm ci` sits between setup and the global install, unlike bun/deno), and
  the per-version jobs keep composing their step arrays themselves or via thin
  wrappers.

The setup step is passed pre-built (not as a raw action name) because bun's
install may vary per `(Os, Architecture)`; deno and node pass a fixed
`install(uses(...))`.

### Why this qualifies

- Three real consumers (bun, deno, node), all shipping — past the
  "second real consumer" bar.
- The shape is identical; only data (action descriptor, command strings)
  differs — the textbook case for a data-parameterized factory in `AGENTS.md`.

### Caveats / why this is an idea, not a mechanical edit

- **Partial fit for node.** Node interleaves `npm ci` before the global
  install and has three per-version jobs with different tails
  (`node --test`, `npx tsc`/`npm run cov`/`npm pack`); the factory covers the
  bun/deno shape cleanly, node only partially. Don't force node in — a
  recipe that only bun and deno consume is still two real consumers.
- **Command ordering differs**: deno runs the smoke test *before*
  `deno install --frozen`, bun after `bun install --frozen-lockfile`. The
  `tests` list keeps that as data, but it means the "recipe" is a flat
  ordered command list, not named slots.
- The mechanical savings are modest; the value is making "install a runtime,
  install fjs globally, run its tests" a single named thing so a fourth
  runtime reuses it instead of forking a fourth copy.

### Related

- `fjs/ci/common/module.f.mjs` already centralizes
  `install`/`test`/`uses`/`toSteps`; `toolSteps` is the next
  composition up the same ladder.
- [66h-ci-npm-global-install.md](./66h-ci-npm-global-install.md) — the
  `npm install -g` family; the `globalInstall` field here is the
  cross-runtime generalization of it.
