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
 * @import { Catch, RandomInt, Sandbox } from '../effects/common/types.ts'
 * @import { BrowserOp } from '../effects/browser/types.ts'
 * @import { Demo, DemoEvent } from './demo/types.ts'
 * @import { Element as HtmlElement } from '../media/html/types.ts'
 * @import { _FieldMemory as FieldMemory } from './private.ts'
 */

import { asyncPartialRun } from '../effects/module.mjs'
import { commandsOf } from '../effects/module.f.mjs'
import { commonOperationMap, randomIntOperationMap } from '../effects/common/module.mjs'
import { browserOperationMap } from '../effects/browser/module.mjs'
import { macrotask, patch, toDom } from '../media/html/module.mjs'
import { copy } from './copy-runtime.mjs'
import { demoMarker, editorMarker, mirrorMarker } from './style/module.f.js'
import { editOf } from './demo/mirror/module.f.mjs'

/**
 * What a demo may ask this page for.
 *
 * **Host-neutral operations, and the browser's own.** `sandbox` runs a thunk
 * and reports how long it took, `catch` reports whether one threw, and
 * `randomInt` answers 32 random bits — a browser has `performance.now()`, a
 * `try` and `crypto.getRandomValues` as surely as Node does, which is why
 * `effects/common` holds them rather than either host. A demo that wants to
 * measure something asks for `sandbox`; nothing in the page knows what it is
 * measuring. `fetchText` and `instantiate` are `effects/browser`'s: a file
 * from the site, and a WebAssembly module from it, which the WASM demo pages
 * load.
 *
 * **The list is what makes a refusal possible.** `partialMatch` recognises a
 * command against it before answering `notImplemented`, so a vocabulary and a
 * handler map are two different things: a command named here with no handler
 * declines, and one not named here is a malformed node. There is nothing in
 * the first category today.
 *
 * Declared as a record because `CommandSet` is checked for *completeness*: a
 * command added to the vocabulary and forgotten here is a compile error, where
 * an array literal has only its members checked and drifts silently. The list
 * the runner tests membership against is derived from it, so the two cannot
 * disagree — the same shape `effects/node` uses for the same reason.
 *
 * @type {CommandSet<Sandbox | Catch | RandomInt | BrowserOp>}
 */
const commandSet = { sandbox: null, catch: null, randomInt: null, fetchText: null, instantiate: null }

/**
 * The commands of {@link commandSet}, in the form a partial runner tests
 * membership against.
 *
 * @type {Commands<Sandbox | Catch | RandomInt | BrowserOp>}
 */
const commands = commandsOf(commandSet)

const run = asyncPartialRun(commands)({ ...commonOperationMap, ...randomIntOperationMap, ...browserOperationMap })

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
 * because somebody was impatient. Incremental work skips this marker so Stop
 * and input remain available; its updates must stay small, including any
 * timed synchronous calls.
 * The next render restores the view's disabled attributes. Going idle must
 * preserve them, rather than enable actions the demo has explicitly refused.
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
        control.disabled = working || control.getAttribute('disabled') !== null
    }
}

/**
 * Every named field under the section — the only identity a demo gives its
 * elements, and the same name its events come back under.
 *
 * @type {(root: Element) => readonly HTMLInputElement[]}
 */
const fields = root =>
    /** @type {HTMLInputElement[]} */ (Array.from(root.querySelectorAll('[name]')))

/**
 * The first field under the section named `name`, or `null` for none.
 *
 * **By comparing the property, never by putting the name in a selector.** A
 * demo names its fields freely, and a name holding a quote, a backslash or a
 * line break is not a selector's text: interpolated into one, it finds
 * nothing or makes the lookup throw, and a throw aborts the render. Comparing
 * needs no escaping rule at all.
 *
 * @type {(root: Element, name: string) => HTMLInputElement | null}
 */
const byName = (root, name) => fields(root).find(el => el.name === name) ?? null

