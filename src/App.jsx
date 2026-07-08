import { useMemo, useState } from 'react'
import { recognize } from 'tesseract.js'
import { products } from './data/products'
import './App.css'

const mapParts = [
  {
    wall: 'left',
    labelStart: 1,
    className: 'wall left-wall',
    x: 0,
    y: 0,
    w: 8,
    h: 93,
    segments: 8,
    axis: 'y',
    labelValues: [18, 17, 16, 15, 14, 13, 12, 11],
  },
  {
    wall: 'top',
    labelStart: 19,
    className: 'wall top-wall',
    x: 0,
    y: 0,
    w: 66,
    h: 6,
    segments: 2,
    axis: 'x',
  },
  {
    wall: 'upperRight',
    labelStart: 1,
    className: 'wall upper-right-wall',
    x: 90,
    y: 0,
    w: 8,
    h: 54,
    segments: 4,
    axis: 'y',
  },
  {
    wall: 'middleFront',
    labelStart: 6,
    className: 'wall middle-wall middle-front-wall',
    x: 64,
    y: 42,
    w: 6,
    h: 51,
    segments: 5,
    axis: 'y',
  },
  {
    wall: 'middleBack',
    labelStart: 5,
    className: 'wall middle-wall middle-back-wall',
    x: 70,
    y: 42,
    w: 6,
    h: 51,
    segments: 5,
    axis: 'y',
    labelValues: [5, null, null, null, null],
  },
  { className: 'reserve', x: 76, y: 42, w: 14, h: 58 },
  {
    wall: 'reserveRight',
    className: 'wall reserve-right-wall',
    x: 90,
    y: 54,
    w: 8,
    h: 46,
    segments: 4,
    axis: 'y',
  },
  { className: 'condemned', x: 0, y: 93, w: 70, h: 7 },
]

const roundTableLocation = {
  mapX: 68.5,
  mapY: 38.5,
}

const coverColibriCodes = new Set(['803299997296', '8032919897296', '8032919997296'])
const ocrBarcodeCorrections = new Map([
  ['2006000022625', '2000000023625'],
  ['2000000023637', '2000000023632'],
  ['2088122285071', '3086123285071'],
  ['3085123285071', '3086123285071'],
  ['9782350406259', '9782369406259'],
  ['9782350405242', '9782369406242'],
  ['781210784727', '9782210784727'],
  ['8782385511784', '9782385511784'],
  ['872385511784', '9782385511784'],
  ['782401000445', '9782401000445'],
  ['6782401000445', '9782401000445'],
  ['8732401000445', '9782401000445'],
  ['9732401000445', '9782401000445'],
  ['9752401092266', '9782401092266'],
  ['8722401082268', '9782401092266'],
])

function normalizeOcrCodeCandidate(candidate) {
  return candidate
    .replace(/[Oo]/g, '0')
    .replace(/[Il|]/g, '1')
    .replace(/[Ss]/g, '5')
    .replace(/[BbEe]/g, '8')
    .replace(/[Gg]/g, '6')
    .replace(/\D/g, '')
}

function isCoverColibriCode(candidate) {
  return coverColibriCodes.has(candidate)
}

function extractBarcodeLikeNumbers(text) {
  const normalizedText = text
    .replace(/[Oo]/g, '0')
    .replace(/[Il|]/g, '1')
    .replace(/[Ss]/g, '5')
    .replace(/[Bb]/g, '8')
  const candidates = []

  normalizedText.split('\n').forEach((line) => {
    const compactedLine = line.replace(/\D/g, '')
    const noisyCodeMatches =
      line
        .match(/[0-9OoIl|SsBbGgEe]{12,14}/g)
        ?.map(normalizeOcrCodeCandidate)
        .filter((candidate) => candidate.length >= 12 && candidate.length <= 14) ?? []
    const separatedMatches =
      line
        .match(/(?:\d[\s./|:\][*-]*){12,14}/g)
        ?.map((candidate) => candidate.replace(/\D/g, ''))
        .filter((candidate) => candidate.length >= 12 && candidate.length <= 14) ?? []

    if (compactedLine.length >= 12 && compactedLine.length <= 14) {
      candidates.push(compactedLine)
    }

    candidates.push(...separatedMatches)
    candidates.push(...noisyCodeMatches)
  })

  return Array.from(
    new Set(candidates),
  )
}

function getOcrContextForCode(text, candidate) {
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
  const lineIndex = lines.findIndex((line) => {
    const digits = line.replace(/\D/g, '')

    return digits.includes(candidate) || candidate.includes(digits)
  })

  if (lineIndex === -1) {
    return ''
  }

  const contextLines = lines
    .slice(Math.max(0, lineIndex - 3), lineIndex + 2)
    .filter((line) => /[A-Za-z]/.test(line))
    .filter((line) => line.replace(/\D/g, '').length < 10)

  return contextLines.slice(-2).join(' - ').slice(0, 120)
}

