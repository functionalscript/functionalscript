/**
 * Lift owning function returns at direct value-consumer boundaries. The shared
 * operand sequencer also exposes regions before threading lazy demands.
 * Lookup, optional skips and receiver binding stay explicit.
 *
 * @module
 * @import { BindingId, Block, Exit, Function as FastFunction, FunctionTarget, Item, Key, LoopTarget, Operator, Statement, Step, Value } from '../types.ts'
 * @import { List } from '../../../types/list/types.ts'
 * @import { Task } from '../task/types.ts'
 * @import { _ChainEnd, _ChainRegion, _ChainSource, _Context, _Expansion, _Region, _ResultMode, _Sequence, _Value } from './private.ts'
 */

import { isBinary, isUnary, lazyLayers } from '../../../compiler/ast/module.f.js'
import { isIntrinsic, isStatic } from '../../../edag/module.f.mjs'
import { isSpread, mapOperator, operatorOperands } from '../module.f.mjs'
import { toArray } from '../../../types/list/alt/module.f.mjs'
import { bind, call, done, run } from '../task/module.f.js'

/** @type {() => BindingId} */
const binding = () => ({ index: 0 })
/** @type {(id: BindingId) => Value} */
const ref = id => ['ref', id]

/** Source logical tags must first become FAST conditional regions. @type {(node: readonly unknown[]) => boolean} */
const eagerBinary = node => isBinary(node) && !lazyLayers.some(layer => Object.values(layer).some(tag => tag === node[0]))

/** Graph inputs allow only value-owned loops; physical callers may retain exact active targets. @type {(owner: FunctionTarget | null, permitted: readonly LoopTarget[]) => _Context} */
const operandContext = (owner, permitted) => ({ owner, operand: true, loops: permitted, permitted })

/** References and native leaves are bare callees; member lookup syntax must stay intact. @type {(source: Value, callee?: boolean) => _Value} */
const plain = (source, callee = !(source instanceof Array) || source[0] === 'ref' || source[0] === 'function'
    || source[0] === 'array' || source[0] === 'object' || isStatic(source) || isIntrinsic(source)
    || source[0] === 'entry' || source[0] === 'hasEntry') =>
    ({ statement: null, value: source, normal: true, callee })

/** A reached spread uses the ordinary array expansion kernel in either FAST stage. @type {<V>(value: V) => readonly ['array', readonly [readonly ['...', V]]]} */
export const _expandSpread = value => ['array', [['...', value]]]

/** Object spreads copy the ordinary own-property kernel in either FAST stage. @type {<V>(value: V) => readonly ['object', readonly [readonly ['...', V]]]} */
export const _expandObjectSpread = value => ['object', [['...', value]]]

/** Establish ordered operands and reached spread expansions before later control. @type {(input: readonly Value[], owner: FunctionTarget | null, plainCall: boolean, permitted: readonly LoopTarget[], spreads?: readonly _Expansion[]) => Task<_Sequence>} */
const sequenceTask = (input, owner, plainCall, permitted, spreads = []) => {
    /** @type {(statements: List<Statement>, values: List<Value>, normal: boolean, lifted: boolean, callee: boolean, admitted?: boolean) => Task<_Sequence>} */
    const finish = (statements, values, normal, lifted, callee, admitted = true) => done({
        statements: toArray(statements).toReversed(), values: toArray(values).toReversed(), normal, lifted, callee, admitted,
    })
    /** @type {(index: number, statements: List<Statement>, values: List<Value>, lifted: boolean, lastCallee: boolean) => Task<_Sequence>} */
    const each = (index, statements, values, lifted, lastCallee) => call(() => {
        if (index === input.length) { return finish(statements, values, true, lifted, lastCallee) }
        const id = binding()
        return bind(valueTask(input[index], id, owner, permitted), result => {
            if (plainCall && index === 0 && !result.callee) { return finish(null, null, true, false, false, false) }
            const statement = result.statement ?? /** @type {Statement} */ (['define', id, result.value, 'required'])
            const next = /** @type {List<Statement>} */ ({ first: statement, tail: statements })
            if (!result.normal) { return finish(next, values, false, true, true) }
            const kind = spreads[index]
            if (kind !== undefined) {
                const expanded = binding()
                const expansion = /** @type {Statement} */ (['define', expanded,
                    kind === 'object' ? _expandObjectSpread(ref(id)) : _expandSpread(ref(id)), 'required'])
                return each(index + 1, { first: expansion, tail: next }, { first: ref(expanded), tail: values },
                    lifted || result.statement !== null, result.callee)
            }
            return each(index + 1, next, { first: ref(id), tail: values }, lifted || result.statement !== null, result.callee)
        })
    })
    return each(0, null, null, false, false)
}

