/**
 * What the Cloudflare site build runs, decided here and performed by
 * `../cloudflare-build.mjs`: the `rustup-init` that installs the pinned Rust,
 * the `cargo doc` that documents the workspace, and the generator.
 *
 * Cloudflare's build image carries no Rust, so the build installs one. Its
 * version is {@link rust} from `fjs/ci/config`, the same constant the shared
 * shell and the platform matrix take, so the site documents the crates with
 * the compiler CI tests them with and nothing is written in the dashboard that
 * could drift from it.
 *
 * @module
 */

import { rust } from '../../ci/config/module.f.js'

/**
 * The target triple `rustup` publishes an installer for, by Node's names for
 * the host, or `null` where this build has no installer.
 *
 * Cloudflare builds on x86-64 Linux. The other three are the developer
 * machines this script may be run on by hand; a host outside the four is
 * refused rather than guessed at.
 *
 * @type {(platform: string, arch: string) => string | null}
 */
export const targetTriple = (platform, arch) => {
    const cpu = arch === 'x64' ? 'x86_64' : arch === 'arm64' ? 'aarch64' : null
    const os = platform === 'linux' ? 'unknown-linux-gnu' : platform === 'darwin' ? 'apple-darwin' : null
    return cpu === null || os === null ? null : `${cpu}-${os}`
}

/**
 * Where the official `rustup-init` for a target is published.
 *
 * @type {(triple: string) => string}
 */
export const rustupInitUrl = triple => `https://static.rust-lang.org/rustup/dist/${triple}/rustup-init`

/**
 * `rustup-init`'s arguments: non-interactive, the smallest profile that
 * carries `cargo` and `rustdoc`, exactly the pinned toolchain, and no edit to
 * the build's shell profile.
 *
 * @type {readonly string[]}
 */
export const rustupInitArgs = ['-y', '--profile', 'minimal', '--default-toolchain', rust, '--no-modify-path']

/**
 * `cargo`'s arguments: the workspace's own crates, without their
 * dependencies' documentation.
 *
 * @type {readonly string[]}
 */
export const docArgs = ['doc', '--no-deps', '--workspace']
