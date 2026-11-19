export interface GeneratedTitleResult {
  title: string;
  numericPrefix: number | null;
  displayIndex: string;
  originalName: string;
}

const MINOR_WORDS = new Set([
  'a',
  'an',
  'and',
  'as',
  'at',
  'but',
  'by',
  'for',
  'from',
  'in',
  'into',
  'nor',
  'of',
  'on',
  'onto',
  'or',
  'per',
  'the',
  'to',
  'up',
  'via',
  'vs',
  'with',
]);

// Canonical technical brand & acronym casings
const SPECIAL_TERMS: Record<string, string> = {
  ai: 'AI',
  api: 'API',
  apis: 'APIs',
  ast: 'AST',
  aws: 'AWS',
  cdn: 'CDN',
  ci: 'CI',
  'ci/cd': 'CI/CD',
  cli: 'CLI',
  cms: 'CMS',
  cpu: 'CPU',
  crud: 'CRUD',
  css: 'CSS',
  css3: 'CSS3',
  csv: 'CSV',
  db: 'DB',
  dns: 'DNS',
  dom: 'DOM',
  dto: 'DTO',
  e2e: 'E2E',
  es6: 'ES6',
  esm: 'ESM',
  figma: 'Figma',
  gcp: 'GCP',
  git: 'Git',
  github: 'GitHub',
  gitlab: 'GitLab',
  gpu: 'GPU',
  graphql: 'GraphQL',
  grpc: 'gRPC',
  gui: 'GUI',
  html: 'HTML',
  html5: 'HTML5',
  http: 'HTTP',
  https: 'HTTPS',
  ide: 'IDE',
  ios: 'iOS',
  ip: 'IP',
  ipc: 'IPC',
  javascript: 'JavaScript',
  js: 'JS',
  json: 'JSON',
  jsx: 'JSX',
  jwt: 'JWT',
  k8s: 'K8s',
  llm: 'LLM',
  llms: 'LLMs',
  lms: 'LMS',
  macos: 'macOS',
  mcp: 'MCP',
  mdx: 'MDX',
  ml: 'ML',
  mongodb: 'MongoDB',
  mvc: 'MVC',
  mysql: 'MySQL',
  nextjs: 'Next.js',
  'next.js': 'Next.js',
  nodejs: 'Node.js',
  'node.js': 'Node.js',
  nosql: 'NoSQL',
  npm: 'npm',
  nuxtjs: 'Nuxt.js',
  oauth: 'OAuth',
  oauth2: 'OAuth2',
  oop: 'OOP',
  orm: 'ORM',
  os: 'OS',
  pdf: 'PDF',
  php: 'PHP',
  png: 'PNG',
  pnpm: 'pnpm',
  postgresql: 'PostgreSQL',
  pwa: 'PWA',
  qa: 'QA',
  rag: 'RAG',
  react: 'React',
  reactjs: 'React',
  redis: 'Redis',
  regex: 'RegEx',
  rest: 'REST',
  restful: 'RESTful',
  rgb: 'RGB',
  rpc: 'RPC',
  rust: 'Rust',
  saas: 'SaaS',
  sass: 'Sass',
  scss: 'SCSS',
  sdk: 'SDK',
  seo: 'SEO',
  spa: 'SPA',
  sql: 'SQL',
  sqlite: 'SQLite',
  ssh: 'SSH',
  ssl: 'SSL',
  ssr: 'SSR',
  svg: 'SVG',
  swiftui: 'SwiftUI',
  tailwindcss: 'Tailwind CSS',
  tcp: 'TCP',
  tdd: 'TDD',
  tls: 'TLS',
  ts: 'TS',
  tsx: 'TSX',
  typescript: 'TypeScript',
  udp: 'UDP',
  ui: 'UI',
  'ui/ux': 'UI/UX',
  uikit: 'UIKit',
  uri: 'URI',
  url: 'URL',
  urls: 'URLs',
  utf8: 'UTF-8',
  ux: 'UX',
  vite: 'Vite',
  vm: 'VM',
  vscode: 'VS Code',
  vuejs: 'Vue.js',
  'vue.js': 'Vue.js',
  wasm: 'WASM',
  webassembly: 'WebAssembly',
  webgl: 'WebGL',
  webpack: 'Webpack',
  websocket: 'WebSocket',
  websockets: 'WebSockets',
  wordpress: 'WordPress',
  xcode: 'Xcode',
  xml: 'XML',
  yaml: 'YAML',
  yml: 'YAML',
  '2d': '2D',
  '3d': '3D',
};

