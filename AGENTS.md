# AGENT Instructions

This repository contains both Node.js (TypeScript) and Rust code. Check the [./issues/README.md](./issues/README.md) file for existing issues.

## Requirements

- Use **Node.js 24 or later** for scripts whenever possible. Environments running Node 22 can work with the modified test command noted below.
- Install Node dependencies with `npm ci`.
- Install Rust dependencies with `cargo fetch`.

If either installation fails, skip all test commands.

## Testing

- Run `npx tsc` to type-check using the repository's version of TypeScript.
- Run `npm test` to test FunctionalScript (`.f.ts`) files with Node 24+.
  If your environment uses Node 22, run `npm run test22` instead so that Node's `--experimental-strip-types` flag is applied.
- Run `cargo test` to test the Rust crate in `nanvm-lib`.
- Run `cargo clippy` to lint the Rust crate.
- Run `cargo fmt -- --check` to verify formatting.

## Pull Requests

- The PR should implement only one feature/improvement with minimal code changes.
- Principles:
  - Reuse code,
  - Don't repeat yourself,
  - Avoid side effects and mutability.
- Prefer CLI parameters over environment variables when adding new features.
- Ensure all of the above tests pass before submitting changes.
