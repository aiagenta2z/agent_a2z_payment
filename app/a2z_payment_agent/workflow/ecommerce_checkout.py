# workflow/ecommerce_checkout.py
import json
import uuid
import asyncio
from typing import Dict, Any, List

from constants import *
from utils import assembly_message, get_new_message_id

async def run_ecommerce_checkout_loop(
        messages: List[Dict],
        kwargs: Dict[str, Any],
        payment_agent: Any,
        payment_stream_generator: Any,
        default_price: float = 120.00,
        default_currency: str = "USD"
):
    """
    Implements the E-Commerce Checkout scenario.
    1. Agent summarizes the final cart/order details.
    2. Stream the summary and offer the A2Z credit/unified payment option.
    3. Gated: Wait for payment to be confirmed (e.g., using A2Z credit deduction).
    4. If paid, confirm the e-commerce transaction completion.
    """
    message_id = get_new_message_id()

    # 1. Agent summarizes the e-commerce cart/order
    amount = default_price
    currency = default_currency

    cart_summary = f"""
    <h3>🛒 Final Order Summary</h3>
    <p>Product: Blue Coat (Brand: XXX)</p>
    <p>Total: **{currency} {amount:,.2f}**</p>
    <p>Please use the available payment options to finalize your order with the E-Commerce site.</p>
    """
    summary_chunk = json.dumps(
        assembly_message("assistant", OUTPUT_FORMAT_HTML, cart_summary, content_type=CONTENT_TYPE_HTML,
                         section="",
                         message_id=message_id, template=TEMPLATE_STREAMING_CONTENT_TYPE))

    # 2. Create order and payment intent, focusing on immediate A2Z/Unified Payment
    order = payment_agent.create_order(amount, currency)
    order_id = order.get(ORDER_ID, str(uuid.uuid4()))
    payment_agent.orders[order_id]["event"] = asyncio.Event()

    # Focus on 'agenta2z' or 'all' for this checkout scenario
    checkout_result = payment_agent.checkout(payment_method="all", order_id=order_id, amount=amount, currency=currency)
    checkout_html = checkout_result.get("checkout_html", "")
    checkout_js = checkout_result.get("checkout_js", "")

    content_type_chunk = json.dumps(
        assembly_message("assistant", OUTPUT_FORMAT_HTML, checkout_html, content_type=CONTENT_TYPE_HTML, section="",
                         message_id=message_id, template=TEMPLATE_STREAMING_CONTENT_TYPE))
    js_chunk = json.dumps(
        assembly_message("assistant", OUTPUT_FORMAT_HTML, checkout_js, content_type=CONTENT_TYPE_JS, section="",
                         message_id=message_id, template=TEMPLATE_STREAMING_CONTENT_TYPE))

    # Stream summary, then checkout card
    chunk_list = [summary_chunk, content_type_chunk, js_chunk]

    # 3. Use the main generator to wait for confirmation
    generator = payment_stream_generator(
        order_id, message_id, chunk_list, payment_agent.orders
    )

    return generator
