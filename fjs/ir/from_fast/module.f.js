/**
 * The lowering from normalized FAST to the IR: the FAST that
 * [`edag/to_fast`](../../edag/to_fast/README.md) makes, before
 * [preparation](../../js/ast/prepare/README.md) adds mutable slots, as
 * [definition.md](../../../doc/sasha-gil/ir/definition.md#from-normalized-fast-to-the-ir)
 * reads it. It takes the part of the language that the
 * [README](./README.md) lists, for [the second slice](../todo/slices.md),
 * and refuses everything else
 * ([DESIGN.md §10](../../../doc/DESIGN.md#10-refuse-what-you-cannot-handle)).
 *
 * - **A module is the exported functions that a table names**, each by its
 *   export, and a call of another one, or of itself, is a `call` of `self`.
 *   The lowering reads the module's functions, not its evaluation: nothing
 *   else of the module is read unless a function that it lowers reads it.
 * - **A function that the module does not export is inlined at each
 *   call**, typed by what the call gives, as a function inside a function
 *   is; its captures are what the module's bindings are. One that calls
 *   itself, by its name or through others, is refused.
 * - **Each other definition of the module is a constant**, named for its
 *   place among them, `#c0` first, whose term reads only the constants
 *   before it, as `init` evaluates them in their order
 *   ([L0 design §20](../../../doc/sasha-gil/wasm/l0-design.md#20-a-program-is-one-module-with-an-init-export)).
 *   Its term is lowered as a function's body is, and reads an import itself
 *   where the normalization writes the read there. The module keeps the
 *   constants that the functions read, themselves or through the constants
 *   that they read. A constant of a record is refused, since no global
 *   holds one, and so is a read of a constant before its definition. A
 *   definition of `Math.abs` or `Math.sqrt` is that operator.
 * - **FAST has no types, so the table gives them**: each function's
 *   parameters and result, as a TypeScript signature names and types them.
 *   A `number` is an `f64`, a `boolean` a `bool`, a `bigint` the range that
 *   the table gives it, and a value of unknown kind `any`.
 * - **A program links L1** ([slice 11a](../todo/slices.md)): where the
 *   runtime gives L1's plain stage, every export is lowered, one that the
 *   table does not name of `any` alone, and an operator, a member read,
 *   `?.` and a call of operands that the IR does not take, values of
 *   `any` among them, is a call of L1's body, each float or boolean boxed
 *   as `any`. [`link`](./link/module.f.js#link) merges the bodies that the program reaches
 *   into the module, by their `l1.` names. A function of the module that
 *   calls itself, not last, and that the module does not export is a
 *   function of the IR there, `#h0` first, of `any` alone, which no export
 *   names: its copies, inlined, would never end.
 * - **An import of the L0 view is L0, and one of L1's native rows is
 *   `Native`.** The caller names the runtime, the specifiers of the view
 *   and of the rows, and the module then imports
 *   [the interfaces of L0](../l0/module.f.js) and
 *   [of the rows](../native/module.f.js). JavaScript reads a tag and a
 *   length as numbers, so each is a float here: `kind(v)` is
 *   `float(Any.kind(v))`, and a tag such as `BOOLEAN` is its float.
 *   `undefined` and `null` are Any's constants, which the host makes
 *   ([L0 design §3](../../../doc/sasha-gil/wasm/l0-design.md#3-constants-imported-immutable-globals)).
 *   `asBoolean`, `asNumber`, `asString`, `asArray`, `asObject` and
 *   `asFunction` are casts, to `to_bool`, `to_f64` and the value itself, and
 *   `length(v)` is a `match` of `v`'s kinds, an arm for each module of L0
 *   that has a `length`, and a trap for the kinds that none takes, or a call
 *   where one module takes them all. `unit(s, i)` reads the integer that the
 *   float `i` holds exactly, and traps where it holds none, and so do
 *   `fromUnit`, `substring` and `item` with their numbers. `find(o, k)` is
 *   Containers' `find` as a float, `text(f)` and `join(parts, separator)`
 *   Functions' `text` and Containers' `join`. `same`, `concat` and each
 *   native row cast each argument to the kinds that they take. `fromUnit`,
 *   `concat`, `substring`, `join` and `text` answer a string (or
 *   `undefined`, for `text`) and `item` a value that the caller owns, which
 *   the [lifetime pass](../lifetime/module.f.js) drops: the lowering writes
 *   the plain stage. A call of a function value is L0 `call(f, args)` with
 *   an args array, built by Containers or passed as it is when a single
 *   spread names a known array. `%` of two floats is the row
 *   `numberRemainder`. Any other import is refused, and so is a cast of a
 *   value that never holds its kind, which would always trap.
 * - **A throw is `Functions.throw`** of its value
 *   ([L0 design §13](../../../doc/sasha-gil/wasm/l0-design.md#13-errors-a-throw-traps)),
 *   a term of type `never`, which ends its block as a `return` does, and
 *   the checker types its value as `any`. A read of L1's error table,
 *   `error.k`, is the string literal of its text, which the runtime gives
 *   from the table's own text, so that the module throws what L1 throws.
 * - **An object literal of names and values whose fields are not all
 *   values of `any` is a record**, a product of its keys in their order,
 *   and `r.k` its field. A record stays in its function: the checker
 *   refuses one in a signature. One whose every value is of `any`, with the
 *   runtime, is built by Containers as an object. A spread in an object
 *   literal is refused outside a program; in one, it is L1's
 *   `objectSpread` of its value, as `spreadObject` builds it.
 * - **An array literal is built by Containers**
 *   ([L0 design §8](../../../doc/sasha-gil/wasm/l0-design.md#8-containers-a-builder-handle-then-seal)):
 *   its items first, each lowered where it stands as an argument is, then
 *   `seal` of a `push` of each item, in their order, onto `begin_array` of
 *   their count. Nothing between `begin_array` and `seal` traps or leaves,
 *   so the builder, which is linear, is never left behind. An item is a
 *   value of `any`: a number or a boolean meets it through `from_f64` or
 *   `from_bool`. An array in a module lowered without the runtime is
 *   refused, and so is a spread outside a program; in one, a spread in an
 *   array or in the arguments of a call is L1's `toIterable` of its value,
 *   and Containers' `push_all` pushes its items, as `spreadArray` builds it
 *   ([slice 11c](../todo/slices.md#decisions-for-slice-11-2026-11-20)).
 * - **`buildArray(n, s, next, at)` of the L0 view is one loop of
 *   Containers' builder**
 *   ([L0 design §22](../../../doc/sasha-gil/wasm/l0-design.md#22-building-in-one-pass)):
 *   `begin_array` of `n`, which must hold an index exactly, then each round
 *   pushes `at` of the state and, before the last item, steps it by
 *   `next`, and the round after the last seals the builder. The callbacks
 *   are arrow literals, inlined, so no closure is made. A throw inside one
 *   is refused, since it would leave the builder behind; a call there that
 *   fails abandons it, as a trap does. `asArray` is a cast.
 * - **`buildObject` and object literals of values of `any`**: Containers'
 *   `begin_object` / `push_property` / `seal`; arrow callbacks of
 *   `buildObject` inline as `buildArray`'s do; `asObject` is a cast.
 *   Float records stay products. A `{ ...v }` literal of a program copies
 *   what `objectSpread` makes, key by key, with Containers' `key`.
 * - **A read of an array at a number key is L1's `get` for that case**:
 *   the item where the key is an index of the array, an integer from `0`
 *   up to its length, and `undefined` where it is anything else. A member
 *   or index of sealed `any` of another kind is a call of the module's
 *   `get` where the signature table names it: `undefined` and `null`
 *   throw, and an object or a string reads by a string. Without `get` in
 *   the table, that read is refused.
 * - **The checker types the terms** that the lowering makes, so that the
 *   operand's type picks the operator where JavaScript has one for two
 *   types: `-x` is `neg` of a float and `0n - x` of an integer, `===` of two
 *   booleans is a `match`, and `Number(x)` is `float` of an integer.
 * - **A binding is a `let`**, of a local named by how many locals of FAST
 *   enclose it: `#0` is the first of a function, and the arms of a `match`
 *   may each have their own. A binding of a local is that local, and a
 *   `let` whose body is only its local is its value.
 * - **A `return` is the body's value in the tail of a function**, and a
 *   `br` to `return` anywhere else.
 * - **A statement that never completes ends its block**: a block or an `if`
 *   whose every path ends in a transfer stands where the block's end
 *   would, and what follows it is never reached.
 * - **A loop is a `loop`**, labelled by how many loops enclose it, `L0`.
 *   Its parameters are locals of the types of their first values, a float
 *   widened to `f64`, in a record too. `continue` is a `br` to it, and
 *   `break` is its value where it ends the loop's body.
 * - **A function inside a function is inlined where it is called.**
 *   Normalized FAST makes a function of each loop and calls it once. Its
 *   parameters stand for the arguments, each lowered where it stands: a
 *   term that does nothing as itself and anything else bound to a local,
 *   in whose scope the arguments after it are lowered. Its captures stand
 *   for what they read where the call stands, and the `return` that ends
 *   its body for its value.
 * - **A definition that only one function reads comes in a block around
 *   that function**, where the normalization puts it: a `const` that only a
 *   loop reads, or an import that only one function of the module reads.
 *   The block's statements stand where the function is defined.
 * - **A cast narrows the rest of its block**
 *   ([definition.md, rule 4](../../../doc/sasha-gil/ir/definition.md#from-normalized-fast-to-the-ir)).
 *   Where the first thing that a definition's value does is a cast of a
 *   local, `asString(a)` say, a `cast` of the local wraps the definition and
 *   the rest of the block, which read it at the cast's kind: `a.string`.
 *
 * The answer is a module for the [checker](../check/module.f.js), which
 * refuses what the IR does not admit, such as a `match` of a float.
 *
 * @module
 *
 * @import { Result } from '../../types/result/types.ts'
 * @import { AstImport } from '../../compiler/ast/types.ts'
 * @import { BindingId, Block, Entry, Exit, Function as FastFunction, Item, Key, Loop, Statement, Step, Value } from '../../js/ast/types.ts'
 * @import { Primitive } from '../../media/datajs/types.ts'
 * @import { ConstantOf, Fn, LoopParamOf, Module, OpName, Param, Signature, Term, Type } from '../types.ts'
 * @import { _Closure, _Context, _Errors, _FirstCast, _Global, _Import, _Lowered, _LowerBlock, _LowerStatement, _LowerValue, _Meaning, _Part, _Scope, _Tail } from './private.ts'
 */

import { assertNotNullish } from '../../asserts/module.f.js'
import { entry } from '../../types/object/entry/module.f.js'
import { error, mapOk, ok, okList, okThen } from '../../types/result/module.f.js'
import { ARRAY, BIGINT, BOOLEAN, FUNCTION, NULL, NUMBER, OBJECT, STRING, UNDEFINED } from '../../wasm/runtime/l0/module.f.js'
import { typeOf } from '../check/module.f.js'
import { any, array, builder, func, kinds, l0, lengths, object, string } from '../l0/module.f.js'
import {
    add, bool, call, cast, codeOf, constant, div, eq, equal, exact, f64, f64c, field, float, fn, get, if_, le, let_, lit, loop, lt,
    make, match, mul, n, ne, neg, next, not, only, product, return_, signature, sub, terms, throw_, trap, u,
} from '../module.f.js'
import { native } from '../native/module.f.js'
import { asAny, boolean, floats, inOrder, isAny, isFloat, nativeRow, numbered, numberPath, numberRow, numeric, primitive } from './numbers/module.f.js'
import { records } from '../records/module.f.js'
import { literals } from './literals/module.f.js'
import { lengthRead } from './reads/module.f.js'
import { everyLoop, filterLoops, locals as callbackLocals, names as callbackNames } from './callbacks/module.f.js'
import { bindTerm, castCall, casts, getOf, isPure, isSpread, l1Of, linking, pure, refuse, settled, settledParts, standsFor, values } from './scope/module.f.js'
import { link, linkAny, linkString, linkedName, uses } from './link/module.f.js'
import { show } from '../print/module.f.js'
import { module as anyModule } from '../runtime/any/module.f.js'
import { module as stringModule } from '../runtime/string/ir.f.js'

/** A count in a message: `one parameter`, `2 values`. @type {(k: number, noun: string) => string} */
const count = (k, noun) => k === 1 ? `one ${noun}` : `${k} ${noun}s`

/** The static functions that are operators of the IR. @type {(id: string) => OpName | null} */
const staticOp = id => id === 'Math.sqrt' ? 'sqrt' : id === 'Math.abs' ? 'abs' : null

/** The operator of the IR that a value is, where it is a static function that is one. @type {(v: Value) => OpName | null} */
const staticOf = v => v instanceof Array && v.length === 1 ? staticOp(v[0]) : null

/**
 * The condition of a choice: a `bool`, or, in a program that links L1, L1's
 * `toBoolean` of a value of `any`, or of a float boxed as one, as
 * JavaScript reads one.
 *
 * @type {(scope: _Scope, c: Term) => Term}
 */
const condition = (scope, c) => {
    const f = l1Of(scope, 'toBoolean')
    if (f === null) { return c }
    const t = typeOf(scope.ir)(c)
    const x = t[0] === 'error' || equal(t[1], bool) ? null : asAny(t[1], c)
    return x === null ? c : call('self', f, [x])
}

/**
 * The value of a function where it returns: a float or a boolean boxed as
 * `any` where the function's result is of `any`, as an untyped export of a
 * program answers one. The value of a function that is inlined, and one
 * that no conversion fits, is itself.
 *
 * @type {(scope: _Scope, x: Term) => Term}
 */
const returned = (scope, x) => {
    const { result } = scope.ir
    if (scope.inlining.length > 0 || result === undefined || !isAny(result)) { return x }
    const t = typeOf(scope.ir)(x)
    return t[0] === 'error' ? x : asAny(t[1], x) ?? x
}

/** What a binding stands for, or `null` for one from outside the function. @type {(scope: _Scope, b: BindingId) => _Meaning | null} */
const meaning = (scope, b) => scope.bindings.find(([x]) => x === b)?.[1] ?? scope.outer(b)

/** What the callee of a call stands for: a binding, or an import that a constant's term reads where it calls it. @type {(scope: _Scope, callee: Value) => _Meaning | null} */
const calleeOf = (scope, callee) => callee instanceof Array && callee[0] === 'ref' ? meaning(scope, callee[1]) : scope.imported(callee)

// blocks

/**
 * A term bound to a binding of FAST around the rest of its block: a `let`,
 * or the local itself where the term is a local.
 *
 * @type {(scope: _Scope, b: BindingId, r: Result<Term, string>, rest: (scope: _Scope) => Result<Term, string>) => Result<Term, string>}
 */
const bind = (scope, b, r, rest) => {
    if (r[0] === 'error') { return r }
    const [, x] = r
    return x[0] === 'get' ? rest(standsFor(scope, b, ['local', x[1]]))
        : bindTerm(scope, x, (next, name) => rest(standsFor(next, b, ['local', name])))
}

/**
 * Whether the end of a block may be reached, and so what follows it: not
 * where it ends in a transfer, nor where one of its statements never
 * completes, a block that never does or an `if` whose arms both never do.
 *
 * @type {(b: Block) => boolean}
 */
const completes = ({ statements, exit }) => exit[0] === 'yield' && statements.every(s =>
    s[0] === 'block' ? completes(s[2]) : s[0] === 'if' ? completes(s[3]) || completes(s[4]) : true)

/**
 * A value past the blocks that the normalization puts around it, where only
 * the value reads a binding, and the statements of those blocks, which
 * define the bindings: a function that alone reads an import, or a loop
 * that alone reads a `const`, comes in one.
 *
 * @type {(v: Value) => readonly [readonly Statement[], Value]}
 */
const unwrapped = v => {
    if (!(v instanceof Array) || v[0] !== 'block') { return [[], v] }
    const { statements, exit } = v[1]
    if (exit[0] !== 'yield' || exit[1].length !== 1) { return [[], v] }
    const [inner, w] = unwrapped(exit[1][0])
    return [[...statements, ...inner], w]
}

// casts

/** Whether a local holds a value of a sealed type that has `kind` and other kinds too, which a cast to `kind` narrows. @type {(scope: _Scope, name: string, kind: string) => boolean} */
const wider = (scope, name, kind) => {
    const [, t] = assertNotNullish(scope.ir.locals.find(([k]) => k === name))
    const held = t[0] === 'sealed' ? t[3] ?? kinds : []
    return held.includes(kind) && held.length > 1
}

