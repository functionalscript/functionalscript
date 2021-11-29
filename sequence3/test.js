const _ = require('.')
const json = require('../json')
const { sort } = require('../object')

/** @type {(sequence: _.Sequence<json.Json>) => string} */
const fromSequence = sequence =>
    json.stringify(sort)(Array.from(_.iterable(sequence)))

/** @type {(value: _.Sequence<json.Json>) => (expected: string) => void} */
const assert_eq = value => expected => {
    const str = fromSequence(value)
    if (str !== expected) { throw str }
}

assert_eq(_.fromArray([1, 2, 3]))('[1,2,3]')
assert_eq(_.countdown(3))('[2,1,0]')

// stress tests

{
    // 200_000_000 is too much
    const n = 100_000_000
    const r = Array.from(_.iterable(_.countdown(n)))
    if (r.length !== n) { throw r.length }
}

{
    // 200_000 is too much
    const n = 100_000
    const r = Array.from(_.iterable(_.countdown(n)))
    const x = Array.from(_.iterable(_.list(...r)))
    if (x.length !== n) { throw r.length }
}