/**
 * The `entry` helper, the language's one read of a property named at run
 * time ([spec: entry](../../../../spec/property-access/entries.md)):
 * the enumerable own property `b` names of `a` — an object's field, an
 * array's or a string's element, and nothing a value owns without
 * enumerating it, a `length` or anything of a function — as an option, a
 * one-element array holding the value, or an empty array where there is
 * none. `[undefined]` is an entry holding `undefined`; `[]` is no entry.
 * The key is converted as a property key is, so that `entry(a, 0)` and
 * `entry(a, "0")` read one element. A `null` or `undefined` `a` throws, as
 * reading a property of one does, and so does a key whose conversion
 * throws.
 *
 * The option is an array, so it composes with arrays: `entry(a, b)[0]` is
 * the value or `undefined`, `entry(a, b).length === 1` is presence,
 * `const [v] = entry(a, b)` destructures it, and
 * `keys.flatMap(k => entry(a, k))` collects the values present.
 *
 * Written once here and imported: the compiler reads this very text as the
 * EDAG's `['entry']`, the helper as a value, and a module that spells its
 * own gets a function of its own, which is what JavaScript gives it too.
 *
 * The key is `any` and not `PropertyKey`: every value is one once
 * converted, as the helper converts it, which TypeScript's narrower name
 * for what `Object.getOwnPropertyDescriptor` takes does not say.
 *
 * Known keys retain their indexed value type inside the option; the
 * fallback accepts arbitrary receivers and keys and returns an option of
 * an unknown value.
 *
 * @module
 *
 * @import { EntryLookup, HasEntry } from './types.ts'
 */

/** @type {EntryLookup} */
export const entry = (/** @type {unknown} */ a, /** @type {any} */ b) => {
    const x = Object.getOwnPropertyDescriptor(a, b);
    return x?.enumerable ? [x.value] : [];
};

/**
 * The `hasEntry` helper, the presence the option tells: whether `a` has
 * an enumerable own property `b` names, `true` for one holding
 * `undefined`, the key converted as `entry` converts it, a nullish `a`
 * throwing as there. Recognized whole by the compiler as the EDAG's
 * `['hasEntry']`, as `entry` is ([spec: has-entry](../../../spec/todo/2345-has-entry.md)).
 *
 * @type {HasEntry}
 */
export const hasEntry = (/** @type {unknown} */ a, /** @type {any} */ b) => {
    const x = Object.getOwnPropertyDescriptor(a, b);
    return x?.enumerable === true;
};
