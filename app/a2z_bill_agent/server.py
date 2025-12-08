"""
BillAgent: A Minimal Composable Part (MCP) for Personal Bill Tracking using SQLite.
This file contains the complete class implementation for managing bill records.

Agent Base Function Provided:
1. add_bill_record: Adds a new transaction.
2. update_bill_record: Modifies an existing transaction by ID.
3. delete_bill_record: Removes a transaction by ID.
4. query_bill_records: Retrieves transactions based on date range and category.
5. query_bill_records_by_category_summary_html: Provides expense totals grouped by category output an HTML
"""

import logging
from datetime import datetime, timedelta
from typing import List, Dict, Tuple, Optional, Any
import uuid
from pathlib import Path

import agent_a2z_payment
from agent_a2z_payment.core import BillAgent

def init_bill_agent():
    """

    :return:
    """
    # Initialize the A2ZPaymentAgent
    agent = BillAgent(db_folder="./", db_name="a2z_billagent.db")
    print("--- Initialized A2ZPaymentAgent Database to save transactions ---")

    # Clear previous data for clean run (optional)
    print("Previous records cleared.")

    # 1. Add Records (Interface 1)
    # Adding data for two different months/weeks to test queries
    user_id = "TEMP_123"
    coffee_id = agent.add_bill_record(user_id,2.99, "USD", 'Coffee', 'Morning coffee', '2025-11-20')
    lunch_id = agent.add_bill_record(user_id,11.50, "USD", 'Food', 'Mexican Food lunch', '2025-11-20')
    transport_id = agent.add_bill_record(user_id,5.00, "USD", 'Transport', 'Subway ticket', '2025-11-25')
    groceries_id = agent.add_bill_record(user_id,45.50, "USD", 'Food', 'Weekly groceries', '2025-12-01')  # Next month

    print(f"\nAdded records (IDs: {coffee_id}, {lunch_id}, {transport_id}, {groceries_id})")

    # 2. Modify Record (Interface 2)
    success_update = agent.update_bill_record(user_id=user_id, record_id=lunch_id, amount=10.00)
    print(f"Updated Lunch Record (ID: {lunch_id}) to $10.00: {success_update}")

    # 3. Delete Record (Interface 3)
    success_delete = agent.delete_bill_record(user_id=user_id, record_id=coffee_id)
    print(f"Deleted Coffee Record (ID: {coffee_id}): {success_delete}")

    # 4. Query Records (Interface 4)

    # Query by Month (e.g., November 2025)
    print("\n--- Query by Month (November 2025) ---")
    start_m, end_m = agent.get_date_range('Month', year=2025, month=11)

    month_records = agent.query_bill_records(user_id=user_id,start_date=start_m, end_date=end_m)
    for record in month_records:
        print(
            f"Date: {record['date']}, Amount: ${record['amount']:.2f}, Category: {record['category']}, Desc: {record['description']}")

    # Summary by Category for November
    print("\n--- Summary by Category (November 2025) ---")
    category_summary = agent.query_bill_records_by_category(user_id=user_id, start_date=start_m, end_date=end_m)
    for summary in category_summary:
        print(f"Category: {summary['category']}, Total: ${summary['total_amount']:.2f}")

    ## set theme
    bill_html_card = agent.query_bill_records_by_category_summary_html(user_id, start_date=start_m, end_date=end_m, category='Coffee', theme='warm')
    print (f"DEBUG: bill_html_card")
    print (f"{bill_html_card}")

    agent.close()
    print("\n--- Database Connection Closed ---")



### Billing MCP
from mcp.server.fastmcp import FastMCP

## Open MySQL DB Agent
LOG_ENABLE = False
DB_NAME = "a2z_billagent.db"

AGENT_ID = "aiagenta2z/a2z_bill_agent"
AGENT_NAME = "A2Z Bill Agent"
CURRENCY_USD = "USD"

ROOT_DIR = Path(__file__).parent
DB_DIR = Path(__file__).parent/ "db"
DB_DIR_STR = str(DB_DIR.resolve())