/** Snapshot eager operands in source order; object keys convert before their values. @type {(source: Operator<Value>, destination: BindingId, owner: FunctionTarget | null, permitted: readonly LoopTarget[], expose?: boolean) => Task<_Value>} */
const eagerTask = (source, destination, owner, permitted, expose = false) => {
    const input = source[0] === 'object' ? source[1].flatMap(entry => entry[0] === '...'
        ? [entry[1]] : [/** @type {Value} */ (['String', entry[1]]), entry[2]]) : operatorOperands(source)
    /** @type {readonly _Expansion[]} */
    const spreads = source[0] === 'object' ? source[1].flatMap(entry => entry[0] === '...'
        ? [/** @type {const} */ ('object')] : [undefined, undefined])
        : source[0] === 'array' ? source[1].map(itemExpansion)
            : source[0] === '()' ? [undefined, ...source[2].map(itemExpansion)] : []
    return bind(sequenceTask(input, owner, source[0] === '()', permitted, spreads), result => {
        if (!result.admitted) { return done(plain(source, false)) }
        const callee = source[0] !== ',' || result.callee
        if (!result.lifted && !expose) { return done(plain(source, callee)) }
        return done({
            statement: ['block', [destination], { statements: result.statements, exit: result.normal
                ? ['yield', [mapOperator((_, index) => result.values[index])(source)]] : ['yield', []] }],
            value: ref(destination), normal: result.normal, callee: !result.normal || callee,
        })
    })
}

/** Captures evaluate in the constructing scope; the nested body keeps its own owner. @type {(source: readonly ['function', FastFunction], destination: BindingId, owner: FunctionTarget | null, permitted: readonly LoopTarget[]) => Task<_Value>} */
const captureTask = (source, destination, owner, permitted) => {
    const fn = source[1]
    return bind(sequenceTask(fn.captures.map(capture => capture.value), owner, false, permitted), result => {
        if (!result.lifted) { return done(plain(source)) }
        return done({
            statement: ['block', [destination], { statements: result.statements, exit: result.normal
                ? ['yield', [['function', { ...fn, captures: fn.captures.map((capture, index) => ({ ...capture, value: result.values[index] })) }]]]
                : ['yield', []] }],
            value: ref(destination), normal: result.normal, callee: true,
        })
    })
}

/** @type {(item: Item<Value>) => _Expansion} */
const itemExpansion = item => isSpread(item) ? 'array' : undefined

/** Original item metadata survives snapshots of the expanded values. @type {(items: readonly Item<Value>[], values: readonly Value[]) => readonly Item<Value>[]} */
const mappedItems = (items, values) => items.map((item, index) => isSpread(item) ? ['...', values[index]] : values[index])

/** Find the one forced suffix without duplicating it beneath optional guards. @type {(source: _ChainSource) => _ChainEnd} */
const chainEnd = source => {
    let member = source[0] !== '?.()'
    /** @type {Key<Value> | null} */
    let key = source[0] === '?.()' ? null : source[2]
    /** @type {Step<Value> | undefined} */
    let step = source[3]
    while (step !== undefined) {
        if (step[0] === '|.') {
            member = true
            key = step[1]
        } else {
            if (step[0] === '|!()') { return { args: step[1], member, key } }
            member = false
            key = null
        }
        step = step[2]
    }
    return { args: null, member: false, key: null }
}

/** @type {(values: readonly Value[], callee?: boolean) => _ChainRegion} */
const chainYield = (values, callee = true) => ({ block: { statements: [], exit: ['yield', values] }, normal: true, lifted: false, callee })

/** Skipping an open region retains only the transport needed by its forced suffix. @type {(end: _ChainEnd) => _ChainRegion} */
const chainSkip = end => chainYield(end.args !== null && end.member ? [false, undefined, 0] : [undefined])

