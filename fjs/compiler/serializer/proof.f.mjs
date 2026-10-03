/**
 * The FunctionalScript writer, claim by claim.
 *
 * Every graph that has a spelling is checked twice: the text itself, so the
 * output is pinned rather than merely round-tripping, and the graph the
 * front end reads back out of that text, so the output is FunctionalScript
 * and not only a string. The second check goes through `parse` and
 * `unresolved`, the front end's own two halves, which is what makes it the
 * compiler's answer rather than a second writer's; the graphs are compared
 * as their tables, since that is what a round trip preserves — the names and
 * the places a value is written are the writer's to choose.
 *
 * A refusal is checked by its message, since a message is what a user of the
 * compiler meets, and every one of them names a feature that will replace it.
 *
 * @import { Exp } from '../../edag/types.ts'
 */

import { assert, assertEq, assertStructurallySame } from '../../asserts/module.f.mjs'
import { _sourceOf, demo } from './demo.f.mjs'
import { examples } from '../examples/module.f.mjs'
import { htmlToString } from '../../media/html/module.f.mjs'
import { memo } from '../../edag/memo/module.f.mjs'
import { analysis } from '../../edag/analysis/module.f.mjs'
import { toArray } from '../../types/list/module.f.mjs'
import { invert, unwrap } from '../../types/result/module.f.mjs'
import { _defaultExport, unresolved } from '../edag/module.f.mjs'
import { parse } from '../transpiler/module.f.mjs'
import { tryFunctionText, trySerialize, tryStringify, tryModuleSerialize, tryModuleStringify } from './module.f.mjs'
import { keywords } from '../../js/keywords/module.f.mjs'

/** The name the front end gives the text it reads back. */
const path = '/proof.f.js'

/**
 * The text the writer writes for a graph, once the front end has read it
 * back to the same table. A module of the writer's own making imports
 * nothing, so `unresolved` needs no resolution to hand back its graph.
 *
 * @type {(e: Exp) => string}
 */
const reads = e => {
    const text = unwrap(tryStringify(e))
    const { imports, edag } = unresolved(unwrap(parse(path)(text)))
    assertEq(imports.length, 0, text)
    assertStructurallySame(analysis(_defaultExport(edag)), analysis(e), text)
    return text
}

/** That, and the text. @type {(e: Exp, expected: string) => void} */
const writes = (e, expected) => { assertEq(reads(e), expected) }

/** Why the writer has no spelling for a graph, with nothing written. @type {(e: Exp, expected: string) => void} */
const refuses = (e, expected) => { assertEq(unwrap(invert(tryStringify(e))), expected) }

/** `(...a) => ... => a`, `n` bodies deep. @type {(n: number) => Exp} */
const nested = n => n === 0 ? ['rest'] : ['=>', 0, [], nested(n - 1)]

/** `(...a) => a`, the graph a spelling is wanted for rather than read from. @type {Exp} */
const identity = ['=>', 0, [], ['rest']]

/**
 * The keys a generated access is given: a word that follows `.`, a number,
 * the one prototype name an access may read, one it may not, a word that
 * denotes a value, and a letter that is no letter.
 *
 * @type {readonly (string | number)[]}
 */
const keys = ['a', 0, 'length', 'constructor', 'true', '\u212a']

/** Every array rebuilt, every leaf as it stands. @type {(x: unknown) => unknown} */
const deep = x => x instanceof Array ? x.map(deep) : x

/** A structural copy: the same graph, sharing no node with the original. @type {(e: Exp) => Exp} */
const copy = e => /** @type {Exp} */ (deep(e))

/**
 * One graph per shape over the graphs `p`: each container, an access with
 * each key, a function body, a node shared twice, each side of a root
 * comma, a root comma whose two sides are one node, a root comma with one
 * operand, the same graph twice over in two scopes, a function that
 * captures the graph beside it, and the lazy operators: the graph as both
 * operands of `&&`, as the lazy operand of `??`, shared under one arm of a
 * conditional, as the condition and both arms of one, anchored by a comma
 * under the lazy operand of `||`, under one access both arms of a
 * conditional read, and once in an array of each arm's own; and Stage
 * A's: as both operands of a binary minus, whose right operand takes
 * parentheses at its own level and a space before a `-`; as both
 * operands of `**`, whose left one takes them; under `~` through `+`; and
 * as a base under `*`; and under both call forms, a call of a method call.
 *
 * That last one is a copy and not the node again: two nodes, one in a body
 * and one outside it, which is a graph the compiler emits — and which the
 * writer has to spell so that reading it back gives two nodes again, since
 * one node in two scopes is no EDAG and the analysis refuses it.
 *
 * A shared node is duplicated within one container, never across a `=>`, so
 * a later shape that wraps it in a body takes both occurrences with it —
 * the EDAG's scope rule is about a node reached from two scopes, and these
 * graphs never build one.
 *
 * @type {(p: readonly Exp[]) => readonly Exp[]}
 */
const shapes = p => [
    ...p.map(x => /** @type {Exp} */(['[]', [x]])),
    ...p.map(x => /** @type {Exp} */(['{}', [[':', 'k', x]]])),
    ...p.flatMap(x => keys.map(k => /** @type {Exp} */(['.', x, k]))),
    ...p.map(x => /** @type {Exp} */(['=>', 0, [], x])),
    ...p.map(x => /** @type {Exp} */(['[]', [x, x]])),
    ...p.map(x => /** @type {Exp} */([',', [x, 1]])),
    ...p.map(x => /** @type {Exp} */([',', [['[]', []], x]])),
    ...p.map(x => /** @type {Exp} */([',', [x, x]])),
    ...p.map(x => /** @type {Exp} */([',', [x]])),
    ...p.map(x => /** @type {Exp} */(['[]', [x, ['=>', 0, [], copy(x)]]])),
    ...p.map(x => /** @type {Exp} */(['[]', [x, ['=>', 0, [x], ['frame', 0]]]])),
    ...p.map(x => /** @type {Exp} */(['&&', x, x])),
    ...p.map(x => /** @type {Exp} */(['??', ['[]', []], x])),
    ...p.map(x => /** @type {Exp} */(['?:', true, ['[]', [x, x]], 2])),
    ...p.map(x => /** @type {Exp} */(['?:', x, ['-', ['[]', [x]]], x])),
    ...p.map(x => /** @type {Exp} */(['||', 1, [',', [x, 2]]])),
    ...p.map(x => /** @type {Exp} */(['?:', true, ['.', x, 'k'], ['.', x, 'k']])),
    ...p.map(x => /** @type {Exp} */(['?:', true, ['[]', [x]], ['[]', [x]]])),
    ...p.map(x => /** @type {Exp} */(['-', x, x])),
    ...p.map(x => /** @type {Exp} */(['**', x, x])),
    ...p.map(x => /** @type {Exp} */(['~', ['+', x, 1]])),
    ...p.map(x => /** @type {Exp} */(['.', ['*', x, x], 'k'])),
    ...p.map(x => /** @type {Exp} */(['()', ['.', x, 'm', ['|()', [x]]], [x]])),
]

/**
 * Every leaf, a negative number among them, the arguments, both empty
 * containers, `undefined`, and a negation — the prefix, whose operand
 * binds tighter than it does, so every shape below has to say where the
 * negation happens, and whose text opens with `-`, which `**` refuses on
 * its left and a binary `-` cannot touch.
 *
 * @type {readonly Exp[]}
 */
const atoms = [1, -1, 'a', null, true, 1n, ['rest'], ['[]', []], ['{}', []], ['undefined'], ['-', ['[]', []]]]

/** How many tests {@link proof}'s `law` is split into. */
const lawParts = 8

/** The atoms and two rounds of shapes over them. @type {readonly Exp[]} */
const generated = (() => {
    const one = shapes(atoms)
    return [...atoms, ...one, ...shapes(one)]
})()

/** @type {(source: string) => Exp} */
const moduleGraph = source => unresolved(unwrap(parse(path)(source))).edag

/** @type {(graph: Exp) => unknown} */
const moduleValue = graph => memo(analysis(graph))({ frame: null, args: [] })

