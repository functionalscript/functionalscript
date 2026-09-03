## Publishing packages

**Priority:** P3
**Status:** open

Targeting the following systems:

- JS:
  - [x] NPM
  - [ ] JSR — JSR doesn't support JSDoc type information, see [jsr-io/jsr/issues/494](https://github.com/jsr-io/jsr/issues/494). This problem will go away once ECMAScript supports [Type Annotations](https://github.com/tc39/proposal-type-annotations).
  - [ ] https://esm.sh/ (optional)
  - [ ] Browsers via `import * from 'https://...'`
- Rust:
  - [ ] https://crates.io/

FunctionalScript can't currently be installed from Git using NPM.

### Updating packages

`npm run lock-update` reinstalls, syncs `deno.lock`/`bun.lock`/`Cargo.lock`, refreshes every `flake.lock`, and regenerates the CI workflow; dependency version bumps in `package.json` are manual until [replace-npm-check-updates-with-an-internal-script.md](./replace-npm-check-updates-with-an-internal-script.md) lands. The version is the single source of truth in `package.json`. We publish only when a new version appears on `main`. This strategy can also work for Rust packages.

### CI publishing (merge to `main`)

- [x] Check if the version is new, then publish.

Package and publish jobs run in CI from a clean checkout. We do not rely on
packing from a developer working tree, and ignored generated outputs from an
earlier revision are not part of the package-build state. `prepack` belongs to
this packaging path; normal development should type-check and test without
producing package artifacts.

### Authored and generated JavaScript extensions

The repository source migration is split into two stages; both, and the
authoritative FunctionalScript extension contract, are in
[`fjs/fsc/README.md`](../../fsc/README.md).

Stage 1 used different extensions for authored JavaScript and generated
TypeScript output. Only the `.mjs` line survives it — no TypeScript pass emits
`source.js` any more, and the authored `.ts` that is left is `types.ts` and its optional
sibling `private.ts`, each contributing a declaration and no runtime file. Both
are emitted; only the first is packed:

```text
source.mjs -> source.mjs + source.d.mts
types.ts   -> types.d.ts
private.ts -> private.d.ts   # emitted, then excluded by `files`
```

The stage-1 invariant, as it stands now that stage 1's source conversion is
complete:

- `.mjs` is authored ESM JavaScript with JSDoc types, and `.f.mjs` is its
  FunctionalScript-intent form;
- `types.ts` is authored TypeScript for a type-level API — permanent, not a
  migration leftover — and an optional sibling `private.ts` holds the
  implementation-private types outside the public declaration closure. Both are
  ordinary checked source; only `types.d.ts` ships, because `package.json`'s
  `files` negates `**/private.d.ts`;
- `.ts` is otherwise gone: no authored implementation or proof `.ts` / `.f.ts`
  remains;
