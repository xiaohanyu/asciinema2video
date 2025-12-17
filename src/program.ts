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
import { Command, Option } from 'commander'
import { consola } from 'consola'
import puppeteer, {
  type Browser,
  type ConsoleMessage,
  type Page,
} from 'puppeteer'
import { PuppeteerScreenRecorder } from 'puppeteer-screen-recorder'

export const THEMES = [
  'asciinema',
  'dracula',
  'gruvbox-dark',
  'monokai',
  'solarized-dark',
  'solarized-light',
  'tango',
  'nord',
] as const

export type Theme = (typeof THEMES)[number]

/**
 * Raw CLI options as strings from command line arguments
 */
export interface ConvertOptions {
  output: string
  width: string
  height: string
  theme: Theme
  speed: string
  scale: string
}

/**
 * Parsed CLI options with proper types
 */
export interface ParsedOptions {
  output: string
  width: number
  height: number
  theme: Theme
  speed: number
  scale: number
}

/**
 * Asciinema player JavaScript and CSS assets
 */
export interface PlayerAssets {
  jsContent: string
  cssContent: string
}

/**
 * Parses command line arguments and creates a Commander program
 *
 * @param argv - Optional array of arguments to parse (for testing)
 * @returns Configured Commander program
 */
export function parseCliArguments(argv?: string[]) {
  const testProgram = new Command()
    .name('asciinema2video')
    .description('Convert asciinema cast file to video')
    .argument('<input>', 'Path to .cast file')
    .option('-o, --output <path>', 'Output video path', 'output.mp4')
    .option('--width <number>', 'Width of the video', '800')
    .option('--height <number>', 'Height of the video', '600')
    .addOption(
      new Option('--theme <string>', 'Asciinema theme')
        .choices(THEMES)
        .default('asciinema')
    )
    .option('--speed <number>', 'Playback speed', '1')
    .option('--scale <number>', 'Player scale', '2')
    .addHelpText(
      'after',
      `
Examples:
  $ asciinema2video demo.cast -o demo.mp4
  $ asciinema2video demo.cast --width 1920 --height 1080 --theme dracula
  $ asciinema2video demo.cast --width 1920 --height 1080 --scale 3
`
    )

  if (argv) {
    testProgram.parse(argv)
  }

  return testProgram
}

/**
 * Validates that the input file exists and returns its absolute path
 *
 * @param inputPath - Path to the input .cast file
 * @returns Absolute path to the input file
 * @throws Error if file does not exist
 */
export function validateInputFile(inputPath: string): string {
  const inputAbsPath = path.resolve(inputPath)

  if (!fs.existsSync(inputAbsPath)) {
    throw new Error(`Input file not found: ${inputAbsPath}`)
  }

  return inputAbsPath
}

/**
 * Converts string CLI options to proper numeric types
 *
 * @param options - Raw CLI options as strings
 * @returns Parsed options with correct types
 */
export function parseOptions(options: ConvertOptions): ParsedOptions {
  return {
    output: options.output,
    width: Number.parseInt(options.width, 10),
    height: Number.parseInt(options.height, 10),
    theme: options.theme,
    speed: Number.parseFloat(options.speed),
    scale: Number.parseFloat(options.scale),
  }
}

/**
 * Gets the file paths for asciinema-player JavaScript and CSS assets
 * Uses Node.js module resolution to locate the package regardless of node_modules location
 * @returns Object containing paths to JS and CSS files
 */
export function getPlayerAssetPaths(): { jsPath: string; cssPath: string } {
  // Use Node.js module resolution to find asciinema-player package
  // Resolve the main entry point and work backwards to package root
  const playerMainPath = import.meta.resolve('asciinema-player')
  const playerMainDir = path.dirname(new URL(playerMainPath).pathname)
  // The main entry is in dist/index.js, so go up one level to package root
  const playerPackagePath = path.dirname(playerMainDir)

  const jsPath = path.join(
    playerPackagePath,
    'dist',
    'bundle',
    'asciinema-player.js'
  )
  const cssPath = path.join(
    playerPackagePath,
    'dist',
    'bundle',
    'asciinema-player.css'
  )

  return { jsPath, cssPath }
}

/**
 * Loads asciinema-player JavaScript and CSS content from files
 *
 * @param jsPath - Path to the JavaScript file
 * @param cssPath - Path to the CSS file
 * @returns Object containing file contents
 */
export function loadPlayerAssets(
  jsPath: string,
  cssPath: string
): PlayerAssets {
  const jsContent = fs.readFileSync(jsPath, 'utf-8')
  const cssContent = fs.readFileSync(cssPath, 'utf-8')

  return { jsContent, cssContent }
}

/**
 * Converts cast file content to a base64 data URI
 *
 * @param castContent - Raw content of the .cast file
 * @returns Base64 encoded data URI
 */
export function createCastDataUri(castContent: string): string {
  const castBase64 = Buffer.from(castContent).toString('base64')
  return `data:application/json;base64,${castBase64}`
}

