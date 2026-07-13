export type WebMProcessingStatus =
  | "ready_for_upload"
  | "backend_processing_required"
  | "invalid_input";

export type WebMProcessingContract = {
  status: WebMProcessingStatus;
  sourceMimeType: string;
  targetMimeType: "video/webm";
  canUploadNow: boolean;
  requiresBackend: boolean;
  message: string;
};

export function evaluateWebMReadiness(file: Pick<File, "type" | "size">): WebMProcessingContract {
  if (!file.type.startsWith("video/") || file.size <= 0) {
    return {
      status: "invalid_input",
      sourceMimeType: file.type,
      targetMimeType: "video/webm",
      canUploadNow: false,
      requiresBackend: false,
      message: "Select a non-empty video file.",
    };
  }
  if (file.type === "video/webm") {
    return {
      status: "ready_for_upload",
      sourceMimeType: file.type,
      targetMimeType: "video/webm",
      canUploadNow: true,
      requiresBackend: false,
      message: "WebM video is ready for upload.",
    };
  }
  return {
    status: "backend_processing_required",
    sourceMimeType: file.type,
    targetMimeType: "video/webm",
    canUploadNow: false,
    requiresBackend: true,
    message: "WebM conversion requires the backend media-processing service; this file was not uploaded.",
  };
}
