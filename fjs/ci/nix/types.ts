/**
 * Types for generated CI Nix flakes.
 *
 * @module
 */

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
    /** Archive that release publishes, for the job's system. */
    readonly url: string
    /** SRI hash of that archive, verified before anything unpacks it. */
    readonly hash: string
}

/** A CI job's development environment, one generated flake each. */
export type NixJob = {
    /** Generated directory name under `nix`, matching the CI job id. */
    readonly id: string
    /** Nix system of the job's runner, e.g. `aarch64-linux`. */
    readonly system: string
    /** Nixpkgs attribute names made available in the job's shell. */
    readonly packages: readonly string[]
    /** Job-local shell initialization, when the job needs one. */
    readonly shellHook?: string
    /** A `rust-overlay` toolchain, for a job whose targets Nixpkgs has no `std` for. */
    readonly rust?: NixRust
    /** An upstream release replacing a snapshot package the job's suite fails on. */
    readonly pin?: NixPin
}
