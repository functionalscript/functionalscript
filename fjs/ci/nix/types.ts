/**
 * Types for generated CI Nix flakes.
 *
 * @module
 */

/** A CI job's development environment, one generated flake each. */
export type NixJob = {
    /** Generated directory name under `nix/generated`, matching the CI job id. */
    readonly id: string
    /** Nix system of the job's runner, e.g. `aarch64-linux`. */
    readonly system: string
    /** Nixpkgs attribute names made available in the job's shell. */
    readonly packages: readonly string[]
    /** Job-local shell initialization, when the job needs one. */
    readonly shellHook?: string
}
