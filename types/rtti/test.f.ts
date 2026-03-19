type Tests = {
    readonly[K in string]: readonly unknown[]
}

const tests: Tests = {
    undefined: [undefined],
    boolean: [true, false],
    string: ['hello'],
    number: [3],
    bigint: [4n],
    object: [null, {}, []],
    function: [() => undefined]
}

export default Object.fromEntries(Object.entries(tests).map(([k, a]) => [k, a.map(v => () => {
    if (typeof v !== k) { throw `typeof ${v} !== ${k}` }
})]))
