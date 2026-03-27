import { LOCAL_MUTATION_TTL, STORAGE_KEYS, WATCH_REFRESH_DELAY } from "../constants";
import type { ResumeStoreBaseContext } from "../context";
import { normalizePathKey } from "../path-utils";
import type { FileItem, WorkspaceChangedEvent } from "../types";

interface WorkspaceWatchModuleContext extends ResumeStoreBaseContext {
  refreshWorkspaceLists: (dirPath: string) => Promise<FileItem[]>;
  hasFile: (files: FileItem[], path: string) => boolean;
  markActiveFileMissing: () => void;
  readResumeContent: (path: string) => Promise<string>;
  ensurePathExists: (path: string) => Promise<boolean>;
  openFile: (path: string) => Promise<void>;
  openDefaultFile: (files: FileItem[]) => Promise<void>;
  setWorkspacePath: (path: string | null) => void;
  loadWorkspaceRenderState: (dirPath: string) => Promise<void>;
  syncWorkspaceWatch: (path: string | null) => Promise<void>;
}

export const createWorkspaceWatchModule = (
  context: WorkspaceWatchModuleContext,
) => {
  const { state, runtime, platform, ui } = context;

  const syncPendingLocalMutationPaths = () => {
    state.pendingLocalMutationPaths.value = Array.from(
      runtime.localMutationTimers.keys(),
    );
  };

  const clearQueuedWorkspaceRefresh = () => {
    if (runtime.queuedWorkspaceRefreshTimer) {
      clearTimeout(runtime.queuedWorkspaceRefreshTimer);
      runtime.queuedWorkspaceRefreshTimer = null;
    }

    runtime.queuedWorkspacePaths.clear();
  };

  const clearPendingLocalMutations = () => {
    for (const timer of runtime.localMutationTimers.values()) {
      clearTimeout(timer);
    }

    runtime.localMutationTimers.clear();
    syncPendingLocalMutationPaths();
  };

  const registerLocalMutation = (...paths: Array<string | null | undefined>) => {
    for (const path of paths) {
      if (!path) {
        continue;
      }

      const key = normalizePathKey(path);
      const existingTimer = runtime.localMutationTimers.get(key);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }

      runtime.localMutationTimers.set(
        key,
        setTimeout(() => {
          runtime.localMutationTimers.delete(key);
          syncPendingLocalMutationPaths();
        }, LOCAL_MUTATION_TTL),
      );
    }

    syncPendingLocalMutationPaths();
  };

  const consumeLocalMutationPaths = (paths: string[]) => {
    const externalPaths: string[] = [];

    for (const path of paths) {
      const key = normalizePathKey(path);
      const timer = runtime.localMutationTimers.get(key);

      if (!timer) {
        externalPaths.push(path);
        continue;
      }

      clearTimeout(timer);
      runtime.localMutationTimers.delete(key);
    }

    syncPendingLocalMutationPaths();
    return externalPaths;
  };

  const resolveExternalChangeForActiveFile = async (changedPaths: string[]) => {
    const currentPath = state.activeFilePath.value;
    if (!currentPath) {
      return;
    }

    const currentPathKey = normalizePathKey(currentPath);
    if (!changedPaths.some((path) => normalizePathKey(path) === currentPathKey)) {
      return;
    }

    try {
      const diskContent = await context.readResumeContent(currentPath);
      if (state.activeFilePath.value !== currentPath) {
        return;
      }

      if (diskContent === state.markdownContent.value) {
        runtime.ignoredExternalContent = null;
        return;
      }

      if (
        runtime.ignoredExternalContent &&
        runtime.ignoredExternalContent.pathKey === currentPathKey &&
        runtime.ignoredExternalContent.content === diskContent
      ) {
        return;
      }

      if (!state.isDirty.value) {
        state.markdownContent.value = diskContent;
        state.activeFileStatus.value = "ready";
        state.isDirty.value = false;
        runtime.ignoredExternalContent = null;
        ui.message.info("当前文件已从磁盘重新加载。");
        return;
      }

      if (runtime.conflictPromptPromise) {
        return;
      }

      state.activeFileStatus.value = "conflict";
      runtime.conflictPromptPromise = (async () => {
        const shouldReload = await ui.messageBox
          .confirm(
            "该文件已被其他程序修改。是否重新加载磁盘中的最新内容？",
            "检测到外部更新",
            {
              confirmButtonText: "重新加载",
              cancelButtonText: "保留当前内容",
              type: "warning",
              distinguishCancelAndClose: false,
            },
          )
          .then(() => true)
          .catch(() => false);

        if (state.activeFilePath.value !== currentPath) {
          return;
        }

        if (shouldReload) {
          state.markdownContent.value = diskContent;
          state.activeFileStatus.value = "ready";
          state.isDirty.value = false;
          runtime.ignoredExternalContent = null;
          ui.message.info("已加载磁盘中的最新内容。");
          return;
        }

        state.activeFileStatus.value = "ready";
        runtime.ignoredExternalContent = {
          pathKey: currentPathKey,
          content: diskContent,
        };
        ui.message.info("已保留当前编辑内容，后续保存将覆盖磁盘版本。");
      })().finally(() => {
        runtime.conflictPromptPromise = null;
        if (state.activeFileStatus.value === "conflict") {
          state.activeFileStatus.value = "ready";
        }
      });

      await runtime.conflictPromptPromise;
    } catch (error) {
      console.error("Failed to process external file change:", error);

      if (!(await context.ensurePathExists(currentPath))) {
        context.markActiveFileMissing();
      }
    }
  };

  const handleWorkspaceChanged = async (paths: string[]) => {
    const currentWorkspace = state.workspacePath.value;
    if (!currentWorkspace) {
      return;
    }

    const externalPaths = consumeLocalMutationPaths(paths);
    let files: FileItem[] = [];
    try {
      files = await context.refreshWorkspaceLists(currentWorkspace);
    } catch {
      return;
    }

    if (state.activeFilePath.value && !context.hasFile(files, state.activeFilePath.value)) {
      context.markActiveFileMissing();
      return;
    }

    if (externalPaths.length === 0) {
      return;
    }

    await resolveExternalChangeForActiveFile(externalPaths);
  };

  const queueWorkspaceChanged = (payload: WorkspaceChangedEvent) => {
    if (!state.workspacePath.value || payload.workspacePath !== state.workspacePath.value) {
      return;
    }

    for (const path of payload.paths) {
      runtime.queuedWorkspacePaths.set(normalizePathKey(path), path);
    }

    if (runtime.queuedWorkspaceRefreshTimer) {
      clearTimeout(runtime.queuedWorkspaceRefreshTimer);
    }

    runtime.queuedWorkspaceRefreshTimer = setTimeout(() => {
      const changedPaths = Array.from(runtime.queuedWorkspacePaths.values());
      runtime.queuedWorkspacePaths.clear();
      runtime.queuedWorkspaceRefreshTimer = null;
      void handleWorkspaceChanged(changedPaths);
    }, WATCH_REFRESH_DELAY);
  };

  const ensureWorkspaceChangedListener = () => {
    if (runtime.workspaceChangedUnlisten || runtime.workspaceChangedListenerPromise) {
      return;
    }

    runtime.workspaceChangedListenerPromise = platform
      .listen<WorkspaceChangedEvent>("workspace-changed", ({ payload }) => {
        queueWorkspaceChanged(payload);
      })
      .then((unlisten) => {
        runtime.workspaceChangedUnlisten = unlisten;
        return unlisten;
      })
      .catch((error) => {
        runtime.workspaceChangedListenerPromise = null;
        console.error("Failed to listen for workspace changes:", error);
        throw error;
      });
  };

  const initWorkspace = async () => {
    const savedWorkspace = localStorage.getItem(STORAGE_KEYS.workspacePath);
    if (!savedWorkspace) {
      state.shouldShowWorkspaceDialog.value = true;
      return;
    }

    context.setWorkspacePath(savedWorkspace);

    try {
      await context.loadWorkspaceRenderState(savedWorkspace);
      const files = await context.refreshWorkspaceLists(savedWorkspace);
      const lastOpenedPath = localStorage.getItem(STORAGE_KEYS.lastOpenedPath);

      if (
        lastOpenedPath &&
        files.some(
          (file) =>
            normalizePathKey(file.path) === normalizePathKey(lastOpenedPath),
        )
      ) {
        await context.openFile(lastOpenedPath);
        return;
      }

      await context.openDefaultFile(files);
    } catch {
      state.shouldShowWorkspaceDialog.value = true;
    }
  };

  return {
    syncPendingLocalMutationPaths,
    clearQueuedWorkspaceRefresh,
    clearPendingLocalMutations,
    registerLocalMutation,
    consumeLocalMutationPaths,
    resolveExternalChangeForActiveFile,
    handleWorkspaceChanged,
    queueWorkspaceChanged,
    ensureWorkspaceChangedListener,
    initWorkspace,
  };
};
