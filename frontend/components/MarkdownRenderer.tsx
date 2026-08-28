import React, { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import DOMPurify from 'dompurify';

/**
 * Returns 'rtl' only when RTL letters are the majority of directional text.
 *
 * We count Hebrew/Arabic code points as RTL and Latin letters as LTR,
 * while ignoring punctuation, numbers, and whitespace. This avoids flipping
 * the whole document to RTL because of just a few RTL tokens.
 */
const getContentDirection = (text: string): 'rtl' | 'ltr' => {
  const rtlCount = (text.match(/[\u0590-\u05FF\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB1D-\uFDFD\uFE70-\uFEFC]/g) ?? []).length;
  const ltrCount = (text.match(/[A-Za-z]/g) ?? []).length;
  return rtlCount > ltrCount ? 'rtl' : 'ltr';
};

/** Recursively extract plain text from React children (e.g. for heading IDs). */
export const childrenToText = (children: React.ReactNode): string => {
  if (typeof children === 'string') return children;
  if (typeof children === 'number') return String(children);
  if (Array.isArray(children)) return children.map(childrenToText).join('');
  if (React.isValidElement<{ children?: React.ReactNode }>(children) && children.props?.children) {
    return childrenToText(children.props.children);
  }
  return '';
};

/**
 * Convert heading text to a URL slug that matches the anchor format used in
 * markdown TOC links (e.g. "1. Registration & Authentication" → "registration--authentication").
 */
export const toHeadingId = (children: React.ReactNode): string =>
  childrenToText(children)
    .replace(/^\d+\.\s+/, '')  // strip leading ordinal prefix ("1. ")
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')  // remove non-word, non-space, non-hyphen chars
    .replace(/\s/g, '-');      // replace each space with a hyphen

/**
 * Parse CSS and extract structured data for visual rendering.
 * Handles color swatches, font families, type scale variables, CSS variable declarations,
 * and type style classes (with var() resolution support).
 */
function _parseCss(css: string): {
  colors: { name: string; value: string; color: string }[];
  fonts: { varName: string; family: string }[];
  typeScale: { varName: string; size: string; rawSize: number }[];
  typeStyles: { selector: string; props: {
    fontSize?: string; fontWeight?: string; lineHeight?: string;
    letterSpacing?: string; fontFamily?: string; color?: string;
    textTransform?: string; textDecoration?: string; transition?: string;
  } }[];
  /** All CSS custom properties for var() resolution */
  vars: Record<string, string>;
} {
  const colors: { name: string; value: string; color: string }[] = [];
  const fonts: { varName: string; family: string }[] = [];
  const typeScale: { varName: string; size: string; rawSize: number }[] = [];
  const typeStyles: { selector: string; props: {
    fontSize?: string; fontWeight?: string; lineHeight?: string;
    letterSpacing?: string; fontFamily?: string; color?: string;
    textTransform?: string; textDecoration?: string; transition?: string;
  } }[] = [];
  const vars: Record<string, string> = {};
  const rawLines: string[] = [];

  const lines = css.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('/*') || trimmed.startsWith('*/') || trimmed.startsWith('*')) continue;
    rawLines.push(trimmed);
  }

  // First pass: collect all CSS custom properties into `vars`
  for (const l of rawLines) {
    // Strip trailing /* ... */ inline comments before matching so $ anchor works
    const stripped = l.replace(/\s*\/\*.*?\*\/\s*$/, '').trim();
    const propMatch = stripped.match(/^(--[\w-]+)\s*:\s*([^;]+);?$/);
    if (propMatch) {
      vars[propMatch[1]] = propMatch[2].trim();
    }
  }

  for (const line of rawLines) {
    // Skip class blocks and selectors during var pass
    if (line.includes('{') || line.includes('}') || line.startsWith('.')) continue;
    // Strip trailing /* ... */ inline comments so $ anchors work correctly
    const stripped = line.replace(/\s*\/\*.*?\*\/\s*$/, '').trim();

    // HEX / RGB / HSL / CMYK color declarations
    const hexMatch = stripped.match(/^(--[\w-]+)\s*:\s*(#[0-9a-fA-F]{3,8})\s*;?$/);
    if (hexMatch) {
      colors.push({ name: hexMatch[1], value: hexMatch[2], color: hexMatch[2] });
      continue;
    }

    const rgbMatch = stripped.match(/^(--[\w-]+)\s*:\s*rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*[\d.]+)?\)\s*;?$/i);
    if (rgbMatch) {
      const r = rgbMatch[2], g = rgbMatch[3], b = rgbMatch[4];
      colors.push({ name: rgbMatch[1], value: `rgba(${r}, ${g}, ${b})`, color: `rgba(${r},${g},${b},1)` });
      continue;
    }

    const hslMatch = stripped.match(/^(--[\w-]+)\s*:\s*hsl\s*\(\s*([\d.]+)\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%\s*\)\s*;?$/i);
    if (hslMatch) {
      const h = hslMatch[2], s = hslMatch[3], l = hslMatch[4];
      colors.push({ name: hslMatch[1], value: `hsl(${h}, ${s}%, ${l}%)`, color: `hsl(${h},${s}%,${l}%)` });
      continue;
    }

    const cmykMatch = stripped.match(/^(--[\w-]+)\s*:\s*(\d+%)\s*,\s*(\d+%)\s*,\s*(\d+%)\s*,\s*(\d+%)\s*;?$/);
    if (cmykMatch) {
      colors.push({ name: cmykMatch[1], value: `cmyk(${cmykMatch[2]}, ${cmykMatch[3]}, ${cmykMatch[4]}, ${cmykMatch[5]})`, color: '#888888' });
      continue;
    }

    // Named color values (e.g. --color-text-primary: white;)
    const namedColorMatch = stripped.match(/^(--[\w-]+)\s*:\s*(white|black|transparent|currentcolor)\s*;?$/i);
    if (namedColorMatch) {
      colors.push({ name: namedColorMatch[1], value: namedColorMatch[2], color: namedColorMatch[2] });
      continue;
    }

    // Font family variables
    const fontMatch = stripped.match(/^(--[\w-]*(?:font|family)[^\s]*)\s*:\s*['"]?([^'";]+)['"]?\s*;?$/i);
    if (fontMatch) {
      fonts.push({ varName: fontMatch[1], family: fontMatch[2].trim() });
      continue;
    }

    // Scale / spacing variables (numeric rem/em/px/%)
    const scaleMatch = stripped.match(/^(--[\w-]+)\s*:\s*([\d.]+(?:rem|em|px|%)?)\s*;?$/);
    if (scaleMatch) {
      const name = scaleMatch[1];
      const rawVal = scaleMatch[2];
      if (
        name.startsWith('--text-') || name.startsWith('--leading-') ||
        name.startsWith('--tracking-') || name.startsWith('--font-weight-')
      ) {
        const num = parseFloat(rawVal);
        typeScale.push({ varName: name, size: rawVal, rawSize: isNaN(num) ? 0 : num });
      }
      continue;
    }
  }

  // Second pass: extract CSS class blocks
  const blockRe = /\.([\w-]+)\s*\{([^}]+)\}/g;
  let blockMatch: RegExpExecArray | null;
  while ((blockMatch = blockRe.exec(css)) !== null) {
    const selector = blockMatch[1].replace(/:hover|:focus|:active|:before|:after/g, '').trim();
    const block = blockMatch[2];
    const props: {
      fontSize?: string; fontWeight?: string; lineHeight?: string;
      letterSpacing?: string; fontFamily?: string; color?: string;
      textTransform?: string; textDecoration?: string; transition?: string;
    } = {};

    const fsMatch = block.match(/font-size\s*:\s*([^;]+);/);
    if (fsMatch) props.fontSize = fsMatch[1].trim();

    const fwMatch = block.match(/font-weight\s*:\s*([^;]+);/);
    if (fwMatch) props.fontWeight = fwMatch[1].trim();

    const lhMatch = block.match(/line-height\s*:\s*([^;]+);/);
    if (lhMatch) props.lineHeight = lhMatch[1].trim();

    const lsMatch = block.match(/letter-spacing\s*:\s*([^;]+);/);
    if (lsMatch) props.letterSpacing = lsMatch[1].trim();

    const ffMatch = block.match(/font-family\s*:\s*([^;]+);/);
    if (ffMatch) props.fontFamily = ffMatch[1].trim();

    const colorMatch = block.match(/color\s*:\s*([^;]+);/);
    if (colorMatch) props.color = colorMatch[1].trim();

    const ttMatch = block.match(/text-transform\s*:\s*([^;]+);/);
    if (ttMatch) props.textTransform = ttMatch[1].trim();

    const tdMatch = block.match(/text-decoration\s*:\s*([^;]+);/);
    if (tdMatch) props.textDecoration = tdMatch[1].trim();

    const trMatch = block.match(/transition\s*:\s*([^;]+);/);
    if (trMatch) props.transition = trMatch[1].trim();

    if (Object.keys(props).length > 0) {
      typeStyles.push({ selector, props });
    }
  }

  return { colors, fonts, typeScale, typeStyles, vars };
}

