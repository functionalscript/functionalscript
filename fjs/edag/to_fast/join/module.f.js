/**
 * Recover normal statement results selected by an already established test.
 * Terminal arms keep their transfers; one following continuation consumes the
 * joined values. Required first demands retain their original execution order.
 *
 * @module
 * @import { BindingId, Block, Definition, Loop, Statement, Value } from '../../../js/ast/types.ts'
 * @import { Exp } from '../../types.ts'
 * @import { Task } from '../../../js/ast/task/types.ts'
 * @import { _Arm, _Region, _Selected, _Way } from './private.ts'
 */

import { operatorOperands, mapOperator, unskipped } from '../../../js/ast/module.f.js'
import { exitValues, freeBindings, someBlock } from '../../../js/ast/control/module.f.js'
import { bind, call, done, run } from '../../../js/ast/task/module.f.js'
import { _forwardResult } from '../../../js/ast/results/module.f.js'
import { anchored, lowerValue } from '../../from_fast/module.f.js'
import { demandsInOrder } from '../../demand/module.f.js'
import { isNegativeZero } from '../../../types/number/is_negative_zero/module.f.js'

/**
 * Whether two tests decide alike: the same value, or the same operation over
 * the same bindings and literals. The language is pure, so equal expressions
 * over the same bindings have one truth, and the second need not be asked. A
 * test that holds a region, a function, a block or a selection, is compared
 * by identity alone.
 *
 * @type {(a: Value, b: Value) => boolean}
 */
const sameTest = (a, b) => {
    /** @type {readonly (readonly [unknown, unknown])[]} */
    let pending = [[a, b]]
    while (pending.length !== 0) {
        const [[x, y], ...rest] = pending
        pending = rest
        // `===` holds for `0` and `-0`, which a test can tell apart
        if (x === y && (typeof x !== 'number' || isNegativeZero(x) === isNegativeZero(/** @type {number} */ (y)))) { continue }
        if (!(x instanceof Array) || !(y instanceof Array) || x.length !== y.length || ['function', 'block', 'if'].includes(x[0])) { return false }
        pending = [...x.map((item, index) => /** @type {const} */ ([item, y[Number(index)]])), ...pending]
    }
    return true
}

/** Deferred declarations run only at a read; dependency checks follow those reads through recipes. @type {(block: Block, target: BindingId, deferred: readonly Definition[]) => boolean} */
const references = (block, target, deferred) => {
    let pending = freeBindings(block)
    /** @type {readonly BindingId[]} */
    let seen = []
    while (pending.length !== 0) {
        const [binding, ...rest] = pending
        pending = rest
        if (binding === target) { return true }
        if (seen.includes(binding)) { continue }
        seen = [...seen, binding]
        const definition = deferred.find(definition => definition[1] === binding)
        if (definition !== undefined) { pending = [...freeBindings({ statements: [], exit: ['yield', [definition[2]]] }), ...pending] }
    }
    return false
}

/** The loops a block runs: its statements', and the one it ends in. @type {(block: Block) => readonly Loop[]} */
const loopsOf = block => [...block.statements.flatMap(statement => statement[0] === 'loop' ? [statement[1]] : []), ...(block.exit[0] === 'loop' ? [block.exit[1]] : [])]

/** Expand deferred recipes without evaluating them; established reads alone are inert placeholders. @type {(value: Value, target: BindingId, deferred: readonly Definition[]) => boolean} */
const firstDemand = (value, target, deferred) => {
    const definitions = deferred.filter(definition => definition[1] !== target)
    // The lowering hands a loop the values its body reads before the first
    // pass, so a read inside a body would count as a demand it is not.
    if (someBlock(block => loopsOf(block).some(loop => references(loop.body, target, definitions)))(value)) { return false }
    const bindings = freeBindings({ statements: definitions, exit: ['yield', [value]] })
    const wanted = /** @type {Exp} */ (['()', ['arg', bindings.length], []])
    /** @type {import('../../from_fast/types.ts').Environment} */
    let environment = bindings.map((binding, index) => [binding, binding === target ? wanted : ['arg', index]])
    for (const definition of definitions) {
        environment = [...environment, [definition[1], anchored(lowerValue(definition[2], environment))]]
    }
    return demandsInOrder(anchored(lowerValue(value, environment)), [wanted])
}

