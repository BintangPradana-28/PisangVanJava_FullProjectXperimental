# infra/cloudflare/main.tf
#
# Pisang Van Java — Cloudflare Infrastructure as Code
# Sprint 3+ implementation | P0 documented here for future IaC migration

terraform {
  required_version = ">= 1.6"

  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 4.0"
    }
  }
}

provider "cloudflare" {
  api_token = var.cloudflare_api_token
}

resource "cloudflare_record" "apex" {
  zone_id = var.cloudflare_zone_id
  name    = "@"
  content = var.vercel_cname_target
  type    = "CNAME"
  proxied = true
  ttl     = 1

  comment = "PVJ apex domain → Vercel (proxied through Cloudflare)"
}

resource "cloudflare_record" "www" {
  zone_id = var.cloudflare_zone_id
  name    = "www"
  content = var.vercel_cname_target
  type    = "CNAME"
  proxied = true
  ttl     = 1

  comment = "PVJ www → Vercel (proxied through Cloudflare)"
}

resource "cloudflare_zone_settings_override" "pvj_security" {
  zone_id = var.cloudflare_zone_id

  settings {
    ssl = "strict"
    always_use_https = "on"
    min_tls_version = "1.2"
    tls_1_3 = "zrt"
    automatic_https_rewrites = "on"
    security_level = "medium"
    browser_check = "on"

    security_headers {
      enabled            = true
      preload            = true
      max_age            = 31536000
      include_subdomains = true
    }

    mirage        = "off"
    rocket_loader = "off"
    http2 = "on"
    http3 = "on"
    brotli = "on"
    early_hints = "on"
  }
}

resource "cloudflare_ruleset" "pvj_waf_webhook" {
  zone_id     = var.cloudflare_zone_id
  name        = "PVJ — Webhook IP Protection"
  description = "Protect payment webhook endpoints — only allow known payment gateway IPs"
  kind        = "zone"
  phase       = "http_request_firewall_custom"

  rules {
    action      = "block"
    description = "Block non-Midtrans IPs from payment webhook"
    enabled     = true
    ref         = "midtrans-webhook-ip-guard"

    # FIX: this previously targeted /api/webhooks/midtrans, which is NOT a real
    # route in this Next.js app (App Router only reads from app/api/**, and no
    # such path exists there). The live handler is app/api/payment/midtrans/webhook/route.ts.
    # As written before, this rule silently protected nothing — the real webhook
    # had zero edge-level IP filtering, relying only on its internal HMAC signature
    # check (app/api/payment/midtrans/webhook/route.ts) as its sole line of defense.
    expression = <<-EOT
      (
        http.request.uri.path eq "/api/payment/midtrans/webhook"
        and not ip.src in {103.208.23.0/24}
      )
    EOT

    action_parameters {}

    logging {
      enabled = true
    }
  }
}

resource "cloudflare_ruleset" "pvj_waf_managed" {
  zone_id     = var.cloudflare_zone_id
  name        = "PVJ — Managed WAF Rules"
  description = "Cloudflare managed WAF rules for PVJ"
  kind        = "zone"
  phase       = "http_request_firewall_managed"

  rules {
    action      = "execute"
    description = "Cloudflare Managed Ruleset"
    enabled     = true
    ref         = "cloudflare-managed-free"

    expression = "true"

    action_parameters {
      id = "efb7b8c949ac4650a09736fc376e9aee"
    }
  }
}

resource "cloudflare_ruleset" "pvj_rate_limiting" {
  zone_id     = var.cloudflare_zone_id
  name        = "PVJ — Rate Limiting"
  description = "Cloudflare-level rate limiting for sensitive endpoints"
  kind        = "zone"
  phase       = "http_ratelimit"

  rules {
    action      = "block"
    description = "Rate limit login endpoint"
    enabled     = true
    ref         = "rate-limit-login"

    # FIX: this previously targeted /api/auth/login, which does not exist — this
    # project uses Auth.js v5 (NextAuth), whose credentials provider is POSTed to
    # /api/auth/callback/credentials (see app/api/auth/[...nextauth]/route.ts,
    # src/auth.config.ts providers). As written before, this rule rate-limited a
    # path nobody ever requests, leaving the real login endpoint with no edge-level
    # brute-force protection (app-level protection still exists via Upstash
    # rate limiting + AuthLog tracking in src/auth.ts, so this is defense-in-depth,
    # not the only guard — but it should still point at something real).
    expression = "http.request.uri.path eq \"/api/auth/callback/credentials\""

    action_parameters {}

    ratelimit {
      characteristics        = ["ip.src"]
      period                 = 60
      requests_per_period    = 10
      mitigation_timeout     = 600
    }
  }
}