/**
 * Remembers one kind of the reader's doing across a render: captures it from
 * every named field now, and answers what puts it back on the field of the
 * same name afterwards. A field the next view no longer renders has nowhere
 * to put it, and is skipped rather than thrown.
 *
 * @type {<V>(memory: FieldMemory<V>) => (root: Element) => () => void}
 */
const remember = ({ capture, restore }) => root => {
    const kept = fields(root).flatMap(el => {
        const v = capture(el)
        return v === null ? [] : [{ name: el.name, v }]
    })
    return () => {
        for (const { name, v } of kept) {
            const next = byName(root, name)
            if (next !== null) { restore(next, v) }
        }
    }
}

/**
 * A field's manually-dragged size.
 *
 * **A drag sets an element's own inline style, which the next render does
 * not carry any more than it carries the caret** — the same problem, the
 * same fix, by the same identity. No demo writes a `style` attribute of its
 * own, so an inline `width` or `height` found here is a reader's drag and
 * nothing else.
 *
 * @type {FieldMemory<{ readonly width: string, readonly height: string }>}
 */
const size = {
    capture: ({ style: { width, height } }) => width === '' && height === '' ? null : { width, height },
    restore: (el, { width, height }) => {
        el.style.width = width
        el.style.height = height
    },
}

/**
 * What the reader was typing into, so re-rendering does not take it away.
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
 * @type {FieldMemory<{ readonly start: number | null, readonly end: number | null }>}
 */
const focus = {
    capture: el => {
        if (el !== el.ownerDocument.activeElement) { return null }
        const { selectionStart, selectionEnd } = /** @type {HTMLInputElement} */ (el)
        return { start: selectionStart, end: selectionEnd }
    },
    restore: (el, { start, end }) => {
        // The reader's own element, still in place: its focus and selection are
        // already theirs, and setting them again could only disturb them.
        if (el === el.ownerDocument.activeElement) { return }
        el.focus()
        const input = /** @type {HTMLInputElement} */ (el)
        if (start !== null && end !== null && input.setSelectionRange !== undefined) {
            input.setSelectionRange(start, end)
        }
    },
}

/**
 * A field's scroll offset.
 *
 * **A fresh element starts scrolled to the top**, so without this a long
 * field jumps back to its first line on every render — and a render follows
 * every click, including the one that ends a mouse selection. Offsets are the
 * reader's as surely as the caret and the size are, and they come back by the
 * same identity.
 *
 * @type {FieldMemory<{ readonly top: number, readonly left: number }>}
 */
const scroll = {
    capture: ({ scrollTop, scrollLeft }) => scrollTop === 0 && scrollLeft === 0 ? null : { top: scrollTop, left: scrollLeft },
    restore: (el, { top, left }) => {
        el.scrollTop = top
        el.scrollLeft = left
    },
}

/**
 * Everything a render puts back, in the order it puts it back.
 *
 * The size comes back before the scroll offset, because the size bounds how
 * far a field can scroll; and the offset comes back last, because focusing a
 * field and setting its selection may scroll it on its own. A size comes
 * back even to a field that stayed, because a patch removes the `style` a
 * drag wrote, the view not naming it.
 */
const memories = [remember(size), remember(focus), remember(scroll)]

/**
 * The coloured copy of a highlighted field's text, or `null` for a field that
 * has none.
 *
 * @type {(textarea: Element) => Element | null}
 */
const mirrorOf = textarea => {
    const mirror = textarea.previousElementSibling
    return mirror?.hasAttribute(mirrorMarker) ? mirror : null
}

/**
 * Keeps a highlighted field's coloured copy where its textarea is scrolled.
 *
 * The copy sits under the textarea and cannot be scrolled by the reader, so
 * it follows: its offset is set to the textarea's on every scroll, and after
 * every render, which can change the text the copy holds and the offset the
 * textarea was put back to.
 *
 * @type {(textarea: Element) => void}
 */