/** Values remain in their operand region until the complete prefix proves a move. @type {(value: Value, test: Value, result: BindingId) => Task<_Selected | null>} */
const selectedTask = (value, test, result) => call(() => {
    if (!(value instanceof Array) || value[0] === 'ref' || value[0] === 'function') { return done(null) }
    if (value[0] === 'block') {
        const block = value[1]
        const first = block.statements[0]
        const operand = first === undefined && block.exit[0] === 'yield' ? block.exit[1][0]
            : first !== undefined && first[0] === 'define' && first[3] === 'required' ? first[2] : null
        if (operand === null) { return done(null) }
        return bind(selectedTask(operand, test, result), selected => done(selected === null ? null : /** @type {_Selected} */ ({ ...selected, value: ['block', first === undefined
            ? { statements: [], exit: ['yield', [selected.value]] }
            : { ...block, statements: [['define', first[1], selected.value, 'required'], ...block.statements.slice(1)] }],
        })))
    }
    if (value[0] === 'if') { return done(sameTest(value[1], test) ? { value: ['ref', result], then: value[2], otherwise: value[3] } : null) }
    const operands = operatorOperands(value)
    /** @type {(index: number) => Task<_Selected | null>} */
    const each = index => call(() => index === operands.length ? done(null)
        : bind(selectedTask(operands[Number(index)], test, result), selected => selected === null ? each(index + 1)
            : done(/** @type {_Selected} */ ({ ...selected, value: mapOperator((operand, position) => position === index ? selected.value : operand)(value) }))))
    return each(0)
})

/** A value arm executes only after the preceding statement arm completes normally. @type {(body: Block, value: Block) => Block} */
const yielded = (body, value) => body.exit[0] === 'yield' ? {
    statements: body.statements,
    exit: ['yield', [...body.exit[1], value.statements.length === 0 && value.exit[0] === 'yield' ? value.exit[1][0] : ['block', value]]],
} : body

/** An existing statement result is available only after both arms finish. @type {(results: readonly BindingId[], left: Block, right: Block) => boolean} */
const usesResults = (results, left, right) => [...freeBindings(left), ...freeBindings(right)].some(binding => results.includes(binding))

/** The bindings a statement declares for what follows it. @type {(statement: Statement) => readonly BindingId[]} */
const bound = statement => statement[0] === 'define' ? [statement[1]] : statement[0] === 'loop' ? statement[1].results : statement[1]

/** Deferred captures also retain the scope preceding the statement arm. @type {(body: Block, value: Block, deferred: readonly Definition[]) => boolean} */
const shadows = (body, value, deferred) => body.statements.some(statement => bound(statement).some(binding => references(value, binding, deferred)))

/** Appending selected values preserves their original dependency scope. @type {(branch: Extract<Statement, readonly ['if', ...unknown[]]>, left: Block, right: Block, deferred: readonly Definition[]) => boolean} */
const appendScope = (branch, left, right, deferred) => !usesResults(branch[1], left, right)
    && !shadows(branch[3], left, deferred) && !shadows(branch[4], right, deferred)

/**
 * A selected match proves the statement's test. Following tests and selected
 * arms must still read the bindings available before the statement decision,
 * so the statement declares none of the bindings its test reads.
 * @type {(branch: Extract<Statement, readonly ['if', ...unknown[]]>, selected: _Selected, deferred: readonly Definition[]) => boolean}
 */
const sameScope = (branch, selected, deferred) => !freeBindings({ statements: [], exit: ['yield', [branch[2]]] }).some(binding => branch[1].includes(binding))
    && appendScope(branch, selected.then, selected.otherwise, deferred)

/** Moving a recipe must preserve both its inputs and which declaration later reads name. @type {(definition: Definition) => Block} */
const recipeScope = definition => ({ statements: [], exit: ['yield', [definition[2], ['ref', definition[1]]]] })

/** What a statement, or past the last one the exit, evaluates on reaching it: no arm, no body, no deferred recipe. @type {(body: Block, index: number) => Value | null} */
const reached = (body, index) => {
    const statement = body.statements[Number(index)]
    return statement === undefined ? ['array', exitValues(body.exit)]
        : statement[0] === 'define' && statement[3] === 'required' || statement[0] === 'if' ? statement[2]
            : statement[0] === 'loop' ? ['array', statement[1].initial] : null
}

