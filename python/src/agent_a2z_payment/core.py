import logging
from enum import Enum
import tiktoken
import time
import math
import stripe
import requests

import sqlite3
from datetime import datetime, timedelta
from typing import List, Dict, Tuple, Optional, Any
from calendar import monthrange
import uuid

import sys, os

if sys.version_info <= (3, 9):
    from importlib_resources import files
else:
    from importlib.resources import files

from .constants import *

template_filepath_obj = files('agent_a2z_payment') / "web/checkout/checkout_template.html"
script_filepath_obj = files('agent_a2z_payment') / "web/checkout/checkout_scripts.js"
checkout_success_filepath_obj = files('agent_a2z_payment') / "web/checkout/checkout_success.html"
checkout_failure_filepath_obj = files('agent_a2z_payment') / "web/checkout/checkout_failure.html"

template_filepath = str(template_filepath_obj)
script_filepath = str(script_filepath_obj)
checkout_success_filepath = str(checkout_success_filepath_obj)
checkout_failure_filepath = str(checkout_failure_filepath_obj)

# --- Constants & Configuration ---
class Environment(Enum):
    SANDBOX = "sandbox"
    PRODUCTION = "production"

class PaymentProvider(Enum):
    STRIPE = "stripe"
    PAYPAL = "paypal"
    ALIPAY = "alipay"
    WECHAT = "wechat"
    AGENT_A2Z = "agenta2z"
    CREDIT_CARD = "credit_card"

class PaymentWaitingMode(Enum):
    SSE = "SSE"
    LONG_POOL = "LONG_POOL"

    def __eq__(self, other):
        if isinstance(other, str):
            return self.name == other or self.value == other
        return super().__eq__(other)

# Endpoint Constants
AGENT_A2Z_ENDPOINTS = {
    Environment.SANDBOX: "https://payment.aiagenta2z.com/api/sandbox",
    Environment.PRODUCTION: "https://payment.aiagenta2z.com/api/live"
}

class AgentPaymentConfig:
    """
    Configuration for the Payment SDK.
    Loads from environment variables or direct initialization.
    """
    def __init__(self,
                 environment: str = "sandbox",
                 # ---- Stripe Integration ----
                 stripe_secret_key: Optional[str] = None,
                 stripe_publishable_key: Optional[str] = None,
                 stripe_webhook_secret: Optional[str] = None,
                 agenta2z_api_key: Optional[str] = None,
                 # ---- Paypal Integration ----
                 paypal_client_id: Optional[str] = None,
                 paypal_secret: Optional[str] = None,
                 paypal_webhook_id: Optional[str] = None,
                 alipay_app_id: Optional[str] = None,
                 wechat_mch_id: Optional[str] = None,
                 price_per_thousand_token=0.10,
                 model_name="gpt-4"):
        self.environment = Environment(environment.lower())
        # load dotenv
        from dotenv import load_dotenv
        load_dotenv()
        if self.environment == Environment.SANDBOX:
            ## Set different environment keys
            self.stripe_secret_key = stripe_secret_key or os.getenv(KEY_STRIPE_API_KEY_SK_TEST)
            self.stripe_publishable_key = stripe_publishable_key or os.getenv(KEY_STRIPE_API_KEY_PK_TEST)
            self.stripe_webhook_secret = stripe_webhook_secret or os.getenv(KEY_STRIPE_WEBHOOK_SECRET)
            self.agenta2z_api_key = agenta2z_api_key or os.getenv(KEY_AGENT_A2Z_API_KEY_TEST)
            self.agenta2z_base_url = AGENT_A2Z_ENDPOINTS[self.environment]
            self.paypal_client_id = paypal_client_id or os.getenv(KEY_PAYPAL_CLIENT_ID_TEST)
            self.paypal_secret = paypal_secret or os.getenv(KEY_PAYPAL_SECRET_TEST)
            self.paypal_webhook_id = paypal_webhook_id or os.getenv(KEY_PAYPAL_WEBHOOK_ID)
            self.alipay_app_id = alipay_app_id or os.getenv(KEY_ALIPAY_APP_ID_TEST)
            self.wechat_mch_id = wechat_mch_id or os.getenv(KEY_WECHAT_MCH_ID_TEST)

        elif self.environment == Environment.PRODUCTION:

            self.stripe_secret_key = stripe_secret_key or os.getenv(KEY_STRIPE_API_KEY_SK_LIVE)
            self.stripe_publishable_key = stripe_publishable_key or os.getenv(KEY_STRIPE_API_KEY_PK_LIVE)
            self.agenta2z_api_key = agenta2z_api_key or os.getenv(KEY_AGENT_A2Z_API_KEY_LIVE)
            self.agenta2z_base_url = AGENT_A2Z_ENDPOINTS[self.environment]

            self.paypal_client_id = paypal_client_id or os.getenv(KEY_PAYPAL_CLIENT_ID_LIVE)
            self.paypal_secret = paypal_secret or os.getenv(KEY_PAYPAL_SECRET_LIVE)
            self.alipay_app_id = alipay_app_id or os.getenv(KEY_ALIPAY_APP_ID_LIVE)
            self.wechat_mch_id = wechat_mch_id or os.getenv(KEY_WECHAT_MCH_ID_LIVE)

        else:
            raise ValueError("Environment must be either SANDBOX or PRODUCTION")

        self.model_name = model_name
        self.price_per_thousand_token = price_per_thousand_token

