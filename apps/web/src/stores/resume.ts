import { computed, ref } from "vue";
import { defineStore } from "pinia";
import { usePlaygroundStore } from "./playground";

interface FileItem {
  name: string;
  path: string;
}

type ActiveFileStatus = "ready" | "missing" | "conflict";

const WEB_FILE_PATH = "web-playground.md";

const readFileAsText = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("文件读取失败"));
    reader.readAsText(file, "utf-8");
  });

const pickSingleFile = (accept: string) =>
  new Promise<File | null>((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.onchange = () => resolve(input.files?.[0] ?? null);
    input.click();
  });

const buildDisplayNameFromMarkdown = (markdown: string) => {
  const titleMatch = markdown.match(/^#\s+(.+)$/m);
  return titleMatch?.[1]?.trim() || "Web Playground";
};

export const useResumeStore = defineStore("resume", () => {
  const playground = usePlaygroundStore();

  if (!playground.hydrated) {
    playground.hydrate();
  }

  const templatesLoaded = ref(true);
  const isExporting = ref(false);
  const activeFileStatus = ref<ActiveFileStatus>("ready");
  const isDirty = ref(false);
  const isSidebarOpen = ref(true);
  const sidebarPrimaryView = ref<"library" | "outline">("outline");
  const shouldShowWorkspaceDialog = ref(false);
  const isTemplateDialogVisible = ref(false);
  const editorJumpRequest = ref<{ line: number; token: number } | null>(null);
  const editorJumpToken = ref(0);

  const fileList = ref<FileItem[]>([
    {
      name: WEB_FILE_PATH,
      path: WEB_FILE_PATH,
    },
  ]);

  const markdownContent = computed({
    get: () => playground.markdown,
    set: (value: string) => {
      playground.updateMarkdown(value);
    },
  });

  const availableTemplates = computed(() => playground.templates);
  const activeTemplate = computed({
    get: () => playground.templateId,
    set: (value: string) => {
      playground.setTemplate(value);
    },
  });

  const activeFilePath = computed(() => WEB_FILE_PATH);
  const activeFileName = computed(() => buildDisplayNameFromMarkdown(playground.markdown));

  const currentPhotoPath = computed(() => {
    return playground.photoBase64 ? "web-photo" : null;
  });

  const loadTemplates = async () => {
    templatesLoaded.value = true;
  };

  const updateMarkdownContent = (content: string, markDirty = true) => {
    playground.updateMarkdown(content);
    if (markDirty) {
      isDirty.value = true;
    }
  };

  const saveCurrentFile = async (_silent = false) => {
    playground.persistNow();
    isDirty.value = false;
  };

  const replaceMarkdownFromOutline = async (nextMarkdown: string) => {
    updateMarkdownContent(nextMarkdown);
    await saveCurrentFile(true);
  };

  const persistActiveFileRenderState = async () => {
    playground.persistNow();
  };

  const resetActiveFileRenderSettings = () => {
    playground.setTemplate(playground.templateId);
  };

  const setActiveTemplateForCurrentFile = (templateId: string) => {
    playground.setTemplate(templateId);
  };

  const saveCurrentTemplate = async () => {
    playground.persistNow();
  };

  const exportCurrentPdf = async () => {
    isExporting.value = true;
    try {
      window.print();
    } finally {
      isExporting.value = false;
    }
  };

  const importIdPhoto = async () => {
    const file = await pickSingleFile("image/png,image/jpeg,image/webp,image/bmp,image/gif");
    if (!file) {
      return;
    }

    await playground.uploadPhoto(file);
  };

  const selectPhoto = async (_path: string) => {
    return;
  };

  const deletePhoto = async (_path: string) => {
    playground.setPhotoBase64(null);
  };

  const importMarkdownFile = async () => {
    const file = await pickSingleFile(".md,text/markdown,text/plain");
    if (!file) {
      return;
    }

    updateMarkdownContent(await readFileAsText(file), false);
    await saveCurrentFile(true);
  };

  const requestEditorJump = (line: number) => {
    editorJumpRequest.value = {
      line,
      token: ++editorJumpToken.value,
    };
  };

  const clearEditorJumpRequest = () => {
    editorJumpRequest.value = null;
  };

  const resetDraft = () => {
    playground.resetDraft();
    isDirty.value = false;
  };

  return {
    markdownContent,
    availableTemplates,
    activeTemplate,
    isExporting,
    templatesLoaded,
    resumeStyle: playground.resumeStyle,
    renderProfilesByFile: computed(() => ({})),
    workspacePath: computed(() => null),
    fileList,
    pdfFileList: computed(() => [] as FileItem[]),
    photoFileList: computed(() => [] as FileItem[]),
    activeFilePath,
    activeFileStatus,
    activeFileName,
    isDirty,
    pendingLocalMutationPaths: computed(() => [] as string[]),
    outlineTree: computed(() => []),
    sidebarPrimaryView,
    isSidebarOpen,
    shouldShowWorkspaceDialog,
    isTemplateDialogVisible,
    currentPhotoPath,
    editorJumpRequest,
    photoBase64: playground.photoBase64,
    loadTemplates,
    saveCurrentTemplate,
    exportCurrentPdf,
    persistActiveFileRenderState,
    resetActiveFileRenderSettings,
    setActiveTemplateForCurrentFile,
    selectWorkspace: async () => undefined,
    openWorkspaceDirectory: async () => undefined,
    openFile: async () => undefined,
    openFirstAvailableFile: async () => undefined,
    updateMarkdownContent,
    saveCurrentFile,
    saveMissingFileAs: async (_name: string) => false,
    replaceMarkdownFromOutline,
    createFile: async (_name: string) => undefined,
    createFromTemplate: async (_name: string, _company: string, _position: string) => undefined,
    deleteFile: async (_path: string) => undefined,
    deletePdf: async (_path: string) => undefined,
    renameFile: async (_oldPath: string, _newName: string) => undefined,
    duplicateFile: async (_path: string) => undefined,
    refreshFileList: async (_dirPath: string) => fileList.value,
    refreshPdfList: async (_dirPath: string) => [],
    refreshPhotoList: async (_dirPath: string) => [],
    selectPhoto,
    importIdPhoto,
    deletePhoto,
    moveOutlineNode: async () => undefined,
    requestEditorJump,
    clearEditorJumpRequest,
    openTemplateDialog: () => {
      isTemplateDialogVisible.value = true;
    },
    importMarkdownFile,
    resetDraft,
  };
});
