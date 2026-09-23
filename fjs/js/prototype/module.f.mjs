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
 * a symbol key is not a name a module can spell. They are not checked
 * against the running engine, since no engine is the reference: a newer
 * release owns names the standard did not, and Deno deletes
 * `Object.prototype.__proto__` outright.
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

/**
 * The names of {@link prototypeNames} a module may not *call* as a member
 * function either, `a.x(...)`: the mutators, the prototype and coercion
 * protocol, everything that reads the host's locale or Unicode version,
 * the regular-expression methods, the `this`-passing function methods,
 * the iterator factories, `forEach`, Annex B's legacy methods, and the
 * five data properties a read refuses, which are no functions. Each name's
 * reason is in [`README.md`](./README.md), one row per name.
 *
 * Every prototype name but `length` is refused as a property *read*, `a.x`
 * — a detached built-in is a function that only fails, and the language
 * has no prototype to find it on — so the read rule is
 * {@link prototypeNames} but `length`, and the call rule is this list: a
 * name here is refused as a call too, and a name in {@link allowedCalls} is
 * a member function the VM answers by the receiver's type. `length` is on
 * neither list: a value owns it, so it is read, and called, as whatever
 * the value holds there — a function on an object, a number and so a
 * `TypeError` on an array, a string or a function, as in JavaScript. The
 * two lists and `length` partition {@link prototypeNames}, which the proof
 * and `./types.ts` pin.
 */
export const prohibitedCalls = /** @type {const} */ ([
    '__defineGetter__', '__defineSetter__', '__lookupGetter__', '__lookupSetter__', '__proto__',
    'anchor', 'apply', 'arguments', 'big', 'bind', 'blink', 'bold', 'call', 'caller', 'constructor',
    'copyWithin', 'entries', 'fill', 'fixed', 'fontcolor', 'fontsize', 'forEach', 'hasOwnProperty',
    'isPrototypeOf', 'italics', 'keys', 'link', 'localeCompare', 'match', 'matchAll',
    'name', 'normalize', 'pop', 'propertyIsEnumerable', 'push', 'reverse', 'search', 'shift',
    'small', 'sort', 'splice', 'strike', 'sub', 'substr', 'sup', 'toLocaleLowerCase',
    'toLocaleString', 'toLocaleUpperCase', 'toLowerCase', 'toUpperCase', 'trimLeft', 'trimRight',
    'unshift', 'valueOf', 'values',
])

/**
 * The member functions a module may call, `a.x(...)`: every name of
 * {@link prototypeNames} not in {@link prohibitedCalls}, `length` aside,
 * which is no function — pure, specified
 * exactly, and the same on every engine. On a receiver whose type has no
 * such built-in the call throws the `TypeError` JavaScript throws, and an
 * own property of the name on an object shadows the built-in, as in
 * JavaScript; the reads stay refused, since a detached built-in is a
 * function that only fails.
 */
export const allowedCalls = /** @type {const} */ ([
    'at', 'charAt', 'charCodeAt', 'codePointAt', 'concat', 'endsWith', 'every', 'filter', 'find',
    'findIndex', 'findLast', 'findLastIndex', 'flat', 'flatMap', 'includes', 'indexOf',
    'isWellFormed', 'join', 'lastIndexOf', 'map', 'padEnd', 'padStart', 'reduce', 'reduceRight',
    'repeat', 'replace', 'replaceAll', 'slice', 'some', 'split', 'startsWith', 'substring',
    'toExponential', 'toFixed', 'toPrecision', 'toReversed', 'toSorted', 'toSpliced', 'toString',
    'toWellFormed', 'trim', 'trimEnd', 'trimStart', 'with',
])

/**
 * The member functions of {@link allowedCalls} that call an argument, and
 * the position of the one they call: the array methods that take a
 * callback or a comparator, and the two string methods that take a
 * replacer. A VM that answers these by the receiver's type calls the
 * argument itself; the JavaScript executors
 * ([`../../edag/operations`](../../edag/operations/module.f.mjs)) hand the
 * host a function that invokes the closure at exactly this position, so a
 * closure anywhere else — `reduce`'s initial value, `includes`'s needle —
 * stays the value it is. No allowed call has a second such position.
 */
export const callbacks = /** @type {const} */ ({
    every: 0, filter: 0, find: 0, findIndex: 0, findLast: 0, findLastIndex: 0, flatMap: 0, map: 0,
    reduce: 0, reduceRight: 0, replace: 1, replaceAll: 1, some: 0, toSorted: 0,
})