class TiktokenAgent:
    """
    A class that wraps token estimation functionality,
    mimicking the core usage of the tiktoken library for counting tokens.
    """

    # Placeholder mapping of model names to their encoding scheme for simulation
    _ENCODING_MAP = {
        "gpt-4": "cl100k_base",
        "gpt-3.5-turbo": "cl100k_base",
        "text-davinci-003": "p50k_base",
        "text-davinci-002": "p50k_base",
        "default": "cl100k_base",
    }

    def __init__(self, model_name: str = "default"):
        """
        Initializes the agent with a specific model encoding.

        :param model_name: The name of the model (e.g., 'gpt-4', 'gpt-3.5-turbo').
        """
        self.model_name = model_name
        self.encoding_name = self._ENCODING_MAP.get(model_name, self._ENCODING_MAP["default"])
        self.encoding = tiktoken.get_encoding(self.encoding_name)
        print(f"Initialized TiktokenAgent for model '{self.model_name}' using encoding '{self.encoding_name}'.")

    def count_tokens(self, text: str) -> int:
        """
        Uses the actual tiktoken encoding to get the precise count.
        """
        token_ids = self.encoding.encode(text)
        return len(token_ids)

    @classmethod
    def from_model_name(cls, model_name: str):
        """
        Class method to create an instance based on a model name.
        """
        return cls(model_name)

def render_template(filepath, **kwargs):
    """
    Loads an HTML template file and formats it using keyword arguments.
    """
    try:
        # Read the entire content of the template file
        with open(filepath, 'r') as f:
            template_content = f.read()
        rendered_html = template_content.format(**kwargs)
        return rendered_html
    except FileNotFoundError:
        return f"Error: Template file not found at {filepath}"
    except KeyError as e:
        return f"Error: Missing variable {e} in template arguments."
    except Exception as e:
        return f"Error: Failed to Render Template with error {e}"

