/**
 * Types for generated CI Nix flakes.
 *
 * @module
 */

import type { _Reference } from '../../media/nix/types.ts'

/**
 * A Rust toolchain for a job that needs one, taken from the `rust-overlay`
 * input rather than from Nixpkgs.
 *
 * Nixpkgs builds one `rustc` and hard-codes the targets it builds `std` for, so
 * a job needing any other target cannot get it from the snapshot at any
 * version. `rust-overlay` unpacks the same release artifacts `rustup` would,
 * pinned by hashes checked into its own repository, and a job says here which
 * of them it wants.
 */
export type NixRust = {
    /** Exact stable Rust release, e.g. `1.98.0`, named in full by the flake. */
    readonly version: string
    /** Components beyond the `minimal` profile, e.g. `clippy`. */
    readonly extensions: readonly string[]
    /** Targets whose `rust-std` the shell must carry. */
    readonly targets: readonly string[]
}

/**
 * A Nixpkgs package replaced by an exact upstream release the pinned snapshot
 * does not carry.
 *
 * The snapshot decides every other version in these flakes, and that is what
 * pinning it is for. This is the deliberate exception: a job whose runtime the
 * snapshot has, at a version this repository's proofs fail on. The override
 * keeps the snapshot's packaging — the unpacking, the `autoPatchelfHook`, the
 * wrapper — and replaces only the archive, so what moves is the bytes rather
 * than the recipe.
 *
 * It is not a route around Nixpkgs in general. Only a package the snapshot
 * already fetches as a prebuilt archive can move this way; anything built from
 * source would become a package definition this repository maintains.
 */
export type NixPin = {
    /** Nixpkgs attribute to override, e.g. `bun`. */
    readonly package: string
    /** The release the override installs. */
    readonly version: string
    /**
     * The archive to unpack, by Nix system.
     *
     * One entry per system the job declares, because both halves vary with it:
     * a release publishes a different file per platform, and each has its own
     * hash. The snapshot's packaging reads the *name* too — for `x86_64-darwin`
     * it strips a `bun-darwin-x64-baseline` directory — so an archive is chosen
     * to match what that recipe already expects rather than for being the
     * newest build on offer.
     */
    readonly sources: { readonly [system: string]: NixArchive }
}

/** One downloadable archive, and the hash its content must have. */
export type NixArchive = {
    /** Where the release publishes it. */
    readonly url: string
    /** SRI hash of that archive, verified before anything unpacks it. */
    readonly hash: string
}

/** A development environment, one generated flake each. */
export type NixJob = {
    /** Generated directory name under `nix`, matching the CI job id. */
    readonly id: string
    /**
     * Nix systems the flake exposes a shell for, one named
     * `devShells.<system>.default` each — never a fold over a system list the
     * file does not contain.
     *
     * More than one, and the part that does not vary is written once as a
     * function those entries call; the systems themselves stay a list you can
     * read off the flake. One, and the shell is inline, because a function
     * called once is indirection for nothing.
     *
     * A CI job declares exactly one: it runs on one runner image, and a second
     * shell there would be one nothing enters. The developer environment is
     * the reason this is a list at all.
     */
    readonly systems: readonly [string, ...readonly string[]]
    /** Nixpkgs attribute names made available in the job's shell. */
    readonly packages: readonly string[]
    /** Job-local shell initialization, when the job needs one. */
    readonly shellHook?: readonly (string | _Reference)[]
    /** A `rust-overlay` toolchain, for a job whose targets Nixpkgs has no `std` for. */
    readonly rust?: NixRust
    /** An upstream release replacing a snapshot package the job's suite fails on. */
    readonly pin?: NixPin
}
