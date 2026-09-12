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
import { commonOperationMap } from '../effects/common/module.mjs'
import { htmlToString } from '../media/html/module.f.mjs'

/**
 * What a demo may ask this page for.
 *
 * **Host-neutral operations only, and both of them are already written.**
 * `sandbox` runs a thunk and reports how long it took, `catch` reports whether
 * one threw — a browser has `performance.now()` and a `try` as surely as Node
 * does, which is why `effects/common` holds them rather than either host. A
 * demo that wants to measure something asks for `sandbox`; nothing in the page
 * knows what it is measuring.
 *
 * **The list is what makes a refusal possible.** `partialMatch` recognises a
 * command against it before answering `notImplemented`, so a vocabulary and a
 * handler map are two different things: a command named here with no handler
 * declines, and one not named here is a malformed node. There is nothing in
 * the first category today, and the first browser-only operation — a fetch, a
 * file the reader picks — is where that gap opens.
 *
 * @type {readonly ['sandbox', 'catch']}
 */
const commands = ['sandbox', 'catch']

const run = asyncPartialRun(/** @type {any} */ (commands))(
    /** @type {any} */ (commonOperationMap))

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
 * What a page shows when a demo breaks its own contract.
 *
 * `update` and `view` are FunctionalScript and total by construction, so one
 * that throws is a defect in the demo — and so is a module that names no
 * `demo`, or a path that does not load. The section says so where the demo's
 * output would have gone, because a blank section is indistinguishable from a
 * demo that renders nothing.
 *
 * @type {(root: Element, cause: unknown) => void}
 */
const fail = (root, cause) => {
    root.textContent = `demo failed: ${cause instanceof Error ? cause.message : String(cause)}`
}

/**
 * Return to the event loop, so the browser can paint what was just set.
 *
 * **A macrotask, and that is the whole point.** A demo's work is ordinary
 * JavaScript on the one thread that paints: `sandbox` calls the thunk the
 * moment it is dispatched, so a flag raised and then awaited is raised and
 * blocked in the same task and nobody ever sees it. Draining the microtask
 * queue is part of that same task, which is why an `await` of a resolved
 * promise is not enough — the same bargain the browser test runner makes
 * between rows.
 *
 * @type {() => Promise<void>}
 */
const macrotask = () => new Promise(resolve => { setTimeout(resolve, 0) })

/**
 * Says whether the page is waiting on this demo, and stops the reader asking
 * again while it is.
 *
 * **Only the runtime can say this.** A demo renders once, after its effect
 * has finished, so it cannot paint a state that means "still going" — the one
 * thing that knows a command is outstanding is the loop that dispatched it.
 *
 * **The word is the runtime's too, and so it is a general one.** This runs
 * every demo: the next may be waiting on a network or on a reader picking a
 * file, neither of which is calculating. A demo that wants its own wording
 * should say so in its own field rather than have this one guess.
 *
 * Buttons are disabled rather than merely dimmed. A queued second click would
 * be honoured after the first finished, which is a demo measuring twice
 * because somebody was impatient.
 *
 * @type {(root: Element, working: boolean) => void}
 */
const busy = (root, working) => {
    if (working) {
        root.setAttribute('data-demo-working', '')
    } else {
        root.removeAttribute('data-demo-working')
    }
    for (const control of root.querySelectorAll('button')) {
        control.disabled = working
    }
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
                busy(root, true)
                await macrotask()
                state = unwrapState(await run(demo.update(state)(event)))
                render(root, htmlToString(demo.view(state)))
            } catch (cause) {
                fail(root, cause)
            } finally {
                busy(root, false)
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
    // **The first render is reported like every later one.** It runs before
    // the queue exists, so without this a demo whose `view(init)` throws — or
    // whose module will not load, or names no `demo` — rejects a promise the
    // page script does not await, and the section stays blank. A blank
    // section is the one thing it must not be, because it is what a demo that
    // renders nothing looks like.
    try {
        const module = await import(path)
        const demo = /** @type {Demo<any, DemoEvent, never>} */ (module.demo)
        if (demo === undefined) { throw new Error(`${path} exports no demo`) }
        const step = stepper(root, demo)
        render(root, htmlToString(demo.view(demo.init)))
        root.addEventListener('input', e => {
            const target = /** @type {HTMLInputElement} */ (e.target)
            step({ kind: 'input', name: target.name, value: target.value })
        })
        // A click is how a demo is *asked* for work rather than told about
        // typing: a benchmark starts when a reader says so. An element with no
        // name is not one the demo asked to hear about.
        root.addEventListener('click', e => {
            const target = /** @type {HTMLElement & { name?: string }} */ (e.target)
            if (target.name === undefined || target.name === '') { return }
            step({ kind: 'click', name: target.name })
        })
        // After the first render, so a demo that needs an operation before it
        // can show anything has somewhere to ask without `init` becoming an
        // effect.
        step({ kind: 'start' })
    } catch (cause) {
        fail(root, cause)
    }
}
