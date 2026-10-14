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
 * @import { Loop } from '../../../edag/loop/types.ts'
 * @import { _Scope } from './private.ts'
 * @import { Chunk } from '../../../text/marked/types.ts'
 */

import { leafSerialize } from '../../../media/datajs/serializer/module.f.mjs'
import { chunksText, keyword, literal } from '../../../text/marked/module.f.mjs'
import { keepsRecursion, loopOf, reaches, readsRest } from '../../../edag/loop/module.f.mjs'
import { operandsOf } from '../../../edag/analysis/module.f.mjs'
import { _name as name, _binding as binding, _resolve as resolve } from '../names/module.f.mjs'

/** The name of one invocation-local memo cell. @type {(_s: _Scope, k: number) => string} */
const memoName = (s, k) => name(`${s.path}/memo${k}`)
/** The name a function reading its own `['self']` is given in its rendering scope: a named function expression is the one JavaScript spelling of a function that names itself. @type {(path: string) => string} */
const selfName = path => name(`${path}/self`)

/**
 * A static function's path as the source calls it: `Object.is` for
 * `['Object', 'is']`, the global alone for `['isNaN']` and for the global
 * called as a function, `['Object', '']`. The keys are an admitted path's,
 * which the analysis checked: identifiers, the empty key last.
 *
 * @type {(path: readonly string[]) => string}
 */
export const _staticText = path => path.filter(key => key !== '').join('.')

/**
 * The `entry` helper's text, the one spelling of `['entry']` — the
 * FunctionalScript writer's and this renderer's alike, so that `String(f)`
 * and the source output agree — over the symbolic names of its three
 * bindings at `path`: the two parameters, named as every function's are,
 * and the descriptor `const`.
 *
 * ```js
 * ($0,$1)=>{const $2=Object.getOwnPropertyDescriptor($0,$1);return $2?.enumerable?$2.value:undefined;}
 * ```
 *
 * @type {(path: string) => string}
 */
export const _entryText = path => chunksText(_entryChunks(path))

/**
 * {@link _entryText} as chunks: its keywords and its `undefined` carry their
 * kind, so the one text has one spelling for the plain and the marked writer.
 *
 * @type {(path: string) => readonly Chunk[]}
 */
export const _entryChunks = path => {
    const a = name(`${path}/arg0`)
    const b = name(`${path}/arg1`)
    const x = name(`${path}/descriptor`)
    return [
        `(${binding(a)},${binding(b)})=>{`,
        keyword('const'),
        ` ${binding(x)}=Object.getOwnPropertyDescriptor(${a},${b});`,
        keyword('return'),
        ` ${x}?.enumerable?${x}.value:`,
        literal('undefined'),
        ';}',
    ]
}

/** Render a value, demanding a shared entry through its cell. @type {(s: _Scope, v: Operand) => string} */
const operand = (s, v) => {
    if (!(v instanceof Array)) { return `(${chunksText(leafSerialize(v))})` }
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
        case 'arg': { return `(${name(`${s.path}/arg${n[1]}`)})` }
        case 'rest': { return `(${name(`${s.path}/rest`)})` }
        case 'frame': { return `(${s.frame[n[1]]})` }
        case 'self': { return `(${selfName(s.path)})` }
        case 'entry': { return `(${_entryText(`${s.path}/function${i}`)})` }
        case 'static': { return `(${_staticText(n[1])})` }
        case '[]': { return `([${items(s, n[1])}])` }
        case '{}': { return `({${n[1].map(p => p[0] === '...'
            ? `...${operand(s, p[1])}` : `[${operand(s, p[1])}]:${operand(s, p[2])}`).join(',')}})` }
        case '=>': {
            const path = `${s.path}/function${i}`
            const frame = n[2].map((_, k) => name(`${path}/frame${k}`))
            const text = lambda(s.a, i, path, frame)
            return n[2].length === 0 ? `(${text})`
                : `((${frame.map(binding).join(',')})=>(${text}))(${n[2].map(v => operand(s, v)).join(',')})`
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
        // the constructor is the name the node carries, written as the word
        case 'instanceof': { return `(${operand(s, n[1])} instanceof ${n[2]})` }
        case '+': case '-': { return n.length === 2 ? `(${n[0]} ${operand(s, n[1])})` : `(${operand(s, n[1])}${n[0]}${operand(s, n[2])})` }
        case '?:': { return `(${operand(s, n[1])}?${operand(s, n[2])}:${operand(s, n[3])})` }
        default: {
            // The remaining admitted body nodes are binary operations;
            // `args`, sharing a type union with rest/undefined, is module-only.
            const [op, left, right] = /** @type {readonly [string, Operand, Operand]} */ (n)
            return `(${operand(s, left)}${op}${operand(s, right)})`
        }
    }
}

/** One lazy cell and its invocation-local value/demand flag. @type {(s: _Scope, i: number, k: number) => string} */
const memoCell = (s, i, k) => {
    const value = name(`${s.path}/memo${k}/value`)
    const done = name(`${s.path}/memo${k}/done`)
    return `const ${binding(memoName(s, k))}=(()=>{let ${binding(value)},${binding(done)}=false;return()=>{if(!${done}){${value}=${entry(s, i)};${done}=true;}return ${value};};})();`
}

