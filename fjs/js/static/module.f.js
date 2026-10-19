/**
 * The static functions a module may call — one source of truth, beside
 * [`../prototype`](../prototype/module.f.js), which holds the member
 * functions'.
 *
 * Each admitted static is a **path** of keys: `['Object', 'is']` is
 * `Object.is`. A two-key path is a namespace's member; a path whose last
 * key is `''` is the global called as a function, `Object(a)`; a one-key
 * path is a global that is a function, `isNaN`. The keys joined by `.`
 * are the id the EDAG spells the node with and the key of the
 * [`../runtime`](../runtime/module.f.js)'s `statics` table, which its
 * `static` function answers by: one representation names every binding,
 * so the parser, the runtime's `types.ts`, an executor and a VM's
 * completeness test all name the same static the same way.
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
 * Every admitted static path: `Object.is` and `Object.entries`, and the
 * four `Number` predicates, none of which converts its argument
 * ([`2360-built-in.md`](../../../spec/todo/2360-built-in.md#number-predicates-proposal-and-approval)).
 */
export const statics = /** @type {const} */ ([
    ['Object', 'is'],
    ['Object', 'entries'],
    ['Number', 'isInteger'],
    ['Number', 'isSafeInteger'],
    ['Number', 'isNaN'],
    ['Number', 'isFinite'],
])

/**
 * The admitted paths no body can define, each a primitive every executor
 * binds natively and the runtime lists as the built-in itself, not as a
 * body: `Object.entries`, since
 * enumerating keys is exactly what the language has no other way to do
 * ([`2360-built-in.md`](../../../spec/todo/2360-built-in.md#objectentries-proposal-and-approval)).
 * Every other path of {@link statics} has its body in the runtime.
 */
export const natives = /** @type {const} */ ([
    ['Object', 'entries'],
])

/** Whether `path` is `p`, key for key. @type {(path: readonly string[]) => (p: readonly string[]) => boolean} */
const same = path => p => p.length === path.length && p.every((key, i) => key === path.at(i))

/**
 * Whether `path` is admitted: one of {@link statics}, key for key.
 *
 * @type {(path: readonly string[]) => boolean}
 */
export const isStatic = path => statics.some(same(path))

/**
 * Whether `path` is bound natively: one of {@link natives}, key for key.
 *
 * @type {(path: readonly string[]) => boolean}
 */
export const isNative = path => natives.some(same(path))
