# robinsonha.cc

Static rebuild of my portfolio site. GitHub Pages serves the repository root.

## Layout

- `index.html`, `2/` to `6/`: the pages. `tools/build.mjs` generates them, so edit the data or the script and rebuild.
- `assets/`: stylesheet, script, fonts, images, and videos.
- `reference/`: page data and screenshots saved from the original Readymag site.
- `tools/`: build and screenshot scripts.

## Rebuild

```
cd tools
npm install
npx playwright install chromium
node build.mjs
node shoot.mjs ../reference/build 1440 900 home=/ 2=/2/ 3=/3/ 4=/4/ 5=/5/ 6=/6/
```

The build downloads any missing image or video and converts videos with `ffmpeg`.