function splitArticleName(name, explicitComment = '') {
  const match = name.match(/^(.*?)\s*\(([^)]+)\)\s*$/)

  if (!match) {
    return {
      displayName: name,
      comment: explicitComment,
    }
  }

  return {
    displayName: match[1].trim(),
    comment: explicitComment || match[2].trim(),
  }
}

function getCandidateVariants(candidate) {
  const variants = new Set([candidate])
  const correctedCandidate = ocrBarcodeCorrections.get(candidate)

  if (correctedCandidate) {
    variants.add(correctedCandidate)
  }

  if (candidate.startsWith('5')) {
    variants.add(`3${candidate.slice(1)}`)
  }

  if (candidate.startsWith('55')) {
    variants.add(candidate.slice(2))
    variants.add(`3${candidate.slice(2)}`)
  }

  if (candidate.length > 13) {
    for (let index = 0; index <= candidate.length - 12; index += 1) {
      variants.add(candidate.slice(index, index + 12))
    }

    for (let index = 0; index <= candidate.length - 13; index += 1) {
      variants.add(candidate.slice(index, index + 13))
    }
  }

  return Array.from(variants)
}

function isOneEditAway(candidate, barcode) {
  if (candidate === barcode) {
    return true
  }

  if (candidate.length === barcode.length) {
    let mismatches = 0

    for (let index = 0; index < candidate.length; index += 1) {
      if (candidate[index] !== barcode[index]) {
        mismatches += 1
      }
    }

    return mismatches <= 1
  }

  if (Math.abs(candidate.length - barcode.length) !== 1) {
    return false
  }

  const shorter = candidate.length < barcode.length ? candidate : barcode
  const longer = candidate.length < barcode.length ? barcode : candidate
  let shortIndex = 0
  let longIndex = 0
  let edits = 0

  while (shortIndex < shorter.length && longIndex < longer.length) {
    if (shorter[shortIndex] === longer[longIndex]) {
      shortIndex += 1
      longIndex += 1
    } else {
      edits += 1
      longIndex += 1
    }
  }

  return edits <= 1
}

function resolveKnownBarcode(candidate) {
  const productsByBarcode = new Map(products.map((product) => [product.codeBarres, product]))
  const knownBarcodes = products.map((product) => product.codeBarres)
  const candidateVariants = getCandidateVariants(candidate)

  const exactMatch = candidateVariants.find((variant) => knownBarcodes.includes(variant))

  if (exactMatch) {
    return exactMatch
  }

  const leadingZeroMatch = candidateVariants
    .filter((variant) => variant.length === 12)
    .map((variant) => `0${variant}`)
    .find((variant) => knownBarcodes.includes(variant))

  if (leadingZeroMatch) {
    return leadingZeroMatch
  }

  const containingMatch = knownBarcodes.find(
    (barcode) => {
      const product = productsByBarcode.get(barcode)

      return candidateVariants.some((variant) => {
        if (product?.type === 'manual') {
          return variant.includes(barcode)
        }

        return variant.includes(barcode) || barcode.includes(variant)
      })
    },
  )

  if (containingMatch) {
    return containingMatch
  }

  const closeMatches = knownBarcodes.filter((barcode) =>
    productsByBarcode.get(barcode)?.type !== 'manual' &&
    candidateVariants.some((variant) => isOneEditAway(variant, barcode)),
  )

  return closeMatches.length === 1 ? closeMatches[0] : null
}

function preparePrintedListCodesForOcr(bitmap) {
  const cropX = Math.floor(bitmap.width * 0.13)
  const cropY = Math.floor(bitmap.height * 0.03)
  const cropWidth = Math.floor(bitmap.width * 0.45)
  const cropHeight = Math.floor(bitmap.height * 0.95)
  const maxHeight = 2600
  const scale = Math.min(2.2, maxHeight / cropHeight)
  const canvas = document.createElement('canvas')

  canvas.width = Math.max(1, Math.floor(cropWidth * scale))
  canvas.height = Math.max(1, Math.floor(cropHeight * scale))

  const context = canvas.getContext('2d', { willReadFrequently: true })

  context.imageSmoothingEnabled = false
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.drawImage(
    bitmap,
    cropX,
    cropY,
    cropWidth,
    cropHeight,
    0,
    0,
    canvas.width,
    canvas.height,
  )

  const imageData = context.getImageData(0, 0, canvas.width, canvas.height)
  const { data } = imageData

  for (let index = 0; index < data.length; index += 4) {
    const gray = data[index] * 0.299 + data[index + 1] * 0.587 + data[index + 2] * 0.114
    const contrasted = gray < 170 ? 0 : 255

    data[index] = contrasted
    data[index + 1] = contrasted
    data[index + 2] = contrasted
  }

  context.putImageData(imageData, 0, 0)

  return canvas
}

