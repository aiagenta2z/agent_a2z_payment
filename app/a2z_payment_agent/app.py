import asyncio
import requests
import traceback
import stripe
from urllib.parse import urlsplit
import re

from fastapi import Body, Depends, APIRouter
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles
from fastapi import Request, Response

import workflow.preview_to_pay as preview_to_pay
import workflow.post_workflow_tip as post_workflow_tip
import workflow.cost_based_consumption as cost_based_consumption
import workflow.ecommerce_checkout as ecommerce_checkout

from contextlib import asynccontextmanager
from dotenv import load_dotenv

from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import StreamingResponse

import logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

import sys
import os

current_file_path = os.path.abspath(__file__)
current_dir = os.path.dirname(current_file_path)
parent_dir = os.path.join(current_dir, '..')
parent_dir_norm = os.path.normpath(parent_dir)

if parent_dir_norm not in sys.path:
    sys.path.append(parent_dir_norm)
if current_dir not in sys.path:
    sys.path.append(current_dir)

from constants import *
from utils import *

import json

load_dotenv()

STATIC_DIR = "web/static"
TEMPLATES_DIR = "web/templates"
PLUGIN_DIR = "web/plugin"

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("Application startup...")
    await startup_event()
    yield
    print("Application shutdown...")
    await shutdown_event()

async def startup_event():
    print("Application startup...")

async def shutdown_event():
    print("Application end...")

def get_base_path(request):
    """
    """
    try:
        base_path = request.state.base_path
        if base_path is None:
            base_path = ""
        return base_path
    except Exception as e:
        print (f"Failed to get_base_path from request with error {e}")
        return ""

def generate_user_id():
    return "test_user"

templates = Jinja2Templates(directory=TEMPLATES_DIR)

app = FastAPI(lifespan=lifespan)
app.mount(f"{PRODUCTION_URL_PREFIX}/static", StaticFiles(directory=STATIC_DIR), name="static")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def add_base_path(request: Request, call_next):
    """
    """
    # remove host and port get clean path
    base_path = urlsplit(str(request.base_url)).path
    print (f"DEBUG: Add Base Path Request request.base_url: {request.base_url} and split base_path {base_path}")
    print (f"DEBUG: add_base_path request.headers {request.headers}")

    is_production = False if ("localhost" in str(request.base_url)
                              or "127.0.0.1" in str(request.base_url)
                              ) else True

    if "x-forwarded-prefix" in request.headers:  # 标准代理转发头
        base_path = request.headers["x-forwarded-prefix"]
        print(f"DEBUG: Using x-forwarded-prefix: {base_path}")

    # proxy get original uri
    if "x-original-uri" in request.headers:
        original_uri = request.headers["x-original-uri"]
        base_path = urlsplit(original_uri).path
        base_path = PRODUCTION_URL_PREFIX

    # remove trailing slash "/"
    base_path = base_path.rstrip('/')
    # replace double slash to single slash
    base_path = re.sub(r'/{2,}', '/', base_path)

    # local model return empty base path
    if base_path == "//" or base_path == "/":
        base_path = ""

    if is_production:
        base_path = PRODUCTION_URL_PREFIX

    request.state.base_path = base_path
    if base_path == "":
        print (f"DEBUG: Add Base Path Request final base_path empty...")
    else:
        print (f"DEBUG: Add Base Path Request final base_path {request.state.base_path}")
    response = await call_next(request)

    print(f"DEBUG: Add Base Path Request final base_path {request.state.base_path}")

    return response

