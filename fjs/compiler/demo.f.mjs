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
 * **A program is every file its imports reach.** The text holds them all
 * ([`demo_files`](./demo_files/module.f.mjs)): the main module, then each file
 * after a `// @filename:` line. An import of a module file opens a box for it
 * under the main one, empty until the reader writes it, and that file's
 * imports open theirs. Every file is written into the in-memory file system,
 * so the compiler links the program as `fjs compile` would on disk. A file no
 * import reaches keeps its box, marked *not imported*, with a button that
 * removes it; the compiler does not read it. A module that does not parse
 * keeps the boxes its imports opened when it last did
 * ([`lastImports`](./demo_files/module.f.mjs)).
 *
 * **A host failure belongs to its output pane too.** Each output is compiled
 * through the `catch` effect during update, so an interpreter stack overflow
 * in a data output leaves the source outputs visible and copyable. The view
 * reads the completed panes without running the edited program again.
 *
 * **The output is copyable**: it is a document or generated source a reader
 * can save and use elsewhere. Copy keeps the original output text.
 *
 * **A link shares the source**, as the stage demos' do. A restored state has
 * the text and no panes yet: restoring cannot run the compiler outside
 * `catch`, so the `start` that follows every restore compiles them.
 *
 * @module
 *
 * @import { Result } from '../types/result/types.ts'
 * @import { Marked } from '../text/marked/types.ts'
 * @import { Demo, DemoEvent } from '../website/demo/types.ts'
 * @import { Catch } from '../effects/common/types.ts'
 * @import { Effect } from '../effects/types.ts'
 * @import { DemoState } from './types.ts'
 * @import { Element } from '../media/html/types.ts'
 * @import { Sharing } from '../website/demo/sharing/types.ts'
 * @import { File, Files } from './demo_files/types.ts'
 */

import { toText } from '../text/marked/module.f.mjs'
import { codeBlock } from '../website/demo/code/module.f.js'
import { exitCode } from '../effects/node/module.f.mjs'
import { virtualAt } from '../effects/node/virtual/module.f.mjs'
import { utf8 } from '../text/module.f.mjs'
import { utf8ToString } from '../text/utf8/module.f.mjs'
import { error, ok, unwrap } from '../types/result/module.f.js'
import { refusal, textField } from '../website/demo/module.f.mjs'
import { highlight, render } from '../website/demo/highlight/module.f.mjs'
import { dirOf, join, lastImports, main, reached, split } from './demo_files/module.f.mjs'
import { examples } from './examples/module.f.js'
import { examplePicker, name as exampleName } from '../website/demo/examples/module.f.js'
import { textSharing } from '../website/demo/sharing/module.f.mjs'
import { _outputMarked, compileFile } from './module.f.mjs'
import { vm } from '../edag/amnesia/module.f.mjs'
import { read } from '../edag/value/property/module.f.mjs'
import { errorMessage, foldStep, history, historyStep, mapStep, pureOk, resultMapStep } from '../effects/module.f.mjs'
import { catch_ } from '../effects/common/module.f.mjs'
import { assert, assertNotNullish } from '../asserts/module.f.js'
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
 * The files the compiler reads `files` from: each one held, and an empty one
 * for each box an import opened that holds nothing yet, so that the compiler
 * refuses an empty module, by name, rather than a file it cannot find.
 *
 * @type {(files: Files) => Files}
 */
const programOf = files => [
    ...files,
    ...reached(() => [])(files).filter(n => !files.some(([held]) => held === n)).map(/** @returns {File} */ n => [n, '']),
]

/**
 * `text`, every file of a program, compiled to the language `outputFileName`
 * names, as marked text: the output `compile` writes the text of, or why it
 * refuses, or why `text` holds no files. A refusal of the main module is
 * shown without the location the command prints; one of another file is the
 * command's line, which names the file. It is the real compile but for its tail, the directory and the
 * write, so a pane cannot show anything the CLI does not write, which
 * {@link _written} lets the proof check.
 *
 * @type {(text: string) => (outputFileName: string) => Result<Marked, string>}
 */
