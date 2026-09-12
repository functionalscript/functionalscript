/**
 * The JavaScript keywords — one source of truth.
 *
 * FunctionalScript is a strict subset of JavaScript: any FunctionalScript
 * program must run the same on JavaScript. Every consumer that decides
 * whether a name is a keyword — the JavaScript and DJS tokenizers, printers
 * that emit identifiers — derives its set from this module instead of
 * keeping a copy, so the sets cannot drift apart.
 *
 * @module
 */

/**
 * The ECMAScript `ReservedWord` production
 * ([ECMA-262 §12.7.2](https://tc39.es/ecma262/#prod-ReservedWord)) — never
 * usable as identifiers.
 */
export const reservedWords = /** @type {const} */ ([
    'await', 'break', 'case', 'catch', 'class', 'const', 'continue',
    'debugger', 'default', 'delete', 'do', 'else', 'enum', 'export',
    'extends', 'false', 'finally', 'for', 'function', 'if', 'import', 'in',
    'instanceof', 'new', 'null', 'return', 'super', 'switch', 'this',
    'throw', 'true', 'try', 'typeof', 'var', 'void', 'while', 'with',
    'yield',
])

/**
 * Reserved only in strict-mode code — and every module is strict-mode code,
 * so FunctionalScript treats them exactly like {@link reservedWords}.
 */
export const strictModeReservedWords = /** @type {const} */ ([
    'implements', 'interface', 'let', 'package', 'private', 'protected',
    'public', 'static',
])

/**
 * Not reserved words, but strict-mode code cannot bind, assign, or shadow
 * them.
 */
export const restrictedNames = /** @type {const} */ (['arguments', 'eval'])

/**
 * Ordinary globals in JavaScript that FunctionalScript keeps as literal
 * keywords: a module may not bind, assign or shadow them, so that each
 * name denotes its value wherever it appears — `undefined` the value, `NaN`
 * and `Infinity` the numbers JSON cannot spell, which DataJS has as leaves.
 */
export const literalGlobals = /** @type {const} */ (['Infinity', 'NaN', 'undefined'])

/**
 * Every name FunctionalScript treats as a keyword, sorted by code unit —
 * the capitalized globals first: the {@link reservedWords}, the
 * {@link strictModeReservedWords}, the {@link restrictedNames}, and the
 * {@link literalGlobals}.
 *
 * The proof verifies this list is exactly the sorted union of the groups,
 * at runtime and at the type level.
 */
export const keywords = /** @type {const} */ ([
    'Infinity', 'NaN',
    'arguments', 'await', 'break', 'case', 'catch', 'class', 'const',
    'continue', 'debugger', 'default', 'delete', 'do', 'else', 'enum',
    'eval', 'export', 'extends', 'false', 'finally', 'for', 'function',
    'if', 'implements', 'import', 'in', 'instanceof', 'interface', 'let',
    'new', 'null', 'package', 'private', 'protected', 'public', 'return',
    'static', 'super', 'switch', 'this', 'throw', 'true', 'try', 'typeof',
    'undefined', 'var', 'void', 'while', 'with', 'yield',
])

