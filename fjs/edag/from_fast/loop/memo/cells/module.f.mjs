/**
 * Select lazy recipes before graph construction loses their
 * lexical definitions. Values keep their own loop-normalization boundary;
 * ordinary function bodies remain opaque. Deferred prerequisites and computed
 * dependents share the same vector, in definition order; lazy
 * reference aliases share their root's cell.
 *
 * @module
 *
 * @import { BindingId, Block, Definition, Exit, FunctionTarget, Loop, LoopTarget, Statement, Value } from '../../../../../js/ast/types.ts'
 * @import { List } from '../../../../../types/list/types.ts'
 * @import { Link } from '../../../private.ts'
 * @import { Task } from '../../../../../js/ast/task/types.ts'
 * @import { MemoLayout, MemoPlan, RecipePlan } from './types.ts'
 * @import { _LoopInfo, _Occurrence, _Owned, _OwnedBlock, _OwnedValue, _OwnedValues, _Root, _Scope, _Transfer, _Visit } from './private.ts'
 */

import { exitValues, freeBindings, freeLoopBindings } from '../../../control/module.f.mjs'
import { concat, toArray } from '../../../../../types/list/module.f.mjs'
import { mapOperator, operatorOperands } from '../../../../../js/ast/module.f.mjs'
import { bind, call, done, run } from '../../../../../js/ast/task/module.f.mjs'

/**
 * A shared syntax container still has one declaration per reached occurrence.
 * Give statement regions distinct planning identities without changing values,
 * binding/target identities or source signatures. Terminal statement regions
 * end the active prefix; their following statements and exit are unreachable.
 * Operand regions and function bodies retain their own normalization boundary.
 * @type {(block: Block) => Task<_Occurrence>}
 */
const occurrenceBlock = block => {
    /** @type {(index: number, statements: List<Statement>) => Task<_Occurrence>} */
    const each = (index, statements) => call(() => {
        if (index === block.statements.length) {
            return done({ block: { statements: toArray(statements).toReversed(), exit: block.exit }, normal: block.exit[0] === 'yield' })
        }
        const statement = block.statements[index]
        /** @type {(mapped: Statement, normal?: boolean) => Task<_Occurrence>} */
        const append = (mapped, normal = true) => {
            const next = /** @type {List<Statement>} */ ({ first: mapped, tail: statements })
            return normal ? each(index + 1, next)
                : done({ block: { statements: toArray(next).toReversed(), exit: ['yield', []] }, normal: false })
        }
        if (statement[0] === 'define') { return append(['define', statement[1], statement[2], statement[3]]) }
        if (statement[0] === 'loop') {
            return bind(occurrenceBlock(statement[1].body), body => append(['loop', { ...statement[1], body: body.block }]))
        }
        if (statement[0] === 'block') {
            return bind(occurrenceBlock(statement[2]), body => append(['block', statement[1], body.block], body.normal))
        }
        return bind(occurrenceBlock(statement[3]), then => bind(occurrenceBlock(statement[4]), otherwise =>
            append(['if', statement[1], statement[2], then.block, otherwise.block], then.normal || otherwise.normal)))
    })
    return each(0, null)
}

/** Established values shadow any enclosing deferred entry. @type {(scope: _Scope, bindings: readonly BindingId[]) => _Scope} */
const established = (scope, bindings) => new Map([...scope, ...bindings.map(binding => /** @type {const} */ ([binding, null]))])

/** @type {(value: Value, scope: _Scope) => readonly _Root[]} */
const dependencies = (value, scope) => freeBindings({ statements: [], exit: ['yield', [value]] })
    .flatMap(binding => {
        const root = scope.get(binding)
        return root === undefined || root === null ? [] : [root]
    }).filter((root, i, roots) => roots.indexOf(root) === i)

/**
 * Keep recipes on both sides of a selected dependency in the same vector.
 * Prerequisites preserve shared first demand; dependents cannot retain reads
 * of definitions replaced by cells. Filtering the lexical inventory keeps
 * slots stable regardless of which root first crosses a helper.
 * @type {(roots: readonly _Root[], crossing: readonly _Root[]) => readonly _Root[]}
 */
