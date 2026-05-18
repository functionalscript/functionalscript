# AGENT Instructions

This repository contains both Node.js (TypeScript) and Rust code. Check the [./issues/README.md](./issues/README.md) file for existing issues.

## Requirements

- Use **Node.js 22 or later**.
- Install Node dependencies with `npm ci`.
- Install Rust dependencies with `cargo fetch`.

If either installation fails, skip all test commands.

## Update

It's recommended to run `npm run update` after changing the source code.

## Testing

- Run `npx tsc` to type-check using the repository's version of TypeScript.
- Run `npm test` to test FunctionalScript (`.f.ts`) files with Node 22+.
- Run `cargo test` to test the Rust crate in `nanvm-lib`.
- Run `cargo clippy` to lint the Rust crate.
- Run `cargo fmt -- --check` to verify formatting.
- To run only the tests under a specific directory, `cd` into it and run `npm run fst`. This scans for `test.f.ts` files in that subtree and reports per-test results.

## Documentation

Use JSDoc for documenting TypeScript files. Every module should start with this header:

```ts
/**
 * <...Module documentation...>
 *
 * @module
 */
```

where `<...Module documentation...>` should be documentation for the module.

## Pull Requests

- The PR should implement only one feature/improvement with minimal code changes.
- Principles:
  - Reuse code,
  - Don't repeat yourself,
  - Avoid side effects and mutability.
- When a sibling module already has the type or helper you need, import it — add `export` to the existing declaration if it's not yet exported, rather than duplicating it (e.g. `parse` reuses `Path`, `ValidationError`, `verror`, `prependPath`, `primitive0Validate`, `constPrimitiveValidate` from `validate`).
- Don't mutate arrays, sets, maps, or objects in place. Avoid `.push`, `.pop`, `.shift`, `.unshift`, `.splice`, `.sort`, `.reverse`, `Set#add`, `Set#delete`, `Map#set`, `Map#delete`, and index/property assignment on accumulators. Build new values with `.map`, `.filter`, `.flatMap`, spread, `new Set([...prev, x])`, `new Map([...prev, [k, v]])`, and `Object.fromEntries(entries.map(...))`.
- Hoist helpers (functions, types, constants) to module scope when they don't capture local state — don't redeclare them inside another function on every call. If a `reduce`/`map` callback needs context that varies per call, thread it through the accumulator rather than closing over a local, so the step function itself can live at module scope.
- When adding a new `module.f.ts` under an existing namespace, register it in the `exports` map of `deno.json`.
- After fixing an issue from [./issues/README.md](./issues/README.md), mark the corresponding bullet `[X]`.
- Reference issues from [./issues/README.md](./issues/README.md) with the `i` prefix as an explicit link, not GitHub's `#` prefix. `#NNN` is reserved for GitHub PR/issue numbers; `iNNN` refers to entries in `issues/README.md`. Always render the reference as a markdown link, e.g. [i135](./issues/README.md), so the reader can navigate to the issue list.
- Add an entry for the change under `## Unreleased` in [./CHANGELOG.md](./CHANGELOG.md), in the same `Topic: short description [NNN](url)` style as existing entries. The link must point to the pull request (`/pull/NNN`), not to an issue — update it to the real PR number once the PR is opened.
- When the version is bumped in `deno.json`/`package.json`, create a new `## X.Y.Z` section in `CHANGELOG.md` immediately after `## Unreleased` and move all entries from `## Unreleased` into it, leaving `## Unreleased` empty.
- Only import other `.f.ts` files from FunctionalScript modules. Avoid references to built-in or external Node modules such as `node:path` in `.f.ts` files.
- Prefer `.flatMap(e => e !== undefined ? [e] : [])` over `.filter((e): e is T => e !== undefined)` to remove `undefined` entries from an array. Type predicates in `filter` are error-prone: if the element type changes, the predicate silently becomes wrong. `flatMap` narrows correctly without a manual type annotation.
- Avoid `as` type assertions (except `as const`). They silence the type checker and hide real bugs — if a cast is needed, it usually means the types or the code structure should be improved instead.
- Use `let` variables only within the function body where they are declared.
- CLI parameters are preferred over environment variables when adding new features.
- Ensure all of the above tests pass before submitting changes.
