/**
 * Prepared FAST to JavaScript. Placement, memo lifetimes, loop state and
 * simultaneous transfers have already been chosen by the common passes.
 * Source mode consumes the source-admitted subset; runtime mode also renders
 * arbitrary evaluated captures and memo definitions.
 * This module supplies syntax and lexical names only.
 *
 * @module
 * @import { BindingId, Item, Key, LoopTarget, Operator, Step } from '../types.ts'
 * @import { Block, Function as PreparedFunction, Statement, Value } from '../prepare/types.ts'
 * @import { List, NonEmpty } from '../../../types/list/types.ts'
 * @import { _Context as Context, _Syntax as Syntax, _ScanTask as ScanTask, _Scan as Scan, _ExpressionTask as ExpressionTask } from './private.ts'
 */

import { operatorOperands } from '../module.f.mjs'
import { isIdentifier } from '../../../js/identifier/module.f.mjs'
import { leafSerialize } from '../../../media/datajs/serializer/module.f.mjs'
import { next, reverse } from '../../../types/list/module.f.js'
import { toArray } from '../../../types/list/alt/module.f.js'
import { chunkText, tagged, untagged } from '../../../text/marked/module.f.mjs'
import { _name as symbol, _binding as declaration, _resolve as resolve } from '../../../compiler/serializer/names/module.f.mjs'
import { _entryChunks, _hasEntryChunks, _intrinsicChunks } from './intrinsic/module.f.mjs'
import { _memberPresentChunks } from './member_present/module.f.mjs'
import { isIntrinsic } from '../../../edag/module.f.mjs'

const keyword = tagged('keyword')

/** @type {(chunks: readonly import('../../../text/marked/types.ts').Chunk[]) => string} */
const taggedChunks = chunks => chunks.map(chunk => typeof chunk === 'string'
    ? chunk : tagged(/** @type {import('../../../text/marked/types.ts').TokenKind} */ (chunk[1]))(chunk[0])).join('')

/** @type {(value: import('../../../media/datajs/types.ts').Primitive) => string} */
const primitive = value => taggedChunks(toArray(leafSerialize(value)))

/** Syntax identities collected with an explicit immutable work stack. @type {(input: readonly ScanTask[]) => Scan} */
const scan = input => {
    /** @type {List<ScanTask>} */
    let pending = input
    /** @type {List<Value>} */
    let values = null
    /** @type {List<LoopTarget>} */
    let loops = null
    /** @type {List<BindingId>} */
    let bindings = null
    while (true) {
        /** @type {NonEmpty<ScanTask> | null} */
        const item = next(pending)
        if (item === null) { break }
        const task = item.first
        /** @type {readonly ScanTask[]} */
        let children = []
        /** @type {readonly BindingId[]} */
        let ids = []
        if (task[0] === 'value') {
            const value = task[1]
            if (value instanceof Array) {
                values = { first: value, tail: values }
                if (value[0] === 'ref' || value[0] === 'demand') { ids = [value[1]] }
                else if (value[0] === 'function') { children = [['function', value[1]]] }
                else if (value[0] === 'block') { children = [['block', value[1]]] }
                else if (value[0] === 'if') { children = [['value', value[1]], ['block', value[2]], ['block', value[3]]] }
                else { children = operatorOperands(/** @type {Operator<Value>} */ (value)).map(child => ['value', child]) }
            }
        } else if (task[0] === 'function') {
            const fn = task[1]
            ids = [...fn.parameters, ...fn.rest === null ? [] : [fn.rest], ...fn.self === null ? [] : [fn.self], ...fn.captures.map(capture => capture.binding)]
            children = [...fn.captures.map(capture => /** @type {ScanTask} */ (['value', capture.value])), ['block', fn.body]]
        } else if (task[0] === 'block') {
            const block = task[1]
            const exit = block.exit
            children = [...block.statements.map(statement => /** @type {ScanTask} */ (['statement', statement])),
                ...exit[0] === 'yield' ? exit[1].map(value => /** @type {ScanTask} */ (['value', value]))
                    : exit[0] === 'return' ? [/** @type {ScanTask} */ (['value', exit[2]])]
                        : exit[0] === 'throw' ? [/** @type {ScanTask} */ (['value', exit[1]])] : []]
        } else {
            const statement = task[1]
            switch (statement[0]) {
                case 'define': case 'slot': case 'write': { ids = [statement[1]]; children = [['value', statement[2]]]; break }
                case 'memo': { ids = [statement[1].binding, statement[1].valueSlot, statement[1].doneSlot]; children = [['block', statement[1].initializer]]; break }
                case 'block': { children = [['block', statement[1]]]; break }
                case 'if': { children = [['value', statement[1]], ['block', statement[2]], ['block', statement[3]]]; break }
                case 'loop': { loops = { first: statement[1], tail: loops }; children = [['block', statement[2]]]; break }
                case 'while': {
                    const loop = statement[1]
                    loops = { first: loop.target, tail: loops }
                    ids = [loop.slot, loop.result]
                    children = [['value', loop.initial], ['value', loop.condition], ['block', loop.body]]
                    break
                }
            }
        }
        for (const first of ids) { bindings = { first, tail: bindings } }
        pending = { head: children, tail: item.tail }
    }
    return { values: toArray(reverse(values)), loops: toArray(reverse(loops)), bindings: toArray(reverse(bindings)) }
}