const follow = textarea => {
    const mirror = mirrorOf(textarea)
    if (mirror === null) { return }
    mirror.scrollTop = textarea.scrollTop
    mirror.scrollLeft = textarea.scrollLeft
}

/**
 * The text nodes under a node, in order.
 *
 * @type {(node: Node) => readonly Text[]}
 */
const textNodes = node => node.nodeType === 3
    ? [/** @type {Text} */ (node)]
    : Array.from(node.childNodes).flatMap(textNodes)

/**
 * The terminator a highlighted field's copy ends in, which keeps a final empty
 * line as tall as the textarea's.
 */
const terminator = '\u200b'

/**
 * Shows what the reader typed in a highlighted field's coloured copy at once.
 *
 * The textarea's own text is transparent, so the copy is the only text the
 * reader sees, and the render that colours it comes later — after the demo's
 * work, and after every input queued before it. Until then a keystroke would
 * paint the old text.
 *
 * **The edit is made in the copy, and the colours around it stay.** Redrawing
 * the copy as plain text would blink the whole field on every keystroke, for
 * as long as the render takes. `editOf` finds the one text node the edit falls
 * in, and only that node changes: what is typed takes the colour of the text
 * it is typed in, until the render colours it for what it is.
 *
 * An edit across several nodes, or in a copy that does not end as a copy
 * does, is shown as plain text instead — nothing is ever left that is not what
 * the reader typed. The render replaces either with the coloured copy.
 *
 * @type {(textarea: Element) => void}
 */
