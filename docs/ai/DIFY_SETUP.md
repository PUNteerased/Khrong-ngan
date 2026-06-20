# Dify Setup Checklist — LaneYa Khrong-ngan

Use this after deploying backend/frontend. QR tickets are issued by the **backend** — Dify does not need a QR-format variable.

## Model settings

| Setting | Value |
|---------|--------|
| Model | MiniMax 2.5 (or your chosen chat model) |
| Temperature | **0** |
| Max tokens | **768–1024** |
| Top P | 1 (default) |

## Instructions (system prompt)

1. Open Dify → App **Khrong-ngan** → **Orchestrate** → **Instructions**
2. Paste the full contents of [`docs/ai/laneya-system-prompt.md`](../../docs/ai/laneya-system-prompt.md) (v3)
3. Save and publish

## Knowledge base

1. Sync from Admin UI → **Knowledge sync**, or upload [`docs/ai/laneya-knowledge-base.md`](../../docs/ai/laneya-knowledge-base.md) (v3, 10 drugs A1–B5)
2. Enable retrieval: hybrid search, top-k **3–5**

## App variables (must match backend `inputs`)

Create each as **string** in Dify Variables. Backend sends all of these on every chat request.

| Variable | Required in Dify | Notes |
|----------|------------------|-------|
| `inventory_drugs` | Yes | Live kiosk stock |
| `age`, `weight`, `height`, `gender` | Yes | User profile |
| `allergies`, `diseases`, `current_medications` | Yes | Safety context |
| `missing_fields`, `missing_fields_instruction` | Yes | Onboarding gate |
| `risk_rubric` | **Add if missing** | Injected by backend — risk_level rules |
| `off_kiosk_examples` | **Add if missing** | Off-kiosk drug policy |

Optional aliases (backend also sends): `allergy_context`, `disease_context`, `user_allergies`, `user_underlying_conditions`, `user_current_medications`.

## Backend env (Render)

- `DIFY_API_KEY`, `DIFY_APP_ID` — Dify app connection
- `PICKUP_TICKET_SECRET` — HMAC for tickets (audit)
- `KIOSK_HEARTBEAT_SECRET` — ESP32-S3 heartbeat + redeem API

## QR ticket format (not a Dify setting)

Tickets look like **`A1-0001-XYZABC`** (slot-qty-token). Issued only when backend gates pass after Dify JSON parse. No Dify change needed for this format.

## Quick test

1. Chat with complete profile → AI recommends in-kiosk drug → mobile shows QR `B3-0001-ABCDEF`
2. Redeem: `POST /api/kiosk/redeem-ticket` with `{ "code": "B3-0001-ABCDEF" }` and `X-Kiosk-Secret`
