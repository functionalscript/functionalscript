/**
 * @import { Exp } from '../../edag/types.ts'
 * @import { Unresolved } from './types.ts'
 */

import { unresolved } from './module.f.mjs'
import { parse } from '../transpiler/module.f.mjs'
import { exp } from '../../edag/module.f.mjs'
import { validate } from '../../rtti/validate/module.f.mjs'
import { unwrap } from '../../types/result/module.f.mjs'
import { assert, assertEq, assertStructurallySame } from '../../asserts/module.f.mjs'

/** A module's text through the front end and the lowering, refusals thrown. @type {(source: string) => Unresolved} */
const compile = source => unwrap(unresolved(unwrap(parse('')(source))))

/** The lowering's own word on a text that parses, as the message of its refusal or `null`. @type {(source: string) => string | null} */
const refusal = source => {
    const [tag, value] = unresolved(unwrap(parse('')(source)))
    return tag === 'error' ? value.message : null
}

/** An EDAG the schema admits, and structurally the one expected. @type {(edag: Exp, expected: Exp) => void} */
const expectEdag = (edag, expected) => {
    assertEq(validate(exp)(edag)[0], 'ok')
    assertStructurallySame(edag, expected)
}

export const proof = {
    // The issue's own example: one shared `const` is one node, reached from
    // two members, and the import is a property of the arguments.
    example: () => {
        const { imports, edag } = compile('import a from "./a.f.js"; const x = [a, 1]; export default { x: x, y: x };')
        assertStructurallySame(imports, ['./a.f.js'])
        expectEdag(edag, ['{}', [[':', 'x', ['[]', [['.', ['args'], 0], 1]]], [':', 'y', ['[]', [['.', ['args'], 0], 1]]]]])
        assert(edag instanceof Array && edag[0] === '{}', edag)
        const [x, y] = edag[1]
        assert(x instanceof Array && y instanceof Array && x[2] === y[2], edag)
    },
    leaves: {
        primitives: () => {
            const { imports, edag } = compile('export default [1, -0, 2n, "s", true, null, NaN, -Infinity];')
            assertStructurallySame(imports, [])
            expectEdag(edag, ['[]', [1, -0, 2n, 's', true, null, NaN, -Infinity]])
        },
        // a bare `undefined` is a missing tuple position in an EDAG, so it is
        // the tagged node, at the root and inside a container alike
        undefined: () => {
            expectEdag(compile('export default undefined;').edag, ['undefined'])
            expectEdag(compile('export default { a: undefined };').edag, ['{}', [[':', 'a', ['undefined']]]])
        },
    },
    // an object's members as written: a repeated key twice, an integer-like
    // key where it stands, which is what the constructor takes
    members: () => {
        expectEdag(compile('export default { b: 1, "1": 2, b: 3 };').edag, ['{}', [[':', 'b', 1], [':', '1', 2], [':', 'b', 3]]])
        expectEdag(compile('export default { ["__proto__"]: 1 };').edag, ['{}', [[':', '__proto__', 1]]])
    },
    // a `const` reached along a chain of `const`s is reached, and its node
    // is the one the chain ends at
    chain: () => {
        const { edag } = compile('const a = []; const b = [a]; const c = { b: b }; export default [c, a];')
        expectEdag(edag, ['[]', [['{}', [[':', 'b', ['[]', [['[]', []]]]]]], ['[]', []]]])
        assert(edag instanceof Array && edag[0] === '[]', edag)
        const [c, a] = edag[1]
        assert(c instanceof Array && c[0] === '{}', c)
        const b = c[1][0]
        assert(b instanceof Array && b[0] === ':' && b[2] instanceof Array && b[2][0] === '[]', b)
        assert(b[2][1][0] === a, edag)
    },
    // imports take their positions from the source, and one import is one
    // parameter node however many references reach it
    parameters: () => {
        const { imports, edag } = compile('import a from "./a.f.js"; import b from "./b.f.js"; export default [b, a, b];')
        assertStructurallySame(imports, ['./a.f.js', './b.f.js'])
        expectEdag(edag, ['[]', [['.', ['args'], 1], ['.', ['args'], 0], ['.', ['args'], 1]]])
        assert(edag instanceof Array && edag[0] === '[]' && edag[1][0] === edag[1][2], edag)
    },
    // A member a later duplicate shadows is in the graph — the constructor
    // applies every member written — so a reference in it is reached, and
    // the module compiles where its value alone would say the `const` is
    // dropped; the sharing decision, which reads the value, says otherwise
    // of the same source, and both are right about their own question.
    shadowed: () => {
        expectEdag(compile('const s = [1]; export default { a: s, a: 1 };').edag, ['{}', [[':', 'a', ['[]', [1]]], [':', 'a', 1]]])
        expectEdag(compile('import a from "./a.f.js"; export default { x: a, x: 0 };').edag, ['{}', [[':', 'x', ['.', ['args'], 0]], [':', 'x', 0]]])
    },
    // What the export does not reach is refused, not dropped: `transpile`
    // reads every import and `run` evaluates every `const`, so a compile
    // that fails today on a broken unused import must not succeed here.
    unreachable: {
        import: () => {
            assertEq(refusal('import a from "./a.f.js"; export default 1;'), 'unreachable import "./a.f.js"')
            assertEq(refusal('import a from "./a.f.js"; import b from "./b.f.js"; export default [b];'), 'unreachable import "./a.f.js"')
        },
        const: () => {
            assertEq(refusal('const a = []; export default 1;'), 'unreachable const 0')
            assertEq(refusal('const a = []; const b = [a, a]; export default [a];'), 'unreachable const 1')
        },
        // the first refusal is the import's: a module that lacks both names
        // the import, and one reached through a `const` the export drops is
        // still unreached
        both: () => {
            assertEq(refusal('import a from "./a.f.js"; const b = [a]; export default 1;'), 'unreachable import "./a.f.js"')
        },
        // the refusal carries no position: the module parsed
        position: () => {
            const [tag, value] = unresolved(unwrap(parse('')('const a = []; export default 1;')))
            assert(tag === 'error', tag)
            assertEq(value.metadata, null)
        },
    },
}
