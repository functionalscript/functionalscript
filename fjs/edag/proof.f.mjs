import { assertEq, assertStructurallySame } from '../asserts/module.f.mjs'
import { propertyValidate, validate } from './module.f.mjs'

/**
 * A valid EDAG comes back as the value it was given — `assertEq`, not a
 * structural comparison, because the identity is the point: it is what carries
 * the graph's sharing past the check.
 * @type {(value: unknown) => void}
 */
const assertValid = value => {
    const [tag, node] = validate(value)
    assertEq(tag, 'ok', node)
    assertEq(node, value)
}

/** @type {(value: unknown) => (path: readonly string[]) => (message: string) => void} */
const assertInvalid = value => path => message =>
    assertStructurallySame(validate(value), ['error', { path, message }])

const constant = {
    bigint: () => assertValid(42n),
    boolean: () => assertValid(false),
    number: () => assertValid(-0),
    string: () => assertValid('hello'),
    undefined: () => assertValid(undefined),
    null: () => assertValid(null),
    // A plain object is reserved, and an object *value* is built by `['{}']`,
    // so the two never compete for the same spelling.
    object: () => assertInvalid({ a: 1 })([])('a plain object is not an EDAG node'),
    function: () => assertInvalid(() => 0)([])('a function or a symbol is not an EDAG node'),
    symbol: () => assertInvalid(Symbol())([])('a function or a symbol is not an EDAG node'),
}

const args = {
    ok: () => assertValid(['args']),
    operand: () => assertInvalid(['args', 0])([])('["args"] takes no operands'),
}

const arrayNode = {
    empty: () => assertValid(['[]']),
    elements: () => assertValid(['[]', 1, 'two', ['args']]),
    nested: () => assertValid(['[]', ['[]', ['[]']]]),
    element: () => assertInvalid(['[]', 0, {}])(['2'])('a plain object is not an EDAG node'),
}

const objectNode = {
    empty: () => assertValid(['{}']),
    entries: () => assertValid(['{}', [':', 'x', 1], [':', 'y', ['args']]]),
    // Duplicate keys are valid and applied in order, as in JavaScript.
    duplicate: () => assertValid(['{}', [':', 'x', 1], [':', 'x', 2]]),
    // `__proto__` is an ordinary data key in an entry; only *printing* it
    // needs the computed spelling.
    proto: () => assertValid(['{}', [':', '__proto__', 1]]),
    notEntry: () => assertInvalid(['{}', 'x'])(['1'])('an object entry must be an entry descriptor'),
    unknownForm: () => assertInvalid(['{}', ['...', ['args']]])(['1'])('an unknown object entry form'),
    arity: () => assertInvalid(['{}', [':', 'x']])(['1'])('[":"] takes a key and a value'),
    key: () => assertInvalid(['{}', [':', 0, 1]])(['1', '1'])('an entry key must be a string constant'),
    value: () => assertInvalid(['{}', [':', 'x', Symbol()]])(['1', '2'])('a function or a symbol is not an EDAG node'),
}

const property = {
    name: () => assertValid(['.', ['args'], 'length']),
    index: () => assertValid(['.', ['args'], 0]),
    // The module-scope shape of an imported value: import parameter 0.
    import: () => assertValid(['.', ['args'], 0]),
    arity: () => assertInvalid(['.', ['args']])([])('["."] takes an object and a property'),
    // A run-time-computed string has no spelling here at all, which is what
    // makes prototype-chain lookup by a computed name unrepresentable.
    computed: () => assertInvalid(['.', ['args'], ['.', ['args'], 0]])(['2'])('a property must be a string or number constant'),
    prohibited: () => assertInvalid(['.', ['args'], 'constructor'])(['2'])('a prohibited property name'),
    object: () => assertInvalid(['.', {}, 0])(['1'])('a plain object is not an EDAG node'),
}

const propertyOperand = {
    number: () => assertStructurallySame(propertyValidate(1.5), ['ok', 1.5]),
    permitted: () => {
        assertStructurallySame(propertyValidate('length'), ['ok', 'length'])
        assertStructurallySame(propertyValidate('size'), ['ok', 'size'])
        assertStructurallySame(propertyValidate('x'), ['ok', 'x'])
    },
    prohibited: () => {
        /** @type {(name: string) => void} */
        const rejected = name =>
            assertStructurallySame(propertyValidate(name), ['error', { path: [], message: 'a prohibited property name' }])
        // one name per table 2330 tabulates
        rejected('__proto__')
        rejected('constructor')
        rejected('toString')
        rejected('map')
        rejected('copyWithin')
        rejected('bind')
        rejected('get')
    },
    other: () =>
        assertStructurallySame(
            propertyValidate(0n),
            ['error', { path: [], message: 'a property must be a string or number constant' }]),
}

const graph = {
    // Two positions holding one node: the array's elements are the same
    // object, and the node is validated once.
    shared: () => {
        const x = ['[]', 1]
        assertValid(['[]', x, x])
    },
    // Sharing the key and value *nodes* of two entries stays valid; only the
    // entry descriptor itself is not shareable.
    sharedEntryValue: () => {
        const v = ['[]']
        assertValid(['{}', [':', 'x', v], [':', 'y', v]])
    },
    entryDescriptor: () => {
        const e = [':', 'x', 1]
        assertInvalid(['{}', e, e])(['2'])('an entry descriptor is not shareable')
    },
    // The one hostile input that cannot be written down as a literal: an EDAG
    // is cyclic only once something mutates it into one, which is exactly why
    // validation cannot take acyclicity on trust.
    cycle: () => {
        /** @type {unknown[]} */
        const self = ['[]']
        self[1] = self
        assertInvalid(self)(['1'])('a cycle is not an EDAG')
    },
    // A node whose validation already completed is ordinary sharing when it
    // reappears, and a cycle only while it is still open.
    reentrant: () => {
        /** @type {unknown[]} */
        const inner = ['[]']
        const outer = ['[]', inner, inner]
        inner[1] = outer
        assertInvalid(outer)(['1', '1'])('a cycle is not an EDAG')
    },
}

export const proof = {
    constant,
    args,
    arrayNode,
    objectNode,
    property,
    propertyOperand,
    graph,
    unknownTag: () => assertInvalid(['?'])([])('an unknown operation tag'),
    // The whole stage 1 vocabulary in one graph — the compiled form of
    // `import a from './a.f.js'; const x = [a, 1]; export default {x: x, y: x}`.
    module: () => {
        const a = ['.', ['args'], 0]
        const x = ['[]', a, 1]
        assertValid(['{}', [':', 'x', x], [':', 'y', x]])
    },
}