/** Whether a region inside the statement leaves it otherwise than by completing or failing. */
const leaves = someBlock(({ exit }) => exit[0] !== 'yield' && exit[0] !== 'throw')

/** What follows where the first part completes without the read; where it cannot, nothing after it is reached unread. @type {(first: readonly _Way[], rest: () => Task<readonly _Way[]>) => Task<readonly _Way[]>} */
const andThen = (first, rest) => !first.includes('normal') ? done(first)
    : bind(rest(), ways => done([...first.filter(way => way !== 'normal' && !ways.includes(way)), ...ways]))

/** Completing unread becomes the transfer, or nothing where the region fails. @type {(ways: readonly _Way[], to: readonly _Way[]) => readonly _Way[]} */
const instead = (ways, to) => ways.flatMap(way => way !== 'normal' ? [way] : to.filter(other => !ways.includes(other)))

/**
 * The ways a region ends without having read the binding declared outside
 * it. A failure is not one: a path that fails before the read fails either
 * way ([spec](../../../../spec/principles/README.md#failure-is-one-outcome)).
 *
 * A read leaves none. Parts evaluated in order add up until one cannot
 * complete unread; a selection is its test, then either arm; an operand that
 * can be skipped keeps `normal` and adds its own ways. A function evaluates
 * its captures and no body, a deferred recipe nothing. A transfer turns
 * `normal` into itself, and a loop turns a `break` to it back into `normal`.
 * A `continue` stays `away`: the path that never reads may never end, and
 * requiring the recipe would fail it.
 *
 * Past a statement that declares the binding anew, reads are of another
 * binding, and the rest of its block ends any way it can.
 *
 * The value, the values from an index on, in order or as operands that can
 * be skipped, and the block from a statement on are one function over a
 * tagged region: they call each other, and a module's `const`s cannot.
 *
 * @type {(target: BindingId) => (region: _Region) => Task<readonly _Way[]>}
 */
const unread = target => {
    /** @type {(region: _Region) => Task<readonly _Way[]>} */
    const of = region => call(() => {
        /** @type {(test: Value, then: Block, otherwise: Block) => Task<readonly _Way[]>} */
        const selection = (test, then, otherwise) => bind(of(['value', test]), ways => andThen(ways, () =>
            bind(of(['block', then, 0]), left => bind(of(['block', otherwise, 0]), right => done([...left, ...right.filter(way => !left.includes(way))])))))
        /** @type {(loop: Loop) => Task<readonly _Way[]>} */
        const ofLoop = loop => loop.parameters.includes(target) ? done(['normal', 'away'])
            : bind(of(['values', loop.initial, 0]), ways => bind(andThen(ways, () => of(['block', loop.body, 0])),
                all => done(all.flatMap(way => way !== loop.target ? [way] : all.includes('normal') ? [] : ['normal']))))
        if (region[0] === 'values' || region[0] === 'skipped') {
            const [kind, values, index] = region
            if (index === values.length) { return done(['normal']) }
            return bind(of(['value', values[Number(index)]]), ways => andThen(kind === 'values' ? ways : ['normal', ...ways.filter(way => way !== 'normal')], () => of([kind, values, index + 1])))
        }
        if (region[0] === 'block') {
            const [, block, index] = region
            const statement = block.statements[Number(index)]
            if (statement === undefined) {
                const { exit } = block
                return exit[0] === 'loop' ? ofLoop(exit[1])
                    : bind(of(['values', exitValues(exit), 0]), ways => done(exit[0] === 'yield' ? ways
                        : instead(ways, exit[0] === 'throw' ? [] : [exit[0] === 'break' ? exit[1] : 'away'])))
            }
            /** @type {readonly _Way[]} */
            const none = ['normal']
            return bind(statement[0] === 'loop' ? ofLoop(statement[1])
                : statement[0] === 'block' ? of(['block', statement[2], 0])
                : statement[0] === 'if' ? selection(statement[2], statement[3], statement[4])
                : statement[3] === 'lazy' ? done(none) : of(['value', statement[2]]),
            ways => andThen(ways, () => !bound(statement).includes(target) ? of(['block', block, index + 1])
                : done(leaves({ ...block, statements: block.statements.slice(index + 1) }) ? [...none, 'away'] : none)))
        }
        const value = region[1]
        if (!(value instanceof Array)) { return done(['normal']) }
        if (value[0] === 'ref') { return done(value[1] === target ? [] : ['normal']) }
        if (value[0] === 'function') { return of(['values', value[1].captures.map(capture => capture.value), 0]) }
        if (value[0] === 'block') { return of(['block', value[1], 0]) }
        if (value[0] === 'if') { return selection(value[1], value[2], value[3]) }
        const operands = operatorOperands(value)
        const count = unskipped(value)
        return bind(of(['values', operands.slice(0, count), 0]), ways => andThen(ways, () => of(['skipped', operands.slice(count), 0])))
    })
    return of
}

