/**
 * A seeded random comparison of the lowering: it writes FunctionalScript in
 * the part of the language the slices lower, takes each program through
 * FAST, the lowering, the checker and the emitter, and runs the WASM on the
 * host's engine against the same body as JavaScript. Programs the slices
 * refuse are counted and not run. The [proof](./proof.mjs) drives it.
 *
 * @module
 *
 * @import { StringMap } from '../../../types/object/types.ts'
 * @import { Signature, Type } from '../../types.ts'
 * @import { _Twin, _Value } from '../../wasm/types.ts'
 * @import { _Outcome, _Rnd } from './private.ts'
 */

import { assert } from '../../../asserts/module.f.js'
import {
    ARRAY, BIGINT, BOOLEAN, FUNCTION, NULL, NUMBER, OBJECT, STRING, UNDEFINED,
    asBoolean, asNumber, kind, length, unit,
} from '../../../wasm/runtime/l0/module.f.js'
import { numberRemainder } from '../../../wasm/runtime/l1/native/module.f.js'
import { check } from '../../check/module.f.js'
import { any } from '../../l0/module.f.js'
import { bool, f64, i, signature, u } from '../../module.f.js'
import { edges, held, run } from '../../wasm/testlib.mjs'
import { lower } from '../module.f.js'
import { runtime, sourceOf } from '../testlib.f.mjs'

/**
 * A Mulberry32 generator from `seed`. Each call answers a float in `[0, 1)`.
 *
 * @type {(seed: number) => _Rnd}
 */
export const rng = seed => {
    let a = seed >>> 0
    return () => {
        a = a + 0x6d2b_79f5 | 0
        let t = Math.imul(a ^ a >>> 15, 1 | a)
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t
        return ((t ^ t >>> 14) >>> 0) / 0x1_0000_0000
    }
}

/** @type {<_T>(rnd: _Rnd, xs: readonly _T[]) => _T} */
const pick = (rnd, xs) => {
    assert(xs.length > 0)
    return xs[Math.floor(rnd() * xs.length)]
}

/** @type {(rnd: _Rnd, n: number) => number} */
const below = (rnd, n) => Math.floor(rnd() * n)

/** The import line that marks the L0 view for the lowering. `%` needs no import: the runtime adds Native. */
const l0Import = "import { ARRAY, BIGINT, BOOLEAN, FUNCTION, NULL, NUMBER, OBJECT, STRING, UNDEFINED, asBoolean, asNumber, asString, kind, length, unit } from '../l0/module.f.js'\n"

/** @type {readonly (readonly [string, Type])[]} */
const floatParams = [['a', f64], ['b', f64]]

/** @type {readonly (readonly [string, Type])[]} */
const boolParams = [['a', bool], ['b', bool]]

/** @type {readonly (readonly [string, Type])[]} */
const intParams = [['a', u(16)], ['b', u(16)]]

/** @type {readonly (readonly [string, Type])[]} */
const signedParams = [['a', i(16)], ['b', i(16)]]

/**
 * A small float expression of the named parameters, depth-bounded.
 *
 * @type {(rnd: _Rnd, names: readonly string[], depth: number) => string}
 */
const floatExpr = (rnd, names, depth) => {
    if (depth <= 0 || rnd() < 0.35) {
        return rnd() < 0.25 ? pick(rnd, ['0', '1', '2', '-1', '0.5', '-0']) : pick(rnd, names)
    }
    const a = floatExpr(rnd, names, depth - 1)
    const b = floatExpr(rnd, names, depth - 1)
    // One pick covers binary ops, comparisons wrapped as floats, and the
    // unary / Math / block forms; each arm is reachable.
    const op = pick(rnd, [
        '+', '-', '*', '/', '%',
        '<', '<=', '>', '>=', '===', '!==',
        'neg', 'abs', 'sqrt', 'cond', 'sq',
    ])
    if (op === '%' || op === '/' || op === '+' || op === '-' || op === '*') {
        return `(${a} ${op} ${b})`
    }
    if (op === '<' || op === '<=' || op === '>' || op === '>=' || op === '===' || op === '!==') {
        // a comparison is a bool; wrap as a float choice for a float result
        return `((${a} ${op} ${b}) ? ${a} : ${b})`
    }
    if (op === 'neg') { return `(-(${a}))` }
    if (op === 'abs') { return `Math.abs(${a})` }
    if (op === 'sqrt') { return `Math.sqrt(Math.abs(${a}))` }
    if (op === 'cond') { return `(${a} < ${b} ? ${a} : ${b})` }
    return `(() => { const s = ${a} + ${b}; return s * s })()`
}

