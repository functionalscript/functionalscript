/**
 * A program that performs an operation per word, run by a mock runner, with
 * every operation the runner was asked to perform and what the program
 * answered.
 *
 * **The program is data until something runs it.** `ask(word)` does not ask
 * anything: it is a `Do` node naming the command `ask` and its payload. The
 * runner here is [`mock`](./mock/module.f.mjs)'s `run`, which answers each
 * command from a handler and threads a state through, and the state it keeps
 * is the trace this demo prints.
 *
 * **A failure stops the program, and the trace shows where.** The handler
 * refuses the word `fail`, and `foldStep` propagates that refusal the way
 * `step` does: no word after it is asked, so the trace ends there and the
 * program answers the error. That is the default this layer exists to give
 * ([`README.md`](./README.md#why-the-layer-exists)).
 *
 * **It needs no operations of its own.** The program's operations are
 * answered by the mock inside `render`, so `update` declares `never` and
 * returns its next state through `pureOk`.
 *
 * @module
 *
 * @import { DemoAsk as Ask, Effect } from './types.ts'
 * @import { MemOperationMap } from './mock/types.ts'
 * @import { Result } from '../types/result/types.ts'
 * @import { Demo, DemoEvent } from '../website/demo/types.ts'
 */

import { codeMarker } from '../website/style/module.f.js'
import { textDemo, caption } from '../website/demo/module.f.mjs'
import { do_, foldStep, mapStep, pureOk } from './module.f.mjs'
import { run } from './mock/module.f.mjs'
import { error, ok } from '../types/result/module.f.js'

/** @type {(word: string) => Effect<Ask, string, string>} */
export const ask = do_('ask')

/**
 * The program: ask about each word in order, collecting the answers, and stop
 * at the first refusal.
 *
 * @type {(words: readonly string[]) => Effect<Ask, readonly string[], string>}
 */
export const program = words => foldStep(
    pureOk(words),
    /** @type {readonly string[]} */([]),
    word => answers => mapStep(ask(word), answer => [...answers, answer]))

/**
 * The mock's handler for `ask`: the word in capitals, or a refusal for
 * `fail`, with the request and its answer appended to the trace.
 *
 * @type {(word: string) => (trace: readonly string[]) => readonly [readonly string[], Result<string, string>]}
 */
const answerAsk = word => trace => {
    const r = word === 'fail' ? error('refused') : ok(word.toUpperCase())
    const [tag, value] = r
    return [[...trace, `ask('${word}') -> ${tag} '${value}'`], r]
}

/** The mock runner's handlers: `ask` alone. @type {MemOperationMap<Ask, readonly string[]>} */
const handlers = { ask: answerAsk }

/**
 * The program run on the words of `text`, as the trace of operations and the
 * program's answer.
 *
 * @type {(text: string) => readonly [readonly string[], Result<readonly string[], string>]}
 */
export const runWords = text => {
    const words = text.replaceAll('\n', ' ').split(' ').filter(w => w !== '')
    return run(handlers)(/** @type {readonly string[]} */([]))(program(words))
}

/** @type {(r: Result<readonly string[], string>) => string} */
const showResult = ([tag, value]) => tag === 'ok' ? `ok [${value.map(w => `'${w}'`).join(', ')}]` : `error '${value}'`

/** @type {Demo<string, DemoEvent>} */
export const demo = textDemo({
    intro: "Type some words. The program asks the runner about each word in turn; this mock runner answers in capitals and refuses the word 'fail', which stops the program.",
    name: 'words',
    label: 'Words',
    rows: 2,
    init: 'read the fail file',
})(text => {
    const [trace, result] = runWords(text)
    return [
        caption('Operations the runner performed:'),
        ['pre', { [codeMarker]: '' }, trace.length === 0 ? '(none)' : trace.join('\n')],
        caption('The program answered:'),
        ['pre', { [codeMarker]: '' }, showResult(result)],
    ]
})