/** The cast that values do first, in their order. @type {(checkFirst: _FirstCast, scope: _Scope, vs: readonly Item<Value>[]) => readonly [string, string] | 'nothing' | null} */
const firstOf = (checkFirst, scope, vs) => {
    if (vs.length === 0) { return 'nothing' }
    const [v, ...more] = vs
    const first = checkFirst(scope, v)
    return first === 'nothing' ? firstOf(checkFirst, scope, more) : first
}

/**
 * The cast that a value does first, as the local that it narrows and the
 * kind: a cast of the L0 view of a local that holds other kinds too, where
 * it is the first thing that the value does. A reference and a primitive
 * do `'nothing'`, and a call does what its arguments do, in their order,
 * then itself. `null` where the value does something else first, which a
 * call of anything but such a cast is, and so is anything else.
 *
 * @type {_FirstCast}
 */
const firstCast = (scope, v) => {
    if (!(v instanceof Array) || v[0] === 'ref') { return 'nothing' }
    if (v[0] !== '()') { return null }
    const [, callee, items] = v
    const m = calleeOf(scope, callee)
    const c = m !== null && m[0] === 'l0' ? casts.find(([k]) => k === m[1]) : undefined
    const [x] = items
    const local = items.length === 1 && x instanceof Array && x[0] === 'ref' ? meaning(scope, x[1]) : null
    if (c !== undefined && local !== null && local[0] === 'local' && wider(scope, local[1], c[1])) { return [local[1], c[1]] }
    const first = firstOf(firstCast, scope, items)
    return first === 'nothing' ? null : first
}

/**
 * The rest of a block where a cast narrows a local: a `cast` of the local
 * to the kind, its arm named after the local and the kind, `a.string`,
 * which every binding that read the local reads from then on.
 *
 * @type {(scope: _Scope, c: readonly [string, string], rest: (scope: _Scope) => Result<Term, string>) => Result<Term, string>}
 */
const narrow = (scope, [name, kind], rest) => {
    const binder = `${name}.${kind}`
    const t = only(any, kind)
    const { ir, bindings } = scope
    const body = rest({
        ...scope,
        ir: { ...ir, locals: [...ir.locals, [binder, t]] },
        bindings: bindings.map(([b, m]) => m[0] === 'local' && m[1] === name ? /** @type {const} */ ([b, ['local', binder]]) : [b, m]),
    })
    return body[0] === 'error' ? body : ok(cast(t, get(name), binder, body[1]))
}

/**
 * Two arms of an `if` at the same type: a float or boolean that meets
 * `any` is boxed
 * ([definition.md's rule 6](../../../doc/sasha-gil/ir/definition.md#from-normalized-fast-to-the-ir)).
 *
 * @type {(scope: _Scope, a: Term, b: Term) => readonly [Term, Term]}
 */
const aligned = (scope, a, b) => {
    // Leave an arm that typeOf cannot place yet under `scope.ir` (a nested
    // `br` to a loop label inside a non-transfer arm, as in a chain of
    // `if`s that ends in continue), and an arm that no `any` holds, as they
    // are: the checker types every arm again and refuses arms that no one
    // type holds, so nothing is boxed wrongly or let through.
    const ta = typeOf(scope.ir)(a)
    const tb = typeOf(scope.ir)(b)
    if (ta[0] === 'error' || tb[0] === 'error') { return [a, b] }
    // In a program, arms of two other types, a float and a boolean, meet as `any` too.
    const both = linking(scope) && !equal(ta[1], tb[1])
    const left = both || isAny(tb[1]) ? asAny(ta[1], a) : a
    const right = both || isAny(ta[1]) ? asAny(tb[1], b) : b
    if (left === null || right === null) { return [a, b] }
    return [left, right]
}

/**
 * A `br` / `trap`, or `let`s whose body is one: `aligned` cannot type those
 * under `scope.ir`, which has no loop labels. Statements before a continue
 * wrap the `br` in `let`s.
 *
 * @type {(t: Term) => boolean}
 */
const isTransfer = t => {
    let x = t
    while (x[0] === 'let') { x = x[3] }
    return x[0] === 'br' || x[0] === 'trap'
}

/** A term's local name, or `fallback` where it is no `get`. @type {(t: Term, fallback: string) => string} */
const localOf = (t, fallback) => t[0] === 'get' ? t[1] : fallback

/** @type {(lowerValue: _LowerValue, lowerBlock: _LowerBlock, scope: _Scope, c: Value, a: Block, b: Block, tail: _Tail) => Result<Term, string>} */
const choice = (lowerValue, lowerBlock, scope, c, a, b, tail) => {
    const parts = okList([lowerValue(scope, c), lowerBlock(lowerValue, scope, a, tail), lowerBlock(lowerValue, scope, b, tail)])
    if (parts[0] === 'error') { return parts }
    const [, test, x, y] = [null, parts[1][0], parts[1][1], parts[1][2]]
    const cond = condition(scope, test)
    if (isTransfer(x) || isTransfer(y)) { return ok(if_(cond, x, y)) }
    const [left, right] = aligned(scope, x, y)
    return ok(if_(cond, left, right))
}

// loops and inlined functions

/**
 * The type of a loop parameter whose first value is of `t`: a float widened
 * to `f64`, since a later round may give any float, and each field of a
 * record in turn. `null` where it holds an integer range, since no bound
 * holds what a later round may give it.
 *
 * @type {(t: Type) => Type | null}
 */
const loose = t => {
    if (t[0] !== 'product') { return isFloat(t) ? f64 : t[0] === 'int' ? null : t }
    const fields = t[1].flatMap(([k, x]) => {
        const y = loose(x)
        return y === null ? [] : [/** @type {const} */ ([k, y])]
    })
    return fields.length === t[1].length ? product(fields) : null
}

/**
 * A loop: its parameters are locals named by their depth, of the types of
 * their first values, loosened. The body ends where the loop's `break` is
 * the loop's value.
 *
 * @type {(lowerValue: _LowerValue, lowerBlock: _LowerBlock, scope: _Scope, l: Loop) => Result<Term, string>}
 */
const loopTerm = (lowerValue, lowerBlock, scope, { target, parameters, initial, body }) => {
    const firsts = values(lowerValue, scope, initial)
    if (firsts[0] === 'error') { return firsts }
    const types = okList(firsts[1].map(x => typeOf(scope.ir)(x)))
    if (types[0] === 'error') { return types }
    const wide = okList(types[1].map(t => {
        const w = loose(t)
        return w === null ? refuse(scope)(`a loop parameter of ${show(t)} is not in this slice`) : ok(w)
    }))
    if (wide[0] === 'error') { return wide }
    const { ir, bindings, depth, loops } = scope
    const label = `L${loops.length}`
    /** @type {readonly LoopParamOf<Term>[]} */
    const params = firsts[1].map((x, j) => [`#${depth + j}`, wide[1][Number(j)], x])
    const names = params.map(([k]) => k)
    /** @type {_Scope} */
    const inner = {
        ...scope,
        ir: { ...ir, locals: [...ir.locals, ...params.map(([k, t]) => /** @type {const} */ ([k, t]))] },
        bindings: [...bindings, ...parameters.map((b, j) => /** @type {const} */ ([b, ['local', names[Number(j)]]]))],
        depth: depth + params.length,
        loops: [[target, label, names], ...loops],
    }
    const b = lowerBlock(lowerValue, inner, body, ['loop', target])
    return b[0] === 'error' ? b : ok(loop(label, params, b[1]))
}

/**
 * Statements in their order, each around those after it, and then `rest`,
 * which stands in the scope that they leave.
 *
 * @type {(lowerStatement: _LowerStatement, lowerValue: _LowerValue, lowerBlock: _LowerBlock, scope: _Scope, statements: readonly Statement[], tail: _Tail, rest: (scope: _Scope) => Result<Term, string>) => Result<Term, string>}
 */
const sequence = (lowerStatement, lowerValue, lowerBlock, scope, statements, tail, rest) => {
    if (statements.length === 0) { return rest(scope) }
    const [s, ...more] = statements
    return lowerStatement(lowerValue, lowerBlock, scope, s, tail, next => sequence(lowerStatement, lowerValue, lowerBlock, next, more, tail, rest))
}

/** Whether a term reads the local `name`. @type {(name: string) => (t: Term) => boolean} */
const readsLocal = name => t => (t[0] === 'get' && t[1] === name) || terms(t).some(readsLocal(name))

/**
 * A function that a function defines, `b`: inlined where it is called. In
 * a program, its value is made where it is defined, in a local that each
 * read of it as a value reads, so that each read is the same function, as
 * in JavaScript, and the `let` is left out where nothing reads it. A
 * function whose value the lowering refuses, such as one that calls
 * itself, stays one that is only called, and a read of it as a value is
 * refused there.
 *
 * @type {(lowerValue: _LowerValue, scope: _Scope, b: BindingId, f: readonly ['function', FastFunction], rest: (scope: _Scope) => Result<Term, string>) => Result<Term, string>}
 */
const defineFunction = (lowerValue, scope, b, f, rest) => {
    const inlined = f[1]
    const made = scope.closureOf(inlined) === null ? null : lowerValue(scope, f)
    if (made === null || made[0] === 'error') { return rest(standsFor(scope, b, ['inline', inlined])) }
    const { ir, depth } = scope
    const name = `#${depth}`
    const body = rest(standsFor({ ...scope, ir: { ...ir, locals: [...ir.locals, [name, func]] }, depth: depth + 1 }, b, ['closure', inlined, name]))
    if (body[0] === 'error') { return body }
    return ok(readsLocal(name)(body[1]) ? let_(name, made[1], body[1]) : body[1])
}

/** @type {(lowerValue: _LowerValue, lowerBlock: _LowerBlock, scope: _Scope, s: Statement, tail: _Tail, rest: (scope: _Scope) => Result<Term, string>) => Result<Term, string>} */
const statement = (lowerValue, lowerBlock, scope, s, tail, rest) => {
    const no = refuse(scope)
    switch (s[0]) {
        case 'define': {
            const [, b, v, kind] = s
            if (kind === 'lazy') { return no('a lazy definition is not in this slice') }
            // A function is inlined where it is called. The statements of the blocks around it stand where it is defined.
            const [around, f] = unwrapped(v)
            if (f instanceof Array && f[0] === 'function') {
                const [, inlined] = f
                return sequence(statement, lowerValue, lowerBlock, scope, around, tail, next => defineFunction(lowerValue, next, b, f, rest))
            }
            const op = staticOf(v)
            if (op !== null) { return rest(standsFor(scope, b, ['op', op])) }
            const c = firstCast(scope, v)
            return c instanceof Array ? narrow(scope, c, next => statement(lowerValue, lowerBlock, next, s, tail, rest)) : bind(scope, b, lowerValue(scope, v), rest)
        }
        case 'block': {
            const [, results, b] = s
            // A block that never completes ends its block, and what follows it is never reached.
            if (!completes(b)) { return lowerBlock(lowerValue, scope, b, tail) }
            return results.length !== 1 ? no(`a statement with ${count(results.length, 'result')} is not in this slice`)
                : bind(scope, results[0], lowerBlock(lowerValue, scope, b, ['value']), rest)
        }
        case 'if': {
            const [, results, c, a, b] = s
            if (!completes(a) && !completes(b)) { return choice(lowerValue, lowerBlock, scope, c, a, b, tail) }
            return results.length !== 1 ? no(`a statement with ${count(results.length, 'result')} is not in this slice`)
                : bind(scope, results[0], choice(lowerValue, lowerBlock, scope, c, a, b, ['value']), rest)
        }
        default: {
            const [, l] = s
            return l.results.length !== 1 ? no(`a loop with ${count(l.results.length, 'result')} is not in this slice`)
                : bind(scope, l.results[0], loopTerm(lowerValue, lowerBlock, scope, l), rest)
        }
    }
}

/**
 * The exit of a block where its end stands: a `yield` is the block's value,
 * a `return` and a `break` are where they end a function's or a loop's
 * body, and a `continue` is a `br` to its loop anywhere in the loop's body.
 *
 * @type {(lowerValue: _LowerValue, scope: _Scope, exit: Exit, tail: _Tail) => Result<Term, string>}
 */
const exitTerm = (lowerValue, scope, exit, tail) => {
    const no = refuse(scope)
    switch (exit[0]) {
        case 'yield': {
            const [, vs] = exit
            return tail[0] === 'loop' ? no("a loop's body that ends in neither continue nor break is not in this slice")
                : vs.length === 1 ? lowerValue(scope, vs[0])
                : no(`a region that yields ${count(vs.length, 'value')} is not in this slice`)
        }
        case 'return': {
            if (tail[0] === 'loop') { return no('a return inside a loop is not in this slice') }
            const r = lowerValue(scope, exit[2])
            return r[0] === 'error' ? r
                : tail[0] === 'return' ? ok(returned(scope, r[1]))
                : scope.inlining.length > 0 ? no('a return before the end of a function that is inlined is not in this slice')
                : ok(return_(returned(scope, r[1])))
        }
        case 'continue': {
            const [, target, vs] = exit
            // A continue stands in the body of its loop, in the same function.
            const [, label, params] = assertNotNullish(scope.loops.find(([t]) => t === target))
            const xs = values(lowerValue, scope, vs)
            return xs[0] === 'error' ? xs : ok(next(label, params.map((k, j) => /** @type {const} */ ([k, xs[1][Number(j)]]))))
        }
        case 'break': {
            const [, target, vs] = exit
            return tail[0] === 'loop' && tail[1] === target ? lowerValue(scope, vs[0])
                : no("a break before the end of its loop's body is not in this slice")
        }
        case 'throw': {
            if (!scope.ir.imports.some(([k]) => k === 'Functions')) { return no('a throw is a call of Functions, which a module lowered without the runtime does not import') }
            if (scope.building.length > 0) { return no(`a throw inside a callback of buildArray or buildObject is not in this slice: it would leave the builder of ${scope.building[0]}, which is linear, behind`) }
            const r = lowerValue(scope, exit[1])
            return r[0] === 'error' ? r : ok(throw_(r[1]))
        }
        default: { return no('a loop that never breaks is not in this slice') }
    }
}

/**
 * A block: its statements as `let`s around its exit, which ends where
 * `tail` says.
 *
 * @type {_LowerBlock}
 */
const block = (lowerValue, scope, { statements, exit }, tail) => sequence(statement, lowerValue, block, scope, statements, tail, next => exitTerm(lowerValue, next, exit, tail))

/** What a parameter stands for where its argument does nothing: the local that the argument reads, or its term. @type {(x: Term) => _Meaning} */
const argument = x => x[0] === 'get' ? ['local', x[1]] : ['term', x]

/**
 * The body of a function that the lowering inlines, applied to terms that
 * do nothing, one for each of its parameters and one more for its rest
 * parameter, which the caller has checked: its parameters stand for them,
 * its captures for what `resolve`
 * makes of them, and the `return` that ends its body for its value.
 *
 * @type {(lowerValue: _LowerValue, scope: _Scope, f: FastFunction, xs: readonly Term[], resolve: (v: Value) => Result<_Meaning, string>) => Result<Term, string>}
 */
const inlineTerms = (lowerValue, scope, f, xs, resolve) => {
    const no = refuse(scope)
    const captured = okList(f.captures.map(({ binding, value: v }) => {
        const m = resolve(v)
        return m[0] === 'error' ? no(m[1]) : ok(/** @type {const} */ ([binding, m[1]]))
    }))
    if (captured[0] === 'error') { return captured }
    return block(lowerValue, {
        ...scope,
        bindings: [
            ...scope.bindings,
            ...captured[1],
            ...f.parameters.map((b, j) => /** @type {const} */ ([b, argument(xs[Number(j)])])),
            ...(f.rest === null ? [] : [/** @type {const} */ ([f.rest, argument(xs[Number(f.parameters.length)])])]),
        ],
        inlining: [f, ...scope.inlining],
    }, f.body, ['return'])
}

