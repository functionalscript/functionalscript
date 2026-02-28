/**
 * FJS (FunctionalScript) Effects-based Implementation
 * 
 * This module provides the core FJS functionality using the effects system.
 * It's a pure functional module that describes the FJS behavior as effects.
 */

import * as E from '../effects/module.f.ts'
import type { Effect, AnyEffect, Log } from '../effects/module.f.ts'

// FJS version
export const version = '0.1.0'

// Command types
export type HelpCommand = { readonly type: 'help' }
export type VersionCommand = { readonly type: 'version' }
export type RunCommand = { readonly type: 'run'; readonly file: string }
export type ErrorCommand = { readonly type: 'error'; readonly message: string }

export type Command =
    | HelpCommand
    | VersionCommand
    | RunCommand
    | ErrorCommand

// Parse command line arguments into a command
export const parseArgs = (args: readonly string[]): Command => {
    // Skip node and script path
    const userArgs = args.slice(2)
    
    if (userArgs.length === 0) {
        return { type: 'help' }
    }
    
    const first = userArgs[0]
    
    if (first === '--help' || first === '-h') {
        return { type: 'help' }
    }
    
    if (first === '--version' || first === '-v') {
        return { type: 'version' }
    }
    
    if (first.startsWith('-')) {
        return { type: 'error', message: `Unknown option: ${first}` }
    }
    
    return { type: 'run', file: first }
}

// Help text
export const helpText = `fjs - FunctionalScript Runner

Usage:
  fjs <file>        Run a FunctionalScript module
  fjs --help, -h    Show this help
  fjs --version, -v Show version

Examples:
  fjs my-module.f.ts    Run my-module.f.ts
`

// Create help effect
export const showHelp = (): Log =>
    E.log(helpText)

// Create version effect
export const showVersion = (): Log =>
    E.log(`fjs version ${version}`)

// Create error effect
export const showError = (message: string): Effect<void> =>
    E.andThen(
        E.error(`Error: ${message}`),
        E.exit(1)
    ) as Effect<void>

// Run a file effect (placeholder for actual module execution)
export const runFile = (file: string): Effect<void> =>
    E.flatMap(
        E.readFile(file),
        content => {
            if (content === null) {
                return showError(`File not found: ${file}`)
            }
            // For now, just log that we would run the file
            return E.andThen(
                E.log(`Running: ${file}`),
                E.log(`Content length: ${content.length} bytes`)
            )
        }
    )

// Main FJS effect based on command
export const runCommand = (cmd: Command): Effect<void> => {
    switch (cmd.type) {
        case 'help':
            return showHelp()
        case 'version':
            return showVersion()
        case 'error':
            return showError(cmd.message)
        case 'run':
            return runFile(cmd.file)
    }
}

// Main FJS effect
export const main: Effect<void> =
    E.flatMap(
        E.getArgs,
        args => runCommand(parseArgs(args))
    )
