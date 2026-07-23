const inner = () => {}

export const proof = {
    outer: (): unknown => ({ inner })
}
