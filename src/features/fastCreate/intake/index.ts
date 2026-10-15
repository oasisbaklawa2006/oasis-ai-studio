export { normalizeBarcodeInput } from "./barcodeChecksum";
export { intakeFromBarcode } from "./barcodeIntake";

export { suggestionListKey } from "./intakeFieldSuggestion";
export { intakeFromOcrText, prepareOcrIntakeFromImage } from "./ocrIntake";
export { setOcrPixelExtractorForTests } from "./ocrPixelExtract";
export {
  applyIntakeToDraft,
  intakeBlocksDraftApply,
} from "./parsedFieldsMapping";
export { parseProductText } from "./productTextParser";
export { intakeFromText, intakeFromVoiceTranscript } from "./textIntake";
export type { ProductIntakeResult } from "./types";
