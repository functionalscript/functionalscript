# Dockerfile

`Dockerfile` is **generated** — do not edit it by hand. Its source is
[fjs/ci/docker/module.f.ts](../fjs/ci/docker/module.f.ts), and every version it
installs is pinned in [fjs/ci/config/module.f.ts](../fjs/ci/config/module.f.ts),
the same module `.github/workflows/ci.yml` is generated from. To change a
version, edit the pin and run `npm run ci-update`; the `node26` CI job
regenerates both files and fails when the committed ones differ, so the image
and the workflow always install the same versions.

## What the image contains

The image carries tools only — no copy of the repository — so the same image
serves a mounted working tree locally and a checkout in a CI job.

| Tool                     | Pinned by                                     |
| ------------------------ | --------------------------------------------- |
| Ubuntu (base image)      | `dockerBase` — 26.04 by digest                |
| `apt` packages           | `dockerSnapshot` — a dated archive snapshot   |
| Node.js                  | `node.default` + `sha256.node`                |
| Deno                     | `deno` + `sha256.deno`                        |
| Bun                      | `bun` + `sha256.bun`                          |
| Rust toolchain + targets | `actions['dtolnay/rust-toolchain']`, `rustup` + `sha256.rustup` |
| Wasmtime                 | `wasmtime` + `sha256.wasmtime`                |
| Wasmer                   | `wasmer` + `sha256.wasmer`                    |
| Playwright + browsers    | `playwright`                                  |
| FunctionalScript CLI     | `functionalscript`                            |

Nothing enters the image unpinned. There is no `latest` tag, no rolling
base-image tag, and no installer script that resolves "the newest" at build
time. Two details go beyond naming a version:

- **The base image is referenced by digest.** A tag, even a date-stamped one,
  can be repointed; the digest cannot. It is the digest of the multi-arch
  index, so it covers `amd64` and `arm64` alike.
- **Every downloaded archive is checked against a committed SHA-256.** A
  version-specific release URL is not by itself an integrity guarantee — a
  release asset can be replaced or deleted under the same tag — so the image
  verifies what it got rather than trusting the URL. The hashes live in
  `sha256` in the config module; recompute them with
  `curl -fsSL <url> | sha256sum` whenever a version pin moves.

The two npm-installed CLIs (`playwright`, `functionalscript`) are the
exception: they are pinned to exact versions and integrity-checked by npm
against the registry, not by a hash committed here.

### Why release archives and not Nix

Installing the tools with Nix was considered for reproducibility. Nixpkgs pins
versions by channel revision rather than per package, so holding Node, Deno,
Bun, Rust, Wasmtime, and Wasmer at exactly the versions CI uses would mean
pinning a separate nixpkgs revision per tool — more moving parts than fetching
each tool's own release archive, which is already immutable and
version-addressed. Playwright's browsers and their system dependencies are also
hard to express as Nix derivations. Nix stays under evaluation for macOS CI,
where a Linux container is not an option.

### How `apt` is pinned

A base-image digest pins only the initial filesystem — `apt-get update` would
still resolve whatever the archive holds on the day of the build. So the image
repoints `apt` at [snapshot.ubuntu.com](https://snapshot.ubuntu.com/) at the
date in `dockerSnapshot` before installing anything, and moves that pin
together with `dockerBase`. Individual `=version` pins would break instead, as
soon as the mirror drops an older build.

That service is reachable over HTTPS only, and the Ubuntu base image ships no
CA bundle at all — `ca-certificates` is one of the packages installed from the
snapshot. Fetching a trust anchor from the live archive first would put one
unpinned package into the image, so instead peer verification is disabled for
that single host until `ca-certificates` lands, and the apt config enabling it
is deleted in the same layer. Integrity does not rest on TLS either way: the
packages are GPG-signed and verified by the `gpgv` and `ubuntu-keyring` the
base image does ship — the same guarantee a plain-HTTP mirror gives. Every
later `apt` call, including Playwright's `install --with-deps`, verifies the
certificate normally.

Both `amd64` and `arm64` are supported — matching the `ubuntu-26.04` and
`ubuntu-26.04-arm` runners — and any other architecture fails the build instead
of installing something unintended.

## Build

Run the command from the repo root.

```sh
docker build -t functionalscript ./docker
```

## Run

Mount the working tree at `/workspace`, the image's working directory:

```sh
docker run --rm -it -v "$PWD:/workspace" functionalscript
```

Or a clean version w/o network, once the image is built:

```sh
docker run --rm -it --network none -v "$PWD:/workspace" functionalscript
```

## Container commands

```sh
cargo test
npm ci && npm test
fjs t
deno task test
bun test
npx playwright test
```

## Codex setup

```sh
rustup component add clippy
rustup component add rustfmt

# Install Node.js dependencies.
npm ci

# Install Rust dependencies.
cargo fetch

rustup show
node -v
```
