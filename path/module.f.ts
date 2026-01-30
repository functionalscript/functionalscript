/**
 * Path utilities
 * Pure functional path operations (no I/O)
 */

/**
 * Join path segments
 */
export const join = (...segments: readonly string[]): string => {
    if (segments.length === 0) {
        return '.'
    }
    
    const parts: string[] = []
    for (const segment of segments) {
        if (segment === '') {
            continue
        }
        if (parts.length === 0) {
            parts.push(segment)
        } else {
            parts.push(segment)
        }
    }
    
    return parts.join('/')
}

/**
 * Get directory name from path
 */
export const dirname = (path: string): string => {
    const lastSlash = path.lastIndexOf('/')
    if (lastSlash === -1) {
        return '.'
    }
    if (lastSlash === 0) {
        return '/'
    }
    return path.substring(0, lastSlash)
}

/**
 * Get base name from path
 */
export const basename = (path: string): string => {
    const lastSlash = path.lastIndexOf('/')
    return path.substring(lastSlash + 1)
}

/**
 * Get file extension
 */
export const extname = (path: string): string => {
    const base = basename(path)
    const lastDot = base.lastIndexOf('.')
    if (lastDot === -1 || lastDot === 0) {
        return ''
    }
    return base.substring(lastDot)
}

/**
 * Check if path is absolute
 */
export const isAbsolute = (path: string): boolean =>
    path.startsWith('/')

/**
 * Normalize a path
 */
export const normalize = (path: string): string => {
    if (path === '') {
        return '.'
    }
    
    const isAbs = isAbsolute(path)
    const segments = path.split('/')
    const result: string[] = []
    
    for (const segment of segments) {
        if (segment === '' || segment === '.') {
            continue
        }
        if (segment === '..') {
            if (result.length > 0 && result[result.length - 1] !== '..') {
                result.pop()
            } else if (!isAbs) {
                result.push('..')
            }
        } else {
            result.push(segment)
        }
    }
    
    const normalized = result.join('/')
    if (isAbs) {
        return '/' + normalized
    }
    return normalized || '.'
}

/**
 * Resolve path segments into an absolute path
 */
export const resolve = (base: string) => (...segments: readonly string[]): string => {
    let current = base
    for (const segment of segments) {
        if (isAbsolute(segment)) {
            current = segment
        } else {
            current = join(current, segment)
        }
    }
    return normalize(current)
}

/**
 * Get relative path from one path to another
 */
export const relative = (from: string) => (to: string): string => {
    const fromParts = normalize(from).split('/')
    const toParts = normalize(to).split('/')
    
    let commonLength = 0
    const minLength = Math.min(fromParts.length, toParts.length)
    for (let i = 0; i < minLength; i++) {
        if (fromParts[i] === toParts[i]) {
            commonLength++
        } else {
            break
        }
    }
    
    const upCount = fromParts.length - commonLength
    const upParts = Array(upCount).fill('..')
    const downParts = toParts.slice(commonLength)
    
    return [...upParts, ...downParts].join('/')
}
