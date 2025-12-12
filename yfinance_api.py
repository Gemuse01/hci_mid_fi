from flask import Flask, request, jsonify
from flask_cors import CORS
import yfinance as yf

app = Flask(__name__)
CORS(app)

@app.route("/")
def index():
    return jsonify({
        "message": "yfinance API server is running",
        "endpoints": [
            "/api/quote?symbol=SYMBOL",
            "/api/search?query=QUERY"
        ]
    })

@app.route("/api/quote")
def get_quote():
    symbol = request.args.get('symbol')
    if not symbol:
        return jsonify({'error': "no symbol"}), 400
    try:
        ticker = yf.Ticker(symbol)
        data = ticker.history(period="2d")
        if data.empty:
            return jsonify({"error": "No price data"}), 404
        last_row = data.iloc[-1]
        price = float(last_row["Close"])
        prev_row = data.iloc[-2] if len(data) > 1 else last_row
        prev_close = float(prev_row["Close"])
        change_pct = (price - prev_close) / prev_close * 100 if prev_close > 0 else 0
        return jsonify({"symbol": symbol, "price": price, "change_pct": change_pct})
    except Exception as e:
        print("quote error", e)
        return jsonify({"error": str(e)}), 500

@app.route("/api/search")
def search_stocks():
    query = request.args.get('query', '').strip()
    if not query:
        return jsonify({"results": []})
    
    results = []
    query_upper = query.upper()
    
    # 1. 나스닥 심볼 직접 시도 (대문자로)
    nasdaq_symbols = [query_upper]
    
    # 2. 한국 주식 심볼 시도
    korean_symbols = []
    if query.isdigit() and len(query) == 6:
        # 6자리 숫자면 .KS와 .KQ 둘 다 시도하되, 각각 독립적으로 검증
        korean_symbols = [f"{query}.KS", f"{query}.KQ"]
    elif query.isdigit():
        korean_symbols = [f"{query}.KS"]
    
    # 3. 이미 .KS, .KQ가 붙어있으면 그대로 사용하고 나스닥은 제외
    if query.endswith('.KS') or query.endswith('.KQ'):
        korean_symbols = [query]
        nasdaq_symbols = []
    
    # 모든 후보 심볼 검증
    all_symbols = nasdaq_symbols + korean_symbols
    valid_korean_results = {'KS': None, 'KQ': None}
    
    for symbol in all_symbols:
        try:
            ticker = yf.Ticker(symbol)
            info = ticker.info
            
            # 유효한 종목인지 확인
            if not info or 'symbol' not in info:
                continue
            
            # 이름 가져오기
            name = info.get('longName') or info.get('shortName') or ''
            
            # 이름이 이상한 경우 필터링
            if not name or len(name) < 2:
                continue
            
            # 이름에 이상한 패턴이 있으면 제외
            if ',' in name or name.startswith('0P') or len(name.split(',')) > 1:
                continue
            
            # 실제 주가 데이터가 있어야 함 (가장 중요!)
            try:
                data = ticker.history(period="2d")
                if data.empty:
                    continue  # 주가 데이터가 없으면 유효하지 않음
                price = float(data.iloc[-1]["Close"])
            except:
                # history 실패 시 info에서 가격 가져오기 시도
                price = info.get('currentPrice', 0) or info.get('regularMarketPrice', 0) or 0
                if price <= 0:
                    continue  # 가격이 없으면 유효하지 않음
            
            # 가격이 0 이하면 제외
            if price <= 0:
                continue
            
            sector = info.get('sector', 'N/A')
            
            result = {
                "symbol": symbol,
                "name": name,
                "price": price,
                "change_pct": 0,
                "sector": sector,
                "volatility": "medium"
            }
            
            # 나스닥 종목이면 바로 추가
            if symbol not in korean_symbols:
                results.append(result)
            else:
                # 한국 주식인 경우, .KS와 .KQ를 구분해서 저장
                if symbol.endswith('.KS'):
                    if valid_korean_results['KS'] is None:
                        valid_korean_results['KS'] = result
                elif symbol.endswith('.KQ'):
                    if valid_korean_results['KQ'] is None:
                        valid_korean_results['KQ'] = result
                
        except Exception as e:
            # 이 심볼은 유효하지 않음, 다음으로
            continue
    
    # 한국 주식 결과 추가 (각각 최대 1개씩만)
    if valid_korean_results['KS']:
        results.append(valid_korean_results['KS'])
    if valid_korean_results['KQ']:
        results.append(valid_korean_results['KQ'])
    
    return jsonify({"results": results[:20]})  # 최대 20개 반환


# yfinance_api.py
# yfinance_api.py (예시)

from flask import Flask, request, jsonify
from flask_cors import CORS
import os

from qwen_client import call_qwen_finsec_model, build_security_prompt

app = Flask(__name__)
# 프론트(3000) → 백엔드(5002) CORS 허용
CORS(app, resources={r"/api/*": {"origins": "*"}})

# 엘리스에서 받은 URL / API KEY
MY_API_URL = "https://mlapi.run/0cd91e2f-6603-4699-b9d8-57c93f05b37e"
MY_API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE3NjUzMjc0NDQsIm5iZiI6MTc2NTMyNzQ0NCwiZXhwIjoxNzY1Mzc4Nzk5LCJrZXlfaWQiOiI5MWQ1N2UwMi03ODYxLTQ4YzQtODU1Ni1hMGVkYmIyNWQxNjIifQ.D-ybt57LKXBcckn2LgHXx6YI2g49UYI4f1vPAxZgpgk"

@app.route("/api/security-chat", methods=["POST", "OPTIONS"])
def security_chat():
    """
    보안모드용 Qwen-Finsec 프록시 엔드포인트
    프론트에서 body:
      { "history": [ { "role": "user"|"model", "content": "..." }, ... ] }
    """
    print(">>> /api/security-chat hit, method =", request.method)

    # 브라우저 Preflight(OPTIONS) 대응
    if request.method == "OPTIONS":
        # Flask-CORS가 헤더는 달아주기 때문에 200만 돌려주면 됨
        return "", 200

    data = request.get_json(force=True) or {}
    history = data.get("history", [])

    if not history:
        return jsonify({"error": "history is empty"}), 400

    latest = history[-1]
    user_message = latest.get("content", "")
    prev_history = history[:-1]

    prompt = build_security_prompt(prev_history, user_message)
    print("[DEBUG] prompt head:", prompt[:200], "...")

    answer = call_qwen_finsec_model(MY_API_URL, MY_API_KEY, prompt)
    return jsonify({"answer": answer})


if __name__ == "__main__":
    # 기존에 yfinance용 다른 라우트들도 같이 app에 정의돼 있다고 가정
    app.run(host="0.0.0.0", port=5002, debug=True)
