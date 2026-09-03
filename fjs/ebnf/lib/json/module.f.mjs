/**
 * @import { Rule } from '../../types.ts'
 */

import { range } from "../../module.f.mjs";

const onenine = range('19')

const digit = range('09')

/** @type {Rule} */
/*
export const string = [
    '"',
    repeat0Plus({
        ...remove(range(` ${unicodeMax}`), set('"\\')),
        escape: [
            '\\',
            {
                ...set('"\\/bfnrt'),
                u: [
                    'u',
                    ...repeat(4)({
                        digit,
                        AF: range('AF'),
                        af: range('af'),
                    })
                ],
            }
        ],
    }),
    '"'
]
*/