const dependencyClosure = (roots, crossing) => {
    let selected = crossing
    while (true) {
        const selectedRoots = new Set(selected)
        const prerequisites = new Set(selected.flatMap(cell => cell.dependencies))
        const expanded = roots.filter(root => selectedRoots.has(root) || prerequisites.has(root)
            || root.dependencies.some(dependency => selectedRoots.has(dependency)))
        if (expanded.length === selected.length) { return selected }
        selected = expanded
    }
}

/**
 * Collect transfers owned by this loop's statement regions. Nested loops have
 * their own inventory rows; operands and ordinary functions retain their owner.
 * @type {(loop: Loop) => readonly _Transfer[]}
 */
const loopTransfers = loop => {
    /** @type {Link<Block> | null} */
    let pending = { first: loop.body, tail: null }
    /** @type {List<_Transfer>} */
    let transfers = null
    while (pending !== null) {
        const { first: block, tail } = /** @type {Link<Block>} */ (pending)
        const exit = block.exit
        if (exit[0] === 'return' || exit[0] === 'break' || exit[0] === 'continue') { transfers = { first: exit, tail: transfers } }
        const children = block.statements.flatMap(statement => statement[0] === 'block' ? [statement[2]]
            : statement[0] === 'if' ? [statement[3], statement[4]] : [])
        pending = children.reduceRight((tail, first) => ({ first, tail }), tail)
    }
    return toArray(transfers).toReversed()
}

/** Nearest lexical ownership distinguishes shared syntax from sibling targets. @type {(info: _LoopInfo, target: LoopTarget) => Loop | null} */
const transferLoop = (info, target) => {
    if (info.loop.target === target) { return info.loop }
    let ancestors = info.ancestors
    while (ancestors !== null) {
        if (ancestors.first.target === target) { return ancestors.first }
        ancestors = ancestors.tail
    }
    return null
}

/**
 * A control-only helper escaping a selected ancestor must carry the same
 * vector. Selecting its intermediates can expose further such targets, so
 * close that selection before restoring the inventory's lexical order.
 * @type {(inventory: readonly _LoopInfo[], crossing: readonly _LoopInfo[]) => ReadonlySet<Loop>}
 */
const selectedLoops = (inventory, crossing) => {
    /** @type {ReadonlySet<Loop>} */
    let selected = new Set(crossing.flatMap(info => [...toArray(info.ancestors), info.loop]))
    while (true) {
        const added = inventory.filter(info => !selected.has(info.loop) && info.transfers.some(exit => {
            if (exit[0] === 'return') { return false }
            const target = transferLoop(info, exit[1])
            return target !== null && selected.has(target)
        }))
        if (added.length === 0) { return new Set(inventory.filter(info => selected.has(info.loop)).map(info => info.loop)) }
        selected = new Set([...selected, ...added.flatMap(info => [...toArray(info.ancestors), info.loop])])
    }
}

/** Validate only regions reached through memo helpers; raw outer exits stay raw. @type {(inventory: readonly _LoopInfo[], selected: ReadonlySet<Loop>, functionTarget: FunctionTarget | null) => void} */
const validateTransfers = (inventory, selected, functionTarget) => {
    for (const info of inventory) {
        if (!selected.has(info.loop) && !toArray(info.ancestors).some(loop => selected.has(loop))) { continue }
        for (const exit of info.transfers) {
            if (exit[0] === 'return' ? exit[1] !== functionTarget : transferLoop(info, exit[1]) === null) {
                throw 'memo helper transfer must name its lexical owner'
            }
        }
    }
}

/**
 * Plan only definitions whose deferred identity crosses a statement helper.
 * Primitives and reads of established values retain the existing no-memo
 * classification. External lazy entries retain unavailable provenance through
 * aliases and recipes. Declaration rows keep lexical shadows distinct from
 * earlier reads; selected external entries cannot become eager captures.
 * Unsupported lifetimes are refused before any recipe moves.
 * @type {(block: Block, externalLazyIds?: readonly BindingId[], functionTarget?: FunctionTarget | null) => MemoPlan | null}
 */
