await fetch("https://api.resend.com/emails/batch", {
  method: "POST",
});

await fetch("https://api.resend.com/api-keys/key_123", {
  method: "DELETE",
});

await fetch("https://api.resend.com/v1/unknown-feature", {
  method: "POST",
});

await fetch("/segments/seg_123", {
  method: "GET",
});

const mcpPackage = "resend-mcp";
void mcpPackage;