/**
 * A call of a function that the lowering inlines, one that the function
 * defines or one that the module does not export: its body, inlined where
 * the call stands, which ends where its `return` is its value. Its
 * parameters stand for the arguments, each lowered where it stands: a term
 * that does nothing as itself, and anything else bound to a local first, in
 * their order; its captures stand for what `resolve` makes of them: what
 * they read where the call stands, or what the module's bindings are. A
 * function that calls itself, by its own name or through others, is
 * refused, since its copies would never end; in a program, one of the
 * module is a function of the IR instead, and is called, not inlined.
 *
 * @type {(lowerValue: _LowerValue, scope: _Scope, f: FastFunction, vs: readonly Value[], resolve: (v: Value) => Result<_Meaning, string>) => Result<Term, string>}
 */
const inline = (lowerValue, scope, f, vs, resolve) => {
    const no = refuse(scope)
    if (f.self !== null || scope.inlining.includes(f)) { return no('a function that calls itself is not in this slice') }
    const p = f.parameters.length
    if (f.rest === null && p !== vs.length) {
        return no(`a function that is inlined takes ${count(p, 'argument')}, and its call gives ${vs.length}`)
    }
    if (f.rest !== null && p > vs.length) {
        return no(`a function that is inlined takes at least ${count(p, 'argument')}, and its call gives ${vs.length}`)
    }
    if (f.rest !== null && !scope.ir.imports.some(([k]) => k === 'Containers')) {
        return no('a rest parameter is an array that Containers builds, which a module lowered without the runtime does not import')
    }
    return settled(lowerValue, scope, vs, (s, xs) => {
        if (f.rest === null) { return inlineTerms(lowerValue, s, f, xs, resolve) }
        // The rest parameter is an array of the arguments past the others, each a value of `any`, built once.
        const typed = okList(xs.slice(p).map(x => typeOf(s.ir)(x)))
        if (typed[0] === 'error') { return typed }
        const boxed = okList(typed[1].map((t, k) => {
            const y = asAny(t, xs[Number(p + k)])
            return y === null ? no(`an item of a rest parameter is a value of any, and item ${k} is ${show(t)}`) : ok(y)
        }))
        if (boxed[0] === 'error') { return boxed }
        const begun = call('Containers', 'begin_array', [n(BigInt(boxed[1].length))])
        const rest = cast(array, call('Containers', 'seal', [boxed[1].reduce((b, x) => call('Containers', 'push', [b, x]), begun)]), 'array', a => a)
        return pure(s, rest, (t, r) => inlineTerms(lowerValue, t, f, [...xs.slice(0, p), r], resolve))
    })
}

/** What a capture of a function that the function defines stands for: what it reads where the call stands. @type {(scope: _Scope) => (v: Value) => Result<_Meaning, string>} */
const local = scope => v => {
    const m = v instanceof Array && v[0] === 'ref' ? meaning(scope, v[1]) : null
    return m === null ? error('a capture that is no binding of the function is not in this slice') : ok(m)
}

// the L0 view

/** The L0 view's tags of the kinds of `any`, which JavaScript reads as numbers. @type {readonly (readonly [string, number])[]} */
const tags = [
    ['UNDEFINED', UNDEFINED], ['NULL', NULL], ['BOOLEAN', BOOLEAN], ['NUMBER', NUMBER], ['STRING', STRING],
    ['BIGINT', BIGINT], ['ARRAY', ARRAY], ['OBJECT', OBJECT], ['FUNCTION', FUNCTION],
]

/**
 * `length(x)`: an arm for each module of L0 whose `length` takes some of
 * `x`'s kinds, naming `x` at those kinds, and a trap for the kinds that no
 * `length` takes, or a call of the one module that takes them all.
 * JavaScript reads a length as a number.
 *
 * @type {(x: Term, held: readonly string[], base: string) => Term}
 */
const lengthOf = (x, held, base) => {
    const named = lengths.flatMap(([, , ks]) => ks)
    const parts = lengths.map(([module, , ks]) => /** @type {const} */ ([module, ks.filter(k => held.includes(k))])).filter(([, ks]) => ks.length > 0)
    const others = held.filter(k => !named.includes(k))
    if (parts.length === 1 && others.length === 0) { return float(call(parts[0][0], 'length', [x])) }
    /** @type {readonly (readonly [readonly string[], string | null, Term])[]} */
    const arms = [
        ...parts.map(([module, ks]) => {
            const binder = `${base}.${module.toLowerCase()}`
            return /** @type {const} */ ([ks, binder, call(module, 'length', [get(binder)])])
        }),
        [others, null, trap('no length')],
    ]
    return float(match(x, arms.filter(([vs]) => vs.length > 0)))
}

/** The functions of the L0 view that the lowering reads, beside its tags, each with how many arguments it takes. @type {readonly (readonly [string, number])[]} */
const viewFunctions = [
    ['kind', 1], ['asBoolean', 1], ['asNumber', 1], ['asString', 1], ['asArray', 1], ['asObject', 1], ['asFunction', 1],
    ['length', 1], ['unit', 2], ['same', 2], ['text', 1],
    ['fromUnit', 1], ['concat', 2], ['substring', 3], ['item', 2], ['find', 2], ['join', 2],
    ['buildArray', 4], ['buildObject', 5],
]

/** The parameters of a function of an interface of L0. @type {(module: string, name: string) => readonly Param[]} */
const paramsOf = (module, name) => {
    const [, i] = assertNotNullish(l0.find(([k]) => k === module))
    return assertNotNullish(i.functions.find(([k]) => k === name))[1].params
}

/**
 * `fromUnit(c)`: the string of the UTF-16 unit that the float `c` holds
 * exactly, which traps (`'inexact'`) where it holds none. JavaScript reads
 * a unit as a number.
 *
 * @type {(scope: _Scope, c: Term) => Result<Term, string>}
 */
const fromUnitTerm = (scope, c) => {
    const t = typeOf(scope.ir)(c)
    if (t[0] === 'error') { return t }
    return !isFloat(t[1]) ? refuse(scope)(`fromUnit of ${show(t[1])} is not in this slice`)
        : ok(exact(u(16), c, `${localOf(c, 'fromUnit')}.unit`, k => call('String', 'from_unit', [k])))
}

/**
 * A function of the L0 view of terms, the first a value of `any`: `kind`, a
 * cast, `length`, `unit`, `substring` or `item`. A cast of a value that
 * holds no other kind is the value, and one of a value that never holds the
 * kind is refused, since it would always trap. A name for the operand of an
 * arm that the call makes is the operand's, or the function's, and the
 * kinds there: `v.number`. An index is a float that must hold an integer
 * exactly, named for the operand and its role: `s.index`, `s.start`.
 *
 * @type {(scope: _Scope, name: string, args: readonly Term[]) => Result<Term, string>}
 */
const viewTerm = (scope, name, args) => {
    const no = refuse(scope)
    const types = okList(args.map(x => typeOf(scope.ir)(x)))
    if (types[0] === 'error') { return types }
    const [x, i, j] = args
    const [type, at, to] = types[1]
    if (type[0] !== 'sealed') { return no(`${name} of ${show(type)} is not in this slice`) }
    const held = type[3] ?? kinds
    const takes = name === 'unit' || name === 'substring' ? 'string' : casts.find(([k]) => k === name)?.[1]
    if (takes !== undefined && !held.includes(takes)) { return no(`${name} of ${show(type)}: ${name} takes ${takes === 'array' ? 'an' : 'a'} ${takes}`) }
    const base = x[0] === 'get' ? x[1] : name
    /** `x` at `kind` in `body`: itself where it holds no other kind, else a cast. @type {(kind: string, body: (y: Term) => Term) => Term} */
    const as = (kind, body) => held.every(k => k === kind) ? body(x) : cast(only(any, kind), x, `${base}.${kind}`, body)
    switch (name) {
        case 'kind': { return ok(float(call('Any', 'kind', [x]))) }
        case 'asBoolean': { return ok(as('boolean', y => call('Any', 'to_bool', [y]))) }
        case 'asNumber': { return ok(as('number', y => call('Any', 'to_f64', [y]))) }
        case 'asString': { return ok(as('string', y => y)) }
        case 'asArray': { return ok(as('array', y => y)) }
        case 'asObject': { return ok(as('object', y => y)) }
        case 'asFunction': { return ok(as('function', y => y)) }
        case 'length': {
            return lengths.some(([, , ks]) => ks.some(k => held.includes(k))) ? ok(lengthOf(x, held, base))
                : no(`length of ${show(type)}: none of its kinds has a length`)
        }
        case 'text': { return ok(as('function', y => call('Functions', 'text', [y]))) }
        case 'substring': {
            if (!isFloat(at) || !isFloat(to)) { return no(`substring from ${show(at)} to ${show(to)} is not in this slice`) }
            // JavaScript reads the string, then the end, then the start
            return ok(as('string', y => exact(u(31), j, `${base}.end`, e => exact(u(31), i, `${base}.start`, b => call('String', 'substring', [y, b, e])))))
        }
        case 'item': {
            const ks = held.filter(k => k === 'array' || k === 'object')
            if (ks.length === 0) { return no(`item of ${show(type)}: item takes an array or an object`) }
            if (!isFloat(at)) { return no(`item at ${show(at)} is not in this slice`) }
            /** @type {(y: Term) => Term} */
            const read = y => exact(u(31), i, `${base}.index`, k => call('Containers', 'item', [y, k]))
            return ok(ks.length === held.length ? read(x) : cast(only(any, ...ks), x, `${base}.${ks.length === 1 ? ks[0] : 'item'}`, read))
        }
        case 'find': {
            if (!held.includes('object')) { return no(`find of ${show(type)}: find takes an object`) }
            if (at[0] !== 'sealed' || !(at[3] ?? kinds).includes('string')) { return no(`find of a key of ${show(at)}: find takes a string`) }
            // JavaScript reads the index as a number.
            return ok(float(as('object', y => {
                const keyName = `${localOf(i, 'find')}.string`
                const key = (at[3] ?? kinds).every(k => k === 'string') ? i
                    : cast(only(any, 'string'), i, keyName, get(keyName))
                return call('Containers', 'find', [y, key])
            })))
        }
        default: {
            // JavaScript reads an index and a unit as numbers: the index must hold an integer exactly.
            if (!isFloat(at)) { return no(`unit at ${show(at)} is not in this slice`) }
            const index = `${i[0] === 'get' ? i[1] : 'unit'}.index`
            return ok(float(as('string', y => exact(u(31), i, index, k => call('String', 'unit', [y, k])))))
        }
    }
}

/** Whether a value is a function literal. @type {(v: Value) => v is readonly ['function', FastFunction]} */
const isFunction = v => v instanceof Array && v[0] === 'function'

/**
 * `buildObject(n, s, next, keyAt, valueAt)` of the L0 view
 * ([L0 design §22](../../../doc/sasha-gil/wasm/l0-design.md#22-building-in-one-pass)):
 * as `buildArray` is, of `begin_object`, `push_property` and `seal`. Each
 * round pushes `keyAt` and `valueAt` of the state; a key is a string, a
 * value a value of `any`. The callbacks are arrow literals of at most one
 * parameter, inlined, and they do not throw.
 *
 * @type {(lowerValue: _LowerValue, scope: _Scope, vs: readonly Value[]) => Result<Term, string>}
 */
const buildObjectOf = (lowerValue, scope, vs) => {
    const no = refuse(scope)
    const callbacks = vs.slice(2).flatMap(v => isFunction(v) && v[1].rest === null && v[1].parameters.length <= 1 ? [v[1]] : [])
    if (callbacks.length !== 3) { return no('a callback of buildObject that is not an arrow literal of at most one parameter is not in this slice') }
    const [step, keyAt, valueAt] = callbacks
    return settled(lowerValue, scope, vs.slice(0, 2), (s, [size, first]) => {
        const types = okList([size, first].map(x => typeOf(s.ir)(x)))
        if (types[0] === 'error') { return types }
        const [countType, firstType] = types[1]
        if (!isFloat(countType)) { return no(`buildObject of ${show(countType)} items is not in this slice`) }
        const state = loose(firstType)
        if (state === null) { return no(`a state of buildObject of ${show(firstType)} is not in this slice`) }
        const label = `B${s.depth}`
        const [b, st, i, key, item, pushed, later, stepped] = ['b', 's', 'i', 'key', 'item', 'pushed', 'i.next', 's.next'].map(k => `${label}.${k}`)
        /** @type {_Scope} */
        const inner = {
            ...s,
            ir: { ...s.ir, locals: [...s.ir.locals, [b, builder], [st, state], [i, f64]] },
            depth: s.depth + 1,
            building: [label, ...s.building],
        }
        const kTerm = inlineTerms(lowerValue, inner, keyAt, [get(st)].slice(0, keyAt.parameters.length), local(inner))
        if (kTerm[0] === 'error') { return kTerm }
        const kType = typeOf(inner.ir)(kTerm[1])
        if (kType[0] === 'error') { return kType }
        if (!equal(kType[1], string)) { return no(`a key of buildObject is a string, and this one is ${show(kType[1])}`) }
        const vTerm = inlineTerms(lowerValue, inner, valueAt, [get(st)].slice(0, valueAt.parameters.length), local(inner))
        if (vTerm[0] === 'error') { return vTerm }
        const vType = typeOf(inner.ir)(vTerm[1])
        if (vType[0] === 'error') { return vType }
        const boxed = asAny(vType[1], vTerm[1])
        if (boxed === null) { return no(`a value of buildObject is a value of any, and this one is ${show(vType[1])}`) }
        const y = inlineTerms(lowerValue, inner, step, [get(st)].slice(0, step.parameters.length), local(inner))
        return y[0] === 'error' ? y : ok(exact(u(31), size, `${label}.n`, n => loop(
            label,
            [[b, builder, call('Containers', 'begin_object', [n])], [st, state, first], [i, f64, lit(f64c, 0)]],
            if_(
                lt(get(i), float(n)),
                let_(key, kTerm[1], let_(item, boxed, let_(pushed, call('Containers', 'push_property', [get(b), get(key), get(item)]), let_(later, add(get(i), lit(f64c, 1)),
                    let_(stepped, if_(lt(get(later), float(n)), y[1], get(st)), next(label, [[b, get(pushed)], [st, get(stepped)], [i, get(later)]])))))),
                cast(object, call('Containers', 'seal', [get(b)]), `${label}.object`, o => o),
            ),
        )))
    })
}

/**
 * `buildArray(n, s, next, at)` of the L0 view
 * ([L0 design §22](../../../doc/sasha-gil/wasm/l0-design.md#22-building-in-one-pass)):
 * `n` and `s` read where they stand, as arguments are, then `begin_array`
 * of `n`, which must hold an index exactly, and a loop, labelled by its
 * depth, `B0`, of the builder, the state and the count of items pushed.
 * Each round pushes `at` of the state and then, before the last item,
 * steps the state by `next`, the view's order; the round after the last
 * seals the builder. The callbacks are arrow literals of at most one
 * parameter, inlined where they stand, with no closure made. Their items are values
 * of `any`, and they do not throw: a throw would leave the builder, which
 * is linear, behind. A call inside them that fails abandons it, as a
 * trap does.
 *
 * @type {(lowerValue: _LowerValue, scope: _Scope, vs: readonly Value[]) => Result<Term, string>}
 */
