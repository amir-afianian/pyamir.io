# Claude: Artifact page and Design canvas

Read this only when running inside Claude (Claude Code or claude.ai).

## Artifact page

For the web template, deliver the HTML file as an Artifact page, unless the user is working in a codebase and wants a component file instead.

## Claude Design canvas

A canvas artboard is a `.dc.html` Design Component. Its UI must be `<x-dc>` markup (no `innerHTML` or `appendChild`), but drawing pixels into a `<canvas>` you declared in the markup is fine. This was tested with the canvas's own runtime: the live card rendered with refraction, rim and drift. The live WebGL card works there through a ref, not through the standalone template's script.

Build it like this:

- Fixed artboard, for example 880×560. The root `div` is `position: relative; overflow: hidden; background: #07060c`.
- First child: `<canvas ref="{{canvasRef}}" width="880" height="560" style="position: absolute; left: 0; top: 0; width: 880px; height: 560px">`. In `renderVals()` return `canvasRef: function (el) { self.cv = el; }` (a callback ref).
- Second child: the card's text as literal markup in an absolutely positioned `div` with the same box as the glass (for example left 180, top 170, 520×220, `border-radius` 52px). Copy stays literal so people can retype it on the canvas.
- In `componentDidMount()` set up WebGL on `this.cv` with the web template's fragment shader unchanged. Set the fixed uniforms once (`R`, `C`, `S` in device pixels, `sy` = 1, `GP`, `BG`, `TINT`, `tmix`, `grid`, `rf`, `lang`, `drift` = 0 under reduced motion). In the animation frame, read `this.props` each time so Tweaks apply live. Cancel the frame in `componentWillUnmount()`.
- Declare a few tweaks in `data-props`: `glow` (color, with 3–4 swatch options), `refraction`, `frost` and `dispersion` (range). Don't make tweaks for the copy.
- Logic is classic JS: `class Component extends DCLogic`, no imports. The shader can sit in a template literal inside the class.
- Put a second artboard beside it with the CSS-only version (three blurred circles as the glow, then the `.glass` styles from `references/css-tier.md` inline on the card) when the canvas will be exported or handed to a tool that won't run scripts. In the canvas index, give the WebGL artboard a title like "Live glass (WebGL)" and the other "CSS-only glass".

Follow the Design type's own instructions for the canvas files (`project/canvas.json`, one file per artboard, one publish call). That type asks you not to verify after publishing unless the user asked, so do any local check before publishing.