@app.get(PRODUCTION_URL_PREFIX, response_class=HTMLResponse)
async def index_page(request: Request, response: Response):
    """
        Index Page For Payment Loop Development
    """
    base_path = get_base_path(request)
    output_dict = {}
    is_mobile = False
    try:
        ## Load Logged In User Information or Share Information
        user_id = generate_user_id()

        user_agent = request.headers.get("user-agent", "").lower()
        is_mobile = any(device in user_agent for device in [
            "mobile", "android", "iphone", "ipad", "ipod", "blackberry",
            "windows phone", "opera mini", "opera mobi"
        ])

        output_dict =  {
            "request": request,
            "base_path": base_path,
            "user_id": user_id,
            "dialogue_history": [],
            "mcp_marketplace_servers": {},
            "page_id_map": {},
            "mcp_servers_display": [],
            "agents_display": [],
            KEY_SIDEBAR_AGENT_INFO: [],
            KEY_SIDEBAR_MCP_INFO: [],
            "available_payment_workflow_list": [PAYMENT_WORKFLOW_PREVIEW_TO_PAY,
                                                PAYMENT_WORKFLOW_POST_WORKFLOW_TIP,
                                                PAYMENT_WORKFLOW_ECOMMERCE_CHECKOUT,
                                                PAYMENT_WORKFLOW_COST_BASED_CONSUMPTION],
            KEY_TITLE: "In Agent Payment",
            KEY_DESCRIPTION: "",
            KEY_KEYWORDS: "",
            KEY_CANONICAL_URL: "",
        }
        if LOG_ENABLE:
            print(f"Starting App {output_dict}")

    except Exception as e:
        logger.error(f"index_page error {e}")
        traceback.print_exc()
        output_dict =  {"request": request, "user_id": "", "dialogue_history": [], "mcp_marketplace_servers": {}}
    finally:
        print ("Ending...")

    template_name = "index_mobile.html" if is_mobile else "index.html"
    return templates.TemplateResponse(template_name, output_dict)

# ---------------------------------------------------------
# Utility: JSON streaming
# ---------------------------------------------------------
async def json_stream(events):
    """
    Turn a list of events into Server-Sent style JSON streaming.
    """
    for ev in events:
        yield json.dumps(ev) + "\n"
        await asyncio.sleep(0.05)

async def response_generator(chunk_list):
    """
        Generator of a list of chunks.
    """
    for chunk in chunk_list:
        yield chunk + CHUNK_JS_SEPARATOR

# ---------------------------------------------------------
# A2Z Payment SDK Integrate Payment Agent Into Your Agent Workflow
# ---------------------------------------------------------

import agent_a2z_payment
from agent_a2z_payment.core import get_payment_sdk, PaymentWaitingMode, Environment
from agent_a2z_payment.core import _get_paypal_access_token

environment = Environment.SANDBOX.value
payment_agent = get_payment_sdk(env=environment)

# ---------------------------------------------------------
# CHAT LOOP — LLM → Payment Gate → LLM,
# Add pre-url prefix, such as payment,
# ---------------------------------------------------------
@app.post(f"{PRODUCTION_URL_PREFIX}/api/chat")
async def chat(messages: list = Body(...)
               , kwargs: dict = Body(...)):

    # 0. process input
    print (f"DEBUG: Input messages: {messages} kwargs: {kwargs}")
    payment_flow = kwargs.get("workflow_selection", PAYMENT_WORKFLOW_COST_BASED_CONSUMPTION)
    print (f"INFO: /api/chat payment_flow {payment_flow}")
    if payment_flow == PAYMENT_WORKFLOW_PREVIEW_TO_PAY:
        generator = await preview_to_pay.run_preview_to_pay_loop(
            messages, kwargs, payment_agent, payment_stream_generator
        )
    elif payment_flow == PAYMENT_WORKFLOW_POST_WORKFLOW_TIP:
        generator = await post_workflow_tip.run_post_workflow_tip_loop(
            messages, kwargs, payment_agent, payment_stream_generator
        )
    elif payment_flow == PAYMENT_WORKFLOW_ECOMMERCE_CHECKOUT:
        generator = await ecommerce_checkout.run_ecommerce_checkout_loop(
            messages, kwargs, payment_agent, payment_stream_generator
        )
    elif payment_flow == PAYMENT_WORKFLOW_COST_BASED_CONSUMPTION:
        # This uses the original core logic, now wrapped in its own file for consistency
        generator = await cost_based_consumption.run_cost_based_consumption_loop(
            messages, kwargs, payment_agent, payment_stream_generator
        )
    else:
        # Fallback or error handling
        raise HTTPException(status_code=400, detail=f"Unknown payment flow: {payment_flow}")
    return StreamingResponse(generator, media_type="text/event-stream")

