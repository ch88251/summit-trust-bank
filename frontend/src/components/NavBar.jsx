import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../AuthContext";
import { initials } from "../format";

const MENU = [
  { to: "/accounts", label: "Accounts", testId: "nav-accounts" },
  { to: "/trade", label: "Trade", testId: "nav-trade" },
  { to: "/transfer-pay", label: "Transfer & Pay", testId: "nav-transfer-pay" },
];

function ProfileMenu() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const close = (e) => {
      if (!ref.current?.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!user) {
    return (
      <Link to="/login" className="btn btn-gold btn-sm" data-testid="nav-login">
        Log In
      </Link>
    );
  }

  const handleLogout = async () => {
    setOpen(false);
    await logout();
    navigate("/login", { state: { loggedOut: true } });
  };

  return (
    <div className="profile" ref={ref}>
      <button
        type="button"
        className="profile-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        data-testid="profile-menu-button"
      >
        <span className="avatar" aria-hidden="true">{initials(user.full_name)}</span>
        <span className="profile-name" data-testid="profile-name">{user.full_name}</span>
        <span className={`caret ${open ? "up" : ""}`} aria-hidden="true">▾</span>
      </button>
      {open && (
        <div className="profile-dropdown" role="menu" data-testid="profile-dropdown">
          <div className="profile-summary">
            <div className="profile-summary-name">{user.full_name}</div>
            <div className="profile-summary-email" data-testid="profile-email">{user.email}</div>
            <div className="profile-summary-user">User ID: {user.username}</div>
          </div>
          <button type="button" role="menuitem" className="dropdown-item" onClick={handleLogout} data-testid="nav-logout">
            Log Out
          </button>
        </div>
      )}
    </div>
  );
}

export default function NavBar() {
  return (
    <header className="topbar">
      <div className="topbar-inner">
        <Link to="/" className="brand" data-testid="brand-logo">
          <svg className="brand-mark" viewBox="0 0 32 32" aria-hidden="true">
            <rect width="32" height="32" rx="6" fill="#c9a227" />
            <path d="M6 22 L13 10 L18 17 L21 13 L26 22 Z" fill="#0b2545" />
          </svg>
          <span className="brand-text">
            Summit <strong>Trust Bank</strong>
          </span>
        </Link>
        <nav className="menu" aria-label="Main menu" data-testid="main-menu">
          {MENU.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `menu-link ${isActive ? "active" : ""}`}
              data-testid={item.testId}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <ProfileMenu />
      </div>
    </header>
  );
}
