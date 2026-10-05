import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import Alert from "../components/Alert";
import { formatDate, formatMoney, formatSignedMoney, maskAccount, titleCase } from "../format";
import { useApi } from "../hooks";

const CATEGORIES = ["DEPOSIT", "WITHDRAWAL", "TRANSFER", "PAYMENT", "TRADE"];

export default function AccountDetailPage() {
  const { accountId } = useParams();
  const [category, setCategory] = useState("");
  const account = useApi(`/accounts/${accountId}`);
  const txns = useApi(`/accounts/${accountId}/transactions${category ? `?category=${category}` : ""}`);

  if (account.error) {
    return (
      <div>
        <Link to="/accounts" className="back-link">← Back to Accounts</Link>
        <Alert type="error" testId="account-error">{account.error}</Alert>
      </div>
    );
  }
  const a = account.data;

  return (
    <div data-testid="account-detail-page">
      <Link to="/accounts" className="back-link" data-testid="back-to-accounts">← Back to Accounts</Link>
      {a && (
        <div className="page-header">
          <div>
            <h1 data-testid="account-name">{a.nickname}</h1>
            <p className="muted">
              {titleCase(a.account_type)} · <span className="mono" data-testid="account-number">{maskAccount(a.account_number)}</span>
            </p>
          </div>
          <div className="summary-total">
            <span className="muted">{a.account_type === "BROKERAGE" ? "Cash balance" : "Available balance"}</span>
            <span className="summary-amount" data-testid="account-balance">{formatMoney(a.balance)}</span>
            {a.account_type !== "BROKERAGE" && (
              <Link
                to={`/transfer-pay?tab=deposit&account=${a.id}`}
                className="btn btn-secondary btn-sm"
                data-testid="deposit-withdraw-link"
              >
                Deposit / Withdraw
              </Link>
            )}
          </div>
        </div>
      )}

      <section className="card">
        <div className="card-header">
          <h2 className="card-title">Transaction history</h2>
          <div className="field inline">
            <label htmlFor="category-filter">Filter</label>
            <select
              id="category-filter"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              data-testid="transaction-filter"
            >
              <option value="">All transactions</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{titleCase(c)}</option>
              ))}
            </select>
          </div>
        </div>
        <Alert type="error">{txns.error}</Alert>
        <table className="table" data-testid="transactions-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Description</th>
              <th>Type</th>
              <th className="num">Amount</th>
              <th className="num">Balance</th>
            </tr>
          </thead>
          <tbody>
            {txns.data?.map((t) => (
              <tr key={t.id} data-testid={`transaction-row-${t.id}`}>
                <td>{formatDate(t.posted_at)}</td>
                <td data-testid="transaction-description">{t.description}</td>
                <td><span className={`badge badge-${t.category.toLowerCase()}`}>{titleCase(t.category)}</span></td>
                <td className={`num ${t.amount < 0 ? "neg" : "pos"}`} data-testid="transaction-amount">
                  {formatSignedMoney(t.amount)}
                </td>
                <td className="num">{formatMoney(t.balance_after)}</td>
              </tr>
            ))}
            {txns.data?.length === 0 && (
              <tr>
                <td colSpan={5} className="empty-row" data-testid="no-transactions">No transactions found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
