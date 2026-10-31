/**
 * Normalize shared lazy values and owning returns before helper lowering.
 * Private memo cells record readiness separately from their source payload.
 * Generated loops transport packets without changing a source loop's declared
 * input/result signature. Source functions and private initializer recipes
 * retain separate return owners; first-demand dispatch connects them.
 *
 * @module
 *
 * @import { BindingId, Block, Exit, Function as FastFunction, FunctionTarget, Loop, Operator, Statement, Value } from '../types.ts'
 * @import { List, Result as ListResult } from '../../../types/list/types.ts'
 * @import { MemoLayout } from './cells/types.ts'
 * @import { _Block, _Context, _Exit, _Loop, _Recipe, _Value, _Values } from './private.ts'
 * @import { Task } from '../task/types.ts'
 */

import { concat, next } from '../../../types/list/module.f.js'
import { toArray } from '../../../types/list/alt/module.f.js'
import { mapOperator, operatorOperands } from '../module.f.mjs'
import { exitValues, freeBindings } from '../control/module.f.mjs'
import { _hasReturn, memoCells, recipeCells } from './cells/module.f.mjs'
import { bind, call, done, run } from '../task/module.f.js'
import { _exposeOperands, liftReturns } from '../returns/module.f.mjs'
import { assert, assertNotNullish } from '../../../asserts/module.f.js'

/** @type {(index?: number) => BindingId} */
const binding = (index = 0) => ({ index })
/** @type {(id: BindingId) => Value} */
const ref = id => ['ref', id]
/** A source binder shadows only this region's active aliases. @type {(aliases: ReadonlyMap<BindingId, number>, bindings: readonly BindingId[]) => ReadonlyMap<BindingId, number>} */
const withoutAliases = (aliases, bindings) => new Map([...aliases].filter(([id]) => !bindings.includes(id)))

/** Replace one private cell, retaining every other lifetime's latest state. @type {(plan: MemoLayout, memo: BindingId, index: number, cell: Value) => Value} */
const withCell = (plan, memo, index, cell) => ['array', plan.cells.map((_, slot) => slot === index ? cell : ['.', ref(memo), slot])]
/** @type {(value: Value, context: _Context) => _Value} */
const plain = (value, context) => ({ statements: null, value, memo: context.memo, usesMemo: false })

/** A successful normal region returns its current memo vector to the caller. @type {(result: _Block) => Block} */
const memoResult = result => result.normal && result.block.exit[0] === 'yield'
    ? { ...result.block, exit: ['yield', [...result.block.exit[1], ref(result.memo)]] } : result.block

/** An operand's zero/many normal results are one array payload. @type {(result: _Block) => Block} */
const valueMemoResult = result => result.normal && result.block.exit[0] === 'yield'
    ? { ...result.block, exit: ['yield', [result.block.exit[1].length === 1 ? result.block.exit[1][0] : ['array', result.block.exit[1]], ref(result.memo)]] } : result.block

/** Establish eager operands before later demand prefixes. @type {(input: readonly Value[], context: _Context) => Task<_Values>} */
const valuesTask = (input, context) => {
    /** @type {(index: number, values: List<_Value>, memo: BindingId) => Task<_Values>} */
    const each = (index, values, memo) => call(() => {
        if (index !== input.length) {
            return bind(valueTask(input[index], { ...context, memo }), value => each(index + 1, { first: value, tail: values }, value.memo))
        }
        const parts = toArray(values).toReversed()
        const lifted = parts.some(part => part.statements !== null)
        /** @type {List<Statement>} */
        let statements = null
        /** @type {List<Value>} */
        let stable = null
        for (const part of parts) {
            statements = concat(statements)(part.statements)
            if (lifted) {
                const id = binding()
                statements = concat(statements)([['define', id, part.value, 'required']])
                stable = { first: ref(id), tail: stable }
            } else { stable = { first: part.value, tail: stable } }
        }
        return done({ statements, values: toArray(stable).toReversed(), memo, usesMemo: parts.some(part => part.usesMemo) })
    })
    return each(0, null, context.memo)
}

/**
 * Snapshot established prerequisites at the original lazy declaration. Fresh
 * getter-local cells extend only this invocation; the pair result trims them
 * while retaining updates to the parent layout.
 * @type {(index: number, context: _Context) => Task<FastFunction>}
 */
