/**
 * The `sugar` pass, [`fjs/js/ast/sugar`](../../js/ast/sugar/module.f.mjs),
 * seen from its input and its output. A FunctionalScript module as its two
 * trees before the EDAG, side by side:
 * the source AST the parser resolves, and the Foundation AST `normalize`
 * expands it into, each drawn with [the shared graph
 * module](../../website/demo/graph/module.f.mjs) by
 * [`fjs/compiler/graph`](../graph/module.f.mjs). Comparing the two
 * shows what `normalize` does: logical operators become conditionals,
 * `let` and `while` become a `loop` with parameters and results, and a
 * closure gets explicit captures.
 *
 * **Each pane runs the real stage.** The page parses the text with the
 * compiler's own front end and normalizes the result as
 * [the EDAG lowering](../edag/module.f.mjs) does. An import is identified
 * by its specifier, so two imports of one module are one FAST parameter.
 *
 * **A refusal is shown in the parser's own words**, in place of both
 * panes: an unparsed module has neither tree.
 *
 * **Under each graph, the same tree as DataJS**, collapsed, so the drawing
 * can be checked against the exact structure.
 *
 * **It needs no operations.** Parsing and normalizing are pure functions
 * of the text, so `update` declares `never` and returns through `pureOk`.
 *
 * @module
 *
 * @import { Graph } from '../../website/demo/graph/types.ts'
 * @import { Node } from '../../media/html/types.ts'
 * @import { Result } from '../../types/result/types.ts'
 * @import { Unknown } from '../../media/datajs/types.ts'
 */

import { codeMarker } from '../../website/style/module.f.js'
import { tryMarked } from '../../media/datajs/module.f.mjs'
import { refusal } from '../../website/demo/module.f.mjs'
import { render } from '../../website/demo/highlight/module.f.mjs'
import { graphSvg } from '../../website/demo/graph/module.f.mjs'
import { fastGraph, sourceGraph } from '../graph/module.f.mjs'
import { normalize } from '../../js/ast/sugar/module.f.mjs'
import { ok } from '../../types/result/module.f.js'
import { parsed, stageDemo } from '../stage_demo/module.f.mjs'

/**
 * `text`'s two trees, each a pane with its heading, its graph and the
 * value it draws, or the parser's message.
 *
 * @type {(text: string) => Result<readonly { readonly heading: string, readonly graph: Graph, readonly tree: Unknown }[], string>}
 */
export const _panes = parsed(resolved => {
    const { imports, body } = resolved
    const fast = normalize(resolved, imports.map(i => i.specifier))
    return ok([
        { heading: 'Source AST', graph: sourceGraph(resolved), tree: { imports, body } },
        { heading: 'FAST', graph: fastGraph(fast), tree: fast },
    ])
})

/**
 * A tree as DataJS, collapsed under its graph, or the serializer's
 * refusal: a tree the compiler builds is always DataJS, so the refusal is
 * for a tree that is not, rather than an empty box.
 *
 * @type {(tree: Unknown) => Node}
 */
export const _listing = tree => {
    const [kind, value] = tryMarked(tree)
    return ['details', ['summary', 'As DataJS'], kind === 'ok' ? ['pre', { [codeMarker]: '' }, ...render(value)] : refusal(value)]
}

export const demo = stageDemo({
    intro: 'Parses a FunctionalScript module and draws its source AST beside the Foundation AST (FAST) it normalizes to. A binding is one node however many places use it; source bindings carry their names, FAST bindings are numbered in definition order. Dashed arrows mark operands that may not be evaluated, and arrows back to a function or loop are the exits that leave it. Expand "As DataJS" under a graph to check it against the exact tree.',
    name: 'sugar',
})(text => {
    const [kind, value] = _panes(text)
    return kind === 'ok'
        ? value.flatMap(({ heading, graph, tree }) => [['h3', heading], graphSvg({ ...graph, trace: true }), _listing(tree)])
        : [refusal(value)]
})
