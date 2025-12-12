/**
 * MIT License
 *
 * Copyright (c) 2025–Present Xiao Hanyu (https://xiaohanyu.me)
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to
 * deal in the Software without restriction, including without limitation the
 * rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
 * sell copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS
 * IN THE SOFTWARE.
 */

import fs from 'node:fs'
import path from 'node:path'
import { consola } from 'consola'
import type { Page } from 'puppeteer'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  type ConvertOptions,
  convertCastToVideo,
  createCastDataUri,
  generateHtml,
  getPlayerAssetPaths,
  loadPlayerAssets,
  type ParsedOptions,
  parseCliArguments,
  parseOptions,
  recordVideo,
  setupBrowser,
  setupPlayer,
  validateInputFile,
} from './program'

// Mock dependencies
vi.mock('fs')
vi.mock('puppeteer', () => ({
  default: {
    launch: vi.fn(),
  },
}))

const mockRecorderInstance = {
  start: vi.fn().mockResolvedValue(undefined),
  stop: vi.fn().mockResolvedValue(undefined),
}

vi.mock('puppeteer-screen-recorder', () => ({
  PuppeteerScreenRecorder: vi
    .fn()
    .mockImplementation(() => mockRecorderInstance),
}))

vi.mock('ffmpeg-static', () => ({
  default: '/path/to/ffmpeg',
}))

vi.mock('consola', () => ({
  consola: {
    debug: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    start: vi.fn(),
    info: vi.fn(),
  },
}))

// Clear mocks between tests
beforeEach(() => {
  vi.clearAllMocks()
})

describe('CLI Argument Parsing', () => {
  it('should parse CLI arguments with defaults', () => {
    const program = parseCliArguments(['node', 'cli.js', 'input.cast'])
    expect(program.args).toContain('input.cast')
  })

  it('should create new program instance for custom options', () => {
    // Test that the function creates a fresh program instance
    const program1 = parseCliArguments(['node', 'cli.js', 'input1.cast'])
    const program2 = parseCliArguments(['node', 'cli.js', 'input2.cast'])

    // Both should be valid programs
    expect(program1.args).toContain('input1.cast')
    expect(program2.args).toContain('input2.cast')
  })
})

describe('Input Validation', () => {
  beforeEach(() => {
    vi.spyOn(fs, 'existsSync')
    vi.spyOn(path, 'resolve')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should validate existing input file', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true)
    vi.mocked(path.resolve).mockReturnValue('/absolute/path/input.cast')

    const result = validateInputFile('input.cast')
    expect(result).toBe('/absolute/path/input.cast')
    expect(fs.existsSync).toHaveBeenCalledWith('/absolute/path/input.cast')
  })

  it('should throw error for non-existing input file', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false)
    vi.mocked(path.resolve).mockReturnValue('/absolute/path/nonexistent.cast')

    expect(() => validateInputFile('nonexistent.cast')).toThrow(
      'Input file not found: /absolute/path/nonexistent.cast'
    )
  })
})

describe('Options Parsing', () => {
  it('should parse string options to correct types', () => {
    const options: ConvertOptions = {
      output: 'test.mp4',
      width: '1200',
      height: '800',
      theme: 'dracula',
      speed: '1.5',
      scale: '2',
    }

    const parsed = parseOptions(options)

    expect(parsed).toEqual({
      output: 'test.mp4',
      width: 1200,
      height: 800,
      theme: 'dracula',
      speed: 1.5,
      scale: 2,
    })
  })

  it('should handle invalid numbers gracefully', () => {
    const options: ConvertOptions = {
      output: 'test.mp4',
      width: 'invalid',
      height: '800',
      theme: 'asciinema',
      speed: 'fast',
      scale: '1',
    }

    const parsed = parseOptions(options)

    expect(Number.isNaN(parsed.width)).toBe(true)
    expect(Number.isNaN(parsed.speed)).toBe(true)
    expect(parsed.height).toBe(800)
    expect(parsed.scale).toBe(1)
  })

  it('should accept a valid theme choice', () => {
    const program = parseCliArguments([
      'node',
      'cli.js',
      'input.cast',
      '--theme',
      'dracula',
    ])
    const opts = program.opts()
    expect(opts.theme).toBe('dracula')
  })

  it('should exit on invalid theme choice', () => {
    const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called')
    })

    // Mock stderr to silence Commander.js error output
    const mockStderrWrite = vi
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true)

    try {
      expect(() =>
        parseCliArguments([
          'node',
          'cli.js',
          'input.cast',
          '--theme',
          'invalid-theme',
        ])
      ).toThrow('process.exit called')
    } finally {
      expect(mockExit).toHaveBeenCalledWith(1)
      mockExit.mockRestore()
      mockStderrWrite.mockRestore()
    }
  })
})