export const memoCells = (block, externalLazyIds = [], functionTarget = null) => {
    const prepared = run(occurrenceBlock(block)).block
    /** @type {readonly _Root[]} */
    const external = externalLazyIds.map(binding => ({ binding, source: null, dependencies: [] }))
    /** @type {Link<_Visit> | null} */
    let pending = { first: { block: prepared, index: 0, scope: new Map(external.map(root => [root.binding, root])), ancestors: null }, tail: null }
    /** @type {readonly _Root[]} */
    let roots = external
    /** @type {readonly (readonly [Definition, _Root])[]} */
    let definitions = []
    /** @type {readonly _LoopInfo[]} */
    let inventory = []
    while (pending !== null) {
        const { first: visit, tail } = /** @type {Link<_Visit>} */ (pending)
        const { block, index, scope, ancestors } = visit
        pending = tail
        if (index === block.statements.length) { continue }
        const statement = block.statements[index]
        /** @type {_Visit} */
        const next = { block, index: index + 1, scope, ancestors }
        if (statement[0] === 'define') {
            const [, binding, initializer, mode] = statement
            /** @type {_Root | null} */
            let root = null
            if (mode === 'lazy' && initializer !== null && typeof initializer === 'object') {
                if (initializer[0] === 'ref') { root = scope.get(initializer[1]) ?? null }
                else {
                    root = { binding, source: { definition: statement, insideLoop: ancestors !== null }, dependencies: dependencies(initializer, scope) }
                    roots = [...roots, root]
                }
            }
            if (root !== null) {
                definitions = [...definitions, [statement, root]]
            }
            pending = { first: { ...next, scope: new Map([...scope, [binding, root]]) }, tail }
            continue
        }
        if (statement[0] === 'loop') {
            const loop = statement[1]
            const free = freeLoopBindings(loop).flatMap(binding => {
                const root = scope.get(binding)
                return root === undefined || root === null ? [] : [root]
            })
            inventory = [...inventory, { loop, roots: free, ancestors, transfers: loopTransfers(loop) }]
            pending = {
                first: { block: loop.body, index: 0, scope: established(scope, loop.parameters), ancestors: { first: loop, tail: ancestors } },
                tail: { first: { ...next, scope: established(scope, loop.results) }, tail },
            }
            continue
        }
        const children = statement[0] === 'block' ? [statement[2]] : [statement[3], statement[4]]
        /** @type {Link<_Visit>} */
        const rest = { first: { ...next, scope: established(scope, statement[1]) }, tail }
        pending = children.reduceRight((tail, block) => ({ first: { block, index: 0, scope, ancestors }, tail }), /** @type {Link<_Visit> | null} */ (rest))
    }
    const crossing = inventory.filter(info => info.roots.length !== 0)
    if (crossing.length === 0) { return null }
    const cells = dependencyClosure(roots, roots.filter(root => crossing.some(info => info.roots.includes(root))))
    const recipes = cells.map(({ binding, source }) => {
        if (source === null) { throw 'external lazy memo prerequisites require an owned initializer recipe' }
        return { binding, initializer: source.definition[2], definition: source.definition, iterationLocal: source.insideLoop }
    })
    const loops = selectedLoops(inventory, crossing)
    validateTransfers(inventory, loops, functionTarget)
    return {
        block: prepared,
        cells: recipes,
        definitions: new Map(definitions.flatMap(([definition, root]) => {
            const index = cells.indexOf(root)
            return index === -1 ? [] : [/** @type {const} */ ([definition, index])]
        })),
        loops,
    }
}

const emptyOwned = /** @type {_Owned} */ ({ roots: null, definitions: null, pruned: false })

