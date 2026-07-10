## Rename top-level `fs/` to `fjs/`

**Priority:** P3
**Status:** open

Rename the top-level source directory `fs/` to `fjs/`.

### Why

- `fs` collides with Node's built-in `fs` module. A consumer import like
  `functionalscript/fs/asserts/module.js` reads as filesystem-related, and
  inside the repo a directory named `fs` next to code doing
  `import ... from 'node:fs'` invites double-takes.
- `fjs` is already the project's public verb: the npm `bin` is `fjs` and the
  `deno.json` task is named `fjs`. Renaming the directory aligns the source
  tree with the name users actually type and with FunctionalScript/`.f.ts`
  branding.
- Mechanically cheap: cross-module imports are relative, so the rename itself
  does not touch them. The blast radius outside the tree is `package.json`
  (scripts, `bin`), `deno.json` (`fjs` task), and a small number of path
  references in docs (README, CHANGELOG, `todo/` files). CI workflows do not
  reference `fs/` at all.

### Caveats

- **Breaking change for npm consumers.** Directory paths are the public API
  (no `exports` map), so every published import path changes:
  `functionalscript/fs/...` → `functionalscript/fjs/...`. Needs a
  **breaking** CHANGELOG entry. Optionally ship a transition release where
  `fs/` re-exports from `fjs/` for a version or two.
- **`fs/fjs/` remnant.** After the `fjs` bin was promoted to the `fs/` root
  (see [group-fs-subdirectories-by-concern](group-fs-subdirectories-by-concern.md)),
  `fs/fjs/` holds only leftover `todo/` files describing the CLI. Move them
  to `fs/todo/` (i.e. the future `fjs/todo/`) and delete `fs/fjs/` before or
  as part of the rename, so the result is not a confusing `fjs/fjs/`.

### Considered alternative

Flattening `fs/*` to the repo root would shorten consumer paths
(`functionalscript/asserts/...`) and remove the collision entirely, but is a
much bigger break and mixes source with repo infrastructure (`docker/`,
`nanvm-lib/`, `todo/`). The `fjs/` rename is the conservative move.

### Tasks

- [ ] Move `fs/fjs/todo/*` to `fs/todo/` and delete `fs/fjs/`.
- [ ] `git mv fs fjs`.
- [ ] Update `package.json`: `bin.fjs` and all script paths.
- [ ] Update `deno.json`: `fjs` task path.
- [ ] Update path references in README, docs, and `todo/` files.
- [ ] Add a **breaking** CHANGELOG entry (`functionalscript/fs/...` →
      `functionalscript/fjs/...`); decide whether to ship a transition
      release with `fs/` re-export stubs.
- [ ] Verify `npx tsc` and `fjs t` pass.