function buildPickingList(listLines = [], options = {}) {
  const productsByBarcode = new Map(
    products.map((product) => [product.codeBarres, product]),
  )

  return listLines
    .map((line) => {
      const resolvedCode = resolveKnownBarcode(line.codeBarres)
      const product = resolvedCode ? productsByBarcode.get(resolvedCode) : null

      if (!product) {
        return null
      }

      return {
        ...product,
        quantite: line.quantite,
        aCouvrir: product.type === 'manual' ? Boolean(options.aCouvrir) : product.aCouvrir,
        mapX: product.shelf?.slot ? product.mapX : roundTableLocation.mapX,
        mapY: product.shelf?.slot ? product.mapY : roundTableLocation.mapY,
        validated: false,
        skipped: false,
      }
    })
    .filter(Boolean)
    .sort((first, second) => getPickingOrder(first) - getPickingOrder(second))
}

function getPickingOrder(article) {
  return article.shelf?.number === 0 ? 10_000 : article.order
}

function getActivePickingArticles(articles) {
  const activeStoreArticles = articles.filter(
    (article) =>
      article.type !== 'manual' &&
      article.type !== 'cover' &&
      !article.validated &&
      !article.skipped,
  )
  const activeManualArticles = articles.filter(
    (article) => article.type === 'manual' && !article.validated && !article.skipped,
  )

  return activeStoreArticles.length > 0 ? activeStoreArticles : activeManualArticles
}

function buildCoverColibriArticle(quantity = 0) {
  if (!quantity) {
    return null
  }

  return {
    id: 'cover-colibri',
    nom: 'Couverture Colibri',
    codeBarres: '8032919897296',
    quantite: quantity,
    type: 'cover',
    commentaire: '',
    aCouvrir: false,
    zone: 'Manuels',
    shelf: {
      wall: 'roundTable',
      slot: 0,
      number: 0,
    },
    mapX: roundTableLocation.mapX,
    mapY: roundTableLocation.mapY,
    order: 1000,
    validated: true,
    skipped: false,
  }
}

function getCoverColibriQuantity(articles, detectedQuantity = 0) {
  const manualCoverQuantity = articles
    .filter((article) => article.type === 'manual' && article.aCouvrir)
    .reduce((sum, article) => sum + article.quantite, 0)

  return Math.max(detectedQuantity, manualCoverQuantity)
}

function buildRecognitionDiagnostics(detectedCandidates) {
  const orderedCandidates = [...detectedCandidates].sort(
    (first, second) => first.orderIndex - second.orderIndex,
  )
  const candidatesByCode = orderedCandidates.reduce((codes, candidate) => {
    const existingCandidate = codes.get(candidate.code)

    codes.set(candidate.code, {
      ...candidate,
      contexts: Array.from(
        new Set([
          ...(existingCandidate?.contexts ?? []),
          candidate.context,
        ].filter(Boolean)),
      ),
      orderIndex: existingCandidate?.orderIndex ?? candidate.orderIndex,
      sources: Array.from(
        new Set([...(existingCandidate?.sources ?? []), candidate.source]),
      ),
      count: (existingCandidate?.count ?? 0) + 1,
    })

    return codes
  }, new Map())
  const receivedCodes = Array.from(candidatesByCode.values()).sort(
    (first, second) => first.orderIndex - second.orderIndex,
  )
  const matchedCodesByBarcode = new Map()

  receivedCodes.forEach((candidate) => {
    if (!candidate.resolvedCode) {
      return
    }

    const product = products.find(
      (currentProduct) => currentProduct.codeBarres === candidate.resolvedCode,
    )

    matchedCodesByBarcode.set(candidate.resolvedCode, {
      codeBarres: candidate.resolvedCode,
      nom: product?.nom ?? 'Produit sans nom',
      orderIndex:
        matchedCodesByBarcode.get(candidate.resolvedCode)?.orderIndex ?? candidate.orderIndex,
      sources: Array.from(
        new Set([
          ...(matchedCodesByBarcode.get(candidate.resolvedCode)?.sources ?? []),
          ...candidate.sources,
        ]),
      ),
    })
  })

  return {
    receivedCodes,
    matchedCodes: Array.from(matchedCodesByBarcode.values()).sort(
      (first, second) => first.orderIndex - second.orderIndex,
    ),
    unknownCodes: receivedCodes.filter((candidate) => !candidate.resolvedCode),
  }
}

function mergeListLines(listLines) {
  return Array.from(
    listLines.reduce((linesByCode, line) => {
      const { codeBarres, quantite } = line
      const currentLine = linesByCode.get(codeBarres)

      linesByCode.set(codeBarres, {
        codeBarres,
        quantite: currentLine ? currentLine.quantite + quantite : quantite,
      })

      return linesByCode
    }, new Map()).values(),
  )
}

