## Resolve package imports from `node_modules`

**Priority:** P3
**Status:** open

### Problem

A program cannot import an installed package by name. The specifier
`functionalscript/fjs/module.f.js` should load
`node_modules/functionalscript/fjs/module.f.js`, as Node's native ESM does, but
native module resolution — `resolve_file_module` in [`resolve.rs`](../src/resolve.rs),
behind the `resolveFileModule` effect — knows file paths only. Native implements
no `import` effect: its module loading is the
[FJS module loader](../../../fjs/compiler/todo/load-modules-without-import-effect.md),
over `resolveFileModule` and `readWhole`, so this resolver is where the lookup
belongs.

The effect does not refuse such a specifier either: it reads it as a path relative
to the importer. At `3e1d1a09`, with an importer `/app/src/main.mjs`, both the
Node runner's `resolveFileModule` and `resolve_file_module` answer
`/app/src/functionalscript/fjs/module.f.js`, a sibling directory, where Node
v26.11.1's native ESM loads `/app/node_modules/functionalscript/fjs/module.f.js`.
The [module-resolution record](../../../fjs/compiler/todo/module-resolution-compatibility.md)
says bare imports are refused, and only the compiler's admission —
`_importSources` in [`compiler/source`](../../../fjs/compiler/source/module.f.mjs) —
refuses them, before either resolver is asked. Any other caller of the effect
gets a plausible wrong module
([DESIGN.md §10](../../../doc/DESIGN.md#10-refuse-what-you-cannot-handle)).

### Proposal

The native effects keep the Node runner's contracts
([native Node effects](../../../todo/nanvm-effects-node-operations.md)), so this
is one contract with three parts: the Node runner's `resolveFileModule` defines
it, `resolve_file_module` follows it, and the compiler's admission lets bare
specifiers through to both. The Rust step comes last, not alone: while
`_importSources` refuses the specifier no program reaches it, and a native
resolver answering what the Node runner refuses breaks parity.

Follow Node's [`PACKAGE_RESOLVE`](https://nodejs.org/api/esm.html#resolution-algorithm-specification)
within this subset:

- **Name.** The package name is the first segment, or `@scope/name`; the rest
  is the subpath, read under the existing portable path rules. A name Node
  calls invalid — empty, a leading `.`, a `\` or `%`, a scope with no name — is
  an invalid specifier.
- **Lookup.** From the importer's real directory up to the filesystem root, the
  first `node_modules/<name>/` directory that exists is the package. A subpath
  it lacks is not found: Node stops at that directory, and so does this.
- **Identity.** The real path and its `file:` URL, as for relative imports. A
  symlinked package (`npm link`, workspaces) takes its target's identity, and a
  file reached through two spellings is one module.

Refuse, until a use case needs them, the cases where Node answers something
other than that lookup:

- A package whose `package.json` has `exports`, and a self-reference (the
  importer's own package scope has the same name and `exports`): Node resolves
  them through the `exports` map. The `functionalscript` package has no
  `exports` at `3e1d1a09`, so the motivating case is inside the subset.
- A package without a subpath (`functionalscript`), which Node resolves through
  `main`.
- A Node built-in name (`fs`, `fs/promises`): Node loads the built-in, never
  `node_modules/fs`. The grammar already refuses `node:` and `#` imports.

### Questions

- Where native gets the built-in names: generated from the pinned Node's
  `module.builtinModules`, or something else. Without them, `fs` silently loads
  a `node_modules/fs` where one exists.
- Whether the virtual runner's lexical profile looks up `node_modules/` in its
  fixture tree the same way, or keeps refusing bare specifiers.

### Tasks

- [ ] Refuse bare specifiers in both `resolveFileModule` implementations, so the
      effect keeps its contract without the compiler's guard; pin the sibling
      case above in the Node runner's filesystem proofs and in `resolve.rs`.
- [ ] Write the package subset into the Node profile of
      [`spec/modules/imports.md`](../../../spec/modules/imports.md).
- [ ] Implement it in the Node runner's `resolveFileModule`, comparing its
      identities with native ESM's `import.meta.resolve` in the filesystem
      proofs: the nearest `node_modules`, a subpath missing from it, a symlinked
      package and each refused case.
- [ ] Admit bare specifiers in `_importSources` for both compiler paths, with the
      virtual runner's answer to the question above.
- [ ] Implement it in `resolve_file_module`, with a package case in the
      [parity corpus](../../harness/fixtures/parity.mjs) whose importer is the
      identity the host answered for its entry, so no file URL is spelled per
      platform.

### Related

- [module-resolution-compatibility](../../../fjs/compiler/todo/module-resolution-compatibility.md)
  — the specifier contract and host boundary this extends; it left package
  resolution for a concrete use case.
- [module-path-encoding](./module-path-encoding.md),
  [local-file-url-authorities](./local-file-url-authorities.md) — the native
  resolver's other open refusals.
- [Node resolution algorithm](https://nodejs.org/api/esm.html#resolution-algorithm-specification)
  — `PACKAGE_RESOLVE` and `PACKAGE_SELF_RESOLVE`.
