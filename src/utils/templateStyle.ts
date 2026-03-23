import type { ResumeStyle } from "../stores/resume";

const DEFAULT_THEME_COLOR = "#4c49cc";
const DEFAULT_FONT_FAMILY = '"PingFang SC", "Microsoft YaHei", sans-serif';

export const createDefaultResumeStyle = (): ResumeStyle => ({
  themeColor: DEFAULT_THEME_COLOR,
  fontFamily: DEFAULT_FONT_FAMILY,
  fontSize: 14,
  paragraphSpacing: 8,
  h1Size: 28,
  h2Size: 20,
  h3Size: 16,
  dateSize: 14,
  dateWeight: "400",
  lineHeight: 1.6,
  marginV: 10,
  marginH: 12,
  personalInfoMode: "text",
});

export const cloneResumeStyle = (
  style?: Partial<ResumeStyle> | null,
): ResumeStyle => ({
  ...createDefaultResumeStyle(),
  ...style,
});

export const normalizeFontFamily = (fontFamily?: string | null): string => {
  const resolvedFontFamily = (fontFamily ?? "").replace(
    /^var\(\s*--[^,]+,\s*(.+)\)$/,
    "$1",
  );

  const primaryFont = resolvedFontFamily
    .split(",")[0]
    ?.replace(/["']/g, "")
    .trim()
    .toLowerCase();

  switch (primaryFont) {
    case "pingfang sc":
      return '"PingFang SC", "Microsoft YaHei", sans-serif';
    case "microsoft yahei":
      return '"Microsoft YaHei", "PingFang SC", sans-serif';
    case "simhei":
      return '"SimHei", "Microsoft YaHei", sans-serif';
    case "simsun":
      return '"SimSun", "Times New Roman", serif';
    case "helvetica":
    case "helvetica neue":
      return "Helvetica, Arial, sans-serif";
    case "arial":
    case "arial narrow":
      return "Arial, sans-serif";
    case "times new roman":
      return '"Times New Roman", Times, serif';
    default:
      return DEFAULT_FONT_FAMILY;
  }
};

const getCssBlocks = (css: string, selector: string): string[] => {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const selectorRe = new RegExp(`${escapedSelector}\\s*\\{`, "g");
  const blocks: string[] = [];

  while (selectorRe.exec(css) !== null) {
    const blockStart = selectorRe.lastIndex - 1;
    let depth = 1;
    let cursor = blockStart + 1;

    while (cursor < css.length && depth > 0) {
      const char = css[cursor];
      if (char === "{") depth += 1;
      if (char === "}") depth -= 1;
      cursor += 1;
    }

    if (depth !== 0) break;

    blocks.push(css.slice(blockStart + 1, cursor - 1));
    selectorRe.lastIndex = cursor;
  }

  return blocks;
};

const extractTopLevelProp = (block: string, prop: string): string | null => {
  let depth = 0;
  let flattened = "";

  for (const char of block) {
    if (char === "{") {
      depth += 1;
      continue;
    }
    if (char === "}") {
      depth = Math.max(0, depth - 1);
      continue;
    }
    if (depth === 0) {
      flattened += char;
    }
  }

  const escapedProp = prop.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const matches = [
    ...flattened.matchAll(
      new RegExp(`(?:^|[;\\s])${escapedProp}\\s*:\\s*([^;]+)`, "g"),
    ),
  ];

  return matches.length > 0 ? matches[matches.length - 1][1].trim() : null;
};

const extractCssProp = (
  css: string,
  selector: string,
  prop: string,
  fallback: string,
): string => {
  const blocks = getCssBlocks(css, selector);
  for (let i = blocks.length - 1; i >= 0; i -= 1) {
    const value = extractTopLevelProp(blocks[i], prop);
    if (value) return value;
  }
  return fallback;
};

const resolveCssFallbackValue = (raw: string, fallback: string): string => {
  const value = raw.trim();
  if (!value.startsWith("var(")) return value;

  const inner = value.slice(4, -1);
  const commaIndex = inner.indexOf(",");
  if (commaIndex === -1) return fallback;

  return inner.slice(commaIndex + 1).trim() || fallback;
};

const normalizeThemeColor = (raw: string, fallback: string): string => {
  const value = resolveCssFallbackValue(raw, fallback)
    .replace(/\s*!important\s*$/i, "")
    .trim();
  const lowered = value.toLowerCase();

  if (
    !value ||
    [
      "inherit",
      "initial",
      "unset",
      "revert",
      "currentcolor",
      "transparent",
    ].includes(lowered)
  ) {
    return fallback;
  }

  return value;
};

const toNum = (value: string, fallback: number) => {
  const rem = value.match(/([\d.]+)rem/);
  if (rem) return parseFloat(rem[1]) * 16;

  const px = value.match(/([\d.]+)px/);
  if (px) return parseFloat(px[1]);

  const raw = parseFloat(value);
  return Number.isFinite(raw) ? raw : fallback;
};

export const parseResumeStyleFromTemplateCss = (css: string): ResumeStyle => {
  const fallback = createDefaultResumeStyle();

  const lineHeightRaw = resolveCssFallbackValue(
    extractCssProp(css, ".resume-document", "line-height", `${fallback.lineHeight}`),
    `${fallback.lineHeight}`,
  );
  const lineHeight = parseFloat(lineHeightRaw);

  const fontFamily = normalizeFontFamily(
    extractCssProp(css, ".resume-document", "font-family", fallback.fontFamily),
  );

  const h1Size = toNum(
    extractCssProp(css, ".resume-document h1", "font-size", `${fallback.h1Size}px`),
    fallback.h1Size,
  );
  const h2Size = toNum(
    extractCssProp(css, ".resume-document h2", "font-size", `${fallback.h2Size}px`),
    fallback.h2Size,
  );
  const h3Size = toNum(
    extractCssProp(css, ".resume-document h3", "font-size", `${fallback.h3Size}px`),
    fallback.h3Size,
  );

  const themeColorRaw =
    extractCssProp(css, ".resume-document", "--cv-theme-color", "") ||
    extractCssProp(css, ".resume-document h2", "color", "") ||
    extractCssProp(css, ".resume-document h2", "border-left-color", "") ||
    extractCssProp(
      css,
      ".resume-document h1",
      "color",
      fallback.themeColor,
    );
  const themeColor = normalizeThemeColor(themeColorRaw, fallback.themeColor);

  const bodyFontRaw = resolveCssFallbackValue(
    extractCssProp(
      css,
      ".resume-document",
      "--cv-font-size",
      extractCssProp(
        css,
        ".resume-document p",
        "font-size",
        extractCssProp(
          css,
          ".resume-document",
          "font-size",
          `${fallback.fontSize}px`,
        ),
      ),
    ),
    `${fallback.fontSize}px`,
  );
  const fontSize = toNum(bodyFontRaw, fallback.fontSize);

  const dateWeightRaw = resolveCssFallbackValue(
    extractCssProp(
      css,
      ".resume-document .experience-date",
      "font-weight",
      extractCssProp(
        css,
        ".resume-document",
        "--cv-date-weight",
        fallback.dateWeight ?? "400",
      ),
    ),
    fallback.dateWeight ?? "400",
  ).toLowerCase();
  const dateWeight = ["bold", "bolder", "700", "800", "900"].includes(
    dateWeightRaw,
  )
    ? "700"
    : "400";

  const dateSizeRaw = resolveCssFallbackValue(
    extractCssProp(
      css,
      ".resume-document .experience-date",
      "font-size",
      extractCssProp(
        css,
        ".resume-document",
        "--cv-date-size",
        `${fallback.dateSize ?? fallback.fontSize}px`,
      ),
    ),
    `${fallback.dateSize ?? fallback.fontSize}px`,
  );
  const dateSize = toNum(dateSizeRaw, fallback.dateSize ?? fallback.fontSize);

  const paragraphSpacingRaw = extractCssProp(
    css,
    ".resume-document",
    "--cv-paragraph-spacing",
    extractCssProp(
      css,
      ".resume-document p",
      "margin-bottom",
      `${fallback.paragraphSpacing}px`,
    ),
  );
  const paragraphSpacing = toNum(paragraphSpacingRaw, fallback.paragraphSpacing);

  const pageMarginRaw = extractCssProp(
    css,
    "@page",
    "margin",
    `${fallback.marginV}mm ${fallback.marginH}mm`,
  );
  const marginParts = pageMarginRaw.match(/([\d.]+)/g) ?? [];
  const marginV =
    marginParts.length >= 1 ? parseFloat(marginParts[0] as string) : fallback.marginV;
  const marginH =
    marginParts.length >= 2 ? parseFloat(marginParts[1] as string) : fallback.marginH;

  const contactRenderMode = extractCssProp(
    css,
    ".resume-document",
    "--cv-contact-render",
    fallback.personalInfoMode ?? "text",
  );

  return {
    ...fallback,
    lineHeight: Number.isNaN(lineHeight) ? fallback.lineHeight : lineHeight,
    fontFamily,
    h1Size,
    h2Size,
    h3Size,
    themeColor,
    fontSize,
    dateWeight,
    dateSize,
    paragraphSpacing,
    marginV,
    marginH,
    personalInfoMode: contactRenderMode === "icon" ? "icon" : "text",
  };
};
