# mise CI

Eleven of the twelve jobs use mise across the six native OS/architecture
combinations. The `package` consumer job uses pinned `setup-node` and
npm-installed TypeScript, without a checkout or mise.
The default `fjs ci` generator now requires the caller's committed mise manifest
and lock. `Setup.environment` and generated shell outputs have been removed.

The mise environment is installed before smart-cache initialization, which runs
with mise-provided Node. Cache hits skip checks and their remaining prerequisites.
The separate `cov` job uses the same locked environment and always runs coverage
without smart-cache initialization.
There is no separate bootstrap Node installation. `node` always packs and
uploads the `package-tarball` artifact; `package` waits for `node`, downloads
it into a clean temporary consumer and runs the existing package checks.
Packing, its dependency/compiler prerequisites and consumer validation run
without whole-check caching.
Publishing also uses its own `setup-node`. Native compiler/SDK prerequisites,
i686 Linux multilib and optional runtime limitations are documented in
[the setup guide](./README.md).

`npm run gen` regenerates outputs using Node only. Manager locks and supplemental
artifact hashes are refreshed explicitly when accepted tool versions change.
