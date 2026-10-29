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

`npm run gen` regenerates outputs using Node only. Manager locks and supplemental
artifact hashes are refreshed explicitly when accepted tool versions change.
