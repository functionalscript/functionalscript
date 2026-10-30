/**
 * Resolve admitted source names and preserve source blocks, assignments,
 * parameter plans and loop source evidence for the common sugar pass.
 *
 * The explicit work stack keeps source depth independent of the host stack.
 * The parser owns declaration, key and capture admission; sugar owns generated
 * bindings, invocation layout and graph normalization.
 *
 * @module
 * @import { Result } from '../../types/result/types.ts'
 * @import { BindingEvent, BindingId, BindingScope, LoopTarget } from '../../js/ast/types.ts'
 * @import { ExpansionPlan, SourceValue, SourceStatement, SourceBlock, SourceImport, SourceModule, SourceSwitch } from '../../js/ast/sugar/source.ts'
 * @import { List } from '../../types/list/types.ts'
 * @import { ModuleTokenWithMetadata } from '../tokenizer/types.ts'
 * @import { AstImport } from '../ast/types.ts'
 * @import { BindingOrigin, ParseError, ResolvedModule } from './types.ts'
 * @import { Assignment, BindingTarget, Block, Chain, ComputedKey, ConstantMember, Const, Container, Discard, Element, Entry, For, If, Import, Item, Key, LoopSwitch, Module, Node, ParameterList, Statement, Step, Switch, ValueStatement, While } from './syntax/types.ts'
 * @import { ValueAccess, ValueArray, ValueBinary, ValueIn, ValueInstanceOf, ValueKey, ValueCall, ValueComma, ValueConditional, ValueEntryFunction, ValueHasEntryFunction, ValueIntrinsic, ValueEntry, ValueItem, ValueMember, ValueObject, ValueStatic, ValueSpread, ValueStep, ValueUnary, _AccessFrame, _BodyFrame, _Bound, _CallFrame, _CasePath, _ChainFrame, _ChainPart, _CommaFrame, _ConditionalFrame, _Counted, _IndexFrame, _ContainerFrame, _DeclarationKind, _Declaring, _Env, _Self, _Evaluated, _Frame, _GuardFrame, _LateFrame, _LoopBodyFrame, _LoopSwitchFrame, _Plan, _Ref, _Scope, _Stack, _State, _SwitchFrame } from './private.ts'
 */

import { error, mapOk, ok } from '../../types/result/module.f.js'
import { concat, reverse } from '../../types/list/module.f.mjs'
import { toArray } from '../../types/list/alt/module.f.mjs'
import { sort } from '../../types/object/module.f.mjs'
import { at, empty, setReplace } from '../../types/ordered_map/module.f.mjs'
import { assert, assertNotNullish, assertOk } from '../../asserts/module.f.js'
import { analyzeBindings } from '../../js/ast/module.f.mjs'
import { planPattern } from '../../js/ast/sugar/pattern/module.f.mjs'
import { maxLength } from '../../types/function/length/module.f.mjs'
import { isKeyword, isReservedGlobal } from '../../js/keywords/module.f.js'
import { prohibitedCalls, prototypeNames } from '../../js/prototype/module.f.js'
import { nameOf, parseSyntax, textOf } from './syntax/module.f.mjs'
import { isBinary, isUnary } from '../ast/module.f.js'
import { intrinsicLength, intrinsics, staticIds, staticPath } from '../../edag/module.f.mjs'
import { hasEntry } from '../../types/object/entry/module.f.js'

// -- resolving the names ------------------------------------------------------

/**
 * The key of `{ __proto__: v }` and `{ "__proto__": v }`. JavaScript reads
 * both as an instruction to replace the object's prototype instead of as a
 * property, so FunctionalScript rejects them and accepts only the computed
 * spelling `{ ["__proto__"]: v }` and the shorthand `{ __proto__ }`, which
 * denote an ordinary property, as they do in JavaScript.
 * See [spec: the `__proto__` key](../../../spec/values/objects/README.md#the-__proto__-key).
 */
const protoKey = '__proto__'

/** @type {(message: string) => (t: ModuleTokenWithMetadata) => ParseError} */
const foldError = message => ({ metadata }) => ({ message, metadata })

/** A plain `__proto__` key, at the key. */
const protoKeyError = foldError('__proto__ requires the computed key form')

/** A reference to a name nothing binds, at the reference. */
const constNotFound = foldError('const not found')

/** A name bound twice, at the second binding. */
const duplicateId = foldError('duplicate id')

/** A braced switch arm must leave the arm rather than fall into the next one. */
const unterminatedCase = foldError('switch case does not terminate')

/**
 * An assignment to a name that is no variable's — a `const`'s, an import's,
 * a function's own — at the name: JavaScript throws on it where this fold
 * refuses it ([spec: variables](../../../spec/bindings/variables/README.md)).
 */
const constAssignment = foldError('assignment to const')

/**
 * A reference, from a function nested in the one that declares it and held
 * as a value, to a variable assigned anywhere in that scope, at the
 * reference: JavaScript's closure sees the variable's last value, where the
 * function's capture holds the value it had when the function was made, so
 * the program is refused rather than read another way — whether the
 * assignment comes before or after the reference. A function called where
 * it is written reads the value of that moment in both, and is admitted.
 * Writes across an ordinary function boundary remain refused; a direct
 * argumentless call normalized as an expression block instead transports
 * its updated immutable values into the surrounding continuation
 * ([spec: variables](../../../spec/bindings/variables/README.md)).
 */
const reassignedCaptured = foldError('reassigned variable captured')

/**
 * A parameter list whose first parameter is no binding target — no name
 * and no pattern — at the `(` that opened it: `(1) => 2`, `(a.b) => 1`,
 * `((a)) => 1`, JavaScript's own early error, by its own name. The grammar
 * admits the value there so that one symbol can decide between a list and
 * a group (`afterValue` in `./grammar/module.f.mjs`), and this is the
 * check that decision left. A value that is no target inside the head's
 * pattern, `([(a)]) => 1`, is {@link invalidTarget} where it stands, as in
 * a `const`.
 */
const malformedParameters = foldError('malformed parameter list')

/**
 * A value where a binding pattern wants a target, at the token it begins
 * with — `const [1] = a;`, `const { a: b.c } = o;`, `const [(a)] = x;`,
 * the last a group, which JavaScript admits in an assignment pattern and
 * refuses in a binding one — by JavaScript's own name for the error.
 */
const invalidTarget = foldError('invalid destructuring target')

/**
 * A rest element or property in a binding pattern, `[a, ...r]` or
 * `{ a, ...r }`, at its `...`: JavaScript's, and not read yet
 * ([destructuring](../../../spec/todo/2450-destructuring.md)), so refused
 * by name rather than read in part.
 */
const restTarget = foldError('rest element not supported')

/**
 * A hole in an array value, `[1, , 2]` or `[,]`, at the comma that makes
 * it: refused by design, an array of the language having none
 * ([spec: arrays](../../../spec/values/arrays/README.md)). The grammar admits
 * the comma for an array pattern's sake, where it is an elision and skips
 * an element ([spec: destructuring](../../../spec/bindings/destructuring/README.md)),
 * and the position alone tells the two apart, so the refusal is here.
 */
const arrayHole = foldError('array hole')

/**
 * A computed key in a binding pattern that is no constant, `{ [k]: a }`,
 * at the token the key begins with. A string or a number literal alone in
 * the brackets, `{ ["a"]: t }` or `{ [3]: t }`, is the constant key an
 * access admits in brackets and never reaches here; the rest is not read
 * yet, the conversion `Number(i)` an access admits included — a body's
 * statement is resolved as one value, and the key would be a second value
 * to resolve inside the statement
 * ([destructuring](../../../spec/todo/2450-destructuring.md)).
 */
const computedPatternKey = foldError('computed key in a binding pattern not supported')

/**
 * A body `const` binding a name the body has already read from a scope
 * around it, at the binding. JavaScript resolves every reference in the
 * body to the body's own `const`, the ones before it included — a read
 * before it is initialized throws, and a function written before it reads
 * it once called — so the capture already taken would be a different
 * value, and the program is refused instead. Not a rule of the language,
 * which leaks nothing here, but a forward reference inside a body not yet
 * supported: `./todo/body-const-forward-reference.md`.
 */
const captureShadowed = foldError('capture shadowed')

/**
 * A keyword where JavaScript wants an identifier, at the word — or a
 * reserved global, `Number` or `String`, bound or read anywhere but as the
 * callee of the conversion, {@link conversion}, or `Object` or `Number`
 * anywhere but as the namespace of an admitted static function,
 * {@link staticRead}: never a module's to bind, under
 * [spec: global names](../../../spec/todo/2365-global-names.md)' rule, and
 * no value, so `Number.MAX_VALUE`, `Object.keys` and a bare `Number` are
 * refused at the word as `typeof.x` would be.
 */
const reservedWord = foldError('reserved word')

/**
 * The call of `Number` or `String` with more than one argument, or a spread,
 * at the word: `Number(a, b)` and `Number(...a)`, refused by design. A
 * conversion is an operator, whose fixed set of operands the compiler
 * checks, and an extra or spread argument says more than the conversion
 * does — `Number(s, 16)` reads as a radix JavaScript ignores
 * ([spec: operators and functions](../../../spec/principles/README.md#operators-and-functions)).
 * `Number()` is `0`, and is read as the literal, {@link conversion}, as
 * `String()` is the empty string.
 *
 * @type {(name: 'Number' | 'String') => (token: ModuleTokenWithMetadata) => ParseError}
 */
const conversionArity = name => foldError(`${name} takes one argument`)

/**
 * A token on the wrong side of a line break, at that token: the first
 * token of a statement on the line of the statement before it, written
 * without its `;` — the error the grammar reported there when the `;` was
 * required, and the one JavaScript reports, which inserts a `;` before a
 * token only where a newline does
 * ([spec: module structure](../../../spec/modules/README.md)) —
 * and the tokens JavaScript forbids a newline before, an `=>` and the
 * value after `return` or `throw`
 * ([spec: line terminators](../../../spec/lexical/whitespace/README.md)).
 */
const unexpectedToken = foldError('unexpected token')

/**
 * A module that neither throws nor exports a name, at its last `export`:
 * every exported `const` was a pattern binding no name, `export const {} = o;`,
 * and no `export default` followed. A module that does not throw exports at
 * least one name ([spec: exports](../../../spec/modules/exports/README.md)),
 * which the grammar asked of the `export` keyword while a `const` always
 * bound one.
 */
const noExport = foldError('module exports nothing')


/**
 * Whether a `return` or `throw`'s value is refused at its first token:
 * JavaScript has `[no LineTerminator here]` after both keywords, so a value
 * beginning a line would end the statement there — `return` returning
 * `undefined`, `throw` a syntax error — and is refused rather than read
 * another way.
 *
 * @type {(statement: ValueStatement) => boolean}
 */
const brokenLine = statement => statement.first.newline

/**
 * Whether `next` is refused at its first token: `previous` ended without
 * its `;`, and `next` begins on the same line. Nothing before the first
 * statement, and a `}` or the end of input after the last, so neither is
 * asked; nor is a guard or a switch, which ends at its `}` and takes no
 * `;`, so the statement after one may share its line, as in JavaScript.
 *
 * @type {(previous: Statement | If | Switch | LoopSwitch | While | null, next: Statement | If | Switch | LoopSwitch | While) => boolean}
 */
const unterminated = (previous, next) => previous !== null && hasEntry(previous, 'semicolon') && !previous.semicolon && !next.start.newline

/** A fixed parameter past the language's limit on a function's `length`, at the first one past it. */
const tooManyParameters = foldError(`more than ${maxLength} fixed parameters`)


/** Source identity is independent of the value its initialization computes. @type {(index: number) => BindingId} */
const sourceBinding = index => ({ index })

/** @type {(scope: _Scope, events: readonly BindingEvent[]) => _Scope} */
const traced = (scope, events) => ({ ...scope, trace: { ...scope.trace, events: concat(scope.trace.events)(events), count: scope.trace.count + events.length } })

/** Materialize ordered evidence once at a source function or region boundary. @type {(scope: _Scope) => BindingScope} */
const completedTrace = scope => ({ target: scope.trace.target, bindings: scope.trace.bindings, events: toArray(scope.trace.events) })

/** @type {(plan: _Plan, kind: _DeclarationKind) => readonly BindingOrigin[]} */
const planOrigins = (plan, kind) => {
    /** @type {List<BindingOrigin>} */
    let origins = null
    let named = 0
    // Names follow their read indices, so each name and hidden read is visited once.
    for (let index = 0; index < plan.ids.length; index += 1) {
        const entry = plan.names[named]
        const name = entry !== undefined && entry[1] === index ? entry[0] : undefined
        if (name !== undefined) { named += 1 }
        origins = { first: { id: plan.ids[index], name: name === undefined ? null : nameOf(name), kind: name === undefined ? 'temporary' : kind, metadata: name?.metadata ?? plan.metadata }, tail: origins }
    }
    return toArray(reverse(origins))
}

/** Declare before initialization without making the name readable in its TDZ. @type {(scope: _Scope, plan: _Plan, kind: _DeclarationKind) => _Scope} */
const declared = (scope, plan, kind) => ({ ...scope, trace: { ...scope.trace, bindings: [...scope.trace.bindings, ...plan.ids] }, sourceOrigins: [...scope.sourceOrigins, ...planOrigins(plan, kind)] })

/** Whether a declaration's names are variables, which an assignment may rebind: a `let`'s and a parameter's. @type {(kind: _DeclarationKind) => boolean} */
const isVariable = kind => kind !== 'const'

/** Initialize each expanded identity once; aliases retain separate source IDs. @type {(scope: _Scope, plan: _Plan) => _Scope} */
const initialized = (scope, plan) => traced({
    ...scope,
    origins: plan.names.reduce((origins, [name, index]) => setReplace(nameOf(name))(plan.ids[index])(origins), scope.origins),
}, plan.ids.map(id => ['initialize', id]))

/** @type {() => _Scope} */
const moduleScope = () => ({
    names: empty, origins: empty, count: 0, parameters: [], rest: null, enclosing: null, outer: null,
    self: null, selfBinding: null, selfVariable: false, captures: [], region: false, inFunction: false, blockCall: false,
    trace: { target: { kind: 'function', index: 0 }, bindings: [], events: null, count: 0 }, sourceOrigins: [],
})

