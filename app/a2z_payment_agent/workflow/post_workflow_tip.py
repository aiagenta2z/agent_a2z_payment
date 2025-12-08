# examples/post_workflow_tip.py
import json
import uuid
import asyncio
from typing import Dict, Any, List

# Assuming these are available from the main app environment
from constants import *
from utils import assembly_message, get_new_message_id

async def run_post_workflow_tip_loop(
        messages: List[Dict],
        kwargs: Dict[str, Any],
        payment_agent: Any,
        payment_stream_generator: Any,
        default_tip_amount: float = 5.00,
        default_currency: str = "USD"
):
    """
    Implements the Post-Workflow Tip (Tipping) scenario.
    1. Complete the main workflow (deliver the report/content).
    2. Stream the completion message + the voluntary tip card.
    3. The payment_stream_generator will handle the optional wait.
    """
    message_id = get_new_message_id()

    # 1. Agent completes the task and generates the main output (e.g., a report)
    # The main output is NOT gated.
    final_report = '<p>This is the generated Deep Research Report. Would you help buy me a coffee/tip me/send me a red envelop?</p> <br><img src="https://agent.deepnlp.org/static/img/pdf-file-icon-transparent.png" style="width:100px"></img>'
    report_chunk = json.dumps(
        assembly_message("assistant", OUTPUT_FORMAT_HTML, final_report, content_type=CONTENT_TYPE_HTML, section="",
                         message_id=message_id, template=TEMPLATE_STREAMING_CONTENT_TYPE))

    # 2. Determine a suggested tip amount (can be configurable)
    amount = default_tip_amount
    currency = default_currency

    # 3. Create a voluntary order and get the tip card HTML/JS
    order = payment_agent.create_order(amount, currency)
    order_id = order.get(ORDER_ID, str(uuid.uuid4()))
    payment_agent.orders[order_id]["event"] = asyncio.Event()

    # Get a specific "Tipping" checkout card if available, otherwise "all"
    checkout_result = payment_agent.checkout(payment_method="all", order_id=order_id, amount=amount, currency=currency)
    checkout_html = checkout_result.get("checkout_html", "")
    checkout_js = checkout_result.get("checkout_js", "")

    tip_html_chunk = json.dumps(
        assembly_message("assistant", OUTPUT_FORMAT_HTML, checkout_html, content_type=CONTENT_TYPE_HTML, section="",
                         message_id=message_id, template=TEMPLATE_STREAMING_CONTENT_TYPE))
    tip_js_chunk = json.dumps(
        assembly_message("assistant", OUTPUT_FORMAT_HTML, checkout_js, content_type=CONTENT_TYPE_JS, section="",
                         message_id=message_id, template=TEMPLATE_STREAMING_CONTENT_TYPE))

    # Combine the report and tip card chunks for initial stream
    chunk_list = [report_chunk, tip_html_chunk, tip_js_chunk]

    async def tip_stream_generator(initial_chunks):
        for chunk in initial_chunks:
            yield chunk + CHUNK_JS_SEPARATOR
        # End of stream, the tip is optional.
        print(f"DEBUG: Tip request streamed for order {order_id}. Workflow finished.")

    return tip_stream_generator(chunk_list)
