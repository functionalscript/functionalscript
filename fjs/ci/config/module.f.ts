/**
 * Centralized version pins and OS images used by the CI generator: runner
 * images, container base image, tool versions (Bun, Deno, Playwright, Rust,
 * Rustup, Node, Wasmtime, Wasmer, TSGO).
 *
 * Every pin here is an exact version: the generated workflow and the generated
 * `docker/Dockerfile` both read from this module, so a bump lands in both.
 *
 * @module
 */
// https://docs.github.com/en/actions/reference/runners/github-hosted-runners#standard-github-hosted-runners-for-public-repositories
export const images = {
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
} as const

// Base image of the generated `docker/Dockerfile`: a date-stamped Ubuntu
// 26.04 snapshot, the same distribution release as the `ubuntu-26.04`
// GitHub-hosted runners, so Playwright's `install --with-deps` resolves the
// packages it does in CI. The digest is what actually pins the image — a tag,
// even a date-stamped one, can be repointed; the digest is of the multi-arch
// index, so it covers both amd64 and arm64.
// https://hub.docker.com/_/ubuntu/tags
export const dockerBase = 'ubuntu:resolute-20260707@sha256:3131b4cc82a783df6c9df078f86e01819a13594b865c2cad47bd1bca2b7063bb' as const

// Archive snapshot the image's `apt` sources are repointed at. The base image
// tag only pins the initial filesystem — `apt-get update` would otherwise
// resolve whatever the archive holds on the day of the build — so this pins
// the packages too. Move it with `dockerBase`; the service serves every
// architecture and its `Release` files carry no `Valid-Until`.
// https://snapshot.ubuntu.com/
export const dockerSnapshot = '20260707T000000Z' as const

// Bootstrap package version used by generated smoke tests. Keep this on a
// published FunctionalScript release; do not tie it to package.json's current
// in-repo version.
// https://www.npmjs.com/package/functionalscript
export const functionalscript = '0.38.0' as const

// https://bun.sh/
export const bun = '1.3.14' as const

// https://deno.com/
export const deno = '2.9.4' as const

// https://www.npmjs.com/package/playwright
export const playwright = '1.62.0' as const

// https://nodejs.org/en/download
export const node = {
    default: '26.5.0',
    node22: '22.23.1',
    node24: '24.18.0',
} as const

// Installer used by the container image to pin the Rust toolchain; the
// toolchain version itself is `actions['dtolnay/rust-toolchain']`.
// https://static.rust-lang.org/rustup/release-stable.toml
export const rustup = '1.29.0' as const

// Toolchain components CI lints with. Comma-separated is the form both
// `dtolnay/rust-toolchain` and `rustup-init --component` take — the latter
// rejects space-separated values.
export const rustComponents = 'rustfmt,clippy' as const

// https://github.com/bytecodealliance/wasmtime/releases
export const wasmtime = '47.0.2' as const

// https://github.com/wasmerio/wasmer/releases
export const wasmer = '7.2.1' as const

// SHA-256 of every archive the container image downloads, keyed by tool and by
// `dpkg --print-architecture` name. A version-specific URL is not by itself
// immutable — a release asset can be replaced or deleted under the same tag —
// so the image verifies what it downloaded instead of trusting the URL. Move
// these with the version pin above; recompute with
// `curl -fsSL <url> | sha256sum`.
export const sha256 = {
    // https://nodejs.org/dist/v26.5.0/SHASUMS256.txt
    node: {
        amd64: '9f619528f1db5ddc41dccf54211066fb42228d69a156733c69cb9d6cc92e358c',
        arm64: '036df0b49662ebb350eb56f1cac603699b1e9ed1e2603ee129fefda473479030',
    },
    deno: {
        amd64: 'c24f955d9fbfe0ea5ae2b501c8e71ae76e31e4c9782390a54a284b3364fda725',
        arm64: '111da5c05c240cfdc4340f234a0e3539d39dbcb6755221f19dcd60bacc8be5aa',
    },
    bun: {
        amd64: '951ee2aee855f08595aeec6225226a298d3fea83a3dcd6465c09cbccdf7e848f',
        arm64: 'a27ffb63a8310375836e0d6f668ae17fa8d8d18b88c37c821c65331973a19a3b',
    },
    rustup: {
        amd64: '4acc9acc76d5079515b46346a485974457b5a79893cfb01112423c89aeb5aa10',
        arm64: '9732d6c5e2a098d3521fca8145d826ae0aaa067ef2385ead08e6feac88fa5792',
    },
    wasmtime: {
        amd64: '9ec85751649139711b6a5061c4f48a41412bf9b1ab98a08b9924ca73f22ca575',
        arm64: '5bb3fe06876a1c3f4043781590b4c0a69e9237549023ccd441c18083f11decd5',
    },
    wasmer: {
        amd64: 'c46d6ff34a12b40d2e57bfc2ccbb8b9e209b0987ab305233619798b264a6bae5',
        arm64: '5a434db36f96d483e9967aa1b3ffd129f5b8781ea58faf1b80aeee6f5fb91f63',
    },
} as const

// GitHub Action versions used by CI step builders. The key is the action
// `owner/name`; call sites compose the full ref as
// `` `${name}@${actions[name]}` ``.
// Note: dtolnay/rust-toolchain value is a Rust version, not an action version.
export const actions = {
    // https://github.com/marketplace/actions/checkout
    'actions/checkout': 'v7.0.1',
    // https://github.com/marketplace/actions/setup-node-js-environment
    'actions/setup-node': 'v7.0.0',
    // https://github.com/marketplace/actions/cache
    'actions/cache': 'v6.1.0',
    // https://github.com/marketplace/actions/setup-deno
    'denoland/setup-deno': 'v2.0.5',
    // https://github.com/marketplace/actions/setup-bun
    'oven-sh/setup-bun': 'v2.2.0',
    // https://github.com/bytecodealliance/actions
    'bytecodealliance/actions/wasmtime/setup': 'v1.1.3',
    // https://github.com/wasmerio/setup-wasmer
    'wasmerio/setup-wasmer': 'v3.1',
    // https://rust-lang.org/ - value is Rust version, not action version
    'dtolnay/rust-toolchain': '1.97.1',
} as const