const recipeFunction = (index, context) => call(() => {
    const source = context.plan.cells[index]
    const initialized = binding(source.binding.index)
    /** @type {Value} */
    const initializer = context.completions ? ['block', liftReturns({
        statements: [['define', initialized, source.initializer, 'required']], exit: ['yield', [ref(initialized)]],
    }, assertNotNullish(context.sourceOwner))] : source.initializer
    const owned = recipeCells(initializer, context.plan, context.aliases, context.completions ? context.sourceOwner : null)
    const memo = binding(source.binding.index)
    const localMemo = owned.localCount === 0 ? memo : binding()
    const target = /** @type {const} */ ({ kind: 'function', index: source.binding.index })
    const width = context.plan.cells.length
    const locals = owned.layout.cells.slice(width)
    /** @type {readonly _Recipe[]} */
    const recipes = [...context.recipes, ...locals.map(cell => ({ binding: binding(cell.binding.index), width: owned.layout.cells.length }))]
    /** @type {readonly Statement[]} */
    const prefix = owned.localCount === 0 ? [] : [['define', localMemo, ['array', [
        ...context.plan.cells.map((_, slot) => /** @type {Value} */ (['.', ref(memo), slot])),
        ...locals.map(() => /** @type {Value} */ (['array', [false, undefined]])),
    ]], 'required']]
    /** @type {(statements: readonly Statement[], ready: BindingId) => Task<FastFunction>} */
    const finish = (statements, ready) => {
        const updated = withCell(context.plan, ready, index, ['array', [true, ref(initialized)]])
        const pair = /** @type {Value} */ (['array', [ref(initialized), updated]])
        const body = /** @type {Block} */ ({ statements: [...prefix, ...statements],
            exit: ['return', target, context.completions ? ['array', ['normal', pair]] : pair] })
        return done({ target, parameters: [memo], rest: null, self: null,
            captures: freeBindings(body, [memo]).map(id => ({ binding: id, value: ref(id) })), body })
    }
    /** @type {_Context} */
    const local = { ...context, plan: owned.layout, recipes, memo: localMemo, owners: null, operand: false,
        recipeOwner: context.completions ? target : null }
    if (context.completions) {
        assert(owned.value instanceof Array && owned.value[0] === 'block')
        return bind(blockTask(owned.value[1], local), recipe => finish(recipe.block.statements, recipe.memo))
    }
    return bind(valueTask(owned.value, local), recipe => finish(
        [...toArray(concat(recipe.statements)([['define', initialized, recipe.value, 'required']]))], recipe.memo))
})

/**
 * First demand invokes the declaration's recipe; hits reuse its payload.
 * A narrower getter receives only its prefix and cannot replace caller-local
 * state. Its returned prefix rejoins the caller's original suffix.
 * @type {(index: number, context: _Context) => _Value}
 */
const demand = (index, context) => {
    const value = binding()
    const memo = binding()
    const initialized = binding()
    const cell = /** @type {Value} */ (['.', ref(context.memo), index])
    const recipe = context.recipes[index]
    const completed = /** @type {Value} */ (context.completions ? ['.', ref(initialized), 1] : ref(initialized))
    const sameWidth = recipe.width === context.plan.cells.length
    const input = /** @type {Value} */ (sameWidth ? ref(context.memo)
        : ['array', context.plan.cells.slice(0, recipe.width).map((_, slot) => ['.', ref(context.memo), slot])])
    const updated = /** @type {Value} */ (sameWidth ? ['.', completed, 1]
        : ['array', context.plan.cells.map((_, slot) => ['.', slot < recipe.width ? ['.', completed, 1] : ref(context.memo), slot])])
    /** @type {readonly Statement[]} */
    const dispatch = context.completions ? [['if', [], ['===', ['.', ref(initialized), 0], 'return'],
        { statements: [], exit: ['return', assertNotNullish(context.recipeOwner ?? context.sourceOwner),
            context.recipeOwner === null ? ['.', ref(initialized), 1] : ref(initialized)] },
        { statements: [], exit: ['yield', []] },
    ]] : []
    return {
        statements: [['if', [value, memo], ['.', cell, 0],
            { statements: [], exit: ['yield', [['.', cell, 1], ref(context.memo)]] },
            { statements: [['define', initialized, ['()', ref(recipe.binding), [input]], 'required'], ...dispatch],
                exit: ['yield', [['.', completed, 0], updated]] },
        ]],
        value: ref(value), memo, usesMemo: true,
    }
}

