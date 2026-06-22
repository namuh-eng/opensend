---
date: 2026-06-18
issue: "#642"
type: decision
promoted_to: null
---

## v1 release publishes pinned images, but default Compose stays source-built until images exist

Issue #642 needs versioned app and ingester images plus pinned-image guidance, but
this worker must not push the real `v1.0.0` tag or publish images. Switching the
checked-in `docker-compose.yml` defaults to `ghcr.io/namuh-eng/opensend:v1.0.0`
before the authorized tag runs would break fresh-clone evaluation because those
images do not exist yet.

Chosen path: prepare the tag workflow to publish multi-arch GHCR app and ingester
images, document exact pinned image replacements in README/self-hosting/ingester
deploy docs, and keep default Compose source-built. After Jaeyun/controller runs
the real release and smoke-tests the images, maintainers can decide whether to
flip Compose defaults or add a dedicated release Compose file.
