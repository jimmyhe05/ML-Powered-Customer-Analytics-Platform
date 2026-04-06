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

// Color generation function based on data value
const getActivationColor = (value, maxValue) => {
  const intensity = value / maxValue;
  // Use a vibrant green color scheme
  return `rgba(76, 175, 80, ${0.6 + intensity * 0.4})`;
};

const ActivationCountsChart = ({ data }) => {
  // Find maximum count for color scaling
  const maxCount = Math.max(...data.map((item) => item.count));

  // Sort data by month to ensure chronological order
  const sortedData = [...data].sort((a, b) => {
    const [monthA, yearA] = a.month.split("/");
    const [monthB, yearB] = b.month.split("/");
    return new Date(yearA, monthA - 1) - new Date(yearB, monthB - 1);
  });

  return (
    <Card className="shadow-sm border-0">
      <Card.Header className="bg-success bg-opacity-10 border-0 py-3">
        <div className="d-flex justify-content-between align-items-center">
          <h5 className="mb-0 text-success fw-semibold">
            Device Activation Trend
          </h5>
          <Badge bg="success" className="px-3 py-2 fw-normal">
            Monthly Trend
          </Badge>
        </div>
      </Card.Header>
      <Card.Body className="p-4">
        <ResponsiveContainer width="100%" height={400}>
          <BarChart
            data={sortedData}
            margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke="#f0f0f0"
            />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 12, fill: "#666" }}
              axisLine={{ stroke: "#ccc" }}
              tickLine={{ stroke: "#ccc" }}
            />
            <YAxis
              tick={{ fontSize: 12, fill: "#666" }}
              axisLine={{ stroke: "#ccc" }}
              tickLine={{ stroke: "#ccc" }}
              tickFormatter={(value) => value.toLocaleString()}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (active && payload && payload.length) {
                  return (
                    <div className="custom-tooltip p-3 bg-white shadow-sm border rounded">
                      <p className="mb-2 fw-semibold">{label}</p>
                      <div className="d-flex justify-content-between align-items-center">
                        <span className="text-success">Activated Devices:</span>
                        <span className="fw-semibold">
                          {payload[0].value.toLocaleString()}
                        </span>
                      </div>
                      <div className="d-flex justify-content-between align-items-center mt-1">
                        <span className="text-muted">Percentage:</span>
                        <span className="fw-semibold">
                          {(
                            (payload[0].value /
                              data.reduce((sum, item) => sum + item.count, 0)) *
                            100
                          ).toFixed(1)}
                          %
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
                <span className="fw-normal">Monthly Device Activations</span>
              )}
              iconType="rect"
              iconSize={14}
              wrapperStyle={{
                padding: "4px 8px",
              }}
            />
            <Bar
              dataKey="count"
              name="Activated Devices"
              radius={[4, 4, 0, 0]}
              barSize={30}
              fill="rgba(76, 175, 80, 0.8)"
            >
              {sortedData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={getActivationColor(entry.count, maxCount)}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="mt-3 text-center">
          <small className="text-muted">
            Hover over bars to see detailed activation counts and percentage
            distribution for each month.
          </small>
        </div>
      </Card.Body>
    </Card>
  );
};

ActivationCountsChart.propTypes = {
  data: PropTypes.arrayOf(
    PropTypes.shape({
      month: PropTypes.string,
      count: PropTypes.number,
    })
  ).isRequired,
};

export default ActivationCountsChart;
