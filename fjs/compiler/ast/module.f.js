/**
 * Source operator vocabulary and grammar precedence. Graph construction and
 * semantic binding analysis live in shared FAST passes, not this module.
 *
 * @module
 * @import { BinaryTag, UnaryTag } from './types.ts'
 */

/**
 * Every binary operator's tag, {@link BinaryTag} at run time — pinned to it
 * in `./types.ts`, so a tag added to one and not the other is a type error.
 * What reads a binary node asks {@link isBinary} instead of listing the
 * tags again, so a new operator is written here and in the grammar, and
 * nowhere a missed `case` would read it as something else.
 */
export const binaryTags = /** @type {const} */ ([
    '*', '/', '%', '**',
    '+', '-',
    '===', '!==', '<', '<=', '>', '>=',
    '&', '|', '^', '<<', '>>', '>>>',
    '&&', '||', '??',
])

/** Assignment spellings and their existing binary operation; plain assignment has none. */
export const assignmentOperators = /** @type {const} */ ({
    plain: ['=', null],
    add: ['+=', '+'], sub: ['-=', '-'], mul: ['*=', '*'], div: ['/=', '/'],
    mod: ['%=', '%'], pow: ['**=', '**'],
    left: ['<<=', '<<'], right: ['>>=', '>>'], unsigned: ['>>>=', '>>>'],
    and: ['&=', '&'], xor: ['^=', '^'], or: ['|=', '|'],
    logicalAnd: ['&&=', '&&'], logicalOr: ['||=', '||'], nullish: ['??=', '??'],
})

/**
 * The eager binary layers, tightest first: one record per level, each
 * operator keyed by a name no other layer uses and valued by its tag,
 * which is also its token. The one statement of their precedence — the
 * grammar builds its ladder from it and the writer the parentheses it
 * needs. The `-` here is subtraction, sharing a token and nothing else
 * with the negation prefix, unary negation. `instanceof` is a relational
 * operator, one level with `<` and left-associative as it is, though its
 * node is a constructor check, not a binary one; so is `in`, whose node is
 * an entry check carrying its key, the string literal on its left, as a
 * spelling. `==` and `!=` are not
 * this language's, per `spec/operators/README.md`. `**` is in
 * no layer: it is right-associative and read inside the operand, so each
 * side places it, tightest of all, where it builds its own structure.
 * Pinned beside {@link binaryTags} in `./types.ts`.
 */
export const eagerLayers = /** @type {const} */ ([
    { mul: '*', div: '/', mod: '%' },
    { add: '+', sub: '-' },
    { left: '<<', right: '>>', unsigned: '>>>' },
    { lt: '<', le: '<=', gt: '>', ge: '>=', instanceof: 'instanceof', in: 'in' },
    { eq: '===', ne: '!==' },
    { and: '&' },
    { xor: '^' },
    { or: '|' },
])

/**
 * The lazy layers above {@link eagerLayers}, tightest first, as they are
 * keyed. `??` shares a level with `||` and mixes with neither it nor `&&`
 * bare — a refusal the grammar states, not an order.
 */
export const lazyLayers = /** @type {const} */ ([
    { logicalAnd: '&&' },
    { logicalOr: '||', nullish: '??' },
])

/**
 * Whether a node is a binary operator, a source node of three entries: a tag of {@link binaryTags} and two operands.
 * The arity is what tells a subtraction from the negation `['-', a]`.
 *
 * @param {readonly unknown[]} node
 * @returns {node is readonly [BinaryTag, unknown, unknown]}
 */
export const isBinary = node => node.length === 3 && binaryTags.some(tag => tag === node[0])

/**
 * Every unary operator's tag, {@link UnaryTag} at run time — pinned to it in
 * `./types.ts` as {@link binaryTags} is to its own: the prefixes `-`, `~`,
 * `!` and `typeof`, and the `Number` and `String` conversions, each a node
 * of one operand. `instanceof` is not one: its node carries the constructor
 * name too. Nor is `throw`, which ends a body rather than computing a value.
 */
export const unaryTags = /** @type {const} */ (['-', '~', '!', 'typeof', 'Number', 'String'])

/**
 * Whether a node is a unary operator, a source node of two entries: a tag of {@link unaryTags} and one operand. The
 * arity is what tells the negation `['-', a]` from a subtraction.
 *
 * @param {readonly unknown[]} node
 * @returns {node is readonly [UnaryTag, unknown]}
 */
export const isUnary = node => node.length === 2 && unaryTags.some(tag => tag === node[0])
