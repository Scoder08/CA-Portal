"""
CA AI Agent powered by LangGraph.

Model selection:
  LLM_PROVIDER = openai (default) | anthropic | groq
  LLM_MODEL    = optional model name override

Each provider requires its own API key env var:
  OPENAI_API_KEY, ANTHROPIC_API_KEY, GROQ_API_KEY
"""

import json
import logging
import os
from datetime import date
from typing import Annotated, TypedDict
import operator

from langchain_core.language_models import BaseChatModel
from langchain_core.messages import (
    AIMessage,
    AnyMessage,
    HumanMessage,
    SystemMessage,
)
from langchain_core.tools import tool
from langgraph.graph import END, StateGraph
from langgraph.prebuilt import ToolNode

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Model factory
# ---------------------------------------------------------------------------

def _build_llm() -> BaseChatModel:
    """
    Instantiate the LLM based on LLM_PROVIDER env var.
    Called per-request so env-var changes take effect without restart.
    """
    provider = os.getenv("LLM_PROVIDER", "openai").lower()
    model_name = os.getenv("LLM_MODEL", "")

    if provider == "anthropic":
        from langchain_anthropic import ChatAnthropic  # noqa: import guard
        return ChatAnthropic(
            model=model_name or "claude-3-5-sonnet-20241022",
            max_tokens=4096,
            streaming=True,
        )
    elif provider == "groq":
        from langchain_groq import ChatGroq  # noqa: import guard
        return ChatGroq(
            model=model_name or "llama-3.3-70b-versatile",
            streaming=True,
        )
    else:  # openai (default)
        from langchain_openai import ChatOpenAI  # noqa: import guard
        return ChatOpenAI(
            model=model_name or "gpt-4o",
            streaming=True,
        )


# ---------------------------------------------------------------------------
# System prompt
# ---------------------------------------------------------------------------

_CA_SYSTEM_PROMPT = """\
You are a senior Chartered Accountant AI assistant for an Indian CA portal. \
Your users are independent professionals and freelancers who earn in foreign \
currency (primarily USD) and file taxes in India.

## Core Competencies
- Indian Income Tax Act 1961: slabs, rebates (87A), surcharges, health & edu cess
- Section 44ADA (presumptive taxation for professionals): eligibility ≤ ₹75L gross \
  receipts, 50% deemed expenses, no audit required, use ITR-4
- Section 44AD/44ADB for businesses
- New vs Old tax regime comparison; Budget 2025 changes (FY 2025-26 / AY 2026-27)
- GST: registration threshold, composition scheme, GSTR-1, GSTR-3B, ITC
- TDS: deduction rates, Form 16A, 26AS reconciliation, advance tax deadlines \
  (Jun 15→15%, Sep 15→45%, Dec 15→75%, Mar 15→100%)
- FEMA / RBI: LRS limit, foreign currency accounts, SWIFT remittances
- Form 15CA / 15CB for foreign remittances exceeding ₹5L
- DTAA: India-USA, India-UK, India-Singapore, UAE – how to claim relief
- ITR forms: ITR-1 (Sahaj), ITR-3 (business/profession), ITR-4 (Sugam/44ADA)
- Deductions: 80C (₹1.5L), 80D (health insurance), 80G (donations), 24(b) (home loan)
- Capital gains: STCG/LTCG on equity (10%/15% after Budget 2024), debt, property
- Crypto/VDA: 30% flat tax + 1% TDS (Section 115BBH)

## Tools Available — USE THEM WITHOUT ASKING PERMISSION
Never ask the user "shall I look up your invoices?" or "do you want me to check?".
Just call the tool immediately. Act like a CA who has full access to the client's file.

- `get_usd_inr_rate`: ALWAYS call this before any USD→INR conversion. \
  Never use a hardcoded or estimated rate. The live rate matters for tax accuracy.
- `calculate_tax`: call this whenever a user mentions any income figure; \
  always pass INR (convert from USD first using `get_usd_inr_rate`)
- `search_user_invoices`: call this immediately whenever the user asks about \
  their earnings, GST eligibility, tax estimates, or invoice history — \
  do NOT ask for permission first
- `ca_knowledge_search`: for deep regulatory questions — ICAI guidance, \
  specific IT Act sections, FEMA circulars
- `format_as_accountant`: optionally call to add structure to complex answers

## Behavioral Rules
1. NEVER use hardcoded exchange rates — always call `get_usd_inr_rate` for live data
2. NEVER ask permission to use tools — just use them proactively
3. NEVER fabricate specific numbers — state uncertainty and direct users to \
   incometax.gov.in or gst.gov.in for official rates
4. Always show slab-by-slab breakdown for tax calculations
5. For exposure > ₹5L, recommend consulting a practising CA (RoC-registered)
6. Cite the relevant section/provision (e.g. "under Section 44ADA…")
7. Respond in the language the user writes in (English or Hinglish are fine)
8. Be concise for simple questions; structured and detailed for planning questions
9. When the user's invoices suggest potential 44ADA eligibility, proactively mention it

Today's date: {today}
Current Financial Year: FY 2025-26 (April 2025 – March 2026)
Assessment Year: AY 2026-27
"""


