import defaultExport from './module.f.ts'

export const proof = {
    default: () => {
        const program = defaultExport()
        if (program === undefined) { throw 'expected a program effect' }
    }
}
