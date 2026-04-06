import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  CartesianGrid,
} from "recharts";
import PropTypes from "prop-types";
import { Card, Badge } from "react-bootstrap";
import CustomTooltip from "./CustomTooltip";

// Color definitions for importance with improved contrast
const getImportanceColor = (value, maxValue, modelType) => {
  const ratio = value / maxValue;
  if (modelType === "xgboost") {
    // Rich blue to purple gradient for XGBoost
    return `rgba(25, 118, 210, ${0.6 + ratio * 0.4})`;
  } else {
    // Vibrant green to teal gradient for MLP
    return `rgba(0, 150, 136, ${0.6 + ratio * 0.4})`;
  }
};

const FeatureImportanceChart = ({ data, modelType = "xgboost" }) => {
  const maxImportance = Math.max(...data.map((item) => item.importance));

  // Sort data by importance for better visual hierarchy
  const sortedData = [...data].sort((a, b) => b.importance - a.importance);

  return (
    <Card className="shadow-sm border-0">
      <Card.Header
        className={`bg-${
          modelType === "xgboost" ? "primary" : "success"
        } bg-opacity-10 border-0 py-3`}
      >
        <div className="d-flex justify-content-between align-items-center">
          <h5
            className={`mb-0 text-${
              modelType === "xgboost" ? "primary" : "success"
            } fw-semibold`}
          >
            Feature Importance Analysis
          </h5>
          <Badge
            bg={modelType === "xgboost" ? "primary" : "success"}
            className="px-3 py-2 fw-normal"
          >
            {modelType === "xgboost" ? "XGBoost" : "MLP"}
          </Badge>
        </div>
      </Card.Header>
      <Card.Body className="p-4">
        <ResponsiveContainer width="100%" height={400}>
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
              domain={[0, maxImportance * 1.1]}
              tick={{ fontSize: 12, fill: "#666" }}
              axisLine={{ stroke: "#ccc" }}
              tickLine={{ stroke: "#ccc" }}
            />
            <YAxis
              type="category"
              dataKey="feature"
              interval={0}
              width={150}
              tick={{ fontSize: 12, fill: "#333" }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              content={<CustomTooltip />}
              cursor={{ fill: "rgba(0, 0, 0, 0.05)" }}
            />
            <Bar
              dataKey="importance"
              name="Importance (%)"
              radius={[0, 4, 4, 0]}
              barSize={20}
            >
              {sortedData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={getImportanceColor(
                    entry.importance,
                    maxImportance,
                    modelType
                  )}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="mt-3 text-center">
          <small className="text-muted">
            Features are sorted by importance. Hover over bars for detailed
            information.
          </small>
        </div>
      </Card.Body>
    </Card>
  );
};

FeatureImportanceChart.propTypes = {
  data: PropTypes.arrayOf(
    PropTypes.shape({
      feature: PropTypes.string,
      importance: PropTypes.number,
    })
  ).isRequired,
  modelType: PropTypes.oneOf(["xgboost", "mlp"]),
};

FeatureImportanceChart.defaultProps = {
  modelType: "xgboost",
};

export default FeatureImportanceChart;
