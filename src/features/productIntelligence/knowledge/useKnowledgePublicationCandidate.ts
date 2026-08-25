import { useEffect, useState } from "react";
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

  useEffect(() => {
    const controller = new AbortController();
    if (!input) {
      setChecksum("");
      setPublicationJson("Preparing publication candidate…");
      return () => {
        controller.abort();
      };
    }
    void (async () => {
      const checksumValue = await knowledgeContentChecksum(input.knowledge);
      const candidate = await buildKnowledgePublicationCandidate(input);
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- abort may flip after await
      if (controller.signal.aborted) return;
      setChecksum(checksumValue);
      setPublicationJson(JSON.stringify(candidate, null, 2));
    })();
    return () => {
      controller.abort();
    };
  }, [input]);

  return { checksum, publicationJson };
}
