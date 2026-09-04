/**
 * @import { Rule } from '../../types.ts'
 */

import { range, remove, repeat0Plus, unicodeMax, set, times } from "../../module.f.mjs";

const onenine = range('19')

const digit = range('09')

const hex = {
    digit,
    AF: range('AF'),
    af: range('af'),
}

/** @type {Rule} */
export const string = [
    '"',
    repeat0Plus({
        c: remove(range(` ${unicodeMax}`), set('"\\')),
        escape: [
            '\\',
            {
                c: set('"\\/bfnrt'),
                u: ['u', times(4)(hex)],
            }
        ],
    }),
    '"'
]