# --- NEW ASYNC GENERATOR FUNCTION ---
async def payment_stream_generator(order_id, message_id, chunk_list, orders):
    """
        Args:
            order_id (str): order_id
            message_id: message_id
            chunk_list: List of json chunk of message
            orders: Dict, key: order_id, value: Dict
    """
    # 1. Stream initial chunks (HTML/JS for checkout)
    for chunk in chunk_list:
        yield chunk + CHUNK_JS_SEPARATOR

    # 2. Stream the 'waiting' message
    waiting_for_payment_result = "Please wait for a few seconds for payment to be processed and notify us.."
    waiting_for_webhook_chunk = json.dumps(
        assembly_message("assistant", OUTPUT_FORMAT_HTML, waiting_for_payment_result, content_type=CONTENT_TYPE_HTML, section="",
                         message_id=message_id, template=TEMPLATE_STREAMING_CONTENT_TYPE))
    yield waiting_for_webhook_chunk + CHUNK_JS_SEPARATOR

    # --- PAUSE AND POLL IMPLEMENTATION ---
    ## "LONG_POOL", "SSE"
    payment_waiting_mode = PAYMENT_WAITING_MODE

    payment_succeeded = False
    time_interval_payment = TIME_LONG_POLL_PAYMENT_INTERVAL_DEFAULT
    time_total_await_payment = TIME_TOTAL_AWAITING_PAYMENT_DEFAULT

    if payment_waiting_mode == PaymentWaitingMode.LONG_POOL:
        max_attempts = 3
        for current_attempt in range(max_attempts):
            await asyncio.sleep(time_interval_payment)
            # Check the DB/Agent state
            order = orders.get(order_id)
            if order and order.get("status") == "paid":
                payment_succeeded = True
                print(f"Server Poll Order Status: Order {order_id} confirmed paid on attempt {current_attempt + 1}.")
                break
            else:
                print(
                    f"Server Poll Order Status: Order {order_id} status is {order.get('status', 'not found')}. Attempt {current_attempt + 1}/{max_attempts}.")

    elif payment_waiting_mode == PaymentWaitingMode.SSE:

        order = orders.get(order_id)
        payment_event = order.get("event")
        if payment_event:
            try:
                await asyncio.wait_for(payment_event.wait(), timeout=time_total_await_payment)

                # If the wait succeeds without timeout, the event was set by the webhook
                if order.get("status") == "paid":
                    payment_succeeded = True
                else:
                    # This could happen if the webhook arrived but set a different status (e.g., failed)
                    pass
            except asyncio.TimeoutError:
                # The timeout was reached, payment not confirmed within the limit
                print(f"Server Await Status: Order {order_id} timed out after {time_total_await_payment} seconds.")

        else:
            print(f"ERROR: No event found for order {order_id}. Falling back to old logic (or handling error).")

    else:
        print (f"DEBUG: payment_waiting_mode {payment_waiting_mode} is not supported")

    # 3. Stream the final response
    payment_status_display = {"order_id": order_id}
    if payment_succeeded:
        final_message = payment_agent.llm_after_payment(order_id)
        success_html = payment_agent.render_checkout_success(**payment_status_display)
        yield json.dumps(
            assembly_message("assistant", OUTPUT_FORMAT_HTML, success_html, content_type=CONTENT_TYPE_HTML, section="",
                             message_id=message_id, template=TEMPLATE_STREAMING_CONTENT_TYPE)) + CHUNK_JS_SEPARATOR

        # Stream the final LLM response
        yield json.dumps(
            assembly_message("assistant", OUTPUT_FORMAT_HTML, final_message, content_type=CONTENT_TYPE_HTML, section="",
                             message_id=message_id, template=TEMPLATE_STREAMING_CONTENT_TYPE)) + CHUNK_JS_SEPARATOR
    else:
        timeout_html = payment_agent.render_checkout_failure(**payment_status_display)
        yield json.dumps(
            assembly_message("assistant", OUTPUT_FORMAT_HTML, timeout_html, content_type=CONTENT_TYPE_HTML, section="",
                             message_id=message_id, template=TEMPLATE_STREAMING_CONTENT_TYPE)) + CHUNK_JS_SEPARATOR

