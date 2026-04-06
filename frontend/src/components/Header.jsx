import React, { useState } from "react";
import { Navbar, Nav, Container } from "react-bootstrap";
import { useLocation } from "react-router-dom";
import logo from "../assets/nuu-logo.svg";

const Header = () => {
  const location = useLocation();
  const [isExpanded, setIsExpanded] = useState(false);

  const brandColor = "#c3d831"; // Nuu Mobile green color
  const hoverColor = "#d4e45c"; // Lighter green for hover
  const textColor = "#FFFFFF"; // White text for contrast

  const linkStyle = {
    color: textColor,
    transition: "all 0.3s ease",
    padding: "0.5rem 1rem",
    borderRadius: "4px",
    margin: "0 0.2rem",
    fontWeight: "500",
  };

  const activeLinkStyle = {
    ...linkStyle,
    backgroundColor: brandColor,
    color: textColor,
  };

  const handleHover = (e) => {
    if (!e.target.classList.contains("active")) {
      e.target.style.color = hoverColor;
      e.target.style.backgroundColor = "rgba(255, 255, 255, 0.1)";
    }
  };

  const handleLeave = (e) => {
    if (!e.target.classList.contains("active")) {
      e.target.style.color = textColor;
      e.target.style.backgroundColor = "transparent";
    }
  };

  return (
    <Navbar
      bg="dark"
      variant="dark"
      expand="md"
      expanded={isExpanded}
      onToggle={() => setIsExpanded(!isExpanded)}
      className="shadow-sm"
    >
      <Container fluid>
        <Navbar.Brand href="/" className="d-flex align-items-center">
          <img
            src={logo}
            style={{
              width: "50px",
              height: "30px",
              borderRadius: "15%",
              transition: "transform 0.3s ease",
            }}
            alt="Nuu Mobile Logo"
            className="hover-scale"
          />
        </Navbar.Brand>

        <Navbar.Toggle
          style={{
            border: "none",
            backgroundColor: brandColor,
            boxShadow: "none",
            padding: "0.5rem",
          }}
        />

        <Navbar.Collapse>
          <Nav className="ms-auto">
            <Nav.Link
              href="/Training-for-engineers"
              style={
                location.pathname === "/Training-for-engineers"
                  ? activeLinkStyle
                  : linkStyle
              }
              onMouseEnter={handleHover}
              onMouseLeave={handleLeave}
              className={
                location.pathname === "/Training-for-engineers" ? "active" : ""
              }
            >
              Training For Engineers
            </Nav.Link>
            <Nav.Link
              href="/"
              style={location.pathname === "/" ? activeLinkStyle : linkStyle}
              onMouseEnter={handleHover}
              onMouseLeave={handleLeave}
              className={location.pathname === "/" ? "active" : ""}
            >
              Dashboard
            </Nav.Link>
            {/* <Nav.Link
              href="/predictions"
              style={linkStyle}
              onMouseEnter={handleHover}
              onMouseLeave={handleLeave}
            >
              Predictions
            </Nav.Link> */}
            {/* <Nav.Link
              href="/settings"
              style={linkStyle}
              onMouseEnter={handleHover}
              onMouseLeave={handleLeave}
            >
              Settings
            </Nav.Link> */}
          </Nav>
        </Navbar.Collapse>
      </Container>
    </Navbar>
  );
};

export default Header;
