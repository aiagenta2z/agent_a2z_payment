<script src="https://js.stripe.com/v3/" async></script>
<script>
    const STRIPE_PUBLIC_KEY = "{publishable_key}";
    const CLIENT_SECRET = "{client_secret}";

    let stripe;
    let elements;
    let card;

    function selectMethod(method) {{
        document.querySelectorAll('.pm-option').forEach(el => {{
            el.style.border = '1px solid #ddd';
            el.style.background = 'white';
        }});
        document.querySelectorAll('.pm-action').forEach(el => el.style.display = 'none');

        const selectedOpt = document.getElementById('opt-' + method);
        if (selectedOpt) {{
            selectedOpt.style.border = '2px solid #007bff';
            selectedOpt.style.background = '#f0f7ff';
        }}

        // Show the selected action section
        const actionDiv = document.getElementById('action-' + method);
        if (actionDiv) {{
            actionDiv.style.display = 'block';
        }}

        // If Stripe is selected, and it hasn't been initialized, call the initializer.
        if (method === 'stripe' && !stripe && typeof Stripe !== 'undefined') {{
            initializeStripe();
        }}
    }}

    /**
     * Initializes Stripe elements and mounts the Card Element.
     */
    function initializeStripe() {{
        if (typeof Stripe === 'undefined' || stripe) {{
            // Already initialized or Stripe library not loaded yet
            return;
        }}

        try {{
            // 1. Initialize Stripe
            stripe = Stripe(STRIPE_PUBLIC_KEY);
            elements = stripe.elements();

            // 2. Create and mount the Card Element
            card = elements.create("card", {{
                style: {{
                    base: {{
                        fontSize: '16px',
                        color: '#32325d',
                        '::placeholder': {{ color: '#aab7c4' }}
                    }}
                }}
            }});
            const cardElement = document.getElementById('card-element');
            if (cardElement) {{
                card.mount(cardElement);
            }}
            // 3. Attach payment logic to the Pay button
            const payBtn = document.querySelector("#pay-btn");
            if (payBtn) {{
                payBtn.onclick = async () => {{
                    const res = await stripe.confirmCardPayment(
                        CLIENT_SECRET,
                        {{
                            payment_method: {{ card: card }}
                        }}
                    );

                    if (res.error) {{
                        alert("Payment Failed: " + res.error.message);
                    }} else {{
                        // Handle success: res.paymentIntent.status will be 'succeeded'
                        alert("Payment processing... you will continue after confirmation. Status: " + res.paymentIntent.status);
                    }}
                }};
            }}
        }} catch (e) {{
            console.error("Stripe Initialization Error:", e);
        }}
    }}

    /**
     * The main entry point to ensure initialization runs when the Stripe library loads.
     */
    function runStripeWhenLoaded() {{
        if (typeof Stripe !== 'undefined') {{
            // Stripe is loaded, initialize it immediately if 'stripe' is the selected method
            if (document.getElementById('action-stripe').style.display !== 'none') {{
                initializeStripe();
            }}
        }} else {{
            // Stripe not loaded yet, wait a moment and check again
            setTimeout(runStripeWhenLoaded, 100);
        }}
    }}

    // Initialize the checkout view on DOM content loaded
    document.addEventListener('DOMContentLoaded', () => {{
        // Ensure the default method is selected (Stripe is the default in your HTML)
        selectMethod('stripe');

        // Start waiting for Stripe.js to load
        runStripeWhenLoaded();
    }});

</script>
