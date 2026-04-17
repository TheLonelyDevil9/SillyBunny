
## Reasoning Tokens Badge
- Extracted `reasoning_tokens` from `parsed.usage?.completion_tokens_details?.reasoning_tokens` in `streamData()` and added it to `state.reasoning_tokens`.
- Extracted `reasoning_tokens` from `data.usage?.completion_tokens_details?.reasoning_tokens` in `sendOpenAIRequest()` non-streaming path and added it to `data.reasoningTokens`.
- Passed `reasoningTokens` from `data` to `saveReply()` in `generateRaw()`'s `onSuccess`.
- Updated `saveReply()` to accept `reasoningTokens` and save it to `lastMessage.extra.reasoning_tokens` and `newMessage.extra.reasoning_tokens`.
- Updated `StreamingProcessor` to store `this.reasoningTokens = state?.reasoning_tokens ?? 0;` in `generate()` and save it to `chat[messageId].extra.reasoning_tokens` in `onProgressStreaming()`.
- Updated `updateMessageElement()` to render a `.reasoning-tokens-badge` next to `.tokenCounterDisplay` if `mes.extra?.reasoning_tokens > 0`.
- Added `.reasoning-tokens-badge` CSS to `public/style.css`.