/** @type {(value: Value) => Syntax} */
const valueSyntax = value => scan([['value', value]])
/** @type {(block: Block) => Syntax} */
const blockSyntax = block => scan([['block', block]])
/** @type {(fn: PreparedFunction) => readonly BindingId[]} */
const functionBindings = fn => scan([['function', fn]]).bindings
/** @type {(block: Block) => readonly BindingId[]} */
const blockBindings = block => scan([['block', block]]).bindings

/** Allocate presentation-only capture aliases before rendering any scope. @type {(ids: readonly BindingId[], syntax: Syntax, runtime: boolean, external: boolean) => Context} */
const contextFor = (ids, syntax, runtime, external) => {
    const functions = [...new Set(syntax.values.flatMap(value => value instanceof Array && value[0] === 'function' ? [value[1]] : []))]
    const captureAliases = functions.map(fn => /** @type {const} */ ([fn, fn.captures.map((_, index) => ({ index }))]))
    return { ids: [...new Set([...ids, ...captureAliases.flatMap(([, bindings]) => bindings)])], ...syntax, captureAliases, runtime, aliases: [], binding: null, external }
}

/** @type {(context: Context, id: BindingId) => string} */
const name = (context, id) => {
    let current = id
    let alias = context.aliases.find(([from]) => from === current)
    while (alias !== undefined) {
        current = alias[1]
        alias = context.aliases.find(([from]) => from === current)
    }
    return symbol(`fast${context.ids.indexOf(current)}`)
}

/** @type {(context: Context, id: BindingId) => string} */
const declared = (context, id) => declaration(name(context, id))

/** @type {(value: Value) => number} */
const precedence = input => {
    const value = syntaxValue(input)
    if (!(value instanceof Array)) { return typeof value === 'number' && (value < 0 || Object.is(value, -0)) || typeof value === 'bigint' && value < 0n ? 14 : 16 }
    const op = value[0]
    if (op === 'function' || op === 'entry' || op === 'hasEntry' || (value.length === 1 && isIntrinsic(value))) { return 1 }
    if (op === 'if' || op === '?:') { return 2 }
    if (op === '|') { return 5 }
    if (op === '^') { return 6 }
    if (op === '&') { return 7 }
    if (op === '===' || op === '!==') { return 8 }
    if (op === '<' || op === '<=' || op === '>' || op === '>=' || op === 'instanceof' || op === 'in') { return 9 }
    if (op === '<<' || op === '>>' || op === '>>>') { return 10 }
    if ((op === '+' || op === '-') && value.length === 3) { return 11 }
    if (op === '*' || op === '/' || op === '%') { return 12 }
    if (op === '**') { return 13 }
    if (op === '+' || op === '-' || op === '~' || op === '!' || op === 'typeof') { return 14 }
    return 16
}

/**
 * Render ordinary expression trees postorder. The shallow syntax functions
 * read only already rendered immediate operands; depth does not use the host
 * stack. Pure result blocks forward their result without adding syntax.
 * @type {(context: Context, value: Value) => string}
 */