class PaymentAgent:

    def __init__(self, config: AgentPaymentConfig):
        self.config = config
        self.orders = {}
        self.tokenizer = TiktokenAgent.from_model_name(config.model_name)
        stripe.api_key = config.stripe_secret_key
        if stripe.api_key is None or stripe.api_key == "":
            print(f"PaymentAgent stripe_api_key is missing and not set...")
        else:
            print(f"PaymentAgent stripe_api_key is set successfully...")

    def calculate_payment(self, messages, **kwargs) -> dict:
        """
        Calculate the payment amount needed from the messages.

        :param messages: A list of message dictionaries (e.g., [{"role": "user", "content": "..."}]).
        :return: A dictionary containing the calculated amount, currency, and token count.
        """
        output = {}

        # 1. Estimate Total Tokens
        estimated_tokens = 0
        # Iterate through all messages (assuming message is a dict with a 'content' key)
        for message in messages:
            content = message.get("content", "")
            if content:
                estimated_tokens += self.tokenizer.count_tokens(content)
        price_per_thousand_token = self.config.price_per_thousand_token
        thousands_of_tokens = estimated_tokens / 1000.0
        amount = thousands_of_tokens * price_per_thousand_token

        amount = amount if amount >= MIN_PAYMENT_AMOUNT_STRIPE_CENTS/100.0 else MIN_PAYMENT_AMOUNT_STRIPE_CENTS/100.0

        # Final Output Structure
        output[AMOUNT] = round(amount, 4)
        output[CURRENCY] = CURRENCY_USD
        output[ESTIMATED_TOKENS] = estimated_tokens
        return output

    def create_order(self, amount: int, currency: str = CURRENCY_USD, description: str = "") -> Dict:
        """
            Creates a generic internal order record.
            amount: in smallest unit (e.g., cents)
        """
        order_id = f"order_{uuid.uuid4().hex[:16]}"
        cur_timestamp = int(time.time())
        self.orders[order_id] = {
            ORDER_ID: order_id,
            AMOUNT: amount,
            CURRENCY: currency,
            DESCRIPTION: description,
            STATUS: STATUS_PENDING,
            CREATED: cur_timestamp,
            EVENT: None
        }
        return self.orders[order_id]

    def create_payment(self, order_id: str, method: str):
        """
            Return:
                Payment Related URLs, such as return_url, web_hook
        """
        order = self.orders.get(order_id, {})
        if len(order) == 0:
            print (f"ERROR：create_payment order_id {order_id} status is not found...")
            return {}
        amount = order.get(AMOUNT, 0)
        currency = order.get(CURRENCY, CURRENCY_USD)

        if method == PAYMENT_METHOD_STRIPE:
            return self._stripe_create_payment(order_id, amount, currency)
        elif method == PAYMENT_METHOD_CREDIT_CARD:
            return self._stripe_credit_card_create_payment(order_id, amount, currency)
        elif method == PAYMENT_METHOD_PAYPAL:
            return self._paypal_create_payment(order_id, amount, currency)
        elif method == PAYMENT_METHOD_ALIPAY:
            return self._alipay_create_payment(order_id, amount, currency)
        elif method == PAYMENT_METHOD_WECHAT:
            return self._wechat_create_payment(order_id, amount, currency)
        elif method == PAYMENT_METHOD_AGENTA2Z:
            return self._agenta2z_create_payment(order_id, amount, currency)
        else:
            raise ValueError(f"Unknown payment method {method}")

    # -----------------------------
    # Stripe Checkout (Stripe)
    # -----------------------------
    def _stripe_create_payment(self, order_id, amount, currency):
        """
            stripe amount should be integer value of unit cents
        """
        try:
            amount_cents = math.ceil(amount * 100.0)
            logging.info(f"_stripe_create_payment input amount {amount} {currency} converting to cents {amount_cents} cents {currency} for {order_id}")
            session = stripe.checkout.Session.create(
                payment_method_types=["card"],
                mode="payment",
                line_items=[{
                    "price_data": {
                        "currency": currency.lower(),
                        "unit_amount": amount_cents,
                        "product_data": {"name": f"Order {order_id}"}
                    },
                    "quantity": 1
                }],
                success_url=f"{SUCCESS_URL}{order_id}",
                cancel_url=f"{CANCEL_URL}{order_id}",
            )
            return {KEY_PAYMENT_URL: session.url}

        except Exception as e:
            logging.error(f"_stripe_create_payment failed with error {e}")
            return {KEY_PAYMENT_URL: "", "message": str(e)}

    # -----------------------------
    # Stripe Direct Credit Card
    # -----------------------------
    def _stripe_credit_card_create_payment(self, order_id, amount, currency):
        """
            Stripe use server side secrete key to create payment order
            sk + order -> client_secret
            client_secret, pk display in the web app

            Stripe Publishable Key (pk_live_xxx / pk_test_xxx)
            PaymentIntent Client Secret (pi_xxx_secret_xxx)
        """
        amount_cents = math.ceil(amount * 100.0)
        if amount_cents < MIN_PAYMENT_AMOUNT_STRIPE_CENTS:
            return {
                KEY_SUCCESS: False,
                KEY_STRIPE_PUBLISHABLE_KEY: "",
                KEY_STRIPE_CLIENT_SECRET: "",
                KEY_PAYMENT_METHOD: PAYMENT_METHOD_CREDIT_CARD,
                KEY_MESSAGE: f"Checkout Stripe Input Amount {amount_cents} cents is too small for Stripe, Minimum should be more than 400 cents"
            }

        logging.info(
            f"_stripe_credit_card_create_payment input amount {amount} {currency} converting to cents {amount_cents} cents {currency} for {order_id}")
        intent = stripe.PaymentIntent.create(
            amount=amount_cents,
            currency=currency.lower(),
            metadata={ORDER_ID: order_id},
        )

        return {
            KEY_SUCCESS: True,
            KEY_STRIPE_PUBLISHABLE_KEY: self.config.stripe_publishable_key,
            KEY_STRIPE_CLIENT_SECRET: intent.client_secret,
            KEY_PAYMENT_METHOD: PAYMENT_METHOD_CREDIT_CARD,
            KEY_MESSAGE: "Checkout Stripe Successfully!"
        }

    # -----------------------------
    # PayPal Integration
    # -----------------------------
    def _paypal_create_payment(self, order_id, amount, currency):
        """

        """
        token = _get_paypal_access_token(
            self.config.paypal_client_id,
            self.config.paypal_secret,
            self.config.environment.value
        )
        if not token:
            raise Exception("_paypal_create_payment Could not retrieve PayPal access token.")
        try:
            ## Token Registered
            base_url = "https://api-m.sandbox.paypal.com" if self.config.environment == Environment.SANDBOX else "https://api-m.paypal.com"
            order_url = f"{base_url}/v2/checkout/orders"
            headers = {
                "Content-Type": "application/json",
                "Authorization": f"Bearer {token}",
                "PayPal-Request-Id": order_id  # Ensure idempotency
            }
            order_payload = {
                "intent": "CAPTURE",
                "purchase_units": [{
                    "reference_id": order_id,
                    "amount": {
                        "currency_code": currency,
                        "value": f"{amount:.2f}"
                    },
                    "description": f"Payment for Order {order_id}"
                }],
                "application_context": {
                    "return_url": f"{RETURN_URL}{order_id}",
                    "cancel_url": f"{CANCEL_URL}{order_id}",
                    "brand_name": PAYPAL_BRAND_NAME,
                    "shipping_preference": "NO_SHIPPING"
                }
            }

            response = requests.post(order_url, headers=headers, json=order_payload)
            response.raise_for_status()
            order_data = response.json()

            # 5. Extract Approval Link
            approval_link = next(
                (link['href'] for link in order_data.get('links', []) if link['rel'] == 'approve'),
                None
            )

            if approval_link:
                return {KEY_PAYMENT_URL: approval_link, KEY_PAYPAL_ORDER_ID: order_data["id"]}
            else:
                raise Exception("PayPal order created but no approval link found.")

        except Exception as e:

            print(f"DEBUG: Paypal Checkout Failed with error {e}")
            return {KEY_PAYMENT_URL: f"https://paypal.com/checkout?token={order_id}"}

    # -----------------------------
    # Alipay Integration
    # -----------------------------
    def _alipay_create_payment(self, order_id, amount, currency):
        return {"payment_url": f"https://alipay.com/pay?token={order_id}"}

    def _agenta2z_create_payment(self, order_id, amount, currency):
        return {"payment_url": f"https://aiagenta2z.com/pay/live?token={order_id}"}

    # -----------------------------
    # WeChat Pay Integration
    # -----------------------------
    def _wechat_create_payment(self, order_id, amount, currency):
        return {"qr_code": f"weixin://wxpay/bizpayurl?pr={order_id}"}

    # -----------------------------
    # 3. Notify callback
    # -----------------------------
    def notify_payment(self, order_id: str, status: str):
        self.orders[order_id]["status"] = status

        if status == "success":
            return self.post_process_payment(order_id)

    def post_process_payment(self, order_id: str):
        # E.g. resume LLM run here
        return {
            "status": "complete",
            "order_id": order_id
        }

    def mock_llm_before_payment(self, order_id: str):
        final_message = f"Before Payment, Order Id: {order_id}"
        return final_message

    def mock_llm_after_payment(self, order_id: str):
        final_message = f"Order {order_id} is paid. The Agent Loop continue and results will be rendered"
        return final_message

    def checkout(self, payment_method: str = PAYMENT_METHOD_ALL, order_id: str = "", amount: float = 0.0, currency: str = CURRENCY_USD):
        """
            The checkout is the main function to create payment by the method user chose, and return valid html, js snippet
            to render on chat/ai output, Create Order should be called before checkout

            Return:
                Dict, key: checkout_html, checkout_js
        """
        ## load .env variables inspection
        from dotenv import load_dotenv
        load_dotenv()

        checkout_html = ""
        checkout_js = ""
        try:
            if payment_method == PAYMENT_METHOD_PAYPAL:
                ## 1. Paypal Payment
                payment = self.create_payment(order_id, method = payment_method)
                success = payment.get(KEY_SUCCESS, False)
                payment_url = payment.get(KEY_PAYMENT_URL, "")
                print(f"INFO: Paypal Checkout URL Successfully: {payment_url}")

                ## credit card on stripe
                if payment_url:
                    html_data_pass = {
                        KEY_TITLE: CHECKOUT_CARD_TITLE,
                        KEY_DESCRIPTION: CHECKOUT_CARD_DESCRIPTION,
                        KEY_AMOUNT: amount,
                        KEY_CURRENCY: currency,
                        KEY_PAYPAL_URL: payment_url,
                        KEY_A2Z_URL: AGENT_A2Z_PAY_URL
                    }
                    # Render a custom HTML template for PayPal (using the same render_checkout_html for simplicity)
                    checkout_html = self.render_checkout_html(**html_data_pass)  # Use a new render function
                    script_data_pass = {
                        KEY_STRIPE_PUBLISHABLE_KEY: "",
                        KEY_STRIPE_CLIENT_SECRET: ""
                    }
                    checkout_js = self.render_checkout_script(**script_data_pass)
                else:
                    checkout_html = PAYPAL_CHECKOUT_ERROR_HTML
                    checkout_js = ""

            elif payment_method == PAYMENT_METHOD_CREDIT_CARD:

                ## 1. Credit Card
                payment = self.create_payment(order_id, method = payment_method)
                success = payment.get(KEY_SUCCESS, False)
                payment_url = payment.get(KEY_PAYMENT_URL, "")
                publishable_key = payment.get(KEY_STRIPE_PUBLISHABLE_KEY, "")
                client_secret = payment.get(KEY_STRIPE_CLIENT_SECRET, "")
                if success:
                    print(f"INFO: Credit Card Stripe Checkout Successfully URL: {payment_url}")
                else:
                    print(f"ERROR: Credit Card Stripe Checkout Failed with empty result return: {payment}")
                html_data_pass = {
                    KEY_TITLE: CHECKOUT_CARD_TITLE,
                    KEY_DESCRIPTION: CHECKOUT_CARD_DESCRIPTION,
                    KEY_AMOUNT: amount,
                    KEY_CURRENCY: currency,
                    KEY_A2Z_URL: AGENT_A2Z_PAY_URL
                }
                # Render the template
                checkout_html = self.render_checkout_html(**html_data_pass)
                if LOG_ENABLE:
                    print(f"Payment Method {payment_method} checkout_html {checkout_html}")

                script_data_pass = {
                    KEY_STRIPE_PUBLISHABLE_KEY: publishable_key,
                    KEY_STRIPE_CLIENT_SECRET: client_secret
                }
                checkout_js = self.render_checkout_script(**script_data_pass)
                if LOG_ENABLE:
                    print(f"Payment Method {payment_method} checkout_js {checkout_js}")

            elif payment_method == PAYMENT_METHOD_ALL:
                ## 1. add payment Paypal
                stripe_publishable_key = ""
                stripe_client_secret = ""
                try:
                    payment_card = self.create_payment(order_id, method=PAYMENT_METHOD_CREDIT_CARD)
                    print(f"Payment By Stripe Checkout Credit Card payment_card Result: {payment_card}")
                    payment_url_card = payment_card.get(KEY_PAYMENT_URL, "")
                    if payment_url_card is not None or payment_url_card != "":
                        print(f"INFO: Payment By Credit Card Checkout URL Successfully: {payment_url_card}")
                    else:
                        print(f"INFO: Payment By Credit Card Checkout Failed with empty URL")
                    stripe_publishable_key = payment_card.get(KEY_STRIPE_PUBLISHABLE_KEY, "")
                    stripe_client_secret = payment_card.get(KEY_STRIPE_CLIENT_SECRET, "")
                except Exception as e1:
                    logging.error(f"Payment Method {payment_method}|CREDIT_CARD failed with error {e1}")

                ## 2. PayPal Payment
                payment_url_paypal = ""
                try:
                    payment_paypal = self.create_payment(order_id, method=PAYMENT_METHOD_PAYPAL)
                    payment_url_paypal = payment_paypal.get(KEY_PAYMENT_URL, "")
                    logging.info(f"Payment By Paypal Checkout URL Successfully: {payment_url_paypal}")
                except Exception as e2:
                    logging.error (f"Payment Method {payment_method} failed with error {e2}")

                ## 3. Add Alipay


                ## 4. Add WeChat


                ## Merge Results
                ## Merge Data in Html
                html_data_pass = {
                    KEY_TITLE: CHECKOUT_CARD_TITLE,
                    KEY_DESCRIPTION: CHECKOUT_CARD_DESCRIPTION,
                    KEY_AMOUNT: amount,
                    KEY_CURRENCY: currency,
                    KEY_PAYPAL_URL: payment_url_paypal,
                    KEY_A2Z_URL: AGENT_A2Z_PAY_URL
                }

                # Render the template
                checkout_html = self.render_checkout_html(**html_data_pass)
                if LOG_ENABLE:
                    print(f"Payment Method {payment_method} checkout_html {checkout_html}")
                script_data_pass = {
                    KEY_STRIPE_PUBLISHABLE_KEY: stripe_publishable_key,
                    KEY_STRIPE_CLIENT_SECRET: stripe_client_secret
                }
                checkout_js = self.render_checkout_script(**script_data_pass)
                if LOG_ENABLE:
                    print(f"Payment Method {payment_method} checkout_js {checkout_js}")

            else:
                if LOG_ENABLE:
                    print(f"DEBUG: PAYMENT_METHOD {payment_method} not supported.")
        except Exception as e:
            logging.error(f"Checkout Failed with error {e}")

        result = {
            KEY_CHECKOUT_HTML: checkout_html,
            KEY_CHECKOUT_JS: checkout_js
        }
        return result

    def render_checkout_html(self, **html_data):
        """
            Fill the nececary fileds in the checkout html template
            Demo：
            data = {
                "title": "In Agent Purchase Payment",
                "description": "Checkout Card for Purchase Payment",
                "amount": amount,  # Pass the value 25.00
                "currency": currency,
                "a2z_url": "test_pay.aiagenta2z.com"
            }
        """
        return render_template(template_filepath, **html_data)

    def render_checkout_script(self, **script_data):
        """
            e.g. stripe credit checkout js required fields
                script_data = {
                    "publishable_key": publishable_key,
                    "client_secret": client_secret
                }
        """
        return render_template(script_filepath, **script_data)

    def render_checkout_success(self, **order_status):
        """
            e.g. stripe credit checkout js required fields
                order_status: {
                    "order_id": order_id
                }
        """
        return render_template(checkout_success_filepath, **order_status)

    def render_checkout_failure(self, **order_status):
        """
            e.g. stripe credit checkout js required fields
                order_status: {
                    "order_id": order_id
                }
        """
        return render_template(checkout_failure_filepath, **order_status)

