---
date: 2026-05-28
issue: "#562"
type: decision
promoted_to: null
---

## Keep the first JVM SDK handwritten, blocking-only, and route-aligned

Issue #562 adds a repo-local first-party JVM package at `packages/jvm-sdk` with Maven coordinates `com.opensend:opensend-java:0.1.0-SNAPSHOT`. The first slice is handwritten instead of generated so review stays narrow while OpenSend's OpenAPI/client-generation surface continues to stabilize.

The SDK is explicitly blocking-only (`java.net.http.HttpClient#send`) and currently wraps implemented email, contact, domain, and suppression routes only. Async methods, Maven Central publishing credentials, and broader resource parity should be follow-up work, not silently added to this first staging slice.
