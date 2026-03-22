import json
import os
import sys
from pathlib import Path

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()

# Ensure solver module is importable
sys.path.insert(0, str(Path(__file__).parent))

from schemas import (
    Scenario, OptimizeRequest, OptimizeResult,
    ChatRequest, ChatResponse,
)
from solver.optimizer import optimize, compute_baseline

# ── App ──────────────────────────────────────────────────────────────────────

app = FastAPI(title="NexusRecover API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Load scenario once at startup ────────────────────────────────────────────

DATA_PATH = Path(__file__).parent / "data" / "mock_scenario.json"
_scenario_raw: dict = json.loads(DATA_PATH.read_text())
_scenario: Scenario = Scenario(**_scenario_raw)


# ── Routes ───────────────────────────────────────────────────────────────────

@app.get("/scenario", response_model=Scenario)
def get_scenario():
    """Return the full scenario data (airports, flights, PAX groups)."""
    return _scenario


@app.post("/optimize", response_model=OptimizeResult)
def run_optimizer(req: OptimizeRequest):
    """Run the CP-SAT optimizer and return the recovery plan."""
    if req.scenario_id != _scenario.scenario_id:
        raise HTTPException(status_code=404, detail="Scenario not found")
    return optimize(_scenario)


@app.get("/baseline", response_model=OptimizeResult)
def get_baseline():
    """Return the no-intervention baseline cost (for savings_delta comparison)."""
    return compute_baseline(_scenario)


@app.post("/chat", response_model=ChatResponse)
async def chat(req: ChatRequest):
    """
    Proxy to OpenRouter. Injects scenario + optimizer result as system context.
    The LLM acts as an IRROPS Copilot — it explains decisions but never
    calculates financial figures; it only cites numbers from the provided context.
    """
    api_key = os.getenv("GOOGLE_API_KEY", "")
    if not api_key:
        raise HTTPException(status_code=500, detail="GOOGLE_API_KEY not configured")

    model = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")

    # Build system prompt with scenario context
    context_parts = [
        "You are NexusRecover Copilot, an AI assistant specialized in airline irregular operations (IRROPS) recovery.",
        "NexusRecover is a decision support system that uses a CP-SAT constraint optimizer to compute the best",
        "recovery plan during airport disruptions — minimizing stranded passengers and total recovery cost.",
        "You explain optimization decisions clearly and concisely to operations managers.",
        "You understand the full recovery workflow: scenario analysis → capacity constraints → optimizer run → report.",
        "CRITICAL RULE: Never calculate, estimate, or infer financial figures on your own.",
        "You may ONLY cite exact numbers that appear in the context below.",
        "If a number is not in the context, say 'that data is not available'.",
        "Always respond in the same language the user writes in (Spanish or English).",
        "",
        "--- CURRENT SCENARIO ---",
        f"Hub: {_scenario.hub} | Disruption: {_scenario.description}",
        "",
        "Inbound flights (with delays):",
    ]

    for inb in _scenario.inbound_flights:
        context_parts.append(
            f"  {inb.flight_id} from {inb.origin}: scheduled {inb.sta_min}min, "
            f"now arriving {inb.eta_min}min (+{inb.delay_min}min delay), "
            f"{inb.total_pax} passengers"
        )

    context_parts.append("\nOutbound flights (scheduled departures):")
    for out in _scenario.outbound_flights:
        context_parts.append(
            f"  {out.flight_id} to {out.destination}: STD {out.std_min}min, "
            f"max delay allowed: {out.max_delay_min}min"
        )

    context_parts.append("\nConnecting passenger groups:")
    for pg in _scenario.pax_groups:
        context_parts.append(
            f"  {pg.group_id}: {pg.count} {pg.tier} PAX from {pg.inbound_flight_id} → {pg.outbound_flight_id}"
        )

    if req.optimize_result:
        r = req.optimize_result
        context_parts.append("\n--- OPTIMIZER RESULT ---")
        context_parts.append(
            f"Baseline cost (no action): ${r.baseline_cost_usd:,.0f} | "
            f"Optimized cost: ${r.optimized_cost_usd:,.0f} | "
            f"Savings: ${r.savings_usd:,.0f}"
        )
        context_parts.append(
            f"PAX protected: {r.passengers_protected} | PAX stranded: {r.passengers_stranded} | "
            f"Total delay applied: {r.total_delay_minutes} minutes"
        )
        context_parts.append("\nFlight decisions:")
        for fd in r.flight_decisions:
            status = "CANCELLED" if fd.cancelled else f"delayed +{fd.delay_applied_min}min → departs {fd.etd_final_clock}"
            context_parts.append(f"  {fd.flight_id}: {status} (delay cost: ${fd.cost_delay_usd:,.0f})")
        context_parts.append("\nPassenger connection results:")
        for pr in r.pax_results:
            status = "connection MADE" if pr.connection_made else f"STRANDED (cost: ${pr.cost_stranded_usd:,.0f})"
            context_parts.append(
                f"  {pr.group_id} [{pr.inbound_flight_id}→{pr.outbound_flight_id}] "
                f"{pr.count} {pr.tier} PAX: {status}"
            )

    system_prompt = "\n".join(context_parts)

    # Build Gemini-native contents (user/model turns only; system goes separately)
    contents = []
    for msg in req.messages:
        role = "model" if msg.role == "assistant" else "user"
        contents.append({"role": role, "parts": [{"text": msg.content}]})

    payload = {
        "system_instruction": {"parts": [{"text": system_prompt}]},
        "contents": contents,
        "generationConfig": {"maxOutputTokens": 4096, "temperature": 0.3},
    }

    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            url,
            headers={
                "x-goog-api-key": api_key,
                "Content-Type": "application/json",
            },
            json=payload,
        )

    if resp.status_code != 200:
        print(f"[Gemini] status={resp.status_code} body={resp.text}")
        raise HTTPException(status_code=502, detail=f"Gemini API error: {resp.text}")

    reply = resp.json()["candidates"][0]["content"]["parts"][0]["text"]
    return ChatResponse(reply=reply)


