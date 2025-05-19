# AGENT Instructions

This repository contains both Node.js (TypeScript) and Rust code.

## Requirements
- Use **Node.js version 24 or later** when running scripts. Node 24+ is strongly recommended; in rare cases Node 22 may be used with modified commands.
- Install Node dependencies with `npm ci`.
- Install Rust dependencies with `cargo fetch`.

## Testing
- Run `npx tsc` to type-check using the repository's version of TypeScript.
- Run `npm test` to compile TypeScript and execute the JS test suite. If your environment runs on Node 22, you must use `npm run test22` instead.
- Run `cargo test` to test the Rust crate in `nanvm-lib`.

## Pull Requests
- Ensure all of the above tests pass before submitting changes.