export const compiled = text => outputFileName => {
    const files = split(text)
    if (files[0] === 'error') { return files }
    const program = programOf(files[1])
    const result = unwrap(virtualAt(dirOf(program))(_outputMarked(runtime)(main, outputFileName))[1])
    const [tag, value] = result
    if (tag === 'error') {
        const [message, diagnostic] = value
        // the main module's refusal is the box above the panes, and an
        // output's is the pane's own; another file's names the file, and
        // where in it
        const [, ...others] = program
        return error(others.some(([n]) => diagnostic.startsWith(`${n}:`) || diagnostic.startsWith(`${n} `)) ? diagnostic : message)
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
    const files = split(text)
    if (files[0] === 'error') { return files }
    const [state, result] = virtualAt(dirOf(programOf(files[1])))(
        compileFile(runtime)(main, outputFileName))
    if (result[0] === 'error') { return error(errorMessage(result[1])) }
    const file = state.root[outputFileName]
    assert(file instanceof Array && file.length > 0, 'successful compilation wrote no output')
    return ok(utf8ToString(file[0]))
}

/** The source field's name, and the event an edit of the main module sends. */
const name = 'compiler'

const intro = 'Compiles a FunctionalScript program into JSON, DataJS, JavaScript, an expression graph and Rust, with each output under its file extension. An import of a module file opens a box for it below. Compare the output with fjs compile.'

const picker = examplePicker(examples)

/** The prefix of a dependency's field name, and the button that removes one. */
const filePrefix = 'file:'
const removePrefix = 'remove:'

/**
 * `text` with `event` applied: an example picked, a file edited or removed.
 * An edit of a text whose files `split` refuses edits the whole text, as the
 * one box that shows it.
 *
 * @type {(text: string) => (event: DemoEvent) => string}
 */
export const _edited = text => event => {
    const files = split(text)
    if (event.kind === 'input') {
        if (event.name === exampleName) { return picker.pick(event.value) }
        if (files[0] === 'error') { return event.name === name ? event.value : text }
        const file = event.name === name ? main
            : event.name.startsWith(filePrefix) ? event.name.slice(filePrefix.length)
            : null
        if (file === null) { return text }
        const held = files[1].some(([n]) => n === file)
        return join(held
            ? files[1].map(([n, t]) => n === file ? [n, event.value] : [n, t])
            : [...files[1], [file, event.value]])
    }
    if (event.kind === 'click' && event.name.startsWith(removePrefix) && files[0] === 'ok') {
        const file = event.name.slice(removePrefix.length)
        return join(files[1].filter(([n]) => n !== file))
    }
    return text
}

/**
 * The boxes of `text`'s files: the main module, then each file its imports
 * reach, then each file they do not, marked and removable. A text whose files
 * `split` refuses is one box, holding all of it.
 *
 * @type {(text: string, imports: DemoState['imports']) => readonly Element[]}
 */
const boxes = (text, imports) => {
    const files = split(text)
    if (files[0] === 'error') { return [textField({ name, label: 'Source', highlight }, text)] }
    /** @type {(file: string) => string} */
    const textOf = file => files[1].find(([n]) => n === file)?.[1] ?? ''
    const reached = lastImports(imports)(files[1]).map(([n]) => n)
    const [, ...dependencies] = reached
    return [
        textField({ name, label: 'Source', highlight }, textOf(main)),
        ...dependencies.map(file => textField({ name: `${filePrefix}${file}`, label: file, rows: 4, highlight }, textOf(file))),
        ...files[1].filter(([n]) => !reached.includes(n)).map(/** @returns {Element} */ ([file, t]) => ['div', { 'data-not-imported': '' },
            textField({ name: `${filePrefix}${file}`, label: `${file} (not imported)`, rows: 4, highlight }, t),
            ['p', ['button', { type: 'button', name: `${removePrefix}${file}` }, `Remove ${file}`]],
        ]),
    ]
}

/**
 * The imports `text`'s files have after an edit, from the ones they had
 * before it.
 *
 * @type {(text: string, imports: DemoState['imports']) => DemoState['imports']}
 */
const importsAfter = (text, imports) => {
    const files = split(text)
    return files[0] === 'ok' ? lastImports(imports)(files[1]) : imports
}

/** Compile one pane, absorbing both host failures and an unavailable catch operation.
 * @type {(text: string, file: string) => Effect<Catch, Result<Marked, string>, never>}
 */
const pane = (text, file) => resultMapStep(catch_(() => compiled(text)(file)), result => {
    if (result[0] === 'error') { return ok(error(errorMessage(result[1]))) }
    const [kind, value] = result[1]
    // The catch operation erases its thunk's return type through `do_`.
    return ok(kind === 'ok' ? /** @type {Result<Marked, string>} */ (value) : error(`Could not compile this output: ${String(value)}`))
})

const sourceSharing = textSharing(name, examples[0][1], examples)

/** @type {Sharing<DemoState>} */
const sharing = {
    ...sourceSharing,
    read: ({ text }) => sourceSharing.read(text),
    restore: inputs => ({ text: sourceSharing.restore(inputs), panes: [], imports: [] }),
}

const init = examples[0][1]

/** @type {Demo<DemoState, DemoEvent, Catch>} */
export const demo = {
    sharing,
    // Only the fixed initial example is compiled on load. Edited source is
    // always evaluated through `catch`, never by `view`.
    init: { text: init, panes: outputs.map(([, file]) => compiled(init)(file)), imports: importsAfter(init, []) },
    update: state => event => {
        // `outputs` is never empty, so no panes is a restored state.
        const restored = event.kind === 'start' && state.panes.length === 0
        const edited = _edited(state.text)(event)
        if (edited === state.text && !restored) { return pureOk(state) }
        const text = pureOk(edited)
        const panes = historyStep(history(text), text => foldStep(pureOk(outputs), /** @type {DemoState['panes']} */ ([]),
            ([, file]) => panes => mapStep(pane(text, file), result => [...panes, result])))
        return mapStep(panes, ([panes, text]) => ({ text, panes, imports: importsAfter(text, state.imports) }))
    },
    view: ({ text, panes, imports }) => ['div',
        ['p', intro],
        picker.view(text),
        ...boxes(text, imports),
        ...panes.map(/** @returns {Element} */ ([kind, value], index) => {
            const [label] = outputs[index]
            return ['section', ['h3', label], kind === 'ok' ? codeBlock(toText(value), `Copy ${label} output`, render(value)) : refusal(value)]
        })],
}
