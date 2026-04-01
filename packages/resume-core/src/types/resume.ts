export interface ResumeTemplate {
  id: string;
  name: string;
  css: string;
}

export interface ResumeStyle {
  themeColor: string;
  fontFamily: string;
  fontSize: number;
  paragraphSpacing: number;
  h2MarginTop: number;
  h2MarginBottom: number;
  h3MarginTop: number;
  h3MarginBottom: number;
  personalHeaderSpacing: number;
  h1Size: number;
  h2Size: number;
  h3Size: number;
  dateSize?: number;
  dateWeight?: string;
  lineHeight: number;
  marginV: number;
  marginH: number;
  personalInfoMode?: "text" | "icon";
}

export interface WebPlaygroundDraft {
  version: 1;
  markdown: string;
  templateId: string;
  resumeStyle: ResumeStyle;
  photoBase64: string | null;
  updatedAt: string;
}