/** @type {(operator: Operator<Value>) => boolean} */
const guarded = operator => operator[0] === '?.' || operator[0] === '?.()' || operator[0] === '.' && operator.length === 4
    || operator[0] === '()' && operator[1] instanceof Array && operator[1][0] === '.'
/** Objects sequence every entry; array and plain-call items need expansion. @type {(operator: Operator<Value>) => boolean} */
const itemSpreads = operator => operator[0] === 'array' ? operator[1].some(item => item instanceof Array && item[0] === '...')
    : operator[0] === '()' && operator[2].some(item => item instanceof Array && item[0] === '...')

/** Selected declaration/loop occurrences can be bound entirely inside an operand. @type {(source: Value, plan: MemoLayout) => boolean} */
const ownsMemo = (source, plan) => {
    /** @type {List<Value | Block>} */
    let pending = [source]
    while (true) {
        /** @type {ListResult<Value | Block>} */
        const item = next(pending)
        if (item === null) { return false }
        pending = item.tail
        const value = item.first
        if (value === null || typeof value !== 'object') { continue }
        if (!(value instanceof Array)) {
            if (value.statements.some(statement => statement[0] === 'define' && plan.definitions.has(statement)
                || statement[0] === 'loop' && plan.loops.has(statement[1]))) { return true }
            /** @type {readonly (Value | Block)[]} */
            const children = [...value.statements.flatMap(statement => statement[0] === 'define'
                ? statement[3] === 'required' ? [statement[2]] : []
                : statement[0] === 'loop' ? [...statement[1].initial, statement[1].body]
                    : statement[0] === 'block' ? [statement[2]] : [statement[2], statement[3], statement[4]]), ...exitValues(value.exit)]
            pending = concat(children)(pending)
            continue
        }
        /** @type {readonly (Value | Block)[]} */
        const children = value[0] === 'function' ? value[1].captures.map(capture => capture.value)
            : value[0] === 'block' ? [value[1]] : value[0] === 'if' ? [value[1], value[2], value[3]]
                : value[0] === 'ref' ? [] : operatorOperands(value)
        pending = concat(children)(pending)
    }
}

/** @type {(test: _Value, then: _Block, otherwise: _Block, source: Value) => _Value} */
const conditionalValue = (test, then, otherwise, source) => {
    const usesMemo = test.usesMemo || then.usesMemo || otherwise.usesMemo
    if (then.normal && then.memo !== test.memo || otherwise.normal && otherwise.memo !== test.memo) {
        const value = binding()
        const memo = binding()
        return { statements: concat(test.statements)([['if', [value, memo], test.value, valueMemoResult(then), valueMemoResult(otherwise)]]), value: ref(value), memo, usesMemo }
    }
    return { statements: test.statements, value: source, memo: test.memo, usesMemo }
}

