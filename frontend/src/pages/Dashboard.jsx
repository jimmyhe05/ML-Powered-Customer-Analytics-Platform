import { useState, useEffect, useRef } from "react";
import React from "react";
import {
  Container,
  Row,
  Col,
  Card,
  Badge,
  Button,
  Modal,
  Table,
  Spinner,
  Pagination,
} from "react-bootstrap";
import { Link, useNavigate } from "react-router-dom";
import {
  FaTimes,
  FaChartLine,
  FaTable,
  FaUpload,
  FaTrashAlt,
  FaExclamationTriangle,
} from "react-icons/fa";
import {
  ChurnCountsChart,
  FeatureImportanceChart,
  AgeRangeChart,
  ActivationCountsChart,
  AppUsageChart,
  CarrierDistributionChart,
  ReturnAnalysisChart,
  UsageDurationChart,
  CorrelationHeatmap,
} from "../components/charts";
import { formatFeatureName } from "../components/charts/utils";
import { useToast } from "../components/Toast";

const emptyReturnAnalysis = {
  source_distribution: [],
  defect_distribution: [],
  warranty_status: [],
  final_status: [],
  responsible_party: [],
};

const normalizeReturnAnalysisPayload = (payload) => ({
  source_distribution: Array.isArray(payload?.source_distribution)
    ? payload.source_distribution
    : [],
  defect_distribution: Array.isArray(payload?.defect_distribution)
    ? payload.defect_distribution
    : [],
  warranty_status: Array.isArray(payload?.warranty_status)
    ? payload.warranty_status
    : [],
  final_status: Array.isArray(payload?.final_status)
    ? payload.final_status
    : [],
  responsible_party: Array.isArray(payload?.responsible_party)
    ? payload.responsible_party
    : [],
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const transientStatuses = new Set([408, 429, 500, 502, 503, 504]);

const apiFetch = async (url, options = {}, retryOptions = {}) => {
  const {
    retries = 3,
    baseDelay = 1500,
    retryStatuses = transientStatuses,
  } = retryOptions;

  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(url, options);
      if (!response.ok && retryStatuses.has(response.status) && attempt < retries) {
        await sleep(baseDelay * (attempt + 1));
        continue;
      }
      return response;
    } catch (error) {
      lastError = error;
      if (attempt >= retries) {
        throw error;
      }
      await sleep(baseDelay * (attempt + 1));
    }
  }
  throw lastError || new Error("Request failed");
};

const apiJson = async (url, options = {}, retryOptions = {}) => {
  const response = await apiFetch(url, options, retryOptions);
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`${url.split("/").pop()} failed (${response.status}): ${errorText.slice(0, 160)}`);
  }
  return response.json();
};

