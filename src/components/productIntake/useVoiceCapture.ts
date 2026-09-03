import { useRef, useState } from "react";
import { toast } from "sonner";
import { transcriptFromSpeechEvent } from "@/features/fastCreate/intake/voiceTranscript";

export function useVoiceCapture(onTranscript: (text: string) => void) {
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const [listening, setListening] = useState(false);

  const start = () => {
    const SpeechRecognitionCtor = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) {
      toast.error(
        "Speech recognition is not supported in this browser — type the transcript instead.",
      );
      return;
    }

    const recognition = new SpeechRecognitionCtor();
    recognition.lang = "en-IN";
    recognition.interimResults = false;
    recognition.continuous = false;
    recognitionRef.current = recognition;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = transcriptFromSpeechEvent(event);
      if (transcript) onTranscript(transcript);
    };
    recognition.onerror = () => {
      setListening(false);
      toast.error("Voice capture failed — type the transcript manually.");
    };
    recognition.onend = () => {
      setListening(false);
    };

    setListening(true);
    recognition.start();
  };

  const stop = () => {
    recognitionRef.current?.stop();
    setListening(false);
  };

  return { listening, start, stop };
}
