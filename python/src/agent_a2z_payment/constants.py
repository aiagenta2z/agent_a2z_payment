## Payment
PAYMENT_METHOD_ALL = "all"
PAYMENT_METHOD_PAYPAL = "paypal"
PAYMENT_METHOD_CREDIT_CARD = "credit_card"
PAYMENT_METHOD_STRIPE = "stripe"
PAYMENT_METHOD_ALIPAY = "alipay"
PAYMENT_METHOD_WECHAT = "wechat"
PAYMENT_METHOD_AGENTA2Z = "agenta2z"
# AGENT_A2Z_PAY_URL = "https://www.aiagenta2z.com/agent/agent-a2z-payment"
AGENT_A2Z_PAY_URL = "https://www.deepnlp.org/agent/agent-a2z-payment"

KEY_MESSAGE = "message"

## Order
AMOUNT = "amount"
CURRENCY = "currency"
ORDER_ID = "order_id"
DESCRIPTION = "description"
STATUS = "status"
STATUS_PENDING = "pending"
CREATED = "created"
EVENT = "event"
STATUS_PAID = "paid"
ESTIMATED_TOKENS = "estimated_tokens"
CURRENCY_USD = "USD"
CURRENCY_CNY = "CNY"
CURRENCY_EUR = "EUR"

## LOG
LOG_ENABLE = False
KEY_SUCCESS = "success"

## ENV
KEY_STRIPE_API_KEY_PK_TEST = "STRIPE_API_KEY_PK_TEST"
KEY_STRIPE_API_KEY_SK_TEST = "STRIPE_API_KEY_SK_TEST"
KEY_STRIPE_API_KEY_PK_LIVE = "STRIPE_API_KEY_PK_LIVE"
KEY_STRIPE_API_KEY_SK_LIVE = "STRIPE_API_KEY_SK_LIVE"
KEY_STRIPE_WEBHOOK_SECRET = "STRIPE_WEBHOOK_SECRET"
KEY_PAYPAL_CLIENT_ID_TEST = "PAYPAL_CLIENT_ID_TEST"
KEY_PAYPAL_CLIENT_ID_LIVE = "PAYPAL_CLIENT_ID_LIVE"
KEY_PAYPAL_SECRET_TEST = "PAYPAL_SECRET_TEST"
KEY_PAYPAL_SECRET_LIVE = "PAYPAL_SECRET_LIVE"
KEY_AGENT_A2Z_API_KEY_TEST = "AGENT_A2Z_API_KEY_TEST"
KEY_AGENT_A2Z_API_KEY_LIVE = "AGENT_A2Z_API_KEY_LIVE"
## Paypal
KEY_PAYPAL_WEBHOOK_ID = "PAYPAL_WEBHOOK_ID"
KEY_PAYPAL_CLIENT_ID = "PAYPAL_CLIENT_ID"
KEY_PAYPAL_SECRET = "PAYPAL_SECRET"
## Alipay
KEY_ALIPAY_APP_ID_TEST = "ALIPAY_APP_ID_TEST"
KEY_ALIPAY_APP_ID_LIVE = "ALIPAY_APP_ID_LIVE"

## WeChat Pay
KEY_WECHAT_MCH_ID_TEST = "WECHAT_MCH_ID_TEST"
KEY_WECHAT_MCH_ID_LIVE = "WECHAT_MCH_ID_LIVE"


### Stripe
KEY_STRIPE_PUBLISHABLE_KEY = "publishable_key"
KEY_STRIPE_CLIENT_SECRET = "client_secret"
KEY_STRIPE_SECRET_KEY = "secret_key"
KEY_PAYMENT_METHOD = "payment_method"
KEY_PAYMENT_URL= "payment_url"
MIN_PAYMENT_AMOUNT_STRIPE_CENTS = 400
MIN_PAYMENT_UNIT_STRIPE = "CENTS"

### Paypal
KEY_PAYPAL_ORDER_ID = "paypal_order_id"
KEY_PAYPAL_ACCESS_TOKEN = "access_token"
PAYPAL_BRAND_NAME = "In Agent Payment"

### Return URL
SUCCESS_URL = "https://example.com/payment/success?order_id="
CANCEL_URL = "https://example.com/payment/cancel?order_id="
RETURN_URL = "https://example.com/payment/return?order_id="


### Checkout Card
KEY_TITLE = "title"
KEY_DESCRIPTION = "description"
KEY_AMOUNT = "amount"
KEY_CURRENCY = "currency"
KEY_PAYPAL_URL = "paypal_url"
KEY_A2Z_URL = "a2z_url"