/** Whether a node is read as a name: a parameter, the rest array, a slot of the frame, `undefined`. @type {(node: Node) => boolean} */
const isNameRead = node => ['arg', 'rest', 'frame', 'undefined'].includes(node[0])

/** An assert as a statement: its value established and discarded. @type {(s: _Scope) => (v: Operand) => string} */
const assert = s => v => `${operand(s, v)};`

/** Whether an operand names the function's first parameter, `['arg', 0]`. @type {(a: Analysis, v: Operand) => boolean} */
const isArg0 = (a, v) => v instanceof Array && a.nodes[v[1]][0] === 'arg' && a.nodes[v[1]][1] === 0

/**
 * Whether a loop (`fjs/edag/loop`) is written as one, {@link loopText},
 * rather than as the recursion it is: the shapes every writer keeps the
 * recursion for (`keepsRecursion`), and one of this text's own — a
 * condition reaching any value a cell establishes, shared with the block
 * or not, since the cells are declared inside the `while`, after the
 * condition is tested, so no value the condition reaches has one to be
 * read from. A next value that throws is assigned as the applied function
 * the throw is spelled as anywhere, and throws there.
 *
 * @type {(a: Analysis, i: number, shared: readonly number[], loop: Loop) => boolean}
 */
const asLoop = (a, i, shared, loop) => !keepsRecursion(a, i, loop) && !reaches(a, shared)(loop.condition)

/**
 * A loop's text, `r => COND ? self(NEXT) : r` as the loop it is
 * (`fjs/edag/loop`), the one spelling every writer has for it, the
 * language's own: an arrow whose body is a `let` of the parameter, the
 * `while` over that variable — the asserts and the memo cells inside the
 * body, so that each round starts fresh as each call did, and the
 * assignment omitted where the next value is the variable itself — and
 * the `return` of the variable. The text the source writer writes for the
 * same loop called in place, and FunctionalScript where no cell stands in
 * it. V8 implements no tail calls, so the named function expression a
 * self-call is otherwise spelled as would overflow the stack after some
 * thousands of rounds, where this runs in constant stack. The `self` name
 * is gone, since no read of it survives.
 *
 * ```js
 * ($0)=>{let $1=$0;while((($1)<(10))){$1=(($1)+(1));}return $1;}
 * ```
 *
 * @type {(s: _Scope, cells: string, loop: Loop) => string}
 */
const loopText = (s, cells, { condition, asserts, next }) => {
    const parameter = name(`${s.path}/parameter`)
    // the variable is what every read of the parameter is written as
    const variable = name(`${s.path}/arg0`)
    const step = isArg0(s.a, next) ? '' : `${variable}=${operand(s, next)};`
    return `(${binding(parameter)})=>{let ${binding(variable)}=${parameter};while(${operand(s, condition)}){${cells}${asserts.map(assert(s)).join('')}${step}}return ${variable};}`
}

/** One function's body has fresh memo cells and only its own parameters. @type {(a: Analysis, i: number, path: string, frame: readonly string[]) => string} */
const lambda = (a, i, path, frame) => {
    const [, length, , body] = /** @type {Extract<Node, readonly ['=>', number, readonly Operand[], Operand]>} */ (a.nodes[i])
    // a name — a parameter, the rest array, a slot of the frame — is the
    // same value at every read, so it takes no cell however many places
    // read it
    const shared = a.shared.filter(j => a.scope[j] === i && !isNameRead(a.nodes[j]))
    const s = { a, path, frame, shared }
    const fixed = Array.from({ length }, (_, k) => binding(name(`${path}/arg${k}`)))
    const rest = readsRest(a, i) ? [`...${binding(name(`${path}/rest`))}`] : []
    const list = [...fixed, ...rest].join(',')
    const cells = shared.map((j, k) => memoCell(s, j, k)).join('')
    const loop = loopOf(a, i)
    if (loop !== null && asLoop(a, i, shared, loop)) { return loopText(s, cells, loop) }
    const value = operand(s, body)
    // a body reading its own `self` is a named function expression, the
    // name the body's `self` reads, since an arrow function cannot name
    // itself; its body is always a block
    return a.nodes.some((n, j) => n[0] === 'self' && a.scope[j] === i)
        ? `(function ${binding(selfName(path))}(${list}){${cells}return ${value};})`
        : `(${list})=>${cells === '' ? value : `{${cells}return ${value};}`}`
}

/** Code-only text of a trusted function entry; evaluated captures stay unnamed data. @type {(a: Analysis, i: number) => string} */
export const renderFunction = (a, i) => {
    const node = /** @type {Extract<Node, readonly ['=>', number, readonly Operand[], Operand]>} */ (a.nodes[i])
    const frame = node[2].map((_, k) => name(`external${k}`))
    return chunksText(resolve([lambda(a, i, 'function', frame)], [], frame))
}

/** Compose a function into a larger symbolic document before allocating names. @type {(a: Analysis, i: number, path: string, frame: readonly string[]) => string} */
export const _renderSymbolic = (a, i, path, frame) => lambda(a, i, path, frame)
