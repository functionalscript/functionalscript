import { editOf } from './module.f.mjs'
import { assertStructurallySame } from '../../../asserts/module.f.mjs'

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
    // A run of equal characters is told apart by the caret: the new `a` of
    // `aaaa` is the one before it, wherever it is
    caret: () => {
        assertStructurallySame(editOf({ was: 'aaa', now: 'aaaa', caret: 2, lengths: [3, 1] }), { index: 0, at: 2, removed: 0, inserted: 'a' })
        assertStructurallySame(editOf({ was: 'aaa', now: 'aaaa', caret: 4, lengths: [3, 1] }), { index: 0, at: 3, removed: 0, inserted: 'a' })
        assertStructurallySame(editOf({ was: 'aaa', now: 'aa', caret: 1, lengths: [3, 1] }), { index: 0, at: 1, removed: 1, inserted: '' })
    },
}
