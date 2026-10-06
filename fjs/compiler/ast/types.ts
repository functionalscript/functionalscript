/**
 * Parsed module shapes and the AST helpers used by EDAG lowering.
 * Evaluation belongs to the represented EDAG interpreter.
 *
 * @module
 */

import type { Assert } from '../../asserts/types.ts'
import type { Primitive } from '../../media/datajs/types.ts'
import type { Equal } from '../../types/ts/types.ts'
import type { binaryTags } from './module.f.mjs'

/**
 * An imported binding: the selected export name, the specifier as written, and
 * whether the import carries `with { type: "json" }`, which JavaScript
 * requires of a JSON module and which makes the file a document to read
 * rather than a module to parse.
 */
export type AstImport = {
    readonly specifier: string
    readonly json: boolean
    /** The selected export; null evaluates an empty import list without binding a name. */
    readonly name: string | null
}

/**
 * A parsed module: its imports, in source order, and its body. The last
 * body entry constructs the object of exports, with its keys in JavaScript namespace order.
 *
 * The import list indexes `['aref', i]`, each a selected export binding.
 */
export type AstModule = readonly [readonly AstImport[], AstBody]

/** A value in a module body: a primitive, a reference, an array, an object, a property access, a call, a negation, a bitwise not, a logical not, a binary operator, a conditional, a function, a fixed parameter, a rest array, a slot of its frame — or a `throw`, which a body may end with in place of a value. */
export type AstConst = Primitive|AstModuleRef|AstArray|AstObject|AstAccess|AstCall|AstNeg|AstBitnot|AstNot|AstBinary|AstConditional|AstFunction|AstRest|AstArg|AstFrameRef|AstThrow

/**
 * A `throw`, `throw v;`: the statement a function's block body, or a
 * module's, may end with in place of its `return` or its exports — the
 * EDAG's `['throw', exp]`, an operation that establishes its operand and
 * fails with it as the thrown value
 * ([spec: functions](../../../spec/README.md#functions)). The parser writes
 * it as the last entry of a body and nowhere else; lowering preserves the
 * operation so interpretation fails with the represented thrown value.
 */
export type AstThrow = readonly ['throw', AstConst]

/**
 * A function: `(...a) => { const x = …; return v; }`, an {@link AstBody}
 * as a module has one — its entries the body's `const`s in order, the last
 * the value it returns, and `['cref', i]` naming an entry of *this* body.
 * `(...a) => v` is the same function as `(...a) => { return v; }`, so it is
 * the one-entry body `[v]`.
 *
 * {@link AstRest} is the rest array. A name the body reads from the
 * scopes around it is a **capture**: the function's fourth element lists
 * them, each once, in the order the body first names them, each the
 * enclosing scope's own reference — a `cref` or `aref` of the module, a
 * `cref` of an enclosing body, its fixed/rest binding, or a slot of *its* frame, since
 * a nested function captures through its parent — and the body names
 * capture `i` as {@link AstFrameRef} `['fref', i]`. A function that
 * captures nothing has no fourth element. The second element is the fixed
 * parameter count. The EDAG's `['=>', length, slots, body]`,
 * its slots the captured values less the primitives — `lower`
 * writes a primitive into the body — and its body a comma where an entry is
 * unreached, as a module's is.
 *
 * An `aref` is typed as any index all the same, as a `cref` is: the parser
 * never writes a module reference into a body, and one written by hand is
 * not rejected — `lower` gives it no node, as it gives none to a `cref`
 * past the entry holding it.
 */
export type AstFunction = readonly ['=>', number, AstBody] | readonly ['=>', number, AstBody, readonly AstConst[]]

/**
 * Slot `i` of the frame of the function whose body holds it: the value its
 * capture `i` names in the scope around the function. The EDAG's
 * `['frame', i]`.
 */
export type AstFrameRef = readonly ['fref', number]

/** The rest array after the function's fixed prefix, whatever the source name. The EDAG's `['rest']`. */
export type AstRest = readonly ['rest']

/** A fixed parameter of the owning function. */
export type AstArg = readonly ['arg', number]

/**
 * A reference to a value defined outside this `AstConst`.
 *
 * - `['aref', i]` — the `i`-th argument of the body, i.e. the `i`-th imported
 *   binding's selected export in the enclosing `AstModule`.
 * - `['cref', i]` — the `i`-th entry of the enclosing `AstBody`, which is the
 *   module's body or a function's, whichever the reference is written in.
 *
 * Both indices are absolute and zero-based, **not** offsets from the
 * referencing entry: in the body `[a, b, ['cref', 0]]` the reference resolves
 * to `a`, not to the nearest preceding entry `b`.
 *
 * A `cref` index must be smaller than the index of the entry holding it.
 * The parser preserves declaration order; lowering trusts those references.
 */