/** Normalize demands inside values while preserving conditional evaluation. @type {(source: Value, context: _Context) => Task<_Value>} */
const valueTask = (source, context) => call(() => {
    if (source === null || typeof source !== 'object') { return done(plain(source, context)) }
    if (source[0] === 'ref') {
        const index = context.aliases.get(source[1])
        return done(index === undefined ? plain(source, context) : demand(index, context))
    }
    if (source[0] === 'function') {
        return bind(valuesTask(source[1].captures.map(capture => capture.value), context), values => {
            if (values.values.every((value, i) => value === source[1].captures[i].value)) { return done({ ...plain(source, context), memo: values.memo, statements: values.statements, usesMemo: values.usesMemo }) }
            const fn = /** @type {FastFunction} */ ({ ...source[1], captures: source[1].captures.map((capture, i) => ({ binding: capture.binding, value: values.values[i] })) })
            return done({ statements: values.statements, value: ['function', fn], memo: values.memo, usesMemo: values.usesMemo })
        })
    }
    if (source[0] === 'block') {
        return bind(blockTask(source[1], { ...context, operand: true, owners: null }), result => {
            if (result.normal && result.memo !== context.memo) {
                const value = binding()
                const memo = binding()
                return done(/** @type {_Value} */ ({ statements: [['block', [value, memo], valueMemoResult(result)]], value: ref(value), memo, usesMemo: result.usesMemo }))
            }
            return done(/** @type {_Value} */ ({ statements: null, value: result.block === source[1] ? source : ['block', result.block], memo: context.memo, usesMemo: result.usesMemo }))
        })
    }
    if (source[0] === 'if' || source[0] === '?:') {
        const then = source[0] === 'if' ? source[2] : /** @type {Block} */ ({ statements: [], exit: ['yield', [source[2]]] })
        const otherwise = source[0] === 'if' ? source[3] : /** @type {Block} */ ({ statements: [], exit: ['yield', [source[3]]] })
        return bind(valueTask(source[1], context), test =>
            bind(blockTask(then, { ...context, memo: test.memo, operand: true, owners: null }), a =>
                bind(blockTask(otherwise, { ...context, memo: test.memo, operand: true, owners: null }), b => {
                    const original = test.value === source[1] && a.block === then && b.block === otherwise ? source : /** @type {Value} */ (['if', test.value, a.block, b.block])
                    return done(conditionalValue(test, a, b, original))
                })))
    }
    if ((guarded(source) || source[0] === 'object' || itemSpreads(source))
        && (freeBindings({ statements: [], exit: ['yield', [source]] }).some(id => context.aliases.has(id)) || ownsMemo(source, context.plan))) {
        const value = _exposeOperands(source, binding(), context.sourceOwner)
        if (value.statement === null) { throw 'deferred completion requires an admitted operand region' }
        return valueTask(['block', { statements: [value.statement], exit: ['yield', [value.value]] }], context)
    }
    const operands = operatorOperands(source)
    return bind(valuesTask(operands, context), values => {
        const unchanged = values.values.every((value, i) => value === operands[i])
        return done({ statements: values.statements, value: unchanged ? source : mapOperator((_, index) => values.values[index])(source), memo: values.memo, usesMemo: values.usesMemo })
    })
})

/** @type {(exit: Exit, context: _Context) => Task<_Exit>} */
const exitTask = (exit, context) => call(() => {
    if (context.operand && exit[0] !== 'yield' && exit[0] !== 'throw') { throw 'memo demands cannot transport nonlocal operand completions yet' }
    const inputs = exitValues(exit)
    return bind(valuesTask(inputs, context), values => {
        /** @type {Exit} */
        let mapped = values.values.every((value, i) => value === inputs[i]) ? exit
            : exit[0] === 'yield' ? ['yield', values.values]
                : exit[0] === 'break' || exit[0] === 'continue' ? [exit[0], exit[1], values.values]
                    : exit[0] === 'throw' ? ['throw', values.values[0]] : ['return', exit[1], values.values[0]]
        if (context.completions && context.recipeOwner !== null && exit[0] === 'return') {
            mapped = ['return', context.recipeOwner, ['array', ['return', values.values[0]]]]
        } else if (exit[0] === 'break' || exit[0] === 'continue') {
            const owner = toArray(context.owners).find(owner => owner.source === exit[1])
            if (owner !== undefined) { mapped = [exit[0], owner.target, [['array', values.values], ref(values.memo)]] }
        }
        return done({ statements: values.statements, exit: mapped, memo: values.memo, normal: exit[0] === 'yield', usesMemo: values.usesMemo })
    })
})

