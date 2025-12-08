# Agent A2Z Payment SDK | In Agent Purchase
[Website](https://www.deepnlp.org/agent/agent-a2z-payment) | [GitHub](https://github.com/aiagenta2z/agent_a2z_payment) | [Playground](https://agent.deepnlp.org/a2z_payment_agent_sandbox) | [AI Agent Marketplace](https://www.deepnlp.org/store/ai-agent)

The Agent A2Z Pay SDK allows for flexible, in-workflow payment integration with AI Agents. It supports various Payment methods, suhc as "Stripe", "Paypal", "Alipay", "WeChat Pay", etc.
This demo of SDK usage and application showcases four primary payment scenarios using a single, unified python package `agent-a2z-payment`. Various payment scenarios, such as Preview-to-Pay, Post-Workflow Tip (Tipping, Buy me coffee, Red Envelope), Cost-Based Consumption, E-Commerce Checkout, etc.

## Workflow Integration 

The Agent's workflow is split into three phases:
1.  **Pre-Payment**: The agent determines the cost or completes the core task.
2.  **Payment Gating/Request**: The agent streams the necessary **HTML/JS checkout card** to the user.
3.  **Awaiting Payment**: The server thread (via `payment_stream_generator`) pauses, waiting for a **Stripe or PayPal webhook** to confirm payment.
4.  **Post-Payment**: Once the webhook is received, the stream resumes, and the agent runs the high-value workflow (`llm_after_payment`).

| Flow Name  | Core Logic                                                                                                | Description                                                                                                                                     | 
| :--- |:----------------------------------------------------------------------------------------------------------|:------------------------------------------------------------------------------------------------------------------------------------------------|
| **Cost-Based Consumption** | **Gated Content** Calculate Estimated Cost (tokens/images) $\to$  Payment (Required) $\to$ LLM completion | Calculates a cost based on estimated resources estimated to run the task/LLM. Payment is at the beginning of the workflow and **required**      |
| **Preview-to-Pay** | **Gated Content**. LLM/Agent Completion $\to$ Preview $\to$ Payment (Required) $\to$ Final Content.       | Shows a low-resolution preview/summary of the content, like and image or first page of a report, then charges for the full, high-value version. |
| **Post-Workflow Tip** | **Ungated Content**. LLM completion $\to$ Final Output $\to$ Payment (Voluntary Tip Request)              | The agent delivers the full, high-value content first, then presents an optional tipping card.                                                  | 
| **E-Commerce Checkout** | **Gated Transaction**. Cart Summary $\to$ Payment $\to$ Transaction Confirmation.                         | Agent guides the user to a final cart summary and provides payment options for a large transaction.                                             |


## Example Playground of the workflow

[Sandbox Web Playground](https://agent.deepnlp.org/a2z_payment_agent_sandbox)
You can use Stripe/Paypal/Alipay/WeChat sandbox test account to complete the payment and see the webhook notification

**Preview-to-Pay**

<img src="https://raw.githubusercontent.com/aiagenta2z/agent_a2z_payment/refs/heads/main/docs/workflow_preview_pay.jpg" style="width:300px;" alt="Workflow Payment Preview-to-Pay">

**Post-Workflow Tip**

<img src="https://raw.githubusercontent.com/aiagenta2z/agent_a2z_payment/refs/heads/main/docs/workflow_post_workflow_tipping.jpg" style="width:300px;" alt="Workflow Payment Preview-to-Pay">

**E-Commerce Checkout**

<img src="https://raw.githubusercontent.com/aiagenta2z/agent_a2z_payment/refs/heads/main/docs/workflow_ecommerce_checkout.jpg" style="width:300px;" alt="Workflow Payment Preview-to-Pay">

## 🛠️ Setup and Run

1.  **Installation & Setup**:
    ```bash
    pip install agent-a2z-payment
    
    # Run the playground Demo, Clone the Repo and Visit the app
    git clone https://github.com/aiagenta2z/agent_a2z_payment
    cd ./app/a2z_payment_agent
    
    ```
2.  **Environment Variables**: Define your API keys for Stripe/PayPal in a `.env` file (e.g., `STRIPE_API_KEY_PK_TEST`, `PAYPAL_CLIENT_ID_TEST`, etc.).
3.  **Start the Server**:
    ```bash
    uvicorn app:app --port 7000
    # Access the app at [http://127.0.0.1:7000/](http://127.0.0.1:7000/)
    ```
4. See the playground
``` 
http://127.0.0.1:7000/a2z_payment_agent_sandbox
```

## 🔄 Agent Payment Flows Agent Loop Code

| Flow Name                  | Core Logic                                                                                             |
|:---------------------------|:-------------------------------------------------------------------------------------------------------|
| **Cost-Based Consumption** | ./app/a2z_payment_agent/workflow/cost_based_consumption.py                                             |
| **Preview-to-Pay** | ./app/a2z_payment_agent/workflow/ecommerce_checkout.py                                                 |
| **Post-Workflow Tip** | ./app/a2z_payment_agent/workflow/post_workflow_tip.py                                                  |                                                   | 
| **E-Commerce Checkout** | ./app/a2z_payment_agent/workflow/ecommerce_checkout.py                                                                        |

### Sandbox Environment

| Method | Environment                                                                                      |
| --- |--------------------------------------------------------------------------------------------------|
| Stripe | Stripe Sandox Dummy CreditCard,CVV check here [Stripe Test Doc](https://docs.stripe.com/testing) | 
| Paypal | Register at [Paypal Sandbox](https://developer.paypal.com/tools/sandbox/accounts/)               | 
| Alipay Sandbox | ---                                                                                              |
| WeChat Pay Sandbox | ---                                                                                              |


## Related
[Agent A2Z Payment SDK Document](https://www.deepnlp.org/doc/agent_a2z_payment)

