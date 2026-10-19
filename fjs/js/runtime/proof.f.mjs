import { assert, assertEq, assertStructurallySame } from '../../asserts/module.f.mjs'
import { allowedCalls } from '../prototype/module.f.js'
import { isNative, isStatic, statics as staticPaths } from '../static/module.f.js'
import { isStatic as isStaticNode, staticPath } from '../../edag/module.f.mjs'
import { runtime } from './module.f.js'
import edag from './gen.edag.data.mjs'

const { entries, values } = Object

/** @type {readonly string[]} */
const allowed = allowedCalls

/** The member section by name, for a proof that walks it. @type {Readonly<Record<string, (self: unknown) => unknown>>} */
const members = runtime.member

/** The static section by path, for a proof that walks it, each entry called as a body is, on two arguments — `Object.entries`, the built-in itself, by `natives` alone. @type {Readonly<Record<string, Readonly<Record<string, (a: unknown, b: unknown) => unknown>>>>} */
const section = /** @type {Readonly<Record<string, Readonly<Record<string, (a: unknown, b: unknown) => unknown>>>>} */ (/** @type {unknown} */ (runtime.static))

/** The host's own globals, each static path read from them as from the section. @type {typeof section} */
const host = /** @type {typeof section} */ (/** @type {unknown} */ ({ Object, Number }))

const array = /** @type {readonly unknown[]} */ ([])
const object = {}
const f = () => 1

/** The chain steps a node holds, anywhere in it: a member call, a guarded step, an optional call. @type {(node: unknown) => readonly unknown[]} */
const steps = node => node instanceof Array
    ? [...(['|()', '|?.()', '|!()', '|.', '?.', '?.()'].includes(/** @type {string} */ (node[0])) ? [node[0]] : []), ...node.flatMap(steps)]
    : []

/** The static-function nodes a node holds, anywhere in it, but the natives, which the runtime lists as themselves. @type {(node: unknown) => readonly unknown[]} */
const statics = node => node instanceof Array
    ? [...(isStaticNode(node) && !isNative(staticPath(node[0])) ? [node[0]] : []), ...node.flatMap(statics)]
    : []

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
    // `member` and `static` are the two sections and `dot` the dispatcher; every key `member` holds
    // is a name `allowedCalls` admits — the same claim `./types.ts` makes at
    // the type level — and every entry is a body of the receiver alone,
    // answering `undefined` or a function.
    keys: () => {
        assertEq(Object.keys(runtime).toSorted().join(), 'dot,member,static')
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
    // Every path the static section holds is admitted, and every entry is
    // a function: a body — a namespace's members, or the function a global
    // is — or, at a native path, the built-in itself.
    staticPaths: () => {
        /** @type {Readonly<Record<string, unknown>>} */
        const section = runtime.static
        for (const [global, value] of entries(section)) {
            if (typeof value === 'function') {
                assert(isStatic([global]), global)
                continue
            }
            for (const [name, entry] of entries(/** @type {Readonly<Record<string, unknown>>} */ (value))) {
                assert(isStatic([global, name]), `${global}.${name}`)
                assertEq(typeof entry, 'function')
            }
        }
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
        for (const [global, name] of staticPaths.filter(path => !isNative(path))) {
            const body = section[global][name]
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
    // `Object.entries` reads no `this`. On every sample but the two
    // nullish ones, on which both calls throw.
    natives: () => {
        /** @type {Readonly<Record<string, Readonly<Record<string, unknown>>>>} */
        const bodies = runtime.static
        for (const [global, name] of staticPaths.filter(isNative)) {
            assertEq(bodies[global]?.[name], host[global][name], [global, name])
            const namespace = /** @type {Readonly<Record<string, (a: unknown) => unknown>>} */ (host[global])
            const detached = namespace[name]
            for (const a of samples.filter(a => a !== null && a !== undefined)) {
                assertStructurallySame(detached(a), namespace[name](a), [global, name, a])
            }
        }
    },
    // The two values `===` reads the other way, which `Object.is` exists
    // for, and none of the four predicates converting its argument, are the
    // cases `host` must not miss; they are in `samples`, and pinned here too.
    edges: () => {
        const { Object: o, Number: n } = runtime.static
        assertEq(o.is(0, -0), false)
        assertEq(o.is(NaN, NaN), true)
        assertEq(o.is(array, []), false)
        assertEq(n.isInteger('1'), false)
        assertEq(n.isSafeInteger(0x20_0000_0000_0000), false)
        assertEq(n.isNaN('NaN'), false)
        assertEq(n.isFinite('1'), false)
    },
    // The one member body so far, on the host: `String.prototype.startsWith`
    // is a string's alone, `undefined` on every other receiver, and its
    // algorithm case by case — the search converted, the position clamped
    // and truncated, an empty search found anywhere.
    startsWith: () => {
        const { startsWith } = runtime.member
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
        assertEq(/** @type {(search: unknown) => boolean} */ (dot('abc', 'startsWith'))('ab'), true)
        for (const self of samples.filter(v => typeof v !== 'string' && v !== null && v !== undefined)) { assertEq(dot(self, 'startsWith'), undefined, self) }
        assertEq(dot('abc', 'slice'), undefined)
        // the core rule of DESIGN.md §13, on the compiled EDAG: the body of
        // `dot` holds no chain step — no member call, no optional chain —
        // since an executor runs it to answer those; the two helpers and a
        // `()` of a function value are what it uses.
        const sections = /** @type {readonly (readonly [string, string, readonly unknown[]])[]} */ (/** @type {readonly any[]} */ (edag)[1][0][2][1])
        const compiled = sections.find(([, name]) => name === 'dot')
        assert(compiled !== undefined)
        const [tag, length, , body] = compiled[2]
        assertEq(`${tag}/${length}`, '=>/2')
        assertEq(steps(body).join(), '')
        assertEq(JSON.stringify(body).includes('["()"'), true)
    },
    // The core may not use what it defines, and the whole module is the
    // core: no body and no initializer holds a member call, an optional
    // chain or a static function the runtime defines — a native is reached
    // through an intrinsic, `slice` in `found`, called as a function, and
    // the native static `Object.entries` is listed as itself — so the module
    // can be evaluated with no runtime, and NaNVM can hold it as a value
    // whose bodies never name it (`../todo/runtime-value.md`). The
    // intrinsic is there, as a node, where the member call was.
    core: () => {
        assertEq(steps(edag).join(), '')
        assertEq(statics(edag).join(), '')
        assertEq(JSON.stringify(edag).includes('["slice"]'), true)
        assertEq(JSON.stringify(edag).includes('["Object.entries"]'), true)
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
        bigintPosition: () => { runtime.member.startsWith('abc')?.('a', 0n) },
        // The search is converted through its own `toString`, whose throw
        // is the call's; which of two throws wins is pinned where the
        // executors run the body, in `nanvm/corpus` and `vm/runtime.rs`.
        searchConversion: () => { runtime.member.startsWith('abc')?.({ toString: () => { throw 'A' } }, 0) },
        // a nullish receiver is the executor's throw, before `dot` is asked
        nullishReceiver: () => { runtime.dot(null, 'x') },
    },
}
