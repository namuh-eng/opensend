# Template Variables

Template variables make reusable content dynamic. Define variables for values such as first name, company name, plan, invoice amount, or action URL.

## Best practices

- Mark variables required when the email is not meaningful without them.
- Provide fallback values only when a generic value is acceptable.
- Keep variable names stable after publishing.
- Test previews with empty, long, and special-character values.

## Troubleshooting

If an API send or automation step fails because of variables, compare the template definition with the payload sent by the caller. The dashboard preview helps validate rendering before production traffic uses the template.
