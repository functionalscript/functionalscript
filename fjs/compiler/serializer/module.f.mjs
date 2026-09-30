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
 * text, so a shared one is hoisted, and so is a shared node holding one
 * through a lazy edge, whose text written twice would mint twice
 * ({@link hoistedKind}). A node the analysis merged — an access, an
 * operator over values — is written in place at every occurrence instead,
 * since the occurrences merge again when the output is read: hoisting one
 * would evaluate it where the source did not. Every `const` is named by its
 * position among the statements of its scope, anchors and hoists in one
 * sequence, so that one graph is one text.
 *
 * **A scope writes its own `const`s.** A module and a function body are the
 * same thing here — statements, then a value, introduced by `export default`
 * or by `return` — so a body hoists what it needs into a block of its own
 * ([spec: functions](../../../spec/README.md#functions)):
 *
 * ```js
 * export default ()=>{const $a0=[1];return [$a0,$a0];};
 * ```
 *
 * **A lazy operand is a block root.** The right operand of `&&`, `||` and
 * `??` and an arm of `?:` is established only when the operator decides
 * to, so a value shared under it alone cannot take a `const` of the scope
 * — that would establish it whatever the operator decides — and takes one
 * in a block opened at the operand instead: an IIFE, which is the call the
 * front end inlines, so that reading it back gives the operand again
 * ({@link block}). A comma under a lazy operand, the anchors of an inlined
 * body, is written as the same block. What a scope hoists is what its own
 * root reaches eagerly, {@link hoists}; a value a lazy operand alone
 * reaches is the operand's block's, and one two lazy operands reach with
 * no eager path has no text and is refused.
 *
 * ```js
 * export default (...$a)=>$a[0]?(()=>{const $b0=[1];return [$b0,$b0];})():4;
 * ```
 *
 * The names say which scope: digits after the `$` for a module, the body's
 * own parameter and then digits one level in, `$a0` where the parameter is
 * `$a`; a block is a scope one level in too, its `const`s named as a
 * body's would be there, and reads the names around it, as a body reads
 * its frame. No two scopes share a spelling, so the writer emits no
 * `const` that shadows one — see {@link hoistName} for why that is the
 * choice.
 *
 * **A function with a frame is a closure.** Each frame element takes a
 * `const` in the scope around the function, even one written in place
 * otherwise, since a capture is a name; a read of the frame's slot `i` is
 * that name, and a parameter of the scope, or a slot that reads the scope's
 * own frame, has its name already: `(...$a)=>()=>$a`. Read back, the body's
 * outside names are its captures in first-use order, which the writer keeps
 * to the frame's by naming the slots in order first where its own text
 * would read them in another ({@link closureBody}):
 *
 * ```js
 * const $0=[1];export default (...$a)=>[$0,$a[0]];
 * ```
 *
 * A body needing no `const` keeps the expression form, `=> v`, which is the
 * same function and the shorter text.
 *
 * **A `throw` is a statement where a scope ends, and a call elsewhere.** A
 * scope whose value is a `throw` node ends in the statement it came from,
 * `throw v;` in place of `return v;` or `export default v;`, so a function
 * whose body throws is always a block. A `throw` node anywhere else — an
 * arm of `?:` once `if` lowers there, or wherever a hand-built graph puts
 * one — is written as the call of a function that throws,
 * `(()=>{throw v;})()`: JavaScript's one spelling of an expression that
 * fails, and FunctionalScript itself — the call the front end inlines, so
 * the text reads back as the node it was written from
 * ([spec: functions](../../../spec/README.md#functions)).
 *
 * **One line, normalized**, as the DataJS output is, and its leaves are the
 * DataJS serializer's, which owns their spelling.
 *
 * **Operators and calls take parentheses only where they must.** Every
 * operand stands at a {@link level}, JavaScript's own precedence, and is
 * grouped where its position asks for a higher one ({@link at}): `(a+b)*c`
 * but `a+b*c`, `a-(b-c)` but `a-b-c`, `(a**b)**c` but `a**b**c`, and
 * `(-a)**b`, since `-a**b` is no expression at all. A group makes no node,
 * so the text reads back as the graph it was written from. It is also how a
 * number, a function or an operator expression is the base of an access or
 * the callee of a call — `(1).x`, `(()=>1).length`, `(-a)[0]` — and
 * how a function is an operator's operand. A lazy operand written as a
 * block is a call, and takes none.
 *
 * **What it refuses**, each by name and with nothing written: a node kind it
 * has no spelling for, which is how a feature that adds one is made to add
 * its spelling here in the same change; a comma anywhere but where a block
 * begins — a module's root, a function's body and a lazy operand are read
 * as one, and anywhere else a comma has no source form until the operator
 * lands; a key the parser would not read back — one no literal spells, and
 * one naming a property of a built-in prototype, which the grammar refuses
 * in either spelling; a call whose arguments are no array literal of its
 * own; a frame the parser would not build
 * ({@link frameNames}, {@link closureBody}), or a read of one that is no
 * slot; an anchor that reads back as no anchor ({@link statement}); and a
 * shared value under a lazy operand that anything outside the operand
 * reaches ({@link block}).
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
 * @import { _Names, _Root, _Scope, _Statement, _Written } from './private.ts'
 */

import { _defaultExport, _moduleExports, _moduleThrows } from '../edag/module.f.mjs'
import { keywords, literalWords } from '../../js/keywords/module.f.mjs'
import { analysis, bindingError, mergeable } from '../../edag/analysis/module.f.mjs'
import { keySerialize, leafSerialize } from '../../media/datajs/serializer/module.f.mjs'
import { arrayWrap, colon, objectWrap, wrap } from '../../media/json/serializer/module.f.mjs'
import { first, flat, toArray } from '../../types/list/module.f.mjs'
import { _prohibitedCallNames, _prohibitedNames } from '../parser/module.f.mjs'
import { dollarSign, isDigit, isLatinLetter, latinSmallLetterA, latinSmallLetterZ, lowLine } from '../../text/ascii/module.f.mjs'
import { codePointToString, stringToCodePointList } from '../../text/utf16/module.f.mjs'
import { assertNotNullish } from '../../asserts/module.f.mjs'
import { error, mapOk, ok, okList, okThen } from '../../types/result/module.f.mjs'

/** Names the parser refuses to bind. */
const reservedExports = new Set([...keywords, ...literalWords, 'then'])

/** Whether an operand is a number or a bigint, which `1.x` would misread as a base. @type {(v: Operand) => boolean} */
const numeric = v => typeof v === 'number' || typeof v === 'bigint'

/**
 * The node kinds that keep a `const`: one value however many edges reach
 * one, which only a `const` keeps in text — a node that mints identity,
 * `[]`, `{}`, `=>`, and a call, which written twice calls twice. The
 * analysis merges none of them.
 *
 * @type {(node: Node) => boolean}
 */
const minting = node => !mergeable(node)

/**
 * Whether a shared entry takes a `const`: one that mints identity, and one
 * that holds, through a lazy edge, a node that does or a comma — `a ? []
 * : 1` referenced twice, whose text written twice would build the array
 * twice, where a shared node the entry reaches eagerly is the scope's own
 * `const` already and reads back as one node from wherever the entry's
 * text stands. Every other shared entry — an access, an operator over
 * values — is written in place at each occurrence, since the occurrences
 * merge again when the output is read.
 *
 * @type {(a: Analysis, i: number) => boolean}
 */
const hoistedKind = (a, i) => minting(a.nodes[i])
    || eagerFrom(a)(['#', i]).flatMap(j => lazyOperands(a.nodes[j])).flatMap(reachableFrom(a)).some(j => minting(a.nodes[j]) || a.nodes[j][0] === ',')

/**
 * The slot a hoisted entry took in its scope, or `null` where it has none
 * yet. A slot an anchor's `const` took holds no entry and matches nothing.
 *
 * @type {(names: _Names, h: number) => number | null}
 */
const slotOf = (names, h) => {
    const i = names.findIndex(([n]) => n === h)
    return i === -1 ? null : i
}

/** How many letters a column digit has. */
const letters = latinSmallLetterZ - latinSmallLetterA + 1

/** The letters a parameter is named by, as a spreadsheet names its columns: `a`, `z`, `aa`. @type {(n: number) => string} */
const column = n => {
    const q = Math.floor((n - 1) / letters)
    return `${q === 0 ? '' : column(q)}${codePointToString(latinSmallLetterA + (n - 1) % letters)}`
}

/** The parameter of the body at `depth`, `1` being the outermost. @type {(depth: number) => string} */
const parameter = depth => `$${column(depth)}`

/**
 * The name a read of a parameter is written as, in a scope whose function's
 * rest parameter is `param`: the rest parameter's own, `$a`, a fixed one's
 * position after it, `$a_0`, and none for any other node.
 *
 * @type {(param: string, node: Node) => string | null}
 */
const parameterName = (param, node) => {
    switch (node[0]) {
        case 'rest': { return param }
        case 'arg': { return `${param}_${node[1]}` }
        default: { return null }
    }
}

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

/** The names a scope sees: the scopes' around it, then its own. @type {(s: _Scope) => _Names} */
const visible = s => [...s.outer, ...s.names]

/** The name a hoisted entry took in the scope at `depth`, or `null` where it has none yet. @type {(names: _Names, h: number) => string | null} */
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

/** Whether an operand is written as a name the scope binds without a `const`: the arguments, a parameter, or a slot of the frame. @type {(a: Analysis, v: Operand) => boolean} */
const isName = (a, v) => v instanceof Array && (['rest', 'arg'].includes(a.nodes[v[1]][0]) || isSlotRead(a, v))

/** Whether an operand is the `frame` node. @type {(a: Analysis, v: Operand) => boolean} */
const isFrame = (a, v) => v instanceof Array && a.nodes[v[1]][0] === 'frame'

/**
 * The value a `throw` entry throws, where the operand is one, and `null`
 * where it is not: what a scope ending in a `throw` writes after the
 * keyword. The value is boxed, since `null` is itself a value a program
 * may throw, and `throw null;` is a `throw` all the same.
 *
 * @type {(a: Analysis, v: Operand) => readonly [Operand] | null}
 */
const thrownValue = (a, v) => {
    if (!(v instanceof Array)) { return null }
    const node = a.nodes[v[1]]
    return node[0] === 'throw' ? [node[1]] : null
}

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
 * The text of an operand at `depth`, `0` at the module level: a primitive
 * as the DataJS serializer spells it, a hoisted value by its name, and any
 * other entry in place.
 *
 * @type {(s: _Scope, depth: number) => (v: Operand) => Document}
 */
const operand = (s, depth) => v => {
    if (!(v instanceof Array)) { return ok(leafSerialize(v)) }
    const name = nameOf(visible(s), v[1])
    return name === null ? entry(s, depth)(v[1]) : ok([name])
}

/** A function, which no operator takes as an operand unparenthesized. */
const functionLevel = 0

/** The conditional, the lowest an operator binds. */
const conditionalLevel = 1

/** `|`, the loosest eager operator, and the tightest a `??` operand may be written at unparenthesized. */
const bitwiseOrLevel = 5

/** `**`. */
const powerLevel = 13

/** A prefix, `-` or `~`. */
const unaryLevel = 14

/** A name, a literal, an access or a call: what takes a step. */
const primaryLevel = 15

/**
 * The level each binary operator binds at, JavaScript's own, `??` loosest.
 *
 * @type {{ readonly [op in string]?: number }}
 */
const binaryLevels = {
    '??': 2, '||': 3, '&&': 4,
    '|': bitwiseOrLevel, '^': 6, '&': 7,
    '===': 8, '!==': 8,
    '<': 9, '<=': 9, '>': 9, '>=': 9,
    '<<': 10, '>>': 10, '>>>': 10,
    '+': 11, '-': 11,
    '*': 12, '/': 12, '%': 12,
    '**': powerLevel,
}

/**
 * The level an operand's text stands at in place: how tightly it binds,
 * which is what decides whether a position takes it bare or in a group. A
 * name binds as tightly as anything, however much it names, and so does
 * every node that is no operator — a `throw` elsewhere than where a scope
 * ends is a call; a negative leaf is written with its prefix.
 *
 * @type {(s: _Scope) => (v: Operand) => number}
 */
const level = s => v => {
    if (!(v instanceof Array)) { return firstChunk(leafSerialize(v)).startsWith('-') ? unaryLevel : primaryLevel }
    if (nameOf(visible(s), v[1]) !== null) { return primaryLevel }
    const node = s.a.nodes[v[1]]
    switch (node[0]) {
        case '=>': { return functionLevel }
        case '?:': { return conditionalLevel }
        case '~': { return unaryLevel }
        default: { return node.length === 2 && node[0] === '-' ? unaryLevel : binaryLevels[node[0]] ?? primaryLevel }
    }
}

/** A text in parentheses: a group, which makes no node. @type {(text: List<string>) => List<string>} */
const group = text => flat([['('], text, [')']])

/**
 * An operand in a position that takes it bare only where `fits` says its
 * level does, and in a group otherwise.
 *
 * @type {(s: _Scope, depth: number, fits: (level: number) => boolean) => (v: Operand) => Document}
 */
const at = (s, depth, fits) => v => {
    const text = operand(s, depth)(v)
    return fits(level(s)(v)) ? text : mapOk(group)(text)
}

/** A position that takes any operand at `min` or above. @type {(min: number) => (level: number) => boolean} */
const atLeast = min => x => x >= min

/** An operand's text in place, with whether it is a block; a name and a primitive are neither. @type {(s: _Scope, depth: number) => (v: Operand) => Result<_Written, string>} */
const inPlace = (s, depth) => v => mapOk((/** @type {List<string>} */ text) => ({ text, block: false }))(operand(s, depth)(v))

/**
 * The text of a lazy operand — the right operand of `&&`, `||` or `??`, an
 * arm of `?:` — which is a block root: written as a block where it needs
 * one ({@link block}), and in place otherwise, in a group where `fits`
 * says its level needs one. A block is a call, and takes none.
 *
 * @type {(s: _Scope, depth: number, fits: (level: number) => boolean) => (v: Operand) => Document}
 */
const lazyOperand = (s, depth, fits) => v => mapOk(
    /** @type {(w: _Written) => List<string>} */
    (({ text, block }) => block || fits(level(s)(v)) ? text : group(text)),
)(block(s, depth)(v))

/**
 * A lazy operand as its own block, where it needs one: an IIFE,
 * `(()=>{const …;return …;})()`, whose statements are the operand's comma
 * anchors, if it is a comma, and the `const`s of what the operand's own
 * block hoists — the shared values it reaches eagerly that no scope
 * around it named, {@link hoists} — and whose `return` is the operand's
 * value. Read back, the call is inlined and the block is the operand
 * again: its `const`s the shared nodes and the anchors, its captures the
 * names around it. An operand needing neither is written in place.
 *
 * The block is a scope at the next depth, its names its own and the names
 * around it visible, and its parameter the enclosing function's, since it
 * has none: a read of the arguments inside it is the function's.
 *
 * A node under the operand that anything outside the operand reaches too
 * is written outside as well, so where it is, or holds, a value a `const`
 * keeps and no scope around the block named, the block is refused: a
 * `const` in the block establishes the value exactly when the operand is
 * established, which is right only where nothing else reads it — `a ? [c,
 * c] : c` has no text that reads back as one node, nor has `[a && [c], b
 * && [c]]`, and `a ? c.length : c.length`, one access over one array,
 * would build the array twice. Linking emits no such graph: what a body's
 * `const` shares, the body holds, and the body is one operand once
 * inlined; and a scope's `const` two lazy positions reach is anchored, an
 * eager reach the scope hoists for.
 *
 * @type {(s: _Scope, depth: number) => (v: Operand) => Result<_Written, string>}
 */
const block = (s, depth) => v => {
    /** @type {_Scope} */
    const inner = { a: s.a, outer: visible(s), names: [], frame: s.frame, param: s.param, eager: eagerFrom(s.a)(v), shared: sharedWithin(s.a)(v) }
    /** @type {(i: number) => boolean} */
    const unnamed = i => nameOf(inner.outer, i) === null
    // Reached from outside by an edge the operand's subgraph does not
    // hold: a count by edges, so that sharing the scope counts through a
    // node holding the operand — a `const` there, {@link hoistedKind} —
    // does not count here.
    const outside = reachableFrom(s.a)(v).find(w => unnamed(w)
        && references(s.a, w) > referencesWithin(s.a, v, w)
        && reachableFrom(s.a)(['#', w]).some(i => unnamed(i) && (hoistedKind(s.a, i) || s.a.nodes[i][0] === ',')))
    if (outside !== undefined) { return error('a shared node reached from outside the lazy operand that establishes it') }
    return okThen(
        /** @type {(all: _Root) => Result<_Written, string>} */
        (all => all.length === 1 && hoists(inner)(all[0]).length === 0
            ? inPlace(s, depth)(all[0])
            : mapOk(
                /** @type {(st: _Statement) => _Written} */
                (st => ({ text: flat([['(()=>{'], st.text, ['})()']]), block: true })),
            )(scope(inner, depth + 1, nothing)(all))),
    )(scopeOperands(s.a, v))
}

/**
 * A binary operator between its operands, each grouped where the operator
 * binds tighter than it, or as tightly on the side associativity does not
 * favor: every operator reads left to right but `**`, which reads right to
 * left and takes no prefix on its left — `-a**b` is no expression, so the
 * left is a primary. `??` does not mix with `&&` and `||` unparenthesized,
 * on either side, which is the one gap in the ladder.
 *
 * The right operand of `&&`, `||` and `??` is lazy, a block root
 * ({@link lazyOperand}); every other operand is eager.
 *
 * A `-` before a text that opens with one takes a space, since `--` is the
 * decrement token and no two minus signs.
 *
 * @type {(s: _Scope, depth: number, op: string, p: number) => (left: Operand, right: Operand) => Document}
 */
const binary = (s, depth, op, p) => (left, right) => {
    const fitsLeft = op === '**' ? atLeast(primaryLevel)
        : op === '??' ? (/** @type {number} */ x) => x === p || x >= bitwiseOrLevel
        : atLeast(p)
    const fitsRight = atLeast(op === '**' ? p : op === '??' ? bitwiseOrLevel : p + 1)
    return mapOk(
        /** @type {(parts: readonly List<string>[]) => List<string>} */
        (([l, r]) => flat([l, [op === '-' && firstChunk(r).startsWith('-') ? '- ' : op], r])),
    )(okList([
        at(s, depth, fitsLeft)(left),
        (['&&', '||', '??'].includes(op) ? lazyOperand : at)(s, depth, fitsRight)(right),
    ]))
}

/**
 * A prefix, `-` or `~`, on an operand that binds at least as tightly — a
 * primary or another prefix: a power is grouped, since `-a**b` is no
 * expression, and a function is, since JavaScript's unary operand is no
 * arrow function. `- -1` and not `--1`, as for {@link binary}.
 *
 * @type {(s: _Scope, depth: number, op: string) => (v: Operand) => Document}
 */
const prefix = (s, depth, op) => v => mapOk(
    /** @type {(text: List<string>) => List<string>} */
    (text => flat([[op === '-' && firstChunk(text).startsWith('-') ? '- ' : op], text])),
)(at(s, depth, atLeast(unaryLevel))(v))

/**
 * The conditional, `c?t:e`: a condition that binds tighter than it, and
 * two arms, each a block root ({@link lazyOperand}) that stands bare
 * whatever it is — a function, or a further conditional, which nests to
 * the right as JavaScript's does.
 *
 * @type {(s: _Scope, depth: number) => (condition: Operand, then: Operand, otherwise: Operand) => Document}
 */
const conditional = (s, depth) => (condition, then, otherwise) => mapOk(
    /** @type {(parts: readonly List<string>[]) => List<string>} */
    (([c, t, e]) => flat([c, ['?'], t, [':'], e])),
)(okList([
    at(s, depth, atLeast(conditionalLevel + 1))(condition),
    lazyOperand(s, depth, atLeast(functionLevel))(then),
    lazyOperand(s, depth, atLeast(functionLevel))(otherwise),
]))

/**
 * An access's base, or a call's callee: what takes a step, so a primary,
 * and in a group anything else — an operator, a function, and a number,
 * since `1.x` is one number and a stray word.
 *
 * @type {(s: _Scope, depth: number) => (v: Operand) => Document}
 */
const base = (s, depth) => v => numeric(v)
    ? mapOk(group)(operand(s, depth)(v))
    : at(s, depth, atLeast(primaryLevel))(v)

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
 * A method call's key is refused by the parser's other list: the member
 * functions a module may not call, `a.push(1)`, where `a.at(0)` is a call
 * though `a.at` is no read.
 *
 * @type {(method: boolean) => (k: Operand) => Document}
 */
const key = method => k => {
    if (typeof k === 'string') {
        if (method && _prohibitedCallNames.has(k)) { return error('a prohibited member function') }
        if (!method && _prohibitedNames.has(k)) { return error('a prohibited property name') }
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
 * The names a function's frame gives its slots, in the scope `s` the
 * function is written in: each element's own name there — a parameter's,
 * the `const` the hoisting walk gave it, or the name of the slot of `s`'s
 * frame it reads — and none for a `null` frame.
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
        const parameterRead = parameterName(s.param, s.a.nodes[x[1]])
        if (parameterRead !== null) { return ok(parameterRead) }
        // every other element was hoisted before the statement holding the
        // function, so a missing name is this writer's own mistake
        return ok(assertNotNullish(nameOf(visible(s), x[1]), ['a frame element that was not hoisted', x]))
    }
    return okThen(
        /** @type {(names: readonly string[]) => Result<readonly string[], string>} */
        (names => new Set(names).size === names.length ? ok(names) : error('a frame slot that repeats another')),
    )(okList(items.map(name)))
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
 * @type {(a: Analysis, depth: number, names: readonly string[]) => (b: Operand) => Document}
 */
const closureBody = (a, depth, names) => b => okThen(
    /** @type {(text: List<string>) => Document} */
    (text => {
        const order = firstUse(names, text)
        return order.length !== names.length ? error('a frame slot the body never reads')
            : order.every((x, i) => x === i) ? ok(text)
            : aliasedBody(a, depth, names)(b)
    }),
)(lambdaBody(a, depth, names)(b))

/**
 * A function's body that opens by naming its frame's slots in slot order,
 * one `const` each, and reads each slot by that `const` from then on:
 *
 * ```js
 * ()=>{const $a0=$0;const $a1=$1;const $a2=()=>$a1;return [$a0,$a2,$a2];}
 * ```
 *
 * Read back, each `const` is the body's capture of that slot, taken in
 * order, and a reference to it is the slot's read again — an alias is the
 * node it names. An alias is no anchor however its slot is reached, even
 * by a lazy operand alone: the front end anchors an unreached `const` only
 * where it computes something.
 *
 * @type {(a: Analysis, depth: number, names: readonly string[]) => (b: Operand) => Document}
 */
const aliasedBody = (a, depth, names) => b => {
    const aliases = names.map((_, i) => hoistName(depth, i))
    /** @type {_Statement} */
    const start = {
        text: flat(names.map((name, i) => [`const ${aliases[i]}=`, name, ';'])),
        names: aliases.map(alias => /** @type {const} */ ([null, alias])),
    }
    return okThen(
        /** @type {(all: _Root) => Document} */
        (all => mapOk(
            /** @type {(st: _Statement) => List<string>} */
            (st => flat([['{'], st.text, ['}']])),
        )(scope(bodyScope(a, depth, aliases, b), depth, start)(all))),
    )(scopeOperands(a, b))
}

/**
 * The scope a function's body is written in, at `depth`: no names around
 * it — a body reads the scope around it through its frame alone — its
 * frame's slot names, the parameter its arguments are written as, and
 * what its root reaches eagerly as its own to hoist.
 *
 * @type {(a: Analysis, depth: number, frame: readonly string[], b: Operand) => _Scope}
 */
const bodyScope = (a, depth, frame, b) => ({ a, outer: [], names: [], frame, param: parameter(depth), eager: eagerFrom(a)(b), shared: a.shared })

/** The scope a module is written in, over the names written so far. @type {(a: Analysis, names: _Names) => _Scope} */
const moduleScope = (a, names) => ({ a, outer: [], names, frame: [], param: '', eager: eagerFrom(a)(a.root), shared: a.shared })

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
 * where a shared constructor inside a body, a callee that takes a name,
 * and a body's anchors are all written
 * ([spec: functions](../../../spec/README.md#functions)) — and so is a body
 * that throws, `=> {throw v;}`, the statement having no expression form.
 *
 * @type {(a: Analysis, depth: number, frame: readonly string[]) => (b: Operand) => Document}
 */
const lambdaBody = (a, depth, frame) => b => {
    const s = bodyScope(a, depth, frame, b)
    return okThen(
        /** @type {(all: _Root) => Document} */
        (all => all.length === 1 && thrownValue(a, all[0]) === null && hoists(s)(all[0]).length === 0
            ? mapOk(
                /** @type {(text: List<string>) => List<string>} */
                (text => firstChunk(text).startsWith('{') ? flat([['{return '], text, [';}']]) : text),
            )(operand(s, depth)(all[0]))
            : mapOk(
                /** @type {(st: _Statement) => List<string>} */
                (st => flat([['{'], st.text, ['}']])),
            )(scope(s, depth, nothing)(all))),
    )(scopeOperands(a, b))
}

/**
 * A call's arguments, `(a,b)`: the array literal the call holds, which no
 * other edge reaches. The parser builds one for every call, so arguments
 * that are anything else, or that are shared, have no text that reads back.
 * Each argument is any value, a function included.
 *
 * @type {(s: _Scope, depth: number) => (args: Operand) => Document}
 */
const callArguments = (s, depth) => args => {
    if (!(args instanceof Array) || s.a.nodes[args[1]][0] !== '[]') { return error('call arguments that are no array literal') }
    if (s.a.shared.includes(args[1])) { return error('call arguments reached from anywhere but their call') }
    return mapOk(wrap('(')(')'))(okList(argumentItems(s.a, args).map(item(s, depth))))
}

/**
 * The items of a call's arguments where they are an array literal, and the
 * arguments themselves otherwise, for the walks that visit them without
 * visiting the array: a `const` for it would be no call's.
 *
 * @type {(a: Analysis, args: Operand) => readonly (Operand | readonly ['...', Operand])[]}
 */
const argumentItems = (a, args) => args instanceof Array && a.nodes[args[1]][0] === '[]'
    ? /** @type {Extract<Node, readonly ['[]', unknown]>} */ (a.nodes[args[1]])[1]
    : [args]

/**
 * Whether a callee takes a `const` of its own:
 *
 * - an access, which a call would read as the method call in any spelling
 *   — `a.b(c)` and `(a.b)(c)` alike — where the graph calls what the
 *   access read. A slot read is a name already.
 * - a function called with no arguments, since the front end inlines such
 *   a call of a function written where it is called — `(()=>1)()` reads
 *   back as `1` — and a name is what keeps the call a call.
 *
 * @type {(a: Analysis, callee: Operand, args: Operand) => boolean}
 */
const calleeHoisted = (a, callee, args) => {
    if (!(callee instanceof Array)) { return false }
    const node = a.nodes[callee[1]]
    return node[0] === '=>' ? argumentItems(a, args).length === 0 : node[0] === '.' && node.length === 3 && !isSlotRead(a, callee)
}

/**
 * A function's parameter list, `($a_0,$a_1,...$a)=>`: one name per fixed
 * parameter, and the rest parameter only where the body reads it — `()=>1`
 * and not `(...$a)=>1`, the two being one node, and the shorter what a
 * reader expects. The function is entry `i`, and the body's nodes are the
 * ones its scope names.
 *
 * @type {(a: Analysis, depth: number, i: number, length: number) => string}
 */
const parameterList = (a, depth, i, length) => {
    const fixed = Array.from({ length }, (_, k) => `${parameter(depth)}_${k}`)
    const rest = a.nodes.some((n, j) => n[0] === 'rest' && a.scope[j] === i) ? [`...${parameter(depth)}`] : []
    return `(${[...fixed, ...rest].join(',')})=>`
}

/**
 * The function that is entry `i`, of `length` fixed parameters, at `depth`,
 * over the names its frame's slots read as: its parameter list, then its
 * body.
 *
 * @type {(a: Analysis, depth: number, i: number, length: number, names: readonly string[]) => (body: Operand) => Document}
 */
const lambda = (a, depth, i, length, names) => body => mapOk(
    /** @type {(text: List<string>) => List<string>} */
    (text => flat([[parameterList(a, depth, i, length)], text])),
)(closureBody(a, depth, names)(body))

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
        case 'arg': case 'rest': { return ok([assertNotNullish(parameterName(s.param, node))]) }
        case '[]': { return mapOk(arrayWrap)(okList(node[1].map(item(s, depth)))) }
        case '{}': { return mapOk(objectWrap)(okList(node[1].map(property(s, depth)))) }
        case 'frame': { return error('the frame outside a slot read') }
        case '.': {
            const [, b, k, step] = node
            if (step === undefined && isFrame(s.a, b)) { return slotRead(s)(k) }
            // a method call: the one continuation a `.` takes in this
            // language, `a.b(c)`, which keeps `a` as the receiver
            if (step !== undefined && step[0] !== '|()') { return error(`a ${step[0]} step`) }
            return mapOk(
                /** @type {(parts: readonly List<string>[]) => List<string>} */
                (parts => flat(parts)),
            )(okList([base(s, depth)(b), key(step !== undefined)(k), ...(step === undefined ? [] : [callArguments(s, depth)(step[1])])]))
        }
        case '()': {
            // A callee that is an access was named by the hoisting walk,
            // since `a.b(c)` is the method call and `(a.b)(c)` is too; a
            // `const` is the one spelling that calls what the access read.
            const [, callee, args] = node
            return mapOk(
                /** @type {(parts: readonly List<string>[]) => List<string>} */
                (parts => flat(parts)),
            )(okList([base(s, depth)(callee), callArguments(s, depth)(args)]))
        }
        case '=>': {
            const [, length, frame, body] = node
            return okThen(
                /** @type {(names: readonly string[]) => Document} */
                (names => lambda(s.a, depth + 1, i, length, names)(body)),
            )(frameNames(s)(frame))
        }
        case '~': { return prefix(s, depth, '~')(node[1]) }
        case '?:': { return conditional(s, depth)(node[1], node[2], node[3]) }
        // a comma is a block's own form, read by `scopeOperands` where a
        // module's root, a function's body or a lazy operand begins;
        // anywhere else it has no source spelling until the operator lands
        case ',': { return error('a comma outside a scope') }
        // a `throw` where a scope ends is `statement`'s, the statement it
        // came from; anywhere else it is the call of a function that throws,
        // JavaScript's one spelling of an expression that fails
        case 'throw': {
            return mapOk(
                /** @type {(text: List<string>) => List<string>} */
                (text => flat([['(()=>{throw '], text, [';})()']])),
            )(operand(s, depth)(node[1]))
        }
        default: {
            const p = binaryLevels[node[0]]
            if (node.length === 3 && p !== undefined) { return binary(s, depth, node[0], p)(node[1], node[2]) }
            // `+` of one operand has no source spelling; `-` of one is the prefix
            if (node.length === 2 && node[0] === '-') { return prefix(s, depth, '-')(node[1]) }
            return error(`a ${node.length === 2 && p !== undefined ? 'unary ' : ''}${node[0]} node`)
        }
    }
}

/**
 * The values a statement has to hoist before it can be written, in the
 * order their `const`s come: every hoisted value its operand reaches that
 * this scope owns — an entry its block's root reaches eagerly, `s.eager`
 * — and the names do not hold yet, each after the hoisted values it
 * reaches itself, which is the table's own order since an entry follows
 * its operands.
 *
 * The walk enters a lazy operand, since a value it holds may be reached
 * eagerly from elsewhere in the scope, in this statement or a later one,
 * and then is the scope's to name before either; what only the operand
 * reaches is not this scope's — it is hoisted in the operand's own block
 * ({@link block}), when the operand is written.
 *
 * A body is not walked: nothing inside one is hoisted, because a `const`
 * at the module level would leave the body's scope.
 *
 * @type {(s: _Scope) => (v: Operand) => readonly number[]}
 */
const hoists = s => {
    /** @type {(i: number) => boolean} */
    const own = i => s.eager.includes(i)
    /** @type {(found: readonly number[], v: Operand) => readonly number[]} */
    const found = (names, v) => {
        /** @type {(ns: readonly number[], h: number) => readonly number[]} */
        const add = (ns, h) =>
            slotOf(visible(s), h) === null && !ns.includes(h) ? [...ns, h] : ns
        if (!(v instanceof Array)) { return names }
        const i = v[1]
        if (slotOf(visible(s), i) !== null) { return names }
        const node = s.a.nodes[i]
        // every frame element but a spread, a parameter and a slot of this
        // scope's own frame takes a `const`, after what it reaches and before
        // the function: a capture is a name, and those three have one
        const inner = frameItems(s.a, node[0] === '=>' ? node[2] : null)
            .filter(x => x instanceof Array && x[0] === '#' && !isName(s.a, /** @type {Ref} */(x)))
            .reduce((ns, x) => own(/** @type {Ref} */(x)[1]) ? add(found(ns, /** @type {Ref} */(x)), /** @type {Ref} */(x)[1]) : found(ns, /** @type {Ref} */(x)),
                [...operands(s.a)(node), ...lazyOperands(node)].reduce(found, names))
        const callee = node[0] === '()' && calleeHoisted(s.a, node[1], node[2]) && own(/** @type {Ref} */(node[1])[1]) ? add(inner, /** @type {Ref} */(node[1])[1]) : inner
        return hoistedKind(s.a, i) && s.shared.includes(i) && own(i) ? add(callee, i) : callee
    }
    return v => found([], v)
}

/**
 * The eager operands a node holds, for the hoisting walk and the module
 * writer: a container's items and a property's halves, an access's base
 * and key, a call's callee and each argument, an operator's operands, a
 * `throw`'s value, a comma's operands, a lazy operator's left operand and
 * a conditional's condition. A function's body is not among them, since
 * the walk stops at a body, and neither is its frame, which the walk reads
 * on its own, nor a call's array of arguments, which is written as the
 * call's own ({@link callArguments}).
 *
 * @type {(a: Analysis) => (node: Node) => readonly Operand[]}
 */
const operands = a => node => {
    /** @type {(items: readonly (Operand | readonly ['...', Operand])[]) => readonly Operand[]} */
    const spread = items => items.flatMap(x => x instanceof Array && x[0] === '...' ? [x[1]] : [/** @type {Operand} */(x)])
    switch (node[0]) {
        case '[]': { return spread(node[1]) }
        case '{}': { return node[1].flatMap(p => p[0] === '...' ? [p[1]] : [p[1], p[2]]) }
        case '.': { return [node[1], node[2], ...(node.length === 3 || node[3][0] !== '|()' ? [] : spread(argumentItems(a, node[3][1])))] }
        case '()': { return [node[1], ...spread(argumentItems(a, node[2]))] }
        case ',': { return node[1] }
        case '&&': case '||': case '??': case '?:': { return [node[1]] }
        case '=>': case 'undefined': case 'arg': case 'rest': case 'frame': case 'args': case '?.': case '?.()': { return [] }
        default: { return /** @type {readonly Operand[]} */ (node.slice(1)) }
    }
}

/**
 * The operands a node establishes only when it decides to — the right
 * operand of `&&`, `||` and `??`, the arms of `?:` — each a block root.
 *
 * @type {(node: Node) => readonly Operand[]}
 */
const lazyOperands = node => {
    switch (node[0]) {
        case '&&': case '||': case '??': { return [node[2]] }
        case '?:': { return [node[2], node[3]] }
        default: { return [] }
    }
}

/**
 * Every operand a node holds in its own scope, eager or lazy, the operands
 * this writer has no spelling for included, so that a reach over the graph
 * is the graph's and not the spelling's: a function's frame, and not its
 * body, which is a scope of its own.
 *
 * @type {(node: Node) => readonly Operand[]}
 */
const allOperands = node => {
    switch (node[0]) {
        case '=>': { return node[2] === null ? [] : [node[2]] }
        case '[]': { return node[1].flatMap(x => x instanceof Array && x[0] === '...' ? [x[1]] : [/** @type {Operand} */(x)]) }
        case '{}': { return node[1].flatMap(p => p[0] === '...' ? [p[1]] : [p[1], p[2]]) }
        case ',': { return node[1] }
        case '.': { return [node[1], node[2], ...(node.length === 3 ? [] : refs(node[3].slice(1)))] }
        default: { return refs(node.slice(1)) }
    }
}

/** The entries among a node's fields, which leaves out its primitives and its tags. @type {(fields: readonly unknown[]) => readonly Operand[]} */
const refs = fields => /** @type {readonly Operand[]} */ (fields.filter(x => x instanceof Array && x[0] === '#'))

/** The eager operands among {@link allOperands}: all but the lazy ones. @type {(node: Node) => readonly Operand[]} */
const eagerOperands = node => allOperands(node).filter(x => !lazyOperands(node).includes(x))

/**
 * The entries a block root reaches eagerly, in walk order: through eager
 * positions alone, never through a lazy operand, and never into a function
 * body. What a scope's statements may hoist, since a `const` there
 * establishes exactly these.
 *
 * @type {(a: Analysis) => (root: Operand) => readonly number[]}
 */
const eagerFrom = a => root => {
    /** @type {(seen: readonly number[], v: Operand) => readonly number[]} */
    const reach = (seen, v) => v instanceof Array && !seen.includes(v[1])
        ? eagerOperands(a.nodes[v[1]]).reduce(reach, [...seen, v[1]])
        : seen
    return reach([], root)
}

/**
 * The entries an operand reaches through any edge in its own scope, in
 * walk order.
 *
 * @type {(a: Analysis) => (root: Operand) => readonly number[]}
 */
const reachableFrom = a => root => {
    /** @type {(seen: readonly number[], v: Operand) => readonly number[]} */
    const reach = (seen, v) => v instanceof Array && !seen.includes(v[1])
        ? allOperands(a.nodes[v[1]]).reduce(reach, [...seen, v[1]])
        : seen
    return reach([], root)
}

/**
 * How many places under `root`, in its own scope, hold the entry `i` —
 * the root's own place where it is `i`, and every edge into it under the
 * root, eager or lazy, counted once per place.
 *
 * @type {(a: Analysis, root: Operand, i: number) => number}
 */
const referencesWithin = (a, root, i) => {
    /** @type {(state: readonly [readonly number[], number], v: Operand) => readonly [readonly number[], number]} */
    const count = ([seen, n], v) => {
        if (!(v instanceof Array) || seen.includes(v[1])) { return [seen, n] }
        const held = allOperands(a.nodes[v[1]])
        return held.reduce(count, [[...seen, v[1]], n + held.filter(x => x instanceof Array && x[1] === i).length])
    }
    return count([[], root instanceof Array && root[1] === i ? 1 : 0], root)[1]
}

/**
 * The entries written at more than one place under an operand, the operand
 * itself written once: reached by more than one edge, or through an entry
 * itself written at more than one place — the analysis's own rule for
 * `shared`, over the operand's subgraph alone, since a block's root is
 * written once whatever holds it: the sharing the scope around the block
 * counts through the node holding the operand is that node's, kept in a
 * `const` there ({@link hoistedKind}), and is not counted again inside.
 *
 * Each entry is met after every entry holding it, an entry following its
 * operands in the table, so its count is final by the time its own
 * operands are counted through it.
 *
 * @type {(a: Analysis) => (root: Operand) => readonly number[]}
 */
const sharedWithin = a => root => {
    if (!(root instanceof Array)) { return [] }
    /** @type {(counts: readonly (readonly [number, number])[], i: number, n: number) => readonly (readonly [number, number])[]} */
    const bump = (counts, i, n) => counts.some(([j]) => j === i)
        ? counts.map(([j, m]) => /** @type {readonly [number, number]} */ ([j, j === i ? m + n : m]))
        : [...counts, /** @type {readonly [number, number]} */ ([i, n])]
    const counts = reachableFrom(a)(root).toSorted((x, y) => y - x).reduce(
        /** @type {(counts: readonly (readonly [number, number])[], p: number) => readonly (readonly [number, number])[]} */
        ((counts, p) => {
            // every entry but the root was counted through the entry
            // holding it before this, so a missing count is this walk's
            // own mistake
            const places = assertNotNullish(counts.find(([j]) => j === p), ['an entry reached before what holds it', p])[1]
            return allOperands(a.nodes[p]).reduce((cs, c) => c instanceof Array ? bump(cs, c[1], places) : cs, counts)
        }),
        [[root[1], 1]])
    return counts.filter(([, n]) => n >= 2).map(([i]) => i)
}

/**
 * How many places in the whole table hold the entry `i` as an operand. The
 * root's own place is not among them, and need not be: what is asked
 * about is a value under a lazy operand ({@link block}), which the root
 * never is.
 *
 * @type {(a: Analysis, i: number) => number}
 */
const references = (a, i) => a.nodes.flatMap(allOperands).filter(x => x instanceof Array && x[1] === i).length

/**
 * One statement and every `const` it needed first: the hoists, in order,
 * then the operand itself — an anchor as a `const` of its own, and the last
 * operand as the export or the `return` — or, where that operand is a
 * `throw` node, as the `throw` statement it came from, the value after the
 * keyword ([spec: functions](../../../spec/README.md#functions)).
 *
 * An anchor that is itself a value the statement's own hoists named — a
 * shared constructor the scope reaches only lazily, `const c = [];
 * export default [a && c, b && c];` — is that `const`, which the front end
 * reads back as anchored exactly because no other operand of the comma
 * reaches it eagerly, `elsewhere`, so the statement writes nothing more.
 * Where one does, the `const` reads back as reached and the anchor is
 * lost, so the anchor is refused, as one whose operand had a name already
 * is, and one that is a name of the scope's own — the arguments, a
 * parameter, a slot of the frame. Its statement would be a bare alias,
 * `const $1=$0;`, which the front end reads back as nothing at all — an
 * alias is the node it names, not an anchored computation — and the comma
 * would be lost with it. Linking emits no such graph: it anchors nothing
 * another operand establishes, and drops the alias where the source
 * writes one.
 *
 * An anchor's `const` names its node for the statements after it where no
 * other operand reaches the node eagerly: a later read of it is lazy then,
 * a function's capture under a lazy operand among them, so the front end
 * still reads the `const` back as the anchor, and the node is not written
 * a second time — `const $a0=$a[0]+1;return true?()=>$a0:1;`, where a
 * second `const` would read back as a second anchor. A node another
 * operand reaches eagerly is written where it is read, as the graph
 * establishes it there.
 *
 * @type {(s0: _Scope, depth: number, last: boolean, elsewhere: readonly number[]) => (before: _Statement, v: Operand) => Result<_Statement, string>}
 */
const statement = (s0, depth, last, elsewhere) => ({ text, names }, v) => {
    /** @type {(acc: Result<_Statement, string>, h: number) => Result<_Statement, string>} */
    const emit = (acc, h) => {
        if (acc[0] === 'error') { return acc }
        const before = acc[1]
        const s = { ...s0, names: before.names }
        return mapOk(
            /** @type {(value: List<string>) => _Statement} */
            (value => ({
                text: flat([before.text, [`const ${hoistName(depth, before.names.length)}=`], value, [';']]),
                names: [...before.names, [h, hoistName(depth, before.names.length)]],
            })),
        )(entry(s, depth)(h))
    }
    const namedBefore = v instanceof Array && slotOf(visible({ ...s0, names }), v[1]) !== null
    const hoisted = hoists({ ...s0, names })(v).reduce(emit, ok({ text, names }))
    if (hoisted[0] === 'error') { return hoisted }
    const before = hoisted[1]
    const s = { ...s0, names: before.names }
    if (!last && v instanceof Array && slotOf(visible(s), v[1]) !== null) {
        return namedBefore || elsewhere.includes(v[1]) ? error('an anchor that repeats a hoisted value') : ok(before)
    }
    if (!last && isName(s.a, v)) { return error('an anchor that is a name') }
    const thrown = last ? thrownValue(s.a, v) : null
    const lead = thrown !== null ? 'throw ' : last ? (depth === 0 ? 'export default ' : 'return ') : `const ${hoistName(depth, before.names.length)}=`
    const written = thrown === null ? v : thrown[0]
    return mapOk(
        /** @type {(value: List<string>) => _Statement} */
        (value => ({
            text: flat([before.text, [lead], value, [';']]),
            names: last ? before.names : [...before.names, [v instanceof Array && !elsewhere.includes(v[1]) ? v[1] : null, hoistName(depth, before.names.length)]],
        })),
    )(operand(s, depth)(written))
}

/**
 * The statements of one scope: each operand preceded by the `const`s it
 * needs, an anchor as a `const` of its own, and the last operand introduced
 * by what the scope returns with — `export default ` for a module, `return `
 * for a function body.
 *
 * The names start empty, a scope's `const`s being its own: a body reads a
 * name the scope around it bound through its frame alone, `frame` naming
 * each slot.
 *
 * `start` is what the scope has written before them: nothing, or a body's
 * aliases of its frame ({@link aliasedBody}). Each statement is told what
 * the other operands reach eagerly, which decides whether an anchor that
 * is a shared value survives reading back ({@link statement}).
 *
 * @type {(s: _Scope, depth: number, start: _Statement) => (all: _Root) => Result<_Statement, string>}
 */
const scope = (s, depth, start) => all => {
    /** @type {(acc: Result<_Statement, string>, v: Operand, i: number) => Result<_Statement, string>} */
    const step = (acc, v, i) => acc[0] === 'error'
        ? acc
        : statement(s, depth, i === all.length - 1, all.flatMap((w, j) => j === i ? [] : eagerFrom(s.a)(w)))(acc[1], v)
    return all.reduce(step, ok(start))
}

/** A scope that has written nothing yet. @type {_Statement} */
const nothing = { text: null, names: [] }

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
    const problem = bindingError(a)
    if (problem !== null) { return error(problem) }
    return okThen(
        /** @type {(all: _Root) => Document} */
        (all => mapOk(
            /** @type {(s: _Statement) => List<string>} */
            (s => s.text),
        )(scope(moduleScope(a, []), 0, nothing)(all))),
    )(scopeOperands(a, a.root))
}

/** The same as one string. @type {(e: Exp) => Result<string, string>} */
export const tryStringify = e => mapOk(
    /** @type {(text: List<string>) => string} */
    (text => toArray(text).join('')),
)(trySerialize(e))

/**
 * How many slots a function's frame has, for its text: none for a `null`
 * frame, and an array literal's items otherwise. What the slots hold is not
 * the text's: a slot is written as a name.
 *
 * @type {(frame: Exp) => Result<number, string>}
 */
const slotCount = frame => {
    if (frame === null) { return ok(0) }
    if (!(frame instanceof Array) || frame[0] !== '[]') { return error('a frame that is not an array literal') }
    return frame[1].some(x => x instanceof Array && x[0] === '...') ? error('a spread') : ok(frame[1].length)
}

/**
 * A function's text: the function node written as one expression — what
 * `String(f)` answers for a function the compiler built, and the one
 * spelling every executor shares
 * ([spec: function source](../../../spec/README.md#function-source-representation-exception)).
 *
 * ```js
 * ()=>1
 * ($a_0,...$a)=>$a_0+$a.length
 * ()=>{const $a0=[];return [$a0,$a0];}
 * ```
 *
 * The text is the code's, not the value's: a captured value is written as
 * the name of its slot, `$0`, `$1`, …, so every function one arrow makes has
 * one text, as it has in JavaScript — `make(0)` and `make(1)` alike, for
 * `const make = x => () => [x];` read as `()=>[$0]`. That answers the
 * serialization spec's question 2 as code-only
 * ([`spec/todo/serialization.md`](../../../spec/todo/serialization.md#open-questions));
 * rendering the captured values instead is a text for the same node with
 * each name replaced, which this spelling leaves room for.
 *
 * A primitive the source captured is no slot: the lowering wrote it into
 * the body, so `const x = 3; const f = () => x;` is `()=>3`.
 *
 * Refused where the writer refuses the body, and for a node that is no
 * function, or whose frame is no array literal.
 *
 * @type {(e: Exp) => Result<string, string>}
 */
export const tryFunctionText = e => {
    if (!(e instanceof Array) || e[0] !== '=>') { return error('not a function') }
    const [, length, frame, body] = e
    return okThen(
        /** @type {(slots: number) => Result<string, string>} */
        (slots => {
            const a = analysis(['=>', length, null, body])
            const problem = bindingError(a)
            if (problem !== null) { return error(problem) }
            const i = /** @type {Ref} */ (a.root)[1]
            const node = /** @type {Extract<Node, readonly ['=>', number, Operand, Operand]>} */ (a.nodes[i])
            return mapOk(
                /** @type {(text: List<string>) => string} */
                (text => toArray(text).join('')),
            )(lambda(a, 1, i, length, Array.from({ length: slots }, (_, k) => `$${k}`))(node[3]))
        }),
    )(slotCount(frame))
}

/** A generated-name prefix that cannot collide with any exported binding. @type {(keys: readonly string[], prefix: string) => string} */
const modulePrefix = (keys, prefix) => keys.some(key => key.startsWith(prefix)) ? modulePrefix(keys, `${prefix}$`) : prefix

/** Emit one named value using the same expression writer as value output. @type {(a: Analysis, prefix: string, h: number) => (before: _Statement) => Result<_Statement, string>} */
const moduleBinding = (a, prefix, h) => before => {
    const name = `${prefix}${before.names.length}`
    return mapOk(
        /** @type {(text: List<string>) => _Statement} */
        (text => ({ text: flat([before.text, [`const ${name}=`], text, [';']]), names: [...before.names, [h, name]] })),
    )(entry(moduleScope(a, before.names), 0)(h))
}

/**
 * Evaluate a module operand in graph order and name it once. Commas become
 * ordered declarations and an alias of their last operand. Function bodies
 * stay in the existing scope writer; no value is hoisted out of a function.
 *
 * @type {(a: Analysis, prefix: string) => (before: _Statement, v: Operand) => Result<_Statement, string>}
 */
const moduleOperand = (a, prefix) => (before, v) => {
    if (!(v instanceof Array) || slotOf(before.names, v[1]) !== null) { return ok(before) }
    const node = a.nodes[v[1]]
    if (node[0] === ',' && node[1].length < 2) { return error('a comma with fewer than two operands') }
    const children = operands(a)(node).reduce(
        /** @type {(acc: Result<_Statement, string>, child: Operand) => Result<_Statement, string>} */
        ((acc, child) => okThen(state => moduleOperand(a, prefix)(state, child))(acc)), ok(before))
    return okThen(state => {
        if (node[0] === ',') {
            const last = node[1][node[1].length - 1]
            const name = `${prefix}${state.names.length}`
            return mapOk(
                /** @type {(text: List<string>) => _Statement} */
                (text => ({ text: flat([state.text, [`const ${name}=`], text, [';']]), names: [...state.names, [v[1], name]] })),
            )(operand(moduleScope(a, state.names), 0)(last))
        }
        const prepared = hoists(moduleScope(a, state.names))(v).reduce(
            /** @type {(acc: Result<_Statement, string>, h: number) => Result<_Statement, string>} */
            ((acc, h) => okThen(moduleBinding(a, prefix, h))(acc)), ok(state))
        return okThen(ready => slotOf(ready.names, v[1]) !== null
            ? ok(ready)
            : moduleBinding(a, prefix, v[1])(ready))(prepared)
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
)(operand(moduleScope(a, state.names), 0)(v))

/**
 * A module export object as source, preserving export names and declaration
 * evaluation. The compact value writer keeps default-only DataJS fixed points;
 * the module walk also handles dependencies whose selected export retains an
 * internal evaluation sequence.
 *
 * @type {(e: Exp) => Document}
 */
export const tryModuleSerialize = e => {
    // a module that throws exports nothing: its computation is the one
    // statement the value writer spells, `throw v;`, in place of the exports
    if (_moduleThrows(e)) { return trySerialize(e) }
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
    const problem = bindingError(a)
    if (problem !== null) { return error(problem) }
    const exports = exportOperands(a, a.root)
    const prefix = modulePrefix(keys, '$')
    return okThen(state => mapOk(
        /** @type {(parts: readonly List<string>[]) => List<string>} */
        (parts => flat([state.text, ...parts])),
    )(okList([
        ...exports.filter(([, key]) => key !== 'default'),
        ...exports.filter(([, key]) => key === 'default'),
    ].map(moduleExport(a, state)))))(moduleBody(a, prefix)({ text: null, names: [] }, a.root))
}

/** The module source as one string. @type {(e: Exp) => Result<string, string>} */
export const tryModuleStringify = e => mapOk(
    /** @type {(text: List<string>) => string} */
    (text => toArray(text).join('')),
)(tryModuleSerialize(e))
