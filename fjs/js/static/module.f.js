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
 * **An admitted static reads no `this`.** Destructuring is sugar,
 * `const { is } = Object` being `const is = Object.is`, so JavaScript runs
 * a module's static detached, `this` undefined, as readily as on its
 * namespace, and the two calls must answer alike. A built-in that builds
 * with `this` as its constructor — `Promise.resolve`, `Promise.all`,
 * `Uint8Array.from`, `Uint8Array.of` — throws a `TypeError` detached on
 * every engine, so it is not admissible here: the compiler would accept
 * the pattern, and the module would answer under the compiler and throw
 * under JavaScript. `Array.from` reads `this` too, but builds an array
 * where it is no constructor, and answers detached. The runtime's proof
 * calls every admitted built-in both ways.
 *
 * @module
 */

/**
 * Every admitted static path: `Object.is`, and the four `Number`
 * predicates, none of which converts its argument
 * ([`2360-built-in.md`](../../../spec/todo/2360-built-in.md#number-predicates-proposal-and-approval)).
 */
export const statics = /** @type {const} */ ([
    ['Object', 'is'],
    ['Number', 'isInteger'],
    ['Number', 'isSafeInteger'],
    ['Number', 'isNaN'],
    ['Number', 'isFinite'],
])

/**
 * Whether `path` is admitted: one of {@link statics}, key for key.
 *
 * @type {(path: readonly string[]) => boolean}
 */
export const isStatic = path => statics.some(p => p.length === path.length && p.every((key, i) => key === path.at(i)))