/** Prefix nesting is linear in chain length; no suffix statement array is copied. @type {(statements: readonly Statement[], next: _ChainRegion, lifted: boolean, end: _ChainEnd) => _ChainRegion} */
const chainPrefix = (statements, next, lifted, end) => {
    const ids = Array.from({ length: end.args !== null && end.member ? 3 : 1 }, binding)
    return {
        ...next, lifted: lifted || next.lifted,
        block: { statements: [...statements, ['block', ids, next.block]], exit: next.normal ? ['yield', ids.map(ref)] : ['yield', []] },
    }
}

/** Establish one original operand before the next chain operation. @type {(source: Value, owner: FunctionTarget | null, end: _ChainEnd, next: (value: Value) => Task<_ChainRegion>, permitted: readonly LoopTarget[]) => Task<_ChainRegion>} */
const chainOperand = (source, owner, end, next, permitted) => {
    const id = binding()
    return bind(valueTask(source, id, owner, permitted), result => {
        const statement = result.statement ?? /** @type {Statement} */ (['define', id, result.value, 'required'])
        if (!result.normal) { return done({ block: { statements: [statement], exit: ['yield', []] }, normal: false, lifted: true, callee: true }) }
        return bind(next(ref(id)), tail => done(chainPrefix([statement], tail, result.statement !== null, end)))
    })
}

/** A nullish receiver/callee test reads an already established value. @type {(value: Value) => Value} */
const present = value => ['?:', ['===', value, null], false, ['!==', value, undefined]]

/** Optional regions join before a forced suffix, retaining receiver and key separately. @type {(test: Value, reached: _ChainRegion, end: _ChainEnd) => _ChainRegion} */
const chainGuard = (test, reached, end) => {
    const ids = Array.from({ length: end.args !== null && end.member ? 3 : 1 }, binding)
    return {
        block: { statements: [['if', ids, test, reached.block, chainSkip(end).block]], exit: ['yield', ids.map(ref)] },
        normal: true, lifted: reached.lifted, callee: reached.callee,
    }
}

/** The value after a call no longer carries a receiver. @type {(value: Value, step: Step<Value> | undefined, owner: FunctionTarget | null, end: _ChainEnd, permitted: readonly LoopTarget[]) => Task<_ChainRegion>} */
const chainValue = (value, step, owner, end, permitted) => call(() => {
    if (step === undefined || step[0] === '|!()') { return done(chainYield([value])) }
    return step[0] === '|.' ? chainProperty(value, step[1], step[2], owner, end, permitted)
        : chainCall(value, step[1], step[2], step[0] === '|?.()', owner, end, permitted)
})

/** Original arguments and spread expansions stay in their selected region. @type {(args: readonly Item<Value>[], invoke: (args: readonly Item<Value>[]) => Value, step: Step<Value> | undefined, owner: FunctionTarget | null, end: _ChainEnd, permitted: readonly LoopTarget[]) => Task<_ChainRegion>} */
const chainArguments = (args, invoke, step, owner, end, permitted) =>
    bind(sequenceTask(args.map(item => isSpread(item) ? item[1] : item), owner, false, permitted, args.map(itemExpansion)), result => {
        if (!result.normal) { return done({ block: { statements: result.statements, exit: ['yield', []] }, normal: false, lifted: true, callee: true }) }
        const value = invoke(mappedItems(args, result.values))
        if (step === undefined) { return done({ block: { statements: result.statements, exit: ['yield', [value]] }, normal: true, lifted: result.lifted, callee: true }) }
        const id = binding()
        return bind(chainValue(ref(id), step, owner, end, permitted), tail => done(chainPrefix([
            ...result.statements, ['define', id, value, 'required'],
        ], tail, result.lifted, end)))
    })

/** Bare calls use callee nullishness; their arguments never acquire a receiver. @type {(value: Value, args: readonly Item<Value>[], step: Step<Value> | undefined, optional: boolean, owner: FunctionTarget | null, end: _ChainEnd, permitted: readonly LoopTarget[]) => Task<_ChainRegion>} */
const chainCall = (value, args, step, optional, owner, end, permitted) =>
    bind(chainArguments(args, args => ['()', value, args], step, owner, end, permitted), reached => done(optional ? chainGuard(present(value), reached, end) : reached))

