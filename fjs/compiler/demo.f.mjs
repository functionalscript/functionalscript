/**
 * One module, every output `fjs compile` writes for it, side by side: type a
 * module and see what each language makes of it — and, as the lesson, where
 * they differ.
 *
 * **It runs the compiler, not a lookalike.** The text is the input file of
 * `_outputMarked`, the real `compile` but for the directory and the write,
 * run over an in-memory file system, once per output name; each pane is the
 * output that run answers, as marked text so that its words are coloured by
 * what the compiler wrote, or the message it would print. The proof holds each
 * pane's text to the file the whole of `compile` writes. So
 * `[a, a]` is a shared `const` in `.js`, `.data.js`, the EDAG and Rust, but
 * JSON, which has no identity to keep, writes the node where each reference
 * reaches it; `undefined` is refused by JSON alone; a function is refused by
 * the two value outputs and written by the rest; and a program that fails
 * when it runs is refused by every value output while the source and Rust
 * ones carry it unevaluated.
 *
 * **A refusal is a pane's content, in the module's own words.** An empty
 * box would be the plausible wrong answer
 * [DESIGN.md §10](../../doc/DESIGN.md#10-refuse-what-you-cannot-handle) rules
 * out, and what an output will not spell is half of what it is.
 *
 * **Modules with imports are refused everywhere**, since the in-memory file
 * system holds the one input and the compiler reports the file it cannot
 * find.
 *
 * **A host failure belongs to its output pane too.** Each output is compiled
 * through the `catch` effect during update, so an interpreter stack overflow
 * in a data output leaves the source outputs visible and copyable. The view
 * reads the completed panes without running the edited program again.
 *
 * **The output is copyable**: it is a document or generated source a reader
 * can save and use elsewhere. Copy keeps the original output text.
 *
 * @module
 *
 * @import { Result } from '../types/result/types.ts'
 * @import { Marked } from '../text/marked/types.ts'
 * @import { Demo, DemoEvent } from '../website/demo/types.ts'
 * @import { Catch } from '../effects/common/types.ts'
 * @import { Effect } from '../effects/types.ts'
 * @import { _DemoState } from './private.ts'
 * @import { Element } from '../media/html/types.ts'
 */

import { toText } from '../text/marked/module.f.mjs'
import { codeBlock } from '../website/demo/code/module.f.js'
import { exitCode } from '../effects/node/module.f.mjs'
import { virtualAt } from '../effects/node/virtual/module.f.mjs'
import { utf8 } from '../text/module.f.mjs'
import { utf8ToString } from '../text/utf8/module.f.mjs'
import { error, ok, unwrap } from '../types/result/module.f.js'
import { refusal } from '../website/demo/module.f.mjs'
import { render } from '../website/demo/highlight/module.f.mjs'
import { stageDemo } from './stage_demo/module.f.mjs'
import { _outputMarked, compileFile } from './module.f.mjs'
import { vm } from '../edag/amnesia/module.f.mjs'
import { read } from '../edag/value/property/module.f.mjs'
import { errorMessage, foldStep, history, historyStep, mapStep, pureOk, resultMapStep } from '../effects/module.f.mjs'
import { catch_ } from '../effects/common/module.f.mjs'
import { assert } from '../asserts/module.f.js'
import runtimeEdag from '../js/runtime/gen.edag.data.js'

/**
 * The runtime a data output interprets the example under: `fjs/js/runtime`'s
 * EDAG, which `npm run gen` writes beside its source, evaluated to its export
 * object and read for `runtime`, as the corpus proofs do — the demo has no
 * file system to load the source from.
 *
 * @type {import('./types.ts').RuntimeLoad}
 */
const runtime = pureOk(/** @type {import('../edag/value/types.ts').Runtime} */ (unwrap(read(
    vm({ frame: [], args: [] })(/** @type {import('../edag/types.ts').Exp} */ (/** @type {unknown} */ (runtimeEdag))),
    'runtime'))))

