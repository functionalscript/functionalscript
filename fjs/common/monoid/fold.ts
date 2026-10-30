import { todo } from "../../asserts/module.f.js"

type State<T> = {
    readonly head: State<T>
    readonly last: T
} | undefined

type Monoid<T> = {
    readonly i: T
    readonly w: (v: T) => bigint
    readonly r: (a: T, b: T) => T
}

type Buffer<T> = {
    readonly first: T
    readonly tail: Buffer<T>
} | undefined

const push = <T>({ w, r }: Monoid<T>) => (head: State<T>, last: T): State<T> => {
    let tail: Buffer<T> = undefined
    while (true) {
        if (head === undefined || head.head === undefined || w(head.head.last) > w(last)) {
            head = { head, last }
            if (tail === undefined) { return head }
            last = tail.first
            tail = tail.tail
            continue
        }
        tail = { first: last, tail }
        const h2 = head.head
        last = r(h2.last, head.last)
        head = h2.head
    }
}

const collect = <T>({ w, r, i }: Monoid<T>) => (head: State<T>): T => {
    if (head === undefined) {
        return i
    }
    let tail: Buffer<T> = undefined
    let last = head.last
    head = head.head
    while (true) {
        if (head === undefined || head.head === undefined || w(head.head.last) > w(last)) {
            if (tail === undefined) {
                if (head === undefined) {
                    return last
                }
                last = r(head.last, last)
                head = head.head
                continue
            }
            head = { head, last }
            last = tail.first
            tail = tail.tail
            continue
        }
        tail = { first: last, tail }
        const h2 = head.head
        last = r(h2.last, head.last)
        head = h2.head
    }
}
