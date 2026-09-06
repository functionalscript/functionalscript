/**
 * Implementation-private types for generated CI Nix flakes.
 *
 * Nothing here is part of what a caller of [`./module.f.mjs`](./module.f.mjs)
 * sees: the shell builder these describe is module-private, so they are outside
 * the public declaration closure `types.ts` holds. They are named at all
 * because [`../../AGENTS.md`](../../AGENTS.md) §3 keeps file-scope `@typedef`
 * out of authored `.mjs`.
 *
 * @module
 */

import type { Expression } from '../../media/nix/types.ts'

/**
 * The parts of a shell that differ between one system and the next.
 *
 * Two ways to fill them, and that is the whole of the choice `module.f.mjs`
 * makes about repetition. A flake with one shell passes the values themselves,
 * and reads with nothing to look up. A flake with several passes references to
 * a function's arguments, and the shell is written once.
 *
 * The package set is not here: it is bound to `pkgs` at each
 * `devShells.<system>.default`, so a hook written for one system can name a
 * package from it. That is what makes a per-system difference expressible at
 * all — a hook interpolating `pkgs` cannot be built where `pkgs` does not yet
 * exist.
 *
 * `targets` is read only under a `rust` and the archive halves only under a
 * `pin`, so for a job declaring neither, whatever fills them never reaches the
 * file. `hook` is the one that is genuinely absent rather than unread: a shell
 * with no initialization has no `shellHook` binding.
 *
 * @internal
 */
export type _ShellValues = {
    readonly targets: Expression
    readonly url: Expression
    readonly hash: Expression
    readonly hook: Expression | undefined
}
