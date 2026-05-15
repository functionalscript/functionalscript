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

// Non-default exports are walked as a sibling test group (see issue 27).
export const namedExportTest = () => {
    if (2 + 2 !== 4) { throw 'arithmetic broken' }
}

export const namedExportGroup = {
    nested: () => {
        if ('a' + 'b' !== 'ab') { throw 'string concat broken' }
    },
    throw: () => { throw 'expected to throw' },
}