/**
 * Generates HTML page containing the asciinema player with cast data
 *
 * @param playerAssets - JavaScript and CSS content for the player
 * @param castDataUri - Base64 data URI of the cast file
 * @param options - Parsed CLI options
 * @returns Complete HTML page as string
 */
export function generateHtml(
  playerAssets: PlayerAssets,
  castDataUri: string,
  options: ParsedOptions
): string {
  return `<!DOCTYPE html>
<html>
<head>
  <style>
    ${playerAssets.cssContent}
    body {
      margin: 0;
      padding: 0;
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100vh;
      background: #000;
    }
    #player-container {
      width: 100%;
      height: 100%;
    }
  </style>
</head>
<body>
  <div id="player-container"></div>
  <script>
    ${playerAssets.jsContent}
  </script>
  <script>
    try {
      const container = document.getElementById('player-container');
      window.player = AsciinemaPlayer.create('${castDataUri}', container, {
        theme: '${options.theme}',
        speed: ${options.speed},
        fontSize: 'medium',
        autoPlay: false,
        preload: true,
        fit: 'both',
      });

      window.playerEl = window.player.el;
      window.playerReady = true;
      window.playerEnded = false;

      window.player.addEventListener('ended', () => {
         setTimeout(() => {
            window.playerEnded = true;
         }, 1000);
      });
    } catch (error) {
      window.playerError = error.toString();
    }
  </script>
</body>
</html>`
}

/**
 * Launches a headless browser and creates a page with specified dimensions
 *
 * @param options - Parsed CLI options containing width and height
 * @returns Object containing browser instance and page
 */
export async function setupBrowser(
  options: ParsedOptions
): Promise<{ browser: Browser; page: Page }> {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  })

  const page = await browser.newPage()

  await page.setViewport({
    width: options.width,
    height: options.height,
    deviceScaleFactor: options.scale,
  })

  return { browser, page }
}

/**
 * Loads HTML content into the page and waits for player initialization
 *
 * @param page - Puppeteer page instance
 * @param html - Complete HTML page content
 * @throws Error if player fails to initialize
 */
export async function setupPlayer(page: Page, html: string): Promise<void> {
  await page.setContent(html, { waitUntil: 'domcontentloaded' })

  page.on('console', (msg: ConsoleMessage) => {
    consola.debug('Browser console:', msg.text())
  })

  try {
    await page.waitForFunction(
      'window.playerReady === true && window.playerEl !== undefined',
      { timeout: 15000 }
    )
    consola.success('Player initialized successfully')
  } catch (_error) {
    const playerError = await page.evaluate(
      () =>
        // @ts-expect-error
        window.playerError
    )
    if (playerError) {
      consola.error('Player initialization error:', playerError)
    }

    throw new Error(
      `Player failed to initialize${playerError ? `: ${playerError}` : ''}`
    )
  }
}

/**
 * Records the asciinema player as a video using screen recording
 *
 * @param page - Puppeteer page containing the player
 * @param outputPath - Path where the video will be saved
 * @param options - Parsed CLI options containing video dimensions
 */
export async function recordVideo(
  page: Page,
  outputPath: string,
  options: ParsedOptions
): Promise<void> {
  // Get ffmpeg path
  const ffmpegPath = await import('ffmpeg-static').then((m) => m.default)

  const recorder = new PuppeteerScreenRecorder(page, {
    followNewTab: false,
    fps: 60,
    ffmpeg_Path: ffmpegPath,
    videoFrame: {
      width: options.width,
      height: options.height,
    },
  })

  consola.start('Starting recording...')
  await recorder.start(outputPath)

  consola.info('Starting playback...')
  await page.evaluate(() => {
    // @ts-expect-error
    window.player.play()
  })

  await page.waitForFunction('window.playerEnded === true', { timeout: 0 })

  consola.info('Stopping recording...')
  await recorder.stop()
}

/**
 * Main function that orchestrates the conversion of a cast file to video
 *
 * @param inputPath - Path to the input .cast file
 * @param options - Raw CLI options
 */
export async function convertCastToVideo(
  inputPath: string,
  options: ConvertOptions
): Promise<void> {
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

  // Add this helper to ensure browser closes on Ctrl+C
  const cleanup = async () => {
    if (browser) await browser.close()
    process.exit(1)
  }
  process.on('SIGINT', cleanup)
  process.on('SIGTERM', cleanup)

  try {
    await setupPlayer(page, html)
    await recordVideo(page, outputAbsPath, parsedOptions)
    consola.success('Done!')
  } finally {
    // Remove listeners to prevent memory leaks in long running processes (though less relevant for CLI)
    process.off('SIGINT', cleanup)
    process.off('SIGTERM', cleanup)
    await browser.close()
  }
}

/**
 * Creates and configures the CLI program
 */
export function createProgram(): Command {
  const program = parseCliArguments()

  program.action(async (inputPath: string, options: ConvertOptions) => {
    try {
      await convertCastToVideo(inputPath, options)
    } catch (error) {
      consola.error(error instanceof Error ? error.message : String(error))
      process.exit(1)
    }
  })

  return program
}
