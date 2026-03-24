export const LINE_FORMAT_OPTIONS = [
  { label: '正文', value: 'paragraph', icon: 'notes' },
  { label: '标题 2', value: 'heading2', icon: 'format_h2' },
  { label: '标题 3', value: 'heading3', icon: 'format_h3' },
  { label: '标题 4', value: 'heading4', icon: 'format_h4' },
  { label: '标题 1', value: 'heading1', icon: 'format_h1' },
  { label: '列表', value: 'list', icon: 'format_list_bulleted' },
  { label: '引用', value: 'quote', icon: 'format_quote' },
] as const

export type LineFormatValue = (typeof LINE_FORMAT_OPTIONS)[number]['value']

export const getLineFormatOption = (format: LineFormatValue) =>
  LINE_FORMAT_OPTIONS.find((option) => option.value === format) ?? LINE_FORMAT_OPTIONS[0]

export const INSERT_MENU_OPTIONS = [
  { label: '日期', value: 'date', icon: 'calendar_month' },
  { label: '强调', value: 'emphasis', icon: 'priority_high' },
  { label: '分页', value: 'page-break', icon: 'insert_page_break' },
  { label: '链接', value: 'link', icon: 'link' },
] as const

export type InsertMenuValue = (typeof INSERT_MENU_OPTIONS)[number]['value']
