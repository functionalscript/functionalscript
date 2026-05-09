// A helper whose own `name` is not `'throw'`. The test framework should still
// treat it as a pass-on-throw test when the enclosing key is `throw`.
const helperThrows: () => unknown = () => { throw 'helper failure' }

export default {
    throw: () => {
        throw [() => {}, () => {}]
    },
    // `throw` key with a function reference (function name is `helperThrows`).
    throwReference: {
        throw: helperThrows,
    },
    // `throw` key with a group: every leaf function under it must throw to pass.
    throwGroup: {
        throw: {
            inline: () => { throw 'inline failure' },
            reference: helperThrows,
            nested: {
                deep: () => { throw 'deep failure' },
            },
        },
    },
}
