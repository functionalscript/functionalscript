const _ = require('..')
const { todo } = require('../../../dev')
const cmp = require('../../function/compare')
const find = require('../find')
const list = require('../../list')

/**
 * @template T
 * @typedef {undefined | _.Leaf1<T>} Leaf01
 */

/**
 * @template T
 * @typedef {{
 *  readonly first: Leaf01<T>,
 *  readonly tail: find.Path<T>
 * }} RemovePath
 */

/** @type {<T>(tail: find.Path<T>) => (n: _.Node<T>) => readonly[T, RemovePath<T>]} */
const path = tail => n => {
    switch (n.length) {
        case 1: { return [n[0], { first: undefined, tail }] }
        case 2: { return [n[0], { first: [n[1]], tail }] }
        case 3: { return path({ first: [0, n], tail })(n[0]) }
        case 5: { return path({ first: [0, n], tail })(n[0]) }
    }
}

/**
 * @template T
 * @typedef {_.Branch1<T> | _.Branch3<T> | _.Branch5<T>} Branch
 */

/** @type {<T>(a: Branch<T>) => (n: _.Branch3<T>) => _.Branch1<T> | _.Branch3<T>} */
const reduceValue0 = a => n => {
    const [, v1, n2] = n
    if (a.length === 1) {
        switch (n2.length) {
            case 3: { return [[a[0], v1, ...n2]] }
            case 5: { return [[a[0], v1, n2[0]], n2[1], [n2[2], n2[3], n2[4]]] }
            default: { throw 'invalid node' }
        }
    } else {
        return [a, v1, n2]
    }
}

/** @type {<T>(a: Branch<T>) => (n: _.Branch3<T>) => _.Branch1<T> | _.Branch3<T>} */
const reduceValue2 = a => n => {
    const [n0, v1, ] = n
    if (a.length === 1) {
        switch (n0.length) {
            case 3: { return [[...n0, v1, a[0]]] }
            case 5: { return [[n0[0], n0[1], n0[2]], n0[3], [n0[4], v1, a[0]]] }
            default: { throw 'invalid node' }
        }
    } else {
        return [n0, v1, a]
    }
}

/** @type {<T>(a: Branch<T>) => (i: find.PathItem<T>) => Branch<T>} */
const reduce = a => i => {
    /** @typedef {typeof a extends Branch<infer T> ? T : never} T */
    /** @type {(r: (a: Branch<T>) => (n: _.Branch3<T>) => _.Branch1<T> | _.Branch3<T>) => Branch<T>} */
    const f = r => {
        const n = i[1]
        const ra = r(a)
        return n.length === 3 ? ra(n) : [...ra([n[0], n[1], n[2]]), n[3], n[4]]
    }
    switch (i[0]) {
        case 0: { return f(reduceValue0) }
        case 2: { return f(reduceValue2) }
        case 4: {
            const n = i[1]
            return [n[0], n[1], ...reduceValue2(a)([n[2], n[3], n[4]])]
        }
    }
}

/** @type {<T>(c: cmp.Compare<T>) => (node: _.Node<T>) => undefined | _.Node<T>} */
const remove = c => node => {
    /** @typedef {typeof c extends cmp.Compare<infer T> ? T : never} T */
    /** @type  {() => undefined | RemovePath<T>} */
    const f = () => {
        const { first, tail } = find.find(c)(node)
        /** @type {(n: _.Node<T>) => (f: (v: T) => find.PathItem<T>) => RemovePath<T>} */
        const branch = n => f => {
            const [v, p] = path(/** @type {find.Path<T>} */(undefined))(n)
            return { first: p.first, tail: list.concat(p.tail)({ first: f(v), tail }) }
        }
        switch (first[0]) {
            case 1: {
                const n = first[1]
                switch (n.length) {
                    case 1: { return { first: undefined, tail } }
                    case 2: { return { first: [n[1]], tail } }
                    case 3: { return branch(n[2])(v => [2, [n[0], v, n[2]]]) }
                    case 5: { return branch(n[2])(v => [2, [n[0], v, n[2], n[3], n[4]]]) }
                }
            }
            case 3: {
                const n = first[1]
                switch (n.length) {
                    case 2: { return { first: [n[0]], tail } }
                    case 5: { return branch(n[4])(v => [4, [n[0], n[1], n[2], v, n[4]]]) }
                }
            }
            default: { return undefined }
        }
    }
    const r = f()
    if (r === undefined) { return node }
    const { first, tail } = r
    const tailR = list.next(tail)
    if (tailR === undefined) { return first }
    const { first: tf, tail: tt } = tailR
    /** @type {() => Branch<T>} */
    const init = () => {
        switch (tf[0]) {
            case 0: {
                const n = tf[1]
                if (n.length === 3) {
                    const [,v1,n2] = n
                    if (first === undefined) {
                        switch (n2.length) {
                            case 1: { return [[v1, n2[0]]] }
                            case 2: { return [[v1], n2[0], [n2[1]]] }
                            default: { throw 'invalid node' }
                        }
                    } else {
                        return [first, v1, n2]
                    }
                } else {
                    const [,v1,n2,v3,n4] = n
                    if (first === undefined) {
                        switch (n2.length) {
                            case 1: { return [[v1, n2[0]], v3, n4] }
                            case 2: { return [[v1], n2[0], [n2[1]], v3, n4] }
                            default: { throw 'invalid node' }
                        }
                    } else {
                        return [first, v1, n2, v3, n4]
                    }
                }
            }
            case 2: {
                const n = tf[1]
                if (n.length === 3) {
                    const [n0, v1,] = n
                    if (first === undefined) {
                        switch (n0.length) {
                            case 1: { return [[n0[0], v1]] }
                            case 2: { return [[n0[0]], n0[1], [v1]] }
                            default: { throw 'invalid node' }
                        }
                    } else {
                        return [n0, v1, first]
                    }
                } else {
                    const [n0, v1, , v3, n4] = n
                    if (first === undefined) {
                        switch (n0.length) {
                            case 1: { return [[n0[0], v1], v3, n4] }
                            case 2: { return [[n0[0]], n0[1], [v1], v3, n4] }
                            default: { throw 'invalid node' }
                        }
                    } else {
                        return [n0, v1, first, v3, n4]
                    }
                }
            }
            case 4: {
                const [n0, v1, n2, v3, ] = tf[1]
                if (first === undefined) {
                    switch (n2.length) {
                        case 1: { return [n0, v1, [n2[0], v3]] }
                        case 2: { return [n0, v1, [n2[0]], n2[1], [v3]] }
                        default: { throw 'invalid node' }
                    }
                } else {
                    return [n0, v1, n2, v3, first]
                }
            }
        }
    }
    const b = init()
    return todo()
}

module.exports = {
    /** @readonly */
    remove,
}