# ---------------------------------------------------------------------------
# Tools (constructed per-request via closure for user-scoped data access)
# ---------------------------------------------------------------------------

def _make_tools(user_id: int) -> list:
    """
    Returns the tool list with user_id captured in closures.
    This is the security boundary: user_id is never a tool parameter,
    so the LLM cannot be prompted to access another user's data.
    """

    @tool
    def calculate_tax(
        gross_income_inr: float,
        regime: str = "new",
        is_44ada: bool = True,
    ) -> str:
        """
        Calculate Indian income tax for the given gross income.
        Mirrors the logic in TaxCalculator.jsx for consistency.

        Args:
            gross_income_inr: Total gross income in INR for the full financial year
            regime: 'new' (default, Budget 2025) or 'old'
            is_44ada: True if the user qualifies for Section 44ADA presumptive taxation
                      (professional services, gross receipts ≤ ₹75L). When True,
                      taxable income = 50% of gross income.
        """
        # FY 2025-26 slabs (Budget 2025 — new regime updated)
        NEW_SLABS = [
            (400_000, 0.00),
            (800_000, 0.05),
            (1_200_000, 0.10),
            (1_600_000, 0.15),
            (2_000_000, 0.20),
            (2_400_000, 0.25),
            (float("inf"), 0.30),
        ]
        OLD_SLABS = [
            (250_000, 0.00),
            (500_000, 0.05),
            (1_000_000, 0.20),
            (float("inf"), 0.30),
        ]

        taxable = gross_income_inr * 0.5 if is_44ada else gross_income_inr
        slabs = NEW_SLABS if regime == "new" else OLD_SLABS

        tax, prev, breakdown = 0.0, 0.0, []
        for upto, rate in slabs:
            if taxable <= prev:
                break
            chunk = min(taxable, upto) - prev
            slab_tax = chunk * rate
            if chunk > 0 and rate > 0:
                breakdown.append(
                    f"₹{prev:,.0f}–{min(taxable, upto):,.0f} @ {rate*100:.0f}% = ₹{slab_tax:,.0f}"
                )
            tax += slab_tax
            prev = upto

        # 87A rebate (new regime: ₹25k if taxable ≤ ₹7L; old: ₹12.5k if ≤ ₹5L)
        rebate = 0.0
        if regime == "new" and taxable <= 700_000:
            rebate = min(tax, 25_000)
        elif regime == "old" and taxable <= 500_000:
            rebate = min(tax, 12_500)

        tax_after_rebate = max(0.0, tax - rebate)

        # Surcharge (same for both regimes)
        surcharge = 0.0
        if taxable > 50_000_000:
            surcharge = tax_after_rebate * 0.37
        elif taxable > 20_000_000:
            surcharge = tax_after_rebate * 0.25
        elif taxable > 10_000_000:
            surcharge = tax_after_rebate * 0.15
        elif taxable > 5_000_000:
            surcharge = tax_after_rebate * 0.10

        cess = (tax_after_rebate + surcharge) * 0.04
        total = tax_after_rebate + surcharge + cess

        result = {
            "regime": regime,
            "gross_income_inr": gross_income_inr,
            "taxable_income_inr": taxable,
            "44ada_applied": is_44ada,
            "slab_breakdown": breakdown,
            "tax_before_rebate": round(tax),
            "rebate_87a": round(rebate),
            "surcharge": round(surcharge),
            "health_edu_cess_4pct": round(cess),
            "total_tax_payable": round(total),
            "effective_rate_pct": round((total / gross_income_inr) * 100, 2) if gross_income_inr else 0,
            "advance_tax_schedule": {
                "by_jun_15": round(total * 0.15),
                "by_sep_15": round(total * 0.45),
                "by_dec_15": round(total * 0.75),
                "by_mar_15": round(total * 1.00),
            },
        }
        return json.dumps(result, ensure_ascii=False)

    @tool
    def get_usd_inr_rate() -> str:
        """
        Fetch the live USD→INR exchange rate from open.er-api.com.
        Always call this before converting any USD amount to INR.
        Never use a hardcoded or assumed rate.
        """
        import urllib.request
        try:
            with urllib.request.urlopen(
                "https://open.er-api.com/v6/latest/USD", timeout=5
            ) as resp:
                data = json.loads(resp.read().decode())
            rate = data["rates"]["INR"]
            return json.dumps({
                "usd_to_inr": round(rate, 4),
                "source": "open.er-api.com",
                "fetched_at": data.get("time_last_update_utc", ""),
            })
        except Exception as exc:
            logger.warning("Forex fetch failed: %s", exc)
            return json.dumps({
                "error": "Could not fetch live rate",
                "fallback_usd_to_inr": None,
                "message": "Tell the user the live rate is unavailable and ask them to provide the current rate.",
            })

    @tool
    def search_user_invoices(
        status: str = "all",
        limit: int = 10,
        summarize: bool = True,
    ) -> str:
        """
        Retrieve the authenticated user's invoice data from the portal.
        Call this immediately whenever the user asks about their earnings,
        invoice history, unpaid invoices, or needs personalised tax estimates.
        Do NOT ask for permission — just call it.

        Args:
            status: Filter by 'all', 'paid', or 'unpaid'
            limit: Max records to return (1–50)
            summarize: True returns aggregate stats; False returns individual records
        """
        import urllib.request
        from app.models.invoice import Invoice

        limit = max(1, min(limit, 50))
        q = Invoice.query.filter_by(user_id=user_id)
        if status in ("paid", "unpaid"):
            q = q.filter_by(status=status)
        invoices = q.order_by(Invoice.created_at.desc()).limit(limit).all()

        if not invoices:
            return json.dumps({"found": 0, "message": "No invoices found for this filter."})

        by_currency: dict[str, float] = {}
        for inv in invoices:
            by_currency[inv.currency] = by_currency.get(inv.currency, 0.0) + inv.amount

        # Fetch live exchange rate for USD→INR conversion
        inr_rate = None
        try:
            with urllib.request.urlopen(
                "https://open.er-api.com/v6/latest/USD", timeout=5
            ) as resp:
                fx = json.loads(resp.read().decode())
            inr_rate = round(fx["rates"]["INR"], 4)
        except Exception:
            pass

        inr_totals = {}
        if inr_rate and "USD" in by_currency:
            inr_totals["USD_in_INR"] = round(by_currency["USD"] * inr_rate)

        if summarize:
            return json.dumps({
                "found": len(invoices),
                "total_by_currency": by_currency,
                "inr_equivalent": inr_totals,
                "live_usd_inr_rate": inr_rate,
                "paid_count": sum(1 for i in invoices if i.status == "paid"),
                "unpaid_count": sum(1 for i in invoices if i.status == "unpaid"),
                "latest_invoice": invoices[0].to_dict() if invoices else None,
            })

        return json.dumps({
            "invoices": [i.to_dict() for i in invoices],
            "live_usd_inr_rate": inr_rate,
        })

    @tool
    def ca_knowledge_search(query: str) -> str:
        """
        Search the CA knowledge base for regulatory information:
        IT Act sections, ICAI guidance, GST circulars, FEMA rules, etc.
        Use this for deep regulatory questions beyond common knowledge.

        Args:
            query: The specific regulation, section, or concept to look up
        """
        # Phase 2: replace with pgvector similarity search
        # from langchain_postgres import PGVector
        # store = PGVector(connection=..., collection_name="ca_knowledge", embedding=embeddings)
        # docs = store.similarity_search(query, k=4)
        # return json.dumps([{"content": d.page_content, "source": d.metadata.get("source")} ...])
        logger.info("ca_knowledge_search stub called for: %s", query)
        return json.dumps({
            "status": "rag_pending",
            "query": query,
            "message": (
                "Knowledge base indexing is pending. Answering from LLM training knowledge. "
                "Once CA course material is indexed, this tool will return authoritative chunks."
            ),
        })

    @tool
    def format_as_accountant(answer: str) -> str:
        """
        Format a complex answer in professional accountant style with clear sections.
        Use for multi-part answers involving tax calculations, GST analysis, etc.
        The disclaimer is added automatically — do NOT include it in the answer.

        Args:
            answer: The complete answer to format
        """
        return answer

    return [get_usd_inr_rate, calculate_tax, search_user_invoices, ca_knowledge_search, format_as_accountant]


