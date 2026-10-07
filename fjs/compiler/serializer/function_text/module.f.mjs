/**
 * JavaScript expression text for every admitted EDAG function body. Captured
 * values remain slot names; nested capture expressions run at construction.
 *
 * This is code-only function representation, separate from the source writer's
 * FJS round-trip contract. The emitted JavaScript can use syntax the FJS parser
 * does not yet accept. Shared nodes use lazy invocation-local cells, so printing
 * a graph neither duplicates allocations nor moves work out of lazy branches.
 * The generator itself is pure; assignments occur only in the emitted text.
 *
 * Admission and binding checks belong to the caller. A function body cannot
 * contain the module-only `args` operation. Nothing traverses the selected
 * function's captures or repeats their validation.
 *
 * @module
 * @import { Analysis, ItemOperand, Node, Operand, Step } from '../../../edag/analysis/types.ts'
 * @import { _Scope } from './private.ts'
 */

import { leafSerialize } from '../../../media/datajs/serializer/module.f.mjs'
import { toArray } from '../../../types/list/module.f.mjs'
import { codePointToString } from '../../../text/utf16/module.f.mjs'
import { latinSmallLetterA, latinSmallLetterZ } from '../../../text/ascii/module.f.mjs'

/** The number of letters in a generated parameter-name digit. */
const letters = latinSmallLetterZ - latinSmallLetterA + 1

/** Spreadsheet-style letters for a positive scope depth. @type {(n: number) => string} */
const column = n => {
    const q = Math.floor((n - 1) / letters)
    return `${q === 0 ? '' : column(q)}${codePointToString(latinSmallLetterA + (n - 1) % letters)}`
}

/** The shared canonical parameter name at a positive function depth. @type {(depth: number) => string} */
export const parameter = depth => `$${column(depth)}`

/** The name of one invocation-local memo cell. @type {(_s: _Scope, k: number) => string} */
const memoName = (s, k) => `${parameter(s.depth)}${k}`
/** The name a function reading its own `['self']` is given at a positive depth: a named function expression is the one JavaScript spelling of a function that names itself. @type {(depth: number) => string} */
const selfName = depth => `${parameter(depth)}_self`

/** Render a value, demanding a shared entry through its cell. @type {(s: _Scope, v: Operand) => string} */
const operand = (s, v) => {
    if (!(v instanceof Array)) { return `(${toArray(leafSerialize(v)).join('')})` }
    const k = s.shared.indexOf(v[1])
    return k === -1 ? entry(s, v[1]) : `(${memoName(s, k)}())`
}

/** Array items and arguments share the same spread syntax. @type {(s: _Scope, values: readonly ItemOperand[]) => string} */
const items = (s, values) => values.map(v => v instanceof Array && v[0] === '...'
    ? `...${operand(s, v[1])}` : operand(s, /** @type {Operand} */ (v))).join(',')

/** Continue one optional region; grouping closes it for the escaping call. @type {(s: _Scope, text: string, step: Step | undefined) => string} */
const chain = (s, text, step) => {
    if (step === undefined) { return text }
    const [tag, value, next] = step
    switch (tag) {
        case '|.': { return chain(s, `${text}[${operand(s, value)}]`, next) }
        case '|?.()': { return chain(s, `${text}?.(${items(s, value)})`, next) }
        case '|!()': { return `(${text})(${items(s, value)})` }
        default: { return chain(s, `${text}(${items(s, value)})`, next) }
    }
}

