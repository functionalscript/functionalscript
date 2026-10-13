## Give the compile CLI the runtime

**Priority:** P3
**Status:** open

### Problem

`fjs compile <input> <output>` with a `.json` or DataJS output interprets
the module to its default export, through `_transpileDefault` in
[`../transpiler`](../transpiler/module.f.mjs), and interprets it with no
runtime: a module whose *initialization* calls a member function the
interpreter answers from [`fjs/js/runtime`](../../js/runtime/README.md)
rather than natively — `startsWith`, the first — fails to initialize there,
where a call inside a function the module exports is untouched. The
transpiler takes a runtime as `interpretWith(runtime)`, and the harness and
the corpus proofs give it one, but the CLI cannot: the runtime is a module
of the package, at `fjs/js/runtime/module.f.js` beside the compiler's own
sources, and a FunctionalScript program has no `import.meta` to locate the
package from; the loader resolves file paths and nothing else.

### Proposal

The host shell, [`fjs/module.mjs`](../../module.mjs), knows where it is.
Either it resolves the runtime's path from its own URL and hands it to the
program as an option every `NodeProgram` receives, or the loader learns to
resolve a package-relative specifier. Then `compile` loads the runtime
once, as the harness does, and interprets the module under it. Until then
`fjs compile` with no arguments, the `.f.js` check, and every code output
are unaffected: none interprets.

### Tasks

- [ ] Decide between the option and the specifier.
- [ ] `compile` interprets data outputs under the runtime; a proof with a
      module whose initialization calls `startsWith`.

### Related

- [`fjs/js/todo/runtime.md`](../../js/todo/runtime.md) — the design this is
  the one known gap of.
