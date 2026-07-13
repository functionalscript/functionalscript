import {
    filter,
    flatMap,
    fold,
    input,
    last,
    map,
    reduce,
    run,
    scan,
    type Node,
} from './module.f.ts'
import { toArray, type List } from '../types/list/module.f.ts'
import {
    addition,
    foldToScan,
} from '../types/function/operator/module.f.ts'
import { stringify, type Unknown } from '../media/json/module.f.ts'
import { sort } from '../types/object/module.f.ts'
import { assertEq } from '../asserts/module.f.ts'

const str
    : (sequence: List<Unknown>) => string
    = sequence => stringify(sort)(toArray(sequence))

type Env = {
    readonly numbers: List<number>
}

const numbers: Node<Env, number> = input(env => env.numbers)

const oneTwoThree: Env = { numbers: [1, 2, 3] }

const emptyEnv: Env = { numbers: null }

export const proof = {
    input: () => {
        assertEq(str(run(oneTwoThree)(numbers)), '[1,2,3]')
    },
    sameGraphDifferentBindings: () => {
        const r = run({ numbers: [5] })(numbers)
        assertEq(str(r), '[5]')
        assertEq(str(run(oneTwoThree)(numbers)), '[1,2,3]')
    },
    flatMap: () => {
        const node = flatMap((x: number) => [x, x * 10])(numbers)
        assertEq(str(run(oneTwoThree)(node)), '[1,10,2,20,3,30]')
    },
    scan: () => {
        const sums = scan(foldToScan(addition)(0))(numbers)
        assertEq(str(run(oneTwoThree)(sums)), '[1,3,6]')
    },
    fold: () => {
        const total = fold(addition)(0)(numbers)
        assertEq(str(run(oneTwoThree)(total)), '[6]')
        assertEq(str(run(emptyEnv)(total)), '[0]')
    },
    map: () => {
        const doubled = map((x: number) => x * 2)(numbers)
        assertEq(str(run(oneTwoThree)(doubled)), '[2,4,6]')
    },
    filter: () => {
        const odd = filter((x: number) => x % 2 !== 0)(numbers)
        assertEq(str(run(oneTwoThree)(odd)), '[1,3]')
    },
    last: () => {
        const node = last(numbers)
        assertEq(str(run(oneTwoThree)(node)), '[3]')
        assertEq(str(run(emptyEnv)(node)), '[]')
    },
    reduce: () => {
        const sum = reduce(addition)(numbers)
        assertEq(str(run(oneTwoThree)(sum)), '[6]')
        assertEq(str(run(emptyEnv)(sum)), '[]')
    },
    sharedInput: () => {
        const doubled = map((x: number) => x * 2)(numbers)
        const total = fold(addition)(0)(numbers)
        assertEq(str(run(oneTwoThree)(doubled)), '[2,4,6]')
        assertEq(str(run(oneTwoThree)(total)), '[6]')
    },
    pipeline: () => {
        const node = last(
            scan(foldToScan(addition)(0))(
                filter((x: number) => x !== 2)(numbers)))
        assertEq(str(run(oneTwoThree)(node)), '[4]')
    },
}
