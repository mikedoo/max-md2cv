export const MANUAL_PAGE_BREAK_MARKER = '\\page'

const MANUAL_PAGE_BREAK_LINE_RE = new RegExp(
  `^\\s*${MANUAL_PAGE_BREAK_MARKER.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`,
  'gm',
)

export const renderManualPageBreaks = (markdown: string) => {
  return markdown.replace(
    MANUAL_PAGE_BREAK_LINE_RE,
    '\n\n<div class="manual-page-break" aria-hidden="true"></div>\n\n',
  )
}