const buildArrayOf = (lowerValue, scope, vs) => {
    const no = refuse(scope)
    const callbacks = vs.slice(2).flatMap(v => isFunction(v) && v[1].rest === null && v[1].parameters.length <= 1 ? [v[1]] : [])
    if (callbacks.length !== 2) { return no('a callback of buildArray that is not an arrow literal of at most one parameter is not in this slice') }
    const [step, at] = callbacks
    return settled(lowerValue, scope, vs.slice(0, 2), (s, [size, first]) => {
        const types = okList([size, first].map(x => typeOf(s.ir)(x)))
        if (types[0] === 'error') { return types }
        const [countType, firstType] = types[1]
        if (!isFloat(countType)) { return no(`buildArray of ${show(countType)} items is not in this slice`) }
        const state = loose(firstType)
        if (state === null) { return no(`a state of buildArray of ${show(firstType)} is not in this slice`) }
        const label = `B${s.depth}`
        const [b, st, i, item, pushed, later, stepped] = ['b', 's', 'i', 'item', 'pushed', 'i.next', 's.next'].map(k => `${label}.${k}`)
        /** @type {_Scope} */
        const inner = {
            ...s,
            ir: { ...s.ir, locals: [...s.ir.locals, [b, builder], [st, state], [i, f64]] },
            depth: s.depth + 1,
            building: [label, ...s.building],
        }
        const x = inlineTerms(lowerValue, inner, at, [get(st)].slice(0, at.parameters.length), local(inner))
        if (x[0] === 'error') { return x }
        const t = typeOf(inner.ir)(x[1])
        if (t[0] === 'error') { return t }
        const boxed = asAny(t[1], x[1])
        if (boxed === null) { return no(`an item of buildArray is a value of any, and this one is ${show(t[1])}`) }
        const y = inlineTerms(lowerValue, inner, step, [get(st)].slice(0, step.parameters.length), local(inner))
        // `seal` answers array|object; `begin_array` makes an array alone, so narrow.
        return y[0] === 'error' ? y : ok(exact(u(31), size, `${label}.n`, k => loop(
            label,
            [[b, builder, call('Containers', 'begin_array', [k])], [st, state, first], [i, f64, lit(f64c, 0)]],
            if_(
                lt(get(i), float(k)),
                let_(item, boxed, let_(pushed, call('Containers', 'push', [get(b), get(item)]), let_(later, add(get(i), lit(f64c, 1)),
                    let_(stepped, if_(lt(get(later), float(k)), y[1], get(st)), next(label, [[b, get(pushed)], [st, get(stepped)], [i, get(later)]]))))),
                cast(array, call('Containers', 'seal', [get(b)]), `${label}.array`, a => a),
            ),
        )))
    })
}

/**
 * A call of a function of the L0 view: `same` and `concat`, whose arguments
 * are cast to the kinds that they take, `unit`, `substring` and `item`, or
 * a function of one value. JavaScript reads every argument before the view
 * casts any, so each that does something is bound to a local first, in
 * their order, and the only term in an arm is then a local or a literal.
 *
 * @type {(lowerValue: _LowerValue, scope: _Scope, name: string, vs: readonly Value[]) => Result<Term, string>}
 */
const viewCall = (lowerValue, scope, name, vs) => {
    const no = refuse(scope)
    const f = viewFunctions.find(([k]) => k === name)
    if (f === undefined) { return no(`${name} of L0 is not in this slice`) }
    const [, arity] = f
    if (vs.length !== arity) { return no(`${name} takes ${count(arity, 'argument')}, not ${vs.length}`) }
    if (name === 'same') { return castCall(lowerValue, scope, 'Any', 'same', paramsOf('Any', 'same'), vs) }
    if (name === 'concat') { return castCall(lowerValue, scope, 'String', 'concat', paramsOf('String', 'concat'), vs) }
    if (name === 'join') { return castCall(lowerValue, scope, 'Containers', 'join', paramsOf('Containers', 'join'), vs) }
    if (name === 'buildArray') { return buildArrayOf(lowerValue, scope, vs) }
    if (name === 'buildObject') { return buildObjectOf(lowerValue, scope, vs) }
    if (arity > 1) { return settled(lowerValue, scope, vs, (s, xs) => viewTerm(s, name, xs)) }
    const xs = values(lowerValue, scope, vs)
    return xs[0] === 'error' ? xs : name === 'fromUnit' ? fromUnitTerm(scope, xs[1][0]) : viewTerm(scope, name, xs[1])
}

// L1's native rows

/**
 * A call of one of L1's native rows, by its name in the module of the rows:
 * a `call` of the interface of the rows, its arguments cast to the kinds
 * that the row takes.
 *
 * @type {(lowerValue: _LowerValue, scope: _Scope, name: string, vs: readonly Value[]) => Result<Term, string>}
 */
const nativeCall = (lowerValue, scope, name, vs) => {
    const row = native.functions.find(([k]) => k === name)
    return row === undefined ? refuse(scope)(`${name} of L1's native rows is not in this slice`)
        : vs.length !== row[1].params.length ? refuse(scope)(`${name} takes ${count(row[1].params.length, 'argument')}, not ${vs.length}`)
        : castCall(lowerValue, scope, 'Native', name, row[1].params, vs)
}

// records

/**
 * An object literal, as a product of its keys in their order: each entry a
 * key that is a name and its value. A record never leaves its function, so
 * nothing reads it as an object, and the checker refuses a name given
 * twice.
 *
 * @type {(lowerValue: _LowerValue, scope: _Scope, entries: readonly Entry<Value>[]) => Result<Term, string>}
 */
const record = (lowerValue, scope, entries) => {
    const fields = okList(entries.map(e => {
        if (e[0] !== ':' || typeof e[1] !== 'string') { return refuse(scope)('an entry of an object that is not a name and its value is not in this slice') }
        const [, k, v] = e
        const x = lowerValue(scope, v)
        return x[0] === 'error' ? x : ok(/** @type {const} */ ([k, x[1]]))
    }))
    return fields[0] === 'error' ? fields : ok(make(fields[1]))
}

// spread

/**
 * L1's `name` of a value of `any`, or of a float or a boolean boxed as one,
 * as a program spreads it: `toIterable`, the array of what `...v` gives in
 * an array or the arguments of a call, and `objectSpread`, the object of
 * what it copies into an object, cast to one.
 *
 * @type {(name: 'toIterable' | 'objectSpread') => (s: _Scope, x: Term) => Result<Term, string>}
 */
const spreadBy = name => (s, x) => {
    const f = l1Of(s, name)
    if (f === null) { return refuse(s)(`a spread uses L1's ${name}, which the program does not link`) }
    const t = typeOf(s.ir)(x)
    if (t[0] === 'error') { return t }
    const y = asAny(t[1], x)
    if (y === null) { return refuse(s)(`a spread of ${show(t[1])} is not in this slice`) }
    const made = call('self', f, [y])
    return ok(name === 'toIterable' ? made : cast(object, made, 'object', o => o))
}

/** The length of a spread array or object, as a float. @type {(x: Term) => Term} */
const spreadLength = x => float(call('Containers', 'length', [x]))

/**
 * A spread array or object pushed item by item, to the builder `b`: a
 * loop, labelled `at`, which pushes each of its items by `each`.
 *
 * @type {(each: (b: Term, x: Term, k: Term) => Term) => (b: Term, x: Term, at: string) => Term}
 */
const itemByItem = each => (b, x, at) => {
    const [lb, li, pushed] = ['b', 'i', 'pushed'].map(k => `${at}.${k}`)
    return loop(
        at,
        [[lb, builder, b], [li, f64, lit(f64c, 0)]],
        if_(
            lt(get(li), spreadLength(x)),
            exact(u(31), get(li), `${at}.k`, k => let_(pushed, each(get(lb), x, k), next(at, [[lb, get(pushed)], [li, add(get(li), lit(f64c, 1))]]))),
            get(lb),
        ),
    )
}

/**
 * An array or an object built of parts, one or more of them spread:
 * `begin` of the count of their items, the items that stand alone and the
 * length of each spread array or object, which must be an index, then each
 * part in its order, an item by `one` and a spread by `many`, given the
 * label `label.j` for the part's place, then `seal` of the builder.
 *
 * @type {(label: string, parts: readonly _Part[], begin: (k: Term) => Term, one: (b: Term, x: Term, j: number) => Term, many: (b: Term, x: Term, at: string) => Term, seal: (b: Term) => Term) => Term}
 */
const builtOf = (label, parts, begin, one, many, seal) => {
    const total = parts.reduce((t, [spread, x]) => spread ? add(t, spreadLength(x)) : t, lit(f64c, parts.filter(([spread]) => !spread).length))
    /** @type {(j: number, b: Term) => Term} */
    const from = (j, b) => {
        if (j === parts.length) { return seal(b) }
        const [spread, x] = parts[Number(j)]
        const name = `${label}.b${j}`
        return let_(name, spread ? many(b, x, `${label}.${j}`) : one(b, x, j), from(j + 1, get(name)))
    }
    return exact(u(31), total, `${label}.n`, k => from(0, begin(k)))
}

/**
 * Each item of a part that stands alone boxed as a value of `any`, as an
 * item of an array or an argument of a call is, or why one is not.
 *
 * @type {(s: _Scope, parts: readonly _Part[], what: string) => Result<readonly _Part[], string>}
 */
const boxedParts = (s, parts, what) => okList(parts.map(([many, x], k) => {
    if (many) { return ok(/** @type {_Part} */ ([many, x])) }
    const t = typeOf(s.ir)(x)
    if (t[0] === 'error') { return t }
    const y = asAny(t[1], x)
    return y === null ? refuse(s)(`${what} is a value of any, and part ${k} is ${show(t[1])}`) : ok(/** @type {_Part} */ ([false, y]))
}))

/**
 * An array of parts, one or more of them spread, as a program builds one:
 * L1's `toIterable` of each spread, then Containers' builder of each
 * part, in their order, an item by `push` and a spread by one `push_all`,
 * labelled `S` and the depth.
 *
 * @type {(lowerValue: _LowerValue, scope: _Scope, items: readonly Item<Value>[], what: string) => Result<Term, string>}
 */
const spreadArray = (lowerValue, scope, items, what) => settledParts(lowerValue, scope, items, spreadBy('toIterable'), (s, parts) => {
    const boxed = boxedParts(s, parts, what)
    return boxed[0] === 'error' ? boxed : ok(builtOf(
        `S${s.depth}`,
        boxed[1],
        k => call('Containers', 'begin_array', [k]),
        (b, x) => call('Containers', 'push', [b, x]),
        (b, x) => call('Containers', 'push_all', [b, x]),
        // `seal` answers array|object; `begin_array` makes an array alone, so narrow.
        b => cast(array, call('Containers', 'seal', [b]), 'array', a => a),
    ))
})

/** Each key and value of a spread object, pushed one by one. */
const pushEntries = itemByItem((b, x, k) => call('Containers', 'push_property', [b, call('Containers', 'key', [x, k]), call('Containers', 'item', [x, k])]))

/**
 * An object of entries, one or more of them spread, as a program builds
 * one: L1's `objectSpread` of each spread, then Containers' builder of
 * each name and its value, and of each key and value of each spread
 * object, in their order, labelled `S` and the depth. A repeated key keeps
 * its first place and its last value, as `seal` does.
 *
 * @type {(lowerValue: _LowerValue, scope: _Scope, entries: readonly Entry<Value>[]) => Result<Term, string>}
 */
const spreadObject = (lowerValue, scope, entries) => {
    const keys = entries.flatMap(e => e[0] === '...' ? [] : [e[1]])
    if (keys.some(k => typeof k !== 'string')) { return refuse(scope)('an entry of an object that is not a name and its value is not in this slice') }
    /** @type {readonly Item<Value>[]} */
    const items = entries.map(e => e[0] === '...' ? e : e[2])
    // The name of each entry that is no spread, at its place.
    const names = entries.map(e => typeof e[1] === 'string' ? e[1] : '')
    return settledParts(lowerValue, scope, items, spreadBy('objectSpread'), (s, parts) => {
        const boxed = boxedParts(s, parts, 'a value of an object')
        return boxed[0] === 'error' ? boxed : ok(builtOf(
            `S${s.depth}`,
            boxed[1],
            k => call('Containers', 'begin_object', [k]),
            (b, x, j) => call('Containers', 'push_property', [b, lit(string, names[Number(j)]), x]),
            pushEntries,
            // `seal` answers array|object; `begin_object` makes an object alone, so narrow.
            b => cast(object, call('Containers', 'seal', [b]), 'object', o => o),
        ))
    })
}

/**
 * An object literal built by Containers: each name:value as a
 * `push_property` of a string literal and a value of `any`. Where a value
 * is not of `any`, the literal is a record instead. The choice is made
 * before any `let` binds a field: falling back to a record from inside
 * `settled` would re-lower fields under those binds and shadow their `#n`
 * names. A spread is refused here — see `objectLiteral`.
 *
 * @type {(lowerValue: _LowerValue, scope: _Scope, entries: readonly Entry<Value>[]) => Result<Term, string>}
 */
const objectOf = (lowerValue, scope, entries) => {
    // Spread and a missing Containers import are refused or redirected in
    // `objectLiteral` before this runs; here every entry is a name:value.
    const no = refuse(scope)
    const parsed = okList(entries.map(e => {
        if (e[0] !== ':' || typeof e[1] !== 'string') { return no('an entry of an object that is not a name and its value is not in this slice') }
        return ok(/** @type {const} */ ([e[1], e[2]]))
    }))
    if (parsed[0] === 'error') { return parsed }
    const named = parsed[1]
    // Peek each field as a sibling term (same scope): decide record vs Containers
    // before `settled` binds any of them.
    const peeked = okList(named.map(([, v]) => lowerValue(scope, v)))
    if (peeked[0] === 'error') { return peeked }
    const typed = okList(peeked[1].map(x => typeOf(scope.ir)(x)))
    if (typed[0] === 'error') { return typed }
    if (typed[1].some(t => !isAny(t))) {
        return ok(make(named.map(([k], i) => /** @type {const} */ ([k, peeked[1][Number(i)]]))))
    }
    // Every value is `any`: bind each that does something before begin/push/seal,
    // so the builder stays linear between those calls. `seal` answers
    // array|object; `begin_object` makes an object alone, so narrow.
    return settled(lowerValue, scope, named.map(([, v]) => v), (s, xs) => {
        const begun = call('Containers', 'begin_object', [n(BigInt(xs.length))])
        return ok(cast(object, call('Containers', 'seal', [xs.reduce(
            (b, x, i) => call('Containers', 'push_property', [b, lit(string, named[Number(i)][0]), x]),
            begun,
        )]), 'object', o => o))
    })
}

/**
 * An object literal: a Containers object where every value is of `any` and
 * the runtime is present, otherwise a record. One that holds a spread is
 * `spreadObject`'s in a program, and refused elsewhere.
 *
 * @type {(lowerValue: _LowerValue, scope: _Scope, entries: readonly Entry<Value>[]) => Result<Term, string>}
 */
const objectLiteral = (lowerValue, scope, entries) => {
    if (entries.some(e => e[0] === '...')) {
        return linking(scope) ? spreadObject(lowerValue, scope, entries) : refuse(scope)('a spread in an object literal is not in this slice')
    }
    if (!scope.ir.imports.some(([k]) => k === 'Containers')) { return record(lowerValue, scope, entries) }
    return objectOf(lowerValue, scope, entries)
}

/**
 * A field of a record: of a record that is made where it is read, whose
 * other fields do nothing, the field's own term, so that an inlined
 * function that takes a record reads what its call gives.
 *
 * @type {(x: Term, key: string) => Term}
 */
const fieldOf = (x, key) => {
    const given = x[0] === 'make' && x[1].every(([k, t]) => k === key || isPure(t)) ? x[1].find(([k]) => k === key) : undefined
    return given === undefined ? field(x, key) : given[1]
}

// values

/** An operator of two operands. @type {(lowerValue: _LowerValue, scope: _Scope, f: (a: Term, b: Term) => Term, a: Value, b: Value) => Result<Term, string>} */
const binary = (lowerValue, scope, f, a, b) => {
    const xs = values(lowerValue, scope, [a, b])
    return xs[0] === 'error' ? xs : ok(f(xs[1][0], xs[1][1]))
}

/** The operator that `pick` picks for a term of type `t`, or why there is none. @type {(scope: _Scope, tag: string, t: Type, x: Term, pick: (t: Type, x: Term) => Term | null) => Result<Term, string>} */
const pickedOf = (scope, tag, t, x, pick) => {
    const picked = pick(t, x)
    return picked === null ? refuse(scope)(`${tag} of ${show(t)} is not in this slice`) : ok(picked)
}

/**
 * An operator of one operand, picked by the operand's type: `pick` answers
 * the term, or `null` where no operator of the slice fits.
 *
 * @type {(lowerValue: _LowerValue, scope: _Scope, tag: string, x: Value, pick: (t: Type, x: Term) => Term | null) => Result<Term, string>}
 */
const unary = (lowerValue, scope, tag, x, pick) => {
    const r = lowerValue(scope, x)
    if (r[0] === 'error') { return r }
    const t = typeOf(scope.ir)(r[1])
    return t[0] === 'error' ? t : pickedOf(scope, tag, t[1], r[1], pick)
}

/** `===` of two terms of types `ts`, or `!==` where `negated`, as `same` writes it. @type {(x: Term, y: Term, ts: readonly Type[], negated: boolean) => Term} */
const sameTerm = (x, y, ts, negated) => !ts.every(t => equal(t, bool)) ? (negated ? ne : eq)(x, y)
    : negated ? if_(x, not(y), y)
    : if_(x, y, not(y))

