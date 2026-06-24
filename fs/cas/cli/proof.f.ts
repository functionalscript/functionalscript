import { length, vec, type Vec } from '../../types/bit_vec/module.f.ts'
import { cBase32ToVec, vecToCBase32 } from '../../cbase32/module.f.ts'
import { sha256 } from '../../crypto/sha2/module.f.ts'
import { fileCas, casAddFile, type FileCasOperation } from '../module.f.ts'
import { pure, type Effect } from '../../effects/module.f.ts'
import { mkdir, writeFile, rm, readFile, type ReadFile, type WriteFile, type Rm, type Mkdir } from '../../effects/node/module.f.ts'

const testDir = './test-cas-cli'

type TestOp = FileCasOperation | WriteFile | ReadFile | Rm | Mkdir

// Create a 128 KiB big file content (at the max Vec size limit)
// This tests the boundary where files are at the chunk size limit
const createBigFileContent = (): Vec => {
    const byteCount = 128n * 1024n // 128 KiB
    // Create a repeating pattern: 0x42 repeated across the file
    return vec(byteCount * 8n)(0x42424242n)
}

// Test adding a big file and verifying the hash
const testAddBigFile = (): Effect<TestOp, void> =>
    mkdir(testDir, { recursive: true }).step(() => {
        const bigContent = createBigFileContent()
        const bigFilePath = `${testDir}/big-file.bin`

        return writeFile(bigFilePath, bigContent).step(writeRes => {
            if (writeRes[0] === 'error') {
                throw new Error(`Failed to write test file: ${writeRes[1]}`)
            }

            const cas = fileCas(sha256)(testDir)
            return casAddFile(cas)(bigFilePath).step(addRes => {
                if (addRes[0] === 'error') {
                    throw new Error(`Failed to add file to CAS: ${addRes[1]}`)
                }

                const hash = addRes[1]

                // Verify hash is 256 bits (SHA-256)
                if (length(hash) !== 256n) {
                    throw new Error(`Expected hash length 256 bits, got ${length(hash)}`)
                }

                // Verify hash can be encoded/decoded
                const hashCBase32 = vecToCBase32(hash)
                const decodedHash = cBase32ToVec(hashCBase32)
                if (decodedHash === null) {
                    throw new Error('Failed to decode hash from base32')
                }

                return rm(testDir).step(() => pure(undefined))
            })
        })
    })

// Test adding and retrieving a big file
const testAddAndGetBigFile = (): Effect<TestOp, void> =>
    mkdir(testDir, { recursive: true })
    .step(() => {
        const bigContent = createBigFileContent()
        const bigFilePath = `${testDir}/big-file.bin`

        return writeFile(bigFilePath, bigContent)
        .step(writeRes => {
            if (writeRes[0] === 'error') {
                throw new Error(`Failed to write test file: ${writeRes[1]}`)
            }

            const cas = fileCas(sha256)(testDir)
            return casAddFile(cas)(bigFilePath)
            .step(addRes => {
                if (addRes[0] === 'error') {
                    throw new Error(`Failed to add file to CAS: ${addRes[1]}`)
                }

                const hash = addRes[1]
                const storedPath = cas.url(hash)

                // Verify file is stored at the expected location
                return readFile(storedPath).step(readRes => {
                    if (readRes[0] === 'error') {
                        throw new Error(`Failed to read stored file: ${readRes[1]}`)
                    }

                    const storedContent = readRes[1]

                    // Verify content is the same size as original
                    const storedLen = length(storedContent)
                    const originalLen = length(bigContent)
                    if (storedLen !== originalLen) {
                        throw new Error(
                            `Content size mismatch: stored ${storedLen} bits, expected ${originalLen} bits`
                        )
                    }

                    return rm(testDir).step(() => pure(undefined))
                })
            })
        })
    })

export const proof = {
    addBigFile: () => testAddBigFile(),
    addAndGetBigFile: () => testAddAndGetBigFile(),
}
