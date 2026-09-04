export function transcriptFromSpeechEvent(event: SpeechRecognitionEvent): string {
  const parts: string[] = [];
  for (let i = event.resultIndex; i < event.results.length; i += 1) {
    const result = event.results.item(i);
    if (!result || result.length === 0) continue;
    const alternative = result.item(0);
    if (alternative?.transcript) parts.push(alternative.transcript);
  }
  return parts.join(" ").trim();
}
