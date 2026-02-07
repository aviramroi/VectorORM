---
"@vectororm/adapter-turbopuffer": minor
---

Add `region` config option to TurbopufferAdapter. Sets the base URL to `https://{region}.turbopuffer.com` (e.g. `aws-us-east-1`, `gcp-us-central1`). Falls back to `TURBOPUFFER_REGION` env var.
