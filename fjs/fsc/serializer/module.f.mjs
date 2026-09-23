/**
 * The FunctionalScript writer: a linked EDAG in, a module the parser
 * accepts out, so that compiling the output again yields the same graph.
 *
 * ```text
 * Exp ==the analysis==> the table ==this writer==> FunctionalScript text
 * ```
 *
 * It is the output the language's own extension asks for, and the one that
 * can hold what the language accepts: DataJS has no functions, so a module
 * holding one has no `.data.js` and no `.json`, and until this writer it had
 * no output but the EDAG document, which describes the function as data
 * rather than being one.
 *
 * **It writes the graph, not the value.** Nothing is executed, so a module
 * holding a function is written, and so is one whose value a reader would
 * refuse — a read of `null` is the program's failure to make when it runs.
 *
 * **What a `const` is for.** A node that mints identity — `[]`, `{}`, `=>` —
 * is one value however many edges reach it, and only a `const` keeps that in
 * text, so a shared one is hoisted. A node the analysis merged — an access —
 * is written in place at every occurrence instead, since the occurrences
 * merge again when the output is read: hoisting one would evaluate it where
 * the source did not. Every `const` is named by its position among the
 * statements of its scope, anchors and hoists in one sequence, so that one
 * graph is one text.
 *
 * **A scope writes its own `const`s.** A module and a function body are the
 * same thing here — statements, then a value, introduced by `export default`
 * or by `return` — so a body hoists what it needs into a block of its own
 * ([spec: functions](../../../spec/README.md#functions)):
 *
 * ```js
 * export default (...$a)=>{const $a0=[1];return [$a0,$a0];};
 * ```
 *
 * The names say which scope: digits after the `$` for a module, the body's
 * own parameter and then digits one level in, `$a0` where the parameter is
 * `$a`. No two scopes share a spelling, so the writer emits no `const` that
 * shadows one — see {@link hoistName} for why that is the choice.
 *
 * **A function's parameters are its count's.** A function of count `0` is
 * written with the one rest parameter, which is the body's arguments; one
 * of count `n` with `n` named parameters, `$a_0` to `$a_{n-1}` in the body
 * whose letters are `$a`, unused ones included, since the count is what
 * `length` reads as and JavaScript can observe it. Under named parameters
 * the body's `['args']` is spelled only as a read of a declared position,
 * `['.', ['args'], i]` with `i` below the count, which is the parameter's
 * name; any other use is refused rather than padded or truncated, since
 * `[$a_0, $a_1]` would not be the complete arguments — an omitted one and
 * an explicit `undefined` told apart, and a third one kept — that the node
 * denotes ([arity and complete
 * arguments](../../../spec/todo/arity-complete-arguments.md)):
 *
 * ```js
 * export default ($a_0,$a_1)=>[$a_1,$a_0];
 * ```
 *
 * **A function with a frame is a closure.** Each frame element takes a
 * `const` in the scope around the function, even one written in place
 * otherwise, since a capture is a name; a read of the frame's slot `i` is
 * that name, and a slot that reads the scope's own frame is that slot's
 * name already. Read back, the body's outside names are its captures in
 * first-use order, which the writer keeps to the frame's by naming the
 * slots in order first where its own text would read them in another
 * ({@link closureBody}):
 *
 * ```js
 * const $0=[1];export default (...$a)=>[$0,$a[0]];
 * ```
 *
 * A body needing no `const` keeps the expression form, `=> v`, which is the
 * same function and the shorter text.
 *
 * **One line, normalized**, as the DataJS output is, and its leaves are the
 * DataJS serializer's, which owns their spelling.
 *
 * **What it refuses**, each by name and with nothing written: a node kind it
 * has no spelling for, which is how a feature that adds one is made to add
 * its spelling here in the same change; a comma anywhere but where a scope
 * begins — a module's root and a function's body are read as one, and
 * anywhere else a comma has no source form until the operator lands; a
 * key the parser would not read back — one no literal spells, and one naming
 * a property of a built-in prototype, which the grammar refuses in either
 * spelling; and a frame the parser would not build ({@link frameNames},
 * {@link closureBody}), or a read of one that is no slot.
 *
 * An identity-minting node reached only through lazy edges is refused too,
 * and needs no rule of its own yet: every lazy node kind is a kind this
 * writer has no spelling for, so such a graph is refused at the operator
 * before its sharing is reached.
 *
 * A graph that breaks the EDAG's own scope rule is not refused but throws,
 * out of the analysis, since it is no EDAG rather than one this writer
 * cannot spell.
 *
 * @module
 *
 * @import { Analysis, Node, Operand, Ref } from '../../edag/analysis/types.ts'
 * @import { Exp } from '../../edag/types.ts'
 * @import { List } from '../../types/list/types.ts'
 * @import { Result } from '../../types/result/types.ts'
 * @import { Document } from './types.ts'
 * @import { _Given, _Hoisted, _Names, _Root, _Scope, _Statement } from './private.ts'
 */

import { _defaultExport, _moduleExports } from '../edag/module.f.mjs'
import { isCount } from '../../edag/module.f.mjs'
import { keywords, literalWords } from '../../js/keywords/module.f.mjs'
import { analysis } from '../../edag/analysis/module.f.mjs'
import { keySerialize, leafSerialize } from '../../media/datajs/serializer/module.f.mjs'
import { arrayWrap, colon, objectWrap } from '../../media/json/serializer/module.f.mjs'
import { first, flat, toArray } from '../../types/list/module.f.mjs'
import { _prohibitedNames } from '../parser/module.f.mjs'
import { dollarSign, isDigit, isLatinLetter, latinSmallLetterA, latinSmallLetterZ, lowLine } from '../../text/ascii/module.f.mjs'
import { codePointToString, stringToCodePointList } from '../../text/utf16/module.f.mjs'
import { assertNotNullish } from '../../asserts/module.f.mjs'
import { error, mapOk, ok, okThen } from '../../types/result/module.f.mjs'

