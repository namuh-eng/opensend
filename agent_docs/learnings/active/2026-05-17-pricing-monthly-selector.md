---
date: 2026-05-17
issue: pricing-monthly-selector
type: decision
promoted_to: null
---

# Monthly-only pricing selector

Decision: Cloud self-serve pricing uses one combined API + broadcast plan family with predefined monthly Stripe Price rows for volume ticks instead of a yearly toggle or separate transactional/marketing checkout tabs.

Why: OpenSend currently gates quotas by emails, domains, and API keys. Broadcast/contact/automation-specific entitlements are not mature enough to support separate marketing SKU enforcement. Monthly predefined ticks keep Checkout simple, avoid dynamic pricing, and still mirror the Resend-style quota selector interaction.

Implementation note: keep fixed public Stripe Prices for Starter 55k/100k and Growth 120k/250k/500k. Scale is contact-sales/custom until high-volume deliverability, retention, dedicated IP, and enterprise support packaging is explicit.