function findProductFromSearch(searchValue) {
  const query = searchValue.trim()
  const digits = query.replace(/\D/g, '')
  const resolvedCode = digits ? resolveKnownBarcode(digits) : null

  return products.find(
    (product) =>
      product.codeBarres === resolvedCode ||
      product.codeBarres === digits ||
      product.id.toLowerCase() === query.toLowerCase(),
  )
}

async function recognizeListFromPhotos(photoFiles) {
  const barcodeDetector =
    'BarcodeDetector' in window
      ? new window.BarcodeDetector({
          formats: ['ean_13', 'ean_8', 'code_128', 'upc_a'],
        })
      : null
  const detectedLines = []
  const detectedCandidates = []
  const photoResults = []
  let coverColibriDetected = false
  let coverColibriQuantity = 0
  let candidateOrder = 0

  for (const file of photoFiles) {
    const bitmap = await createImageBitmap(file)
    const codesFromPhoto = new Set()

    if (barcodeDetector) {
      const barcodes = (await barcodeDetector.detect(bitmap)).sort((first, second) => {
        const firstBox = first.boundingBox ?? { top: 0, left: 0 }
        const secondBox = second.boundingBox ?? { top: 0, left: 0 }

        return firstBox.top - secondBox.top || firstBox.left - secondBox.left
      })

      barcodes.forEach((barcode) => {
        const rawCode = barcode.rawValue.replace(/\D/g, '')
        const codeBarres = resolveKnownBarcode(rawCode)

        if (rawCode) {
          if (isCoverColibriCode(rawCode)) {
            coverColibriDetected = true
            coverColibriQuantity = Math.max(coverColibriQuantity, 1)
            return
          }

          detectedCandidates.push({
            code: rawCode,
            context: 'Code-barres detecte',
            orderIndex: candidateOrder,
            resolvedCode: codeBarres,
            source: 'code-barres',
          })
          candidateOrder += 1
        }

        if (codeBarres) {
          codesFromPhoto.add(codeBarres)
        }
      })

    }

    const ocrImages = [
      preparePrintedListCodesForOcr(bitmap),
    ]
    const ocrResults = await Promise.all(
      ocrImages.map((ocrImage, index) =>
        recognize(
          ocrImage,
          'eng',
          {
            logger: () => {},
            tessedit_pageseg_mode: index === 0 ? '11' : '6',
          },
        ),
      ),
    )
    bitmap.close?.()
    const ocrTexts = ocrResults.map((ocrResult) => ocrResult.data.text)

    ocrTexts.forEach((currentOcrText) => {
      extractBarcodeLikeNumbers(currentOcrText).forEach((candidate) => {
        if (isCoverColibriCode(candidate)) {
          coverColibriDetected = true
          coverColibriQuantity = Math.max(coverColibriQuantity, 1)
          return
        }

        const codeBarres = resolveKnownBarcode(candidate)
        const shouldShowCandidate = codeBarres || candidate.length === 12 || candidate.length === 13

        if (shouldShowCandidate) {
          detectedCandidates.push({
            code: candidate,
            context: getOcrContextForCode(currentOcrText, candidate),
            orderIndex: candidateOrder,
            resolvedCode: codeBarres,
            source: 'OCR codes',
          })
          candidateOrder += 1
        }

        if (codeBarres) {
          codesFromPhoto.add(codeBarres)
        }
      })
    })

    const photoLines = Array.from(codesFromPhoto).map((codeBarres) => ({
        codeBarres,
        quantite: 1,
      }))

    photoResults.push({
      fileName: file.name,
      lines: photoLines,
      validated: false,
    })
    detectedLines.push(...photoLines)
  }

  const lines = mergeListLines(detectedLines)

  return {
    lines,
    coverColibriDetected,
    coverColibriQuantity,
    photoResults,
    diagnostics: buildRecognitionDiagnostics(detectedCandidates),
  }
}

function StoreMap({ mapX, mapY }) {
  return (
    <div className="store-plan">
      {mapParts.map((part) => (
        <div
          className={`map-part ${part.className}`}
          key={`${part.className}-${part.x}-${part.y}`}
          style={{
            left: `${part.x}%`,
            top: `${part.y}%`,
            width: `${part.w}%`,
            height: `${part.h}%`,
          }}
        >
          {part.segments &&
            Array.from({ length: part.segments - 1 }, (_, index) => (
              <span
                className={`shelf-separator separator-${part.axis}`}
                key={`${part.className}-separator-${index}`}
                style={{ '--separator-position': `${((index + 1) / part.segments) * 100}%` }}
              />
            ))}
          {part.segments &&
            (part.labelStart != null || part.labelValues) &&
            Array.from({ length: part.segments }, (_, index) => {
              const label = part.labelValues ? part.labelValues[index] : part.labelStart + index

              return label == null ? null : (
                <span
                  className={`shelf-label label-${part.axis}`}
                  key={`${part.wall}-label-${index}`}
                  style={{
                    '--label-position': `${((index + 0.5) / part.segments) * 100}%`,
                  }}
                >
                  {label}
                </span>
              )
            })}
        </div>
      ))}

      <div className="white-circle">
        <span>0</span>
      </div>

      {mapX != null && mapY != null && (
        <div
          className="target-dot"
          style={{
            left: `${mapX}%`,
            top: `${mapY}%`,
          }}
        />
      )}
    </div>
  )
}

