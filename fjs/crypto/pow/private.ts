/** State of the interactive proof-of-work demo. */
export type DemoState = {
    readonly text: string
    readonly nonce: string
    readonly nBits: string
    readonly running: boolean
    readonly searchStart: bigint | null
    readonly attempts: bigint
}
