import defaultResumeMarkdown from "../assets/templates/default-resume.md?raw";
import businessCss from "../assets/templates/business.css?raw";
import classicCss from "../assets/templates/classic.css?raw";
import modernCss from "../assets/templates/modern.css?raw";
import type { ResumeTemplate } from "../types/resume";

export type BuiltinTemplateId = "modern" | "classic" | "business";

export const DEFAULT_TEMPLATE_ID: BuiltinTemplateId = "modern";
export const DEFAULT_RESUME_MARKDOWN = defaultResumeMarkdown;

const extractMetaName = (css: string, fallback: string) => {
  const match = css.match(/@name:\s*([^\r\n*]+)/);
  return match?.[1]?.trim() || fallback;
};

const BUILTIN_TEMPLATES: ResumeTemplate[] = [
  {
    id: "modern",
    name: extractMetaName(modernCss, "现代简约"),
    css: modernCss,
  },
  {
    id: "classic",
    name: extractMetaName(classicCss, "传统经典"),
    css: classicCss,
  },
  {
    id: "business",
    name: extractMetaName(businessCss, "商务专业"),
    css: businessCss,
  },
];

export const getBuiltinTemplates = (): ResumeTemplate[] =>
  BUILTIN_TEMPLATES.map((template) => ({ ...template }));

export const getBuiltinTemplateById = (templateId: string) =>
  BUILTIN_TEMPLATES.find((template) => template.id === templateId) ?? null;
