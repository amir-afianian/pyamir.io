import { PRESETS, allCards } from './cards.js';
import { RANGES, applyState, agentPrompt, decode, encode, exportHtml, stateFromConfig, withCardCss, withOverrides } from './share.js';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const frame = $('#lg-frame');
const statusEl = $('#status');
const fallbackBox = $('#fallback-copy');
const fallbackLabel = fallbackBox.closest('label');

const loadedConfig = () => frame.contentDocument?.getElementById('lg-stage')?.lgConfig;
if (!loadedConfig()) await new Promise(resolve => frame.addEventListener('load', resolve, { once: true }));

// Without WebGL the template shows its CSS fallback and exposes no live config, so there is nothing to tune.
if (loadedConfig()) boot();
else {
  statusEl.textContent = "This browser can't run WebGL, so the live controls are off. The install steps below still work.";
  $$('.controls input, .presets button, .actions .btn').forEach(el => { el.disabled = true; });
}

let statusTimer;
function say(message) {
  statusEl.textContent = message;
  clearTimeout(statusTimer);
  statusTimer = setTimeout(() => { statusEl.textContent = ''; }, 2600);
}

async function copy(text, what) {
  fallbackLabel.hidden = true;
  try {
    await navigator.clipboard.writeText(text);
    say(`Copied ${what}`);
  } catch {
    fallbackLabel.hidden = false;
    fallbackBox.value = text;
    fallbackBox.focus();
    fallbackBox.select();
    say(`Couldn't copy ${what}. Select the text below and copy it.`);
  }
}

$$('.cmd').forEach(cmd => {
  const text = $('code', cmd).textContent;
  const button = $('.copy', cmd);
  button.setAttribute('aria-label', `Copy: ${text}`);
  button.addEventListener('click', () => copy(text, 'command'));
});

function boot() {
  // The template is the only source of truth: its own config and its own metric card become the "Original" look.
  const doc = frame.contentDocument;
  const stage = doc.getElementById('lg-stage');
  const content = stage.querySelector('.lg-content');
  const live = stage.lgConfig;
  const defaults = structuredClone(live);
  const baseState = stateFromConfig(defaults);

  const CARDS = allCards(defaults, { aria: stage.getAttribute('aria-label'), html: content.innerHTML });
  const CARD_IDS = Object.keys(CARDS);

  const componentStyle = [...doc.querySelectorAll('style')].find(s => s.textContent.includes('/* Fallback when WebGL'));
  componentStyle.textContent = withCardCss(componentStyle.textContent, Object.values(CARDS).map(c => c.css).filter(Boolean).join('\n'));

  const presetStates = Object.fromEntries(PRESETS.map(p => [p.id, withOverrides(baseState, p)]));
  let templateText;

  let state = decode(location.hash, baseState, CARD_IDS);
  let shownCard = null;
  let hashTimer;

  const sliders = $$('input[type="range"][data-key]');
  const glowRows = $$('.glow');
  const intensities = glowRows.map(row => $('input[type="range"]', row));
  sliders.forEach(input => Object.assign(input, RANGES[input.dataset.key]));
  intensities.forEach(input => Object.assign(input, RANGES.i));
  const show = (input, value) => {
    input.value = value;
    setFill(input);
    $('output', input.parentElement).textContent = value.toFixed(input.step < 1 ? 2 : 0);
  };

  const setFill = input => input.style.setProperty('--p', (input.value - input.min) / (input.max - input.min));
  const fitFrame = () => { frame.style.height = `${stage.offsetHeight + 34}px`; };

  function showCard(id, replay) {
    if (id === shownCard) return;
    shownCard = id;
    content.innerHTML = CARDS[id].html;
    stage.setAttribute('aria-label', CARDS[id].aria);
    fitFrame();
    if (replay) stage.lgReplay?.();
  }

  // Safari throttles history.replaceState, so a drag on a slider must not write the hash on every input event.
  function scheduleHash() {
    clearTimeout(hashTimer);
    hashTimer = setTimeout(() => {
      try { history.replaceState(null, '', encode(state)); } catch { /* the page works without a shareable hash */ }
    }, 120);
  }

  function render({ replay = false, persist = true } = {}) {
    applyState(live, state, CARDS[state.c]);
    showCard(state.c, replay);

    sliders.forEach(input => show(input, state[input.dataset.key]));
    $('#ctl-dotGrid').checked = state.n;
    glowRows.forEach((row, k) => {
      $('.swatch', row).value = state.g[k];
      show(intensities[k], state.i[k]);
    });
    $$('[data-card]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.card === state.c)));
    const current = encode(state);
    Object.entries(presetStates).forEach(([id, s]) => $(`[data-preset="${id}"]`).setAttribute('aria-pressed', String(encode(s) === current)));

    document.documentElement.style.setProperty('--glow-a', state.g[0]);
    document.documentElement.style.setProperty('--glow-b', state.g[1]);
    if (persist) scheduleHash();
  }

  function update(patch, opts) {
    state = { ...state, ...patch };
    render(opts);
  }

  sliders.forEach(input => input.addEventListener('input', () => update({ [input.dataset.key]: Number(input.value) })));
  $('#ctl-dotGrid').addEventListener('change', e => update({ n: e.target.checked }));
  glowRows.forEach((row, k) => {
    const patchAt = (key, value) => update({ [key]: state[key].map((v, j) => (j === k ? value : v)) });
    $('.swatch', row).addEventListener('input', e => patchAt('g', e.target.value.toLowerCase()));
    intensities[k].addEventListener('input', e => patchAt('i', Number(e.target.value)));
  });
  $$('[data-card]').forEach(b => b.addEventListener('click', () => update({ c: b.dataset.card }, { replay: true })));
  $$('[data-preset]').forEach(b => b.addEventListener('click', () => {
    state = presetStates[b.dataset.preset];
    render({ replay: true });
  }));
  $('#btn-replay').addEventListener('click', () => stage.lgReplay());

  $('#btn-copy-prompt').addEventListener('click', () => copy(agentPrompt(state, baseState), 'agent prompt'));
  $('#btn-copy-link').addEventListener('click', () => copy(`${location.origin}${location.pathname}${encode(state)}`, 'link'));
  $('#btn-copy-html').addEventListener('click', async () => {
    let html;
    try {
      templateText ??= await (await fetch('template.html')).text();
      html = exportHtml(templateText, defaults, state, CARDS[state.c]);
    } catch (err) {
      templateText = undefined;
      console.error(err);
      say("Couldn't build the HTML. Reload the page and try again.");
      return;
    }
    await copy(html, 'HTML');
  });

  addEventListener('hashchange', () => {
    if (location.hash === encode(state)) return;
    state = decode(location.hash, baseState, CARD_IDS);
    render({ replay: true, persist: false });
  });
  new ResizeObserver(fitFrame).observe(frame);
  render({ persist: false });
}