/** Replace one source loop by a private user-state/memo transport loop. @type {(loop: Loop, context: _Context) => Task<_Loop>} */
const loopTask = (loop, context) => call(() => {
    if (!context.plan.loops.has(loop)) {
        return bind(valuesTask(loop.initial, context), initial => {
            /** @type {(body: Block) => Task<_Loop>} */
            const finish = body => done({
                statements: concat(initial.statements)([['loop', body === loop.body && initial.values.every((value, i) => value === loop.initial[i])
                    ? loop : { ...loop, initial: initial.values, body }]]),
                memo: initial.memo, usesMemo: initial.usesMemo, changed: body !== loop.body || initial.usesMemo,
            })
            return context.completions && context.recipeOwner !== null
                ? bind(blockTask(loop.body, { ...context, aliases: withoutAliases(context.aliases, loop.parameters), memo: initial.memo, operand: false }), body => finish(body.block))
                : finish(loop.body)
        })
    }
    const state = binding(loop.target.index)
    const memo = binding(loop.target.index)
    const result = binding(loop.target.index)
    const outputMemo = binding(loop.target.index)
    const target = /** @type {const} */ ({ kind: 'loop', index: loop.target.index })
    return bind(valuesTask(loop.initial, context), initial =>
        bind(blockTask(loop.body, { ...context, aliases: withoutAliases(context.aliases, loop.parameters), memo, owners: { first: { source: loop.target, target }, tail: context.owners }, operand: false }), body => {
            const internal = /** @type {Loop} */ ({
                target, parameters: [state, memo], initial: [['array', initial.values], ref(initial.memo)], results: [result, outputMemo],
                body: { statements: [
                    ...loop.parameters.map((id, i) => /** @type {Statement} */ (['define', id, ['.', ref(state), i], 'required'])),
                    ...body.block.statements,
                ], exit: body.block.exit },
            })
            return done({ statements: concat(initial.statements)([
                ['loop', internal],
                ...loop.results.map((id, i) => /** @type {Statement} */ (['define', id, ['.', ref(result), i], 'required'])),
            ]), memo: outputMemo, usesMemo: true, changed: true })
        }))
})

/** Thread normal-path memo bindings through source statement regions. @type {(block: Block, context: _Context) => Task<_Block>} */
const blockTask = (block, context) => {
    /** @type {(index: number, statements: List<Statement>, memo: BindingId, aliases: ReadonlyMap<BindingId, number>, changed: boolean, usesMemo: boolean) => Task<_Block>} */
    const each = (index, statements, memo, aliases, changed, usesMemo) => call(() => {
        const current = /** @type {_Context} */ ({ ...context, memo, aliases })
        /** @type {(pieces: List<Statement>, nextMemo: BindingId, different: boolean, used: boolean, normal?: boolean, nextAliases?: ReadonlyMap<BindingId, number>) => Task<_Block>} */
        const resume = (pieces, nextMemo, different, used, normal = true, nextAliases = aliases) => {
            const next = concat(statements)(pieces)
            return normal ? each(index + 1, next, nextMemo, nextAliases, changed || different, usesMemo || used)
                : done({ block: { statements: toArray(next), exit: block.exit }, memo: nextMemo, normal: false, usesMemo: usesMemo || used })
        }
        if (index === block.statements.length) {
            return bind(exitTask(block.exit, current), exit => done({
                block: changed || exit.exit !== block.exit || exit.statements !== null ? { statements: toArray(concat(statements)(exit.statements)), exit: exit.exit } : block,
                memo: exit.memo, normal: exit.normal, usesMemo: usesMemo || exit.usesMemo,
            }))
        }
        const statement = block.statements[index]
        if (statement[0] === 'define') {
            const shadowed = withoutAliases(aliases, [statement[1]])
            if (statement[3] === 'lazy') {
                const selected = context.plan.definitions.get(statement)
                if (selected !== undefined) {
                    const active = new Map([...shadowed, [statement[1], selected]])
                    if (context.plan.cells[selected].definition === statement) {
                        const local = context.plan.cells[selected].iterationLocal
                        const nextMemo = local ? binding() : memo
                        /** @type {readonly Statement[]} */
                        const reset = local ? [['define', nextMemo, withCell(context.plan, memo, selected, ['array', [false, undefined]]), 'required']] : []
                        return bind(recipeFunction(selected, current), fn => resume(
                            [...reset, ['define', context.recipes[selected].binding, ['function', fn], 'required']], nextMemo, true, local, true, active))
                    }
                    return resume(null, memo, true, false, true, active)
                }
                const initializer = statement[2]
                const root = initializer instanceof Array && initializer[0] === 'ref' ? aliases.get(initializer[1]) : undefined
                if (root !== undefined) { return resume(null, memo, true, false, true, new Map([...shadowed, [statement[1], root]])) }
                return resume([statement], memo, false, false, true, shadowed)
            }
            return bind(valueTask(statement[2], current), value => resume(concat(value.statements)([
                value.value === statement[2] ? statement : ['define', statement[1], value.value, statement[3]],
            ]), value.memo, value.value !== statement[2] || value.statements !== null, value.usesMemo, true, shadowed))
        }
        if (statement[0] === 'loop') {
            return bind(loopTask(statement[1], current), loop => resume(loop.statements, loop.memo,
                loop.changed, loop.usesMemo, true, withoutAliases(aliases, statement[1].results)))
        }
        if (statement[0] === 'block') {
            return bind(blockTask(statement[2], current), result => {
                if (result.normal && result.memo !== memo) {
                    const nextMemo = binding()
                    return resume([['block', [...statement[1], nextMemo], memoResult(result)]], nextMemo, true, result.usesMemo,
                        true, withoutAliases(aliases, statement[1]))
                }
                return resume([result.block === statement[2] ? statement : ['block', statement[1], result.block]], memo,
                    result.block !== statement[2], result.usesMemo, result.normal, withoutAliases(aliases, statement[1]))
            })
        }
        return bind(valueTask(statement[2], current), test =>
            bind(blockTask(statement[3], { ...current, memo: test.memo }), then =>
                bind(blockTask(statement[4], { ...current, memo: test.memo }), otherwise => {
                    const threaded = then.normal && then.memo !== test.memo || otherwise.normal && otherwise.memo !== test.memo
                    const nextMemo = threaded ? binding() : test.memo
                    const mapped = /** @type {Statement} */ (threaded
                        ? ['if', [...statement[1], nextMemo], test.value, memoResult(then), memoResult(otherwise)]
                        : test.value === statement[2] && then.block === statement[3] && otherwise.block === statement[4] ? statement
                            : ['if', statement[1], test.value, then.block, otherwise.block])
                    return resume(concat(test.statements)([mapped]), nextMemo, mapped !== statement || test.statements !== null,
                        test.usesMemo || then.usesMemo || otherwise.usesMemo, then.normal || otherwise.normal, withoutAliases(aliases, statement[1]))
                })))
    })
    return each(0, null, context.memo, context.aliases, false, false)
}