const echo = textarea => {
    const mirror = mirrorOf(textarea)
    if (mirror === null) { return }
    const { value, selectionStart } = /** @type {HTMLTextAreaElement} */ (textarea)
    const wanted = `${value}${terminator}`
    const nodes = textNodes(mirror)
    const shown = nodes.map(node => node.data).join('')
    if (shown !== wanted) {
        const edit = shown.endsWith(terminator)
            ? editOf({ was: shown.slice(0, -terminator.length), now: value, caret: selectionStart, lengths: nodes.map(node => node.data.length) })
            : null
        if (edit !== null) {
            const node = nodes[edit.index]
            node.data = `${node.data.slice(0, edit.at)}${edit.inserted}${node.data.slice(edit.at + edit.removed)}`
        }
        if (edit === null) { mirror.textContent = wanted }
    }
    follow(textarea)
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
 * What the reader did to the fields is captured before the patch and put back
 * after it, one kind of {@link memories} at a time: size, then focus, then
 * scroll.
 *
 * @type {(root: Element, view: HtmlElement) => void}
 */
const render = (root, view) => {
    const restores = memories.map(kind => kind(root))
    const shown = root.firstElementChild
    if (shown !== null && root.childNodes.length === 1 && shown.localName === view[0]) {
        patch(shown, view)
    } else {
        root.replaceChildren(toDom(root.ownerDocument, view))
    }
    for (const restore of restores) { restore() }
    for (const area of Array.from(root.querySelectorAll(`[${editorMarker}] > textarea`))) { follow(area) }
}

/**
 * Whether the reader changed a field from what its markup says, which is
 * what a reader can do to the build's first view before the runtime is there
 * to hear it.
 *
 * The same reading of a form control a patch makes when it puts one back to
 * its markup (`showDefault` in `media/html`): a radio button counts once it
 * is the one checked, as the browser reports the input on it and not on the
 * one it unchecked, and a file input is the reader's own business. Anything
 * else under the section with a name, a button above all, holds no input.
 *
 * @type {(field: HTMLInputElement) => boolean}
 */
const edited = field => {
    if (field.localName === 'textarea') { return field.value !== field.defaultValue }
    if (field.localName === 'select') {
        return Array.from(/** @type {HTMLSelectElement} */ (/** @type {unknown} */ (field)).options)
            .some(option => option.selected !== option.defaultSelected)
    }
    if (field.localName !== 'input') { return false }
    const type = (field.getAttribute('type') ?? '').toLowerCase()
    if (type === 'radio') { return field.checked && !field.defaultChecked }
    if (type === 'checkbox') { return field.checked !== field.defaultChecked }
    return type !== 'file' && field.value !== field.defaultValue
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
 * What an `input` event reports of a field: its value, but nothing for a
 * checkbox that is not checked, as a form leaves one out — a checkbox's
 * value is the same either way.
 *
 * @type {(field: HTMLInputElement) => string}
 */
const valueOf = field => field.type === 'checkbox' && !field.checked ? '' : field.value

/**
 * Whether the reader has asked for less motion, as the site's stylesheet
 * reads it: `prefers-reduced-motion: reduce`. A host without `matchMedia`
 * has not.
 *
 * @type {(root: Element) => boolean}
 */
const lessMotion = root =>
    root.ownerDocument.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true

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
 * `nextEvent` requests one automatic event on a later turn after the latest
 * state renders, `nextDelay` milliseconds later if the demo says — at once
 * where the reader has asked for less motion, since a delay only holds a
 * step of an animation on screen. Reader
 * events cancel the scheduled turn, and automatic updates keep controls
 * available so a Stop button can interrupt the work.
 *
 * @type {(root: Element, demo: Demo<any, DemoEvent, never>) => (event: DemoEvent) => void}
 */
const stepper = (root, demo) => {
    let state = demo.init
    /** @type {Promise<void>} */
    let queue = Promise.resolve()
    let pending = 0
    let incremental = false
    /** @type {ReturnType<typeof setTimeout> | undefined} */
    let scheduled
    /** @type {(event: DemoEvent, automatic?: boolean) => void} */
    const step = (event, automatic = false) => {
        const keepControls = automatic || incremental
        clearTimeout(scheduled)
        scheduled = undefined
        pending += 1
        queue = queue.then(async () => {
            // A throw is not a state. `update` and `view` are FunctionalScript
            // and total by construction, so one that throws is a defect in the
            // demo, and the page says so where its output would have gone.
            try {
                // Incremental work yields between small updates, possibly timed
                // by sandbox. Keep controls available for its reader events too.
                if (!keepControls) {
                    // Read the warning before the update; afterwards is too late.
                    // Then yield: `sandbox` calls the thunk the moment it is
                    // dispatched, so the flag would be raised and blocked in
                    // the same task, and nobody would ever see it.
                    busy(root, true, demo.wait === undefined ? null : demo.wait(state))
                    await macrotask()
                }
                state = unwrapState(await run(demo.update(state)(event)))
                if (pending === 1) {
                    render(root, demo.view(state))
                    const next = demo.nextEvent === undefined ? null : demo.nextEvent(state)
                    incremental = next !== null
                    if (next !== null) {
                        const delay = demo.nextDelay === undefined || lessMotion(root) ? 0 : demo.nextDelay(state)
                        scheduled = setTimeout(() => step(next, true), delay)
                    }
                }
            } catch (cause) {
                incremental = false
                fail(root, cause)
            } finally {
                pending -= 1
                if (!keepControls) { busy(root, false) }
            }
        })
    }
    return step
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
 * Starts the demo named by `demoMarker` inside `root`.
 *
 * The path is root-relative and taken verbatim: a relative specifier in the
 * `import()` below would resolve against *this module*, two directories deep,
 * and every demo outside `fjs/website/` would 404.
 *
 * @type {(root: Element) => Promise<void>}
 */
export const startDemo = async root => {
    const path = root.getAttribute(demoMarker)
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
        // **The build already rendered `view(init)` into the section**, and
        // the reader may have typed into it while this module loaded. Rendering
        // it again would put every field back to its markup and lose that, so
        // the section is taken over as it is, and what the reader changed is
        // heard below, as if typed now. An empty section is a page the build
        // could not render the demo into.
        const prerendered = root.firstElementChild !== null
        const edits = prerendered ? fields(root).filter(edited) : []
        if (!prerendered) { render(root, demo.view(demo.init)) }
        // A scroll does not bubble, so it is heard in the capture phase.
        root.addEventListener('scroll', e => {
            const target = /** @type {Element} */ (e.target)
            if (target.matches(`[${editorMarker}] > textarea`)) { follow(target) }
        }, true)
        root.addEventListener('input', e => {
            const target = /** @type {HTMLInputElement} */ (e.target)
            echo(target)
            step({ kind: 'input', name: target.name, value: valueOf(target) })
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
            if (text !== null) { void copy(button, text).catch(cause => fail(root, cause)); return }
            if (button.name === '') { return }
            step({ kind: 'click', name: button.name })
        })
        // SVG controls describe events as data; all state remains in the demo.
        root.addEventListener('click', e => {
            const target = /** @type {Element} */ (e.target).closest('[data-demo-click]')
            const name = target?.getAttribute('data-demo-click')
            if (target !== null && name !== undefined && name !== null) {
                step({ kind: 'click', name })
                // Pointer selection is already visible in the updated graph.
                // Remove its focus ring; keyboard activation keeps focus.
                if (/** @type {MouseEvent} */ (e).detail > 0 && 'blur' in target && typeof target.blur === 'function') { target.blur() }
            }
        })
        root.addEventListener('keydown', e => {
            const key = /** @type {KeyboardEvent} */ (e).key
            const target = /** @type {Element} */ (e.target).closest('[data-demo-click]')
            const name = target?.getAttribute('data-demo-click')
            if ((key === 'Enter' || key === ' ') && name !== undefined && name !== null) {
                e.preventDefault()
                step({ kind: 'click', name })
            }
        })
        // Native range controls provide the same input for keyboard users.
        // Capture on the stable root because rendering may patch the handle.
        /** @type {{ name: string, svg: SVGSVGElement, pointer: number } | null} */
        let drag = null
        root.addEventListener('pointerdown', e => {
            const pointer = /** @type {PointerEvent} */ (e)
            const target = /** @type {Element} */ (e.target).closest('[data-demo-drag]')
            const name = target?.getAttribute('data-demo-drag')
            const svg = target?.closest('svg')
            if (name === undefined || name === null || svg === null || svg === undefined) { return }
            drag = { name, svg: /** @type {SVGSVGElement} */ (svg), pointer: pointer.pointerId }
            root.setPointerCapture(pointer.pointerId)
            e.preventDefault()
        })
        root.addEventListener('pointermove', e => {
            const pointer = /** @type {PointerEvent} */ (e)
            if (drag === null || pointer.pointerId !== drag.pointer) { return }
            const { name, svg } = drag
            const matrix = svg.getScreenCTM()
            if (matrix === null) { return }
            const location = svg.createSVGPoint()
            location.x = pointer.clientX
            location.y = pointer.clientY
            const x = location.matrixTransform(matrix.inverse()).x
            const min = Number(svg.getAttribute('data-demo-x-min'))
            const max = Number(svg.getAttribute('data-demo-x-max'))
            const left = Number(svg.getAttribute('data-demo-x-left'))
            const right = Number(svg.getAttribute('data-demo-x-right'))
            // The slider's minimum can be inside the graph's left boundary.
            const range = byName(root, name)
            if (range === null || right <= left) { return }
            const value = Math.min(Number(range.max), Math.max(Number(range.min), min + (x - left) / (right - left) * (max - min)))
            step({ kind: 'input', name, value: value.toFixed(3) })
        })
        const endDrag = () => { drag = null }
        root.addEventListener('pointerup', endDrag)
        root.addEventListener('pointercancel', endDrag)
        root.addEventListener('lostpointercapture', endDrag)
        // After the first render, so a demo that needs an operation before it
        // can show anything has somewhere to ask without `init` becoming an
        // effect.
        step({ kind: 'start' })
        for (const field of edits) {
            echo(field)
            step({ kind: 'input', name: field.name, value: valueOf(field) })
        }
    } catch (cause) {
        fail(root, cause)
    }
}
