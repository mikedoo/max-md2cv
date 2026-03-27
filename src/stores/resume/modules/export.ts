import { buildSelfContainedExportStyles } from "../../../utils/exportStyles";
import { getInlinePingFangFontFaceCss } from "../../../utils/fontAssets";
import type { ResumeStoreBaseContext } from "../context";

interface ExportModuleContext extends ResumeStoreBaseContext {
  refreshPdfList: (dirPath: string) => Promise<unknown>;
}

export const createExportModule = (context: ExportModuleContext) => {
  const { state, platform, ui } = context;

  const exportCurrentPdf = async () => {
    if (!state.activeFilePath.value || !state.workspacePath.value) {
      ui.message.error("未找到当前打开的文件或工作区");
      return;
    }

    state.isExporting.value = true;
    try {
      const fileNameWithExt =
        state.activeFilePath.value.split(/[/\\]/).pop() || "简历.md";
      const documentTitle = fileNameWithExt.replace(/\.[^/.]+$/, "");
      const targetPdfName = `${documentTitle}.pdf`;
      const targetPdfPath = await platform.join(
        state.workspacePath.value,
        targetPdfName,
      );

      const exists = state.pdfFileList.value.some(
        (file) => file.name === targetPdfName,
      );
      if (exists) {
        try {
          await ui.messageBox.confirm(
            `工作区已存在名为 "${targetPdfName}" 的文件，是否覆盖？`,
            "导出确认",
            {
              confirmButtonText: "覆盖",
              cancelButtonText: "取消",
              type: "warning",
            },
          );
        } catch {
          state.isExporting.value = false;
          return;
        }
      }

      const pagesContainer = platform.document?.querySelector(".pagedjs_pages");
      if (!pagesContainer) {
        throw new Error("预览内容尚未准备好，请稍后重试。");
      }

      const styles = await buildSelfContainedExportStyles();
      const inlinePingFangFontFaceCss = await getInlinePingFangFontFaceCss();

      const exportedPagesContainer = pagesContainer.cloneNode(true) as HTMLElement;
      if (!exportedPagesContainer.style.getPropertyValue("--pagedjs-page-count")) {
        exportedPagesContainer.style.setProperty(
          "--pagedjs-page-count",
          String(exportedPagesContainer.querySelectorAll(".pagedjs_page").length),
        );
      }

      const htmlContent = `
        <!DOCTYPE html>
        <html class="light" lang="zh-CN">
        <head>
          <meta charset="utf-8">
          <title>${documentTitle}</title>
          ${styles}
          <style>
            ${inlinePingFangFontFaceCss}
            body {
              background: white !important;
              margin: 0;
              padding: 0;
            }
            .pagedjs-wrapper {
              width: 100% !important;
              align-items: flex-start !important;
            }
            .pagedjs_pages {
              display: block !important;
            }
            .pagedjs_page {
              box-shadow: none !important;
            }
          </style>
        </head>
        <body class="resume-document">
          <div class="pagedjs-wrapper">
            ${exportedPagesContainer.outerHTML}
          </div>
        </body>
        </html>
      `;

      await platform.invoke("export_pdf_command", {
        htmlContent,
        outputPath: targetPdfPath,
      });

      if (state.workspacePath.value) {
        await context.refreshPdfList(state.workspacePath.value);
      }

      ui.message.success(`导出成功：${targetPdfName}`);
    } catch (error: any) {
      console.error("导出失败:", error);
      const errorMsg =
        typeof error === "string" ? error : error.message || JSON.stringify(error);
      ui.message.error({
        message: `导出失败: ${errorMsg}`,
        duration: 5000,
        showClose: true,
      });
    } finally {
      state.isExporting.value = false;
    }
  };

  return {
    exportCurrentPdf,
  };
};
