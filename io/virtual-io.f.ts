import { at, setReplace, type Map } from '../types/map/module.f.ts'
import type { Fs } from './module.f.ts'

export const virtualFs = (files: Map<string>): Fs => ({
    readFileSync: (path: string) => at(path)(files),
    writeFileSync: (path: string) => (content: string) => {
        const map = setReplace(path)(content)(files)
        return virtualFs(map)
    }
})