/** Names the parser refuses to bind. */
const reservedExports = new Set([...keywords, ...literalWords, 'then'])

/** The node kinds a compiled graph holds and this writer spells. @type {(node: Node) => boolean} */
const minting = node => {
    switch (node[0]) {
        case '[]': case '{}': case '=>': { return true }
        default: { return false }
    }
}

/**
 * Whether a base needs a `const` of its own — three bases this writer has
 * no text for, though linking puts all of them there:
 *
 * - a number or a bigint, since `1.x` is one number and a stray word, and
 *   the space `1 .x` needs is not a spelling this writer keeps;
 * - a function, which takes no access in the grammar;
 * - a **negation**, because `-` binds looser than a step: `-1 .x` is
 *   `-(1 .x)` and `-1[0]` is `-(1[0])`, so the text for `['.', ['-', 1],
 *   0]` would be a different graph rather than an unreadable one. A name
 *   is what says the negation happens first, until this writer spells the
 *   group the grammar reads — `(-1)[0]`
 *   ([`./todo/parenthesized-object-body.md`](./todo/parenthesized-object-body.md)
 *   asks the same of a body).
 *
 * @type {(a: Analysis, base: Operand) => boolean}
 */
const basedHoisted = (a, base) => {
    if (!(base instanceof Array)) { return typeof base === 'number' || typeof base === 'bigint' }
    const kind = a.nodes[base[1]][0]
    return kind === '=>' || kind === '-'
}

/**
 * Whether a negation's operand needs a `const` of its own: a function, and
 * nothing else. JavaScript's unary operand is a `UnaryExpression`, which an
 * arrow function is not — `-(...a) => 1` is a syntax error — so the
 * function takes a name and the negation is written on that. A number needs
 * none here, `-1` being what the operator is most often written on.
 *
 * @type {(a: Analysis, v: Operand) => boolean}
 */
const negHoisted = (a, v) => v instanceof Array && a.nodes[v[1]][0] === '=>'

/** Two hoisted values are one when they name the same entry, or the same primitive by `Object.is`. @type {(x: _Hoisted, y: _Hoisted) => boolean} */
const sameHoisted = (x, y) => x[0] === y[0] && Object.is(x[1], y[1])

/**
 * The slot a hoisted value took in its scope, or `null` where it has none
 * yet. A slot an anchor's `const` took holds no value and matches nothing.
 *
 * @type {(names: _Names, h: _Hoisted) => number | null}
 */
const slotOf = (names, h) => {
    const i = names.findIndex(([n]) => n !== null && sameHoisted(n, h))
    return i === -1 ? null : i
}

/** How many letters a column digit has. */
const letters = latinSmallLetterZ - latinSmallLetterA + 1

/** The letters a parameter is named by, as a spreadsheet names its columns: `a`, `z`, `aa`. @type {(n: number) => string} */
const column = n => {
    const q = Math.floor((n - 1) / letters)
    return `${q === 0 ? '' : column(q)}${codePointToString(latinSmallLetterA + (n - 1) % letters)}`
}

/** The rest parameter of the body at `depth`, `1` being the outermost. @type {(depth: number) => string} */
const parameter = depth => `$${column(depth)}`

/**
 * Named parameter `i` of the body at `depth`: the body's letters, `_` and
 * the position, `$a_0` where the rest parameter would be `$a`. Neither a
 * hoist name, `$a0`, nor another body's, so a body reads only its own —
 * see {@link hoistName}.
 *
 * @type {(depth: number, i: number) => string}
 */
const parameterName = (depth, i) => `${parameter(depth)}_${i}`

/** The named parameters of a function of `count` at `depth`, in order. @type {(depth: number, count: number) => readonly string[]} */
const parameterNames = (depth, count) => Array.from({ length: count }, (_, i) => parameterName(depth, i))

/**
 * A function's count where it is one the language declares — a
 * nonnegative integer within `u32` — and the refusal otherwise, decided
 * before a name is made for it. The schema admits any number there, its
 * shape being all it checks, and a count of `1.5`, `-1`, `NaN` or `-0`
 * has no list that reads back as the same graph: `Array.from` would write
 * one or no parameters and read back another count — `0` for `-0`, which
 * the analysis tells apart by `Object.is` — so the graph is refused rather
 * than answered with a different function. `u32` is the bound `length`
 * has everywhere the graph runs — `Array.from` has no list past it, and
 * neither has NaNVM's `static_function` — so a count past it is refused
 * here as the Rust printer refuses it, rather than met with a range error.
 * Within the bound the list is as long as the count, as the text of an
 * array is as long as the array: a count of a billion is a function of a
 * billion parameters, its text the graph's size and not a fault of the
 * writer's, and no tighter bound is the language's to state — a host's
 * own limit on a parameter list is the host's, and differs by engine.
 *
 * @type {(count: number) => Result<number, string>}
 */
const declaredCount = count => !isCount(count) ? error('a parameter count that is no nonnegative integer')
    : count > 0xffffffff ? error('a parameter count past u32')
    : ok(count)

/**
 * The parameter list a function of `count` is written with, in the body
 * at `depth`: the rest parameter for none, one bare name, or a list —
 * three spellings the parser reads as one function each, the shortest of
 * each count's.
 *
 * @type {(depth: number, count: number) => string}
 */
const parameterList = (depth, count) => count === 0 ? `(...${parameter(depth)})=>`
    : count === 1 ? `${parameterName(depth, 0)}=>`
    : `(${parameterNames(depth, count).join(',')})=>`

