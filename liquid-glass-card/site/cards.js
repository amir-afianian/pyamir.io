// Card types the playground can put on the glass. The metric card is not listed here: it is whatever the template itself ships.
export const EXTRA_CARDS = {
  profile: {
    width: 460, height: 190,
    aria: 'Profile card: Maya Rahimi, product designer in Lisbon, open to work',
    html: `<div class="lg-profile">
  <span class="av">MR</span>
  <div class="who">
    <span class="k">Product designer</span>
    <span class="v">Maya Rahimi</span>
    <span class="s">Lisbon · 12 years · open to work</span>
  </div>
</div>`,
    css: `.lg-content .lg-profile{display:flex;align-items:center;gap:18px}
.lg-content .lg-profile .av{flex:none;width:64px;height:64px;border-radius:50%;display:grid;place-items:center;font-weight:700;font-size:1.25rem;letter-spacing:.02em;background:rgb(255 255 255/.14);box-shadow:inset 0 0 0 1px rgb(255 255 255/.28)}
.lg-content .lg-profile .who{display:flex;flex-direction:column;gap:6px;min-width:0}
.lg-content .lg-profile .v{font-size:clamp(1.4rem,3vw,2rem)}`,
  },
  pricing: {
    width: 440, height: 244,
    aria: 'Pro plan: $24 per seat per month, with unlimited cards and team presets',
    html: `<div class="lg-pricing">
  <span class="k">Pro · per seat</span>
  <span class="v">$24<small>/mo</small></span>
  <span class="s">Unlimited cards and shared team presets</span>
  <span class="cta">Start free trial</span>
</div>`,
    css: `.lg-content .lg-pricing{display:flex;flex-direction:column;align-items:flex-start;gap:6px}
.lg-content .lg-pricing .v small{font-size:.9rem;font-weight:500;letter-spacing:0;opacity:.75;margin-left:4px}
.lg-content .lg-pricing .cta{margin-top:10px;padding:9px 18px;border-radius:999px;font-size:.85rem;font-weight:600;color:#0a0a0f;background:rgb(255 255 255/.92);text-shadow:none}`,
  },
  notification: {
    width: 460, height: 150,
    aria: 'Notification: Priya sent you design-review-final.fig, 4.2 megabytes',
    html: `<div class="lg-note">
  <span class="ic" aria-hidden="true"></span>
  <div class="body">
    <span class="k">Files · now</span>
    <span class="v">Priya sent you a file</span>
    <span class="s">design-review-final.fig · 4.2 MB</span>
  </div>
</div>`,
    css: `.lg-content .lg-note{display:flex;align-items:center;gap:16px}
.lg-content .lg-note .ic{flex:none;width:44px;height:44px;border-radius:12px;background:linear-gradient(145deg,rgb(255 255 255/.32),rgb(255 255 255/.08));box-shadow:inset 0 0 0 1px rgb(255 255 255/.3)}
.lg-content .lg-note .body{display:flex;flex-direction:column;gap:4px;min-width:0}
.lg-content .lg-note .v{font-size:1.2rem;letter-spacing:-.01em}`,
  },
};

export const allCards = (defaults, metric) => ({
  metric: { width: defaults.card.width, height: defaults.card.height, css: '', ...metric },
  ...EXTRA_CARDS,
});

// Each preset overrides the template defaults; "original" overrides nothing, so it is always the template's own look.
export const PRESETS = [
  { id: 'original', c: 'metric' },
  { id: 'apple-clear', c: 'profile',
    r: 26, f: 5, d: 6, l: 300, t: 0.2, g: ['#6ad4ff', '#a78bfa', '#ff9ec7'], i: [0.85, 0.8, 0.7] },
  { id: 'showy-liquid', c: 'pricing',
    r: 45, f: 10, d: 0, l: 300, t: 0.4, g: ['#17c3ff', '#6b5bff', '#00e0a4'], i: [1.3, 0.95, 0.8] },
  { id: 'rainbow-edge', c: 'notification',
    r: 30, f: 12, d: 40, l: 320, t: 0.4, g: ['#ff3d9a', '#ffb02e', '#2ee6ff'], i: [1.2, 0.9, 0.9] },
];
