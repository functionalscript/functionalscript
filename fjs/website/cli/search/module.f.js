/** Case-insensitive matching for the CLI catalogue. @module */

/** @type {(text: string, query: string) => boolean} */
export const matches = (text, query) => text.toLowerCase().includes(query.trim().toLowerCase())