/**
 * A bool expression of the named parameters.
 *
 * @type {(rnd: _Rnd, names: readonly string[], depth: number) => string}
 */
const boolExpr = (rnd, names, depth) => {
    if (depth <= 0 || rnd() < 0.4) {
        return rnd() < 0.2 ? pick(rnd, ['true', 'false']) : pick(rnd, names)
    }
    const a = boolExpr(rnd, names, depth - 1)
    const b = boolExpr(rnd, names, depth - 1)
    return pick(rnd, [
        `(!${a})`,
        `(${a} ? ${b} : ${a})`,
        `(${a} ? !${b} : ${b})`,
        `(${a} === ${b})`,
        `(${a} !== ${b})`,
    ])
}

/**
 * A bigint expression of the named parameters.
 *
 * @type {(rnd: _Rnd, names: readonly string[], depth: number) => string}
 */
const intExpr = (rnd, names, depth) => {
    if (depth <= 0 || rnd() < 0.4) {
        return rnd() < 0.2 ? pick(rnd, ['0n', '1n', '2n']) : pick(rnd, names)
    }
    const a = intExpr(rnd, names, depth - 1)
    const b = intExpr(rnd, names, depth - 1)
    return pick(rnd, [
        `(${a} + ${b})`,
        `(${a} - ${b})`,
        `(${a} * ${b})`,
        `(-${a})`,
        `(${a} < ${b} ? ${a} : ${b})`,
        `(${a} === ${b} ? ${a} : ${b})`,
    ])
}

/**
 * Sample inputs for a typed signature: a few edges of each parameter, not
 * the full product, so a run of hundreds of programs stays short.
 *
 * @type {(params: readonly (readonly [string, Type])[], rnd: _Rnd) => readonly (readonly _Value[])[]}
 */
const typedInputs = (params, rnd) => {
    const lists = params.map(([, t]) => {
        const all = edges(t)
        if (all.length <= 4) { return all }
        const chosen = [all[0], all[all.length - 1], all[Math.floor(all.length / 2)]]
        while (chosen.length < 4) {
            chosen.push(pick(rnd, all))
        }
        return [...new Set(chosen)]
    })
    /** @type {readonly (readonly _Value[])[]} */
    let rows = [[]]
    for (const list of lists) {
        rows = rows.flatMap(xs => list.map(v => /** @type {const} */ ([...xs, v])))
    }
    if (rows.length <= 24) { return rows }
    return Array.from({ length: 24 }, () => pick(rnd, rows))
}

/**
 * One typed program: floats, booleans, small integer ranges, an unexported
 * helper, a short loop, `%`, or a record kept inside the function.
 *
 * @type {(rnd: _Rnd) => {
 *   readonly text: string,
 *   readonly signatures: Readonly<Record<string, Signature>>,
 *   readonly inputs: StringMap<readonly (readonly _Value[])[]>,
 *   readonly twin: _Twin,
 *   readonly runtime: typeof runtime | null,
 * }}
 */
