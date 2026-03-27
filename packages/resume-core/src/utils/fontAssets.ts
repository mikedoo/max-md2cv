import pingFangScRegularWoff2Url from '../assets/fonts/PingFangSC-Regular.woff2'

const buildPingFangFontFaceCss = (src: string) => `
  @font-face {
    font-family: 'PingFang SC';
    src: url('${src}') format('woff2');
    font-style: normal;
    font-weight: 400;
    font-display: swap;
  }
`

export const pingFangFontFaceCss = buildPingFangFontFaceCss(pingFangScRegularWoff2Url)

let pingFangFontReadyPromise: Promise<void> | null = null

const normalizeFontFamilyName = (fontFamily: string) =>
  fontFamily.trim().replace(/^['"]|['"]$/g, '')

const getRequestedFontFamilies = (fontFamily: string) =>
  fontFamily
    .split(',')
    .map(normalizeFontFamilyName)
    .filter(Boolean)

const hasLoadedPingFangFace = () => {
  if (typeof document === 'undefined' || !('fonts' in document)) {
    return false
  }

  return Array.from(document.fonts).some((fontFace) => {
    return normalizeFontFamilyName(fontFace.family).toLowerCase() === 'pingfang sc'
      && fontFace.status === 'loaded'
  })
}

export const ensurePingFangFontReady = async () => {
  if (
    typeof document === 'undefined'
    || typeof FontFace === 'undefined'
    || !('fonts' in document)
  ) {
    return
  }

  if (hasLoadedPingFangFace()) {
    return
  }

  if (!pingFangFontReadyPromise) {
    const fontFace = new FontFace(
      'PingFang SC',
      `url(${pingFangScRegularWoff2Url}) format('woff2')`,
      {
        style: 'normal',
        weight: '400',
      },
    )

    document.fonts.add(fontFace)
    pingFangFontReadyPromise = fontFace.load().then(() => undefined).catch((error) => {
      pingFangFontReadyPromise = null
      throw error
    })
  }

  await pingFangFontReadyPromise
}

export const ensurePreviewFontsReady = async (
  fontFamily: string,
  fontSize: number,
) => {
  if (typeof document === 'undefined' || !('fonts' in document)) {
    return
  }

  const families = getRequestedFontFamilies(fontFamily)
  if (families.some((family) => family.toLowerCase() === 'pingfang sc')) {
    await ensurePingFangFontReady()
  }

  const sampleFamilies = Array.from(new Set([...families.slice(0, 2), 'Manrope']))
  await Promise.all(
    sampleFamilies.map(async (family) => {
      try {
        await document.fonts.load(`${Math.max(fontSize, 12)}px "${family}"`)
      } catch (error) {
        console.warn(`Failed to preload font family: ${family}`, error)
      }
    }),
  )

  try {
    await document.fonts.ready
  } catch (error) {
    console.warn('Failed to await document fonts readiness', error)
  }
}

const blobToDataUrl = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read font blob'))
    reader.readAsDataURL(blob)
  })

export const getInlinePingFangFontFaceCss = async (): Promise<string> => {
  const response = await fetch(pingFangScRegularWoff2Url)
  if (!response.ok) {
    throw new Error(`Failed to fetch embedded PingFang font: ${response.status}`)
  }

  const blob = await response.blob()
  const dataUrl = await blobToDataUrl(blob)
  return buildPingFangFontFaceCss(dataUrl)
}
