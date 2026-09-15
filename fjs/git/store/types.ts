/**
 * Types for reading a repository's objects, over the effects.
 *
 * @module
 */

/**
 * Why an `objects/info/alternates` cannot be read: its bytes are not UTF-8, or a
 * line has text after its closing quote and so names a path only an off-by-one
 * in Git's own reader would build.
 *
 * An object rather than a tagged array, so it is told from a list of paths by
 * shape: a path may be any string, so no array of strings could stand for one of
 * these without a path being able to impersonate it.
 *
 * Here rather than in `private.ts` because `alternatesIn` is exported and
 * answers one, which puts it in the public declaration closure — and
 * `package.json` ships no `private.d.ts`, so a declaration reaching it would not
 * resolve for an importer.
 */
export type _Refusal = {
    readonly why: 'encoding' | 'line'
    readonly line: string
}
