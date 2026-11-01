/** Direct FAST fixtures retain true lazy initializers absent from source input.
 * @import { BindingId, Block, Function as FastFunction, FunctionTarget, Item, Statement, Value } from '../../../js/ast/types.ts'
 */

/** @type {() => BindingId} */
const id = () => ({ index: 0 })
/** @type {() => FunctionTarget} */
const owner = () => ({ kind: 'function', index: 0 })
/** @type {(binding: BindingId) => Value} */
const ref = binding => ['ref', binding]
/** @type {(exit: Block['exit'], statements?: readonly Statement[]) => Block} */
const block = (exit, statements = []) => ({ statements, exit })
/** @type {(value: Value) => Block} */
const yielded = value => block(['yield', [value]])

/** A closure observes its creating invocation's immutable value. @type {(value: Value) => Value} */
const capture = value => {
    const target = owner(), binding = id()
    return ['function', { target, parameters: [], rest: null, self: null,
        captures: [{ binding, value }], body: block(['return', target, ref(binding)]) }]
}

/** @type {(target: FunctionTarget, value: Value, statements?: readonly Statement[]) => Block} */
const terminal = (target, value, statements = []) => block(['loop', {
    target: { kind: 'loop', index: 0 }, parameters: [], initial: [], results: [], body: block(['return', target, value], statements),
}])

/** @type {(target: FunctionTarget, callee: Value, count: Value, args: readonly Item<Value>[], base?: Value) => Block} */
const countdown = (target, callee, count, args, base = 7) => block(['return', target, ['()', callee, args]], [
    ['if', [], ['===', count, 0], block(['return', target, base]), block(['yield', []])],
])

/** @type {(target: FunctionTarget, parameters: readonly BindingId[], self: BindingId, cell: BindingId, initializer: Value, consumer: Block, rest?: BindingId | null, prefix?: readonly Statement[]) => FastFunction} */
const deferred = (target, parameters, self, cell, initializer, consumer, rest = null, prefix = []) => ({
    target, parameters, self, rest, captures: [], body: { ...consumer,
        statements: [...prefix, ['define', cell, initializer, 'lazy'], ...consumer.statements],
    },
})

/** @type {(ordinary: boolean) => FastFunction} */
const basic = ordinary => {
    const target = owner(), self = id(), n = id(), cell = id()
    const loop = /** @type {const} */ ({ kind: 'loop', index: 0 })
    /** @type {Block} */
    const consumer = ordinary ? block(['return', target, 7], [['loop', {
        target: loop, parameters: [], initial: [], results: [], body: block(['break', loop, []], [
            ['if', [], ['>', ref(n), 0], block(['return', target, ref(cell)]), block(['yield', []])],
        ]),
    }]]) : terminal(target, ref(cell))
    return deferred(target, [n], self, cell, ['block', countdown(target, ref(self), ref(n), [['-', ref(n), 1]])], consumer)
}

/** A dependent recipe must forward its prerequisite's abrupt completion. @type {() => FastFunction} */
const nestedRecipe = () => {
    const target = owner(), self = id(), n = id(), inner = id(), outer = id()
    return deferred(target, [n], self, outer, ['array', [ref(inner), ref(inner)]], terminal(target, ref(outer)), null, [
        ['define', inner, ['block', countdown(target, ref(self), ref(n), [['-', ref(n), 1]])], 'lazy'],
    ])
}

/** Immutable aliases retain the same self identity on either side of a recipe. @type {(inside: boolean) => FastFunction} */
const aliased = inside => {
    const target = owner(), self = id(), alias = id(), n = id(), cell = id()
    const body = countdown(target, ref(alias), ref(n), [['-', ref(n), 1]])
    /** @type {Statement} */
    const definition = ['define', alias, ref(self), 'lazy']
    return deferred(target, [n], self, cell, ['block', inside ? { ...body, statements: [definition, ...body.statements] } : body],
        terminal(target, ref(cell)), null, inside ? [] : [definition])
}

/** Selected if/block/comma results retain one old argument snapshot. @type {() => FastFunction} */
const tailValues = () => {
    const target = owner(), self = id(), n = id(), left = id(), right = id(), pair = id(), cell = id()
    /** @type {readonly Item<Value>[]} */
    const args = [['...', ['array', [['-', ref(n), 1], ['.', ref(pair), 1], ['.', ref(pair), 0]]]], 5]
    /** @type {Value} */
    const call = ['()', ref(self), args]
    const recursive = block(['yield', [[',', [['+', ref(n), 0], call]]]], [
        ['define', pair, ['array', [ref(left), ref(right)]], 'required'],
    ])
    return deferred(target, [n, left, right], self, cell, ['block', block(['return', target, ['if', ['===', ref(n), 0],
        yielded(['array', [ref(left), ref(right)]]), yielded(['block', recursive]),
    ]])], terminal(target, ref(cell)))
}

