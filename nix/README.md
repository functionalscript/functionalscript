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
nix develop --no-write-lock-file ./nix/node24 --command node --version
```

The pinned commit determines the package versions: `pkgs.nodejs_24` at that
revision is one exact Node release, and the same number is recorded in
`fjs/ci/config`. The flakes do not restate it — the job checks it from inside
the shell instead (below), which also catches a shell that builds but provides
the wrong binary. `pkgs.deno` and `pkgs.bun` name no version at all, so for
those two jobs the check is the only thing tying the recorded version to what
the shell provides.

The files stay static and readable on purpose — no job selection, no
`flake-utils`, no shared Nix modules. A job that later needs a second system
gets a second explicit `devShells.<system>.default` attribute rather than a
loop.

The pinned commit in `flake.nix` is the lock, so nothing needs a `flake.lock`
beside it. CI passes `--no-write-lock-file` to every `nix develop`, which is why
its runs leave the checkout untouched; the root `.gitignore` still ignores those
files, for a hand-run `nix develop` that omits the flag.

Every canonical job runs through its flake — the three Node jobs, `deno` and
`bun`. Each installs Nix, checks the runtime its shell provides, and then runs
its commands one `nix develop` step each, because a CI step runs one command. No
separate job makes that check — a flake is checked by the job that uses it, and
every generated flake has one.

The check's shape follows the runtime rather than a convention: `node --version`
and `bun --version` print one line, differing only in Node's leading `v`, while
`deno --version` prints three — the runtime, V8 and TypeScript — so Deno is
asked for `Deno.version.deno` instead of having two versions nobody configured
pinned by accident.

Node 26's drift check is a plain step, not a `nix develop` one: `git` is the
runner's tool, and a step names the flake only when it needs something the flake
pins.

Nix runs nowhere else in CI. What a generated flake declares is asserted without
Nix by two proofs: `fjs/ci/proof.f.mjs` requires the written file to equal the
generator's text for that job, and each Node job's package attribute to follow
the configured version; `fjs/ci/nix/proof.f.mjs` pins that text character for
character, the pinned commit and `devShells.<system>.default` included.