/**
 * Whether the block reads the recipe on every path that completes it or
 * leaves it: nothing after the declaration ends unread. The recipe may then
 * be required where it stands.
 *
 * @type {(body: Block, definition: Definition) => boolean}
 */
const certain = (body, definition) => run(unread(definition[1])(['block', body, body.statements.indexOf(definition) + 1])).length === 0

/** Only move a recipe to its first reached demand without crossing a dependency's shadow. @type {(body: Block, definition: Definition, deferred: readonly Definition[], start?: number) => Block | null} */
const localized = (body, definition, deferred, start = 0) => {
    let index = 0
    while (index < body.statements.length && !freeBindings({ statements: [body.statements[Number(index)]], exit: ['yield', []] }).includes(definition[1])) {
        index = index + 1
    }
    if (index < start) { return null }
    const value = reached(body, index)
    const visible = /** @type {readonly Definition[]} */ ([...deferred, ...body.statements.slice(0, index).flatMap(statement => statement[0] === 'define' && statement[3] === 'lazy' ? [statement] : [])])
    if (value === null || !firstDemand(value, definition[1], visible)) { return null }
    if (shadows({ statements: body.statements.slice(start, index), exit: ['yield', []] }, recipeScope(definition), deferred)) { return null }
    return { ...body, statements: [...body.statements.slice(0, index), ['define', definition[1], definition[2], 'required'], ...body.statements.slice(index)] }
}

/** Only newly recovered results change where their dependent declarations belong. @type {(block: Block, branch: Extract<Statement, readonly ['if', ...unknown[]]>, deferred: readonly Definition[], result: BindingId) => readonly Statement[]} */
const followingRecipes = (block, branch, deferred, result) => {
    const index = block.statements.indexOf(branch)
    const before = block.statements.slice(0, index)
    const moved = before.filter(statement => statement[0] === 'define' && statement[3] === 'lazy'
        && references({ statements: [], exit: ['yield', [statement[2]]] }, result, deferred))
    return [...before.filter(statement => !moved.includes(statement)), branch, ...moved, ...block.statements.slice(index + 1)]
}

/** Recovered recipes and their moved dependents retain their declaration scope. @type {(block: Block, branch: Extract<Statement, readonly ['if', ...unknown[]]>, definition: Definition, deferred: readonly Definition[]) => boolean} */
const followingScope = (block, branch, definition, deferred) => {
    const before = block.statements.slice(0, block.statements.indexOf(branch))
    const origin = before.indexOf(definition)
    return before.every((statement, index) => {
        if (statement[0] !== 'define' || statement[3] !== 'lazy') { return true }
        const value = /** @type {Block} */ ({ statements: [], exit: ['yield', [statement[2]]] })
        return statement !== definition && !references(value, definition[1], deferred) || index >= origin
            && !shadows({ statements: [...before.slice(index + 1), branch], exit: ['yield', []] }, recipeScope(statement), deferred)
    })
}

/** Whether evaluating the value can read the binding, through deferred recipes too. @type {(value: Value, target: BindingId, deferred: readonly Definition[]) => boolean} */
const reads = (value, target, deferred) => references({ statements: [], exit: ['yield', [value]] }, target, deferred)

/** The one arm of a selection that reads the binding, where its test and its other arm do not. @type {<T>(test: Value, then: Block, otherwise: Block, rebuilt: (then: Block, otherwise: Block) => T, target: BindingId, deferred: readonly Definition[]) => _Arm<T> | null} */
const exclusiveArm = (test, then, otherwise, rebuilt, target, deferred) => {
    const left = references(then, target, deferred)
    return reads(test, target, deferred) || left === references(otherwise, target, deferred) ? null
        : left ? { arm: then, rebuilt: arm => rebuilt(arm, otherwise) } : { arm: otherwise, rebuilt: arm => rebuilt(then, arm) }
}

