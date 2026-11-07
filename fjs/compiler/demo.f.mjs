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
 * **A program is every file its imports reach, each in a box of its own**
 * ([`demo_files`](./demo_files/module.f.mjs)). An import of a file the
 * compiler can read, by a relative or rooted path, opens a box for it under
 * the main one, empty until the reader writes it, and that file's imports
 * open theirs. Every file is written into the in-memory file system,
 * so the compiler links the program as `fjs compile` would on disk. A file no
 * import reaches keeps its box, marked *not imported*, with a button that
 * removes it; the compiler does not read it. A module that does not parse
 * keeps the boxes its imports opened when it last did
 * ([`lastImports`](./demo_files/module.f.mjs)). The program's directory is
 * the in-memory file system's root, so `/` names it and nothing is above it;
 * the page names each import that reads another file on the command line,
 * where `/` is the root of the disk and `../` may leave it. The main box is labelled with
 * its file name, `input.f.js`, which a dependency imports it by. Where the
 * imports form a cycle, the panes refuse it as the compiler does, and the page
 * names every file the cycle passes through.
 *
 * **A host failure belongs to its output pane too.** Each output is compiled
 * through the `catch` effect during update, so an interpreter stack overflow
 * in a data output leaves the source outputs visible and copyable. The view
 * reads the completed panes without running the edited program again.
 *
 * **The output is copyable**: it is a document or generated source a reader
 * can save and use elsewhere. Copy keeps the original output text.
 *
 * **A link shares the program**: the main module as the stage demos share
 * theirs, and the other files as one JSON field, `files`, so no text a module
 * can hold is reserved, and a link without `files` is the one module it was
 * before. A restored state has the files and no panes yet: restoring cannot run the compiler outside
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
import { utf8ToString } from '../text/utf8/module.f.mjs'
import { error, ok, unwrap } from '../types/result/module.f.js'
import { refusal, textField } from '../website/demo/module.f.mjs'
import { highlight, render } from '../website/demo/highlight/module.f.mjs'
import { cycleOf, decode, dirOf, encode, lastImports, main, outsideImports, reached, twiceLoaded } from './demo_files/module.f.mjs'
import { dependenciesOf, examples } from './examples/module.f.js'
import { examplePicker, name as exampleName } from '../website/demo/examples/module.f.js'
import { _outputMarked, compileFile } from './module.f.mjs'
import { vm } from '../edag/amnesia/module.f.mjs'
import { read } from '../edag/value/property/module.f.mjs'
import { errorMessage, foldStep, mapStep, pureOk, resultMapStep } from '../effects/module.f.mjs'
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
 * `files`, a program with its main module first, compiled to the language
 * `outputFileName` names, as marked text: the output `compile` writes the
 * text of, or why it refuses. A refusal of the main module or of the output
 * is shown without the location the command prints; one of another file is
 * the command's line, which names the file. It is the real compile but for
 * its tail, the directory and the write, so a pane cannot show anything the
 * CLI does not write, which {@link _writtenProgram} lets the proof check.
 *
 * @type {(files: Files) => (outputFileName: string) => Result<Marked, string>}
 */
export const compiledProgram = files => outputFileName => {
    const result = unwrap(virtualAt(dirOf(files))(_outputMarked(runtime)(main, outputFileName))[1])
    const [tag, value] = result
    if (tag === 'error') {
        const [message, diagnostic] = value
        // the main module's refusal is the box above the panes, and an
        // output's is the pane's own; another file's names the file, and
        // where in it
        // (by its path from the root where a rooted import reached it)
        const [, ...others] = files
        const names = others.flatMap(([n]) => [n, `/${n}`])
        return error(names.some(n => diagnostic.startsWith(`${n}:`) || diagnostic.startsWith(`${n} `)) ? diagnostic : message)
    }
    return result
}

/**
 * `text`, one module, compiled as {@link compiledProgram} compiles a program
 * of one file: what a page that compiles one module shows.
 *
 * @type {(text: string) => (outputFileName: string) => Result<Marked, string>}
 */
export const compiled = text => compiledProgram([[main, text]])

/**
 * `files` compiled by the whole of `compile` over an in-memory file system:
 * the file it wrote, or what it printed when it refused. The proof holds
 * {@link compiledProgram} to it.
 *
 * @type {(files: Files) => (outputFileName: string) => Result<string, string>}
 */
