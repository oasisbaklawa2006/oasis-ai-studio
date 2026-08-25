import { useEffect, useRef, useState } from "react";
import {
  type BuildKnowledgePublicationCandidateInput,
  buildKnowledgePublicationCandidate,
  knowledgeContentChecksum,
} from "./knowledgeBundle";

export function useKnowledgePublicationCandidate(
  input: BuildKnowledgePublicationCandidateInput | null,
) {
  const [checksum, setChecksum] = useState("");
  const [publicationJson, setPublicationJson] = useState("Preparing publication candidate…");
  const publicationGenerationRef = useRef(0);

  useEffect(() => {
    if (!input) {
      setChecksum("");
      setPublicationJson("Preparing publication candidate…");
      return;
    }
    const generation = publicationGenerationRef.current + 1;
    publicationGenerationRef.current = generation;
    void (async () => {
      const checksumValue = await knowledgeContentChecksum(input.knowledge);
      const candidate = await buildKnowledgePublicationCandidate(input);
      if (publicationGenerationRef.current !== generation) return;
      setChecksum(checksumValue);
      setPublicationJson(JSON.stringify(candidate, null, 2));
    })();
  }, [input]);

  return { checksum, publicationJson };
}
