const cmp = require('../cmp')
const { index3, index5 } = cmp
const seq = require('../sequence')

/**
 * @template T
 * @typedef {() => T} Lazy
 */

/**
 * @template T
 * @typedef {cmp.Cmp<T>} Cmp
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

/** @typedef {<T>(_: Lazy<T>) => (_: Leaf1<T>) => Result<T>} InLeaf1 */
/** @typedef {<T>(_: Lazy<T>) => (_: Leaf2<T>) => Result<T>} InLeaf2 */
/** @typedef {<T>(_: Lazy<T>) => (_: Branch3<T>) => Result<T>} InBranch3 */
/** @typedef {<T>(_: Lazy<T>) => (_: Branch5<T>) => Result<T>} InBranch5 */

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
 * @type {<T>(overflow: (o: Branch3<T>) => Result<T>) => 
 *  (replace: (r: Node<T>) => Node<T>) => 
 *  (result: Result<T>) => 
 *  Result<T>} 
 */
const merge = overflow => replace => result => {
    switch (result[0]) {
        case 'done': { return result }
        case 'replace': { return ['replace', replace(result[1])] }
        default: { return overflow(result[1]) }
    }
}

/** 
 * @type {<T>(overflow: (o: Branch3<T>) => Branch5<T>) => 
 *  (replace: (r: Node<T>) => Branch3<T>) => 
 *  (result: Result<T>) => 
 *  Result<T>} 
 */
const merge2 = overflow => merge(o => ['replace', overflow(o)])

/** 
 * @type {<T>(overflow: (o: Branch3<T>) => Branch7<T>) => 
 *  (replace: (r: Node<T>) => Branch5<T>) => 
 *  (result: Result<T>) => 
 *  Result<T>} 
 */
const merge3 = overflow => merge(o => ['overflow', split(overflow(o))])

/** @type {(visitor: Visitor) => <T>(cmp: Cmp<T>) => (init: Lazy<T>) => (node: Node<T>) => Result<T>} */
const visit = ({ found, notFound }) => cmp => {
    const i3 = index3(cmp)
    const i5 = index5(cmp)
    return init => {
        /** @typedef {typeof cmp extends Cmp<infer T> ? T : never} T*/
        /** @type {(node: Node<T>) => Result<T>} */
        const f = node => {
            switch (node.length) {
                case 1: {
                    switch (i3(node[0])) {
                        case 0: { return notFound.leaf1_left(init)(node) }
                        case 1: { return found.leaf1(init)(node) }
                        default: { return notFound.leaf1_right(init)(node) }
                    }
                }
                case 2: {
                    switch (i5(node)) {
                        case 0: { return notFound.leaf2_left(init)(node) }
                        case 1: { return found.leaf2_left(init)(node) }
                        case 2: { return notFound.leaf2_middle(init)(node) }
                        case 3: { return found.leaf2_right(init)(node) }
                        default: { return notFound.leaf2_right(init)(node) }
                    }
                }
                case 3: {
                    const [n0, v1, n2] = node
                    switch (i3(v1)) {
                        case 0: {
                            return merge2
                                (o => [...o, v1, n2])
                                (r => [r, v1, n2])
                                (f(n0))
                        }
                        case 1: { return found.branch3(init)(node) }
                        default: {
                            return merge2
                                (o => [n0, v1, ...o])
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
                        case 1: { return found.branch5_left(init)(node) }
                        case 2: {
                            return merge3
                                (o => [n0, v1, ...o, v3, n4])
                                (r => [n0, v1, r, v3, n4])
                                (f(n2))
                        }
                        case 3: { return found.branch5_right(init)(node) }
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
}

/** @type { <T>(_: T) => Done<T> } */
const found = value => ['done', value]

/** @type {Found} */
const foundGet = {
    leaf1: () => ([value]) => found(value),
    leaf2_left: () => ([value]) => found(value),
    leaf2_right: () => ([, value]) => found(value),
    branch3: () => ([, value]) => found(value),
    branch5_left: () => ([, value]) => found(value),
    branch5_right: () => ([, , , value]) => found(value),
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
    leaf1: f => () => replace([f()]),
    leaf2_left: f => ([, v1]) => replace([f(), v1]),
    leaf2_right: f => ([v0,]) => replace([v0, f()]),
    branch3: f => ([n0, , n2]) => replace([n0, f(), n2]),
    branch5_left: f => ([n0, , n2, v3, n4]) => replace([n0, f(), n2, v3, n4]),
    branch5_right: f => ([n0, v1, n2, , n4]) => replace([n0, v1, n2, f(), n4])
}

/** @type {<T>(leaf3: Array3<T>) => Result<T>} */
const overflow = ([v0, v1, v2]) => ['overflow', [[v0], v1, [v2]]]

/** @type {NotFound} */
const notFoundInsert = {
    leaf1_left: f => ([v]) => replace([f(), v]),
    leaf1_right: f => ([v]) => replace([v, f()]),
    leaf2_left: f => ([v0, v1]) => overflow([f(), v0, v1]),
    leaf2_middle: f => ([v0, v1]) => overflow([v0, f(), v1]),
    leaf2_right: f => ([v0, v1]) => overflow([v0, v1, f()]),
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

/** @type {<T>(node: Node<T>) => seq.Sequence<T>} */
const values = node => () => {
    const f = () => {
        switch (node.length) {
            case 1: case 2: { return seq.list(...node) }
            case 3: { 
                return seq.concat(
                    values(node[0]), 
                    seq.list(node[1]), 
                    values(node[2])
                )
            }
            default: {
                return seq.concat(
                    values(node[0]),
                    seq.list(node[1]),
                    values(node[2]),
                    seq.list(node[3]),
                    values(node[4])
                )
            }
        }
    }
    return seq.next(f())
}

module.exports = {
    /** @readonly */
    values,
    /** 
     * @readonly
     * @type { <T>(cmp: Cmp<T>) => (node: Node<T>) => T|undefined }
     */
    getVisitor: cmp => node => {
        const result = visit(getVisitor)(cmp)(() => { throw '' })(node)
        if (result[0] === 'done') { return result[1] }
        return undefined
    },
    /** @readonly */
    setVisitor: visit(setVisitor),
    /** @readonly */
    getOrInsertVisitor: visit(getOrInsertVisitor),
    /** @readonly */
    replaceVisitor: visit(replaceVisitor)
}
