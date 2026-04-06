import React from "react";
import { Link } from "react-router-dom";

export default function Footer() {
  const brandColor = "#c3d831"; // Nuu Mobile green color
  const hoverColor = "#d4e45c"; // Lighter green for hover
  const textColor = "#FFFFFF"; // White text for contrast

  const linkStyle = {
    color: textColor,
    textDecoration: "none",
    transition: "all 0.3s ease",
    padding: "0.5rem 1rem",
    borderRadius: "4px",
    fontWeight: "500",
  };

  const handleHover = (e) => {
    e.target.style.color = hoverColor;
    e.target.style.backgroundColor = "rgba(255, 255, 255, 0.1)";
  };

  const handleLeave = (e) => {
    e.target.style.color = textColor;
    e.target.style.backgroundColor = "transparent";
  };

  return (
    <footer className="footer bg-dark text-white py-4 mt-auto">
      <div className="container">
        <div className="row">
          <div className="col-md-4 mb-3 mb-md-0">
            <h5 className="mb-3" style={{ color: brandColor }}>
              Nuu Mobile
            </h5>
            <p className="mb-0">
              Empowering engineers with cutting-edge training solutions.
            </p>
            <p className="mt-2 mb-0" style={{ color: brandColor }}>
              Created by the NuuB Team
            </p>
          </div>
          <div className="col-md-4 mb-3 mb-md-0">
            <h5 className="mb-3" style={{ color: brandColor }}>
              Quick Links
            </h5>
            <div className="d-flex flex-column">
              <Link
                to="/"
                style={linkStyle}
                onMouseEnter={handleHover}
                onMouseLeave={handleLeave}
              >
                Dashboard
              </Link>
              <Link
                to="/Training-for-engineers"
                style={linkStyle}
                onMouseEnter={handleHover}
                onMouseLeave={handleLeave}
              >
                Training For Engineers
              </Link>
            </div>
          </div>
          <div className="col-md-4">
            <h5 className="mb-3" style={{ color: brandColor }}>
              Legal
            </h5>
            <div className="d-flex flex-column">
              <Link
                to="/privacy-policy"
                style={linkStyle}
                onMouseEnter={handleHover}
                onMouseLeave={handleLeave}
              >
                Privacy Policy
              </Link>
              <Link
                to="/terms-of-service"
                style={linkStyle}
                onMouseEnter={handleHover}
                onMouseLeave={handleLeave}
              >
                Terms of Service
              </Link>
              <Link
                to="/contact"
                style={linkStyle}
                onMouseEnter={handleHover}
                onMouseLeave={handleLeave}
              >
                Contact Us
              </Link>
            </div>
          </div>
        </div>
        <hr
          className="my-4"
          style={{ borderColor: "rgba(255, 255, 255, 0.1)" }}
        />
        <div className="row">
          <div className="col-12 text-center">
            <p className="mb-0">
              &copy; {new Date().getFullYear()} Nuu Mobile. All Rights Reserved.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