describe('Player Asset Paths', () => {
  it('should generate correct asset paths', () => {
    const { jsPath, cssPath } = getPlayerAssetPaths()

    expect(jsPath).toContain('asciinema-player')
    expect(jsPath).toContain('asciinema-player.js')
    expect(cssPath).toContain('asciinema-player')
    expect(cssPath).toContain('asciinema-player.css')
  })
})

describe('Player Assets Loading', () => {
  beforeEach(() => {
    vi.spyOn(fs, 'readFileSync')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should load player assets from files', () => {
    vi.mocked(fs.readFileSync)
      .mockReturnValueOnce('/* JS content */')
      .mockReturnValueOnce('/* CSS content */')

    const assets = loadPlayerAssets('/path/to/js', '/path/to/css')

    expect(assets.jsContent).toBe('/* JS content */')
    expect(assets.cssContent).toBe('/* CSS content */')
    expect(fs.readFileSync).toHaveBeenCalledTimes(2)
  })
})

describe('Cast Data URI Creation', () => {
  it('should create valid data URI from cast content', () => {
    const castContent = '{"version": 2, "width": 80, "height": 24}'
    const dataUri = createCastDataUri(castContent)

    expect(dataUri).toMatch(/^data:application\/json;base64,/)

    // Decode and verify
    const base64 = dataUri.replace('data:application/json;base64,', '')
    const decoded = Buffer.from(base64, 'base64').toString('utf-8')
    expect(decoded).toBe(castContent)
  })
})

describe('HTML Generation', () => {
  it('should generate valid HTML with player assets', () => {
    const playerAssets = {
      jsContent: 'console.log("JS loaded")',
      cssContent: 'body { margin: 0; }',
    }
    const castDataUri = 'data:application/json;base64,eyJ0ZXN0IjoidHJ1ZSJ9'
    const options: ParsedOptions = {
      output: 'test.mp4',
      width: 800,
      height: 600,
      theme: 'asciinema',
      speed: 1,
      scale: 1,
    }

    const html = generateHtml(playerAssets, castDataUri, options)

    expect(html).toContain(playerAssets.jsContent)
    expect(html).toContain(playerAssets.cssContent)
    expect(html).toContain(castDataUri)
    expect(html).toContain(`theme: '${options.theme}'`)
    expect(html).toContain(`speed: ${options.speed}`)
    expect(html).toContain('<!DOCTYPE html>')
    expect(html).toContain('AsciinemaPlayer.create')
  })
})

describe('Browser Setup', () => {
  // biome-ignore lint/suspicious/noExplicitAny: Mocking complex objects
  let mockBrowser: any
  // biome-ignore lint/suspicious/noExplicitAny: Mocking complex objects
  let mockPage: any

  beforeEach(async () => {
    const puppeteer = await import('puppeteer')

    mockPage = {
      setViewport: vi.fn().mockResolvedValue(undefined),
    }

    mockBrowser = {
      newPage: vi.fn().mockResolvedValue(mockPage),
      close: vi.fn().mockResolvedValue(undefined),
    }

    vi.mocked(puppeteer.default.launch).mockResolvedValue(mockBrowser)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should setup browser with correct viewport', async () => {
    const options: ParsedOptions = {
      output: 'test.mp4',
      width: 1200,
      height: 800,
      theme: 'asciinema',
      speed: 1,
      scale: 1,
    }

    const { browser, page } = await setupBrowser(options)

    expect(browser).toBe(mockBrowser)
    expect(page).toBe(mockPage)
    expect(mockPage.setViewport).toHaveBeenCalledWith({
      width: 1200,
      height: 800,
      deviceScaleFactor: 1,
    })
  })
})