const expressionText = (context, value) => {
    /** @type {List<ExpressionTask>} */
    let pending = [['value', value]]
    /** @type {List<string>} */
    let results = null
    while (true) {
        /** @type {NonEmpty<ExpressionTask> | null} */
        const task = next(pending)
        if (task === null) { return /** @type {NonNullable<ReturnType<typeof next<string>>>} */ (next(results)).first }
        pending = task.tail
        if (task.first[0] === 'value') {
            const value = task.first[1]
            if (!(value instanceof Array) || ['ref', 'demand', 'function', 'if'].includes(value[0]) || value[0] === 'block' && (value[1].statements.length !== 0 || value[1].exit[0] !== 'yield')) {
                results = { first: valueText(context, value), tail: results }
                continue
            }
            const children = value[0] === 'block' ? [/** @type {Extract<Block['exit'], readonly ['yield', unknown]>} */ (value[1].exit)[1][0]] : operatorOperands(/** @type {Operator<Value>} */ (value))
            pending = { head: children.map(child => /** @type {ExpressionTask} */ (['value', child])), tail: { first: ['finish', value, children], tail: pending } }
        } else {
            const [, value, children] = task.first
            /** @type {List<string>} */
            let rendered = null
            for (const _ of children) {
                const result = /** @type {NonNullable<ReturnType<typeof next<string>>>} */ (next(results))
                rendered = { first: result.first, tail: rendered }
                results = result.tail
            }
            const texts = toArray(rendered)
            const text = valueText({ ...context, rendered: children.map((child, index) => [child, texts[index]]) }, value)
            results = { first: text, tail: results }
        }
    }
}

/** @type {(context: Context, value: Value, minimum?: number) => string} */
const expression = (context, value, minimum = 0) => {
    const text = context.rendered?.find(([child]) => Object.is(child, value))?.[1] ?? expressionText(context, value)
    return minimum !== 0 && precedence(value) < minimum ? `(${text})` : text
}

/** @type {(context: Context, key: Key<Value>, optional?: boolean) => string} */
const keyText = (context, key, optional = false) => key instanceof Array
    ? `${optional ? '?.' : ''}[Number(${expression(context, key[1])})]`
    : typeof key === 'string' && isIdentifier(key)
        ? `${optional ? '?.' : '.'}${key}`
        : `${optional ? '?.' : ''}[${primitive(key)}]`

/** @type {(context: Context, values: readonly Item<Value>[]) => string} */
const itemText = (context, values) => values.map(value => value instanceof Array && value[0] === '...'
    ? `...${expression(context, value[1])}` : expression(context, /** @type {Value} */ (value))).join(',')

/** @type {(context: Context, text: string, step: Step<Value> | undefined) => string} */
const stepsText = (context, text, step) => {
    let current = step
    let result = text
    while (current !== undefined) {
        if (current[0] === '|.') { result = `${result}${keyText(context, current[1])}` }
        else if (current[0] === '|!()') { return `(${result})(${itemText(context, current[1])})` }
        else { result = `${result}${current[0] === '|?.()' ? '?.' : ''}(${itemText(context, current[1])})` }
        current = current[2]
    }
    return result
}

/** A result block requiring no statements has the syntax of its value. @type {(value: Value) => Value} */
const syntaxValue = value => {
    let current = value
    while (current instanceof Array && current[0] === 'block' && current[1].statements.length === 0 && current[1].exit[0] === 'yield') { current = current[1].exit[1][0] }
    return current
}

/** Parentheses close a native optional-chain region. @type {(value: Value) => boolean} */
const optionalRegion = input => {
    const value = syntaxValue(input)
    if (!(value instanceof Array)) { return false }
    if (value[0] === '?.' || value[0] === '?.()') { return true }
    return value[0] === '.' && value.length === 4 && value[3][0] === '|?.()'
}

