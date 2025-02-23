import { fgRed } from './module.f.ts'

export default [
    () => {
        if (fgRed !== '\x1b[31m') {
            throw new Error('Test failed: sgr(0)')
        }
    }
]
