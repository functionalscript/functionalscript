/** @import { Exp } from '../../edag/types.ts' */

import { assert, assertEq, assertStructurallySame } from '../../asserts/module.f.js'
import { _moduleExports } from '../../compiler/edag/module.f.mjs'
import { allowedCalls } from '../prototype/module.f.js'
import { isNative, statics as staticPaths } from '../static/module.f.js'
import { isStatic as isStaticNode } from '../../edag/module.f.mjs'
import { member, runtime, statics } from './module.f.js'
import edag from './gen.edag.data.js'

const { entries, values } = Object

/** @type {readonly string[]} */
const allowed = allowedCalls

/** The member table by name, for a proof that walks it. @type {Readonly<Record<string, (self: unknown) => unknown>>} */
const members = member

/** The static table by id, for a proof that walks it, each entry called as a body is, on two arguments — `Object.entries`, the built-in itself, by `natives` alone. @type {Readonly<Record<string, (a: unknown, b: unknown) => unknown>>} */
const table = /** @type {Readonly<Record<string, (a: unknown, b: unknown) => unknown>>} */ (/** @type {unknown} */ (statics))

/** The host's own globals, each static path read from them by its keys. @type {Readonly<Record<string, Readonly<Record<string, (a: unknown, b: unknown) => unknown>>>>} */
const host = /** @type {Readonly<Record<string, Readonly<Record<string, (a: unknown, b: unknown) => unknown>>>>} */ (/** @type {unknown} */ ({ Object, Number, String }))

/**
 * The statics whose argument is an array of entries, which no pair of
 * {@link samples} is: `host` leaves them to a proof of their own.
 */
const entryShaped = ['Object.fromEntries']

const array = /** @type {readonly unknown[]} */ ([])
const object = {}
const f = () => 1

/** The chain steps a node holds, anywhere in it: a member call, a guarded step, an optional call. @type {(node: unknown) => readonly unknown[]} */
const steps = node => node instanceof Array
    ? [...(['|()', '|?.()', '|!()', '|.', '?.', '?.()'].includes(/** @type {string} */ (node[0])) ? [node[0]] : []), ...node.flatMap(steps)]
    : []

/** The static-function nodes a node holds, anywhere in it, a shared node as often as it is reached: the table, which the `static` function captures and the `statics` export is, twice. @type {(node: unknown) => readonly (readonly [string])[]} */
const staticNodes = node => node instanceof Array
    ? [...(isStaticNode(node) ? [node] : []), ...node.flatMap(staticNodes)]
    : []

/** Inspect an export after its required initialization prefix. @type {(node: unknown, key: string) => unknown} */
const at = (node, key) => _moduleExports(/** @type {Exp} */ (node)).find(([, name]) => name === key)?.[2]

/**
 * Every type, with the values the static functions part on: the zeros and
 * `NaN`, the infinities, fractions, the bounds of the safe integers and
 * the first integers past them, the largest double and the least, numeric
 * strings, the bigint zeros, and a container and a function beside a
 * second one of the same shape. A static body is called on every pair, so
 * a two-argument function meets every combination and a one-argument one
 * every value, its second argument ignored as the host ignores it.
 *
 * @type {readonly unknown[]}
 */
const samples = [
    NaN, 0, -0, 1, -1, 0.5, -0.5, 1.5, -1.5, Infinity, -Infinity,
    0x1f_ffff_ffff_ffff, -0x1f_ffff_ffff_ffff, 0x20_0000_0000_0000, -0x20_0000_0000_0000,
    1e100, 1.7976931348623157e308, -1.7976931348623157e308, 5e-324, -5e-324,
    0n, -0n, 1n, -1n,
    '', '0', '1', 'a', 'NaN', 'Infinity',
    true, false, null, undefined,
    array, [], [1], [NaN], object, {}, f, () => 1,
]