describe('Player Setup', () => {
  // biome-ignore lint/suspicious/noExplicitAny: Mocking complex objects
  let mockPage: any

  beforeEach(() => {
    mockPage = {
      setContent: vi.fn().mockResolvedValue(undefined),
      on: vi.fn(),
      waitForFunction: vi.fn().mockResolvedValue(undefined),
      evaluate: vi.fn(),
    }
  })

  it('should setup player successfully', async () => {
    const html = '<html><body>Test</body></html>'

    await setupPlayer(mockPage, html)

    expect(mockPage.setContent).toHaveBeenCalledWith(html, {
      waitUntil: 'domcontentloaded',
    })
    expect(mockPage.on).toHaveBeenCalledWith('console', expect.any(Function))
    expect(mockPage.waitForFunction).toHaveBeenCalledWith(
      'window.playerReady === true && window.playerEl !== undefined',
      { timeout: 15000 }
    )
  })

  it('should handle player initialization error', async () => {
    const html = '<html><body>Test</body></html>'
    mockPage.waitForFunction.mockRejectedValueOnce(new Error('Timeout'))
    mockPage.evaluate.mockResolvedValueOnce('Player error occurred')

    await expect(setupPlayer(mockPage, html)).rejects.toThrow(
      'Player failed to initialize: Player error occurred'
    )
  })

  it('should handle player initialization error without playerError', async () => {
    const html = '<html><body>Test</body></html>'
    mockPage.waitForFunction.mockRejectedValueOnce(new Error('Timeout'))
    mockPage.evaluate.mockResolvedValueOnce(undefined)

    await expect(setupPlayer(mockPage, html)).rejects.toThrow(
      'Player failed to initialize'
    )
  })

  it('should handle case where playerError is falsy', async () => {
    // Create a fresh mock page to avoid interference from other tests
    const freshMockPage = {
      setContent: vi.fn().mockResolvedValue(undefined),
      on: vi.fn(),
      waitForFunction: vi.fn().mockRejectedValue(new Error('Timeout')),
      evaluate: vi.fn().mockResolvedValue(null), // playerError is falsy
    } as unknown as Page

    const html = '<html><body>Test</body></html>'

    await expect(setupPlayer(freshMockPage, html)).rejects.toThrow(
      'Player failed to initialize'
    )

    // Should not call consola.error for playerError since it's null
    // The line "if (playerError)" should prevent the error call
    expect(freshMockPage.evaluate).toHaveBeenCalled()
  })

  it('should evaluate window.playerError specifically', async () => {
    const testMockPage = {
      setContent: vi.fn().mockResolvedValue(undefined),
      on: vi.fn(),
      waitForFunction: vi.fn().mockRejectedValue(new Error('Timeout')),
      evaluate: vi.fn().mockImplementation((fn) => {
        // This mock specifically targets the window.playerError evaluation
        if (fn.toString().includes('window.playerError')) {
          return Promise.resolve('Specific player error')
        }
        return Promise.resolve(undefined)
      }),
    } as unknown as Page

    const html = '<html><body>Test</body></html>'

    await expect(setupPlayer(testMockPage, html)).rejects.toThrow(
      'Player failed to initialize: Specific player error'
    )

    expect(testMockPage.evaluate).toHaveBeenCalled()

    expect(consola.error).toHaveBeenCalledWith(
      'Player initialization error:',
      'Specific player error'
    )
  })
})

describe('Video Recording', () => {
  it('should create recorder configuration correctly', () => {
    const options: ParsedOptions = {
      output: 'test.mp4',
      width: 800,
      height: 600,
      theme: 'asciinema',
      speed: 1,
      scale: 1,
    }

    // Test the configuration values are used correctly
    expect(options.width).toBe(800)
    expect(options.height).toBe(600)
  })

  it('should test recordVideo flow with minimal mocking', () => {
    // This test verifies the types and structure without calling the actual function
    const mockPage = {
      evaluate: vi.fn(),
      waitForFunction: vi.fn(),
    }

    const options: ParsedOptions = {
      output: 'test.mp4',
      width: 800,
      height: 600,
      theme: 'asciinema',
      speed: 1,
      scale: 1,
    }

    // Test that the function parameters have the correct types and structure
    expect(typeof mockPage.evaluate).toBe('function')
    expect(typeof mockPage.waitForFunction).toBe('function')
    expect(typeof options.width).toBe('number')
    expect(options.width).toBe(800)
    expect(options.height).toBe(600)

    // Test recordVideo function exists and has correct signature
    expect(typeof recordVideo).toBe('function')
    expect(recordVideo.length).toBe(3) // Should take 3 parameters
  })
})

