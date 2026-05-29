export const sleep_fail = async () => {
    await new Promise<void>(resolve => setTimeout(resolve, 10))
    throw 'async failure'
}
