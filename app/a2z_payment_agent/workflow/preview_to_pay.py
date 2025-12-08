# examples/preview_to_pay.py
import json
import uuid
import asyncio
from typing import Dict, Any, List

# Assuming these are available from the main app environment
from constants import *
from utils import assembly_message, get_new_message_id

async def run_preview_to_pay_loop(
        messages: List[Dict],
        kwargs: Dict[str, Any],
        payment_agent: Any,  # Mocking the type for simplicity
        payment_stream_generator: Any,
        default_amount: float = 1.00,
        default_currency: str = "USD"
):
    """
    Implements the Preview-to-Pay workflow.
    1. Determine cost (e.g., $1.00 for the full 4K image).
    2. Stream the preview HTML.
    3. Stream the payment card HTML/JS.
    4. Start the payment_stream_generator to wait for the webhook.
    """
    # 1. LLM/Agent determines the cost
    # For demo: hardcode the price for the 4K image
    amount = default_amount
    currency = default_currency
    amount = MIN_PAYMENT_AMOUNT_USD if amount < MIN_PAYMENT_AMOUNT_USD else amount

    # 2. Prepare the preview content
    message_id = get_new_message_id()
    preview_html = f'<div><div>This is the preview-to-payment image</div><img src="{PRODUCTION_URL_PREFIX}/static/img/preview_minecraft.png" style="width:200px"></img><br><div>Please complete the transaction to see the full 4K version</div></div>'

    preview_chunk = json.dumps(
        assembly_message("assistant", OUTPUT_FORMAT_HTML, preview_html, content_type=CONTENT_TYPE_HTML,
                         section="", message_id=message_id, template=TEMPLATE_STREAMING_CONTENT_TYPE))

    # 3. Create order and payment intent (server-side)
    order = payment_agent.create_order(amount, currency)
    order_id = order.get(ORDER_ID, str(uuid.uuid4()))
    ## Add Event to Hold Until Notify by Payment Server
    payment_agent.orders[order_id]["event"] = asyncio.Event()

    checkout_result = payment_agent.checkout(payment_method="all", order_id=order_id, amount=amount, currency=currency)
    checkout_html = checkout_result.get("checkout_html", "")
    checkout_js = checkout_result.get("checkout_js", "")

    content_type_chunk = json.dumps(
        assembly_message("assistant", OUTPUT_FORMAT_HTML, checkout_html, content_type=CONTENT_TYPE_HTML,
                         section="",
                         message_id=message_id, template=TEMPLATE_STREAMING_CONTENT_TYPE))
    ## CONTENT_TYPE_JS, finish rendering
    js_chunk = json.dumps(
        assembly_message("assistant", OUTPUT_FORMAT_HTML, checkout_js, content_type=CONTENT_TYPE_JS,
                         section="",
                         message_id=message_id, template=TEMPLATE_STREAMING_CONTENT_TYPE))

    # Combine the preview and checkout chunks for initial stream
    chunk_list = [preview_chunk, content_type_chunk, js_chunk]

    # 4. Generator function to wait for payment and stream the final 4K image/content
    return payment_stream_generator(
        order_id, message_id, chunk_list, payment_agent.orders
    )
