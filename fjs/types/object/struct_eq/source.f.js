/** The core supplies its own SameValue while bootstrapping the runtime.
 * @param {boolean} core
 * @returns {string}
 */
export const structEqBody = core => `(a, b) => {${core ? '\n    /** @type {_StructEqStack<unknown, Entry<unknown>>} */' : ''}
    let pending = { tag: 'value', a, b, n: undefined }
    while (pending !== undefined) {${core ? '\n        /** @type {NonNullable<_StructEqStack<unknown, Entry<unknown>>>} */' : ''}
        const frame = pending
        pending = frame.n
        if (frame.tag !== 'value') {
            const i = frame.i
            if (i === frame.a.length) { continue }${core ? '\n            /** @type {_StructEqStack<unknown, Entry<unknown>>} */' : ''}
            const next = i + 1 === frame.a.length ? pending : { ...frame, i: i + 1 }
            if (frame.tag === 'array') {
                pending = { tag: 'value', a: frame.a[Number(i)], b: frame.b[Number(i)], n: next }
            } else {
                const left = frame.a[Number(i)]
                const right = frame.b[Number(i)]
                if (left[0] !== right[0]) { return false }
                pending = { tag: 'value', a: left[1], b: right[1], n: next }
            }
            continue
        }
        const x = frame.a
        const y = frame.b
        if (${core ? 'sameValue' : 'Object.is'}(x, y)) { continue }
        if (x === null || typeof x !== 'object' || y === null || typeof y !== 'object') { return false }
        if (x instanceof Array) {
            if (!(y instanceof Array) || x.length !== y.length) { return false }
            pending = { tag: 'array', a: x, b: y, i: 0, n: pending }
        } else {
            if (y instanceof Array) { return false }
            const left = ${core ? 'entries' : 'Object.entries'}(x)
            const right = ${core ? 'entries' : 'Object.entries'}(y)
            if (left.length !== right.length) { return false }
            pending = { tag: 'object', a: left, b: right, i: 0, n: pending }
        }
    }
    return true
}`

/** Portable spelling used to recognize and serialize the ordered comparison. */
export const structEqSource = `const structEq = ${structEqBody(false)}`
