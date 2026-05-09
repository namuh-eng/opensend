# Custom event payload schemas

Custom events may be created without a schema. Schema-less events, including
unknown event names that have not been created yet, keep accepting any object
payload and can still record deliveries or trigger matching automations.

When a stored custom event has a schema, `POST /api/events/send` validates the
payload before contact creation, delivery recording, waiting-run resume, or new
automation-run creation. Invalid payloads return `422` with stable `details`
entries that include field paths such as `payload.plan`.

## Supported schema dialect

The first backend slice intentionally supports a narrow JSON-Schema-like object
descriptor instead of adding a broad JSON Schema dependency:

```json
{
  "type": "object",
  "required": ["plan", "trial"],
  "properties": {
    "plan": { "type": "string" },
    "seats": { "type": "number" },
    "trial": { "type": "boolean" },
    "metadata": {
      "type": "object",
      "required": ["source"],
      "properties": {
        "source": { "type": "string" }
      }
    }
  }
}
```

Supported property types are `string`, `number`, `boolean`, `object`, and
`array`. Extra payload fields are allowed; the schema only constrains listed
properties and required fields. Unsupported schema keywords are rejected when an
event schema is created.