@app.post("/notify-authorities")
async def notify_authorities(payload: dict):
    """Proxy webhook to N8N — Authorities notification."""
    webhook_url = os.getenv("WEBHOOK_AUTHORITIES", "")
    if not webhook_url:
        print("[notify-authorities] WEBHOOK_AUTHORITIES not configured")
        raise HTTPException(status_code=500, detail="WEBHOOK_AUTHORITIES not configured")

    try:
        print(f"[notify-authorities] Sending to {webhook_url}")
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(webhook_url, json=payload)
        if resp.status_code >= 400:
            print(f"[notify-authorities] Webhook error: {resp.status_code} {resp.text}")
            raise HTTPException(status_code=502, detail=f"Webhook error: {resp.text}")
        return {"ok": True, "message": "Authorities notified"}
    except Exception as e:
        print(f"[notify-authorities] Exception: {str(e)}")
        raise HTTPException(status_code=502, detail=f"Webhook failed: {str(e)}")


@app.post("/notify-hospitality")
async def notify_hospitality(payload: dict):
    """Proxy webhook to N8N — Hospitality notification."""
    webhook_url = os.getenv("WEBHOOK_HOSPITALITY", "")
    if not webhook_url:
        print("[notify-hospitality] WEBHOOK_HOSPITALITY not configured")
        raise HTTPException(status_code=500, detail="WEBHOOK_HOSPITALITY not configured")

    try:
        print(f"[notify-hospitality] Sending to {webhook_url}")
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(webhook_url, json=payload)
        if resp.status_code >= 400:
            print(f"[notify-hospitality] Webhook error: {resp.status_code} {resp.text}")
            raise HTTPException(status_code=502, detail=f"Webhook error: {resp.text}")
        return {"ok": True, "message": "Hospitality notified"}
    except Exception as e:
        print(f"[notify-hospitality] Exception: {str(e)}")
        raise HTTPException(status_code=502, detail=f"Webhook failed: {str(e)}")


@app.get("/health")
def health():
    return {"status": "ok", "scenario_loaded": _scenario.scenario_id}
