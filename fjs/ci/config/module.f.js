/**
 * Centralized version pins and OS images used by the CI generator: runner
 * images, tool versions (Bun, Deno, Rust, Node, Wasmtime, Wasmer, TSGO).
 *
 * @module
 */

// https://docs.github.com/en/actions/reference/runners/github-hosted-runners#standard-github-hosted-runners-for-public-repositories
export const images = /** @type {const} */({
    ubuntu: {
        intel: 'ubuntu-26.04',
        arm: 'ubuntu-26.04-arm'
    },
    macos: {
        intel: 'macos-26-intel',
        arm: 'macos-26'
    },
    windows: {
        intel: 'windows-2025',
        arm: 'windows-11-arm',
    }
})

// Bootstrap package version used by generated smoke tests. Keep this on a
// published FunctionalScript release; do not tie it to package.json's current
// in-repo version.
// https://www.npmjs.com/package/functionalscript
export const functionalscript = /** @type {const} */ '0.56.0'

// The one runtime a generated flake takes from outside the pinned snapshot.
// Nixpkgs ships 1.3.13 — on the pin and on `master` — and two of this
// repository's proofs fail on it, one of them a real difference in when
// `Symbol.species` is read rather than a slow machine. So the shared flake
// keeps the snapshot's packaging and replaces only the archive, named by the
// version here and the table below.
//
// This is the exception, not a pattern: it works because Nixpkgs fetches Bun as
// a prebuilt archive, so overriding it moves bytes rather than adopting a
// package definition. Delete this and the table below the day the snapshot
// carries a Bun this suite passes on.
// https://bun.sh/
export const bun = '1.4.3'

// The archive that release publishes for each system a generated flake targets,
// with the SHA-256 its content must have, as an SRI string.
//
// The snapshot's packaging strips a directory whose name it derives from the
// system, so each archive here is the one that recipe already expects.
//
// Verified rather than copied: every archive was downloaded and hashed here,
// and matched an independent packaging of the same release.
// Recompute them the same way when the version above moves —
// `nix-prefetch-url` where Nix is available, otherwise a download and a
// `sha256sum` re-encoded as base64.
/** @type {{ readonly [system: string]: { readonly archive: string, readonly hash: string } }} */
export const bunSources = {
    'aarch64-linux': {
        archive: 'bun-linux-aarch64',
        hash: 'sha256-76mBPaXtckI7+Ef5FujSxHwNd2rdlyNUAmp14Q2pqiE=',
    },
    'x86_64-linux': {
        archive: 'bun-linux-x64',
        hash: 'sha256-PnMFKNiXdfA/h/BcBnh8TfQJnQo38/JS57gpyyOBbhg=',
    },
    'aarch64-darwin': {
        archive: 'bun-darwin-aarch64',
        hash: 'sha256-gK/UwGm0am+o8+xSC+vHUKeEPkqNW5WD0prUNsAKNAM=',
    },
}

// The Deno version the pinned Nixpkgs snapshot below provides — read from
// `pkgs/by-name/de/deno/package.nix` at that commit. The job asserts the
// version the shared flake gives it, so this is checked rather than trusted. Nixpkgs
// trails deno.com, so bump the snapshot first and copy the version it offers.
// https://deno.com/
export const deno = '2.8.3'

// The selected Node version the pinned Nixpkgs snapshot below provides — read
// from `pkgs/development/web/nodejs/v26.nix` at that commit. It feeds the shared
// shell, whose jobs assert the version they actually get, as well
// as every `setup-node` step: Intel macOS, the two Windows jobs, the packed-package check
// closing the `node26` job, and the publishing workflow.
// Nixpkgs usually trails nodejs.org, so bump the snapshot first and copy the
// version it offers rather than the latest release. Keep package.json's Node
// engine, package-lock.json's root engine and .node-version synchronized with
// this exact pin; an accepted update replaces the supported Node version.
// https://nodejs.org/en/download
export const node = /** @type {const} */ ('26.12.0')

// The TypeScript this repository type-checks with, and the one the
// packed-package check installs from npm to check the declarations the packed
// tarball ships.
//
// `attribute` is the Nixpkgs attribute carrying it, and it is not `typescript`.
// That one is the original compiler and the pinned snapshot has it at 5.9.3;
// `typescript-go` is the Go implementation, at exactly the version below, with
// `bin/tsc` symlinked to `tsgo` so the command every script already runs is the
// command the shell provides. Both were read from
// `pkgs/by-name/ty/typescript{,-go}/package.nix` at the commit pinned below.
//
// One version, two package managers, and that is the point of it being here.
// npm resolves the platform binary for the package check, Nix builds it from
// source for the shared shell; nothing in this generator picks a per-platform
// artifact, because both tools already do. It is exact rather than a range in
// both: the package check's consumer project has no lockfile, so a range there
// would let the registry change the verdict with no change here.
//
// The shared shell's Node job asserts it from inside, since the attribute
// names no version — the same tie `deno`, `wasmtime` and `wasmer` have.
// https://github.com/microsoft/typescript-go
export const typescript = /** @type {const} */({
    version: '7.0.2',
    attribute: 'typescript-go',
})