/** A recipe-local allocation remains captured after the next invocation. @type {() => FastFunction} */
const captures = () => {
    const target = owner(), self = id(), n = id(), saved = id(), value = id(), cell = id()
    const body = countdown(target, ref(self), ref(n), [['-', ref(n), 1], capture(ref(value))], ['array', [ref(value), ['()', ref(saved), []]]])
    return deferred(target, [n, saved], self, cell, ['block', { ...body, statements: [
        ['define', value, ['array', [ref(n)]], 'required'], ...body.statements,
    ] }], terminal(target, ref(cell)))
}

/** Undemanded recipes and unselected arguments stay skipped. @type {() => FastFunction} */
const extraArguments = () => {
    const target = owner(), self = id(), n = id(), selected = id(), cell = id()
    /** @type {Value} */
    const extra = ['if', ref(selected), yielded(['+', 1n, 1]), yielded(undefined)]
    return deferred(target, [n, selected], self, cell, ['block', countdown(target, ref(self), ref(n), [
        ['-', ref(n), 1], ref(selected), extra,
    ])], terminal(target, ref(cell), [
        ['if', [], ['<', ref(n), 0], block(['return', target, 9]), block(['yield', []])],
    ]))
}

/** A reached failed expansion is not erased by the fixed invocation prefix. @type {() => FastFunction} */
const failedSpread = () => {
    const target = owner(), self = id(), n = id(), cell = id()
    return deferred(target, [n], self, cell, ['block', countdown(target, ref(self), ref(n), [
        ['-', ref(n), 1], ['...', undefined],
    ])], terminal(target, ref(cell)))
}

/** Empty or populated rest arrays are fresh, shared, and captured per invocation. @type {() => FastFunction} */
const rest = () => {
    const target = owner(), self = id(), n = id(), saved = id(), items = id(), cell = id()
    return deferred(target, [n, saved], self, cell, ['block', countdown(target, ref(self), ref(n), [
        ['-', ref(n), 1], capture(ref(items)), ['...', ref(items)],
    ], ['array', [['()', ref(saved), []], ref(items), ref(items), capture(ref(items))]])], terminal(target, ref(cell)), items)
}

/** The observed rest array is the whole public invocation signature. @type {() => FastFunction} */
const restOnly = () => {
    const target = owner(), self = id(), items = id(), cell = id()
    /** @type {Value} */
    const count = ['.', ref(items), 0]
    return deferred(target, [], self, cell, ['block', countdown(target, ref(self), count, [
        ['-', count, 1], ['+', ['.', ref(items), 1], 1],
    ], ['.', ref(items), 1])], terminal(target, ref(cell)), items)
}

/** Normal memo values can resemble any private completion packet. @type {() => FastFunction} */
const normalPayload = () => {
    const target = owner(), self = id(), n = id(), selected = id(), tag = id(), cell = id()
    /** @type {Value} */
    const condition = ['if', ref(selected), yielded(['>', ref(n), 0]), yielded(false)]
    return deferred(target, [n, selected, tag], self, cell, ['block', block(['yield', [['array', [ref(tag), ['array', [ref(n)]]]]]], [
        ['if', [], condition, block(['return', target, ['()', ref(self), [['-', ref(n), 1], ref(selected), ref(tag)]]]), block(['yield', []])],
    ])], terminal(target, ['array', [ref(cell), ref(cell)]]))
}

/** This recursion has required work after its call and must remain ordinary. @type {() => FastFunction} */
const nonTail = () => {
    const target = owner(), self = id(), n = id(), cell = id()
    return deferred(target, [n], self, cell, ['block', block(['return', target, ['+', ['()', ref(self), [['-', ref(n), 1]]], 1]], [
        ['if', [], ['===', ref(n), 0], block(['return', target, 0]), block(['yield', []])],
    ])], terminal(target, ref(cell)))
}

/** The loop-local cell is declared only after two ordinary iterations. @type {() => FastFunction} */
const localReset = () => {
    const target = owner(), self = id(), n = id(), total = id(), step = id(), cell = id()
    const loop = /** @type {const} */ ({ kind: 'loop', index: 0 })
    /** @type {Value} */
    const updated = ['+', ref(total), ref(step)]
    return { target, parameters: [n, total], rest: null, self, captures: [], body: block(['loop', {
        target: loop, parameters: [step], initial: [0], results: [], body: block(['return', target, ref(cell)], [
            ['if', [], ['<', ref(step), 2], block(['continue', loop, [['+', ref(step), 1]]]), block(['yield', []])],
            ['define', cell, ['block', countdown(target, ref(self), ref(n), [['-', ref(n), 1], updated], updated)], 'lazy'],
        ]),
    }]) }
}

/** Fresh resolved identities for native JS, represented evaluation, and Rust generation. */
export const _fixtures = () => /** @type {const} */ ({
    terminal: basic(false), ordinary: basic(true), nestedRecipe: nestedRecipe(),
    insideAlias: aliased(true), outsideAlias: aliased(false), tailValues: tailValues(),
    captures: captures(), extraArguments: extraArguments(), failedSpread: failedSpread(),
    rest: rest(), restOnly: restOnly(), normalPayload: normalPayload(), nonTail: nonTail(), localReset: localReset(),
})
