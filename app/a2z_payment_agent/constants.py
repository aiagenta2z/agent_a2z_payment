LOG_ENABLE = False

## Web
KEY_TITLE = "title"
KEY_DESCRIPTION = "description"
KEY_KEYWORDS = "keywords"
KEY_CANONICAL_URL = "canonical_url"
KEY_SIDEBAR_AGENT_INFO = "sidebar_agent_info"
KEY_SIDEBAR_MCP_INFO = "sidebar_mcp_info"
OUTPUT_FORMAT_HTML = "html"
OUTPUT_FORMAT_MARKDOWN = "markdown"
OUTPUT_FORMAT_TEXT = "text"
TEMPLATE_STREAMING_CONTENT_TYPE = "streaming_content_type"

## DEPLOYMENT
PRODUCTION_URL_PREFIX = "/a2z_payment_agent_sandbox"

CHUNK_JS_SEPARATOR = "\n"
CONTENT_TYPE_MARKDOWN = "text/markdown"
CONTENT_TYPE_HTML = "text/html"
CONTENT_TYPE_JS = "application/javascript"
CONTENT_TYPE_CODE = "application/code"
CONTENT_TYPE_TOOL_RESULT = "tool/tool_result"

## Payment .env keys
PAYMENT_METHOD = "all"  # "credit_card", "paypal", "alipay", "wechat"
KEY_STRIPE_WEBHOOK_SECRET = "STRIPE_WEBHOOK_SECRET"
KEY_STRIPE_PUBLISHABLE_KEY = "publishable_key"
KEY_STRIPE_CLIENT_SECRET = "client_secret"
KEY_STRIPE_SECRET_KEY = "secret_key"
KEY_PAYMENT_METHOD = "payment_method"

AMOUNT = "amount"
CURRENCY = "currency"
ORDER_ID = "order_id"

MIN_PAYMENT_AMOUNT_USD = 4

PAYMENT_WAITING_MODE = "SSE"
KEY_PAYMENT_URL= "payment_url"
### Paypal
KEY_PAYPAL_ORDER_ID = "paypal_order_id"
# Constants
KEY_PAYPAL_WEBHOOK_ID = "PAYPAL_WEBHOOK_ID"
KEY_PAYPAL_CLIENT_ID = "PAYPAL_CLIENT_ID"
KEY_PAYPAL_SECRET = "PAYPAL_SECRET"
### TimeOut
TIME_LONG_POLL_PAYMENT_INTERVAL_DEFAULT = 30
TIME_TOTAL_AWAITING_PAYMENT_DEFAULT = 120
TIME_TOTAL_AWAITING_PAYMENT_TIMEOUT_DICT = {"paypal": 120, "credit_card": 60, "stripe": 60}

PAYMENT_WORKFLOW_PREVIEW_TO_PAY = "preview_to_pay"
PAYMENT_WORKFLOW_POST_WORKFLOW_TIP = "post_workflow_tip"
PAYMENT_WORKFLOW_ECOMMERCE_CHECKOUT = "ecommerce_checkout"
PAYMENT_WORKFLOW_COST_BASED_CONSUMPTION = "cost_based_consumption"
