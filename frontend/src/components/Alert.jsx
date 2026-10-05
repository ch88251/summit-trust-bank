export default function Alert({ type = "info", children, testId, onClose }) {
  if (!children) return null;
  return (
    <div className={`alert alert-${type}`} role={type === "error" ? "alert" : "status"} data-testid={testId}>
      <div className="alert-body">{children}</div>
      {onClose && (
        <button type="button" className="alert-close" aria-label="Dismiss" onClick={onClose}>
          ×
        </button>
      )}
    </div>
  );
}