/**
 * `===`, or `!==` where `negated`: `eq` of two numbers, and a `match` of two
 * booleans, which evaluates each operand once on every path.
 *
 * @type {(lowerValue: _LowerValue, scope: _Scope, a: Value, b: Value, negated: boolean) => Result<Term, string>}
 */
const same = (lowerValue, scope, a, b, negated) => {
    const xs = values(lowerValue, scope, [a, b])
    if (xs[0] === 'error') { return xs }
    const [x, y] = xs[1]
    const ts = okList([typeOf(scope.ir)(x), typeOf(scope.ir)(y)])
    if (ts[0] === 'error') { return ts }
    return ok(sameTerm(x, y, ts[1], negated))
}

// arrays

/**
 * An array literal, as Containers builds one: its items first, each lowered
 * where it stands as the arguments of a call are, so that each is a term
 * that does nothing, then `seal` of a `push` of each, in their order, onto
 * `begin_array` of their count. Nothing between `begin_array` and `seal`
 * traps or leaves, so the builder, which is linear, is never left behind.
 * An item is a value of `any`, or a float or boolean boxed as one. A
 * spread is `spreadArray`'s in a program, and refused elsewhere.
 *
 * @type {(lowerValue: _LowerValue, scope: _Scope, items: readonly Item<Value>[]) => Result<Term, string>}
 */
const arrayOf = (lowerValue, scope, items) => {
    const no = refuse(scope)
    if (!scope.ir.imports.some(([k]) => k === 'Containers')) { return no('an array is a value that Containers builds, which a module lowered without the runtime does not import') }
    const vs = items.flatMap(item => isSpread(item) ? [] : [item])
    if (vs.length !== items.length) {
        return linking(scope) ? spreadArray(lowerValue, scope, items, 'an item of an array') : no('a spread in an array literal is not in this slice')
    }
    return settled(lowerValue, scope, vs, (s, xs) => {
        // Each item is a term that does nothing, but a pure one, such as a read
        // of a field a record has not, may still not type-check.
        const typed = okList(xs.map(x => typeOf(s.ir)(x)))
        if (typed[0] === 'error') { return typed }
        const boxed = okList(typed[1].map((t, i) => {
            const y = asAny(t, xs[Number(i)])
            return y === null ? no(`an item of an array is a value of any, and item ${i} is ${show(t)}`) : ok(y)
        }))
        if (boxed[0] === 'error') { return boxed }
        const begun = call('Containers', 'begin_array', [n(BigInt(boxed[1].length))])
        // `seal` answers array|object; `begin_array` makes an array alone, so narrow.
        return ok(cast(array, call('Containers', 'seal', [boxed[1].reduce((b, x) => call('Containers', 'push', [b, x]), begun)]), 'array', a => a))
    })
}

/**
 * A read of an array at a number key, `a[0]` or `a[Number(k)]`, by L1's `get` rules
 * for that case: the receiver, then the key, each lowered where it stands as
 * the arguments of a call are; then the item where the key is an index of
 * one, an integer from `0` up to the array's length, `-0` reading `0`, and
 * `undefined` where it is anything else. The receiver holds an array alone
 * keeps that path. A sealed `any` of another kind is a call of the module's
 * `get` where the signature table names it; without `get`, that read is
 * refused. In a program, a value of `any` that may be an array is matched
 * once, and takes that path where it is one, so only the other kinds call
 * `get` (lever P5 of the perf demos).
 *
 * @type {(lowerValue: _LowerValue, scope: _Scope, receiver: Value, key: Value) => Result<Term, string>}
 */
const indexed = (lowerValue, scope, receiver, key) => settled(lowerValue, scope, [receiver, key], (s, [a, k]) => {
    // The receiver is a term that does nothing, but a pure one may still not
    // type-check; the key is a float, since it is a number or `Number` of one.
    const typed = typeOf(s.ir)(a)
    if (typed[0] === 'error') { return typed }
    const t = typed[1]
    const held = t[0] === 'sealed' ? t[3] : null
    const undefined_ = constant('Any', 'undefined')
    const base = a[0] === 'get' ? a[1] : 'array'
    /** The item of the array `b` at `k`, or `undefined`. @type {(b: Term) => Term} */
    const item = b => exact(u(31), k, `${base}.index`, i => if_(lt(i, call('Containers', 'length', [b])), call('Containers', 'item', [b, i]), undefined_), undefined_)
    if (isAny(t) && held !== null && held.length === 1 && held[0] === 'array') { return ok(item(a)) }
    // An index key is a float (a literal or `Number(...)`); L1's `get` takes `any`.
    const g = getOf(s)
    const y = g === null ? null : isAny(t) ? a : linking(s) ? asAny(t, a) : null
    if (y === null || g === null) { return refuse(s)(`a read of ${show(t)} at a number is not in this slice: only an array's is`) }
    /** L1's `get` of the key, boxed. @type {(z: Term) => Term} */
    const slow = z => call('self', g, [z, call('Any', 'from_f64', [k])])
    // In a program, a value of `any` that may be an array is read as one where it is, and by `get` else, where `get` is L1's own.
    if (!isAny(t) || g !== 'l1.get' || !(held ?? kinds).includes('array')) { return ok(slow(y)) }
    const [b, other] = [`${base}.array`, `${base}.other`]
    return ok(match(a, [[['array'], b, item(get(b))], [null, other, slow(get(other))]]))
})

/**
 * The call of a callee `f` of type `ft`, a term that does nothing, on an
 * array of arguments: Functions' `call` of a value that holds functions
 * alone, and in a program that links L1, L1's `call` of any other, a float
 * or a boolean boxed, which throws JavaScript's TypeError for one that is
 * no function; or why there is none.
 *
 * @type {(s: _Scope, f: Term, ft: Type) => Result<(args: Term) => Term, string>}
 */
const calling = (s, f, ft) => {
    const no = refuse(s)
    const fHeld = ft[0] === 'sealed' ? ft[3] ?? kinds : []
    // Only a sealed value that holds functions alone is `Functions.call`'s: a float or a boolean callee holds none.
    const onlyFunctions = fHeld.length > 0 && fHeld.every(k => k === 'function')
    const linked = onlyFunctions ? null : l1Of(s, 'call')
    if (!fHeld.includes('function') && linked === null) { return no(`a call of ${show(ft)} is not in this slice: only a function's is`) }
    const callee = linked === null ? f : asAny(ft, f)
    if (callee === null) { return no(`a call of ${show(ft)} in a program is not in this slice: only one of any, a float or a boolean is`) }
    const fnName = `${localOf(f, 'call')}.function`
    const fn = onlyFunctions ? f : cast(func, f, fnName, get(fnName))
    return ok(args => linked === null ? call('Functions', 'call', [fn, args]) : call('self', linked, [callee, args]))
}

/**
 * A call of a function value whose callee `lowered` lowers where it stands,
 * before its arguments: `valueCall`'s, and in a program that links L1, a
 * call of a value of `any` that may be no function is L1's `call`, which
 * throws what JavaScript throws for one.
 *
 * @type {(lowerValue: _LowerValue, scope: _Scope, lowered: () => Result<Term, string>, callee: Value, items: readonly Item<Value>[]) => Result<Term, string>}
 */
const callOf = (lowerValue, scope, lowered, callee, items) => {
    const no = refuse(scope)
    if (!scope.ir.imports.some(([k]) => k === 'Functions')) {
        return no('a call of a value uses Functions.call, which a module lowered without the runtime does not import')
    }
    const spreads = items.flatMap(item => isSpread(item) ? [item[1]] : [])
    const plain = items.flatMap(item => isSpread(item) ? [] : [item])
    if (spreads.length > 0 && linking(scope)) {
        // In a program, the arguments are an array that L1's `toIterable` spreads into, as JavaScript reads them.
        const r = lowered()
        if (r[0] === 'error') { return r }
        return pure(scope, r[1], (t, f) => {
            const ft = typeOf(t.ir)(f)
            if (ft[0] === 'error') { return ft }
            const c = calling(t, f, ft[1])
            if (c[0] === 'error') { return c }
            const args = spreadArray(lowerValue, t, items, 'an argument of a call')
            return args[0] === 'error' ? args : ok(c[1](args[1]))
        })
    }
    if (spreads.length > 1 || (spreads.length === 1 && plain.length > 0)) {
        return no('a spread among positional arguments is not in this slice')
    }
    if (spreads.length === 1) {
        return settled(lowerValue, scope, [callee, spreads[0]], (s, [f, args]) => {
            // Pure but ill-typed terms (a missing field of a record) still fail typeOf.
            const typed = okList([f, args].map(x => typeOf(s.ir)(x)))
            if (typed[0] === 'error') { return typed }
            const [ft, at] = typed[1]
            const fHeld = ft[0] === 'sealed' ? ft[3] ?? kinds : []
            const aHeld = at[0] === 'sealed' ? at[3] ?? kinds : []
            if (!fHeld.includes('function')) { return no(`a call of ${show(ft)} is not in this slice: only a function's is`) }
            if (!aHeld.includes('array')) { return no(`a spread of ${show(at)} is not in this slice: only an array's is`) }
            const fnName = `${localOf(f, 'call')}.function`
            const arrName = `${localOf(args, 'call')}.array`
            const fn = fHeld.every(k => k === 'function') ? f : cast(func, f, fnName, get(fnName))
            const arr = aHeld.every(k => k === 'array') ? args : cast(array, args, arrName, get(arrName))
            return ok(call('Functions', 'call', [fn, arr]))
        })
    }
    const r = lowered()
    if (r[0] === 'error') { return r }
    return pure(scope, r[1], (t, f) => settled(lowerValue, t, plain, (s, xs) => {
        // Pure but ill-typed terms (a missing field of a record) still fail typeOf.
        const typed = okList([f, ...xs].map(x => typeOf(s.ir)(x)))
        if (typed[0] === 'error') { return typed }
        const [ft, ...ats] = typed[1]
        const c = calling(s, f, ft)
        if (c[0] === 'error') { return c }
        const boxed = okList(ats.map((t, i) => {
            const y = asAny(t, xs[Number(i)])
            return y === null ? no(`an argument of a call is a value of any, and argument ${i} is ${show(t)}`) : ok(y)
        }))
        if (boxed[0] === 'error') { return boxed }
        const begun = call('Containers', 'begin_array', [n(BigInt(boxed[1].length))])
        return ok(c[1](cast(array, call('Containers', 'seal', [boxed[1].reduce((b, x) => call('Containers', 'push', [b, x]), begun)]), 'args', a => a)))
    }))
}

/**
 * A call of a function value: L0 `call(f, args)` with an args array
 * ([L0 design §12](../../../doc/sasha-gil/wasm/l0-design.md#12-functions-a-code-index-a-frame-a-length-and-a-text)).
 * A single spread of a known array passes that array; otherwise Containers
 * builds one from the positional arguments.
 *
 * @type {(lowerValue: _LowerValue, scope: _Scope, callee: Value, items: readonly Item<Value>[]) => Result<Term, string>}
 */
const valueCall = (lowerValue, scope, callee, items) => callOf(lowerValue, scope, () => lowerValue(scope, callee), callee, items)

/**
 * The arguments of a call of a function of the module: in a program, each
 * float or boolean that a parameter of `any` takes boxed as one, as a call
 * of an untyped export gives it; elsewhere, as they are.
 *
 * @type {(scope: _Scope, name: string, xs: readonly Term[]) => readonly Term[]}
 */
const boxedFor = (scope, name, xs) => {
    const s = linking(scope) ? scope.ir.functions.find(([k]) => k === name) : undefined
    return s === undefined ? xs : xs.map((x, k) => {
        const p = s[1].params[Number(k)]
        const t = p === undefined || !isAny(p[1]) ? null : typeOf(scope.ir)(x)
        return t === null || t[0] === 'error' ? x : asAny(t[1], x) ?? x
    })
}

/**
 * `o.every(f)` or `o.filter(f)` of a value of `any` that may be an array,
 * whose callback `f` is an arrow literal of at most three parameters: a
 * `match` of `o` whose arm for an array is one loop with `f` inlined, as
 * [`from_fast/callbacks`](./callbacks/module.f.js) writes it (lever P6 of
 * the perf demos), and whose arm for the other kinds, if any, is `slow`,
 * L1's call. The callback's item, index and array stand for its
 * parameters, and what it answers is read as JavaScript reads a
 * condition. A `throw` inside `filter`'s is refused, as it would leave the
 * builder of its mask behind. A callback whose answer is no `bool` once it
 * is read as a condition, a record say, is not inlined: the answer is
 * `null`, and the call is L1's.
 *
 * @type {(lowerValue: _LowerValue, s: _Scope, name: string, f: FastFunction, o: Term, held: readonly string[], slow: (s: _Scope, y: Term) => Result<Term, string>) => Result<Term, string> | null}
 */
const inlinedCallback = (lowerValue, s, name, f, o, held, slow) => {
    const building = name === 'filter'
    const label = `${building ? 'F' : 'E'}${s.depth}`
    const [a, other] = /** @type {const} */ ([`${label}.array`, `${label}.other`])
    const v = callbackNames(label)
    /** @type {_Scope} */
    const inner = {
        ...s,
        ir: { ...s.ir, locals: [...s.ir.locals, [a, only(any, 'array')], ...callbackLocals(label, building)] },
        depth: s.depth + 1,
        building: building ? [label, ...s.building] : s.building,
    }
    const body = inlineTerms(lowerValue, inner, f, [get(v.x), get(v.i), get(a)].slice(0, f.parameters.length), local(inner))
    if (body[0] === 'error') { return body }
    const test = condition(inner, body[1])
    const tested = typeOf(inner.ir)(test)
    if (tested[0] === 'error' || !equal(tested[1], bool)) { return null }
    const arm = building ? filterLoops(label, get(a), test) : call('Any', 'from_bool', [everyLoop(label, get(a), test)])
    const rest = held.filter(k => k !== 'array')
    if (rest.length === 0) { return ok(match(o, [[['array'], a, arm]])) }
    const r = slow({ ...s, ir: { ...s.ir, locals: [...s.ir.locals, [other, only(any, ...rest)]] } }, get(other))
    return mapOk(/** @type {(y: Term) => Term} */ (y => match(o, [[['array'], a, arm], [null, other, y]])))(r)
}

/** The methods that L1 has an operation for, each called with one argument: `o.name(x)` is `l1.name(o, x)`. @type {readonly string[]} */
const methods = ['charCodeAt', 'at', 'every', 'filter']

/**
 * A call `o.name(x)` of a method in {@link methods}, in a program that
 * links L1: L1's operation `name` of the receiver and the argument, each
 * boxed as `any`, which calls the receiver's own member where it has no
 * body for its kind. JavaScript reads `o.name`, which throws for
 * `undefined` and `null`, before it reads `x`, so a receiver that may be
 * one passes L1's `requireObjectCoercible` first where `x` is no literal,
 * binding or arrow function, which make nothing that can throw. A
 * receiver that is no value of `any`, a record say, reads and calls its
 * member as any other callee does.
 *
 * @type {(lowerValue: _LowerValue, scope: _Scope, receiver: Value, name: string, items: readonly Item<Value>[]) => Result<Term, string>}
 */
const methodCall = (lowerValue, scope, receiver, name, items) => {
    const r = lowerValue(scope, receiver)
    if (r[0] === 'error') { return r }
    return pure(scope, r[1], (s, x) => {
        const t = typeOf(s.ir)(x)
        if (t[0] === 'error') { return t }
        const o = asAny(t[1], x)
        // A binding of no FAST binding stands for the receiver, read once.
        /** @type {BindingId} */
        const id = { index: -1 }
        if (o === null) { return valueCall(lowerValue, standsFor(s, id, ['term', x]), ['.', ['ref', id], name], items) }
        const [v] = items
        if (items.length !== 1 || isSpread(v)) { return refuse(s)(`a call of the method ${name} with other than one argument is not in this slice`) }
        const held = t[1][0] === 'sealed' ? t[1][3] ?? kinds : []
        const quiet = !(v instanceof Array) || v[0] === 'ref' || v[0] === 'function' || !held.some(k => k === 'undefined' || k === 'null')
        /** The argument, boxed, where `y` stands for the receiver. @type {(s: _Scope, y: Term) => Result<Term, string>} */
        const then = (u, y) => settled(lowerValue, u, [v], (w, [a]) => {
            const at = typeOf(w.ir)(a)
            if (at[0] === 'error') { return at }
            const b = asAny(at[1], a)
            return b === null ? refuse(w)(`the argument of the method ${name} is ${show(at[1])}`) : ok(call('self', `l1.${name}`, [y, b]))
        })
        const f = v instanceof Array && v[0] === 'function' ? v[1] : null
        if (f !== null && (name === 'every' || name === 'filter') && f.rest === null && f.self === null && f.parameters.length <= 3 && isAny(t[1]) && held.includes('array')) {
            const inlined = inlinedCallback(lowerValue, s, name, f, o, held, then)
            if (inlined !== null) { return inlined }
        }
        return quiet ? then(s, o) : pure(s, call('self', 'l1.requireObjectCoercible', [o]), then)
    })
}