/**
 * The name a scope at `depth` gives the `const` in slot `i`: `$0` at the
 * module level, and the body's own parameter with the slot after it one
 * level in — `$a0` in the body whose parameter is `$a`.
 *
 * Every scope numbers from zero and no two scopes share a spelling: a
 * module's names are digits after the `$`, a body's are its parameter's
 * letters and then digits, and a parameter is letters alone.
 *
 * Reading the output back needs that: a body names what it captures by the
 * name the value took in the scope around it, so a body `const` spelled the
 * same would shadow the capture — and a body that reads its capture first
 * is refused outright (`capture shadowed`). It also means the writer never
 * emits a shadowing `const` at all, which is the spelling
 * [no-shadowing](../../../spec/todo/3150-shadowing.md) would refuse.
 *
 * @type {(depth: number, i: number) => string}
 */
const hoistName = (depth, i) => depth === 0 ? `$${i}` : `${parameter(depth)}${i}`

/** The name a hoisted value took in the scope at `depth`, or `null` where it has none yet. @type {(names: _Names, h: _Hoisted) => string | null} */
const nameOf = (names, h) => {
    const i = slotOf(names, h)
    return i === null ? null : names[i][1]
}

/** What may open an identifier: a Latin letter, `_` or `$`. @type {(codePoint: number) => boolean} */
const identifierStart = codePoint =>
    isLatinLetter(codePoint) || codePoint === lowLine || codePoint === dollarSign

/**
 * Whether a word is one the tokenizer reads as a single `id` token, and so
 * may follow a `.` rather than be written as a key in brackets.
 *
 * The characters are classified by code point through
 * [`text/ascii`](../../text/ascii/module.f.mjs), which is where the rest of
 * the repository's lexical rules ask what a character is
 * ([`../../js/identifier/todo`](../../js/identifier/todo/lexical-predicates-from-text-ascii.md)).
 * A case fold would not do: `'\u212a'`, the Kelvin sign, lowercases to `k`
 * and is no letter the tokenizer takes.
 *
 * @type {(key: string) => boolean}
 */
const identifierKey = key => {
    const word = toArray(stringToCodePointList(key))
    return word.length !== 0
        && identifierStart(word[0])
        && word.every(c => identifierStart(c) || isDigit(c))
}

/** Whether an operand is the `frame` node. @type {(a: Analysis, v: Operand) => boolean} */
const isFrame = (a, v) => v instanceof Array && a.nodes[v[1]][0] === 'frame'

/** Whether an operand is the `args` node. @type {(a: Analysis, v: Operand) => boolean} */
const isArgs = (a, v) => v instanceof Array && a.nodes[v[1]][0] === 'args'

/**
 * Whether an entry reads a named parameter of the scope: `['.', ['args'],
 * i]` with `i` a declared position — the read a parameter is, which the
 * parser builds from the name and nothing else builds.
 *
 * @type {(s: _Scope, v: Ref) => boolean}
 */
const isParameterRead = (s, v) => {
    const node = s.a.nodes[v[1]]
    return node[0] === '.' && node.length === 3 && isArgs(s.a, node[1]) && parameterIndex(s)(node[2]) !== null
}

/**
 * The position a key names among the scope's named parameters, or `null`
 * where it names none: an integer from `0` below the count. A `-0` key is
 * position `0`'s, as it is a frame slot's ({@link slotName}).
 *
 * @type {(s: _Scope) => (k: Operand) => number | null}
 */
const parameterIndex = s => k => typeof k === 'number' && Number.isInteger(k) && k >= 0 && k < s.parameters.length ? k : null

/**
 * Whether an entry reads a slot of the frame: `['.', ['frame'], i]`, the
 * one read of the frame the parser builds.
 *
 * @type {(a: Analysis, v: Ref) => boolean}
 */
const isSlotRead = (a, v) => {
    const node = a.nodes[v[1]]
    return node[0] === '.' && node.length === 3 && isFrame(a, node[1])
}

/**
 * The items of a function's frame where it is an array literal, and none
 * otherwise — `null`, or a frame {@link frameNames} refuses.
 *
 * @type {(a: Analysis, frame: Operand) => readonly (Operand | readonly ['...', Operand])[]}
 */
const frameItems = (a, frame) => {
    if (!(frame instanceof Array)) { return [] }
    const node = a.nodes[frame[1]]
    return node[0] === '[]' ? node[1] : []
}

/**
 * The results of a list, or the first error in it. A list of values is
 * written only when every element is, and the refusal reported is the one
 * a reader meets first.
 *
 * @template T
 * @param {readonly Result<T, string>[]} xs
 * @returns {Result<readonly T[], string>}
 */
const every = xs => {
    const bad = xs.find(x => x[0] === 'error')
    return bad === undefined
        ? ok(xs.map(x => /** @type {readonly ['ok', T]} */(x)[1]))
        : error(/** @type {readonly ['error', string]} */(bad)[1])
}

/**
 * The text of an operand at `depth`, `0` at the module level: a primitive
 * as the DataJS serializer spells it, a hoisted value by its name, and any
 * other entry in place.
 *
 * @type {(s: _Scope, depth: number) => (v: Operand) => Document}
 */
const operand = (s, depth) => v => {
    if (!(v instanceof Array)) { return ok(leafSerialize(v)) }
    const name = nameOf(s.names, ['entry', v[1]])
    return name === null ? entry(s, depth)(v[1]) : ok([name])
}

/**
 * An access's base: a hoisted one by its name, anything else as an operand.
 * The `const` it names is its own scope's, a body's as readily as the
 * module's, so a numeric or function base inside a body is written there
 * rather than refused.
 *
 * @type {(s: _Scope, depth: number) => (v: Operand) => Document}
 */
