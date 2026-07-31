# Nix environments

`generated/<job>/flake.nix` is **generated** by [`fjs/ci/nix`](../fjs/ci/nix/module.f.ts)
— one self-contained flake per CI job. Do not edit these files by hand: run
`npm run ci-update` and commit the result. The Node 26 CI job fails when the
committed files no longer match the generator's output.

Each flake pins the exact Nixpkgs commit from
[`fjs/ci/config`](../fjs/ci/config/module.f.ts) and exposes a single
development shell for the job's runner:

```sh
nix develop ./nix/generated/node24 --command node --version
```

The files stay static and readable on purpose — no job selection, no
`flake-utils`, no shared Nix modules. A job that later needs a second system
gets a second explicit `devShells.<system>.default` attribute rather than a
loop.

`flake.lock` files that Nix writes next to a generated flake are ignored (see
the root `.gitignore`); the pinned commit in `flake.nix` is the lock.
