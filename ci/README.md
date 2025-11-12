# Continuous integration workflow generator

This directory contains the FunctionalScript source that defines the GitHub Actions
workflow for this repository. Running the generator writes `.github/workflows/ci.yml`
with the latest matrix of jobs and steps that we support.

## Files

- `module.f.ts` – the FunctionalScript description of the CI pipeline. It declares
  the operating systems, architectures, tools, and test suites that every job runs.
  The script also knows how to set up platform specific dependencies such as
  Rust targets, Playwright browsers, and alternative runtimes (Deno and Bun).
- `module.ts` – the Node.js entry point that runs the FunctionalScript generator
  using the shared IO helpers from `../io/module.ts`.

## Usage

1. Ensure dependencies are installed with `npm ci`.
2. Regenerate the workflow definition by running either of the following commands:
   - `npm run ci-update`
   - `node ./ci/module.ts`
3. Commit the updated `.github/workflows/ci.yml` if it has changed.

The generator is idempotent – rerunning it without modifying `module.f.ts` will
produce the same workflow file.