CHECKOUT_CARD_TITLE = "In Agent Purchase Payment"
CHECKOUT_CARD_DESCRIPTION = "Checkout Card for Purchase Payment Using Paypal"

KEY_CHECKOUT_HTML = "checkout_html"
KEY_CHECKOUT_JS = "checkout_js"

PAYPAL_CHECKOUT_ERROR_HTML = """<h1>Payment Error</h1><p>Could not generate PayPal payment link.</p>"""

### Theme
DEFAULT_THEMES_DICT = {
    'classic': {
        'card_bg': '#ffffff', 'shadow': '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        'border_color': '#bfdbfe',
        'title_color': '#1d4ed8', 'text_color': '#6b7280', 'header_color': '#4b5563',
        'header_border': '2px solid #93c5fd', 'row_border': '1px solid #f3f4f6',
        'total_border': '2px solid #3b82f6',
        'total_spent_color': '#dc2626', 'percentage_color': '#10b981', 'grand_total_color': '#1f2937',
        'row_category_color': '#374151', 'row_amount_color': '#4b5563', 'grand_total_percent_color': '#1d4ed8'
    },
    'dark': {
        'card_bg': '#1f2937', 'shadow': '0 10px 15px -3px rgba(0, 0, 0, 0.5)', 'border_color': '#4b5563',
        'title_color': '#93c5fd', 'text_color': '#9ca3af', 'header_color': '#d1d5db',
        'header_border': '2px solid #6366f1', 'row_border': '1px solid #374151',
        'total_border': '2px solid #4f46e5',
        'total_spent_color': '#f87171', 'percentage_color': '#4ade80', 'grand_total_color': '#e5e7eb',
        'row_category_color': '#e5e7eb', 'row_amount_color': '#d1d5db', 'grand_total_percent_color': '#93c5fd'
    },
    'warm': {
        'card_bg': '#fff7ed', 'shadow': '0 20px 25px -5px rgba(249, 115, 22, 0.1)', 'border_color': '#fdba74',
        'title_color': '#c2410c', 'text_color': '#b45309', 'header_color': '#92400e',
        'header_border': '2px solid #fb923c', 'row_border': '1px solid #fbd38a',
        'total_border': '2px solid #f97316',
        'total_spent_color': '#ef4444', 'percentage_color': '#16a34a', 'grand_total_color': '#78350f',
        'row_category_color': '#78350f', 'row_amount_color': '#92400e', 'grand_total_percent_color': '#c2410c'
    }
}

BILL_CARD_TEMPLATE = """
            <div style="max-width: 28rem; margin: 0 auto; padding: 1.25rem; background-color: {card_bg}; border-radius: 0.75rem; box-shadow: {shadow}; border: 1px solid {border_color};">
                <h3 style="font-size: 1.25rem; font-weight: 700; color: {title_color}; margin-bottom: 0.25rem; text-align: center;">
                    Expense Summary ({theme_name} Theme)
                </h3>
                <p style="font-size: 0.75rem; color: {text_color}; margin-bottom: 1rem; text-align: center;">
                    Filter: {title_category} ({start_date} to {end_date})
                </p>

                <!-- Summary Header Row (3 columns) -->
                <div style="display: flex; justify-content: space-between; font-weight: 700; font-size: 0.875rem; color: {header_color}; border-bottom: {header_border}; padding-bottom: 0.25rem; margin-bottom: 0.5rem;">
                    <div style="width: 40%;">Category</div>
                    <div style="width: 35%; text-align: right;">Expenses</div>
                    <div style="width: 25%; text-align: right;">% of Total</div>
                </div>

                <!-- Dynamic Content Rows Container -->
                <div style="margin-bottom: 0.25rem; max-height: 15rem; overflow-y: auto;">
                    {rows_html} 
                </div>

                <!-- Grand Total Footer -->
                <div style="display: flex; justify-content: space-between; font-weight: 800; font-size: 1.125rem; color: {grand_total_color}; border-top: {total_border}; padding-top: 0.75rem; margin-top: 0.75rem;">
                    <div style="width: 40%;">GRAND TOTAL:</div>
                    <div style="width: 35%; text-align: right; color: {total_spent_color};">
                        {grand_total_formatted}
                    </div>
                    <div style="width: 25%; text-align: right; color: {grand_total_percent_color};">
                        100.0%
                    </div>
                </div>
            </div>
            """