function HomeButton({ onGoHome }) {
  return (
    <button className="home-button" type="button" onClick={onGoHome}>
      Accueil
    </button>
  )
}

function HomeScreen({ onOpenList }) {
  return (
    <main className="home-screen">
      <section className="home-panel">
        <p className="home-kicker">ArsUna</p>
        <h1>Préparation des listes scolaires</h1>
        <button className="open-list-action" type="button" onClick={onOpenList}>
          Ouvrir une liste type
        </button>
      </section>
    </main>
  )
}

function PhotoCaptureScreen({ onAnalyzePhotos, onGoHome }) {
  const [photoFiles, setPhotoFiles] = useState([])
  const [analysisMessage, setAnalysisMessage] = useState('')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const photoPreviews = useMemo(
    () =>
      photoFiles.map((file) => ({
        name: file.name,
        url: URL.createObjectURL(file),
      })),
    [photoFiles],
  )

  function handlePhotoChange(event) {
    setPhotoFiles(Array.from(event.target.files ?? []))
    setAnalysisMessage('')
  }

  async function analyzePhotos() {
    if (photoFiles.length === 0) {
      setAnalysisMessage('Ajoute au moins une photo de liste.')
      return
    }

    setIsAnalyzing(true)
    setAnalysisMessage('Analyse en cours...')

    try {
      const analysisResult = await recognizeListFromPhotos(photoFiles)

      if (!onAnalyzePhotos(analysisResult)) {
        setAnalysisMessage('Codes detectes, mais aucun ne correspond a la base produits.')
      }
    } catch {
      setAnalysisMessage('La reconnaissance a echoue sur ces photos.')
    } finally {
      setIsAnalyzing(false)
    }
  }

  return (
    <main className="photo-screen">
      <HomeButton onGoHome={onGoHome} />
      <section className="photo-panel">
        <div>
          <p className="home-kicker">Liste scolaire</p>
          <h1>Photos de la liste</h1>
        </div>

        <label className="photo-input">
          <input
            accept="image/*"
            multiple
            onChange={handlePhotoChange}
            type="file"
          />
          Choisir des photos
        </label>

        <div className="photo-strip" aria-label="Photos sélectionnées">
          {photoPreviews.length === 0 ? (
            <div className="empty-photo">0 photo</div>
          ) : (
            photoPreviews.map((photo) => (
              <img alt={photo.name} key={photo.url} src={photo.url} />
            ))
          )}
        </div>

        <button className="open-list-action" type="button" onClick={analyzePhotos}>
          {isAnalyzing ? 'Analyse...' : 'Analyser les photos'}
        </button>

        {analysisMessage && <p className="analysis-message">{analysisMessage}</p>}
      </section>
    </main>
  )
}