/** A lexical region shares its source function target. @type {(outer: _Scope, names: _Env, enclosing: List<_Env>) => _Scope} */
const regionScope = (outer, names, enclosing) => ({
    names, origins: empty, count: 0, parameters: [], rest: null, enclosing, outer, self: null, selfBinding: null, selfVariable: false, captures: [], region: true, inFunction: outer.inFunction, blockCall: false,
    trace: { target: outer.trace.target, bindings: [], events: null, count: 0 }, sourceOrigins: [],
})

/**
 * The word an identifier token spells where JavaScript wants an identifier
 * — a name bound or referenced — refusing every keyword: the tokenizer
 * demotes them all to `id`, so that a key or the name after `.` may be one,
 * and here is where the distinction is made. `const if = 1;` is a syntax
 * error in JavaScript, so it is an error here. A reserved global is refused
 * the same way, {@link reservedWord}: `Array`, `Number`, `Object` and
 * `String` name no binding and no value, and the places each stands are
 * read before the word reaches here — `instanceof`'s right operand, which
 * the fold checks for the word itself, the conversion's callee,
 * {@link conversion}, the namespace of a static function,
 * {@link staticRead}, and that of the `entry` helper, {@link entryFunction}.
 *
 * @type {(name: ModuleTokenWithMetadata) => Result<string, ParseError>}
 */
const identifierOf = name => {
    const word = nameOf(name)
    return isKeyword(word) || isReservedGlobal(word) ? error(reservedWord(name)) : ok(word)
}

/**
 * An `instanceof` whose right operand is not a reference to `Array`, at
 * the operator: the language admits that one constructor, and reads the
 * word, not a value — so an access, a literal or a parenthesized value
 * other than the bare reference is refused here, whatever it would be
 * in JavaScript.
 */
const instanceofRight = foldError('the right operand of instanceof must be Array')

/**
 * An `in` whose left operand is not a string literal, at the operator: the
 * language admits that one key, written in the source, so that the names
 * it refuses are refused here, as the key of a read is; a key computed at
 * run time is the `hasEntry` helper's to test
 * ([spec: the `in` record](../../../spec/todo/2346-in-operator.md)).
 */
const inLeft = foldError('the left operand of in must be a string literal')

/** An attribute key the language does not know, at the key: `type` is the one JavaScript defines. */
const unknownAttribute = foldError('unknown import attribute')

/** A module type the language does not read, at the value: `json` is the one JavaScript defines. */
const unknownType = foldError('unknown import type')

/**
 * An import as the AST records it: its specifier, and whether its attribute
 * names a JSON module — the one attribute JavaScript defines, `type`, with
 * the one value it reads, `json`; any other key or value is refused where
 * it stands.
 *
 * @type {(statement: Import) => Result<Omit<AstImport, 'name'>, ParseError>}
 */
const imported = ({ module, attribute }) => {
    if (attribute === null) { return ok({ specifier: module, json: false }) }
    const [key, value] = attribute
    if (nameOf(key) !== 'type') { return error(unknownAttribute(key)) }
    if (textOf(value) !== 'json') { return error(unknownType(value)) }
    return ok({ specifier: module, json: true })
}

/**
 * A key that names a property of a built-in prototype, at the key, in
 * either spelling. An access reads an own property, and JavaScript reads
 * the prototype's where the value owns none: `a.push` is a function there
 * and nothing here, `a.__proto__` and `a.constructor` reach a function's
 * constructor through any object — so every such name is refused, as
 * [spec: property accessor](../../../spec/todo/2330-property-accessor.md)
 * has it, and a module means one thing in both languages.
 */
const prohibitedKey = foldError('prohibited property name')

/**
 * The refusal of a method call's key: a member function a module may not
 * call, `a.push(1)` or `a.valueOf()` — a mutator, the prototype protocol, a
 * locale-dependent or regular-expression method, and the rest
 * `fjs/js/prototype`'s `prohibitedCalls` names, its README saying why for
 * each. The other prototype names are member functions the VM answers by
 * the receiver's type, so `a.at(0)` and `a.toString()` are calls like any
 * other, though `a.at` and `a.toString` stay refused as reads: a detached
 * built-in is a function that only fails.
 */
const prohibitedCall = foldError('prohibited member function')

/**
 * The names an access may not read: every name a built-in prototype gives
 * a value, `fjs/js/prototype`, but `length` — an own property of an array,
 * a string and a function, which the two languages read alike.
 *
 * @type {ReadonlySet<string>}
 */
const prohibitedNames = new Set(prototypeNames.filter(name => name !== 'length'))

/**
 * The names a method call may not call: `prohibitedCalls`, as a set.
 *
 * @type {ReadonlySet<string>}
 */
const prohibitedCallNames = new Set(prohibitedCalls)

/**
 * Why an access of the name is refused, or `null` when it is allowed: a
 * member function a module may not call where the access is a method
 * call's callee, `method`, and a name of the prototype chain where it is
 * read — the two rules of `fjs/js/prototype`'s two lists.
 *
 * Exported for the writer in [`../serializer`](../serializer/module.f.mjs),
 * which refuses the same accesses rather than write one the parser here
 * would not read back: the rule is the language's, and it has one owner,
 * each consumer wrapping the answer in its own error. The `_` says that
 * export is linkage rather than API, as it does for `_tokenKindNames` in
 * [`./grammar`](./grammar/module.f.mjs).
 *
 * @type {(method: boolean) => (name: string) => 'member function' | 'property name' | null}
 */
export const _prohibitedAccess = method => name =>
    method
        ? (prohibitedCallNames.has(name) ? 'member function' : null)
        : (prohibitedNames.has(name) ? 'property name' : null)

/** What an access's key token names: a name's word, the string's text, or the number. @type {(t: ModuleTokenWithMetadata) => string | number} */
const keyNamed = t => {
    const { token } = t
    switch (token.kind) {
        case 'string': { return token.value }
        case 'number': { return Number(token.value.replaceAll('_', '')) }
        default: { return nameOf(t) }
    }
}

/**
 * An access closed over its base and its constant key: the AST's
 * `['.', base, key]`, or the refusal of its key — a name of the prototype
 * chain where the access is read, and a member function a module may not
 * call where it is a call's callee, `method`. The two rules are
 * `fjs/js/prototype`'s two lists, and the access's shape is the same
 * either way: the lowering makes the callee access a method call,
 * `['.', a, 'b', ['|()', args]]`.
 *
 * @type {(key: ModuleTokenWithMetadata, method: boolean, base: SourceValue) => Result<SourceValue, ParseError>}
 */
const accessClosed = (key, method, base) => mapOk(
    /** @type {(named: string | number) => SourceValue} */
    (named => ['.', base, named]),
)(checkedKey(key, method))

/**
 * A key computed at run time that is no conversion, at the token it begins
 * with: `a[i]`, `a[-1]`, `a[NaN]`. An index is a constant — a string or a
 * number literal — or `Number(i)`, the conversion
 * ([spec: property access](../../../spec/property-access/README.md)); a key
 * of any type is read by the `entry` helper, and a negative or a special
 * number is written as the string it names, `a["-1"]`.
 */
const computedKey = foldError('computed key is not Number(...)')

/**
 * Whether a computed key is the conversion: a call of the word `Number`,
 * whatever its arguments, which the conversion itself judges when entered,
 * {@link conversion} — so `a[Number()]` is `a[0]`, and `a[Number(1, 2)]`
 * is refused as `Number(1, 2)` is anywhere.
 *
 * @type {(node: Node) => boolean}
 */
const isConversion = node => node[0] === '()' && node[1][0] === 'ref' && nameOf(node[1][1]) === 'Number'

/**
 * A computed key entered under `frame`, which receives its value — the
 * access whose base it follows, {@link _IndexFrame}, or a chain, which
 * takes the key among its parts' values — or its refusal, at the token it
 * begins with, {@link computedKey}. It is entered after the base, and after
 * every part of a chain written before it, as JavaScript evaluates it.
 *
 * @type {(stack: _Stack, scope: _Scope, key: ComputedKey, frame: _IndexFrame | _ChainFrame) => _State}
 */
const keyEntered = (stack, scope, [, node, first], frame) => isConversion(node)
    ? [{ top: frame, rest: stack }, scope, ['enter', node]]
    : [stack, scope, error(computedKey(first))]

/**
 * A key's name, or its refusal: a name of the prototype chain where the
 * key is read, and a member function a module may not call where it is
 * called, `method`, as {@link _prohibitedAccess} answers.
 *
 * @type {(key: ModuleTokenWithMetadata, method: boolean) => Result<string | number, ParseError>}
 */
const checkedKey = (key, method) => {
    const named = keyNamed(key)
    if (typeof named === 'string') {
        const why = _prohibitedAccess(method)(named)
        if (why === 'member function') { return error(prohibitedCall(key)) }
        if (why === 'property name') { return error(prohibitedKey(key)) }
    }
    return ok(named)
}

/**
 * Whether steps end in a call: the last of them a call, `(…)`, a guarded
 * one, `?.(…)`, or the call a group put outside a region, `(a?.b)(…)` —
 * and no property. Over an explicit loop, so a chain as long as the input
 * allows costs no call stack.
 *
 * @type {(step: Step) => boolean}
 */
const endsInCall = step => {
    let last = step
    let next = stepAfter(last)
    while (next !== undefined) {
        last = next
        next = stepAfter(last)
    }
    return last[0] !== '|.'
}

/** The steps a chain goes on with after `step`, where it has any. @type {(step: Step) => Step | undefined} */
const stepAfter = ([, , next]) => next

/**
 * Whether a call statement's value is a call: of any value but the word of
 * a conversion, `Number(x)` and `String(x)` being operators
 * ([spec: operators and functions](../../../spec/principles/README.md#operators-and-functions)),
 * read here as the word alone, as {@link conversion} reads it; a guarded
 * call, `f?.(x)`; or a chain whose last step is a call, `a?.b(x)`,
 * {@link endsInCall}. A group is no node, so `(f(x))` is the call it holds.
 *
 * @type {(node: Node) => boolean}
 */
const isCall = node => {
    switch (node[0]) {
        case '()': { return node[1][0] !== 'ref' || !isConversionWord(nameOf(node[1][1])) }
        case '?.()': { return node[3] === undefined || endsInCall(node[3]) }
        case '?.': case '.': { return node[3] !== undefined && endsInCall(node[3]) }
        default: { return false }
    }
}

/**
 * A `const`'s plan, {@link planned}: where it is a call statement, the
 * `const` that binds nothing, `['discard', name]`, its value has to be a
 * call, {@link isCall}, and any other is refused at the name — an
 * operator's result discarded is almost always a mistake, and a conversion
 * is an operator ([spec: call statements](../../../spec/functions/call-statements/README.md)).
 *
 * @type {(check: (name: ModuleTokenWithMetadata) => Result<string, ParseError>) => (target: BindingTarget | Discard, value: Node, namespace: ModuleTokenWithMetadata | null) => Result<_Plan, ParseError>}
 */
const constPlan = check => (target, value, namespace) =>
    target[0] === 'discard' && !isCall(value) ? error(unexpectedToken(target[1])) : planned(check)(target, namespace)

/**
 * Source declaration and key policy for the sugar-owned structural pattern
 * planner. Callbacks run during its single source-order walk, preserving the
 * first diagnostic without assigning normalization decisions to the parser.
 *
 * @type {(check: (name: ModuleTokenWithMetadata) => Result<string, ParseError>) => (target: BindingTarget | Discard, namespace: ModuleTokenWithMetadata | null) => Result<_Plan, ParseError>}
 */
const planned = check => planPattern({
    name: check,
    key: key => checkedKey(key, false),
    namespaceMember,
    refused: (reason, token) => patternRefusals[reason](token),
})

/** The source admission owner supplies each refused spelling's diagnostic. */
const patternRefusals = { invalid: invalidTarget, rest: restTarget, computed: computedPatternKey, duplicate: duplicateId }

/** @type {(namespace: ModuleTokenWithMetadata, key: ModuleTokenWithMetadata) => Result<ValueStatic, ParseError>} */
const namespaceMember = (namespace, key) => {
    const member = staticMember(nameOf(namespace), keyNamed(key))
    if (member !== null) { return ok(member) }
    const [tag, named] = checkedKey(key, false)
    return tag === 'error' ? error(named) : error(reservedWord(namespace))
}

/** Public plans contain resolved reads, with no source tokens or names. @type {(plan: _Plan) => ExpansionPlan} */
const expansion = ({ reads, ids }) => ({ reads, ids })

/** @type {(scope: _Scope, plan: _Plan, assignable: boolean) => _Scope} */
const boundPlan = (scope, plan, assignable) => initialized({ ...scope, names: plan.names.reduce((names, [token, i]) => extended(names)(nameOf(token), { id: plan.ids[i], kind: 'own', assignable }), scope.names) }, plan)

/**
 * A counting frame past its operand: the next one's position, and what
 * the operand made appended to the ones before it — one value, or the
 * source statements contributed by a declaration.
 *
 * @type {<T, F>(frame: F & _Counted<T>, made: readonly NoInfer<T>[]) => F}
 */
const advanced = (frame, made) => ({ ...frame, index: frame.index + 1, done: concat(frame.done)(made) })

/** Bind a declaration after its initializer has resolved: a `const`'s names, or a `let`'s, which are variables. @type {<F extends _Counted<SourceStatement> & _Declaring>(round: (stack: _Stack, scope: _Scope, frame: F) => _State, stack: _Stack, scope: _Scope, frame: F, kind: 'const' | 'let', value: SourceValue) => _State} */
const landed = (round, stack, scope, frame, kind, value) => {
    const plan = assertNotNullish(frame.plan, 'a declaration with no plan')
    const shadowed = plan.names.find(([name]) => at(nameOf(name))(scope.names) !== null)
    if (shadowed !== undefined) { return [stack, scope, error(captureShadowed(shadowed[0]))] }
    return round(stack, boundPlan(scope, plan, isVariable(kind)), advanced(frame, [['initialize', expansion(plan), value]]))
}