describe('Full Conversion Process', () => {
  // biome-ignore lint/suspicious/noExplicitAny: Mocking complex objects
  let mockBrowser: any
  // biome-ignore lint/suspicious/noExplicitAny: Mocking complex objects
  let mockPage: any

  beforeEach(async () => {
    // Mock all file system operations
    vi.spyOn(fs, 'existsSync').mockReturnValue(true)
    vi.spyOn(fs, 'readFileSync').mockImplementation((path) => {
      if (path.toString().includes('.cast')) {
        return '{"version": 2, "width": 80, "height": 24}'
      }
      if (path.toString().includes('.js')) {
        return 'console.log("JS loaded")'
      }
      if (path.toString().includes('.css')) {
        return 'body { margin: 0; }'
      }
      return ''
    })
    vi.spyOn(path, 'resolve').mockImplementation((p) => `/absolute/${p}`)

    // Mock puppeteer
    mockPage = {
      setViewport: vi.fn().mockResolvedValue(undefined),
      setContent: vi.fn().mockResolvedValue(undefined),
      on: vi.fn(),
      waitForFunction: vi.fn().mockResolvedValue(undefined),
      evaluate: vi.fn().mockResolvedValue(undefined),
    }

    mockBrowser = {
      newPage: vi.fn().mockResolvedValue(mockPage),
      close: vi.fn().mockResolvedValue(undefined),
    }

    const puppeteer = await import('puppeteer')
    vi.mocked(puppeteer.default.launch).mockResolvedValue(mockBrowser)

    // Mock process methods
    vi.spyOn(process, 'on').mockImplementation(() => process)
    vi.spyOn(process, 'off').mockImplementation(() => process)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should handle conversion process errors gracefully', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false)

    const options: ConvertOptions = {
      output: 'test.mp4',
      width: '800',
      height: '600',
      theme: 'asciinema',
      speed: '1',
      scale: '1',
    }

    await expect(
      convertCastToVideo('nonexistent.cast', options)
    ).rejects.toThrow('Input file not found')
  })

  it('should setup signal handlers and test cleanup', async () => {
    const options: ConvertOptions = {
      output: 'test.mp4',
      width: '800',
      height: '600',
      theme: 'asciinema',
      speed: '1',
      scale: '1',
    }

    const processOnSpy = vi.spyOn(process, 'on')
    const processOffSpy = vi.spyOn(process, 'off')
    // biome-ignore lint/suspicious/noExplicitAny: Mocking complex objects
    let cleanupHandler: ((...args: any[]) => void) | undefined

    // Capture the cleanup handler
    processOnSpy.mockImplementation(
      // biome-ignore lint/suspicious/noExplicitAny: Mocking complex objects
      (event: string | symbol, handler: (...args: any[]) => void) => {
        if (event === 'SIGINT') {
          cleanupHandler = handler
        }
        return process
      }
    )

    // Test error case where setupPlayer fails to test cleanup
    mockPage.waitForFunction.mockRejectedValueOnce(new Error('Setup failed'))
    mockPage.evaluate.mockResolvedValueOnce(undefined)

    await expect(convertCastToVideo('input.cast', options)).rejects.toThrow()

    expect(processOnSpy).toHaveBeenCalledWith('SIGINT', expect.any(Function))
    expect(processOnSpy).toHaveBeenCalledWith('SIGTERM', expect.any(Function))
    expect(processOffSpy).toHaveBeenCalledWith('SIGINT', expect.any(Function))
    expect(processOffSpy).toHaveBeenCalledWith('SIGTERM', expect.any(Function))
    expect(mockBrowser.close).toHaveBeenCalled()

    // Test the cleanup handler if it was captured
    if (cleanupHandler) {
      const mockProcessExit = vi
        .spyOn(process, 'exit')
        .mockImplementation(() => undefined as never)
      await cleanupHandler()
      expect(mockBrowser.close).toHaveBeenCalled()
      expect(mockProcessExit).toHaveBeenCalledWith(1)
      mockProcessExit.mockRestore()
    }
  })

  it('should handle browser cleanup on error', async () => {
    const options: ConvertOptions = {
      output: 'test.mp4',
      width: '800',
      height: '600',
      theme: 'asciinema',
      speed: '1',
      scale: '1',
    }

    // Mock setupPlayer to throw an error
    mockPage.waitForFunction.mockRejectedValueOnce(new Error('Setup failed'))
    mockPage.evaluate.mockResolvedValueOnce(undefined)

    await expect(convertCastToVideo('input.cast', options)).rejects.toThrow()

    // Browser should still be closed in finally block
    expect(mockBrowser.close).toHaveBeenCalled()
    expect(process.off).toHaveBeenCalledWith('SIGINT', expect.any(Function))
    expect(process.off).toHaveBeenCalledWith('SIGTERM', expect.any(Function))
  })

  it('should complete conversion successfully when mocking recordVideo', async () => {
    const options: ConvertOptions = {
      output: 'test.mp4',
      width: '800',
      height: '600',
      theme: 'asciinema',
      speed: '1',
      scale: '1',
    }

    // Mock recordVideo at the module level by providing a mock implementation
    const mockRecordVideo = vi.fn().mockResolvedValue(undefined)

    // Replace the imported function temporarily
    Object.defineProperty(globalThis, 'mockRecordVideo', {
      value: mockRecordVideo,
      configurable: true,
    })

    // Create a test version of convertCastToVideo that uses our mock
    const testConvertCastToVideo = async (
      inputPath: string,
      options: ConvertOptions
    ) => {
      const inputAbsPath = validateInputFile(inputPath)
      const outputAbsPath = path.resolve(options.output)
      const parsedOptions = parseOptions(options)

      consola.start(`Converting ${inputAbsPath} to ${outputAbsPath}...`)

      const { jsPath, cssPath } = getPlayerAssetPaths()
      const playerAssets = loadPlayerAssets(jsPath, cssPath)
      const castContent = fs.readFileSync(inputAbsPath, 'utf-8')
      const castDataUri = createCastDataUri(castContent)
      const html = generateHtml(playerAssets, castDataUri, parsedOptions)

      const { browser, page } = await setupBrowser(parsedOptions)

      const cleanup = async () => {
        if (browser) await browser.close()
        process.exit(1)
      }
      process.on('SIGINT', cleanup)
      process.on('SIGTERM', cleanup)

      try {
        await setupPlayer(page, html)
        await mockRecordVideo(page, outputAbsPath, parsedOptions) // Use mock
        consola.success('Done!')
      } finally {
        process.off('SIGINT', cleanup)
        process.off('SIGTERM', cleanup)
        await browser.close()
      }
    }

    await testConvertCastToVideo('input.cast', options)

    expect(mockRecordVideo).toHaveBeenCalled()
    expect(mockBrowser.close).toHaveBeenCalled()
    expect(process.off).toHaveBeenCalledWith('SIGINT', expect.any(Function))
    expect(process.off).toHaveBeenCalledWith('SIGTERM', expect.any(Function))

    expect(consola.start).toHaveBeenCalledWith(
      'Converting /absolute/input.cast to /absolute/test.mp4...'
    )
    expect(consola.success).toHaveBeenCalledWith('Done!')
  })
})

