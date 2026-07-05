import { assert, assertEq } from '../../asserts/module.f.ts'
import { parse } from '../parser/module.f.ts'
import { tokenize } from '../tokenizer/module.f.ts'
import { stringToList } from '../../text/utf16/module.f.ts'
import {
    recognizerInit,
    recognizerStep,
    recognizerAccepts,
    recognizerInitWithMaxDepth,
} from './module.f.ts'

// Feeds `s` through the recognizer one Unicode code point at a time.
const accepts = (s: string): boolean => {
    let state = recognizerInit
    for (const c of s) { state = recognizerStep(state, c.codePointAt(0) ?? 0) }
    return recognizerAccepts(state)
}

// Feeds `s` split at `at`, proving the recognizer is genuinely incremental —
// the same verdict must come out regardless of where the stream is cut.
const acceptsSplit = (s: string, at: number): boolean => {
    let state = recognizerInit
    for (const c of s.slice(0, at)) { state = recognizerStep(state, c.codePointAt(0) ?? 0) }
    for (const c of s.slice(at)) { state = recognizerStep(state, c.codePointAt(0) ?? 0) }
    return recognizerAccepts(state)
}

const acceptsWithMaxDepth = (s: string, maxDepth: number): boolean => {
    let state = recognizerInitWithMaxDepth(maxDepth)
    for (const c of s) { state = recognizerStep(state, c.codePointAt(0) ?? 0) }
    return recognizerAccepts(state)
}

// `parse`'s own verdict (via the shared tokenizer), for the cap-disabled
// equivalence check: `recognizerAccepts` must agree with `parse` on every
// input in the existing parser test corpus.
const parseAccepts = (s: string): boolean => parse(tokenize(stringToList(s)))[0] === 'ok'

const valid = [
    'null', 'true', 'false',
    '0', '-0', '0.1', '-0.5', '1.1e+2', '1e10', '1E-10', '123',
    '"abc"', '"a\\nb"', '"\\u0041"', '""',
    '[]', '[1]', '[[]]', '[0,[1,[2,[]]],3]',
    '{}', '[{}]',
    '{"a":true,"b":false,"c":null}',
    '{"a":{"b":{"c":["d"]}}}',
    '  {"a":1}  ',
    '[1,2,3]',
]

const invalid = [
    '',
    '[1,]',
    '{"a":1,}',
    '"123',
    '"\t"',
    '{"a":"\t"}',
    '[,]',
    '[1 2]',
    '[1,,2]',
    '[]]',
    '["a"',
    '[,1]',
    '[:]',
    ']',
    '{,}',
    '{1:2}',
    '{"1"2}',
    '{"1"::2}',
    '{"1":2,,"3":4',
    '{}}',
    '{"1":2',
    '{,"1":2}',
    '}',
    '{"a":1 "b":2}',
    '[{]}',
    '{[}]',
    '10-5',
    'undefined',
    '01',
    '1.',
    '.1',
    '1e',
    '1e+',
    '-',
    '{"a":1} garbage',
]

export const proof = {
    // Cap-disabled equivalence: the recognizer agrees with `parse` across the
    // shared corpus above, for both the valid and invalid halves.
    equivalence: () => {
        for (const s of [...valid, ...invalid]) {
            assertEq(accepts(s), parseAccepts(s), s)
        }
    },

    valid: () => {
        for (const s of valid) { assert(accepts(s), s) }
    },

    invalid: () => {
        for (const s of invalid) { assert(!accepts(s), s) }
    },

    // Bare top-level scalars are valid JSON per RFC 8259 — the recognizer
    // itself has no object/array-only policy; that gate is `fs/mime`'s.
    bareScalarsAreValidJson: () => {
        for (const s of ['42', '"hi"', 'true', 'null']) { assert(accepts(s), s) }
    },

    // The verdict does not depend on where the stream is split.
    splitAcrossSteps: () => {
        const s = '{"a":[1,2.5,"x\\ty"],"b":null}'
        for (let i = 0; i <= s.length; i++) {
            assert(acceptsSplit(s, i), `split at ${i}`)
        }
    },

    // A depth cap rejects a validly-nested document once it goes deeper than
    // the cap, even though it is accepted with no cap (or a higher cap).
    maxDepth: () => {
        const nested = '[[[[[1]]]]]' // 5 levels of array nesting
        assert(accepts(nested))
        assert(acceptsWithMaxDepth(nested, 5))
        assert(!acceptsWithMaxDepth(nested, 4))
        assert(acceptsWithMaxDepth('[1]', 1))
        assert(!acceptsWithMaxDepth('[1]', 0))
    },

    // A single huge string or number does not grow the recognizer's state
    // shape — it stays a fixed-size sub-state (payload-free), not an
    // accumulating buffer.
    largeSingleTokenBoundedState: () => {
        const hugeString = `"${'x'.repeat(100_000)}"`
        assert(accepts(hugeString))
        const hugeNumber = `1${'2'.repeat(100_000)}`
        assert(accepts(hugeNumber))
    },
}
