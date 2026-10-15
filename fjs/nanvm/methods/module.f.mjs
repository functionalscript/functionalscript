/**
 * Which built-in member functions `nanvm-lib` answers, as a table its own
 * test checks the VM against — the completeness test
 * `nanvm/lib/todo/member-functions.md` asks for.
 *
 * The compiler admits a call of every name in `allowedCalls`
 * ([`fjs/js/prototype`](../../js/prototype/module.f.js)), and the VM must
 * answer each on every type whose prototype has it, or a module compiles and
 * then throws. It must equally answer none of `prohibitedCalls`, so that a
 * name the compiler refuses cannot be reached another way, and no known name
 * that is not a member function of the type: one its prototype lacks, so
 * that `[1].charAt(0)` throws as it does in JavaScript and `[].bind` has no
 * entry to reach, or `length`, a property on neither list, so that
 * `(1).length()` and `[].length()` throw. This module crosses every known
 * name with each type's prototype and sorts every pair into one of four
 * rows, which
 * [`generate`](#generate) prints as Rust:
 *
 * - **answered** — allowed, and the VM has an entry;
 * - **pending** — allowed, and the VM has no entry yet: {@link pending},
 *   the one list here written by hand;
 * - **prohibited** — refused, and the VM must never have an entry;
 * - **absent** — a known name that is no member function of this type, being
 *   off its prototype or `length`, and the VM must never have an entry
 *   either.
 *
 * The test beside `method` in `nanvm/lib/src/vm/lambda/method.rs` asserts
 * each row, so landing a built-in fails it until its pair leaves
 * {@link pending}, and {@link pending} can only shrink.
 *
 * @module
 *
 * @import { AllowedCall, PrototypeName } from '../../js/prototype/types.ts'
 * @import { Result } from '../../types/result/types.ts'
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
    prototypeNames,
    stringPrototype,
} from '../../js/prototype/module.f.js'
import { entry } from '../../types/object/entry/module.f.js'
import { statics } from '../../js/static/module.f.js'
import { stringLiteral } from '../../media/rust/module.f.mjs'
import { constSlice, generatedHeader } from '../../media/rust/item/module.f.mjs'
import { mapOk, okList, unwrap } from '../../types/result/module.f.js'

/**
 * Each type a receiver can have, by the name of its global as
 * `fjs/js/runtime` keys it, and the prototype a call on it looks in. An
 * object's is `Object.prototype`; every other type's is its own, which is
 * where its own member functions are, `toString` among them.
 *
 * @type {readonly (readonly[string, readonly PrototypeName[]])[]}
 */
export const types = [
    ['Object', objectPrototype],
    ['Array', arrayPrototype],
    ['String', stringPrototype],
    ['Number', numberPrototype],
    ['Boolean', booleanPrototype],
    ['BigInt', bigintPrototype],
    ['Function', functionPrototype],
]

/**
 * The allowed pairs the VM does not answer yet, by type. A pair leaves this
 * list in the pull request that lands its entry. It is empty: every call
 * `allowedCalls` admits on the seven types is answered. A type the language
 * gains — `Map`, `Set` — would start with its names here.
 *
 * @type {{ readonly [type in string]: readonly AllowedCall[] }}
 */
export const pending = {}

/**
 * The four rows for a pending list, each a list of `[type, name]` pairs in
 * {@link types}' order and then its prototype's, or, for `absent`,
 * `prototypeNames`' order.
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
    const isPending = (type, name) => (entry(p, type) ?? []).includes(name)
    /** @type {(name: string) => boolean} */
    const isCall = name => allowed.includes(name) || prohibited.includes(name)
    /** @type {(keep: (type: string, name: string) => boolean) => readonly (readonly[string, string])[]} */
    const pairs = keep => types.flatMap(([type, names]) => names
        .filter(name => keep(type, name))
        .map(name => /** @type {const} */ ([type, name])))
    const r = {
        answered: pairs((type, name) => allowed.includes(name) && !isPending(type, name)),
        pending: pairs((type, name) => allowed.includes(name) && isPending(type, name)),
        prohibited: pairs((_, name) => prohibited.includes(name)),
        absent: types.flatMap(([type, names]) => prototypeNames
            .filter(name => !(isCall(name) && (/** @type {readonly string[]} */ (names)).includes(name)))
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
 *
 * @type {string}
 */
export const path = 'nanvm/lib/src/vm/lambda/gen.methods.rs'

/**
 * A `(type, name)` pair as a Rust tuple of two string literals, or the
 * refusal of a string Rust cannot spell.
 *
 * @type {(pair: readonly[string, string]) => Result<string, unknown>}
 */
const pairRow = ([type, method]) =>
    mapOk((/** @type {readonly string[]} */ [t, m]) => `(${t}, ${m})`)(okList([stringLiteral(type), stringLiteral(method)]))

/**
 * A static path as a Rust slice of string literals, or the refusal of a key
 * Rust cannot spell.
 *
 * @type {(path: readonly string[]) => Result<string, unknown>}
 */
const pathRow = path => mapOk((/** @type {readonly string[]} */ keys) => `&[${keys.join(', ')}]`)(okList(path.map(stringLiteral)))

/**
 * One constant of `(type, name)` pairs, and the blank line after it. The
 * names are authored source, so one Rust cannot spell is a defect here and
 * throws.
 *
 * @type {(name: string, doc: string, pairs: readonly (readonly[string, string])[]) => readonly string[]}
 */
const table = (name, doc, pairs) => [unwrap(constSlice(doc, name, '(&str, &str)', pairs, pairRow)), '']

/**
 * The admitted static paths as Rust, each a slice of keys: what the VM must
 * bind, natively or through its runtime, for every static function the
 * parser admits.
 *
 * @type {() => readonly string[]}
 */
const staticTable = () => [
    unwrap(constSlice('Admitted static paths, `fjs/js/static`\'s: the VM binds each one.', 'STATICS', '&[&str]', statics, pathRow)),
    '',
]

/**
 * The table as Rust: four constants of `(type, name)` pairs, and the
 * admitted static paths.
 *
 * @type {() => string}
 */
export const generate = () => {
    const r = rows(pending)
    return [
        generatedHeader('`npm run gen` from `fjs/nanvm/methods/module.f.mjs`', 'change the pending list there and regenerate'),
        '',
        ...table('ANSWERED', 'Allowed, and answered: `method` has an entry.', r.answered),
        ...table('PENDING', 'Allowed, and not answered yet: `method` has no entry.', r.pending),
        ...table('PROHIBITED', 'Refused by the compiler: `method` never has an entry.', r.prohibited),
        ...table('ABSENT', 'A known name that is no member function of the type: `method` never has an entry.', r.absent),
        ...staticTable(),
    ].join('\n')
}
