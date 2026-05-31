export const proof = {
    sleep: async () => {
        await new Promise<void>(resolve => setTimeout(resolve, 10))
    }
}