# ---------------------------------------------------------
# STRIPE WEBHOOK
# ---------------------------------------------------------
@app.post(f"{PRODUCTION_URL_PREFIX}/stripe/webhook")
async def stripe_webhook(request: Request):
    """
        If the payment is successful, stripe will post request to the webhook endpoint.
    """
    webhook_secret = payment_agent.config.stripe_webhook_secret
    if webhook_secret is None:
        print (f"ERROR: Stripe Webhook Secret not found in environment variables. Exiting.")
        raise HTTPException(status_code=400, detail=str("WebHook Stripe Secret is not set..."))

    try:
        payload = await request.body()
        sig_header = request.headers.get("stripe-signature")

        event = stripe.Webhook.construct_event(
            payload, sig_header, webhook_secret
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    # -----------------------------
    # Payment succeeded
    # -----------------------------
    if event["type"] == "payment_intent.succeeded":
        intent = event["data"]["object"]
        order_id = intent["metadata"]["order_id"]

        ## update the order status of the agent
        order = payment_agent.orders[order_id]
        if order:
            order["status"] = "paid"
            print(f"INFO: ORDER {order_id} PAID.")

            ## Add Post Request to Status Update
            payment_event = order.get("event")
            if payment_event:
                payment_event.set()
                print(f"INFO: EVENT SET for Order {order_id}. Streaming response should resume immediately.")
            else:
                print(f"WARNING: Event not found for Order {order_id}. Streaming may fall back to timeout.")
        else:
            print (f"Error: Error for Order {order_id} Order Not Found in Payment Agent Dict")

    return {"status": "ok"}

# ---------------------------------------------------------
# Resume LLM after payment
# Front-end should poll this.
# ---------------------------------------------------------
@app.get(f"{PRODUCTION_URL_PREFIX}/status")
async def payment_status(order_id: str):
    order = payment_agent.orders.get(order_id)

    if not order:
        raise HTTPException(404, "Order not found")

    if order["status"] != "paid":
        return {"status": "pending"}

    # LLM continues conversation
    msg = payment_agent.llm_after_payment(order_id)
    return {
        "status": "paid",
        "assistant_message": msg
    }

@app.post(f"{PRODUCTION_URL_PREFIX}/paypal/webhook")
async def paypal_webhook(request: Request):
    """
        Handles PayPal webhook events for order status updates, with mandatory signature verification.

        Return:
            success: order.get("status") == "paid", order.get("event") continue
    """
    # 1. Configuration Check
    ### Environment
    paypal_client_id = payment_agent.config.paypal_client_id
    paypal_secret = payment_agent.config.paypal_secret
    paypal_webhook_id = payment_agent.config.paypal_webhook_id

    # paypal_client_id = os.getenv(KEY_PAYPAL_CLIENT_ID)
    # paypal_secret = os.getenv(KEY_PAYPAL_SECRET)
    if LOG_ENABLE:
        print (f"DEBUG: Posting PayPal Webhook Event for Order ID paypal_client_id {paypal_client_id} | paypal_secret {paypal_secret}|paypal_webhook_id {paypal_webhook_id}")

    if not all([paypal_webhook_id, paypal_client_id, paypal_secret]):
        logging.error("PayPal webhook configuration missing (ID, Client ID, or Secret).")
        # Return 400 immediately if configuration is missing to avoid processing
        raise HTTPException(status_code=400, detail="PayPal configuration not complete.")

    # 2. Verify Webhook Signature (CRITICAL)
    if not await _verify_paypal_webhook(request, paypal_client_id, paypal_secret, paypal_webhook_id, environment):
        logging.error("PayPal Webhook Signature Verification FAILED.")
        # Return 403 Forbidden on verification failure
        raise HTTPException(status_code=403, detail="Webhook signature verification failed.")

    # 3. Process Event
    event = await request.json()
    event_type = event.get("event_type")
    resource = event.get("resource", {})

    if LOG_ENABLE:
        print (f"DEBUG: Paypal input resource {resource}")

    ## Get the Reference Order From Paypal Reference ID
    order_id = ""
    order = None

    # We process both APPROVED and COMPLETED, but only set the status to 'paid' on COMPLETED
    if event_type in ["CHECKOUT.ORDER.APPROVED", "CHECKOUT.ORDER.COMPLETED"]:

        paypal_order_id = resource.get("id")
        reference_id = ""
        try:
            purchase_units = resource.get("purchase_units")[0]
            reference_id = purchase_units.get("reference_id", "")
        except Exception as e2:
            print (f"DEBUG: Paypal reference ID {reference_id} not found with error {e2}")
        if LOG_ENABLE:
            print (f"DEBUG: Parsing From resource {resource} Reference ID {reference_id}")

        # Assuming our internal ID is the PayPal Order ID
        order_id = reference_id
        if not order_id:
            logging.warning(f"PayPal event {event_type} missing reference order ID.")
            return {"status": "ok"}  # Return 200 OK for logging, no action taken

        # Find the internal order
        order = payment_agent.orders.get(order_id)
        if not order:
            logging.error(f"Order {order_id} not found in Payment Agent Dict. Ignoring event.")
            return {"status": "ok"}  # Return 200 OK, nothing to do internally

        logging.info(
            f"Processing PayPal event: {event_type} for Order: {order_id}. Current status: {order.get('status')}")

        if event_type == "CHECKOUT.ORDER.COMPLETED":

            # Only update status and set event if it hasn't been paid already (idempotency check)
            if order.get("status") != "paid":
                order["status"] = "paid"
                logging.info(f"ORDER {order_id} status updated to PAID via PayPal.")

                payment_event = order.get("event")
                if payment_event:
                    payment_event.set()
                    logging.info(f"EVENT SET for Order {order_id}. Streaming response resumed.")
                else:
                    logging.warning(f"Event missing for Order {order_id}.")
            else:
                logging.info(
                    f"Idempotent: Order {order_id} already marked as paid. Ignoring duplicate COMPLETED event.")

        elif event_type == "CHECKOUT.ORDER.APPROVED":
            # Log the approval but do not change the status or set the event (we wait for COMPLETED)
            logging.info(f"Order {order_id} successfully APPROVED by user. Waiting for COMPLETED event.")
            # tell paypal to move the money
            if await _capture_paypal_order(paypal_order_id, paypal_client_id, paypal_secret, environment):
                print("Capture initiated. Waiting for COMPLETED webhook...")

                ## update order status
                if order.get("status") != "paid":
                    order["status"] = "paid"
                    logging.info(f"ORDER {order_id} status updated to PAID via PayPal.")

                ## If order is complete, set the loop
                ## Add Post Request to Status Update
                payment_event = order.get("event")
                if payment_event:
                    payment_event.set()
                    print(f"INFO: EVENT SET for Order {order_id}. Streaming response should resume immediately.")
                else:
                    print(f"WARNING: Event not found for Order {order_id}. Streaming may fall back to timeout.")

            else:
                print("Capture failed. Manual review needed.")

    elif event_type == "PAYMENT.CAPTURE.COMPLETED":
        if order_id != "" and order is not None:

            if order.get("status") != "paid":
                order["status"] = "paid"
                logging.info(f"ORDER {order_id} status updated to PAID via PayPal.")

            payment_event = order.get("event")
            if payment_event:
                payment_event.set()
                print(f"INFO: EVENT SET for Order {order_id}. Streaming response should resume immediately.")
            else:
                print(f"WARNING: Event not found for Order {order_id}. Streaming may fall back to timeout.")
        else:
            print(f"WARNING: Event PAYMENT.CAPTURE.COMPLETE Order {order_id} {order}")
    else:
        # 4. Handle other/unwanted event types
        logging.info(f"Received unhandled PayPal event type: {event_type}.")

    # 4. Success Response
    # PayPal requires a 200/OK response to acknowledge receipt.
    return {"status": "ok"}

async def _verify_paypal_webhook(request: Request, client_id: str, client_secret: str, webhook_id: str,
                                 environment: str) -> bool:
    """
    Verifies the integrity and authenticity of a PayPal webhook event by calling
    PayPal's verification API. Returns True if the event is verified, False otherwise.
    """
    try:
        # 1. Get Access Token (needed to authorize the verification API call)
        access_token = _get_paypal_access_token(client_id, client_secret, environment)
        if not access_token:
            logging.error("Failed to get PayPal access token for verification.")
            return False

        # 2. Prepare Verification Payload
        webhook_payload = await request.json()

        verification_payload = {
            # These headers are sent by PayPal in the original webhook request
            "auth_algo": request.headers.get("PAYPAL-AUTH-ALGO"),
            "cert_url": request.headers.get("PAYPAL-CERT-URL"),
            "transmission_id": request.headers.get("PAYPAL-TRANSMISSION-ID"),
            "transmission_sig": request.headers.get("PAYPAL-TRANSMISSION-SIG"),
            "transmission_time": request.headers.get("PAYPAL-TRANSMISSION-TIME"),
            "webhook_id": webhook_id,  # Your configured Webhook ID
            "webhook_event": webhook_payload,  # The entire body of the webhook event
        }

        base_url = "https://api-m.sandbox.paypal.com" if environment == Environment.SANDBOX.value else "https://api-m.paypal.com"
        verify_url = f"{base_url}/v1/notifications/verify-webhook-signature"

        # 3. Send Verification Request to PayPal
        if LOG_ENABLE:
            print(f"DEBUG: _verify_paypal_webhook verify_url is {verify_url}")
            print(f"DEBUG: _verify_paypal_webhook access_token generated is {access_token}")
            print(f"DEBUG: _verify_paypal_webhook webhook_payload is {webhook_payload}")
            print(f"DEBUG: _verify_paypal_webhook verification_payload generated is {verification_payload}")

        response = requests.post(
            verify_url,
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {access_token}"
            },
            data=json.dumps(verification_payload)
        )
        response.raise_for_status()

        result = response.json()
        if LOG_ENABLE:
            print(f"DEBUG: _verify_paypal_webhook final result generated is {result}")

        return result.get("verification_status") == "SUCCESS"

    except requests.exceptions.RequestException as e:
        logging.error(f"PayPal Webhook Verification Failed (Request Error): {e}")
        return False
    except Exception as e:
        logging.error(f"PayPal Webhook Verification Failed (General Error): {e}")
        return False