# ---------------------------------------------------------------------------
# LangGraph state + graph
# ---------------------------------------------------------------------------

class AgentState(TypedDict):
    messages: Annotated[list[AnyMessage], operator.add]


def _build_graph(user_id: int):
    """
    Compile a fresh LangGraph for the given user.
    Compile is cheap (~microseconds); fresh compile ensures closure is always
    request-scoped so user_id cannot leak across requests.
    """
    tools = _make_tools(user_id)
    llm = _build_llm()
    llm_with_tools = llm.bind_tools(tools)
    today = date.today().isoformat()
    system_prompt = _CA_SYSTEM_PROMPT.format(today=today)

    def agent_node(state: AgentState) -> dict:
        messages = [SystemMessage(content=system_prompt)] + state["messages"]
        response = llm_with_tools.invoke(messages)
        return {"messages": [response]}

    def should_continue(state: AgentState) -> str:
        last = state["messages"][-1]
        if hasattr(last, "tool_calls") and last.tool_calls:
            return "tools"
        return END

    graph = StateGraph(AgentState)
    graph.add_node("agent", agent_node)
    graph.add_node("tools", ToolNode(tools))
    graph.set_entry_point("agent")
    graph.add_conditional_edges("agent", should_continue, {"tools": "tools", END: END})
    graph.add_edge("tools", "agent")

    return graph.compile()


