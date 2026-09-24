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
import { memo } from '../../edag/memo/module.f.mjs'
import { analysis } from '../../edag/analysis/module.f.mjs'
import { toArray } from '../../types/list/module.f.mjs'
import { invert, unwrap } from '../../types/result/module.f.mjs'
import { _defaultExport, unresolved } from '../edag/module.f.mjs'
import { parse } from '../transpiler/module.f.mjs'
import { trySerialize, tryStringify, tryModuleSerialize, tryModuleStringify } from './module.f.mjs'
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
const nested = n => n === 0 ? ['args'] : ['=>', 0, null, nested(n - 1)]

/** `(...a) => a`, the graph a spelling is wanted for rather than read from. @type {Exp} */
const identity = ['=>', 0, null, ['args']]

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
 * operand, the same graph twice over in two scopes, and a function that
 * captures the graph beside it.
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
    ...p.map(x => /** @type {Exp} */(['=>', 0, null, x])),
    ...p.map(x => /** @type {Exp} */(['[]', [x, x]])),
    ...p.map(x => /** @type {Exp} */([',', [x, 1]])),
    ...p.map(x => /** @type {Exp} */([',', [['[]', []], x]])),
    ...p.map(x => /** @type {Exp} */([',', [x, x]])),
    ...p.map(x => /** @type {Exp} */([',', [x]])),
    ...p.map(x => /** @type {Exp} */(['[]', [x, ['=>', 0, null, copy(x)]]])),
    ...p.map(x => /** @type {Exp} */(['[]', [x, ['=>', 0, ['[]', [x]], ['.', ['frame'], 0]]]])),
]

/**
 * Every leaf, the arguments, both empty containers, `undefined`, and a
 * negation — the one operator, whose operand binds tighter than it does, so
 * every shape below has to say where the negation happens.
 *
 * @type {readonly Exp[]}
 */
