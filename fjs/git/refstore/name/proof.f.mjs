/**
 * The codec on its own, with no filesystem: every rule here is a function of
 * a name's bytes. What the store makes of each answer — which file it opens,
 * which name it refuses — is [`../proof.f.mjs`](../proof.f.mjs)'s.
 *
 * Names are written byte per code unit through `latin1`, so `\xC3\xA9` is the
 * two bytes of `é` and `\x80` is the one byte no UTF-8 starts with.
 */

import { assert, assertEq, assertStructurallySame } from '../../../asserts/module.f.mjs'
import { maxLengthBytes } from '../../../types/bit_vec/module.f.mjs'
import { latin1 } from '../../testlib.f.mjs'
import { askable, head, headName, isUnderRefs, nameBytes, nameForMessage, nameKey, nameText, refsPrefix } from './module.f.mjs'

/** A name of `n` bytes, every one of them `a`. @type {(n: number) => readonly number[]} */
const ofLength = n => Array.from({ length: n }, () => 0x61)

export const proof = {
    // A path's text is its UTF-8 bytes, and the bytes read back as the text.
    nameBytes: () => {
        assertStructurallySame(nameBytes('é'), [0xc3, 0xa9])
        assertStructurallySame(nameBytes('refs/heads/x'), latin1('refs/heads/x'))
        assertEq(nameText(nameBytes('refs/heads/é')), 'refs/heads/é')
    },
    // A key is a code unit per byte: two names share one exactly when they are
    // the same bytes, and the key of `é` is not the text `é`.
    nameKey: () => {
        assertEq(nameKey([0xc3, 0xa9]), '\xC3\xA9')
        assertEq(nameKey(nameBytes('é')), nameKey(latin1('\xC3\xA9')))
        assert(nameKey(nameBytes('é')) !== 'é')
        assert(nameKey(latin1('ab')) !== nameKey(latin1('ba')))
    },
    head: () => {
        assertEq(head, 'HEAD')
        assertStructurallySame(headName, latin1('HEAD'))
        assertEq(refsPrefix, 'refs/')
    },
    // `null` where no path can be built: bytes that are no UTF-8, and a name
    // one byte past what a `Vec` holds — which is refused before the
    // conversion asserts.
    nameText: () => {
        assertEq(nameText(latin1('\xC3\xA9')), 'é')
        assertEq(nameText(latin1('refs/heads/\x80')), null)
        const size = Number(maxLengthBytes)
        assertEq(nameText(ofLength(size))?.length, size)
        assertEq(nameText(ofLength(size + 1)), null)
    },
    // The one rule `HEAD`'s target is held to: one level under `refs/` is
    // enough, `refs` alone is not, and a name no path can spell is not under
    // anything.
    isUnderRefs: () => {
        assertEq(isUnderRefs(latin1('refs/x')), true)
        assertEq(isUnderRefs(latin1('refs/heads/master')), true)
        assertEq(isUnderRefs(latin1('refs')), false)
        assertEq(isUnderRefs(latin1('a/b')), false)
        assertEq(isUnderRefs(latin1('refs/heads/\x80')), false)
    },
    // A name the store may ask the filesystem about is a whole ref name with a
    // path spelling; `../secret` is the first refusal and `\x80` the second.
    askable: () => {
        assertEq(askable(latin1('HEAD')), 'HEAD')
        assertEq(askable(latin1('refs/heads/\xC3\xA9')), 'refs/heads/é')
        assertEq(askable(latin1('../secret')), null)
        assertEq(askable(latin1('refs/heads/a..b')), null)
        assertEq(askable(latin1('refs/heads/\x80')), null)
    },
    // A name that is no UTF-8 is written as its bytes in hex, two digits each.
    nameForMessage: () => {
        assertEq(nameForMessage(latin1('refs/heads/\xC3\xA9')), 'refs/heads/é')
        assertEq(nameForMessage(latin1('\x80\x01')), '8001')
    },
}