# --------------------------------
# --- PayPal Helper Functions ---
# --------------------------------
def _get_paypal_access_token(client_id: str, client_secret: str, environment: str) -> Optional[str]:
    """Retrieves an access token from PayPal."""
    base_url = "https://api-m.sandbox.paypal.com" if environment == Environment.SANDBOX.value else "https://api-m.paypal.com"
    token_url = f"{base_url}/v1/oauth2/token"

    # PayPal uses Basic Auth for token request
    try:
        response = requests.post(
            token_url,
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            data="grant_type=client_credentials",
            auth=(client_id, client_secret)
        )
        response.raise_for_status()
        token_data = response.json()
        return token_data.get(KEY_PAYPAL_ACCESS_TOKEN)
    except requests.exceptions.RequestException as e:
        logging.error(f"_get_paypal_access_token PayPal Token Request Failed: {e}")
        return None

# --- Usage Helper ---
def get_payment_sdk(env="sandbox"):
    cfg = AgentPaymentConfig(environment=env)
    return PaymentAgent(cfg)

# --- Bill Agent (Records) ----
# --- Configuration ---
DATABASE_NAME = 'a2z_billagent.db'

# --- SQLite Schema ---
CREATE_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,    -- Stored as 'String'
    date TEXT NOT NULL,       -- Stored as 'YYYY-MM-DD'
    amount REAL NOT NULL,     -- Transaction amount (e.g., 2.99)
    currency REAL NOT NULL,   -- Transaction currency (e.g., USD)    
    category TEXT NOT NULL,   -- Expense category (e.g., 'Food', 'Transport')
    description TEXT,          -- Detailed description (e.g., 'Morning coffee')
    create_time TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%S', 'now', 'localtime')),
    update_time TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%S', 'now', 'localtime')),
    order_id TEXT,            -- Optional. Order ID of the External Transaction.
    ext_info TEXT             -- Optional. External Transaction Info.    
);
"""

def generate_user_id():
    """
        get logged in user_id from session
    """
    temp_str = str(uuid.uuid4())[0:4]
    temp_user_id = "USER_" + temp_str
    user_id = temp_user_id
    return user_id

class BillAgent:
    """
    Manages all database operations (CRUD and Query) for bill tracking records.
    """

    def __init__(self, db_folder: str = "", db_name: str = DATABASE_NAME):
        """
        Initializes the database connection and ensures the 'transactions' table exists.
        """
        if db_folder is None or db_folder == "":
            db_full_path = f"./{db_name}"
        else:
            db_full_path = f"{db_folder}/{db_name}"
            db_full_path = os.path.normpath(db_full_path)
        logging.info(f"SQL Connecting to db_full_path: {db_full_path}")
        self.conn = sqlite3.connect(db_full_path)
        self.cursor = self.conn.cursor()
        self.cursor.execute(CREATE_TABLE_SQL)
        self.conn.commit()

        ## bill card
        self.init_bill_theme()

    async def connect(self):
        """Simulates establishing the MySQL connection."""
        print("    [MySQL Agent] Attempting to establish database connection...")
        await self.mock_delay()
        print("    [MySQL Agent] Database connection established and ready.")

    async def close(self):
        """Simulates closing the MySQL connection."""
        print("    [MySQL Agent] Shutting down database connection...")
        await self.mock_delay()
        print("    [MySQL Agent] Database connection closed successfully.")

    async def mock_delay(self):
        """A simple delay function to simulate I/O."""
        import asyncio
        await asyncio.sleep(0.1)

    # --- API 1: Add Record (Retained original logic) ---
    def add_bill_record(self, user_id: str = None, amount: float = 0.0, currency: str = CURRENCY_USD, category: str = "", description: str = "", date: Optional[str] = None,
                        order_id: Optional[str] = None, ext_info: Optional[str] = None) -> int:
        """
        Adds a new transaction record to the ledger. date should be required, otherwise it's not approp
        :param user_id: User ID.
        :param amount: The transaction amount.
        :param category: The expense category (will be capitalized).
        :param description: A brief description.
        :param date: Optional. Date in 'YYYY-MM-DD' format. Defaults to today's date.
        :param order_id: Optional. Order ID of the External Transaction.
        :param ext_info: Optional. External transaction information.
        :return: The ID of the newly inserted record.
        """
        try:
            if date is None:
                date = datetime.now().strftime('%Y-%m-%d')
            if user_id is None or user_id == '':
                user_id = generate_user_id()
                print(f"DEBUG: add_bill_record User ID is empty. Setting User ID to temp is {user_id}")

            SQL = """
            INSERT INTO transactions (user_id, date, amount, currency, category, description, order_id, ext_info)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?);
            """
            self.cursor.execute(SQL, (user_id, date, amount, currency, category.capitalize(), description, order_id, ext_info))
            self.conn.commit()
            return self.cursor.lastrowid

        except Exception as e:
            logging.error(f"Bill Agent add_bill_record with error: {e}")
            return -1

    # --- API 2: Modify Record (REVISED to include user_id) ---
    def update_bill_record(self, user_id: str, record_id: int, amount: Optional[float] = None,
                           currency: Optional[float] = None, category: Optional[str] = None,
                           description: Optional[str] = None, order_id: Optional[str] = None,
                           ext_info: Optional[str] = None) -> bool:
        """
        Updates an existing transaction record by its ID and user_id.

        :param user_id: User ID to ensure only the owner can modify the record.
        :param record_id: The ID of the record to update.
        :param amount: New amount. Pass None to keep existing value.
        :param currency: New currency. Pass None to keep existing value.
        :param category: New category. Pass None to keep existing value.
        :param description: New description. Pass None to keep existing value.
        :param order_id: New order ID. Pass None to keep existing value.
        :param ext_info: New external info. Pass None to keep existing value.
        :return: True if the record was updated, False otherwise.
        """
        updates: List[str] = []
        params: List[Any] = []

        if amount is not None:
            updates.append("amount = ?")
            params.append(amount)
        if currency is not None:
            updates.append("currency = ?")
            params.append(currency)
        if category is not None:
            updates.append("category = ?")
            params.append(category.capitalize())
        if description is not None:
            updates.append("description = ?")
            params.append(description)
        if order_id is not None:
            updates.append("order_id = ?")
            params.append(order_id)
        if ext_info is not None:
            updates.append("ext_info = ?")
            params.append(ext_info)

        if not updates:
            return False
        try:
            # Add update_time to ensure it reflects the modification time
            updates.append("update_time = ?")
            params.append(datetime.now().strftime('%Y-%m-%d %H:%M:%S'))

            SQL = f"""
            UPDATE transactions
            SET {", ".join(updates)}
            WHERE id = ? AND user_id = ?; -- ENSURE SECURITY
            """
            params.append(record_id)
            params.append(user_id)  # Added user_id parameter

            self.cursor.execute(SQL, tuple(params))
            self.conn.commit()
            return self.cursor.rowcount > 0

        except Exception as e:
            logging.error(f"Bill Agent update_bill_record with error: {e}")
            return False

    # --- API 3: Delete Record (Retained original logic) ---
    def delete_bill_record(self, user_id: str,record_id: int) -> bool:
        """
        Deletes a transaction record by its ID. and user_id

        :param user_id: The ID of the record to delete. Make Sure User Have privileges.
        :param record_id: The ID of the record to delete.
        :return: True if the record was deleted, False otherwise.
        """
        try:
            SQL = "DELETE FROM transactions WHERE id = ? AND user_id = ?;"
            self.cursor.execute(SQL, (record_id, user_id))
            self.conn.commit()
            return self.cursor.rowcount > 0

        except Exception as e:
            print (f"BillAgent delete_bill_record failed with error: {e}")
            return False

    # --- API 4: Query Records & Summary (REVISED to include user_id) ---
    def query_bill_records(self, user_id: str, start_date: str, end_date: str, category: Optional[str] = None) -> List[
        Dict[str, Any]]:
        """
        Queries all records for a specific user within a date range, optionally filtered by category.

        :param user_id: User ID to filter results.
        :param start_date: Start date (inclusive) in 'YYYY-MM-DD' format.
        :param end_date: End date (inclusive) in 'YYYY-MM-DD' format.
        :param category: Optional category filter. Pass None for all categories.
        :return: A list of dictionaries, where each dictionary is a transaction record.
        """
        try:
            # Included user_id, create_time, update_time, order_id, ext_info in the selection
            SQL = "SELECT id, user_id, date, amount, currency, category, description, create_time, update_time, order_id, ext_info FROM transactions WHERE user_id = ? AND date BETWEEN ? AND ?"
            params: List[Any] = [user_id, start_date, end_date]  # Added user_id

            if category is not None:
                SQL += " AND category = ?"
                params.append(category.capitalize())

            SQL += " ORDER BY date DESC, id DESC;"

            if LOG_ENABLE:
                print (f"DEBUG: query_bill_records SQL: {SQL}")

            self.cursor.execute(SQL, tuple(params))

            # Helper to convert results to a list of dictionaries
            columns = [col[0] for col in self.cursor.description]
            return [dict(zip(columns, row)) for row in self.cursor.fetchall()]

        except Exception as e:
            logging.error(f"Bill Agent query_bill_records with error: {e}")
            return []

    def query_bill_records_by_category(self, user_id: str, start_date: str, end_date: str) -> List[Dict[str, Any]]:
        """
        Calculates the total expense for each category for a specific user within a date range.

        :param user_id: User ID to filter results.
        :param start_date: Start date (inclusive) in 'YYYY-MM-DD' format.
        :param end_date: End date (inclusive) in 'YYYY-MM-DD' format.
        :return: A list of dictionaries with 'category' and 'total_amount'.
        """
        try:
            SQL = """
            SELECT category, currency, SUM(amount) as total_amount
            FROM transactions
            WHERE user_id = ? AND date BETWEEN ? AND ? -- ENSURE SECURITY
            GROUP BY category
            ORDER BY total_amount DESC;
            """
            self.cursor.execute(SQL, (user_id, start_date, end_date))  # Added user_id parameter
            columns = [col[0] for col in self.cursor.description]
            return [dict(zip(columns, row)) for row in self.cursor.fetchall()]

        except Exception as e:
            logging.error(f"Bill Agent summarize_expense_by_category with error: {e}")
            return []

    def query_bill_records_by_category_summary_html(self, user_id: str, start_date: Optional[str] = None,
                                                    end_date: Optional[str] = None, category: Optional[str] = None,
                                                    theme: Optional[str] = "classic") -> Dict[str, Any]:
        """
        Calculates the total expense and percentage for each category for a specific user
        within a date range, returning the result as styled HTML.

        :param user_id: User ID to filter results.
        :param start_date: Start date (inclusive) in 'YYYY-MM-DD' format.
        :param end_date: End date (inclusive) in 'YYYY-MM-DD' format.
        :param category: Select a specific category or just show all
        :return: A dictionary with the HTML card ('html') and placeholder JS ('js').
        """
        try:
            results = []

            # --- 1. Database Query to get Category Totals ---
            if category is not None and category != "":
                SQL = """
                SELECT category, currency, SUM(amount) as total_amount
                FROM transactions
                WHERE user_id = ? AND date BETWEEN ? AND ?
                AND category = ?
                ORDER BY total_amount DESC;
                """
                self.cursor.execute(SQL, (user_id, start_date, end_date, category))
            else:
                SQL = """
                SELECT category, currency, SUM(amount) as total_amount
                FROM transactions
                WHERE user_id = ? AND date BETWEEN ? AND ?
                GROUP BY category
                ORDER BY total_amount DESC;
                """
                self.cursor.execute(SQL, (user_id, start_date, end_date))

            columns = [col[0] for col in self.cursor.description]
            results = [dict(zip(columns, row)) for row in self.cursor.fetchall()]

            # --- 2. Pre-Calculate Grand Total for Percentage Calculation ---

            # Convert amounts to float immediately and calculate the sum
            grand_total = 0.0
            grand_total_currency_dict = {}
            for item in results:
                amount = float(item.get("total_amount", 0.0))
                currency = item.get("currency", CURRENCY_USD)
                category = item.get("category", "")

                grand_total_sub = grand_total_currency_dict.get(category, 0.0)
                ## Add to Grand Sub Total
                grand_total_sub += amount
                ## Add to Grand Total
                grand_total += amount
                grand_total_currency_dict[category] = grand_total_sub

            # grand_total = sum(float(item.get("total_amount", 0.0)) for item in results)
            # --- 3. Prepare Data and HTML Rows ---

            results_sorted = sorted(results, key=lambda k: k.get('total_amount', 0.0), reverse=True)
            title_category = category.capitalize() if category else "All Categories"

            rows_html = ""

            for item in results_sorted:
                try:
                    category_name = item.get("category", "N/A")
                    currency = item.get("currency", CURRENCY_USD)
                    total_amount = float(item.get("total_amount", 0.0))

                    if category_name == "N/A" or total_amount <= 0.0:
                        continue

                    grand_total_sub = grand_total_currency_dict.get(category, 0.0)
                    safe_grand_total_sub = grand_total_sub if grand_total_sub > 1e-9 else 1.0

                    # Calculate percentage
                    percentage = (total_amount / safe_grand_total_sub) * 100

                    # Inline CSS for data rows (modified widths for 3 columns)
                    rows_html += f"""
                    <div style="display: flex; justify-content: space-between; padding-top: 0.5rem; padding-bottom: 0.5rem; border-bottom: 1px solid #f3f4f6;">

                        <!-- Category Column (40%) -->
                        <div style="font-size: 0.875rem; font-weight: 500; color: #374151; width: 40%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                            {category_name}
                        </div>
                        <!-- Expense Column (35%) -->
                        <div style="font-size: 0.875rem; font-family: monospace; color: #4b5563; text-align: right; width: 35%;">
                            ${"{:.2f}".format(total_amount)}
                        </div>
                        <!-- Currency Column (30%) -->
                        <div style="font-size: 0.875rem; font-weight: 500; color: #374151; width: 40%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                            {currency}
                        </div>
                        <!-- Percentage Column (25%) -->
                        <div style="font-size: 0.875rem; font-weight: 600; color: #10b981; text-align: right; width: 25%;">
                            {"{:.1f}".format(percentage)}%
                        </div>
                    </div>
                    """
                except Exception as e1:
                    logging.error(f"Bill Agent summarization loop error: {e1}")

            # --- 4. Construct the final HTML Card (bill_card) ---
            theme_name = "classic"
            theme_dict = self.theme_dict[theme_name]  # e.g., {'card_bg': '#ffffff', 'shadow': '0 4px 6px ...'}
            context = {
                'theme_name': theme_name.capitalize(),
                'title_category': title_category,
                'start_date': start_date,
                'end_date': end_date,
                'rows_html': rows_html,
                'grand_total_formatted': "${:.2f}".format(grand_total)
            }
            context.update(theme_dict)

            # The structure is updated to include the Percentage column in headers and footer
            bill_card = BILL_CARD_TEMPLATE.format(**context)

            bill_js_code = f"""
                <script>
                    // Add filter logic here if needed, but keeping it empty per request.
                </script>
            """
            result = {"html": bill_card, "js": bill_js_code}
            return result

        except Exception as e:
            logging.error(f"Bill Agent show_bill with error: {e}")
            result = {"html": "", "js": ""}
            return result

    # --- Helper: Date Range Calculation (No change needed) ---

    def get_date_range(self, period: str, year: int, month: Optional[int] = None, week_of_year: Optional[int] = None) -> \
    Tuple[str, str]:
        """
        Calculates the start and end dates for a given period ('Month' or 'Week').

        :param period: 'Month' or 'Week'.
        :param year: The year.
        :param month: The month (1-12), required if period='Month'.
        :param week_of_year: The ISO week number (1-53), required if period='Week'.
        :return: A tuple of (start_date_str, end_date_str) in 'YYYY-MM-DD'.
        :raises ValueError: If parameters are missing or invalid.
        """
        if period.lower() == 'month':
            if month is None or not (1 <= month <= 12):
                raise ValueError("Month must be between 1 and 12 for 'Month' period.")

            # Find the last day of the month
            _, last_day = monthrange(year, month)
            start_date = f"{year}-{month:02d}-01"
            end_date = f"{year}-{month:02d}-{last_day:02d}"
            return start_date, end_date

        elif period.lower() == 'week':
            if week_of_year is None or not (1 <= week_of_year <= 53):
                raise ValueError("Week of year must be between 1 and 53 for 'Week' period.")

            # Use ISO 8601 week date format to find the first day of the week (Monday=1)
            # Example: 2025-W47-1 is Monday of week 47, 2025
            d = datetime.strptime(f'{year}-W{week_of_year:02d}-1', '%Y-W%W-%w')
            start_date = d.strftime('%Y-%m-%d')
            end_date = (d + timedelta(days=6)).strftime('%Y-%m-%d')
            return start_date, end_date

        else:
            raise ValueError("Period must be 'Month' or 'Week'.")

    def init_bill_theme(self):
        """
        :return:
        """
        self.theme_dict = DEFAULT_THEMES_DICT

    def _get_theme_styles(self, theme_name) -> Dict:
        """Helper to get the style dictionary for the currently active theme."""
        return self.theme_dict.get(theme_name, self.theme_dict['classic'])
