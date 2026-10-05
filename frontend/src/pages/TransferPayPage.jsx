import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../api";
import Alert from "../components/Alert";
import { accountLabel, formatDateTime, formatMoney, formatSignedMoney, maskAccount } from "../format";
import { useApi } from "../hooks";

const TABS = [
  { id: "transfer", label: "Transfer Funds" },
  { id: "deposit", label: "Deposit & Withdraw" },
  { id: "pay", label: "Pay Bills" },
  { id: "payees", label: "Manage Payees" },
];

/** Validates a dollar amount string; returns an error message or "". */
function amountError(value, available) {
  if (!value) return "Please enter an amount.";
  if (!/^\d+(\.\d{1,2})?$/.test(value)) return "Enter a valid amount (up to 2 decimal places).";
  const n = Number(value);
  if (n <= 0) return "Amount must be greater than $0.00.";
  if (available !== undefined && n > available) return "Amount exceeds the available balance.";
  return "";
}

function AccountSelect({ id, label, accounts, value, onChange, testId, exclude }) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <select id={id} value={value} onChange={onChange} data-testid={testId}>
        <option value="">Select an account</option>
        {accounts
          .filter((a) => a.id !== exclude)
          .map((a) => (
            <option key={a.id} value={a.id}>
              {accountLabel(a)} — {formatMoney(a.balance)}
            </option>
          ))}
      </select>
    </div>
  );
}

