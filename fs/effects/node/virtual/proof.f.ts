import { assertEq } from '../../../asserts/module.f.ts'
import { rm, writeFile, readFile, readdir, import_ } from '../module.f.ts'
import { vec8 } from '../../../types/bit_vec/module.f.ts'
import { emptyState, virtual, type Dir, type JsModule } from './module.f.ts'

export const proof = {
    rm: {
        success: () => {
            const root: Dir = { 'a.txt': vec8(0x42n) }
            const [, result] = virtual({ ...emptyState, root })(rm('a.txt'))
            assertEq(result[0], 'ok')
        },
        notFound: () => {
            const [, result] = virtual(emptyState)(rm('notexist.txt'))
            assertEq(result[0], 'error')
        },
        isDirectory: () => {
            const inner: Dir = {}
            const root: Dir = { 'mydir': inner }
            const [, result] = virtual({ ...emptyState, root })(rm('mydir'))
            assertEq(result[0], 'error')
        },
    },
    writeFileOnDirectory: () => {
        const inner: Dir = {}
        const root: Dir = { 'mydir': inner }
        const [, result] = virtual({ ...emptyState, root })(writeFile('mydir', vec8(0x42n)))
        assertEq(result[0], 'error')
    },
    readdirRecursive: () => {
        const file = vec8(0x42n)
        const sub: Dir = { 'file.txt': file }
        const outer: Dir = { 'sub': sub }
        const root: Dir = { 'mydir': outer }
        const [, result] = virtual({ ...emptyState, root })(readdir('mydir', { recursive: true }))
        assertEq(result[0], 'ok')
        if (result[0] !== 'ok') { throw result }
        assertEq(result[1].length, 2)
    },
    readFileIntoDir: () => {
        // 'a/b' where both 'a' and 'b' are directories
        // hits path.length === 0 in operation's f and path.length !== 1 in readFile op
        const inner: Dir = {}
        const outer: Dir = { 'b': inner }
        const root: Dir = { 'a': outer }
        const [, result] = virtual({ ...emptyState, root })(readFile('a/b'))
        assertEq(result[0], 'error')
    },
    importNonModule: () => {
        // import_ on a Vec (not a JsModule) covers typeof entry !== 'function' branch
        const root: Dir = { 'module.f.ts': vec8(0x42n) }
        const [, result] = virtual({ ...emptyState, root })(import_('module.f.ts'))
        assertEq(result[0], 'error')
    },
    throw: {
        readFileOnJsModule: () => {
            // readFile on a JsModule path covers typeof file === 'function' branch
            const root: Dir = { 'a.f.ts': (() => ({})) as JsModule }
            virtual({ ...emptyState, root })(readFile('a.f.ts'))
        },
    },
}
