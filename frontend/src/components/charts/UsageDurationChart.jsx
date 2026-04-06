import { Card, Badge } from "react-bootstrap";
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

// Color generation function based on duration
const getDurationColor = (count, maxCount, durationIndex, totalDurations) => {
  // Calculate intensity based on the count relative to max
  const countIntensity = count / maxCount;

  // Also factor in the duration length (longer durations should be darker)
  const durationIntensity = durationIndex / (totalDurations - 1);

  // Combined intensity - we weight the count more heavily than the duration position
  const intensity = countIntensity * 0.6 + durationIntensity * 0.4;

  // Blue-based spectrum for usage duration
  const hue = 210; // Blue
  const saturation = 70 + intensity * 30; // More saturated for higher values
  const lightness = 65 - intensity * 30; // Darker for higher values

  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
};

const UsageDurationChart = ({ data }) => {
  // If no data or empty data array, show loading
  if (!data || data.length === 0) {
    return (
      <Card className="shadow-sm border-0 h-100">
        <Card.Header className="bg-primary bg-opacity-10 border-0 py-3">
          <div className="d-flex justify-content-between align-items-center">
            <div>
              <h5 className="mb-0 text-primary fw-semibold">
                Device Usage Duration
              </h5>
            </div>
            <Badge bg="primary" className="px-3 py-2 fw-normal">
              Usage
            </Badge>
          </div>
        </Card.Header>
        <Card.Body className="p-4">
          <div className="text-center p-5 text-muted">No data available</div>
        </Card.Body>
      </Card>
    );
  }

  // Find maximum count for color scaling
  const maxCount = Math.max(...data.map((item) => item.count));
  const totalDurations = data.length;
  const totalDevices = data.reduce((sum, item) => sum + item.count, 0);

  return (
    <Card className="shadow-sm border-0 h-100">
      <Card.Header className="bg-primary bg-opacity-10 border-0 py-3">
        <div className="d-flex justify-content-between align-items-center">
          <div>
            <h5 className="mb-0 text-primary fw-semibold">
              Device Usage Duration
            </h5>
          </div>
          <Badge bg="primary" className="px-3 py-2 fw-normal">
            Usage
          </Badge>
        </div>
      </Card.Header>
      <Card.Body className="p-4">
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={data} margin={{ bottom: 60 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="duration"
              tick={{ fontSize: 12 }}
              interval={0}
              angle={-15}
              textAnchor="end"
              height={60}
            />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip
              content={({ active, payload, label }) => {
                if (active && payload && payload.length) {
                  const count = payload[0].value;
                  const percentage = ((count / totalDevices) * 100).toFixed(1);
                  return (
                    <div className="custom-tooltip p-3 bg-white shadow-sm border rounded">
                      <p className="mb-2 fw-semibold">{label}</p>
                      <div className="d-flex justify-content-between align-items-center">
                        <span className="text-primary">Devices:</span>
                        <span className="fw-semibold">
                          {count.toLocaleString()}
                        </span>
                      </div>
                      <div className="d-flex justify-content-between align-items-center">
                        <span className="text-muted">Share:</span>
                        <span className="fw-semibold">{percentage}%</span>
                      </div>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Bar dataKey="count" fill="#8884d8">
              {data.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={getDurationColor(
                    entry.count,
                    maxCount,
                    index,
                    totalDurations
                  )}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="mt-3 text-center">
          <small className="text-muted">
            Distribution of device usage durations across all users
          </small>
        </div>
      </Card.Body>
    </Card>
  );
};

UsageDurationChart.propTypes = {
  data: PropTypes.arrayOf(
    PropTypes.shape({
      duration: PropTypes.string.isRequired,
      count: PropTypes.number.isRequired,
    })
  ),
};

export default UsageDurationChart;