/** @type {(context: Context, operator: Operator<Value>) => string} */
const operatorText = (context, operator) => {
    if (operator.length === 1) {
        const path = `helper${context.values.indexOf(operator)}`
        if (operator[0] === 'entry') { return taggedChunks(_entryChunks(path)) }
        if (operator[0] === 'hasEntry') { return taggedChunks(_hasEntryChunks(path)) }
        return isIntrinsic(operator) ? taggedChunks(_intrinsicChunks(operator[0])(path)) : operator[0]
    }
    switch (operator[0]) {
        case 'array': { return `[${itemText(context, operator[1])}]` }
        case 'object': { return `{${operator[1].map(entry => entry[0] === '...'
            ? `...${expression(context, entry[1])}`
            : `${typeof entry[1] === 'string' && entry[1] !== '__proto__' ? primitive(entry[1]) : `[${expression(context, entry[1])}]`}:${expression(context, entry[2])}`).join(',')}}` }
        case 'memberPresent': {
            const helper = taggedChunks(_memberPresentChunks(`helper${context.values.indexOf(operator)}`))
            const key = operator[2]
            const converted = key instanceof Array ? `Number(${expression(context, key[1])})` : primitive(key)
            return `${helper}(${expression(context, operator[1])},${converted})`
        }
        case '.': case '?.': {
            const base = operator[1]
            const text = expression(context, base, 15)
            const grouped = typeof base === 'number' || typeof base === 'bigint' || (operator[0] === '.' && optionalRegion(base))
            return stepsText(context, `${grouped ? `(${text})` : text}${keyText(context, operator[2], operator[0] === '?.')}`, /** @type {Step<Value> | undefined} */ (operator[3]))
        }
        case '()': {
            const callee = expression(context, operator[1], 15)
            let value = syntaxValue(operator[1])
            while (value instanceof Array && value[0] === ',' && value[1].length === 1) { value = syntaxValue(value[1][0]) }
            const detached = value instanceof Array && ['.', '?.'].includes(value[0])
            return `${detached ? `(0,${callee})` : callee}(${itemText(context, operator[2])})`
        }
        case '?.()': {
            const callee = expression(context, operator[1], 15)
            return stepsText(context, `${callee}?.(${itemText(context, operator[2])})`, /** @type {Step<Value> | undefined} */ (operator[3]))
        }
        case ',': { return `(${operator[1].map(value => expression(context, value)).join(',') || primitive(undefined)})` }
        case '?:': { return `${expression(context, operator[1], 3)}?${expression(context, operator[2])}:${expression(context, operator[3])}` }
        case 'BigInt': case 'Number': case 'String': { return `${operator[0]}(${expression(context, operator[1])})` }
        case 'typeof': { return `${keyword('typeof')} ${expression(context, operator[1], 14)}` }
        case '~': case '!': { return `${operator[0]}${expression(context, operator[1], 14)}` }
        case '+': case '-': {
            if (operator[0] === '+' && operator.length === 3) { const right = expression(context, operator[2], 12); return `${expression(context, operator[1], 11)}+${untagged(right).startsWith('+') ? ' ' : ''}${right}` }
            if (operator.length === 2) {
                const text = expression(context, operator[1], 14)
                return `${operator[0]}${untagged(text).startsWith(operator[0]) ? ' ' : ''}${text}`
            }
            const right = expression(context, operator[2], 12)
            return `${expression(context, operator[1], 11)}-${untagged(right).startsWith('-') ? ' ' : ''}${right}`
        }
        case 'instanceof': { return `${expression(context, operator[1], 9)} ${keyword('instanceof')} ${operator[2]}` }
        // the key is a string literal, the one left operand the language
        // admits; the right operand groups as `<`'s right operand would
        case 'in': { return `${primitive(operator[1])} ${keyword('in')} ${expression(context, operator[2], 10)}` }
        default: {
            const level = precedence(operator)
            const [tag, left, right] = operator
            const leftText = expression(context, left, level + (tag === '**' ? 1 : 0))
            const leftValue = syntaxValue(left)
            const signedLeaf = typeof leftValue === 'number' && (leftValue < 0 || Object.is(leftValue, -0)) || typeof leftValue === 'bigint' && leftValue < 0n
            const unary = leftValue instanceof Array && ['-', '+', '~', '!', 'typeof'].includes(leftValue[0]) && leftValue.length === 2
            const l = tag === '**' && (signedLeaf || unary) ? `(${leftText})` : leftText
            const r = expression(context, right, level + (tag === '**' ? 0 : 1))
            return `${l}${tag}${r}`
        }
    }
}

/** @type {(context: Context, value: Value) => string} */
const valueText = (context, value) => {
    if (!(value instanceof Array)) { return primitive(value) }
    switch (value[0]) {
        case 'ref': { return name(context, value[1]) }
        case 'demand': { return `${name(context, value[1])}()` }
        case 'function': { return functionText(context, value[1]) }
        case 'block': { return blockExpression(context, value[1]) }
        case 'if': { return `${expression(context, value[1], 3)}?${blockExpression(context, value[2])}:${blockExpression(context, value[3])}` }
        default: { return operatorText(context, value) }
    }
}

/** Final result regions share the containing lexical region. @type {(input: Block) => Block} */
const flatten = input => {
    let block = input
    /** @type {List<Statement>} */
    let before = null
    const target = input.exit[0] === 'return' ? input.exit[1] : null
    while (true) {
        const exit = block.exit
        const value = exit[0] === 'yield' && exit[1].length === 1 ? exit[1][0] : exit[0] === 'return' ? exit[2] : undefined
        if (!(value instanceof Array) || value[0] !== 'block') {
            return { statements: toArray({ head: before, tail: block.statements }), exit: target !== null && exit[0] === 'yield' ? ['return', target, exit[1][0]] : exit }
        }
        before = { head: before, tail: block.statements }
        block = value[1]
    }
}

