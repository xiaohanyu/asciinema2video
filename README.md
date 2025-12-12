# asciinema2video

Convert asciinema `.cast` files to video (MP4) using Node.js and Puppeteer.

## Features

- 🎥 Convert `.cast` files to high-quality MP4 videos
- 🎨 Support for asciinema player themes
- ⚡ Adjustable playback speed
- 📐 Customizable video dimensions
- 🎬 60 FPS output for smooth playback

## Installation

You can run it directly using `npx`:

```bash
npx asciinema2video input.cast -o output.mp4
```

Or install globally via npm:

```bash
npm install -g asciinema2video
```

## Usage

### Basic Usage

```bash
npm run dev -- input.cast -o output.mp4
```

Or after building:

```bash
node dist/cli.js input.cast -o output.mp4
```

Or if installed globally:

```bash
asciinema2video input.cast -o output.mp4
```

### Options

```
$ asciinema2video --help
Usage: asciinema2video [options] <input>

Convert asciinema cast file to video

Arguments:
  input                Path to .cast file

Options:
  -o, --output <path>  Output video path (default: "output.mp4")
  --width <number>     Width of the video (default: "800")
  --height <number>    Height of the video (default: "600")
  --theme <string>     Asciinema theme (choices: "asciinema", "dracula", "gruvbox-dark", "monokai", "solarized-dark",
                       "solarized-light", "tango", "nord", default: "asciinema")
  --speed <number>     Playback speed (default: "1")
  --scale <number>     Player scale (default: "2")
  -h, --help           display help for command

Examples:
  $ asciinema2video demo.cast -o demo.mp4
  $ asciinema2video demo.cast --width 1920 --height 1080 --theme dracula
```

### Themes

Available themes include:
- `asciinema` (default)
- `dracula`
- `monokai`
- `solarized-dark`
- `solarized-light`
- `tango`
- `nord`

For a full list of supported themes, please refer to the [asciinema-player
documentation](https://github.com/asciinema/asciinema-player#themes).

### Examples

```bash
# Basic conversion
asciinema2video demo.cast -o demo.mp4

# Custom dimensions
asciinema2video demo.cast -o demo.mp4 --width 1920 --height 1080

# Faster playback
asciinema2video demo.cast -o demo.mp4 --speed 2

# Different theme
asciinema2video demo.cast -o demo.mp4 --theme monokai
```

## How It Works

1. Loads the asciinema player in a headless browser (Puppeteer)
2. Renders the `.cast` file using the asciinema-player library
3. Records the browser screen while the terminal recording plays
4. Outputs the recording as an MP4 video using FFmpeg

## Requirements

- Node.js 20+
- FFmpeg (bundled via `ffmpeg-static`)
- **Graphical Environment**: Since this tool uses Puppeteer (Chrome) to record
  he screen, it requires a graphical environment.
  - On **Linux servers** (headless), you may need to use `Xvfb` (X virtual
    framebuffer).
    ```bash
    xvfb-run --auto-servernum --server-args="-screen 0 1280x1024x24" asciinema2video input.cast
    ```

## Dependencies

- **puppeteer**: Headless browser automation
- **asciinema-player**: Official asciinema player
- **puppeteer-screen-recorder**: Screen recording for Puppeteer
- **ffmpeg-static**: Bundled FFmpeg binary
- **commander**: CLI argument parsing

## Creating a Sample Cast File

You can create a `.cast` file using the asciinema CLI:

```bash
# Install asciinema
brew install asciinema  # macOS
# or
apt-get install asciinema  # Linux

# Record a session
asciinema rec demo.cast

# Convert to video
asciinema2video demo.cast -o demo.mp4
```

## License

MIT