function PageReviewScreen({ analysisResult, onBackToPhotos, onGoHome, onOpenPicking }) {
  const initialPhotoResults =
    analysisResult.photoResults?.length > 0
      ? analysisResult.photoResults
      : [{ fileName: 'Page 1', lines: analysisResult.lines, validated: false }]
  const [pageIndex, setPageIndex] = useState(0)
  const [photoResults, setPhotoResults] = useState(() =>
    initialPhotoResults.map((photoResult, index) => ({
      ...photoResult,
      id: photoResult.id ?? `${photoResult.fileName}-${index}`,
      lines: photoResult.lines.map((line) => ({ ...line, quantite: Math.max(1, line.quantite) })),
    })),
  )
  const [addInput, setAddInput] = useState('')
  const [addMessage, setAddMessage] = useState('')
  const currentPhoto = photoResults[pageIndex] ?? photoResults[0]
  const isLastPage = pageIndex === photoResults.length - 1
  const reviewedLines = useMemo(
    () => mergeListLines(photoResults.flatMap((photoResult) => photoResult.lines)),
    [photoResults],
  )

  function changePageLineQuantity(codeBarres, delta) {
    setPhotoResults((currentPhotoResults) =>
      currentPhotoResults.map((photoResult, currentIndex) => {
        if (currentIndex !== pageIndex) {
          return photoResult
        }

        return {
          ...photoResult,
          lines: photoResult.lines.map((line) =>
            line.codeBarres === codeBarres
              ? { ...line, quantite: Math.max(1, line.quantite + delta) }
              : line,
          ),
        }
      }),
    )
  }

  function removeArticleFromCurrentPage(codeBarres) {
    setPhotoResults((currentPhotoResults) =>
      currentPhotoResults.map((photoResult, currentIndex) =>
        currentIndex === pageIndex
          ? {
              ...photoResult,
              lines: photoResult.lines.filter((line) => line.codeBarres !== codeBarres),
            }
          : photoResult,
      ),
    )
    setAddMessage('')
  }

  function addArticleToCurrentPage() {
    const product = findProductFromSearch(addInput)

    if (!product) {
      setAddMessage('Code introuvable dans la base.')
      return
    }

    setPhotoResults((currentPhotoResults) =>
      currentPhotoResults.map((photoResult, currentIndex) => {
        if (currentIndex !== pageIndex) {
          return photoResult
        }

        const existingLine = photoResult.lines.find((line) => line.codeBarres === product.codeBarres)
        const nextLines = existingLine
          ? photoResult.lines.map((line) =>
              line.codeBarres === product.codeBarres
                ? { ...line, quantite: line.quantite + 1 }
                : line,
            )
          : [...photoResult.lines, { codeBarres: product.codeBarres, quantite: 1 }]

        return { ...photoResult, lines: nextLines }
      }),
    )
    setAddInput('')
    setAddMessage(`${product.nom} ajoute.`)
  }

  function goToNextPage() {
    setAddInput('')
    setAddMessage('')

    if (!isLastPage) {
      setPageIndex((currentIndex) => currentIndex + 1)
      return
    }

    onOpenPicking({
      ...analysisResult,
      lines: reviewedLines,
      photoResults,
    })
  }

  return (
    <main className="page-review-screen">
      <HomeButton onGoHome={onGoHome} />
      <section className="page-review-panel">
        <div className="page-review-topbar">
          <button className="secondary-action" type="button" onClick={onBackToPhotos}>
            Refaire
          </button>
          <span>
            Page {pageIndex + 1} / {photoResults.length}
          </span>
        </div>

        <h1>Page {pageIndex + 1}</h1>

        <div className="review-add-row">
          <input
            inputMode="numeric"
            placeholder="Ajouter un code"
            value={addInput}
            onChange={(event) => {
              setAddInput(event.target.value)
              setAddMessage('')
            }}
          />
          <button aria-label="Ajouter l'article" type="button" onClick={addArticleToCurrentPage}>
            +
          </button>
        </div>
        {addMessage && <p className="review-add-message">{addMessage}</p>}

        <div className="review-page-list" aria-label={`Articles de la page ${pageIndex + 1}`}>
          {currentPhoto.lines.length === 0 ? (
            <p className="review-empty">Aucun code connu reconnu sur cette page.</p>
          ) : (
            currentPhoto.lines.map((line) => {
              const product = products.find(
                (currentProduct) => currentProduct.codeBarres === line.codeBarres,
              )

              return (
                <article className="review-line" key={line.codeBarres}>
                  <div className="review-quantity">
                    <button
                      aria-label="Retirer une quantite"
                      disabled={line.quantite <= 1}
                      type="button"
                      onClick={() => changePageLineQuantity(line.codeBarres, -1)}
                    >
                      -
                    </button>
                    <strong>{line.quantite}</strong>
                    <button
                      aria-label="Ajouter une quantite"
                      type="button"
                      onClick={() => changePageLineQuantity(line.codeBarres, 1)}
                    >
                      +
                    </button>
                  </div>
                  <div className="review-item-text">
                    <strong>{product?.nom ?? 'Article reconnu'}</strong>
                    <code>{line.codeBarres}</code>
                  </div>
                  <button
                    className="review-line-remove"
                    aria-label="Supprimer l'article"
                    type="button"
                    onClick={() => removeArticleFromCurrentPage(line.codeBarres)}
                  >
                    x
                  </button>
                </article>
              )
            })
          )}
        </div>

        <button className="review-next-action" type="button" onClick={goToNextPage}>
          {'>'}
        </button>
      </section>
    </main>
  )
}

function SummaryRow({ article }) {
  const articleName = splitArticleName(article.nom, article.commentaire)

  return (
    <div className="missing-row" key={article.id}>
      <strong>{articleName.displayName}</strong>
      <span>x{article.quantite}</span>
      <code>{article.codeBarres}</code>
      {articleName.comment && <small>{articleName.comment}</small>}
    </div>
  )
}

