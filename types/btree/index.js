const { todo } = require('../../dev')
const cmp = require('../function/compare')
const { index3, index5 } = cmp
const seq = require('../list')

/**
 * @template T
 * @typedef {() => T} Lazy
 */

/**
 * @template T
 * @typedef {cmp.Compare<T>} Cmp
 */

/**
 * @template T
 * @typedef {readonly[T]} Array1
 */

/**
 * @template T
 * @typedef {readonly[T,T]} Array2
 */

/**
 * @template T
 * @typedef {readonly[T,T,T]} Array3
 */

/** @typedef {0|1} Index2 */

/** @typedef {0|1|2} Index3 */

/** @typedef {0|1|2|3|4} Index5 */

//

/**
 * @template T
 * @typedef {Array1<T>} Leaf1
 */

/**
 * @template T
 * @typedef {Array2<T>} Leaf2
 */

/**
 * @template T
 * @typedef {readonly [Node<T>, T, Node<T>]} Branch3
 */

/**
 * @template T
 * @typedef {readonly [Node<T>, T, Node<T>, T, Node<T>]} Branch5
 */

/**
 * @template T
 * @typedef { Leaf1<T> | Leaf2<T> | Branch3<T> | Branch5<T>} Node
 */

/** @typedef {readonly['done']} NotFoundDone */

/**
 * @template T
 * @typedef {readonly['done', T]} FoundDone
 */

/**
 * @template T
 * @typedef { NotFoundDone | FoundDone<T> } Done
 */

/**
 * @template T
 * @typedef {readonly['replace', Node<T>]} Replace
 */

/**
 * @template T
 * @typedef {readonly['overflow', Branch3<T>]} Overflow
 */

/**
 * @template T
 * @typedef { Done<T> | Replace<T> | Overflow<T> } Result
 */

/** @typedef {<T>(_: Leaf1<T>) => LazyResult<T>} InLeaf1 */
/** @typedef {<T>(_: Leaf2<T>) => LazyResult<T>} InLeaf2 */
/** @typedef {<T>(_: Branch3<T>) => LazyResult<T>} InBranch3 */
/** @typedef {<T>(_: Branch5<T>) => LazyResult<T>} InBranch5 */

/**
 * @typedef {{
 *  readonly leaf1: InLeaf1
 *  readonly leaf2_left: InLeaf2
 *  readonly leaf2_right: InLeaf2
 *  readonly branch3: InBranch3
 *  readonly branch5_left: InBranch5
 *  readonly branch5_right: InBranch5
 * }} Found
 */

/**
 * @typedef {{
 *  readonly leaf1_left: InLeaf1
 *  readonly leaf1_right: InLeaf1
 *  readonly leaf2_left: InLeaf2
 *  readonly leaf2_middle: InLeaf2
 *  readonly leaf2_right: InLeaf2
 * }} NotFound
 */

/**
 * @typedef {{
 *  readonly found: Found
 *  readonly notFound: NotFound
 * }} Visitor
 */

/**
 * @template T
 * @typedef { readonly [Node<T>, T, Node<T>, T, Node<T>, T, Node<T>] } Branch7
 */

/** @type {<T>(n: Branch7<T>) => Branch3<T>} */
const split = ([n0, v1, n2, v3, n4, v5, n6]) => [[n0, v1, n2], v3, [n4, v5, n6]]

/**
 * @template T
 * @typedef {(init: Lazy<T>) => Result<T>} LazyResult
 */

/**
 * @type {<T>(extend: (o: Branch3<T>) => Result<T>) =>
 *  (replace: (r: Node<T>) => Node<T>) =>
 *  (result: LazyResult<T>) =>
 *  LazyResult<T>}
 */
const merge = extend => replace => lazyResult => init => {
    const result = lazyResult(init)
    switch (result[0]) {
        case 'done': { return result }
        case 'replace': { return ['replace', replace(result[1])] }
        default: { return extend(result[1]) }
    }
}

