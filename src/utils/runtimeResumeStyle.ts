import type { ResumeStyle } from "@resume-core";

interface RuntimeResumeStyleOptions {
  includePageRule?: boolean;
}

export const buildRuntimeResumeStyleCss = (
  cvStyle: ResumeStyle,
  options: RuntimeResumeStyleOptions = {},
): string => {
  const { includePageRule = true } = options;

  return `
  ${includePageRule
    ? `@page {
    size: A4;
    margin: ${cvStyle.marginV}mm ${cvStyle.marginH}mm;
    @bottom-right {
      content: counter(page) " / " counter(pages);
      font-size: 10px;
      color: #c7c4d6;
      font-family: 'Manrope', sans-serif;
      letter-spacing: 0.1em;
    }
  }`
    : ""}
  .resume-document {
    --cv-photo-width: 90px;
    --cv-photo-height: 120px;
    --cv-photo-gap: 18px;
    --cv-photo-radius: 8px;
    --cv-photo-reserve: calc(var(--cv-photo-width) + var(--cv-photo-gap));
    --cv-theme-color: ${cvStyle.themeColor};
    --cv-font-size: ${cvStyle.fontSize}px;
    --cv-paragraph-spacing: ${cvStyle.paragraphSpacing}px;
    --cv-h2-margin-top: ${cvStyle.h2MarginTop}px;
    --cv-h2-margin-bottom: ${cvStyle.h2MarginBottom}px;
    --cv-h3-margin-top: ${cvStyle.h3MarginTop}px;
    --cv-h3-margin-bottom: ${cvStyle.h3MarginBottom}px;
    --cv-personal-header-spacing: ${cvStyle.personalHeaderSpacing}px;
    font-family: ${cvStyle.fontFamily} !important;
    font-size: ${cvStyle.fontSize}px !important;
    line-height: ${cvStyle.lineHeight} !important;
    position: relative !important;
    ${cvStyle.dateWeight ? `--cv-date-weight: ${cvStyle.dateWeight};` : ""}
    ${cvStyle.dateSize ? `--cv-date-size: ${cvStyle.dateSize}px;` : ""}
  }
  .resume-document .resume-photo-wrapper {
    position: absolute !important;
    top: 0;
    right: 0;
    width: var(--cv-photo-width);
    height: var(--cv-photo-height);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    box-sizing: border-box;
    cursor: pointer;
    z-index: 10;
    transition: border-color 0.2s ease, background-color 0.2s ease, box-shadow 0.2s ease;
  }
  .resume-document .resume-photo-wrapper.is-empty {
    background-color: #f8f9fa;
    border: 1px dashed #ced4da;
    border-radius: var(--cv-photo-radius);
    overflow: hidden;
  }
  .resume-document > .resume-photo-wrapper.is-empty:hover {
    border-color: ${cvStyle.themeColor};
    background-color: color-mix(in srgb, ${cvStyle.themeColor} 5%, #f8f9fa);
  }
  .resume-document .resume-photo-wrapper.has-photo {
    background: transparent;
    border: none;
    border-radius: 0;
    overflow: visible;
    box-shadow: none;
  }
  .resume-document > .resume-photo-wrapper.has-photo:hover {
    background: transparent;
    border: none;
    box-shadow: none;
  }
  .resume-document .resume-photo-wrapper img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
    border: none !important;
    border-radius: 0 !important;
    box-shadow: none !important;
    filter: none !important;
    clip-path: none !important;
    background: transparent;
  }
  .resume-document .resume-photo-wrapper.has-photo img {
    position: absolute;
    inset: 0;
  }
  .resume-document > .resume-photo-wrapper .photo-placeholder-text {
    color: #adb5bd;
    font-size: 12px;
    text-align: center;
    line-height: 1.2;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    padding: 12px;
    box-sizing: border-box;
  }
  .resume-document .dodge-photo:not(h2) {
    padding-right: var(--cv-photo-reserve) !important;
    box-sizing: border-box;
  }
  .resume-document h1 {
    font-size: ${cvStyle.h1Size}px !important;
    color: ${cvStyle.themeColor} !important;
    border-color: ${cvStyle.themeColor} !important;
  }
  .resume-document h2 {
    font-size: ${cvStyle.h2Size}px !important;
    color: ${cvStyle.themeColor} !important;
    border-bottom-color: ${cvStyle.themeColor} !important;
    border-left-color: ${cvStyle.themeColor} !important;
    margin-top: var(--cv-h2-margin-top) !important;
    margin-bottom: var(--cv-h2-margin-bottom) !important;
  }
  .resume-document h3 {
    font-size: ${cvStyle.h3Size}px !important;
    color: ${cvStyle.themeColor} !important;
    margin-top: var(--cv-h3-margin-top) !important;
    margin-bottom: var(--cv-h3-margin-bottom) !important;
  }
  .resume-document .experience-line {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.75rem;
  }
  .resume-document h3.experience-line {
    align-items: flex-end;
  }
  .resume-document .experience-title {
    flex: 1 1 auto;
    min-width: 0;
  }
  .resume-document .experience-date {
    font-size: var(--cv-date-size, inherit);
    font-weight: var(--cv-date-weight, inherit);
    flex-shrink: 0;
    margin-left: auto;
    text-align: right;
    white-space: nowrap;
  }
  .resume-document p:not(.job-intention),
  .resume-document ul,
  .resume-document ol,
  .resume-document .job-intention + p,
  .resume-document .contact-info--text,
  .resume-document .contact-info-text-line,
  .resume-document .contact-info--icon,
  .resume-document .contact-info-item {
    font-size: var(--cv-font-size) !important;
  }
  .resume-document blockquote {
    font-size: calc(var(--cv-font-size) * 0.9) !important;
  }
  .resume-document p,
  .resume-document ul,
  .resume-document ol,
  .resume-document blockquote {
    margin-top: 0 !important;
    margin-bottom: var(--cv-paragraph-spacing) !important;
  }
  .resume-document li {
    margin-bottom: calc(var(--cv-paragraph-spacing) * 0.5) !important;
  }
  .resume-document .personal-header {
    margin-bottom: var(--cv-personal-header-spacing) !important;
    break-inside: avoid;
    box-sizing: border-box;
  }
  .resume-document .contact-info--text,
  .resume-document .contact-info--icon,
  .resume-document .job-intention + p {
    margin-bottom: 0 !important;
  }
  .resume-document .manual-page-break {
    break-before: page;
    page-break-before: always;
    height: 0;
    margin: 0;
    padding: 0;
    border: 0;
  }
`;
};
