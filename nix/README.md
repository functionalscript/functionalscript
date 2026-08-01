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

Each flake asserts the version of every package it declares:

```nix
assert pkgs.nodejs_24.version == "24.18.0";
```

The expected versions live in `fjs/ci/config` and are the same ones the
GitHub-hosted jobs install with `setup-node`, so every runtime in CI runs the
identical Node. A snapshot that ships a different version fails evaluation
rather than silently diverging.

The files stay static and readable on purpose — no job selection, no
`flake-utils`, no shared Nix modules. A job that later needs a second system
gets a second explicit `devShells.<system>.default` attribute rather than a
loop.

`flake.lock` files that Nix writes next to a generated flake are ignored (see
the root `.gitignore`); the pinned commit in `flake.nix` is the lock.

CI's temporary `nix-flakes` job runs exactly that command for every generated
flake and compares the output to the expected version, so these files are
checked on every pull request even though no real job uses them yet.