- `.js` is neither authored nor emitted by a build or packaging step — the pass
  that produced it was removed in
  [#1520](https://github.com/functionalscript/functionalscript/pull/1520).
  `fjs compile` still writes one to a caller-named output path; that is the
  compiler's output for a user, not repository source. A publish does not carry
  it, because package and publish jobs run from a clean CI checkout — but that
  is the only reason: `files` still selects `**/*.js`, so `npm pack` in a dirty
  working tree *does* include such a file (measured with `npm pack --dry-run`);
- `.d.ts` and `.d.mts` are generated declarations.

`.f.mjs` does **not** promise that the current FunctionalScript
parser/compiler accepts the whole module.
[`f-mjs-package-support.md`](./f-mjs-package-support.md) was written as the
prerequisite for the first package-owned migration; it was de-scoped as a gate,
and what the migration needed from it was performed one-time and recorded in
[`packed-consumer-validation.md`](../packed-consumer-validation.md).

The two end-of-stage-1 cleanups are done: the TypeScript-to-JavaScript emit path
is gone (#1520) and the blanket `**/*.js` ignore is gone from `.gitignore`
([#1545](https://github.com/functionalscript/functionalscript/pull/1545)),
though `**/*.js` deliberately stays in `package.json`'s `files`. Stage 2 can
therefore use `.f.js` as authored compiler-compatible FunctionalScript. Before
the first `.f.mjs` -> `.f.js` rename, complete
[`f-js-package-support.md`](./f-js-package-support.md) so standalone authored
`.f.js` source is directly checked, gets `.d.ts`, is packed, and resolves for a
clean consumer.

### Stage-1 TypeScript configuration

Before the first `.ts` -> `.mjs` conversion, the main `tsconfig.json` should
validate both authored TypeScript and JavaScript by enabling:

```jsonc
{
  "compilerOptions": {
    "allowJs": true,
    "checkJs": true
  }
}
```

Enabling `checkJs` includes `fjs/types/bigint/benchmark.mjs`; keep it checked
like any other authored JavaScript. Its eventual removal is independent cleanup
and is not a prerequisite for the migration.

NPM must include the stage-1 runtime and declaration extensions. It is not
necessary to special-case incidental non-public authored `.mjs` files: for
example, packing `benchmark.mjs` is harmless because it exposes no documented
public API. Such files can be removed later when no longer useful.

### Stage-1 emission

Keep packaging simple and keep emission as an implementation detail of the NPM
lifecycle. While implementation `.ts` / `.f.ts` source remained, `prepack` was
two ordered TypeScript passes — declarations first, then JavaScript emission.
With only `types.ts` and test-fixture TypeScript left,
[#1520](https://github.com/functionalscript/functionalscript/pull/1520) measured
that no generated `.js` is required and replaced the second pass with a plain
check, which re-resolves the tree through the just-emitted declarations and so
keeps the declaration round-trip property:

```json
{
  "scripts": {
    "prepack": "tsc --noEmit false --emitDeclarationOnly && tsc"
  }
}
```

Do not expose separate `emit:declarations` or `emit:typescript` scripts. Users
should not need to invoke individual package-emission phases during normal
development.

The first pass emits declarations for both authored extensions:

```text
source.ts  -> source.d.ts
source.mjs -> source.d.mts
```

The generated declarations are then present for the second invocation. For the
repository configuration, TypeScript resolves those `.d.mts` declarations for
the authored `.mjs` modules — `.d.mts` outranks `.mjs` in resolution — so the
second invocation type-checks every import through the just-emitted
declarations. That is the declaration round-trip check: a type that survives
source checking but degrades in declaration emit fails here. The invocation
emits nothing (`tsconfig.json` sets `noEmit: true`); while implementation
`.ts` / `.f.ts` source remained, this second step was
`tsc --noEmit false --declaration false` and additionally emitted
`source.ts -> source.js`, an output retired by
[#1520](https://github.com/functionalscript/functionalscript/pull/1520).

The historical two-pass setup was validated by
[PR #1451](https://github.com/functionalscript/functionalscript/pull/1451),
which enables `allowJs` / `checkJs`, keeps an authored `benchmark.mjs`, and
passes the Node 26 CI `npm pack` step. A separate runtime-emission
configuration was never needed.

No generated-output cleanup is needed before packaging because the CI package
job starts from a clean checkout. In particular, after `source.ts` is renamed
to `source.mjs`, an ignored `source.js` / `source.d.ts` from a developer's older
working tree cannot appear in the CI package job.

Authored `.mjs` is copied without rewriting runtime imports, and emitted
`.d.mts` specifiers are not rewritten. Stage-1 migration was therefore
asymmetric and dependency-first: authored `.ts` could import already migrated
`.mjs`, while authored `.mjs` could not retain relative runtime or declaration
references to a remaining implementation `.ts` or a generated `.js`. Neither
kind of file exists now; a `.mjs` referencing `./types.ts` is the intended form,
not a leftover edge.

With the last authored implementation `.ts` / `.f.ts` source removed, the
runtime JavaScript *emission* lost its purpose and was retired in
[#1520](https://github.com/functionalscript/functionalscript/pull/1520). Do
**not** reduce `prepack` to the bare `--emitDeclarationOnly` invocation: the
second `tsc` stays, as a check, because it is the only gate that catches
declaration-emit degradation (the class behind #1497) — dropping it lets a
declaration that collapses to `/*elided*/ any` reach a release with every other
check green.

### Stage-2 authored `.f.js`

Once stage 1 is complete, `.js` is no longer generated from repository
TypeScript and becomes authorable again. The stage-2 package invariant for a
compiler-compatible FunctionalScript module is:

```text
source.f.js -> source.f.js + source.f.d.ts
```

TypeScript with `allowJs` / `checkJs` must include authored `.f.js` directly in
its checked source roots and declaration emission. NPM and clean-consumer tests
must cover both runtime and declarations. These requirements are owned by
[`f-js-package-support.md`](./f-js-package-support.md).

### Tasks

- [x] Complete [`f-mjs-package-support.md`](./f-mjs-package-support.md) before
      the first stage-1 source conversion. Moot as a gate: every conversion
      already happened, validated one-time in
      [#1520](https://github.com/functionalscript/functionalscript/pull/1520);
      the committed CI fixture remains future work in that file.
- [x] After the last `.ts` / `.f.ts` source is removed, simplify `prepack` to
      declaration emit. Done in
      [#1520](https://github.com/functionalscript/functionalscript/pull/1520) —
      but not to the bare `--emitDeclarationOnly` command this item originally
      prescribed: the second `tsc` invocation survives as a no-emit check
      because it is the declaration round-trip gate (see Stage-1 emission
      above).
- [ ] Complete [`f-js-package-support.md`](./f-js-package-support.md) after
      stage 1 and before the first authored `.f.js` compiler-compatibility
      conversion.

### Related

- [PR #1451](https://github.com/functionalscript/functionalscript/pull/1451) —
  initial implementation and CI validation of authored `.mjs` package support.
- [`fjs/fsc/README.md`](../../fsc/README.md) — repository-wide two-stage
  ordering and the extension contract.
- [`f-mjs-package-support.md`](./f-mjs-package-support.md) — focused stage-1
  authored `.mjs` prerequisite.
- [`f-js-package-support.md`](./f-js-package-support.md) — focused stage-2
  authored `.f.js` prerequisite.
- [`fjs/fsc/README.md`](../../fsc/README.md) — authoritative FunctionalScript
  extension and migration contract.
- [GitHub issue #398](https://github.com/functionalscript/functionalscript/issues/398)
  — the original package report.