/** @type {(context: Context, block: Block) => string} */
const blockExpression = (context, input) => {
    const block = flatten(input)
    return block.statements.length === 0 && block.exit[0] === 'yield'
        ? expression(context, block.exit[1][0])
        : `(()=>{${blockText(context, block, 'return')}})()`
}

/** @type {(context: Context, fn: PreparedFunction) => string} */
const functionText = (context, fn) => {
    const references = fn.captures.flatMap(capture => capture.value instanceof Array && capture.value[0] === 'ref' ? [capture.value[1]] : [])
    const captured = context.runtime && !context.external && (references.length !== fn.captures.length || new Set(references).size !== references.length)
    const aliases = captured || context.external ? context.aliases : [
        ...context.aliases,
        ...fn.captures.map(capture => /** @type {const} */ ([capture.binding, /** @type {readonly ['ref', BindingId]} */ (capture.value)[1]]))
            .filter(([binding, source]) => binding !== source),
    ]
    const self = fn.self === null || context.binding === null || context.runtime ? [] : [/** @type {const} */ ([fn.self, context.binding])]
    let inner = { ...context, aliases: [...aliases, ...self], binding: null, external: false }
    const params = [...fn.parameters.map(id => declared(inner, id)), ...fn.rest === null ? [] : [`...${declared(inner, fn.rest)}`]].join(',')
    let preface = ''
    if (!context.runtime && fn.captures.length > 1) {
        const before = inner
        const locals = /** @type {readonly [PreparedFunction, readonly BindingId[]]} */ (context.captureAliases.find(([owner]) => owner === fn))[1]
        inner = { ...inner, aliases: [...inner.aliases.filter(([from]) => !fn.captures.some(capture => capture.binding === from)), ...fn.captures.map((capture, index) => /** @type {const} */ ([capture.binding, locals[index]]))] }
        preface = fn.captures.map((capture, index) => `${keyword('const')} ${declared(inner, locals[index])}=${name(before, capture.binding)};`).join('')
    }
    const expressionBody = preface === '' && fn.body.statements.length === 0 && fn.body.exit[0] === 'return'
    const value = expressionBody ? expression(inner, /** @type {Extract<Block['exit'], readonly ['return', unknown, Value]>} */ (fn.body.exit)[2]) : ''
    const body = expressionBody && !value.startsWith('{') ? value : `{${preface}${blockText(inner, fn.body, 'return')}}`
    const lambda = fn.self !== null && context.runtime
        ? `(${keyword('function')} ${declared(inner, fn.self)}(${params}){${preface}${blockText(inner, fn.body, 'return')}})`
        : `(${params})=>${body}`
    if (!captured || fn.captures.length === 0) { return lambda }
    return `((${fn.captures.map(capture => declared(inner, capture.binding)).join(',')})=>(${lambda}))(${fn.captures.map(capture => expression(context, capture.value, 2)).join(',')})`
}

/** @type {(context: Context, statement: Statement) => string} */
const statementText = (context, statement) => {
    switch (statement[0]) {
        case 'define': { return `${keyword('const')} ${declared(context, statement[1])}=${expression({ ...context, binding: statement[1] }, statement[2])};` }
        case 'slot': { return `${keyword('let')} ${declared(context, statement[1])}=${expression(context, statement[2])};` }
        case 'write': { return `${name(context, statement[1])}=${expression(context, statement[2])};` }
        case 'memo': {
            const memo = statement[1]
            return `${keyword('const')} ${declared(context, memo.binding)}=(()=>{${keyword('let')} ${declared(context, memo.valueSlot)},${declared(context, memo.doneSlot)}=${primitive(false)};${keyword('return')}()=>{${keyword('if')}(!${name(context, memo.doneSlot)}){${name(context, memo.valueSlot)}=${blockExpression(context, memo.initializer)};${name(context, memo.doneSlot)}=${primitive(true)};}${keyword('return')} ${name(context, memo.valueSlot)};};})();`
        }
        case 'block': { return `{${blockText(context, statement[1], 'none')}}` }
        case 'if': { return `${keyword('if')}(${expression(context, statement[1])}){${blockText(context, statement[2], 'none')}}${keyword('else')}{${blockText(context, statement[3], 'none')}}` }
        case 'loop': { return `${context.runtime ? `L${context.loops.indexOf(statement[1])}:` : ''}${keyword('while')}(${primitive(true)}){${blockText(context, statement[2], 'none')}}` }
        case 'while': {
            const loop = statement[1]
            // a loop whose block writes its variable nowhere writes it back
            // unchanged: the language's loop is over the variable its block
            // assigns, and refuses a block assigning none
            // ([spec: loops](../../../spec/control-flow/loops/README.md))
            const unchanged = loop.mutable ? '' : `${name(context, loop.slot)}=${name(context, loop.slot)};`
            return `${keyword('let')} ${declared(context, loop.slot)}=${expression(context, loop.initial)};${keyword('while')}(${expression(context, loop.condition)}){${blockText(context, loop.body, 'none')}${unchanged}}`
        }
        default: { throw ['not a statement', statement] }
    }
}

