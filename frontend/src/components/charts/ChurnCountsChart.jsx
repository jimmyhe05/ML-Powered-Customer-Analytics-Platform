import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";
import PropTypes from "prop-types";
import { Card, Badge } from "react-bootstrap";

// Color definitions with improved contrast
const CHURN_COLOR = "#dc3545"; // Bootstrap danger red
const GRID_COLOR = "#f0f0f0";

const ChurnCountsChart = ({ data }) => {
  // Format data for better visualization
  const formattedData = data.map((item) => ({
    ...item,
    month: item.month,
    churn_count: item.churn_count,
  }));

  return (
    <Card className="shadow-sm border-0">
      <Card.Header className="bg-danger bg-opacity-10 border-0 py-3">
        <div className="d-flex justify-content-between align-items-center">
          <h5 className="mb-0 text-danger fw-semibold">Churn Analysis</h5>
          <Badge bg="danger" className="px-3 py-2 fw-normal">
            Monthly Trend
          </Badge>
        </div>
      </Card.Header>
      <Card.Body className="p-4">
        <ResponsiveContainer width="100%" height={400}>
          <LineChart
            data={formattedData}
            margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke={GRID_COLOR}
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
                        <span className="text-danger">Churned Customers:</span>
                        <span className="fw-semibold">
                          {payload[0].value.toLocaleString()}
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
              formatter={(value) => <span className="fw-normal">{value}</span>}
            />
            <Line
              type="monotone"
              dataKey="churn_count"
              name="Churned Customers"
              stroke={CHURN_COLOR}
              strokeWidth={2}
              dot={{ r: 4, fill: CHURN_COLOR }}
              activeDot={{ r: 6, fill: CHURN_COLOR }}
            />
          </LineChart>
        </ResponsiveContainer>
        <div className="mt-3 text-center">
          <small className="text-muted">
            Hover over data points to see the number of churned customers for
            each month.
          </small>
        </div>
      </Card.Body>
    </Card>
  );
};

ChurnCountsChart.propTypes = {
  data: PropTypes.arrayOf(
    PropTypes.shape({
      month: PropTypes.string,
      churn_count: PropTypes.number,
    })
  ).isRequired,
};

export default ChurnCountsChart;
