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

| Tool                     | Pinned by                                    |
| ------------------------ | -------------------------------------------- |
| Ubuntu (base image)      | `dockerBase` — a date-stamped 26.04 snapshot |
| Node.js                  | `node.default`                               |
| Deno                     | `deno`                                       |
| Bun                      | `bun`                                        |
| Rust toolchain + targets | `actions['dtolnay/rust-toolchain']`, `rustup` |
| Wasmtime                 | `wasmtime`                                   |
| Wasmer                   | `wasmer`                                     |
| Playwright + browsers    | `playwright`                                 |
| FunctionalScript CLI     | `functionalscript`                           |

Each tool is fetched from an immutable, version-specific release URL: no
`latest` tag, no rolling base-image tag, and no installer script that resolves
"the newest" at build time. Rebuilding an unchanged `Dockerfile` therefore
installs the versions it installed before. The Node.js archive is additionally
verified against the release `SHASUMS256.txt`.

### Why release archives and not Nix

Installing the tools with Nix was considered for reproducibility. Nixpkgs pins
versions by channel revision rather than per package, so holding Node, Deno,
Bun, Rust, Wasmtime, and Wasmer at exactly the versions CI uses would mean
pinning a separate nixpkgs revision per tool — more moving parts than fetching
each tool's own release archive, which is already immutable and
version-addressed. Playwright's browsers and their system dependencies are also
hard to express as Nix derivations. Nix stays under evaluation for macOS CI,
where a Linux container is not an option.

The `apt` packages are the one exception: their versions come from the pinned
base-image snapshot rather than from individual `=version` pins, which would
break as soon as the mirror drops an older build. Bumping `dockerBase` is what
moves them.

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
