import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  CartesianGrid,
  Legend,
} from "recharts";
import PropTypes from "prop-types";
import { Card, Badge } from "react-bootstrap";

// Color constants for consistent theming
const COLORS = {
  primary: "rgb(255, 87, 34)", // Deep Orange
  background: "rgba(255, 87, 34, 0.1)",
  text: "#333",
  muted: "#666",
};

const AppUsageChart = ({ data }) => {
  if (!Array.isArray(data) || data.length === 0) {
    return (
      <Card className="shadow-sm border-0 h-100">
        <Card.Header className="bg-danger bg-opacity-10 border-0 py-3">
          <div className="d-flex justify-content-between align-items-center">
            <div>
              <h5 className="mb-0 text-danger fw-semibold">Application Usage Analysis</h5>
            </div>
            <Badge bg="danger" className="px-3 py-2 fw-normal">Usage Stats</Badge>
          </div>
        </Card.Header>
        <Card.Body className="p-4 text-center text-muted">
          No application usage data available in uploaded dashboard dataset.
        </Card.Body>
      </Card>
    );
  }

  // Sort data by percentage in descending order
  const sortedData = [...data].sort((a, b) => b.percentage - a.percentage);
  const maxPercentage = Math.max(...sortedData.map((item) => item.percentage));

  return (
    <Card className="shadow-sm border-0 h-100">
      <Card.Header className="bg-danger bg-opacity-10 border-0 py-3">
        <div className="d-flex justify-content-between align-items-center">
          <div>
            <h5 className="mb-0 text-danger fw-semibold">
              Application Usage Analysis
            </h5>
          </div>
          <Badge bg="danger" className="px-3 py-2 fw-normal">
            Usage Stats
          </Badge>
        </div>
      </Card.Header>
      <Card.Body className="p-4">
        <ResponsiveContainer width="100%" height={393}>
          <BarChart
            data={sortedData}
            layout="vertical"
            margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              horizontal={true}
              vertical={false}
              stroke="#f0f0f0"
            />
            <XAxis
              type="number"
              tickFormatter={(value) => `${value.toFixed(1)}%`}
              domain={[0, maxPercentage * 1.1]}
              tick={{ fontSize: 12, fill: COLORS.muted }}
              axisLine={{ stroke: "#ddd" }}
              tickLine={{ stroke: "#ddd" }}
            />
            <YAxis
              type="category"
              dataKey="app"
              interval={0}
              width={160}
              tick={{
                fontSize: 12,
                fill: COLORS.text,
                fontWeight: 500,
              }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (active && payload && payload.length) {
                  const percentage = payload[0].value;
                  return (
                    <div className="custom-tooltip p-3 bg-white shadow-sm border rounded">
                      <p className="mb-2 fw-semibold">{label}</p>
                      <div className="d-flex justify-content-between align-items-center">
                        <span className="text-danger">Usage Rate:</span>
                        <span className="fw-semibold">
                          {percentage.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Legend
              verticalAlign="top"
              height={36}
              formatter={() => (
                <span className="fw-normal">Application Distribution</span>
              )}
              iconType="rect"
              iconSize={14}
              wrapperStyle={{
                padding: "4px 8px",
              }}
            />
            <Bar
              dataKey="percentage"
              name="Usage Rate"
              radius={[0, 4, 4, 0]}
              barSize={24}
              fill="rgba(220, 53, 69, 0.8)" // Bootstrap danger color
            >
              {sortedData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={`rgba(220, 53, 69, ${
                    0.4 + (entry.percentage / maxPercentage) * 0.6
                  })`}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="mt-4 text-center">
          <small className="text-muted">
            Hover over bars to see detailed usage statistics. Applications are
            sorted by usage rate.
          </small>
        </div>
      </Card.Body>
    </Card>
  );
};

AppUsageChart.propTypes = {
  data: PropTypes.arrayOf(
    PropTypes.shape({
      app: PropTypes.string.isRequired,
      percentage: PropTypes.number.isRequired,
    })
  ).isRequired,
};

export default AppUsageChart;