export const proof = {
    namedExports: {
        roundTrip: () => {
            for (const source of [
                'export const a=5;',
                'const unused=[2]; export const z=[1]; export const a=z;',
                'const base=[1]; export const z=base; export const a=[z,z]; export default a;',
                'export const z=1; const local=[z]; export const a=local; export default z;',
                'export const __proto__=7; export const constructor=8;',
                'export const $0=[]; export const $$0=$0; export default $$0;',
                'export const a=undefined; export default undefined;',
                'export const a=(1).x; export const b=-1;',
            ]) {
                const graph = moduleGraph(source)
                const text = unwrap(tryModuleStringify(graph))
                const result = moduleValue(moduleGraph(text))
                assertStructurallySame(result, moduleValue(graph), text)
            }
            const output = unwrap(tryModuleStringify(moduleGraph('export const z=[]; export const a=z; export default a;')))
            assertEq(output, 'const $0=[];export const a=$0;export const z=$0;export default $0;')
            const result = /** @type {{ a: unknown, z: unknown, default: unknown }} */ (moduleValue(moduleGraph(output)))
            assert(result.a === result.z && result.a === result.default)
            assertStructurallySame(Object.keys(result), ['a', 'default', 'z'])
            assertEq(unwrap(tryModuleStringify(moduleGraph('export default 7;'))), 'export default 7;')
        },
        functions: () => {
            const text = unwrap(tryModuleStringify(moduleGraph('export const f=(...a)=>a; export default f;')))
            const result = /** @type {{ f: (...args: unknown[]) => unknown, default: unknown }} */ (moduleValue(moduleGraph(text)))
            assert(result.f === result.default)
            assertStructurallySame(result.f(1, 2), [1, 2])
        },
        refusals: () => {
            for (const graph of /** @type {readonly Exp[]} */ ([
                ['{}', []],
                ['{}', [[':', 'a', 1], [':', 'a', 2]]],
                ['{}', [[':', 'then', 1]]],
                ['{}', [[':', 'if', 1]]],
                ['{}', [[':', 'NaN', 1]]],
                ['{}', [[':', 'not-a-name', 1]]],
                ['{}', [[':', 'a', ['{}', [['...', 1]]]]]],
                ['{}', [[':', 'a', [',', [1]]]]],
                ['{}', [[':', 'a', ['+', 1]], [':', 'b', 1]]],
                ['{}', [[':', 'a', ['.', 1, 'constructor']]]],
                ['{}', [[':', 'a', ['=>', 0, [7], ['frame', 0]]]]],
                ['{}', [[':', 'default', ['{}', [['...', 1]]]]]],
            ])) { assertEq(tryModuleSerialize(graph)[0], 'error') }
        },
    },
    // A module is one line and one statement when nothing is shared: the
    // export, its value spelled where it stands. The leaves are the DataJS
    // serializer's, this writer owning none of their spelling.
    leaves: () => {
        writes(1, 'export default 1;')
        writes('x', 'export default "x";')
        writes(['undefined'], 'export default undefined;')
        writes(['[]', []], 'export default [];')
        writes(['{}', []], 'export default {};')
        writes(
            ['[]', [null, true, false, 1, 1.5, 1n, 'a"b', '\u{1f600}']],
            'export default [null,true,false,1,1.5,1n,"a\\"b","\u{1f600}"];')
        writes(['{}', [[':', 'a', 1], [':', 'b', 2], [':', '', 3]]], 'export default {"a":1,"b":2,"":3};')
        // an array's spread, `...` before its operand, which is any value an
        // item is: a conditional or a function as it stands, ungrouped
        writes(['[]', [1, ['...', ['[]', [2]]], ['...', 'ab']]], 'export default [1,...[2],..."ab"];')
        writes(['[]', [['...', ['?:', true, ['[]', []], 'a']]]], 'export default [...true?[]:"a"];')
        writes(['[]', [['...', ['=>', 0, [], 1]]]], 'export default [...()=>1];')
    },
    // The prefix `-`. It binds looser than a step, so a negation under an
    // access is a base only in a group — `-1[0]` is `-(1[0])` — and a
    // negated function is no `UnaryExpression`, so it stands in a group
    // too. `op12` of two operands is the binary minus, `operators` below.
    neg: () => {
        writes(['-', ['[]', [1]]], 'export default -[1];')
        writes(['-', 'a'], 'export default -"a";')
        // `- -1` and not `--1`, which is the decrement token. The operand
        // here is a container, since a negated *literal* has no text
        writes(['-', ['-', ['[]', []]]], 'export default - -[];')
        // the negation is inside the access, which is where the text puts it
        writes(['-', ['.', ['[]', [1]], 0]], 'export default -[1][0];')
        // and outside it only in a group
        writes(['.', ['-', ['[]', []]], 0], 'export default (-[])[0];')
        writes(['.', ['-', ['[]', []]], 'a'], 'export default (-[]).a;')
        // a negated function likewise
        writes(['-', ['=>', 0, [], 1]], 'export default -(()=>1);')
        writes(['-', 1, 2], 'export default 1-2;')
        // `-1()` is `-(1())`, so a negative callee says that the negation
        // happens first as an access base does: a negative leaf is a number,
        // which takes a `const`, and a `['-', …]` node is grouped
        writes(['()', -1, []], 'const $0=-1;export default $0();')
        writes(['()', ['-', ['[]', []]], []], 'export default (-[])();')
    },
    /**
     * A negative number is a leaf — a JSON input gives one — and the
     * language's only spelling for it is the prefix, which the lowering
     * folds back into the leaf. So the text reads back as the graph it was
     * written from.
     */
    negativeLeaves: () => {
        writes(['[]', [-0, -1.5, -1n]], 'export default [-0,-1.5,-1n];')
    },

    /**
     * What {@link writes} means by "reads back as the same graph": the same
     * graph *as the lowering makes of it*. Reading a text is parsing and
     * lowering, and the lowering folds — a negated numeric literal is the
     * number — so a text read back is always in the form the lowering
     * produces.
     *
     * For every graph the compiler emits that is the graph itself, since
     * the compiler's graphs come out of that same lowering. A graph built
     * by hand need not be: `['-', 1]` is a fine EDAG, worth `-1`, and its
     * text reads back as the leaf `-1` — the same value, and the form the
     * fold gives it.
     *
     * Refusing it was considered and is wrong. The writer has a faithful
     * text for the *value*, and the node count differs only because the
     * reading normalizes. Tying a refusal to what the folder happens to do
     * would also grow one per fold: `['+', 1, 2]` would want the same
     * treatment the moment that fold lands, and so would every constant
     * expression after it.
     */
    readsBackNormalized: () => {
        assertEq(unwrap(tryStringify(['-', 1])), 'export default -1;')
        const { edag } = unresolved(unwrap(parse(path)('export default -1;')))
        assertStructurallySame(edag, ['{}', [[':', 'default', -1]]])
        // and one deeper, where the fold runs twice
        assertEq(unwrap(tryStringify(['-', ['-', 1]])), 'export default - -1;')
        assertStructurallySame(unresolved(unwrap(parse(path)('export default - -1;'))).edag, ['{}', [[':', 'default', 1]]])
        // and under a binary operator, where the fold reaches the operand
        // alone: `['-', 0]` is the leaf `-0` once read, the operator over it
        // as written
        assertEq(unwrap(tryStringify(['-', 1, ['-', 0]])), 'export default 1- -0;')
        assertStructurallySame(unresolved(unwrap(parse(path)('export default 1- -0;'))).edag, ['{}', [[':', 'default', ['-', 1, -0]]]])
    },
    // A node that mints identity is one value however many edges reach it,
    // and a `const` is the only thing in text that keeps that, so a shared
    // one is hoisted and written once. An unshared one is written where it
    // stands, every occurrence its own value.
    identity: () => {
        /** @type {Exp} */
        const o = ['{}', []]
        writes(['[]', [o, o]], 'const $0={};export default [$0,$0];')
        writes(['[]', [['{}', []], ['{}', []]]], 'export default [{},{}];')
        writes(['[]', [identity, identity]], 'const $0=(...$a)=>$a;export default [$0,$0];')
    },
    // An access is not hoisted, though the analysis merged its occurrences:
    // the merge happens again when the output is read, and a `const` would
    // evaluate it where the source did not.
    merged: () => {
        /** @type {Exp} */
        const o = ['{}', [[':', 'a', 1]]]
        writes(['[]', [['.', o, 'a'], ['.', o, 'a']]], 'const $0={"a":1};export default [$0.a,$0.a];')
    },
    // A base the grammar takes no access on — a number, a bigint, a function
    // — gets a `const` of its own, since `1.x` is no spelling of `['.', 1,
    // 'x']`. A container base is written in place, where `{}.a` is a
    // spelling the parser reads back.
    bases: () => {
        writes(['.', 1, 'x'], 'const $0=1;export default $0.x;')
        writes(['.', 1n, 'x'], 'const $0=1n;export default $0.x;')
        writes(['.', identity, 'length'], 'const $0=(...$a)=>$a;export default $0.length;')
        writes(['.', ['{}', [[':', 'a', 1]]], 'a'], 'export default {"a":1}.a;')
        writes(['.', ['[]', [1, 2]], 0], 'export default [1,2][0];')
        // One `const` per base, and one only: two accesses on one base share
        // it, two bases do not, and a base named by an earlier statement is
        // not named again.
        writes(['[]', [['.', 1, 'x'], ['.', 1, 'y']]], 'const $0=1;export default [$0.x,$0.y];')
        writes(['[]', [['.', 1, 'x'], ['.', 2, 'y']]], 'const $0=1;const $1=2;export default [$0.x,$1.y];')
        writes([',', [['.', 1, 'x'], ['.', 1, 'y']]], 'const $0=1;const $1=$0.x;export default $0.y;')
    },
    // A key is a name after `.` where the word admits one, and a key in
    // brackets otherwise: the empty word, a word a digit opens, a word
    // holding what an identifier may not, and every number.
    keys: () => {
        writes(['=>', 0, [], ['.', ['rest'], 'length']], 'export default (...$a)=>$a.length;')
        writes(['=>', 0, [], ['.', ['rest'], 'A_$9']], 'export default (...$a)=>$a.A_$9;')
        writes(['=>', 0, [], ['.', ['rest'], '']], 'export default (...$a)=>$a[""];')
        writes(['=>', 0, [], ['.', ['rest'], '0a']], 'export default (...$a)=>$a["0a"];')
        writes(['=>', 0, [], ['.', ['rest'], 'a-b']], 'export default (...$a)=>$a["a-b"];')
        // a word that denotes a value names a property like any other
        writes(['=>', 0, [], ['.', ['rest'], 'NaN']], 'export default (...$a)=>$a.NaN;')
        writes(['=>', 0, [], ['.', ['rest'], '_x']], 'export default (...$a)=>$a._x;')
        writes(['=>', 0, [], ['.', ['rest'], '$x']], 'export default (...$a)=>$a.$x;')
        // The Kelvin sign lowercases to `k` and is no letter the tokenizer
        // takes, so a key holding one is a key in brackets. The characters
        // are classified by code point for that reason, never by case fold.
        writes(['=>', 0, [], ['.', ['rest'], '\u212a']], 'export default (...$a)=>$a["\u212a"];')
        writes(['=>', 0, [], ['.', ['rest'], 0]], 'export default (...$a)=>$a[0];')
        writes(['=>', 0, [], ['.', ['rest'], 1.5]], 'export default (...$a)=>$a[1.5];')
    },
    // Every keyword is a name after `.`, the six words that denote a value
    // included: a property is named by an `IdentifierName` in JavaScript,
    // and the grammar follows. So the writer has no rule about them — this
    // is the case that would fail if one were needed again, over every
    // keyword rather than over a list someone remembered to update.
    keywords: () => {
        keywords.forEach(k => {
            const written = tryStringify(['=>', 0, [], ['.', ['rest'], k]])
            // `arguments` and `with` are on the prototypes, and an access on
            // either has no text at all.
            if (written[0] === 'error') {
                assertEq(written[1], 'a prohibited property name', k)
                return
            }
            assertEq(reads(['=>', 0, [], ['.', ['rest'], k]]), `export default (...$a)=>$a.${k};`)
        })
    },
    // A function is written with its parameter and no other, since a body
    // reads its arguments as one node: the parameters are named as a
    // spreadsheet names its columns, by depth, so a body names its own and
    // reaches the ones outside it.
    functions: () => {
        writes(identity, 'export default (...$a)=>$a;')
        writes(['=>', 0, [], ['=>', 0, [], ['rest']]], 'export default ()=>(...$b)=>$b;')
        writes(['=>', 0, [], ['[]', [['=>', 0, [], 1]]]], 'export default ()=>[()=>1];')
        // `$z` then `$aa`: the letters carry past the twenty-sixth body.
        assert(reads(nested(27)).endsWith('()=>()=>(...$aa)=>$aa;'))
    },
    // A function's `length` is at most 16: 16 reads back, and a larger one,
    // top-level or nested, is an error from every entry point, not a throw
    // out of allocating its parameter names.
    lengthLimit: () => {
        assert(reads(['=>', 16, [], ['arg', 15]]).includes('_15)=>'))
        for (const e of /** @type {readonly Exp[]} */ ([
            ['=>', 2 ** 32, [], 1],
            ['=>', 0, [], ['=>', 2 ** 32, [], 1]],
        ])) {
            /** @type {Exp} */
            const module = ['{}', [[':', 'f', e], [':', 'default', 1]]]
            for (const result of [trySerialize(e), tryStringify(e), tryModuleSerialize(module), tryModuleStringify(module)]) {
                assertStructurallySame(result, ['error', 'a function length above 16'])
            }
        }
    },
    // A body whose text opens with `{` is written as a block: `=> {` opens a
    // block and not an object, so the value has to be returned from it. The
    // question is the text's and not the node's — an access on an object
    // literal opens with one too, and reads back as a block just the same.
    block: () => {
        writes(['=>', 0, [], ['{}', [[':', 'x', 1]]]], 'export default ()=>{return {"x":1};};')
        writes(['=>', 0, [], ['.', ['{}', [[':', 'a', 1]]], 'a']], 'export default ()=>{return {"a":1}.a;};')
        writes(['=>', 0, [], ['[]', [1]]], 'export default ()=>[1];')
        writes(['=>', 0, [], ['.', 'x', 'length']], 'export default ()=>"x".length;')
    },
    // A body's own `const`s: a shared constructor, hoisted so that it is one
    // value per call; a numeric or function access base, which the grammar
    // takes no access on; and the anchors of a comma the body holds. Each is
    // named by the body's parameter and its slot, `$a0` where the parameter
    // is `$a`, so a scope's names collide with no other's and a body reads
    // only its own.
    //
    // A body needing none keeps the expression form, which `functions`
    // above pins: the `const`s are what make it a block.
    bodyConsts: () => {
        /** @type {Exp} */
        const o = ['{}', []]
        writes(['=>', 0, [], ['[]', [o, o]]], 'export default ()=>{const $a0={};return [$a0,$a0];};')
        writes(['=>', 0, [], ['.', 1, 'x']], 'export default ()=>{const $a0=1;return $a0.x;};')
        writes(['=>', 0, [], ['.', identity, 'length']], 'export default ()=>{const $a0=(...$b)=>$b;return $a0.length;};')
        writes(['=>', 0, [], [',', [['[]', []], 1]]], 'export default ()=>{const $a0=[];return 1;};')
        // the arguments are a body's to name, which no module `const` can
        writes(['=>', 0, [], ['[]', [['[]', [['rest']]], ['[]', [['rest']]]]]], 'export default (...$a)=>[[$a],[$a]];')
        // one scope per body: the module's `$0`, the outer body's `$a0` and
        // the inner one's `$b0` stand together, each numbering from zero
        writes(
            (() => {
                /** @type {Exp} */
                const m = ['[]', []]
                /** @type {Exp} */
                const inner = ['{}', []]
                return [',', [['[]', [m, m]], ['=>', 0, [], ['[]', [['=>', 0, [], ['[]', [inner, inner]]]]]]]]
            })(),
            'const $0=[];const $1=[$0,$0];export default ()=>[()=>{const $b0={};return [$b0,$b0];}];')
    },
    // A comma at the root is the module it came from: an unused `const` per
    // anchor and then the export, each anchor taking a name it does not
    // spend so that one graph is one text. Any other root is the export
    // alone.
    roots: () => {
        writes([',', [['[]', []], 1]], 'const $0=[];export default 1;')
        writes([',', [1, 2]], 'const $0=1;export default 2;')
        /** @type {Exp} */
        const o = ['{}', []]
        writes([',', [['[]', []], ['[]', [o, o]]]], 'const $0=[];const $1={};export default [$1,$1];')
        writes([',', [['[]', [o, o]], ['[]', [o]]]], 'const $0={};const $1=[$0,$0];export default [$0];')
    },
    // The chunks, which is what the writer writes and the string is joined
    // from.
    chunks: () => {
        assertStructurallySame(toArray(unwrap(trySerialize(1))), ['export default ', '1', ';'])
    },
    // A function with a frame is a closure: each frame element takes a
    // `const` in the scope around the function — even one the writer would
    // write in place, since a capture is a name — and a read of slot `i` is
    // that name. A slot that reads the scope's own frame is that slot's
    // name already. Read back, the body's outside names are its captures
    // in first-use order, which is the frame's.
    captures: () => {
        /** @type {Exp} */
        const c = ['[]', [1]]
        /** A read of slot `i`, a node of its own — one node in two bodies is no EDAG. @type {(i: number) => Exp} */
        const slot = i => ['frame', i]
        writes(['=>', 0, [c], slot(0)], 'const $0=[1];export default ()=>$0;')
        writes(['[]', [c, ['=>', 0, [c], slot(0)]]], 'const $0=[1];export default [$0,()=>$0];')
        // the frame's `const` comes before the function's own
        /** @type {Exp} */
        const f = ['=>', 0, [c], ['[]', [slot(0), ['.', ['rest'], 0]]]]
        writes(['[]', [f, f]], 'const $0=[1];const $1=(...$a)=>[$0,$a[0]];export default [$1,$1];')
        // a slot read is a base like any name
        writes(['=>', 0, [c], ['.', slot(0), 0]], 'const $0=[1];export default ()=>$0[0];')
        // one slot read twice is one name, and two slots are two
        /** @type {Exp} */
        const d = ['{}', []]
        writes(['=>', 0, [c, d], ['[]', [slot(0), slot(1), slot(0)]]], 'const $0=[1];const $1={};export default ()=>[$0,$1,$0];')
        // inside a body: a parameter is a name already, and a nested
        // function captures through its parent
        writes(
            ['=>', 0, [], ['=>', 0, [['rest']], ['=>', 0, [slot(0), ['rest']], ['[]', [slot(0), slot(1), slot(0)]]]]],
            'export default (...$a)=>(...$b)=>()=>[$a,$b,$a];')
        writes(
            ['=>', 0, [], ['=>', 0, [['.', ['rest'], 0]], ['[]', [slot(0), slot(0)]]]],
            'export default (...$a)=>{const $a0=$a[0];return ()=>[$a0,$a0];};')
        // what the compiler builds is written, two `const`s reading one
        // value among it: the lowering gives them the one slot the
        // analysis sees
        assertEq(
            reads(_defaultExport(moduleGraph('const o=[1]; const x=o[0]; const y=o[0]; export default (...a)=>[x,y];'))),
            'const $0=[1][0];export default ()=>[$0,$0];')
        // where the writer's own order would read the slots in another —
        // here the body's text is the frame's order backwards, and a shared
        // function hoisted above the `return` reads the later slot first —
        // the body names its slots in order before anything else
        writes(['=>', 0, [c, d], ['[]', [slot(1), slot(0)]]], 'const $0=[1];const $1={};export default ()=>{const $a0=$0;const $a1=$1;return [$a1,$a0];};')
        assertEq(
            reads(_defaultExport(moduleGraph('const x=[1]; const y=[2]; export default (...a)=>{const z=x; const f=(...b)=>y; return [z,f,f];};'))),
            'const $0=[1];const $1=[2];export default ()=>{const $a0=$0;const $a1=$1;const $a2=()=>$a1;return [$a0,$a2,$a2];};')
        // slots the parser would not build have no text that reads back,
        // and one of the enclosing scope, a comma, has no text yet
        refuses(['=>', 0, [1], slot(0)], 'a frame slot holding a primitive')
        refuses(['=>', 0, [c, c], ['[]', [slot(0), slot(1)]]], 'a frame slot that repeats another')
        refuses(['=>', 0, [c], 1], 'a frame slot the body never reads')
        // a read of no slot, one whose index is no canonical index, and one
        // outside a function are the analysis's refusals, before any text
        // is written
        refuses(['=>', 0, [c], slot(1)], 'invalid frame slot index or scope')
        refuses(['=>', 0, [c], slot(-0)], 'invalid frame slot index or scope')
        refuses(slot(0), 'invalid frame slot index or scope')
        refuses(['=>', 0, [[',', [['[]', []], c]]], slot(0)], 'a comma outside a scope')
    },
    calls: () => {
        /** @type {(e: Exp) => Exp} */
        const f = e => ['=>', 0, [], e]
        /** @type {Exp} */
        const a = ['rest']
        writes(f(['()', a, [1, 2]]), 'export default (...$a)=>$a(1,2);')
        writes(f(['()', a, []]), 'export default (...$a)=>$a();')
        writes(f(['()', ['()', a, [1]], [2]]), 'export default (...$a)=>$a(1)(2);')
        writes(f(['()', a, [['=>', 0, [], 1], ['?:', a, 1, 2]]]), 'export default (...$a)=>$a(()=>1,$a?1:2);')
        // a function called with no arguments is a callee by its name: the
        // front end inlines one called where it is written
        writes(f(['()', ['=>', 0, [], 1], []]), 'export default ()=>{const $a0=()=>1;return $a0();};')
        // and so is one called with arguments, as a function access base is
        writes(f(['()', ['=>', 1, [], ['arg', 0]], [1]]), 'export default ()=>{const $a0=($b_0)=>$b_0;return $a0(1);};')
        writes(f(['()', ['+', a, 1], []]), 'export default (...$a)=>($a+1)();')
        writes(f(['.', ['()', a, []], 'x']), 'export default (...$a)=>$a().x;')
        writes(f(['()', ['.', a, 'f'], []]), 'export default (...$a)=>{const $a0=$a.f;return $a0();};')
        writes(f(['.', a, 'f', ['|()', [1]]]), 'export default (...$a)=>$a.f(1);')
        writes(f(['.', ['+', a, 1], 'f', ['|()', []]]), 'export default (...$a)=>($a+1).f();')
        writes(f(['.', 1, 'f', ['|()', []]]), 'export default ()=>{const $a0=1;return $a0.f();};')
        writes(f(['()', ['.', a, 'f', ['|()', []]], []]), 'export default (...$a)=>$a.f()();')
        writes(f(['.', ['.', a, 'f', ['|()', []]], 'g', ['|()', []]]), 'export default (...$a)=>$a.f().g();')
        // a method call's key is refused by the parser's own list of the
        // member functions a module may not call, not by the one of reads
        writes(f(['.', a, 'at', ['|()', [0]]]), 'export default (...$a)=>$a.at(0);')
        refuses(f(['.', a, 'push', ['|()', [0]]]), 'a prohibited member function')
        refuses(f(['.', a, 'at']), 'a prohibited property name')
        // one call node is one call, however many edges reach it
        /** @type {Exp} */
        const c = ['()', a, []]
        writes(f(['[]', [c, c]]), 'export default (...$a)=>{const $a0=$a();return [$a0,$a0];};')
        writes(f(['[]', [['()', a, []], ['()', a, []]]]), 'export default (...$a)=>[$a(),$a()];')
        // a slot is a name, and a callee as it stands
        writes(['=>', 0, [['[]', []]], ['()', ['frame', 0], []]], 'const $0=[];export default ()=>$0();')
        // a shared call under a lazy operand takes its block's `const` after
        // the one its callee or its base takes
        /** @type {Exp} */
        const m = ['.', 1, 'm', ['|()', []]]
        writes(['?:', true, ['[]', [m, m]], 2], 'export default true?(()=>{const $a0=1;const $a1=$a0.m();return [$a1,$a1];})():2;')
        /** @type {Exp} */
        const n = ['()', 1, []]
        writes(['&&', ['[]', []], ['[]', [n, n]]], 'export default []&&(()=>{const $a0=1;const $a1=$a0();return [$a1,$a1];})();')
        // a spread argument, `...` before its operand
        writes(f(['()', a, [['...', a]]]), 'export default (...$a)=>$a(...$a);')
        writes(f(['.', a, 'm', ['|()', [1, ['...', a]]]]), 'export default (...$a)=>$a.m(1,...$a);')
        // what the compiler builds is written
        assertEq(
            reads(_defaultExport(moduleGraph('export default (...a)=>{const g=a.b; return [g(1), a.b(2), a.b(1)(2)];};'))),
            'export default (...$a)=>{const $a0=$a.b;return [$a0(1),$a.b(2),$a.b(1)(2)];};')
    },
    // A function's text is the function written as one expression: the
    // module text of a function with no frame, less `export default` and
    // the `;`, and with a frame, each slot a name, `$0` for slot `0`,
    // whatever the slot holds. So a frame's items are not read at all: a
    // rest parameter of an enclosing function is a slot like any other.
    functionText: () => {
        /** @type {(e: Exp) => string} */
        const text = e => unwrap(tryFunctionText(e))
        /** @type {(i: number) => Exp} */
        const slot = i => ['frame', i]
        for (const e of /** @type {readonly Exp[]} */ ([
            ['=>', 0, [], 1],
            ['=>', 1, [], ['+', ['arg', 0], ['.', ['rest'], 'length']]],
            ['=>', 0, [], ['[]', [['[]', []], ['=>', 0, [], ['rest']]]]],
            ['=>', 0, [], ['?:', ['rest'], ['.', ['rest'], 'f', ['|()', [1]]], null]],
        ])) { assertEq(`export default ${text(e)};`, reads(e)) }
        assertEq(text(['=>', 0, [], 1]), '()=>1')
        assertEq(text(['=>', 1, [], ['+', ['arg', 0], ['.', ['rest'], 'length']]]), '($a_0,...$a)=>$a_0+$a.length')
        assertEq(text(['=>', 0, [['rest']], slot(0)]), '()=>$0')
        assertEq(text(['=>', 0, [['rest'], ['arg', 3]], ['[]', [slot(0), slot(1), ['rest']]]]), '(...$a)=>[$0,$1,$a]')
        // a nested function captures a slot through its own frame
        assertEq(text(['=>', 0, [['rest']], ['=>', 0, [slot(0)], slot(0)]]), '()=>()=>$0')
        // slots read out of order are named in order first, as a body's are
        assertEq(text(['=>', 0, [1, 2], ['[]', [slot(1), slot(0)]]]), '()=>{const $a0=$0;const $a1=$1;return [$a1,$a0];}')
        // refused: no function, and a body the writer or the analysis refuses
        assertStructurallySame(tryFunctionText(1), ['error', 'not a function'])
        assertStructurallySame(tryFunctionText(['[]', []]), ['error', 'not a function'])
        assertStructurallySame(tryFunctionText(['=>', 0, [], ['!', 1]]), ['error', 'a ! node'])
        assertStructurallySame(tryFunctionText(['=>', 0, [], ['arg', 0]]), ['error', 'invalid fixed parameter index or scope'])
    },
    // Every refusal, by the message it carries: a node kind with no spelling
    // yet, a position a spelling has none in, and a key no literal reads
    // back. Each names the feature that replaces it.
    // A scope whose value is a `throw` node ends in the statement it came
    // from, `throw v;` where `return v;` or `export default v;` would stand
    // — a body always a block, since the statement has no expression form —
    // with the `const`s the scope needs before it as ever. Anywhere else
    // the node is the call of a function that throws, JavaScript's one
    // spelling of an expression that fails: it reads back as that call and
    // fails at the same point (`throw.nested` below), so that round trip is
    // by behaviour and not by table.
    throws: () => {
        writes(['=>', 0, [], ['throw', 1]], 'export default ()=>{throw 1;};')
        writes(['=>', 0, [], ['throw', ['[]', [1]]]], 'export default ()=>{throw [1];};')
        writes(['=>', 0, [], [',', [['[]', []], ['throw', 1]]]], 'export default ()=>{const $a0=[];throw 1;};')
        writes(['throw', 'x'], 'throw "x";')
        // `null` is a value to throw, not the absence of one
        writes(['throw', null], 'throw null;')
        writes(['=>', 0, [], ['throw', null]], 'export default ()=>{throw null;};')
        assertEq(unwrap(tryModuleStringify(['throw', null])), 'throw null;')
        writes([',', [['[]', []], ['throw', 1]]], 'const $0=[];throw 1;')
        // a shared constructor the throw holds is hoisted before the statement
        /** @type {Exp} */
        const o = ['{}', []]
        writes(['throw', ['[]', [o, o]]], 'const $0={};throw [$0,$0];')
        // the module writer takes a throwing module to the same text
        assertEq(unwrap(tryModuleStringify(['throw', 'x'])), 'throw "x";')
        assertEq(unwrap(tryModuleStringify([',', [['[]', []], ['throw', 1]]])), 'const $0=[];throw 1;')
        // nested: the call of a function that throws, which the front end
        // inlines, so it reads back as the node it was written from
        writes(['[]', [['throw', 1]]], 'export default [(()=>{throw 1;})()];')
        writes(['=>', 0, [], ['[]', [['throw', ['rest']]]]], 'export default (...$a)=>[(()=>{throw $a;})()];')
    },
    throw: {
        // the call a nested `throw` is written as fails where the node does
        nested: () => {
            const { edag } = unresolved(unwrap(parse(path)(unwrap(tryStringify(['[]', [['throw', 1]]])))))
            memo(analysis(_defaultExport(edag)))({ frame: null, args: [] })
        },
    },
    refuses: () => {
        // A node kind this writer has no spelling for, which is how the
        // feature that adds one is made to add its spelling here too: the
        // unary plus, `op12`'s `+` of one operand, which the language has
        // no prefix for
        refuses(['+', 1], 'a unary + node')
        // a node under a lazy operand is walked for what it holds before
        // it is refused for what it is: an object's spread, which waits on
        // `spec/todo/2490-object-spread.md`
        refuses(['{}', [['...', ['[]', []]]]], 'a spread')
        refuses(['=>', 0, [], ['?.', ['rest'], 'a', ['|.', 'b', ['|()', [['[]', [1]]]]]]], 'a ?. node')
        // an argument list is read by position: `f('#', 0)` names no entry
        refuses(['=>', 0, [], ['?.()', ['rest'], ['#', 0], ['|.', 'b']]], 'a ?.() node')
        refuses(['=>', 0, [], ['.', ['rest'], 'b', ['|?.()', []]]], 'a |?.() step')
        // A node kind with a spelling, in a position that has none.
        refuses(['rest'], 'the arguments outside a function')
        // a comma is a scope's own form — a module's root and a function's
        // body are where one is read — so one inside a container has no
        // source spelling until the operator lands
        refuses(['[]', [[',', [1, 2]]]], 'a comma outside a scope')
        refuses(['=>', 0, [], ['[]', [[',', [1, 2]]]]], 'a comma outside a scope')
        // A key no literal spells: a computed one, an object key that is not
        // a string, and the three numbers the tokenizer does not read back.
        refuses(['=>', 0, [], ['.', ['rest'], ['Number', ['rest']]]], 'an access key that is no literal')
        refuses(['{}', [[':', 1, 2]]], 'an object key that is not a string')
        refuses(['=>', 0, [], ['.', ['rest'], NaN]], 'a number key no literal reads back')
        refuses(['=>', 0, [], ['.', ['rest'], Infinity]], 'a number key no literal reads back')
        refuses(['=>', 0, [], ['.', ['rest'], -0]], 'a number key no literal reads back')
        // A key naming a property of a built-in prototype: the grammar
        // refuses it in either spelling, `.k` and `["k"]` alike, so an
        // access on one has no text at all — `length`, which both languages
        // read as an own property, is the one such name that has.
        refuses(['=>', 0, [], ['.', ['rest'], 'constructor']], 'a prohibited property name')
        refuses(['=>', 0, [], ['.', ['rest'], '__proto__']], 'a prohibited property name')
        refuses(['=>', 0, [], ['.', ['rest'], 'toString']], 'a prohibited property name')
        // The first refusal is the one reported, and nothing after it is
        // written: among the values a statement hoists, and among the
        // statements of a module.
        refuses(
            (() => {
                /** @type {Exp} */
                const bad = ['{}', [['...', 1]]]
                /** @type {Exp} */
                const good = ['{}', []]
                return ['[]', [bad, bad, good, good]]
            })(),
            'a spread')
        refuses([',', [['+', 1], 1]], 'a unary + node')
        // A comma with no anchor to write: with one operand it would read
        // back as that operand alone, and with none it is no scope. Linking
        // emits neither, at a root or in a body — a comma is built only
        // where an anchor or an unbound import is there to carry.
        refuses([',', [1]], 'a comma with fewer than two operands')
        refuses([',', []], 'a comma with fewer than two operands')
        refuses(['=>', 0, [], [',', [1]]], 'a comma with fewer than two operands')
        refuses(['=>', 0, [], [',', []]], 'a comma with fewer than two operands')
        // An anchor whose operand already has a name: its statement would be
        // the alias `const $1=$0;`, which the front end reads back as
        // nothing — an alias to a reached `const` is not an anchored
        // computation — and the comma would go with it. Linking emits no
        // such graph: `const a = []; const b = a; export default a;` drops
        // the alias and is the array alone.
        refuses(
            (() => {
                /** @type {Exp} */
                const o = ['[]', []]
                return [',', [o, o]]
            })(),
            'an anchor that repeats a hoisted value')
        // and one that is a name the scope binds without a `const`: the
        // front end reads `const $a0=$a;` as an alias, no anchor at all
        refuses(['=>', 0, [], [',', [['rest'], 1]]], 'an anchor that is a name')
        refuses(['=>', 1, [], [',', [['arg', 0], 1]]], 'an anchor that is a name')
        refuses(['[]', [['[]', []], ['=>', 0, [['[]', []]], [',', [['frame', 0], 1]]]]], 'an anchor that is a name')
    },
    // Stage A: the eager binary operators and `~`, each spelled with the
    // parentheses JavaScript's own precedence asks for and no more. A left
    // operand as loose as the operator stands bare and a right one that
    // loose takes them, the other way round for `**`, which associates to
    // the right; a looser operand takes them on either side, a tighter one
    // never. The text reads back as the graph, a leaf's negation folded.
    operators: () => {
        /** @type {(b: Exp) => Exp} */
        const fn = b => ['=>', 0, [], b]
        /** @type {Exp} */
        const r0 = ['.', ['rest'], 0]
        /** @type {Exp} */
        const r1 = ['.', ['rest'], 1]
        for (const op of /** @type {const} */ (['|', '^', '&', '===', '!==', '<', '<=', '>', '>=', '<<', '>>', '>>>', '+', '-', '*', '/', '%', '**'])) {
            writes(fn([op, r0, r1]), `export default (...$a)=>$a[0]${op}$a[1];`)
        }
        writes(fn(['~', r0]), 'export default (...$a)=>~$a[0];')
        writes(['+', 'a', 1n], 'export default "a"+1n;')
        // associativity: to the left, `**` to the right
        writes(['-', ['-', 1, 2], 3], 'export default 1-2-3;')
        writes(['-', 1, ['-', 2, 3]], 'export default 1-(2-3);')
        writes(['**', ['**', 2, 3], 2], 'export default (2**3)**2;')
        writes(['**', 2, ['**', 3, 2]], 'export default 2**3**2;')
        // the levels, each against its neighbours
        writes(['+', 1, ['*', 2, 3]], 'export default 1+2*3;')
        writes(['*', ['+', 1, 2], 3], 'export default (1+2)*3;')
        writes(['**', 2, ['*', 3, 4]], 'export default 2**(3*4);')
        writes(['%', ['/', 1, 2], 3], 'export default 1/2%3;')
        writes(['<<', 1, ['+', 2, 3]], 'export default 1<<2+3;')
        writes(['<', ['<<', 1, 2], 5], 'export default 1<<2<5;')
        writes(['<<', ['<', 1, 2], 5], 'export default (1<2)<<5;')
        writes(['===', ['<', 1, 2], true], 'export default 1<2===true;')
        writes(['&', ['===', 1, 2], 1], 'export default 1===2&1;')
        writes(['^', ['&', 1, 2], 3], 'export default 1&2^3;')
        writes(['|', ['^', 1, 2], 3], 'export default 1^2|3;')
        writes(['^', 1, ['|', 2, 3]], 'export default 1^(2|3);')
        // under the lazy operators and the conditional, which bind looser
        // than them all
        writes(fn(['&&', ['+', r0, 1], r1]), 'export default (...$a)=>$a[0]+1&&$a[1];')
        writes(fn(['+', ['&&', r0, r1], 1]), 'export default (...$a)=>($a[0]&&$a[1])+1;')
        writes(fn(['+', r0, ['?:', r1, 1, 2]]), 'export default (...$a)=>$a[0]+($a[1]?1:2);')
        writes(fn(['?:', ['+', r0, 1], 1, 2]), 'export default (...$a)=>$a[0]+1?1:2;')
        writes(fn(['|', r0, ['??', r1, 1]]), 'export default (...$a)=>$a[0]|($a[1]??1);')
        // the prefixes bind tighter than every binary operator, so an
        // operator's text is grouped under one and a prefix stands bare
        // under anything, another prefix included
        writes(['-', ['+', 1, 2]], 'export default -(1+2);')
        writes(['~', ['|', 1, 2]], 'export default ~(1|2);')
        writes(['+', ['~', 1], ['-', ['[]', []]]], 'export default ~1+-[];')
        writes(['~', ['~', 1]], 'export default ~~1;')
        writes(['~', ['-', ['[]', []]]], 'export default ~-[];')
        writes(['-', ['~', 1]], 'export default -~1;')
        // `**` takes no prefix on its left bare, a negative number
        // included, as JavaScript does not; on its right either stands bare
        writes(['**', -2, 2], 'export default (-2)**2;')
        writes(['**', ['-', ['[]', []]], 2], 'export default (-[])**2;')
        writes(['**', ['~', 1], 2], 'export default (~1)**2;')
        writes(['**', 2, -2], 'export default 2**-2;')
        writes(['**', 2, ['~', 1]], 'export default 2**~1;')
        writes(['-', ['**', 2, 2]], 'export default -(2**2);')
        writes(['**', 2, ['-', ['**', 2, 2]]], 'export default 2**-(2**2);')
        // a `-` before a text opening with `-` takes a space, `--` being
        // the decrement token; no other operator meets its own character
        writes(['-', 1, -2], 'export default 1- -2;')
        writes(['-', 1, ['-', ['[]', []]]], 'export default 1- -[];')
        writes(['+', 1, -2], 'export default 1+-2;')
        // a function is an operand only in a group
        writes(['+', ['=>', 0, [], 1], 1], 'export default (()=>1)+1;')
        writes(['+', 1, ['=>', 0, [], 1]], 'export default 1+(()=>1);')
        writes(['~', ['=>', 0, [], 1]], 'export default ~(()=>1);')
        // and an operator an access base only in a group, where an access
        // is a prefix's operand bare
        writes(['.', ['+', 1, 2], 'x'], 'export default (1+2).x;')
        writes(['.', ['~', ['[]', []]], 0], 'export default (~[])[0];')
        writes(['~', ['.', ['[]', [1]], 0]], 'export default ~[1][0];')
        // a shared operator over values is written in place at each
        // occurrence, its minting operand hoisted, and merges again when
        // read; one holding a minting node through a lazy edge takes a
        // `const`, as the lazy operators' proof has
        /** @type {Exp} */
        const o = ['[]', []]
        /** @type {Exp} */
        const sum = ['+', o, 1]
        writes(['[]', [sum, sum]], 'const $0=[];export default [$0+1,$0+1];')
        /** @type {Exp} */
        const held = ['+', ['?:', true, o, 1], 1]
        writes(['[]', [held, held]], 'const $0=true?[]:1;const $1=$0+1;export default [$1,$1];')
        // in a body, the same
        writes(fn(['[]', [sum, sum]]), 'export default ()=>{const $a0=[];return [$a0+1,$a0+1];};')
    },
    // The lazy operators and the conditional. Each operand of `&&`, `||`
    // and `??` after the first, and each arm of `?:`, is a block root: a
    // value shared under it alone is hoisted in a block of its own, an
    // IIFE, which is the call the front end inlines, and so is a comma
    // there — its anchors the block's unreferenced `const`s. A value the
    // scope reaches eagerly as well is the scope's `const`, as ever, and
    // one a lazy operand reaches from outside the operand that would hoist
    // it has no text that reads back as one node.
    lazy: {
        spelling: () => {
            /** @type {(b: Exp) => Exp} */
            const fn = b => ['=>', 0, [], b]
            /** @type {Exp} */
            const r0 = ['.', ['rest'], 0]
            /** @type {Exp} */
            const r1 = ['.', ['rest'], 1]
            /** @type {Exp} */
            const r2 = ['.', ['rest'], 2]
            writes(fn(['&&', r0, r1]), 'export default (...$a)=>$a[0]&&$a[1];')
            writes(fn(['||', r0, r1]), 'export default (...$a)=>$a[0]||$a[1];')
            writes(fn(['??', r0, r1]), 'export default (...$a)=>$a[0]??$a[1];')
            writes(fn(['?:', r0, r1, r2]), 'export default (...$a)=>$a[0]?$a[1]:$a[2];')
            // precedence: a left operand as loose as the operator stands
            // bare, a right one that loose takes parentheses, since bare it
            // would read as the left operand's; `??` never mixes bare with
            // `&&` or `||`; a conditional is looser than them all, and its
            // arms take anything bare, a conditional and a function included
            writes(fn(['&&', ['&&', r0, r1], r2]), 'export default (...$a)=>$a[0]&&$a[1]&&$a[2];')
            writes(fn(['&&', r0, ['&&', r1, r2]]), 'export default (...$a)=>$a[0]&&($a[1]&&$a[2]);')
            writes(fn(['||', ['&&', r0, r1], r2]), 'export default (...$a)=>$a[0]&&$a[1]||$a[2];')
            writes(fn(['&&', ['||', r0, r1], r2]), 'export default (...$a)=>($a[0]||$a[1])&&$a[2];')
            writes(fn(['??', r0, ['||', r1, r2]]), 'export default (...$a)=>$a[0]??($a[1]||$a[2]);')
            writes(fn(['||', ['??', r0, r1], r2]), 'export default (...$a)=>($a[0]??$a[1])||$a[2];')
            writes(fn(['?:', ['?:', r0, 1, 2], 3, 4]), 'export default (...$a)=>($a[0]?1:2)?3:4;')
            writes(fn(['?:', r0, ['?:', r1, 1, 2], 3]), 'export default (...$a)=>$a[0]?$a[1]?1:2:3;')
            writes(fn(['?:', r0, 1, ['?:', r1, 2, 3]]), 'export default (...$a)=>$a[0]?1:$a[1]?2:3;')
            writes(fn(['&&', ['?:', r0, 1, 2], r1]), 'export default (...$a)=>($a[0]?1:2)&&$a[1];')
            writes(fn(['?:', r0, 1, ['&&', r1, r2]]), 'export default (...$a)=>$a[0]?1:$a[1]&&$a[2];')
            // a function is no operand bare, an arm excepted
            writes(fn(['&&', r0, ['=>', 0, [], 1]]), 'export default (...$a)=>$a[0]&&(()=>1);')
            writes(fn(['&&', ['=>', 0, [], 1], r0]), 'export default (...$a)=>(()=>1)&&$a[0];')
            writes(fn(['?:', ['=>', 0, [], 1], 1, 2]), 'export default ()=>(()=>1)?1:2;')
            writes(fn(['?:', r0, ['=>', 0, [], 1], 2]), 'export default (...$a)=>$a[0]?()=>1:2;')
            writes(fn(['?:', r0, 1, ['=>', 0, [], 1]]), 'export default (...$a)=>$a[0]?1:()=>1;')
            // an operator binds looser than a step and than the prefix
            writes(fn(['.', ['&&', r0, r1], 'x']), 'export default (...$a)=>($a[0]&&$a[1]).x;')
            writes(fn(['-', ['&&', r0, r1]]), 'export default (...$a)=>-($a[0]&&$a[1]);')
            writes(fn(['&&', ['-', r0], r1]), 'export default (...$a)=>-$a[0]&&$a[1];')
            // a body whose text opens with `{` is a block, whatever follows
            writes(fn(['?:', ['.', ['{}', []], 'x'], 1, 2]), 'export default ()=>{return {}.x?1:2;};')
            writes(fn(['?:', r0, ['.', ['{}', []], 'x'], 2]), 'export default (...$a)=>$a[0]?{}.x:2;')
        },
        blocks: () => {
            /** @type {(b: Exp) => Exp} */
            const fn = b => ['=>', 0, [], b]
            /** @type {Exp} */
            const r0 = ['.', ['rest'], 0]
            /** @type {Exp} */
            const r1 = ['.', ['rest'], 1]
            /** @type {Exp} */
            const r2 = ['.', ['rest'], 2]
            /** @type {Exp} */
            const c = ['[]', [1]]
            // a value shared under one arm alone is the arm's block's
            writes(fn(['?:', r0, ['[]', [c, c]], 4]), 'export default (...$a)=>$a[0]?(()=>{const $b0=[1];return [$b0,$b0];})():4;')
            writes(['?:', true, ['[]', [c, c]], 4], 'export default true?(()=>{const $a0=[1];return [$a0,$a0];})():4;')
            // a comma under a lazy operand is a block too, its anchors the
            // block's own `const`s, unreferenced
            writes(fn(['&&', r0, [',', [['.', null, 'x'], 1]]]), 'export default (...$a)=>$a[0]&&(()=>{const $b0=null.x;return 1;})();')
            writes(fn(['&&', r0, [',', [['.', null, 'x'], ['[]', [c, c]]]]]), 'export default (...$a)=>$a[0]&&(()=>{const $b0=null.x;const $b1=[1];return [$b1,$b1];})();')
            // the block reads the names around it: the function's
            // arguments and parameters, and the scopes' `const`s
            writes(fn(['?:', r0, ['[]', [c, c, ['rest']]], 1]), 'export default (...$a)=>$a[0]?(()=>{const $b0=[1];return [$b0,$b0,$a];})():1;')
            writes(['=>', 1, [], ['?:', ['arg', 0], ['[]', [c, c, ['arg', 0]]], 1]], 'export default ($a_0)=>$a_0?(()=>{const $b0=[1];return [$b0,$b0,$a_0];})():1;')
            writes(fn([',', [['[]', []], ['?:', r0, ['[]', [c, c]], 1]]]), 'export default (...$a)=>{const $a0=[];return $a[0]?(()=>{const $b0=[1];return [$b0,$b0];})():1;};')
            // a function in the block captures the block's `const`, and is
            // one depth further in
            writes(['?:', true, ['[]', [c, ['=>', 0, [c], ['frame', 0]]]], 1], 'export default true?(()=>{const $a0=[1];return [$a0,()=>$a0];})():1;')
            // blocks nest as lazy operands do
            /** @type {Exp} */
            const d = ['[]', [2]]
            writes(fn(['?:', r0, ['[]', [c, c, ['&&', r1, ['[]', [d, d]]]]], 4]), 'export default (...$a)=>$a[0]?(()=>{const $b0=[1];return [$b0,$b0,$a[1]&&(()=>{const $c0=[2];return [$c0,$c0];})()];})():4;')
            // a value the scope reaches eagerly as well — in the same
            // statement, or a later one — is the scope's `const`
            writes(fn(['[]', [c, ['?:', r0, ['[]', [c, c]], 1]]]), 'export default (...$a)=>{const $a0=[1];return [$a0,$a[0]?[$a0,$a0]:1];};')
            writes([',', [['[]', [['&&', 1, c]]], ['[]', [c, 2]]]], 'const $0=[1];const $1=[1&&$0];export default [$0,2];')
            // an anchor that is a value the scope reaches only lazily is
            // its `const` and nothing more: read back, the `const` is
            // anchored for the same reason
            writes([',', [c, ['[]', [['&&', 1, c], ['&&', 2, c]]]]], 'const $0=[1];export default [1&&$0,2&&$0];')
            writes([',', [['[]', [2]], c, ['[]', [['&&', 1, ['[]', [c, c]]], ['&&', 2, ['[]', [2]]]]]]], 'const $0=[2];const $1=[1];export default [1&&[$1,$1],2&&[2]];')
            // a shared node that holds a value minting identity through a
            // lazy edge takes a `const` as the value would: written twice
            // it would mint twice. One reached eagerly by the scope is the
            // scope's; one holding only values is written in place, as an
            // access is, and merges again when read
            /** @type {Exp} */
            const y = ['?:', r0, ['[]', []], 1]
            writes(fn(['[]', [y, y]]), 'export default (...$a)=>{const $a0=$a[0]?[]:1;return [$a0,$a0];};')
            /** @type {Exp} */
            const w = ['.', ['?:', r0, ['[]', []], 1], 'k']
            writes(fn(['[]', [w, w]]), 'export default (...$a)=>{const $a0=$a[0]?[]:1;const $a1=$a0.k;return [$a1,$a1];};')
            /** @type {Exp} */
            const n = ['-', ['?:', r0, ['[]', []], 1]]
            writes(fn(['[]', [n, n]]), 'export default (...$a)=>{const $a0=$a[0]?[]:1;const $a1=-$a0;return [$a1,$a1];};')
            /** @type {Exp} */
            const z = ['??', r0, r1]
            writes(fn(['[]', [z, z]]), 'export default (...$a)=>[$a[0]??$a[1],$a[0]??$a[1]];')
            /** @type {Exp} */
            const m = ['?:', r0, c, 1]
            writes(fn([',', [c, ['[]', [m, m]]]]), 'export default (...$a)=>{const $a0=[1];const $a1=$a[0]?$a0:1;return [$a1,$a1];};')
            // a value nothing outside its lazy operand reaches, but two
            // lazy operands do, or one that is the operand itself, has no
            // text that reads back as one node
            refuses(['?:', true, c, c], 'a shared node reached from outside the lazy operand that establishes it')
            refuses(['[]', [['&&', 1, c], ['&&', 2, c]]], 'a shared node reached from outside the lazy operand that establishes it')
            refuses(['?:', true, ['[]', [c, c]], c], 'a shared node reached from outside the lazy operand that establishes it')
            refuses(fn(['?:', r0, ['[]', [['&&', 1, c], ['&&', 2, c]]], 1]), 'a shared node reached from outside the lazy operand that establishes it')
            // and so has an operand two edges reach that holds one: the
            // access is written at each and merges again when read, but
            // the array under it would be built twice
            /** @type {Exp} */
            const length = ['.', c, 'length']
            refuses(['?:', true, length, length], 'a shared node reached from outside the lazy operand that establishes it')
            refuses(['[]', [['&&', 1, length], ['&&', 2, length]]], 'a shared node reached from outside the lazy operand that establishes it')
            // and so has one each of two lazy operands reaches once, held
            // in place — under a container of the operand's own, or under
            // an access two containers hold
            refuses(['[]', [['&&', 1, ['[]', [c]]], ['&&', 2, ['[]', [c]]]]], 'a shared node reached from outside the lazy operand that establishes it')
            refuses(['?:', true, ['[]', [c]], ['[]', [c]]], 'a shared node reached from outside the lazy operand that establishes it')
            refuses(['[]', [['&&', 1, ['[]', [length]]], ['&&', 2, ['[]', [length]]]]], 'a shared node reached from outside the lazy operand that establishes it')
            // where one holding values alone is written at each, and reads
            // back merged
            writes(fn(['?:', r0, r1, r1]), 'export default (...$a)=>$a[0]?$a[1]:$a[1];')
            // and one the scope reaches eagerly as well is the scope's
            writes([',', [c, ['?:', true, length, length]]], 'const $0=[1];export default true?$0.length:$0.length;')
            // and what a value the scope names holds is not the block's:
            // its `const` writes it once, and each occurrence reads the
            // name — a nested array, and a call, whose arguments are an
            // array, read in both arms, or eagerly and under `||` or in
            // one arm
            /** @type {Exp} */
            const nest = ['[]', [c]]
            /** @type {Exp} */
            const nestLength = ['.', nest, 'length']
            writes([',', [nest, ['?:', true, nestLength, nestLength]]], 'const $0=[[1]];export default true?$0.length:$0.length;')
            /** @type {Exp} */
            const call = ['()', ['rest'], []]
            /** @type {Exp} */
            const field = ['.', call, 'a']
            writes(fn(['||', ['===', field, 1], ['===', field, 2]]), 'export default (...$a)=>{const $a0=$a();return $a0.a===1||$a0.a===2;};')
            writes(fn(['[]', [field, ['?:', r0, field, 0]]]), 'export default (...$a)=>{const $a0=$a();return [$a0.a,$a[0]?$a0.a:0];};')
            writes(fn([',', [call, ['?:', r0, field, field]]]), 'export default (...$a)=>{const $a0=$a();return $a[0]?$a0.a:$a0.a;};')
            // and so is what the value holds under a lazy operand of its
            // own: an array in an arm, or an object after a `??` in a
            // call's arguments
            /** @type {Exp} */
            const choice = ['?:', r0, ['[]', [r1]], 0]
            /** @type {Exp} */
            const choiceField = ['.', choice, 'a']
            writes(fn([',', [choice, ['?:', r2, choiceField, choiceField]]]), 'export default (...$a)=>{const $a0=$a[0]?[$a[1]]:0;return $a[2]?$a0.a:$a0.a;};')
            writes(fn(['[]', [choice, ['?:', r2, choiceField, ['[]', [choiceField]]]]]), 'export default (...$a)=>{const $a0=$a[0]?[$a[1]]:0;return [$a0,$a[2]?$a0.a:[$a0.a]];};')
            /** @type {Exp} */
            const defaulted = ['()', ['rest'], [['??', r0, ['{}', []]]]]
            /** @type {Exp} */
            const defaultedField = ['.', defaulted, 'a']
            writes(fn([',', [defaulted, ['?:', r1, defaultedField, defaultedField]]]), 'export default (...$a)=>{const $a0=$a($a[0]??{});return $a[1]?$a0.a:$a0.a;};')
        },
    },
    // The writer's one law, over graphs nobody chose: a graph is refused,
    // or its text is read back to the same table. Every case above is a
    // text this module pins; this is the claim that nothing outside them
    // is answered with a plausible wrong value
    // ([DESIGN.md §10](../../../doc/DESIGN.md#10-refuse-what-you-cannot-handle)),
    // which is what a writer whose contract is the round trip may not do,
    // and which four hand-picked accept sets in a row did not catch — and
    // which caught, when the lazy operators landed, a shared anchor the
    // export reached eagerly, whose `const` read back as no anchor at all.
    //
    // The graphs are every shape over every shape over the atoms, some
    // thousands of them, of which about half have a text and the rest are
    // refused by name.
    //
    // The graphs are split into parts, each its own test, so that no one
    // test runs near a runner's time limit.
    law: Object.fromEntries(Array.from({ length: lawParts }, (_, k) => [
        `part${k}`,
        () => generated.filter((_, i) => i % lawParts === k).forEach(e => {
            const written = tryStringify(e)
            if (written[0] === 'error') { return }
            reads(e)
        }),
    ])),
    /**
     * **Every shared example is proved to behave as its name says.** The
     * parser's refusals and the import, which has no file set to link from,
     * are the refusals; everything else is written as a module.
     */
    demo: {
        examples: () => {
            for (const [name, source] of examples) {
                assertEq(_sourceOf(source)[0], ['An import', 'Logical not', 'Hex escape', 'typeof', 'Parse error'].includes(name) ? 'error' : 'ok')
            }
            assertEq(_sourceOf('const a = [1];\nexport default [a, a];')[1], 'const $0=[1];export default [$0,$0];')
        },
        view: () => {
            const shown = htmlToString(demo.view(demo.init))
            assert(shown.includes('<pre>'), shown)
            const refused = htmlToString(demo.view('export default {bad'))
            assert(refused.includes('Refused: '), refused)
        },
    },
}
