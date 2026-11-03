/**
 * Select lazy recipes before helper construction loses their
 * lexical definitions across eager statement and value regions;
 * ordinary function bodies remain opaque. Deferred prerequisites and computed
 * dependents share the same vector, in definition order; lazy
 * reference aliases share their root's cell.
 *
 * @module
 *
 * @import { BindingId, Block, Definition, Exit, FunctionTarget, Loop, LoopTarget, Statement, Value } from '../../types.ts'
 * @import { List } from '../../../../types/list/types.ts'
 * @import { _Link as Link } from '../../control/private.ts'
 * @import { Task } from '../../task/types.ts'
 * @import { MemoLayout, MemoPlan, RecipePlan } from './types.ts'
 * @import { _DeferredBinding, _DeferredBlock, _DeferredScope, _DeferredSummary, _LoopInfo, _Owned, _OwnedBlock, _OwnedValue, _OwnedValues, _Root, _Scope, _Transfer } from './private.ts'
 */

import { exitValues, freeBindings, freeLoopBindings } from '../../control/module.f.mjs'
import { concat } from '../../../../types/list/module.f.js'
import { toArray } from '../../../../types/list/alt/module.f.js'
import { mapOperator, operatorOperands } from '../../module.f.mjs'
import { bind, call, done, run } from '../../task/module.f.js'
import { assertNotNullish } from '../../../../asserts/module.f.js'

/** Owning returns inside deferred recipes, without crossing ordinary bodies. @type {(value: Value, target: FunctionTarget) => boolean} */
export const _hasReturn = (value, target) => {
    /** @type {Link<Value | Block> | null} */
    let pending = { first: value, tail: null }
    while (pending !== null) {
        const { first: node, tail } = /** @type {Link<Value | Block>} */ (pending)
        pending = tail
        if (node === null || typeof node !== 'object') { continue }
        if (!(node instanceof Array)) {
            if (node.exit[0] === 'return' && node.exit[1] === target) { return true }
            /** @type {readonly (Value | Block)[]} */
            const values = [...node.statements.flatMap(statement => statement[0] === 'define' ? [statement[2]]
                : statement[0] === 'loop' ? [...statement[1].initial, statement[1].body]
                    : statement[0] === 'block' ? [statement[2]] : [statement[2], statement[3], statement[4]]), ...exitValues(node.exit),
                ...node.exit[0] === 'loop' ? [node.exit[1].body] : []]
            pending = values.reduceRight((tail, first) => ({ first, tail }), pending)
        } else {
            const values = node[0] === 'function' ? node[1].captures.map(capture => capture.value)
                : node[0] === 'block' ? [node[1]] : node[0] === 'if' ? [node[1], node[2], node[3]]
                    : node[0] === 'ref' ? [] : operatorOperands(node)
            pending = values.reduceRight((tail, first) => ({ first, tail }), pending)
        }
    }
    return false
}

/** Established values shadow any enclosing deferred entry. @type {(scope: _Scope, bindings: readonly BindingId[]) => _Scope} */
const established = (scope, bindings) => bindings.some(binding => scope.has(binding))
    ? new Map([...scope].filter(([binding]) => !bindings.includes(binding))) : scope

