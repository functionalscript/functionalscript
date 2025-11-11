# AGENT Instructions

This repository contains both Node.js (TypeScript) and Rust code. Check the [./issues/README.md](./issues/README.md) file for existing issues.

## Requirements

- Use **Node.js 22 or later** for scripts whenever possible.
- Install Node dependencies with `npm ci`.
- Install Rust dependencies with `cargo fetch`.

If either installation fails, skip all test commands.

## Testing

- Run `npx tsc` to type-check using the repository's version of TypeScript.
- Run `npm test` to test FunctionalScript (`.f.ts`) files with Node 22+.
- Run `cargo test` to test the Rust crate in `nanvm-lib`.
- Run `cargo clippy` to lint the Rust crate.
- Run `cargo fmt -- --check` to verify formatting.

## Pull Requests

- The PR should implement only one feature/improvement with minimal code changes.
- Principles:
  - Reuse code,
  - Don't repeat yourself,
  - Avoid side effects and mutability.
- Only import other `.f.ts` files from FunctionalScript modules. Avoid references to built-in or external Node modules such as `node:path` in `.f.ts` files.
- Use `let` variables only within the function body where they are declared.
- CLI parameters are preferred over environment variables when adding new features.
- Ensure all of the above tests pass before submitting changes.
