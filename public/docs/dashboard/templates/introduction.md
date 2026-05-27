# Dashboard Templates

Templates are reusable email bodies and subjects with variables. Use them when multiple sends share a layout or when non-engineering teammates need to update content without changing application code.

## Workflow

1. Create a template with subject, HTML/text, and variables.
2. Preview with representative variable values.
3. Publish the template when it is ready for production use.
4. Reference the template from API sends, broadcasts, or automation send-email steps.
5. Duplicate templates for variants instead of editing live content blindly.

## Caveat

Template rendering depends on the variables provided by the caller or automation. Missing required variables should be treated as a content/configuration error, not a provider delivery issue.