const VIDEO_EXT_RE = /\.(mp4|m4v|mkv|mov|webm|avi|wmv|flv|ogv|mpeg|mpg|ts)$/i;

// Common resolution / encoder / ripper / course-site noise tags
const BRACKET_NOISE_RE =
  /[\[\(]\s*(?:\d{3,4}p|4k|8k|hd|fhd|uhd|hdr|x264|x265|h\.?264|h\.?265|hevc|aac|web-?dl|webrip|bluray|dvdrip|remastered|subbed|english|eng|tutflix|freecoursesite|getfreecourses|downloadly|courseclub|udemy|coursera|pluralsight|egghead|frontendmasters|fireship)[^\]\)]*[\]\)]/gi;

const INLINE_NOISE_RE =
  /(?:^|[\s._-])(?:\d{3,4}p|4k|8k|x264|x265|h\.?264|h\.?265|hevc|web-?dl|webrip|bluray|aac\d*(?:\.\d)?|10bit)(?=$|[\s._-])/gi;

// Trailing YouTube / Vimeo / hash IDs like _[dQw4w9WgXcQ] or -[aB3_dE5fG7h] or _dQw4w9WgXcQ
// Only strip unbracketed 11-char suffix when it contains a digit (so English words like _Masterclass are untouched)
const TRAILING_ID_BRACKET_RE = /\s*[\[\(][A-Za-z0-9_-]{8,16}[\]\)]\s*$/;
const TRAILING_YT_UNDERSCORE_RE = /_(?=[A-Za-z0-9-]*\d)[A-Za-z0-9-]{11}$/;

/**
 * Strip file extension for video files
 */
export function stripVideoExtension(fileName: string): string {
  return fileName.replace(VIDEO_EXT_RE, '');
}

/**
 * Extract leading numeric/episode/lesson prefix if present.
 */
function extractLeadingPrefix(input: string): {
  numericPrefix: number | null;
  remainder: string;
} {
  const trimmed = input.trim();

  // Pattern 0: Purely numeric filename like "05" -> numericPrefix 5, empty remainder
  const pureNumMatch = trimmed.match(/^0*(\d{1,4})$/);
  if (pureNumMatch) {
    return {
      numericPrefix: parseInt(pureNumMatch[1], 10),
      remainder: '',
    };
  }

  // Pattern 1: S01E05 / s1e03
  const seMatch = trimmed.match(/^s\d{1,2}e(\d{1,4})(?:[\s._:\-–—]+(.*))?$/i);
  if (seMatch) {
    return {
      numericPrefix: parseInt(seMatch[1], 10),
      remainder: (seMatch[2] || '').trim(),
    };
  }

  // Pattern 2: "Lesson 04 - ...", "Module 01 - ...", "Chapter 3: ...", "Section 02_...", "Part 2 - ...", "Day 5 - ...", "Lecture 12 - ...", "Ep 4 - ...", "Ch 02 -"
  const keywordMatch = trimmed.match(
    /^(?:lesson|lecture|module|section|chapter|part|day|week|unit|video|episode|ep|ch|mod|sec)\.?\s*0*(\d{1,4})(?:[\s._:\-–—]+(.*))?$/i,
  );
  if (keywordMatch && keywordMatch[2] && keywordMatch[2].trim().length > 0) {
    return {
      numericPrefix: parseInt(keywordMatch[1], 10),
      remainder: keywordMatch[2].trim(),
    };
  }

  // Pattern 3: Bracketed leading index: "[01] Title" or "(04) Title"
  const bracketMatch = trimmed.match(/^[\[\(]\s*0*(\d{1,4})\s*[\]\)]\s*[\-–—:._]?\s*(.+)$/);
  if (bracketMatch) {
    return {
      numericPrefix: parseInt(bracketMatch[1], 10),
      remainder: bracketMatch[2].trim(),
    };
  }

  // Pattern 4: Hierarchical numeric prefix like "1.2.3 - Title" or "01.02_Title"
  const hierarchicalMatch = trimmed.match(/^0*(\d{1,3})(?:\.\d{1,3})+(?:[\s._:\-–—]+(.+))$/);
  if (hierarchicalMatch) {
    return {
      numericPrefix: parseInt(hierarchicalMatch[1], 10),
      remainder: hierarchicalMatch[2].trim(),
    };
  }

  // Pattern 5: Plain numeric prefix "01 - Title", "01. Title", "01_Title", "1) Title", "003 Title"
  // Avoid stripping a 4-digit year like "2026 Roadmap"
  const numMatch = trimmed.match(/^0*(\d{1,3})\s*(?:[\)\]\.\-–—:_]+|\s+)\s*(.+)$/);
  if (numMatch) {
    const num = parseInt(numMatch[1], 10);
    const rest = numMatch[2].trim();
    // Don't treat "3D Modeling" or "2D Game" as numbered lesson 3 / 2
    if (!/^[dD]\b/.test(rest) && rest.length > 0) {
      return {
        numericPrefix: num,
        remainder: rest,
      };
    }
  }

  return { numericPrefix: null, remainder: trimmed };
}