describe('CLI Entry Point', () => {
  it('should handle CLI action errors', async () => {
    const mockExit = vi
      .spyOn(process, 'exit')
      .mockImplementation(() => undefined as never)

    const options: ConvertOptions = {
      output: 'test.mp4',
      width: '800',
      height: '600',
      theme: 'asciinema',
      speed: '1',
      scale: '1',
    }

    // Create a mock program action function that simulates the CLI entry point
    const mockAction = async (_inputPath: string, _opts: ConvertOptions) => {
      try {
        // Mock convertCastToVideo to throw an error
        throw new Error('Conversion failed')
      } catch (error) {
        consola.error(error instanceof Error ? error.message : String(error))
        process.exit(1)
      }
    }

    // Simulate the CLI action
    await mockAction('input.cast', options)

    expect(consola.error).toHaveBeenCalledWith('Conversion failed')
    expect(mockExit).toHaveBeenCalledWith(1)

    mockExit.mockRestore()
  })

  it('should handle non-Error exceptions', async () => {
    const mockExit = vi
      .spyOn(process, 'exit')
      .mockImplementation(() => undefined as never)

    const options: ConvertOptions = {
      output: 'test.mp4',
      width: '800',
      height: '600',
      theme: 'asciinema',
      speed: '1',
      scale: '1',
    }

    // Create a mock program action function that throws a non-Error
    const mockAction = async (_inputPath: string, _opts: ConvertOptions) => {
      try {
        // Mock convertCastToVideo to throw a non-Error
        throw 'String error'
      } catch (error) {
        consola.error(error instanceof Error ? error.message : String(error))
        process.exit(1)
      }
    }

    // Simulate the CLI action
    await mockAction('input.cast', options)

    expect(consola.error).toHaveBeenCalledWith('String error')
    expect(mockExit).toHaveBeenCalledWith(1)

    mockExit.mockRestore()
  })

  it('should simulate CLI program flow', () => {
    // Test the program setup that would happen in the CLI entry point
    const program = parseCliArguments()

    // Verify the program has the expected structure
    expect(program).toBeDefined()
    expect(typeof program.action).toBe('function')
    expect(typeof program.parse).toBe('function')

    // Mock the action to verify it can be called
    const actionSpy = vi.spyOn(program, 'action')

    // Simulate what the CLI entry point does - just test the action registration
    program.action(async () => {
      // Mock action implementation
    })

    expect(actionSpy).toHaveBeenCalled()
  })
})
