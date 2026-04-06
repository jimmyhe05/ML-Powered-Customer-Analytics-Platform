import { useEffect, useRef, useMemo, useState } from "react";
import PropTypes from "prop-types";
import {
  Card,
  Badge,
  Form,
  Spinner,
  Button,
  OverlayTrigger,
  Tooltip,
  Collapse,
} from "react-bootstrap";
import {
  FaDownload,
  FaInfoCircle,
  FaChevronDown,
  FaChevronUp,
} from "react-icons/fa";
import * as d3 from "d3";

const formatFeatureName = (name) => {
  let formatted = name.replace(/^(num_|cat_|bool_)/, "");
  formatted = formatted.replace(/[_.]/g, " ");
  formatted = formatted
    .split(" ")
    .map((word) => {
      if (word.toUpperCase() === "SIM" || word.toUpperCase() === "ID") {
        return word.toUpperCase();
      }
      switch (word.toLowerCase()) {
        case "info":
          return "Info";
        case "num":
          return "#";
        case "email":
          return "Email";
        case "encoded":
          return "Code";
        default:
          return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      }
    })
    .join(" ");

  if (formatted.length > 15) {
    const words = formatted.split(" ");
    const midpoint = Math.ceil(words.length / 2);
    formatted =
      words.slice(0, midpoint).join(" ") +
      "\n" +
      words.slice(midpoint).join(" ");
  }

  return formatted;
};

