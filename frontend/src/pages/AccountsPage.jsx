import { Link } from "react-router-dom";
import { useAuth } from "../AuthContext";
import Alert from "../components/Alert";
import { formatMoney, maskAccount, titleCase } from "../format";
import { useApi } from "../hooks";

export default function AccountsPage() {
  const { user } = useAuth();
  const { data: accounts, error, loading } = useApi("/accounts");

  const groups = ["CHECKING", "SAVINGS", "BROKERAGE"]
    .map((type) => ({ type, items: (accounts || []).filter((a) => a.account_type === type) }))
    .filter((g) => g.items.length);
  const total = (accounts || []).reduce((sum, a) => sum + a.balance, 0);
  const firstName = user.full_name.split(" ")[0];

  return (
    <div data-testid="accounts-page">
      <div className="page-header">
        <div>
          <h1 data-testid="welcome-message">Welcome back, {firstName}</h1>
          <p className="muted">Here’s a summary of your accounts.</p>
        </div>
        <div className="summary-total">
          <span className="muted">Total balance</span>
          <span className="summary-amount" data-testid="total-balance">{formatMoney(total)}</span>
        </div>
      </div>

      <Alert type="error" testId="accounts-error">{error}</Alert>
      {loading && <div className="card muted">Loading accounts…</div>}

      {groups.map((g) => (
        <section className="card" key={g.type} data-testid={`account-group-${g.type.toLowerCase()}`}>
          <h2 className="card-title">{titleCase(g.type)}</h2>
          <table className="table fixed" data-testid="accounts-table">
            <thead>
              <tr>
                <th>Account</th>
                <th>Number</th>
                <th className="num">{g.type === "BROKERAGE" ? "Cash balance" : "Available balance"}</th>
              </tr>
            </thead>
            <tbody>
              {g.items.map((a) => (
                <tr key={a.id} data-testid={`account-row-${a.id}`}>
                  <td>
                    <Link to={`/accounts/${a.id}`} className="account-link" data-testid={`account-link-${a.id}`}>
                      {a.nickname}
                    </Link>
                  </td>
                  <td className="mono" data-testid="account-number">{maskAccount(a.account_number)}</td>
                  <td className="num strong" data-testid="account-balance">{formatMoney(a.balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
    </div>
  );
}
