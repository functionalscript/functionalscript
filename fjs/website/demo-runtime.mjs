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
 * @import { CommandSet, Commands } from '../effects/types.ts'
 * @import { Catch, Sandbox } from '../effects/common/types.ts'
 * @import { Demo, DemoEvent } from './demo/types.ts'
 * @import { Element as HtmlElement } from '../media/html/types.ts'
 */

import { asyncPartialRun } from '../effects/module.mjs'
import { commonOperationMap } from '../effects/common/module.mjs'
import { patch, toDom } from '../media/html/module.mjs'

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
 * Declared as a record because `CommandSet` is checked for *completeness*: a
 * command added to the vocabulary and forgotten here is a compile error, where
 * an array literal has only its members checked and drifts silently. The list
 * the runner tests membership against is derived from it, so the two cannot
 * disagree — the same shape `effects/node` uses for the same reason.
 *
 * @type {CommandSet<Sandbox | Catch>}
 */
const commandSet = { sandbox: null, catch: null }

/**
 * The commands of {@link commandSet}, in the form a partial runner tests
 * membership against. The cast is the one `Object.keys` always needs: it
 * answers `string[]` for a record whose keys the type system knows exactly.
 *
 * @type {Commands<Sandbox | Catch>}
 */
const commands = /** @type {Commands<Sandbox | Catch>} */ (Object.keys(commandSet))

const run = asyncPartialRun(commands)(commonOperationMap)

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
 * says so in its own field — `wait` — and what it answers arrives here as
 * `note`, to be appended by the stylesheet rather than replace the word.
 * Empty is the ordinary case and renders nothing extra.
 *
 * Buttons are disabled rather than merely dimmed. A queued second click would
 * be honoured after the first finished, which is a demo measuring twice
 * because somebody was impatient.
 *
 * @type {(root: Element, working: boolean, note?: string | null) => void}
 */
const busy = (root, working, note = null) => {
    if (working) {
        root.setAttribute('data-demo-working', note === null ? '' : ` (${note})`)
    } else {
        root.removeAttribute('data-demo-working')
    }
    for (const control of root.querySelectorAll('button')) {
        control.disabled = working
    }
}

/**
 * What the reader was doing, so re-rendering does not take it away.
 *
 * **A render keeps the elements it can, but not every one.** {@link render}
 * patches the section in place, so a field that stays is the node the reader
 * is typing into and nothing here touches it. A field whose place in the view
 * changes is a new element with the same `name`, and focus and the caret
 * belong to the node, not the name — so for that one, this puts them back.
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
    // The reader's own element, still in place: its focus and selection are
    // already theirs, and setting them again could only disturb them.
    if (next === null || next === root.ownerDocument.activeElement) { return }
    next.focus()
    if (was.start !== null && was.end !== null && next.setSelectionRange !== undefined) {
        next.setSelectionRange(was.start, was.end)
    }
}

/**
 * Every field's manually-dragged size, by name.
 *
 * **A drag sets an element's own inline style, which the next render does
 * not carry any more than it carries the caret** — the same problem, the
 * same fix, by the same identity. No demo writes a `style` attribute of its
 * own, so an inline `width` or `height` found here is a reader's drag and
 * nothing else.
 *
 * @type {(root: Element) => readonly { readonly name: string, readonly width: string, readonly height: string }[]}
 */
const resized = root => (
    /** @type {HTMLInputElement[]} */ (Array.from(root.querySelectorAll('[name]')))
).filter(el => el.style.width !== '' || el.style.height !== '')
    .map(el => ({ name: el.name, width: el.style.width, height: el.style.height }))

/**
 * Puts every resized field back to the size the reader left it at.
 *
 * @type {(root: Element, was: ReturnType<typeof resized>) => void}
 */
const resize = (root, was) => {
    for (const { name, width, height } of was) {
        const next = /** @type {HTMLInputElement | null} */ (root.querySelector(`[name="${name}"]`))
        if (next === null) { continue }
        next.style.width = width
        next.style.height = height
    }
}

/**
 * Every field's scroll offset, by name.
 *
 * **A fresh element starts scrolled to the top**, so without this a long
 * field jumps back to its first line on every render — and a render follows
 * every click, including the one that ends a mouse selection. Offsets are the
 * reader's as surely as the caret and the size are, and they come back by the
 * same identity.
 *
 * @type {(root: Element) => readonly { readonly name: string, readonly top: number, readonly left: number }[]}
 */
const scrolled = root => (
    /** @type {HTMLInputElement[]} */ (Array.from(root.querySelectorAll('[name]')))
).filter(el => el.scrollTop !== 0 || el.scrollLeft !== 0)
    .map(el => ({ name: el.name, top: el.scrollTop, left: el.scrollLeft }))

/**
 * Scrolls every field back to where the reader left it.
 *
 * @type {(root: Element, was: ReturnType<typeof scrolled>) => void}
 */
const rescroll = (root, was) => {
    for (const { name, top, left } of was) {
        const next = /** @type {HTMLInputElement | null} */ (root.querySelector(`[name="${name}"]`))
        if (next === null) { continue }
        next.scrollTop = top
        next.scrollLeft = left
    }
}

/**
 * Renders a state, and leaves the reader where they were.
 *
 * **Patched, not replaced.** Replacing the section's contents rebuilt the
 * field under the reader's hands on every keystroke, leaving the runtime to
 * carry focus, caret, size and scroll across to a node the reader never
 * touched — and anything the browser held for the old node was lost with it:
 * its undo history, so Ctrl+Z did nothing in a demo field, and any
 * composition in progress. A patch keeps every element whose place
 * in the view is unchanged.
 * The section is rebuilt only when it holds something other than the
 * previous view — nothing yet, or a reported failure.
 *
 * The size comes back before the scroll offset, because the size bounds how
 * far a field can scroll; and the offset comes back last, because focusing a
 * field and setting its selection may scroll it on its own. A size comes
 * back even to a field that stayed, because a patch removes the `style` a
 * drag wrote, the view not naming it.
 *
 * @type {(root: Element, view: HtmlElement) => void}
 */
