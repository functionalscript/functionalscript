/**
 * The static functions a module may call — one source of truth, beside
 * [`../prototype`](../prototype/module.f.js), which holds the member
 * functions'.
 *
 * Each admitted static is a **path** into the `static` section of
 * [`../runtime`](../runtime/module.f.js): `['Object', 'is']` is
 * `Object.is`. A two-key path is a namespace's member; a path whose last
 * key is `''` is the global called as a function, `Object(a)`; a one-key
 * path is a global that is a function, `isNaN`. One representation names
 * every binding, so the parser, the runtime's `types.ts`, an executor and
 * a VM's completeness test all probe the same object the same way, by
 * walking the keys.
 *
 * A global's namespace is closed: a name is admitted here one at a time,
 * each its own decision in
 * [`spec/todo/2360-built-in.md`](../../../spec/todo/2360-built-in.md),
 * and every other member of a reserved global is refused. The design is
 * [`../todo/runtime-static.md`](../todo/runtime-static.md).
 *
 * @module
 */

/** Every admitted static path. */
export const statics = /** @type {const} */ ([['Object', 'is']])

/**
 * Whether `path` is admitted: one of {@link statics}, key for key.
 *
 * @type {(path: readonly string[]) => boolean}
 */
export const isStatic = path => statics.some(p => p.length === path.length && p.every((key, i) => key === path.at(i)))
