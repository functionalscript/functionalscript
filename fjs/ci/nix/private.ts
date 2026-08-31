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
 * The archive halves are read only under a `pin`, so for a job that pins
 * nothing whatever fills them never reaches the file.
 *
 * @internal
 */
export type _PerSystem = {
    readonly system: Expression
    readonly url: Expression
    readonly hash: Expression
}