/**
 * A call of a function of the module, of a static function that is an
 * operator, of a function of the L0 view or of L1's native rows, of a
 * function value, or of a function that the function defines or that the
 * module does not export, which are inlined: the callee is a binding that
 * stands for one.
 *
 * @type {(lowerValue: _LowerValue, scope: _Scope, callee: Value, items: readonly Item<Value>[]) => Result<Term, string>}
 */
const callTerm = (lowerValue, scope, callee, items) => {
    const no = refuse(scope)
    const m = calleeOf(scope, callee)
    const read = callee instanceof Array && callee[0] === '.' && callee.length === 3 ? callee : null
    if (m === null && read !== null && typeof read[2] === 'string' && methods.includes(read[2]) && l1Of(scope, read[2]) !== null) {
        return methodCall(lowerValue, scope, read[1], read[2], items)
    }
    if (m === null || m[0] === 'local' || m[0] === 'term') { return valueCall(lowerValue, scope, callee, items) }
    if (m[0] === 'refused') { return no(m[1]) }
    if (m[0] === 'errors') { return no("a call of L1's error table is not in this slice") }
    const vs = items.flatMap(item => isSpread(item) ? [] : [item])
    if (vs.length !== items.length) { return no('a spread argument is not in this slice') }
    switch (m[0]) {
        case 'l0': { return viewCall(lowerValue, scope, m[1], vs) }
        case 'native': { return nativeCall(lowerValue, scope, m[1], vs) }
        case 'inline':
        case 'closure': { return inline(lowerValue, scope, m[1], vs, local(scope)) }
        case 'module': { return inline(lowerValue, scope, m[1], vs, scope.module) }
        default: {
            const xs = values(lowerValue, scope, vs)
            return xs[0] === 'error' ? xs : ok(m[0] === 'function' ? call('self', m[1], boxedFor(scope, m[1], xs[1])) : ['op', m[1], xs[1]])
        }
    }
}

/**
 * `a > b` as `lt(b, a)`, and `a >= b` as `le(b, a)`, with `a` still done
 * first: where it is no local or literal it is bound to a local before `b`,
 * since either may trap and a loop may never end.
 *
 * @type {(lowerValue: _LowerValue, scope: _Scope, f: (a: Term, b: Term) => Term, a: Value, b: Value) => Result<Term, string>}
 */
const swapped = (lowerValue, scope, f, a, b) => {
    const x = lowerValue(scope, a)
    if (x[0] === 'error') { return x }
    /** `b`, where `s` is the scope, before `y`. @type {(s: _Scope, y: Term) => Result<Term, string>} */
    const before = (s, y) => {
        const r = lowerValue(s, b)
        return r[0] === 'error' ? r : ok(f(r[1], y))
    }
    return isPure(x[1]) ? before(scope, x[1]) : bindTerm(scope, x[1], (s, name) => before(s, get(name)))
}

/**
 * What a capture of a function of the module stands for: what `capture`
 * makes of the module's binding, or the term of a primitive, which the
 * normalization captures where a binding of the module holds one.
 *
 * @type {(imports: Module['imports'], capture: (b: BindingId) => Result<_Meaning, string>) => (v: Value) => Result<_Meaning, string>}
 */
const ofModule = (imports, capture) => v => {
    if (v instanceof Array) { return v[0] === 'ref' ? capture(v[1]) : error('a capture that is neither a binding of the module nor a primitive is not in this slice') }
    const x = primitive(imports, v)
    return x[0] === 'error' ? x : ok(['term', x[1]])
}

/**
 * A function of FAST as a value, in a program
 * ([slice 11b](../todo/slices.md#decisions-for-slice-11-2026-11-20)):
 * `make_function` of its lifted code, the frame of its captures that read
 * values of the function around it, each lowered where it stands and boxed,
 * as the items of an array literal are, its count of parameters as its
 * length, which counts no rest parameter, and no text. Outside a program,
 * and for a function that calls itself, it is refused.
 *
 * @type {(lowerValue: _LowerValue, scope: _Scope, f: FastFunction) => Result<Term, string>}
 */
const lift = (lowerValue, scope, f) => {
    const no = refuse(scope)
    const c = scope.closureOf(f)
    if (c === null) { return no('a function as a value is not in this slice') }
    if (f.self !== null) { return no('a function that calls itself is not in this slice') }
    const frame = arrayOf(lowerValue, scope, c.frame.map(({ value: v }) => v))
    if (frame[0] === 'error') { return frame }
    return ok(call('Functions', 'make_function', [codeOf(c.code), frame[1], n(BigInt(f.parameters.length)), constant('Any', 'undefined')]))
}

/**
 * A function of the module that it does not export, as a value: in a
 * program, the module's constant that holds its one value, which `init`
 * makes, so that each read of it is the same function, as in JavaScript.
 *
 * @type {(lowerValue: _LowerValue, scope: _Scope, f: FastFunction) => Result<Term, string>}
 */
const shared = (lowerValue, scope, f) => {
    const made = lift(lowerValue, scope, f)
    const name = scope.closureOf(f)?.shared ?? null
    return made[0] === 'error' || name === null ? made : ok(constant('self', name))
}

/**
 * The term of what a value names: a binding, or an import that a
 * constant's term reads. A tag of the L0 view is its float. A function
 * that the function defines, or one of the module that it does not export,
 * is a function value in a program.
 *
 * @type {(lowerValue: _LowerValue, scope: _Scope, m: _Meaning | null) => Result<Term, string>}
 */
const named = (lowerValue, scope, m) => {
    const no = refuse(scope)
    const tag = m !== null && m[0] === 'l0' ? tags.find(([k]) => k === m[1]) : undefined
    return m === null ? no('a binding from outside the function is not in this slice')
        : m[0] === 'local' ? ok(get(m[1]))
        : m[0] === 'term' ? ok(m[1])
        : m[0] === 'refused' ? no(m[1])
        : tag !== undefined ? ok(lit(f64c, tag[1]))
        : m[0] === 'errors' ? no("L1's error table as a value is not in this slice: a term reads one of its errors")
        : m[0] === 'closure' ? ok(get(m[2]))
        : m[0] === 'inline' ? lift(lowerValue, scope, m[1])
        : m[0] === 'module' ? shared(lowerValue, scope, m[1])
        : no('a function as a value is not in this slice')
}

/**
 * A read of one of L1's errors, `error.k`: the string literal of its text
 * in the table that the runtime gives, which the module's start function
 * makes once.
 *
 * `key` is `null` for a read that goes on, as a call of the member does.
 *
 * @type {(scope: _Scope, table: _Errors, key: unknown) => Result<Term, string>}
 */
const errorOf = (scope, table, key) => {
    const no = refuse(scope)
    if (typeof key !== 'string') { return no("a read of L1's error table at a computed key, or with a further step, is not in this slice") }
    const e = table.find(([k]) => k === key)
    return e === undefined ? no(`L1's error table has no ${key}`) : ok(lit(string, e[1]))
}

// operators of a program

/** Whether `===` of the IR takes operands of these types: numbers of one kind, or booleans. @type {(ts: readonly Type[]) => boolean} */
const comparable = ts => numeric(ts) || boolean(ts)

/**
 * An operator in a program that links L1, of its operands lowered once, in
 * their order: where the operator of the IR takes them, `fits` says, what
 * `native` makes of them, and else, such as for values of `any` or a float
 * and a boolean, `wrap` of a call of L1's function `name` of them, each
 * float or boolean boxed as `any`. `null` where the module links no L1, or
 * where `native` answers `null`, for the lowering of the operator of the
 * IR from the operands.
 *
 * @type {(lowerValue: _LowerValue, scope: _Scope, name: string, fits: (ts: readonly Type[]) => boolean, vs: readonly Value[], native: (xs: readonly Term[], ts: readonly Type[]) => Result<Term, string> | null, wrap?: (x: Term) => Term) => Result<Term, string> | null}
 */
const viaL1 = (lowerValue, scope, name, fits, vs, native, wrap = x => x) => {
    const f = l1Of(scope, name)
    if (f === null) { return null }
    const xs = values(lowerValue, scope, vs)
    if (xs[0] === 'error') { return xs }
    const ts = okList(xs[1].map(x => typeOf(scope.ir)(x)))
    if (ts[0] === 'error') { return ts }
    if (fits(ts[1])) { return native(xs[1], ts[1]) }
    const types = ts[1]
    /** L1's call of the operands, each float or boolean boxed. @type {(ys: readonly Term[]) => Term} */
    const slow = ys => wrap(call('self', f, ys.map((y, k) => assertNotNullish(asAny(types[Number(k)], y)))))
    if (xs[1].some((x, k) => asAny(types[Number(k)], x) === null)) { return refuse(scope)(`${name} of ${types.map(show).join(' and ')} is not in this slice`) }
    return (numbered(name, types) ? numberPath(pure, scope, xs[1], types, native, slow) : null) ?? ok(slow(xs[1]))
}

/**
 * `a > b` as `lt(b, a)`, of its operands lowered in their order: where
 * either does nothing as itself, which one is done first does not show.
 * `null` where both do something, for `swapped`, which binds `a` first.
 *
 * @type {(f: (a: Term, b: Term) => Term) => (xs: readonly Term[]) => Result<Term, string> | null}
 */
const flipped = f => ([x, y]) => isPure(x) || isPure(y) ? ok(f(y, x)) : null

/**
 * A member read or a call that goes on by `step`, as the read or call of
 * what it goes on from: `a.b.c` is `(a.b).c` and `o.f(x)` is `(o.f)(x)`,
 * since FunctionalScript has no `this`. `null` for a step that is guarded
 * or asserted, which this slice does not lower.
 *
 * @type {(v: Value, step: Step<Value>) => Value | null}
 */
const unstep = (v, step) => {
    /** @type {Value | null} */
    const head = step[0] === '|.' ? ['.', v, step[1]] : step[0] === '|()' ? ['()', v, step[1]] : null
    return head === null || step.length === 2 ? head : unstep(head, step[2])
}

/**
 * `o?.k`, and the steps after it, in a program that links L1: `undefined`
 * where `o` is `undefined` or `null`, which short-circuits the whole chain,
 * and else the read and the steps of `o` at its other kinds, named
 * `o.value`. `o` is read once, where it stands.
 *
 * @type {(lowerValue: _LowerValue, scope: _Scope, receiver: Value, key: Key<Value>, step: Step<Value> | null) => Result<Term, string>}
 */
const guarded = (lowerValue, scope, receiver, key, step) => {
    const r = lowerValue(scope, receiver)
    if (r[0] === 'error') { return r }
    return pure(scope, r[1], (s, x) => {
        const no = refuse(s)
        const t = typeOf(s.ir)(x)
        if (t[0] === 'error') { return t }
        // A float or a boolean is boxed, as JavaScript reads its members.
        const y = asAny(t[1], x)
        if (y === null) { return no(`?. of ${show(t[1])} is not in this slice`) }
        const ty = t[1]
        const held = ty[0] === 'sealed' ? ty[3] ?? kinds : [isFloat(ty) ? 'number' : 'boolean']
        /** @type {readonly string[]} */
        const nullish = held.filter(k => k === 'undefined' || k === 'null')
        const others = held.filter(k => !nullish.includes(k))
        const undefined_ = constant('Any', 'undefined')
        if (others.length === 0) { return ok(undefined_) }
        // A binding of no FAST binding stands for the receiver where it is no `undefined` or `null`.
        /** @type {BindingId} */
        const id = { index: -1 }
        /** @type {Value} */
        const first = ['.', ['ref', id], key]
        const read = step === null ? first : unstep(first, step)
        if (read === null) { return no('a guarded or asserted step after ?. is not in this slice') }
        const base = localOf(x, '?.')
        const binder = `${base}.value`
        if (nullish.length === 0) { return lowerValue(standsFor(s, id, ['term', y]), read) }
        /** @type {_Scope} */
        const narrowed = { ...s, ir: { ...s.ir, locals: [...s.ir.locals, [binder, only(any, ...others)]] } }
        const inner = standsFor(narrowed, id, ['local', binder])
        const body = lowerValue(inner, read)
        return body[0] === 'error' ? body : ok(match(x, [[nullish, null, undefined_], [others, binder, body[1]]]))
    })
}

/** `a % b`, `a >> b` or `a & b` of two floats, as L1's native row `row`, of the operands lowered in their order. @type {(lowerValue: _LowerValue, op: string, row: string, scope: _Scope, vs: readonly Value[]) => Result<Term, string>} */
const rowOf = (lowerValue, op, row, scope, vs) => {
    const xs = values(lowerValue, scope, vs)
    return xs[0] === 'error' ? xs : numberRow(op, row)(scope, xs[1])
}