const atoms = [1, 'a', null, true, 1n, ['args'], ['[]', []], ['{}', []], ['undefined'], ['-', ['[]', []]]]

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
    // A function of a positive `length` is a named list of as many
    // parameters, the first names of its body, and the body reads each as
    // the argument at its position: `['.', ['args'], i]` for `i` below the
    // count is the name, and any other use of the arguments has no text,
    // since the list spells the declared positions and nothing else.
    parameters: () => {
        /** @type {Exp} */
        const args = ['args']
        /** @type {(i: number) => Exp} */
        const slot = i => ['.', ['frame'], i]
        writes(['=>', 2, null, ['.', args, 0]], 'export default ($a0,$a1)=>$a0;')
        writes(['=>', 1, null, ['[]', [['.', args, 0], ['.', args, 0]]]], 'export default ($a0)=>[$a0,$a0];')
        writes(['=>', 2, null, 1], 'export default ($a0,$a1)=>1;')
        // a body `const` takes the slot after the parameters
        /** @type {Exp} */
        const x = ['[]', [['.', args, 0]]]
        writes(['=>', 1, null, ['[]', [x, x]]], 'export default ($a0)=>{const $a1=[$a0];return [$a1,$a1];};')
        // a nested function captures a parameter as it captures anything of
        // the body, through a `const`; its own list is its own
        writes(['=>', 1, null, ['=>', 0, ['[]', [['.', args, 0]]], slot(0)]], 'export default ($a0)=>{const $a1=$a0;return (...$b)=>$a1;};')
        writes(['=>', 1, null, ['=>', 0, null, args]], 'export default ($a0)=>(...$b)=>$b;')
        writes(['=>', 1, null, ['=>', 2, null, ['.', args, 1]]], 'export default ($a0)=>($b0,$b1)=>$b1;')
        refuses(['=>', 2, null, args], 'the arguments of a function with named parameters')
        refuses(['=>', 2, null, ['.', args, 2]], 'an argument read that is no named parameter')
        refuses(['=>', 2, null, ['.', args, 'length']], 'an argument read that is no named parameter')
        refuses(['=>', 2, null, ['.', args, -0]], 'an argument read that is no named parameter')
        refuses(['=>', 1, null, ['[]', [['.', args, 0], args]]], 'the arguments of a function with named parameters')
        // what the executors make of the graph agrees with JavaScript's own
        // function: the `length`, an unused parameter counted, and the
        // binding of missing, explicit `undefined` and extra arguments
        /** @type {(source: string) => (...a: unknown[]) => unknown} */
        const defaultOf = source => /** @type {{ readonly default: (...a: unknown[]) => unknown }} */ (moduleValue(moduleGraph(source))).default
        const f = defaultOf('export default (a, b) => [a, b];')
        /** @type {(a?: unknown, b?: unknown) => unknown} */
        const native = (a, b) => [a, b]
        assertEq(f.length, native.length)
        assertStructurallySame(f(), native())
        assertStructurallySame(f(1), native(1))
        assertStructurallySame(f(undefined, 2), native(undefined, 2))
        // a third argument is passed all the same, as in JavaScript, and
        // no name of the list reaches it
        assertStructurallySame(f(1, 2, 3), [1, 2])
        /** @type {(source: string) => number} */
        const lengthOf = source => defaultOf(source).length
        assertEq(lengthOf('export default a => 1;'), 1)
        assertEq(lengthOf('export default (a, b, c) => 1;'), 3)
        assertEq(lengthOf('const id = x => x; export default id((a, b) => a);'), 2)
        assertEq(lengthOf('export default (...a) => a;'), 0)
        assertEq(lengthOf('export default () => 1;'), 0)
    },
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
                ['{}', [[':', 'a', ['()', 1, ['[]', []]]]]],
                ['{}', [[':', 'a', [',', [1]]]]],
                ['{}', [[':', 'a', ['+', 1, 2]], [':', 'b', 1]]],
                ['{}', [[':', 'a', ['.', 1, 'constructor']]]],
                ['{}', [[':', 'a', ['=>', 0, 7, 1]]]],
                ['{}', [[':', 'default', ['()', 1, ['[]', []]]]]],
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
    },
    // The one operator. `-` binds looser than a step, so a negation under an
    // access is a base the text cannot say without a name — `-1[0]` is
    // `-(1[0])` — and a negated function is no `UnaryExpression`, so it
    // takes a name too. `op12` of two operands is the binary minus, which
    // the language has no spelling for yet.
    neg: () => {
        writes(['-', ['[]', [1]]], 'export default -[1];')
        writes(['-', 'a'], 'export default -"a";')
        // `- -1` and not `--1`, which is the decrement token. The operand
        // here is a container, since a negated *literal* has no text
        writes(['-', ['-', ['[]', []]]], 'export default - -[];')
        // the negation is inside the access, which is where the text puts it
        writes(['-', ['.', ['[]', [1]], 0]], 'export default -[1][0];')
        // and outside it only through a name
        writes(['.', ['-', ['[]', []]], 0], 'const $0=-[];export default $0[0];')
        writes(['.', ['-', ['[]', []]], 'a'], 'const $0=-[];export default $0.a;')
        // a negated function likewise
        writes(['-', ['=>', 0, null, 1]], 'const $0=(...$a)=>1;export default -$0;')
        refuses(['-', 1, 2], 'a binary - node')
        // A call has no spelling yet, and these are the two shapes that
        // cannot take the obvious one when it lands: `-1()` is `-(1())`, so
        // a negative callee has to say that the negation happens first. A
        // group would say it, `(-1)()`, and until the grammar has one a
        // `const` does — the answer an access base already takes, for a
        // negative leaf and a `['-', …]` node alike. These two lines redden
        // the moment a `()` is given a spelling, which is where that has to
        // be decided.
        refuses(['()', -1, ['[]', []]], 'a () node')
        refuses(['()', ['-', 1], ['[]', []]], 'a () node')
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
        writes(['=>', 0, null, ['.', ['args'], 'length']], 'export default (...$a)=>$a.length;')
        writes(['=>', 0, null, ['.', ['args'], 'A_$9']], 'export default (...$a)=>$a.A_$9;')
        writes(['=>', 0, null, ['.', ['args'], '']], 'export default (...$a)=>$a[""];')
        writes(['=>', 0, null, ['.', ['args'], '0a']], 'export default (...$a)=>$a["0a"];')
        writes(['=>', 0, null, ['.', ['args'], 'a-b']], 'export default (...$a)=>$a["a-b"];')
        // a word that denotes a value names a property like any other
        writes(['=>', 0, null, ['.', ['args'], 'NaN']], 'export default (...$a)=>$a.NaN;')
        writes(['=>', 0, null, ['.', ['args'], '_x']], 'export default (...$a)=>$a._x;')
        writes(['=>', 0, null, ['.', ['args'], '$x']], 'export default (...$a)=>$a.$x;')
        // The Kelvin sign lowercases to `k` and is no letter the tokenizer
        // takes, so a key holding one is a key in brackets. The characters
        // are classified by code point for that reason, never by case fold.
        writes(['=>', 0, null, ['.', ['args'], '\u212a']], 'export default (...$a)=>$a["\u212a"];')
        writes(['=>', 0, null, ['.', ['args'], 0]], 'export default (...$a)=>$a[0];')
        writes(['=>', 0, null, ['.', ['args'], 1.5]], 'export default (...$a)=>$a[1.5];')
    },
    // Every keyword is a name after `.`, the six words that denote a value
    // included: a property is named by an `IdentifierName` in JavaScript,
    // and the grammar follows. So the writer has no rule about them — this
    // is the case that would fail if one were needed again, over every
    // keyword rather than over a list someone remembered to update.
    keywords: () => {
        keywords.forEach(k => {
            const written = tryStringify(['=>', 0, null, ['.', ['args'], k]])
            // `arguments` and `with` are on the prototypes, and an access on
            // either has no text at all.
            if (written[0] === 'error') {
                assertEq(written[1], 'a prohibited property name', k)
                return
            }
            assertEq(reads(['=>', 0, null, ['.', ['args'], k]]), `export default (...$a)=>$a.${k};`)
        })
    },
    // A function is written with its parameter and no other, since a body
    // reads its arguments as one node: the parameters are named as a
    // spreadsheet names its columns, by depth, so a body names its own and
    // reaches the ones outside it.
    functions: () => {
        writes(identity, 'export default (...$a)=>$a;')
        writes(['=>', 0, null, ['=>', 0, null, ['args']]], 'export default (...$a)=>(...$b)=>$b;')
        writes(['=>', 0, null, ['[]', [['=>', 0, null, 1]]]], 'export default (...$a)=>[(...$b)=>1];')
        // `$z` then `$aa`: the letters carry past the twenty-sixth body.
        assert(reads(nested(27)).endsWith('(...$y)=>(...$z)=>(...$aa)=>$aa;'))
    },
    // A body whose text opens with `{` is written as a block: `=> {` opens a
    // block and not an object, so the value has to be returned from it. The
    // question is the text's and not the node's — an access on an object
    // literal opens with one too, and reads back as a block just the same.
    block: () => {
        writes(['=>', 0, null, ['{}', [[':', 'x', 1]]]], 'export default (...$a)=>{return {"x":1};};')
        writes(['=>', 0, null, ['.', ['{}', [[':', 'a', 1]]], 'a']], 'export default (...$a)=>{return {"a":1}.a;};')
        writes(['=>', 0, null, ['[]', [1]]], 'export default (...$a)=>[1];')
        writes(['=>', 0, null, ['.', 'x', 'length']], 'export default (...$a)=>"x".length;')
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
        writes(['=>', 0, null, ['[]', [o, o]]], 'export default (...$a)=>{const $a0={};return [$a0,$a0];};')
        writes(['=>', 0, null, ['.', 1, 'x']], 'export default (...$a)=>{const $a0=1;return $a0.x;};')
        writes(['=>', 0, null, ['.', identity, 'length']], 'export default (...$a)=>{const $a0=(...$b)=>$b;return $a0.length;};')
        writes(['=>', 0, null, [',', [['[]', []], 1]]], 'export default (...$a)=>{const $a0=[];return 1;};')
        // the arguments are a body's to name, which no module `const` can
        writes(['=>', 0, null, ['[]', [['[]', [['args']]], ['[]', [['args']]]]]], 'export default (...$a)=>[[$a],[$a]];')
        // one scope per body: the module's `$0`, the outer body's `$a0` and
        // the inner one's `$b0` stand together, each numbering from zero
        writes(
            (() => {
                /** @type {Exp} */
                const m = ['[]', []]
                /** @type {Exp} */
                const inner = ['{}', []]
                return [',', [['[]', [m, m]], ['=>', 0, null, ['[]', [['=>', 0, null, ['[]', [inner, inner]]]]]]]]
            })(),
            'const $0=[];const $1=[$0,$0];export default (...$a)=>[(...$b)=>{const $b0={};return [$b0,$b0];}];')
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
        const slot = i => ['.', ['frame'], i]
        writes(['=>', 0, ['[]', [c]], slot(0)], 'const $0=[1];export default (...$a)=>$0;')
        writes(['[]', [c, ['=>', 0, ['[]', [c]], slot(0)]]], 'const $0=[1];export default [$0,(...$a)=>$0];')
        // the frame's `const` comes before the function's own
        /** @type {Exp} */
        const f = ['=>', 0, ['[]', [c]], ['[]', [slot(0), ['.', ['args'], 0]]]]
        writes(['[]', [f, f]], 'const $0=[1];const $1=(...$a)=>[$0,$a[0]];export default [$1,$1];')
        // a slot read is a base like any name
        writes(['=>', 0, ['[]', [c]], ['.', slot(0), 0]], 'const $0=[1];export default (...$a)=>$0[0];')
        // one slot read twice is one name, and two slots are two
        /** @type {Exp} */
        const d = ['{}', []]
        writes(['=>', 0, ['[]', [c, d]], ['[]', [slot(0), slot(1), slot(0)]]], 'const $0=[1];const $1={};export default (...$a)=>[$0,$1,$0];')
        // inside a body: the arguments and an access take a `const` of the
        // body, and a nested function captures through its parent
        writes(
            ['=>', 0, null, ['=>', 0, ['[]', [['args']]], ['=>', 0, ['[]', [slot(0), ['args']]], ['[]', [slot(0), slot(1), slot(0)]]]]],
            'export default (...$a)=>{const $a0=$a;return (...$b)=>{const $b0=$b;return (...$c)=>[$a0,$b0,$a0];};};')
        writes(
            ['=>', 0, null, ['=>', 0, ['[]', [['.', ['args'], 0]]], ['[]', [slot(0), slot(0)]]]],
            'export default (...$a)=>{const $a0=$a[0];return (...$b)=>[$a0,$a0];};')
        // what the compiler builds is written, two `const`s reading one
        // value among it: the lowering gives them the one slot the
        // analysis sees
        assertEq(
            reads(_defaultExport(moduleGraph('const o=[1]; const x=o[0]; const y=o[0]; export default (...a)=>[x,y];'))),
            'const $0=[1][0];export default (...$a)=>[$0,$0];')
        // where the writer's own order would read the slots in another —
        // here the body's text is the frame's order backwards, and a shared
        // function hoisted above the `return` reads the later slot first —
        // the body names its slots in order before anything else
        writes(['=>', 0, ['[]', [c, d]], ['[]', [slot(1), slot(0)]]], 'const $0=[1];const $1={};export default (...$a)=>{const $a0=$0;const $a1=$1;return [$a1,$a0];};')
        assertEq(
            reads(_defaultExport(moduleGraph('const x=[1]; const y=[2]; export default (...a)=>{const z=x; const f=(...b)=>y; return [z,f,f];};'))),
            'const $0=[1];const $1=[2];export default (...$a)=>{const $a0=$0;const $a1=$1;const $a2=(...$b)=>$a1;return [$a0,$a2,$a2];};')
        // a frame the parser would not build has no text that reads back,
        // and one of the enclosing scope, a comma, has no text yet
        refuses(['=>', -0, null, 1], 'a function whose length is no parameter count')
        refuses(['=>', 1.5, null, 1], 'a function whose length is no parameter count')
        // the writer's own limit: the longest list V8 loads with the same
        // `length`, and one name more is refused
        assert(unwrap(tryStringify(['=>', 0x7fff, null, 1])).endsWith(',$a32766)=>1;'))
        refuses(['=>', 0x8000, null, 1], 'a function whose length is no parameter count')
        refuses(['=>', ['undefined'], null, 1], 'a function whose length is no parameter count')
        refuses(['=>', 0, ['undefined'], 1], 'a frame that is not an array literal')
        refuses(['=>', 0, ['[]', []], 1], 'an empty frame')
        refuses(['=>', 0, ['[]', [1]], slot(0)], 'a frame slot holding a primitive')
        refuses(['=>', 0, ['[]', [['...', c]]], slot(0)], 'a spread')
        refuses(['=>', 0, ['[]', [c, c]], ['[]', [slot(0), slot(1)]]], 'a frame slot that repeats another')
        refuses(['=>', 0, ['[]', [c]], 1], 'a frame slot the body never reads')
        refuses(['=>', 0, ['[]', [c]], slot(1)], 'a frame read that is no slot')
        refuses(['=>', 0, ['[]', [c]], ['.', ['frame'], 'a']], 'a frame read that is no slot')
        refuses(['.', ['frame'], 0], 'a frame read that is no slot')
        refuses(['=>', 0, ['[]', [c]], ['frame']], 'the frame outside a slot read')
        refuses((() => {
            /** @type {Exp} */
            const frame = ['[]', [c]]
            return ['[]', [frame, ['=>', 0, frame, slot(0)]]]
        })(), 'a frame reached from anywhere but its function')
        refuses(['=>', 0, ['[]', [[',', [['[]', []], c]]]], slot(0)], 'a comma outside a scope')
    },
    // Every refusal, by the message it carries: a node kind with no spelling
    // yet, a position a spelling has none in, and a key no literal reads
    // back. Each names the feature that replaces it.
    refuses: () => {
        // A node kind this writer has no spelling for, which is how the
        // feature that adds one is made to add its spelling here too.
        refuses(['+', 1], 'a + node')
        refuses(['[]', [['...', ['[]', []]]]], 'a spread')
        refuses(['{}', [['...', ['[]', []]]]], 'a spread')
        refuses(['.', ['args'], 'b', ['|()', ['args']]], 'a chain step')
        // A node kind with a spelling, in a position that has none.
        refuses(['args'], 'the arguments outside a function')
        // a comma is a scope's own form — a module's root and a function's
        // body are where one is read — so one inside a container has no
        // source spelling until the operator lands
        refuses(['[]', [[',', [1, 2]]]], 'a comma outside a scope')
        refuses(['=>', 0, null, ['[]', [[',', [1, 2]]]]], 'a comma outside a scope')
        // A key no literal spells: a computed one, an object key that is not
        // a string, and the three numbers the tokenizer does not read back.
        refuses(['=>', 0, null, ['.', ['args'], ['Number', ['args']]]], 'an access key that is no literal')
        refuses(['{}', [[':', 1, 2]]], 'an object key that is not a string')
        refuses(['=>', 0, null, ['.', ['args'], NaN]], 'a number key no literal reads back')
        refuses(['=>', 0, null, ['.', ['args'], Infinity]], 'a number key no literal reads back')
        refuses(['=>', 0, null, ['.', ['args'], -0]], 'a number key no literal reads back')
        // A key naming a property of a built-in prototype: the grammar
        // refuses it in either spelling, `.k` and `["k"]` alike, so an
        // access on one has no text at all — `length`, which both languages
        // read as an own property, is the one such name that has.
        refuses(['=>', 0, null, ['.', ['args'], 'constructor']], 'a prohibited property name')
        refuses(['=>', 0, null, ['.', ['args'], '__proto__']], 'a prohibited property name')
        refuses(['=>', 0, null, ['.', ['args'], 'toString']], 'a prohibited property name')
        // The first refusal is the one reported, and nothing after it is
        // written: among the values a statement hoists, and among the
        // statements of a module.
        refuses(
            (() => {
                /** @type {Exp} */
                const bad = ['[]', [['...', 1]]]
                /** @type {Exp} */
                const good = ['{}', []]
                return ['[]', [bad, bad, good, good]]
            })(),
            'a spread')
        refuses([',', [['+', 1], 1]], 'a + node')
        // A comma with no anchor to write: with one operand it would read
        // back as that operand alone, and with none it is no scope. Linking
        // emits neither, at a root or in a body — a comma is built only
        // where an anchor or an unbound import is there to carry.
        refuses([',', [1]], 'a comma with fewer than two operands')
        refuses([',', []], 'a comma with fewer than two operands')
        refuses(['=>', 0, null, [',', [1]]], 'a comma with fewer than two operands')
        refuses(['=>', 0, null, [',', []]], 'a comma with fewer than two operands')
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
    },
    // The writer's one law, over graphs nobody chose: a graph is refused,
    // or its text is read back to the same table. Every case above is a
    // text this module pins; this is the claim that nothing outside them
    // is answered with a plausible wrong value
    // ([DESIGN.md §10](../../../doc/DESIGN.md#10-refuse-what-you-cannot-handle)),
    // which is what a writer whose contract is the round trip may not do,
    // and which four hand-picked accept sets in a row did not catch.
    //
    // The graphs are every shape over every shape over the atoms: 2730 of
    // them, of which 1447 have a text and the rest are refused by name.
    // The capturing shape, a closure, is 320 of the graphs and 148 of the
    // texts; before a body could hold a `const` the writer spelled 47 fewer
    // of the rest, which is what a body's `const`s are worth to it.
    law: () => {
        generated.forEach(e => {
            const written = tryStringify(e)
            if (written[0] === 'error') { return }
            reads(e)
        })
    },
}
