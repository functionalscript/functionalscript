import type { Io } from '../io/module.f.ts'
import { encodeUtf8 } from '../types/uint8array/module.f.ts'
import { htmlToString, type Element } from '../html/module.f.ts'

export const run = async({ fs: { promises: { writeFile }} }: Io): Promise<number> => {
    const html: Element = ['body',['h1', 'FunctionalScript']]
    await writeFile('index.html', encodeUtf8(htmlToString(html)))
    return 0
}