/**
 * The target of an assignment, `name = value`, resolved before the value is
 * entered: the word, then the binding it names — a name nothing binds is
 * `const not found` — which is refused unless a variable's, a `let`'s or a
 * parameter's. A write crossing a function boundary stays pending until
 * that function closes: only an expression-block call can carry it back to
 * its enclosing scope. The write itself is traced once
 * the value has been read, {@link written}, the order the statement runs in.
 *
 * @type {(scope: _Scope, name: ModuleTokenWithMetadata) => Result<readonly [_Scope, BindingId], ParseError>}
 */
const assigned = (scope, name) => {
    const [tag, word] = identifierOf(name)
    if (tag === 'error') { return error(word) }
    const found = resolve(scope, word)
    if (found === null) { return error(constNotFound(name)) }
    const [inner, ref] = found
    if (!ref.assignable) { return error(constAssignment(name)) }
    // Resolving a cached capture need not search across its boundary again.
    // Declaration identity, rather than that search's path, owns the write.
    let current = inner
    let crossed = false
    while (!current.trace.bindings.includes(ref.id)) {
        if (!current.region) {
            if (!current.blockCall) { return error(reassignedCaptured(name)) }
            crossed = true
        }
        current = assertNotNullish(current.outer, 'an assignment has no declaring scope')
    }
    return ok([crossed ? { ...inner, captures: [...inner.captures, { id: ref.id, refusal: reassignedCaptured(name), escaped: false, written: true }] } : inner, ref.id])
}

/** Whether the operand and write occur in a conditional source region. @type {(statement: Assignment) => boolean} */
const logicalAssignment = ({ operator }) => operator !== null && (operator.tag === '&&' || operator.tag === '||' || operator.tag === '??')

/** Record a compound target's read before entering its operand. @type {(scope: _Scope, statement: Assignment, id: BindingId) => _Scope} */
const assignmentScope = (scope, statement, id) => {
    const read = statement.operator === null ? scope : traced(scope, [['read', id]])
    return logicalAssignment(statement) ? regionScope(read, empty, null) : read
}

/** The operand's events precede its write; a logical assignment restores its conditional region. @type {(scope: _Scope, statement: Assignment, id: BindingId) => _Scope} */
const written = (scope, statement, id) => {
    const write = traced(scope, [['write', id]])
    return logicalAssignment(statement) ? restoredScope(write, false) : write
}

/** Preserve the source operation until the shared sugar pass. @type {(statement: Assignment, id: BindingId, value: SourceValue) => SourceStatement} */
const assignmentStatement = (statement, id, value) => statement.operator === null
    ? ['write', id, value]
    : ['compound-write', id, statement.operator.tag, value]

/**
 * A resolved reference, a function's reference to itself counted as crossing
 * the boundary where the function is a variable's, a `let`'s: JavaScript's
 * closure reads the variable, and the function's `self` the function, so the
 * two agree only while the variable is never reassigned — the capture rule's
 * own condition, which recording the reference as a capture lets it keep.
 *
 * @type {(found: readonly [_Scope, _Ref, boolean]) => readonly [_Scope, _Ref, boolean]}
 */
const selfReference = ([scope, ref, crossed]) => [scope, ref, crossed || (ref.kind === 'self' && ref.assignable)]

/**
 * The scope a resolved reference leaves: with the reference noted as a
 * capture where it crossed a function boundary — the first such reference
 * to a binding is where the write-based rule refuses the program, once the
 * whole scope is read, {@link resolvedModule}.
 *
 * @type {(found: readonly [_Scope, _Ref, boolean], name: ModuleTokenWithMetadata) => _Scope}
 */
const referenced = ([scope, ref, crossed], name) => crossed ? { ...scope, captures: [...scope.captures, { id: ref.id, refusal: reassignedCaptured(name), escaped: false, written: false }] } : scope

/** Whether the step after a key makes the key a call's: any step but a property. @type {(step: Step | undefined) => boolean} */
const isCallStep = step => step !== undefined && step[0] !== '|.'

/** The parts of a chain's steps, {@link chainParts}: each key with whether a call follows it, and each argument's operand. @type {(step: Step | undefined) => readonly _ChainPart[]} */
const stepParts = step => {
    if (step === undefined) { return [] }
    if (step[0] === '|.') { return [{ key: step[1], method: isCallStep(step[2]) }, ...stepParts(step[2])] }
    return [...step[1].map(item => ({ value: operandOf(item) })), ...stepParts(step[2])]
}

/**
 * The operands of a chain in document order, {@link _ChainPart}: its base
 * or callee, then each key — with whether a call step follows it, which
 * is what makes the key a method call's — and each argument's operand,
 * in the order they are written, which is the order they are evaluated in
 * and the order their errors are reported in.
 *
 * @type {(chain: Chain) => readonly _ChainPart[]}
 */
const chainParts = chain => {
    if (chain[0] === '?.()') { return [{ value: chain[1] }, ...chain[2].map(item => ({ value: operandOf(item) })), ...stepParts(chain[3])] }
    return [{ value: chain[1] }, { key: chain[2], method: isCallStep(chain[3]) }, ...stepParts(chain[3])]
}

/**
 * A chain's steps with their values put back, from `at` in `values`: a
 * key's name where its token was, each argument's value under its spread.
 *
 * @type {(step: Step, values: readonly SourceValue[], at: number) => ValueStep}
 */
const stepClosed = (step, values, at) => {
    const [tag, x, next] = step
    if (tag === '|.') {
        const key = /** @type {ValueKey} */ (values[at])
        return next === undefined ? ['|.', key] : ['|.', key, stepClosed(next, values, at + 1)]
    }
    const args = x.map((item, i) => itemValue(item)(values[at + i]))
    return /** @type {ValueStep} */ (next === undefined ? [tag, args] : [tag, args, stepClosed(next, values, at + x.length)])
}

/**
 * A chain closed over its parts' values, {@link chainParts}'s order: the
 * AST's own shape, which is the EDAG's, with each value where its operand
 * was and each key's name where its token was.
 *
 * @type {(chain: Chain, values: readonly SourceValue[]) => SourceValue}
 */
const chainClosed = (chain, values) => {
    if (chain[0] === '?.()') {
        const [, , items, step] = chain
        const args = items.map((item, i) => itemValue(item)(values[1 + i]))
        return step === undefined ? ['?.()', values[0], args] : ['?.()', values[0], args, stepClosed(step, values, 1 + items.length)]
    }
    const [tag, , , step] = chain
    const key = /** @type {ValueKey} */ (values[1])
    return /** @type {SourceValue} */ (step === undefined ? [tag, values[0], key] : [tag, values[0], key, stepClosed(step, values, 2)])
}

/**
 * The next part of a chain, or the chain closed when none is left: a
 * value is entered under the frame, and a key is judged here, by the call
 * rule where a call follows it, and its name kept with the values — in
 * document order, so that the first error met is the first written.
 *
 * @type {(stack: _Stack, scope: _Scope, frame: _ChainFrame) => _State}
 */
const chainRound = (stack, scope, frame) => {
    const { parts, index } = frame
    if (index === parts.length) { return [stack, scope, ok(chainClosed(frame.chain, toArray(frame.done)))] }
    const part = parts[index]
    if (hasEntry(part, 'value')) { return [{ top: frame, rest: stack }, scope, ['enter', part.value]] }
    const { key } = part
    if (key instanceof Array) { return keyEntered(stack, scope, key, frame) }
    const [tag, named] = checkedKey(key, part.method)
    if (tag === 'error') { return [stack, scope, error(named)] }
    return chainRound(stack, scope, advanced(frame, [named]))
}

/**
 * Whether the node being entered is a call's callee: the frame on top is
 * the call's, with no operand done yet. An access entered there is a method
 * call's, and its key is checked as one — through a group as well, since
 * `(a.b)(c)` is the node `a.b(c)` is by the time it is entered.
 *
 * @type {(stack: _Stack) => boolean}
 */
const isCallee = stack => stack !== null && hasEntry(stack.top, 'call') && stack.top.index === 0

/**
 * The node an item evaluates: a value's own, or a spread's operand — the
 * spread itself is put back once the operand has its value,
 * {@link itemValue}.
 *
 * @type {(item: Item) => Node}
 */
const operandOf = item => item[0] === '...' ? item[1] : item

/**
 * An item's value from its operand's: the value, or the spread of it where
 * the item was a spread.
 *
 * @type {(item: Item) => (value: SourceValue) => ValueItem}
 */
const itemValue = item => value => {
    if (item[0] !== '...') { return value }
    /** @type {ValueSpread} */
    const spread = ['...', value]
    return spread
}

/**
 * The node an entry evaluates: a member's value, or a spread's operand —
 * a spread is the one entry that is a tuple, a member being a record.
 *
 * @type {(entry: Entry) => Node}
 */
const entryOperandOf = entry => entry instanceof Array ? entry[1] : entry.value

/**
 * An array's element as the item it is: an elision never reaches its
 * value, {@link badKey} refusing it first.
 *
 * @type {(element: Element) => Item}
 */
const elementItem = element => {
    assert(element[0] !== 'elision')
    return element
}

/** @type {(container: Container, index: number) => Node} */
const itemAt = ([kind, items], index) =>
    kind === 'array' ? operandOf(elementItem(items[index])) : entryOperandOf(items[index])

/**
 * The node a member's computed key is, or `null` where the item at `index`
 * has none: an array's item, a spread, or a member whose key is a constant.
 *
 * @type {(container: Container, index: number) => Node | null}
 */
const computedKeyAt = ([kind, items], index) => {
    if (kind === 'array') { return null }
    const entry = items[index]
    return entry instanceof Array || entry.spelling !== 'computed' ? null : entry.node
}

/**
 * A container's item at `index` as the AST holds it, from its value: an
 * array's item, its spread put back, {@link itemValue}; an object's spread
 * likewise, or its member, a property of its name and the value — the
 * computed key's value, `key`, where the member has one. A member is the
 * one item that is a record: an array's items and a spread are tuples.
 *
 * @type {(container: Container, index: number, key: readonly [SourceValue] | null, value: SourceValue) => ValueItem | ValueMember}
 */
const containerValue = ([, items], index, key, value) => {
    const entry = items[index]
    if (entry instanceof Array) { return itemValue(elementItem(entry))(value) }
    /** @type {ValueMember} */
    const member = [':', key === null ? /** @type {ConstantMember} */ (entry).name : key[0], value]
    return member
}

/**
 * The error a container's item earns before its value is read, or `null`:
 * a hole in an array, at its comma, {@link arrayHole}, or a plain
 * `__proto__` key, at the key itself.
 *
 * Checked as each member is reached rather than by scanning every key
 * first, so that an earlier member's failure is reported before a later
 * key's: `{a: missing, __proto__: 1}` reports the unresolved `missing`.
 * Errors are first-to-last, and a key is not special enough to jump the
 * queue.
 *
 * @type {(container: Container, index: number) => ParseError | null}
 */
const badKey = ([kind, items], index) => {
    if (kind === 'array') {
        const element = items[index]
        return element[0] === 'elision' ? arrayHole(element[1]) : null
    }
    const member = items[index]
    // a spread names no key, and a computed key is an own property's
    if (member instanceof Array || member.spelling === 'computed') { return null }
    const { key, name, spelling } = member
    return name === protoKey && spelling !== 'shorthand' ? protoKeyError(key) : null
}

/**
 * A container of the items its rounds built: an array, or an object of
 * its members in the order they are written, a repeated key written
 * twice. The order is not the parser's to change — it is the order the
 * graph a module denotes has, as JavaScript reads the same literal — and
 * the duplicates are not its to collapse: `run` builds the object
 * JavaScript builds, and EDAG's object constructor takes the members as
 * written, which the syntax alone still has. The items are the
 * container's kind's, {@link containerValue}, which the list's one type
 * does not say.
 *
 * @type {(container: Container, done: readonly (ValueItem | ValueMember)[]) => SourceValue}
 */
const close = ([kind], done) => {
    if (kind === 'array') {
        /** @type {ValueArray} */
        const array = ['array', /** @type {readonly ValueItem[]} */ (done)]
        return array
    }
    /** @type {ValueObject} */
    const object = ['object', /** @type {readonly ValueEntry[]} */ (done)]
    return object
}

/**
 * The next round of a container: its item's key checked first, then the
 * key entered where it is computed and not yet evaluated, or the item's
 * value — or the container closed when no item is left.
 *
 * @type {(stack: _Stack, scope: _Scope, frame: _ContainerFrame) => _State}
 */
const round = (stack, scope, frame) => {
    const { container, index, done, key } = frame
    if (index >= container[1].length) { return [stack, scope, ok(close(container, toArray(done)))] }
    const rejected = badKey(container, index)
    if (rejected !== null) { return [stack, scope, error(rejected)] }
    const computed = computedKeyAt(container, index)
    return [{ top: frame, rest: stack }, scope, ['enter', computed !== null && key === null ? computed : itemAt(container, index)]]
}

/**
 * A container's frame with a value returned to it: the computed key's,
 * kept for the value's round, or the item's, which the next round follows.
 *
 * @type {(stack: _Stack, scope: _Scope, frame: _ContainerFrame, value: SourceValue) => _State}
 */
const containerReturned = (stack, scope, frame, value) => {
    const { container, index, key } = frame
    return computedKeyAt(container, index) !== null && key === null
        ? round(stack, scope, { ...frame, key: [value] })
        : round(stack, scope, { ...advanced(frame, [containerValue(container, index, key, value)]), key: null })
}

/**
 * How many operands a call has: its callee and its arguments.
 *
 * Counted and indexed rather than built into one list, which is what
 * `[callee, ...args]` per round would be — a copy of every argument for
 * each of them, and quadratic in a call's width where the parser is linear
 * in an array's.
 *
 * @type {(call: _CallFrame['call']) => number}
 */
const callOperandCount = call => call[2].length + 1

/**
 * The operand a call evaluates at `index`: the callee first, then each
 * argument as written — JavaScript's own order, and the order an error
 * among them is reported in.
 *
 * @type {(call: _CallFrame['call'], index: number) => Node}
 */
const callOperandAt = (call, index) => index === 0 ? call[1] : operandOf(call[2][index - 1])

