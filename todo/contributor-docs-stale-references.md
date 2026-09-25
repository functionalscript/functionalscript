## Contributor docs cite code that moved

**Priority:** P4
**Status:** open

### Problem

Several contributor documents use a module, step or type as a worked example
that has since moved, been renamed or changed shape. Each one sends a reader
to something that is not there, or holds up as an example something that no
longer shows the rule.

- **[AGENTS.md §7](../AGENTS.md#7-continuous-integration)** justifies two
  commands in one CI step with "both such pairs in the generated workflow":
  `git add -A && git diff --cached --exit-code`, and
  `sudo apt-get update && sudo apt-get install -y …`. Neither generated
  workflow has an `apt-get` step any more — `fjs/ci/rust/module.f.mjs` says the
  Nix linker for 32-bit Linux "replaces `apt-get install libc6-dev-i386`" — so
  the `git` pair is the only one left.
- **[fjs/AGENTS.md](../fjs/AGENTS.md)** cites three examples that moved:
  - "Types are `readonly`" gives "`IncomingMessage = Readable & {…}` in
    `fjs/effects/node/module.mjs`" as the existing exception for a mutable
    member of a host object. The type is now
    `_IncomingMessage = _Readable & {…}` in
    [`fjs/effects/node/private.ts`](../fjs/effects/node/private.ts), and every
    member is `readonly`, so it is no longer an example of the exception.
  - "Composition over intersection" cites the same `IncomingMessage` in
    `fjs/effects/node/module.mjs` for the intersection exception. The public
    `IncomingMessage` in `fjs/effects/node/types.ts` is a plain record; the
    intersection is `private.ts`'s `_IncomingMessage`.
  - "Import instead of duplicating" says "`parse` reuses `Path`,
    `ValidationError`, `verror`, `prependPath`, `primitive0Validate`,
    `constPrimitiveValidate` from `validate`". `fjs/rtti/parse/module.f.mjs`
    now imports its shared helpers from `fjs/rtti/common/module.f.mjs`, which
    also defines `prependPath` and `Path` (in its `types.ts`), and does not
    import `prependPath` at all.
- **[CONTRIBUTING.md](../CONTRIBUTING.md#running-tests)** gives
  `cd fjs/base64 && fjs test` as the subtree example. There is no `fjs/base64`;
  the codec is `fjs/basen/base64`.
- **[DESIGN.md §6](../doc/DESIGN.md#6-never-precompute-a-size-to-predict-whether-something-fits)**
  lists "`base64Decode` in … `fjs/base64`" among the `try*`-style functions.
  The function is `decode` in
  [`fjs/basen/base64`](../fjs/basen/base64/module.f.mjs), returning
  `Nullable<Vec>`; `base64Decode` is only an import alias in `fjs/mcp/cas`.
- **[changelog/README.md](../changelog/README.md#entries)** uses
  `djs/tokenizer` as its module-path topic example. `fjs/djs` is gone;
  CONTRIBUTING.md's title rule uses `fsc/tokenizer`.
- **[fjs/README.md](../fjs/README.md)** shows the `fjs run` convention in
  TypeScript — `export const main: NodeProgram = options => …` and
  `(v.main as NodeProgram)({ ...options, args })`. Authored modules are
  `.f.mjs` with JSDoc, and `types.ts` / `private.ts` are the only authored
  TypeScript. The dispatcher in `fjs/module.f.mjs` checks that `main` is a
  function and then casts it with `/** @type {NodeProgram} */`.

### Tasks

- [ ] AGENTS.md §7: drop the `apt-get` pair, or mark it as historical
- [ ] fjs/AGENTS.md "Types are `readonly`": replace the `IncomingMessage`
      example with a host type that really has a mutable member, or drop it
- [ ] fjs/AGENTS.md "Composition over intersection": point the host-object
      case at `_IncomingMessage` in `fjs/effects/node/private.ts`
- [ ] fjs/AGENTS.md "Import instead of duplicating": restate the `parse`
      example against `fjs/rtti/common`
- [ ] CONTRIBUTING.md: make the subtree example `cd fjs/basen/base64`
- [ ] DESIGN.md §6: cite `decode` in `fjs/basen/base64`
- [ ] changelog/README.md: replace the `djs/tokenizer` topic example
- [ ] fjs/README.md: write the `fjs run` example as an `.f.mjs` module with
      JSDoc, and show the dispatcher's call as the code spells it

### Related

- [contributor-doc-duplication](./contributor-doc-duplication.md) — rules
  restated across the same documents
