import { anchors, run, sharing, values } from './module.f.mjs'
import { _stringifyTree } from '../module.f.mjs'
import { unwrap } from '../../types/result/module.f.mjs'
import { assert, assertEq, assertStructurallySame } from '../../asserts/module.f.mjs'

/** Whether the sweep finds a shared node in a body with no imports, given its values. @type {(body: import('./types.ts').AstBody) => boolean} */
const sharedOf = body => sharing(body)([])(unwrap(values(body)([]))).shared

/**
 * Whether the sweep finds a shared node in a body holding an operator,
 * where `values` has none to compute — `sharing` alone, an operator's own
 * value being none `values` could give it. Every entry but the export
 * stands in as `['array', []]` and needs no real value, its own value,
 * `[]`, taking the place `values` would have computed; a leaf entry would
 * need its real one instead, `containerNode` reading only a referenced
 * entry's containerness.
 *
 * @type {(body: readonly import('./types.ts').AstConst[]) => boolean}
 */
const sharedWithOperator = body => sharing(body)([])(body.map((_, i) => i < body.length - 1 ? [] : null)).shared

/** What the sweep says of a body over `imports`, given the values the body has over them. @type {(imports: readonly import('./types.ts').Import[]) => (body: import('./types.ts').AstBody) => import('./types.ts').Sharing} */
const sharingWith = imports => body => sharing(body)(imports)(unwrap(values(body)(imports.map(m => m.value))))

/** @type {import('./types.ts').AstImport} */
const a = { specifier: './a', json: false }

/** @type {import('./types.ts').AstImport} */
const b = { specifier: './b', json: false }

/** @type {(module: import('./types.ts').AstModule) => string} */
const anchorsOf = module => {
    const { consts, imports } = anchors(module)(module[0])
    return `consts ${consts.join()}; imports ${imports.join()}`
}