/** Retain source order across eager subregions. @type {(first: _Owned, second: _Owned) => _Owned} */
const mergeOwned = (first, second) => ({
    roots: concat(first.roots)(second.roots),
    definitions: concat(first.definitions)(second.definitions),
    pruned: first.pruned || second.pruned,
})

/** @type {(exit: Exit, values: readonly Value[]) => Exit} */
const mappedExit = (exit, values) => values.every((value, index) => value === exitValues(exit)[index]) ? exit
    : exit[0] === 'yield' ? ['yield', values]
        : exit[0] === 'break' || exit[0] === 'continue' ? [exit[0], exit[1], values]
            : exit[0] === 'throw' ? ['throw', values[0]] : ['return', exit[1], values[0]]

/** @type {(values: readonly Value[], scope: _Scope) => Task<_OwnedValues>} */
const ownedValues = (values, scope) => {
    /** @type {(index: number, prepared: List<Value>, owned: _Owned) => Task<_OwnedValues>} */
    const each = (index, prepared, owned) => call(() => index === values.length
        ? done({ values: toArray(prepared).toReversed(), owned })
        : bind(ownedValue(values[index], scope), result => each(index + 1, { first: result.value, tail: prepared }, mergeOwned(owned, result.owned))))
    return each(0, null, emptyOwned)
}

/**
 * Prepare the current initializer's eager regions. A lazy definition owns a
 * later recipe, and loop/function bodies own separate execution boundaries.
 * @type {(source: Value, scope: _Scope) => Task<_OwnedValue>}
 */
const ownedValue = (source, scope) => call(() => {
    if (source === null || typeof source !== 'object' || source[0] === 'ref') { return done(/** @type {_OwnedValue} */ ({ value: source, owned: emptyOwned })) }
    if (source[0] === 'block') {
        return bind(ownedBlock(source[1], scope), result => done({ value: ['block', result.block], owned: result.owned }))
    }
    if (source[0] === 'if') {
        return bind(ownedValue(source[1], scope), test =>
            bind(ownedBlock(source[2], scope), then =>
                bind(ownedBlock(source[3], scope), otherwise => done({
                    value: ['if', test.value, then.block, otherwise.block],
                    owned: mergeOwned(test.owned, mergeOwned(then.owned, otherwise.owned)),
                }))))
    }
    if (source[0] === 'function') {
        return bind(ownedValues(source[1].captures.map(capture => capture.value), scope), captures => done({
            value: ['function', { ...source[1], captures: source[1].captures.map((capture, index) => ({ binding: capture.binding, value: captures.values[index] })) }],
            owned: captures.owned,
        }))
    }
    return bind(ownedValues(operatorOperands(source), scope), operands => done({
        value: mapOperator((_, index) => operands.values[index])(source), owned: operands.owned,
    }))
})

