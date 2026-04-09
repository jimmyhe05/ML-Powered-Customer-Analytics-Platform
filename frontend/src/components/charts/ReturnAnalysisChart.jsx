import { useState } from "react";
import { Card, Nav, Badge } from "react-bootstrap";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import PropTypes from "prop-types";

// Color generation function based on count
const getReturnColor = (count, maxCount) => {
  // Calculate intensity based on the count relative to max
  const intensity = maxCount > 0 ? count / maxCount : 0;

  // Red-based spectrum for returns (higher returns = darker red)
  const hue = 0; // Red
  const saturation = 75 + intensity * 25; // More saturated for higher values
  const lightness = 65 - intensity * 30; // Darker for higher values

  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
};

const ReturnAnalysisChart = ({ data }) => {
  const [activeKey, setActiveKey] = useState("source_distribution");

  // Data mapping for different views
  const dataMapping = {
    source_distribution: {
      title: "Return Sources",
      description: "Distribution of return sources",
      xKey: "source",
      yKey: "count",
      data: data?.source_distribution || [],
    },
    defect_distribution: {
      title: "Defect Types",
      description: "Distribution of defect/damage types",
      xKey: "defect_type",
      yKey: "count",
      data: data?.defect_distribution || [],
    },
    warranty_status: {
      title: "Warranty Status",
      description: "Warranty status of returned devices",
      xKey: "warranty_status",
      yKey: "count",
      data: data?.warranty_status || [],
    },
    final_status: {
      title: "Final Status",
      description: "Final status of returned devices",
      xKey: "final_status",
      yKey: "count",
      data: data?.final_status || [],
    },
    responsible_party: {
      title: "Responsible Party",
      description: "Party responsible for returns",
      xKey: "responsible_party",
      yKey: "count",
      data: data?.responsible_party || [],
    },
  };

  const currentData = dataMapping[activeKey];
  // If no data available, show loading
  if (!data) {
    return (
      <Card className="shadow-sm border-0 h-100">
        <Card.Header className="bg-danger bg-opacity-10 border-0 py-3">
          <div className="d-flex justify-content-between align-items-center">
            <div>
              <h5 className="mb-0 text-danger fw-semibold">Return Analysis</h5>
            </div>
            <Badge bg="danger" className="px-3 py-2 fw-normal">
              Returns
            </Badge>
          </div>
        </Card.Header>
        <Card.Body className="p-4">
          <div className="text-center p-5 text-muted">No data available</div>
        </Card.Body>
      </Card>
    );
  }

  // If the currently selected view has no records, show a friendly placeholder
  if (!currentData || !Array.isArray(currentData.data) || currentData.data.length === 0) {
    return (
      <Card className="shadow-sm border-0 h-100">
        <Card.Header className="bg-danger bg-opacity-10 border-0 py-3">
          <div className="d-flex justify-content-between align-items-center">
            <div>
              <h5 className="mb-0 text-danger fw-semibold">{currentData?.title || "Return Analysis"}</h5>
            </div>
            <Badge bg="danger" className="px-3 py-2 fw-normal">
              Returns
            </Badge>
          </div>
        </Card.Header>
        <Card.Body className="p-4">
          <div className="text-center p-5 text-muted">No data available for this view</div>
        </Card.Body>
      </Card>
    );
  }

  // Find maximum count for color scaling in current data view
  // Guard maxCount calculation when data exists but all counts are zero
  const counts = currentData.data.map((item) => Number(item[currentData.yKey]) || 0);
  const maxCount = counts.length > 0 ? Math.max(...counts) : 0;

  return (
    <Card className="shadow-sm border-0 h-100">
      <Card.Header className="bg-danger bg-opacity-10 border-0 py-3">
        <div className="d-flex justify-content-between align-items-center">
          <div>
            <h5 className="mb-0 text-danger fw-semibold">
              {currentData.title}
            </h5>
          </div>
          <Badge bg="danger" className="px-3 py-2 fw-normal">
            Returns
          </Badge>
        </div>
      </Card.Header>
      <Card.Body className="p-4">
        <Nav
          variant="pills"
          className="mb-4 flex-wrap gap-2"
          activeKey={activeKey}
          onSelect={(k) => setActiveKey(k)}
        >
          <Nav.Item>
            <Nav.Link
              eventKey="source_distribution"
              className="py-1 px-3 rounded-pill"
            >
              Sources
            </Nav.Link>
          </Nav.Item>
          <Nav.Item>
            <Nav.Link
              eventKey="defect_distribution"
              className="py-1 px-3 rounded-pill"
            >
              Defects
            </Nav.Link>
          </Nav.Item>
          <Nav.Item>
            <Nav.Link
              eventKey="warranty_status"
              className="py-1 px-3 rounded-pill"
            >
              Warranty
            </Nav.Link>
          </Nav.Item>
          <Nav.Item>
            <Nav.Link
              eventKey="final_status"
              className="py-1 px-3 rounded-pill"
            >
              Status
            </Nav.Link>
          </Nav.Item>
          <Nav.Item>
            <Nav.Link
              eventKey="responsible_party"
              className="py-1 px-3 rounded-pill"
            >
              Responsible
            </Nav.Link>
          </Nav.Item>
        </Nav>

        <ResponsiveContainer width="100%" height={385}>
          <BarChart data={currentData.data} margin={{ bottom: 80 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey={currentData.xKey}
              tick={{ fontSize: 12 }}
              interval={0}
              angle={-45}
              textAnchor="end"
              height={80}
            />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip
              content={({ active, payload, label }) => {
                if (active && payload && payload.length) {
                  const total = currentData.data.reduce(
                    (sum, item) => sum + (Number(item[currentData.yKey]) || 0),
                    0
                  );
                  const value = Number(payload[0].value) || 0;
                  const share = total ? ((value / total) * 100).toFixed(1) : "0.0";

                  return (
                    <div className="custom-tooltip p-3 bg-white shadow-sm border rounded">
                      <p className="mb-2 fw-semibold">{label}</p>
                      <div className="d-flex justify-content-between align-items-center">
                        <span className="text-danger">Count:</span>
                        <span className="fw-semibold">{value.toLocaleString()}</span>
                      </div>
                      <div className="d-flex justify-content-between align-items-center">
                        <span className="text-muted">Share:</span>
                        <span className="fw-semibold">{share}%</span>
                      </div>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Bar dataKey={currentData.yKey} fill="#8884d8">
              {currentData.data.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={getReturnColor(entry[currentData.yKey], maxCount)}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Card.Body>
    </Card>
  );
};

ReturnAnalysisChart.propTypes = {
  data: PropTypes.shape({
    source_distribution: PropTypes.arrayOf(
      PropTypes.shape({
        source: PropTypes.string.isRequired,
        count: PropTypes.number.isRequired,
      })
    ),
    defect_distribution: PropTypes.arrayOf(
      PropTypes.shape({
        defect_type: PropTypes.string.isRequired,
        count: PropTypes.number.isRequired,
      })
    ),
    warranty_status: PropTypes.arrayOf(
      PropTypes.shape({
        warranty_status: PropTypes.string.isRequired,
        count: PropTypes.number.isRequired,
      })
    ),
    final_status: PropTypes.arrayOf(
      PropTypes.shape({
        final_status: PropTypes.string.isRequired,
        count: PropTypes.number.isRequired,
      })
    ),
    responsible_party: PropTypes.arrayOf(
      PropTypes.shape({
        responsible_party: PropTypes.string.isRequired,
        count: PropTypes.number.isRequired,
      })
    ),
  }),
};

export default ReturnAnalysisChart;