/**
 * A call's value at `index`, an argument's spread put back: the callee is
 * never one.
 *
 * @type {(call: _CallFrame['call'], index: number, value: SourceValue) => ValueItem}
 */
const callValue = (call, index, value) => index === 0 ? value : itemValue(call[2][index - 1])(value)

/**
 * The next operand of a call, or the call closed when none is left: the
 * first value is the callee and the rest its arguments.
 *
 * @type {(stack: _Stack, scope: _Scope, frame: _CallFrame) => _State}
 */
const callRound = (stack, scope, frame) => {
    const { call, index } = frame
    if (index < callOperandCount(call)) { return [{ top: frame, rest: stack }, scope, ['enter', callOperandAt(call, index)]] }
    const [callee, ...args] = toArray(frame.done)
    /** @type {ValueCall} */
    const closed = ['()', /** @type {SourceValue} */ (callee), args]
    return [stack, scope, ok(closed)]
}

/**
 * The operand a conditional evaluates at `index`: the condition, then each
 * arm as written.
 *
 * @type {(conditional: _ConditionalFrame['conditional'], index: number) => Node}
 */
const conditionalOperandAt = ([, condition, then, otherwise], index) => [condition, then, otherwise][index]

/**
 * The next operand of a conditional, or the conditional closed when none
 * is left: the condition first, then each arm as written — resolved all
 * three, since a name is checked where it is written whether or not the
 * program ever establishes the arm, as JavaScript's early errors are.
 *
 * @type {(stack: _Stack, scope: _Scope, frame: _ConditionalFrame) => _State}
 */
const conditionalRound = (stack, scope, frame) => {
    const { conditional, index } = frame
    if (index < 3) { return [{ top: frame, rest: stack }, scope, ['enter', conditionalOperandAt(conditional, index)]] }
    const [condition, then, otherwise] = toArray(frame.done)
    /** @type {ValueConditional} */
    const closed = ['?:', condition, then, otherwise]
    return [stack, scope, ok(closed)]
}

/**
 * The next operand of a comma, or the comma closed when none is left:
 * each operand as written, resolved all, as a conditional's arms are.
 * Inside it no operand is a call's callee, the comma's frame standing on
 * top: `(0, a.b)(c)` reads `a.b` by the read rule, as the plain call over
 * a detached function JavaScript makes of it, and never as a method.
 *
 * @type {(stack: _Stack, scope: _Scope, frame: _CommaFrame) => _State}
 */
const commaRound = (stack, scope, frame) => {
    const { comma, index } = frame
    if (index < comma.length) { return [{ top: frame, rest: stack }, scope, ['enter', comma[index]]] }
    /** @type {ValueComma} */
    const closed = [',', toArray(frame.done)]
    return [stack, scope, ok(closed)]
}

/** A function's declaration is its self only where no parameter/local shadows it. @type {(scope: _Scope, word: string) => _Ref | null} */
const bound = (scope, word) => at(word)(scope.names) ?? (scope.self === word
    ? { id: assertNotNullish(scope.selfBinding), kind: 'self', assignable: scope.selfVariable } : null)

/**
 * Resolve an original declaration identity and remember each intervening read
 * for the existing capture-shadow rule. No capture frame or value version is
 * chosen here. The outward search and inward rebuilding use explicit lists,
 * keeping deeply nested source functions off the host stack. The third
 * element is whether the search crossed a function boundary — a region's is
 * none — the reference being a capture then.
 *
 * @type {(scope: _Scope, word: string) => readonly [_Scope, _Ref, boolean] | null}
 */
const resolve = (scope, word) => {
    /** The bodies the word is read through, the one just inside the binding scope on top. @type {List<_Scope>} */
    let through = null
    let binder = scope
    let ref = bound(binder, word)
    while (ref === null) {
        if (binder.outer === null) { return null }
        through = { first: binder, tail: through }
        binder = binder.outer
        ref = bound(binder, word)
    }
    /** @type {readonly [_Scope, _Ref]} */
    let result = [ref.kind === 'self' ? { ...binder, names: extended(binder.names)(word, ref) } : binder, ref]
    let crossed = false
    for (const body of toArray(through)) {
        result = captured(body, word, result)
        crossed = crossed || !body.region
    }
    return [result[0], result[1], crossed]
}

/** Retain lexical read evidence for existing capture-shadow admission, without frames. @type {(body: _Scope, word: string, outer: readonly [_Scope, _Ref]) => readonly [_Scope, _Ref]} */
const captured = (body, word, [outer, ref]) => {
    const captured = /** @type {_Ref} */ ({ id: ref.id, kind: 'capture', assignable: ref.assignable })
    return [{ ...body, outer, names: extended(body.names)(word, captured), origins: setReplace(word)(ref.id)(body.origins) }, captured]
}

/** @type {(bound: _Bound, plan: _Plan, initialize: boolean) => _Bound} */
const parameterBindings = (bound, plan, initialize) => ({
    ...bound,
    origins: initialize ? plan.names.reduce((origins, [name, index]) => setReplace(nameOf(name))(plan.ids[index])(origins), bound.origins) : bound.origins,
    bindings: [...bound.bindings, ...plan.ids],
    sourceOrigins: [...bound.sourceOrigins, ...planOrigins(plan, 'parameter')],
    initialized: initialize ? [...bound.initialized, ...plan.ids] : bound.initialized,
})


/**
 * Check every parameter declaration before resolving defaults in order. The
 * admitted fixed prefix preserves JavaScript's function length. Pattern reads
 * and defaults remain plans for sugar; each original local retains its own ID.
 *
 * @type {(list: ParameterList) => Result<_Bound, ParseError>}
 */
const functionScope = list => {
    if (hasEntry(list, 'invalid')) { return error(malformedParameters(list.invalid)) }
    if (hasEntry(list, 'arrow')) { return error(unexpectedToken(list.arrow)) }
    const defaulted = list.fixed.findIndex(parameter => parameter[0] === '=')
    const count = defaulted === -1 ? list.fixed.length : defaulted
    /** @type {_Bound} */
    let bound = { names: empty, count, parameters: [], rest: null, late: [], origins: empty, bindings: [], sourceOrigins: [], initialized: [] }
    /** @type {_Env} */
    let seen = empty
    for (const [i, parameter] of list.fixed.entries()) {
        const target = parameter[0] === '=' ? parameter[1] : parameter
        if (i === maxLength) { return error(tooManyParameters(target[1])) }
        const [tag, plan] = planned(bindable(seen))(target, null)
        if (tag === 'error') { return error(plan) }
        bound = parameterBindings(bound, plan, i < count)
        seen = plan.names.reduce(/** @type {(env: _Env, name: readonly [ModuleTokenWithMetadata, number]) => _Env} */ ((env, [name, index]) => extended(env)(nameOf(name), { id: plan.ids[index], kind: 'own', assignable: true })), seen)
        if (i >= count) {
            bound = { ...bound, late: [...bound.late, { plan, init: parameter[0] === '=' ? parameter[3] : null, rest: false }] }
        } else {
            bound = { ...bound, parameters: [...bound.parameters, { plan: expansion(plan), default: null }], names: plan.names.reduce((env, [name, index]) => extended(env)(nameOf(name), { id: plan.ids[index], kind: 'own', assignable: true }), bound.names) }
        }
    }
    if (list.rest === null) { return ok(bound) }
    const [tag, plan] = planned(bindable(seen))(['name', list.rest], null)
    if (tag === 'error') { return error(plan) }
    bound = parameterBindings(bound, plan, bound.late.length === 0)
    return ok(bound.late.length === 0
        ? { ...bound, rest: plan, names: extended(bound.names)(nameOf(list.rest), { id: plan.ids[0], kind: 'own', assignable: true }) }
        : { ...bound, rest: plan, late: [...bound.late, { plan, init: null, rest: true }] })
}

/** Source-only transfer scan: nested functions own their transfers; all lexical branches remain visible.
 * @type {(root: SourceBlock, target: LoopTarget) => boolean}
 */
const hasTargetBreak = (root, target) => {
    /** @type {readonly SourceBlock[]} */
    let pending = [root]
    while (pending.length !== 0) {
        const [block, ...rest] = pending
        pending = rest
        for (const statement of block.statements) {
            if (statement[0] === 'break' && statement[1] === target) { return true }
            if (statement[0] === 'if') { pending = [...pending, statement[2], statement[3]] }
            if (statement[0] === 'while') { pending = [...pending, statement[1].body] }
            if (statement[0] === 'switch') { pending = [...pending, ...statement[1].cases.map(arm => arm.body), statement[1].otherwise] }
        }
    }
    return false
}

/** The same lexical loop entry serves a function, enclosing loop, or module continuation. @type {(stack: _Stack, scope: _Scope, loop: While | For, body: _BodyFrame | _LoopBodyFrame | null, terminal?: boolean) => _State} */
const enterLoop = (stack, scope, loop, body, terminal = false) =>
    [{ top: { loop, target: { kind: 'loop', index: scope.trace.count + 1 }, body, condition: null, step: null, terminal }, rest: stack }, regionScope(scope, empty, null), ['enter', loop.condition]]

/** Resolve a for initializer in a lexical region that remains open for its loop. @type {(stack: _Stack, scope: _Scope, loop: For, body: _BodyFrame | _LoopBodyFrame | null, terminal?: boolean) => _State} */
const enterFor = (stack, scope, loop, body, terminal = false) => {
    const target = /** @type {const} */ ({ kind: 'loop', index: scope.trace.count + 1 })
    return loopRound({ top: { for: loop, body, initial: null, terminal }, rest: stack }, regionScope(scope, empty, null), {
        block: loop.initializer === null ? [] : [loop.initializer], target, breakTarget: target, index: 0, plan: null, assigned: null, done: null, open: true,
    })
}

/**
 * Enter the next declaration, branch condition, loop initializer or terminal
 * value in document order. Source guards retain their lexical block and the
 * remaining statements as terminal branches rather than generated invocations.
 *
 * @type {(stack: _Stack, scope: _Scope, frame: _BodyFrame) => _State}
 */
const bodyRound = (stack, scope, frame) => {
    const { statements, first, index } = frame
    const [kind, statement] = statements[index]
    // the statement's own beginning before either half of it: the one
    // before it, written without its `;`, ends at a newline or not at all
    if (unterminated(index === first ? null : statements[index - 1][1], statement)) {
        return [stack, scope, error(unexpectedToken(statement.start))]
    }
    if (kind === 'if') { return [{ top: frame, rest: stack }, scope, ['enter', statement.condition]] }
    if (kind === 'switch') { return [{ top: frame, rest: stack }, scope, ['enter', statement.discriminant]] }
    // A loop's condition and block are source regions. Their complete
    // evidence reaches sugar before mutable loop inputs are selected.
    if (kind === 'while' || kind === 'terminal-while') { return enterLoop(stack, scope, statement, frame, kind === 'terminal-while') }
    if (kind === 'for' || kind === 'terminal-for') { return enterFor(stack, scope, statement, frame, kind === 'terminal-for') }
    if (kind === 'assign') {
        const [tag, target] = assigned(scope, statement.name)
        if (tag === 'error') { return [stack, scope, error(target)] }
        return [{ top: { ...frame, plan: null, assigned: target[1] }, rest: stack }, assignmentScope(target[0], statement, target[1]), ['enter', statement.value]]
    }
    if (kind !== 'const' && kind !== 'let') {
        return brokenLine(statement)
            ? [stack, scope, error(unexpectedToken(statement.first))]
            : [{ top: frame, rest: stack }, scope, ['enter', statement.value]]
    }
    const { target, value } = statement
    const namespace = namespaceOf(target, value)
    const [tag, plan] = constPlan(bodyBindable(scope))(target, value, namespace)
    if (tag === 'error') { return [stack, scope, error(plan)] }
    return [{ top: { ...frame, plan, assigned: null }, rest: stack }, declared(scope, plan, kind), declaredValue(kind, target, value, namespace, plan)]
}

/**
 * What a declaration resolves before its names land: its value — a function
 * that is the whole value of a `const` or a `let` of one name entered under
 * that name, its `self`, since a pattern names no function; a `let`'s name
 * being a variable, the function's reference to itself is a capture,
 * {@link selfReference} — or, for a pattern over a reserved namespace,
 * nothing: the checked plan names its static members directly, so sugar
 * receives an unused `undefined` input.
 *
 * @type {(kind: _DeclarationKind, target: BindingTarget | Discard, value: Node, namespace: ModuleTokenWithMetadata | null, plan: _Plan) => _State[2]}
 */
const declaredValue = (kind, target, value, namespace, plan) => namespace !== null ? ok(undefined)
    : target[0] === 'name' ? ['define', value, [nameOf(target[1]), plan.ids[0], isVariable(kind)]] : ['enter', value]

/**
 * Enters a node: a primitive is its value, a reference what `scope`
 * resolves its name to — a capture, where a function's body names what a
 * scope around it binds, {@link resolve} — an access its base under a
 * frame holding the key, a container, a call or a conditional the first
 * round of a new frame, an operator its left operand under a frame holding
 * the right, and a function its body, in a scope of its own inside
 * `scope`. A name no scope binds is `const not found`.
 *
 * A block body is entered the same way, under a frame that also holds its
 * statements: the parameter is the only name bound when the first of them
 * is resolved — none is, where the list is empty — and each binds its own
 * as the module's `const`s do.
 *
 * @type {(stack: _Stack, scope: _Scope, node: Node) => _State}
 */