const render = (root, view) => {
    const was = focused(root)
    const sizes = resized(root)
    const offsets = scrolled(root)
    const shown = root.firstElementChild
    if (shown !== null && root.childNodes.length === 1 && shown.localName === view[0]) {
        patch(shown, view)
    } else {
        root.replaceChildren(toDom(root.ownerDocument, view))
    }
    resize(root, sizes)
    refocus(root, was)
    rescroll(root, offsets)
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
 * A demo runs one event at a time.
 *
 * An operation is asynchronous, so an event can arrive while an `update` is
 * still in flight. Serializing is what makes a demo's state a fold over its
 * events in the order they happened — the property its proof relies on — and
 * it is what the virtual runner can reproduce. The queue is this promise: each
 * event chains onto the last.
 *
 * **Only the last event queued renders.** A render makes the field being
 * typed into show the state's text, so rendering the state after one
 * keystroke once the reader has typed the next would put the older text back
 * under their caret: the newer keystroke is lost. An event
 * with a later one waiting behind it updates the state and leaves the page
 * alone; the later one renders.
 *
 * **A skipped state's `view` is not called, so a throw in it goes unreported —
 * and nothing that was seen is lost.** Reported, it would be replaced by the
 * very next render, the one this event was skipped for, a moment later. A
 * `view` that throws on a state the reader stops at is still reported, because
 * the last event always renders; a demo's proof is what calls `view` on every
 * input it cares about.
 *
 * @type {(root: Element, demo: Demo<any, DemoEvent, never>) => (event: DemoEvent) => void}
 */
const stepper = (root, demo) => {
    let state = demo.init
    /** @type {Promise<void>} */
    let queue = Promise.resolve()
    let pending = 0
    /** @type {(event: DemoEvent) => void} */
    return event => {
        pending += 1
        queue = queue.then(async () => {
            // A throw is not a state. `update` and `view` are FunctionalScript
            // and total by construction, so one that throws is a defect in the
            // demo, and the page says so where its output would have gone.
            try {
                // Read from the state the demo is *about* to be given: the
                // point of the warning is to arrive before the wait, and after
                // `update` there is nothing left to warn about.
                busy(root, true, demo.wait === undefined ? null : demo.wait(state))
                await macrotask()
                state = unwrapState(await run(demo.update(state)(event)))
                if (pending === 1) { render(root, demo.view(state)) }
            } catch (cause) {
                fail(root, cause)
            } finally {
                pending -= 1
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
 * Copy the text declared by a demo's code block, directly from the click so
 * the browser keeps the reader's clipboard permission gesture. This is a
 * page control rather than a demo event: copying does not change demo state.
 *
 * @type {(button: HTMLButtonElement | HTMLInputElement, text: string) => Promise<void>}
 */
const copy = async (button, text) => {
    const title = button.getAttribute('aria-label') ?? 'Copy'
    const previous = copyTimers.get(button)
    if (previous !== undefined) { clearTimeout(previous) }
    button.removeAttribute('data-copied')
    /** @type {(message: string) => void} */
    const report = message => {
        button.title = message
        const status = button.querySelector('[data-copy-status]')
        if (status !== null) { status.textContent = message }
    }
    button.disabled = true
    try {
        const clipboard = button.ownerDocument.defaultView?.navigator.clipboard
        if (clipboard === undefined) {
            report('Copy unavailable')
            return
        }
        await clipboard.writeText(text)
        report('Copied!')
        button.setAttribute('data-copied', '')
        copyTimers.set(button, setTimeout(() => {
            button.removeAttribute('data-copied')
            report(title)
            copyTimers.delete(button)
        }, 2000))
    } catch {
        report('Copy failed')
    } finally {
        button.disabled = false
    }
}

/** @type {WeakMap<HTMLButtonElement | HTMLInputElement, ReturnType<typeof setTimeout>>} */
const copyTimers = new WeakMap()

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
        render(root, demo.view(demo.init))
        root.addEventListener('input', e => {
            const target = /** @type {HTMLInputElement} */ (e.target)
            step({ kind: 'input', name: target.name, value: target.value })
        })
        // A click is how a demo is *asked* for work rather than told about
        // typing: a benchmark starts when a reader says so. So only a named
        // button asks — a `<button>` or an `<input type="button">`. A click in
        // a field is the reader placing a caret or ending a selection, already
        // the field's own business, and an element with no name is not one the
        // demo asked to hear about. The button is the nearest one around the
        // target, because a button's label may be markup of its own and the
        // reader clicks whichever part of it is under the pointer.
        root.addEventListener('click', e => {
            const button = /** @type {HTMLButtonElement | HTMLInputElement | null} */ (
                /** @type {Element} */ (e.target).closest('button, input[type="button"]'))
            if (button === null || button.disabled) { return }
            const text = button.getAttribute('data-copy')
            if (text !== null) { void copy(button, text); return }
            if (button.name === '') { return }
            step({ kind: 'click', name: button.name })
        })
        // After the first render, so a demo that needs an operation before it
        // can show anything has somewhere to ask without `init` becoming an
        // effect.
        step({ kind: 'start' })
    } catch (cause) {
        fail(root, cause)
    }
}
