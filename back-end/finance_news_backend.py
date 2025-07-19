# finance_news_backend.py (Final Version with Pagination)

"""
FinanceFlow Web App (Production Ready)
- This is the lightweight web server component of the FinanceFlow project.
- Its main responsibilities are:
  1. Serving the frontend application (HTML/CSS/JS).
  2. Fetching pre-analyzed news from Firestore with pagination.
  3. Fetching real-time stock prices for news on the current page.
  4. Handling user Q&A requests by querying the AI.
- Includes a data sanitization step to validate ticker symbols from the AI.
- Pagination is implemented on the /api/main_feed endpoint.
"""

# --- Imports ---
import os
import re
from datetime import datetime
from typing import List, Dict, Any, Optional
import yfinance as yf
from dataclasses import dataclass, asdict
import math  # Added for pagination calculation

from groq import Groq
from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
import logging
from dotenv import load_dotenv

import firebase_admin
from firebase_admin import credentials, firestore
import json

# --- Initialization ---
load_dotenv()
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# --- Firebase Initialization ---
db_firestore = None
analyzed_news_collection = None
daily_briefs_collection = None
metadata_collection = None

try:
    firebase_credentials_json = os.getenv("FIREBASE_CREDENTIALS_JSON")
    if firebase_credentials_json:
        logger.info("WEB APP: Found FIREBASE_CREDENTIALS_JSON environment variable. Attempting to use it.")
        cred = credentials.Certificate(json.loads(firebase_credentials_json))
    else:
        key_path = "firebase-key.json"
        if os.path.exists(key_path):
            logger.info(f"WEB APP: Found Firebase key file at {key_path}. Attempting to use it.")
            cred = credentials.Certificate(key_path)
        else:
            raise FileNotFoundError(f"Firebase credentials not found. Neither FIREBASE_CREDENTIALS_JSON env var nor file at {key_path} exists.")
    
    firebase_admin.initialize_app(cred)
    db_firestore = firestore.client()

    # Define all collection references
    analyzed_news_collection = db_firestore.collection('analyzed_news')
    daily_briefs_collection = db_firestore.collection('daily_briefs')
    # This collection is crucial for efficient pagination counting
    metadata_collection = db_firestore.collection('collections_metadata')
    
    logger.info("WEB APP: Firebase initialized successfully.")
except Exception as e:
    logger.error(f"WEB APP: Failed to initialize Firebase: {e}", exc_info=True)
    # Ensure all clients are None on failure
    analyzed_news_collection = None
    daily_briefs_collection = None
    metadata_collection = None


# --- Data Classes ---
@dataclass
class StockData:
    symbol: str
    price: float
    change: float
    percent_change: float

@dataclass
class NewsItem:
    # This is used for context in the Q&A function
    id: str
    title: str
    link: str
    source: str
    published: Any
    content: str = ""
    analysis: Optional[Dict[str, Any]] = None
    processed_at: Any = None

# --- Utility Functions ---
def is_valid_ticker(symbol: str) -> bool:
    """A simple validator to filter out invalid ticker symbols returned by the AI."""
    if not symbol or not isinstance(symbol, str): return False
    if len(symbol) > 6 or len(symbol) < 1: return False
    if ' ' in symbol: return False
    if not re.match(r'^[A-Z0-9.-]+$', symbol): return False
    return True

def format_datetime_to_thai(dt: datetime) -> str:
    """Formats a datetime object to 'DD Mon YYYY, HH:MM' with Thai month abbreviation."""
    thai_months = {
        1: "ม.ค.", 2: "ก.พ.", 3: "มี.ค.", 4: "เม.ย.", 5: "พ.ค.", 6: "มิ.ย.",
        7: "ก.ค.", 8: "ส.ค.", 9: "ก.ย.", 10: "ต.ค.", 11: "พ.ย.", 12: "ธ.ค."
    }
    return f"{dt.day} {thai_months[dt.month]} {dt.year}, {dt.hour:02d}:{dt.minute:02d}"

