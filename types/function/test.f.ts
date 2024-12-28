import { fn } from './module.f.ts'

export default () => {
    const f: (x: string) => readonly[string]
        = x => [x]
    const g: (x: readonly[string]) => readonly[number]
        = ([x]) => [x.length]
    const w: (x: readonly[number]) => number
        = ([x]) => x

    const r = fn(f).then(g).then(w).result

    const result = r('hello')
    if (result !== 5) { throw r }
}
