export {
  buildHeuristicChannelSuggestions,
  CHANNEL_COPY_CHARACTER_LIMITS,
  channelSuggestionsToContent,
  detectChannelFactualDrift,
  GOVERNED_CHANNEL_COPY_DISCLAIMER,
  GOVERNED_CHANNEL_COPY_PROMPT_VERSION,
  truncateChannelCopySafely,
  validateChannelCopyText,
  validateChannelSource,
  validateGovernedChannelCopy,
  validateProviderChannelEnvelope,
} from "./governedChannelCopyContract";
export {
  buildAuthoritativeChannelSource,
  mockChannelCopyProvider,
  type MockChannelCopyScenario,
} from "./governedChannelCopyProvider";
export {
  CHANNEL_KEY_TO_CHANNEL,
  GOVERNED_CHANNEL_COPY_KEYS,
  type AuthoritativeChannelSource,
  type GovernedChannel,
  type GovernedChannelCopyKey,
  type GovernedChannelCopyResult,
  type GovernedChannelCopyValidationResult,
  type GovernedChannelFieldSuggestion,
} from "./types";