const enter = (stack, scope, node) => {
    if (isBinary(node)) { return [{ top: { tag: node[0], right: node[2] }, rest: stack }, scope, ['enter', node[1]]] }
    if (isUnary(node)) { return [{ top: { unary: node[0] }, rest: stack }, scope, ['enter', node[1]]] }
    switch (node[0]) {
        case 'primitive': { return [stack, scope, ok(node[1])] }
        case 'ref': {
            const [tag, word] = identifierOf(node[1])
            if (tag === 'error') { return [stack, scope, error(word)] }
            const found = resolve(scope, word)
            if (found === null) { return [stack, scope, error(constNotFound(node[1]))] }
            return [stack, traced(referenced(selfReference(found), node[1]), [['read', found[1].id]]), ok(['ref', found[1].id])]
        }
        case '.': {
            const member = staticOf(node)
            if (member !== null) { return staticRead(stack, scope, node, member) }
            return node.length === 3
                ? [{ top: { key: node[2], method: isCallee(stack) }, rest: stack }, scope, ['enter', node[1]]]
                : chainRound(stack, scope, { chain: node, parts: chainParts(node), index: 0, done: null })
        }
        // a guarded read of a namespace enters the word, which is refused:
        // a guard asks whether a value is nullish, and a namespace is none
        case '?.': case '?.()': { return chainRound(stack, scope, { chain: node, parts: chainParts(node), index: 0, done: null }) }
        case '()': { return conversion(stack, scope, node) ?? callRound(stack, scope, { call: node, index: 0, done: null }) }
        // the left operand first, as every binary operator's: the right
        // side is checked when the left returns, so a fault in the left is
        // the one reported, the first in document order
        case 'instanceof': { return [{ top: { instanceof: node[2], at: node[3] }, rest: stack }, scope, ['enter', node[1]]] }
        // the key first, as every operator's left operand is checked first:
        // a string literal, and no name a built-in prototype gives a value,
        // `length` included — `"length" in []` is `true` in JavaScript where
        // the own entry is absent, which a read of `length` is not — both
        // refused at the operator, the one token every spelling of the
        // left side shares; then the right operand is entered
        case 'in': {
            const [, left, right, at] = node
            if (left[0] !== 'primitive' || typeof left[1] !== 'string') { return [stack, scope, error(inLeft(at))] }
            if (prohibitedNames.has(left[1]) || left[1] === 'length') { return [stack, scope, error(prohibitedKey(at))] }
            return [{ top: { in: left[1] }, rest: stack }, scope, ['enter', right]]
        }
        case '?:': { return conditionalRound(stack, scope, { conditional: node, index: 0, done: null }) }
        // a comma the parentheses also hold what no comma has in is
        // refused at the first of it: a default, a rest or a trailing comma
        case ',': {
            const refusal = node[2]
            return refusal === null ? commaRound(stack, scope, { comma: node[1], index: 0, done: null }) : [stack, scope, error(unexpectedToken(refusal))]
        }
        case '=>': { return entered(stack, scope, node, null) }
        // a block stands only as a function's body, which `'=>'` above
        // enters; the mapping writes one nowhere else
        default: { return round(stack, scope, { container: /** @type {Container} */ (node), index: 0, done: null, key: null }) }
    }
}

/** Whether a node is the reference `word` spells. @type {(node: Item, word: string) => boolean} */
const isRef = (node, word) => node[0] === 'ref' && nameOf(node[1]) === word

/**
 * The conversion `Number(x)` or `String(x)` entered, or `null` where the call
 * is no conversion: a call whose callee is one of those words — which no scope
 * binds, since each word is refused at every binding, {@link identifierOf},
 * so the word alone decides — its one plain argument entered under a frame
 * holding the tag, {@link _UnaryFrame}. `Number()` is the literal `0`
 * and `String()` the empty-string literal, as JavaScript has them, folded
 * here as unary `-` over a literal is
 * folded, since a node of no operand would be a second spelling of the
 * leaf; the call of any other shape is refused at the word,
 * {@link conversionArity}. The word anywhere else is a reference, and
 * refused as every reserved word is.
 *
 * @type {(stack: _Stack, scope: _Scope, node: Extract<Node, readonly ['()', Node, readonly Item[]]>) => _State | null}
 */
const conversion = (stack, scope, [, callee, args]) => {
    if (callee[0] !== 'ref') { return null }
    const name = nameOf(callee[1])
    if (!isConversionWord(name)) { return null }
    if (args.length === 0) { return [stack, scope, ok(name === 'Number' ? 0 : '')] }
    const operand = args.length === 1 ? args[0] : null
    if (operand === null || operand[0] === '...') { return [stack, scope, error(conversionArity(name)(callee[1]))] }
    return [{ top: { unary: name }, rest: stack }, scope, ['enter', operand]]
}

/** Whether a word is a conversion's, `Number` or `String`, which the word alone decides, no scope binding it. @type {(name: string) => name is 'Number' | 'String'} */
const isConversionWord = name => name === 'Number' || name === 'String'

/**
 * Whether an access's key is the constant `name`, in either spelling: a
 * computed key, `[Number(i)]`, names no constant.
 *
 * @type {(key: Key, name: string) => boolean}
 */
const isKeyNamed = (key, name) => !(key instanceof Array) && keyNamed(key) === name

/**
 * The static function the key `named` names in the namespace `global`, as
 * the AST holds it, `['Number.isInteger']`, or `null` where the language
 * admits none: `is` of `Object` and the four predicates of `Number`
 * ([spec: built-in static functions](../../../spec/built-ins/static-functions/README.md)),
 * each a tag of the EDAG's `staticIds`, where a later name is a row of
 * its own decision.
 *
 * @type {(global: string, named: string | number) => ValueStatic | null}
 */
const staticMember = (global, named) => {
    const id = staticIds.find(id => id === `${global}.${named}`)
    if (id === undefined) { return null }
    /** @type {ValueStatic} */
    const member = [id]
    return member
}

/**
 * The static function an access reads, where its base is the bare word
 * of a namespace and its key a constant naming an admitted member, in
 * either spelling, {@link staticMember}; `null` for every other access,
 * which is resolved as any is — so `Object.keys` and `Number.MAX_VALUE`
 * enter the word and are refused at it. The word is a reserved global,
 * which no scope binds, so it alone decides.
 *
 * @type {(node: Extract<Node, readonly ['.', Node, Key, ...unknown[]]>) => ValueStatic | null}
 */
const staticOf = ([, base, key]) => base[0] !== 'ref' || key instanceof Array ? null : staticMember(nameOf(base[1]), keyNamed(key))

/**
 * A read of a static function entered, `member`: `Object.is` or
 * `Object['is']` — the AST's `['Object.is']`. Unguarded only: a guard asks
 * whether a value is nullish, and a namespace is no value, so `Object?.is`
 * is refused at the word, {@link enter}. A guarded call of the read,
 * `Object.is?.(a, b)`, is the chain over the plain read it is, the read
 * entered again as its head.
 *
 * @type {(stack: _Stack, scope: _Scope, node: Extract<Node, readonly ['.', Node, Key, ...unknown[]]>, member: ValueStatic) => _State}
 */
const staticRead = (stack, scope, node, member) => {
    const step = node[3]
    if (step === undefined) { return [stack, scope, ok(member)] }
    const [, items, next] = step
    /** @type {Node} */
    const read = ['.', node[1], node[2]]
    return [stack, scope, ['enter', next === undefined ? ['?.()', read, items] : ['?.()', read, items, next]]]
}

/**
 * Whether a word is a namespace an admitted static function is a member
 * of: `Object`, `Number`.
 *
 * @type {(word: string) => boolean}
 */
const isNamespace = word => staticIds.some(id => staticPath(id)[0] === word)

/**
 * The namespace's word where a `const`'s pattern destructures one — an
 * object pattern whose value is the bare word, `Object` or `Number` — and
 * `null` otherwise. Destructuring is sugar: the pattern reads each of its
 * keys as the access does, {@link planned}, so `const { is } = Object` is
 * `const is = Object.is`, and the namespace, which is no value, is never
 * entered. Any other pattern over the word, and the word alone, is
 * entered and refused as every reserved global is.
 *
 * @type {(target: BindingTarget | Discard, value: Node) => ModuleTokenWithMetadata | null}
 */
const namespaceOf = (target, value) => target[0] === 'object' && value[0] === 'ref' && isNamespace(nameOf(value[1])) ? value[1] : null

/**
 * Whether a node is `Object.getOwnPropertyDescriptor(a, b)`, the helper's
 * descriptor, `a` and `b` the words its parameters bind: a plain call of
 * a plain access, the key in either spelling, as any key is read,
 * {@link isKeyNamed}.
 *
 * @type {(node: Node, a: string, b: string) => boolean}
 */
const isDescriptorOf = (node, a, b) => {
    if (node[0] !== '()' || node[2].length !== 2) { return false }
    const [, callee, [first, second]] = node
    return callee[0] === '.' && callee.length === 3 && isRef(callee[1], 'Object') && isKeyNamed(callee[2], 'getOwnPropertyDescriptor')
        && isRef(first, a) && isRef(second, b)
}

/**
 * Whether a node is `x?.enumerable ? x.value : undefined`, the helper's
 * value, `x` the word its `const` binds: a guarded access ending its
 * chain there, the one plain access, and the literal `undefined`.
 *
 * @type {(node: Node, x: string) => boolean}
 */
const isEntryOf = (node, x) => {
    if (node[0] !== '?:') { return false }
    const [, condition, value, otherwise] = node
    return condition[0] === '?.' && condition.length === 3 && isRef(condition[1], x) && isKeyNamed(condition[2], 'enumerable')
        && value[0] === '.' && value.length === 3 && isRef(value[1], x) && isKeyNamed(value[2], 'value')
        && otherwise[0] === 'primitive' && otherwise[1] === undefined
}

/**
 * Whether a node is `x?.enumerable === true`, the `hasEntry` helper's
 * presence, `x` the word its `const` binds: the same guarded access the
 * option tests, compared to `true`.
 *
 * @type {(node: Node, x: string) => boolean}
 */
const isHasEntryOf = (node, x) => {
    if (node[0] !== '===') { return false }
    const [, condition, literal] = node
    return condition[0] === '?.' && condition.length === 3 && isRef(condition[1], x) && isKeyNamed(condition[2], 'enumerable')
        && literal[0] === 'primitive' && literal[1] === true
}

/**
 * An intrinsic's helper, recognized whole as the `entry` helper is: a
 * function of as many parameters as the intrinsic's `length`, each a bare
 * name, whose expression body is the member call of the intrinsic's name
 * on the first with the rest, in order —
 *
 * ```js
 * (s, a, b) => s.slice(a, b)
 * ```
 *
 * under any distinct names — the AST's `['slice']`, the member's name
 * ([`fjs/js/intrinsic`](../../js/intrinsic/module.f.js); the list is
 * `intrinsics` in `fjs/edag`). `null` where the function is not a helper,
 * by shape or by its names — a keyword or a reserved global among them, a
 * name repeated, a pattern, a rest parameter, a spread, a block body, the
 * key in the computed spelling — and the ordinary resolution takes it
 * from there, as it takes every member call.
 *
 * @type {(node: Extract<Node, readonly ['=>', ParameterList, Node]>) => ValueIntrinsic | null}
 */
const intrinsicFunction = ([, list, body]) => {
    if (!hasEntry(list, 'fixed') || list.rest !== null || body[0] !== '()') { return null }
    const [, callee, items] = body
    if (callee[0] !== '.' || callee.length !== 3 || callee[2] instanceof Array) { return null }
    const key = keyNamed(callee[2])
    const intrinsic = intrinsics.find(([id]) => id === key)
    if (intrinsic === undefined || list.fixed.length !== intrinsicLength(intrinsic[0]) || items.length !== list.fixed.length - 1) { return null }
    const tokens = list.fixed.flatMap(p => p[0] === 'name' ? [p[1]] : [])
    if (tokens.length !== list.fixed.length) { return null }
    const names = tokens.map(nameOf)
    if (new Set(names).size !== names.length || names.some(word => isKeyword(word) || isReservedGlobal(word))) { return null }
    const [receiver, ...rest] = names
    if (!isRef(callee[1], receiver) || !items.every((item, k) => isRef(item, rest[k]))) { return null }
    /** @type {ValueIntrinsic} */
    const helper = [intrinsic[0]]
    return helper
}

/**
 * The `entry` helper, recognized whole
 * ([spec: entry](../../../spec/property-access/entries/README.md)), and the
 * `hasEntry` helper beside it, the same but for its `return`
 * ([spec: why two helpers](../../../spec/property-access/entries/README.md#why-two-helpers)):
 *
 * ```js
 * (a, b) => {
 *     const x = Object.getOwnPropertyDescriptor(a, b);
 *     return x?.enumerable ? x.value : undefined;
 * }
 * (a, b) => {
 *     const x = Object.getOwnPropertyDescriptor(a, b);
 *     return x?.enumerable === true;
 * }
 * ```
 *
 * under any three distinct names — the AST's `['entry']` and
 * `['hasEntry']`, the two functions whose body reads a property named at
 * run time, and the one place the
 * `Object` namespace stands but `Object.is`. It is matched on the syntax
 * tree with its names resolved by the rules every other body follows: the
 * two parameters and the body's `const` are what the body reads back, and
 * `Object` is a reserved global, which no scope binds. `null` where the
 * function is not the helper, by shape or by binding, and the ordinary
 * resolution takes it from there, refusing the `Object` it cannot name; a
 * keyword, a reserved global such as `Array` or `Object`, or a repeated
 * name among the three is left to it the same way, to refuse as it
 * refuses every other. An error where the helper's two statements
 * break the line rules every block's statements keep, {@link unterminated}
 * and {@link brokenLine}, which the shape alone cannot see.
 *
 * @type {(node: Extract<Node, readonly ['=>', ParameterList, Node]>) => Result<ValueEntryFunction | ValueHasEntryFunction, ParseError> | null}
 */
const entryFunction = ([, list, body]) => {
    if (!hasEntry(list, 'fixed') || list.fixed.length !== 2 || list.rest !== null || body[0] !== 'block' || body[1].length !== 2) { return null }
    const [p, q] = list.fixed
    const first = body[1][0]
    const last = body[1][1]
    if (first[0] !== 'const' || last[0] !== 'return') { return null }
    const [, declaration] = first
    const [, returned] = last
    // the two parameters and the descriptor are each bound to one name: a
    // pattern is a step away from the helper, so the function is an
    // ordinary one
    if (p[0] !== 'name' || q[0] !== 'name' || declaration.target[0] !== 'name') { return null }
    const a = nameOf(p[1])
    const b = nameOf(q[1])
    const x = nameOf(declaration.target[1])
    const names = [a, b, x]
    if (new Set(names).size !== names.length || names.some(word => isKeyword(word) || isReservedGlobal(word))) { return null }
    if (!isDescriptorOf(declaration.value, a, b)) { return null }
    const has = isHasEntryOf(returned.value, x)
    if (!has && !isEntryOf(returned.value, x)) { return null }
    if (unterminated(declaration, returned)) { return error(unexpectedToken(returned.start)) }
    if (brokenLine(returned)) { return error(unexpectedToken(returned.first)) }
    /** @type {ValueEntryFunction | ValueHasEntryFunction} */
    const helper = has ? ['hasEntry'] : ['entry']
    return ok(helper)
}