function MissingSummary({ articles, missingManualArticles, missingArticles, onGoHome }) {
  const totalQuantity = articles.reduce((sum, article) => sum + article.quantite, 0)
  const totalMissing =
    missingManualArticles.length + missingArticles.length

  return (
    <main className="summary-screen">
      <HomeButton onGoHome={onGoHome} />
      <section className="summary-panel">
        <p className="status-badge done-badge">TERMINE</p>
        <h1>Liste terminee</h1>
        <p className="summary-count">
          {totalQuantity} item{totalQuantity > 1 ? 's' : ''} traites / {articles.length} article
          {articles.length > 1 ? 's' : ''}
        </p>
        {totalMissing === 0 && (
          <div className="summary-empty">
            <strong>Tout est pris.</strong>
            <span>Aucun manuel ou article manquant.</span>
          </div>
        )}
        {missingManualArticles.length > 0 && (
          <>
            <p className="summary-count">
              {missingManualArticles.length} manuel{missingManualArticles.length > 1 ? 's' : ''}{' '}
              manquant{missingManualArticles.length > 1 ? 's' : ''}
            </p>
            <div className="missing-list" aria-label="Manuels">
              {missingManualArticles.map((article) => (
                <SummaryRow article={article} key={article.id} />
              ))}
            </div>
          </>
        )}
        <p className="summary-count">
          {missingArticles.length === 0
            ? 'Aucun article manquant.'
            : `${missingArticles.length} article${missingArticles.length > 1 ? 's' : ''} manquant${missingArticles.length > 1 ? 's' : ''}`}
        </p>
        {missingArticles.length > 0 && (
          <div className="missing-list" aria-label="Articles manquants">
            {missingArticles.map((article) => (
              <SummaryRow article={article} key={article.id} />
            ))}
          </div>
        )}
      </section>
    </main>
  )
}

function PickingScreen({
  articles,
  activeIndex,
  canRedo,
  canUndo,
  onRedo,
  onSetActiveIndex,
  onMarkArticle,
  onGoHome,
  onUndo,
}) {
  const totalQuantity = articles.reduce((sum, article) => sum + article.quantite, 0)
  const activeArticles = getActivePickingArticles(articles)
  const missingManualArticles = articles.filter(
    (article) => article.type === 'manual' && article.skipped,
  )
  const missingArticles = articles.filter(
    (article) => article.type !== 'manual' && article.type !== 'cover' && article.skipped,
  )

  if (activeArticles.length === 0) {
    return (
      <MissingSummary
        articles={articles}
        missingManualArticles={missingManualArticles}
        missingArticles={missingArticles}
        onGoHome={onGoHome}
      />
    )
  }

  const safeIndex = Math.max(0, Math.min(activeIndex, activeArticles.length - 1))
  const currentArticle = activeArticles[safeIndex]
  const articleName = splitArticleName(currentArticle.nom, currentArticle.commentaire)

  function goToPrevious() {
    onSetActiveIndex(Math.max(safeIndex - 1, 0))
  }

  function goToNext() {
    onSetActiveIndex(Math.min(safeIndex + 1, activeArticles.length - 1))
  }

  function markCurrent(statusKey) {
    onMarkArticle(currentArticle.id, statusKey, safeIndex)
    onSetActiveIndex(Math.max(0, Math.min(safeIndex, activeArticles.length - 2)))
  }

  return (
    <main className="order-screen">
      <div className="history-controls" aria-label="Historique">
        <button
          className={!canUndo ? 'is-disabled' : ''}
          type="button"
          onClick={onUndo}
          disabled={!canUndo}
          aria-disabled={!canUndo}
          aria-label="Annuler"
        >
          ↶
        </button>
        <button
          className={!canRedo ? 'is-disabled' : ''}
          type="button"
          onClick={onRedo}
          disabled={!canRedo}
          aria-disabled={!canRedo}
          aria-label="Retablir"
        >
          ↷
        </button>
      </div>
      <HomeButton onGoHome={onGoHome} />
      <section className="article-column" aria-label="Article à préparer">
        <div className="status-badge">À PRENDRE</div>

        <p className="article-count">
          Article {safeIndex + 1} / {activeArticles.length}
        </p>
        <p className="total-count">
          Total : {totalQuantity} item{totalQuantity > 1 ? 's' : ''} / {articles.length} article
          {articles.length > 1 ? 's' : ''}
        </p>

        <h1>{articleName.displayName}</h1>
        {articleName.comment && <p className="article-comment">{articleName.comment}</p>}
        {currentArticle.type === 'manual' && (
          <p className="manual-cover-status">
            Couverture Colibri :{' '}
            <b className={currentArticle.aCouvrir ? 'cover-yes' : 'cover-no'}>
              {currentArticle.aCouvrir ? 'oui' : 'non'}
            </b>
          </p>
        )}

        <div className="quantity-block">
          <span>Quantité</span>
          <strong>{currentArticle.quantite}</strong>
        </div>

        <div className="barcode-block">
          <span>Code-barres</span>
          <strong>
            {currentArticle.codeBarres.slice(0, -4)}
            <em>{currentArticle.codeBarres.slice(-4)}</em>
          </strong>
        </div>
      </section>

      <section className="store-plan-panel" aria-label="Plan global du magasin">
        <StoreMap mapX={currentArticle.mapX} mapY={currentArticle.mapY} />
      </section>

      <nav className="bottom-nav" aria-label="Navigation de préparation">
        <button type="button" onClick={goToPrevious} disabled={safeIndex === 0}>
          Précédent
        </button>
        <button className="taken-action" type="button" onClick={() => markCurrent('validated')}>
          Pris
        </button>
        <button className="missing-action" type="button" onClick={() => markCurrent('skipped')}>
          Manquant
        </button>
        <button
          type="button"
          onClick={goToNext}
          disabled={safeIndex === activeArticles.length - 1}
        >
          Suivant
        </button>
      </nav>
    </main>
  )
}