/**
 * The one selected arm inside a value that holds every read of the binding:
 * a selection's, or the selection's inside the one operand that reads it.
 * A function's captures and a block keep their recipes outside.
 *
 * @type {(value: Value, target: BindingId, deferred: readonly Definition[]) => Task<_Arm<Value> | null>}
 */
const valueArm = (value, target, deferred) => call(() => {
    if (!(value instanceof Array) || value[0] === 'ref' || value[0] === 'function' || value[0] === 'block') { return done(null) }
    if (value[0] === 'if') { return done(exclusiveArm(value[1], value[2], value[3], (then, otherwise) => /** @type {Value} */ (['if', value[1], then, otherwise]), target, deferred)) }
    const operands = operatorOperands(value)
    const reading = operands.flatMap((operand, index) => reads(operand, target, deferred) ? [index] : [])
    if (reading.length !== 1) { return done(null) }
    const [index] = reading
    return bind(valueArm(operands[Number(index)], target, deferred), found => done(found === null ? null : /** @type {_Arm<Value>} */ ({
        arm: found.arm, rebuilt: arm => mapOperator((operand, position) => position === index ? found.rebuilt(arm) : operand)(value),
    })))
})

/** The one selected arm a statement holds every read of the binding in: an `if` statement's, or one inside a required initializer. @type {(statement: Statement, target: BindingId, deferred: readonly Definition[]) => Task<_Arm<Statement> | null>} */
const statementArm = (statement, target, deferred) => {
    if (statement[0] === 'if') {
        return done(exclusiveArm(statement[2], statement[3], statement[4], (then, otherwise) => /** @type {Statement} */ (['if', statement[1], statement[2], then, otherwise]), target, deferred))
    }
    if (statement[0] !== 'define' || statement[3] !== 'required') { return done(null) }
    return bind(valueArm(statement[2], target, deferred), found => done(found === null ? null : /** @type {_Arm<Statement>} */ ({
        arm: found.arm, rebuilt: arm => ['define', statement[1], found.rebuilt(arm), 'required'],
    })))
}

/** The exit over other values, a terminal loop's aside. @type {(exit: Exclude<Block['exit'], readonly ['loop', unknown]>, values: readonly Value[]) => Block['exit']} */
const exitOver = (exit, values) => exit[0] === 'yield' ? ['yield', values]
    : exit[0] === 'break' || exit[0] === 'continue' ? [exit[0], exit[1], values]
        : exit[0] === 'return' ? ['return', exit[1], values[0]] : ['throw', values[0]]

/** The one selected arm the exit holds every read of the binding in, inside the one value that reads it. @type {(exit: Block['exit'], target: BindingId, deferred: readonly Definition[]) => Task<_Arm<Block['exit']> | null>} */
const exitArm = (exit, target, deferred) => {
    if (exit[0] === 'loop') { return done(null) }
    const values = exitValues(exit)
    const reading = values.flatMap((value, index) => reads(value, target, deferred) ? [index] : [])
    if (reading.length !== 1) { return done(null) }
    const [index] = reading
    return bind(valueArm(values[Number(index)], target, deferred), found => done(found === null ? null : /** @type {_Arm<Block['exit']>} */ ({
        arm: found.arm, rebuilt: arm => exitOver(exit, values.map((value, position) => position === index ? found.rebuilt(arm) : value)),
    })))
}

/**
 * Place a recipe in its block. It moves to its first demand, descending the
 * one selected arm that holds every read of it; dependents move first, so a
 * prerequisite never passes their declarations. Failing that it is required
 * where it stands, at the head of an arm it was carried into, when the block
 * reads it on every path that completes.
 *
 * @type {(source: Block, definition: Definition, deferred: readonly Definition[], origin: number) => Task<Block | null>}
 */
