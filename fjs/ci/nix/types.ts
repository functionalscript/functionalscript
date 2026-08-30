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
}
