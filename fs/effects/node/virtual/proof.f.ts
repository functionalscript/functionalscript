import { assertEq } from '../../../asserts/module.f.ts'
import { awaitIfPromise, fetch, rm, writeFile, readFile, readdir, import_, rename, readBytes } from '../module.f.ts'
import { maxLengthBytes, vec, vec8 } from '../../../types/bit_vec/module.f.ts'
import { emptyState, virtual, type Dir, type JsModule } from './module.f.ts'

export const proof = {
    rm: {
        success: () => {
            const root: Dir = { 'a.txt': [vec8(0x42n)] }
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
        const file = [vec8(0x42n)] as const
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
    awaitNonPromise: () => {
        // a non-promise value passes through the virtual `await` handler as-is
        const [, result] = virtual(emptyState)(awaitIfPromise(42))
        assertEq(result, 42)
    },
    fetchNotFound: () => {
        // covers the `result === undefined` branch of the `fetch` handler
        const [, result] = virtual(emptyState)(fetch('https://example.com/missing'))
        assertEq(result[0], 'error')
    },
    importNestedPath: () => {
        // import_ on a path whose parent does not exist covers the
        // path.length !== 1 branch of the import_ op
        const [, result] = virtual(emptyState)(import_('a/b'))
        assertEq(result[0], 'error')
    },
    importNonModule: () => {
        // import_ on a Vec (not a JsModule) covers typeof entry !== 'function' branch
        const root: Dir = { 'module.f.ts': [vec8(0x42n)] }
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
    renameSamePath: () => {
        // rename('a', 'a') should succeed as a no-op, not reject
        const root: Dir = { 'a': [vec8(0x42n)] }
        const [, result] = virtual({ ...emptyState, root })(rename('a', 'a'))
        assertEq(result[0], 'ok')
    },
    renameIntoOwnSubtree: () => {
        // rename('a', 'a/b') should fail (dst inside src's subtree)
        const root: Dir = { 'a': { 'b': [vec8(0x42n)] } }
        const [, result] = virtual({ ...emptyState, root })(rename('a', 'a/b'))
        assertEq(result[0], 'error')
    },
    renameOntoOwnAncestor: () => {
        // rename('a/b', 'a') should fail (src inside dst's subtree)
        const root: Dir = { 'a': { 'b': [vec8(0x42n)] } }
        const [, result] = virtual({ ...emptyState, root })(rename('a/b', 'a'))
        assertEq(result[0], 'error')
    },
    renameNonEmptyDirOverEmptyDir: () => {
        // rename a directory onto an empty directory should succeed
        const root: Dir = { 'src': { 'file': [vec8(0x42n)] }, 'dst': {} }
        const [, result] = virtual({ ...emptyState, root })(rename('src', 'dst'))
        assertEq(result[0], 'ok')
    },
    renameEmptyDirOverNonEmptyDir: () => {
        // rename an empty directory onto a non-empty directory should fail
        const root: Dir = { 'src': {}, 'dst': { 'file': [vec8(0x42n)] } }
        const [, result] = virtual({ ...emptyState, root })(rename('src', 'dst'))
        assertEq(result[0], 'error')
    },
    readBytesNegativeSize: () => {
        // readBytes with negative size should fail
        const root: Dir = { 'file': [vec8(0x42n)] }
        const [, result] = virtual({ ...emptyState, root })(readBytes('file', 0, -1))
        assertEq(result[0], 'error')
    },
    readBytesZeroSize: () => {
        // readBytes with zero size should succeed and return empty vec
        const root: Dir = { 'file': [vec8(0x42n)] }
        const [, result] = virtual({ ...emptyState, root })(readBytes('file', 0, 0))
        assertEq(result[0], 'ok')
    },
    readBytesNegativeOffset: () => {
        // readBytes with negative offset should fail
        const root: Dir = { 'file': [vec8(0x42n)] }
        const [, result] = virtual({ ...emptyState, root })(readBytes('file', -1, 1))
        assertEq(result[0], 'error')
    },
    readBytesFractionalSize: () => {
        // readBytes with fractional size should fail rather than throw RangeError
        const root: Dir = { 'file': [vec8(0x42n)] }
        const [, result] = virtual({ ...emptyState, root })(readBytes('file', 0, 1.5))
        assertEq(result[0], 'error')
    },
    readBytesFractionalOffset: () => {
        // readBytes with fractional offset should fail rather than throw RangeError
        const root: Dir = { 'file': [vec8(0x42n)] }
        const [, result] = virtual({ ...emptyState, root })(readBytes('file', 0.5, 1))
        assertEq(result[0], 'error')
    },
    readBytesAcrossChunkBoundary: () => {
        // Two 128 KiB chunks; read 2 bytes spanning the boundary (last byte of chunk 0, first of chunk 1).
        const chunkSize = Number(maxLengthBytes)
        const chunk0 = vec(maxLengthBytes * 8n)(0xAAn)
        const chunk1 = vec(maxLengthBytes * 8n)(0xBBn)
        const root: Dir = { 'big': [chunk0, chunk1] }
        const [, result] = virtual({ ...emptyState, root })(readBytes('big', chunkSize - 1, 2))
        assertEq(result[0], 'ok')
    },
    largeFileReadBytes: () => {
        // A file stored as two 128 KiB chunks is larger than maxLengthBytes.
        // readBytes within the second chunk (offset = 128 KiB, size = 1) should succeed.
        const chunkSize = Number(maxLengthBytes)
        const chunk0 = vec(maxLengthBytes * 8n)(0n)
        const chunk1 = vec(maxLengthBytes * 8n)(0xFFn)
        const root: Dir = { 'large': [chunk0, chunk1] }
        const [, result] = virtual({ ...emptyState, root })(readBytes('large', chunkSize, 1))
        assertEq(result[0], 'ok')
    },
}