export const CorrelationHeatmap = ({ data, isLoading }) => {
  const svgRef = useRef();
  const containerRef = useRef();
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [hoveredCell, setHoveredCell] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [showLabels, setShowLabels] = useState(true);
  const [correlationThreshold, setCorrelationThreshold] = useState(0.7);
  const [showStrongCorrelations, setShowStrongCorrelations] = useState(false);
  const [showExplanation, setShowExplanation] = useState(true);

  const { features, matrix } = useMemo(() => {
    if (!Array.isArray(data) || data.length === 0) {
      return { features: [], matrix: [] };
    }
    const uniqueFeatures = [
      ...new Set([...data.map((d) => d.row), ...data.map((d) => d.column)]),
    ].sort();
    const matrixData = uniqueFeatures.map((row) =>
      uniqueFeatures.map((col) => {
        const cell = data.find((d) => d.row === row && d.column === col);
        return cell ? cell.value : 0;
      })
    );
    return { features: uniqueFeatures, matrix: matrixData };
  }, [data]);

  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        const { width, height } = containerRef.current.getBoundingClientRect();
        setDimensions({ width, height });
      }
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handleDownload = () => {
    if (!data || data.length === 0) return;
    const csvContent = [
      ["Feature 1", "Feature 2", "Correlation"],
      ...data.map(({ row, column, value }) => [row, column, value.toFixed(4)]),
    ]
      .map((row) => row.join(","))
      .join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "correlation_matrix.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  useEffect(() => {
    if (!Array.isArray(data) || data.length === 0 || !dimensions.width) return;
    try {
      d3.select(svgRef.current).selectAll("*").remove();
      const margin = { top: 130, right: 100, bottom: 40, left: 180 };
      const width = dimensions.width - margin.left - margin.right;
      const height = dimensions.height - margin.top - margin.bottom;
      const cellSize = Math.min(
        width / features.length,
        height / features.length,
        45
      );
      const colorScale = d3
        .scaleDiverging()
        .domain([-1, 0, 1])
        .interpolator(d3.interpolateRdBu);

      const svg = d3
        .select(svgRef.current)
        .attr("width", dimensions.width)
        .attr("height", dimensions.height);
      const mainGroup = svg
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

      if (showLabels) {
        const rowLabels = mainGroup
          .selectAll(".row-label")
          .data(features)
          .enter()
          .append("text")
          .attr("class", "row-label")
          .attr("x", -10)
          .attr("y", (d, i) => i * cellSize + cellSize / 2)
          .attr("text-anchor", "end")
          .attr("alignment-baseline", "middle")
          .style("font-size", "12px")
          .style("font-weight", "500")
          .text((d) => formatFeatureName(d));

        const columnLabels = mainGroup
          .selectAll(".col-label")
          .data(features)
          .enter()
          .append("text")
          .attr("class", "col-label")
          .attr("x", (d, i) => i * cellSize + cellSize / 2)
          .attr("y", -5)
          .attr("text-anchor", "start")
          .attr(
            "transform",
            (d, i) => `rotate(-45, ${i * cellSize + cellSize / 2}, 0)`
          )
          .style("font-size", "12px")
          .style("font-weight", "500")
          .text((d) => formatFeatureName(d));

        rowLabels
          .on("mouseover", function () {
            d3.select(this)
              .style("font-weight", "bold")
              .style("fill", "#2196F3");
          })
          .on("mouseout", function () {
            d3.select(this).style("font-weight", "500").style("fill", "#000");
          });

        columnLabels
          .on("mouseover", function () {
            d3.select(this)
              .style("font-weight", "bold")
              .style("fill", "#2196F3");
          })
          .on("mouseout", function () {
            d3.select(this).style("font-weight", "500").style("fill", "#000");
          });
      }

      features.forEach((row, i) => {
        features.forEach((col, j) => {
          const value = matrix[i][j];
          const isStrongCorrelation =
            showStrongCorrelations && Math.abs(value) >= correlationThreshold;
          const cell = mainGroup
            .append("rect")
            .attr("x", j * cellSize)
            .attr("y", i * cellSize)
            .attr("width", cellSize)
            .attr("height", cellSize)
            .attr("fill", colorScale(value))
            .attr("stroke", isStrongCorrelation ? "#ff9800" : "#fff")
            .attr("stroke-width", isStrongCorrelation ? 3 : 1)
            .style("cursor", "pointer")
            .on("mouseover", function (event) {
              const [x, y] = d3.pointer(event, containerRef.current);
              setHoveredCell({ row, col, value });
              setTooltipPos({ x, y });
              cell.attr("stroke", "#2196F3").attr("stroke-width", 2);
              if (showLabels) {
                d3.selectAll(".row-label")
                  .filter((d) => d === row)
                  .style("font-weight", "bold")
                  .style("fill", "#2196F3");
                d3.selectAll(".col-label")
                  .filter((d) => d === col)
                  .style("font-weight", "bold")
                  .style("fill", "#2196F3");
              }
            })
            .on("mouseout", () => {
              setHoveredCell(null);
              cell
                .attr("stroke", isStrongCorrelation ? "#ff9800" : "#fff")
                .attr("stroke-width", isStrongCorrelation ? 3 : 1);
              if (showLabels) {
                d3.selectAll(".row-label")
                  .style("font-weight", "500")
                  .style("fill", "#000");
                d3.selectAll(".col-label")
                  .style("font-weight", "500")
                  .style("fill", "#000");
              }
            });

          if (Math.abs(value) > 0.1) {
            mainGroup
              .append("text")
              .attr("x", j * cellSize + cellSize / 2)
              .attr("y", i * cellSize + cellSize / 2)
              .attr("text-anchor", "middle")
              .attr("alignment-baseline", "middle")
              .style("font-size", "10px")
              .style("font-weight", isStrongCorrelation ? "bold" : "normal")
              .style("fill", Math.abs(value) > 0.5 ? "#fff" : "#000")
              .text(value.toFixed(2));
          }
        });
      });
    } catch (err) {
      console.error("Error rendering heatmap", err);
    }
  }, [
    data,
    dimensions,
    features,
    matrix,
    showLabels,
    showStrongCorrelations,
    correlationThreshold,
  ]);

  const renderTooltip = (hoveredCell) => (
    <div
      className="bg-white p-3 rounded shadow-sm border"
      style={{ pointerEvents: "none", width: 260 }}
    >
      <div className="fw-bold mb-2 text-primary">Correlation Details</div>
      <div>
        <strong>Features:</strong>
        <br />
        {formatFeatureName(hoveredCell.row)} ↔{" "}
        {formatFeatureName(hoveredCell.col)}
      </div>
      <div className="mt-2">
        <strong>Correlation:</strong>
        <br />
        {hoveredCell.value.toFixed(3)}
        {Math.abs(hoveredCell.value) > correlationThreshold && (
          <span className="ms-2 badge bg-warning">
            Strong {hoveredCell.value > 0 ? "Positive" : "Negative"} Correlation
          </span>
        )}
      </div>
    </div>
  );

  return (
    <Card className="shadow-sm border-0 h-100">
      <Card.Header className="bg-primary bg-opacity-10 border-0 py-3">
        <div className="d-flex justify-content-between align-items-center">
          <div>
            <h5 className="mb-1 text-primary fw-semibold">
              Feature Correlation Analysis
            </h5>
          </div>
          <Badge bg="primary" className="px-3 py-2 fw-normal">
            Correlations
          </Badge>
        </div>
      </Card.Header>
      <Card.Body className="p-4">
        <div className="d-flex justify-content-between align-items-center mb-4">
          <div className="d-flex align-items-center gap-3">
            <Form.Check
              type="switch"
              id="show-labels-switch"
              label="Show Labels"
              checked={showLabels}
              onChange={(e) => setShowLabels(e.target.checked)}
            />
            <Form.Check
              type="switch"
              id="show-strong-correlations"
              label="Highlight Strong Correlations"
              checked={showStrongCorrelations}
              onChange={(e) => setShowStrongCorrelations(e.target.checked)}
            />
            <small className="text-muted d-flex align-items-center gap-2">
              <FaInfoCircle /> Hover over cells to see correlation details
            </small>
          </div>
          <OverlayTrigger
            placement="bottom"
            overlay={<Tooltip>Download correlation matrix as CSV</Tooltip>}
          >
            <Button
              variant="outline-primary"
              size="sm"
              onClick={handleDownload}
              disabled={!data || data.length === 0}
              className="d-flex align-items-center gap-2"
            >
              <FaDownload /> Export Data
            </Button>
          </OverlayTrigger>
        </div>

        {showStrongCorrelations && (
          <div className="mb-4 bg-light p-3 rounded">
            <div className="d-flex align-items-center gap-3">
              <div className="d-flex flex-column" style={{ width: "200px" }}>
                <small className="text-muted mb-1">Correlation Threshold</small>
                <Form.Range
                  min={0.5}
                  max={1}
                  step={0.1}
                  value={correlationThreshold}
                  onChange={(e) =>
                    setCorrelationThreshold(parseFloat(e.target.value))
                  }
                />
                <div className="d-flex justify-content-between">
                  <small className="text-muted">0.5</small>
                  <small className="text-primary fw-semibold">
                    {correlationThreshold.toFixed(1)}
                  </small>
                  <small className="text-muted">1.0</small>
                </div>
              </div>
              <div className="d-flex align-items-center gap-2">
                <div
                  className="border"
                  style={{
                    width: "20px",
                    height: "20px",
                    backgroundColor: "#ff9800",
                  }}
                ></div>
                <small className="text-muted">Strong Correlation</small>
              </div>
            </div>
          </div>
        )}

        <div className="mb-4">
          <Button
            variant="link"
            className="p-0 text-primary text-decoration-none d-flex align-items-center gap-2"
            onClick={() => setShowExplanation(!showExplanation)}
            aria-expanded={showExplanation}
          >
            <h6 className="mb-0">Understanding Correlation Values</h6>
            {showExplanation ? <FaChevronUp /> : <FaChevronDown />}
          </Button>
          <Collapse in={showExplanation}>
            <div className="p-3 bg-light rounded mt-2">
              <div className="row g-4">
                <div className="col-md-6">
                  <strong className="text-primary">
                    Correlation Strength:
                  </strong>
                  <ul className="mb-0 mt-2">
                    <li>
                      <strong>High Correlation</strong> (|r| &ge; 0.7):{" "}
                      <small className="text-muted">
                        Features are strongly related
                      </small>
                    </li>
                    <li className="mt-2">
                      <strong>Moderate Correlation</strong> (0.3 &le; |r| &lt;
                      0.7):{" "}
                      <small className="text-muted">
                        Noticeable relationship
                      </small>
                    </li>
                    <li className="mt-2">
                      <strong>Low Correlation</strong> (|r| &lt; 0.3):{" "}
                      <small className="text-muted">
                        Little to no relationship
                      </small>
                    </li>
                  </ul>
                </div>
                <div className="col-md-6">
                  <strong className="text-primary">
                    Correlation Direction:
                  </strong>
                  <ul className="mb-0 mt-2">
                    <li>
                      <strong>Positive</strong> (r &gt; 0):{" "}
                      <small className="text-muted">
                        Move in same direction
                      </small>
                    </li>
                    <li className="mt-2">
                      <strong>Negative</strong> (r &lt; 0):{" "}
                      <small className="text-muted">
                        Move in opposite directions
                      </small>
                    </li>
                    <li className="mt-2">
                      <strong>No Correlation</strong> (&asymp; 0):{" "}
                      <small className="text-muted">Independent features</small>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </Collapse>
        </div>

        <div
          className="position-relative"
          ref={containerRef}
          style={{ height: "600px" }}
        >
          {isLoading ? (
            <div className="d-flex align-items-center justify-content-center h-100">
              <Spinner animation="border" variant="primary" />
            </div>
          ) : (
            <>
              <svg ref={svgRef} style={{ width: "100%", height: "100%" }}></svg>
              {hoveredCell && (
                <div
                  style={{
                    position: "absolute",
                    top: tooltipPos.y,
                    left: tooltipPos.x + 20,
                    zIndex: 10,
                  }}
                >
                  {renderTooltip(hoveredCell)}
                </div>
              )}
            </>
          )}
        </div>
      </Card.Body>
    </Card>
  );
};

CorrelationHeatmap.propTypes = {
  data: PropTypes.arrayOf(
    PropTypes.shape({
      row: PropTypes.string.isRequired,
      column: PropTypes.string.isRequired,
      value: PropTypes.number.isRequired,
    })
  ),
  isLoading: PropTypes.bool,
};

CorrelationHeatmap.defaultProps = {
  data: [],
  isLoading: false,
};