// The Rust the shared shell's flake provides, resolved by `rust-overlay` from
// the official release manifest — so unlike the Nixpkgs pins below, this is an
// exact release rather than whatever a snapshot happens to carry, and the flake
// text names it in full. It is also the version the platform matrix's
// `dtolnay/rust-toolchain` installs; the two are the same constant so they
// cannot drift.
// https://rust-lang.org/
export const rust = '1.99.1'

// How long, in minutes, a job may run once a runner has picked it up. GitHub's
// default is six hours, and a job that hangs holds its runner for all of them:
// two `macos-intel` jobs stuck building their shell held the scarcest runners
// for three and a half hours before they were cancelled by hand. The slowest
// job, `macos-intel`, has taken up to 13.3 minutes, so a job past this limit is
// one that hung rather than one that is slow.
//
// It does not count the wait for a runner. That wait belongs to the merge
// queue's status check timeout, a repository setting, which has to cover it.
// https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#jobsjob_idtimeout-minutes
export const jobTimeout = /** @type {const} */ (15)

// Official Nixpkgs snapshot used by the shared flake. `ref` is the
// stable channel the commit is accepted from; `commit` is the exact revision
// the generated `flake.nix` pins. The Node version above comes from this
// snapshot, so the two move together.
//
// `commit` is the only fact `flake.nix` needs: `inputs.nixpkgs.url` names it
// exactly, so the two other things a `flake.lock` records about a revision —
// `narHash` and `lastModified` — are for real Nix to fill in, by
// `gen.nix/lock-update.sh`, rather than data kept here. See
// `../nix/module.f.mjs`'s `lockUpdateText`.
// https://channels.nixos.org/nixpkgs-26.05-darwin/git-revision
export const nixpkgs = /** @type {const} */({
    owner: 'NixOS',
    repo: 'nixpkgs',
    ref: 'nixpkgs-26.05-darwin',
    commit: '7529d323f8f9926b38df356da2483c2a4e759d00',
})

// `rust-overlay`, the second input of the shared flake. Nixpkgs builds
// one `rustc` and hard-codes the targets it builds `std` for — the host,
// `wasm32-unknown-unknown` and two bare-metal targets — so three of that job's
// four targets have no `std` at any Nixpkgs version. This overlay takes the
// same tarballs `rustup` would, pinned by hashes checked into its own
// repository. `ref` is the branch the commit is accepted from.
// https://github.com/oxalica/rust-overlay
export const rustOverlay = /** @type {const} */({
    owner: 'oxalica',
    repo: 'rust-overlay',
    ref: 'master',
    commit: 'ec07af44be2e0ce4e1a17e00a97d44232607c1ec',
})

// Moving either `commit` above needs `npm run lock-update` (real Nix) to
// refresh the matching `flake.lock` afterward — see `../nix/module.f.mjs`.
// Until that runs, the two disagree and every Nix job fails loudly on it.

// The Wasmtime and Wasmer versions the pinned Nixpkgs snapshot provides — read
// from `pkgs/by-name/wa/{wasmtime,wasmer}/package.nix` at that commit. The
// `ubuntu-arm` job asserts both from inside its shell, which is the only tie there
// is: neither attribute carries a version, so nothing else connects these
// numbers to what the shell provides. Bump the snapshot first and copy what it
// offers, as the Node and Deno pins do.
// https://github.com/bytecodealliance/wasmtime/releases
export const wasmtime = '45.0.2'

// https://github.com/wasmerio/wasmer/releases
export const wasmer = '7.1.0'

// The SpiderMonkey shell the pinned Nixpkgs snapshot provides. The attribute
// names only the major version, so the `ubuntu-arm` job asserts the whole of
// `version` from inside its shell, as it does the WASM runtimes. Bump the
// snapshot first and copy what it offers; a new major is a new attribute.
// https://spidermonkey.dev/
export const spidermonkey = /** @type {const} */ ({
    version: '140.14.0',
    attribute: 'spidermonkey_140',
})

// GitHub Action versions used by CI step builders. The key is the action
// `owner/name`; call sites compose the full ref as
// `` `${name}@${actions[name]}` ``.
// Note: dtolnay/rust-toolchain value is a Rust version, not an action version.
export const actions = /** @type {const} */({
    // https://github.com/marketplace/actions/checkout
    'actions/checkout': 'v7.0.1',
    // https://github.com/marketplace/actions/setup-node-js-environment
    'actions/setup-node': 'v7.1.0',
    // https://github.com/marketplace/actions/cache
    'actions/cache': 'v6.1.0',
    // https://github.com/marketplace/actions/install-nix
    // Enables the `nix-command` and `flakes` experimental features by default.
    'cachix/install-nix-action': 'v31.11.2',
    // https://rust-lang.org/ - value is Rust version, not action version
    'dtolnay/rust-toolchain': rust,
})