/** @type {(context: Context, block: Block, normal: 'return' | 'export' | 'none') => string} */
const blockText = (outer, input, normal) => {
    const block = flatten(input)
    const context = { ...outer, aliases: [...outer.aliases, ...block.statements.flatMap(statement => statement[0] === 'while' ? [/** @type {const} */ ([statement[1].result, statement[1].slot])] : [])] }
    const before = block.statements.map(statement => statementText(context, statement)).join('')
    const exit = block.exit
    switch (exit[0]) {
        case 'yield': { return `${before}${normal === 'none' || exit[1].length === 0 ? '' : `${normal === 'return' ? keyword('return') : `${keyword('export')} ${keyword('default')}`} ${expression(context, exit[1][0])};`}` }
        case 'return': { return `${before}${keyword('return')} ${expression(context, exit[2])};` }
        case 'throw': { return `${before}${keyword('throw')} ${expression(context, exit[1])};` }
        case 'break': case 'continue': { return `${before}${keyword(exit[0])}${context.runtime ? ` L${context.loops.indexOf(exit[1])}` : ''};` }
        default: { throw ['not an exit', exit] }
    }
}

/**
 * Render one prepared region. The tagged result retains every token category;
 * untagging it is the exact plain-output spelling.
 *
 * @type {(block: Block, kind?: 'module' | 'factory' | 'expression', runtime?: boolean) => string}
 */
export const render = (block, kind = 'module', runtime = false) => {
    const context = contextFor(blockBindings(block), blockSyntax(block), runtime, false)
    const text = kind === 'expression' ? blockExpression(context, block)
        : kind === 'factory' ? `${keyword('export')} ${keyword('default')}()=>{${blockText(context, block, 'return')}};`
            : blockText(context, block, 'export')
    return resolve([text]).map(chunkText).join('')
}

/** The plain JavaScript spelling of {@link render}. @type {(block: Block, kind?: 'module' | 'factory' | 'expression', runtime?: boolean) => string} */
export const stringify = (block, kind = 'module', runtime = false) => untagged(render(block, kind, runtime))

/** A prepared module namespace becomes its original named exports. @type {(block: Block) => string} */
export const renderModule = block => {
    const context = contextFor(blockBindings(block), blockSyntax(block), false, false)
    const value = /** @type {Extract<Block['exit'], readonly ['yield', readonly Value[]]>} */ (block.exit)[1][0]
    const entries = /** @type {Extract<Operator<Value>, readonly ['object', unknown]>} */ (value)[1]
    const members = /** @type {readonly (readonly [':', string, Value])[]} */ (entries)
    const before = blockText(context, block, 'none')
    const exports = [...members.filter(([, key]) => key !== 'default'), ...members.filter(([, key]) => key === 'default')]
        .map(([, key, value]) => `${keyword('export')} ${key === 'default' ? keyword('default') : `${keyword('const')} ${key}=`}${key === 'default' ? ' ' : ''}${expression(context, value)};`).join('')
    return resolve([before, exports], members.map(([, key]) => key)).map(chunkText).join('')
}

/** Code-only text; captures are external names, in declared capture order. @type {(fn: PreparedFunction) => string} */
export const functionStringify = fn => {
    const context = contextFor(functionBindings(fn), valueSyntax(['function', fn]), true, true)
    const text = functionText(context, fn)
    const external = fn.captures.map(capture => name(context, capture.binding))
    return untagged(resolve([text], [], external).map(chunkText).join(''))
}
