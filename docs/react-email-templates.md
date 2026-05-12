# React Email template previews

Opensend supports a first path for React Email-backed stored templates without
adding a dependency on Resend-hosted rendering services.

## What is supported now

- Dashboard template previews render through the same stored-template renderer
  used by `/api/emails` sends and automation send steps.
- Previews show rendered HTML and generated `text/plain` output when the
  renderer can produce them.
- Variable diagnostics show whether a preview value came from an explicit
  value, stored fallback metadata, or a preview-only sample for a required
  send-time variable.
- React Email stored templates are selected by repo-owned registry metadata in
  `templates.document.rendering`, for example:

```json
{
  "rendering": {
    "kind": "react_email",
    "templateKey": "onboarding-welcome"
  }
}
```

- The dashboard can create the `onboarding-welcome` starter template. It stores
  the registry key plus variable metadata/fallbacks; it does not store or
  execute tenant-provided TSX.

## Self-hosting model

Rendering runs inside the Opensend app process using the bundled renderer and
registry. A self-hosted deployment only needs the normal app dependencies and
its database. No preview or send path calls Resend-hosted rendering services.

## Limitations

- Arbitrary tenant TSX/JS execution is not supported. Template keys must be
  present in the Opensend-owned registry before they can render.
- Runtime sandboxing for tenant-authored React components is intentionally out
  of scope until a later issue designs a safe execution boundary.
- Preview-only sample values are for dashboard debugging. Production sends must
  still provide required variables unless stored fallback metadata exists.
- Legacy HTML/text templates continue to render with the existing `{{var}}` and
  `{{{var}}}` interpolation semantics.

## Adding another registry-controlled starter

1. Add the React Email template definition and metadata in
   `packages/core/src/services/template-renderer.ts`.
2. Include variable metadata with explicit `required` and `fallbackValue`
   settings so preview diagnostics match send behavior.
3. Create stored templates with `document.rendering.kind = "react_email"` and a
   registry `templateKey` only. Do not accept raw tenant code as metadata.
4. Cover the renderer, preview API, dashboard component, and Playwright preview
   path before shipping.
