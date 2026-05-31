export const proof = {
    withSubtests: async () => {
        await new Promise<void>(resolve => setTimeout(resolve, 10))
        return {
            sub1: () => {},
            sub2: () => {},
        }
    }
}