# ---------------------------------------------------------------------------
# Public streaming interface
# ---------------------------------------------------------------------------

def stream_agent_response(
    user_id: int,
    history: list[dict],
    user_message: str,
):
    """
    Generator that yields SSE-formatted strings.
    Caller must handle the accumulated full text for DB persistence.

    Yields:
        "data: <token>\\n\\n"  — for each streamed token
        "data: [DONE]\\n\\n"   — when the stream is complete
    """
    graph = _build_graph(user_id)

    # Reconstruct LangChain message objects from DB history
    lc_messages: list[AnyMessage] = []
    for msg in history:
        if msg["role"] == "user":
            lc_messages.append(HumanMessage(content=msg["content"]))
        elif msg["role"] == "assistant":
            lc_messages.append(AIMessage(content=msg["content"]))

    lc_messages.append(HumanMessage(content=user_message))

    # stream_mode="messages" yields (chunk, metadata) tuples — one chunk per token
    # Filter to agent node only: tool JSON would otherwise appear as garbage tokens
    try:
        for chunk, metadata in graph.stream(
            {"messages": lc_messages},
            stream_mode="messages",
        ):
            if metadata.get("langgraph_node") != "agent":
                continue
            if not hasattr(chunk, "content") or not chunk.content:
                continue
            # chunk.content can be a string or a list of content blocks (Anthropic)
            token = chunk.content if isinstance(chunk.content, str) else ""
            if isinstance(chunk.content, list):
                token = "".join(
                    block.get("text", "") if isinstance(block, dict) else ""
                    for block in chunk.content
                )
            if token:
                yield f"data: {token}\n\n"
    except Exception:
        logger.exception("LangGraph stream error for user_id=%s", user_id)
        yield "data: Sorry, I encountered an error. Please try again.\n\n"

    yield "data: [DONE]\n\n"