/** @type {_LowerValue} */
const value = (scope, v) => {
    const no = refuse(scope)
    if (!(v instanceof Array)) {
        const x = primitive(scope.ir.imports, v)
        return x[0] === 'error' ? no(x[1]) : x
    }
    switch (v[0]) {
        case 'ref': { return named(value, scope, meaning(scope, v[1])) }
        case 'function': { return lift(value, scope, v[1]) }
        case 'block': { return block(value, scope, v[1], ['value']) }
        case 'if': { return choice(value, block, scope, v[1], v[2], v[3], ['value']) }
        case '?:': {
            const parts = values(value, scope, [v[1], v[2], v[3]])
            if (parts[0] === 'error') { return parts }
            const [left, right] = aligned(scope, parts[1][1], parts[1][2])
            return ok(if_(condition(scope, parts[1][0]), left, right))
        }
        case '()': { return callTerm(value, scope, v[1], v[2]) }
        case '-': {
            /** @type {(t: Type, x: Term) => Term | null} */
            const negative = (t, x) => t[0] === 'int' ? sub(n(0n), x) : isFloat(t) ? neg(x) : null
            return v.length === 3 ? viaL1(value, scope, 'subtract', numeric, [v[1], v[2]], inOrder(sub)) ?? binary(value, scope, sub, v[1], v[2])
                : viaL1(value, scope, 'negate', numeric, [v[1]], (xs, ts) => pickedOf(scope, '-', ts[0], xs[0], negative)) ?? unary(value, scope, '-', v[1], negative)
        }
        case '+': { return v.length === 3 ? viaL1(value, scope, 'add', numeric, [v[1], v[2]], inOrder(add)) ?? binary(value, scope, add, v[1], v[2]) : no('+ of one operand is not in this slice') }
        case '!': {
            /** @type {(t: Type, x: Term) => Term | null} */
            const negation = (t, x) => equal(t, bool) ? not(x) : null
            return viaL1(value, scope, 'toBoolean', boolean, [v[1]], (xs, ts) => pickedOf(scope, '!', ts[0], xs[0], negation), not) ?? unary(value, scope, '!', v[1], negation)
        }
        case 'typeof': {
            const f = l1Of(scope, 'typeOf')
            return f === null ? no('typeof is not in this slice') : unary(value, scope, 'typeof', v[1], (t, x) => {
                const y = asAny(t, x)
                return y === null ? null : call('self', f, [y])
            })
        }
        case 'Number': {
            // `float` of an integer is exact within ±2^53 alone, so a wider one is L1's, which rounds it.
            /** @type {(t: Type) => boolean} */
            const exactly = t => t[0] === 'int' ? -(2n ** 53n) <= t[1] && t[2] <= 2n ** 53n : isFloat(t)
            /** @type {(t: Type, x: Term) => Term | null} */
            const number = (t, x) => !exactly(t) ? null : t[0] === 'int' ? float(x) : x
            return viaL1(value, scope, 'number', ts => exactly(ts[0]), [v[1]], (xs, ts) => pickedOf(scope, 'Number', ts[0], xs[0], number)) ?? unary(value, scope, 'Number', v[1], number)
        }
        // `String(x)`, which a template literal writes for each value that it holds.
        // A function that a program makes has no text yet, so its text is refused rather than thrown at run time.
        case 'String': {
            return viaL1(value, scope, 'toString', ts => equal(ts[0], string) || equal(ts[0], func), [v[1]],
                (xs, ts) => equal(ts[0], string) ? ok(xs[0]) : no('the text of a function that a program makes is not in this slice')) ?? no('String is not in this slice')
        }
        case '*': { return viaL1(value, scope, 'multiply', numeric, [v[1], v[2]], inOrder(mul)) ?? binary(value, scope, mul, v[1], v[2]) }
        case '/': { return viaL1(value, scope, 'divide', numeric, [v[1], v[2]], inOrder(div)) ?? binary(value, scope, div, v[1], v[2]) }
        case '%': { return viaL1(value, scope, 'remainder', floats, [v[1], v[2]], nativeRow('numberRemainder')) ?? rowOf(value, '%', 'numberRemainder', scope, [v[1], v[2]]) }
        case '>>': { return viaL1(value, scope, 'shiftRight', floats, [v[1], v[2]], nativeRow('numberShiftRight')) ?? rowOf(value, '>>', 'numberShiftRight', scope, [v[1], v[2]]) }
        case '&': { return viaL1(value, scope, 'bitwiseAnd', floats, [v[1], v[2]], nativeRow('numberAnd')) ?? rowOf(value, '&', 'numberAnd', scope, [v[1], v[2]]) }
        case 'object': { return objectLiteral(value, scope, v[1]) }
        case 'array': { return arrayOf(value, scope, v[1]) }
        case '?.': {
            return l1Of(scope, 'get') === null ? no('?. is not in this slice') : guarded(value, scope, v[1], v[2], v.length === 4 ? v[3] : null)
        }
        case '.': {
            const key = v[2]
            const m = scope.imported(v)
            // what the receiver names: a binding, or an import that a constant's term reads itself
            const from = !(v[1] instanceof Array) ? null : v[1][0] === 'ref' ? meaning(scope, v[1][1]) : scope.imported(v[1])
            const g = getOf(scope)
            const goes = v.length === 4 && l1Of(scope, 'get') !== null ? unstep(['.', v[1], key], v[3]) : null
            return m !== null ? named(value, scope, m)
                : from !== null && from[0] === 'errors' ? errorOf(scope, from[1], v.length === 3 ? key : null)
                : goes !== null ? value(scope, goes)
                : v.length !== 3 ? no('a member read with a further step, such as a call of the member, is not in this slice')
                : typeof key === 'string' ? unary(value, scope, `.${key}`, v[1], (t, x) => {
                    if (t[0] === 'product') { return fieldOf(x, key) }
                    // In a program, a float or a boolean is boxed for L1's `get`, as JavaScript reads its members.
                    const y = g === null ? null : isAny(t) ? x : linking(scope) ? asAny(t, x) : null
                    if (y === null || g === null) { return null }
                    /** L1's `get` of the key. @type {(z: Term) => Term} */
                    const slow = z => call('self', g, [z, lit(string, key)])
                    // An array's or a string's length is read in place, where `get` is L1's own.
                    return (key === 'length' && g === 'l1.get' ? lengthRead(x, t, slow, localOf(x, 'length')) : null) ?? slow(y)
                })
                : indexed(value, scope, v[1], key)
        }
        case '<': { return viaL1(value, scope, 'lessThan', numeric, [v[1], v[2]], inOrder(lt)) ?? binary(value, scope, lt, v[1], v[2]) }
        case '<=': { return viaL1(value, scope, 'lessThanOrEqual', numeric, [v[1], v[2]], inOrder(le)) ?? binary(value, scope, le, v[1], v[2]) }
        case '>': { return viaL1(value, scope, 'greaterThan', numeric, [v[1], v[2]], flipped(lt)) ?? swapped(value, scope, lt, v[1], v[2]) }
        case '>=': { return viaL1(value, scope, 'greaterThanOrEqual', numeric, [v[1], v[2]], flipped(le)) ?? swapped(value, scope, le, v[1], v[2]) }
        case '===': { return viaL1(value, scope, 'strictEquals', comparable, [v[1], v[2]], (xs, ts) => ok(sameTerm(xs[0], xs[1], ts, false))) ?? same(value, scope, v[1], v[2], false) }
        case '!==': { return viaL1(value, scope, 'strictEquals', comparable, [v[1], v[2]], (xs, ts) => ok(sameTerm(xs[0], xs[1], ts, true)), not) ?? same(value, scope, v[1], v[2], true) }
        default: { return no(`${v[0]} is not in this slice`) }
    }
}

// functions and modules

/** What a function reads that it does not bind, a binding or an import: nothing, since it reads the module's bindings and imports through its captures. @type {() => null} */
const outside = () => null

/**
 * A function of the module, typed by its signature: its parameters are
 * locals of the signature's names, and its `self` and its captures are what
 * `capture` makes of the module's bindings, as are those of each function
 * of the module that it inlines.
 *
 * @type {(context: _Context, capture: (b: BindingId) => Result<_Meaning, string>) => (entry: readonly [string, FastFunction, Signature]) => Result<readonly [string, Fn], string>}
 */
const lowerFn = ({ functions, imports, constants, closureOf }, capture) => ([name, f, { params, result }]) => {
    /** @type {(message: string) => Result<never, string>} */
    const no = message => error(`${name}: ${message}`)
    if (f.rest !== null) { return no('a rest parameter is not in this slice') }
    if (f.parameters.length !== params.length) {
        return no(`the signature has ${count(params.length, 'parameter')}, and the function ${f.parameters.length}`)
    }
    const module = ofModule(imports, capture)
    const captured = okList(f.captures.map(({ binding, value: v }) => {
        const m = module(v)
        return m[0] === 'error' ? no(m[1]) : ok(/** @type {const} */ ([binding, m[1]]))
    }))
    if (captured[0] === 'error') { return captured }
    /** @type {readonly (readonly [BindingId, _Meaning])[]} */
    const bindings = [
        ...f.parameters.map((b, k) => /** @type {const} */ ([b, ['local', params[Number(k)][0]]])),
        ...(f.self === null ? [] : [/** @type {const} */ ([f.self, ['function', name]])]),
        ...captured[1],
    ]
    const body = block(value, { ir: { name, locals: params, result, functions, imports, constants }, bindings, outer: outside, imported: outside, depth: 0, loops: [], inlining: [], building: [], module, closureOf }, f.body, ['return'])
    return body[0] === 'error' ? body : ok([name, fn(params, result, body[1])])
}

/**
 * The rest parameter of lifted code: an array of the items of `args` from
 * `p` on, none where it has no more than `p`, labelled `R`, as its loop
 * pushes each.
 *
 * @type {(args: Term, p: number) => Term}
 */
const restOf = (args, p) => {
    const length = float(call('Containers', 'length', [args]))
    const from = lit(f64c, p)
    const total = if_(lt(from, length), sub(length, from), lit(f64c, 0))
    return exact(u(31), total, 'R.n', k => loop(
        'R',
        [['R.b', builder, call('Containers', 'begin_array', [k])], ['R.i', f64, lit(f64c, 0)]],
        if_(
            lt(get('R.i'), float(k)),
            exact(u(31), add(get('R.i'), from), 'R.k', j => let_('R.pushed', call('Containers', 'push', [get('R.b'), call('Containers', 'item', [args, j])]), next('R', [['R.b', get('R.pushed')], ['R.i', add(get('R.i'), lit(f64c, 1))]]))),
            // `seal` answers array|object; `begin_array` makes an array alone, so narrow.
            cast(array, call('Containers', 'seal', [get('R.b')]), 'array', a => a),
        ),
    ))
}

/**
 * The lifted code of a function of FAST that a program makes as a value
 * ([slice 11b](../todo/slices.md#decisions-for-slice-11-2026-11-20)),
 * named for its closure: `(self, args) -> any`, which borrows both, as the
 * code of L0's function values does. Each capture that reads a value of
 * the function around it is an item of the frame, `frame(self, k)`, each
 * parameter an item of `args`, or `undefined` past its length, each in a
 * local first, a rest parameter the array of the items of `args` past
 * them, in a local after them, and each other capture what it stands for
 * in the module.
 *
 * @type {(context: _Context, module: (v: Value) => Result<_Meaning, string>) => (entry: readonly [FastFunction, _Closure]) => Result<readonly [string, Fn], string>}
 */
const lowerClosure = ({ functions, imports, constants, closureOf }, module) => ([f, c]) => {
    const self = get('#self')
    const args = get('#args')
    /** @type {readonly Term[]} */
    const items = [
        ...c.frame.map((_, k) => call('Functions', 'frame', [self, n(BigInt(k))])),
        ...f.parameters.map((_, j) => if_(
            lt(n(BigInt(j)), call('Containers', 'length', [args])),
            call('Containers', 'item', [args, n(BigInt(j))]),
            constant('Any', 'undefined'),
        )),
    ]
    const names = items.map((_, k) => `#${k}`)
    const restName = `#${items.length}`
    /** @type {readonly Param[]} */
    const params = [['#self', func], ['#args', array]]
    /** @type {readonly (readonly [BindingId, _Meaning])[]} */
    const bindings = [
        ...c.statics.map(([b, v]) => {
            const m = module(v)
            return /** @type {const} */ ([b, m[0] === 'error' ? /** @type {const} */ (['refused', m[1]]) : m[1]])
        }),
        ...c.frame.map(({ binding }, k) => /** @type {const} */ ([binding, ['local', names[Number(k)]]])),
        ...f.parameters.map((b, j) => /** @type {const} */ ([b, ['local', names[Number(c.frame.length + j)]]])),
        ...(f.rest === null ? [] : [/** @type {const} */ ([f.rest, ['local', restName]])]),
    ]
    /** @type {readonly Param[]} */
    const locals = [...params, ...names.map(k => /** @type {const} */ ([k, any])), ...(f.rest === null ? [] : [/** @type {const} */ ([restName, array])])]
    const ir = { name: c.code, locals, result: any, functions, imports, constants }
    const depth = locals.length - params.length
    const body = block(value, { ir, bindings, outer: outside, imported: outside, depth, loops: [], inlining: [], building: [], module, closureOf }, f.body, ['return'])
    if (body[0] === 'error') { return body }
    const inner = f.rest === null ? body[1] : let_(restName, restOf(args, f.parameters.length), body[1])
    return ok([c.code, fn(params, any, items.reduceRight((x, t, k) => let_(names[Number(k)], t, x), inner))])
}

/**
 * A constant of the module, named `name`: the term of the value that a
 * module-level definition gives, which reads the module's bindings itself,
 * each what `capture` makes of it, and its imports, as `importOf` reads
 * them, and the term's type. A constant of a type that the checker refuses
 * where a term reads it, such as a record, is refused, so that every other
 * term's scope holds the constants that a term may read.
 *
 * @type {(context: _Context, capture: (b: BindingId) => Result<_Meaning, string>, importOf: (v: Value) => _Import | null) => (name: string, v: Value) => Result<readonly [string, ConstantOf<Term>], string>}
 */
const lowerConstant = ({ functions, imports, constants, closureOf }, capture, importOf) => (name, v) => {
    /** @type {_Scope} */
    const scope = {
        ir: { name, locals: [], functions, imports, constants },
        bindings: [],
        outer: b => {
            const m = capture(b)
            return m[0] === 'error' ? ['refused', m[1]] : m[1]
        },
        imported: importOf,
        depth: 0,
        loops: [],
        inlining: [],
        building: [],
        module: ofModule(imports, capture),
        closureOf,
    }
    const x = value(scope, v)
    if (x[0] === 'error') { return x }
    const t = typeOf(scope.ir)(x[1])
    if (t[0] === 'error') { return t }
    const read = typeOf({ name, locals: [], functions, imports, constants: [[name, t[1]]] })(constant('self', name))
    return read[0] === 'error' ? read : ok([name, { type: t[1], value: x[1] }])
}

/** The module's own constants that a term reads. @type {(t: Term) => readonly string[]} */
const reads = t => t[0] === 'constant' ? (t[1] === 'self' ? [t[2]] : []) : terms(t).flatMap(reads)

/** The types of the constants that the lowering made. @type {(done: readonly _Lowered[]) => _Context['constants']} */
const typesOf = done => done.flatMap(([, r]) => r[0] === 'ok' ? [/** @type {const} */ ([r[1][0], r[1][1].type])] : [])

/**
 * The slot of import `i` that a value reads from the arguments of the
 * module, `['.', ['ref', args], i]`, where `args` is the module's one free
 * binding or a definition of it, or `null` where it reads none.
 *
 * @type {(args: (b: BindingId) => boolean, v: Value) => number | null}
 */
const slotIn = (args, v) => {
    if (!(v instanceof Array) || v[0] !== '.' || v.length !== 3 || typeof v[2] !== 'number') { return null }
    const from = v[1]
    return from instanceof Array && from[0] === 'ref' && args(from[1]) ? v[2] : null
}

/**
 * Import `i`'s export `name`, as FAST reads it from the arguments of the
 * module: `['.', slot, name]`, where `slotOf` reads `i` from the slot. What
 * `source` makes of an export of a module of the runtime, the L0 view, L1's
 * native rows or L1's error table; any other import is refused. `null`
 * where `v` reads no import.
 *
 * @type {(source: (specifier: string, name: string) => _Import | null, imports: readonly AstImport[], slotOf: (v: Value) => number | null, v: Value) => _Import | null}
 */
const imported = (source, imports, slotOf, v) => {
    if (!(v instanceof Array) || v[0] !== '.' || v.length !== 3 || typeof v[2] !== 'string') { return null }
    const i = slotOf(v[1])
    if (i === null) { return null }
    const m = imports[Number(i)]
    const origin = m === undefined || m.json ? null : source(m.specifier, v[2])
    return m === undefined ? ['refused', `no import ${i}`]
        : origin === null ? ['refused', `an import of ${m.specifier} is not in this slice`]
        : origin
}

/**
 * A statement of a module, and before it the statements of the blocks that
 * the normalization puts around the value that it defines, which define
 * bindings of the module too.
 *
 * @type {(s: Statement) => readonly Statement[]}
 */
const flat = s => {
    if (s[0] !== 'define') { return [s] }
    const [, b, v, kind] = s
    const [around, w] = unwrapped(v)
    return [...around.flatMap(flat), ['define', b, w, kind]]
}

/**
 * What each binding that the module's statements define stands for, those
 * of the blocks around a definition's value among them, in their order,
 * and the import that a value reads. A binding that no statement defines
 * holds the module's imports, and so does a definition that only names it
 * or a slot of it; a definition that reads an import from one of them is
 * that import, one of a static function that is an operator of the IR,
 * `Math.abs` or `Math.sqrt`, is that operator, and any other is a
 * constant.
 *
 * @type {(source: (specifier: string, name: string) => _Import | null, imports: readonly AstImport[], statements: readonly Statement[]) => readonly [readonly (readonly [BindingId, _Global])[], (v: Value) => _Import | null]}
 */
const globals = (source, imports, wrapped) => {
    const statements = wrapped.flatMap(flat)
    /** @type {(s: Statement) => readonly BindingId[]} */
    const results = s => s[0] === 'define' ? [s[1]] : s[0] === 'loop' ? s[1].results : s[1]
    const defined = statements.flatMap(results)
    const aliases = statements.flatMap(s => s[0] === 'define' && s[2] instanceof Array && s[2][0] === 'ref' && !defined.includes(s[2][1]) ? [s[1]] : [])
    /** @type {(b: BindingId) => boolean} */
    const args = b => aliases.includes(b) || !defined.includes(b)
    const slots = statements.flatMap(s => {
        const i = s[0] === 'define' ? slotIn(args, s[2]) : null
        return i === null ? [] : [/** @type {const} */ ([s[1], i])]
    })
    /** The slot that a value reads: itself, or a binding that a definition of one defines. @type {(v: Value) => number | null} */
    const slotOf = v => {
        const slot = v instanceof Array && v[0] === 'ref' ? slots.find(([b]) => b === v[1]) : undefined
        return slot === undefined ? slotIn(args, v) : slot[1]
    }
    /** @type {(v: Value) => _Import | null} */
    const importOf = v => imported(source, imports, slotOf, v)
    const bindings = statements.flatMap(s => {
        const op = s[0] === 'define' ? staticOf(s[2]) : null
        /** @type {_Global} */
        const g = s[0] !== 'define' ? ['refused', `a module statement of the kind ${s[0]} is not in this slice`]
            : s[3] === 'lazy' ? ['refused', 'a lazy definition is not in this slice']
            : s[2] instanceof Array && s[2][0] === 'function' ? ['function', s[2][1]]
            : aliases.includes(s[1]) || slots.some(([b]) => b === s[1]) ? ['args']
            : op !== null ? ['op', op]
            : importOf(s[2]) ?? ['constant', s[2]]
        return results(s).map(b => /** @type {const} */ ([b, g]))
    })
    return [bindings, importOf]
}

