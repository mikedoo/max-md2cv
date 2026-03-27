import { marked } from "marked";
import { renderManualPageBreaks } from "./manualPageBreak";

export const renderMarkdownToHtml = async (markdown: string) => {
  return await marked.parse(renderManualPageBreaks(markdown));
};
