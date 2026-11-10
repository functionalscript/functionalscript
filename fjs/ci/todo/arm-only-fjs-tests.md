# Run fjs tests only on ARM

**Status:** wip

Remove the host-JavaScript proof runs under `fjs/` from Intel CI jobs.
Keep the ARM suites and native Rust checks.

## Tasks

- [ ] Update the generator, proofs and documentation, then regenerate workflows.