# --- Service Classes ---
class MarketDataProvider:
    """Fetches live stock market data."""
    def get_stock_data(self, symbols: List[str]) -> Dict[str, StockData]:
        if not symbols: return {}
        data = {}
        logger.info(f"WEB APP: Fetching stock data for: {symbols}")
        try:
            tickers = yf.Tickers(' '.join(symbols))
            for symbol in symbols:
                try:
                    info = tickers.tickers[symbol].fast_info
                    price, prev_close = info.get('last_price'), info.get('previous_close')
                    if price and prev_close:
                        data[symbol] = StockData(
                            symbol=symbol,
                            price=round(price, 2),
                            change=round(price - prev_close, 2),
                            percent_change=round(((price - prev_close) / prev_close) * 100, 2)
                        )
                except Exception as e:
                    logger.warning(f"WEB APP: Could not fetch data for an individual ticker '{symbol}': {e}")
        except Exception as e:
            logger.error(f"WEB APP: A general error occurred in yfinance Tickers call: {e}")
        return data

class AIProcessor:
    """This version of the processor is only for the Q&A feature."""
    def __init__(self):
        self.api_key = os.getenv("GROQ_API_KEY")
        self.client = Groq(api_key=self.api_key) if self.api_key else None
        if not self.client: logger.warning("WEB APP: GROQ_API_KEY not found for Q&A.")
        self.model = "llama3-8b-8192"

    def answer_user_question(self, question: str, news_context: List[NewsItem]) -> str:
        if not self.client: return "AI processor is offline."
        context_str = "\n\n".join([f"Title: {item.title}\nSummary: {item.analysis.get('summary_en', '')}" for item in news_context if item.analysis])
        prompt = f"""You are a helpful AI investment assistant. Answer the user's question in Thai based *only* on the provided context. Do not give direct financial advice. If the context is insufficient, state that.
        CONTEXT:\n---\n{context_str}\n---\nUSER QUESTION: "{question}"\n\nYOUR ANSWER (in Thai):"""
        try:
            chat_completion = self.client.chat.completions.create(
                messages=[{"role": "user", "content": prompt}], model=self.model, temperature=0.5
            )
            return chat_completion.choices[0].message.content
        except Exception as e:
            logger.error(f"WEB APP: Groq Q&A failed: {e}")
            return "ขออภัยค่ะ เกิดข้อผิดพลาดในการประมวลผลคำตอบ"

# --- Application Components ---
market_provider = MarketDataProvider()
ai_processor_for_qa = AIProcessor()

# --- Flask App & API Endpoints ---
app = Flask(__name__, template_folder='../front-end/dist', static_folder='../front-end/dist/assets')
CORS(app)

@app.route('/')
def index():
    return render_template('index.html')


@app.route('/api/daily_brief')
def get_daily_brief():
    if not daily_briefs_collection:
        return jsonify({"status": "error", "message": "Database connection not available."}), 500
    try:
        query = daily_briefs_collection.order_by("__name__", direction=firestore.Query.DESCENDING).limit(1)
        docs = list(query.stream())
        if docs:
            brief_data = docs[0].to_dict()
            if 'generated_at_utc' in brief_data and isinstance(brief_data['generated_at_utc'], datetime):
                brief_data['generated_at_utc'] = brief_data['generated_at_utc'].isoformat()
            return jsonify({"status": "success", "data": brief_data})
        else:
            logger.warning("WEB APP: No daily brief document was found in the collection.")
            return jsonify({"status": "error", "message": "No daily brief is available yet."}), 404
    except Exception as e:
        logger.error(f"WEB APP: Error fetching daily brief from Firestore: {e}", exc_info=True)
        return jsonify({"status": "error", "message": "Could not load the daily brief."}), 500


