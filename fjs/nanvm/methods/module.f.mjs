/**
 * Which built-in member functions `nanvm-lib` answers, as a table its own
 * test checks the VM against — the completeness test
 * `nanvm-lib/todo/member-functions.md` asks for.
 *
 * The compiler admits a call of every name in `allowedCalls`
 * ([`fjs/js/prototype`](../../js/prototype/module.f.mjs)), and the VM must
 * answer each on every type whose prototype has it, or a module compiles and
 * then throws. It must equally answer none of `prohibitedCalls`, so that a
 * name the compiler refuses cannot be reached another way, and no name of
 * either list on a type whose prototype lacks it, so that `[1].charAt(0)`
 * throws as it does in JavaScript and `[].bind` has no entry to reach. This module crosses the two lists with each type's
 * prototype and sorts every pair into one of four rows, which
 * [`generate`](#generate) prints as Rust:
 *
 * - **answered** — allowed, and the VM has an entry;
 * - **pending** — allowed, and the VM has no entry yet: {@link pending},
 *   the one list here written by hand;
 * - **prohibited** — refused, and the VM must never have an entry;
 * - **absent** — on either list, but not on this type's prototype, and the
 *   VM must never have an entry either.
 *
 * The test beside `method` in `nanvm-lib/src/vm/lambda/method.rs` asserts
 * each row, so landing a built-in fails it until its pair leaves
 * {@link pending}, and {@link pending} can only shrink.
 *
 * @module
 *
 * @import { AllowedCall, PrototypeName } from '../../js/prototype/types.ts'
 */

import {
    allowedCalls,
    arrayPrototype,
    bigintPrototype,
    booleanPrototype,
    functionPrototype,
    numberPrototype,
    objectPrototype,
    prohibitedCalls,
    stringPrototype,
} from '../../js/prototype/module.f.mjs'

/**
 * Each type a receiver can have, and the prototype a call on it looks in.
 * An object's is `Object.prototype`; every other type's is its own, which
 * is where its own member functions are, `toString` among them.
 *
 * @type {readonly (readonly[string, readonly PrototypeName[]])[]}
 */
export const types = [
    ['object', objectPrototype],
    ['array', arrayPrototype],
    ['string', stringPrototype],
    ['number', numberPrototype],
    ['boolean', booleanPrototype],
    ['bigint', bigintPrototype],
    ['function', functionPrototype],
]

/**
 * The allowed pairs the VM does not answer yet, by type. A pair leaves this
 * list in the pull request that lands its entry; the list is complete when
 * it is empty.
 *
 * @type {{ readonly [type in string]: readonly AllowedCall[] }}
 */
export const pending = {
    string: [
        'concat', 'padEnd', 'padStart', 'repeat', 'replace', 'replaceAll', 'slice', 'split',
        'substring', 'trim', 'trimEnd', 'trimStart',
    ],
    number: ['toExponential', 'toFixed', 'toPrecision'],
}

/**
 * The four rows for a pending list, each a list of `[type, name]` pairs in
 * {@link types}' order and then its prototype's, or, for `absent`,
 * `allowedCalls`' and then `prohibitedCalls`' order.
 *
 * A pending pair that is not an allowed call on a type is refused: no row
 * could hold it, so a typo would otherwise vanish rather than be reported.
 *
 * @type {(p: { readonly [type in string]: readonly string[] }) => {
 *     readonly answered: readonly (readonly[string, string])[],
 *     readonly pending: readonly (readonly[string, string])[],
 *     readonly prohibited: readonly (readonly[string, string])[],
 *     readonly absent: readonly (readonly[string, string])[],
 * }}
 */
export const rows = p => {
    /** @type {readonly string[]} */
    const allowed = allowedCalls
    /** @type {readonly string[]} */
    const prohibited = prohibitedCalls
    /** @type {(type: string, name: string) => boolean} */
    const isPending = (type, name) => (p[type] ?? []).includes(name)
    /** @type {(keep: (type: string, name: string) => boolean) => readonly (readonly[string, string])[]} */
    const pairs = keep => types.flatMap(([type, names]) => names
        .filter(name => keep(type, name))
        .map(name => /** @type {const} */ ([type, name])))
    const r = {
        answered: pairs((type, name) => allowed.includes(name) && !isPending(type, name)),
        pending: pairs((type, name) => allowed.includes(name) && isPending(type, name)),
        prohibited: pairs((_, name) => prohibited.includes(name)),
        absent: types.flatMap(([type, names]) => [...allowed, ...prohibited]
            .filter(name => !(/** @type {readonly string[]} */ (names)).includes(name))
            .map(name => /** @type {const} */ ([type, name]))),
    }
    const listed = Object.values(p).reduce((n, names) => n + names.length, 0)
    if (r.pending.length !== listed) { throw ['a pending name is no allowed call on its type', p] }
    return r
}

/**
 * Where {@link generate}'s output goes, relative to the repository root:
 * beside `method.rs`, whose test reads it, under a `gen.` name that
 * `vm/lambda/mod.rs` includes by `#[path]`.
 */
export const directory = 'nanvm-lib/src/vm/lambda'

/** @type {string} */
export const path = `${directory}/gen.methods.rs`

/** @type {(name: string, doc: string, pairs: readonly (readonly[string, string])[]) => readonly string[]} */
const table = (name, doc, pairs) => [
    `/// ${doc}`,
    '#[rustfmt::skip]',
    `pub const ${name}: &[(&str, &str)] = &[`,
    ...pairs.map(([type, method]) => `    ("${type}", "${method}"),`),
    '];',
    '',
]

/**
 * The table as Rust: four constants of `(type, name)` pairs.
 *
 * @type {() => string}
 */
export const generate = () => {
    const r = rows(pending)
    return [
        '// @generated by `npm run gen` from `fjs/nanvm/methods/module.f.mjs`.',
        '// Do not edit: change the pending list there and regenerate.',
        '',
        ...table('ANSWERED', 'Allowed, and answered: `method` has an entry.', r.answered),
        ...table('PENDING', 'Allowed, and not answered yet: `method` has no entry.', r.pending),
        ...table('PROHIBITED', 'Refused by the compiler: `method` never has an entry.', r.prohibited),
        ...table('ABSENT', 'A known name not on the type\'s prototype: `method` never has an entry.', r.absent),
    ].join('\n')
}