/** Resolved reads inside the exact, capture-free helper forms matched above. @type {(node: Node, origins: _Scope['origins']) => readonly BindingEvent[]} */
const templateReads = (node, origins) => {
    switch (node[0]) {
        case 'primitive': { return [] }
        case 'ref': {
            const id = at(nameOf(node[1]))(origins)
            return id === null ? [] : [['read', id]]
        }
        case '.': case '?.': { return templateReads(node[1], origins) }
        case '()': { return [...templateReads(node[1], origins), .../** @type {readonly Node[]} */ (node[2]).flatMap(value => templateReads(value, origins))] }
        case '?:': { return [node[1], node[2], node[3]].flatMap(value => templateReads(value, origins)) }
        default: {
            const comparison = /** @type {readonly ['===', Node, Node]} */ (node)
            return [...templateReads(comparison[1], origins), ...templateReads(comparison[2], origins)]
        }
    }
}

/**
 * Whole-helper recognition proves its body has no writes or outside names.
 * Retain its actual parameter/local identities and reads before replacing it
 * with the intrinsic operation, just as ordinary functions retain theirs.
 *
 * @type {(scope: _Scope, node: Extract<Node, readonly ['=>', ParameterList, Node]>) => _Scope}
 */
const templateScope = (scope, node) => {
    const bound = assertOk(functionScope(node[1]))
    let origins = bound.origins
    let bindings = bound.bindings
    let sourceOrigins = bound.sourceOrigins
    /** @type {readonly BindingEvent[]} */
    let events = bound.initialized.map(id => ['initialize', id])
    if (node[2][0] === 'block') {
        const [first, last] = node[2][1]
        const declaration = /** @type {Const} */ (first[1])
        const plan = assertOk(planned(bindable(bound.names))(declaration.target, null))
        bindings = [...bindings, ...plan.ids]
        sourceOrigins = [...sourceOrigins, ...planOrigins(plan, 'const')]
        events = [...events, ...templateReads(declaration.value, origins), ...plan.ids.map(id => /** @type {BindingEvent} */ (['initialize', id]))]
        origins = plan.names.reduce((origins, [name, i]) => setReplace(nameOf(name))(plan.ids[i])(origins), origins)
        events = [...events, ...templateReads(/** @type {ValueStatement} */ (last[1]).value, origins)]
    } else {
        events = [...events, ...templateReads(node[2], origins)]
    }
    return traced({ ...scope, sourceOrigins: [...scope.sourceOrigins, ...sourceOrigins] }, [['function', { target: { kind: 'function', index: scope.trace.count + 1 }, bindings, events }]])
}

/**
 * Enter an ordinary source function, or recognize an admitted whole-function
 * intrinsic. A named whole initializer retains the original declaration as
 * its self binding, unless a parameter or local shadows it.
 *
 * @type {(stack: _Stack, scope: _Scope, node: Extract<Node, readonly ['=>', ParameterList, Node]>, self: _Self | null) => _State}
 */
const entered = (stack, scope, node, self) => {
    // the helpers first, whole: a function that is one has no body to
    // resolve
    const entry = entryFunction(node)
    if (entry !== null) { return [stack, entry[0] === 'ok' ? templateScope(scope, node) : scope, entry] }
    const intrinsic = intrinsicFunction(node)
    if (intrinsic !== null) { return [stack, templateScope(scope, node), ok(intrinsic)] }
    const [tag, bound] = functionScope(node[1])
    if (tag === 'error') { return [stack, scope, error(bound)] }
    const { names, count, parameters, rest, late } = bound
    const target = /** @type {const} */ ({ kind: 'function', index: scope.trace.count + 1 })
    /** @type {_Scope} */
    const inner = {
        names, count, parameters, rest, enclosing: null, outer: scope, self: self?.[0] ?? null, selfBinding: self?.[1] ?? null, selfVariable: self?.[2] ?? false, captures: [], region: false, inFunction: true,
        blockCall: stack !== null && hasEntry(stack.top, 'call') && stack.top.index === 0 && stack.top.call[2].length === 0
            && count === 0 && late.length === 0 && rest === null,
        origins: self === null || at(self[0])(bound.origins) !== null ? bound.origins : setReplace(self[0])(self[1])(bound.origins),
        trace: { target, bindings: bound.bindings, events: bound.initialized.map(id => ['initialize', id]), count: bound.initialized.length }, sourceOrigins: bound.sourceOrigins,
    }
    return lateRound(stack, inner, { late, index: 0, body: node[2] })
}

/** Resolve defaults before making the next parameter readable. @type {(stack: _Stack, scope: _Scope, frame: _LateFrame) => _State} */
const lateRound = (stack, scope, frame) => {
    const { late, index, body } = frame
    if (index === late.length) {
        return body[0] === 'block'
            ? bodyRound(stack, scope, { statements: body[1], first: 0, index: 0, plan: null, assigned: null, done: null })
            : [{ top: { function: true }, rest: stack }, scope, ['enter', body]]
    }
    const { init } = late[index]
    return init === null ? lateLanded(stack, scope, frame, null) : [{ top: frame, rest: stack }, scope, ['enter', init]]
}

/** @type {(stack: _Stack, scope: _Scope, frame: _LateFrame, value: { readonly value: SourceValue } | null) => _State} */
const lateLanded = (stack, scope, frame, value) => {
    const { plan, rest } = frame.late[frame.index]
    const shadowed = plan.names.find(([name]) => at(nameOf(name))(scope.names) !== null)
    if (shadowed !== undefined) { return [stack, scope, error(captureShadowed(shadowed[0]))] }
    const initialized = boundPlan(scope, plan, true)
    return lateRound(stack, rest ? initialized : { ...initialized, parameters: [...initialized.parameters, { plan: expansion(plan), default: value }] }, { ...frame, index: frame.index + 1 })
}

/**
 * A value handed to the frame on top: the next round of a container with
 * the value among its items, an access closed over its base, or a function
 * closed over its body, {@link closed}.
 *
 * @type {(stack: _Stack, scope: _Scope, frame: _Frame, value: SourceValue) => _State}
 */
const returned = (stack, scope, frame, value) => {
    if (hasEntry(frame, 'container')) { return containerReturned(stack, scope, frame, value) }
    if (hasEntry(frame, 'call')) { return callRound(stack, scope, advanced(frame, [callValue(frame.call, frame.index, value)])) }
    if (hasEntry(frame, 'conditional')) { return conditionalRound(stack, scope, advanced(frame, [value])) }
    if (hasEntry(frame, 'comma')) { return commaRound(stack, scope, advanced(frame, [value])) }
    if (hasEntry(frame, 'key')) {
        const { key, method } = frame
        return key instanceof Array ? keyEntered(stack, scope, key, { indexed: value }) : [stack, scope, accessClosed(key, method, value)]
    }
    if (hasEntry(frame, 'indexed')) {
        /** @type {ValueAccess} */
        const access = ['.', frame.indexed, /** @type {ValueKey} */ (value)]
        return [stack, scope, ok(access)]
    }
    if (hasEntry(frame, 'chain')) { return chainRound(stack, scope, advanced(frame, [value])) }
    if (hasEntry(frame, 'unary')) {
        /** @type {ValueUnary} */
        const applied = [frame.unary, value]
        return [stack, scope, ok(applied)]
    }
    if (hasEntry(frame, 'instanceof')) {
        // the right operand is a name, not a value: the one reference the
        // language has a meaning for, never resolved in scope — `Array` is
        // a reserved global, so no scope binds it
        const right = frame.instanceof
        if (right[0] !== 'ref' || nameOf(right[1]) !== 'Array') { return [stack, scope, error(instanceofRight(frame.at))] }
        /** @type {ValueInstanceOf} */
        const checked = ['instanceof', value, 'Array']
        return [stack, scope, ok(checked)]
    }
    if (hasEntry(frame, 'in')) {
        /** @type {ValueIn} */
        const checked = ['in', frame.in, value]
        return [stack, scope, ok(checked)]
    }
    if (hasEntry(frame, 'right')) { return [{ top: { tag: frame.tag, left: value }, rest: stack }, scope, ['enter', frame.right]] }
    if (hasEntry(frame, 'left')) {
        /** @type {ValueBinary} */
        const binary = [frame.tag, frame.left, value]
        return [stack, scope, ok(binary)]
    }
    if (hasEntry(frame, 'for')) {
        const block = regionBlock(value)
        if (frame.initial === null) {
            return enterLoop({ top: { ...frame, initial: block.statements }, rest: stack }, scope, frame.for, null)
        }
        const outer = restoredScope(scope, false)
        const statement = block.statements[0]
        assert(statement[0] === 'while', 'a for resolves to one loop')
        if (frame.terminal) {
            const syntax = frame.for.condition
            if (syntax[0] !== 'primitive' || syntax[1] !== true || hasTargetBreak(statement[1].body, statement[1].target)) {
                return [stack, outer, error(foldError('terminal for must be literal true with no break targeting it')(frame.for.start))]
            }
            assert(frame.body !== null && !('block' in frame.body), 'a terminal loop belongs to a function block')
            return closed(stack, outer, { statements: [...toArray(frame.body.done), ...frame.initial], exit: ['terminal-loop', statement[1]] })
        }
        const statements = [...frame.initial, ...block.statements]
        if (frame.body === null) { return [stack, outer, ok(['block', { statements, exit: ['yield', undefined] }])] }
        if ('block' in frame.body) { return loopRound(stack, outer, advanced(frame.body, statements)) }
        return bodyRound(stack, outer, { ...frame.body, index: frame.body.index + 1, done: concat(frame.body.done)(statements) })
    }
    if (hasEntry(frame, 'loop')) {
        if (frame.condition === null) {
            if ('initializer' in frame.loop && frame.loop.step !== null) {
                return loopRound({ top: { ...frame, condition: [value] }, rest: stack }, regionScope(scope, empty, null),
                    { block: [frame.loop.step], target: frame.target, breakTarget: frame.target, index: 0, plan: null, assigned: null, done: null })
            }
            return loopRound({ top: { ...frame, condition: [value] }, rest: stack },
                regionScope(scope, empty, null),
                { block: frame.loop.block[1], target: frame.target, breakTarget: frame.target, index: 0, plan: null, assigned: null, done: null })
        }
        if ('initializer' in frame.loop && frame.loop.step !== null && frame.step === null) {
            return loopRound({ top: { ...frame, step: regionBlock(value) }, rest: stack }, regionScope(scope, empty, null),
                { block: frame.loop.block[1], target: frame.target, breakTarget: frame.target, index: 0, plan: null, assigned: null, done: null })
        }
        const body = regionBlock(value)
        const outer = restoredScope(scope, false)
        const loop = /** @type {const} */ ({ target: frame.target, events: completedTrace(scope).events, condition: frame.condition[0], body,
            ...(frame.step === null ? {} : { step: frame.step }) })
        if (frame.terminal) {
            const syntax = frame.loop.condition
            if (syntax[0] !== 'primitive' || syntax[1] !== true || hasTargetBreak(loop.body, loop.target)) {
                return [stack, outer, error(foldError('terminal while must be literal true with no break targeting it')(frame.loop.start))]
            }
            assert(frame.body !== null && !('block' in frame.body), 'a terminal loop belongs to a function block')
            return closed(stack, outer, { statements: toArray(frame.body.done), exit: ['terminal-loop', loop] })
        }
        if (frame.body === null) { return [stack, outer, ok(['block', { statements: [['while', loop]], exit: ['yield', undefined] }])] }
        if ('block' in frame.body) { return loopRound(stack, outer, advanced(frame.body, [['while', loop]])) }
        return bodyRound(stack, outer, { ...frame.body, index: frame.body.index + 1, done: concat(frame.body.done)([['while', loop]]) })
    }
    if (hasEntry(frame, 'block')) {
        const [kind, statement] = frame.block[frame.index]
        if (kind === 'if') {
            return loopRound({ top: { loopGuard: frame, condition: value, otherwise: statement.otherwise, then: null }, rest: stack }, regionScope(scope, empty, null),
                { block: statement.block[1], target: frame.target, breakTarget: frame.breakTarget, index: 0, plan: null, assigned: null, done: null })
        }
        if (kind === 'assign') {
            const id = assertNotNullish(frame.assigned, 'an assignment with no target')
            return loopRound(stack, written(scope, statement, id), advanced(frame, [assignmentStatement(statement, id, value)]))
        }
        if (kind === 'return') { return loopRound(stack, scope, advanced(frame, [['return', scope.trace.target, value]])) }
        if (kind === 'throw') { return loopRound(stack, scope, advanced(frame, [['throw', value]])) }
        assert(kind !== 'while' && kind !== 'for' && kind !== 'switch' && kind !== 'break' && kind !== 'continue', 'a loop or transfer completes without a value')
        return landed(loopRound, stack, scope, frame, kind, value)
    }
    if (hasEntry(frame, 'loopGuard')) {
        const block = regionBlock(value)
        if (frame.then === null && frame.otherwise !== null) {
            return loopRound({ top: { ...frame, then: block }, rest: stack }, regionScope(scope, empty, null),
                { block: frame.otherwise[1], target: frame.loopGuard.target, breakTarget: frame.loopGuard.breakTarget, index: 0, plan: null, assigned: null, done: null })
        }
        return loopRound(stack, scope, advanced(frame.loopGuard, [['if', frame.condition,
            frame.then ?? block, frame.then === null ? { statements: [], exit: ['yield', undefined] } : block,
        ]]))
    }
    if (hasEntry(frame, 'statements')) {
        const [kind, statement] = frame.statements[frame.index]
        if (kind === 'const' || kind === 'let') { return landed(bodyRound, stack, scope, frame, kind, value) }
        if (kind === 'assign') {
            const id = assertNotNullish(frame.assigned, 'an assignment with no target')
            return bodyRound(stack, written(scope, statement, id), advanced(frame, [assignmentStatement(statement, id, value)]))
        }
        if (kind === 'if') { return arm(stack, scope, { guard: statement, body: frame, condition: value, then: null }, statement.block[1], 0, null) }
        if (kind === 'switch') {
            return switchRound(stack, scope, { switch: statement, body: frame, discriminant: value, index: 0, label: 0, labels: [], arms: null })
        }
        return closed(stack, scope, { statements: toArray(frame.done), exit: kind === 'throw' ? ['throw', value] : ['return', scope.trace.target, value] })
    }
    if (hasEntry(frame, 'switch')) { return switchReturned(stack, scope, frame, value) }
    if (hasEntry(frame, 'loopSwitch')) {
        return frame.discriminant === null
            ? loopSwitchRound(stack, scope, { ...frame, discriminant: [value] })
            : loopSwitchReturned(stack, scope, frame, value)
    }
    if (hasEntry(frame, 'guard')) {
        const block = regionBlock(value)
        if (frame.then === null) { return arm(stack, scope, { ...frame, then: block }, frame.body.statements, frame.body.index + 1, { first: scope.names, tail: scope.enclosing }) }
        return closed(stack, scope, { statements: toArray(frame.body.done), exit: ['if', frame.condition, frame.then, block] })
    }
    if (hasEntry(frame, 'late')) { return lateLanded(stack, scope, frame, { value }) }
    return closed(stack, scope, { statements: [], exit: ['return', scope.trace.target, value] })
}

