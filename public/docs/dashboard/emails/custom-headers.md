# Custom Headers

Custom headers let application code attach provider-safe metadata to an email. Headers are submitted through the API or SDK and are useful for internal correlation, customer support, and downstream processing.

## Recommended use

- Add internal IDs such as `X-Order-ID` or `X-Workspace-ID`.
- Keep values short and non-sensitive.
- Use tags for dashboard filtering and analytics-oriented grouping; use headers when the recipient mailbox or downstream system needs the metadata.

## Safety rules

Do not put secrets, API keys, session tokens, or private customer data in headers. Headers can be visible outside your application and may be copied into provider logs or recipient mail clients.

## Troubleshooting

If a header does not appear as expected, confirm the send request used the API field supported by your SDK and then inspect the email detail/log entry. Provider-side normalization can alter casing or omit invalid header names.
