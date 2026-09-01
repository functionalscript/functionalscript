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
 * @import { Monoid } from '../../common/monoid/types.ts'
 * @import { Rule } from '../types.ts'
 * @import { Entry, Meta, Out, RepeatTransformer, SequenceTransformer, TerminalTransformer, Transformer, TransformerMap, TransformerTools, VariantTransformer, _AstRepeatState } from './types.ts'
 */

import { eofSymbol } from '../module.f.mjs'
import { assert } from '../../asserts/module.f.mjs'
import { concat, toArray } from '../../types/list/module.f.mjs'

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
 * `symbolOf` is how a backend's leaf yields its symbol. Each backend binds its
 * partial application once at module scope.
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

/** @type {<L, P>(success: boolean) => (tag: AstTag, sequence: AstSequence<L>, pos: P) => AstResult<L, P>} */
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

/**
 * Default terminal transformer used when a rule has no explicit mapping.
 *
 * @type {(tag: AstTag) => <M>(value: Meta<M, number>) => Out<M, Ast<Meta<M, number>>>}
 */
export const astTerminal = tag => ([value, metadata]) => [
    { tag, sequence: value === eofSymbol ? [] : [[value, metadata]] },
    metadata,
]

/**
 * Default sequence transformer used when a rule has no explicit mapping.
 *
 * @type {(tag: AstTag) => <M>(value: Meta<M, readonly unknown[]>) => Out<M, Ast<unknown>>}
 */
export const astSequence = tag => ([items, metadata]) => [
    { tag, sequence: items },
    metadata,
]

/**
 * Default variant transformer. The selected branch node already carries the
 * variant tag, so the variant contributes no additional node.
 *
 * @type {<M>(value: Meta<M, readonly[string, Ast<unknown>]>) => Out<M, Ast<unknown>>}
 */
export const astVariant = ([[, node], metadata]) => [node, metadata]

/**
 * Default repetition transformer used when a rule has no explicit mapping.
 *
 * @type {<M>(monoid: Monoid<M>) => (tag: AstTag) => RepeatTransformer<M, unknown, _AstRepeatState<M>, Ast<unknown>>}
 */
export const astRepeat = monoid => tag => ({
    init: [null, monoid.identity],
    update: ([items, metadata], [item, itemMetadata]) => [
        concat(items)([item]),
        monoid.operation(metadata)(itemMetadata),
    ],
    end: ([items, metadata]) => [{ tag, sequence: toArray(items) }, metadata],
})

/**
 * Creates the metadata-bound transformer constructors shared by parser
 * backends. The fresh token makes entries and maps from another factory fail
 * before parsing even when their structural TypeScript types agree.
 *
 * @template M
 * @param {Monoid<M>} monoid
 * @returns {TransformerTools<M>}
 */
export const transformerTools = monoid => {
    const factory = Symbol()
    /** @type {Transformer<M, undefined>} */
    const unit = ['unit']
    return {
        entry: (rule, transformer) => ({ factory, rule, transformer }),
        map: (...entries) => {
            assert(entries.every(entry => entry.factory === factory), 'transformer factory mismatch')
            assert(entries.every((entry, i) => !entries.slice(0, i).some(previous => previous.rule === entry.rule)), 'duplicate rule transformer')
            return {
                factory,
                entries: new Map(entries.map(({ rule, transformer }) => [rule, transformer])),
            }
        },
        terminalOf: f => /** @type {any} */ (['terminal', f]),
        sequenceOf: (arity, f) => /** @type {any} */ (['sequence', arity, f]),
        variantOf: (branches, f) => /** @type {any} */ (['variant', branches, f]),
        repeatOf: (item, fold) => /** @type {any} */ (['repeat', item, fold]),
        unit,
    }
}
