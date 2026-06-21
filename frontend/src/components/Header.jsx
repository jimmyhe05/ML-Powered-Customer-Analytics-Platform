import { useState } from "react";
import { Navbar, Nav, Container } from "react-bootstrap";
import { Link, useLocation } from "react-router-dom";
import { FaBrain, FaChartLine } from "react-icons/fa";
import logo from "../assets/nuu-logo.svg";

const navigation = [
  { to: "/", label: "Analytics", icon: FaChartLine },
  { to: "/training-for-engineers", label: "Model training", icon: FaBrain },
];

export default function Header() {
  const location = useLocation();
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <Navbar
      expand="md"
      expanded={isExpanded}
      onToggle={setIsExpanded}
      className="app-navbar"
      aria-label="Primary navigation"
    >
      <Container fluid className="app-shell">
        <Navbar.Brand
          as={Link}
          to="/"
          className="app-brand"
          onClick={() => setIsExpanded(false)}
        >
          <span className="app-brand-mark" aria-hidden="true">
            <img src={logo} alt="" />
          </span>
          <span>
            <strong>Customer Intelligence</strong>
            <small>Churn analytics workspace</small>
          </span>
        </Navbar.Brand>

        <Navbar.Toggle aria-controls="primary-navigation" />

        <Navbar.Collapse id="primary-navigation">
          <Nav className="ms-auto app-nav">
            {navigation.map(({ to, label, icon: Icon }) => {
              const isActive = location.pathname === to;
              return (
                <Nav.Link
                  key={to}
                  as={Link}
                  to={to}
                  active={isActive}
                  aria-current={isActive ? "page" : undefined}
                  onClick={() => setIsExpanded(false)}
                >
                  <Icon aria-hidden="true" />
                  {label}
                </Nav.Link>
              );
            })}
          </Nav>
        </Navbar.Collapse>
      </Container>
    </Navbar>
  );
}