/**
 * Split camelCase / PascalCase tokens while keeping React hooks (useEffect, useState)
 * and known brand tokens (SwiftUI, GraphQL, macOS, JavaScript, TypeScript, iOS, GitHub, etc.) intact.
 */
function splitCamelToken(token: string): string {
  const lower = token.toLowerCase();
  if (SPECIAL_TERMS[lower]) return token;
  // Preserve React hooks like useEffect, useCallback, useRef, useMemo, useReducer, useContext
  if (/^use[A-Z][a-zA-Z0-9]*$/.test(token)) return token;
  // Preserve macOS / iOS / iPadOS / watchOS
  if (/^(mac|i|iPad|watch|tv)OS$/i.test(token)) return token;
  // Preserve dot-notated frameworks like Next.js, Node.js, Vue.js
  if (/^[A-Za-z]+\.js$/i.test(token)) return token;

  // Split camelCase boundaries: "dockerComposeBasics" -> "docker Compose Basics", "HTMLParser" -> "HTML Parser"
  return token
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
}

function formatWord(word: string, index: number, total: number, afterColonOrDash: boolean): string {
  if (!word) return word;

  // Preserve leading/trailing punctuation around word
  const match = word.match(/^([("'“‘`]*)(.*?)([)"'”’`,.?!:;]*)$/);
  if (!match) return word;
  const [, lead, core, trail] = match;
  if (!core) return word;

  const lower = core.toLowerCase();

  // Preserve React hooks
  if (/^use[A-Z][a-zA-Z0-9]*$/.test(core)) {
    return `${lead}${core}${trail}`;
  }

  // Exact special term match (e.g., api -> API, next.js -> Next.js, ci/cd -> CI/CD)
  if (SPECIAL_TERMS[lower]) {
    return `${lead}${SPECIAL_TERMS[lower]}${trail}`;
  }

  // Slash-combined words like "ci/cd", "async/await", "ui/ux"
  if (core.includes('/') && !core.startsWith('/')) {
    const parts = core.split('/').map((part, i) =>
      formatWord(part, index + i, total, i === 0 ? afterColonOrDash : true),
    );
    return `${lead}${parts.join('/')}${trail}`;
  }

  // Hyphenated compound words like "real-time", "server-side", "ci-cd"
  if (core.includes('-') && core.length > 1) {
    if (lower === 'ci-cd') return `${lead}CI/CD${trail}`;
    const parts = core
      .split('-')
      .map((part, i) => formatWord(part, index + i, total, i === 0 ? afterColonOrDash : true));
    return `${lead}${parts.join('-')}${trail}`;
  }

  // Keep existing all-caps acronyms (2-5 chars, e.g. SOLID, ACID, CORS, CSRF, XSS, SSR)
  if (/^[A-Z0-9]{2,5}$/.test(core) && /[A-Z]/.test(core)) {
    return `${lead}${core}${trail}`;
  }

  const isFirstOrLast = index === 0 || index === total - 1 || afterColonOrDash;
  if (!isFirstOrLast && MINOR_WORDS.has(lower)) {
    return `${lead}${lower}${trail}`;
  }

  return `${lead}${lower.charAt(0).toUpperCase()}${lower.slice(1)}${trail}`;
}

/**
 * Clean a raw video filename or folder name into a crisp, LMS-ready title.
 */
export function generateTitleFromName(
  rawName: string,
  fallbackIndex = 1,
  options: { isFolder?: boolean } = {},
): GeneratedTitleResult {
  const base = options.isFolder ? rawName.trim() : stripVideoExtension(rawName.trim());

  // Remove bracketed noise tags and trailing video IDs
  let cleaned = base
    .replace(BRACKET_NOISE_RE, ' ')
    .replace(TRAILING_ID_BRACKET_RE, '')
    .replace(TRAILING_YT_UNDERSCORE_RE, '')
    .trim();

  // Extract leading numbering (sometimes repeated like "01 - Module 01 - Getting Started")
  let firstPrefix = extractLeadingPrefix(cleaned);
  let numericPrefix = firstPrefix.numericPrefix;
  cleaned = firstPrefix.remainder;

  // Check for double prefix like "01 - Lesson 01 - Intro" or "02 - Module 2 - Hooks"
  const secondPrefix = extractLeadingPrefix(cleaned);
  if (numericPrefix !== null && secondPrefix.numericPrefix !== null && secondPrefix.remainder) {
    cleaned = secondPrefix.remainder;
  }

  // Remove inline quality/codec tags
  cleaned = cleaned.replace(INLINE_NOISE_RE, ' ');

  // Normalize separators:
  // Protect known dot-tokens (Node.js, Next.js, Vue.js, Nuxt.js, ASP.NET, v2.0, 3.5)
  const protectedMap: string[] = [];
  const protect = (m: string) => {
    const key = `\uE000P${protectedMap.length}\uE000`;
    protectedMap.push(m);
    return key;
  };

  cleaned = cleaned
    .replace(/\b(?:next|node|vue|nuxt|react|express|nest|three|chart|d3|p5|alpine)\.js\b/gi, protect)
    .replace(/\bC\+\+|\bC#|\bF#|\.NET\b|\bASP\.NET\b/gi, protect)
    .replace(/\bv?\d+\.\d+(?:\.\d+)?\b/gi, protect)
    .replace(/\bCI[\s_-]?CD\b/gi, 'CI/CD')
    .replace(/\bUI[\s_-]?UX\b/gi, 'UI/UX');

  // Replace underscores and stray dots with spaces
  cleaned = cleaned.replace(/_/g, ' ').replace(/\./g, ' ');

  // Convert spaced hyphens/dashes into clean separator " — " or keep tight hyphens
  cleaned = cleaned
    .replace(/\s+[-–—]\s+/g, ' — ')
    .replace(/(?<=\w)-(?=\w)/g, (match, offset, full) => {
      // Keep common hyphenated modifiers, split obvious slug filenames (many hyphens and no spaces)
      const hasSpaces = /\s/.test(full);
      if (!hasSpaces) return ' ';
      return match;
    });

  // Restore protected tokens
  cleaned = cleaned.replace(/\uE000P(\d+)\uE000/g, (_, i) => protectedMap[Number(i)] || '');

  // Split camelCase / PascalCase words
  cleaned = cleaned
    .split(/\s+/)
    .map((tok) => splitCamelToken(tok))
    .join(' ');

  // Clean stray leading/trailing separators and extra spaces
  cleaned = cleaned
    .replace(/^[\s\-–—:|]+|[\s\-–—:|]+$/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  // Fallback if stripping removed everything (e.g. "01.mp4" or "Lesson 03.mp4")
  if (!cleaned) {
    const idxNum = numericPrefix ?? fallbackIndex;
    cleaned = options.isFolder ? `Module ${idxNum}` : `Lesson ${idxNum}`;
  } else {
    const words = cleaned.split(' ');
    let afterBreak = false;
    const formatted = words.map((w, i) => {
      if (w === '—' || w === '-' || w === ':' || w === '&' || w === '|') {
        afterBreak = w !== '&';
        return w;
      }
      const out = formatWord(w, i, words.length, afterBreak);
      afterBreak = /[:?!—]$/.test(w);
      return out;
    });
    cleaned = formatted.join(' ');
  }

  const indexNum = numericPrefix ?? fallbackIndex;
  const displayIndex = String(indexNum).padStart(2, '0');

  return {
    title: cleaned,
    numericPrefix,
    displayIndex,
    originalName: rawName,
  };
}

/**
 * Natural alphanumeric comparator so "2 - Foo" always comes before "10 - Bar".
 */
const naturalCollator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: 'base',
});

export function compareNaturalNames(a: string, b: string): number {
  const pa = extractLeadingPrefix(stripVideoExtension(a));
  const pb = extractLeadingPrefix(stripVideoExtension(b));

  if (pa.numericPrefix !== null && pb.numericPrefix !== null && pa.numericPrefix !== pb.numericPrefix) {
    return pa.numericPrefix - pb.numericPrefix;
  }
  if (pa.numericPrefix !== null && pb.numericPrefix === null) return -1;
  if (pa.numericPrefix === null && pb.numericPrefix !== null) return 1;

  return naturalCollator.compare(a, b);
}
