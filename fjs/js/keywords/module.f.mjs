/**
 * The JavaScript keywords — one source of truth.
 *
 * FunctionalScript is a strict subset of JavaScript: any FunctionalScript
 * program must run the same on JavaScript. Every consumer that decides
 * whether a name is a keyword — the JavaScript and module tokenizers, the
 * parser, printers that emit identifiers — asks {@link isKeyword} or derives
 * its set from this module instead of keeping a copy, so the answers cannot
 * drift apart.
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
 * Global names FunctionalScript reserves without making them keywords: a
 * module may not bind one as a `const` or a parameter, and a reference to
 * one is refused as a reserved word, while it still names a property —
 * `{ Array: 1 }` and `a.Array` — as every reserved word does. A tokenizer
 * keeps each an `id` token: it is a name, not a token kind of its own,
 * which is why these are not among the {@link keywords} and the parser
 * asks {@link isReservedGlobal} beside {@link isKeyword}.
 *
 * `Array` is the first entry of the list
 * `spec/todo/2365-global-names.md` proposes, landed on its own: the right
 * operand of `instanceof` names it, and a module that could bind the word
 * would mean something else by it (`spec/README.md`, Operators).
 */
export const reservedGlobals = /** @type {const} */ (['Array'])

/** @type {ReadonlySet<string>} */
const reservedGlobalSet = new Set(reservedGlobals)

/** Whether a word is one of the {@link reservedGlobals}. @type {(word: string) => boolean} */
export const isReservedGlobal = word => reservedGlobalSet.has(word)

/**
 * The words that *denote* a value rather than name one: JavaScript's three
 * literals, which the {@link reservedWords} hold, and the three
 * {@link literalGlobals}.
 *
 * A tokenizer gives each of these a token kind of its own rather than `id`,
 * and every other keyword an `id` carrying the word, which is why a grammar
 * over that alphabet owes them a rule wherever a *name* may stand — a
 * property's or a binding's — as `identifierName` in `fjs/compiler/parser/grammar`
 * does. Where a **value** may stand they are the value, which is the line
 * this list draws and the reason it exists.
 */
export const literalWords = /** @type {const} */ ([
    'Infinity', 'NaN', 'false', 'null', 'true', 'undefined',
])

/** The four groups in declaration order, each name once. */
const groups = [...reservedWords, ...strictModeReservedWords, ...restrictedNames, ...literalGlobals]

/**
 * Every name FunctionalScript treats as a keyword, sorted by code unit —
 * the capitalized globals first: the {@link reservedWords}, the
 * {@link strictModeReservedWords}, the {@link restrictedNames}, and the
 * {@link literalGlobals}.
 *
 * Derived from the groups, so a new keyword is added to its group alone.
 *
 * @type {readonly (typeof groups)[number][]}
 */
export const keywords = groups.toSorted()

/** @type {ReadonlySet<string>} */
const keywordSet = new Set(keywords)

/**
 * Whether a word is one of the {@link keywords} — the one membership test
 * every tokenizer and parser asks, so none keeps a set of its own.
 *
 * @type {(word: string) => boolean}
 */
export const isKeyword = word => keywordSet.has(word)
