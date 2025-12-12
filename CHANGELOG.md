# Changelog

## v1.0.0 - Initial Release

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

### Known Limitations
- Requires Node.js 14+
- Video encoding time depends on cast file duration
- Output format is MP4 (H.264)
