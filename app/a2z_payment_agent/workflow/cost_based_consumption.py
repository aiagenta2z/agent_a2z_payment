# workflow/cost_based_consumption.py
import json
import uuid
import asyncio
from typing import Dict, Any, List

from constants import *
from utils import assembly_message, get_new_message_id

async def run_cost_based_consumption_loop(
        messages: List[Dict],
        kwargs: Dict[str, Any],
        payment_agent: Any,
        payment_stream_generator: Any,
):
    """
    Implements the Cost-Based Consumption workflow (Default Logic).
    1. LLM/Agent calculates the cost based on input/estimated work.
    2. Gating: Stream the payment card HTML/JS.
    3. Start the payment_stream_generator to wait for payment/webhook.
    4. If paid, run the full LLM workflow (llm_after_payment).
    """
    message_id = get_new_message_id()

    # 1. LLM/Agent decides cost
    output = payment_agent.calculate_payment(messages)  # Mocking: actual cost calculation based on expected tokens/APIs
    amount = output.get(AMOUNT, 1.0)
    currency = output.get(CURRENCY, "USD")

    ## minimum payment requirements for stripe and more 1 dollars
    amount = MIN_PAYMENT_AMOUNT_USD if amount < MIN_PAYMENT_AMOUNT_USD else amount

    print(f"Payment Agent calculate_payment output {output}")
    consumption_html = f'<div>This is the cost based consumption</div><p>You have consumed xxx tokens, xxx images<p>'

    consumption_chunk = json.dumps(
        assembly_message("assistant", OUTPUT_FORMAT_HTML, consumption_html, content_type=CONTENT_TYPE_HTML,
                         section="", message_id=message_id, template=TEMPLATE_STREAMING_CONTENT_TYPE))

    # 2. Create order and insert db
    order = payment_agent.create_order(amount, currency)
    order_id = order.get(ORDER_ID, str(uuid.uuid4()))
    payment_agent.orders[order_id]["event"] = asyncio.Event()

    # 3. Create payment intent and return checkout card html/js
    checkout_result = payment_agent.checkout(payment_method="all", order_id=order_id, amount=amount, currency=currency)
    checkout_html = checkout_result.get("checkout_html", "")
    checkout_js = checkout_result.get("checkout_js", "")

    content_type_chunk = json.dumps(
        assembly_message("assistant", OUTPUT_FORMAT_HTML, checkout_html, content_type=CONTENT_TYPE_HTML, section="",
                         message_id=message_id, template=TEMPLATE_STREAMING_CONTENT_TYPE))
    js_chunk = json.dumps(
        assembly_message("assistant", OUTPUT_FORMAT_HTML, checkout_js, content_type=CONTENT_TYPE_JS, section="",
                         message_id=message_id, template=TEMPLATE_STREAMING_CONTENT_TYPE))

    # 4. Stream events to front-end
    chunk_list = [consumption_chunk, content_type_chunk, js_chunk]

    generator = payment_stream_generator(
        order_id, message_id, chunk_list, payment_agent.orders
    )

    return generator