const base = (s, depth) => v => {
    if (!basedHoisted(s.a, v)) { return operand(s, depth)(v) }
    const h = /** @type {_Hoisted} */ (v instanceof Array ? ['entry', v[1]] : ['leaf', v])
    // Every such base was collected before the statement that needs it, so a
    // missing name is this writer's own mistake.
    return ok([assertNotNullish(nameOf(s.names, h), ['an access base that was not hoisted', v])])
}

/** An array's item: a spread has no source spelling. @type {(s: _Scope, depth: number) => (v: Operand | readonly ['...', Operand]) => Document} */
const item = (s, depth) => v => v instanceof Array && v[0] === '...'
    ? error('a spread')
    : operand(s, depth)(/** @type {Operand} */(v))

/** An object's entry: a spread has no source spelling, and a key that is not a string no literal. @type {(s: _Scope, depth: number) => (p: readonly [':', Operand, Operand] | readonly ['...', Operand]) => Document} */
const property = (s, depth) => p => {
    if (p[0] === '...') { return error('a spread') }
    const [, k, v] = p
    return typeof k !== 'string'
        ? error('an object key that is not a string')
        : mapOk(value => flat([keySerialize(k), colon, value]))(operand(s, depth)(v))
}

/** A key in brackets, `[k]`, where no word follows a `.`. @type {(k: string | number) => Document} */
const bracketed = k => ok(flat([['['], leafSerialize(k), [']']]))

/**
 * An access's key: a name after `.` where the word admits it, and a key in
 * brackets otherwise. The `.` and the name are one chunk, so that a chunk
 * holding a name alone is always a reference — what {@link firstUse} reads.
 *
 * A number is written as itself, except for the three the tokenizer does not
 * read back to the same key: `NaN` and either infinity have no literal at
 * all, `Infinity` being an identifier and no key token, and `-0` reads back
 * as `0`. The front end produces none of them — `a[-0]` is already the key
 * `0` by the time a graph holds it — so each is refused rather than
 * respelled.
 *
 * A computed key, `['Number', e]`, is refused rather than written
 * `base[Number(k)]` as the issue proposes: the grammar's index is a string
 * or a number literal, so that spelling is one the parser would not read
 * back, and writing it would break the round trip the output exists for. It
 * is a spelling to add with computed keys, not before them.
 *
 * @type {(k: Operand) => Document}
 */
const key = k => {
    if (typeof k === 'string') {
        if (_prohibitedNames.has(k)) { return error('a prohibited property name') }
        return identifierKey(k) ? ok([`.${k}`]) : bracketed(k)
    }
    if (typeof k !== 'number') { return error('an access key that is no literal') }
    return Number.isFinite(k) && !Object.is(k, -0)
        ? bracketed(k)
        : error('a number key no literal reads back')
}

/** The first chunk of a document, which no spelling leaves empty. @type {(text: List<string>) => string} */
const firstChunk = first('')

/**
 * The name the frame's slot `k` reads as in the scope `s`: the name the
 * slot's element took in the scope around the function. A slot out of
 * range, and a key no slot is, has no name to write. A `-0` key is slot
 * `0`'s: JavaScript reads the number `-0` as the key `"0"`, and so do the
 * EDAG interpreter and `nanvm-lib` (`canonical_index`), so the read is
 * written as slot `0`'s name — the same program, the table differing only
 * in the key's sign, which collapsing would be an optimization.
 *
 * @type {(s: _Scope) => (k: Operand) => Result<string, string>}
 */
const slotName = s => k => typeof k === 'number' && Number.isInteger(k) && k >= 0 && k < s.frame.length
    ? ok(s.frame[k])
    : error('a frame read that is no slot')

/** A read of the frame's slot `k`, written as its name. @type {(s: _Scope) => (k: Operand) => Document} */
const slotRead = s => k => mapOk((/** @type {string} */ name) => [name])(slotName(s)(k))

/**
 * The name the argument at `k` reads as under named parameters: the
 * parameter's, where `k` is a declared position — and none where it is
 * not: `$a_0` names the argument at `0` and nothing names the rest, so
 * `a.length` and `a[2]` under `(a, b)` have no text that reads back as the
 * same graph.
 *
 * @type {(s: _Scope) => (k: Operand) => Result<string, string>}
 */
const argumentName = s => k => {
    const i = parameterIndex(s)(k)
    return i === null ? error('an argument that is no named parameter') : ok(s.parameters[i])
}

/** A read of the argument at `k` under named parameters, `['.', ['args'], k]`, written as the parameter's name. @type {(s: _Scope) => (k: Operand) => Document} */
const parameterRead = s => k => mapOk((/** @type {string} */ name) => [name])(argumentName(s)(k))

/**
 * The names a function's frame gives its slots, in the scope `s` the
 * function is written in: each element's own name there — the `const` the
 * hoisting walk gave it, the name of the slot of `s`'s frame it reads, or
 * the name of the parameter of `s` it reads — and none for a `null`
 * frame.
 *
 * A frame the parser would not have built has no text that reads back as
 * the same graph, and is refused: one that is no array literal, an empty
 * one — reading back no capture is `null` — one reached from anywhere but
 * its function, and one with a slot that is a spread, holds a primitive —
 * which the parser writes into the body instead — or repeats another slot,
 * since one name is one capture.
 *
 * @type {(s: _Scope) => (frame: Operand) => Result<readonly string[], string>}
 */