export const typedProgram = rnd => {
    const kind = below(rnd, 7)
    if (kind === 0) {
        const params = floatParams
        const names = params.map(([n]) => n)
        const body = floatExpr(rnd, names, 2 + below(rnd, 2))
        const needsNative = body.includes('%')
        const text = `export const f = (${names.join(', ')}) => ${body}\n`
        const twin = /** @type {_Twin} */ (xs => {
            const fn = new Function(...names, `return (${body})`)
            return fn(...xs.map(v => typeof v === 'object' ? held(v) : v))
        })
        return {
            text,
            signatures: { f: signature(params, f64) },
            inputs: { f: typedInputs(params, rnd) },
            twin,
            runtime: needsNative ? runtime : null,
        }
    }
    if (kind === 1) {
        const params = boolParams
        const names = params.map(([n]) => n)
        const body = boolExpr(rnd, names, 2)
        const text = `export const f = (${names.join(', ')}) => ${body}\n`
        const twin = /** @type {_Twin} */ (xs => {
            const fn = new Function(...names, `return (${body})`)
            return fn(...xs)
        })
        return {
            text,
            signatures: { f: signature(params, bool) },
            inputs: { f: typedInputs(params, rnd) },
            twin,
            runtime: null,
        }
    }
    if (kind === 2) {
        const params = rnd() < 0.5 ? intParams : signedParams
        const names = params.map(([n]) => n)
        const body = intExpr(rnd, names, 2)
        const text = `export const f = (${names.join(', ')}) => ${body}\n`
        const twin = /** @type {_Twin} */ (xs => {
            const fn = new Function(...names, `return (${body})`)
            return fn(...xs)
        })
        return {
            text,
            signatures: { f: signature(params, params[0][1]) },
            inputs: { f: typedInputs(params, rnd) },
            twin,
            runtime: null,
        }
    }
    if (kind === 3) {
        // unexported helper, arguments that each do something
        const text = [
            'const twice = x => x + x',
            'const square = x => x * x',
            'export const f = (a, b) => twice(a + 1) + square(b + 1)',
            '',
        ].join('\n')
        const twin = /** @type {_Twin} */ (xs => {
            const a = /** @type {number} */ (xs[0])
            const b = /** @type {number} */ (xs[1])
            const twice = (/** @type {number} */ x) => x + x
            const square = (/** @type {number} */ x) => x * x
            return twice(a + 1) + square(b + 1)
        })
        return {
            text,
            signatures: { f: signature(floatParams, f64) },
            inputs: { f: typedInputs(floatParams, rnd) },
            twin,
            runtime: null,
        }
    }
    if (kind === 4) {
        // short loop; keep the bound small so a run finishes
        const text = [
            'export const f = a => {',
            '    const limit = a < 0 ? 0 : a > 8 ? 8 : a',
            '    let i = 0',
            '    while (i < limit) { i = i + 1 }',
            '    return i',
            '}',
            '',
        ].join('\n')
        const twin = /** @type {_Twin} */ (xs => {
            const a = /** @type {number} */ (xs[0])
            const limit = a < 0 ? 0 : a > 8 ? 8 : a
            let i = 0
            while (i < limit) { i = i + 1 }
            return i
        })
        return {
            text,
            signatures: { f: signature([['a', f64]], f64) },
            inputs: { f: typedInputs([['a', f64]], rnd) },
            twin,
            runtime: null,
        }
    }
    if (kind === 5) {
        const text = 'export const f = (a, b) => a % b\n'
        const twin = /** @type {_Twin} */ (xs => numberRemainder(
            /** @type {number} */ (xs[0]),
            /** @type {number} */ (xs[1]),
        ))
        return {
            text,
            signatures: { f: signature(floatParams, f64) },
            inputs: { f: typedInputs(floatParams, rnd) },
            twin,
            runtime,
        }
    }
    // record kept inside the function
    const text = [
        'const mid = (p, q) => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 })',
        'export const f = (a, b, c, d) => {',
        '    const m = mid({ x: a, y: b }, { x: c, y: d })',
        '    return m.x + m.y',
        '}',
        '',
    ].join('\n')
    const twin = /** @type {_Twin} */ (xs => {
        const [a, b, c, d] = /** @type {readonly [number, number, number, number]} */ (xs)
        const mid = (
            /** @type {{ readonly x: number, readonly y: number }} */ p,
            /** @type {{ readonly x: number, readonly y: number }} */ q,
        ) => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 })
        const m = mid({ x: a, y: b }, { x: c, y: d })
        return m.x + m.y
    })
    const params = /** @type {const} */ ([['a', f64], ['b', f64], ['c', f64], ['d', f64]])
    return {
        text,
        signatures: { f: signature(params, f64) },
        inputs: { f: typedInputs(params, rnd) },
        twin,
        runtime: null,
    }
}

