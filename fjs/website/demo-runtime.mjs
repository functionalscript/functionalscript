/**
 * The one impure half of every demo: it renders what a demo describes, watches
 * the section for input, and hands each event back.
 *
 * **Written once so a demo author writes no host code.** A demo module is
 * FunctionalScript, so it cannot touch the DOM or register a listener; it
 * answers with a `media/html` tree and a next state, and this drives it. An
 * impure `demo.mjs` beside every module was the alternative, and it is the
 * migration debt `AGENTS.md` names, multiplied by every demo.
 *
 * @import { Demo, DemoEvent } from './demo/types.ts'
 */

import { asyncPartialRun } from '../effects/module.mjs'
import { htmlToString } from '../media/html/module.f.mjs'

/**
 * The operations a demo may ask for, and the handlers this runtime has.
 *
 * Both are empty, and that is the starting position rather than an oversight:
 * every operation answers `notImplemented` through the demo's own channel, the
 * demo shows what it could not do, and the page keeps working. A capability is
 * added here with its virtual counterpart, one at a time, when a demo needs
 * it.
 */
const commands = /** @type {readonly never[]} */ ([])

const run = asyncPartialRun(commands)({})

/**
 * A demo runs one event at a time.
 *
 * An operation is asynchronous, so an event can arrive while an `update` is
 * still in flight. Serializing is what makes a demo's state a fold over its
 * events in the order they happened — the property its proof relies on — and
 * it is what the virtual runner can reproduce. The queue is this promise: each
 * event chains onto the last.
 *
 * @type {(root: Element, demo: Demo<any, DemoEvent, never>) => (event: DemoEvent) => void}
 */
const stepper = (root, demo) => {
    let state = demo.init
    /** @type {Promise<void>} */
    let queue = Promise.resolve()
    /** @type {(event: DemoEvent) => void} */
    return event => {
        queue = queue.then(async () => {
            // A throw is not a state. `update` and `view` are FunctionalScript
            // and total by construction, so one that throws is a defect in the
            // demo, and the page says so where its output would have gone.
            try {
                state = unwrapState(await run(demo.update(state)(event)))
                root.innerHTML = htmlToString(demo.view(state))
            } catch (cause) {
                root.textContent = `demo failed: ${cause instanceof Error ? cause.message : String(cause)}`
            }
        })
    }
}

/**
 * The value inside a demo's result.
 *
 * A demo's error channel is `never` — it absorbs its own recoverable failures
 * into the state it renders — so an `error` here is a demo that broke its own
 * contract, and a throw is the honest answer to it.
 *
 * @type {(result: readonly [string, any]) => any}
 */
const unwrapState = result => {
    if (result[0] === 'error') {
        throw new Error(`a demo returned an error, but its channel is never: ${String(result[1])}`)
    }
    return result[1]
}

/**
 * Starts the demo named by `data-demo` inside `root`.
 *
 * The path is root-relative and taken verbatim: a relative specifier in the
 * `import()` below would resolve against *this module*, two directories deep,
 * and every demo outside `fjs/website/` would 404.
 *
 * @type {(root: Element) => Promise<void>}
 */
export const startDemo = async root => {
    const path = root.getAttribute('data-demo')
    if (path === null) { return }
    const module = await import(path)
    const demo = /** @type {Demo<any, DemoEvent, never>} */ (module.demo)
    const step = stepper(root, demo)
    root.innerHTML = htmlToString(demo.view(demo.init))
    root.addEventListener('input', e => {
        const target = /** @type {HTMLInputElement} */ (e.target)
        step({ kind: 'input', name: target.name, value: target.value })
    })
    // After the first render, so a demo that needs an operation before it can
    // show anything has somewhere to ask without `init` becoming an effect.
    step({ kind: 'start' })
}