export const proof = {
    fromCharCode: () => {
        const { fromCharCode } = String
        assertEq(statics['String.fromCharCode'], fromCharCode)
        assertEq(fromCharCode.length, 1)
        assertEq(fromCharCode(5, 6), '\u0005\u0006')
        assertEq(fromCharCode(), '')
        assertEq(fromCharCode(0xd800, 0xffff, 0x1_0041, -1), '\ud800\uffffA\uffff')
    },
    // `static`, `dot` and `in` are the runtime's three functions; every key `member` holds
    // is a name `allowedCalls` admits — the same claim `./types.ts` makes at
    // the type level — and every entry is a body of the receiver alone,
    // answering `undefined` or a function.
    keys: () => {
        assertEq(Object.keys(runtime).toSorted().join(), 'dot,in,static')
        for (const [name, entry] of entries(members)) {
            assert(allowed.includes(name), name)
            assertEq(entry.length, 1)
            for (const self of samples) {
                const stage = entry(self)
                assert(stage === undefined || typeof stage === 'function', [name, self])
            }
        }
        assert(values(members).length > 0)
    },
    // Every key of the static table is an admitted id and every entry a
    // function — a body, or at a native path the built-in itself — and
    // `static` answers the entry by id, reading the table as the object
    // literal it is: an id the table lacks, an inherited name and a bare
    // namespace answer `undefined`, which an executor refuses by name.
    staticIds: () => {
        for (const [id, entry] of entries(statics)) {
            assert(isStaticNode([id]), id)
            assertEq(typeof entry, 'function')
            assertEq(runtime.static(id), entry, id)
        }
        for (const id of ['Object.keys', 'Math.max', 'toString', 'constructor', 'Object', 'is', '']) { assertEq(runtime.static(id), undefined, id) }
    },
    // Every admitted static but a native is bound, and each body answers as
    // the host's own built-in at the same path — its `length`, and its answer on every
    // pair of values — so a body is the built-in, value for value, and not
    // only on the cases written out for it. The built-in is called both
    // ways JavaScript calls it: as a method of its namespace, `Object.is(a,
    // b)`, and detached, `this` undefined, as `const { is } = Object;
    // is(a, b)` calls it — destructuring being sugar for the read, an
    // admitted static must answer alike either way
    // (`../static/module.f.js`), and a built-in that reads `this` throws
    // here on every engine the suite runs on.
    host: () => {
        for (const [global, name] of staticPaths.filter(path => !isNative(path) && !entryShaped.includes(path.join('.')))) {
            const body = table[`${global}.${name}`]
            const namespace = host[global]
            const detached = namespace[name]
            assertEq(body.length, detached.length, [global, name])
            for (const a of samples) {
                for (const b of samples) {
                    const expected = body(a, b)
                    assertEq(namespace[name](a, b), expected, [global, name, 'method', a, b])
                    assertEq(detached(a, b), expected, [global, name, 'detached', a, b])
                }
            }
        }
    },
    // A native static has no body here, every executor binding it itself:
    // the section holds the built-in itself at the path, so the table is
    // complete as a value, and the host's own built-in answers alike
    // detached and on its namespace, as `host` checks a body's:
    // Both natives read no `this`; compare their successful coercion inputs.
    natives: () => {
        for (const [global, name] of staticPaths.filter(isNative)) {
            assertEq(table[`${global}.${name}`], host[global][name], [global, name])
            const namespace = /** @type {Readonly<Record<string, (a: unknown) => unknown>>} */ (host[global])
            const detached = namespace[name]
            for (const a of samples.filter(a => a !== null && a !== undefined && (global !== 'String' || typeof a !== 'bigint'))) {
                assertStructurallySame(detached(a), namespace[name](a), [global, name, a])
            }
        }
    },
    // `Object.fromEntries` answers as the host's own on arrays of entries,
    // method and detached: the same keys in the same order, a key written
    // twice at its first position with its last value, each key converted,
    // a missing value `undefined`, `__proto__` an own key, and an entry that
    // is an object read by index. The order is compared through `entries`,
    // which lists it.
    fromEntries: () => {
        const body = /** @type {(a: unknown) => object} */ (statics['Object.fromEntries'])
        const fromEntries = /** @type {(a: unknown) => object} */ (Object.fromEntries)
        assertEq(body.length, fromEntries.length)
        /** @type {readonly unknown[]} */
        const cases = [
            [], [['a', 1]], [['b', 1], ['10', 2], ['2', 3], ['b', 4]],
            [[1, 'n'], [true, 'b'], [undefined, 'u'], [null, 'z'], [2n, 'g']],
            [['a']], [['__proto__', 1]], [{ 0: 'a', 1: 1 }], [array, object, f],
            entries({ x: 1, y: [2] }),
        ]
        for (const c of cases) {
            const expected = entries(body(c))
            assertStructurallySame(expected, entries(Object.fromEntries(/** @type {Iterable<readonly [PropertyKey, unknown]>} */ (c))), c)
            assertStructurallySame(expected, entries(fromEntries(c)), c)
        }
        assert(body([]) !== body([]))
    },
    // The two values `===` reads the other way, which `Object.is` exists
    // for, and none of the four predicates converting its argument, are the
    // cases `host` must not miss; they are in `samples`, and pinned here too.
    edges: () => {
        assertEq(statics['Object.is'](0, -0), false)
        assertEq(statics['Object.is'](NaN, NaN), true)
        assertEq(statics['Object.is'](array, []), false)
        assertEq(statics['Number.isInteger']('1'), false)
        assertEq(statics['Number.isSafeInteger'](0x20_0000_0000_0000), false)
        assertEq(statics['Number.isNaN']('NaN'), false)
        assertEq(statics['Number.isFinite']('1'), false)
    },
    // The member bodies, on the host. `String.prototype.startsWith`
    // is a string's alone, `undefined` on every other receiver, and its
    // algorithm case by case — the search converted, the position clamped
    // and truncated, an empty search found anywhere.
    startsWith: () => {
        const { startsWith } = member
        for (const self of samples.filter(v => typeof v !== 'string')) { assertEq(startsWith(self), undefined, self) }
        /** @type {(self: string) => (search: unknown, at: unknown) => boolean} */
        const on = self => /** @type {(search: unknown, at: unknown) => boolean} */ (startsWith(self))
        assertEq(on('abc')('ab', undefined), true)
        assertEq(on('abc')('bc', undefined), false)
        assertEq(on('abc')('bc', 1), true)
        assertEq(on('abc')('c', 2.9), true)
        assertEq(on('abc')('a', -1), true)
        assertEq(on('abc')('a', NaN), true)
        assertEq(on('abc')('', 9), true)
        assertEq(on('abc')('', Infinity), true)
        assertEq(on('abc')('c', Infinity), false)
        assertEq(on('ab')('abc', undefined), false)
        assertEq(on('12')(1, undefined), true)
        assertEq(on('undefinedx')(undefined, undefined), true)
        // the host's own, on every sample pair but a bigint position, which
        // throws on both, as `host` checks a static
        for (const a of samples) {
            for (const b of samples.filter(v => typeof v !== 'bigint')) {
                assertEq(on('abc')(a, b), 'abc'.startsWith(/** @type {string} */ (a), /** @type {number} */ (b)), [a, b])
            }
        }
    },
    // `String.prototype.codePointAt` is a string's alone, and its algorithm
    // case by case: a pair's code point where a lead surrogate is followed
    // by a trail, the code unit itself otherwise — a lone surrogate, a
    // trail, a lead at the end — and `undefined` outside the string, the
    // position truncated, `NaN` and `undefined` the first.
    codePointAt: () => {
        const { codePointAt } = member
        for (const self of samples.filter(v => typeof v !== 'string')) { assertEq(codePointAt(self), undefined, self) }
        /** @type {(self: string) => (at: unknown) => number | undefined} */
        const on = self => /** @type {(at: unknown) => number | undefined} */ (codePointAt(self))
        assertEq(on('abc')(1), 0x62)
        assertEq(on('abc')(1.9), 0x62)
        assertEq(on('abc')(undefined), 0x61)
        assertEq(on('abc')(NaN), 0x61)
        assertEq(on('abc')('2'), 0x63)
        assertEq(on('abc')(3), undefined)
        assertEq(on('abc')(-1), undefined)
        assertEq(on('abc')(-0.5), 0x61)
        assertEq(on('abc')(Infinity), undefined)
        assertEq(on('')(0), undefined)
        assertEq(on('\u{1F600}')(0), 0x1_f600)
        assertEq(on('\u{1F600}')(1), 0xde00)
        assertEq(on('\ud83da')(0), 0xd83d)
        assertEq(on('a\ud83d')(1), 0xd83d)
        assertEq(on('\ude00\ud83d')(0), 0xde00)
        assertEq(on('\udbff\udfff')(0), 0x10_ffff)
        assertEq(on('\ud800\udc00')(0), 0x1_0000)
        // the host's own, on every sample but a bigint position, which
        // throws on both
        for (const s of ['abc', '\u{1F600}', 'a\u{1F600}b', '\ud83d', '']) {
            for (const a of samples.filter(v => typeof v !== 'bigint')) {
                assertEq(on(s)(a), s.codePointAt(/** @type {number} */ (a)), [s, a])
            }
        }
    },
    // The dispatcher, on the host: an own enumerable property first,
    // whatever it holds — a field, an element, a character, an own
    // `undefined` — then the member body's answer for the receiver, then
    // `undefined`; a `length`, a function's properties and every inherited
    // name are no entry.
    dot: () => {
        const { dot } = runtime
        const f = () => 1
        assertEq(dot({ startsWith: f }, 'startsWith'), f)
        assertEq(dot({ x: 0 }, 'x'), 0)
        assertEq(dot({ x: undefined }, 'x'), undefined)
        // an own `undefined` under a member name wins too, as in JavaScript,
        // where the call throws; `hasEntry` is what finds it
        assertEq(dot({ startsWith: undefined }, 'startsWith'), undefined)
        assertEq(dot([f], '0'), f)
        assertEq(dot('abc', '1'), 'b')
        assertEq(dot([1], 'length'), undefined)
        assertEq(dot(f, 'length'), undefined)
        assertEq(dot({}, 'toString'), undefined)
        assertEq(dot({}, 'constructor'), undefined)
        assertEq(dot(members, 'constructor'), undefined)
        assertEq(typeof dot('abc', 'startsWith'), 'function')
        assertEq(typeof dot('abc', 'codePointAt'), 'function')
        assertEq(dot(1, 'codePointAt'), undefined)
        assertEq(/** @type {(search: unknown) => boolean} */ (dot('abc', 'startsWith'))('ab'), true)
        for (const self of samples.filter(v => typeof v !== 'string' && v !== null && v !== undefined)) { assertEq(dot(self, 'startsWith'), undefined, self) }
        assertEq(dot('abc', 'slice'), undefined)
        // the core rule of DESIGN.md §13, on the compiled EDAG: the body of
        // `dot` holds no chain step — no member call, no optional chain —
        // since an executor runs it to answer those; the two helpers and a
        // `()` of a function value are what it uses.
        const compiled = /** @type {readonly unknown[]} */ (at(at(edag, 'runtime'), 'dot'))
        const [tag, length, , body] = compiled
        assertEq(`${tag}/${length}`, '=>/2')
        assertEq(steps(body).join(), '')
        assertEq(JSON.stringify(body).includes('["()"'), true)
    },
    // The operator's body, on the host: `"k" in o` for a key no prototype
    // supplies is the host's own `in` — an enumerable own entry of an
    // object, an array or a function, an own `undefined` included, and
    // nothing else — on every such key and every sample that is no
    // primitive, `length` among them, which an array and a function own
    // without enumerating it and the body reads as the read does. Where a
    // prototype would answer, which the parser refuses as a key, the body
    // and the host part: `toString` of anything and `name` of a function
    // are no entry here and found there.
    in: () => {
        const has = runtime.in
        assertEq(has.length, 2)
        /** @type {readonly string[]} */
        const keys = ['x', '0', '1', '', 'in', 'if', 'hasOwnProperty_', '__proto', 'NaN', 'undefined', 'length']
        /** @type {readonly unknown[]} */
        const receivers = [
            ...samples.filter(v => v !== null && typeof v === 'object' || typeof v === 'function'),
            { x: 1 }, { x: undefined }, { '': 0, in: 0, if: 0, undefined: 0 }, { ['__proto__']: 1 }, [undefined], [, 1], { length: 0 },
        ]
        for (const self of receivers) {
            for (const key of keys) { assertEq(has(key, self), key in /** @type {object} */ (self), [key, self]) }
        }
        assertEq(has('x', { x: undefined }), true)
        assertEq(has('0', [undefined]), true)
        assertEq(has('0', [, 1]), false)
        assertEq(has('toString', {}), false)
        assertEq(has('length', []), true)
        assertEq(has('length', f), true)
        assertEq(has('length', {}), false)
        assertEq(has('name', f), false)
        assertEq(has('__proto__', {}), false)
        assertEq(has('__proto__', { ['__proto__']: 1 }), true)
        // the body is the compiled EDAG's, no chain step in it, as `dot`'s
        const compiled = /** @type {readonly unknown[]} */ (at(at(edag, 'runtime'), 'in'))
        const [tag, length, , body] = compiled
        assertEq(`${tag}/${length}`, '=>/2')
        assertEq(steps(body).join(), '')
    },
    // The core may not use what it defines, and the whole module is the
    // core: no body and no initializer holds a member call, an optional
    // chain or a static function the runtime defines — a native is reached
    // through an intrinsic, `slice` in `found` and `charCodeAt` in
    // `codePointAt`, called as a function, and the native static
    // `Object.entries` is the built-in itself at its own table entry, the
    // one static node anywhere, so no body reads it — so the module can be
    // evaluated with no runtime, and NaNVM can hold it as a value whose
    // bodies never name it (`../runtime/README.md`, "How NaNVM finds
    // it"). The intrinsic is there, as a node, where the member call was.
    // An absence is a finding only of a detector that sees: each is shown
    // a node it is for, first.
    core: () => {
        assertEq(steps([['|()', ['=>', 0, [], 1], []]]).join(), '|()')
        assertEq(staticNodes([['Object.is']]).join(), 'Object.is')
        assertEq(steps(edag).join(), '')
        const natives = staticPaths.filter(isNative)
        // the distinct static nodes: a body reading one writes a node of its own
        assertEq([...new Set(staticNodes(edag))].map(node => node[0]).join(), natives.map(path => path.join('.')).join())
        for (const path of natives) {
            assertEq(JSON.stringify(at(at(edag, 'statics'), path.join('.'))), JSON.stringify([path.join('.')]))
        }
        assertEq(JSON.stringify(edag).includes('["slice"]'), true)
        assertEq(JSON.stringify(edag).includes('["charCodeAt"]'), true)
    },
    throw: {
        // The detached call `host` makes is a real one: a built-in that
        // builds with `this` as its constructor, which no static may be,
        // throws called so.
        detachedThis: () => {
            const { from } = Uint8Array
            from([1])
        },
        // A bigint position is the `TypeError` `ToNumber` throws.
        bigintPosition: () => { member.startsWith('abc')?.('a', 0n) },
        bigintCodePointPosition: () => { member.codePointAt('abc')?.(0n) },
        // The search is converted through its own `toString`, whose throw
        // is the call's; which of two throws wins is pinned where the
        // executors run the body, in `nanvm/corpus` and `vm/runtime.rs`.
        searchConversion: () => { member.startsWith('abc')?.({ toString: () => { throw 'A' } }, 0) },
        // a nullish receiver is the executor's throw, before `dot` is asked
        nullishReceiver: () => { runtime.dot(null, 'x') },
        // `in` throws on `null`, `undefined` and every primitive, as the
        // host's `TypeError` does — a string's index too, which `hasEntry`
        // alone would answer `true`, and is why the body is not the helper.
        inNull: () => { runtime.in('x', null) },
        inUndefined: () => { runtime.in('x', undefined) },
        inString: () => { runtime.in('0', 'abc') },
        inNumber: () => { runtime.in('x', 1) },
        inBoolean: () => { runtime.in('x', true) },
        inBigint: () => { runtime.in('x', 1n) },
        // `Object.fromEntries` of an entry that is not an object throws, as
        // the host's `TypeError` does…
        fromEntriesEntry: () => { statics['Object.fromEntries']([['a', 1], 2]) },
        // …and so does a value that is not an array, even one the host
        // iterates: the language admits no other iterable as entries.
        fromEntriesNotArray: () => { statics['Object.fromEntries']('') },
    },
}