export const _writtenProgram = files => outputFileName => {
    const [state, result] = virtualAt(dirOf(files))(
        compileFile(runtime)(main, outputFileName))
    if (result[0] === 'error') { return error(errorMessage(result[1])) }
    const file = state.root[outputFileName]
    assert(file instanceof Array && file.length > 0, 'successful compilation wrote no output')
    return ok(utf8ToString(file[0]))
}

/** The main module's field name, and the event an edit of it sends. */
const name = 'compiler'

/** The shared link's field that carries the other files. */
const filesField = 'files'

const intro = 'Compiles a FunctionalScript program into JSON, DataJS, JavaScript, an expression graph and Rust, with each output under its file extension. An import of a file opens a box for it below. Compare the output with fjs compile.'

const picker = examplePicker(examples)

/**
 * The main module's label: its file name, which a dependency imports it by
 * (`./input.f.js`) and `fjs compile` reads it from, and what it is.
 */
const mainLabel = `${main} (main module)`

/** The prefix of a dependency's field name, and the button that removes one. */
const filePrefix = 'file:'
const removePrefix = 'remove:'

/** The example `[main, files]` is, by ID, or `null` for a program of the reader's own. @type {(main: string, files: Files) => string | null} */
const exampleOf = (mainText, files) => {
    const id = picker.idOf(mainText)
    return id !== null && encode(dependenciesOf(id)) === encode(files) ? id : null
}

/**
 * `[main, files]` with `event` applied: an example picked, a file edited or
 * removed; `null` for an event no control of the page sends.
 *
 * @type {(mainText: string, files: Files) => (event: DemoEvent) => readonly [string, Files] | null}
 */
export const _edited = (mainText, files) => event => {
    if (event.kind === 'input') {
        if (event.name === exampleName) {
            const picked = picker.pick(event.value)
            return [picked, dependenciesOf(assertNotNullish(picker.idOf(picked)))]
        }
        if (event.name === name) { return [event.value, files] }
        if (!event.name.startsWith(filePrefix)) { return null }
        const file = event.name.slice(filePrefix.length)
        return [mainText, files.some(([n]) => n === file)
            ? files.map(([n, t]) => /** @type {File} */ ([n, n === file ? event.value : t]))
            : [...files, [file, event.value]]]
    }
    if (event.kind === 'click' && event.name.startsWith(removePrefix)) {
        const file = event.name.slice(removePrefix.length)
        return [mainText, files.filter(([n]) => n !== file)]
    }
    return null
}

/**
 * The boxes of a program: the main module, then each file its imports reach,
 * then each file they do not, marked and removable, then the cycle its
 * imports form, if they form one.
 *
 * @type {(state: DemoState) => readonly Element[]}
 */
const boxes = ({ main: mainText, files, imports }) => {
    const program = [/** @type {File} */ ([main, mainText]), ...files]
    /** @type {(file: string) => string} */
    const textOf = file => files.find(([n]) => n === file)?.[1] ?? ''
    const [, ...dependencies] = lastImports(imports)(program).map(([n]) => n)
    return [
        textField({ name, label: mainLabel, highlight }, mainText),
        ...dependencies.map(file => textField({ name: `${filePrefix}${file}`, label: file, rows: 4, highlight }, textOf(file))),
        ...files.filter(([n]) => !dependencies.includes(n)).map(/** @returns {Element} */ ([file, t]) => ['div', { 'data-not-imported': '' },
            textField({ name: `${filePrefix}${file}`, label: `${file} (not imported)`, rows: 4, highlight }, t),
            ['p', ['button', { type: 'button', name: `${removePrefix}${file}` }, `Remove ${file}`]],
        ]),
        ...cycleView(program),
        ...sandboxView(program),
        ...twiceLoadedView(program),
    ]
}

/**
 * What the page says of each file a program reaches both by a rooted path and
 * by a relative one: one box, read as two modules, so not shared
 * ([rooted-module-identity](../effects/node/virtual/todo/rooted-module-identity.md)).
 *
 * @type {(files: Files) => readonly Element[]}
 */
const twiceLoadedView = files => twiceLoaded(files).map(/** @returns {Element} */ file =>
    ['p', { role: 'note' }, `${file} is imported both by a / path and by a relative one: the compiler loads it as two modules, so the two are not shared.`])