async def _capture_paypal_order(order_id: str, client_id: str, client_secret: str, environment: str) -> bool:
    """
    Executes the final server-side CAPTURE on an APPROVED PayPal Order.
    This action triggers the CHECKOUT.ORDER.COMPLETED webhook event.

    Args:
        order_id: The PayPal Order ID (e.g., '2PY69743MW597090U' from your log).
        client_id: Your PayPal Client ID.
        client_secret: Your PayPal Secret.
        environment: Sandbox or Production environment.

    Returns:
        True if the capture request was successful and the status is 'COMPLETED', False otherwise.
    """
    try:
        # 1. Get the required access token
        access_token = _get_paypal_access_token(client_id, client_secret, environment)
        if not access_token:
            logging.error(f"Failed to get PayPal access token to capture order {order_id}.")
            return False

        # 2. Construct the API URL
        base_url = "https://api-m.sandbox.paypal.com" if environment == Environment.SANDBOX.value else "https://api-m.paypal.com"
        # The endpoint for capturing an order is /v2/checkout/orders/{id}/capture
        capture_url = f"{base_url}/v2/checkout/orders/{order_id}/capture"

        logging.info(f"Attempting to CAPTURE PayPal Order: {order_id} at {capture_url}")

        # 3. Send the Capture Request
        response = requests.post(
            capture_url,
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {access_token}"
            },
            # An empty body {} is sufficient for a simple capture request
            json={}
        )
        response.raise_for_status()  # Raise exception for 4xx or 5xx status codes

        capture_data = response.json()

        # 4. Check Final Capture Status
        final_status = capture_data.get("status")

        if final_status == "COMPLETED":
            logging.info(f"SUCCESS: Order {order_id} captured successfully (Status: COMPLETED).")
            # This capture success will also trigger the CHECKOUT.ORDER.COMPLETED webhook
            return True
        elif final_status == "PENDING":
            logging.warning(f"Order {order_id} captured, but is PENDING review. Awaiting final COMPLETED webhook.")
            return False  # Treat as not finalized for safety
        else:
            logging.error(
                f"Capture request succeeded, but final status was unexpected: {final_status}. Full response: {capture_data}")
            return False

    except requests.exceptions.RequestException as e:
        error_details = f"PayPal Capture Request Failed for Order {order_id}. Error: {e}"
        if e.response is not None:
            error_details += f" | Response: {e.response.text}"
        logging.error(error_details)
        return False
    except Exception as e:
        logging.error(f"General error during PayPal Capture for Order {order_id}: {e}")
        return False
