/**
 * The layer every BNF matcher backend shares: the {@link Cursor} it matches at,
 * the {@link Ast} it builds, and the constructors that pair them.
 *
 * `fjs/bnf/ll1` and `fjs/bnf/descent` are two machines over one contract, and
 * the contract is what lives here — not the machines. Backtracking, frame
 * shapes, failure reporting and the public result type are each backend's own,
 * and deliberately different; where the input sits, what a consumed symbol
 * contributes to the AST, and how a node is built are not.
 *
 * The three are one module rather than three because they are interdependent:
 * {@link leafAt} produces AST leaves, and {@link mrSuccess} builds AST nodes
 * positioned by a cursor. Splitting them would put one concept behind three
 * imports.
 *
 * See `./types.ts` for the type-level API and `./README.md` for the contract
 * this implements.
 *
 * @module
 *
 * @import { Ast, AstResult, AstSequence, AstTag, Cursor } from './types.ts'
 */

import { eofSymbol } from '../module.f.mjs'

/**
 * What consuming the symbol at a cursor contributes to the AST: the leaf
 * itself, and nothing for the synthesized end-of-input symbol — it has no
 * physical source element, so it never reaches an AST.
 *
 * @type {<L>(input: readonly L[], pos: Cursor) => AstSequence<L>}
 */
export const leafAt = (input, pos) => pos < input.length ? [input[pos]] : []

/**
 * The semantic symbol a cursor points at: one read out of the physical input,
 * and the synthesized {@link eofSymbol} at its end. Only meaningful where the
 * cursor still has a symbol, `pos <= input.length`.
 *
 * `symbolOf` is the one place backends differ — it is how a leaf yields its
 * symbol, `identity` where the leaf *is* the code point and a destructuring
 * where it carries metadata alongside. Each backend binds its own partial
 * application once at module scope.
 *
 * @type {<L>(symbolOf: (leaf: L) => number) => (input: readonly L[], pos: Cursor) => number}
 */
export const symbolAt = symbolOf => (input, pos) =>
    pos < input.length ? symbolOf(input[pos]) : eofSymbol

/**
 * The public, physical index of a cursor. Consuming the synthesized
 * end-of-input symbol moves the cursor past the physical end, and both cursors
 * report `length`.
 *
 * @type {(length: number) => (pos: Cursor) => number}
 */
export const physicalIdx = length => pos => Math.min(pos, length)

/**
 * @template L
 * @template P
 * @typedef {(tag: AstTag, sequence: AstSequence<L>, pos: P) => AstResult<L, P>} _Mr
 */

/** @type {<L, P>(success: boolean) => _Mr<L, P>} */
const mr = success => (tag, sequence, pos) => ({ ast: { tag, sequence }, success, pos })

/**
 * A matched node at a position.
 *
 * @type {<L, P>(tag: AstTag, sequence: AstSequence<L>, pos: P) => AstResult<L, P>}
 */
export const mrSuccess = mr(true)

/**
 * A node that did not match, at the position the caller should resume from —
 * which a backtracking backend rewinds and a predictive one does not.
 *
 * @type {<L, P>(tag: AstTag, sequence: AstSequence<L>, pos: P) => AstResult<L, P>}
 */
export const mrFail = mr(false)
