import defaultResumeMarkdown from "../assets/templates/default-resume.md?raw";
import businessCss from "../assets/templates/business.css?raw";
import businessManifest from "../assets/templates/business.manifest.json";
import classicCss from "../assets/templates/classic.css?raw";
import classicManifest from "../assets/templates/classic.manifest.json";
import modernCss from "../assets/templates/modern.css?raw";
import modernManifest from "../assets/templates/modern.manifest.json";
import type { ResumeTemplate, TemplateManifest } from "../types/resume";

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
    manifest: modernManifest as TemplateManifest,
  },
  {
    id: "classic",
    name: extractMetaName(classicCss, "传统经典"),
    css: classicCss,
    manifest: classicManifest as TemplateManifest,
  },
  {
    id: "business",
    name: extractMetaName(businessCss, "商务专业"),
    css: businessCss,
    manifest: businessManifest as TemplateManifest,
  },
];

export const getBuiltinTemplates = (): ResumeTemplate[] =>
  BUILTIN_TEMPLATES.map((template) => ({ ...template }));

export const getBuiltinTemplateById = (templateId: string) =>
  BUILTIN_TEMPLATES.find((template) => template.id === templateId) ?? null;