/** A final property is a detached value; call continuations retain their receiver. @type {(receiver: Value, key: Key<Value>, step: Step<Value> | undefined, owner: FunctionTarget | null, end: _ChainEnd, permitted: readonly LoopTarget[]) => Task<_ChainRegion>} */
const chainMember = (receiver, key, step, owner, end, permitted) => call(() => {
    if (step === undefined) { return done(chainYield([['.', receiver, key]])) }
    if (step[0] === '|.') {
        const id = binding()
        return bind(chainProperty(ref(id), step[1], step[2], owner, end, permitted), tail => done(chainPrefix([
            ['define', id, ['.', receiver, key], 'required'],
        ], tail, false, end)))
    }
    const guard = binding()
    const query = /** @type {Statement} */ (['define', guard, ['memberPresent', receiver, key], 'required'])
    if (step[0] === '|!()') {
        return done(chainPrefix([query], chainYield([true, receiver, key instanceof Array ? key[1] : key]), false, end))
    }
    return bind(chainArguments(step[1], args => ['.', receiver, key, ['|()', args]], step[2], owner, end, permitted), reached =>
        done(chainPrefix([query], step[0] === '|?.()' ? chainGuard(ref(guard), reached, end) : reached, false, end)))
})

/** Numeric conversion is required before lookup and reused by query and call. @type {(receiver: Value, key: Key<Value>, step: Step<Value> | undefined, owner: FunctionTarget | null, end: _ChainEnd, permitted: readonly LoopTarget[]) => Task<_ChainRegion>} */
const chainProperty = (receiver, key, step, owner, end, permitted) => key instanceof Array
    ? chainOperand(['Number', key[1]], owner, end, number => chainMember(receiver, ['Number', number], step, owner, end, permitted), permitted)
    : chainMember(receiver, key, step, owner, end, permitted)

/** Replay the single forced suffix after the optional region has joined. @type {(_region: _ChainRegion, end: _ChainEnd, owner: FunctionTarget | null, permitted: readonly LoopTarget[]) => Task<_ChainRegion>} */
const forcedChain = (region, end, owner, permitted) => {
    if (end.args === null || !region.normal) { return done(region) }
    const ids = Array.from({ length: end.member ? 3 : 1 }, binding)
    const items = end.args
    return bind(sequenceTask(items.map(item => isSpread(item) ? item[1] : item), owner, false, permitted, items.map(itemExpansion)), /** @returns {Task<_ChainRegion>} */ args => {
        const prefix = /** @type {readonly Statement[]} */ ([['block', ids, region.block], ...args.statements])
        if (!args.normal) { return done({ block: { statements: prefix, exit: ['yield', []] }, normal: false, lifted: true, callee: true }) }
        const values = mappedItems(items, args.values)
        const plainCall = /** @type {Value} */ (['()', end.member ? undefined : ref(ids[0]), values])
        if (!end.member) { return done({ block: { statements: prefix, exit: ['yield', [plainCall]] }, normal: true, lifted: region.lifted || args.lifted, callee: true }) }
        const key = /** @type {Key<Value>} */ (end.key instanceof Array ? ['Number', ref(ids[2])] : end.key)
        const result = binding()
        return done({
            block: { statements: [...prefix, ['if', [result], ref(ids[0]),
                { statements: [], exit: ['yield', [['.', ref(ids[1]), key, ['|()', values]]]] },
                { statements: [], exit: ['yield', [plainCall]] },
            ]], exit: ['yield', [ref(result)]] },
            normal: true, lifted: region.lifted || args.lifted, callee: true,
        })
    })
}

/** Only a reached owning return or demand normalization publishes the chain's explicit regions. @type {(source: _ChainSource, destination: BindingId, owner: FunctionTarget | null, permitted: readonly LoopTarget[], expose?: boolean) => Task<_Value>} */
const chainTask = (source, destination, owner, permitted, expose = false) => {
    const end = chainEnd(source)
    return bind(chainOperand(source[1], owner, end, base => {
        const reached = source[0] === '?.()' ? chainCall(base, source[2], source[3], true, owner, end, permitted)
            : chainProperty(base, source[2], source[3], owner, end, permitted)
        return source[0] === '?.' ? bind(reached, result => done(chainGuard(present(base), result, end))) : reached
    }, permitted), region => bind(forcedChain(region, end, owner, permitted), result => done(result.lifted || expose ? {
        statement: ['block', [destination], result.block], value: ref(destination), normal: result.normal, callee: result.callee,
    } : plain(source, result.callee))))
}