function App() {
  const [screen, setScreen] = useState('home')
  const [articles, setArticles] = useState([])
  const [activeIndex, setActiveIndex] = useState(0)
  const [analysisResult, setAnalysisResult] = useState(null)
  const [undoStack, setUndoStack] = useState([])
  const [redoStack, setRedoStack] = useState([])

  function openDemoList() {
    setScreen('photos')
  }

  function openReview(nextAnalysisResult) {
    setAnalysisResult(nextAnalysisResult)
    setScreen('review')
    return true
  }

  function openRecognizedList(nextAnalysisResult = analysisResult) {
    const recognizedArticles = buildPickingList(nextAnalysisResult?.lines ?? [], {
      aCouvrir: nextAnalysisResult?.coverColibriDetected ?? false,
    })
    const coverColibriQuantity = getCoverColibriQuantity(
      recognizedArticles,
      nextAnalysisResult?.coverColibriQuantity ?? 0,
    )
    const coverColibriArticle = buildCoverColibriArticle(coverColibriQuantity)
    const nextArticles = coverColibriArticle
      ? [...recognizedArticles, coverColibriArticle]
      : recognizedArticles

    if (nextArticles.length === 0) {
      return false
    }

    setAnalysisResult(nextAnalysisResult)
    setArticles(nextArticles.map((article) => ({ ...article })))
    setActiveIndex(0)
    setUndoStack([])
    setRedoStack([])
    setScreen('picking')
    return true
  }

  function goHome() {
    setScreen('home')
    setActiveIndex(0)
    setAnalysisResult(null)
    setUndoStack([])
    setRedoStack([])
  }

  function markArticle(articleId, statusKey, visibleIndex = 0) {
    setArticles((currentArticles) => {
      const currentArticle = currentArticles.find((article) => article.id === articleId)

      if (!currentArticle) {
        return currentArticles
      }

      const action = {
        articleId,
        visibleIndex,
        previous: {
          validated: currentArticle.validated,
          skipped: currentArticle.skipped,
        },
        next: {
          validated: statusKey === 'validated' ? true : currentArticle.validated,
          skipped: statusKey === 'skipped' ? true : currentArticle.skipped,
        },
      }

      setUndoStack((currentStack) => [...currentStack.slice(-9), action])
      setRedoStack([])

      return currentArticles.map((article) =>
        article.id === articleId
          ? { ...article, ...action.next }
          : article,
      )
    })
  }

  function undoLastAction() {
    const action = undoStack.at(-1)

    if (!action) {
      return
    }

    setUndoStack((currentStack) => currentStack.slice(0, -1))
    setRedoStack((currentStack) => [...currentStack.slice(-9), action])
    setArticles((currentArticles) => {
      const nextArticles = currentArticles.map((article) =>
        article.id === action.articleId
          ? { ...article, ...action.previous }
          : article,
      )
      const activeArticles = getActivePickingArticles(nextArticles)
      const restoredIndex = activeArticles.findIndex((article) => article.id === action.articleId)

      setActiveIndex(Math.max(0, restoredIndex))

      return nextArticles
    })
  }

  function redoLastAction() {
    const action = redoStack.at(-1)

    if (!action) {
      return
    }

    setRedoStack((currentStack) => currentStack.slice(0, -1))
    setUndoStack((currentStack) => [...currentStack.slice(-9), action])
    setArticles((currentArticles) => {
      const nextArticles = currentArticles.map((article) =>
        article.id === action.articleId
          ? { ...article, ...action.next }
          : article,
      )
      const activeArticles = getActivePickingArticles(nextArticles)

      setActiveIndex(Math.max(0, Math.min(action.visibleIndex, activeArticles.length - 1)))

      return nextArticles
    })
  }

  if (screen === 'home') {
    return <HomeScreen onOpenList={openDemoList} />
  }

  if (screen === 'photos') {
    return (
      <PhotoCaptureScreen
        onAnalyzePhotos={openReview}
        onGoHome={goHome}
      />
    )
  }

  if (screen === 'review' && analysisResult) {
    return (
      <PageReviewScreen
        analysisResult={analysisResult}
        onBackToPhotos={() => setScreen('photos')}
        onGoHome={goHome}
        onOpenPicking={openRecognizedList}
      />
    )
  }

  return (
    <PickingScreen
      activeIndex={activeIndex}
      articles={articles}
      canRedo={redoStack.length > 0}
      canUndo={undoStack.length > 0}
      onGoHome={goHome}
      onMarkArticle={markArticle}
      onRedo={redoLastAction}
      onSetActiveIndex={setActiveIndex}
      onUndo={undoLastAction}
    />
  )
}

export default App

