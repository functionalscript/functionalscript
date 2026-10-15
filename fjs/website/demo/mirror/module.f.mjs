/**
 * Where an edit of a highlighted field lands in its coloured copy, so that
 * the copy can take the edit at once and keep the colours of everything the
 * reader did not touch.
 *
 * The textarea of a highlighted field has transparent text, so its copy is the
 * only text the reader sees, and the copy is redrawn, coloured, by the render
 * that follows a keystroke — after the demo's work. Until then the copy is
 * stale. Redrawing it plain would blink the whole field; this finds the one
 * place the text changed, so that the page runtime can change just that.
 *
 * **Only an edit inside one text node is answered.** Typing a character,
 * deleting one, or replacing a selection that lies within a single token is
 * nearly all editing, and the new text takes the colour of the text it is
 * inside, or of the text before it where an edit falls on a boundary. An edit
 * across several nodes — a paste over a selection that spans tokens, a cut —
 * is `null`: there is no one colour for what replaces it, and the runtime
 * falls back to the plain text until the render colours it.
 *
 * **The caret says where.** What differs between the old text and the new is
 * ambiguous in a run of equal characters: typing `a` into `aaa` leaves four,
 * and pasting `aa` before the `aa` of `aa` leaves `aaaa`, and any of them could
 * be the new ones. An edit ends at the caret — typed or pasted text is before
 * it, a deletion leaves it at the place deleted — so **what follows the caret
 * is what the edit did not touch**, and the change is the rest of the text,
 * from the longest start the old and new texts share. Where the old text does
 * not end as the new one does after the caret, as after an undo that leaves the
 * caret elsewhere, the longest end they share is taken instead.
 *
 * Offsets are UTF-16 units, as a DOM's are.
 *
 * @module
 *
 * @import { Edit, EditQuestion } from './types.ts'
 * @import { Scan } from '../../../types/function/operator/types.ts'
 */

import { scan, toArray } from '../../../types/list/module.f.mjs'

/** @type {(a: string, b: string) => number} */
const commonPrefix = (a, b) => {
    const max = Math.min(a.length, b.length)
    const first = Array.from({ length: max }).findIndex((_, i) => a[i] !== b[i])
    return first === -1 ? max : first
}

/** @type {(a: string, b: string, max: number) => number} */
const commonSuffix = (a, b, max) => {
    const first = Array.from({ length: max }).findIndex((_, i) => a[a.length - 1 - i] !== b[b.length - 1 - i])
    return first === -1 ? max : first
}

/**
 * Where each node starts, in one pass over their lengths.
 *
 * @type {(at: number) => Scan<number, number>}
 */
const startsFrom = at => length => [at, startsFrom(at + length)]

/**
 * The first node that holds an edit of `removed` units at `at` whole, which
 * is the node before the place where the place is a boundary: the edit takes
 * the colour of the text before it.
 *
 * @type {(lengths: readonly number[], at: number, removed: number) => { readonly index: number, readonly start: number } | null}
 */
const nodeOf = (lengths, at, removed) => {
    const found = toArray(scan(startsFrom(0))(lengths))
        .map((start, index) => ({ index, start, end: start + lengths[index] }))
        .find(({ start, end }) => start <= at && at + removed <= end)
    return found === undefined ? null : { index: found.index, start: found.start }
}

/**
 * The edit that turns the copy's text `was` into the field's `now`, if the
 * copy's text nodes can take it, or `null`.
 *
 * @type {(question: EditQuestion) => Edit | null}
 */
export const editOf = ({ was, now, caret, lengths }) => {
    const afterCaret = now.length - caret
    const caretIsAfterTheEdit = caret >= 0 && afterCaret >= 0 && was.endsWith(now.slice(caret))
    const suffix = caretIsAfterTheEdit ? afterCaret : commonSuffix(was, now, Math.min(was.length, now.length))
    const at = commonPrefix(was.slice(0, was.length - suffix), now.slice(0, now.length - suffix))
    const removed = was.length - at - suffix
    const node = nodeOf(lengths, at, removed)
    return node === null ? null : { index: node.index, at: at - node.start, removed, inserted: now.slice(at, now.length - suffix) }
}
