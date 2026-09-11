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

import { asyncRun } from '../effects/module.mjs'
import { htmlToString } from '../media/html/module.f.mjs'

/**
 * A demo's effect, performed.
 *
 * **There are no browser operations yet, so there is nothing to implement.**
 * `Demo`'s vocabulary defaults to `never`, which makes every effect a demo can
 * build a `Pure` node: this runs it and never dispatches a command. The map is
 * empty because an empty vocabulary needs no handlers, not because handlers
 * are missing.
 *
 * **So the strict runner is the honest one today.** A partial runner exists to
 * answer `notImplemented` for a command a runtime knows about and cannot do —
 * and `partialMatch` checks the command against a declared vocabulary *first*,
 * so with no vocabulary every command is a malformed node and panics rather
 * than degrading. Nothing would be gained by dressing that up. When
 * `fjs/effects/browser/` lands with its first operation, it brings the
 * vocabulary, the partial runner, and a demo that can be told no.
 */
const run = asyncRun({})

/**
 * What the reader was doing, so re-rendering does not take it away.
 *
 * **Replacing the section's contents destroys the element they are typing
 * into.** A new one takes its place with the same `name` and the right value,
 * but focus and the caret belong to the node, not the name, so without this a
 * demo accepts exactly one character and then drops you. That is not a
 * refinement of wholesale replacement, it is what makes wholesale replacement
 * usable at all.
 *
 * The caret is `null` on a control that has no text to put one in — a
 * checkbox, a range — and restoring it is skipped rather than guessed.
 *
 * @type {(root: Element) => { readonly name: string, readonly start: number | null, readonly end: number | null } | null}
 */
const focused = root => {
    const active = /** @type {HTMLInputElement | null} */ (root.ownerDocument.activeElement)
    if (active === null || !root.contains(active) || active.name === undefined) { return null }
    return { name: active.name, start: active.selectionStart, end: active.selectionEnd }
}

/**
 * Puts the reader back where they were.
 *
 * By `name`, which is the only identity a demo gives its elements — the same
 * name its events come back under — so a view that keeps a field across a
 * state keeps the caret in it too.
 *
 * @type {(root: Element, was: ReturnType<typeof focused>) => void}
 */
const refocus = (root, was) => {
    if (was === null) { return }
    const next = /** @type {HTMLInputElement | null} */ (
        root.querySelector(`[name="${was.name}"]`))
    if (next === null) { return }
    next.focus()
    if (was.start !== null && was.end !== null && next.setSelectionRange !== undefined) {
        next.setSelectionRange(was.start, was.end)
    }
}

/**
 * Renders a state, and leaves the reader where they were.
 *
 * @type {(root: Element, view: string) => void}
 */
const render = (root, view) => {
    const was = focused(root)
    root.innerHTML = view
    refocus(root, was)
}

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
                render(root, htmlToString(demo.view(state)))
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
    render(root, htmlToString(demo.view(demo.init)))
    root.addEventListener('input', e => {
        const target = /** @type {HTMLInputElement} */ (e.target)
        step({ kind: 'input', name: target.name, value: target.value })
    })
    // After the first render, so a demo that needs an operation before it can
    // show anything has somewhere to ask without `init` becoming an effect.
    step({ kind: 'start' })
}
