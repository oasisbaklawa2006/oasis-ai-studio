export type { ProductIntakeMode, ProductIntakeResult, ProductIntakeFieldSuggestion } from "./types";
export { normalizeBarcodeInput } from "./normalizeBarcode";
export { parseProductText } from "./parseProductText";
export { lookupBarcodeInCatalog, toDuplicateHit } from "./barcodeLookup";
export { intakeFromBarcode } from "./barcodeIntake";
export { intakeFromText, intakeFromVoiceTranscript } from "./textIntake";
export { extractOcrCandidateText, intakeFromOcrText, prepareOcrIntakeFromImage } from "./ocrIntake";
export { applyIntakeToDraft, intakeBlocksDraftApply } from "./applyIntakeResult";