/** @type {(visitor: Visitor) => <T>(cmp: Cmp<T>) => (node: Node<T>) => LazyResult<T>} */
const visit = ({ found, notFound }) => cmp => {
    const i3 = index3(cmp)
    const i5 = index5(cmp)
    /** @typedef {typeof cmp extends Cmp<infer T> ? T : never} T */
    /**
     * @type {(extend: (o: Branch3<T>) => Branch5<T>) =>
     *  (replace: (r: Node<T>) => Branch3<T>) =>
     *  (result: LazyResult<T>) =>
     *  LazyResult<T>}
     */
    const merge2 = extend => merge(o => ['replace', extend(o)])
    /**
     * @type {(extend: (o: Branch3<T>) => Branch7<T>) =>
     *  (replace: (r: Node<T>) => Branch5<T>) =>
     *  (result: LazyResult<T>) =>
     *  LazyResult<T>}
     */
    const merge3 = extend => merge(o => ['overflow', split(extend(o))])
    /** @type {(node: Node<T>) => LazyResult<T>} */
    const f = node => {
        switch (node.length) {
            case 1: {
                switch (i3(node[0])) {
                    case 0: { return notFound.leaf1_left(node) }
                    case 1: { return found.leaf1(node) }
                    default: { return notFound.leaf1_right(node) }
                }
            }
            case 2: {
                switch (i5(node)) {
                    case 0: { return notFound.leaf2_left(node) }
                    case 1: { return found.leaf2_left(node) }
                    case 2: { return notFound.leaf2_middle(node) }
                    case 3: { return found.leaf2_right(node) }
                    default: { return notFound.leaf2_right(node) }
                }
            }
            case 3: {
                const [n0, v1, n2] = node
                switch (i3(v1)) {
                    case 0: {
                        return merge2
                            (e => [...e, v1, n2])
                            (r => [r, v1, n2])
                            (f(n0))
                    }
                    case 1: { return found.branch3(node) }
                    default: {
                        return merge2
                            (e => [n0, v1, ...e])
                            (r => [n0, v1, r])
                            (f(n2))
                    }
                }
            }
            default: {
                const [n0, v1, n2, v3, n4] = node
                switch (i5([v1, v3])) {
                    case 0: {
                        return merge3
                            (o => [...o, v1, n2, v3, n4])
                            (r => [r, v1, n2, v3, n4])
                            (f(n0))
                    }
                    case 1: { return found.branch5_left(node) }
                    case 2: {
                        return merge3
                            (o => [n0, v1, ...o, v3, n4])
                            (r => [n0, v1, r, v3, n4])
                            (f(n2))
                    }
                    case 3: { return found.branch5_right(node) }
                    default: {
                        return merge3
                            (o => [n0, v1, n2, v3, ...o])
                            (r => [n0, v1, n2, v3, r])
                            (f(n4))
                    }
                }
            }
        }
    }
    return f
}

/** @type { <T>(_: T) => Done<T> } */
const found = value => ['done', value]

/** @type {Found} */
const foundGet = {
    leaf1: ([value]) => () => found(value),
    leaf2_left: ([value]) => () => found(value),
    leaf2_right: ([, value]) => () => found(value),
    branch3: ([, value]) => () => found(value),
    branch5_left: ([, value]) => () => found(value),
    branch5_right: ([, , , value]) => () => found(value),
}
/** @type { () => () => NotFoundDone } */
const notFound = () => () => ['done']

/** @type {NotFound} */
const notFoundGet = {
    leaf1_left: notFound,
    leaf1_right: notFound,
    leaf2_left: notFound,
    leaf2_middle: notFound,
    leaf2_right: notFound,
}

/** @type { <T>(_: Node<T>) => Replace<T> } */
const replace = node => ['replace', node]

/** @type {Found} */
const foundReplace = {
    leaf1: () => f => replace([f()]),
    leaf2_left: ([, v1]) => f => replace([f(), v1]),
    leaf2_right: ([v0,]) => f => replace([v0, f()]),
    branch3: ([n0, , n2]) => f => replace([n0, f(), n2]),
    branch5_left: ([n0, , n2, v3, n4]) => f => replace([n0, f(), n2, v3, n4]),
    branch5_right: ([n0, v1, n2, , n4]) => f => replace([n0, v1, n2, f(), n4])
}

/** @type {<T>(leaf3: Array3<T>) => Result<T>} */
const overflow = ([v0, v1, v2]) => ['overflow', [[v0], v1, [v2]]]

/** @type {NotFound} */
const notFoundInsert = {
    leaf1_left: ([v]) => f => replace([f(), v]),
    leaf1_right: ([v]) => f => replace([v, f()]),
    leaf2_left: ([v0, v1]) => f => overflow([f(), v0, v1]),
    leaf2_middle: ([v0, v1]) => f => overflow([v0, f(), v1]),
    leaf2_right: ([v0, v1]) => f => overflow([v0, v1, f()]),
}

/** @type {Visitor} */
const getVisitor = {
    found: foundGet,
    notFound: notFoundGet,
}

/** @type {Visitor} */
const setVisitor = {
    found: foundReplace,
    notFound: notFoundInsert,
}

/** @type {Visitor} */
const getOrInsertVisitor = {
    found: foundGet,
    notFound: notFoundInsert,
}

/** @type {Visitor} */
const replaceVisitor = {
    found: foundReplace,
    notFound: notFoundGet,
}

/** @type {<T>(node: Node<T>) => seq.Thunk<T>} */
const values = node => () => {
    switch (node.length) {
        case 1: case 2: { return node }
        case 3: {
            return seq.flat([
                values(node[0]),
                [node[1]],
                values(node[2])
            ])
        }
        default: {
            return seq.flat([
                values(node[0]),
                [node[1]],
                values(node[2]),
                [node[3]],
                values(node[4])
            ])
        }
    }
}

module.exports = {
    /** @readonly */
    values,
    /**
     * @readonly
     * @type { <T>(cmp: Cmp<T>) => (node: Node<T>) => T|undefined }
     */
    getVisitor: cmp => node => {
        const result = visit(getVisitor)(cmp)(node)(() => { throw 'getVisitor' })
        if (result[0] !== 'done') { throw 'getVisitor result' }
        return result[1]
    },
    /** @readonly */
    setVisitor: visit(setVisitor),
    /** @readonly */
    getOrInsertVisitor: visit(getOrInsertVisitor),
    /** @readonly */
    replaceVisitor: visit(replaceVisitor)
}