/**
 * Resolve a lexical branch. A source block may shadow outer names; a branch
 * continuing the current block retains its duplicate and capture-shadow checks.
 * Regions preserve the owning source function target and add no invocation.
 *
 * @type {(stack: _Stack, scope: _Scope, frame: _GuardFrame | _SwitchFrame, statements: Block[1], first: number, enclosing: List<_Env>) => _State}
 */
const arm = (stack, scope, frame, statements, first, enclosing) =>
    bodyRound({ top: frame, rest: stack }, regionScope(scope, empty, enclosing), { statements, first, index: first, plan: null, assigned: null, done: null })

/**
 * Resolve case labels and lexical bodies in source order, then the explicit
 * default or the remaining statements. Sugar owns discriminant sharing and
 * the lazy comparison chain.
 *
 * @type {(stack: _Stack, scope: _Scope, frame: _SwitchFrame) => _State}
 */
const switchRound = (stack, scope, frame) => {
    const { cases, default: fallback } = frame.switch
    const { body, index, label } = frame
    if (index < cases.length) {
        const { labels, block } = cases[index]
        return label < labels.length
            ? [{ top: frame, rest: stack }, scope, ['enter', labels[label]]]
            : arm(stack, scope, frame, block[1], 0, null)
    }
    return fallback !== null
        ? arm(stack, scope, frame, fallback[1], 0, null)
        : arm(stack, scope, frame, body.statements, body.index + 1, { first: scope.names, tail: scope.enclosing })
}

/** Preserve source cases; sugar selects the discriminant and tests each label. @type {(stack: _Stack, scope: _Scope, frame: _SwitchFrame, value: SourceValue) => _State} */
const switchReturned = (stack, scope, frame, value) => {
    const { cases } = frame.switch
    const { index, label } = frame
    if (index < cases.length && label < cases[index].labels.length) {
        return switchRound(stack, scope, { ...frame, label: label + 1, labels: [...frame.labels, value] })
    }
    const body = regionBlock(value)
    if (index < cases.length) {
        return switchRound(stack, scope, { ...frame, index: index + 1, label: 0, labels: [], arms: { first: { labels: frame.labels, body }, tail: frame.arms } })
    }
    return closed(stack, scope, { statements: toArray(frame.body.done), exit: ['switch', frame.discriminant, toArray(reverse(frame.arms)), body] })
}

/**
 * An arm may not complete normally. Follow possible source paths on an explicit
 * stack; a nested switch's break resumes after that switch. Shared continuations
 * are visited once, so successive conditional arms do not multiply the work.
 * Loop statements retain the existing requirement for an explicit arm exit.
 *
 * @type {(body: SourceBlock) => boolean}
 */
const caseFallsThrough = body => {
    /** @type {readonly _CasePath[]} */
    let pending = [{ statements: body.statements, index: 0, next: null, breaks: [] }]
    /** @type {ReadonlySet<_CasePath>} */
    let seen = new Set()
    while (pending.length !== 0) {
        const [path, ...rest] = pending
        pending = rest
        if (seen.has(path)) { continue }
        seen = new Set([...seen, path])
        if (path.index === path.statements.length) {
            if (path.next === null) { return true }
            pending = [path.next, ...pending]
            continue
        }
        const statement = path.statements[path.index]
        const next = /** @type {_CasePath} */ ({ ...path, index: path.index + 1 })
        if (statement[0] === 'break') {
            const owner = path.breaks.find(([target]) => target === statement[1])
            if (owner !== undefined) { pending = [owner[1], ...pending] }
            continue
        }
        if (statement[0] === 'continue' || statement[0] === 'return' || statement[0] === 'throw') { continue }
        if (statement[0] === 'if') {
            pending = [...[statement[2], statement[3]].map(arm => ({ statements: arm.statements, index: 0, next, breaks: path.breaks })), ...pending]
            continue
        }
        if (statement[0] === 'switch') {
            const region = statement[1]
            const breaks = /** @type {_CasePath['breaks']} */ ([[region.target, next], ...path.breaks])
            pending = [...[...region.cases.map(arm => arm.body), region.otherwise].map(arm => ({ statements: arm.statements, index: 0, next, breaks })), ...pending]
            continue
        }
        pending = [next, ...pending]
    }
    return false
}

/** Resolve one loop-switch label or case without changing its enclosing continue owner. @type {(stack: _Stack, scope: _Scope, frame: _LoopSwitchFrame) => _State} */
const loopSwitchRound = (stack, scope, frame) => {
    const { cases, default: fallback } = frame.loopSwitch
    const { index, label } = frame
    const block = index < cases.length ? cases[index].block : fallback
    if (index < cases.length && label < cases[index].labels.length) { return [{ top: frame, rest: stack }, scope, ['enter', cases[index].labels[label]]] }
    return block === null
        ? loopSwitchDone(stack, scope, frame, { statements: [], exit: ['yield', undefined] })
        : loopRound({ top: frame, rest: stack }, regionScope(scope, empty, null), {
            block: block[1], target: frame.body.target, breakTarget: frame.target, index: 0, plan: null, assigned: null, done: null,
        })
}

/** Cases keep fresh lexical names and complete legality checks before fallthrough admission. @type {(stack: _Stack, scope: _Scope, frame: _LoopSwitchFrame, value: SourceValue) => _State} */
const loopSwitchReturned = (stack, scope, frame, value) => {
    const { cases } = frame.loopSwitch
    const { index, label } = frame
    if (index < cases.length && label < cases[index].labels.length) {
        return loopSwitchRound(stack, scope, { ...frame, label: label + 1, labels: [...frame.labels, value] })
    }
    const body = regionBlock(value)
    if (caseFallsThrough(body)) { return [stack, scope, error(unterminatedCase(frame.loopSwitch.start))] }
    return index < cases.length
        ? loopSwitchRound(stack, scope, { ...frame, index: index + 1, label: 0, labels: [], arms: { first: { labels: frame.labels, body }, tail: frame.arms } })
        : loopSwitchDone(stack, scope, frame, body)
}

/** A completed switch supplies its normal branch to following source statements. @type {(stack: _Stack, scope: _Scope, frame: _LoopSwitchFrame, otherwise: SourceBlock) => _State} */
const loopSwitchDone = (stack, scope, frame, otherwise) => {
    const region = /** @type {SourceSwitch} */ ({
        target: frame.target, events: completedTrace(scope).events,
        discriminant: assertNotNullish(frame.discriminant, 'a switch without its discriminant')[0], cases: toArray(reverse(frame.arms)), otherwise,
    })
    return loopRound(stack, restoredScope(scope, false), advanced(frame.body, [['switch', region]]))
}

/**
 * Retain declarations and assignments in a loop's block, a region of the
 * body: `const`s and `let`s as the body's, and assignments, each resolved
 * as an assignment anywhere is, {@link assigned}. Zero or several outer writes
 * are admitted. Complete resolved read/write events, rather than a selected
 * state variable, reach sugar, which chooses immutable versions and explicit
 * iteration transfers after whole-scope analysis.
 *
 * @type {(stack: _Stack, scope: _Scope, frame: _LoopBodyFrame) => _State}
 */
const loopRound = (stack, scope, frame) => {
    while (true) {
        const { block, index } = frame
        if (index === block.length) {
            if (frame.open) { return [stack, scope, ok(['block', { statements: toArray(frame.done), exit: ['yield', undefined] }])] }
            return closed(stack, scope, { statements: toArray(frame.done), exit: ['yield', undefined] })
        }
        const [kind, statement] = block[index]
        if (unterminated(index === 0 ? null : block[index - 1][1], statement)) {
            return [stack, scope, error(unexpectedToken(statement.start))]
        }
        if (kind === 'break' || kind === 'continue') {
            frame = advanced(frame, [[kind, kind === 'break' ? frame.breakTarget : frame.target]])
            continue
        }
        if (kind === 'return' || kind === 'throw') {
            if (kind === 'return' && !scope.inFunction) { return [stack, scope, error(unexpectedToken(statement.start))] }
            if (brokenLine(statement)) { return [stack, scope, error(unexpectedToken(statement.first))] }
            return [{ top: frame, rest: stack }, scope, ['enter', statement.value]]
        }
        if (kind === 'if') { return [{ top: frame, rest: stack }, scope, ['enter', statement.condition]] }
        if (kind === 'while') { return enterLoop(stack, scope, statement, frame) }
        if (kind === 'for') { return enterFor(stack, scope, statement, frame) }
        if (kind === 'switch') {
            return [{ top: { loopSwitch: statement, body: frame, target: { kind: 'loop', index: scope.trace.count + 1 }, discriminant: null, index: 0, label: 0, labels: [], arms: null }, rest: stack },
                regionScope(scope, empty, null), ['enter', statement.discriminant]]
        }
        if (kind === 'assign') {
            const [tag, target] = assigned(scope, statement.name)
            if (tag === 'error') { return [stack, scope, error(target)] }
            return [{ top: { ...frame, plan: null, assigned: target[1] }, rest: stack }, assignmentScope(target[0], statement, target[1]), ['enter', statement.value]]
        }
        const { target, value } = statement
        const namespace = namespaceOf(target, value)
        const [tag, plan] = constPlan(bodyBindable(scope))(target, value, namespace)
        if (tag === 'error') { return [stack, scope, error(plan)] }
        return [{ top: { ...frame, plan, assigned: null }, rest: stack }, declared(scope, plan, kind), declaredValue(kind, target, value, namespace, plan)]
    }
}

/** A resolved lexical region payload, including normal and terminal branches. @type {(value: SourceValue) => SourceBlock} */
const regionBlock = value => {
    assert(value instanceof Array && value[0] === 'block')
    return value[1]
}

/**
 * Merge complete source evidence at a lexical boundary. The captures the
 * scope holds, still pending, of bindings it declares itself are decided:
 * harmless, since the function that made them was called inside the
 * binding's scope. The rest pass to the outer scope after the outer's own,
 * in document order — pending still, unless the scope is a function `held`
 * as a value, which makes them escaped: those a reassignment refuses,
 * {@link resolvedModule}.
 *
 * @type {(scope: _Scope, held: boolean) => _Scope}
 */
const restoredScope = (scope, held) => {
    const outer = assertNotNullish(scope.outer, 'a source region without its enclosing scope')
    const trace = completedTrace(scope)
    /** @type {BindingEvent} */
    const event = scope.region ? ['region', trace.events] : ['function', trace]
    const kept = scope.captures.filter(capture => capture.escaped || !trace.bindings.includes(capture.id))
    return {
        ...traced({ ...outer, trace: scope.region ? { ...outer.trace, bindings: [...outer.trace.bindings, ...trace.bindings] } : outer.trace }, [event]),
        sourceOrigins: [...outer.sourceOrigins, ...scope.sourceOrigins],
        captures: [...outer.captures, ...(held ? kept.map(capture => ({ ...capture, escaped: true })) : kept)],
    }
}

/**
 * Whether the node being closed is called where it is written: the frame on
 * top is a call's, plain or optional, `(f)()` or `(f)?.()`, with no operand
 * done yet, so the node is its callee.
 *
 * @type {(stack: _Stack) => boolean}
 */
const isCalledWhereWritten = stack => {
    if (stack === null) { return false }
    const { top } = stack
    return (hasEntry(top, 'call') && top.index === 0) || (hasEntry(top, 'chain') && top.index === 0 && top.chain[0] === '?.()')
}

/**
 * Source functions retain their declarations and lexical body; regions create
 * no invocation. A function is held as a value unless it closes as a call's
 * callee, called where it is written, {@link isCalledWhereWritten}.
 *
 * @type {(stack: _Stack, scope: _Scope, body: SourceBlock) => _State}
 */
const closed = (stack, scope, body) => {
    // A block-call candidate with a nonterminal owning return must still
    // keep its invocation. Other invocation boundaries were refused at the
    // assignment, before its right-hand side was entered.
    const externalWrite = scope.captures.find(capture => capture.written && !scope.trace.bindings.includes(capture.id))
    if (!scope.region && externalWrite !== undefined && internalReturn(body)) { return [stack, scope, error(externalWrite.refusal)] }
    /** @type {SourceValue} */
    const value = scope.region ? ['block', body] : ['function', {
        target: scope.trace.target, length: scope.count, parameters: scope.parameters, rest: scope.rest === null ? null : expansion(scope.rest), self: scope.selfBinding, body,
    }]
    return [stack, restoredScope(scope, !scope.region && !isCalledWhereWritten(stack)), ok(value)]
}

