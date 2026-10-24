/**
 * Select caller-owned lazy recipes before graph construction loses their
 * lexical definitions. Values keep their own loop-normalization boundary;
 * ordinary function bodies remain opaque. Deferred prerequisites and computed
 * dependents share the same caller-owned vector, in definition order; lazy
 * reference aliases share their root's cell.
 *
 * @module
 *
 * @import { BindingId, Block, Definition, Loop, Value } from '../../../../../js/ast/types.ts'
 * @import { Link } from '../../../private.ts'
 * @import { MemoPlan } from './types.ts'
 * @import { _LoopInfo, _Root, _Scope, _TransferVisit, _Visit } from './private.ts'
 */

import { freeBindings, freeLoopBindings } from '../../../control/module.f.mjs'

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
 * Nested ordinary loops may retain their own transfers. Crossing any helper
 * exit requires the later completion-bearing memo protocol.
 * @type {(loop: Loop) => void}
 */
const normalTransfers = loop => {
    /** @type {Link<_TransferVisit> | null} */
    let pending = { first: { block: loop.body, loop }, tail: null }
    while (pending !== null) {
        const { first: visit, tail } = /** @type {Link<_TransferVisit>} */ (pending)
        const exit = visit.block.exit
        if (exit[0] === 'return' || (exit[0] === 'break' || exit[0] === 'continue') && exit[1] !== visit.loop.target) {
            throw 'memo helper escaping transfers require completion demand-state lowering'
        }
        const children = visit.block.statements.flatMap(statement => statement[0] === 'block'
            ? [{ block: statement[2], loop: visit.loop }]
            : statement[0] === 'if' ? [{ block: statement[3], loop: visit.loop }, { block: statement[4], loop: visit.loop }]
            : statement[0] === 'loop' ? [{ block: statement[1].body, loop: statement[1] }] : [])
        pending = children.reduceRight((tail, first) => ({ first, tail }), tail)
    }
}

/**
 * Plan only definitions whose deferred identity crosses a statement helper.
 * Primitives and reads of established values retain the existing no-memo
 * classification. External lazy entries retain unavailable provenance through
 * aliases and recipes. Declaration rows keep lexical shadows distinct from
 * earlier reads; selected external entries cannot become eager captures.
 * Unsupported lifetimes are refused before any recipe moves.
 * @type {(block: Block, externalLazyIds?: readonly BindingId[]) => MemoPlan | null}
 */
export const memoCells = (block, externalLazyIds = []) => {
    /** @type {readonly _Root[]} */
    const external = externalLazyIds.map(binding => ({ binding, source: null, dependencies: [] }))
    /** @type {Link<_Visit> | null} */
    let pending = { first: { block, index: 0, scope: new Map(external.map(root => [root.binding, root])), ancestors: null }, tail: null }
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
            if (free.length !== 0) { inventory = [...inventory, { loop, roots: free, ancestors }] }
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
    if (inventory.length === 0) { return null }
    const cells = dependencyClosure(roots, roots.filter(root => inventory.some(info => info.roots.includes(root))))
    const recipes = cells.map(({ binding, source }) => {
        if (source === null) { throw 'external lazy memo prerequisites require an owned initializer recipe' }
        if (source.insideLoop) { throw 'iteration-local memo cells require nested demand-state lowering' }
        return { binding, initializer: source.definition[2], definition: source.definition }
    })
    for (const info of inventory) {
        if (info.ancestors !== null) { throw 'nested memo helper boundaries require shared demand-state lowering' }
        normalTransfers(info.loop)
    }
    return {
        cells: recipes,
        definitions: new Map(definitions.flatMap(([definition, root]) => {
            const index = cells.indexOf(root)
            return index === -1 ? [] : [/** @type {const} */ ([definition, index])]
        })),
        loops: new Set(inventory.map(info => info.loop)),
    }
}