export default function Dashboard() {
  // Model type color scheme:
  // - XGBoost: primary (blue)
  // - MLP: success (green)
  const [predictions, setPredictions] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [selectedModel, setSelectedModel] = useState("xgboost");
  const [dragging, setDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const navigate = useNavigate();
  const [featureImportance, setFeatureImportance] = useState([]);
  const [riskThreshold] = useState(() => {
    const stored = localStorage.getItem("riskThreshold");
    return stored ? parseInt(stored) : 50;
  });
  const [carrierData, setCarrierData] = useState([]);
  const [returnData, setReturnData] = useState(emptyReturnAnalysis);
  const [usageData, setUsageData] = useState(null);
  const [correlationData, setCorrelationData] = useState(null);
  const [mlpFeatureImportance, setMlpFeatureImportance] = useState([]);
  const [error, setError] = useState(null);
  const dashboardTitleRef = useRef(null);
  const [modelTrained, setModelTrained] = useState(false);
  const [modelAvailability, setModelAvailability] = useState({
    xgboost: false,
    mlp: false,
  });
  const [allPredictions, setAllPredictions] = useState([]);
  const [isLoadingAllPredictions, setIsLoadingAllPredictions] = useState(false);
  const [showAllPredictionsModal, setShowAllPredictionsModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState({
    key: "timestamp",
    direction: "desc",
  });
  const [currentPage, setCurrentPage] = useState(1);
  const predictionsPerPage = 10;
  const [showDashboardUploadModal, setShowDashboardUploadModal] = useState(false);
  const [dashboardFile, setDashboardFile] = useState(null);
  const [isUploadingDashboard, setIsUploadingDashboard] = useState(false);


  const rawApiUrl = import.meta.env.VITE_API_URL?.trim();
  const BASE_URL = rawApiUrl
    ? `${rawApiUrl.startsWith("http://") || rawApiUrl.startsWith("https://")
      ? rawApiUrl
      : `https://${rawApiUrl}`
    }`.replace(/\/+$/, "")
    : "";

  // Runtime guard: if VITE_API_URL wasn't set at build time, avoid making
  // API requests that become `/undefined/...` and create noisy JSON parse errors.
  if (!BASE_URL) {
    console.error(
      "VITE_API_URL is not set. API requests are disabled until you set VITE_API_URL in Vercel and redeploy."
    );
  }

  const toast = useToast();

  const handleDashboardFileSelect = (event) => {
    const file = event.target.files[0];
    if (file && (file.type === "text/csv" || file.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")) {
      setDashboardFile(file);
    } else {
      toast({ message: "Please upload a valid CSV or XLSX file.", variant: "warning" });
      setDashboardFile(null);
    }
  };

  const handleUploadDashboardData = async () => {
    if (!dashboardFile) return;

    setIsUploadingDashboard(true);

    try {
      const formData = new FormData();
      formData.append("file", dashboardFile);

      const response = await apiFetch(`${BASE_URL}/upload_dashboard_data`, {
        method: "POST",
        body: formData,
      }, { retries: 2, baseDelay: 2000 });

      if (response.ok) {
        toast({ message: "Dashboard data uploaded successfully.", variant: "success" });
        setShowDashboardUploadModal(false);
        setDashboardFile(null);
        setIsUploadingDashboard(false);

        // Refresh dashboard data
        setLoading(true);
        apiJson(`${BASE_URL}/dashboard_data`)
          .then((data) => {
            if (data && Array.isArray(data.app_usage_percentages)) {
              data.app_usage_percentages.sort((a, b) => b.percentage - a.percentage);
              setDashboardData(data);
              setLoading(false);
            } else {
              console.error("Invalid dashboard data:", data);
              setDashboardData(null);
              setLoading(false);
            }
          })
          .catch((error) => {
            console.error("Error refreshing dashboard data:", error);
            setLoading(false);
          });

        apiJson(`${BASE_URL}/carrier_distribution`)
          .then((data) => setCarrierData(data.carrier_distribution || []))
          .catch((err) => console.error("Error refreshing carrier distribution:", err));

        apiJson(`${BASE_URL}/return_analysis`)
          .then((data) => setReturnData(normalizeReturnAnalysisPayload(data)))
          .catch((err) => console.error("Error refreshing return analysis:", err));

        apiJson(`${BASE_URL}/time_analysis`)
          .then((data) => setUsageData(data.usage_duration))
          .catch((err) => console.error("Error refreshing time analysis:", err));
      } else {
        const errorData = await response.json();
        console.error("Dashboard upload error:", errorData);
        toast({ message: "Failed to upload dashboard data. Please try again.", variant: "danger" });
      }
    } catch (error) {
      console.error("Dashboard upload exception:", error);
      toast({ message: "Upload failed. Check your connection and try again.", variant: "danger" });
    } finally {
      setIsUploadingDashboard(false);
    }
  };

  const [showResetDashboardConfirm, setShowResetDashboardConfirm] = useState(false);

  const handleResetDashboardData = async () => {
    setShowResetDashboardConfirm(false);
    try {
      const response = await apiFetch(`${BASE_URL}/reset_dashboard_data`, {
        method: "POST",
      }, { retries: 2, baseDelay: 2000 });

      if (response.ok) {
        toast({ message: "Dashboard data has been reset.", variant: "info" });
        setDashboardData(null);
        setCarrierData([]);
        setReturnData(emptyReturnAnalysis);
        setUsageData(null);
        setCorrelationData([]);
        setPage(0);
        setLoading(true);
        apiJson(`${BASE_URL}/dashboard_data`)
          .then((data) => {
            setDashboardData(data || null);
            setLoading(false);
          })
          .catch((error) => {
            console.error("Error refreshing empty dashboard:", error);
            setLoading(false);
          });
      } else {
        toast({ message: "Failed to reset dashboard data. Please try again.", variant: "danger" });
      }
    } catch (error) {
      console.error("Reset dashboard error:", error);
      toast({ message: "An error occurred during reset.", variant: "danger" });
    }
  };


  useEffect(() => {
    const trained = localStorage.getItem("modelTrained");
    if (trained === "true") {
      setModelTrained(true); // this triggers the real dashboard fetch below
      localStorage.removeItem("modelTrained"); // prevent future loops
    }
  }, []);

  // Fetch Dashboard Data
  useEffect(() => {
    // If the API base URL is missing, bail out early to prevent /undefined/... calls.
    if (!BASE_URL) {
      setLoading(false);
      setError("VITE_API_URL missing - configure VITE_API_URL in Vercel and redeploy the frontend.");
      return;
    }
    // Fetch latest predictions
    apiJson(`${BASE_URL}/predictions?limit=5`)
      .then((data) => {
        const parsed = Object.values(data).map((item, index) => {
          const predictionsArray = Array.isArray(item.predictions)
            ? item.predictions
            : [];
          const predictionDate = new Date(item.prediction_date);
          return {
            fileName: item.upload_file,
            date: predictionDate.toLocaleDateString(undefined, {
              year: "numeric",
              month: "short",
              day: "numeric",
            }),
            time: predictionDate.toLocaleTimeString(undefined, {
              hour: "2-digit",
              minute: "2-digit",
              hour12: true,
            }),
            riskyCustomers: predictionsArray.filter(
              (p) => p.churn_probability > riskThreshold / 100
            ).length,
            predictions: predictionsArray,
            modelType: item.model_type,
            predictionBatchId: Object.keys(data)[index],
            timestamp: predictionDate.getTime(),
          };
        });

        // Sort by timestamp in descending order (most recent first)
        const sortedPredictions = parsed.sort(
          (a, b) => b.timestamp - a.timestamp
        );
        setPredictions(sortedPredictions);
      })
      .catch((err) => {
        console.error("Error fetching predictions:", err);
      });

    // Fetch Dashboard Data
    console.log(`${BASE_URL}/dashboard_data`);
    apiJson(`${BASE_URL}/dashboard_data`, {}, { retries: 4, baseDelay: 2000 })
      .then((data) => {
        if (!data || !Array.isArray(data.app_usage_percentages)) {
          throw new Error(data?.error || "Invalid dashboard_data response");
        }
        data.app_usage_percentages.sort((a, b) => b.percentage - a.percentage);
        setDashboardData(data);
        setLoading(false);
      })
      .catch((error) => {
        console.error("Error fetching data:", error);
        setError(error.message || "Failed to load dashboard data");
        setLoading(false);
      });

    // Check if models exist before fetching feature importance
    Promise.all([
      apiJson(`${BASE_URL}/check_model`),
      apiJson(`${BASE_URL}/check_MLP_model`),
    ])
      .then(([xgbData, mlpData]) => {
        console.log("Model check results:", { xgbData, mlpData });
        const availability = {
          xgboost: Boolean(xgbData.model_exists),
          mlp: Boolean(mlpData.model_exists),
        };
        setModelAvailability(availability);
        if (!availability[selectedModel]) {
          if (availability.xgboost) {
            setSelectedModel("xgboost");
          } else if (availability.mlp) {
            setSelectedModel("mlp");
          }
        }

        if (xgbData.model_exists) {
          apiJson(`${BASE_URL}/feature_importance`)
            .then((data) => {
              console.log("XGBoost feature importance data:", data);
              if (data && data.feature_importance) {
                const formattedData = data.feature_importance.map((item) => ({
                  ...item,
                  feature: formatFeatureName(item.feature),
                  importance: item.importance * 100,
                }));
                setFeatureImportance(formattedData);
              } else {
                console.warn(
                  "XGBoost feature importance data is not in expected format"
                );
                setFeatureImportance([]);
              }
            })
            .catch((error) => {
              console.error(
                "Error fetching XGBoost feature importance:",
                error
              );
              setFeatureImportance([]);
            });
        }
        if (mlpData.model_exists) {
          apiJson(`${BASE_URL}/feature_importance_MLP`)
            .then((data) => {
              console.log("MLP feature importance data:", data);
              if (data && data.feature_importance) {
                const formattedData = data.feature_importance.map((item) => ({
                  ...item,
                  feature: formatFeatureName(item.feature),
                  importance: item.importance * 100,
                }));
                setMlpFeatureImportance(formattedData);
              } else {
                console.warn(
                  "MLP feature importance data is not in expected format"
                );
                setMlpFeatureImportance([]);
              }
            })
            .catch((error) => {
              console.error("Error fetching MLP feature importance:", error);
              setMlpFeatureImportance([]);
            });
        }
      })
      .catch((error) => {
        console.error("Error checking model existence:", error);
      });

    // Fetch carrier distribution data
    const fetchCarrierDistribution = async () => {
      try {
        const data = await apiJson(`${BASE_URL}/carrier_distribution`);
        setCarrierData(data.carrier_distribution || []);
      } catch (err) {
        console.error("Error fetching carrier distribution:", err);
      }
    };

    fetchCarrierDistribution();

    // Fetch return analysis data
    apiJson(`${BASE_URL}/return_analysis`)
      .then((data) => {
        setReturnData(normalizeReturnAnalysisPayload(data));
      })
      .catch((error) => {
        console.error("Error fetching return analysis:", error);
        setReturnData(emptyReturnAnalysis);
      });

    // Fetch time analysis data
    apiJson(`${BASE_URL}/time_analysis`)
      .then((data) => {
        setUsageData(data.usage_duration);
      })
      .catch((error) => {
        console.error("Error fetching time analysis:", error);
      });
    // Add new fetch for correlation data
    apiJson(`${BASE_URL}/feature_heatmap_data`)
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setCorrelationData(data);
        } else {
          console.warn("No correlation data available or empty data returned");
          setCorrelationData([]);
        }
      })
      .catch((error) => {
        console.error("Error fetching correlation data:", error);
        setCorrelationData([]);
      });
  }, [modelTrained, BASE_URL, riskThreshold]);

  // Handle File Drop
  const handleDrop = (event) => {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files[0];
    if (file && file.type === "text/csv") {
      setSelectedFile(file);
    } else {
      toast({ message: "Please upload a valid CSV file.", variant: "warning" });
    }
  };

  // Handle File Selection
  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file && file.type === "text/csv") {
      setSelectedFile(file);
    } else {
      toast({ message: "Please upload a valid CSV file.", variant: "warning" });
      setSelectedFile(null);
    }
  };

  // Handle Prediction Generation & Redirect
  const handleGenerateNewPrediction = async () => {
    if (!selectedFile) return;
    if (!modelAvailability[selectedModel]) {
      const modelName = selectedModel === "xgboost" ? "XGBoost" : "MLP";
      toast({ message: `${modelName} is not trained yet. Train the model first from the Model Training page.`, variant: "warning", duration: 6000 });
      return;
    }

    setIsProcessing(true);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

      // Use the appropriate endpoint based on selected model
      const endpoint =
        selectedModel === "xgboost"
          ? `${BASE_URL}/predict_batch`
          : `${BASE_URL}/predict_batch_MLP`;

      const response = await apiFetch(endpoint, {
        method: "POST",
        body: formData,
      }, { retries: 1, baseDelay: 2500 });

      const data = await response.json();

      if (response.ok) {
        const RISK_THRESHOLD = 0.5;
        const riskyCustomers = data.predictions.filter(
          (p) => p.churn_probability > RISK_THRESHOLD
        );

        const now = new Date();
        const newPredictionMeta = {
          fileName: selectedFile.name,
          date: now.toLocaleDateString(undefined, {
            year: "numeric",
            month: "short",
            day: "numeric",
          }),
          time: now.toLocaleTimeString(undefined, {
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
          }),
          riskyCustomers: riskyCustomers.length,
          totalCustomers: data.predictions.length,
          modelType: selectedModel,
          predictionBatchId: data.batch_id,
          timestamp: now.getTime(),
        };

        // Update predictions array, keeping only the 5 most recent
        const updatedPredictions = [newPredictionMeta, ...predictions].slice(
          0,
          5
        );
        setPredictions(updatedPredictions);

        setShowModal(false);
        setSelectedFile(null);
        setIsProcessing(false);

        // Navigate to Prediction Results Page
        navigate(`/${encodeURIComponent(selectedFile.name)}`, {
          state: { predictions: data.predictions, modelType: selectedModel },
        });
      } else {
        const message = data?.error || "Error generating predictions.";
        toast({ message, variant: "danger" });
      }
    } catch (error) {
      console.error("Prediction error:", error);
      toast({ message: error.message || "Failed to generate predictions.", variant: "danger" });
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle Removing a Prediction
  const handleRemovePrediction = async (batchId) => {
    try {
      console.log(batchId);
      const response = await apiFetch(
        `${BASE_URL}/delete_prediction_batch/${batchId}`,
        {
          method: "DELETE",
        }
      );

      if (response.ok) {
        const updatedPredictions = predictions.filter(
          (prediction) =>
            String(prediction.predictionBatchId) !== String(batchId)
        );
        setPredictions(updatedPredictions);

        // Also update allPredictions if it's loaded
        if (allPredictions.length > 0) {
          const updatedAllPredictions = allPredictions.filter(
            (prediction) =>
              String(prediction.predictionBatchId) !== String(batchId)
          );
          setAllPredictions(updatedAllPredictions);
        }
      } else {
        const errorData = await response.json();
        console.error("Error deleting batch:", errorData.error || response.statusText);
        toast({ message: "Failed to delete the prediction batch.", variant: "danger" });
      }
    } catch (err) {
      console.error("Error:", err);
      toast({ message: "An error occurred while deleting the prediction batch.", variant: "danger" });
    }
  };

  // Fetch all predictions
  const fetchAllPredictions = async () => {
    setIsLoadingAllPredictions(true);
    try {
      const data = await apiJson(`${BASE_URL}/predictions?limit=100`);

      const parsed = Object.values(data).map((item, index) => {
        const predictionsArray = Array.isArray(item.predictions)
          ? item.predictions
          : [];
        const predictionDate = new Date(item.prediction_date);
        return {
          fileName: item.upload_file,
          date: predictionDate.toLocaleDateString(undefined, {
            year: "numeric",
            month: "short",
            day: "numeric",
          }),
          time: predictionDate.toLocaleTimeString(undefined, {
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
          }),
          riskyCustomers: predictionsArray.filter(
            (p) => p.churn_probability > riskThreshold / 100
          ).length,
          predictions: predictionsArray,
          modelType: item.model_type,
          predictionBatchId: Object.keys(data)[index],
          timestamp: predictionDate.getTime(),
        };
      });

      // Sort by timestamp in descending order (most recent first)
      const sortedPredictions = parsed.sort(
        (a, b) => b.timestamp - a.timestamp
      );
      setAllPredictions(sortedPredictions);
      setShowAllPredictionsModal(true);
    } catch (error) {
      console.error("Error fetching all predictions:", error);
      toast({ message: "Failed to fetch all predictions. Please try again.", variant: "danger" });
    } finally {
      setIsLoadingAllPredictions(false);
    }
  };

  // Close all predictions modal
  const closeAllPredictionsModal = () => {
    setShowAllPredictionsModal(false);
    setSearchTerm("");
    setCurrentPage(1);
  };

  const [showClearAllConfirm, setShowClearAllConfirm] = useState(false);

  // Handle clear all predictions
  const handleClearAllPredictions = async () => {
    setShowClearAllConfirm(false);
    try {
      const response = await apiFetch(`${BASE_URL}/delete_all_predictions`, {
        method: "DELETE",
      });

      if (response.ok) {
        setAllPredictions([]);
        setPredictions([]);
        toast({ message: "All predictions deleted successfully.", variant: "info" });
      } else {
        const errorData = await response.json();
        console.error("Error deleting all predictions:", errorData.error || response.statusText);
        toast({ message: "Failed to delete all predictions. Please try again.", variant: "danger" });
      }
    } catch (err) {
      console.error("Error:", err);
      toast({ message: "An error occurred while deleting all predictions.", variant: "danger" });
    }
  };

  // Handle sorting
  const handleSort = (key) => {
    let direction = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  // Filter and sort predictions
  const getFilteredAndSortedPredictions = () => {
    let filteredPredictions = allPredictions;

    // Apply search filter
    if (searchTerm) {
      filteredPredictions = allPredictions.filter(
        (prediction) =>
          prediction.fileName
            .toLowerCase()
            .includes(searchTerm.toLowerCase()) ||
          prediction.date.toLowerCase().includes(searchTerm.toLowerCase()) ||
          prediction.modelType.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply sorting
    return [...filteredPredictions].sort((a, b) => {
      if (sortConfig.key === "timestamp") {
        return sortConfig.direction === "asc"
          ? a.timestamp - b.timestamp
          : b.timestamp - a.timestamp;
      } else if (sortConfig.key === "fileName") {
        return sortConfig.direction === "asc"
          ? a.fileName.localeCompare(b.fileName)
          : b.fileName.localeCompare(a.fileName);
      } else if (sortConfig.key === "modelType") {
        return sortConfig.direction === "asc"
          ? a.modelType.localeCompare(b.modelType)
          : b.modelType.localeCompare(a.modelType);
      } else if (sortConfig.key === "riskyCustomers") {
        return sortConfig.direction === "asc"
          ? a.riskyCustomers - b.riskyCustomers
          : b.riskyCustomers - a.riskyCustomers;
      }
      return 0;
    });
  };

  // Get current page predictions
  const getCurrentPagePredictions = () => {
    const filteredAndSorted = getFilteredAndSortedPredictions();
    const indexOfLastPrediction = currentPage * predictionsPerPage;
    const indexOfFirstPrediction = indexOfLastPrediction - predictionsPerPage;
    return filteredAndSorted.slice(
      indexOfFirstPrediction,
      indexOfLastPrediction
    );
  };

  // Calculate total pages
  const totalPages = Math.ceil(
    getFilteredAndSortedPredictions().length / predictionsPerPage
  );

  // Handle page change
  const handlePageChange = (pageNumber) => {
    setCurrentPage(pageNumber);
  };

  // Modify the page change function to include scrolling
  const handleDashboardPageChange = (newPage) => {
    setPage(newPage);
    scrollToDashboardTitle();
  };

  const hasDashboardContent = Boolean(
    dashboardData && (
      (dashboardData.total_users ?? 0) > 0 ||
      (dashboardData.churn_counts_per_month?.length ?? 0) > 0 ||
      (dashboardData.age_range_counts?.length ?? 0) > 0 ||
      (dashboardData.activation_counts?.length ?? 0) > 0 ||
      (dashboardData.app_usage_percentages?.length ?? 0) > 0 ||
      (carrierData?.length ?? 0) > 0 ||
      (returnData?.source_distribution?.length ?? 0) > 0 ||
      (usageData?.length ?? 0) > 0 ||
      (correlationData?.length ?? 0) > 0
    )
  );

  const pages = hasDashboardContent
    ? [
      {
        title: "Model drivers",
        description: "Compare which customer signals influence each model most.",
        content: (
          <Row>
            <Col md={6}>
              <Card className="h-100 border-0 shadow-sm">
                <Card.Body className="p-0">
                  {featureImportance.length > 0 ? (
                    <FeatureImportanceChart
                      data={featureImportance}
                      modelType="xgboost"
                    />
                  ) : (
                    <div className="text-center py-4">
                      <p className="text-muted">No XGBoost model available</p>
                    </div>
                  )}
                </Card.Body>
              </Card>
            </Col>
            <Col md={6}>
              <Card className="h-100 border-0 shadow-sm">
                <Card.Body className="p-0">
                  {mlpFeatureImportance && mlpFeatureImportance.length > 0 ? (
                    <FeatureImportanceChart
                      data={mlpFeatureImportance}
                      modelType="mlp"
                    />
                  ) : (
                    <div className="text-center py-4">
                      <p className="text-muted">No MLP model available</p>
                    </div>
                  )}
                </Card.Body>
              </Card>
            </Col>
          </Row>
        ),
      },
      {
        title: "Churn trend",
        description: "Track how churn volume changes across reporting periods.",
        content: (
          <Row>
            <Col md={12}>
              <ChurnCountsChart data={dashboardData.churn_counts_per_month} />
            </Col>
          </Row>
        ),
      },
      {
        title: "Customer profile",
        description: "Explore age segments and activation patterns side by side.",
        content: (
          <Row>
            <Col md={6}>
              <AgeRangeChart data={dashboardData.age_range_counts} />
            </Col>
            <Col md={6}>
              <ActivationCountsChart data={dashboardData.activation_counts} />
            </Col>
          </Row>
        ),
      },
      {
        title: "Product engagement",
        description: "Understand app usage and carrier mix across the customer base.",
        content: (
          <Row>
            <Col md={6}>
              <Card className="h-100 border-0 shadow-sm">
                <Card.Body className="p-0">
                  <AppUsageChart data={dashboardData.app_usage_percentages} />
                </Card.Body>
              </Card>
            </Col>
            <Col md={6}>
              <Card className="h-100 border-0 shadow-sm">
                <Card.Body className="p-0">
                  <CarrierDistributionChart data={carrierData} />
                </Card.Body>
              </Card>
            </Col>
          </Row>
        ),
      },
      {
        title: "Returns and tenure",
        description: "Review return outcomes alongside customer usage duration.",
        content: (
          <Row>
            <Col md={6}>
              <Card className="h-100 border-0 shadow-sm">
                <Card.Body className="p-0">
                  <ReturnAnalysisChart data={returnData} />
                </Card.Body>
              </Card>
            </Col>
            <Col md={6}>
              <Card className="h-100 border-0 shadow-sm">
                <Card.Body className="p-0">
                  <UsageDurationChart data={usageData} />
                </Card.Body>
              </Card>
            </Col>
          </Row>
        ),
      },
      {
        title: "Feature relationships",
        description: "Inspect correlations between the variables used in analysis.",
        content: (
          <Row>
            <Col md={12}>
              <CorrelationHeatmap data={correlationData} />
            </Col>
          </Row>
        ),
      },
    ]
    : [];

  const currentPageContent = pages[page]?.content || null;

  // Add a function to scroll to the dashboard title
  const scrollToDashboardTitle = () => {
    if (dashboardTitleRef.current) {
      dashboardTitleRef.current.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  };

  if (loading) {
    return (
      <div className="page-state" role="status" aria-live="polite">
        <Spinner animation="border" />
        <div>
          <h1>Preparing your workspace</h1>
          <p>Loading analytics, model insights, and recent predictions.</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-state page-state-error" role="alert">
        <span className="state-kicker">Connection issue</span>
        <div>
          <h1>We couldn’t load the analytics workspace</h1>
          <p>{error}</p>
        </div>
        <Button onClick={() => window.location.reload()}>Try again</Button>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      <Container fluid className="dashboard-content">
        <section className="dashboard-hero" aria-labelledby="dashboard-title">
          <div>
            <span className="eyebrow">Customer intelligence</span>
            <h1 id="dashboard-title" ref={dashboardTitleRef}>
              Find the customers who need attention next.
            </h1>
            <p>
              Monitor churn signals, compare model drivers, and turn batch
              predictions into a focused retention workflow.
            </p>
            <div className="dashboard-summary" aria-label="Workspace summary">
              <span><strong>{pages.length}</strong> insight views</span>
              <span><strong>{predictions.length}</strong> recent batches</span>
              <span><strong>{riskThreshold}%</strong> risk threshold</span>
            </div>
          </div>
          <div className="hero-actions">
            <Button
              className="primary-action"
              onClick={() => setShowDashboardUploadModal(true)}
            >
              <FaUpload aria-hidden="true" />
              Upload customer data
            </Button>
            <Button
              variant="outline-danger"
              onClick={() => setShowResetDashboardConfirm(true)}
              className="quiet-danger-action"
            >
              <FaTrashAlt aria-hidden="true" />
              Reset data
            </Button>
          </div>
        </section>

        <section className="insights-section" aria-labelledby="insights-heading">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Analytics overview</span>
              <h2 id="insights-heading">
                {pages[page]?.title || "Customer insights"}
              </h2>
              <p>{pages[page]?.description || "Upload a dataset to begin exploring customer patterns."}</p>
            </div>
            {pages.length > 0 && (
              <span className="view-counter">View {page + 1} of {pages.length}</span>
            )}
          </div>

          <Row className="g-4 dashboard-chart-grid">
          {currentPageContent || (
            <Col>
              <Card className="empty-state-card">
                <Card.Body className="empty-state">
                  <FaChartLine aria-hidden="true" />
                  <div>
                    <h3>Your analytics canvas is ready</h3>
                    <p>Upload CSV or XLSX customer data to populate trends, segments, and model insights.</p>
                  </div>
                  <Button onClick={() => setShowDashboardUploadModal(true)}>
                    Upload dashboard data
                  </Button>
                </Card.Body>
              </Card>
            </Col>
          )}
        </Row>

        {pages.length > 1 && <Row className="mt-3">
          <Col className="d-flex justify-content-center">
            <Pagination aria-label="Analytics views">
              <Pagination.First
                onClick={() => handleDashboardPageChange(0)}
                disabled={page === 0}
                className="mx-1"
              />
              <Pagination.Prev
                onClick={() => handleDashboardPageChange(page - 1)}
                disabled={page === 0}
                className="mx-1"
              />
              {Array.from({ length: pages.length }, (_, i) => (
                <Pagination.Item
                  key={i}
                  active={i === page}
                  onClick={() => handleDashboardPageChange(i)}
                  className="mx-1"
                  aria-label={`Show ${pages[i].title}`}
                >
                  {i + 1}
                </Pagination.Item>
              ))}
              <Pagination.Next
                onClick={() => handleDashboardPageChange(page + 1)}
                disabled={page === pages.length - 1}
                className="mx-1"
              />
              <Pagination.Last
                onClick={() => handleDashboardPageChange(pages.length - 1)}
                disabled={page === pages.length - 1}
                className="mx-1"
              />
            </Pagination>
          </Col>
        </Row>}
        </section>
      </Container>

      {/* Predictions Section */}
      <Row className="dashboard-predictions-row mx-0">
        <Col>
          <Card
            className="prediction-history-card p-3 p-md-4 mb-4"
          >
            <div className="section-heading prediction-heading mb-4">
              <div>
                <Card.Title
                  className="mb-1 d-flex align-items-center gap-2"
                >
                  <FaChartLine className="text-primary" />
                  Most Recent Predictions
                </Card.Title>
                <p className="text-muted small mb-0">
                  View and manage your prediction results
                </p>
              </div>
              <div className="section-actions">
                <Button
                  variant="outline-primary"
                  onClick={fetchAllPredictions}
                  className="d-flex align-items-center gap-2"
                >
                  <FaTable /> View all
                </Button>
                <Button
                  variant="primary"
                  onClick={() => setShowModal(true)}
                  className="d-flex align-items-center gap-2"
                >
                  <FaChartLine /> New prediction
                </Button>
              </div>
            </div>
            <Table responsive hover className="align-middle mb-0">
              <thead>
                <tr>
                  <th className="px-3">File Name</th>
                  <th className="px-3">Upload Date & Time</th>
                  <th className="px-3">Model</th>
                  <th className="px-3">Risky Customers</th>
                  <th className="px-3"></th>
                </tr>
              </thead>
              <tbody>
                {predictions.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-5">
                      <div className="d-flex flex-column align-items-center">
                        <FaTable
                          className="mb-3"
                          size={32}
                          style={{ color: "#adb5bd" }}
                        />
                        <p className="mb-0 fs-6" style={{ color: "#6c757d" }}>
                          No predictions available
                        </p>
                        <p className="text-muted small mb-0">
                          Upload a CSV file to generate predictions
                        </p>
                        <Button
                          variant="outline-primary"
                          size="sm"
                          className="mt-3"
                          onClick={() => setShowModal(true)}
                          style={{
                            borderRadius: "8px",
                            borderWidth: "1.5px",
                          }}
                        >
                          Generate Your First Prediction
                        </Button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  predictions.map((prediction) => {
                    return (
                      <tr key={prediction.predictionBatchId}>
                        <td className="px-3">
                          <Link
                            to={`/${prediction.fileName}`}
                            state={{
                              predictions: prediction.predictions,
                              modelType: prediction.modelType,
                            }}
                            className="text-decoration-none d-flex align-items-center gap-2"
                            style={{
                              transition: "all 0.2s ease",
                              color: "#3498db",
                              fontWeight: "500",
                            }}
                            onMouseOver={(e) => {
                              e.currentTarget.style.color = "#2980b9";
                              e.currentTarget.style.transform =
                                "translateX(3px)";
                            }}
                            onMouseOut={(e) => {
                              e.currentTarget.style.color = "#3498db";
                              e.currentTarget.style.transform = "translateX(0)";
                            }}
                          >
                            <FaTable />
                            {prediction.fileName}
                          </Link>
                        </td>
                        <td className="px-3">
                          <div className="d-flex flex-column">
                            <span className="fw-medium">{prediction.date}</span>
                            <small className="text-muted">
                              at {prediction.time}
                            </small>
                          </div>
                        </td>
                        <td className="px-3">
                          <Badge
                            bg={
                              prediction.modelType === "xgboost"
                                ? "primary"
                                : "success"
                            }
                            className="px-3 py-2"
                          >
                            {prediction.modelType.toUpperCase()}
                          </Badge>
                        </td>
                        <td className="px-3">
                          <div className="d-flex align-items-center gap-2">
                            <span className="fw-bold text-danger">
                              {prediction.riskyCustomers}
                            </span>
                            <small className="text-muted">
                              of {prediction.predictions.length}
                            </small>
                          </div>
                        </td>
                        <td className="px-3">
                          <Button
                            variant="link"
                            className="p-0"
                            onClick={() => handleRemovePrediction(prediction.predictionBatchId)}
                            title="Remove prediction"
                            style={{
                              transition: "all 0.2s ease",
                              color: "#e74c3c",
                              padding: "0.25rem",
                            }}
                            onMouseOver={(e) => {
                              e.currentTarget.style.transform = "scale(1.2)";
                              e.currentTarget.style.color = "#c0392b";
                            }}
                            onMouseOut={(e) => {
                              e.currentTarget.style.transform = "scale(1)";
                              e.currentTarget.style.color = "#e74c3c";
                            }}
                          >
                            <FaTimes />
                          </Button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </Table>
          </Card>
        </Col>

        {/* Modal for File Upload */}
        <Modal
          show={showModal}
          onHide={() => setShowModal(false)}
          size="lg"
          centered
        >
          <Modal.Header closeButton className="border-0 pb-0">
            <Modal.Title
              className="d-flex align-items-center gap-2"
              style={{ fontWeight: "600" }}
            >
              <FaChartLine className="text-primary" />
              Generate New Prediction
            </Modal.Title>
          </Modal.Header>
          <Modal.Body className="pt-4">
            {/* Add Model Selection Dropdown */}
            <div className="mb-4">
              <label
                htmlFor="modelSelect"
                className="form-label"
                style={{ fontWeight: "500" }}
              >
                Select Model
              </label>
              <select
                id="modelSelect"
                className="form-select"
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                style={{
                  borderRadius: "8px",
                  border: "1px solid #ced4da",
                  padding: "0.5rem 1rem",
                  boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
                }}
              >
                <option value="xgboost" disabled={!modelAvailability.xgboost}>
                  XGBoost Model{modelAvailability.xgboost ? "" : " (train first)"}
                </option>
                <option value="mlp" disabled={!modelAvailability.mlp}>
                  MLP Model{modelAvailability.mlp ? "" : " (train first)"}
                </option>
              </select>
              {!modelAvailability.xgboost && !modelAvailability.mlp && (
                <div className="text-danger small mt-2">
                  No trained model is available on the deployed backend. Train a model first from the Training page.
                </div>
              )}
            </div>

            <div
              className={`border p-5 rounded-4 ${dragging
                ? "border-primary bg-primary bg-opacity-10"
                : "border-dashed bg-light"
                }`}
              style={{
                cursor: "pointer",
                transition: "all 0.3s ease",
                minHeight: "200px",
                borderRadius: "12px",
                borderWidth: "2px",
                boxShadow: "0 4px 8px rgba(0,0,0,0.05)",
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              onClick={() => document.getElementById("fileInput").click()}
            >
              <input
                type="file"
                id="fileInput"
                accept=".csv"
                onChange={handleFileSelect}
                style={{ display: "none" }}
              />
              {selectedFile ? (
                <div className="d-flex flex-column align-items-center">
                  <div className="d-flex align-items-center mb-4">
                    <i
                      className="fas fa-file-csv text-success me-3"
                      style={{ fontSize: "2rem" }}
                    ></i>
                    <p className="fw-bold text-success mb-0 fs-5">
                      {selectedFile.name}
                    </p>
                  </div>
                  <Button
                    variant="outline-danger"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedFile(null);
                    }}
                    className="px-4"
                    style={{
                      borderRadius: "8px",
                      borderWidth: "1.5px",
                    }}
                  >
                    Remove File
                  </Button>
                </div>
              ) : (
                <div className="text-center">
                  <i className="fas fa-cloud-upload-alt fa-4x text-muted mb-4"></i>
                  <h5 className="mb-2" style={{ fontWeight: "500" }}>
                    Drag & drop your CSV file here
                  </h5>
                  <p className="text-muted mb-3">or click to browse</p>
                  <Button
                    variant="outline-primary"
                    className="px-4"
                    onClick={(e) => {
                      e.stopPropagation();
                      document.getElementById("fileInput").click();
                    }}
                    style={{
                      borderRadius: "8px",
                      borderWidth: "1.5px",
                    }}
                  >
                    Select File
                  </Button>
                  <p className="text-muted mt-3 small">
                    Supported format: CSV files only
                  </p>
                </div>
              )}
            </div>
          </Modal.Body>
          <Modal.Footer className="border-0 pt-0">
            <Button
              variant="secondary"
              onClick={() => setShowModal(false)}
              className="px-4"
              style={{
                borderRadius: "8px",
                borderWidth: "1.5px",
              }}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleGenerateNewPrediction}
              disabled={!selectedFile || isProcessing || !modelAvailability[selectedModel]}
              className="px-4"
              style={{
                borderRadius: "8px",
                background: "linear-gradient(135deg, #3498db 0%, #2980b9 100%)",
                border: "none",
                fontWeight: "500",
              }}
            >
              {isProcessing ? (
                <>
                  <Spinner
                    as="span"
                    animation="border"
                    size="sm"
                    className="me-2"
                  />
                  Processing...
                </>
              ) : (
                "Generate Prediction"
              )}
            </Button>
          </Modal.Footer>
        </Modal>

        <Modal
          show={showDashboardUploadModal}
          onHide={() => setShowDashboardUploadModal(false)}
          size="lg"
          centered
        >
          <Modal.Header closeButton className="border-0 pb-0">
            <Modal.Title className="d-flex align-items-center gap-2" style={{ fontWeight: "600" }}>
              <FaUpload className="text-primary" />
              Upload Dashboard Data
            </Modal.Title>
          </Modal.Header>
          <Modal.Body className="pt-4">
            <div
              className={`border p-5 rounded-4 ${dragging
                ? "border-success bg-success bg-opacity-10"
                : "border-dashed bg-light"
                }`}
              style={{
                cursor: "pointer",
                transition: "all 0.3s ease",
                minHeight: "200px",
                borderRadius: "12px",
                borderWidth: "2px",
                boxShadow: "0 4px 8px rgba(0,0,0,0.05)",
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                const file = e.dataTransfer.files[0];
                if (file) handleDashboardFileSelect({ target: { files: [file] } });
              }}
              onClick={() => document.getElementById("dashboardFileInput").click()}
            >
              <input
                type="file"
                id="dashboardFileInput"
                accept=".csv, .xlsx"
                onChange={handleDashboardFileSelect}
                style={{ display: "none" }}
              />
              {dashboardFile ? (
                <div className="text-center">
                  <p className="fw-bold text-success fs-5">{dashboardFile.name}</p>
                  <Button
                    variant="outline-danger"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDashboardFile(null);
                    }}
                    className="px-4"
                  >
                    Remove File
                  </Button>
                </div>
              ) : (
                <div className="text-center">
                  <i className="fas fa-cloud-upload-alt fa-4x text-muted mb-4"></i>
                  <h5 className="mb-2" style={{ fontWeight: "500" }}>
                    Drag & drop your file here
                  </h5>
                  <p className="text-muted mb-3">or click to browse</p>
                  <Button
                    variant="outline-success"
                    className="px-4"
                    onClick={(e) => {
                      e.stopPropagation();
                      document.getElementById("dashboardFileInput").click();
                    }}
                  >
                    Select File
                  </Button>
                  <p className="text-muted mt-3 small">
                    Supported formats: CSV or XLSX
                  </p>
                </div>
              )}
            </div>
          </Modal.Body>
          <Modal.Footer className="border-0 pt-0">
            <Button
              variant="secondary"
              onClick={() => setShowDashboardUploadModal(false)}
              className="px-4"
              style={{
                borderRadius: "8px",
                borderWidth: "1.5px",
              }}
            >
              Cancel
            </Button>
            <Button
              variant="success"
              onClick={handleUploadDashboardData}
              disabled={!dashboardFile || isUploadingDashboard}
              className="px-4"
              style={{
                borderRadius: "8px",
                background: "linear-gradient(135deg, #27ae60 0%, #219150 100%)",
                border: "none",
                fontWeight: "500",
              }}
            >
              {isUploadingDashboard ? (
                <>
                  <Spinner
                    as="span"
                    animation="border"
                    size="sm"
                    className="me-2"
                  />
                  Uploading...
                </>
              ) : (
                "Upload Dashboard Data"
              )}
            </Button>
          </Modal.Footer>
        </Modal>


        {/* Modal for All Predictions */}
        <Modal
          show={showAllPredictionsModal}
          onHide={closeAllPredictionsModal}
          size="xl"
          centered
          className="all-predictions-modal"
        >
          <Modal.Header closeButton className="border-0 pb-0">
            <Modal.Title
              className="d-flex align-items-center gap-2"
              style={{ fontWeight: "600" }}
            >
              <FaTable className="text-primary" />
              All Predictions
            </Modal.Title>
          </Modal.Header>
          <Modal.Body className="pt-4">
            {isLoadingAllPredictions ? (
              <div className="text-center py-5">
                <Spinner animation="border" role="status">
                  <span className="visually-hidden">Loading...</span>
                </Spinner>
                <p className="mt-3 text-muted">Loading all predictions...</p>
              </div>
            ) : (
              <>
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <div className="d-flex align-items-center">
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Search by filename, date, or model..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      style={{ width: "300px" }}
                    />
                    {searchTerm && (
                      <Button
                        variant="link"
                        className="ms-2 p-0"
                        onClick={() => setSearchTerm("")}
                      >
                        <FaTimes />
                      </Button>
                    )}
                  </div>
                  <div className="d-flex gap-2">
                    <Button
                      variant="outline-danger"
                      size="sm"
                      onClick={() => setShowClearAllConfirm(true)}
                      className="d-flex align-items-center gap-1"
                    >
                      <FaTrashAlt className="me-1" /> Clear All
                    </Button>
                  </div>
                </div>
                <div
                  style={{
                    maxHeight: "60vh",
                    overflowY: "auto",
                    borderRadius: "8px",
                    border: "1px solid #e9ecef",
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
                      <tr>
                        <th
                          className="px-3"
                          style={{ cursor: "pointer" }}
                          onClick={() => handleSort("fileName")}
                        >
                          File Name{" "}
                          {sortConfig.key === "fileName" &&
                            (sortConfig.direction === "asc" ? "↑" : "↓")}
                        </th>
                        <th
                          className="px-3"
                          style={{ cursor: "pointer" }}
                          onClick={() => handleSort("timestamp")}
                        >
                          Upload Date & Time{" "}
                          {sortConfig.key === "timestamp" &&
                            (sortConfig.direction === "asc" ? "↑" : "↓")}
                        </th>
                        <th
                          className="px-3"
                          style={{ cursor: "pointer" }}
                          onClick={() => handleSort("modelType")}
                        >
                          Model{" "}
                          {sortConfig.key === "modelType" &&
                            (sortConfig.direction === "asc" ? "↑" : "↓")}
                        </th>
                        <th
                          className="px-3"
                          style={{ cursor: "pointer" }}
                          onClick={() => handleSort("riskyCustomers")}
                        >
                          Risky Customers{" "}
                          {sortConfig.key === "riskyCustomers" &&
                            (sortConfig.direction === "asc" ? "↑" : "↓")}
                        </th>
                        <th className="px-3"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {getCurrentPagePredictions().length === 0 ? (
                        <tr>
                          <td colSpan={5} className="text-center py-5">
                            <div className="d-flex flex-column align-items-center">
                              <FaTable
                                className="mb-3"
                                size={32}
                                style={{ color: "#adb5bd" }}
                              />
                              <p
                                className="mb-0 fs-6"
                                style={{ color: "#6c757d" }}
                              >
                                {searchTerm
                                  ? "No predictions match your search"
                                  : "No predictions available"}
                              </p>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        getCurrentPagePredictions().map((prediction) => {
                          return (
                            <tr key={prediction.predictionBatchId}>
                              <td className="px-3">
                                <Link
                                  to={`/${prediction.fileName}`}
                                  state={{
                                    predictions: prediction.predictions,
                                    modelType: prediction.modelType,
                                  }}
                                  className="text-decoration-none d-flex align-items-center gap-2"
                                  style={{
                                    transition: "all 0.2s ease",
                                    color: "#3498db",
                                    fontWeight: "500",
                                  }}
                                  onMouseOver={(e) => {
                                    e.currentTarget.style.color = "#2980b9";
                                    e.currentTarget.style.transform =
                                      "translateX(3px)";
                                  }}
                                  onMouseOut={(e) => {
                                    e.currentTarget.style.color = "#3498db";
                                    e.currentTarget.style.transform =
                                      "translateX(0)";
                                  }}
                                >
                                  <FaTable />
                                  {prediction.fileName}
                                </Link>
                              </td>
                              <td className="px-3">
                                <div className="d-flex flex-column">
                                  <span className="fw-medium">
                                    {prediction.date}
                                  </span>
                                  <small className="text-muted">
                                    at {prediction.time}
                                  </small>
                                </div>
                              </td>
                              <td className="px-3">
                                <Badge
                                  bg={
                                    prediction.modelType === "xgboost"
                                      ? "primary"
                                      : "success"
                                  }
                                  className="px-3 py-2"
                                >
                                  {prediction.modelType.toUpperCase()}
                                </Badge>
                              </td>
                              <td className="px-3">
                                <div className="d-flex align-items-center gap-2">
                                  <span className="fw-bold text-danger">
                                    {prediction.riskyCustomers}
                                  </span>
                                  <small className="text-muted">
                                    of {prediction.predictions.length}
                                  </small>
                                </div>
                              </td>
                              <td className="px-3">
                                <Button
                                  variant="link"
                                  className="p-0"
                                  onClick={() => handleRemovePrediction(prediction.predictionBatchId)}
                                  title="Remove prediction"
                                  style={{
                                    transition: "all 0.2s ease",
                                    color: "#e74c3c",
                                    padding: "0.25rem",
                                  }}
                                  onMouseOver={(e) => {
                                    e.currentTarget.style.transform = "scale(1.2)";
                                    e.currentTarget.style.color = "#c0392b";
                                  }}
                                  onMouseOut={(e) => {
                                    e.currentTarget.style.transform = "scale(1)";
                                    e.currentTarget.style.color = "#e74c3c";
                                  }}
                                >
                                  <FaTimes />
                                </Button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </Table>
                </div>
                {totalPages > 1 && (
                  <div className="d-flex justify-content-center mt-3">
                    <Pagination>
                      <Pagination.First
                        onClick={() => handlePageChange(1)}
                        disabled={currentPage === 1}
                      />
                      <Pagination.Prev
                        onClick={() => handlePageChange(currentPage - 1)}
                        disabled={currentPage === 1}
                      />
                      {Array.from({ length: totalPages }, (_, i) => i + 1)
                        .filter(
                          (page) =>
                            page === 1 ||
                            page === totalPages ||
                            (page >= currentPage - 1 && page <= currentPage + 1)
                        )
                        .map((page, index, array) => {
                          // Add ellipsis if there's a gap
                          if (index > 0 && array[index - 1] !== page - 1) {
                            return (
                              <React.Fragment key={`ellipsis-${page}`}>
                                <Pagination.Ellipsis disabled />
                                <Pagination.Item
                                  active={page === currentPage}
                                  onClick={() => handlePageChange(page)}
                                >
                                  {page}
                                </Pagination.Item>
                              </React.Fragment>
                            );
                          }
                          return (
                            <Pagination.Item
                              key={page}
                              active={page === currentPage}
                              onClick={() => handlePageChange(page)}
                            >
                              {page}
                            </Pagination.Item>
                          );
                        })}
                      <Pagination.Next
                        onClick={() => handlePageChange(currentPage + 1)}
                        disabled={currentPage === totalPages}
                      />
                      <Pagination.Last
                        onClick={() => handlePageChange(totalPages)}
                        disabled={currentPage === totalPages}
                      />
                    </Pagination>
                  </div>
                )}
                <div className="d-flex justify-content-between align-items-center mt-3">
                  <div className="text-muted small">
                    Showing {getCurrentPagePredictions().length} of{" "}
                    {getFilteredAndSortedPredictions().length} predictions
                  </div>
                </div>
              </>
            )}
          </Modal.Body>
          <Modal.Footer className="border-0 pt-0">
            <Button
              variant="secondary"
              onClick={closeAllPredictionsModal}
              className="px-4"
              style={{
                borderRadius: "8px",
                borderWidth: "1.5px",
              }}
            >
              Close
            </Button>
          </Modal.Footer>
        </Modal>

        {/* Confirm Reset Dashboard Modal */}
        <Modal show={showResetDashboardConfirm} onHide={() => setShowResetDashboardConfirm(false)} centered size="sm">
          <Modal.Header closeButton className="border-0">
            <Modal.Title className="d-flex align-items-center gap-2 fs-6" style={{ fontWeight: 700 }}>
              <FaExclamationTriangle className="text-warning" /> Confirm Reset
            </Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <p className="mb-0" style={{ fontSize: "0.9rem" }}>
              This will clear all uploaded dashboard data and charts. This action cannot be undone.
            </p>
          </Modal.Body>
          <Modal.Footer className="border-0 pt-0">
            <Button variant="outline-secondary" size="sm" onClick={() => setShowResetDashboardConfirm(false)}>Cancel</Button>
            <Button variant="danger" size="sm" onClick={handleResetDashboardData}>Reset data</Button>
          </Modal.Footer>
        </Modal>

        {/* Confirm Clear All Predictions Modal */}
        <Modal show={showClearAllConfirm} onHide={() => setShowClearAllConfirm(false)} centered size="sm">
          <Modal.Header closeButton className="border-0">
            <Modal.Title className="d-flex align-items-center gap-2 fs-6" style={{ fontWeight: 700 }}>
              <FaExclamationTriangle className="text-warning" /> Delete All Predictions
            </Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <p className="mb-0" style={{ fontSize: "0.9rem" }}>
              All prediction batches will be permanently deleted. This action cannot be undone.
            </p>
          </Modal.Body>
          <Modal.Footer className="border-0 pt-0">
            <Button variant="outline-secondary" size="sm" onClick={() => setShowClearAllConfirm(false)}>Cancel</Button>
            <Button variant="danger" size="sm" onClick={handleClearAllPredictions}>Delete all</Button>
          </Modal.Footer>
        </Modal>

      </Row>

    </div>
  );
}
