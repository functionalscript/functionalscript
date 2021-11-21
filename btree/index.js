const { index3, index5 } = require('../cmp')

/**
 * @template T
 * @typedef {() => T} Lazy
 */

/**
 * @template T
 * @typedef {import('../cmp').Cmp<T>} Cmp
 */

/**
 * @template T
 * @typedef {import('../array').Array1<T>} Array1
 */

/**
 * @template T
 * @typedef {import('../array').Array2<T>} Array2
 */

/**
 * @template T
 * @typedef {import('../array').Array3<T>} Array3
 */

/** @typedef {import('../array').Index2} Index2 */

/** @typedef {import('../array').Index3} Index3 */

/** @typedef {import('../array').Index5} Index5 */

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
 * @typedef {readonly [TNode<T>, T, TNode<T>]} Branch3
 */

/**
 * @template T
 * @typedef {readonly [TNode<T>, T, TNode<T>, T, TNode<T>]} Branch5
 */

/**
 * @template T
 * @typedef {Leaf1<T>|Leaf2<T>|Branch3<T>|Branch5<T>} TNode
 */

/**
 * @template T
 * @typedef {{ done: false } | { done: true, value: T }} Done
 */

/**
 * @template T
 * @typedef {{ replace: TNode<T> }} Replace
 */

/**
 * @template T
 * @typedef {{ overflow: Branch3<T> }} Overflow
 */

/**
 * @template T
 * @typedef {Done<T> | Replace<T> | Overflow<T>} Result
 */

/** @typedef {<T>(_: Lazy<T>) => (_: Leaf1<T>) => Result<T>} InLeaf1 */
/** @typedef {<T>(_: Lazy<T>) => (_: Leaf2<T>) => Result<T>} InLeaf2 */
/** @typedef {<T>(_: Lazy<T>) => (_: Branch3<T>) => Result<T>} InBranch3 */
/** @typedef {<T>(_: Lazy<T>) => (_: Branch5<T>) => Result<T>} InBranch5 */

/** 
 * @typedef {{
 *  leaf1: InLeaf1
 *  leaf2_left: InLeaf2
 *  leaf2_right: InLeaf2
 *  branch3: InBranch3
 *  branch5_left: InBranch5
 *  branch5_right: InBranch5
 * }} Found
 */

/**
 * @typedef {{
 *  leaf1_left: InLeaf1
 *  leaf1_right: InLeaf1
 *  leaf2_left: InLeaf2
 *  leaf2_middle: InLeaf2
 *  leaf2_right: InLeaf2
 * }} NotFound
 */

/** 
 * @typedef {{
 *  found: Found
 *  notFound: NotFound
 * }} Visitor
 */

/**
 * @template T
 * @typedef {readonly [TNode<T>, T, TNode<T>, T, TNode<T>, T, TNode<T>]} Branch7
 */

/** @type {<T>(n: Branch7<T>) => Branch3<T>} */
const split = ([n0, v1, n2, v3, n4, v5, n6]) => [[n0, v1, n2], v3, [n4, v5, n6]]

/** 
 * @type {<T>(overflow: (o: Branch3<T>) => Result<T>) => 
 *  (replace: (r: TNode<T>) => TNode<T>) => 
 *  (result: Result<T>) => 
 *  Result<T>} 
 */
const merge = overflow => replace => result => {
    if ('done' in result) { return result }
    if ('replace' in result) { return { replace: replace(result.replace) } }
    return overflow(result.overflow)
}

/** 
 * @type {<T>(overflow: (o: Branch3<T>) => Branch5<T>) => 
 *  (replace: (r: TNode<T>) => Branch3<T>) => 
 *  (result: Result<T>) => 
 *  Result<T>} 
 */
const merge2 = overflow => merge(o => ({ replace: overflow(o) }))

/** 
 * @type {<T>(overflow: (o: Branch3<T>) => Branch7<T>) => 
 *  (replace: (r: TNode<T>) => Branch5<T>) => 
 *  (result: Result<T>) => 
 *  Result<T>} 
 */
const merge3 = overflow => merge(o => ({ overflow: split(overflow(o)) }))

/** @type {(visitor: Visitor) => <T>(cmp: Cmp<T>) => (init: Lazy<T>) => (node: TNode<T>) => Result<T>} */
const visit = ({ found, notFound }) => cmp => {
    const i3 = index3(cmp)
    const i5 = index5(cmp)
    return init => {
        /** @typedef {typeof cmp extends Cmp<infer T> ? T : never} T*/
        /** @type {(node: TNode<T>) => Result<T>} */
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

/** @type {<T>(_: T) => Done<T>} */
const found = value => ({ done: true, value })

/** @type {Found} */
const foundGet = {
    leaf1: () => ([value]) => found(value),
    leaf2_left: () => ([value]) => found(value),
    leaf2_right: () => ([, value]) => found(value),
    branch3: () => ([, value]) => found(value),
    branch5_left: () => ([, value]) => found(value),
    branch5_right: () => ([, , , value]) => found(value),
}
/** @type {() => () => { done: false }} */
const notFound = () => () => ({ done: false })

/** @type {NotFound} */
const notFoundGet = {
    leaf1_left: notFound,
    leaf1_right: notFound,
    leaf2_left: notFound,
    leaf2_middle: notFound,
    leaf2_right: notFound,
}

/** @type {<T>(_: TNode<T>) => Replace<T>} */
const replace = node => ({ replace: node })

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
const overflow = ([v0, v1, v2]) => ({ overflow: [[v0], v1, [v2]] })

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

const replaceVisitor = {
    found: foundReplace,
    notFound: notFoundGet,
}

/** @type {<T>(_: TNode<T>) => Iterable<T>} */
const values = node => ({
    *[Symbol.iterator]() {
        switch (node.length) {
            case 1: case 2: {
                yield* node
                return
            }
            case 3: {
                yield* values(node[0])
                yield node[1]
                yield* values(node[2])
                return
            }
            default: {
                yield* values(node[0])
                yield node[1]
                yield* values(node[2])
                yield node[3]
                yield* values(node[4])
                return
            }
        }
    }
})

module.exports = {
    /** @readonly */
    values,
    /** 
     * @readonly
     * @type {<T>(cmp: Cmp<T>) => (node: TNode<T>) => T|undefined}
     */
    getVisitor: cmp => node => {
        const result = visit(getVisitor)(cmp)(() => { throw '' })(node)
        if ('done' in result && result.done) { return result.value }
        return undefined
    },
    /** @readonly */
    setVisitor: visit(setVisitor),
    /** @readonly */
    getOrInsertVisitor: visit(getOrInsertVisitor),
    /** @readonly */
    replaceVisitor: visit(replaceVisitor)
}
