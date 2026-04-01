export interface ResumeTemplate {
  id: string;
  name: string;
  css: string;
}

export interface FileItem {
  name: string;
  path: string;
}

export interface PhotoItem extends FileItem {
  isIdPhoto: boolean;
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

export type SidebarPrimaryView = "library" | "outline";
export type ActiveFileStatus = "ready" | "missing" | "conflict";

export interface EditorJumpRequest {
  line: number;
  token: number;
}

export interface WorkspaceChangedEvent {
  workspacePath: string;
  paths: string[];
}

export interface ResumeRenderProfile {
  templateId: string;
  style: ResumeStyle;
  photoPath?: string;
}

export interface WorkspaceRenderState {
  version: number;
  files: Record<string, ResumeRenderProfile>;
}
