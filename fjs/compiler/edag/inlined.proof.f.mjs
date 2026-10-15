/**
 * The proof of calls the lowering inlines — a parameterless function
 * called at once with no arguments, which is its body where the call
 * stands — and of what such a body anchors, split off `./proof.f.mjs`
 * when that file outgrew what the website's build accepts in one file,
 * 128 KiB, along the seam its own sections drew. It lowers source as that
 * proof does, through the helpers it exports.
 *
 * No `@module`: a proof's documentation reaches no reader of the published
 * API, which is the case that rule names outright.
 *
 * @import { Exp } from '../../edag/types.ts'
 */

import { compile, execute, expectEdag } from './proof.f.mjs'
import { assert, assertStructurallySame } from '../../asserts/module.f.mjs'

export const proof = {
    // A call of a parameterless function written at the call, with no
    // arguments, is its body where the call stands: the idiom for a
    // `const` inside an expression. Nothing observes the function, so the
    // graph holds none — `(() => [1, 2])()` is the array — and a body
    // `const` is a shared node of the enclosing scope, its slot reads the
    // enclosing nodes themselves.
    inlined: {
        body: () => {
            expectEdag(compile('export default (() => [1, 2])();').edag, ['[]', [1, 2]])
            expectEdag(compile('export default (() => { return 1; })();').edag, 1)
            const shared = compile('export default (...a) => a[0] ? (() => { const x = [1]; return [x, x]; })() : 4;').edag
            expectEdag(shared, ['=>', 0, [], ['?:', ['.', ['rest'], 0], ['[]', [['[]', [1]], ['[]', [1]]]], 4]])
            const arm = /** @type {readonly any[]} */ (/** @type {readonly any[]} */ (shared)[3])[2]
            assert(arm[1][0] === arm[1][1], shared)
            assertStructurallySame(execute(compile('export default (() => { const x = [1]; return [x, x]; })();').edag), [[1], [1]])
        },
        // a slot read is the enclosing scope's node: the capture itself,
        // shared with the scope, and a primitive written in place
        captures: () => {
            const captured = compile('const c = [1]; export default [c, (() => c)()];').edag
            expectEdag(captured, ['[]', [['[]', [1]], ['[]', [1]]]])
            assert(/** @type {readonly any[]} */ (captured)[1][0] === /** @type {readonly any[]} */ (captured)[1][1], captured)
            expectEdag(compile('const c = 1; export default (() => [c])();').edag, ['[]', [1]])
            expectEdag(compile('export default (...a) => (() => a)();').edag, ['=>', 0, [], ['rest']])
            expectEdag(compile('export default (...a) => (() => a[0])();').edag, ['=>', 0, [], ['.', ['rest'], 0]])
            expectEdag(compile('export default (x) => (() => x)();').edag, ['=>', 1, [], ['arg', 0]])
            // a nested function captures the enclosing node directly, with
            // no frame of the inlined body in between
            expectEdag(compile('const c = [1]; export default (() => (...a) => c)();').edag, ['=>', 0, [['[]', [1]]], ['frame', 0]])
            // and an inlined call inside a body reads that body's frame
            expectEdag(compile('const c = [1]; export default (...a) => (() => [c, c])();').edag, ['=>', 0, [['[]', [1]]], ['[]', [['frame', 0], ['frame', 0]]]])
            // an unused alias of a capture is the capture and anchors
            // nothing — where an anchor would float the enclosing node out
            // as its own anchor
            expectEdag(compile('const c = [1]; export default (...a) => [(() => { const y = c; return 1; })(), c];').edag, ['=>', 0, [['[]', [1]]], ['[]', [1, ['frame', 0]]]])
            // a capture the body names only through an unused alias is no
            // slot: the frame holds what the body reads, in the body or in
            // a call inlined into it, and the enclosing `const` is anchored
            // as one nothing reaches
            expectEdag(compile('const c = [1]; export default (...a) => (() => { const x = c; return 1; })();').edag, [',', [['[]', [1]], ['=>', 0, [], 1]]])
            expectEdag(compile('const c = [1]; export default (...a) => { const x = c; return 1; };').edag, [',', [['[]', [1]], ['=>', 0, [], 1]]])
            expectEdag(compile('const c = [1]; const d = [2]; export default (...a) => { const x = c; return d; };').edag, [',', [['[]', [1]], ['=>', 0, [['[]', [2]]], ['frame', 0]]]])
            expectEdag(compile('const c = [1]; export default (...a) => { const x = c; return [x, c]; };').edag, ['=>', 0, [['[]', [1]]], ['[]', [['frame', 0], ['frame', 0]]]])
            // an unused alias of the function itself is the function and
            // anchors nothing, as an alias of a capture does: the `self` is
            // a name, and a name is no anchor
            expectEdag(compile('const f = () => { const g = f; return 1; }; export default f;').edag, ['=>', 0, [], 1])
            expectEdag(compile('const f = () => { const g = f; return g(); }; export default f;').edag, ['=>', 0, [], ['()', ['self'], []]])
        },
        // What the body anchors — the `const`s its value does not reach —
        // floats to the nearest block root: the scope's root through eager
        // positions, and a lazy operand, which is established only when
        // the operator decides to and so takes the comma itself.
        anchors: () => {
            /** @type {Exp} */
            const x = ['.', null, 'x']
            expectEdag(compile('export default (() => { const x = null.x; return 1; })();').edag, [',', [x, 1]])
            expectEdag(compile('export default [(() => { const x = null.x; return 1; })()];').edag, [',', [x, ['[]', [1]]]])
            expectEdag(compile('export default { a: (() => { const x = null.x; return 1; })() }.a;').edag, [',', [x, ['.', ['{}', [[':', 'a', 1]]], 'a']]])
            expectEdag(compile('export default -(() => { const x = null.x; return 1; })();').edag, [',', [x, -1]])
            expectEdag(compile('export default ~(() => { const x = null.x; return 1; })();').edag, [',', [x, ['~', 1]]])
            expectEdag(compile('export default 1 + (() => { const x = null.x; return 2; })();').edag, [',', [x, ['+', 1, 2]]])
            expectEdag(compile('export default (() => { const x = null.x; return 1; })() && 2;').edag, [',', [x, ['&&', 1, 2]]])
            expectEdag(compile('export default (() => { const x = null.x; return 1; })() ? 2 : 3;').edag, [',', [x, ['?:', 1, 2, 3]]])
            expectEdag(compile('const f = (...a) => 1; export default f((() => { const x = null.x; return 2; })());').edag, [',', [x, ['()', ['=>', 0, [], 1], [2]]]])
            expectEdag(compile('const o = { b: 1 }; export default o.b((() => { const x = null.x; return 2; })());').edag, [',', [x, ['.', ['{}', [[':', 'b', 1]]], 'b', ['|()', [2]]]]])
            // a lazy operand is a block root: the anchor stays under it
            expectEdag(compile('export default 1 && (() => { const x = null.x; return 2; })();').edag, ['&&', 1, [',', [x, 2]]])
            expectEdag(compile('export default 1 || (() => { const x = null.x; return 2; })();').edag, ['||', 1, [',', [x, 2]]])
            expectEdag(compile('export default 1 ?? (() => { const x = null.x; return 2; })();').edag, ['??', 1, [',', [x, 2]]])
            expectEdag(compile('export default 1 ? (() => { const x = null.x; return 2; })() : 3;').edag, ['?:', 1, [',', [x, 2]], 3])
            expectEdag(compile('export default 1 ? 2 : (() => { const x = null.x; return 3; })();').edag, ['?:', 1, 2, [',', [x, 3]]])
            // and one nested in an eager position under the lazy operand
            // floats to the operand, not past it
            expectEdag(compile('export default 1 && [(() => { const x = null.x; return 2; })()];').edag, ['&&', 1, [',', [x, ['[]', [2]]]]])
            // the anchors of an entry come before the entry, and an
            // anchored entry keeps its own anchors before it too; the
            // module's unbound imports come first of all
            expectEdag(compile('const a = [(() => { const x = null.x; return 1; })()]; export default a;').edag, [',', [x, ['[]', [1]]]])
            expectEdag(compile('const a = [(() => { const x = null.x; return 1; })()]; export default 2;').edag, [',', [x, ['[]', [1]], 2]])
            expectEdag(compile('const a = (() => { const x = null.x; return [1]; })(); const b = (() => { const y = null.y; return [2]; })(); export default [b, a];').edag,
                [',', [x, ['.', null, 'y'], ['[]', [['[]', [2]], ['[]', [1]]]]]])
            expectEdag(compile('import m from "./m.f.js"; export default (() => { const x = null.x; return 1; })();').edag, [',', [['.', ['.', ['args'], 0], 'default'], x, 1]])
            // a body's own anchors float through the bodies it is inlined
            // into, and stop at its function
            expectEdag(compile('export default (() => (() => { const x = null.x; return 1; })())();').edag, [',', [x, 1]])
            expectEdag(compile('export default (...a) => (() => { const x = null.x; return 1; })();').edag, ['=>', 0, [], [',', [x, 1]]])
            // a call inlined that answers a `const` of the scope around,
            // `(() => t)()`, is an alias of it, as `const u = t;` is: unused,
            // it anchors nothing in the body and reads nothing, so the scope
            // that makes `t` anchors it where nothing else reaches it, at any
            // depth of inlining
            /** @type {Exp} */
            const bxy = ['.', ['.', ['arg', 1], 'x'], 'y']
            expectEdag(compile('export default (a, b) => { const t = b.x.y; return (() => { const u = (() => t)(); return 1; })(); };').edag, ['=>', 2, [], [',', [bxy, 1]]])
            expectEdag(compile('const t = null.x; export default [(() => { const u = (() => t)(); return 1; })()];').edag, [',', [x, ['[]', [1]]]])
            expectEdag(compile('export default (a, b) => { const t = b.x.y; return (() => { const v = (() => { const u = (() => t)(); return 1; })(); return 2; })(); };').edag, ['=>', 2, [], [',', [bxy, 1, 2]]])
            // and none where something else reaches it: the value, which is
            // the node or holds it, or nothing more for a second alias
            expectEdag(compile('export default (n) => { const t = [n]; const u = (() => t)(); return t; };').edag, ['=>', 1, [], ['[]', [['arg', 0]]]])
            expectEdag(compile('export default (n) => { const t = [n]; const u = (() => t)(); return [t]; };').edag, ['=>', 1, [], ['[]', [['[]', [['arg', 0]]]]]])
            expectEdag(compile('export default (b) => { const t = b.x; const u = (() => t)(); const v = (() => t)(); return 1; };').edag, ['=>', 1, [], [',', [['.', ['arg', 0], 'x'], 1]]])
            // nor under a lazy operand, where a read reaches nothing for the
            // scope around it, which anchors the node itself where nothing
            // reaches it eagerly; a node the operand makes is anchored under
            // it however deep the call that floats it
            expectEdag(compile('export default (a, b) => { const t = b.x; return a ? (() => { const u = (() => t)(); return 1; })() : 0; };').edag, ['=>', 2, [], [',', [['.', ['arg', 1], 'x'], ['?:', ['arg', 0], 1, 0]]]])
            expectEdag(compile('export default (a, b) => a ? (() => { const t = b.x; const v = (() => { const u = (() => t)(); return 1; })(); return 2; })() : 0;').edag, ['=>', 2, [], ['?:', ['arg', 0], [',', [['.', ['arg', 1], 'x'], 1, 2]], 0]])
            // a call nothing reads anchors no node of its own: its value is
            // one more `const` of its body that nothing reads, anchored where
            // it stands there — before what reads it lazily — or not at all
            // where what the body anchors reaches it
            /** @type {Exp} */
            const cx = ['.', ['arg', 1], 'x']
            expectEdag(compile('export default (z, c) => { const u = (() => { const v0 = c.x; const v1 = z && v0; return v0; })(); return z ? u : 0; };').edag, ['=>', 2, [], [',', [cx, ['&&', ['arg', 0], cx], ['?:', ['arg', 0], cx, 0]]]])
            expectEdag(compile('export default (z, c) => { const u = (() => { const v0 = c.x; const v1 = [v0]; return v0; })(); return z ? u : 0; };').edag, ['=>', 2, [], [',', [['[]', [cx]], ['?:', ['arg', 0], cx, 0]]]])
            // nor for an alias of a parameter, which names a binding
            expectEdag(compile('export default (a) => (() => { const u = (() => a)(); return 1; })();').edag, ['=>', 1, [], 1])
            // a body `const` its own lazy positions alone reach is anchored
            // by the body's rule, so it stands eagerly under the block root
            const shared = compile('export default (...a) => a[0] ? (() => { const x = [1]; return [a[1] && x, a[2] && x]; })() : 4;').edag
            expectEdag(shared, ['=>', 0, [], ['?:', ['.', ['rest'], 0], [',', [['[]', [1]], ['[]', [['&&', ['.', ['rest'], 1], ['[]', [1]]], ['&&', ['.', ['rest'], 2], ['[]', [1]]]]]]], 4]])
            // the executor: what floats is established where the call was,
            // once, and a lazy operand's anchor only when the operand is
            assertStructurallySame(execute(compile('export default [(() => { const x = [1]; return 2; })()];').edag), [2])
            assertStructurallySame(execute(compile('export default 0 && (() => { const x = null.x; return 2; })();').edag), 0)
            assertStructurallySame(execute(compile('export default 1 && (() => { const x = [1]; return 2; })();').edag), 2)
        },
        // A chain of calls inlined, each the next one's value, a hundred and
        // fifty deep, unread and read: the `const` the last one names is
        // the node of all of them. Lowering it asks no call nothing reads,
        // and no body's value, whether it names one, so the chain costs
        // what its bodies do, where asking walked it again at every level.
        depth: () => {
            /** @type {(inner: string) => string} */
            const wrap = inner => `(() => ${inner})()`
            const chain = Array.from({ length: 150 }).reduce(wrap, 't')
            /** @type {Exp} */
            const x = ['.', ['arg', 0], 'x']
            expectEdag(compile(`export default (a) => { const t = a.x; const u = ${chain}; return 1; };`).edag, ['=>', 1, [], [',', [x, 1]]])
            expectEdag(compile(`export default (a) => { const t = a.x; const u = ${chain}; return [u]; };`).edag, ['=>', 1, [], ['[]', [x]]])
        },
        // every other call stays a call
        stays: () => {
            expectEdag(compile('export default (() => 1)(2);').edag, ['()', ['=>', 0, [], 1], [2]])
            expectEdag(compile('export default ((x) => x)();').edag, ['()', ['=>', 1, [], ['arg', 0]], []])
            expectEdag(compile('export default ((...a) => a)();').edag, ['()', ['=>', 0, [], ['rest']], []])
            expectEdag(compile('const f = () => 1; export default f();').edag, ['()', ['=>', 0, [], 1], []])
        },
    },
}