const frameNames = s => frame => {
    if (frame === null) { return ok([]) }
    if (!(frame instanceof Array) || s.a.nodes[frame[1]][0] !== '[]') { return error('a frame that is not an array literal') }
    if (s.a.shared.includes(frame[1])) { return error('a frame reached from anywhere but its function') }
    const items = frameItems(s.a, frame)
    if (items.length === 0) { return error('an empty frame') }
    /** @type {(x: Operand | readonly ['...', Operand]) => Result<string, string>} */
    const name = x => {
        if (!(x instanceof Array)) { return error('a frame slot holding a primitive') }
        if (x[0] === '...') { return error('a spread') }
        if (isSlotRead(s.a, x)) { return slotName(s)(/** @type {Operand} */(s.a.nodes[x[1]][2])) }
        // a parameter is a name already, as a slot is
        if (isParameterRead(s, x)) { return argumentName(s)(/** @type {Operand} */(s.a.nodes[x[1]][2])) }
        // every other element was hoisted before the statement holding the
        // function, so a missing name is this writer's own mistake
        return ok(assertNotNullish(nameOf(s.names, ['entry', x[1]]), ['a frame element that was not hoisted', x]))
    }
    return okThen(
        /** @type {(names: readonly string[]) => Result<readonly string[], string>} */
        (names => new Set(names).size === names.length ? ok(names) : error('a frame slot that repeats another')),
    )(every(items.map(name)))
}

/**
 * The order a function's body first reads its frame's slots in, which is
 * the order reading the text back numbers them: a chunk holding a name
 * alone is a reference ({@link key}), and the names of one frame are the
 * spellings of the scope around the body, which no name the body binds
 * shares ({@link hoistName}), so the first time the text holds a slot's name
 * is where the parser meets that capture.
 *
 * @type {(names: readonly string[], text: List<string>) => readonly number[]}
 */
const firstUse = (names, text) => toArray(text).reduce(
    /** @type {(order: readonly number[], chunk: string) => readonly number[]} */
    ((order, chunk) => {
        const i = names.indexOf(chunk)
        return i === -1 || order.includes(i) ? order : [...order, i]
    }),
    [])

/**
 * A function's body, over the names its frame's slots read as, in the text
 * that reads back to the same frame: the body as {@link lambdaBody} writes
 * it where its first reads of the slots come in slot order, and otherwise
 * {@link aliasedBody}, which puts them in that order first. The writer's
 * text order is its own — a shared function the body holds is hoisted above
 * the `return`, so what it reads comes first — and the frame's order is the
 * source's, so the two need not agree.
 *
 * A slot the body never reads is refused: the parser builds none, and no
 * text reads back as one.
 *
 * @type {(a: Analysis, depth: number, given: _Given) => (b: Operand) => Document}
 */
const closureBody = (a, depth, given) => b => okThen(
    /** @type {(text: List<string>) => Document} */
    (text => {
        const order = firstUse(given.frame, text)
        return order.length !== given.frame.length ? error('a frame slot the body never reads')
            : order.every((x, i) => x === i) ? ok(text)
            : aliasedBody(a, depth, given)(b)
    }),
)(lambdaBody(a, depth, given)(b))

/**
 * A function's body that opens by naming its frame's slots in slot order,
 * one `const` each, and reads each slot by that `const` from then on:
 *
 * ```js
 * (...$a)=>{const $a0=$0;const $a1=$1;const $a2=(...$b)=>$a1;return [$a0,$a2,$a2];}
 * ```
 *
 * Read back, each `const` is the body's capture of that slot, taken in
 * order, and a reference to it is the slot's read again — an alias is the
 * node it names. It is anchored, as an unreached `const` is, only where no
 * eager position reaches it, and every position reaching a slot read is
 * eager in what this writer spells: a lazy operator is a node kind it has
 * none for.
 *
 * @type {(a: Analysis, depth: number, given: _Given) => (b: Operand) => Document}
 */
const aliasedBody = (a, depth, given) => b => {
    const aliases = given.frame.map((_, i) => hoistName(depth, i))
    /** @type {_Statement} */
    const start = {
        text: flat(given.frame.map((name, i) => [`const ${aliases[i]}=`, name, ';'])),
        names: aliases.map(alias => /** @type {const} */ ([null, alias])),
    }
    return okThen(
        /** @type {(all: _Root) => Document} */
        (all => mapOk(
            /** @type {(st: _Statement) => List<string>} */
            (st => flat([['{'], st.text, ['}']])),
        )(scope(a, depth, { ...given, frame: aliases }, start)(all))),
    )(scopeOperands(a, b))
}

/**
 * A function's body at `depth`, in a scope of its own: the `const`s it needs
 * and then the value it returns.
 *
 * A body needing no `const` is the expression form, `=> v`, which is the
 * same function and the shorter text — unless its text opens with `{`, since
 * `=> {` opens a block and not an object. That question is the text's and
 * not the node's: an object literal is not the only body that begins with
 * one — `['.', ['{}', …], 'a']` writes `{"a":1}.a` — and a body that begins
 * with `{` any other way would need the same block. Grouping has since given
 * the language `=> ({"a":1})`, which is the same function in four fewer
 * characters; writing that instead is
 * [`./todo/parenthesized-object-body.md`](./todo/parenthesized-object-body.md).
 *
 * A body needing one is a block, `=> {const $a0=…;return v;}`, which is
 * where a shared constructor inside a body, a numeric or function access
 * base, and a body's anchors are all written
 * ([spec: functions](../../../spec/README.md#functions)).
 *
 * @type {(a: Analysis, depth: number, given: _Given) => (b: Operand) => Document}
 */
const lambdaBody = (a, depth, given) => b => okThen(
    /** @type {(all: _Root) => Document} */
    (all => all.length === 1 && hoists({ a, names: [], ...given })(all[0]).length === 0
        ? mapOk(
            /** @type {(text: List<string>) => List<string>} */
            (text => firstChunk(text).startsWith('{') ? flat([['{return '], text, [';}']]) : text),
        )(operand({ a, names: [], ...given }, depth)(all[0]))
        : mapOk(
            /** @type {(st: _Statement) => List<string>} */
            (st => flat([['{'], st.text, ['}']])),
        )(scope(a, depth, given, nothing)(all))),
)(scopeOperands(a, b))