print(f"Initializing DB or Connecting Existing {DB_DIR_STR} and DB Name {DB_NAME}")
logging.info(f"Initializing DB or Connecting Existing {DB_DIR_STR} and DB Name {DB_NAME}")
agent = BillAgent(db_folder=DB_DIR_STR, db_name=DB_NAME)

# Create an MCP server
mcp = FastMCP(AGENT_NAME, json_response=True)
CATEGORIES_LIST = ['EDUCATION', 'ENTERTAINMENT', 'FOOD', 'FUEL', 'GIFTS', 'GROCERIES', 'HEALTHCARE', 'HOUSING', 'INCOME', 'INSURANCE', 'INVESTMENTS',
                  'MORTGAGE', 'OTHERS', 'RENT', 'SALARY', 'SHOPPING', 'TAXES', 'TRANSPORT', 'TRAVEL', 'UTILITIES']

def generate_user_id():
    """
        get logged in user_id from session
    """
    temp_str = str(uuid.uuid4())[0:4]
    temp_user_id = "USER_" + temp_str
    user_id = temp_user_id
    return user_id

@mcp.tool()
def add_bill_record(user_id: str, amount: float, currency: str, category: str, description: str,
                    date: str = None, order_id: Optional[str] = None,
                    ext_info: Optional[str] = None) -> Dict:
    """
    Adds a new transaction record to the ledger, requiring amount, category, and date validation.

    Args:
        user_id: User ID. If user doesn't specify, use "TEMP_xxxx" format.
        amount: REQUIRED. The transaction amount. Must be greater than 0.0.
        category: REQUIRED. The transaction currency in upper case, such as "USD", "CNT", "EUR"
        category: REQUIRED. The expense category. Must be one of the following:
                  ['EDUCATION', 'ENTERTAINMENT', 'FOOD', 'FUEL', 'GIFTS', 'GROCERIES', 'HEALTHCARE', 'HOUSING', 'INCOME', 'INSURANCE', 'INVESTMENTS',
                  'MORTGAGE', 'OTHERS', 'RENT', 'SALARY', 'SHOPPING', 'TAXES', 'TRANSPORT', 'TRAVEL', 'UTILITIES'].
        description: A brief description.
        date: REQUIRED. The date in 'YYYY-MM-DD' format. If user mentions a general month
              or data like September, use the first day of that month (e.g., '2025-09-01').
              Defaults to today's date if not explicitly provided by the user.
        order_id: Optional. Order ID of the External Transaction.
        ext_info: Optional. External information related to the transaction.

    Returns:
        A dictionary with the 'order_id' (record ID) and a 'message' indicating success or failure.
    """
    record_id = -1
    message = ""
    if not user_id:
        user_id = generate_user_id()

    # 2. Handle date default calculation
    if not date:
        date = datetime.now().strftime('%Y-%m-%d')

    category_upper = category.upper()
    if category_upper not in CATEGORIES_LIST:
        return {"user_id": user_id,
                "order_id": -1,
                "message": f"Validation Failed: Category '{category}' not recognized. Please use one of the predefined categories: {', '.join(CATEGORIES_LIST)}."}

    try:
        record_id = agent.add_bill_record(
            user_id=user_id,
            amount=amount,
            currency=currency,
            category=category,
            description=description,
            date=date,
            order_id=order_id,
            ext_info=ext_info
        )
        message = f"Order {record_id} created successfully."
    except ValueError as e:
        print(f"Failed to add bill: {e}")
        message = f"Failed to create order: {e}"  # Updated failure message for clarity
    except Exception as e:
        print(f"An unexpected error occurred: {e}")
        message = f"Failed to create order due to an unexpected error."

    ## note: the user_id should be returned back to the LLM, just in case the add record are using various different user_id and mess
    # up the context
    result = {"user_id": user_id,
              "order_id": record_id,
              "message": message}
    return result

