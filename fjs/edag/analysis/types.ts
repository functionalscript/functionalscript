/**
 * Type-level API of the EDAG analysis: the table a graph is read into, so
 * that a writer can hoist what is shared and an executor can cache it,
 * neither of them holding a structure keyed by node identity.
 *
 * An entry names its operands by index, so the table is the graph in
 * another spelling: a consumer runs it or writes it and never touches the
 * EDAG's objects again. `Node` is the EDAG's node kinds over another
 * operand type, `Over` in [`../types.ts`](../types.ts) — every operand
 * position holds an {@link Operand} where the EDAG holds an `Exp` — so a
 * node kind added to the EDAG is a node kind here without a second
 * declaration to keep in step.
 *
 * @module
 */

import type { Assert } from '../../asserts/types.ts'
import type { Equal } from '../../types/ts/types.ts'
import type { Call, Dot, ExpOp, Op1, Op2, Over, Primitive, StepOver } from '../types.ts'

/** An entry of the table, by index. */
export type Ref = readonly ['#', number]

/**
 * An operand: an entry by index, or a primitive written in place. A
 * primitive is a leaf, evaluated where it stands, and takes no index.
 */
export type Operand = Ref | Primitive

/**
 * The naming operand of `.`, `?.` and the `|.` step: a string or a number
 * as written, or the `Number` node a computed key is, by index.
 */
export type IndexOperand = Ref | number | string

/** An array item: an operand, or a spread of one. */
export type ItemOperand = Operand | readonly ['...', Operand]

/** An object entry: a key and a value, or a spread. */
export type PropertyOperand = readonly [':', Operand, Operand] | readonly ['...', Operand]

/** A chain step over operands. */
export type Step = StepOver<Operand, IndexOperand>

/** An entry of the table: the EDAG node with each operation-node operand replaced by its index. */
export type Node = Over<ExpOp, Operand, IndexOperand>

/**
 * The analysis of one program: every operation node once, in walk order,
 * with the scope each belongs to and the ones reached by more than one edge.
 *
 * The walk is depth-first from the root, operands in the order written,
 * each node listed after its operands and on the first edge that reaches
 * it — a function of the graph alone, so two analyses of one graph are one
 * table. A node whose scope is `-1` is at the module level; any other scope
 * is the index of the `=>` whose body holds the node, which comes after it,
 * as a node comes after its operands. `shared` is every entry written at
 * more than one place, in index order: reached by more than one edge, or
 * through an entry that is itself written at more than one place, since an
 * entry that merges is written wherever it is reached — see `analysis` in
 * [`module.f.mjs`](./module.f.mjs).
 */
export type Analysis = {
    readonly root: Operand
    readonly nodes: readonly Node[]
    readonly scope: readonly number[]
    readonly shared: readonly number[]
}

// A position of each kind translates as documented above; each claim was
// falsified once and seen to fail before being restored (`../../AGENTS.md`
// §1.4).

type _Op1 = Assert<Equal<Over<Op1, Operand, IndexOperand>, readonly [Op1[0], Operand]>>
type _Op2 = Assert<Equal<Over<Op2, Operand, IndexOperand>, readonly [Op2[0], Operand, Operand]>>
type _Call = Assert<Equal<Over<Call, Operand, IndexOperand>, readonly ['()', Operand, Operand]>>
type _Dot = Assert<Equal<Over<Dot, Operand, IndexOperand>,
    | readonly ['.', Operand, IndexOperand]
    | readonly ['.', Operand, IndexOperand, Step]>>
type _NodeIsClosed = Assert<Equal<Node extends readonly [ExpOp[0], ...readonly unknown[]] ? true : false, true>>