export type AstModuleRef = readonly ['aref' | 'cref', number]

/**
 * An item of an array or of a call's arguments: a value, or a spread of
 * one, {@link AstSpread}.
 */
export type AstItem = AstConst | AstSpread

/**
 * A spread, `...v`: its operand evaluated in its place, and what it
 * contributes decided by where it stands, as JavaScript decides it. Among
 * the items of an array or a call, {@link AstItem}, the operand is iterated,
 * each value it yields one item — an array's elements, a string's code
 * points — and every other value refused, as `GetIterator` refuses it.
 * Among the entries of an object, {@link AstEntry}, the operand's own
 * properties are copied — an array's elements by index, a string's code
 * units — and every other value contributes nothing, as `CopyDataProperties`
 * copies it. No value of its own, so it stands in those two lists alone.
 */
export type AstSpread = readonly ['...', AstConst]

/** An array value; its items are evaluated in order. */
export type AstArray = readonly ['array', readonly AstItem[]]

/**
 * One member of an object, tagged `:` as the EDAG's property is: the key it
 * is written under — spelled bare, quoted or computed — and its value. The
 * tag keeps a member apart from a spread, `['...', v]`, which a key `...`
 * would otherwise spell too: `{ "...": 1 }` is a property.
 */
export type AstMember = readonly [':', string, AstConst]

/**
 * An entry of an object literal: a member, or a spread, `...v`, whose
 * operand's own properties are copied in its place — an object's in own
 * property order, an array's elements by index, a string's code units, and
 * nothing from any other value — as `CopyDataProperties` copies them. A
 * copied key behaves as a written one: a later value wins and the key
 * keeps its first position.
 */
export type AstEntry = AstMember | AstSpread

/**
 * An object value: its entries in the order they are written, a repeated
 * key written twice. EDAG's object constructor, `['{}', …]`, takes those
 * entries as written. Interpretation produces a represented object with a
 * repeated key at its first position and last value, integer-like keys first
 * in numeric order, as JavaScript does.
 */
export type AstObject = readonly ['object', readonly AstEntry[]]

/**
 * A property access, `base.key` or `base[key]`: the base any value — a
 * reference, a literal, or an access — and the key the constant written,
 * a string, or a number from `[0]`. The EDAG's own form, `['.', object,
 * index]`, so the lowering carries it as it is. A key naming a property of
 * a built-in prototype — every name `fjs/js/prototype` lists but `length`
 * — is refused by the parser where the access is read; where the access is
 * a call's callee the parser checks the key
 * against `prohibitedCalls` instead, so a callee access may carry a member
 * function's name, `at` or `toString`. A numeric literal is an ordinary
 * base: `1 .x` is `['.', 1, 'x']`.
 */
export type AstAccess = readonly ['.', AstConst, string | number]

/**
 * A call, `f(a, b)`: the callee any value, and the arguments in the order
 * written.
 *
 * The EDAG spells a call two ways and the lowering picks by the callee: a
 * callee that is an access is a *method* call, `a.b(c)`, whose receiver is
 * that access's base — the `.` node owns its call, `['.', a, 'b', ['|()',
 * args]]` — and any other callee is the plain `['()', callee, args]`, which
 * over an access is the detached receiver, `(0, a.b)(c)`. That one needs the
 * comma operator and is unspellable, so every call written on a property
 * today is a method call.
 *
 * One call the lowering does not keep: a call, with no arguments, of a
 * parameterless function written at the call, `isInlinedCall`, is its body
 * where the call stands. The parser writes that call for a guard's two
 * arms, `if (c) { … }` being sugar for `c ? (() => { … })() : (() => …rest…)()`
 * ([spec: functions](../../../spec/README.md#functions)).
 */
export type AstCall = readonly ['()', AstConst, readonly AstItem[]]

