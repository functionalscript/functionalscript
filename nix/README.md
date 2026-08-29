# Nix environments

`<job>/flake.nix` is **generated** by [`fjs/ci/nix`](../fjs/ci/nix/module.f.mjs)
— one self-contained flake per CI job, in a directory named after the job. Do
not edit these files by hand: run `npm run ci-update` and commit the result. The
Node 26 CI job fails when the committed files no longer match the generator's
output. This README is the one file here that is written by hand.

Each flake pins the exact Nixpkgs commit from
[`fjs/ci/config`](../fjs/ci/config/module.f.mjs) and exposes a single
development shell for the job's runner:

```sh
nix develop ./nix/node24 --command node --version
```

The pinned commit determines the package versions: `pkgs.nodejs_24` at that
revision is one exact Node release, recorded in `fjs/ci/config` and installed by
the jobs that still use `setup-node`, so every runtime in CI runs the identical
Node. The flakes do not restate that version — a job checks it from inside the
shell instead (below), which also catches a shell that builds but provides the
wrong binary.

The files stay static and readable on purpose — no job selection, no
`flake-utils`, no shared Nix modules. A job that later needs a second system
gets a second explicit `devShells.<system>.default` attribute rather than a
loop.

`flake.lock` files that Nix writes next to a generated flake are ignored (see
the root `.gitignore`); the pinned commit in `flake.nix` is the lock.

The Node 24 and Node 26 jobs run through their flakes: each installs Nix, checks
the Node its shell provides, and then runs its commands one `nix develop` step
each, because a CI step runs one command. The check is the same one Node 22
still makes of the runtime `setup-node` gives it, and no separate job makes it;
a flake is checked by the job that uses it.

Node 26's drift check is a plain step, not a `nix develop` one: `git` is the
runner's tool, and a step names the flake only when it needs something the flake
pins.

Nix runs nowhere else in CI. What a generated flake declares — the pinned
commit, the job's default shell, and the `nodejs_<major>` its configured version
implies — is asserted by `fjs/ci/proof.f.mjs` against the generator's output,
which needs no Nix; the Node 22 flake is first evaluated when that job
migrates.
