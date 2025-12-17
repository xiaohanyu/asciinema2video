# Changelog

All notable changes to this project will be documented in this file. See [commit-and-tag-version](https://github.com/absolute-version/commit-and-tag-version) for commit guidelines.

## [1.0.2](https://github.com/xiaohanyu/asciinema2video/compare/v1.0.1...v1.0.2) (2025-12-17)

## [1.0.1](https://github.com/xiaohanyu/asciinema2video/compare/v1.0.0...v1.0.1) (2025-12-17)

## 1.0.0 (2025-12-17)

### Features
- ✅ Convert `.cast` files to MP4 video
- ✅ Customizable video dimensions (width/height)
- ✅ Adjustable playback speed
- ✅ Theme support (asciinema, monokai, etc.)
- ✅ 60 FPS output for smooth playback
- ✅ High DPI rendering (2x device scale factor)
- ✅ Automatic player lifecycle management
- ✅ CLI interface with Commander.js

### Technical Details
- Uses Puppeteer for headless browser automation
- Leverages official asciinema-player for accurate rendering
- FFmpeg (via ffmpeg-static) for video encoding
- TypeScript for type safety
