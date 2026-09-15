/**
 * The own property names of the built-in prototypes a value can have —
 * one source of truth, as `fjs/js/keywords` is for the keywords.
 *
 * A FunctionalScript value is a primitive, an array, an object or a
 * function, and JavaScript finds a property of it that the value does not
 * own on one of seven prototypes. Every consumer that decides whether a
 * name is such a property — the compiler, which refuses to read one —
 * derives its set from this module instead of asking the engine it runs
 * on, whose prototypes grow with each release: the decision has to be the
 * same on every engine, so that a module means one thing everywhere.
 *
 * The lists are ECMAScript 2025's, Annex B included, string keys only —
 * a symbol key is not a name a module can spell. `./proof.f.mjs` checks
 * each against the running engine, which may hold more and must hold
 * these.
 *
 * @module
 */

/**
 * [`Object.prototype`](https://tc39.es/ecma262/#sec-properties-of-the-object-prototype-object),
 * which every object and every boxed primitive reaches.
 */
export const objectPrototype = /** @type {const} */ ([
    '__defineGetter__', '__defineSetter__', '__lookupGetter__', '__lookupSetter__', '__proto__',
    'constructor', 'hasOwnProperty', 'isPrototypeOf', 'propertyIsEnumerable', 'toLocaleString',
    'toString', 'valueOf',
])

/** [`Array.prototype`](https://tc39.es/ecma262/#sec-properties-of-the-array-prototype-object). */
export const arrayPrototype = /** @type {const} */ ([
    'at', 'concat', 'constructor', 'copyWithin', 'entries', 'every', 'fill', 'filter', 'find',
    'findIndex', 'findLast', 'findLastIndex', 'flat', 'flatMap', 'forEach', 'includes', 'indexOf',
    'join', 'keys', 'lastIndexOf', 'length', 'map', 'pop', 'push', 'reduce', 'reduceRight',
    'reverse', 'shift', 'slice', 'some', 'sort', 'splice', 'toLocaleString', 'toReversed',
    'toSorted', 'toSpliced', 'toString', 'unshift', 'values', 'with',
])

/** [`String.prototype`](https://tc39.es/ecma262/#sec-properties-of-the-string-prototype-object), the Annex B HTML methods included. */
export const stringPrototype = /** @type {const} */ ([
    'anchor', 'at', 'big', 'blink', 'bold', 'charAt', 'charCodeAt', 'codePointAt', 'concat',
    'constructor', 'endsWith', 'fixed', 'fontcolor', 'fontsize', 'includes', 'indexOf',
    'isWellFormed', 'italics', 'lastIndexOf', 'length', 'link', 'localeCompare', 'match',
    'matchAll', 'normalize', 'padEnd', 'padStart', 'repeat', 'replace', 'replaceAll', 'search',
    'slice', 'small', 'split', 'startsWith', 'strike', 'sub', 'substr', 'substring', 'sup',
    'toLocaleLowerCase', 'toLocaleUpperCase', 'toLowerCase', 'toString', 'toUpperCase',
    'toWellFormed', 'trim', 'trimEnd', 'trimLeft', 'trimRight', 'trimStart', 'valueOf',
])

/** [`Number.prototype`](https://tc39.es/ecma262/#sec-properties-of-the-number-prototype-object). */
export const numberPrototype = /** @type {const} */ ([
    'constructor', 'toExponential', 'toFixed', 'toLocaleString', 'toPrecision', 'toString', 'valueOf',
])

/** [`Boolean.prototype`](https://tc39.es/ecma262/#sec-properties-of-the-boolean-prototype-object). */
export const booleanPrototype = /** @type {const} */ (['constructor', 'toString', 'valueOf'])

/** [`BigInt.prototype`](https://tc39.es/ecma262/#sec-properties-of-the-bigint-prototype-object). */
export const bigintPrototype = /** @type {const} */ (['constructor', 'toLocaleString', 'toString', 'valueOf'])

/** [`Function.prototype`](https://tc39.es/ecma262/#sec-properties-of-the-function-prototype-object), the Annex B `arguments` and `caller` included. */
export const functionPrototype = /** @type {const} */ ([
    'apply', 'arguments', 'bind', 'call', 'caller', 'constructor', 'length', 'name', 'toString',
])

/**
 * Every name a built-in prototype gives a value, sorted by code unit — the
 * union of the seven lists above, each name once. The proof verifies this
 * list is exactly that union, at runtime and at the type level.
 */
export const prototypeNames = /** @type {const} */ ([
    '__defineGetter__', '__defineSetter__', '__lookupGetter__', '__lookupSetter__', '__proto__',
    'anchor', 'apply', 'arguments', 'at', 'big', 'bind', 'blink', 'bold', 'call', 'caller',
    'charAt', 'charCodeAt', 'codePointAt', 'concat', 'constructor', 'copyWithin', 'endsWith',
    'entries', 'every', 'fill', 'filter', 'find', 'findIndex', 'findLast', 'findLastIndex',
    'fixed', 'flat', 'flatMap', 'fontcolor', 'fontsize', 'forEach', 'hasOwnProperty', 'includes',
    'indexOf', 'isPrototypeOf', 'isWellFormed', 'italics', 'join', 'keys', 'lastIndexOf',
    'length', 'link', 'localeCompare', 'map', 'match', 'matchAll', 'name', 'normalize',
    'padEnd', 'padStart', 'pop', 'propertyIsEnumerable', 'push', 'reduce', 'reduceRight',
    'repeat', 'replace', 'replaceAll', 'reverse', 'search', 'shift', 'slice', 'small', 'some',
    'sort', 'splice', 'split', 'startsWith', 'strike', 'sub', 'substr', 'substring', 'sup',
    'toExponential', 'toFixed', 'toLocaleLowerCase', 'toLocaleString', 'toLocaleUpperCase',
    'toLowerCase', 'toPrecision', 'toReversed', 'toSorted', 'toSpliced', 'toString',
    'toUpperCase', 'toWellFormed', 'trim', 'trimEnd', 'trimLeft', 'trimRight', 'trimStart',
    'unshift', 'valueOf', 'values', 'with',
])