const localizedTask = (source, definition, deferred, origin) => bind(/** @type {Task<Block | null>} */ (call(() => {
    const following = localized({ ...source, statements: source.statements.filter(statement => statement !== definition) }, definition, deferred, Math.max(0, origin))
    if (following !== null) { return done(following) }
    const index = source.statements.findIndex(statement => statement !== definition && freeBindings({ statements: [statement], exit: ['yield', []] }).includes(definition[1]))
    const branch = source.statements[Number(index)]
    if (branch !== undefined && origin >= index) { return done(null) }
    const outside = /** @type {Block} */ ({ statements: source.statements.filter(statement => statement !== definition && statement !== branch), exit: branch === undefined ? ['yield', []] : source.exit })
    const crossed = source.statements.slice(origin + 1, branch === undefined ? source.statements.length : index)
    if (references(outside, definition[1], deferred) || shadows({ statements: crossed, exit: ['yield', []] }, recipeScope(definition), deferred)) { return done(null) }
    const kept = source.statements.filter(statement => statement !== definition)
    /** @type {<T>(found: _Arm<T> | null, over: (placed: T) => Block) => Task<Block | null>} */
    const within = (found, over) => found === null ? done(null)
        : bind(localizedTask(found.arm, definition, deferred, -1), body => done(body === null ? null : over(found.rebuilt(body))))
    return branch === undefined
        ? bind(exitArm(source.exit, definition[1], deferred), found => within(found, exit => ({ statements: kept, exit })))
        : bind(statementArm(branch, definition[1], deferred), found => within(found, placed => ({ ...source, statements: kept.map(statement => statement === branch ? placed : statement) })))
})), moved => {
    if (moved !== null) { return done(moved) }
    const standing = origin === -1 ? [definition, ...source.statements] : source.statements
    return done(certain({ ...source, statements: standing }, definition)
        ? { ...source, statements: standing.map(statement => statement === definition ? ['define', definition[1], definition[2], 'required'] : statement) }
        : null)
})

/** Each recipe moves to its first reached demand where one is proved. @type {(block: Block, inherited: readonly Definition[]) => Block} */
const placed = (block, inherited) => {
    let current = block
    for (const definition of block.statements.toReversed()) {
        if (definition[0] !== 'define' || definition[3] !== 'lazy') { continue }
        const deferred = /** @type {readonly Definition[]} */ ([...inherited, ...current.statements.flatMap(statement => statement[0] === 'define' && statement[3] === 'lazy' ? [statement] : [])])
        // a recipe carried into the exit's arm changes the exit with the statements
        current = run(localizedTask(current, definition, deferred, current.statements.indexOf(definition))) ?? current
    }
    return current
}

/** Selected arms and the following normal continuation retain one first-demand owner. @type {(block: Block, selected: Extract<Statement, readonly ['if', ...unknown[]]>, inherited: readonly Definition[], result: BindingId) => Block} */
const localRecipes = (block, selected, inherited, result) => {
    const visible = /** @type {readonly Definition[]} */ ([...inherited, ...block.statements.flatMap(statement => statement[0] === 'define' && statement[3] === 'lazy' ? [statement] : [])])
    return placed({ ...block, statements: followingRecipes(block, selected, visible, result) }, inherited)
}

/**
 * Prefix recipes reference already available bindings. Dependent declarations
 * follow each recovered result before another recipe is considered.
 * @type {(block: Block, deferred: readonly Definition[], inherited: readonly Definition[]) => Block | null}
 */
const recipeJoin = (block, deferred, inherited) => {
    for (let index = block.statements.length - 1; index >= 0; index = index - 1) {
        const branch = block.statements[Number(index)]
        if (branch[0] !== 'if') { continue }
        for (const definition of block.statements.slice(0, index)) {
            if (definition[0] !== 'define' || definition[3] !== 'lazy') { continue }
            const value = definition[2]
            if (!(value instanceof Array) || value[0] !== 'if' || !sameTest(value[1], branch[2])) { continue }
            if (!appendScope(branch, value[2], value[3], deferred)) { continue }
            if (!followingScope(block, branch, definition, deferred)) { continue }
            const earlier = /** @type {Block} */ ({ statements: block.statements.slice(0, index + 1).filter(statement => statement[0] !== 'define' || statement[3] !== 'lazy'), exit: ['yield', []] })
            if (references(earlier, definition[1], deferred)) { continue }
            const following = block.statements.slice(index + 1).find(statement => statement[0] !== 'define' || statement[3] !== 'lazy')
            const first = following === undefined ? /** @type {Value} */ (['array', exitValues(block.exit)])
                : following[0] === 'define' || following[0] === 'if' ? following[2] : null
            if (first === null || !firstDemand(first, definition[1], deferred)) { continue }
            const joined = /** @type {Extract<Statement, readonly ['if', ...unknown[]]>} */ (['if', [...branch[1], definition[1]], branch[2], yielded(branch[3], value[2]), yielded(branch[4], value[3])])
            return localRecipes({ ...block, statements: block.statements.filter(statement => statement !== definition).map(statement => statement === branch ? joined : statement) }, joined, inherited, definition[1])
        }
    }
    return null
}