/**
 * What a read of a constant stands for: its term, which borrows it, or why
 * the lowering refused it. The normalization defines a constant before
 * anything that reads it.
 *
 * @type {(made: Result<readonly [string, ConstantOf<Term>], string> | undefined) => Result<_Meaning, string>}
 */
const ofConstant = made => made === undefined ? error('a constant that is read before its definition is not in this slice')
    : made[0] === 'error' ? made
    : ok(['term', constant('self', made[1][0])])

/**
 * The constants that the module keeps, those after `c` first, and what
 * they and the functions read: `c` is kept where one of them reads it.
 *
 * @type {(state: readonly [readonly (readonly [string, ConstantOf<Term>])[], readonly string[]], c: readonly [string, ConstantOf<Term>]) => readonly [readonly (readonly [string, ConstantOf<Term>])[], readonly string[]]}
 */
const keep = ([later, needed], c) => needed.includes(c[0]) ? [[c, ...later], [...needed, ...reads(c[1].value)]] : [later, needed]

// programs

/**
 * Every function of FAST inside a part of normalized FAST, an outer one
 * before those that it defines.
 *
 * @type {(x: unknown) => readonly FastFunction[]}
 */
const functionsIn = x => {
    if (x instanceof Array) { return x.flatMap(functionsIn) }
    if (typeof x !== 'object' || x === null) { return [] }
    if ('captures' in x && 'body' in x && 'target' in x) {
        const f = /** @type {FastFunction} */ (x)
        return [f, ...functionsIn(f.captures), ...functionsIn(f.body)]
    }
    return Object.values(x).flatMap(functionsIn)
}

/**
 * The closures of a program
 * ([slice 11b](../todo/slices.md#decisions-for-slice-11-2026-11-20)):
 * each function of FAST in its text, once, with the name of its lifted
 * code, `#f` and its place among them, and its captures, split. A capture
 * of a function of the module reads a value of the module, which its
 * lifted code reads once the module's constants are made. A capture of a
 * function inside one reads what the capture that it reads reads, where
 * that one reads a value of the module; any other capture reads a value of
 * the function around it, so it is an item of the frame. A function of the module in `shared` has a constant
 * of the module, `#v` and its place, that holds its one value.
 *
 * @type {(tops: readonly FastFunction[], shared: readonly FastFunction[], root: unknown) => readonly (readonly [FastFunction, _Closure])[]}
 */
const closuresOf = (tops, shared, root) => {
    const all = functionsIn(root)
    const fns = all.filter((f, k) => all.indexOf(f) === k)
    /** @type {(done: readonly (readonly [BindingId, Value])[], f: FastFunction) => readonly (readonly [BindingId, Value])[]} */
    const add = (done, f) => [...done, ...f.captures.flatMap(({ binding, value: v }) => {
        if (tops.includes(f)) { return [/** @type {const} */ ([binding, v])] }
        const m = done.find(([b]) => v instanceof Array && v[0] === 'ref' && b === v[1])
        return m === undefined ? [] : [/** @type {const} */ ([binding, m[1]])]
    })]
    const statics = fns.reduce(add, [])
    return fns.map((f, k) => /** @type {const} */ ([f, {
        code: `#f${k}`,
        shared: shared.includes(f) ? `#v${k}` : null,
        statics: statics.filter(([b]) => f.captures.some(({ binding }) => binding === b)),
        frame: f.captures.filter(({ binding }) => !statics.some(([b]) => b === binding)),
    }]))
}

/**
 * The signature of an export of a program that the table does not name:
 * each parameter, `p0` first, and the result, of `any`.
 *
 * @type {(f: FastFunction) => Signature}
 */
const untyped = f => signature(f.parameters.map((_, k) => /** @type {const} */ ([`p${k}`, any])), any)

/**
 * The lifted code of each closure that the terms of a program reach, by
 * the names in `todo`, themselves or through the code of others, in the
 * order that they are reached.
 *
 * @type {(lowerClosure: (entry: readonly [FastFunction, _Closure]) => Result<readonly [string, Fn], string>, closures: readonly (readonly [FastFunction, _Closure])[], todo: readonly string[]) => Result<readonly (readonly [string, Fn])[], string>}
 */
const madeClosures = (lowerClosure, closures, todo) => {
    let left = todo
    /** @type {readonly (readonly [string, Fn])[]} */
    let made = []
    while (left.length > 0) {
        const [name, ...rest] = left
        left = rest
        const c = closures.find(([, { code }]) => code === name)
        if (c !== undefined && !made.some(([k]) => k === name)) {
            const lowered = lowerClosure(c)
            if (lowered[0] === 'error') { return lowered }
            made = [...made, lowered[1]]
            left = [...left, ...uses(lowered[1][1].body)]
        }
    }
    return ok(made)
}

/**
 * The lowering of a module: the signatures of the exported functions to
 * lower, by their names, and the runtime, where the module is lowered over
 * it: the specifiers by which it imports the L0 view and L1's native rows,
 * whose interfaces it then imports, and, where the module reads L1's error
 * table, its specifier and the table, which [`errorTable`](./link/module.f.js#errortable)
 * reads from its text, and, for a program, L1's plain stage, which
 * [`link`](./link/module.f.js#link) merges into it; then the normalized FAST of the
 * module's text and its imports. The functions keep the order of the
 * exports. Each other definition of the module is a constant, named for
 * its place among them, `#c0` first, whose term reads the constants before
 * it; the module keeps those that the functions read, themselves or
 * through the constants that they read, in their order.
 *
 * @type {(signatures: Readonly<Record<string, Signature>>, runtime?: { readonly l0: string, readonly native: string, readonly errors?: { readonly specifier: string, readonly table: readonly (readonly [string, string])[] }, readonly l1?: Module } | null) => (fast: Block, imports?: readonly AstImport[]) => Result<Module, string>}
 */
export const lower = (signatures, runtime = null) => ({ statements, exit }, imports = []) => {
    const table = Object.entries(signatures)
    const exports = exit[0] === 'yield' && exit[1].length === 1 ? exit[1][0] : null
    if (!(exports instanceof Array) || exports[0] !== 'object') { return error('a module that yields no object of exports is not in this slice') }
    /** @type {(entry: Entry<Value>) => Result<readonly [string, readonly Statement[], Value], string>} */
    const entry = entry => entry[0] === '...' || typeof entry[1] !== 'string' ? error('an export of a computed name is not in this slice') : ok([entry[1], ...unwrapped(entry[2])])
    const entries = okList(exports[1].map(entry))
    if (entries[0] === 'error') { return entries }
    const all = entries[1].map(([key, , v]) => /** @type {const} */ ([key, v]))
    const stray = table.find(([k]) => !all.some(([key]) => key === k))
    if (stray !== undefined) { return error(`${stray[0]} has a signature, and the module exports no function ${stray[0]}`) }
    /** What an export of a module of the runtime stands for, by the module's specifier and the export's name. @type {(specifier: string, name: string) => _Import | null} */
    const source = (x, name) => {
        if (runtime === null) { return null }
        const { errors } = runtime
        return x === runtime.l0 ? ['l0', name]
            : x === runtime.native ? ['native', name]
            : errors === undefined || x !== errors.specifier ? null
            : name === 'error' ? ['errors', errors.table]
            : ['refused', `${x} exports error, and no ${name} that is in this slice`]
    }
    const [defined, importOf] = globals(source, imports, [...statements, ...entries[1].flatMap(([, ss]) => ss)])
    /** @type {(b: BindingId) => _Global | undefined} */
    const globalOf = b => defined.find(([x]) => x === b)?.[1]
    const l1 = runtime === null ? null : runtime.l1 ?? null
    /**
     * An export that the table names, or in a program any export, as the
     * function to lower, its signature, which an export that the table
     * does not name has of `any` alone, and the binding that defines it,
     * if one does.
     *
     * @type {(key: string, v: Value, s: Signature | null) => Result<readonly [string, FastFunction, Signature, BindingId | null], string>}
     */
    const choose = (key, v, s) => {
        if (v instanceof Array && v[0] === 'function') { return ok([key, v[1], s ?? untyped(v[1]), null]) }
        const b = v instanceof Array && v[0] === 'ref' ? v[1] : null
        const g = b === null ? undefined : globalOf(b)
        return b !== null && g !== undefined && g[0] === 'function' ? ok([key, g[1], s ?? untyped(g[1]), b])
            : g !== undefined && g[0] === 'refused' ? error(`${key}: ${g[1]}`)
            : error(`${key}: an export that is not a function is not in this slice`)
    }
    const chosen = okList(all.flatMap(([key, v]) => {
        const s = table.find(([k]) => k === key)
        return s !== undefined ? [choose(key, v, s[1])] : l1 === null ? [] : [choose(key, v, null)]
    }))
    if (chosen[0] === 'error') { return chosen }
    const lowered = chosen[1]
    const shared = lowered.find(([, , , b], k) => b !== null && lowered.findIndex(([, , , x]) => x === b) !== k)
    if (shared !== undefined) {
        return error(`${shared[0]} exports the same function as ${lowered.find(([, , , b]) => b === shared[3])?.[0]}`)
    }
    // In a program, a function of the module that calls itself and that it does not export is a function of the IR, `#h0` first, of `any` alone: its copies would never end.
    /** @type {readonly (readonly [string, FastFunction, Signature, BindingId | null])[]} */
    const helpers = l1 === null ? [] : defined
        .flatMap(([b, g]) => g[0] === 'function' && g[1].self !== null && !lowered.some(([, , , x]) => x === b) ? [/** @type {const} */ ([b, g[1]])] : [])
        .map(([b, f], k) => /** @type {const} */ ([`#h${k}`, f, untyped(f), b]))
    const own = [...lowered, ...helpers]
    /**
     * What a term that the lowering makes reads where it reads `b`, once it
     * has made the constants in `done`: a function, which it calls or
     * inlines, a name of an import, or a constant.
     *
     * @type {(done: readonly _Lowered[]) => (b: BindingId) => Result<_Meaning, string>}
     */
    const captureIn = done => b => {
        const mine = own.find(([, , , x]) => x === b)
        const g = globalOf(b)
        const exported = all.find(([, v]) => v instanceof Array && v[0] === 'ref' && v[1] === b)
        return mine !== undefined ? ok(['function', mine[0]])
            : g === undefined || g[0] === 'args' ? error("a capture of the module's imports is not in this slice")
            : g[0] === 'refused' ? error(g[1])
            : g[0] === 'constant' ? ofConstant(done.find(([x]) => x === b)?.[1])
            : g[0] !== 'function' ? ok(g)
            : exported !== undefined ? error(`${exported[0]} has no signature`)
            : ok(['module', g[1]])
    }
    const interfaces = runtime === null ? [] : [...l0, /** @type {const} */ (['Native', native])]
    const unexported = defined.flatMap(([, g]) => g[0] === 'function' ? [g[1]] : [])
    const tops = [...lowered.map(([, f]) => f), ...unexported]
    /** @type {(done: readonly _Lowered[]) => (v: Value) => Result<_Meaning, string>} */
    const moduleIn = done => ofModule(interfaces, captureIn(done))
    // A program makes its functions of FAST as values, each of its lifted code.
    const closures = l1 === null ? [] : closuresOf(tops, unexported, [statements, entries[1]])
    /** @type {(f: FastFunction) => _Closure | null} */
    const closureOf = f => closures.find(([g]) => g === f)?.[1] ?? null
    const ir = {
        functions: [
            ...own.map(([key, , s]) => /** @type {const} */ ([key, s])),
            ...(l1 === null ? [] : l1.functions.map(([k, f]) => /** @type {const} */ ([linkedName(k), signature(f.params, f.result)]))),
            ...closures.map(([, { code }]) => /** @type {const} */ ([code, signature([['#self', func], ['#args', array]], any)])),
        ],
        imports: interfaces,
        closureOf,
    }
    /** The constants that the lowering made, and the next, which reads those. @type {(done: readonly _Lowered[], definition: readonly [BindingId, Value], k: number) => readonly _Lowered[]} */
    // Each function of the module that it does not export has one value, a constant that `init` makes, where a term reads it.
    /** @type {readonly (readonly [string, ConstantOf<Term>])[]} */
    const sharedConstants = closures.flatMap(([f, { code, shared: name }]) => name === null ? [] : [/** @type {const} */ ([name, {
        type: func,
        value: call('Functions', 'make_function', [
            codeOf(code),
            cast(array, call('Containers', 'seal', [call('Containers', 'begin_array', [n(0n)])]), 'array', a => a),
            n(BigInt(f.parameters.length)),
            constant('Any', 'undefined'),
        ]),
    }])])
    /** @type {_Context['constants']} */
    const sharedTypes = sharedConstants.map(([name, { type }]) => [name, type])
    /** The constants that the lowering made, and the next, which reads those. @type {(done: readonly _Lowered[], definition: readonly [BindingId, Value], k: number) => readonly _Lowered[]} */
    const addConstant = (done, [b, v], k) => [...done, [b, lowerConstant({ ...ir, constants: [...sharedTypes, ...typesOf(done)] }, captureIn(done), importOf)(`#c${k}`, v)]]
    const done = defined.flatMap(([b, g]) => g[0] === 'constant' ? [/** @type {const} */ ([b, g[1]])] : []).reduce(addConstant, [])
    const capture = captureIn(done)
    const context = { ...ir, constants: [...sharedTypes, ...typesOf(done)] }
    const functions = okList(lowered.map(([key, f, s]) => lowerFn(context, capture)([key, f, s])))
    if (functions[0] === 'error') { return functions }
    const lowerOne = lowerClosure(context, moduleIn(done))
    const candidates = [...sharedConstants, ...done.flatMap(([, r]) => r[0] === 'ok' ? [r[1]] : [])]
    // The constants that the functions read keep the code of the closures that they make, whose code may read more,
    // and the functions of the module that call themselves are lowered once something reached calls them.
    /** @type {readonly (readonly [string, Fn])[]} */
    let made = []
    /** @type {readonly (readonly [string, Fn])[]} */
    let called = []
    let growing = true
    while (growing) {
        const before = called
        const reached = [...functions[1], ...before, ...made]
        const [kept] = candidates.reduceRight(keep, [[], reached.flatMap(([, f]) => reads(f.body))])
        const used = [...reached.flatMap(([, f]) => uses(f.body)), ...kept.flatMap(([, c]) => uses(c.value))]
        const wanted = okList(helpers.filter(([k]) => used.includes(k) && !before.some(([h]) => h === k)).map(([key, f, s]) => lowerFn(context, capture)([key, f, s])))
        if (wanted[0] === 'error') { return wanted }
        const next = madeClosures(lowerOne, closures, used)
        if (next[0] === 'error') { return next }
        growing = next[1].length > made.length || wanted[1].length > 0
        made = next[1]
        called = [...called, ...wanted[1]]
    }
    const everything = [...functions[1], ...called, ...made]
    const [constants] = candidates.reduceRight(keep, [[], everything.flatMap(([, f]) => reads(f.body))])
    /** @type {Module} */
    const m = { imports: interfaces, constants, functions: everything, exports: lowered.map(([key]) => key) }
    if (l1 === null) { return ok(literals(m)) }
    // a program: L1's bodies linked in, then the objects that it only reads back split, then its boxed numbers made once (still as Any.from_f64), then Any's bodies linked in so scalar ops and those boxes are local, then String's short-path length/unit
    return okThen(linkString(stringModule))(okThen(linkAny(anyModule))(mapOk(x => literals(records('l1.get')(x)))(link(l1)(m))))
}