@app.route('/api/main_feed')
def get_main_feed():
    # <<< MODIFICATION: We no longer need metadata_collection for this endpoint >>>
    if not analyzed_news_collection:
        return jsonify({"status": "error", "message": "Database connection not available."}), 500
    
    try:
        # Step 1: Get pagination parameters from the request query string
        page = int(request.args.get('page', 1))
        limit = int(request.args.get('limit', 10))
        
        # <<< MODIFICATION: Hardcode the total number of news to 50 >>>
        # This ensures the app only ever considers the latest 50 articles.
        TOTAL_NEWS_TO_SHOW = 50
        
        # Prevent users from requesting pages beyond the limit
        if (page - 1) * limit >= TOTAL_NEWS_TO_SHOW:
            return jsonify({
                "status": "success", 
                "data": {
                    "news": [], 
                    "stocks": {}, 
                    "pagination": {
                        "currentPage": page,
                        "pageSize": limit,
                        "totalNews": TOTAL_NEWS_TO_SHOW,
                        "totalPages": math.ceil(TOTAL_NEWS_TO_SHOW / limit)
                    }
                }
            }), 200

        # Step 2: Build the base query (this remains the same)
        base_query = analyzed_news_collection.order_by("published", direction=firestore.Query.DESCENDING)

        # Step 3: Use a cursor for pagination (this remains the same)
        query = base_query
        cursor = None
        if page > 1:
            offset = (page - 1) * limit
            last_doc_query = base_query.limit(offset).get()
            if len(last_doc_query) > 0:
                cursor = last_doc_query[-1]
                query = base_query.start_after(cursor)

        # Step 4: Execute the query for the current page, but limit the total scope.
        # The limit() here applies to the current page's fetch, not the total.
        docs = query.limit(limit).stream()
        news_from_db_raw = [doc.to_dict() for doc in docs]
        
        # Step 5: Process the news items for the current page (same logic)
        processed_news = []
        all_raw_symbols = set()
        for item in news_from_db_raw:
            # ... (the existing processing logic is fine, no changes needed here) ...
            if 'analysis' not in item or not isinstance(item['analysis'], dict): item['analysis'] = {}
            firestore_sentiment = item['analysis'].get('sentiment', 'Neutral')
            if firestore_sentiment == 'Positive': item['analysis']['impact'] = 'Bullish'
            elif firestore_sentiment == 'Negative': item['analysis']['impact'] = 'Bearish'
            else: item['analysis']['impact'] = 'Mixed'
            
            item['analysis']['impact_score'] = item['analysis'].get('impact_score', None)
            item['analysis']['summary_en'] = item['analysis'].get('summary_en', item.get('content', '')[:150] + '...' if item.get('content') else 'No summary available.')
            item['analysis']['summary_th'] = item['analysis'].get('summary_th', item['analysis']['summary_en'])
            
            affected_symbols = item['analysis'].get('affected_symbols', [])
            if not isinstance(affected_symbols, list): affected_symbols = []
            item['analysis']['affected_symbols'] = affected_symbols
            
            if isinstance(item.get('published'), datetime): item['published'] = format_datetime_to_thai(item['published'])
            elif isinstance(item.get('published'), str):
                try: dt_obj = datetime.fromisoformat(item['published'].replace('Z', '+00:00')); item['published'] = format_datetime_to_thai(dt_obj)
                except ValueError: pass
            
            all_raw_symbols.update(sym.upper() for sym in item['analysis']['affected_symbols'])
            processed_news.append(item)
        
        # Step 6: Get stock data for the current page's news (same logic)
        valid_symbols = {sym for sym in all_raw_symbols if is_valid_ticker(sym)}
        stock_data = market_provider.get_stock_data(list(valid_symbols)[:20])
        
        # Step 7: Build the response structure with the hardcoded pagination info
        response_data = {
            "news": processed_news,
            "stocks": {symbol: asdict(data) for symbol, data in stock_data.items()},
            "pagination": {
                "currentPage": page,
                "pageSize": limit,
                "totalNews": TOTAL_NEWS_TO_SHOW,
                "totalPages": math.ceil(TOTAL_NEWS_TO_SHOW / limit)
            }
        }
        return jsonify({"status": "success", "data": response_data})
    except Exception as e:
        logger.error(f"WEB APP: Error fetching feed from Firestore: {e}", exc_info=True)
        return jsonify({"status": "error", "message": "Could not load feed from database."}), 500
    
@app.route('/api/ask', methods=['POST'])
def ask_question():
    data = request.get_json()
    question = data.get('question')
    if not question:
        return jsonify({"status": "error", "message": "No question provided."}), 400
    
    if not analyzed_news_collection:
        return jsonify({"status": "error", "message": "Database connection not available for context."}), 500

    try:
        # Context is still based on the latest 30 news items for relevance
        query = analyzed_news_collection.order_by("published", direction=firestore.Query.DESCENDING).limit(50)
        docs = query.stream()
        news_context = [NewsItem(**doc.to_dict()) for doc in docs]

        answer = ai_processor_for_qa.answer_user_question(question, news_context)
        return jsonify({"status": "success", "answer": answer})
    except Exception as e:
        logger.error(f"WEB APP: Error in Q&A endpoint: {e}", exc_info=True)
        return jsonify({"status": "error", "message": "Could not process question."}), 500

if __name__ == '__main__':
    print("🚀 Starting FinanceFlow Web App [LOCAL DEVELOPMENT MODE]")
    app.run(debug=True, host='0.0.0.0', port=5000)