/** Values of every kind for programs over `any`. @type {readonly unknown[]} */
const anySamples = [
    undefined, null, false, true, 0, -0, 1, -1.5, NaN, Infinity,
    '', 'a', 'ab', 0n, 1n, -1n,
    [], [1], {}, { a: 1 },
    () => 0,
]

/**
 * One program over values of unknown kind, through the L0 view.
 *
 * @type {(rnd: _Rnd) => {
 *   readonly text: string,
 *   readonly signatures: Readonly<Record<string, Signature>>,
 *   readonly inputs: StringMap<readonly (readonly _Value[])[]>,
 *   readonly twin: _Twin,
 *   readonly runtime: typeof runtime,
 * }}
 */
export const anyProgram = rnd => {
    const form = below(rnd, 5)
    const samples = () => Array.from({ length: 8 }, () => /** @type {const} */ ([{ any: pick(rnd, anySamples) }]))
    if (form === 0) {
        const body = 'kind(v) !== UNDEFINED && kind(v) !== NULL && asBoolean(v)'
        return {
            text: `${l0Import}export const f = v => ${body}\n`,
            signatures: { f: signature([['v', any]], bool) },
            inputs: { f: samples() },
            twin: xs => {
                const v = held(xs[0])
                const k = kind(v)
                return k !== UNDEFINED && k !== NULL && asBoolean(v)
            },
            runtime,
        }
    }
    if (form === 1) {
        const body = 'kind(v) === BOOLEAN ? asBoolean(v) : false'
        return {
            text: `${l0Import}export const f = v => ${body}\n`,
            signatures: { f: signature([['v', any]], bool) },
            inputs: { f: samples() },
            twin: xs => {
                const v = held(xs[0])
                return kind(v) === BOOLEAN ? asBoolean(v) : false
            },
            runtime,
        }
    }
    if (form === 2) {
        const body = 'kind(v) === NUMBER ? asNumber(v) : 0'
        return {
            text: `${l0Import}export const f = v => ${body}\n`,
            signatures: { f: signature([['v', any]], f64) },
            inputs: { f: samples() },
            twin: xs => {
                const v = held(xs[0])
                return kind(v) === NUMBER ? asNumber(v) : 0
            },
            runtime,
        }
    }
    if (form === 3) {
        const body = [
            '{',
            '    const k = kind(v)',
            '    return k === STRING || k === ARRAY || k === OBJECT || k === FUNCTION || k === BIGINT ? length(v) : 0',
            '}',
        ].join('\n')
        return {
            text: `${l0Import}export const f = v => ${body}\n`,
            signatures: { f: signature([['v', any]], f64) },
            inputs: { f: samples() },
            twin: xs => {
                const v = held(xs[0])
                const k = kind(v)
                return k === STRING || k === ARRAY || k === OBJECT || k === FUNCTION || k === BIGINT ? length(v) : 0
            },
            runtime,
        }
    }
    // unit of a string at a small index; may throw
    return {
        text: `${l0Import}export const f = (v, i) => kind(v) === STRING ? unit(v, i) : -1\n`,
        signatures: { f: signature([['v', any], ['i', f64]], f64) },
        inputs: {
            f: Array.from({ length: 12 }, () => /** @type {const} */ ([
                { any: pick(rnd, ['', 'a', 'ab', 'abc', 1, null]) },
                pick(rnd, [0, 1, 2, -1, 0.5, 3]),
            ])),
        },
        twin: xs => {
            const v = held(xs[0])
            const i = /** @type {number} */ (xs[1])
            return kind(v) === STRING ? unit(v, i) : -1
        },
        runtime,
    }
}

