/**
 * Type-level API for the FunctionalScript EDAG — an *expression DAG*: the
 * canonical representation of a compiled computation, expressed as an ordinary
 * FunctionalScript value.
 *
 * This file carries the **stage 1** vocabulary only: constants, the array and
 * object constructors, the arguments array, and property access. Functions
 * (`['=>', frame, body]`), calls (`['()', …]`, `['.()', …]`), operators, and
 * `[',', …]` are later stages and are deliberately absent — see
 * `../../todo/edag-stage1-discussion.md` for the full vocabulary and
 * `../djs/todo/compile-modules-to-edag.md` for the rollout order.
 *
 * Two properties of the shape are load-bearing and cannot be read off the
 * types:
 *
 * - **Sharing is semantic.** An operand position holds a real reference to a
 *   node, so referencing one node twice means *one* value used twice:
 *   `['[]', x, x]` builds an array whose two elements are the same object,
 *   while `['[]', ['{}'], ['{}']]` builds two distinct ones.
 * - **Validation is a total gate.** `Node` describes the shape a validated
 *   EDAG has, not everything TypeScript would accept here: a prohibited
 *   property name and a cyclic graph are both `Node`-shaped and both rejected
 *   by `validate` in `./module.f.mjs`.
 *
 * @module
 */

import type { Primitive } from '../types/rtti/ts/types.ts'

/**
 * A constant node — any non-object, non-array value, denoting itself.
 *
 * Functions, symbols, and plain objects are not constants: the first two have
 * no EDAG spelling at all, and plain objects are reserved for a future use
 * (an object *value* is built by `ObjectNode`, not written down directly).
 */
export type Constant = Primitive

/**
 * `['args']` — the arguments array of the enclosing function scope.
 *
 * It is one node yielding an array, not a list of operands, so a single
 * argument is `['.', ['args'], 0]` and forwarding the whole array is free.
 * At module scope it is the imported-module array; inside a (stage 2)
 * function body it is that invocation's arguments instead.
 */
export type ArgsNode = readonly ['args']

/** `['[]', ...node]` — an array constructor. */
export type ArrayNode = readonly ['[]', ...Node[]]

/**
 * `['{}', ...entry]` — an ordered object constructor.
 *
 * The entry sequence is retained exactly as written: JavaScript applies
 * object-literal definitions in source order, duplicate keys let a later entry
 * overwrite an earlier one, and insertion order of non-index keys is
 * observable. Entries are therefore never sorted.
 */
export type ObjectNode = readonly ['{}', ...Entry[]]

/**
 * `[':', key, value]` — one entry of an object constructor.
 *
 * An entry is a **structural operand** of `['{}', …]`, not a node: it is never
 * evaluated on its own, so its container identity carries no meaning and one
 * entry array must not appear in two entry positions. Its `key` and `value`
 * are ordinary nodes whose identities may be shared as usual.
 *
 * The key position is a node in the wider design so that computed keys can be
 * admitted later without changing the constructor's shape; stage 1 spells it
 * as a `string` because a string constant is all validation accepts —
 * arbitrary key expressions need `ToPropertyKey` coercion and failure
 * semantics first. `'__proto__'` is an ordinary data key here, never a
 * prototype assignment.
 */
export type Entry = readonly [':', string, Node]

/**
 * The property operand of `['.', object, property]`.
 *
 * A *constant* string or number, so the name is known when the graph is
 * validated rather than computed while it runs. That is what makes
 * prototype-chain lookup by a computed name unrepresentable rather than
 * merely checked. Not every `Property` is permitted: `validate` also rejects
 * the prohibited names — see `propertyValidate` in `./module.f.mjs`.
 *
 * Later stages widen this to the unary `['+', node]` / `['Number', node]`
 * forms, each guaranteed to yield a number or throw.
 */
export type Property = string | number

/** `['.', object, property]` — property access, JavaScript's `o.p` / `o[p]`. */
export type PropertyNode = readonly ['.', Node, Property]

/** A tagged operation node: everything that is not a constant. */
export type Operation = ArgsNode | ArrayNode | ObjectNode | PropertyNode

/** Any EDAG node — the operand type of every operation. */
export type Node = Constant | Operation