/**
 * An adjacent required initializer can consume the selected normal result.
 * Keep declarations between the branch and its consumer outside this profile;
 * moving their reads into the branch would precede their lexical bindings.
 * @type {(block: Block, deferred: readonly Definition[], inherited: readonly Definition[]) => Task<Block | null>}
 */
const requiredJoin = (block, deferred, inherited) => {
    /** @type {(index: number) => Task<Block | null>} */
    const each = index => call(() => {
        if (index < 0) { return done(null) }
        const branch = block.statements[Number(index)]
        const following = block.statements[Number(index + 1)]
        if (branch[0] !== 'if' || following[0] !== 'define' || following[3] !== 'required') { return each(index - 1) }
        const result = /** @type {BindingId} */ ({ index: 0 })
        return bind(selectedTask(following[2], branch[2], result), selected => {
            if (selected === null || !sameScope(branch, selected, deferred) || !firstDemand(selected.value, result, deferred)) { return each(index - 1) }
            const joined = /** @type {Extract<Statement, readonly ['if', ...unknown[]]>} */ (['if', [...branch[1], result], branch[2], yielded(branch[3], selected.then), yielded(branch[4], selected.otherwise)])
            const mapped = { ...block, statements: block.statements.map((statement, position) => position === index ? joined
                : position === index + 1 ? /** @type {Statement} */ (['define', following[1], selected.value, 'required']) : statement) }
            return done(localRecipes(mapped, joined, inherited, result))
        })
    })
    return each(block.statements.length - 2)
}

/** Rejoin a residual selected value without copying its following computation. @type {(block: Block, inherited: readonly Definition[]) => Task<Block>} */
const joinTask = (block, inherited) => call(() => {
    // Placing a recipe can put a selection where a join reads it, a required
    // initializer after the statement that tests the same binding: the
    // block is joined again until placing changes nothing.
    /** @type {() => Task<Block>} */
    const settled = () => {
        const next = placed(block, inherited)
        return next === block ? done(next) : joinTask(next, inherited)
    }
    const deferred = /** @type {readonly Definition[]} */ ([...inherited, ...block.statements.flatMap(statement => statement[0] === 'define' && statement[3] === 'lazy' ? [statement] : [])])
    // A join carries a selection's arms into a statement's arms, which were
    // joined before they held them: the arms are joined again, then the block.
    /** @type {(joined: Block) => Task<Block>} */
    const rejoined = joined => {
        const visible = /** @type {readonly Definition[]} */ ([...inherited, ...joined.statements.flatMap(statement => statement[0] === 'define' && statement[3] === 'lazy' ? [statement] : [])])
        /** @type {(index: number, statements: readonly Statement[]) => Task<Block>} */
        const each = (index, statements) => call(() => {
            if (index === joined.statements.length) { return joinTask({ ...joined, statements }, inherited) }
            const statement = joined.statements[Number(index)]
            return statement[0] !== 'if' ? each(index + 1, [...statements, statement])
                : bind(joinTask(statement[3], visible), then => bind(joinTask(statement[4], visible), otherwise =>
                    each(index + 1, [...statements, ['if', statement[1], statement[2], then, otherwise]])))
        })
        return each(0, [])
    }
    return bind(requiredJoin(block, deferred, inherited), required => {
        if (required !== null) { return rejoined(required) }
        const recipe = recipeJoin(block, deferred, inherited)
        if (recipe !== null) { return rejoined(recipe) }
        const branch = block.statements.at(-1)
        if (branch === undefined || branch[0] !== 'if') { return settled() }
        const result = /** @type {BindingId} */ ({ index: 0 })
        const values = exitValues(block.exit)
        return bind(selectedTask(['array', values], branch[2], result), selected => {
            if (selected === null || !sameScope(branch, selected, deferred) || !firstDemand(selected.value, result, deferred)) { return settled() }
            const joined = /** @type {Statement} */ (['if', [...branch[1], result], branch[2], yielded(branch[3], selected.then), yielded(branch[4], selected.otherwise)])
            const replacement = /** @type {Extract<Value, readonly ['array', unknown]>} */ (selected.value)[1]
            const exit = block.exit
            const mapped = exitOver(/** @type {Exclude<Block['exit'], readonly ['loop', unknown]>} */ (exit), /** @type {readonly Value[]} */ (replacement))
            return rejoined(localRecipes({ statements: [...block.statements.slice(0, -1), joined], exit: mapped }, /** @type {Extract<Statement, readonly ['if', ...unknown[]]>} */ (joined), inherited, result))
        })
    })
})