/**
 * One entry of the table, written in place — every entry that is not a
 * hoisted value of the scope it stands in, which {@link operand} named
 * before reaching here.
 *
 * @type {(s: _Scope, depth: number) => (i: number) => Document}
 */
const entry = (s, depth) => i => {
    const node = s.a.nodes[i]
    switch (node[0]) {
        case 'undefined': { return ok(['undefined']) }
        case 'args': {
            // under named parameters the arguments have no name of their
            // own, and a read of a declared position is the one spelling
            return depth === 0 ? error('the arguments outside a function')
                : s.parameters.length !== 0 ? error('the arguments of a function with named parameters')
                : ok([parameter(depth)])
        }
        case '[]': { return mapOk(arrayWrap)(every(node[1].map(item(s, depth)))) }
        case '{}': { return mapOk(objectWrap)(every(node[1].map(property(s, depth)))) }
        case 'frame': { return error('the frame outside a slot read') }
        case '.': {
            const [, b, k, continuation] = node
            if (continuation !== undefined) { return error('a chain step') }
            if (isFrame(s.a, b)) { return slotRead(s)(k) }
            if (isArgs(s.a, b) && s.parameters.length !== 0) { return parameterRead(s)(k) }
            return mapOk(
                /** @type {(parts: readonly List<string>[]) => List<string>} */
                (parts => flat(parts)),
            )(every([base(s, depth)(b), key(k)]))
        }
        case '=>': {
            const [, declared, frame, body] = node
            return okThen(
                /** @type {(count: number) => Document} */
                (count => okThen(
                    /** @type {(names: readonly string[]) => Document} */
                    (names => mapOk(
                        /** @type {(text: List<string>) => List<string>} */
                        (text => flat([[parameterList(depth + 1, count)], text])),
                    )(closureBody(s.a, depth + 1, { frame: names, parameters: parameterNames(depth + 1, count) })(body))),
                )(frameNames(s)(frame))),
            )(declaredCount(declared))
        }
        case '-': {
            // `op12` of two operands is the binary minus, which the language
            // has no spelling for yet; of one, it is the prefix.
            if (node.length !== 2) { return error('a binary - node') }
            return mapOk(
                /** @type {(text: List<string>) => List<string>} */
                // `- -1` and not `--1`: two adjacent minus characters are the
                // one decrement token, which the parser has no rule for, so a
                // minus before a minus takes a space. A negation whose operand
                // is a function was given a `const` by the hoisting walk, so
                // what stands here is a name and never `(...$a)=>…`, which
                // JavaScript refuses after a `-`.
                (text => flat([[firstChunk(text).startsWith('-') ? '- ' : '-'], text])),
            )(operand(s, depth)(node[1]))
        }
        // a comma is a scope's own form, read by `scopeOperands` where a
        // module's root or a function's body begins; anywhere else it has no
        // source spelling until the operator lands
        case ',': { return error('a comma outside a scope') }
        default: { return error(`a ${node[0]} node`) }
    }
}

/**
 * The values a statement has to hoist before it can be written, in the
 * order their `const`s come: every hoisted value its operand reaches and
 * the names do not hold yet, each after the hoisted values it reaches
 * itself, which is the table's own order since an entry follows its
 * operands.
 *
 * A body is not walked: nothing inside one is hoisted, because a `const`
 * at the module level would leave the body's scope.
 *
 * @type {(s: _Scope) => (v: Operand) => readonly _Hoisted[]}
 */
const hoists = s => {
    /** @type {(found: readonly _Hoisted[], v: Operand) => readonly _Hoisted[]} */
    const found = (names, v) => {
        /** @type {(ns: readonly _Hoisted[], h: _Hoisted) => readonly _Hoisted[]} */
        const add = (ns, h) =>
            slotOf(s.names, h) === null && !ns.some(n => sameHoisted(n, h)) ? [...ns, h] : ns
        if (!(v instanceof Array)) { return names }
        const i = v[1]
        if (slotOf(s.names, ['entry', i]) !== null) { return names }
        const node = s.a.nodes[i]
        // every frame element but a spread, a slot of this scope's own
        // frame and a parameter of it takes a `const`, after what it
        // reaches and before the function: a capture is a name
        const inner = frameItems(s.a, node[0] === '=>' ? node[2] : null)
            .filter(x => x instanceof Array && x[0] === '#' && !isSlotRead(s.a, /** @type {Ref} */(x)) && !isParameterRead(s, /** @type {Ref} */(x)))
            .reduce((ns, x) => add(found(ns, /** @type {Ref} */(x)), ['entry', /** @type {Ref} */(x)[1]]), operands(node).reduce(found, names))
        const self = minting(node) && s.a.shared.includes(i) ? add(inner, ['entry', i]) : inner
        if (node[0] === '-' && node.length === 2 && negHoisted(s.a, node[1])) {
            return add(self, ['entry', /** @type {Ref} */(node[1])[1]])
        }
        return node[0] === '.' && basedHoisted(s.a, node[1])
            ? add(self, node[1] instanceof Array ? ['entry', node[1][1]] : ['leaf', /** @type {number | bigint} */(node[1])])
            : self
    }
    return v => found(/** @type {readonly _Hoisted[]} */([]), v)
}

/**
 * The operands a node holds, for the hoisting walk: a container's items and
 * a property's halves, an access's base and key, a negation's operand, and
 * a comma's operands. A function's body is not among them, since the walk
 * stops at a body.
 *
 * @type {(node: Node) => readonly Operand[]}
 */