/**
 * A negation, `-v`: the first of the language's prefix operators, and the
 * EDAG's `['-', exp]` — `op12Id` being `'+'` and `'-'`, each of one operand
 * or two.
 *
 * `-` binds looser than a step, so `-1 .x` is `['-', ['.', 1, 'x']]` and
 * `-1()` is `['-', ['()', 1, []]]`, which is how JavaScript reads them. A
 * negative literal is no longer a literal *here*: `-1` is `['-', 1]` in
 * this tree, since the parser computes nothing. The lowering folds that one
 * case — negating a numeric literal is exact — so the graph holds the leaf,
 * and everything else reaches the represented interpreter as a node,
 * including conversions through `ToPrimitive`.
 */
export type AstNeg = readonly ['-', AstConst]

/**
 * A bitwise not, `~v`: the EDAG's `['~', exp]`, `op1Id`. Unlike {@link AstNeg}
 * it folds nothing — `~` is exact only over an integer already reduced to
 * one, which is `ToInt32`'s question and not this tree's — so it always
 * reaches the represented interpreter as a node.
 */
export type AstBitnot = readonly ['~', AstConst]

/**
 * A logical not, `!v`: the EDAG's `['!', exp]`, `op1Id`. Like {@link AstBitnot}
 * it folds nothing: what `!` negates is its operand's truthiness, which is
 * `ToBoolean`'s question and not this tree's, so it always reaches the
 * represented interpreter as a node.
 */
export type AstNot = readonly ['!', AstConst]

/**
 * A binary operator, Stages A and B of
 * [`spec/todo/2340-operators.md`](../../../spec/todo/2340-operators.md):
 * arithmetic, strict comparison, bitwise, and the lazy `&&`/`||`/`??` —
 * the EDAG's `op2Id`, and `-` again at two operands, `op12Id`'s other
 * arity, told from {@link AstNeg} by length.
 *
 * Lowering preserves the operation; the represented EDAG interpreter owns
 * conversion, evaluation order and failures over the graph's values.
 *
 * A lazy operator's right operand is established only when the left
 * decides nothing — `a && b`'s `b` when `a` is truthy, `a ?? b`'s when `a`
 * is nullish — exactly as the EDAG's `op2Id` states it, positionally: the
 * same node reached from an eager position elsewhere is established
 * there. The shape says nothing of it; what reads the shape does, and
 * `anchors` is where it matters, since a `const` reached only through a
 * lazy position is still evaluated at module load.
 */
export type AstBinary = readonly [BinaryTag, AstConst, AstConst]

/** Every binary operator Stages A and B admit, the tag doubling as the EDAG's own — `op12Id`'s `-` included, told from the unary `['-', AstConst]` by arity. `../parser/syntax/types.ts`'s `Node` carries the same tags, imported from here, so `toNode`'s fold and `lower`'s dispatch both key off one name per operator. `binaryTags` in `./module.f.mjs` is the same list at run time. */
export type BinaryTag =
    | '*' | '/' | '%' | '**'
    | '+' | '-'
    | '===' | '!==' | '<' | '<=' | '>' | '>='
    | '&' | '|' | '^' | '<<' | '>>' | '>>>'
    | '&&' | '||' | '??'

type _BinaryTagsAreComplete = Assert<Equal<(typeof binaryTags)[number], BinaryTag>>

/**
 * The conditional, `c ? t : e`: the EDAG's `op3`, `['?:', c, t, e]`, the
 * one node of three operands — always three, so nothing decides its arity
 * as length decides `-`'s. It establishes `c` and then exactly one arm,
 * the one `ToBoolean(c)` selects; both arms are lazy positions to
 * `anchors`, as `&&`'s right operand is.
 */
export type AstConditional = readonly ['?:', AstConst, AstConst, AstConst]

/**
 * The constants of a body, in declaration order. The **last** entry is the
 * value the body yields — or the {@link AstThrow} it ends with instead; the
 * preceding entries exist to be named by `['cref', i]`.
 *
 * A body describes the function
 *
 * ```js
 * (...args) => { const c0 = ...; const c1 = ...; return <last> }
 * ```
 *
 * A module's body is that function with `args` the selected import bindings
 * and the last value its export object; a
 * function's body ({@link AstFunction}) is that function literally, `args`
 * its rest parameter.
 */
export type AstBody = readonly AstConst[]

/**
 * What an EDAG of the module anchors, each by index: exactly the code the
 * graph would not otherwise hold — the body entries and the imports the
 * export does not reach through eager positions alone, less what those
 * entries reach themselves the same way — each a computation whose value
 * nothing is guaranteed to take. An entry that is a bare reference
 * is not a node and is never named; an import is named by the first import
 * sharing its node.
 */
export type Anchors = {
    readonly consts: readonly number[]
    readonly imports: readonly number[]
}
