import { main } from './module.f.ts'

export const proof = {
    main: () => {
        const program = main()
        if (program === undefined) { throw 'expected a program effect' }
    }
}