/**
 * What the page says of each import whose file differs on the command line:
 * the page's program directory is its root, while `fjs compile` reads `/`
 * from the root of the disk and lets `../` leave the main module's directory.
 * Nothing where every import reads the same file both ways.
 *
 * @type {(files: Files) => readonly Element[]}
 */
const sandboxView = files => {
    const outside = outsideImports(files)
    return outside.length === 0 ? [] : [['p', { role: 'note' },
        `This page keeps the program in its own folder, so / is the folder and nothing is above it. On the command line, / is the root of the disk and ../ may leave the main module's folder, so these imports read other files there: ${outside.map(([file, specifier]) => `${file} imports ${specifier}`).join('; ')}.`]]
}

/**
 * The import cycle of `files`, every file it passes through, which the
 * compiler's `circular dependency` does not name; nothing where there is none.
 *
 * @type {(files: Files) => readonly Element[]}
 */
const cycleView = files => {
    const cycle = cycleOf(files)
    return cycle === null ? [] : [['p', { role: 'status' }, `Import cycle: ${cycle.join(' → ')}`]]
}

/** Compile one pane, absorbing both host failures and an unavailable catch operation.
 * @type {(files: Files, file: string) => Effect<Catch, Result<Marked, string>, never>}
 */
const pane = (files, file) => resultMapStep(catch_(() => compiledProgram(programOf(files))(file)), result => {
    if (result[0] === 'error') { return ok(error(errorMessage(result[1]))) }
    const [kind, value] = result[1]
    // The catch operation erases its thunk's return type through `do_`.
    return ok(kind === 'ok' ? /** @type {Result<Marked, string>} */ (value) : error(`Could not compile this output: ${String(value)}`))
})

const init = examples[0][1]

/** @type {Sharing<DemoState>} */
const sharing = {
    fields: { [name]: { default: init }, [filesField]: { default: encode([]) } },
    examples: examples.map(([, source, id]) => ({ id, inputs: { [name]: source, [filesField]: encode(dependenciesOf(id)) } })),
    validate: inputs => {
        const files = decode(String(inputs[filesField]))
        return files[0] === 'error' ? files[1] : null
    },
    read: ({ main: mainText, files }) => ({ [name]: mainText, [filesField]: encode(files) }),
    restore: inputs => ({ main: String(inputs[name]), files: unwrap(decode(String(inputs[filesField]))), panes: [], imports: [] }),
}

/** The imports a program's files have after an edit, from the ones they had before it. @type {(mainText: string, files: Files, imports: DemoState['imports']) => DemoState['imports']} */
const importsAfter = (mainText, files, imports) => lastImports(imports)([[main, mainText], ...files])

/** @type {Demo<DemoState, DemoEvent, Catch>} */
export const demo = {
    sharing,
    // Only the fixed initial example is compiled on load. Edited source is
    // always evaluated through `catch`, never by `view`.
    init: { main: init, files: [], panes: outputs.map(([, file]) => compiled(init)(file)), imports: importsAfter(init, [], []) },
    update: state => event => {
        // `outputs` is never empty, so no panes is a restored state.
        const restored = event.kind === 'start' && state.panes.length === 0
        const edited = _edited(state.main, state.files)(event)
        if (edited === null && !restored) { return pureOk(state) }
        const [mainText, files] = edited ?? [state.main, state.files]
        const program = [/** @type {File} */ ([main, mainText]), ...files]
        const panes = foldStep(pureOk(outputs), /** @type {DemoState['panes']} */ ([]),
            ([, file]) => panes => mapStep(pane(program, file), result => [...panes, result]))
        return mapStep(panes, panes => ({ main: mainText, files, panes, imports: importsAfter(mainText, files, state.imports) }))
    },
    view: state => ['div',
        ['p', intro],
        picker.view(exampleOf(state.main, state.files) === null ? '' : state.main),
        ...boxes(state),
        ...state.panes.map(/** @returns {Element} */ ([kind, value], index) => {
            const [label] = outputs[index]
            return ['section', ['h3', label], kind === 'ok' ? codeBlock(toText(value), `Copy ${label} output`, render(value)) : refusal(value)]
        })],
}
