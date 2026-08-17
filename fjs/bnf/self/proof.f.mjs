/**
 * @import { CodePoint } from '../../text/utf16/types.ts'
 * @import { CodePointMeta } from '../descent/types.ts'
 */

import { stringToCodePointList } from '../../text/utf16/module.f.mjs'
import { map, toArray } from '../../types/list/module.f.mjs'
import { toData } from '../data/module.f.mjs'
import { descentParser } from '../descent/module.f.mjs'
import { assertEq } from '../../asserts/module.f.mjs'
import { syntax } from './module.f.mjs'

/** @type {(cp: CodePoint) => CodePointMeta<unknown>} */
const mapCodePoint = cp => [cp, undefined]

const [ruleSet, entry] = toData(syntax)
const match = descentParser(syntax)

/** @type {(s: string) => boolean} */
const matches = s => {
    const cp = toArray(map(mapCodePoint)(toArray(stringToCodePointList(s))))
    const result = match(entry, cp)
    return result.success && result.idx === cp.length
}

export const proof = {
    // the whole grammar has an entry rule with at least one production
    entry: () => {
        assertEq(typeof ruleSet[entry], 'object')
    },
    oneRule: () => {
        assertEq(matches('<digit> ::= "0" | "1" | "9"\n'), true)
    },
    ruleReference: () => {
        assertEq(matches('<digits> ::= <digit> | <digit> <digits>\n'), true)
    },
    multipleRules: () => {
        assertEq(matches(
            '<digit> ::= "0" | "1"\n' +
            '<digits> ::= <digit> | <digit> <digits>\n'
        ), true)
    },
    optWhitespaceAroundOperators: () => {
        assertEq(matches('<digit>::="0"|"1"\n'), true)
        assertEq(matches('<digit>   ::=   "0"   |   "1"\n'), true)
    },
    singleQuotedLiteral: () => {
        assertEq(matches("<pipe> ::= '|'\n"), true)
    },
    blankLineAfterRule: () => {
        assertEq(matches('<digit> ::= "0"\n\n'), true)
    },
    missingArrow: () => {
        assertEq(matches('<digit> = "0"\n'), false)
    },
    missingAngleBrackets: () => {
        assertEq(matches('digit ::= "0"\n'), false)
    },
    missingLineEnd: () => {
        assertEq(matches('<digit> ::= "0"'), false)
    },
    emptyRuleName: () => {
        assertEq(matches('<> ::= "0"\n'), false)
    },
}
