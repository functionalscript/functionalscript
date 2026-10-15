/**
 * Implementation-private types for `fjs/compiler/edag/module.f.mjs` and
 * its `demo.f.mjs`.
 *
 * @module
 */

import type { ConstructorId, Exp, Items, Properties } from '../../edag/types.ts'
import type { AstConst, BinaryTag, UnaryTag } from '../ast/types.ts'

/** The nodes a reference can name: one per import, one per entry lowered so far, the arguments of the function being lowered, and a read of each slot of its frame. */
export type _Nodes = {
    readonly parameters: readonly Exp[]
    readonly consts: readonly Exp[]
    readonly args: Exp
    readonly frame: readonly Exp[]
}

/**
 * `lower`'s own explicit stack, in place of the recursion a chain of
 * operator/prefix/conditional/throw nodes would
 * otherwise call it through: a node still to lower, a unary operator or a
 * `throw` whose one operand is already on top of `_LowerResults` and needs
 * its tag applied, an `instanceof` whose one operand is and needs its
 * constructor name, a binary operator whose two operands
 * are — right on top, left under it — or the
 * conditional whose three are, the else arm on top and the condition
 * lowest.
 */
export type _LowerWork =
    | { readonly kind: 'expand', readonly ast: AstConst, readonly rest: _LowerWork }
    | { readonly kind: 'unary', readonly tag: UnaryTag | 'throw', readonly rest: _LowerWork }
    | { readonly kind: 'instanceof', readonly name: ConstructorId, readonly rest: _LowerWork }
    | { readonly kind: 'binary', readonly tag: BinaryTag, readonly rest: _LowerWork }
    | { readonly kind: 'ternary', readonly rest: _LowerWork }
    | null

/** The values `_LowerWork`'s combine steps read and replace, most recently lowered on top. */
export type _LowerResults = { readonly top: _Lowered, readonly rest: _LowerResults } | null

/**
 * A lowered value and what it floats: the roots an inlined body anchors —
 * its `const`s the value does not reach — carried up through eager
 * positions to the nearest block root, a scope's root or a lazy operand,
 * where the comma establishes them before the value.
 */
export type _Lowered = _LoweredOver<Exp>

/** An item lowered: a value's {@link _Lowered}, or a spread item's over its operand's. */
export type _LoweredItem = _LoweredOver<Items>

/** An entry lowered: a member's property over its value's, or a spread's. */
export type _LoweredEntry = _LoweredOver<Properties>

/** A lowered `E`, and what it floats. */
export type _LoweredOver<E> = {
    readonly exp: E
    readonly anchors: readonly Exp[]
}

/** The entries of a body lowered so far: each entry's node, and beside each what lowering it floated. */
export type _Entries = {
    readonly nodes: readonly Exp[]
    readonly floated: readonly (readonly Exp[])[]
}

/**
 * A module's full result and its export bindings. Select once so repeated
 * imports share the same computation, including its evaluation anchors.
 */
export type _Resolved = {
    readonly exports: Exp
    readonly bindings: readonly (readonly [string, Exp])[]
    /**
     * What any binding of the module reaches that an importer may bind too:
     * the module's EDAG and its default value, and each node an import of it
     * was lowered over, with what that one reaches, at any depth.
     */
    readonly reached: readonly Exp[]
}

/** What an import binds, as the linker hands it to the importer: the node it selects, and what that node reaches, `_Resolved`'s. */
export type _Bound = {
    readonly node: Exp
    readonly reached: readonly Exp[]
}

/** An edge of `demo.f.mjs`'s drawing: a port's label, the value it reaches, and `lazy` where the position is one the node may never evaluate. */
export type _Child = readonly [label: string, value: Exp, kind?: 'lazy']

/**
 * A chain `demo.f.mjs` is drawing, one node however many steps it has: the
 * label and ports so far, the spelling of the key the next call is on — none
 * after a call, whose value has no name — and whether a `?.` has been
 * passed, which makes the operands after it the ones a nullish value skips.
 */
export type _Chain = {
    readonly label: string
    readonly children: readonly _Child[]
    readonly key: string
    readonly lazy: boolean
}
