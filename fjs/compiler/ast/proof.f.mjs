import { anchors, binaryTags, eagerLayers, isBinary, isInlinedCall, isLazy, lazyLayers, readCaptures } from './module.f.mjs'
import { definedValues } from '../../types/object/module.f.mjs'
import { assert, assertEq, assertStructurallySame } from '../../asserts/module.f.mjs'

const a = { specifier: './a', json: false, name: 'default' }

/** @type {import('./types.ts').AstImport} */
const b = { specifier: './b', json: false, name: 'default' }

/** @type {(module: import('./types.ts').AstModule) => string} */
const anchorsOf = module => {
    const { consts, imports } = anchors(module)(module[0])
    return `consts ${consts.join()}; imports ${imports.join()}`
}

export const proof = {
    // Function bodies and their references belong to their own scope.
    func: () => {
        // a function names nothing outside itself, so it is a leaf to the
        // sweep — a leaf, not a reference: read as one, its body would pass
        // for an import's index, and `0` would mark the import reached
        assertEq(anchorsOf([[a], [['=>', 0, [['rest']]], 1]]), 'consts 0; imports 0')
        assertEq(anchorsOf([[a], [['=>', 0, [0]], 1]]), 'consts 0; imports 0')
        assertEq(anchorsOf([[a], [['=>', 0, [0]], ['cref', 0]]]), 'consts ; imports 0')
        assertEq(anchorsOf([[a], [['=>', 0, [['array', [['rest'], ['rest']]]]], ['cref', 0]]]), 'consts ; imports 0')
        // a body `const` is an entry of the function's own body, so a `cref`
        // in it names that entry and not the module's
        assertEq(anchorsOf([[a], [['=>', 0, [['array', []], ['cref', 0]]], ['cref', 0]]]), 'consts ; imports 0')
    },
    // Calls reach their callee and arguments in the enclosing scope.
    call: () => {
        // the callee is reached
        assertEq(anchorsOf([[a], [['array', []], ['()', ['cref', 0], []]]]), 'consts ; imports 0')
        // and each argument
        assertEq(anchorsOf([[a], [['array', []], ['()', 1, [['cref', 0]]]]]), 'consts ; imports 0')
        assertEq(anchorsOf([[a], [['array', []], ['()', 1, [2, ['cref', 0]]]]]), 'consts ; imports 0')
        // what it does not reach is anchored as ever
        assertEq(anchorsOf([[a], [['array', []], ['()', 1, [2]]]]), 'consts 0; imports 0')
    },
    // The call the lowering inlines: no arguments, a parameterless function
    // written at the call, reading no rest array. Every other call stays
    // one.
    // A chain's base, and a guarded call's callee, are established
    // whatever the guard decides; its steps' arguments, and a guarded
    // call's own, only where the chain goes on — lazy, so a `const` read
    // there alone keeps its anchor, as one under `&&`'s right operand does
    chains: () => {
        assertEq(anchorsOf([[a], [['array', []], ['?.', ['cref', 0], 'b']]]), 'consts ; imports 0')
        assertEq(anchorsOf([[a], [['array', []], ['?.()', ['cref', 0], []]]]), 'consts ; imports 0')
        assertEq(anchorsOf([[a], [['array', []], ['?.', 1, 'b', ['|()', [['cref', 0]]]]]]), 'consts 0; imports 0')
        assertEq(anchorsOf([[a], [['array', []], ['?.', 1, 'b', ['|.', 'c', ['|?.()', [['...', ['cref', 0]]]]]]]]), 'consts 0; imports 0')
        assertEq(anchorsOf([[a], [['array', []], ['?.()', 1, [['cref', 0]]]]]), 'consts 0; imports 0')
        assertEq(anchorsOf([[a], [['array', []], ['.', 1, 'b', ['|?.()', [['cref', 0]]]]]]), 'consts 0; imports 0')
        assertEq(anchorsOf([[a], [['array', []], ['.', 1, 'b', ['|?.()', [], ['|!()', [['cref', 0]]]]]]]), 'consts 0; imports 0')
        // a body reads its rest array through a chain anywhere in it
        assert(!isInlinedCall(['()', ['=>', 0, [['?.', ['rest'], 'b']]], []]))
        assert(!isInlinedCall(['()', ['=>', 0, [['?.', 1, 'b', ['|()', [['rest']]]]]], []]))
        assert(!isInlinedCall(['()', ['=>', 0, [['?.()', 1, [['rest']]]]], []]))
        assert(!isInlinedCall(['()', ['=>', 0, [['.', 1, 'b', ['|?.()', [], ['|.', 'c', ['|()', [['...', ['rest']]]]]]]]], []]))
        assert(isInlinedCall(['()', ['=>', 0, [['?.', 1, 'b', ['|.', 'c']]]], []]))
    },
    inlined: () => {
        assert(isInlinedCall(['()', ['=>', 0, [1]], []]))
        assert(isInlinedCall(['()', ['=>', 0, [['fref', 0]], [['cref', 0]]], []]))
        // a nested function's own rest array is its own
        assert(isInlinedCall(['()', ['=>', 0, [['=>', 0, [['rest']]]]], []]))
        assert(!isInlinedCall(['()', ['=>', 0, [1]], [2]]))
        assert(!isInlinedCall(['()', ['=>', 1, [1]], []]))
        assert(!isInlinedCall(['()', ['cref', 0], []]))
        assert(!isInlinedCall(['()', 1, []]))
        // the rest array read anywhere in the body, a nested function's
        // captures included, outside a nested function's body
        assert(!isInlinedCall(['()', ['=>', 0, [['rest']]], []]))
        assert(!isInlinedCall(['()', ['=>', 0, [['array', [['rest']]]]], []]))
        assert(!isInlinedCall(['()', ['=>', 0, [['object', [[':', 'a', ['rest']]]]]], []]))
        assert(!isInlinedCall(['()', ['=>', 0, [['()', ['rest'], []]]], []]))
        assert(!isInlinedCall(['()', ['=>', 0, [['()', 1, [['rest']]]]], []]))
        assert(!isInlinedCall(['()', ['=>', 0, [['.', ['rest'], 0]]], []]))
        assert(!isInlinedCall(['()', ['=>', 0, [['-', ['rest']]]], []]))
        assert(!isInlinedCall(['()', ['=>', 0, [['&&', 1, ['rest']]]], []]))
        assert(!isInlinedCall(['()', ['=>', 0, [['=>', 0, [['fref', 0]], [['rest']]]]], []]))
        assert(!isInlinedCall(['()', ['=>', 0, [1, ['rest']]], []]))
        // To the sweep such a call is its body where it stands: a capture
        // is reached as the body reaches it — eagerly through the value or
        // through an entry the value does not reach, which the lowering
        // anchors at the call, and lazily where the body's own lazy
        // position holds it — and not by being captured.
        /** @type {(body: import('./types.ts').AstBody) => string} */
        const inlining = body => anchorsOf([[a], [['array', []], ['()', ['=>', 0, body, [['cref', 0]]], []]]])
        assertEq(inlining([['fref', 0]]), 'consts ; imports 0')
        assertEq(inlining([['array', [['fref', 0]]], 1]), 'consts ; imports 0')
        assertEq(inlining([['&&', 1, ['fref', 0]]]), 'consts 0; imports 0')
        assertEq(inlining([['?:', 1, ['fref', 0], 2]]), 'consts 0; imports 0')
        assertEq(inlining([['&&', ['fref', 0], 1]]), 'consts ; imports 0')
        // a body `const` naming the capture is the capture, reached where
        // the `const` is; an unused alias reaches nothing
        assertEq(inlining([['fref', 0], ['cref', 0]]), 'consts ; imports 0')
        assertEq(inlining([['fref', 0], 1]), 'consts 0; imports 0')
        assertEq(inlining([['array', [['fref', 0]]], ['.', ['cref', 0], 0]]), 'consts ; imports 0')
        // a nested function capturing through the body establishes its
        // frame where it is made
        assertEq(inlining([['=>', 0, [['fref', 0]], [['fref', 0]]]]), 'consts ; imports 0')
        // an import is a capture like any other
        assertEq(anchorsOf([[a], [['()', ['=>', 0, [['&&', 1, ['fref', 0]]], [['aref', 0]]], []]]]), 'consts ; imports 0')
        assertEq(anchorsOf([[a], [['()', ['=>', 0, [['fref', 0]], [['aref', 0]]], []]]]), 'consts ; imports ')
        // a call that is not inlined still reaches what its function
        // captures, whatever position the body reads it in
        assertEq(anchorsOf([[a], [['array', []], ['()', ['=>', 0, [['&&', 1, ['fref', 0]]], [['cref', 0]]], [1]]]]), 'consts ; imports 0')
        // inside a function body a slot of the frame is a reference the
        // body's own sweep passes over
        assertEq(anchorsOf([[], [['array', [['fref', 0]]], 1]]), 'consts 0; imports ')
        // an unused alias of a slot, of the rest array or of a parameter is
        // the node it names and anchors nothing
        assertEq(anchorsOf([[], [['fref', 0], 1]]), 'consts ; imports ')
        assertEq(anchorsOf([[], [['rest'], 1]]), 'consts ; imports ')
        assertEq(anchorsOf([[], [['arg', 0], 1]]), 'consts ; imports ')
    },
    // The captures a body reads, by index, each once in first-use order:
    // the slots of the function's frame. A capture the body names only
    // through an unused alias is not read, so a function names only what
    // its body reads, and the enclosing `const` behind an unread capture is
    // anchored as one nothing reaches.
    readCaptures: () => {
        assertStructurallySame(readCaptures(['=>', 0, [['fref', 0]], [['cref', 0]]]), [0])
        assertStructurallySame(readCaptures(['=>', 0, [['fref', 1], ['array', [['fref', 0], ['cref', 0], ['fref', 1]]]], [['cref', 0], ['cref', 1]]]), [0, 1])
        assertStructurallySame(readCaptures(['=>', 0, [['fref', 0], 1], [['cref', 0]]]), [])
        assertStructurallySame(readCaptures(['=>', 0, [['fref', 0], ['cref', 0]], [['cref', 0]]]), [0])
        // read anywhere: a lazy position, a nested function's captures, a
        // call the lowering inlines, a negation
        assertStructurallySame(readCaptures(['=>', 0, [['&&', 1, ['fref', 0]]], [['cref', 0]]]), [0])
        assertStructurallySame(readCaptures(['=>', 0, [['=>', 0, [['fref', 0]], [['fref', 0]]]], [['cref', 0]]]), [0])
        assertStructurallySame(readCaptures(['=>', 0, [['()', ['=>', 0, [['fref', 0]], [['fref', 0]]], []]], [['cref', 0]]]), [0])
        assertStructurallySame(readCaptures(['=>', 0, [['()', ['=>', 0, [['fref', 0], 1], [['fref', 0]]], []]], [['cref', 0]]]), [])
        assertStructurallySame(readCaptures(['=>', 0, [['-', ['fref', 0]]], [['cref', 0]]]), [0])
        assertStructurallySame(readCaptures(['=>', 0, [1]]), [])
        // the sweep names only what the body reads
        assertEq(anchorsOf([[a], [['array', []], ['=>', 0, [['fref', 0], 1], [['cref', 0]]]]]), 'consts 0; imports 0')
        assertEq(anchorsOf([[a], [['array', []], ['=>', 0, [['fref', 0], ['cref', 0]], [['cref', 0]]]]]), 'consts ; imports 0')
        assertEq(anchorsOf([[a], [['array', []], ['=>', 0, [['()', ['=>', 0, [['fref', 0], 1], [['fref', 0]]], []]], [['cref', 0]]]]]), 'consts 0; imports 0')
    },
    // Eager operators reach all their operands.
    operator: () => {
        // both operands of a binary operator are reached
        assertEq(anchorsOf([[a], [['array', []], ['+', ['cref', 0], 1]]]), 'consts ; imports 0')
        assertEq(anchorsOf([[a], [['array', []], ['+', 1, ['cref', 0]]]]), 'consts ; imports 0')
        assertEq(anchorsOf([[a], [['array', []], ['~', ['cref', 0]]]]), 'consts ; imports 0')
        assertEq(anchorsOf([[a], [['array', []], ['!', ['cref', 0]]]]), 'consts ; imports 0')
        assertEq(anchorsOf([[a], [['array', []], ['typeof', ['cref', 0]]]]), 'consts ; imports 0')
        assertEq(anchorsOf([[a], [['array', []], ['instanceof', ['cref', 0], 'Array']]]), 'consts ; imports 0')
        // what it does not reach is anchored as ever
        assertEq(anchorsOf([[a], [['array', []], ['+', 1, 2]]]), 'consts 0; imports 0')
    },
    // A string conversion establishes its operand, follows captures and
    // rest reads, and leaves references inside lazy positions lazy.
    stringConversion: () => {
        assertEq(anchorsOf([[a], [['array', []], ['String', ['cref', 0]]]]), 'consts ; imports 0')
        assertEq(anchorsOf([[a], [['String', ['aref', 0]]]]), 'consts ; imports ')
        assertEq(anchorsOf([[], [['array', []], ['String', ['&&', 1, ['cref', 0]]]]]), 'consts 0; imports ')
        assertEq(anchorsOf([[], [['array', []], ['&&', false, ['String', ['cref', 0]]]]]), 'consts 0; imports ')
        assertStructurallySame(readCaptures(['=>', 0, [['String', ['fref', 0]]], [['cref', 0]]]), [0])
        assert(!isInlinedCall(['()', ['=>', 0, [['String', ['rest']]]], []]))
        // a converted nested function reads its own rest array
        assert(isInlinedCall(['()', ['=>', 0, [['String', ['=>', 0, [['rest']]]]]], []]))
    },
    // Every tag of `binaryTags` with two operands is a binary operator, and
    // nothing else is: the negation shares `-` and has one, and a node of
    // two operands under any other tag is an access or the like. Of those
    // tags, `&&`, `||` and `??` are lazy, and the rest eager.
    binary: () => {
        for (const tag of binaryTags) { assert(isBinary([tag, 1, 2])) }
        assert(!isBinary(['-', 1]))
        assert(!isBinary(['.', 1, 'x']))
        assertEq(binaryTags.filter(isLazy).join(), '&&,||,??')
    },
    // The lazy layers hold exactly the lazy operators, as `isLazy` reads
    // them from the EDAG, and no eager layer holds one.
    layers: () => {
        assertEq(lazyLayers.flatMap(definedValues).join(), binaryTags.filter(isLazy).join())
        assert(!eagerLayers.flatMap(definedValues).some(tag => tag !== 'instanceof' && isLazy(tag)))
    },
    // A throw reaches its operand before the computation fails.
    thrown: () => {
        assertEq(anchorsOf([[a], [['array', []], ['throw', ['cref', 0]]]]), 'consts ; imports 0')
        assertEq(anchorsOf([[a], [['array', []], ['throw', 1]]]), 'consts 0; imports 0')
    },
    // A lazy right operand or conditional arm may not execute, so a const
    // reached only there still needs its initialization anchor.
    lazy: () => {
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
            assertEq(anchorsOf([[a], [['array', []], ['object', [[':', 'k', ['array', [['cref', 0], ['aref', 0]]]]]]]]), 'consts ; imports ')
        },
        // a member a later duplicate shadows is applied by the EDAG's object
        // constructor, so a reference in it reaches
        shadowed: () => {
            assertEq(anchorsOf([[a], [['array', []], ['object', [[':', 'x', ['cref', 0]], [':', 'x', ['aref', 0]], [':', 'x', 0]]]]]), 'consts ; imports ')
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
    // A chain of operators, as deep as the source that built it: `refsOf`
    // walks one with an explicit stack rather than recursion, so 5,000
    // terms — the depth `fjs/compiler/parser/proof.f.mjs`'s own `stackSafety`
    // uses — cost no call stack, left-associative for a binary operator and
    // right-associative for `-`/`~` alike.
    stackSafety: () => {
        // a reference at the deep end of a left-associative chain is still
        // reached, so the `const` it names is not anchored
        /** @type {import('./types.ts').AstConst} */
        let plus = ['cref', 0]
        for (let i = 0; i < 5000; i++) { plus = ['+', plus, 1] }
        assertEq(anchorsOf([[], [['array', []], plus]]), 'consts ; imports ')
        // a right-associative chain of negations, `refsOf`'s other shape
        /** @type {import('./types.ts').AstConst} */
        let neg = ['cref', 0]
        for (let i = 0; i < 5000; i++) { neg = ['-', neg] }
        assertEq(anchorsOf([[], [['array', []], neg]]), 'consts ; imports ')
        /** @type {import('./types.ts').AstConst} */
        let converted = ['cref', 0]
        for (let i = 0; i < 5000; i++) { converted = ['String', converted] }
        assertEq(anchorsOf([[], [['array', []], converted]]), 'consts ; imports ')
        // a lazy chain, and a conditional nested through either arm, at
        // the depth the parser's own `lazyStackCost` proves: the eager
        // operand is followed and the lazy one is not
        /** @type {import('./types.ts').AstConst} */
        let and = ['cref', 0]
        for (let i = 0; i < 20000; i++) { and = ['&&', and, ['cref', 0]] }
        assertEq(anchorsOf([[], [['array', []], and]]), 'consts ; imports ')
        /** @type {import('./types.ts').AstConst} */
        let otherwise = ['cref', 0]
        for (let i = 0; i < 20000; i++) { otherwise = ['?:', 1, 2, otherwise] }
        assertEq(anchorsOf([[], [['array', []], otherwise]]), 'consts 0; imports ')
        /** @type {import('./types.ts').AstConst} */
        let then = ['cref', 0]
        for (let i = 0; i < 20000; i++) { then = ['?:', ['cref', 0], then, 2] }
        assertEq(anchorsOf([[], [['array', []], then]]), 'consts ; imports ')
    },
}