/** @type {(source: Block, initialScope: _Scope) => Task<_OwnedBlock>} */
const ownedBlock = (source, initialScope) => {
    /** @type {(index: number, scope: _Scope, statements: List<Statement>, owned: _Owned) => Task<_OwnedBlock>} */
    const each = (index, scope, statements, owned) => call(() => {
        if (index === source.statements.length) {
            return bind(ownedValues(exitValues(source.exit), scope), values => done({
                block: { statements: toArray(statements).toReversed(), exit: mappedExit(source.exit, values.values) },
                normal: source.exit[0] === 'yield', owned: mergeOwned(owned, values.owned),
            }))
        }
        const statement = source.statements[index]
        /** @type {(statement: Statement, nextScope: _Scope, added: _Owned, normal?: boolean) => Task<_OwnedBlock>} */
        const append = (statement, nextScope, added, normal = true) => {
            const next = /** @type {List<Statement>} */ ({ first: statement, tail: statements })
            const collected = mergeOwned(owned, added)
            if (normal) { return each(index + 1, nextScope, next, collected) }
            const pruned = index + 1 < source.statements.length || source.exit[0] !== 'yield' || source.exit[1].length !== 0
            return done({ block: { statements: toArray(next).toReversed(), exit: ['yield', []] }, normal: false,
                owned: { ...collected, pruned: collected.pruned || pruned } })
        }
        if (statement[0] === 'define') {
            const [, binding, initializer, mode] = statement
            if (mode === 'required') {
                return bind(ownedValue(initializer, scope), value => append(['define', binding, value.value, mode], established(scope, [binding]), value.owned))
            }
            const definition = /** @type {Definition} */ (['define', binding, initializer, mode])
            /** @type {_Root | null} */
            let root = null
            /** @type {List<_Root>} */
            let roots = null
            if (initializer !== null && typeof initializer === 'object') {
                if (initializer[0] === 'ref') { root = scope.get(initializer[1]) ?? null }
                else {
                    root = { binding, source: { definition, insideLoop: false }, dependencies: dependencies(initializer, scope) }
                    roots = [root]
                }
            }
            const added = /** @type {_Owned} */ ({
                roots, definitions: root === null ? null : [[definition, root]], pruned: false,
            })
            return append(definition, new Map([...scope, [binding, root]]), added)
        }
        if (statement[0] === 'loop') {
            return bind(ownedValues(statement[1].initial, scope), initial => append(
                ['loop', { ...statement[1], initial: initial.values }], established(scope, statement[1].results), initial.owned))
        }
        if (statement[0] === 'block') {
            return bind(ownedBlock(statement[2], scope), result => append(
                ['block', statement[1], result.block], established(scope, statement[1]), result.owned, result.normal))
        }
        return bind(ownedValue(statement[2], scope), test =>
            bind(ownedBlock(statement[3], scope), then =>
                bind(ownedBlock(statement[4], scope), otherwise => append(
                    ['if', statement[1], test.value, then.block, otherwise.block], established(scope, statement[1]),
                    mergeOwned(test.owned, mergeOwned(then.owned, otherwise.owned)), then.normal || otherwise.normal))))
    })
    return each(0, initialScope, null, emptyOwned)
}

/**
 * Append only this getter's connected local recipes. The caller's cells keep
 * their slots; a getter invocation supplies fresh slots for its owned locals.
 * @type {(value: Value, outer: MemoLayout, aliases: ReadonlyMap<BindingId, number>) => RecipePlan}
 */
export const recipeCells = (value, outer, aliases) => {
    const indices = [...new Set(aliases.values())]
    const borrowed = indices.map(index => {
        const cell = outer.cells[index]
        return /** @type {_Root} */ ({ binding: cell.binding, source: { definition: cell.definition, insideLoop: cell.iterationLocal }, dependencies: [] })
    })
    const byIndex = new Map(indices.map((index, position) => [index, borrowed[position]]))
    const scope = new Map([...aliases].map(([binding, index]) => /** @type {const} */ ([binding, /** @type {_Root} */ (byIndex.get(index))])))
    const prepared = run(ownedValue(value, scope))
    const localRoots = toArray(prepared.owned.roots)
    const selected = dependencyClosure([...borrowed, ...localRoots], borrowed)
    const locals = localRoots.filter(root => selected.includes(root))
    const slots = new Map([
        ...borrowed.map((root, position) => /** @type {const} */ ([root, indices[position]])),
        ...locals.map((root, index) => /** @type {const} */ ([root, outer.cells.length + index])),
    ])
    const cells = locals.map(root => {
        const definition = /** @type {NonNullable<_Root['source']>} */ (root.source).definition
        return { binding: root.binding, initializer: definition[2], definition, iterationLocal: false }
    })
    return {
        value: locals.length === 0 && !prepared.owned.pruned ? value : prepared.value,
        layout: {
            cells: locals.length === 0 ? outer.cells : [...outer.cells, ...cells],
            definitions: new Map(locals.length === 0 ? [] : toArray(prepared.owned.definitions).flatMap(([definition, root]) => {
                const index = slots.get(root)
                return index === undefined ? [] : [/** @type {const} */ ([definition, index])]
            })),
            loops: new Set(),
        },
        localCount: locals.length,
    }
}
