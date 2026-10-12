/** Shared browser clipboard controls for demos and the CLI reference. @module */

/**
 * Copy the text declared by a code block, directly from the click so
 * the browser keeps the reader's clipboard permission gesture. This is a
 * page control rather than a demo event: copying does not change demo state.
 * Pending copies ignore re-entry without disabling the focused button. Every
 * outcome gets visible feedback; resetting it clears the live region rather
 * than announcing the button's label as another status.
 *
 * @type {(button: HTMLButtonElement | HTMLInputElement, text: string) => Promise<void>}
 */
export const copy = async (button, text) => {
    const view = button.ownerDocument.defaultView
    if (view === null) { throw new Error('copy control has no window') }
    if (copyPending.has(button)) { return }

    const status = button.querySelector('[data-copy-status]')
    /** @type {(result: 'copied' | 'failed' | null, message: string) => void} */
    const setFeedback = (result, message) => {
        if (result === null) { button.removeAttribute('data-copy-feedback') }
        else { button.setAttribute('data-copy-feedback', result) }
        if (status !== null) { status.textContent = message }
    }

    copyPending.add(button)
    button.setAttribute('aria-disabled', 'true')
    view.clearTimeout(copyTimers.get(button))
    copyTimers.delete(button)
    setFeedback(null, '')

    try {
        const [result, message] = await write(view, text)
        setFeedback(result, message)
        copyTimers.set(button, view.setTimeout(() => {
            setFeedback(null, '')
            copyTimers.delete(button)
        }, copyFeedbackDurationMs))
    } finally {
        copyPending.delete(button)
        button.removeAttribute('aria-disabled')
    }
}

/** @type {(view: Window, text: string) => Promise<readonly ['copied' | 'failed', string]>} */
const write = async (view, text) => {
    try {
        const clipboard = view.navigator.clipboard
        if (clipboard === undefined) { return ['failed', 'Copy unavailable'] }
        await clipboard.writeText(text)
        return ['copied', 'Copied!']
    } catch {
        return ['failed', 'Copy failed']
    }
}

const copyFeedbackDurationMs = 2_000

/** @type {WeakMap<HTMLButtonElement | HTMLInputElement, number>} */
const copyTimers = new WeakMap()

/** @type {WeakSet<HTMLButtonElement | HTMLInputElement>} */
const copyPending = new WeakSet()
