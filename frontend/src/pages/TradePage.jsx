import { useEffect, useState } from "react";
import { api } from "../api";
import Alert from "../components/Alert";
import { accountLabel, formatDateTime, formatMoney, formatSignedMoney } from "../format";
import { useApi } from "../hooks";

const EMPTY_ORDER = { symbol: "", side: "BUY", quantity: "" };

function OrderTicket({ accountId, quotes, portfolio, onPlaced }) {
  const [order, setOrder] = useState(EMPTY_ORDER);
  const [reviewing, setReviewing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const quote = quotes.find((q) => q.symbol === order.symbol);
  const qty = Number(order.quantity);
  const estimate = quote && qty > 0 ? quote.price * qty : 0;
  const owned = portfolio?.holdings.find((h) => h.symbol === order.symbol)?.quantity ?? 0;

  const update = (field) => (e) => {
    setOrder((o) => ({ ...o, [field]: e.target.value }));
    setError("");
    setResult(null);
  };

  const validate = () => {
    if (!order.symbol) return "Please select a symbol.";
    if (!Number.isInteger(qty) || qty <= 0) return "Quantity must be a whole number greater than 0.";
    if (order.side === "BUY" && estimate > portfolio.cash) return "Insufficient cash for this order.";
    if (order.side === "SELL" && qty > owned) return `You only own ${owned} shares of ${order.symbol}.`;
    return "";
  };

  const handleReview = (e) => {
    e.preventDefault();
    const msg = validate();
    if (msg) return setError(msg);
    setReviewing(true);
  };

  const handlePlace = async () => {
    setSubmitting(true);
    setError("");
    try {
      const placed = await api("/trade/orders", {
        method: "POST",
        body: { account_id: accountId, symbol: order.symbol, side: order.side, quantity: qty },
      });
      setResult(placed);
      setOrder(EMPTY_ORDER);
      onPlaced();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
      setReviewing(false);
    }
  };

  return (
    <section className="card" data-testid="order-ticket">
      <h2 className="card-title">Order ticket</h2>
      <Alert type="error" testId="order-error">{error}</Alert>
      {result && (
        <Alert type="success" testId="order-success" onClose={() => setResult(null)}>
          Order filled: {result.side === "BUY" ? "Bought" : "Sold"} {result.quantity} {result.symbol} @{" "}
          {formatMoney(result.price)} for {formatMoney(result.total)}.
          <div className="confirmation">Confirmation #: <span data-testid="order-confirmation">{result.confirmation_number}</span></div>
        </Alert>
      )}

      {!reviewing ? (
        <form onSubmit={handleReview} noValidate data-testid="order-form">
          <div className="field">
            <span className="label">Action</span>
            <div className="segmented" role="radiogroup">
              {["BUY", "SELL"].map((side) => (
                <label key={side} className={`segment ${order.side === side ? `active ${side.toLowerCase()}` : ""}`}>
                  <input
                    type="radio"
                    name="side"
                    value={side}
                    checked={order.side === side}
                    onChange={update("side")}
                    data-testid={`order-side-${side.toLowerCase()}`}
                  />
                  {side === "BUY" ? "Buy" : "Sell"}
                </label>
              ))}
            </div>
          </div>
          <div className="field">
            <label htmlFor="order-symbol">Symbol</label>
            <select id="order-symbol" value={order.symbol} onChange={update("symbol")} data-testid="order-symbol">
              <option value="">Select a symbol</option>
              {quotes.map((q) => (
                <option key={q.symbol} value={q.symbol}>{q.symbol} — {q.name}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="order-quantity">Quantity (shares)</label>
            <input
              id="order-quantity"
              type="number"
              min="1"
              step="1"
              value={order.quantity}
              onChange={update("quantity")}
              data-testid="order-quantity"
            />
            {order.side === "SELL" && order.symbol && <small className="muted">You own {owned} shares</small>}
          </div>
          <div className="field">
            <span className="label">Order type</span>
            <div className="static-value">Market</div>
          </div>
          <div className="estimate">
            <span>Estimated {order.side === "BUY" ? "cost" : "proceeds"}</span>
            <strong data-testid="order-estimate">{formatMoney(estimate)}</strong>
          </div>
          <button type="submit" className="btn btn-primary btn-block" data-testid="order-review">
            Review Order
          </button>
        </form>
      ) : (
        <div className="review" data-testid="order-review-panel">
          <h3>Review your order</h3>
          <dl className="review-list">
            <dt>Action</dt><dd data-testid="review-side">{order.side === "BUY" ? "Buy" : "Sell"}</dd>
            <dt>Symbol</dt><dd data-testid="review-symbol">{order.symbol}</dd>
            <dt>Quantity</dt><dd data-testid="review-quantity">{qty}</dd>
            <dt>Price</dt><dd>{formatMoney(quote.price)}</dd>
            <dt>Estimated total</dt><dd className="strong" data-testid="review-total">{formatMoney(estimate)}</dd>
          </dl>
          <div className="btn-row">
            <button type="button" className="btn btn-secondary" onClick={() => setReviewing(false)} disabled={submitting} data-testid="order-edit">
              Edit
            </button>
            <button type="button" className="btn btn-primary" onClick={handlePlace} disabled={submitting} data-testid="order-place">
              {submitting ? "Placing…" : "Place Order"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

export default function TradePage() {
  const accounts = useApi("/accounts");
  const brokerage = (accounts.data || []).filter((a) => a.account_type === "BROKERAGE");
  const [accountId, setAccountId] = useState(null);

  useEffect(() => {
    if (accountId === null && brokerage.length) setAccountId(brokerage[0].id);
  }, [accountId, brokerage]);

  const quotes = useApi("/trade/quotes");
  const portfolio = useApi(accountId ? `/trade/portfolio/${accountId}` : null);
  const orders = useApi(accountId ? `/trade/orders?account_id=${accountId}` : null);

  const refresh = () => {
    portfolio.reload();
    orders.reload();
  };

  if (accounts.loading) return <div className="card muted">Loading…</div>;
  if (!brokerage.length) {
    return (
      <div className="card empty-state" data-testid="no-brokerage">
        <h2>No brokerage account</h2>
        <p className="muted">You need a brokerage account to trade. Contact us to open one.</p>
      </div>
    );
  }

  const p = portfolio.data;

  return (
    <div data-testid="trade-page">
      <div className="page-header">
        <div>
          <h1>Trade</h1>
          <p className="muted">Buy and sell stocks and ETFs at market price.</p>
        </div>
        <div className="field inline">
          <label htmlFor="trade-account">Account</label>
          <select
            id="trade-account"
            value={accountId ?? ""}
            onChange={(e) => setAccountId(Number(e.target.value))}
            data-testid="trade-account"
          >
            {brokerage.map((a) => (
              <option key={a.id} value={a.id}>{accountLabel(a)}</option>
            ))}
          </select>
        </div>
      </div>

      <Alert type="error">{portfolio.error || quotes.error}</Alert>

      {p && (
        <div className="stat-row">
          <div className="stat card">
            <span className="muted">Cash available</span>
            <span className="stat-value" data-testid="portfolio-cash">{formatMoney(p.cash)}</span>
          </div>
          <div className="stat card">
            <span className="muted">Holdings value</span>
            <span className="stat-value" data-testid="portfolio-holdings-value">{formatMoney(p.holdings_value)}</span>
          </div>
          <div className="stat card">
            <span className="muted">Total account value</span>
            <span className="stat-value" data-testid="portfolio-total-value">{formatMoney(p.total_value)}</span>
          </div>
        </div>
      )}

      <div className="grid-2">
        <div>
          <section className="card">
            <h2 className="card-title">Market quotes</h2>
            <table className="table" data-testid="quotes-table">
              <thead>
                <tr>
                  <th>Symbol</th>
                  <th>Name</th>
                  <th className="num">Price</th>
                  <th className="num">Change</th>
                </tr>
              </thead>
              <tbody>
                {quotes.data?.map((q) => (
                  <tr key={q.symbol} data-testid={`quote-row-${q.symbol}`}>
                    <td className="strong">{q.symbol}</td>
                    <td className="muted">{q.name}</td>
                    <td className="num" data-testid="quote-price">{formatMoney(q.price)}</td>
                    <td className={`num ${q.change < 0 ? "neg" : "pos"}`}>
                      {formatSignedMoney(q.change)} ({q.change_pct > 0 ? "+" : ""}{q.change_pct.toFixed(2)}%)
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="card">
            <h2 className="card-title">Your holdings</h2>
            <table className="table" data-testid="holdings-table">
              <thead>
                <tr>
                  <th>Symbol</th>
                  <th className="num">Shares</th>
                  <th className="num">Avg cost</th>
                  <th className="num">Market value</th>
                  <th className="num">Gain/Loss</th>
                </tr>
              </thead>
              <tbody>
                {p?.holdings.map((h) => (
                  <tr key={h.symbol} data-testid={`holding-row-${h.symbol}`}>
                    <td className="strong">{h.symbol}</td>
                    <td className="num" data-testid="holding-quantity">{h.quantity}</td>
                    <td className="num">{formatMoney(h.avg_cost)}</td>
                    <td className="num">{formatMoney(h.market_value)}</td>
                    <td className={`num ${h.gain_loss < 0 ? "neg" : "pos"}`}>{formatSignedMoney(h.gain_loss)}</td>
                  </tr>
                ))}
                {p?.holdings.length === 0 && (
                  <tr><td colSpan={5} className="empty-row">You don’t own any securities yet.</td></tr>
                )}
              </tbody>
            </table>
          </section>
        </div>

        <div>
          {quotes.data && p && (
            <OrderTicket accountId={accountId} quotes={quotes.data} portfolio={p} onPlaced={refresh} />
          )}
        </div>
      </div>

      <section className="card">
        <h2 className="card-title">Order history</h2>
        <table className="table" data-testid="orders-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Confirmation #</th>
              <th>Action</th>
              <th>Symbol</th>
              <th className="num">Qty</th>
              <th className="num">Price</th>
              <th className="num">Total</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {orders.data?.map((o) => (
              <tr key={o.id} data-testid={`order-row-${o.confirmation_number}`}>
                <td>{formatDateTime(o.created_at)}</td>
                <td className="mono">{o.confirmation_number}</td>
                <td><span className={`badge badge-${o.side.toLowerCase()}`}>{o.side}</span></td>
                <td className="strong">{o.symbol}</td>
                <td className="num">{o.quantity}</td>
                <td className="num">{formatMoney(o.price)}</td>
                <td className="num">{formatMoney(o.total)}</td>
                <td><span className="badge badge-filled">{o.status}</span></td>
              </tr>
            ))}
            {orders.data?.length === 0 && (
              <tr><td colSpan={8} className="empty-row" data-testid="no-orders">No orders yet.</td></tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
