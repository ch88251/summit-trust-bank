import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext";
import NavBar from "./components/NavBar";
import AccountsPage from "./pages/AccountsPage";
import AccountDetailPage from "./pages/AccountDetailPage";
import LoginPage from "./pages/LoginPage";
import TradePage from "./pages/TradePage";
import TransferPayPage from "./pages/TransferPayPage";

function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <div className="page-loading" data-testid="page-loading">Loading…</div>;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return children;
}

export default function App() {
  return (
    <div className="app">
      <NavBar />
      <main className="main" data-testid="main-content">
        <Routes>
          <Route path="/" element={<Navigate to="/accounts" replace />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/accounts" element={<RequireAuth><AccountsPage /></RequireAuth>} />
          <Route path="/accounts/:accountId" element={<RequireAuth><AccountDetailPage /></RequireAuth>} />
          <Route path="/trade" element={<RequireAuth><TradePage /></RequireAuth>} />
          <Route path="/transfer-pay" element={<RequireAuth><TransferPayPage /></RequireAuth>} />
          <Route
            path="*"
            element={
              <div className="card empty-state" data-testid="not-found">
                <h2>Page not found</h2>
                <p>The page you requested doesn’t exist.</p>
              </div>
            }
          />
        </Routes>
      </main>
      <footer className="footer">
        © {new Date().getFullYear()} Summit Trust Bank · Demo application for test automation practice · Not a real bank
      </footer>
    </div>
  );
}
