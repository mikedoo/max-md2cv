import { ResumeStyle } from '../stores/resume'

export const REGEX_PATTERNS = {
  JOB_INTENTION: /(?:求职意向|期望职位|应聘职位|求职目标)/,

  // Priority 1: explicitly bracketed date e.g. [2024.09 - 2027.06] or [2024.09]
  DATE_BRACKETED: /\[(\d{4}[\.\/-年]\d{1,2}(?:月)?(?:\s*(?:-|–|—|至)\s*(?:\d{4}[\.\/-年]\d{1,2}(?:月)?|至今|今))?)\]/,

  // Priority 2: bare date at the end of a line (fallback, no brackets needed)
  DATE_RANGE: /(\d{4}[\.\/-年]\d{1,2}(?:月)?(?:\s*(?:-|–|—|至)\s*(?:\d{4}[\.\/-年]\d{1,2}(?:月)?|至今|今))?)/,
}

// Strip all HTML tags to get plain text
function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, '')
}

export function enhanceResumeHtml(rawHtml: string, styleConfig: ResumeStyle): string {
  let html = rawHtml;

  // 1. Job intention paragraph
  html = html.replace(
    /<p>(.*?(?:求职意向|期望职位|应聘职位|求职目标).*?)<\/p>/g,
    (_match, text) => {
      return `<p class="job-intention" style="color: ${styleConfig.jobIntentionColor || styleConfig.themeColor}; cursor: pointer; transition: opacity 0.2s;" title="点击修改求职意向颜色">${text}</p>`;
    }
  );

  // 2. Extract dates from headings (h1-h6) and paragraphs (p, li)
  html = html.replace(/<(h[1-6]|p|li)([^>]*)>([\s\S]*?)<\/\1>/g, (match, tag, attrs, content) => {
    if (content.includes('experience-date')) return match;

    const plainText = stripHtml(content).trim();

    // --- Strategy: Bracketed date [YYYY.MM - YYYY.MM] only ---
    const bracketedMatch = plainText.match(REGEX_PATTERNS.DATE_BRACKETED);
    if (!bracketedMatch) return match;

    const dateText = bracketedMatch[1]; // captured group without brackets
    // Remove the bracketed date from raw content (with brackets!)
    const rawCleaned = content.replace(REGEX_PATTERNS.DATE_BRACKETED, '').trim();
    const titleHtml = rawCleaned.replace(/[\s\-\|—–:：,，·]+$/, '').trim();

    return `<${tag}${attrs} class="experience-line"><span class="experience-title">${titleHtml}</span><span class="experience-date">${dateText}</span></${tag}>`;
  });

  return html;
}
