---
name: "liquid-glass-card"
description: "Build a liquid glass card (frosted, light-bending glass over a soft colour glow, with a specular rim and bounce-in) for web, iOS or a Claude Design canvas. Use for liquid glass, glassmorphism, frosted or refractive glass cards and panels."
---

# Liquid Glass Card

Produce a polished liquid glass card from a short request, such as "liquid glass card showing MRR $48k" or "a glass pricing card in blue". The look comes from Stephan Zammit's After Effects tutorial "Vibrant Glass UI" (YouTube fJJ6YhaUWB8), verified against frames of the video, then rebuilt as live UI.

## What the look is made of

Think of a thick glass coaster lying on a table lit by a coloured lamp. Each physical fact maps to one layer:

1. **Glow (the lamp).** One to three large, soft colour blobs on a near-black ground (#07060c), placed off-centre, usually bottom right. In the video the glow spills below the card like a floor reflection.
2. **Frost.** The glow seen through the card is heavily blurred, with no detail.
3. **Tint.** The card base is near-black (#0a0a0f), mixed in at about 35%, so text reads well.
4. **Refraction.** The background bends only near the edges, never in the centre. In the video it is subtle: the glow looks smeared along the border, not strongly warped.
5. **Specular rim.** A thin 1 to 2 px light line around the edge, brightest on the side facing the light and where the glow sits behind it.
6. **Motion.** The card grows in vertically with an overshoot bounce (the AE expression freq 1.5, amplitude 0.1, decay 4.5). The glow drifts slowly.

Corners are about 10% of the card width. There is no chromatic aberration and no hard drop shadow in the original. Keep dispersion at 0 unless the user asks for a more "Apple Liquid Glass" or rainbow-edge look.

## Pick the target

If the request is ambiguous, pick web, say so in one line, and build it. Don't stop to ask.

- **Web, or no platform named:** use the WebGL template, `assets/liquid-glass-card.html`, as described below. It works in Chrome, Safari and Firefox because it draws its own background instead of reading the page behind it. Deliver it as a component file in the user's codebase if they are working in one, otherwise as the HTML file.
- **iOS / SwiftUI:** read `references/ios.md`.
- **Glass over real page content on the web** (a navbar over a scrolling page, a card over a photo the page already shows, or many small cards): WebGL cannot read live HTML. Read `references/css-tier.md`, build the CSS tier (frost and rim, no bending) and say why.
- **Inside Claude (Claude Code or claude.ai), and the user wants an Artifact page or a Claude Design canvas artboard:** read `references/claude-artifacts.md`.

## Web: the template

Copy [`assets/liquid-glass-card.html`](assets/liquid-glass-card.html) and change only what the request needs. It is a complete page that opens on its own. To embed the card in an existing page or component, take the `<style>`, the `.lg-stage` element and the `<script>` from its body, and leave the page wrapper behind.

What to change:

- **Content:** replace the `.lg-content` markup with the card's real content (a metric, a pricing tier, a profile, a notification). Keep a real `aria-label` on `.lg-stage`, because the visible text sits in an `aria-hidden` overlay.
- **Colours:** set `glows` to the requested palette. Use one dominant glow for a calm card; add a second or third for a richer one. Keep `background` very dark, since the glass needs light to bend.
- **Size:** set `card.width` and `card.height` to fit the content. The template caps them to the stage, so it works at phone width.
- **Strength:** `refraction` 15 to 25 matches the video; 35 to 50 is a showier liquid look. `frost` 10 to 18 is frosted; 4 to 8 is clearer. `dispersion` 30 to 50 adds rainbow edges.
- **Light:** `lightAngle` in degrees sets which edge of the rim is brightest. Aim it at the main glow.

The script exposes its config as `stage.lgConfig`. Edits there apply live, except `card.x`, `card.y` and `card.draggable`, which are read once at start.

How the shader works, in case a change needs it: the card is a rounded-rectangle signed distance field. Inside it, the normal of that field pushes background samples outward near the edge (refraction), nine samples in a spiral blur them (frost), and red and blue are sampled at slightly different offsets (dispersion). The background is a function (`bg`), so "what is behind the glass" can be evaluated at any offset with no texture reads. To put several cards on one page, give each stage a unique id and run the script once per stage with its own config.

For a page with more than one card, or a card inside an app shell, keep the WebGL stage as the hero and use the CSS fallback style from `references/css-tier.md` for secondary cards. A few real-time glass layers per screen is the practical limit on phones.

## Check before handing over

- Render it once and look at it: the rim should be visible all round, the glow should show through the card, and text should be crisp white. If you can run a headless browser (for example headless Chromium with `--use-angle=swiftshader`), screenshot it with `bounceIn` off so it isn't caught mid-animation. Otherwise tell the user to open the file and check the same three things.
- Text contrast: check the label against the brightest glow behind the card (WCAG 4.5:1). Increase `tintAmount` toward 0.5 if it is too low.
- Reduced motion: the template already skips the bounce and drift when `prefers-reduced-motion` is set. Keep that in any rewrite.
- Tell the user in one line which settings you chose (colours, refraction, frost), so they can ask for tweaks in those terms.
