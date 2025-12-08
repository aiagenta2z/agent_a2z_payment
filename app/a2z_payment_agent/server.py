"""
PaymentAgent: A Minimal Composable Part (MCP) for Personal Bill Tracking using SQLite.
This file contains the complete class implementation for managing bill records.

"""
import logging
from datetime import datetime, timedelta
from typing import List, Dict, Tuple, Optional, Any
import uuid
from pathlib import Path

import agent_a2z_payment
from agent_a2z_payment.core import PaymentAgent

from typing import Deque, List, Optional, Tuple
from mcp.server.fastmcp import Context, FastMCP

import logging

logging.basicConfig(
    filename='server.log',
    level=logging.DEBUG,
    format='%(asctime)s - %(levelname)s - %(message)s',
    filemode='a'
)

### New MCP
from mcp.server.fastmcp import FastMCP
import agent_a2z_payment
from agent_a2z_payment.core import get_payment_sdk, PaymentWaitingMode, Environment
from agent_a2z_payment.core import _get_paypal_access_token

environment = Environment.SANDBOX.value

from dotenv import load_dotenv
load_dotenv()
payment_agent = get_payment_sdk(env=environment)

server = FastMCP(AGENT_NAME, json_response=True)

AGENT_ID = "aiagenta2z/a2z_payment_agent"
AGENT_NAME = "A2Z Payment Agent"
CURRENCY_USD = "USD"

# Payment MCP
# ---------------------------
# Tool 1: Calculate Payment
# ---------------------------
@server.tool()
def calculate_payment(messages: List[str]) -> Dict[str, Any]:
    """
    Calculate total payment based on messages.
    """
    try:
        return payment_agent.calculate_payment(messages)
    except Exception as e:
        logging.error(f"Error in calculate_payment: {str(e)}")
        return {
            "amount": 0.0,
            "currency": "USD"
        }

@server.tool()
def create_order(amount: float, currency: str) -> dict:
    """
    Create an order with amount and currency.
    """
    try:
        return payment_agent.create_order(amount, currency)
    except Exception as e:
        logging.error(f"Error in create_order: {str(e)}")
        return {"order_id": "-1", "message": "Failed to create_order for the amount and currency. Please check the agent healthy"}

@server.tool()
def checkout(order_id: str, amount: float, currency: str, payment_method: str = "all") -> dict:
    """
    Checkout an order with a given payment method.
    """
    try:
        return payment_agent.checkout(order_id=order_id, amount=amount, currency=currency, payment_method=payment_method)
    except Exception as e:
        logging.error(f"Error in checkout: {str(e)}")
        return {"error": str(e)}

@server.prompt("system_prompt")
def system_prompt() -> str:
    return """
    # Payment Agent MCP Server

    This MCP server exposes three tools for payments:
    1. calculate_payment(messages: List[str])
    2. create_order(amount: float, currency: str)
    3. checkout(order_id: str, amount: float, currency: str, payment_method: str = "all")

    Users can use these tools directly through ChatGPT Web Agent or SDK.
    """

import contextlib
from starlette.applications import Starlette
from starlette.routing import Mount, Route
from starlette.responses import JSONResponse

@contextlib.asynccontextmanager
async def lifespan(app: Starlette):

    # STARTUP: Connect to MySQL
    print("--- APPLICATION STARTUP ---")
    async with server.session_manager.run():
        yield

    # SHUTDOWN: Close MySQL connection
    print("--- APPLICATION SHUTDOWN ---")

async def get_mcp_root_id_handler(request):
    """
    This function handles the GET request to the root of the MCP application (i.e., /mcp).
    """
    unique_id = AGENT_ID
    return JSONResponse({"id": AGENT_ID})

async def starlette_root_id_endpoint(request):
    """
    Starlette endpoint to serve the root path of the main application: http://<server>:7003/
    """
    unique_id = str(uuid.uuid4())[:8]
    return JSONResponse({"app_root_id": unique_id})

mcp_app = server.streamable_http_app()
mcp_app.routes.insert(0,
    Route("/mcp", get_mcp_root_id_handler, methods=["GET"])
)

# Mount using Host-based routing
app = Starlette(
    routes=[
        # Mount("/", app=mcp.streamable_http_app()),
        Mount("/", app=mcp_app),
    ],
    lifespan=lifespan,
)

# Define the argument parser
def parse_args():
    """Parses command line arguments for the server port."""
    parser = argparse.ArgumentParser(description="Run the A2Z Bill Agent MCP Server.")
    parser.add_argument(
        "--port",
        type=int,
        default=7000,  # Set a default port
        help="The port number on which to run the server (e.g., 9000)."
    )
    return parser.parse_args()

# Run with streamable HTTP transport
if __name__ == "__main__":
    """
        Uvicorn Run
        Starlette mount to /mcp
    """
    import argparse, os
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=7000)
    args = parser.parse_args()

    print(f"Starting MCP server on port {args.port}")
    os.environ["MCP_SERVER_URL"] = f"http://0.0.0.0:{args.port}/mcp"
    mcp.run("streamable-http")