/**
 * Eager operations, constructor checks, comma sequences, array/call items
 * and object entries sequence their value operands. Member chains preserve their
 * own lookup/skip regions. Captures sequence in their constructing scope;
 * nested function bodies and lazy initializers stay opaque.
 * @type {(source: Value, destination: BindingId, owner: FunctionTarget | null, permitted: readonly LoopTarget[]) => Task<_Value>}
 */
const valueTask = (source, destination, owner, permitted) => call(() => {
    if (!(source instanceof Array)) { return done(plain(source)) }
    if (source[0] === 'function') { return captureTask(source, destination, owner, permitted) }
    if (source[0] === '.' || source[0] === '?.' || source[0] === '?.()') { return chainTask(source, destination, owner, permitted) }
    if (source[0] === '()' && source[1] instanceof Array && source[1][0] === '.' && source[1].length === 3) {
        const member = source[1]
        return bind(chainTask(['.', member[1], member[2], ['|()', source[2]]], destination, owner, permitted), result =>
            done(result.statement === null ? plain(source, result.callee) : result))
    }
    if (source[0] === 'block') {
        return bind(blockTask(source[1], operandContext(owner, permitted), 'value'), result => done(result.returns
            ? { statement: ['block', [destination], result.block], value: ref(destination), normal: result.normal, callee: result.callee }
            : plain(source, result.callee)))
    }
    if (isUnary(source) || eagerBinary(source) || source[0] === 'instanceof' || source[0] === 'in' || source[0] === '+' && source.length === 2
        || source[0] === ',' && source[1].length !== 0
        || source[0] === 'object'
        || source[0] === '()' || source[0] === 'array') {
        return eagerTask(/** @type {Operator<Value>} */ (source), destination, owner, permitted)
    }
    if (source[0] !== 'if' && source[0] !== '?:') { return done(plain(source)) }
    const then = source[0] === 'if' ? source[2] : /** @type {Block} */ ({ statements: [], exit: ['yield', [source[2]]] })
    const otherwise = source[0] === 'if' ? source[3] : /** @type {Block} */ ({ statements: [], exit: ['yield', [source[3]]] })
    return bind(valueTask(source[1], binding(), owner, permitted), test => {
        if (!test.normal) { return done({
            statement: ['block', [destination], { statements: [/** @type {Statement} */ (test.statement)], exit: ['yield', []] }],
            value: ref(destination), normal: false, callee: true,
        }) }
        return bind(blockTask(then, operandContext(owner, permitted), 'value'), a =>
            bind(blockTask(otherwise, operandContext(owner, permitted), 'value'), b => {
                const callee = a.callee && b.callee
                if (test.statement === null && !a.returns && !b.returns) { return done(plain(source, callee)) }
                const result = test.statement === null ? destination : binding()
                const conditional = /** @type {Statement} */ (['if', [result], test.value, a.block, b.block])
                return done({
                    statement: test.statement === null ? conditional : ['block', [destination], {
                        statements: [test.statement, conditional], exit: ['yield', [ref(result)]],
                    }],
                    value: ref(destination), normal: a.normal || b.normal, callee,
                })
            }))
    })
})

