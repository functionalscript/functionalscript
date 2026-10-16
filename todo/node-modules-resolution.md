## Resolve package imports from `node_modules`

**Priority:** P3
**Status:** open

### Problem

A program cannot import an installed package by name. The specifier
`functionalscript/fjs/module.f.js` should load
`node_modules/functionalscript/fjs/module.f.js`, as Node's native ESM does, but
every FJS host implements `resolveFileModule` for file paths only: the
[Node runner](../fjs/effects/node/module.mjs), the
[virtual runner](../fjs/effects/node/virtual/module.f.mjs) and native
`resolve_file_module` in [`resolve.rs`](../nanvm/effects-node/src/resolve.rs).
Native implements no `import` effect; its module loading is the
[FJS module loader](../fjs/compiler/todo/load-modules-without-import-effect.md),
over `resolveFileModule` and `readWhole`.

No host refuses such a specifier either: each reads it as a path relative to
the importer. At `3e1d1a09`, with the importer `/app/src/main.mjs`, all three
answer `/app/src/functionalscript/fjs/module.f.js`, a sibling directory, where
Node v26.11.1's native ESM loads `/app/node_modules/functionalscript/fjs/module.f.js`.
The empty specifier, which Node's ESM refuses, is the importer itself to the
Node runner and native, and its directory to the virtual runner.
The [module-resolution record](../fjs/compiler/todo/module-resolution-compatibility.md)
says bare imports are refused, and only the compiler's admission —
`_importSources` in [`compiler/source`](../fjs/compiler/source/module.f.mjs) —
refuses them, before any host is asked. Any other caller of the effect gets a
plausible wrong module ([DESIGN.md §10](../doc/DESIGN.md#10-refuse-what-you-cannot-handle)).

### Proposal

Every FJS host follows one convention, written once. The package lookup is
FunctionalScript, shared the way [`fjs/path/import`](../fjs/path/import/module.f.mjs)'s
specifier rules are, and composed over the file effects the hosts already have.
No host implements package logic, and `resolveFileModule` stays a file-path
effect. Native's resolver is generated from that FJS source, never a
handwritten copy.

#### Stage 1: refuse

`resolveFileModule` refuses every import specifier `specifierKind` calls
`'bare'`, packages and the empty specifier alike, on all three hosts, with the
`invalid module specifier` refusal each already gives. An import is a request
with an importer: an entry path (`parent: null`) stays a literal filesystem
path, so `main.f.js` is still an entry. The effect then keeps
its contract without the compiler's guard. The refusal is permanent: stage 2
resolves packages above the effect, not inside it.

#### Stage 2: look up packages

Follow Node's [`PACKAGE_RESOLVE`](https://nodejs.org/api/esm.html#resolution-algorithm-specification)
within this subset, in the shared resolver both compiler paths use:

- **Name.** The whole specifier first passes the existing grammar, which
  refuses a `:`, `\`, `?` or `#` anywhere in it. `node:` imports, and `#`
  imports, which Node resolves through `PACKAGE_IMPORTS_RESOLVE` before any
  package lookup, never reach this one. The package name is then the first
  segment, or `@scope/name`, and the rest is the subpath, read under the
  existing portable path rules. A name Node calls invalid — a leading `.`, a
  `%`, a scope with no name — is an invalid specifier.
- **Lookup.** From the importer's real directory up to the filesystem root, the
  first `node_modules/<name>/` that is a directory is the package. A subpath it
  lacks is not found: Node stops at that directory, and so does this.
- **Spelling.** Each step is a relative specifier from the importer, through
  `resolveFileModule`: the probes `./node_modules/<name>/`,
  `../node_modules/<name>/` and so on up, which every host answers as a
  directory or as `ENOENT` or `ENOTDIR`, then the winner followed by the
  subpath. The identity is therefore the real path's `file:` URL, as for any
  relative import. A symlinked package (`npm link`, workspaces) takes its
  target's identity, and a file reached through two spellings is one module.
  At `3e1d1a09` the virtual runner answers a missing file without error, so
  this stage first makes it check existence.

Refuse the specifiers Node answers with something other than that lookup:

- **Built-ins.** FJS loads no host module. Node checks the whole specifier
  against its built-ins before any lookup: `fs/foo.js` loads
  `node_modules/fs/foo.js`, but `fs/promises` loads the built-in even where
  `node_modules/fs/promises` exists. Refuse the names in the pinned Node's
  `module.builtinModules`, held as FunctionalScript data beside the resolver
  and pinned to that list by a host proof, which fails on the pin bump that
  adds one. Its `node:`-only names need no entry, since the grammar refuses
  `node:`.
- **`exports`.** A package whose `package.json` has `exports`, and a
  self-reference (the importer's own package scope has the same name and
  `exports`): Node resolves them through the `exports` map. The
  `functionalscript` package has no `exports` at `3e1d1a09`, so the motivating
  case is inside the subset.
- **Package root.** A specifier with no subpath (`functionalscript`), which Node
  resolves through `main`.

#### Stage 3: generate the native resolver

`npm run gen` compiles the shared resolver through the compiler's Rust output
into a `gen.*` module beside `resolve.rs`, as the harness fixtures are compiled
now. It is a unit of its own and does not wait for the whole
[loader's native prerequisites](../fjs/compiler/todo/load-modules-without-import-effect.md#native-prerequisites).
What it generates is the shared logic: the specifier rules `decode_specifier`
copies by hand today, stage 1's refusal and the package lookup. The
`resolveFileModule` effect stays handwritten Rust, because the URL-to-path
conversion and the real path are the host's.

The compiler does not accept that source yet. At `3e1d1a09` it refuses
`fjs/path/import` first at the `'\0'` in `importSegment` (strings take JSON's
escapes, so `'\u0000'`), then at the `switch` in `importSegmentKind`
(`st.switch` is a refused construct), then at `resolve` naming `decode` before
its declaration. With those three fixed, it refuses `next` in `fjs/types/list`,
reached through the resolver's dependency closure, whose `let` and `while` the
language does not admit yet. Until the source compiles, native keeps the
handwritten resolver with stage 1's refusal, so it refuses packages rather than
resolving them differently.

### Questions

- Whether the resolver's closure avoids `fjs/types/list`, using only constructs
  the compiler accepts, or the generation waits for the compiler to cover `let`
  and loops.

### Tasks

Stage 1:

- [ ] Refuse bare import specifiers in `resolveFileModule` on the Node runner,
      the virtual runner and native. Pin the sibling and empty cases in each
      host's proofs, with a bare entry path such as `main.f.js` still resolving,
      and add a parity case to the
      [corpus](../nanvm/harness/fixtures/parity.mjs) whose importer is the
      identity the host answered for its entry, so no file URL is spelled per
      platform.

Stage 2:

- [ ] Make the virtual runner's `resolveFileModule` fail on a missing file
      (`ENOENT`) and on a file spelled as a directory (`ENOTDIR`), as the other
      hosts do.
- [ ] Write the package subset into the Node profile of
      [`spec/modules/imports.md`](../spec/modules/imports.md).
- [ ] Implement the lookup in the shared resolver, admitted by `_importSources`
      for both compiler paths, with the built-in names and their host proof.
      Prove it on the virtual runner in FJS proofs, and on the Node runner
      against native ESM: identities against `import.meta.resolve` for the
      nearest `node_modules` and a symlinked package, and the failure against
      `import()` for a subpath missing from the nearest package:
      `import.meta.resolve` does not check that the file exists, and at
      `3e1d1a09`, on Node v26.11.1, it answers the nearest package's missing
      path where `import()` fails with `ERR_MODULE_NOT_FOUND`. Assert each
      refused case's refusal directly: Node answers all of them, which is why
      they are refused.

Stage 3:

- [ ] Bring the shared resolver's dependency closure within what the compiler's
      Rust output accepts, starting with the refusals above.
- [ ] Generate the native resolver from it with `npm run gen`, replacing
      `decode_specifier` and stage 1's handwritten check, and compare the
      stage 2 fixtures with the Node runner.

### Related

- [module-resolution-compatibility](../fjs/compiler/todo/module-resolution-compatibility.md)
  — the specifier contract and host boundary this extends; it left package
  resolution for a concrete use case.
- [nanvm-effects-node-operations](./nanvm-effects-node-operations.md) — native
  effects keep the Node runner's contracts.
- [module-path-encoding](../nanvm/effects-node/todo/module-path-encoding.md),
  [local-file-url-authorities](../nanvm/effects-node/todo/local-file-url-authorities.md)
  — the native resolver's other open refusals.
- [Node resolution algorithm](https://nodejs.org/api/esm.html#resolution-algorithm-specification)
  — `PACKAGE_RESOLVE` and `PACKAGE_SELF_RESOLVE`.
