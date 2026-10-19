/**
 * The `entry` helper, the language's one read of a property named at run
 * time ([spec: entry](../../../../spec/property-access/entries.md)):
 * the value of the enumerable own property `b` names of `a` — an object's
 * field, an array's or a string's element, and nothing a value owns
 * without enumerating it, a `length` or anything of a function — and
 * `undefined` where there is none, the key converted as a property key is,
 * so that `entry(a, 0)` and `entry(a, "0")` read one element. A `null` or
 * `undefined` `a` throws, as reading a property of one does, and so does a
 * key whose conversion throws. An entry holding `undefined` reads as none
 * here; `hasEntry` beside it tells the two apart
 * ([spec: why two helpers](../../../../spec/property-access/entries.md#why-two-helpers)).
 *
 * Written once here and imported: the compiler reads this very text as the
 * EDAG's `['entry']`, the helper as a value, and a module that spells its
 * own gets a function of its own, which is what JavaScript gives it too.
 *
 * The key is `any` and not `PropertyKey`: every value is one once
 * converted, as the helper converts it, which TypeScript's narrower name
 * for what `Object.getOwnPropertyDescriptor` takes does not say.
 *
 * Known keys keep their indexed value type together with `undefined` for
 * absent, inherited, or non-enumerable properties. The fallback accepts
 * arbitrary receivers and keys and returns an unknown value.
 *
 * @module
 *
 * @import { EntryLookup, HasEntry } from './types.ts'
 */

/** @type {EntryLookup} */
export const entry = (/** @type {unknown} */ a, /** @type {any} */ b) => {
    const x = Object.getOwnPropertyDescriptor(a, b);
    return x?.enumerable ? x.value : undefined;
};

/**
 * The `hasEntry` helper, the presence beside the value: whether `a` has
 * an enumerable own property `b` names, `true` for one holding
 * `undefined`, which `entry` reads as none, the key converted as `entry`
 * converts it, a nullish `a` throwing as there. Recognized whole by the compiler as the EDAG's
 * `['hasEntry']`, as `entry` is ([spec: why two helpers](../../../../spec/property-access/entries.md#why-two-helpers)).
 *
 * @type {HasEntry}
 */
export const hasEntry = (/** @type {unknown} */ a, /** @type {any} */ b) => {
    const x = Object.getOwnPropertyDescriptor(a, b);
    return x?.enumerable === true;
};
