import React from "react";
import { Card, Badge } from "react-bootstrap";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  Tooltip,
  Sector,
} from "recharts";
import PropTypes from "prop-types";

// Carrier brand colors mapping with consistent colors
const CARRIER_BRAND_COLORS = {
  "T-Mobile": "#E20074", // T-Mobile magenta
  "AT&T": "#00A8E0", // AT&T blue
  Verizon: "#CD040B", // Verizon red
  Sprint: "#FFD100", // Sprint yellow
  Cricket: "#4BB544", // Cricket green
  "Metro PCS": "#2D3079", // Metro PCS blue
  "US Cellular": "#E31837", // US Cellular red
  Boost: "#F78F1E", // Boost orange
  "Consumer Cellular": "#7B2C84", // Consumer Cellular purple
  "Straight Talk": "#0066FF", // Straight Talk blue
  Others: "#A0A0A0", // Gray for others
};

// Normalize carrier names and combine similar ones
const normalizeCarrierName = (simInfo) => {
  if (!simInfo || simInfo === "uninserted") {
    return ["Uninserted"];
  }

  try {
    // Parse JSON string from sim_info
    const simData = JSON.parse(simInfo);
    if (!Array.isArray(simData) || simData.length === 0) {
      return ["Others"];
    }

    // Process each SIM slot
    const carriers = simData.map((sim) => {
      if (!sim || !sim.carrier_name) return "Others";

      const name = sim.carrier_name.trim().toLowerCase();

      // T-Mobile variations (including emergency calls)
      if (name.includes("t-mobile") || name.includes("tmobile")) {
        return "T-Mobile";
      }

      // AT&T variations
      if (name.includes("at&t") || name.includes("att")) {
        return "AT&T";
      }

      // Verizon variations
      if (name.includes("verizon")) {
        return "Verizon";
      }

      // Sprint variations
      if (name.includes("sprint")) {
        return "Sprint";
      }

      return "Others";
    });

    return carriers.filter(Boolean);
  } catch (_) {
    return ["Others"];
  }
};

// Get color for a carrier
const getCarrierColor = (carrier, index) => {
  if (CARRIER_BRAND_COLORS[carrier]) {
    return CARRIER_BRAND_COLORS[carrier];
  }
  // Generate colors for carriers not in the predefined list
  const hue = (index * 137.508) % 360; // Golden angle approximation
  return `hsl(${hue}, 70%, 50%)`;
};

// Custom active shape for better highlighting
const renderActiveShape = (props) => {
  const {
    cx,
    cy,
    innerRadius,
    outerRadius,
    startAngle,
    endAngle,
    fill,
    payload,
    percent,
    value,
  } = props;

  return (
    <g>
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius}
        outerRadius={outerRadius + 6}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
      />
      <Sector
        cx={cx}
        cy={cy}
        startAngle={startAngle}
        endAngle={endAngle}
        innerRadius={outerRadius + 6}
        outerRadius={outerRadius + 10}
        fill={fill}
      />
      <text
        x={cx}
        y={cy - 10}
        textAnchor="middle"
        fill={fill}
        fontSize={14}
        fontWeight="bold"
      >
        {payload.carrier}
      </text>
      <text x={cx} y={cy + 10} textAnchor="middle" fill="#333" fontSize={12}>
        {`${(percent * 100).toFixed(1)}% (${value.toLocaleString()})`}
      </text>
    </g>
  );
};

const CarrierDistributionChart = ({ data }) => {
  const [activeIndex, setActiveIndex] = React.useState(null);

  if (!data || data.length === 0) {
    return (
      <Card className="shadow-sm border-0 h-100">
        <Card.Header className="bg-primary bg-opacity-10 border-0 py-3">
          <div className="d-flex justify-content-between align-items-center">
            <div>
              <h5 className="mb-1 text-primary fw-semibold">
                Carrier Distribution
              </h5>
              <small className="text-muted">Network carrier analysis</small>
            </div>
            <Badge bg="primary" className="px-3 py-2 fw-normal">
              Network Usage
            </Badge>
          </div>
        </Card.Header>
        <Card.Body className="p-4">
          <div className="text-center p-5 text-muted">No data available</div>
        </Card.Body>
      </Card>
    );
  }

  // Calculate total devices for percentage calculation
  const totalDevices = data.reduce((sum, item) => sum + item.count, 0);

  const onPieEnter = (_, index) => setActiveIndex(index);
  const onPieLeave = () => setActiveIndex(null);

  return (
    <Card className="shadow-sm border-0 h-100">
      <Card.Header className="bg-primary bg-opacity-10 border-0 py-3">
        <div className="d-flex justify-content-between align-items-center">
          <div>
            <h5 className="mb-1 text-primary fw-semibold">
              Carrier Distribution
            </h5>
          </div>
          <Badge bg="primary" className="px-3 py-2 fw-normal">
            Distribution
          </Badge>
        </div>
      </Card.Header>
      <Card.Body className="p-4">
        <ResponsiveContainer width="100%" height={393}>
          <PieChart>
            <Pie
              data={data}
              dataKey="count"
              nameKey="carrier"
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={120}
              activeIndex={activeIndex}
              activeShape={renderActiveShape}
              onMouseEnter={onPieEnter}
              onMouseLeave={onPieLeave}
            >
              {data.map((entry, index) => (
                <Cell
                  key={`cell-${entry.carrier}`}
                  fill={getCarrierColor(entry.carrier, index)}
                />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload;
                  const percent = ((data.count / totalDevices) * 100).toFixed(
                    1
                  );
                  return (
                    <div className="custom-tooltip p-3 bg-white shadow-sm border rounded">
                      <p className="mb-2 fw-semibold">{data.carrier}</p>
                      <div className="d-flex flex-column gap-1">
                        <div className="d-flex justify-content-between align-items-center">
                          <span className="text-primary">SIM Count:</span>
                          <span className="fw-semibold">
                            {data.count.toLocaleString()}
                          </span>
                        </div>
                        <div className="d-flex justify-content-between align-items-center">
                          <span className="text-muted">Market Share:</span>
                          <span className="fw-semibold">{percent}%</span>
                        </div>
                      </div>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Legend
              layout="vertical"
              verticalAlign="middle"
              align="right"
              wrapperStyle={{
                fontSize: "12px",
                paddingLeft: "20px",
                maxHeight: "300px",
                overflowY: "auto",
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="mt-3 text-center">
          <small className="text-muted">
            Showing top 5 carriers and combined others. Each SIM slot is counted
            separately.
          </small>
        </div>
      </Card.Body>
    </Card>
  );
};

CarrierDistributionChart.propTypes = {
  data: PropTypes.arrayOf(
    PropTypes.shape({
      carrier: PropTypes.string.isRequired,
      count: PropTypes.number.isRequired,
    })
  ).isRequired,
};

export default CarrierDistributionChart;