export const proof = {
    test: () => {
        const djs = unwrap(run([1])([]))
        const result = _stringifyTree(djs)
        assertEq(result, '1')
    },
    testCref: () => {
        const djs = unwrap(run([1, 2, 3, 4, 5, ['cref', 3]])([11, 12, 13, 14, 15]))
        const result = _stringifyTree(djs)
        assertEq(result, '4')
    },
    testAref: () => {
        const djs = unwrap(run([1, 2, 3, 4, 5, ['aref', 3]])([11, 12, 13, 14, 15]))
        const result = _stringifyTree(djs)
        assertEq(result, '14')
    },
    testArray: () => {
        const djs = unwrap(run([1, 2, 3, 4, 5, ['array', [['aref', 3], ['cref', 3]]]])([11, 12, 13, 14, 15]))
        const result = _stringifyTree(djs)
        assertEq(result, '[14,4]')
    },
    testObj: () => {
        const djs = unwrap(run([1, 2, 3, 4, 5, ['object', [['key', ['object', [['key2', ['array', [['aref', 3], ['cref', 3]]]]]]]]]])([11, 12, 13, 14, 15]))
        const result = _stringifyTree(djs)
        if (result !== '{"key":{"key2":[14,4]}}') { throw result }
    },
    testBool: () => {
        assertEq(_stringifyTree(unwrap(run([true])([]))), 'true')
        assertEq(_stringifyTree(unwrap(run([false])([]))), 'false')
    },
    testStr: () => {
        assertEq(_stringifyTree(unwrap(run(['hello'])([]))), '"hello"')
    },
    testNull: () => {
        assertEq(_stringifyTree(unwrap(run([null])([]))), 'null')
    },
    testBigint: () => {
        assertEq(_stringifyTree(unwrap(run([42n])([]))), '42n')
    },
    testUndefined: () => {
        assertEq(_stringifyTree(unwrap(run([undefined])([]))), 'undefined')
    },
    // a function has no value: what it denotes is its EDAG, and a data
    // module's value has no function in it — its arguments likewise
    func: () => {
        assertStructurallySame(run([['=>', [['args']]]])([]), ['error', 'a function has no value'])
        assertStructurallySame(values([['=>', [1]], 2])([]), ['error', 'a function has no value'])
        assertStructurallySame(run([['args']])([]), ['error', 'a function has no value'])
        // a function names nothing outside itself, so it is a leaf to the
        // sweep — a leaf, not a reference: read as one, its body would pass
        // for an import's index, and `0` would mark the import reached
        assertEq(anchorsOf([[a], [['=>', [['args']]], 1]]), 'consts 0; imports 0')
        assertEq(anchorsOf([[a], [['=>', [0]], 1]]), 'consts 0; imports 0')
        assertEq(anchorsOf([[a], [['=>', [0]], ['cref', 0]]]), 'consts ; imports 0')
        assertEq(anchorsOf([[a], [['=>', [['array', [['args'], ['args']]]]], ['cref', 0]]]), 'consts ; imports 0')
        // a body `const` is an entry of the function's own body, so a `cref`
        // in it names that entry and not the module's
        assertEq(anchorsOf([[a], [['=>', [['array', []], ['cref', 0]]], ['cref', 0]]]), 'consts ; imports 0')
    },
    // A call has no value: this evaluator has no function to apply, so what
    // a call returns is not a value it can reach. To the sweep it is not a
    // leaf, though — its callee and its arguments are written where they
    // stand, so what they name is reached.
    call: () => {
        assertStructurallySame(run([['()', ['args'], []]])([]), ['error', 'a call has no value'])
        assertStructurallySame(run([['()', 1, [2]]])([]), ['error', 'a call has no value'])
        assertStructurallySame(values([['()', 1, []], 2])([]), ['error', 'a call has no value'])
        // the callee is reached
        assertEq(anchorsOf([[a], [['array', []], ['()', ['cref', 0], []]]]), 'consts ; imports 0')
        // and each argument
        assertEq(anchorsOf([[a], [['array', []], ['()', 1, [['cref', 0]]]]]), 'consts ; imports 0')
        assertEq(anchorsOf([[a], [['array', []], ['()', 1, [2, ['cref', 0]]]]]), 'consts ; imports 0')
        // what it does not reach is anchored as ever
        assertEq(anchorsOf([[a], [['array', []], ['()', 1, [2]]]]), 'consts 0; imports 0')
    },
    // A binary operator and a bitwise not have no value here — `+` alone
    // needs `ToPrimitive`, and folding the rest while leaving it a node
    // would draw an inconsistent line — so `noOperatorValue` refuses every
    // one of them, `run` reaching it exactly where it reaches
    // `noFunctionValue`/`noCallValue`. Unary `-` alone still folds, told
    // from the binary one by length. Neither is a leaf to the sweep: both
    // operands are written where they stand, so what they name is reached.
    operator: () => {
        assertStructurallySame(run([['+', 1, 2]])([]), ['error', 'an operator has no value'])
        assertStructurallySame(run([['-', 1, 2]])([]), ['error', 'an operator has no value'])
        assertStructurallySame(run([['~', 1]])([]), ['error', 'an operator has no value'])
        assertStructurallySame(values([['===', 1, 2], 3])([]), ['error', 'an operator has no value'])
        // the unary `-` this refusal does not reach
        assertStructurallySame(run([['-', 1]])([]), ['ok', -1])
        // both operands of a binary operator are reached
        assertEq(anchorsOf([[a], [['array', []], ['+', ['cref', 0], 1]]]), 'consts ; imports 0')
        assertEq(anchorsOf([[a], [['array', []], ['+', 1, ['cref', 0]]]]), 'consts ; imports 0')
        assertEq(anchorsOf([[a], [['array', []], ['~', ['cref', 0]]]]), 'consts ; imports 0')
        // what it does not reach is anchored as ever
        assertEq(anchorsOf([[a], [['array', []], ['+', 1, 2]]]), 'consts 0; imports 0')
    },
    // Stage B's lazy operators and the conditional have no value here
    // either, refused the same way. To the sweep their left operand and
    // condition are reached as any operand is; their right operand and arms
    // are lazy positions, and what only those name is anchored — see
    // `anchors.lazy` below.
    lazy: () => {
        assertStructurallySame(run([['&&', 1, 2]])([]), ['error', 'an operator has no value'])
        assertStructurallySame(run([['||', 1, 2]])([]), ['error', 'an operator has no value'])
        assertStructurallySame(run([['??', 1, 2]])([]), ['error', 'an operator has no value'])
        assertStructurallySame(run([['?:', 1, 2, 3]])([]), ['error', 'an operator has no value'])
        assertStructurallySame(values([['?:', true, 1, 2], 3])([]), ['error', 'an operator has no value'])
        assertEq(anchorsOf([[a], [['array', []], ['&&', ['cref', 0], 1]]]), 'consts ; imports 0')
        assertEq(anchorsOf([[a], [['array', []], ['||', ['cref', 0], 1]]]), 'consts ; imports 0')
        assertEq(anchorsOf([[a], [['array', []], ['??', ['cref', 0], 1]]]), 'consts ; imports 0')
        assertEq(anchorsOf([[a], [['array', []], ['?:', ['cref', 0], 1, 2]]]), 'consts ; imports 0')
        assertEq(anchorsOf([[a], [['array', []], ['&&', ['aref', 0], ['cref', 0]]]]), 'consts 0; imports ')
    },
    // what the sweep from the export leaves out, by index, less what the
    // left-out entries reach themselves
    anchors: {
        nothing: () => {
            assertEq(anchorsOf([[], [1]]), 'consts ; imports ')
            assertEq(anchorsOf([[a], [['aref', 0]]]), 'consts ; imports ')
            assertEq(anchorsOf([[a], [['aref', 0], ['cref', 0]]]), 'consts ; imports ')
            assertEq(anchorsOf([[a], [['array', []], ['object', [['k', ['array', [['cref', 0], ['aref', 0]]]]]]]]), 'consts ; imports ')
        },
        // a member a later duplicate shadows is applied by the EDAG's object
        // constructor, so a reference in it reaches, where for sharing it
        // does not
        shadowed: () => {
            assertEq(anchorsOf([[a], [['array', []], ['object', [['x', ['cref', 0]], ['x', ['aref', 0]], ['x', 0]]]]]), 'consts ; imports ')
        },
        consts: () => {
            assertEq(anchorsOf([[], [['array', []], 1]]), 'consts 0; imports ')
            assertEq(anchorsOf([[], [['array', []], ['cref', 0], ['array', [['cref', 0]]], ['cref', 0]]]), 'consts 2; imports ')
        },
        // A reference through a lazy position — the right operand of
        // `&&`/`||`/`??`, either arm of `?:` — reaches nothing for
        // anchoring: the EDAG establishes it only when the operator
        // decides to, where the source's own `const c = null.x;` throws at
        // load whatever later code does with `c`. So `[a && c, b && c]`
        // anchors `c`, `[c, a && c]` does not — one eager path in is enough
        // — and the rule holds one level down: an unreached entry excuses
        // another's anchor only where it reaches it eagerly, so `const d =
        // null.x; const c = a && d; export default b && c;` anchors both,
        // since anchoring `c` establishes `a && d` and not `d`. The worked
        // examples of `spec/todo/2340-operators.md`'s subtraction rule.
        lazy: () => {
            /** `a`, `b`, `c`: three container entries, `c` the one at stake. @type {readonly import('./types.ts').AstConst[]} */
            const abc = [['array', []], ['array', []], ['array', []]]
            assertEq(anchorsOf([[], [...abc, ['array', [['&&', ['cref', 0], ['cref', 2]], ['&&', ['cref', 1], ['cref', 2]]]]]]), 'consts 2; imports ')
            /** `a` and `c` alone. @type {readonly import('./types.ts').AstConst[]} */
            const ac = [['array', []], ['array', []]]
            assertEq(anchorsOf([[], [...ac, ['array', [['cref', 1], ['&&', ['cref', 0], ['cref', 1]]]]]]), 'consts ; imports ')
            assertEq(anchorsOf([[], [...ac, ['array', [['&&', ['cref', 0], ['cref', 1]], ['cref', 1]]]]]), 'consts ; imports ')
            // each lazy position, and each operator's eager one
            assertEq(anchorsOf([[], [['array', []], ['||', 1, ['cref', 0]]]]), 'consts 0; imports ')
            assertEq(anchorsOf([[], [['array', []], ['??', 1, ['cref', 0]]]]), 'consts 0; imports ')
            assertEq(anchorsOf([[], [['array', []], ['?:', 1, ['cref', 0], 2]]]), 'consts 0; imports ')
            assertEq(anchorsOf([[], [['array', []], ['?:', 1, 2, ['cref', 0]]]]), 'consts 0; imports ')
            assertEq(anchorsOf([[], [['array', []], ['?:', ['cref', 0], 1, 2]]]), 'consts ; imports ')
            // an import likewise: evaluated at load, whatever reaches it
            assertEq(anchorsOf([[a], [['&&', 1, ['aref', 0]]]]), 'consts ; imports 0')
            assertEq(anchorsOf([[a], [['?:', 1, ['aref', 0], 2]]]), 'consts ; imports 0')
            assertEq(anchorsOf([[a], [['?:', ['aref', 0], 1, 2]]]), 'consts ; imports ')
            // the transitive case: `d`, `c = a && d`, `b && c`
            assertEq(anchorsOf([[], [['array', []], ['array', []], ['array', []], ['&&', ['cref', 0], ['cref', 2]], ['&&', ['cref', 1], ['cref', 3]]]]), 'consts 2,3; imports ')
            // where `c` reaches `d` eagerly, `c = d && 1`, anchoring `c` covers `d`
            assertEq(anchorsOf([[], [['array', []], ['array', []], ['&&', ['cref', 0], 1], ['&&', ['cref', 1], ['cref', 2]]]]), 'consts 2; imports ')
            // an alias is the node it names: a `const` that is a bare
            // reference to `c` anchors nothing of its own, and `c` reached
            // only through the alias's lazy use is anchored as `c`
            assertEq(anchorsOf([[], [['array', []], ['cref', 0], ['&&', 1, ['cref', 1]]]]), 'consts 0; imports ')
            // deeper inside a lazy operand is lazy still, and an eager
            // position inside a lazy operand is lazy from the export's view
            assertEq(anchorsOf([[], [['array', []], ['&&', 1, ['array', [['+', ['cref', 0], 1]]]]]]), 'consts 0; imports ')
            assertEq(anchorsOf([[], [['array', []], ['+', 1, ['&&', 1, ['cref', 0]]]]]), 'consts 0; imports ')
        },
        // an access reaches its base
        access: () => {
            assertEq(anchorsOf([[], [['object', []], ['.', ['cref', 0], 'x']]]), 'consts ; imports ')
            assertEq(anchorsOf([[a], [['array', [['.', ['aref', 0], 0]]]]]), 'consts ; imports ')
        },
        imports: () => {
            assertEq(anchorsOf([[a], [1]]), 'consts ; imports 0')
            assertEq(anchorsOf([[a, b], [['aref', 1]]]), 'consts ; imports 0')
            assertEq(anchorsOf([[a, b], [['aref', 1], 1]]), 'consts ; imports 0,1')
        },
        // an unreached entry another unreached entry reaches is anchored
        // through it: only the roots of the unreached part are named
        roots: () => {
            assertEq(anchorsOf([[], [['array', []], ['array', [['cref', 0]]], 1]]), 'consts 1; imports ')
            assertEq(anchorsOf([[], [['array', []], ['.', ['cref', 0], 'x'], 1]]), 'consts 1; imports ')
            assertEq(anchorsOf([[a], [['array', [['aref', 0]]], 1]]), 'consts 0; imports ')
            assertEq(anchorsOf([[a, b], [['array', [['aref', 1]]], ['cref', 0], 1]]), 'consts 0; imports 0')
            // a reached entry's references do not anchor: what it reaches is reached
            assertEq(anchorsOf([[a], [['array', []], ['array', [['cref', 0], ['aref', 0]]], ['cref', 1]]]), 'consts ; imports ')
        },
        // a `const` that is a bare reference is the node it names, not a
        // node of its own: it anchors nothing, and what it names is anchored
        // where any reference to that node would be
        alias: () => {
            assertEq(anchorsOf([[], [['array', []], ['cref', 0], ['cref', 0]]]), 'consts ; imports ')
            assertEq(anchorsOf([[], [['array', []], ['cref', 0], ['array', [['cref', 0]]], 1]]), 'consts 2; imports ')
            assertEq(anchorsOf([[], [['array', []], ['cref', 0], 1]]), 'consts 0; imports ')
            assertEq(anchorsOf([[], [['array', []], ['cref', 0], ['cref', 1], 1]]), 'consts 0; imports ')
            assertEq(anchorsOf([[a], [['aref', 0], 1]]), 'consts ; imports 0')
            assertEq(anchorsOf([[a], [['aref', 0], ['cref', 0]]]), 'consts ; imports ')
            assertEq(anchorsOf([[a], [['aref', 0], ['array', [['cref', 0]]], 1]]), 'consts 1; imports ')
        },
        // two imports are one node where the nodes given for them are one —
        // as the linker binds two imports of one module — and the first
        // names it
        sameImport: () => {
            const x = {}
            /** @type {(module: import('./types.ts').AstModule) => string} */
            const bound = module => {
                const { consts, imports } = anchors(module)([x, x])
                return `consts ${consts.join()}; imports ${imports.join()}`
            }
            assertEq(bound([[a, b], [['aref', 0]]]), 'consts ; imports ')
            assertEq(bound([[a, b], [['aref', 1]]]), 'consts ; imports ')
            assertEq(bound([[a, b], [1]]), 'consts ; imports 0')
            assertEq(bound([[a, b], [['array', [['aref', 1]]], 1]]), 'consts 0; imports ')
        },
    },
    // a property access reads its base's own property — never the
    // prototype chain — and `undefined` where there is none; a `null` or
    // `undefined` base is the failure JavaScript throws for
    access: {
        own: () => {
            assertEq(_stringifyTree(unwrap(run([['object', [['b', ['array', [1, 2]]]]], ['.', ['cref', 0], 'b']])([]))), '[1,2]')
            assertEq(unwrap(run([['object', [['b', ['array', [1, 2]]]]], ['.', ['.', ['cref', 0], 'b'], 1]])([])), 2)
            assertEq(unwrap(run([['object', [['b', ['array', [1, 2]]]]], ['.', ['.', ['cref', 0], 'b'], 'length']])([])), 2)
            assertEq(unwrap(run([['.', ['aref', 0], 'length']])(['ab'])), 2)
            assertEq(unwrap(run([['.', ['aref', 0], '0']])(['ab'])), 'a')
        },
        none: () => {
            assertEq(unwrap(run([['object', []], ['.', ['cref', 0], 'toString']])([])), undefined)
            assertEq(unwrap(run([['array', []], ['.', ['cref', 0], 'map']])([])), undefined)
            assertEq(unwrap(run([1, ['.', ['cref', 0], 'x']])([])), undefined)
            assertEq(unwrap(run([true, ['.', ['cref', 0], 'x']])([])), undefined)
            assertEq(unwrap(run([1n, ['.', ['cref', 0], 'x']])([])), undefined)
        },
        failure: () => {
            const [tag, message] = run([null, ['.', ['cref', 0], 'x']])([])
            assertEq(tag, 'error')
            assertEq(message, 'cannot read property "x" of null')
            const [tag2, message2] = run([['object', []], ['.', ['.', ['cref', 0], 'a'], 'b']])([])
            assertEq(tag2, 'error')
            assertEq(message2, 'cannot read property "b" of undefined')
            assertEq(run([undefined, ['array', [['.', ['cref', 0], 0]]]])([])[0], 'error')
            assertEq(run([undefined, ['object', [['k', ['.', ['cref', 0], 0]]]]])([])[0], 'error')
        },
        // every entry's value, in order
        all: () => {
            assertEq(_stringifyTree(unwrap(values([['array', [1]], ['.', ['cref', 0], 0], ['array', [['cref', 1], ['cref', 1]]]])([]))), '[[1],1,[1,1]]')
        },
    },
    // Two references share a node when one's keys are the other's or a
    // prefix of them, and the node they reach is a container; the values
    // say which, so `a.x` twice on a leaf `x` shares nothing.
    sharing: {
        whole: () => {
            assert(sharedOf([['array', []], ['array', [['cref', 0], ['cref', 0]]]]))
            assert(!sharedOf([1, ['array', [['cref', 0], ['cref', 0]]]]))
        },
        // a binary operator's operands are reached exactly as a call's
        // arguments are, and a bitwise not's the same way a call's callee is
        operator: () => {
            assert(sharedWithOperator([['array', []], ['+', ['cref', 0], ['cref', 0]]]))
            assert(!sharedWithOperator([['array', []], ['array', []], ['+', ['cref', 0], ['cref', 1]]]))
            assert(sharedWithOperator([['array', []], ['array', [['cref', 0], ['~', ['cref', 0]]]]]))
        },
        // a lazy operand counts for sharing exactly as an eager one: the
        // value may be it, so a node reached twice through lazy positions
        // is shared — identity is indifferent to laziness, only anchoring
        // is not
        lazy: () => {
            assert(sharedWithOperator([['array', []], ['array', [['&&', 1, ['cref', 0]], ['||', 1, ['cref', 0]]]]]))
            assert(sharedWithOperator([['array', []], ['??', ['cref', 0], ['cref', 0]]]))
            assert(sharedWithOperator([['array', []], ['?:', 1, ['cref', 0], ['cref', 0]]]))
            assert(sharedWithOperator([['array', []], ['array', [['cref', 0], ['?:', ['cref', 0], 1, 2]]]]))
            assert(!sharedWithOperator([['array', []], ['array', []], ['?:', ['cref', 0], ['cref', 1], 1]]))
        },
        access: () => {
            /** @type {readonly import('./types.ts').AstConst[]} */
            const container = [['object', [['x', ['array', []]], ['y', ['array', []]]]]]
            assert(sharedOf([...container, ['array', [['.', ['cref', 0], 'x'], ['.', ['cref', 0], 'x']]]]))
            assert(sharedOf([...container, ['array', [['cref', 0], ['.', ['cref', 0], 'x']]]]))
            assert(!sharedOf([...container, ['array', [['.', ['cref', 0], 'x'], ['.', ['.', ['cref', 0], 'x'], 'length']]]]))
            assert(!sharedOf([...container, ['array', [['.', ['cref', 0], 'x'], ['.', ['cref', 0], 'y']]]]))
            assert(!sharedOf([['object', [['x', 1]]], ['array', [['.', ['cref', 0], 'x'], ['.', ['cref', 0], 'x']]]]))
            assert(!sharedOf([['object', []], ['array', [['.', ['cref', 0], 'x'], ['.', ['cref', 0], 'x']]]]))
        },
        // an entry reached through an access is walked along the access's
        // keys only: what lies under another member is not in the value
        routes: () => {
            /** @type {readonly import('./types.ts').AstConst[]} */
            const a = [['array', []], ['object', [['s', 1], ['o', ['array', [['cref', 0], ['cref', 0]]]]]]]
            assert(!sharedOf([...a, ['.', ['cref', 1], 's']]))
            assert(sharedOf([...a, ['.', ['cref', 1], 'o']]))
            assert(sharedOf([...a, ['cref', 1]]))
            assert(!sharedOf([...a, ['.', ['.', ['cref', 1], 'o'], 0]]))
            assert(!sharedOf([...a, ['array', [['.', ['cref', 1], 's'], ['.', ['cref', 1], 's']]]]))
            assert(!sharedOf([...a, ['.', ['cref', 1], 'length']]))
            assert(!sharedOf([['array', [['array', []]]], ['.', ['.', ['cref', 0], 'length'], 0]]))
        },
        // `0` and `"0"` name one element; a node inside another is reached
        // twice when both are; one node under two keys is a `const`
        // referenced twice inside the base, counted there
        keys: () => {
            assert(sharedOf([['array', [['array', []]]], ['array', [['.', ['cref', 0], 0], ['.', ['cref', 0], '0']]]]))
            assert(!sharedOf([['array', [['array', []]]], ['array', [['.', ['cref', 0], 0], ['.', ['cref', 0], '00']]]]))
            assert(!sharedOf([['array', []], ['array', [['cref', 0]]], ['array', [['.', ['cref', 1], 0], ['.', ['cref', 1], '00']]]]))
            assert(sharedOf([['array', [['array', [['array', []]]]]], ['array', [['.', ['.', ['cref', 0], 0], 0], ['.', ['cref', 0], 0]]]]))
            assert(sharedOf([['array', []], ['object', [['x', ['cref', 0]], ['y', ['cref', 0]]]], ['array', [['.', ['cref', 1], 'x'], ['.', ['cref', 1], 'y']]]]))
        },
        imports: () => {
            /** @type {readonly import('./types.ts').Import[]} */
            const imports = [{ id: 'm', value: { x: [1], y: [2], z: 3 }, shared: false, reaches: [] }]
            const over = sharingWith(imports)
            assert(over([['array', [['.', ['aref', 0], 'x'], ['.', ['aref', 0], 'x']]]]).shared)
            assert(!over([['array', [['.', ['aref', 0], 'x'], ['.', ['aref', 0], 'y']]]]).shared)
            assert(!over([['array', [['.', ['aref', 0], 'z'], ['.', ['aref', 0], 'z']]]]).shared)
            assert(over([['array', [['aref', 0], ['.', ['aref', 0], 'x']]]]).shared)
            assert(!over([['array', [['aref', 0], ['.', ['aref', 0], 'z']]]]).shared)
            assertEq(over([['array', [['.', ['aref', 0], 'x'], ['.', ['aref', 0], 'y']]]]).reaches.join(), 'm')
            assertEq(over([['array', [['.', ['aref', 0], 'z']]]]).reaches.join(), '')
            // an import the export does not reach is not reached, whatever it holds
            /** @type {readonly import('./types.ts').Import[]} */
            const two = [...imports, { id: 'n', value: [1], shared: false, reaches: [] }]
            assertEq(sharing([['.', ['aref', 0], 'x']])(two)([[1]]).reaches.join(), 'm')
            // a module's id may spell a `const`'s index, and is another group
            /** @type {readonly import('./types.ts').Import[]} */
            const zero = [{ id: '0', value: [], shared: false, reaches: [] }]
            assert(!sharingWith(zero)([['array', []], ['array', [['cref', 0], ['aref', 0]]]]).shared)
        },
    },
    // A chain of operators, as deep as the source that built it: `refsOf`
    // walks one with an explicit stack rather than recursion, so 5,000
    // terms — the depth `fjs/fsc/parser/proof.f.mjs`'s own `stackSafety`
    // uses — cost no call stack, left-associative for a binary operator and
    // right-associative for `-`/`~` alike.
    stackSafety: () => {
        // a reference at the deep end of a left-associative chain is still
        // found, and reached exactly once — `refsOf` never revisits a node
        // through the chain it flattens
        /** @type {import('./types.ts').AstConst} */
        let plus = ['cref', 0]
        for (let i = 0; i < 5000; i++) { plus = ['+', plus, 1] }
        assert(!sharedWithOperator([['array', []], plus]))
        // a right-associative chain of negations, `refsOf`'s other shape
        /** @type {import('./types.ts').AstConst} */
        let neg = ['cref', 0]
        for (let i = 0; i < 5000; i++) { neg = ['-', neg] }
        assert(!sharedWithOperator([['array', []], neg]))
        // a lazy chain, and a conditional nested through either arm, at
        // the depth the parser's own `lazyStackCost` proves, under both
        // views — the one that follows a lazy position and the one that
        // stops at it
        /** @type {import('./types.ts').AstConst} */
        let and = ['cref', 0]
        for (let i = 0; i < 20000; i++) { and = ['&&', and, ['cref', 0]] }
        assert(sharedWithOperator([['array', []], and]))
        assertEq(anchorsOf([[], [['array', []], and]]), 'consts ; imports ')
        /** @type {import('./types.ts').AstConst} */
        let otherwise = ['cref', 0]
        for (let i = 0; i < 20000; i++) { otherwise = ['?:', 1, 2, otherwise] }
        assert(!sharedWithOperator([['array', []], otherwise]))
        assertEq(anchorsOf([[], [['array', []], otherwise]]), 'consts 0; imports ')
        /** @type {import('./types.ts').AstConst} */
        let then = ['cref', 0]
        for (let i = 0; i < 20000; i++) { then = ['?:', ['cref', 0], then, 2] }
        assert(sharedWithOperator([['array', []], then]))
        assertEq(anchorsOf([[], [['array', []], then]]), 'consts ; imports ')
    },
}
