export { type BarcodeNormalization, normalizeBarcodeInput } from "./barcodeChecksum";
export { intakeFromBarcode } from "./barcodeIntake";
export {
  type BarcodeCatalogLookupResult,
  lookupBarcodeInCatalog,
  toDuplicateHit,
} from "./barcodeLookup";
export { suggestionListKey } from "./intakeFieldSuggestion";
export { intakeFromOcrText, prepareOcrIntakeFromImage } from "./ocrIntake";
export { extractOcrTextFromImagePixels, setOcrPixelExtractorForTests } from "./ocrPixelExtract";
export {
  applyIntakeToDraft,
  draftFieldValuesFromSuggestions,
  intakeBlocksDraftApply,
  parsedFieldsToDraft,
  parsedFieldsToSuggestions,
} from "./parsedFieldsMapping";
export { parseProductText } from "./productTextParser";
export { intakeFromText, intakeFromVoiceTranscript } from "./textIntake";
export type { ProductIntakeFieldSuggestion, ProductIntakeMode, ProductIntakeResult } from "./types";