/** Resolve a `var(--name)` reference from the vars map, with a fallback. */
function _resolveVar(val: string, vars: Record<string, string>, fallback: string): string {
  const m = val.match(/^var\(--([^)]+)\)$/);
  if (!m) return val;
  return vars[m[1]] ?? fallback;
}

interface MarkdownRendererProps {
  content: string;
  lightMode: boolean;
  /**
   * - `"inline"` (default): scaled-down headings without anchor IDs, suitable
   *   for embedded content where headings must stay subordinate to page titles.
   * - `"page"`: full-size headings with anchor IDs, suitable for standalone
   *   document pages (EULA, Privacy Policy, User Manual).
   */
  variant?: 'inline' | 'page';
  /** When true, uses `text-sm` for body text — useful for print contexts. */
  compact?: boolean;
}

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({
  content,
  lightMode,
  variant = 'inline',
  compact = false,
}) => {
  const dir = useMemo(() => getContentDirection(content), [content]);
  const mdComponents = useMemo<React.ComponentProps<typeof ReactMarkdown>['components']>(() => {
    const textBase = lightMode ? 'text-slate-700' : 'text-slate-300';
    const textStrong = lightMode ? 'text-slate-900' : 'text-white';
    const isPage = variant === 'page';

    return {
      h1: ({ children }) => isPage
        ? <h1 dir={dir} id={toHeadingId(children)} className={`scroll-mt-20 text-3xl font-bold mt-6 mb-6 ${textStrong}`}>{children}</h1>
        : <div dir={dir} className={`text-base font-bold mt-4 mb-2 ${textStrong}`}>{children}</div>,
      h2: ({ children }) => isPage
        ? <h2 dir={dir} id={toHeadingId(children)} className={`scroll-mt-20 text-xl font-bold mt-10 mb-4 pb-2 border-b ${lightMode ? `${textStrong} border-slate-200` : `${textStrong} border-white/10`}`}>{children}</h2>
        : <div dir={dir} className={`text-sm font-semibold mt-3 mb-1 ${textStrong}`}>{children}</div>,
      h3: ({ children }) => isPage
        ? <h3 dir={dir} id={toHeadingId(children)} className={`scroll-mt-20 text-base font-semibold mt-6 mb-2 ${lightMode ? 'text-slate-700' : 'text-slate-200'}`}>{children}</h3>
        : <div dir={dir} className={`text-xs font-semibold uppercase tracking-wide mt-3 mb-1 ${lightMode ? 'text-slate-500' : 'text-slate-400'}`}>{children}</div>,
      h4: ({ children }) => (
        <div dir={dir} className={`text-xs font-semibold mt-2 mb-1 ${lightMode ? 'text-slate-500' : 'text-slate-400'}`}>{children}</div>
      ),
      h5: ({ children }) => (
        <h5 dir={dir} className={`text-xs font-medium mt-2 mb-1 ${lightMode ? 'text-slate-500' : 'text-slate-400'}`}>{children}</h5>
      ),
      h6: ({ children }) => (
        <h6 dir={dir} className={`text-xs font-medium mt-2 mb-1 ${lightMode ? 'text-slate-500' : 'text-slate-400'}`}>{children}</h6>
      ),
      p: ({ children }) => (
        <p dir={dir} className={`leading-relaxed ${isPage ? 'mb-4' : 'mb-3'} ${compact ? 'text-sm' : 'text-base'} ${textBase}`}>{children}</p>
      ),
      ul: ({ children }) => (
        <ul dir={dir} className={`list-disc ${isPage ? 'ps-6' : 'ps-5'} space-y-1 ${isPage ? 'mb-4' : 'mb-3'} ${compact ? 'text-sm' : 'text-base'} ${textBase}`}>{children}</ul>
      ),
      ol: ({ children }) => (
        <ol dir={dir} className={`list-decimal ${isPage ? 'ps-6' : 'ps-5'} space-y-1 ${isPage ? 'mb-4' : 'mb-3'} ${compact ? 'text-sm' : 'text-base'} ${textBase}`}>{children}</ol>
      ),
      li: ({ children }) => (
        <li dir={dir} className="leading-relaxed">{children}</li>
      ),
      strong: ({ children }) => (
        <strong className={`font-semibold ${textStrong}`}>{children}</strong>
      ),
      em: ({ children }) => (
        <em className={`italic ${lightMode ? 'text-slate-500' : 'text-slate-400'}`}>{children}</em>
      ),
      a: ({ href, children, ...props }) => (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="text-blue-500 hover:underline break-all"
          {...props}
        >
          {children}
        </a>
      ),
      hr: () => (
        <hr className={`${isPage ? 'my-8' : 'my-4'} ${lightMode ? 'border-slate-200' : 'border-white/10'}`} />
      ),
      blockquote: ({ children }) => (
        <blockquote dir={dir} className={`border-s-4 border-blue-500 ps-4 italic ${isPage ? 'my-4' : 'my-3'} ${lightMode ? 'text-slate-600' : 'text-slate-400'}`}>{children}</blockquote>
      ),
      table: ({ children }) => (
        <div className={`overflow-x-auto ${isPage ? 'my-6' : 'my-4'}`}>
          <table dir={dir} className={`w-full text-sm border-collapse ${textBase}`}>{children}</table>
        </div>
      ),
      thead: ({ children }) => (
        <thead className={`border-b ${lightMode ? 'border-slate-300' : 'border-white/20'}`}>{children}</thead>
      ),
      th: ({ children }) => (
        <th dir={dir} className={`text-start font-semibold wrap-normal ${isPage ? 'py-2 pe-6 text-sm' : 'py-1.5 pe-4 text-xs'} ${textStrong}`}>{children}</th>
      ),
      td: ({ children }) => (
        <td dir={dir} className={`wrap-normal ${isPage ? 'py-2 pe-6' : 'py-1.5 pe-4 text-xs'} border-b ${lightMode ? 'border-slate-100' : 'border-white/5'} ${textBase}`}>{children}</td>
      ),
      code: ({ children }) => (
        <code className={`px-1 py-0.5 rounded text-xs font-mono ${lightMode ? 'bg-slate-100 text-slate-800' : 'bg-slate-800 text-slate-200'}`}>{children}</code>
      ),
      pre: ({ children }) => {
        const raw = React.Children.toArray(children)
          .map(c => (React.isValidElement(c) ? String((c as React.ReactElement<{children?: React.ReactNode}>).props.children ?? '') : c))
          .join('');
        const trimmed = raw.trim();

        if (trimmed.startsWith('<svg') && trimmed.endsWith('</svg>')) {
          const sanitized = DOMPurify.sanitize(trimmed, { USE_PROFILES: { svg: true, svgFilters: true } });
          return (
            <div
              className={`my-3 flex justify-center ${lightMode ? 'bg-slate-50' : 'bg-slate-800/50'} rounded-lg p-4 overflow-x-auto`}
              dangerouslySetInnerHTML={{ __html: sanitized }}
            />
          );
        }

        if (trimmed.startsWith('/*') || trimmed.includes('--') || trimmed.includes('font')) {
          const { colors, fonts, typeScale, typeStyles, vars } = _parseCss(trimmed);
          const hasColors = colors.length > 0;
          const hasFonts = fonts.length > 0;
          const hasScale = typeScale.length > 0;
          const hasStyles = typeStyles.length > 0;

          if (!hasColors && !hasFonts && !hasScale && !hasStyles) {
            return (
              <pre className={`p-3 rounded-lg ${isPage ? 'my-4' : 'my-3'} overflow-x-auto text-xs font-mono ${lightMode ? 'bg-slate-100 text-slate-800' : 'bg-slate-800 text-slate-200'}`}>{children}</pre>
            );
          }

          // Build a reverse lookup: font var name → actual font family string
          const fontFamilyMap: Record<string, string> = {};
          for (const f of fonts) {
            const clean = f.family.replace(/^['"]|['"]$/g, '').split(',')[0].trim();
            fontFamilyMap[f.varName] = clean;
            // Also store without prefix dash
            fontFamilyMap[f.varName.replace(/^--/, '')] = clean;
          }

          // Resolve a CSS var value, e.g. "var(--text-h1)" → "1.5rem"
          const resolve = (val: string | undefined): string | undefined =>
            val ? _resolveVar(val, vars, val) : undefined;

          return (
            <div className={`my-3 rounded-lg overflow-hidden border ${lightMode ? 'border-slate-200 bg-slate-50' : 'border-slate-700 bg-slate-800/50'}`}>
              {hasFonts && (
                <div className="p-4 border-b border-inherit">
                  <div className={`text-[10px] font-bold uppercase tracking-widest mb-3 ${lightMode ? 'text-slate-400' : 'text-slate-500'}`}>Font Families</div>
                  <div className="grid gap-2">
                    {fonts.map((font, i) => {
                      const cleanFamily = font.family.replace(/,\s*$/, '').replace(/^['"]|['"]$/g, '').split(',')[0].trim();
                      return (
                        <div key={i} className="flex items-baseline gap-3">
                          <span
                            className="text-sm font-semibold truncate"
                            style={{ fontFamily: cleanFamily, color: lightMode ? '#1e293b' : '#e2e8f0' }}
                          >
                            {cleanFamily}
                          </span>
                          <span className={`text-xs font-mono truncate ${lightMode ? 'text-slate-400' : 'text-slate-500'}`}>{font.varName}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {hasScale && (
                <div className="p-4 border-b border-inherit">
                  <div className={`text-[10px] font-bold uppercase tracking-widest mb-3 ${lightMode ? 'text-slate-400' : 'text-slate-500'}`}>Type Scale</div>
                  <div className="space-y-2">
                    {[...typeScale]
                      .filter(s => s.varName.startsWith('--text-'))
                      .sort((a, b) => b.rawSize - a.rawSize)
                      .map((entry, i) => {
                        const headingFamily = resolve('--font-heading') || 'system-ui';
                        const cleanFamily = headingFamily.replace(/^['"]|['"]$/g, '').split(',')[0].trim();
                        return (
                          <div key={i} className="flex items-baseline gap-3">
                            <span
                              className="font-semibold text-slate-700 dark:text-slate-200"
                              style={{ fontFamily: cleanFamily, fontSize: entry.size }}
                            >
                              Aa
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className={`text-xs font-mono truncate ${lightMode ? 'text-slate-500' : 'text-slate-400'}`}>{entry.varName}</div>
                              <div className={`text-[10px] font-mono ${lightMode ? 'text-slate-300' : 'text-slate-500'}`}>{entry.size}</div>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}

              {hasStyles && (
                <div className="p-4 border-b border-inherit">
                  <div className={`text-[10px] font-bold uppercase tracking-widest mb-3 ${lightMode ? 'text-slate-400' : 'text-slate-500'}`}>Typography Styles</div>
                  <div className="space-y-3">
                    {typeStyles.map((style, i) => {
                      const sampleText = style.selector.includes('caption') || style.selector.includes('label')
                        ? 'The quick brown fox'
                        : style.selector.includes('display')
                        ? 'Brand Name'
                        : style.selector.includes('link')
                        ? 'Click here to learn more'
                        : style.selector.includes('button')
                        ? 'Get Started'
                        : 'The quick brown fox jumps over the lazy dog';

                      const resolvedSize = resolve(style.props.fontSize);
                      const resolvedWeight = resolve(style.props.fontWeight);
                      const resolvedLh = resolve(style.props.lineHeight);
                      const resolvedLs = resolve(style.props.letterSpacing);
                      const resolvedColor = resolve(style.props.color);
                      const resolvedFfRaw = resolve(style.props.fontFamily);
                      const resolvedFf = resolvedFfRaw
                        ? resolvedFfRaw.replace(/^['"]|['"]$/g, '').split(',')[0].trim()
                        : undefined;
                      const isVarColor = !resolvedColor ||
                        resolvedColor === style.props.color ||
                        resolvedColor.startsWith('var(');

                      return (
                        <div key={i} className="flex flex-col gap-1">
                          <span
                            className={`${lightMode ? 'text-slate-400' : 'text-slate-500'} text-[10px] font-mono`}
                          >.{style.selector}</span>
                          <span
                            style={{
                              fontSize: resolvedSize === 'inherit' ? undefined : resolvedSize,
                              fontWeight: resolvedWeight === 'inherit' ? undefined : resolvedWeight,
                              lineHeight: resolvedLh === 'inherit' ? undefined : resolvedLh,
                              letterSpacing: resolvedLs === 'inherit' ? undefined : resolvedLs,
                              fontFamily: resolvedFf || undefined,
                              color: isVarColor ? undefined : resolvedColor,
                              textTransform: style.props.textTransform,
                              textDecoration: style.props.textDecoration,
                              transition: style.props.transition,
                            }}
                            className={isVarColor ? 'text-slate-700 dark:text-slate-200' : ''}
                          >
                            {sampleText}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {hasColors && (
                <div className="p-4">
                  <div className={`text-[10px] font-bold uppercase tracking-widest mb-3 ${lightMode ? 'text-slate-400' : 'text-slate-500'}`}>Color Palette</div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {colors.map((swatch, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <div
                          className="shrink-0 rounded border border-black/10 dark:border-white/10"
                          style={{ backgroundColor: swatch.color, width: 36, height: 36 }}
                        />
                        <div className="min-w-0">
                          <div className={`text-[10px] font-semibold font-mono truncate ${lightMode ? 'text-slate-600' : 'text-slate-300'}`}>{swatch.name.replace('--', '')}</div>
                          <div className={`text-[10px] font-mono truncate ${lightMode ? 'text-slate-400' : 'text-slate-500'}`}>{swatch.value}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <details className={`border-t px-4 py-2 ${lightMode ? 'border-slate-200 text-slate-400' : 'border-slate-700 text-slate-500'}`}>
                <summary className="text-xs cursor-pointer hover:text-slate-300">View raw CSS</summary>
                <pre className={`mt-2 text-xs font-mono overflow-x-auto ${lightMode ? 'text-slate-600' : 'text-slate-300'}`}>{trimmed}</pre>
              </details>
            </div>
          );
        }

        return (
          <pre className={`p-3 rounded-lg ${isPage ? 'my-4' : 'my-3'} overflow-x-auto text-xs font-mono ${lightMode ? 'bg-slate-100 text-slate-800' : 'bg-slate-800 text-slate-200'}`}>{children}</pre>
        );
      },
    };
  }, [lightMode, variant, compact]);

  return (
    <div dir={dir} className="min-w-0 max-w-full wrap-break-word">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
        {content}
      </ReactMarkdown>
    </div>
  );
};

export default MarkdownRenderer;
