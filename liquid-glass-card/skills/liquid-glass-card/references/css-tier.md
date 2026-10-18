# Web: CSS-only tier

Use this when the glass must sit over live page content, for many small cards, or for the secondary cards on a page whose hero is the WebGL template.

```css
.glass {
  background: rgb(10 10 15 / .55);
  backdrop-filter: blur(16px) saturate(150%);
  -webkit-backdrop-filter: blur(16px) saturate(150%);
  border-radius: 24px;
  border: 1px solid rgb(255 255 255 / .16);          /* rim */
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / .3),             /* top specular */
    inset 0 -18px 40px rgb(0 0 0 / .35);             /* depth */
}
@media (prefers-reduced-transparency: reduce) {
  .glass { background: #121019; backdrop-filter: none; }
}
```

Keep the blur static, because animating `backdrop-filter` repaints every frame. Animate opacity or transform instead.

## No bending in this tier

This tier gives frost and rim, not refraction. Tell the user so. Refraction here would need SVG `feDisplacementMap` inside `backdrop-filter`, and that is not portable: Safari doesn't render it, and Firefox passes `@supports` and then draws nothing. Stay with blur, saturate and the rim.
