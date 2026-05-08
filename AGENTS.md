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
- Don't mutate arrays or objects in place. Avoid `.push`, `.pop`, `.shift`, `.unshift`, `.splice`, `.sort`, `.reverse`, and index/property assignment on accumulators. Build new values with `.map`, `.filter`, `.flatMap`, spread, and `Object.fromEntries(entries.map(...))`.
- When adding a new `module.f.ts` under an existing namespace, register it in the `exports` map of `deno.json`.
- After fixing an issue from [./issues/README.md](./issues/README.md), mark the corresponding bullet `[X]`.
- Reference issues from [./issues/README.md](./issues/README.md) with the `i` prefix as an explicit link, not GitHub's `#` prefix. `#NNN` is reserved for GitHub PR/issue numbers; `iNNN` refers to entries in `issues/README.md`. Always render the reference as a markdown link, e.g. [i135](./issues/README.md), so the reader can navigate to the issue list.
- Add an entry for the change under `## Unreleased` in [./CHANGELOG.md](./CHANGELOG.md), in the same `Topic: short description [PR#](url)` style as existing entries.
- Only import other `.f.ts` files from FunctionalScript modules. Avoid references to built-in or external Node modules such as `node:path` in `.f.ts` files.
- Use `let` variables only within the function body where they are declared.
- CLI parameters are preferred over environment variables when adding new features.
- Ensure all of the above tests pass before submitting changes.