/** @type {(source: Block, context: _Context, mode: _ResultMode) => Task<_Region>} */
const blockTask = (source, context, mode) => {
    /** @type {(statements: List<Statement>, exit: Exit, normal: boolean, returns: boolean, lifted: boolean, changed: boolean, callee?: boolean) => Task<_Region>} */
    const finish = (statements, exit, normal, returns, lifted, changed, callee = false) => done({
        block: changed ? { statements: toArray(statements).toReversed(), exit } : source, normal, returns, lifted, callee: !normal || callee,
    })
    /** @type {(index: number, statements: List<Statement>, returns: boolean, lifted: boolean, changed: boolean) => Task<_Region>} */
    const each = (index, statements, returns, lifted, changed) => call(() => {
        if (index === source.statements.length) {
            const exit = source.exit
            if (context.operand && (exit[0] === 'return' && exit[1] !== context.owner
                || (exit[0] === 'break' || exit[0] === 'continue') && !toArray(context.loops).includes(exit[1]))) {
                throw 'a value region may return only to its owning function or transfer within its own loops'
            }
            const ownReturn = context.owner !== null && exit[0] === 'return' && exit[1] === context.owner
            const permittedTransfer = (exit[0] === 'break' || exit[0] === 'continue') && context.permitted.includes(exit[1])
            /** @type {(mapped: Exit, next: List<Statement>, added: boolean, callee?: boolean) => Task<_Region>} */
            const complete = (mapped, next, added, callee = false) => {
                const normal = mapped[0] === 'yield'
                const packed = /** @type {Exit} */ (mode === 'value' && normal && mapped[1].length !== 1
                    ? ['yield', [['array', mapped[1]]]] : mapped)
                return finish(next, packed, normal, returns || ownReturn || permittedTransfer || added, lifted || added,
                    changed || packed !== source.exit || added, callee || normal && mapped[0] === 'yield' && mapped[1].length !== 1)
            }
            if (mode === 'statement' && exit[0] === 'yield' || exit[0] === 'break' || exit[0] === 'continue') {
                const values = exit[0] === 'yield' ? exit[1] : exit[2]
                return bind(sequenceTask(values, context.owner, false, context.permitted), result => {
                    if (!result.lifted) { return complete(exit, statements, false) }
                    const next = result.statements.reduce((tail, first) => /** @type {List<Statement>} */ ({ first, tail }), statements)
                    if (!result.normal) { return finish(next, ['yield', []], false, true, true, true) }
                    return complete(exit[0] === 'yield' ? ['yield', result.values] : [exit[0], exit[1], result.values], next, true, result.callee)
                })
            }
            if (ownReturn || context.operand && exit[0] === 'yield' && (exit[1].length === 1 || mode === 'value')) {
                const values = /** @type {Extract<Exit, readonly ['yield', ...unknown[]]>} */ (exit)[1]
                const value = ownReturn ? /** @type {Extract<Exit, readonly ['return', ...unknown[]]>} */ (exit)[2]
                    : values.length === 1 ? values[0] : /** @type {Value} */ (['array', values])
                return bind(valueTask(value, binding(), context.owner, context.permitted), result => {
                    if (result.statement === null) { return complete(exit, statements, false, result.callee) }
                    const next = /** @type {List<Statement>} */ ({ first: result.statement, tail: statements })
                    if (!result.normal) { return finish(next, ['yield', []], false, true, true, true) }
                    return complete(ownReturn ? ['return', /** @type {FunctionTarget} */ (context.owner), result.value] : ['yield', [result.value]], next, true, result.callee)
                })
            }
            return complete(exit, statements, false)
        }
        const statement = source.statements[index]
        /** @type {(mapped: Statement, normal: boolean, addedReturns: boolean, addedLifted: boolean, leading?: readonly Statement[]) => Task<_Region>} */
        const append = (mapped, normal, addedReturns, addedLifted, leading = []) => {
            const next = /** @type {List<Statement>} */ ({ first: mapped,
                tail: leading.reduce((tail, first) => /** @type {List<Statement>} */ ({ first, tail }), statements) })
            const different = changed || mapped !== statement || leading.length !== 0
            if (normal) { return each(index + 1, next, returns || addedReturns, lifted || addedLifted, different) }
            const pruned = index + 1 !== source.statements.length || source.exit[0] !== 'yield' || source.exit[1].length !== 0
            return finish(next, ['yield', []], false, returns || addedReturns, lifted || addedLifted, different || pruned)
        }
        if (statement[0] === 'define') {
            if (statement[3] === 'lazy') { return append(statement, true, false, false) }
            return bind(valueTask(statement[2], statement[1], context.owner, context.permitted), result => append(
                result.statement ?? statement, result.normal, result.statement !== null, result.statement !== null))
        }
        if (statement[0] === 'loop') {
            const loop = statement[1]
            return bind(sequenceTask(loop.initial, context.owner, false, context.permitted), initial => {
                if (!initial.normal) {
                    return finish(initial.statements.reduce((tail, first) => /** @type {List<Statement>} */ ({ first, tail }), statements),
                        ['yield', []], false, true, true, true)
                }
                return bind(blockTask(loop.body, { ...context, loops: { first: loop.target, tail: context.loops } }, 'none'), result => append(
                    !initial.lifted && result.block === loop.body ? statement
                        : ['loop', { ...loop, initial: initial.lifted ? initial.values : loop.initial, body: result.block }],
                    true, initial.lifted || result.returns, initial.lifted || result.lifted, initial.lifted ? initial.statements : []))
            })
        }
        if (statement[0] === 'block') {
            return bind(blockTask(statement[2], context, 'statement'), result => append(
                result.block === statement[2] ? statement : ['block', statement[1], result.block], result.normal, result.returns, result.lifted))
        }
        return bind(valueTask(statement[2], binding(), context.owner, context.permitted), test => {
            if (!test.normal) { return append(/** @type {Statement} */ (test.statement), false, true, true) }
            return bind(blockTask(statement[3], context, 'statement'), then =>
                bind(blockTask(statement[4], context, 'statement'), otherwise => append(
                    test.statement === null && then.block === statement[3] && otherwise.block === statement[4] ? statement
                        : ['if', statement[1], test.value, then.block, otherwise.block],
                    then.normal || otherwise.normal, then.returns || otherwise.returns || test.statement !== null,
                    then.lifted || otherwise.lifted || test.statement !== null, test.statement === null ? [] : [test.statement])))
        })
    })
    return each(0, null, false, false, false)
}

