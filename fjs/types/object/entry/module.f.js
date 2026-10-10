/**
 * The `entry` helper, the language's one read of a property named at run
 * time ([spec: entry](../../../../spec/README.md#reading-an-entry-at-run-time)):
 * the enumerable own property `b` names of `a` — an object's field, an
 * array's or a string's element, and nothing a value owns without
 * enumerating it, a `length` or anything of a function — the key converted
 * as a property key is, so that `entry(a, 0)` and `entry(a, "0")` read one
 * element. A `null` or `undefined` `a` throws, as reading a property of
 * one does, and so does a key whose conversion throws.
 *
 * Written once here and imported: the compiler reads this very text as the
 * EDAG's `['entry']`, the helper as a value, and a module that spells its
 * own gets a function of its own, which is what JavaScript gives it too.
 *
 * The key is `any` and not `PropertyKey`: every value is one once
 * converted, as the helper converts it, which TypeScript's narrower name
 * for what `Object.getOwnPropertyDescriptor` takes does not say.
 *
 * Known keys retain their indexed value type together with `undefined` for
 * absent, inherited, or non-enumerable properties. The fallback accepts
 * arbitrary receivers and keys and returns an unknown value.
 *
 * @module
 *
 * @import { EntryLookup } from './types.ts'
 */

/** @type {EntryLookup} */
export const entry = (/** @type {unknown} */ a, /** @type {any} */ b) => {
    const x = Object.getOwnPropertyDescriptor(a, b);
    return x?.enumerable ? x.value : undefined;
};