@mcp.tool()
def update_bill_record(user_id: str, record_id: int,
                       amount: Optional[float] = None,
                       currency: str = CURRENCY_USD,
                       category: Optional[str] = None,
                       description: Optional[str] = None,
                       order_id: Optional[str] = None,
                       ext_info: Optional[str] = None) -> Dict:
    """
    Updates an existing transaction record by its ID, ensuring the update is tied to a specific user.
    Automatically uses a default/temporary user ID if none is provided.

    Args:
        user_id: The ID of the user performing the update. Will be auto-generated if empty.
        record_id: The ID of the record to update.
        amount: New transaction amount. Pass None to keep existing value.
        category: New expense category (will be capitalized). Pass None to keep existing value.
        description: New detailed description. Pass None to keep existing value.
        order_id: New Order ID of the External Transaction. Pass None to keep existing value.
        ext_info: New External transaction information. Pass None to keep existing value.

    Returns:
        A dictionary with a 'status' (boolean) indicating success and a 'message'.
    """
    is_successful = False
    message = ""

    # Logic to fill user_id if called by LLM without context
    if not user_id:
        user_id = generate_user_id()
        print(f"DEBUG: update_bill_record User ID was empty. Set to temporary ID: {user_id}")

    try:
        is_successful = agent.update_bill_record(
            user_id=user_id,  # Added user_id
            record_id=record_id,
            amount=amount,
            currency=currency,
            category=category,
            description=description,
            order_id=order_id,
            ext_info=ext_info
        )
        if is_successful:
            message = f"Record ID {record_id} for user {user_id} updated successfully."
        else:
            message = f"Record ID {record_id} not found for user {user_id} or no changes were provided."
    except Exception as e:
        print(f"Failed to update bill record {record_id} for user {user_id}: {e}")
        message = f"Failed to update record ID {record_id} due to an error: {e}"

    return {"status": is_successful, "message": message}


# --- Tool 2: Query Records ---
@mcp.tool()
def query_bill_records(user_id: str, start_date: str, end_date: str,
                       category: Optional[str] = None) -> Dict:
    """
    Queries all transaction records for a specific user within a date range, optionally filtered by category.
    Automatically uses a default/temporary user ID if none is provided.

    Args:
        user_id: The ID of the user whose records are being queried. Will be auto-generated if empty.
        start_date: Start date (inclusive) in 'YYYY-MM-DD' format.
        end_date: End date (inclusive) in 'YYYY-MM-DD' format.
        category: Optional category filter. Pass None for all categories.

    Returns:
        A dictionary containing the list of matching 'records', the 'count' of records, and a 'message'.
    """
    records: List[Dict[str, Any]] = []
    message = "Success"

    # Logic to fill user_id if called by LLM without context
    if not user_id:
        user_id = generate_user_id()
        print(f"DEBUG: query_bill_records User ID was empty. Set to temporary ID: {user_id}")

    try:
        records = agent.query_bill_records(
            user_id=user_id,  # Added user_id
            start_date=start_date,
            end_date=end_date,
            category=category
        )
        message = f"Successfully retrieved {len(records)} records for user {user_id}."
    except Exception as e:
        print(f"Failed to query bill records for user {user_id}: {e}")
        message = f"Failed to query records due to an error: {e}"

    return {
        "records": records,
        "count": len(records),
        "message": message
    }


# --- Tool 3: Summarize Expenses ---
@mcp.tool()
def query_bill_records_by_category(user_id: str, start_date: str, end_date: str) -> Dict:
    """
    Calculates the total expense for each category for a specific user within a specified date range.
    Automatically uses a default/temporary user ID if none is provided.

    Args:
        user_id: The ID of the user whose expenses are being summarized. Will be auto-generated if empty.
        start_date: Start date (inclusive) in 'YYYY-MM-DD' format.
        end_date: End date (inclusive) in 'YYYY-MM-DD' format.

    Returns:
        A dictionary containing the expense 'summary' (list of categories and total amounts) and a 'message'.
    """
    summary: List[Dict[str, Any]] = []
    message = "Success"

    # Logic to fill user_id if called by LLM without context
    if not user_id:
        user_id = generate_user_id()
        print(f"DEBUG: summarize_expense_by_category User ID was empty. Set to temporary ID: {user_id}")

    try:
        summary = agent.query_bill_records_by_category(
            user_id=user_id,  # Added user_id
            start_date=start_date,
            end_date=end_date
        )
        message = f"Successfully generated summary for user {user_id}."
    except Exception as e:
        print(f"Failed to summarize expenses for user {user_id}: {e}")
        message = f"Failed to generate summary due to an error: {e}"

    return {
        "summary": summary,
        "message": message
    }

