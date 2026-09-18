/**
 * Type-level API for `fjs/fsc/ast/module.f.mjs`: the AST shape `run`
 * evaluates — `AstModule`, `AstConst`, `AstModuleRef`, `AstArray`,
 * `AstMember`, `AstObject`, `AstAccess`, and `AstBody`.
 *
 * @module
 */

import type { Primitive, Unknown } from '../../media/datajs/types.ts'

/**
 * An import as the module records it: the specifier as written, and
 * whether the import carries `with { type: "json" }`, which JavaScript
 * requires of a JSON module and which makes the file a document to read
 * rather than a module to parse.
 */
export type AstImport = {
    readonly specifier: string
    readonly json: boolean
}

/**
 * A parsed DJS module: its imports, in source order, and its body.
 *
 * The import list indexes `['aref', i]`.
 */
export type AstModule = readonly [readonly AstImport[], AstBody]

/** A value in a module body: a primitive, a reference, an array, an object, a property access, a call, a negation, a function, or a function's arguments. */
export type AstConst = Primitive|AstModuleRef|AstArray|AstObject|AstAccess|AstCall|AstNeg|AstFunction|AstArgs

/**
 * A function of its arguments alone: `(...a) => { const x = …; return v; }`,
 * an {@link AstBody} as a module has one — its entries the body's `const`s
 * in order, the last the value it returns, and `['cref', i]` naming an
 * entry of *this* body. `(...a) => v` is the same function as
 * `(...a) => { return v; }`, so it is the one-entry body `[v]`.
 *
 * {@link AstArgs} is the arguments array; no `aref` stands here, and no
 * `cref` of an enclosing body — a capture is refused where it is written,
 * since a function has no frame yet. The EDAG's `['=>', null, body]`, its
 * body a comma where an entry is unreached, as a module's is.
 *
 * An `aref` is typed as any index all the same, as a `cref` is: the parser
 * never writes a module reference into a body, and one written by hand is
 * not rejected — `lower` gives it no node, as it gives none to a `cref`
 * past the entry holding it.
 */
export type AstFunction = readonly ['=>', AstBody]

/** The arguments array of the function whose body holds it — the rest parameter, whatever it is named. The EDAG's `['args']`. */
export type AstArgs = readonly ['args']

/**
 * A reference to a value defined outside this `AstConst`.
 *
 * - `['aref', i]` — the `i`-th argument of the body, i.e. the `i`-th imported
 *   module of the enclosing `AstModule`.
 * - `['cref', i]` — the `i`-th entry of the enclosing `AstBody`, which is the
 *   module's body or a function's, whichever the reference is written in.
 *
 * Both indices are absolute and zero-based, **not** offsets from the
 * referencing entry: in the body `[a, b, ['cref', 0]]` the reference resolves
 * to `a`, not to the nearest preceding entry `b`.
 *
 * A `cref` index must be smaller than the index of the entry holding it —
 * `run` evaluates a body left to right, so a reference to the current or a
 * later entry is unsatisfiable. It is not rejected: it resolves to the most
 * recently evaluated entry instead.
 */
export type AstModuleRef = readonly ['aref' | 'cref', number]

/** An array value; its elements are evaluated in order. */
export type AstArray = readonly ['array', readonly AstConst[]]

/** One member of an object: the key it is written under — spelled bare, quoted or computed — and its value. */
export type AstMember = readonly [string, AstConst]

/**
 * An object value: its members in the order they are written, a repeated
 * key written twice. The syntax keeps what the value cannot: `run` builds
 * the object JavaScript builds from the same literal — a repeated key at its
 * first position with its last value, integer-like keys first in numeric
 * order — and EDAG's object constructor, `['{}', …]`, takes the members as
 * written, duplicates and all, which only the syntax still has.
 */
export type AstObject = readonly ['object', readonly AstMember[]]

/**
 * A property access, `base.key` or `base[key]`: the base any value — a
 * reference, a literal, or an access — and the key the constant written,
 * a string, or a number from `[0]`. The EDAG's own form, `['.', object,
 * index]`, so the lowering carries it as it is. A key naming a property of
 * a built-in prototype — every name `fjs/js/prototype` lists but `length`
 * — is refused by the parser, so `run` never reads one. A numeric literal
 * is an ordinary base: `1 .x` is `['.', 1, 'x']`.
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
 */
export type AstCall = readonly ['()', AstConst, readonly AstConst[]]

/**
 * A negation, `-v`: the language's one prefix operator, and the EDAG's
 * `['-', exp]` — `op12Id` being `'+'` and `'-'`, each of one operand or
 * two.
 *
 * `-` binds looser than a step, so `-1 .x` is `['-', ['.', 1, 'x']]` and
 * `-1()` is `['-', ['()', 1, []]]`, which is how JavaScript reads them. A
 * negative literal is no longer a literal *here*: `-1` is `['-', 1]` in
 * this tree, since the parser computes nothing. The lowering folds that one
 * case — negating a numeric literal is exact — so the graph holds the leaf,
 * and everything else reaches it as a node whose value `run` works out for
 * the document outputs, or refuses where the conversion is `ToPrimitive`'s.
 */
export type AstNeg = readonly ['-', AstConst]

/**
 * The constants of a body, in declaration order. The **last** entry is the
 * value the body yields; the preceding entries exist to be named by
 * `['cref', i]`.
 *
 * A body describes the function
 *
 * ```js
 * (...args) => { const c0 = ...; const c1 = ...; return <last> }
 * ```
 *
 * A module's body is that function with `args` the imported modules; a
 * function's body ({@link AstFunction}) is that function literally, `args`
 * its rest parameter.
 */
export type AstBody = readonly AstConst[]

/**
 * What the sweep over a module's syntax says about the graph its value
 * denotes: whether a node is reached by two references, and — when none is —
 * which container modules the value reaches, each named once by its id, so
 * that an importer can see a module reached along two import edges as one
 * node reached twice. A shared module reaches nothing worth listing: every
 * importer of it is shared already — under any route it takes into the
 * module, and the modules it reaches count under any route too, since
 * where in the module's value a node sits is not carried, and refusing is
 * the answer that never writes a node twice.
 */
export type Sharing = {
    readonly shared: boolean
    readonly reaches: readonly string[]
}

/**
 * What a module denotes: the value the front end built for it, and what the
 * sweep says of its graph. The sweep's answer is known from the module's
 * syntax — a `const` or a module referenced twice — and is carried beside
 * the value because nothing about a plain object says it afterwards without
 * walking the graph by identity.
 */
export type Denotation = Sharing & { readonly value: Unknown }

/** An imported module as the sweep sees it: what it denotes, under the id an importer names it by — its resolved path. */
export type Import = Denotation & { readonly id: string }

/**
 * What an EDAG of the module anchors, each by index: exactly the code the
 * graph would not otherwise hold — the body entries and the imports the
 * export does not reach, less what those entries reach themselves — each a
 * computation whose value nothing takes. An entry that is a bare reference
 * is not a node and is never named; an import is named by the first import
 * sharing its node.
 */
export type Anchors = {
    readonly consts: readonly number[]
    readonly imports: readonly number[]
}
