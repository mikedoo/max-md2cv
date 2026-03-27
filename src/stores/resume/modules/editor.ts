import { DEFAULT_MARKDOWN } from "../constants";
import type { ResumeStoreBaseContext } from "../context";
import { ensureMarkdownFileName, normalizePathKey } from "../path-utils";

interface EditorModuleContext extends ResumeStoreBaseContext {
  setLastOpenedPath: (path: string | null) => void;
  syncActiveFileRenderProfile: () => void;
  refreshWorkspaceLists: (dirPath: string) => Promise<unknown>;
  updateRenderProfilePath: (
    oldPath: string,
    newPath: string,
    mode: "move" | "copy",
  ) => Promise<void>;
  openDefaultFile: (files: Array<{ path: string }>) => Promise<void>;
  registerLocalMutation: (...paths: Array<string | null | undefined>) => void;
}

export const createEditorModule = (context: EditorModuleContext) => {
  const { state, runtime, platform, ui } = context;

  const resetActiveDocumentState = () => {
    state.activeFilePath.value = null;
    state.activeFileStatus.value = "ready";
    state.markdownContent.value = DEFAULT_MARKDOWN;
    state.isDirty.value = false;
    runtime.ignoredExternalContent = null;
    state.editorJumpRequest.value = null;
    context.setLastOpenedPath(null);
  };

  const applyOpenedFile = (path: string, content: string) => {
    state.markdownContent.value = content;
    state.activeFilePath.value = path;
    state.activeFileStatus.value = "ready";
    state.isDirty.value = false;
    runtime.ignoredExternalContent = null;
    state.editorJumpRequest.value = null;
    context.setLastOpenedPath(path);
  };

  const markActiveFileMissing = () => {
    if (state.activeFileStatus.value === "missing") {
      return;
    }

    state.activeFileStatus.value = "missing";
    runtime.ignoredExternalContent = null;
    ui.message.warning("当前打开的文件已从磁盘删除。");
  };

  const readResumeContent = async (path: string) => {
    return await platform.invoke<string>("read_resume", { path });
  };

  const ensurePathExists = async (path: string) => {
    return await platform.invoke<boolean>("path_exists", { path });
  };

  const openFile = async (path: string) => {
    try {
      const content = await readResumeContent(path);
      applyOpenedFile(path, content);
      context.syncActiveFileRenderProfile();
    } catch (error) {
      console.error("Failed to read file:", error);
      ui.message.error("读取文件失败");

      const fallbackFile = state.fileList.value.find(
        (file) => normalizePathKey(file.path) !== normalizePathKey(path),
      );

      if (fallbackFile) {
        await openFile(fallbackFile.path);
        return;
      }

      resetActiveDocumentState();
    }
  };

  const updateMarkdownContent = (content: string, markDirty = true) => {
    state.markdownContent.value = content;

    if (markDirty && state.activeFilePath.value) {
      state.isDirty.value = true;
    }
  };

  const saveCurrentFile = async (silent = false) => {
    if (!state.activeFilePath.value) {
      return;
    }

    if (state.activeFileStatus.value === "missing") {
      if (!silent) {
        ui.message.warning("当前文件已从磁盘删除，请先另存为新文件。");
      }
      return;
    }

    if (state.activeFileStatus.value === "conflict") {
      if (!silent) {
        ui.message.warning("请先处理外部修改冲突。");
      }
      return;
    }

    try {
      const exists = await ensurePathExists(state.activeFilePath.value);
      if (!exists) {
        markActiveFileMissing();
        if (!silent) {
          ui.message.warning("当前文件已从磁盘删除，请先另存为新文件。");
        }
        return;
      }

      context.registerLocalMutation(state.activeFilePath.value);
      await platform.invoke("write_resume", {
        path: state.activeFilePath.value,
        content: state.markdownContent.value,
      });

      state.isDirty.value = false;
      runtime.ignoredExternalContent = null;

      if (!silent) {
        ui.message.success("文件已保存");
      }
    } catch (error) {
      console.error("Failed to save file:", error);
      ui.message.error("保存文件失败");
    }
  };

  const saveMissingFileAs = async (name: string) => {
    if (!state.workspacePath.value) {
      return false;
    }

    try {
      const previousPath = state.activeFilePath.value;
      const targetPath = await platform.join(
        state.workspacePath.value,
        ensureMarkdownFileName(name),
      );
      const targetKey = normalizePathKey(targetPath);
      const currentKey = state.activeFilePath.value
        ? normalizePathKey(state.activeFilePath.value)
        : null;

      const exists = await ensurePathExists(targetPath);
      if (exists && targetKey !== currentKey) {
        ui.message.error("同名文件已存在，请换一个名称。");
        return false;
      }

      context.registerLocalMutation(targetPath);
      await platform.invoke("write_resume", {
        path: targetPath,
        content: state.markdownContent.value,
      });

      await context.refreshWorkspaceLists(state.workspacePath.value);
      if (previousPath) {
        await context.updateRenderProfilePath(previousPath, targetPath, "move");
      }
      await openFile(targetPath);
      ui.message.success("已恢复为新文件");
      return true;
    } catch (error) {
      console.error("Failed to recover missing file:", error);
      ui.message.error("恢复文件失败");
      return false;
    }
  };

  const openFirstAvailableFile = async () => {
    const nextFile = state.fileList.value[0];
    if (!nextFile) {
      ui.message.warning("当前目录没有其他可打开的文件。");
      return;
    }

    await openFile(nextFile.path);
  };

  const replaceMarkdownFromOutline = async (nextMarkdown: string) => {
    if (
      state.activeFileStatus.value !== "ready" ||
      state.markdownContent.value === nextMarkdown
    ) {
      return;
    }

    state.markdownContent.value = nextMarkdown;
    state.isDirty.value = true;
    await saveCurrentFile(true);
  };

  return {
    resetActiveDocumentState,
    applyOpenedFile,
    markActiveFileMissing,
    readResumeContent,
    ensurePathExists,
    openFile,
    updateMarkdownContent,
    saveCurrentFile,
    saveMissingFileAs,
    openFirstAvailableFile,
    replaceMarkdownFromOutline,
  };
};