const operands = node => {
    switch (node[0]) {
        case '[]': { return node[1].flatMap(x => x instanceof Array && x[0] === '...' ? [x[1]] : [/** @type {Operand} */(x)]) }
        case '{}': { return node[1].flatMap(p => p[0] === '...' ? [p[1]] : [p[1], p[2]]) }
        case '.': { return [node[1], node[2]] }
        case '-': { return node.length === 2 ? [node[1]] : [] }
        case ',': { return node[1] }
        default: { return [] }
    }
}

/** The text a hoisted value's `const` holds, in the scope at `depth`. @type {(s: _Scope, depth: number) => (h: _Hoisted) => Document} */
const hoistedText = (s, depth) => h => h[0] === 'leaf'
    ? ok(leafSerialize(h[1]))
    : entry(s, depth)(h[1])

/**
 * One statement and every `const` it needed first: the hoists, in order,
 * then the operand itself — an anchor as a `const` of its own, and the last
 * operand as the export.
 *
 * An anchor whose operand already has a name is refused. Its statement
 * would be a bare alias, `const $1=$0;`, which the front end reads back as
 * nothing at all — an alias to a reached `const` is not an anchored
 * computation — and the comma would be lost with it. Linking emits no such
 * graph, dropping the alias where the source writes one.
 *
 * @type {(a: Analysis, depth: number, given: _Given, last: boolean) => (before: _Statement, v: Operand) => Result<_Statement, string>}
 */
const statement = (a, depth, given, last) => ({ text, names }, v) => {
    /** @type {(acc: Result<_Statement, string>, h: _Hoisted) => Result<_Statement, string>} */
    const emit = (acc, h) => {
        if (acc[0] === 'error') { return acc }
        const before = acc[1]
        const s = { a, names: before.names, ...given }
        return mapOk(
            /** @type {(value: List<string>) => _Statement} */
            (value => ({
                text: flat([before.text, [`const ${hoistName(depth, before.names.length)}=`], value, [';']]),
                names: [...before.names, [h, hoistName(depth, before.names.length)]],
            })),
        )(hoistedText(s, depth)(h))
    }
    const hoisted = hoists({ a, names, ...given })(v).reduce(emit, ok({ text, names }))
    if (hoisted[0] === 'error') { return hoisted }
    const before = hoisted[1]
    if (!last && v instanceof Array && slotOf(before.names, ['entry', v[1]]) !== null) {
        return error('an anchor that repeats a hoisted value')
    }
    const s = { a, names: before.names, ...given }
    return mapOk(
        /** @type {(value: List<string>) => _Statement} */
        (value => ({
            text: flat([
                before.text,
                last ? [depth === 0 ? 'export default ' : 'return '] : [`const ${hoistName(depth, before.names.length)}=`],
                value,
                [';'],
            ]),
            names: last ? before.names : [...before.names, [null, hoistName(depth, before.names.length)]],
        })),
    )(operand(s, depth)(v))
}

/**
 * The statements of one scope: each operand preceded by the `const`s it
 * needs, an anchor as a `const` of its own, and the last operand introduced
 * by what the scope returns with — `export default ` for a module, `return `
 * for a function body.
 *
 * The names start empty, a scope's `const`s being its own: a body reads a
 * name the scope around it bound through its frame alone, and its
 * arguments through its parameters, `given` naming each.
 *
 * `start` is what the scope has written before them: nothing, or a body's
 * aliases of its frame ({@link aliasedBody}).
 *
 * @type {(a: Analysis, depth: number, given: _Given, start: _Statement) => (all: _Root) => Result<_Statement, string>}
 */
const scope = (a, depth, given, start) => all => {
    /** @type {(acc: Result<_Statement, string>, v: Operand, i: number) => Result<_Statement, string>} */
    const step = (acc, v, i) => acc[0] === 'error'
        ? acc
        : statement(a, depth, given, i === all.length - 1)(acc[1], v)
    return all.reduce(step, ok(start))
}

/** A scope that has written nothing yet. @type {_Statement} */
const nothing = { text: null, names: [] }

/** What a module is given from outside: nothing, a module having no frame and no parameters. @type {_Given} */
const module = { frame: [], parameters: [] }

/**
 * The operands a scope's statements are written from: a comma is the source
 * form it came from, an unused `const` per anchor and then the value, and
 * any other operand is that value alone.
 *
 * A comma holding fewer than two operands is refused: an anchor is an
 * unreached `const`, so a comma with one operand has no anchor to write and
 * would be read back as its operand alone, and one with none is no scope at
 * all. Linking emits neither, at a module's root or in a body — a comma is
 * built only where an anchor or an unbound import is there to carry.
 *
 * @type {(a: Analysis, v: Operand) => Result<_Root, string>}
 */
const scopeOperands = (a, v) => {
    if (!(v instanceof Array)) { return ok([v]) }
    const node = a.nodes[v[1]]
    if (node[0] !== ',') { return ok([v]) }
    return node[1].length < 2
        ? error('a comma with fewer than two operands')
        : ok(node[1])
}

/**
 * A linked EDAG as the chunks of a FunctionalScript module, or why this
 * writer has no spelling for it.
 *
 * @type {(e: Exp) => Document}
 */
export const trySerialize = e => {
    const a = analysis(e)
    return okThen(
        /** @type {(all: _Root) => Document} */
        (all => mapOk(
            /** @type {(s: _Statement) => List<string>} */
            (s => s.text),
        )(scope(a, 0, module, nothing)(all))),
    )(scopeOperands(a, a.root))
}

/** The same as one string. @type {(e: Exp) => Result<string, string>} */
export const tryStringify = e => mapOk(
    /** @type {(text: List<string>) => string} */
    (text => toArray(text).join('')),
)(trySerialize(e))

/** A generated-name prefix that cannot collide with any exported binding. @type {(keys: readonly string[], prefix: string) => string} */
const modulePrefix = (keys, prefix) => keys.some(key => key.startsWith(prefix)) ? modulePrefix(keys, `${prefix}$`) : prefix