/**
 * Whether a refusal is one the generators expect today: an integer-signed
 * body's range past its signature, which the checker finds by interval
 * arithmetic. The signature's result must be an integer range, so a
 * regression that gives an integer body where `f64` or `bool` was declared
 * is not counted as expected.
 *
 * @type {(reason: string, result: Type) => boolean}
 */
const expectedRefusal = (reason, result) => {
    if (result[0] !== 'int') { return false }
    // `f: the body is int(-65535, 0), not u(16)`
    const colon = reason.indexOf(':')
    if (colon < 0) { return false }
    const rest = reason.slice(colon + 1).trimStart()
    return rest.startsWith('the body is int(') && rest.includes('), not ')
}

/**
 * Lower, check, emit and run one program against its twin. A known refusal
 * from the checker (an integer range past the signature) is an outcome, not
 * a failure: the generators still write such bodies. Any other refusal is
 * reported as wrong, so a regression that refuses a supported category
 * fails the proof.
 *
 * @type {(program: ReturnType<typeof typedProgram>) => _Outcome}
 */
export const compareOne = program => {
    const result = program.signatures.f.result
    const accept = (/** @type {string} */ reason) => expectedRefusal(reason, result)
    const parsed = sourceOf(program.text)
    if (parsed[0] === 'error') { return ['wrong', `parse: ${parsed[1]}`] }
    const { fast, imports } = parsed[1]
    const ir = lower(program.signatures, program.runtime)(fast, imports)
    if (ir[0] === 'error') {
        return accept(ir[1]) ? ['refused', ir[1]] : ['wrong', `refused: ${ir[1]}`]
    }
    // Refuse here if the checker does; `run` checks again on the plain IR, as
    // the other host proofs pass it, and a module that `check` already typed
    // is not what `run` emits.
    const checked = check(ir[1])
    if (checked[0] === 'error') {
        return accept(checked[1]) ? ['refused', checked[1]] : ['wrong', `refused: ${checked[1]}`]
    }
    try {
        run(ir[1], { f: program.twin }, program.inputs)
    } catch (e) {
        return ['wrong', e instanceof Error ? e.message : String(e)]
    }
    const calls = Object.values(program.inputs).reduce((n, rows) => n + rows.length, 0)
    return ['ran', calls]
}

/**
 * Run `typed` typed programs and `any` programs over values of unknown
 * kind from `seed`. Answers how many ran, how many calls agreed, how many
 * were refused, and the first wrong answer if any.
 *
 * @type {(seed: number, typed: number, anyCount: number) => {
 *   readonly seed: number,
 *   readonly programs: number,
 *   readonly ran: number,
 *   readonly refused: number,
 *   readonly calls: number,
 *   readonly wrong: string | null,
 * }}
 */
export const compare = (seed, typed, anyCount) => {
    const rnd = rng(seed)
    let ran = 0
    let refused = 0
    let calls = 0
    /** @type {string | null} */
    let wrong = null
    const step = (/** @type {ReturnType<typeof typedProgram>} */ program) => {
        if (wrong !== null) { return }
        const out = compareOne(program)
        if (out[0] === 'ran') {
            ran += 1
            calls += out[1]
        } else if (out[0] === 'refused') {
            refused += 1
        } else {
            wrong = out[1]
        }
    }
    for (let k = 0; k < typed; k += 1) { step(typedProgram(rnd)) }
    for (let k = 0; k < anyCount; k += 1) { step(anyProgram(rnd)) }
    return { seed, programs: typed + anyCount, ran, refused, calls, wrong }
}
