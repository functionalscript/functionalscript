import { editOf } from './module.f.js'
import { assert, assertStructurallySame } from '../../../asserts/module.f.js'

// The copy `a b` of a highlighted field, as the nodes `a`, ` b` and the
// terminator, one unit each at the end: lengths 1, 2 and 1.
/** @type {readonly number[]} */
const nodes = [1, 2, 1]

export const proof = {
    // Typing inside a token, and at the end of one, takes the token's colour:
    // the node before the place, where the place is a boundary.
    typing: () => {
        assertStructurallySame(editOf({ was: 'a b', now: 'aX b', caret: 2, lengths: nodes }), { index: 0, at: 1, removed: 0, inserted: 'X' })
        assertStructurallySame(editOf({ was: 'a b', now: 'a bX', caret: 4, lengths: nodes }), { index: 1, at: 2, removed: 0, inserted: 'X' })
    },
    // At the start the first node takes it, and into a copy of nothing but its terminator
    start: () => {
        assertStructurallySame(editOf({ was: 'a b', now: 'Xa b', caret: 1, lengths: nodes }), { index: 0, at: 0, removed: 0, inserted: 'X' })
        assertStructurallySame(editOf({ was: '', now: 'x', caret: 1, lengths: [1] }), { index: 0, at: 0, removed: 0, inserted: 'x' })
    },
    // Deleting one character, or a selection inside one token
    deleting: () => {
        assertStructurallySame(editOf({ was: 'a b', now: 'ab', caret: 1, lengths: nodes }), { index: 1, at: 0, removed: 1, inserted: '' })
        assertStructurallySame(editOf({ was: 'abc d', now: 'ad', caret: 1, lengths: [3, 2, 1] }), null)
        assertStructurallySame(editOf({ was: 'abcd e', now: 'ad e', caret: 1, lengths: [4, 2, 1] }), { index: 0, at: 1, removed: 2, inserted: '' })
    },
    // Replacing a selection that lies in one token
    replacing: () => {
        assertStructurallySame(editOf({ was: 'abc d', now: 'aXc d', caret: 2, lengths: [3, 2, 1] }), { index: 0, at: 1, removed: 1, inserted: 'X' })
    },
    // An edit across tokens is not answered: no colour would be right for it
    acrossNodes: () => {
        assertStructurallySame(editOf({ was: 'a b', now: '', caret: 0, lengths: nodes }), null)
        assertStructurallySame(editOf({ was: 'a b', now: 'Z', caret: 1, lengths: nodes }), null)
    },
    // Nothing changed: an edit that changes nothing
    unchanged: () => {
        assertStructurallySame(editOf({ was: 'a b', now: 'a b', caret: 3, lengths: nodes }), { index: 1, at: 2, removed: 0, inserted: '' })
    },
    // A run of equal characters is told apart by the caret: the edit ends at
    // it, so the new `a` of `aaaa` is the one before the caret, wherever it is
    caret: () => {
        assertStructurallySame(editOf({ was: 'aaa', now: 'aaaa', caret: 2, lengths: [3, 1] }), { index: 0, at: 1, removed: 0, inserted: 'a' })
        assertStructurallySame(editOf({ was: 'aaa', now: 'aaaa', caret: 4, lengths: [3, 1] }), { index: 0, at: 3, removed: 0, inserted: 'a' })
        assertStructurallySame(editOf({ was: 'aaa', now: 'aa', caret: 1, lengths: [3, 1] }), { index: 0, at: 1, removed: 1, inserted: '' })
    },
    // Pasting text that repeats the text it is pasted into ends at the caret
    // too, so it takes the node it was pasted into, not the one after it
    pasteOfRepeatedText: () => {
        assertStructurallySame(editOf({ was: 'aa', now: 'aaaa', caret: 2, lengths: [1, 1, 1] }), { index: 0, at: 0, removed: 0, inserted: 'aa' })
        assertStructurallySame(editOf({ was: 'aa', now: 'aaaa', caret: 4, lengths: [1, 1, 1] }), { index: 1, at: 1, removed: 0, inserted: 'aa' })
    },
    // Where the caret is not after the edit, the longest shared end is taken:
    // the text after the caret is not the old text's end (an undo that leaves
    // the caret at the start), the caret is beyond what could follow it, or it
    // is not a place in the text
    caretElsewhere: () => {
        assertStructurallySame(editOf({ was: 'abc', now: 'abXc', caret: 0, lengths: [3, 1] }), { index: 0, at: 2, removed: 0, inserted: 'X' })
        assertStructurallySame(editOf({ was: 'a', now: 'abc', caret: 0, lengths: [1, 1] }), { index: 0, at: 1, removed: 0, inserted: 'bc' })
        // in the text, but what follows it is not the old text's end: taking it
        // for the end would leave the old text as it was
        assertStructurallySame(editOf({ was: 'abcd', now: 'aXYd', caret: 1, lengths: [4, 1] }), { index: 0, at: 1, removed: 2, inserted: 'XY' })
        assertStructurallySame(editOf({ was: 'abc', now: 'abXc', caret: 9, lengths: [3, 1] }), { index: 0, at: 2, removed: 0, inserted: 'X' })
        assertStructurallySame(editOf({ was: 'abc', now: 'abXc', caret: -1, lengths: [3, 1] }), { index: 0, at: 2, removed: 0, inserted: 'X' })
        assertStructurallySame(editOf({ was: 'abc', now: 'abXc', caret: NaN, lengths: [3, 1] }), { index: 0, at: 2, removed: 0, inserted: 'X' })
    },
    // Whatever the caret, the edit turns the old text into the new: for every
    // pair of texts over two letters up to four long, and every caret from
    // before the text to after it, in a copy of one text node
    anyEditIsRight: () => {
        /** @type {(n: number) => readonly string[]} */
        const texts = n => n === 0 ? [''] : texts(n - 1).flatMap(t => [`${t}a`, `${t}b`])
        const all = [0, 1, 2, 3, 4].flatMap(texts).concat('')
        for (const was of all) {
            for (const now of all) {
                for (const caret of [-1, 0, 1, 2, 3, 4, 5, NaN]) {
                    const edit = editOf({ was, now, caret, lengths: [was.length, 1] })
                    assert(edit !== null, `${was} ${now} ${caret}`)
                    assertStructurallySame(`${was.slice(0, edit.at)}${edit.inserted}${was.slice(edit.at + edit.removed)}`, now)
                }
            }
        }
    },
}
