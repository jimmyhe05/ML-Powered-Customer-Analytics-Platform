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
const getAgeRangeColor = (value, maxValue) => {
  const intensity = value / maxValue;
  // Use a more vibrant blue color scheme
  return `rgba(3, 169, 244, ${0.6 + intensity * 0.4})`;
};

const AgeRangeChart = ({ data }) => {
  if (!Array.isArray(data) || data.length === 0) {
    return (
      <Card className="shadow-sm border-0 h-100">
        <Card.Header className="bg-info bg-opacity-10 border-0 py-3">
          <div className="d-flex justify-content-between align-items-center">
            <h5 className="mb-0 text-info fw-semibold">Age Distribution Analysis</h5>
            <Badge bg="info" className="px-3 py-2 fw-normal">Demographics</Badge>
          </div>
        </Card.Header>
        <Card.Body className="p-4 text-center text-muted">
          No age data available in uploaded dashboard dataset.
        </Card.Body>
      </Card>
    );
  }

  // Find maximum count for color scaling
  const maxCount = Math.max(...data.map((item) => item.count));

  // Sort data by age range for better visualization
  const sortedData = [...data].sort((a, b) => {
    const getAgeValue = (range) => {
      const num = parseInt(range.split("-")[0]);
      return isNaN(num) ? 999 : num; // Put "Unknown" at the end
    };
    return getAgeValue(a.range) - getAgeValue(b.range);
  });

  return (
    <Card className="shadow-sm border-0">
      <Card.Header className="bg-info bg-opacity-10 border-0 py-3">
        <div className="d-flex justify-content-between align-items-center">
          <h5 className="mb-0 text-info fw-semibold">
            Age Distribution Analysis
          </h5>
          <Badge bg="info" className="px-3 py-2 fw-normal">
            Demographics
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
              dataKey="range"
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
                        <span className="text-info">Number of Users:</span>
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
                <span className="fw-normal">Distribution by Age Range</span>
              )}
              iconType="rect"
              iconSize={14}
              wrapperStyle={{
                padding: "4px 8px",
              }}
            />
            <Bar
              dataKey="count"
              name="Number of Users"
              radius={[4, 4, 0, 0]}
              barSize={30}
              fill="rgba(3, 169, 244, 0.8)"
            >
              {sortedData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={getAgeRangeColor(entry.count, maxCount)}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="mt-3 text-center">
          <small className="text-muted">
            Hover over bars to see detailed user count and percentage
            distribution for each age range.
          </small>
        </div>
      </Card.Body>
    </Card>
  );
};

AgeRangeChart.propTypes = {
  data: PropTypes.arrayOf(
    PropTypes.shape({
      range: PropTypes.string,
      count: PropTypes.number,
    })
  ).isRequired,
};

export default AgeRangeChart;
