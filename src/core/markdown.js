import { escapeHtml } from './html.js';
import { safeUrl } from './url.js';

/**
 * Renders the Markdown subset that GitHub release notes use, for the release
 * notes WhatsNewWidget shows.
 *
 * The output goes straight into innerHTML, so nothing from the source is ever
 * emitted as markup: text is escaped and every URL goes through `safeUrl()`.
 * The notes are written into the build by CI, not by this project.
 */

// Written out per level, and per element below, because Tailwind only emits
// classes it finds verbatim - a `text-${size}` template would produce nothing.
const HEADINGS = {
  1: 'text-2xl font-bold mt-6 mb-3 first:mt-0',
  2: 'text-xl font-bold mt-6 mb-3 first:mt-0',
  3: 'text-lg font-semibold mt-5 mb-2 first:mt-0',
  4: 'font-semibold mt-4 mb-2 first:mt-0',
  5: 'font-semibold mt-4 mb-2 first:mt-0',
  6: 'font-semibold mt-4 mb-2 first:mt-0',
};

const PARAGRAPH = 'mb-4 leading-relaxed';
const LIST = 'list-disc list-outside mb-4 ml-6 space-y-1';
const ORDERED = 'list-decimal list-outside mb-4 ml-6 space-y-1';
const QUOTE = 'border-l-4 border-base-300 pl-3 mb-4 opacity-80';
const BLOCK = 'bg-base-200 rounded-lg p-3 mb-4 overflow-x-auto text-sm';
const CODE = 'bg-base-200 rounded px-1 py-0.5 text-sm';
const LINK = 'link link-primary';
const IMAGE = 'rounded-lg max-w-full my-2';
const RULE = 'my-6 border-base-300';

const FENCE = /^\s*```/;
const HEADING = /^(#{1,6})\s+(.*)$/;
const HORIZONTAL = /^\s*(?:[-*_]\s*){3,}$/;
const BULLET = /^\s*[-*+]\s+(.*)$/;
const NUMBERED = /^\s*\d+[.)]\s+(.*)$/;
const QUOTED = /^\s*>\s?(.*)$/;

const TARGET = '(?:[^()\\s]|\\([^()\\s]*\\))+';

// Emphasis marked with underscores needs the word boundaries GitHub requires,
// or an identifier such as MAX_ASSET_BYTES renders as italics.
const INLINE = new RegExp(
  [
    '`(?<code>[^`\\n]+)`',
    // A target may hold balanced parens - Wikipedia links do, and so does the
    // javascript: URL that has to be recognised before it can be turned down.
    `!\\[(?<alt>[^\\]]*)\\]\\((?<src>${TARGET})\\)`,
    `\\[(?<text>[^\\]]*)\\]\\((?<href>${TARGET})\\)`,
    '\\*\\*(?<strong>[^*]+)\\*\\*',
    '(?<![\\w_])__(?<strongScore>[^_]+)__(?![\\w_])',
    '\\*(?<em>[^*\\n]+)\\*',
    '(?<![\\w_])_(?<emScore>[^_\\n]+)_(?![\\w_])',
    // Stops short of trailing punctuation, so a URL ending a sentence keeps it.
    '(?<bare>https?://[^\\s<>()\\[\\]]*[^\\s<>()\\[\\].,;:!?\'"])',
  ].join('|'),
  'g',
);

export function renderMarkdown(source) {
  // Comments carry the release stamp WhatsNewWidget reads, and release bodies
  // written on GitHub tend to have a few of their own.
  const lines = String(source)
    .replace(/\r\n?/g, '\n')
    .replace(/<!--[\s\S]*?-->/g, '')
    .split('\n');
  const html = [];
  let paragraph = [];

  const flush = () => {
    if (paragraph.length > 0) {
      html.push(`<p class="${PARAGRAPH}">${renderInline(paragraph.join(' '))}</p>`);
    }
    paragraph = [];
  };

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];

    if (FENCE.test(line)) {
      flush();
      const body = [];
      while (++index < lines.length && !FENCE.test(lines[index])) body.push(lines[index]);
      html.push(`<pre class="${BLOCK}"><code>${escapeHtml(body.join('\n'))}</code></pre>`);
      continue;
    }

    const heading = HEADING.exec(line);
    if (heading) {
      flush();
      const level = heading[1].length;
      html.push(`<h${level} class="${HEADINGS[level]}">${renderInline(heading[2])}</h${level}>`);
      continue;
    }

    // Before the list rules, which `- - -` would otherwise match.
    if (HORIZONTAL.test(line)) {
      flush();
      html.push(`<hr class="${RULE}">`);
      continue;
    }

    const bullets = BULLET.test(line);
    const pattern = bullets ? BULLET : NUMBERED.test(line) ? NUMBERED : null;
    if (pattern) {
      flush();
      const items = run(lines, index, pattern);
      index += items.length - 1;
      const body = items.map((item) => `<li>${renderInline(item)}</li>`).join('');
      html.push(
        bullets
          ? `<ul class="${LIST}">${body}</ul>`
          : `<ol class="${ORDERED}">${body}</ol>`,
      );
      continue;
    }

    if (QUOTED.test(line)) {
      flush();
      const quoted = run(lines, index, QUOTED);
      index += quoted.length - 1;
      html.push(`<blockquote class="${QUOTE}">${renderInline(quoted.join(' '))}</blockquote>`);
      continue;
    }

    if (line.trim()) paragraph.push(line.trim());
    else flush();
  }

  flush();
  return html.join('');
}

/** The captured text of the run of lines from `index` that `pattern` matches. */
function run(lines, index, pattern) {
  const captured = [];
  for (let match; index < lines.length && (match = pattern.exec(lines[index])); index++) {
    captured.push(match[1]);
  }
  return captured;
}

function renderInline(text) {
  let html = '';
  let index = 0;
  for (const match of text.matchAll(INLINE)) {
    html += escapeHtml(text.slice(index, match.index));
    html += renderToken(match.groups);
    index = match.index + match[0].length;
  }
  return html + escapeHtml(text.slice(index));
}

function renderToken(groups) {
  const { code, alt, src, text, href, strong, strongScore, em, emScore, bare } = groups;
  if (code !== undefined) return `<code class="${CODE}">${escapeHtml(code)}</code>`;
  if (src !== undefined) return image(alt, src);
  if (href !== undefined) return anchor(renderInline(text), href);
  const bold = strong ?? strongScore;
  if (bold !== undefined) return `<strong>${renderInline(bold)}</strong>`;
  const italic = em ?? emScore;
  if (italic !== undefined) return `<em>${renderInline(italic)}</em>`;
  return anchor(escapeHtml(bare), bare);
}

/** `inner` is already-rendered HTML; an unusable target degrades to plain text. */
function anchor(inner, target) {
  const url = safeUrl(target);
  if (!url) return inner;
  const attributes = `href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer"`;
  return `<a ${attributes} class="${LINK}">${inner}</a>`;
}

function image(alt, target) {
  const url = safeUrl(target);
  if (!url) return escapeHtml(alt);
  const attributes = `src="${escapeHtml(url)}" alt="${escapeHtml(alt)}" loading="lazy"`;
  return `<img ${attributes} class="${IMAGE}">`;
}