/**
 * Normalize local lazy values crossing a helper or returning at first demand.
 * The original block identity is returned when no such cells exist. Generated
 * required cells make repeated normalization a no-op. External lazy bindings
 * have no available recipe and remain explicit admission boundaries. Only a
 * source function supplies the owner for returns across statement helpers.
 * @type {(root: Block, externalLazyIds: readonly BindingId[], functionTarget: FunctionTarget | null, returnsOnly: boolean) => Block}
 */
const normalize = (root, externalLazyIds, functionTarget, returnsOnly) => {
    const plan = memoCells(root, externalLazyIds, functionTarget, returnsOnly)
    if (plan === null) { return root }
    const memo = binding()
    const recipes = plan.cells.map(cell => ({ binding: binding(cell.binding.index), width: plan.cells.length }))
    const completions = functionTarget !== null && plan.cells.some(cell => _hasReturn(cell.initializer, functionTarget))
    const context = /** @type {_Context} */ ({ plan, aliases: new Map(), recipes, memo, owners: null, operand: false,
        sourceOwner: functionTarget, recipeOwner: null, completions })
    const result = run(blockTask(plan.block, context))
    const initializer = /** @type {Value} */ (['array', plan.cells.map(() => ['array', [false, undefined]])])
    return { statements: [['define', memo, initializer, 'required'], ...result.block.statements], exit: result.block.exit }
}

/** @type {(root: Block, externalLazyIds?: readonly BindingId[], functionTarget?: FunctionTarget | null) => Block} */
export const normalizeMemo = (root, externalLazyIds = [], functionTarget = null) => normalize(root, externalLazyIds, functionTarget, false)

/** Preserve existing physical memo programs while sharing deferred return transport. @type {(root: Block, functionTarget: FunctionTarget) => Block} */
export const normalizeLazyReturns = (root, functionTarget) => memoCells(root, [], functionTarget, true) === null
    ? root : normalize(liftReturns(root, functionTarget), [], functionTarget, true)
