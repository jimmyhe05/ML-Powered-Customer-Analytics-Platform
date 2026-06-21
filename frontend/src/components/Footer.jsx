import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer className="app-footer mt-auto">
      <div className="app-shell app-footer-inner">
        <div>
          <strong>Customer Intelligence</strong>
          <span>Built by the NuuB Team for explainable churn analysis.</span>
        </div>
        <nav aria-label="Footer navigation">
          <Link to="/privacy-policy">Privacy</Link>
          <Link to="/terms-of-service">Terms</Link>
          <Link to="/contact">Contact</Link>
        </nav>
        <small>© {new Date().getFullYear()} NUU Mobile</small>
      </div>
    </footer>
  );
}