/** Source statement returns retain an invocation; terminal exits become yields. @type {(body: SourceBlock) => boolean} */
const internalReturn = body => {
    let pending = [body]
    while (pending.length !== 0) {
        const [block, ...rest] = pending
        pending = rest
        for (const statement of block.statements) {
            if (statement[0] === 'return') { return true }
            if (statement[0] === 'if') { pending = [...pending, statement[2], statement[3]] }
            if (statement[0] === 'while') { pending = [...pending, statement[1].body] }
            if (statement[0] === 'switch') { pending = [...pending, ...statement[1].cases.map(arm => arm.body), statement[1].otherwise] }
        }
        const exit = block.exit
        if (exit[0] === 'if') { pending = [...pending, exit[2], exit[3]] }
        if (exit[0] === 'switch') { pending = [...pending, ...exit[2].map(arm => arm.body), exit[3]] }
        if (exit[0] === 'terminal-loop') { pending = [...pending, exit[1].body] }
    }
    return false
}

/**
 * The value a node denotes under `env`, or the first error met in document
 * order: a reference to a keyword, to a name bound outside the function
 * being resolved, or to a name nothing binds, a plain `__proto__` key, or
 * an access naming a built-in prototype's property.
 *
 * Over an explicit stack: a frame per container being built, its items
 * resolved in order, and per function, its body resolved under its own
 * names, so that a value nested as deep as the input allows costs no call
 * stack.
 *
 * `self` is the word a `const` or a `let` binds the value to, with whether
 * it is a variable's, or `null` for a value that is no declaration's: a
 * function that is the whole value is entered with the word bound to itself,
 * {@link entered}, as a body's is.
 *
 * @type {(initial: _State) => Result<_Evaluated, ParseError>}
 */
const evaluateState = initial => {
    let state = initial
    while (true) {
        const [stack, scope, step] = state
        const [tag, payload] = step
        if (tag === 'enter') {
            state = enter(stack, scope, payload)
        } else if (tag === 'define') {
            // a `const`'s value: a function is entered under its own name
            state = payload[0] === '=>' ? entered(stack, scope, payload, step[2]) : enter(stack, scope, payload)
        } else if (tag === 'error') {
            return error(payload)
        } else if (stack === null) {
            // the root's value, every body closed
            return ok({ value: payload, scope })
        } else {
            state = returned(stack.rest, scope, stack.top, payload)
        }
    }
}

/** A source value enters the shared resolution worklist without a statement continuation. @type {(initial: _Scope, self: _Self | null) => (root: Node) => Result<_Evaluated, ParseError>} */
const evaluate = (initial, self) => root => evaluateState([null, initial, self === null ? ['enter', root] : ['define', root, self]])

/**
 * The word a binding may take: an identifier, refusing a keyword, and one
 * the environment does not hold — `import` and `const` share the one map,
 * so a name taken by either is taken for both, `duplicate id`.
 *
 * Separate from the binding itself because a `const` asks the two questions
 * at different moments: its name is refused before its value is read, so
 * that `const NaN = missing;` answers for the name and not for `missing`,
 * while the binding lands after, keeping the name out of its own
 * initializer's scope.
 *
 * @type {(env: _Env) => (name: ModuleTokenWithMetadata) => Result<string, ParseError>}
 */
const bindable = env => name => {
    const [tag, word] = identifierOf(name)
    if (tag === 'error') { return error(word) }
    return at(word)(env) === null ? ok(word) : error(duplicateId(name))
}

/**
 * The word a body `const` may take: {@link bindable}'s question asked of
 * the body's own names and of the names of the block it continues, the
 * statements after a guard being JavaScript's one block with the ones
 * before it. A name any of them binds is `duplicate id`; one none binds
 * but one has read from outside — bound to a slot of its frame, or to the
 * function itself, {@link bound} — is `capture shadowed`, and the binding
 * wins where both hold, as it does in JavaScript, where the read named the
 * block's own binding. A name the
 * body's own initializer reads is refused once it has been, in
 * {@link returned}.
 *
 * @type {(scope: _Scope) => (name: ModuleTokenWithMetadata) => Result<string, ParseError>}
 */
const bodyBindable = scope => name => {
    const [tag, word] = identifierOf(name)
    if (tag === 'error') { return error(word) }
    const refs = [scope.names, ...toArray(scope.enclosing)].flatMap(env => {
        const ref = at(word)(env)
        return ref === null ? [] : [ref]
    })
    if (refs.some(ref => ref.kind === 'own')) { return error(duplicateId(name)) }
    return refs.length === 0 ? ok(word) : error(captureShadowed(name))
}

/** The environment with a word bound to a reference, its two questions already answered. @type {(env: _Env) => (word: string, ref: _Ref) => _Env} */
const extended = env => (word, ref) => setReplace(word)(ref)(env)

/** An export as the module's result object holds it: a member of its name and node. @type {(e: readonly [string, SourceValue]) => ValueMember} */
const exportMember = ([name, value]) => [':', name, value]

/**
 * Run shared analysis only after the complete resolved source scope exists,
 * and refuse what it finds: a variable assigned anywhere in its scope and
 * read or assigned by a function nested in that scope and held as a value,
 * at the first such reference in document order
 * ([spec: variables](../../../spec/bindings/variables/README.md)).
 *
 * @type {(source: SourceModule, scope: _Scope) => Result<ResolvedModule, ParseError>}
 */
const resolvedModule = (source, scope) => {
    const trace = completedTrace(scope)
    const bindings = analyzeBindings(trace)
    const reassigned = bindings.filter(fact => fact.isMutable).map(fact => fact.id)
    const escape = scope.captures.find(capture => capture.escaped && reassigned.includes(capture.id))
    if (escape !== undefined) { return error(escape.refusal) }
    return ok({ ...source, scope: trace, bindings, origins: scope.sourceOrigins })
}

/**
 * Resolve imports, declarations and assignments in order, preserving one
 * initialization plan per declaration, one write per assignment and each
 * original declaration identity. Named exports select those identities; a
 * terminal throw replaces the export result. A module's `let` is a variable
 * as a body's is ([spec: variables](../../../spec/bindings/variables/README.md)),
 * and the module being a function, the capture rule is the same.
 *
 * @type {(module: Module) => Result<ResolvedModule, ParseError>}
 */
const foldModule = ({ imports, statements, exported, thrown: failing }) => {
    let scope = moduleScope()
    /** @type {readonly SourceImport[]} */
    let modules = []
    /** @type {readonly SourceStatement[]} */
    let body = []
    /** @type {readonly (readonly [string, SourceValue])[]} */
    let exports = []
    // the statement before the one being read, whose omitted `;` the one
    // being read has to begin a line for
    /** @type {Statement | While | null} */
    let previous = null
    for (const statement of imports) {
        if (unterminated(previous, statement)) { return error(unexpectedToken(statement.start)) }
        previous = statement
        /** @type {readonly BindingId[]} */
        let importIds = []
        for (const { local } of statement.bindings) {
            const [tag, word] = bindable(scope.names)(local)
            if (tag === 'error') { return error(word) }
            const id = sourceBinding(scope.trace.bindings.length)
            scope = traced({
                ...scope, names: extended(scope.names)(word, { id, kind: 'own', assignable: false }), origins: setReplace(word)(id)(scope.origins),
                trace: { ...scope.trace, bindings: [...scope.trace.bindings, id] },
                sourceOrigins: [...scope.sourceOrigins, { id, name: word, kind: 'import', metadata: local.metadata }],
            }, [['initialize', id]])
            importIds = [...importIds, id]
        }
        const [read, record] = imported(statement)
        if (read === 'error') { return error(record) }
        modules = [
            ...modules,
            ...(statement.bindings.length === 0
                ? [{ ...record, name: null, binding: null }]
                : statement.bindings.map(({ name }, i) => ({ ...record, name, binding: importIds[i] }))),
        ]
    }
    for (const statement of statements) {
        if (statement[0] === 'while' || statement[0] === 'for') {
            const loop = statement[1]
            if (unterminated(previous, loop)) { return error(unexpectedToken(loop.start)) }
            previous = loop
            const [tag, evaluated] = evaluateState(statement[0] === 'for' ? enterFor(null, scope, statement[1], null) : enterLoop(null, scope, loop, null))
            if (tag === 'error') { return error(evaluated) }
            scope = evaluated.scope
            body = [...body, ...regionBlock(evaluated.value).statements]
            continue
        }
        if (statement[0] === 'assign') {
            const assignment = statement[1]
            if (unterminated(previous, assignment)) { return error(unexpectedToken(assignment.start)) }
            previous = assignment
            const [tag, target] = assigned(scope, assignment.name)
            if (tag === 'error') { return error(target) }
            const [resolved, evaluated] = evaluate(assignmentScope(target[0], assignment, target[1]), null)(assignment.value)
            if (resolved === 'error') { return error(evaluated) }
            scope = written(evaluated.scope, assignment, target[1])
            body = [...body, assignmentStatement(assignment, target[1], evaluated.value)]
            continue
        }
        const [kind, { declaration, exported: named }] = statement
        const { target, value: node } = declaration
        // the statement's beginning first, then the names, then the value: a
        // statement wrong in more than one answers for what a reader meets
        // first
        if (unterminated(previous, declaration)) { return error(unexpectedToken(declaration.start)) }
        previous = declaration
        const namespace = namespaceOf(target, node)
        const [tag, plan] = constPlan(bindable(scope.names))(target, node, namespace)
        if (tag === 'error') { return error(plan) }
        const then = named ? plan.names.find(([name]) => nameOf(name) === 'then') : undefined
        if (then !== undefined) { return error({ message: 'reserved export name then', metadata: then[0].metadata }) }
        // a function that is the whole value of a declaration of one name is
        // entered under that name, its `self`, a `let`'s a capture; a pattern
        // names no function, and a pattern over the `Object` namespace
        // enters nothing, {@link declaredValue}
        scope = declared(scope, plan, kind)
        const [resolved, evaluated] = namespace !== null ? ok({ value: undefined, scope }) : evaluate(scope, target[0] === 'name' ? [nameOf(target[1]), plan.ids[0], isVariable(kind)] : null)(node)
        if (resolved === 'error') { return error(evaluated) }
        scope = boundPlan(evaluated.scope, plan, isVariable(kind))
        if (named) { exports = [...exports, ...plan.names.map(([token, i]) => /** @type {const} */ ([nameOf(token), ['ref', plan.ids[i]]]))] }
        body = [...body, ['initialize', expansion(plan), evaluated.value]]
    }
    if (failing !== null) {
        if (unterminated(previous, failing)) { return error(unexpectedToken(failing.start)) }
        if (brokenLine(failing)) { return error(unexpectedToken(failing.first)) }
        const [resolved, evaluated] = evaluate(scope, null)(failing.value)
        if (resolved === 'error') { return error(evaluated) }
        /** @type {SourceModule} */
        const failingModule = { imports: modules, body: { statements: body, exit: ['throw', evaluated.value] } }
        return resolvedModule(failingModule, evaluated.scope)
    }
    if (exported !== null) {
        if (unterminated(previous, exported)) { return error(unexpectedToken(exported.start)) }
        const [resolved, evaluated] = evaluate(scope, null)(exported.value)
        if (resolved === 'error') { return error(evaluated) }
        scope = evaluated.scope
        exports = [...exports, ['default', evaluated.value]]
    }
    // an exported pattern binding no name exports nothing, and the grammar
    // saw only the `export`: the module is refused where a name was owed
    if (exports.length === 0) {
        const last = assertNotNullish(statements.findLast(s => s[0] === 'const' && s[1].exported), ['a module with no export and no throw', statements])
        assert(last[0] === 'const')
        return error(noExport(last[1].declaration.start))
    }
    /** @type {SourceModule} */
    const sourceModule = { imports: modules, body: { statements: body, exit: ['yield', ['object', toArray(sort(exports)).map(exportMember)]] } }
    return resolvedModule(sourceModule, scope)
}

/**
 * Reads the token list as a FunctionalScript module: `import` statements, then
 * `const` and `export const` statements, with an optional final `export default`
 * — or a final `throw` in its place. At least one export is required of a
 * module that does not throw; every statement ends with `;`, or where
 * JavaScript inserts one — before a statement on a new line, before `}`,
 * and at the end of the input.
 *
 * This is the only language the parser reads. A JSON document is data, not a
 * module, and `fjs/media/json` is its reader
 * ([spec: JSON input](../../../spec/command-line/json-input.md)).
 *
 * The grammar it accepts is written down in `./grammar`, read by
 * `./syntax`, and what the grammar accepts and this refuses is the fold's:
 * a name unbound or bound twice, and a plain `__proto__` key.
 *
 * @type {(tokenList: List<ModuleTokenWithMetadata>) => Result<ResolvedModule, ParseError>}
 */
export const parseFromTokens = tokenList => {
    const [tag, module] = parseSyntax(tokenList)
    return tag === 'error' ? error(module) : foldModule(module)
}

/**
 * Where a {@link ParseError} happened, as much of it as is known: the token's
 * `path:line:column` when the reader tracks positions; otherwise the file
 * the error names, when it names one — a missing import, a cycle, a body
 * that fails to evaluate, in an imported module as readily as in the input;
 * and otherwise `inputFileName`, the file being compiled — which no reader
 * `fjs compile` runs produces any more, every reader naming its file, and
 * which this parser's one contract failure, a token list with no end,
 * still can.
 *
 * An error that knows how far the offending source runs renders as a span,
 * `path:line:column-column` within one line and `path:line:column-line:column`
 * across several. Only lexical errors carry one today; a grammar failure points
 * at a single token and prints the point form.
 *
 * @type {(inputFileName: string) => (parseError: ParseError) => string}
 */
export const errorLocation = inputFileName => ({ metadata, end, path }) => {
    if (metadata === null) { return path ?? inputFileName }
    const start = `${metadata.path}:${metadata.line}:${metadata.column}`
    if (end === undefined) { return start }
    // the path is printed once — a token does not straddle files — and the
    // line is dropped from the far end when the span stays on one line, so the
    // common case reads `a.js:1:1-7` rather than repeating `1:`
    const far = end.line === metadata.line
        ? `${end.column}`
        : `${end.line}:${end.column}`
    return `${start}-${far}`
}