/**
 * Normalize required and loop-entry initializers, return/transfer payloads and statement results.
 * No owning return to expose means no change to the input block identity.
 * @type {(block: Block, owner: FunctionTarget) => Block}
 */
export const liftReturns = (block, owner) => {
    const result = run(blockTask(block, { owner, operand: false, loops: null, permitted: [] }, 'none'))
    return result.lifted ? result.block : block
}

/** The final normal result belongs directly to this function return. @type {(block: Block, owner: FunctionTarget) => Task<Block>} */
const returnedBlockTask = (block, owner) => forwardReturnTask(block.exit[0] === 'yield' && block.exit[1].length === 1
    ? { statements: block.statements, exit: ['return', owner, block.exit[1][0]] } : block, owner)

/**
 * Consume only an immediately returned, single result of a statement region.
 * Prefix statements and payload values keep their identities. Other regions,
 * values and ordinary nested functions retain their existing owners.
 * @type {(block: Block, owner: FunctionTarget) => Task<Block>}
 */
const forwardReturnTask = (block, owner) => call(() => {
    const exit = block.exit
    if (exit[0] !== 'return' || exit[1] !== owner || !(exit[2] instanceof Array) || exit[2][0] !== 'ref') { return done(block) }
    const last = block.statements.at(-1)
    if (last === undefined || last[0] !== 'block' && last[0] !== 'if' || last[1].length !== 1 || last[1][0] !== exit[2][1]) { return done(block) }
    /** @type {(statement: Statement) => Task<Block>} */
    const finish = statement => done({ statements: [...block.statements.slice(0, -1), statement], exit: ['yield', []] })
    return last[0] === 'block'
        ? bind(returnedBlockTask(last[2], owner), body => finish(['block', [], body]))
        : bind(returnedBlockTask(last[3], owner), then => bind(returnedBlockTask(last[4], owner), otherwise =>
            finish(['if', [], last[2], then, otherwise])))
})

/**
 * Forward a lifted region's sole result into an owning tail return without
 * constructing a selected-result phi and then selecting it again. Graph
 * construction uses this after return lifting; ordinary lifting keeps its
 * existing destination-based API. No continuation computation is copied.
 * @type {(block: Block, owner: FunctionTarget) => Block}
 */
export const _forwardReturns = (block, owner) => run(forwardReturnTask(block, owner))

/** Normalize one value with its exact function owner and any retained physical loop targets. @type {(value: Value, destination: BindingId, owner: FunctionTarget | null, permitted?: readonly LoopTarget[]) => { readonly statement: Statement | null, readonly value: Value, readonly normal: boolean, readonly callee: boolean }} */
export const liftValueReturns = (value, destination, owner, permitted = []) => run(valueTask(value, destination, owner, permitted))

/**
 * Make one operation's evaluation regions explicit before threading normal or
 * returning deferred demands. Nested operands retain their lifting boundary.
 * @type {(source: Operator<Value>, destination: BindingId, owner: FunctionTarget | null) => { readonly statement: Statement | null, readonly value: Value, readonly normal: boolean, readonly callee: boolean }}
 */
export const _exposeOperands = (source, destination, owner) => {
    if (source[0] === '.' || source[0] === '?.' || source[0] === '?.()') {
        return run(chainTask(source, destination, owner, [], true))
    }
    if (source[0] === '()' && source[1] instanceof Array && source[1][0] === '.' && source[1].length === 3) {
        const member = source[1]
        return run(chainTask(['.', member[1], member[2], ['|()', source[2]]], destination, owner, [], true))
    }
    return run(eagerTask(source, destination, owner, [], true))
}
