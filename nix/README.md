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

The pinned commit determines the package versions: `pkgs.nodejs_24` at that
revision is one exact Node release, recorded in `fjs/ci/config` and installed by
the GitHub-hosted jobs with `setup-node`, so every runtime in CI runs the
identical Node. The flakes do not restate that version — CI's `nix-flakes` job
checks it instead (below), which also catches a shell that builds but provides
the wrong binary.

The files stay static and readable on purpose — no job selection, no
`flake-utils`, no shared Nix modules. A job that later needs a second system
gets a second explicit `devShells.<system>.default` attribute rather than a
loop.

`flake.lock` files that Nix writes next to a generated flake are ignored (see
the root `.gitignore`); the pinned commit in `flake.nix` is the lock.

CI's temporary `nix-flakes` job runs exactly that command for every generated
flake and compares the output to the expected version, so these files are
checked on every pull request even though no real job uses them yet.

## Job images

A job that runs in a container gets a second output in the same flake:

```sh
"$(nix build ./nix/generated/playwright#oci --no-link --print-out-paths)" | docker load
docker run --rm --ipc=host --volume "$PWD:/workspace" functionalscript-playwright:<nixpkgs-commit> node --version
```

`packages.<system>.oci` is a `dockerTools.streamLayeredImage` derivation — a
script that writes the image archive to standard output, so the archive is never
stored alongside the layers it is made of. `--no-link` keeps a `result` symlink
out of the checkout.

The image and the development shell come from **one** declaration: the job's
`packages` and environment variables reach both. Only what a shell inherits from
the runner and a container has to provide itself is added — `PATH` and `HOME`,
`/bin/sh` and the core utilities, the certificate bundle, `/etc/passwd`, and a
writable `/tmp`.

Store paths reach the image through the environment: `Env` interpolates them,
and `streamLayeredImage` treats the image configuration as a closure root, so
naming `pkgs.playwright-driver.browsers` there is what puts the browsers in the
image. The image is tagged with the pinned Nixpkgs commit, which — together with
the generated flake in this repository — is its whole identity. It is built by
the job that uses it; nothing is pushed to a registry.
