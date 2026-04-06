import { useState, useMemo, useRef, useEffect } from "react";
import {
  Container,
  Row,
  Col,
  Card,
  Table,
  Button,
  Badge,
  Dropdown,
  Form,
  InputGroup,
} from "react-bootstrap";
import { useLocation, useParams, useNavigate } from "react-router-dom";
import { Pie } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";
import {
  FaArrowLeft,
  FaFileAlt,
  FaExclamationTriangle,
  FaUsers,
  FaSync,
  FaDownload,
  FaFileCsv,
  FaSearch,
  FaFilter,
} from "react-icons/fa";

// Register the components required for the Pie chart
ChartJS.register(ArcElement, Tooltip, Legend);

// Define a consistent color scheme
const COLORS = {
  primary: "#2c3e50",
  secondary: "#34495e",
  accent: "#3498db",
  success: "#2ecc71",
  warning: "#f1c40f",
  danger: "#e74c3c",
  light: "#ecf0f1",
  dark: "#2c3e50",
};

export default function Predictions() {
  const location = useLocation();
  const { fileName } = useParams();
  const navigate = useNavigate();
  const predictionResultsRef = useRef(null);
  const { predictions, modelType } = location.state || {
    predictions: [],
    modelType: "xgboost",
  };

  // Add useEffect for scrolling to top of page
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Add useEffect for auto-scrolling to prediction results
  useEffect(() => {
    if (predictionResultsRef.current) {
      predictionResultsRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, []);

  // Scroll to first non-risky customer
  const scrollToSplit = () => {
    const tableContainer = document.querySelector(
      '[style*="overflow-y: auto"]'
    );
    const splitElement = document
      .querySelector(".progress-bar.bg-success")
      ?.closest("tr");

    if (splitElement && tableContainer) {
      const headerHeight = 56; // Height of the sticky header
      const elementTop = splitElement.offsetTop - headerHeight;
      tableContainer.scrollTo({
        top: elementTop,
        behavior: "smooth",
      });

      // Add a temporary highlight effect
      splitElement.style.transition = "background-color 0.5s";
      splitElement.style.backgroundColor = "#e8f4f8";
      setTimeout(() => {
        splitElement.style.backgroundColor = "";
      }, 1500);
    }
  };

  // State for risk threshold (default: 50%)
  const [riskThreshold, setRiskThreshold] = useState(() => {
    const stored = localStorage.getItem("riskThreshold");
    return stored ? parseInt(stored) : 50;
  });

  // Filter risky customers based on the current threshold
  const riskyCustomers = predictions.filter(
    (p) => p.churn_probability > riskThreshold / 100
  );

  // Data for the pie chart
  const pieData = {
    labels: ["Churn", "Non-Churn"],
    datasets: [
      {
        data: [
          predictions.filter((p) => p.churn_probability > riskThreshold / 100)
            .length,
          predictions.filter((p) => p.churn_probability <= riskThreshold / 100)
            .length,
        ],
        backgroundColor: [
          COLORS.danger,
          modelType === "xgboost" ? COLORS.accent : COLORS.success,
        ],
        borderWidth: 0,
      },
    ],
  };

  // Handle slider and input changes
  const handleThresholdChange = (e) => {
    const value = Math.min(100, Math.max(0, e.target.value));
    setRiskThreshold(value);
    localStorage.setItem("riskThreshold", value.toString());
  };

  // Handle threshold reset
  const handleResetThreshold = () => {
    setRiskThreshold(50);
    localStorage.setItem("riskThreshold", "50");
  };

  // Calculate statistics
  const totalCustomers = predictions.length;
  const riskRate = ((riskyCustomers.length / totalCustomers) * 100).toFixed(1);

  // Handle export to CSV
  const handleExportCSV = () => {
    // Create CSV content
    const headers = [
      "Customer Number",
      "Device Number",
      "Churn Probability",
      "Risk Status",
    ];
    const csvContent = [
      headers.join(","),
      ...predictions.map((p) => {
        const isRisky = p.churn_probability > riskThreshold / 100;
        return [
          p.customer_number,
          p["device number"],
          (p.churn_probability * 100).toFixed(2) + "%",
          isRisky ? "High Risk" : "Low Risk",
        ].join(",");
      }),
    ].join("\n");

    // Create and trigger download
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `${fileName.replace(/\.[^/.]+$/, "")}_predictions.csv`
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Add state for search and filter
  const [searchTerm, setSearchTerm] = useState("");
  const [filterRisk, setFilterRisk] = useState("all"); // "all", "high", "low"

  // Filtered predictions based on search and filter
  const filteredPredictions = useMemo(() => {
    return predictions
      .filter((prediction) => {
        // Apply search filter
        const searchLower = searchTerm.toLowerCase();
        const matchesSearch =
          prediction.customer_number.toString().includes(searchLower) ||
          prediction["device number"].toString().includes(searchLower);

        // Apply risk filter
        const isRisky = prediction.churn_probability > riskThreshold / 100;
        const matchesRiskFilter =
          filterRisk === "all" ||
          (filterRisk === "high" && isRisky) ||
          (filterRisk === "low" && !isRisky);

        return matchesSearch && matchesRiskFilter;
      })
      .sort((a, b) => b.churn_probability - a.churn_probability);
  }, [predictions, searchTerm, filterRisk, riskThreshold]);

  return (
    <Container fluid className="mt-4">
      <div
        className="d-flex justify-content-between align-items-center mb-4"
        ref={predictionResultsRef}
      >
        <div className="d-flex gap-2">
          <Button
            variant="outline-secondary"
            onClick={() => navigate("/")}
            className="d-flex align-items-center gap-2"
          >
            <FaArrowLeft /> Back to Dashboard
          </Button>
          <Button
            variant="outline-secondary"
            onClick={handleResetThreshold}
            className="d-flex align-items-center gap-2"
          >
            <FaSync /> Reset Threshold
          </Button>
        </div>
        <div className="d-flex align-items-center gap-3">
          <h1 className="mb-0">Prediction Results</h1>
          <Dropdown>
            <Dropdown.Toggle
              variant="outline-primary"
              id="export-dropdown"
              className="d-flex align-items-center gap-2"
            >
              <FaDownload /> Export
            </Dropdown.Toggle>
            <Dropdown.Menu>
              <Dropdown.Item onClick={handleExportCSV}>
                <FaFileCsv className="me-2" /> Export as CSV
              </Dropdown.Item>
            </Dropdown.Menu>
          </Dropdown>
        </div>
      </div>

      <Row>
        <Col md={4}>
          <Card className="shadow p-4 mb-4 sticky-top" style={{ top: "1rem" }}>
            <div className="d-flex flex-column gap-4">
              {/* File Name */}
              <div className="d-flex align-items-center">
                <FaFileAlt className="text-primary fs-4 me-3" />
                <div>
                  <h6 className="text-muted mb-1">File Name</h6>
                  <h5 className="mb-0">{fileName}</h5>
                </div>
              </div>

              {/* Risky Customers */}
              <div className="d-flex align-items-center">
                <FaExclamationTriangle className="text-danger fs-4 me-3" />
                <div>
                  <h6 className="text-muted mb-1">Risky Customers</h6>
                  <div className="d-flex flex-column gap-1">
                    <div className="d-flex align-items-center gap-2">
                      <h5 className="mb-0 text-danger">
                        {riskyCustomers.length}
                      </h5>
                      <Badge
                        bg={
                          riskRate > 10
                            ? "danger"
                            : riskRate > 5
                              ? "warning"
                              : "success"
                        }
                        className="fs-6"
                      >
                        {riskRate}%
                      </Badge>
                    </div>
                    <small className="text-muted">
                      {riskyCustomers.length} of{" "}
                      {totalCustomers.toLocaleString()} customers exceed{" "}
                      {riskThreshold}% threshold
                    </small>
                  </div>
                </div>
              </div>

              {/* Total Customers */}
              <div className="d-flex align-items-center">
                <FaUsers
                  className={`fs-4 me-3 ${modelType === "xgboost" ? "text-primary" : "text-success"
                    }`}
                />
                <div>
                  <h6 className="text-muted mb-1">Total Customers</h6>
                  <h5 className="mb-0">{totalCustomers.toLocaleString()}</h5>
                </div>
              </div>

              {/* Risk Threshold Slider */}
              <div>
                <h6 className="text-muted mb-3">Risk Threshold</h6>
                <div className="d-flex align-items-center gap-3 flex-wrap">
                  <input
                    type="range"
                    className="form-range flex-grow-1"
                    id="riskThreshold"
                    min="0"
                    max="100"
                    value={riskThreshold}
                    onChange={handleThresholdChange}
                    style={{ minWidth: "150px" }} // Ensure the slider is not too small
                  />
                  <div
                    className="input-group"
                    style={{ width: "120px", flexShrink: 0 }}
                  >
                    <input
                      type="number"
                      className="form-control"
                      min="0"
                      max="100"
                      value={riskThreshold}
                      onChange={handleThresholdChange}
                      style={{ textAlign: "center" }} // Center-align the number
                    />
                    <span className="input-group-text">%</span>
                  </div>
                </div>
              </div>

              {/* Pie Chart */}
              <div className="text-center">
                <h6 className="text-muted mb-3">Churn Distribution</h6>
                <div className="d-flex align-items-center justify-content-center gap-4">
                  <div
                    style={{ height: "150px", width: "150px", flexShrink: 0 }}
                  >
                    <Pie
                      data={pieData}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                          legend: {
                            display: false, // Hide default legend
                          },
                        },
                      }}
                    />
                  </div>
                  <div className="d-flex flex-column gap-2">
                    <div className="d-flex align-items-center gap-2">
                      <div
                        style={{
                          width: "16px",
                          height: "16px",
                          backgroundColor: COLORS.danger,
                          borderRadius: "4px",
                        }}
                      />
                      <span style={{ fontSize: "0.9rem" }}>Churn</span>
                    </div>
                    <div className="d-flex align-items-center gap-2">
                      <div
                        style={{
                          width: "16px",
                          height: "16px",
                          backgroundColor:
                            modelType === "xgboost"
                              ? COLORS.accent
                              : COLORS.success,
                          borderRadius: "4px",
                        }}
                      />
                      <span style={{ fontSize: "0.9rem" }}>Non-Churn</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </Col>

        <Col md={8}>
          <Card className="shadow h-100" style={{ position: "relative" }}>
            <Card.Header className="bg-white py-3">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <h5 className="mb-1">Customer Predictions</h5>
                  <p className="text-muted small mb-0">
                    Detailed churn probability for each customer
                  </p>
                </div>
                <Badge bg="primary" className="fs-6">
                  {filteredPredictions.length.toLocaleString()} Records
                </Badge>
              </div>
            </Card.Header>

            {/* Add search and filter controls */}
            <div className="p-3 border-bottom">
              <Row className="g-3">
                <Col md={6}>
                  <InputGroup>
                    <InputGroup.Text>
                      <FaSearch />
                    </InputGroup.Text>
                    <Form.Control
                      placeholder="Search by customer or device number..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </InputGroup>
                </Col>
                <Col md={6}>
                  <InputGroup>
                    <InputGroup.Text>
                      <FaFilter />
                    </InputGroup.Text>
                    <Form.Select
                      value={filterRisk}
                      onChange={(e) => setFilterRisk(e.target.value)}
                    >
                      <option value="all">All Customers</option>
                      <option value="high">High Risk Only</option>
                      <option value="low">Low Risk Only</option>
                    </Form.Select>
                  </InputGroup>
                </Col>
              </Row>
            </div>

            <div
              id="customer-predictions-container"
              style={{
                height: "calc(100vh - 240px)",
                overflowY: "auto",
                position: "relative",
              }}
            >
              <Table responsive hover className="align-middle mb-0">
                <thead
                  style={{
                    position: "sticky",
                    top: 0,
                    backgroundColor: "white",
                    zIndex: 1,
                  }}
                >
                  <tr className="bg-light">
                    <th className="py-3">Customer Number</th>
                    <th className="py-3">Device Number</th>
                    <th className="py-3">Churn Probability</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPredictions.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="text-center py-5">
                        <div className="text-muted">
                          <FaSearch className="mb-3" size={32} />
                          <p>No matching results found</p>
                          <small>
                            Try adjusting your search or filter criteria
                          </small>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredPredictions.map((prediction, index) => (
                      <tr
                        key={index}
                        className={
                          prediction.churn_probability > riskThreshold / 100
                            ? "table-danger"
                            : ""
                        }
                      >
                        <td>{prediction.customer_number}</td>
                        <td>{prediction["device number"]}</td>
                        <td>
                          <div className="d-flex align-items-center gap-2">
                            <div
                              className="progress flex-grow-1"
                              style={{ height: "8px" }}
                            >
                              <div
                                className={`progress-bar ${prediction.churn_probability >
                                  riskThreshold / 100
                                  ? "bg-danger"
                                  : "bg-success"
                                  }`}
                                role="progressbar"
                                style={{
                                  width: `${prediction.churn_probability * 100
                                    }%`,
                                }}
                              />
                            </div>
                            <span
                              className={`fw-bold ${prediction.churn_probability >
                                riskThreshold / 100
                                ? "text-danger"
                                : "text-success"
                                }`}
                              style={{ minWidth: "45px", textAlign: "right" }}
                            >
                              {(prediction.churn_probability * 100).toFixed(1)}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </Table>
            </div>

            {/* Move buttons outside the scrollable container but keep them inside the Card */}
            <div
              style={{
                position: "absolute",
                bottom: "3rem", // Changed from 1rem to 3rem to move buttons higher
                right: "1rem",
                display: "flex",
                flexDirection: "column",
                gap: "0.5rem",
                zIndex: 10, // Ensure buttons appear above the scrollable content
              }}
            >
              {/* Go to Top button */}
              <Button
                variant="primary"
                onClick={() => {
                  const container = document.getElementById(
                    "customer-predictions-container"
                  );
                  container.scrollTo({ top: 0, behavior: "smooth" });
                }}
                title="Go to Top of the Table"
                style={{
                  borderRadius: "50%",
                  width: "3rem",
                  height: "3rem",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 2px 5px rgba(0,0,0,0.2)",
                  transition: "transform 0.2s",
                }}
                onMouseOver={(e) =>
                  (e.currentTarget.style.transform = "translateY(-2px)")
                }
                onMouseOut={(e) =>
                  (e.currentTarget.style.transform = "translateY(0)")
                }
              >
                <FaArrowLeft
                  style={{
                    fontSize: "1.2rem",
                    transform: "rotate(90deg)",
                  }}
                />
              </Button>

              {/* Jump to Split button */}
              <Button
                variant="info"
                onClick={scrollToSplit}
                title="Jump to First Non-Risky Customer"
                style={{
                  borderRadius: "50%",
                  width: "3rem",
                  height: "3rem",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 2px 5px rgba(0,0,0,0.2)",
                  transition: "transform 0.2s",
                }}
                onMouseOver={(e) =>
                  (e.currentTarget.style.transform = "translateY(-2px)")
                }
                onMouseOut={(e) =>
                  (e.currentTarget.style.transform = "translateY(0)")
                }
              >
                <div
                  style={{
                    width: "12px",
                    height: "12px",
                    backgroundColor: COLORS.danger,
                    borderTopLeftRadius: "6px",
                    borderTopRightRadius: "6px",
                  }}
                />
                <div
                  style={{
                    width: "12px",
                    height: "12px",
                    backgroundColor: COLORS.success,
                    borderBottomLeftRadius: "6px",
                    borderBottomRightRadius: "6px",
                  }}
                />
              </Button>
            </div>
          </Card>
        </Col>
      </Row>
    </Container>
  );
}