/**
 * The outputs, each under the file name that selects its language: what a
 * reader would type after `fjs compile input.f.js`.
 *
 * @type {readonly (readonly [label: string, outputFileName: string])[]}
 */
export const outputs = [
    ['.json', 'output.json'],
    ['.data.js', 'output.data.js'],
    ['.js', 'output.js'],
    ['.edag.data.js', 'output.edag.data.js'],
    ['.rs', 'output.rs'],
]

/**
 * `text` compiled to the language `outputFileName` names, as marked text: the
 * output `compile` writes the text of, or why it refuses, without the
 * location the command prints. It is the real compile but for its tail, the directory and the
 * write, so a pane cannot show anything the CLI does not write, which
 * {@link _written} lets the proof check.
 *
 * @type {(text: string) => (outputFileName: string) => Result<Marked, string>}
 */
export const compiled = text => outputFileName => {
    const result = unwrap(virtualAt({ 'input.f.js': [utf8(text)] })(_outputMarked(runtime)('input.f.js', outputFileName))[1])
    const [tag, value] = result
    if (tag === 'error') {
        const [message] = value
        return error(message)
    }
    return result
}

/**
 * `text` compiled by the whole of `compile` over an in-memory file system:
 * the file it wrote, or what it printed when it refused. The proof holds
 * {@link compiled} to it.
 *
 * @type {(text: string) => (outputFileName: string) => Result<string, string>}
 */
export const _written = text => outputFileName => {
    const [state, result] = virtualAt({ 'input.f.js': [utf8(text)] })(
        compileFile(runtime)('input.f.js', outputFileName))
    if (result[0] === 'error') { return error(errorMessage(result[1])) }
    const file = state.root[outputFileName]
    assert(file instanceof Array && file.length > 0, 'successful compilation wrote no output')
    return ok(utf8ToString(file[0]))
}

const sourceDemo = stageDemo({
    intro: 'Compiles a FunctionalScript module into JSON, DataJS, JavaScript, an expression graph and Rust, with each output under its file extension. Compare the output with fjs compile for a module without imports.',
    name: 'compiler',
})(() => [])

/** Compile one pane, absorbing both host failures and an unavailable catch operation.
 * @type {(text: string, file: string) => Effect<Catch, Result<Marked, string>, never>}
 */
const pane = (text, file) => resultMapStep(catch_(() => compiled(text)(file)), result => {
    if (result[0] === 'error') { return ok(error(errorMessage(result[1]))) }
    const [kind, value] = result[1]
    // The catch operation erases its thunk's return type through `do_`.
    return ok(kind === 'ok' ? /** @type {Result<Marked, string>} */ (value) : error(`Could not compile this output: ${String(value)}`))
})

/** @type {Demo<_DemoState, DemoEvent, Catch>} */
export const demo = {
    // Only the fixed initial example is compiled on load. Edited source is
    // always evaluated through `catch`, never by `view`.
    init: { text: sourceDemo.init, panes: outputs.map(([, file]) => compiled(sourceDemo.init)(file)) },
    update: state => event => {
        if (event.kind !== 'input') { return pureOk(state) }
        const text = sourceDemo.update(state.text)(event)
        const panes = historyStep(history(text), text => foldStep(pureOk(outputs), /** @type {_DemoState['panes']} */ ([]),
            ([, file]) => panes => mapStep(pane(text, file), result => [...panes, result])))
        return mapStep(panes, ([panes, text]) => ({ text, panes }))
    },
    view: ({ text, panes }) => ['div', sourceDemo.view(text), ...panes.map(/** @returns {Element} */ ([kind, value], index) => {
        const [label] = outputs[index]
        return ['section', ['h3', label], kind === 'ok' ? codeBlock(toText(value), `Copy ${label} output`, render(value)) : refusal(value)]
    })],
}
