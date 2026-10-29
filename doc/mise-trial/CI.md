# mise CI

All nine jobs use mise across the six native OS/architecture combinations.
The default `fjs ci` generator now requires the caller's committed mise manifest
and lock. `Setup.environment` and generated shell outputs have been removed.

The mise environment is installed before smart-cache initialization, which runs
with mise-provided Node. Cache hits skip checks and their remaining prerequisites.
There is no separate bootstrap Node installation. Packed-package
consumer steps deliberately remain outside the environment and use `setup-node`.
Publishing also uses its own `setup-node`. Native compiler/SDK prerequisites,
i686 Linux multilib and optional runtime limitations are documented in
[the setup guide](./README.md).

## Installed-tool cache

Every mise job keeps its data directory in the checkout's sibling `.mise-ci`
directory. `MISE_RUSTUP_HOME` and `MISE_CARGO_HOME` live inside that tree, so
the action caches Rust's actual toolchains, components and targets together with
mise's install records. The job environment keeps later `mise exec` commands on
the same homes across Linux, macOS and Windows. The `mise-rust-v1` cache prefix
starts fresh rather than restoring entries that omit Rust's state.

The action saves immediately after tool installation, before Cargo builds, so
this cache covers installed tools rather than build outputs. Its logs report
the compressed archive size; GitHub's Actions caches view and API report stored
`size_in_bytes`. Compare those values and cold/warm setup durations when
evaluating the larger cache. PR-created caches belong to that PR's merge ref
and cannot seed the default branch or other PRs.

`npm run gen` regenerates outputs using Node only. Manager locks and supplemental
artifact hashes are refreshed explicitly when accepted tool versions change.