function TransferTab({ accounts, onDone }) {
  const empty = { from: "", to: "", amount: "", memo: "" };
  const [form, setForm] = useState(empty);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const history = useApi("/transfers");

  const fromAcct = accounts.find((a) => a.id === Number(form.from));
  const set = (field) => (e) => {
    setForm((f) => ({ ...f, [field]: e.target.value }));
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSuccess(null);
    if (!form.from || !form.to) return setError("Please select both a From and To account.");
    if (form.from === form.to) return setError("From and To accounts must be different.");
    const msg = amountError(form.amount, fromAcct?.balance);
    if (msg) return setError(msg);

    setSubmitting(true);
    try {
      const t = await api("/transfers", {
        method: "POST",
        body: {
          from_account_id: Number(form.from),
          to_account_id: Number(form.to),
          amount: form.amount,
          memo: form.memo.trim() || null,
        },
      });
      setSuccess(t);
      setForm(empty);
      history.reload();
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const nameOf = (id) => {
    const a = accounts.find((x) => x.id === id);
    return a ? accountLabel(a) : `#${id}`;
  };

  return (
    <div className="grid-2" data-testid="transfer-tab">
      <section className="card">
        <h2 className="card-title">Transfer between your accounts</h2>
        <Alert type="error" testId="transfer-error">{error}</Alert>
        {success && (
          <Alert type="success" testId="transfer-success" onClose={() => setSuccess(null)}>
            Transfer of {formatMoney(success.amount)} completed.
            <div className="confirmation">Confirmation #: <span data-testid="transfer-confirmation">{success.confirmation_number}</span></div>
          </Alert>
        )}
        <form onSubmit={handleSubmit} noValidate data-testid="transfer-form">
          <AccountSelect id="transfer-from" label="From" accounts={accounts} value={form.from} onChange={set("from")} testId="transfer-from" />
          <AccountSelect id="transfer-to" label="To" accounts={accounts} value={form.to} onChange={set("to")} testId="transfer-to" exclude={Number(form.from)} />
          <div className="field">
            <label htmlFor="transfer-amount">Amount</label>
            <div className="input-prefix">
              <span>$</span>
              <input id="transfer-amount" inputMode="decimal" placeholder="0.00" value={form.amount} onChange={set("amount")} data-testid="transfer-amount" />
            </div>
          </div>
          <div className="field">
            <label htmlFor="transfer-memo">Memo <span className="muted">(optional)</span></label>
            <input id="transfer-memo" maxLength={100} value={form.memo} onChange={set("memo")} data-testid="transfer-memo" />
          </div>
          <button type="submit" className="btn btn-primary btn-block" disabled={submitting} data-testid="transfer-submit">
            {submitting ? "Processing…" : "Transfer Now"}
          </button>
        </form>
      </section>

      <section className="card">
        <h2 className="card-title">Recent transfers</h2>
        <table className="table compact" data-testid="transfers-table">
          <thead>
            <tr><th>Date</th><th>From → To</th><th className="num">Amount</th></tr>
          </thead>
          <tbody>
            {history.data?.map((t) => (
              <tr key={t.id} data-testid={`transfer-row-${t.confirmation_number}`}>
                <td>{formatDateTime(t.created_at)}</td>
                <td>
                  <div>{nameOf(t.from_account_id)}</div>
                  <div className="muted small">→ {nameOf(t.to_account_id)}</div>
                </td>
                <td className="num strong">{formatMoney(t.amount)}</td>
              </tr>
            ))}
            {history.data?.length === 0 && <tr><td colSpan={3} className="empty-row">No transfers yet.</td></tr>}
          </tbody>
        </table>
      </section>
    </div>
  );
}

const MAX_DEPOSIT = 10000;

function DepositWithdrawTab({ accounts, initialAccountId, onDone }) {
  const cashAccounts = accounts.filter((a) => a.account_type === "CHECKING" || a.account_type === "SAVINGS");
  const preselected = cashAccounts.some((a) => String(a.id) === initialAccountId) ? initialAccountId : "";
  const empty = { account: preselected, type: "DEPOSIT", amount: "", memo: "" };
  const [form, setForm] = useState(empty);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const history = useApi("/cash-transactions");

  const acct = cashAccounts.find((a) => a.id === Number(form.account));
  const isDeposit = form.type === "DEPOSIT";
  const set = (field) => (e) => {
    setForm((f) => ({ ...f, [field]: e.target.value }));
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSuccess(null);
    if (!form.account) return setError("Please select an account.");
    const msg = amountError(form.amount, isDeposit ? undefined : acct?.balance);
    if (msg) return setError(msg);
    if (isDeposit && Number(form.amount) > MAX_DEPOSIT) {
      return setError(`Deposits are limited to ${formatMoney(MAX_DEPOSIT)} per transaction.`);
    }

    setSubmitting(true);
    try {
      const t = await api("/cash-transactions", {
        method: "POST",
        body: {
          account_id: Number(form.account),
          type: form.type,
          amount: form.amount,
          memo: form.memo.trim() || null,
        },
      });
      setSuccess(t);
      setForm({ ...empty, account: form.account, type: form.type });
      history.reload();
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const nameOf = (id) => {
    const a = accounts.find((x) => x.id === id);
    return a ? accountLabel(a) : `#${id}`;
  };

  return (
    <div className="grid-2" data-testid="deposit-tab">
      <section className="card">
        <h2 className="card-title">Deposit or withdraw funds</h2>
        <Alert type="error" testId="cash-error">{error}</Alert>
        {success && (
          <Alert type="success" testId="cash-success" onClose={() => setSuccess(null)}>
            {success.type === "DEPOSIT" ? "Deposit" : "Withdrawal"} of {formatMoney(success.amount)}{" "}
            {success.type === "DEPOSIT" ? "to" : "from"} {nameOf(success.account_id)} completed.
            <div className="confirmation">Confirmation #: <span data-testid="cash-confirmation">{success.confirmation_number}</span></div>
          </Alert>
        )}
        <form onSubmit={handleSubmit} noValidate data-testid="cash-form">
          <div className="field">
            <span className="label">Transaction type</span>
            <div className="segmented" role="radiogroup">
              {[["DEPOSIT", "Deposit", "buy"], ["WITHDRAWAL", "Withdraw", "sell"]].map(([value, label, tone]) => (
                <label key={value} className={`segment ${form.type === value ? `active ${tone}` : ""}`}>
                  <input
                    type="radio"
                    name="cash-type"
                    value={value}
                    checked={form.type === value}
                    onChange={set("type")}
                    data-testid={`cash-type-${value.toLowerCase()}`}
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>
          <AccountSelect
            id="cash-account"
            label={isDeposit ? "Deposit to" : "Withdraw from"}
            accounts={cashAccounts}
            value={form.account}
            onChange={set("account")}
            testId="cash-account"
          />
          <div className="field">
            <label htmlFor="cash-amount">Amount</label>
            <div className="input-prefix">
              <span>$</span>
              <input id="cash-amount" inputMode="decimal" placeholder="0.00" value={form.amount} onChange={set("amount")} data-testid="cash-amount" />
            </div>
            <small className="muted">
              {isDeposit
                ? `Maximum ${formatMoney(MAX_DEPOSIT)} per deposit.`
                : acct
                  ? `Available balance: ${formatMoney(acct.balance)}`
                  : "Withdrawals cannot exceed the available balance."}
            </small>
          </div>
          <div className="field">
            <label htmlFor="cash-memo">Memo <span className="muted">(optional)</span></label>
            <input id="cash-memo" maxLength={100} value={form.memo} onChange={set("memo")} data-testid="cash-memo" />
          </div>
          <button type="submit" className="btn btn-primary btn-block" disabled={submitting} data-testid="cash-submit">
            {submitting ? "Processing…" : isDeposit ? "Deposit Funds" : "Withdraw Funds"}
          </button>
        </form>
      </section>

      <section className="card">
        <h2 className="card-title">Recent deposits &amp; withdrawals</h2>
        <table className="table compact" data-testid="cash-table">
          <thead>
            <tr><th>Date</th><th>Account</th><th className="num">Amount</th></tr>
          </thead>
          <tbody>
            {history.data?.map((t) => (
              <tr key={t.id} data-testid={`cash-row-${t.confirmation_number}`}>
                <td>{formatDateTime(t.created_at)}</td>
                <td>
                  <div>{nameOf(t.account_id)}</div>
                  <div className="muted small">{t.type === "DEPOSIT" ? "Deposit" : "Withdrawal"}</div>
                </td>
                <td className={`num strong ${t.type === "DEPOSIT" ? "pos" : "neg"}`}>
                  {formatSignedMoney(t.type === "DEPOSIT" ? t.amount : -t.amount)}
                </td>
              </tr>
            ))}
            {history.data?.length === 0 && <tr><td colSpan={3} className="empty-row">No deposits or withdrawals yet.</td></tr>}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function PayTab({ accounts, payees, onDone }) {
  const empty = { from: "", payee: "", amount: "", memo: "" };
  const [form, setForm] = useState(empty);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const history = useApi("/payments");
  const payFrom = accounts.filter((a) => a.account_type !== "BROKERAGE");
  const fromAcct = payFrom.find((a) => a.id === Number(form.from));

  const set = (field) => (e) => {
    setForm((f) => ({ ...f, [field]: e.target.value }));
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSuccess(null);
    if (!form.from) return setError("Please select an account to pay from.");
    if (!form.payee) return setError("Please select a payee.");
    const msg = amountError(form.amount, fromAcct?.balance);
    if (msg) return setError(msg);

    setSubmitting(true);
    try {
      const p = await api("/payments", {
        method: "POST",
        body: {
          from_account_id: Number(form.from),
          payee_id: Number(form.payee),
          amount: form.amount,
          memo: form.memo.trim() || null,
        },
      });
      setSuccess(p);
      setForm(empty);
      history.reload();
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="grid-2" data-testid="pay-tab">
      <section className="card">
        <h2 className="card-title">Pay a bill</h2>
        <Alert type="error" testId="payment-error">{error}</Alert>
        {success && (
          <Alert type="success" testId="payment-success" onClose={() => setSuccess(null)}>
            Payment of {formatMoney(success.amount)} to {success.payee_name} sent.
            <div className="confirmation">Confirmation #: <span data-testid="payment-confirmation">{success.confirmation_number}</span></div>
          </Alert>
        )}
        {payees.length === 0 ? (
          <p className="muted" data-testid="no-payees-message">You have no payees. Add one under “Manage Payees”.</p>
        ) : (
          <form onSubmit={handleSubmit} noValidate data-testid="payment-form">
            <AccountSelect id="payment-from" label="Pay from" accounts={payFrom} value={form.from} onChange={set("from")} testId="payment-from" />
            <div className="field">
              <label htmlFor="payment-payee">Payee</label>
              <select id="payment-payee" value={form.payee} onChange={set("payee")} data-testid="payment-payee">
                <option value="">Select a payee</option>
                {payees.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} ({maskAccount(p.account_number)})</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="payment-amount">Amount</label>
              <div className="input-prefix">
                <span>$</span>
                <input id="payment-amount" inputMode="decimal" placeholder="0.00" value={form.amount} onChange={set("amount")} data-testid="payment-amount" />
              </div>
            </div>
            <div className="field">
              <label htmlFor="payment-memo">Memo <span className="muted">(optional)</span></label>
              <input id="payment-memo" maxLength={100} value={form.memo} onChange={set("memo")} data-testid="payment-memo" />
            </div>
            <button type="submit" className="btn btn-primary btn-block" disabled={submitting} data-testid="payment-submit">
              {submitting ? "Processing…" : "Pay Now"}
            </button>
          </form>
        )}
      </section>

      <section className="card">
        <h2 className="card-title">Recent payments</h2>
        <table className="table compact" data-testid="payments-table">
          <thead>
            <tr><th>Date</th><th>Payee</th><th className="num">Amount</th></tr>
          </thead>
          <tbody>
            {history.data?.map((p) => (
              <tr key={p.id} data-testid={`payment-row-${p.confirmation_number}`}>
                <td>{formatDateTime(p.created_at)}</td>
                <td>{p.payee_name}</td>
                <td className="num strong">{formatMoney(p.amount)}</td>
              </tr>
            ))}
            {history.data?.length === 0 && <tr><td colSpan={3} className="empty-row">No payments yet.</td></tr>}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function PayeesTab({ payees, onChange }) {
  const empty = { name: "", account_number: "", nickname: "" };
  const [form, setForm] = useState(empty);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(null);

  const set = (field) => (e) => {
    setForm((f) => ({ ...f, [field]: e.target.value }));
    setError("");
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    setSuccess("");
    if (!form.name.trim()) return setError("Payee name is required.");
    if (!/^\d{4,17}$/.test(form.account_number)) return setError("Account number must be 4–17 digits.");
    try {
      const p = await api("/payees", {
        method: "POST",
        body: { name: form.name.trim(), account_number: form.account_number, nickname: form.nickname.trim() || null },
      });
      setSuccess(`Payee “${p.name}” added.`);
      setForm(empty);
      onChange();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDelete = async (payee) => {
    setConfirmDelete(null);
    setSuccess("");
    try {
      await api(`/payees/${payee.id}`, { method: "DELETE" });
      setSuccess(`Payee “${payee.name}” removed.`);
      onChange();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="grid-2" data-testid="payees-tab">
      <section className="card">
        <h2 className="card-title">Your payees</h2>
        <Alert type="success" testId="payee-success" onClose={() => setSuccess("")}>{success}</Alert>
        <table className="table compact" data-testid="payees-table">
          <thead>
            <tr><th>Name</th><th>Account</th><th></th></tr>
          </thead>
          <tbody>
            {payees.map((p) => (
              <tr key={p.id} data-testid={`payee-row-${p.id}`}>
                <td>
                  <div className="strong" data-testid="payee-name">{p.name}</div>
                  {p.nickname && <div className="muted small">{p.nickname}</div>}
                </td>
                <td className="mono">{maskAccount(p.account_number)}</td>
                <td className="num">
                  {confirmDelete === p.id ? (
                    <span className="inline-confirm">
                      Remove?{" "}
                      <button type="button" className="link-btn danger" onClick={() => handleDelete(p)} data-testid={`payee-delete-confirm-${p.id}`}>Yes</button>
                      <button type="button" className="link-btn" onClick={() => setConfirmDelete(null)} data-testid={`payee-delete-cancel-${p.id}`}>No</button>
                    </span>
                  ) : (
                    <button type="button" className="link-btn danger" onClick={() => setConfirmDelete(p.id)} data-testid={`payee-delete-${p.id}`}>
                      Remove
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {payees.length === 0 && <tr><td colSpan={3} className="empty-row">No payees yet.</td></tr>}
          </tbody>
        </table>
      </section>

      <section className="card">
        <h2 className="card-title">Add a payee</h2>
        <Alert type="error" testId="payee-error">{error}</Alert>
        <form onSubmit={handleAdd} noValidate data-testid="payee-form">
          <div className="field">
            <label htmlFor="payee-name">Payee name</label>
            <input id="payee-name" maxLength={100} value={form.name} onChange={set("name")} data-testid="payee-name-input" />
          </div>
          <div className="field">
            <label htmlFor="payee-account">Account number</label>
            <input id="payee-account" inputMode="numeric" maxLength={17} value={form.account_number} onChange={set("account_number")} data-testid="payee-account-input" />
          </div>
          <div className="field">
            <label htmlFor="payee-nickname">Nickname <span className="muted">(optional)</span></label>
            <input id="payee-nickname" maxLength={100} value={form.nickname} onChange={set("nickname")} data-testid="payee-nickname-input" />
          </div>
          <button type="submit" className="btn btn-primary btn-block" data-testid="payee-submit">Add Payee</button>
        </form>
      </section>
    </div>
  );
}

export default function TransferPayPage() {
  const [params, setParams] = useSearchParams();
  const tab = TABS.some((t) => t.id === params.get("tab")) ? params.get("tab") : "transfer";
  const accounts = useApi("/accounts");
  const payees = useApi("/payees");

  return (
    <div data-testid="transfer-pay-page">
      <div className="page-header">
        <div>
          <h1>Transfer &amp; Pay</h1>
          <p className="muted">Move money between your accounts, deposit or withdraw funds, and pay your bills.</p>
        </div>
      </div>

      <div className="tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={`tab ${tab === t.id ? "active" : ""}`}
            onClick={() => setParams({ tab: t.id })}
            data-testid={`tab-${t.id}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <Alert type="error">{accounts.error || payees.error}</Alert>
      {accounts.data && payees.data && (
        <>
          {tab === "transfer" && <TransferTab accounts={accounts.data} onDone={accounts.reload} />}
          {tab === "deposit" && (
            <DepositWithdrawTab accounts={accounts.data} initialAccountId={params.get("account")} onDone={accounts.reload} />
          )}
          {tab === "pay" && <PayTab accounts={accounts.data} payees={payees.data} onDone={accounts.reload} />}
          {tab === "payees" && <PayeesTab payees={payees.data} onChange={payees.reload} />}
        </>
      )}
    </div>
  );
}