/** Emit one named value using the same expression writer as value output. @type {(a: Analysis, prefix: string, h: _Hoisted) => (before: _Statement) => Result<_Statement, string>} */
const moduleBinding = (a, prefix, h) => before => {
    const name = `${prefix}${before.names.length}`
    return mapOk(
        /** @type {(text: List<string>) => _Statement} */
        (text => ({ text: flat([before.text, [`const ${name}=`], text, [';']]), names: [...before.names, [h, name]] })),
    )(hoistedText({ a, names: before.names, ...module }, 0)(h))
}

/**
 * Evaluate a module operand in graph order and name it once. Commas become
 * ordered declarations and an alias of their last operand. Function bodies
 * stay in the existing scope writer; no value is hoisted out of a function.
 *
 * @type {(a: Analysis, prefix: string) => (before: _Statement, v: Operand) => Result<_Statement, string>}
 */
const moduleOperand = (a, prefix) => (before, v) => {
    if (!(v instanceof Array) || slotOf(before.names, ['entry', v[1]]) !== null) { return ok(before) }
    const node = a.nodes[v[1]]
    if (node[0] === ',' && node[1].length < 2) { return error('a comma with fewer than two operands') }
    const children = operands(node).reduce(
        /** @type {(acc: Result<_Statement, string>, child: Operand) => Result<_Statement, string>} */
        ((acc, child) => okThen(state => moduleOperand(a, prefix)(state, child))(acc)), ok(before))
    return okThen(state => {
        if (node[0] === ',') {
            const last = node[1][node[1].length - 1]
            const name = `${prefix}${state.names.length}`
            return mapOk(
                /** @type {(text: List<string>) => _Statement} */
                (text => ({ text: flat([state.text, [`const ${name}=`], text, [';']]), names: [...state.names, [['entry', v[1]], name]] })),
            )(operand({ a, names: state.names, ...module }, 0)(last))
        }
        const prepared = hoists({ a, names: state.names, ...module })(v).reduce(
            /** @type {(acc: Result<_Statement, string>, h: _Hoisted) => Result<_Statement, string>} */
            ((acc, h) => okThen(moduleBinding(a, prefix, h))(acc)), ok(state))
        return okThen(ready => slotOf(ready.names, ['entry', v[1]]) !== null
            ? ok(ready)
            : moduleBinding(a, prefix, ['entry', v[1]])(ready))(prepared)
    })(children)
}

/** @type {(a: Analysis, v: Operand) => readonly (readonly [':', string, Operand])[]} */
const exportOperands = (a, v) => {
    const node = a.nodes[/** @type {Ref} */ (v)[1]]
    return node[0] === ','
        ? exportOperands(a, node[1][node[1].length - 1])
        : /** @type {readonly (readonly [':', string, Operand])[]} */ (/** @type {Extract<Node, readonly ['{}', unknown]>} */ (node)[1])
}

/** Evaluate a module's sequence and exports without constructing a discarded namespace. @type {(a: Analysis, prefix: string) => (state: _Statement, v: Operand) => Result<_Statement, string>} */
const moduleBody = (a, prefix) => (state, v) => {
    const node = a.nodes[/** @type {Ref} */ (v)[1]]
    const values = node[0] === ',' ? node[1].slice(0, -1) : exportOperands(a, v).map(([, , value]) => value)
    const before = values.reduce(
        /** @type {(acc: Result<_Statement, string>, value: Operand) => Result<_Statement, string>} */
        ((acc, value) => okThen(s => moduleOperand(a, prefix)(s, value))(acc)), ok(state))
    return node[0] === ','
        ? okThen(s => moduleBody(a, prefix)(s, node[1][node[1].length - 1]))(before)
        : before
}

/** One original export, after its computation has been emitted. @type {(a: Analysis, state: _Statement) => (member: readonly [':', string, Operand]) => Document} */
const moduleExport = (a, state) => ([, key, v]) => mapOk(
    /** @type {(text: List<string>) => List<string>} */
    (text => flat([[key === 'default' ? 'export default ' : `export const ${key}=`], text, [';']])),
)(operand({ a, names: state.names, ...module }, 0)(v))

/**
 * A module export object as source, preserving export names and declaration
 * evaluation. The compact value writer keeps default-only DataJS fixed points;
 * the module walk also handles dependencies whose selected export retains an
 * internal evaluation sequence.
 *
 * @type {(e: Exp) => Document}
 */
export const tryModuleSerialize = e => {
    const members = _moduleExports(e)
    if (members.length === 0) { return error('a module without exports') }
    const keys = members.map(([, key]) => key)
    if (new Set(keys).size !== keys.length) { return error('duplicate export names') }
    if (keys.some(key => key !== 'default' && (!identifierKey(key) || reservedExports.has(key)))) {
        return error('an unsupported export name')
    }
    if (keys.length === 1 && keys[0] === 'default') {
        const compact = trySerialize(_defaultExport(e))
        if (compact[0] === 'ok') { return compact }
    }
    const a = analysis(e)
    const exports = exportOperands(a, a.root)
    const prefix = modulePrefix(keys, '$')
    return okThen(state => mapOk(
        /** @type {(parts: readonly List<string>[]) => List<string>} */
        (parts => flat([state.text, ...parts])),
    )(every([
        ...exports.filter(([, key]) => key !== 'default'),
        ...exports.filter(([, key]) => key === 'default'),
    ].map(moduleExport(a, state)))))(moduleBody(a, prefix)({ text: null, names: [] }, a.root))
}

/** The module source as one string. @type {(e: Exp) => Result<string, string>} */
export const tryModuleStringify = e => mapOk(
    /** @type {(text: List<string>) => string} */
    (text => toArray(text).join('')),
)(tryModuleSerialize(e))
