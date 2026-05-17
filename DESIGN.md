# Design

## Source of truth
- Status: Draft
- Last refreshed: 2026-05-16
- Primary product surfaces: public landing, dashboard shell, first-party markdown docs corpus, docs/API reference, machine-readable docs.
- Evidence reviewed: `src/app/globals.css`, `tailwind.config.ts`, `src/components/dashboard-shell/sidebar.tsx`, `src/components/landing/landing-page.tsx`, `opensend-new-design/*`, `src/app/docs/page.tsx`, `agent_docs/resend-parity.md`.

## Brand
- Personality: precise, operator-grade, fast, self-hostable, quietly premium.
- Trust signals: Resend-compatible API language, explicit OpenAPI/LLM/MCP contracts, DNS/auth/security copy, clear self-hosting boundaries.
- Avoid: generic black tables, walls of collapsed endpoints, vague parity claims, unactionable marketing copy.

## Product goals
- Goals: make the docs page useful for first send, migration from Resend, endpoint discovery, and AI-agent integration.
- Non-goals: full Mintlify clone, complete narrative docs system, undocumented endpoint expansion.
- Success signals: user can send first email from the hero, find OpenAPI and `/docs/llms.txt`, and understand which routes are Resend-compatible versus OpenSend-specific.

## Personas and jobs
- Primary personas: developer integrating email, self-hosting operator, AI coding agent, founder evaluating Resend replacement.
- User jobs: send a test email, verify a domain, manage contacts/campaigns, wire webhooks/MCP, generate client code from OpenAPI.
- Key contexts of use: local development, hosted OpenSend API, self-hosted Docker/AWS SES deployment.

## Information architecture
- Primary navigation: quickstart, Resend references, endpoint groups, LLM/MCP resources.
- Core routes/screens: `/docs`, `/openapi.json`, `/docs/llms.txt`, `public/docs/**/*.md`.
- Content hierarchy: first-send hero first, OpenSend-owned guide cards second, grouped endpoint cards third, complete markdown corpus via `/docs/llms.txt` last and in side rails.

## Design principles
- Principle 1: docs must be actionable before exhaustive.
- Principle 2: compatibility claims need visible source references or explicit OpenSend-specific labels.
- Tradeoffs: prefer curated endpoint groups over dumping every route; defer full prose docs until the OpenAPI contract is broader.

## Visual language
- Color: dark `--bg` canvas, subtle `--line` borders, `--accent` green for primary action and POST, blue/violet/amber/red for status semantics.
- Typography: Geist sans for UI, Geist Mono for commands and endpoints, Instrument Serif only as accent if needed.
- Spacing/layout rhythm: generous landing-page rhythm; cards use `rounded-card`, thin borders, soft glow only on high-value panels.
- Shape/radius/elevation: 12px cards, 20-24px hero panels, minimal elevation.
- Motion: small hover transitions; avoid heavy animation in docs.
- Imagery/iconography: text-first; use badges and pills rather than decorative icons.

## Components
- Existing components to reuse: global `.landing-root`, `.wrap`, `.pill`, `.btn`, `.kicker`, `.mono`, theme tokens in `tailwind.config.ts`.
- New/changed components: docs-only code block, method badge, endpoint card, docs sidebars.
- Variants and states: language tabs, copy buttons, hover/focus states, responsive stacked layout.
- Token/component ownership: theme tokens stay in `src/app/globals.css` and Tailwind config; docs-specific composition stays in `src/app/docs/page.tsx` until extracted.

## Accessibility
- Target standard: WCAG 2.1 AA for public docs.
- Keyboard/focus behavior: tabs and copy buttons are native buttons; links are visible and text-labeled.
- Contrast/readability: use `text-fg`/`text-fg-2` on dark backgrounds and avoid tiny low-contrast endpoint descriptions.
- Screen-reader semantics: use headings, sections, nav, aside, and button labels with text.
- Reduced motion and sensory considerations: no required animation.

## Responsive behavior
- Supported breakpoints/devices: mobile through desktop.
- Layout adaptations: sidebars hide below xl; hero and quickstart stack on mobile; endpoint rows become vertical cards.
- Touch/hover differences: copy buttons remain reachable through visible native controls on hover-capable layouts; content is still selectable.

## Interaction states
- Loading: static docs avoid loading states.
- Empty: not applicable.
- Error: docs should link to OpenAPI as source of truth when examples drift.
- Success: copy button uses clipboard best-effort without toast for this slice.
- Disabled: not applicable.
- Offline/slow network: core docs render without remote assets.

## Content voice
- Tone: terse, concrete, migration-friendly.
- Terminology: say `OpenSend`, `Resend-compatible`, `os_ API key`, `dashboard cookies are not API credentials`.
- Microcopy rules: distinguish root aliases from `/api/*` routes; do not imply unsupported SDK helpers exist.

## Implementation constraints
- Framework/styling system: Next.js App Router, TypeScript strict, Tailwind CSS, no added dependency.
- Design-token constraints: use existing global CSS variables and Tailwind tokens.
- Performance constraints: static client page plus static markdown files in `public/docs`; avoid heavy runtime fetches for docs chrome.
- Compatibility constraints: public docs routes must bypass dashboard auth middleware.
- Test/screenshot expectations: `make check` and local `/docs`, `/docs/llms.txt` fetches; browser screenshot when tooling is available.

## Open questions
- [ ] Should the docs page become generated from `src/lib/openapi.ts` once OpenAPI covers all public routes? / owner: engineering / impact: reduces drift.
- [ ] Should copy buttons show toast feedback? / owner: design / impact: improves UX but adds component surface.