/** A node's complete JavaScript expression, without demanding its own memo cell. @type {(s: _Scope, i: number) => string} */
const entry = (s, i) => {
    const n = /** @type {Exclude<Node, readonly ['args']>} */ (s.a.nodes[i])
    switch (n[0]) {
        case 'undefined': { return '(undefined)' }
        case 'arg': { return `(${parameter(s.depth)}_${n[1]})` }
        case 'rest': { return `(${parameter(s.depth)})` }
        case 'frame': { return `(${s.frame[n[1]]})` }
        case 'self': { return `(${selfName(s.depth)})` }
        case '[]': { return `([${items(s, n[1])}])` }
        case '{}': { return `({${n[1].map(p => p[0] === '...'
            ? `...${operand(s, p[1])}` : `[${operand(s, p[1])}]:${operand(s, p[2])}`).join(',')}})` }
        case '=>': {
            const frame = n[2].map((_, k) => `$${k}`)
            const text = lambda(s.a, i, s.depth + 1, frame)
            return n[2].length === 0 ? `(${text})`
                : `((${frame.join(',')})=>(${text}))(${n[2].map(v => operand(s, v)).join(',')})`
        }
        case '.': case '?.': {
            const start = `${operand(s, n[1])}${n[0] === '?.' ? '?.' : ''}[${operand(s, n[2])}]`
            return `(${chain(s, start, n[3])})`
        }
        case '()': { return `((0,${operand(s, n[1])})(${items(s, n[2])}))` }
        case '?.()': { return `(${chain(s, `(0,${operand(s, n[1])})?.(${items(s, n[2])})`, n[3])})` }
        case ',': { return n[1].length === 0 ? '(undefined)' : `(${n[1].map(v => operand(s, v)).join(',')})` }
        case 'throw': { return `(()=>{throw ${operand(s, n[1])};})()` }
        case 'String': case 'Number': { return `(${n[0]}(${operand(s, n[1])}))` }
        case '!': case '~': case 'typeof': { return `(${n[0]} ${operand(s, n[1])})` }
        case '+': case '-': { return n.length === 2 ? `(${n[0]} ${operand(s, n[1])})` : `(${operand(s, n[1])}${n[0]}${operand(s, n[2])})` }
        case '?:': { return `(${operand(s, n[1])}?${operand(s, n[2])}:${operand(s, n[3])})` }
        case 'is': { return `(Object.is(${operand(s, n[1])},${operand(s, n[2])}))` }
        case 'own': { return `(($o,$k)=>{if(typeof $k!=="string"){throw undefined;}return Object.getOwnPropertyDescriptor($o,$k)?.value;})(${operand(s, n[1])},${operand(s, n[2])})` }
        default: {
            // The remaining admitted body nodes are binary operations;
            // `args`, sharing a type union with rest/undefined, is module-only.
            const [op, left, right] = /** @type {readonly [string, Operand, Operand]} */ (n)
            return `(${operand(s, left)}${op}${operand(s, right)})`
        }
    }
}

/** One function's body has fresh memo cells and only its own parameters. @type {(a: Analysis, i: number, depth: number, frame: readonly string[]) => string} */
const lambda = (a, i, depth, frame) => {
    const [, length, , body] = /** @type {Extract<Node, readonly ['=>', number, readonly Operand[], Operand]>} */ (a.nodes[i])
    const shared = a.shared.filter(j => a.scope[j] === i)
    const s = { a, depth, frame, shared }
    const fixed = Array.from({ length }, (_, k) => `${parameter(depth)}_${k}`)
    const rest = a.nodes.some((n, j) => n[0] === 'rest' && a.scope[j] === i) ? [`...${parameter(depth)}`] : []
    const list = [...fixed, ...rest].join(',')
    const value = operand(s, body)
    const cells = shared.map((j, k) => `const ${memoName(s, k)}=(()=>{let $v,$done=false;return()=>{if(!$done){$v=${entry(s, j)};$done=true;}return $v;};})();`).join('')
    // a body reading its own `self` is a named function expression, the
    // name the body's `self` reads, since an arrow function cannot name
    // itself; its body is always a block
    return a.nodes.some((n, j) => n[0] === 'self' && a.scope[j] === i)
        ? `(function ${selfName(depth)}(${list}){${cells}return ${value};})`
        : `(${list})=>${cells === '' ? value : `{${cells}return ${value};}`}`
}

/** Code-only text of a trusted function entry; evaluated captures stay unnamed data. @type {(a: Analysis, i: number) => string} */
export const renderFunction = (a, i) => {
    const node = /** @type {Extract<Node, readonly ['=>', number, readonly Operand[], Operand]>} */ (a.nodes[i])
    return lambda(a, i, 1, node[2].map((_, k) => `$${k}`))
}