# --- Tool 3: Summarize Expenses ---
@mcp.tool()
def query_bill_records_summary_html(user_id: str, start_date: str, end_date: str, category: Optional[str]=None) -> Dict:
    """
    Calculates the total expense for each category for a specific user within a specified date range.
    Automatically uses a default/temporary user ID if none is provided.

    Args:
        user_id: The ID of the user whose expenses are being summarized. Will be auto-generated if empty.
        start_date: Start date (inclusive) in 'YYYY-MM-DD' format.
        end_date: End date (inclusive) in 'YYYY-MM-DD' format.

    Returns:
        A dictionary containing the expense 'summary' (list of categories and total amounts) and a 'message'.
    """
    # Logic to fill user_id if called by LLM without context
    if not user_id:
        user_id = generate_user_id()
        print(f"DEBUG: summarize_expense_by_category User ID was empty. Set to temporary ID: {user_id}")

    try:
        result = agent.query_bill_records_by_category_summary_html(user_id, start_date, end_date, category)
        html = result.get("html")
        js = result.get("js")
        if LOG_ENABLE:
            print (f"Query bill for user {user_id}: {html}")
            print (f"Query bill for user {user_id}: {js}")
        message = f"Successfully generated card to display for user {user_id}."
        result["message"] = message
        return result
    except Exception as e:
        print(f"Failed to summarize expenses for user {user_id}: {e}")
        message = f"Failed to Render Card. Please try again later."
        result = {
            "html": "<div>Your Bill Agent is taking a rest. Please try again later</div>",
            "js": "",
            "message": message,
        }
        return result

# Add a prompt
@mcp.prompt()
def greet_user(name: str, style: str = "friendly") -> str:
    """Generate a greeting prompt

    """
    styles = {
        "friendly": "Hello, I am Agent A2Z Bill Agent, Who can help you track your daily expense add bills and make analysis. You can send me bill like 'coffee for $2.99 on Nov 4th, cellphone AT&T $200.0, rent $500.0, etc'. And analysis like 'How much I spend on food last month?' ",
        "formal": "Please write a formal, professional greeting",
        "casual": "Please write a casual, relaxed greeting",
    }

    return f"{styles.get(style, styles['friendly'])} for someone named {name}."

import contextlib
from starlette.applications import Starlette
from starlette.routing import Mount, Route
from starlette.responses import JSONResponse

@contextlib.asynccontextmanager
async def lifespan(app: Starlette):

    # STARTUP: Connect to MySQL
    print("--- APPLICATION STARTUP ---")
    await agent.connect()

    async with mcp.session_manager.run():
        yield

    # SHUTDOWN: Close MySQL connection
    print("--- APPLICATION SHUTDOWN ---")
    await agent.close()

async def get_mcp_root_id_handler(request):
    """
    This function handles the GET request to the root of the MCP application (i.e., /mcp).
    """
    unique_id = AGENT_ID
    return JSONResponse({"id": AGENT_ID})

# --- Starlette Route Function (for the main / route) ---
async def starlette_root_id_endpoint(request):
    """
    Starlette endpoint to serve the root path of the main application: http://<server>:7003/
    """
    unique_id = str(uuid.uuid4())[:8]
    return JSONResponse({"app_root_id": unique_id})

## Route: single endpoint, Mount: /xxx all the subsequent urls
mcp_app = mcp.streamable_http_app()
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
        Starlette: Mount mcp to /
    """
    import argparse, os
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=7000)
    args = parser.parse_args()

    print(f"Starting MCP server on port {args.port}")
    os.environ["MCP_SERVER_URL"] = f"http://0.0.0.0:{args.port}/mcp"
    mcp.run("streamable-http")
