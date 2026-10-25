# pixi CI

All nine jobs use pixi across the six native OS/architecture combinations.
The default `fjs ci` generator now requires the caller's committed pixi manifest
and lock. `Setup.environment` and generated shell outputs have been removed.

The migration preserves every check and smart-cache prerequisite. Packed-package
consumer steps deliberately remain outside the environment and use `setup-node`.
Publishing also uses its own `setup-node`. Native compiler/SDK prerequisites,
i686 Linux multilib and optional runtime limitations are documented in
[the setup guide](./README.md).

`npm run gen` regenerates outputs using Node only. Manager locks and supplemental
artifact hashes are refreshed explicitly when accepted tool versions change.