/** A block whose statements and exit are the other's own. @type {(a: Block, b: Block) => boolean} */
const sameBlock = (a, b) => a.exit === b.exit && a.statements.length === b.statements.length && a.statements.every((statement, index) => statement === b.statements[Number(index)])

/** Statement regions share the existing explicit task stack; function bodies were planned separately. @type {(block: Block, inherited?: readonly Definition[]) => Task<Block>} */
const blockTask = (block, inherited = []) => {
    /**
     * The regions inside a value are blocks like any other: a block value's,
     * and a selection's two arms. A function's body was planned separately.
     * A value none of whose regions changes is answered as it was.
     *
     * Declared here and not beside `blockTask`: the two call each other, and
     * a module's `const`s are read in order, so neither can stand before
     * the other at module scope.
     *
     * @type {(value: Value, deferred: readonly Definition[]) => Task<Value>}
     */
    const valueTask = (value, deferred) => call(() => {
        if (!(value instanceof Array) || value[0] === 'ref' || value[0] === 'function') { return done(value) }
        if (value[0] === 'block') { return bind(blockTask(value[1], deferred), region => done(/** @type {Value} */ (sameBlock(region, value[1]) ? value : ['block', region]))) }
        if (value[0] === 'if') {
            return bind(valueTask(value[1], deferred), test => bind(blockTask(value[2], deferred), then => bind(blockTask(value[3], deferred), otherwise =>
                done(/** @type {Value} */ (test === value[1] && sameBlock(then, value[2]) && sameBlock(otherwise, value[3]) ? value : ['if', test, then, otherwise])))))
        }
        const operands = operatorOperands(value)
        /** @type {(index: number, mapped: readonly Value[]) => Task<Value>} */
        const operand = (index, mapped) => call(() => index === operands.length
            ? done(mapped.every((item, position) => item === operands[Number(position)]) ? value : mapOperator((_, position) => mapped[Number(position)])(value))
            : bind(valueTask(operands[Number(index)], deferred), item => operand(index + 1, [...mapped, item])))
        return operand(0, [])
    })
    /** @type {(index: number, statements: readonly Statement[], deferred?: readonly Definition[]) => Task<Block>} */
    const each = (index, statements, deferred = inherited) => call(() => {
        if (index === block.statements.length) {
            const exit = block.exit
            if (exit[0] === 'loop') { return bind(blockTask(exit[1].body, deferred), body => done({ statements, exit: ['loop', { ...exit[1], body }] })) }
            /** @type {Value} */
            const values = ['array', exitValues(exit)]
            return bind(valueTask(values, deferred), mapped => joinTask({ statements, exit: mapped === values ? exit
                : exitOver(exit, /** @type {readonly Value[]} */ (/** @type {Extract<Value, readonly ['array', unknown]>} */ (mapped)[1])) }, inherited))
        }
        const statement = block.statements[Number(index)]
        if (statement[0] === 'define') {
            return bind(valueTask(statement[2], deferred), value => {
                /** @type {Definition} */
                const next = value === statement[2] ? statement : ['define', statement[1], value, statement[3]]
                return each(index + 1, [...statements, next], next[3] === 'lazy' ? [...deferred, next] : deferred)
            })
        }
        if (statement[0] === 'loop') { return bind(blockTask(statement[1].body, deferred), body => each(index + 1, [...statements, ['loop', { ...statement[1], body }]], deferred)) }
        if (statement[0] === 'block') { return bind(blockTask(statement[2], deferred), body => each(index + 1, [...statements, _forwardResult(['block', statement[1], body])], deferred)) }
        return bind(blockTask(statement[3], deferred), left => bind(blockTask(statement[4], deferred), right => each(index + 1, [...statements, ['if', statement[1], statement[2], left, right]], deferred)))
    })
    return each(0, [])
}

/** Recover selected normal results after common tail-control placement. @type {(block: Block) => Block} */
export const _joinResults = block => run(blockTask(block))