/** @type {(value: Value, scope: _Scope) => readonly _Root[]} */
const dependencies = (value, scope) => freeBindings({ statements: [], exit: ['yield', [value]] })
    .flatMap(binding => {
        const root = scope.get(binding)
        return root === undefined ? [] : [root]
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
    let ancestors = info.owners
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
 * Plan deferred identities crossing helpers or carrying owning returns.
 * Primitives and reads of established values retain the existing no-memo
 * classification. External lazy entries retain unavailable provenance through
 * aliases and recipes. Declaration rows keep lexical shadows distinct from
 * earlier reads; selected external entries cannot become eager captures.
 * Unsupported lifetimes are refused before any recipe moves.
 * @type {(block: Block, externalLazyIds?: readonly BindingId[], functionTarget?: FunctionTarget | null, returnsOnly?: boolean) => MemoPlan | null}
 */
export const memoCells = (block, externalLazyIds = [], functionTarget = null, returnsOnly = false) => {
    /** @type {readonly _Root[]} */
    const external = externalLazyIds.map(binding => ({ binding, source: null, dependencies: [] }))
    const prepared = run(ownedBlock(block, new Map(external.map(root => [root.binding, root])), null, null))
    const roots = [...external, ...toArray(prepared.owned.roots)]
    const definitions = toArray(prepared.owned.definitions)
    const inventory = preparedLoops(prepared.owned)
    const returning = functionTarget === null ? [] : roots.filter(root => root.source !== null && _hasReturn(root.source.definition[2], functionTarget))
    const crossing = inventory.filter(info => info.roots.length !== 0)
    const eager = roots.filter(root => returning.includes(root) || !returnsOnly && crossing.some(info => info.roots.includes(root)))
    const selectedEager = dependencyClosure(roots, eager)
    const deferred = returnsOnly ? [] : deferredSeeds(prepared.block, external, definitions,
        roots.filter(root => root.source !== null && root.dependencies.length !== 0 && !selectedEager.includes(root)))
    if (selectedEager.length === 0 && deferred.length === 0) { return null }
    const cells = deferred.length === 0 ? selectedEager : dependencyClosure(roots, [...selectedEager, ...deferred])
    const recipes = cells.map(({ binding, source }) => {
        if (source === null) { throw 'external lazy memo prerequisites require an owned initializer recipe' }
        return { binding, initializer: source.definition[2], definition: source.definition, iterationLocal: source.insideLoop }
    })
    const selected = returnsOnly ? crossing.filter(info => info.roots.some(root => cells.includes(root))) : crossing
    const loops = selectedLoops(inventory, inventory.filter(info => selected.includes(info)
        || cells.some(root => root.source?.loop === info.source)))
    validateTransfers(inventory, loops, functionTarget)
    return {
        block: prepared.block,
        cells: recipes,
        definitions: new Map(definitions.flatMap(([definition, root]) => {
            const index = cells.indexOf(root)
            return index === -1 ? [] : [/** @type {const} */ ([definition, index])]
        })),
        loops,
    }
}

const emptyOwned = /** @type {_Owned} */ ({ roots: null, definitions: null, loops: null, pruned: false })

/** Retain source order across eager subregions. @type {(first: _Owned, second: _Owned) => _Owned} */
const mergeOwned = (first, second) => ({
    roots: concat(first.roots)(second.roots),
    definitions: concat(first.definitions)(second.definitions),
    loops: concat(first.loops)(second.loops),
    pruned: first.pruned || second.pruned,
})

/** @type {(exit: Exclude<Exit, readonly ['loop', Loop]>, values: readonly Value[]) => Exit} */
const mappedExit = (exit, values) => values.every((value, index) => value === exitValues(exit)[index]) ? exit
    : exit[0] === 'yield' ? ['yield', values]
        : exit[0] === 'break' || exit[0] === 'continue' ? [exit[0], exit[1], values]
            : exit[0] === 'throw' ? ['throw', values[0]] : ['return', exit[1], values[0]]

/** @type {(values: readonly Value[], scope: _Scope, ancestors: Link<Loop> | null) => Task<_OwnedValues>} */
const ownedValues = (values, scope, ancestors) => {
    /** @type {(index: number, prepared: List<Value>, owned: _Owned) => Task<_OwnedValues>} */
    const each = (index, prepared, owned) => call(() => {
        if (index !== values.length) { return bind(ownedValue(values[index], scope, ancestors), result =>
            each(index + 1, { first: result.value, tail: prepared }, mergeOwned(owned, result.owned))) }
        const result = toArray(prepared).toReversed()
        return done({ values: result.every((value, index) => value === values[index]) ? values : result, owned })
    })
    return each(0, null, emptyOwned)
}

/**
 * Prepare the current caller or initializer's eager regions. A lazy definition owns a
 * later recipe; loop declarations retain their reached iteration lifetime.
 * Ordinary function bodies keep their separate execution boundary.
 * @type {(source: Value, scope: _Scope, ancestors: Link<Loop> | null) => Task<_OwnedValue>}
 */
const ownedValue = (source, scope, ancestors) => call(() => {
    if (source === null || typeof source !== 'object' || source[0] === 'ref') { return done(/** @type {_OwnedValue} */ ({ value: source, owned: emptyOwned })) }
    if (source[0] === 'block') {
        return bind(ownedBlock(source[1], scope, ancestors, null), result => done({ value: ['block', result.block], owned: result.owned }))
    }
    if (source[0] === 'if') {
        return bind(ownedValue(source[1], scope, ancestors), test =>
            bind(ownedBlock(source[2], scope, ancestors, null), then =>
                bind(ownedBlock(source[3], scope, ancestors, null), otherwise => done({
                    value: ['if', test.value, then.block, otherwise.block],
                    owned: mergeOwned(test.owned, mergeOwned(then.owned, otherwise.owned)),
                }))))
    }
    if (source[0] === 'function') {
        const values = source[1].captures.map(capture => capture.value)
        return bind(ownedValues(values, scope, ancestors), captures => done({
            value: captures.values === values ? source : ['function', { ...source[1], captures: source[1].captures.map((capture, index) => ({ binding: capture.binding, value: captures.values[index] })) }],
            owned: captures.owned,
        }))
    }
    const values = operatorOperands(source)
    return bind(ownedValues(values, scope, ancestors), operands => done({
        value: operands.values === values ? source : mapOperator((_, index) => operands.values[index])(source), owned: operands.owned,
    }))
})

/** Inventory one lexical loop occurrence, including a terminal exit loop. @type {(source: Loop, scope: _Scope, ancestors: Link<Loop> | null, owners: Link<Loop> | null) => Task<{ readonly loop: Loop; readonly owned: _Owned }>} */
const ownedLoop = (source, scope, ancestors, owners) => {
    /** @type {Loop} */
    const occurrence = { ...source }
    return bind(ownedValues(occurrence.initial, scope, ancestors), initial =>
        bind(ownedBlock(occurrence.body, established(scope, occurrence.parameters), { first: occurrence, tail: ancestors }, { first: occurrence, tail: owners }), body => {
            /** @type {Loop} */
            const loop = { ...occurrence, initial: initial.values, body: body.block }
            const free = freeLoopBindings(loop).flatMap(binding => {
                const root = scope.get(binding)
                return root === undefined ? [] : [root]
            })
            /** @type {_LoopInfo} */
            const info = { source: occurrence, loop, roots: free, ancestors, owners, transfers: loopTransfers(loop) }
            /** @type {_Owned} */
            const owned = { ...body.owned, loops: concat([info])(body.owned.loops) }
            return done({ loop, owned: mergeOwned(initial.owned, owned) })
        }))
}

/** @type {(source: Block, initialScope: _Scope, ancestors: Link<Loop> | null, owners: Link<Loop> | null) => Task<_OwnedBlock>} */
const ownedBlock = (source, initialScope, ancestors, owners) => {
    /** @type {(index: number, scope: _Scope, statements: List<Statement>, owned: _Owned) => Task<_OwnedBlock>} */
    const each = (index, scope, statements, owned) => call(() => {
        if (index === source.statements.length) {
            const exit = source.exit
            if (exit[0] === 'loop') {
                return bind(ownedLoop(exit[1], scope, ancestors, owners), result => done({
                    block: { statements: toArray(statements).toReversed(), exit: ['loop', result.loop] },
                    normal: false, owned: mergeOwned(owned, result.owned),
                }))
            }
            return bind(ownedValues(exitValues(exit), scope, ancestors), values => done({
                block: { statements: toArray(statements).toReversed(), exit: mappedExit(exit, values.values) },
                normal: exit[0] === 'yield', owned: mergeOwned(owned, values.owned),
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
                return bind(ownedValue(initializer, scope, ancestors), value => append(['define', binding, value.value, mode], established(scope, [binding]), value.owned))
            }
            const definition = /** @type {Definition} */ (['define', binding, initializer, mode])
            /** @type {_Root | null} */
            let root = null
            /** @type {List<_Root>} */
            let roots = null
            if (initializer !== null && typeof initializer === 'object') {
                if (initializer[0] === 'ref') { root = scope.get(initializer[1]) ?? null }
                else {
                    root = { binding, source: { definition, insideLoop: ancestors !== null, loop: ancestors?.first ?? null }, dependencies: dependencies(initializer, scope) }
                    roots = [root]
                }
            }
            const added = /** @type {_Owned} */ ({
                roots, definitions: root === null ? null : [[definition, root]], loops: null, pruned: false,
            })
            return append(definition, root === null ? established(scope, [binding]) : new Map([...scope, [binding, root]]), added)
        }
        if (statement[0] === 'loop') {
            return bind(ownedLoop(statement[1], scope, ancestors, owners), result =>
                append(['loop', result.loop], established(scope, result.loop.results), result.owned))
        }
        if (statement[0] === 'block') {
            return bind(ownedBlock(statement[2], scope, ancestors, owners), result => append(
                ['block', statement[1], result.block], established(scope, statement[1]), result.owned, result.normal))
        }
        return bind(ownedValue(statement[2], scope, ancestors), test =>
            bind(ownedBlock(statement[3], scope, ancestors, owners), then =>
                bind(ownedBlock(statement[4], scope, ancestors, owners), otherwise => append(
                    ['if', statement[1], test.value, then.block, otherwise.block], established(scope, statement[1]),
                    mergeOwned(test.owned, mergeOwned(then.owned, otherwise.owned)), then.normal || otherwise.normal))))
    })
    return each(0, initialScope, null, emptyOwned)
}

/** Resolve stable occurrence handles to the loops emitted by the common walk. @type {(owned: _Owned) => readonly _LoopInfo[]} */
const preparedLoops = owned => {
    const occurrences = toArray(owned.loops)
    const bySource = new Map(occurrences.map(info => [info.source, info.loop]))
    /** @type {(links: Link<Loop> | null) => Link<Loop> | null} */
    const mapped = links => toArray(links).map(loop => assertNotNullish(bySource.get(loop)))
        .reduceRight((/** @type {Link<Loop> | null} */ tail, first) => ({ first, tail }), null)
    return occurrences.map(info => ({ ...info, ancestors: mapped(info.ancestors), owners: mapped(info.owners) }))
}

const emptyDeferred = /** @type {_DeferredSummary} */ ({ dependencies: [], crossed: false, selected: null })

/** @type {(first: _DeferredSummary, second: _DeferredSummary) => _DeferredSummary} */
const mergeDeferred = (first, second) => ({
    dependencies: [...new Set([...first.dependencies, ...second.dependencies])],
    crossed: first.crossed || second.crossed,
    selected: concat(first.selected)(second.selected),
})

/**
 * Inspect deferred syntax once, retaining lexical origins without preparing or
 * evaluating it. A local lazy value carries its caller dependencies; a required
 * value is already established before any later helper reads it.
 * @type {(source: Block, external: readonly _Root[], definitions: readonly (readonly [Definition, _Root])[], candidates: readonly _Root[]) => readonly _Root[]}
 */
const deferredSeeds = (source, external, definitions, candidates) => {
    if (candidates.length === 0) { return [] }
    const wanted = new Set(candidates)
    const declared = new Map(definitions)
    /** @type {(scope: _DeferredScope, bindings: readonly BindingId[]) => _DeferredScope} */
    const shadowed = (scope, bindings) => bindings.some(binding => scope.has(binding))
        ? new Map([...scope].filter(([binding]) => !bindings.includes(binding))) : scope
    /** @type {(input: readonly Value[], scope: _DeferredScope, depth: number) => Task<_DeferredSummary>} */
    const values = (input, scope, depth) => {
        /** @type {(index: number, summary: _DeferredSummary) => Task<_DeferredSummary>} */
        const each = (index, summary) => call(() => index === input.length ? done(summary)
            : bind(value(input[index], scope, depth), result => each(index + 1, mergeDeferred(summary, result))))
        return each(0, emptyDeferred)
    }
    /** @type {(source: Value, scope: _DeferredScope, depth: number) => Task<_DeferredSummary>} */
    const value = (source, scope, depth) => call(() => {
        if (source === null || typeof source !== 'object') { return done(emptyDeferred) }
        if (source[0] === 'ref') {
            const binding = scope.get(source[1])
            return done(binding === undefined ? emptyDeferred : {
                dependencies: binding.roots, crossed: depth > binding.depth, selected: null,
            })
        }
        if (source[0] === 'block') { return bind(block(source[1], scope, depth), result => done(result.summary)) }
        if (source[0] === 'if') {
            return bind(value(source[1], scope, depth), test => bind(block(source[2], scope, depth), then =>
                bind(block(source[3], scope, depth), otherwise => done(mergeDeferred(test, mergeDeferred(then.summary, otherwise.summary))))))
        }
        return values(source[0] === 'function' ? source[1].captures.map(capture => capture.value) : operatorOperands(source), scope, depth)
    })
    /** @type {(source: Block, initial: _DeferredScope, depth: number) => Task<_DeferredBlock>} */
    const block = (source, initial, depth) => {
        /** @type {(index: number, scope: _DeferredScope, summary: _DeferredSummary) => Task<_DeferredBlock>} */
        const each = (index, scope, summary) => call(() => {
            if (index === source.statements.length) {
                if (source.exit[0] === 'loop') {
                    const loop = source.exit[1]
                    return bind(values(loop.initial, scope, depth), initial =>
                        bind(block(loop.body, shadowed(scope, loop.parameters), depth + 1), body => done({
                            summary: mergeDeferred(summary, mergeDeferred(initial, body.summary)), normal: false,
                        })))
                }
                return bind(values(exitValues(source.exit), scope, depth), result =>
                    done({ summary: mergeDeferred(summary, result), normal: source.exit[0] === 'yield' }))
            }
            const statement = source.statements[index]
            /** @type {(added: _DeferredSummary, next: _DeferredScope, normal?: boolean) => Task<_DeferredBlock>} */
            const append = (added, next, normal = true) => normal ? each(index + 1, next, mergeDeferred(summary, added))
                : done({ summary: mergeDeferred(summary, added), normal: false })
            if (statement[0] === 'define') {
                const [, binding, initializer, mode] = statement
                const root = declared.get(statement)
                const computed = root !== undefined && root.source?.definition === statement
                const inspect = mode === 'required' || !computed || wanted.has(root)
                return bind(inspect ? value(initializer, scope, depth) : done(emptyDeferred), result => {
                    /** @type {_DeferredBinding | undefined} */
                    const marker = mode === 'required' ? undefined
                        : initializer instanceof Array && initializer[0] === 'ref' ? scope.get(initializer[1])
                            : computed ? { roots: [root], depth }
                                : result.dependencies.length === 0 ? undefined : { roots: result.dependencies, depth }
                    const next = marker === undefined ? shadowed(scope, [binding]) : new Map([...scope, [binding, marker]])
                    return append(computed && wanted.has(root) && result.crossed
                        ? { ...result, selected: concat(result.selected)([root]) } : result, next)
                })
            }
            if (statement[0] === 'loop') {
                const loop = statement[1]
                return bind(values(loop.initial, scope, depth), initial =>
                    bind(block(loop.body, shadowed(scope, loop.parameters), depth + 1), body =>
                        append(mergeDeferred(initial, body.summary), shadowed(scope, loop.results))))
            }
            if (statement[0] === 'block') { return bind(block(statement[2], scope, depth), result =>
                append(result.summary, shadowed(scope, statement[1]), result.normal)) }
            return bind(value(statement[2], scope, depth), test => bind(block(statement[3], scope, depth), then =>
                bind(block(statement[4], scope, depth), otherwise => append(mergeDeferred(test, mergeDeferred(then.summary, otherwise.summary)),
                    shadowed(scope, statement[1]), then.normal || otherwise.normal))))
        })
        return each(0, initial, emptyDeferred)
    }
    const scope = new Map(external.map(root => [root.binding, { roots: [root], depth: 0 }]))
    return toArray(run(block(source, scope, 0)).summary.selected)
}

/**
 * Append only this getter's connected local recipes. The caller's cells keep
 * their slots; a getter invocation supplies fresh slots for its owned locals.
 * @type {(value: Value, outer: MemoLayout, aliases: ReadonlyMap<BindingId, number>, functionTarget?: FunctionTarget | null) => RecipePlan}
 */
export const recipeCells = (value, outer, aliases, functionTarget = null) => {
    const indices = [...new Set(aliases.values())]
    const borrowed = indices.map(index => {
        const cell = outer.cells[index]
        return /** @type {_Root} */ ({ binding: cell.binding, source: { definition: cell.definition, insideLoop: cell.iterationLocal, loop: null }, dependencies: [] })
    })
    const byIndex = new Map(indices.map((index, position) => [index, borrowed[position]]))
    const scope = new Map([...aliases].map(([binding, index]) => /** @type {const} */ ([binding, /** @type {_Root} */ (byIndex.get(index))])))
    const prepared = run(ownedValue(value, scope, null))
    const localRoots = toArray(prepared.owned.roots)
    const inventory = preparedLoops(prepared.owned)
    const crossing = inventory.filter(info => info.roots.length !== 0)
    const returning = functionTarget === null ? [] : localRoots.filter(root => root.source !== null && _hasReturn(root.source.definition[2], functionTarget))
    const selected = dependencyClosure([...borrowed, ...localRoots], [...new Set([...borrowed, ...returning, ...crossing.flatMap(info => info.roots)])])
    const locals = localRoots.filter(root => selected.includes(root))
    const loops = selectedLoops(inventory, inventory.filter(info => info.roots.some(root => selected.includes(root))
        || locals.some(root => root.source?.loop === info.source)))
    validateTransfers(inventory, loops, functionTarget)
    const slots = new Map([
        ...borrowed.map((root, position) => /** @type {const} */ ([root, indices[position]])),
        ...locals.map((root, index) => /** @type {const} */ ([root, outer.cells.length + index])),
    ])
    const cells = locals.map(root => {
        const source = assertNotNullish(root.source)
        const definition = source.definition
        return { binding: root.binding, initializer: definition[2], definition, iterationLocal: source.insideLoop }
    })
    return {
        value: locals.length === 0 && loops.size === 0 && !prepared.owned.pruned ? value : prepared.value,
        layout: {
            cells: locals.length === 0 ? outer.cells : [...outer.cells, ...cells],
            definitions: new Map(locals.length === 0 ? [] : toArray(prepared.owned.definitions).flatMap(([definition, root]) => {
                const index = slots.get(root)
                return index === undefined ? [] : [/** @type {const} */ ([definition, index])]
            })),
            loops,
        },
        localCount: locals.length,
    }
}
