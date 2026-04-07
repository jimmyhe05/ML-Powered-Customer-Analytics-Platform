import { useState, useEffect, useRef, useCallback } from "react";
import { Modal } from "react-bootstrap";
import {
  Container,
  Row,
  Col,
  Card,
  Button,
  Spinner,
  ProgressBar,
  Badge,
  Alert,
} from "react-bootstrap";
import { useNavigate } from "react-router-dom";
import Papa from "papaparse";
import { motion, AnimatePresence } from "framer-motion";

const rawApiUrl = import.meta.env.VITE_API_URL?.trim();
const BASE_URL = rawApiUrl
  ? `${rawApiUrl.startsWith("http://") || rawApiUrl.startsWith("https://")
    ? rawApiUrl
    : `https://${rawApiUrl}`
  }`.replace(/\/+$/, "")
  : "";

// Runtime guard: prevent noisy fetch attempts when the API URL isn't configured.
if (!BASE_URL) {
  console.error(
    "VITE_API_URL is not set. API requests are disabled until you set VITE_API_URL in Vercel and redeploy."
  );
}

export default function TrainingForEngineers() {
  const [csvFile, setCsvFile] = useState(null);
  const [isTraining, setIsTraining] = useState(false);
  const [modelAccuracy, setModelAccuracy] = useState(null);
  const [mlpAccuracy, setMlpAccuracy] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [currentTrainingStage, setCurrentTrainingStage] = useState("");
  const progressIntervalRef = useRef(null);
  const [error, setError] = useState(null);
  const [errorDetails, setErrorDetails] = useState(null);
  const [retryAttempted, setRetryAttempted] = useState(false);
  //const [currentStep, setCurrentStep] = useState(() => {
  //   const savedStep = localStorage.getItem("currentStep");
  //   return savedStep ? parseInt(savedStep) : 0;
  // });
  const [currentStep, setCurrentStep] = useState(0);
  const [trainingMode, setTrainingMode] = useState("incremental");
  const [speedMode, setSpeedMode] = useState("fast");
  const [forceScratchTraining, setForceScratchTraining] = useState(false);
  const [serverStatus, setServerStatus] = useState({
    checked: false,
    healthy: true,
  });
  const navigate = useNavigate();
  const [mlpProgress, setMlpProgress] = useState(0);
  const [xgbProgress, setXgbProgress] = useState(0);
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [mlpTrainingStatus, setMlpTrainingStatus] = useState("idle");
  const [xgbTrainingStatus, setXGBTrainingStatus] = useState("idle");
  const [trainingSessionId, setTrainingSessionId] = useState(() => localStorage.getItem("activeTrainingSessionId") || null);
  // values: 'idle', 'in_progress', 'completed', 'error', 'cancelled'

  const setActiveTrainingSessionId = (id) => {
    if (!id) {
      localStorage.removeItem("activeTrainingSessionId");
      setTrainingSessionId(null);
      return;
    }
    localStorage.setItem("activeTrainingSessionId", id);
    setTrainingSessionId(id);
  };

  useEffect(() => {
    // If the base URL is missing, mark server as checked but unhealthy and skip network checks.
    if (!BASE_URL) {
      setServerStatus({ checked: true, healthy: false });
      setError("VITE_API_URL missing - configure VITE_API_URL in Vercel and redeploy the frontend.");
      return;
    }

    const checkServerHealth = async () => {
      try {
        const response = await fetch(`${BASE_URL}/health`, {
          method: "GET",
          headers: { "Content-Type": "application/json" },
        });

        setServerStatus({
          checked: true,
          healthy: response.ok,
        });
      } catch (err) {
        console.error("Server health check failed:", err);
        setServerStatus({ checked: true, healthy: false });
      }
    };

    checkServerHealth();
  }, []);

  const syncTrainingStateFromBackend = useCallback(async () => {
    if (!BASE_URL) return;

    try {
      let xgbStatusData = null;
      let xgbProgressData = null;
      let mlpStatusData = null;
      let mlpProgressData = null;

      let sessionPayload = null;
      if (trainingSessionId) {
        const sessionRes = await fetch(`${BASE_URL}/training_session/${encodeURIComponent(trainingSessionId)}`);
        if (sessionRes.ok) {
          sessionPayload = await sessionRes.json();
        }
      }

      if (!sessionPayload) {
        const activeRes = await fetch(`${BASE_URL}/training_session/active`);
        if (activeRes.ok) {
          const activeData = await activeRes.json();
          if (activeData?.active && activeData?.session) {
            sessionPayload = activeData.session;
            setActiveTrainingSessionId(activeData.session.training_id);
          }
        }
      }

      if (sessionPayload) {
        xgbProgressData = sessionPayload.xgb || {};
        mlpProgressData = sessionPayload.mlp || {};
        xgbStatusData = sessionPayload.xgb || {};
        mlpStatusData = sessionPayload.mlp || {};
      } else {
        const [xgbStatusRes, xgbProgressRes, mlpStatusRes, mlpProgressRes] = await Promise.all([
          fetch(`${BASE_URL}/training_status_XGB`),
          fetch(`${BASE_URL}/training_progress_XGB`),
          fetch(`${BASE_URL}/training_status_MLP`),
          fetch(`${BASE_URL}/training_progress_MLP`),
        ]);

        [xgbStatusData, xgbProgressData, mlpStatusData, mlpProgressData] = await Promise.all([
          xgbStatusRes.json(),
          xgbProgressRes.json(),
          mlpStatusRes.json(),
          mlpProgressRes.json(),
        ]);
      }

      const xgbStatus = xgbStatusData?.status || "not_started";
      const mlpStatus = mlpStatusData?.status || "not_started";

      if (typeof xgbProgressData?.current_trial === "number") {
        const totalTrials = xgbProgressData.total_trials || 0;
        const progress = totalTrials > 0
          ? Math.floor((xgbProgressData.current_trial / totalTrials) * 100)
          : 0;
        setXgbProgress(progress);
      }

      if (typeof mlpProgressData?.current_epoch === "number") {
        const totalEpochs = mlpProgressData.total_epochs || 0;
        const progress = totalEpochs > 0
          ? Math.floor((mlpProgressData.current_epoch / totalEpochs) * 100)
          : 0;
        setMlpProgress(progress);
      }

      if (xgbStatus === "completed" && xgbStatusData?.metrics) {
        setModelAccuracy(xgbStatusData.metrics);
      }
      if (mlpStatus === "completed" && mlpStatusData?.metrics) {
        setMlpAccuracy(mlpStatusData.metrics);
      }

      if (xgbStatus === "error" || mlpStatus === "error") {
        setIsTraining(false);
        setError("Training encountered an error.");
        setErrorDetails(xgbStatusData?.message || mlpStatusData?.message || null);
        setXGBTrainingStatus(xgbStatus === "error" ? "error" : xgbStatus);
        setMlpTrainingStatus(mlpStatus === "error" ? "error" : mlpStatus);
        return;
      }

      if (xgbStatus === "cancelled" || mlpStatus === "cancelled" || sessionPayload?.overall_status === "cancelled") {
        setIsTraining(false);
        setCurrentStep(0);
        setError("Training was cancelled. Re-upload your CSV to start again.");
        setXGBTrainingStatus("cancelled");
        setMlpTrainingStatus("cancelled");
        setActiveTrainingSessionId(null);
        return;
      }

      const anyInProgress = xgbStatus === "in_progress" || mlpStatus === "in_progress";
      const bothCompleted = xgbStatus === "completed" && mlpStatus === "completed";

      if (anyInProgress) {
        setIsTraining(true);
        setCurrentStep(1);
        setCurrentTrainingStage("Training in Progress...");
      }

      if (bothCompleted) {
        setIsTraining(false);
        setCurrentStep(2);
        setXGBTrainingStatus("completed");
        setMlpTrainingStatus("completed");
        setActiveTrainingSessionId(null);
      } else {
        setXGBTrainingStatus(xgbStatus === "not_started" ? "idle" : xgbStatus);
        setMlpTrainingStatus(mlpStatus === "not_started" ? "idle" : mlpStatus);
      }
    } catch (err) {
      console.error("Failed to sync training state from backend:", err);
    }
  }, [trainingSessionId]);

  useEffect(() => {
    if (!BASE_URL) return;

    syncTrainingStateFromBackend();
    const intervalId = setInterval(syncTrainingStateFromBackend, 2500);

    return () => clearInterval(intervalId);
  }, [syncTrainingStateFromBackend]);

  const handleDrop = (event) => {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files[0];

    if (file && file.type === "text/csv") {
      setCsvFile(file);
      parseCSV(file);
    }
  };

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file && file.type === "text/csv") {
      setCsvFile(file);
      parseCSV(file);
    }
  };

  const parseCSV = (file) => {
    Papa.parse(file, {
      complete: () => {
        console.log("CSV file parsed successfully.");
      },
      header: true,
      skipEmptyLines: true,
    });
  };

  // Force model cleanup before training from scratch
  const cleanupModels = async () => {
    try {
      const response = await fetch(`${BASE_URL}/cleanup_models`, {
        method: "POST",
      });

      if (!response.ok) {
        console.warn(
          "Model cleanup request failed, but continuing with training"
        );
      }

      return true;
    } catch (err) {
      console.error("Model cleanup error:", err);
      return false;
    }
  };

  // // Update progress with a more realistic timing model
  // const updateProgressWithTiming = (estimatedSeconds, setProgress) => {
  //   if (progressIntervalRef.current) {
  //     clearInterval(progressIntervalRef.current);
  //   }

  //   const startTime = Date.now();
  //   trainingStartTimeRef.current = startTime;

  //   setProgress(5);
  //   setCurrentTrainingStage("Preparing data");

  //   let lastUpdateTime = startTime;

  //   progressIntervalRef.current = setInterval(() => {
  //     const elapsed = (Date.now() - startTime) / 1000;
  //     const elapsedSinceLastUpdate = (Date.now() - lastUpdateTime) / 1000;

  //     const progressPercent = Math.min(98, Math.floor((elapsed / estimatedSeconds) * 98));

  //     if (progressPercent < 20) {
  //       setCurrentTrainingStage("Preprocessing data");
  //     } else if (progressPercent < 40) {
  //       setCurrentTrainingStage("Training XGBoost model");
  //     } else if (progressPercent < 70) {
  //       setCurrentTrainingStage("Training XGBoost model");
  //     } else if (progressPercent < 90) {
  //       setCurrentTrainingStage("Evaluating model performance");
  //     } else {
  //       setCurrentTrainingStage("Finalizing training");
  //     }

  //     const remainingSeconds = Math.max(0, estimatedSeconds - elapsed);
  //     setEstimatedTimeRemaining(
  //       remainingSeconds < 1
  //         ? "almost complete"
  //         : `approx. ${Math.ceil(remainingSeconds)}s remaining`
  //     );

  //     setProgress(progressPercent);

  //     if (elapsedSinceLastUpdate > 5) {
  //       lastUpdateTime = Date.now();
  //     }
  //   }, 500);

  //   return () => {
  //     if (progressIntervalRef.current) {
  //       clearInterval(progressIntervalRef.current);
  //     }
  //   };
  // };

  const trainModel = async (mode = "incremental") => {
    if (!csvFile) {
      setError("Please select a CSV file first.");
      return;
    }

    if (!serverStatus.healthy) {
      setError(
        "Server appears to be offline. Please check your connection and try again."
      );
      setErrorDetails(
        `The application failed to connect to the backend server at ${BASE_URL}/`
      );
      return;
    }
    setMlpAccuracy(null);
    setModelAccuracy(null);
    setMlpTrainingStatus("idle");
    setXGBTrainingStatus("idle");
    setXgbProgress(0);
    setMlpProgress(0);

    const pollXGBTrainingStatus = () => {
      return new Promise((resolve, reject) => {
        const pollInterval = 2000;
        const timeoutLimit = 600000;
        const startTime = Date.now();

        const checkStatus = async () => {
          try {
            const res = await fetch(`${BASE_URL}/training_status_XGB`);
            const data = await res.json();

            const progressRes = await fetch(`${BASE_URL}/training_progress_XGB`);
            const progressData = await progressRes.json();

            console.log("🔄 XGBoost Status:", data, "Progress:", progressData);

            if (progressData && typeof progressData.current_trial === "number") {
              const { current_trial, total_trials } = progressData;
              const progress = total_trials > 0
                ? Math.floor((current_trial / total_trials) * 100)
                : 0;
              setXgbProgress(progress);
            }

            if (data.status === "in_progress") {
              setXGBTrainingStatus("in_progress");
            }

            if (data.status === "completed") {
              setModelAccuracy(data.metrics);
              setXGBTrainingStatus(data.status);
              resolve();
              return;
            } else if (data.status === "cancelled") {
              setError("Training was cancelled.");
              reject(new Error("cancelled"));
              return;
            } else if (data.status === "error") {
              setError("XGBoost Training failed.");
              setErrorDetails(data.message);
              reject(new Error(data.message));
              return;
            }

            if (Date.now() - startTime < timeoutLimit) {
              setTimeout(checkStatus, pollInterval);
            } else {
              setError("XGBoost training timed out.");
              reject(new Error("timeout"));
            }
          } catch (err) {
            setError("Failed to poll XGBoost training status.");
            reject(err);
          }
        };

        checkStatus();
      });
    };


    const pollMLPTrainingStatus = async () => {
      try {
        const pollInterval = 2000; // ms
        const timeoutLimit = 600000; // 10 min
        const startTime = Date.now();

        let mlpStartDetected = false;

        const checkStatus = async () => {
          const res = await fetch(`${BASE_URL}/training_status_MLP`);
          const data = await res.json();

          const progressRes = await fetch(`${BASE_URL}/training_progress_MLP`);
          const progressData = await progressRes.json();

          console.log("🔄 Polling MLP Status:", data);

          if (progressData && typeof progressData.current_epoch === "number") {
            const { current_epoch, total_epochs } = progressData;
            const progress = total_epochs > 0
              ? Math.floor((current_epoch / total_epochs) * 100)
              : 0;
            setMlpProgress(progress);
          }

          if (data.status === "in_progress") {
            mlpStartDetected = true;
            setMlpTrainingStatus("in_progress");
          }

          if (data.status === "completed" && mlpStartDetected) {
            setMlpProgress(100);
            setMlpAccuracy(data.metrics);
            setMlpTrainingStatus(data.status);
            return;
          } else if (data.status === "cancelled") {
            setError("Training was cancelled.");
            return;
          } else if (data.status === "error") {
            setError("MLP Training failed.");
            setErrorDetails(data.message);
            return;
          }

          if (Date.now() - startTime < timeoutLimit) {
            setTimeout(checkStatus, pollInterval);
          } else {
            setError("MLP training timed out.");
          }
        };

        checkStatus();
      } catch (err) {
        setError("Failed to poll MLP training status.");
        console.error(err);
      }
    };


    const waitForXGBTrainingToStart = async () => {
      const pollInterval = 500; // half a second
      const timeoutLimit = 10000; // 10 seconds
      const startTime = Date.now();

      return new Promise((resolve, reject) => {
        const checkStatus = async () => {
          try {
            const res = await fetch(`${BASE_URL}/training_status_XGB`);
            const data = await res.json();

            if (data.status === "in_progress") {
              resolve();
              return;
            }

            if (data.status === "cancelled") {
              reject(new Error("cancelled"));
              return;
            }

            if (Date.now() - startTime > timeoutLimit) {
              reject(new Error("Timeout waiting for XGBoost training to start."));
              return;
            }

            setTimeout(checkStatus, pollInterval);
          } catch (err) {
            reject(err);
          }
        };

        checkStatus();
      });
    };

    const waitForMLPTrainingToStart = async () => {
      const pollInterval = 500; // half a second
      const timeoutLimit = 10000; // 10 seconds max
      const startTime = Date.now();

      return new Promise((resolve, reject) => {
        const checkStatus = async () => {
          try {
            const res = await fetch(`${BASE_URL}/training_status_MLP`);
            const data = await res.json();

            if (data.status === "in_progress") {
              resolve();
              return;
            }

            if (data.status === "cancelled") {
              reject(new Error("cancelled"));
              return;
            }

            if (Date.now() - startTime > timeoutLimit) {
              reject(new Error("Timeout waiting for MLP training to start."));
              return;
            }

            setTimeout(checkStatus, pollInterval);
          } catch (err) {
            reject(err);
          }
        };

        checkStatus();
      });
    };

    setIsTraining(true);
    setModelAccuracy(null);
    setMlpAccuracy(null);
    setCurrentTrainingStage("");
    setError(null);
    setErrorDetails(null);

    if (forceScratchTraining) {
      await cleanupModels();
    }

    const formData = new FormData();
    formData.append("file", csvFile);
    formData.append("training_mode", mode);
    formData.append("speed_mode", speedMode);

    try {
      let activeSessionId = trainingSessionId;
      if (!activeSessionId) {
        const sessionRes = await fetch(`${BASE_URL}/training_session`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ speed_mode: speedMode }),
        });
        if (!sessionRes.ok) {
          throw new Error("Failed to create training session.");
        }
        const sessionData = await sessionRes.json();
        activeSessionId = sessionData.training_id;
        setActiveTrainingSessionId(activeSessionId);
      }

      formData.append("training_id", activeSessionId);

      await fetch(`${BASE_URL}/delete_old_metrics`, { method: "POST" });

      try {
        const trainStartRes = await fetch(`${BASE_URL}/train_model`, {
          method: "POST",
          body: formData,
        });

        if (!trainStartRes.ok) {
          throw new Error("Failed to start XGBoost training.");
        }

        const trainStartData = await trainStartRes.json();
        if (trainStartData?.training_id) {
          setActiveTrainingSessionId(trainStartData.training_id);
          activeSessionId = trainStartData.training_id;
        }
      } catch (err) {
        console.error("Failed to start training:", err);
        setError("Failed to start training.");
        return;
      }


      // if (progressIntervalRef.current) {
      //   clearInterval(progressIntervalRef.current);
      // }

      // if (!response.ok) {
      //   let errorMessage = `Server error (${response.status})`;
      //   let details = null;

      //   try {
      //     const errorData = await response.json();
      //     errorMessage = errorData.error || errorMessage;
      //     details =
      //       errorData.details || "Something went wrong during model training";
      //   } catch (e) {
      //     console.error("Failed to parse error response:", e);
      //     const responseText = await response.text();
      //     if (responseText && responseText.includes("NoneType")) {
      //       details = "Model initialization failed - NoneType error detected";
      //     }
      //   }

      // if (
      //   (details && details.includes("NoneType")) ||
      //   (errorMessage && errorMessage.includes("NoneType"))
      // ) {
      //   if (mode === "incremental" && !retryAttempted) {
      //     setError(
      //       "Incremental training failed. Attempting to rebuild models from scratch..."
      //     );
      //     setRetryAttempted(true);
      //     await cleanupModels();
      //     setTimeout(() => trainModel("scratch"), 1500);
      //     return;
      //   } else if (retryAttempted) {
      //     errorMessage = "Training failed even after retry attempt.";
      //     details =
      //       "There may be an issue with your dataset structure or backend configuration. " +
      //       "Please ensure your CSV has all required columns in the expected format.";
      //   }
      // }

      //   throw new Error(errorMessage, { cause: details });
      // }

      //const data = await response.json();
      await waitForXGBTrainingToStart();
      await pollXGBTrainingStatus();

      const mlpResponse = await fetch(`${BASE_URL}/train_MLP_model?speed_mode=${encodeURIComponent(speedMode)}&training_id=${encodeURIComponent(activeSessionId)}`, { method: "POST" });
      if (!mlpResponse.ok) {
        throw new Error("Failed to start MLP training.");
      }

      await waitForMLPTrainingToStart();
      await pollMLPTrainingStatus();

      setRetryAttempted(false);
    } catch (err) {
      console.error("Training error:", err);

      if ((err?.message || "").toLowerCase().includes("cancelled")) {
        setIsTraining(false);
        setCurrentStep(0);
        setError("Training was cancelled. Re-upload your CSV to start again.");
        setActiveTrainingSessionId(null);
        return;
      }

      let errorMsg = "An error occurred during training.";

      if (err.message && err.message.toLowerCase().includes("nonetype")) {
        errorMsg = "The model could not be initialized properly.";
        setErrorDetails(
          "This typically happens when there are issues with the dataset format or model files. " +
          "Try uploading a different CSV file with the correct format."
        );
      } else if (err.cause) {
        setErrorDetails(err.cause);
        errorMsg = err.message;
      }

      setError(errorMsg);
    } finally {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    }
  };

  useEffect(() => {
    const intervalRef = progressIntervalRef;
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const [xgbRes, mlpRes] = await Promise.all([
          fetch(`${BASE_URL}/model_metrics`),
          fetch(`${BASE_URL}/MLP_metrics`)
        ]);

        if (xgbRes.ok) {
          const xgbData = await xgbRes.json();
          if (xgbData.metrics && !xgbData.metrics.error) {
            setModelAccuracy(xgbData.metrics);
          } else {
            console.warn("❌ XGBoost metrics not available:", xgbData.metrics?.error);
          }
        }

        if (mlpRes.ok) {
          const mlpData = await mlpRes.json();
          if (mlpData.metrics && !mlpData.metrics.error) {
            setMlpAccuracy(mlpData.metrics);
          } else {
            console.warn("❌ MLP metrics not available:", mlpData.metrics?.error);
          }
        }
      } catch (err) {
        console.error("❌ Failed to fetch model metrics:", err);
      }
    };

    if (
      isTraining &&
      mlpTrainingStatus === "completed" &&
      xgbTrainingStatus === "completed"
    ) {
      fetchMetrics().then(() => {
        setCurrentStep(2);
        setIsTraining(false);
        setTimeout(() => {
          setMlpTrainingStatus("idle");
          setXGBTrainingStatus("idle");
        }, 1000);
      });
    }
  }, [isTraining, mlpTrainingStatus, xgbTrainingStatus]);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const [xgbRes, mlpRes] = await Promise.all([
          fetch(`${BASE_URL}/model_metrics`),
          fetch(`${BASE_URL}/MLP_metrics`)
        ]);
  
        if (xgbRes.ok) {
          const xgbData = await xgbRes.json();
          if (xgbData.metrics && !xgbData.metrics.error) {
            setModelAccuracy(xgbData.metrics);
          }
        }
  
        if (mlpRes.ok) {
          const mlpData = await mlpRes.json();
          if (mlpData.metrics && !mlpData.metrics.error) {
            setMlpAccuracy(mlpData.metrics);
          }
        }
      } catch (err) {
        console.error("❌ Failed to fetch model metrics on step load:", err);
      }
    };
  
    if (currentStep === 2) {
      fetchMetrics();
    }
  }, [currentStep]);
  

  const resetTraining = async () => {
    await cleanupModels();
    setCsvFile(null);
    setCurrentStep(0);
    setModelAccuracy(null);
    setMlpAccuracy(null);
    setError(null);
    setMlpTrainingStatus("idle");
    setXGBTrainingStatus("idle");
    setXgbProgress(0);
    setMlpProgress(0);
  };

  const handleForceResetTraining = async () => {
    const confirmed = window.confirm(
      "This will reset current training progress and clear uploaded model artifacts. Continue?"
    );

    if (!confirmed) return;

    setResetting(true);
    try {
      const response = await fetch(`${BASE_URL}/reset_training_state`, {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Failed to reset training state");
      }

      setIsTraining(false);
      setCurrentStep(0);
      setCsvFile(null);
      setModelAccuracy(null);
      setMlpAccuracy(null);
      setError(null);
      setErrorDetails(null);
      setCurrentTrainingStage("");
      setMlpTrainingStatus("idle");
      setXGBTrainingStatus("idle");
      setXgbProgress(0);
      setMlpProgress(0);
      setShowResetModal(false);
      setActiveTrainingSessionId(null);
    } catch (err) {
      console.error("Reset training state failed:", err);
      setError("Failed to reset stuck training. Please try again.");
    } finally {
      setResetting(false);
    }
  };

  const handleCancelTraining = async () => {
    if (!trainingSessionId) {
      setError("No active training session found.");
      return;
    }

    const confirmed = window.confirm("Cancel the current training run?");
    if (!confirmed) return;

    setResetting(true);
    try {
      const response = await fetch(`${BASE_URL}/training_session/${encodeURIComponent(trainingSessionId)}/cancel`, {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Failed to cancel training");
      }

      setIsTraining(false);
      setCurrentStep(0);
      setCsvFile(null);
      setCurrentTrainingStage("");
      setXgbProgress(0);
      setMlpProgress(0);
      setXGBTrainingStatus("cancelled");
      setMlpTrainingStatus("cancelled");
      setActiveTrainingSessionId(null);
      setError("Training was cancelled. Re-upload your CSV to start again.");
    } catch (err) {
      console.error("Cancel training failed:", err);
      setError("Failed to cancel training. Please try reset.");
    } finally {
      setResetting(false);
    }
  };

  const navigateStep = (step) => {
    if (step === 1 && !csvFile) {
      setError("Please upload a CSV file first.");
      return;
    }
    setCurrentStep(step);
  };

  const steps = [
    { title: "Upload Data", description: "Upload your training dataset" },
    { title: "Training", description: "Train the AI models" },
    { title: "Results", description: "View training results" },
  ];

  const CustomStepper = () => (
    <div className="d-flex flex-column flex-md-row justify-content-between align-items-center mb-5">
      {steps.map((step, index) => (
        <div
          key={index}
          className="d-flex align-items-center mb-3 mb-md-0"
          style={{ cursor: "pointer" }}
          onClick={() => navigateStep(index)}
        >
          <div
            className={`rounded-circle d-flex align-items-center justify-content-center ${currentStep >= index
              ? "bg-success text-white"
              : "bg-light text-muted"
              }`}
            style={{ width: "40px", height: "40px" }}
          >
            {index + 1}
          </div>
          <div className="ms-3">
            <div
              className={`fw-bold ${currentStep >= index ? "text-success" : "text-muted"
                }`}
            >
              {step.title}
            </div>
            <div className="small text-muted d-none d-md-block">
              {step.description}
            </div>
            <div className="small text-muted d-md-none">{step.title}</div>
          </div>
          {index < steps.length - 1 && (
            <div
              className={`mx-3 flex-grow-1 d-none d-md-block ${currentStep > index ? "bg-success" : "bg-light"
                }`}
              style={{ height: "2px" }}
            />
          )}
        </div>
      ))}
    </div>
  );

  const ProgressMetric = ({ label, value, variant = "info" }) => {
    const numericValue = parseFloat(value);
    return (
      <div className="mb-3">
        <h6 className="mb-1">{label}</h6>
        {isNaN(numericValue) ? (
          <p className="text-danger">Invalid metric</p>
        ) : (
          <ProgressBar
            now={numericValue * 100}
            label={`${(numericValue * 100).toFixed(2)}%`}
            variant={variant}
            className="progress-lg"
          />
        )}
      </div>
    );
  };

  return (
    <Container className="my-3 my-md-5">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Row className="justify-content-center">
          <Col md={10}>
            <Card className="shadow-lg border-0">
              <Card.Header className="bg-success text-white py-3 py-md-4">
                <h3 className="mb-0 fs-4 fs-md-3">
                  AI Model Training Dashboard
                </h3>
                <p className="text-white-50 mb-0 small">
                  Train your custom AI models with your dataset
                </p>
              </Card.Header>
              <Card.Body className="p-3 p-md-4">
                <CustomStepper />

                {!serverStatus.healthy && serverStatus.checked && (
                  <Alert variant="danger" className="mb-4">
                    <Alert.Heading>Server Connection Error</Alert.Heading>
                    <p>
                      Unable to connect to the backend server. Training
                      functionality may be limited.
                    </p>
                    <hr />
                    <p className="mb-0">
                      Please ensure the backend server is running and try again.
                    </p>
                  </Alert>
                )}

                <AnimatePresence mode="wait">
                  {currentStep === 0 && (
                    <motion.div
                      key="upload"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.3 }}
                    >
                      <Row>
                        <Col md={8} className="mx-auto">
                          <div
                            className={`upload-area p-4 p-md-5 rounded-4 ${dragging
                              ? "border-success bg-success bg-opacity-10"
                              : "border-dashed bg-light"
                              }`}
                            style={{
                              cursor: "pointer",
                              minHeight: "250px",
                              transition: "all 0.3s ease",
                            }}
                            onDragOver={(e) => {
                              e.preventDefault();
                              setDragging(true);
                            }}
                            onDragLeave={() => setDragging(false)}
                            onDrop={handleDrop}
                            onClick={(e) => {
                              e.stopPropagation();
                              document.getElementById("fileInput").click();
                            }}
                          >
                            <input
                              type="file"
                              id="fileInput"
                              accept=".csv"
                              onChange={handleFileSelect}
                              style={{ display: "none" }}
                            />
                            {csvFile ? (
                              <motion.div
                                initial={{ scale: 0.8 }}
                                animate={{ scale: 1 }}
                                className="text-center"
                              >
                                <Badge bg="success" className="mb-3 px-3 py-2">
                                  File Selected
                                </Badge>
                                <p className="fw-bold text-success">
                                  {csvFile.name}
                                </p>
                                <Button
                                  variant="outline-success"
                                  className="mt-3"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setCurrentStep(1);
                                  }}
                                >
                                  Continue to Training
                                </Button>
                              </motion.div>
                            ) : (
                              <div className="text-center">
                                <i className="fas fa-cloud-upload-alt fa-3x fa-md-4x mb-3 mb-md-4 text-success"></i>
                                <h5 className="mb-3 fs-5">
                                  Upload Your Training Data
                                </h5>
                                <p className="text-muted mb-4 small">
                                  Drag & drop your CSV file here or click to
                                  browse
                                </p>
                                <Button
                                  variant="outline-success"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    document
                                      .getElementById("fileInput")
                                      .click();
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
                        </Col>
                      </Row>
                    </motion.div>
                  )}

                  {currentStep === 1 && (
                    <motion.div
                      key="training"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.3 }}
                    >
                      <Row>
                        <Col md={8} className="mx-auto">
                          <Card className="border-0 shadow-sm">
                            <Card.Body className="p-3 p-md-4">
                              <h5 className="mb-4">Model Training</h5>
                              {error && (
                                <Alert variant="danger" className="mb-4">
                                  <Alert.Heading>{error}</Alert.Heading>
                                  {errorDetails && (
                                    <div className="mt-2 small">
                                      <strong>Technical details:</strong>
                                      <p className="mb-0 font-monospace small text-break">
                                        {errorDetails}
                                      </p>

                                      {error.includes(
                                        "model could not be initialized"
                                      ) && (
                                          <div className="mt-2">
                                            <strong>Recommended actions:</strong>
                                            <ul className="mt-1">
                                              <li>Try training from scratch</li>
                                              <li>Check your CSV data format</li>
                                              <li>
                                                Reset your training session and
                                                start over
                                              </li>
                                            </ul>
                                          </div>
                                        )}
                                    </div>
                                  )}

                                  {retryAttempted && (
                                    <div className="mt-2">
                                      <Spinner
                                        animation="border"
                                        variant="light"
                                        size="sm"
                                        className="me-2"
                                      />
                                      Attempting to train from scratch...
                                    </div>
                                  )}
                                </Alert>
                              )}
                              {isTraining ? (
                                <div className="text-center">
                                  <Spinner
                                    animation="border"
                                    variant="success"
                                    size="lg"
                                    className="mb-4"
                                  />
                                  <h6 className="mb-3">
                                    {currentTrainingStage ||
                                      "Training in Progress..."}
                                  </h6>
                                  <div className="mb-3">
                                    <h6 className="mb-2">XGBoost Training Progress</h6>
                                    <ProgressBar
                                      now={xgbProgress}
                                      label={`${xgbProgress}%`}
                                      animated
                                      variant="info"
                                      className="mb-3"
                                    />
                                  </div>

                                  <div className="mb-3">
                                    <h6 className="mb-2">MLP Training Progress</h6>
                                    <ProgressBar
                                      now={mlpProgress}
                                      label={`${mlpProgress}%`}
                                      animated
                                      variant="success"
                                    />
                                  </div>
                                  <div className="small text-muted mt-1">
                                    <span className="fw-semibold">File:</span>{" "}
                                    {csvFile?.name}
                                    {csvFile && (
                                      <span className="ms-1">
                                        (
                                        {(csvFile.size / (1024 * 1024)).toFixed(
                                          2
                                        )}{" "}
                                        MB)
                                      </span>
                                    )}
                                  </div>
                                  <div className="mt-4">
                                    <Button
                                      variant="warning"
                                      className="me-2"
                                      disabled={resetting}
                                      onClick={handleCancelTraining}
                                    >
                                      {resetting ? "Cancelling..." : "Cancel Training"}
                                    </Button>
                                    <Button
                                      variant="outline-danger"
                                      disabled={resetting}
                                      onClick={handleForceResetTraining}
                                    >
                                      {resetting ? "Resetting Training..." : "Training Stuck? Reset & Re-upload"}
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                <div className="text-center">
                                  <div className="mb-4">
                                    <h6 className="mb-3">Model Training</h6>
                                    <div className="d-flex flex-column align-items-center">
                                      <div className="w-100 mb-3" style={{ maxWidth: "420px" }}>
                                        <label className="form-label fw-semibold" htmlFor="speedMode">
                                          Training Speed
                                        </label>
                                        <select
                                          id="speedMode"
                                          className="form-select"
                                          value={speedMode}
                                          onChange={(e) => setSpeedMode(e.target.value)}
                                        >
                                          <option value="fast">Fast (recommended): fewer trials/epochs</option>
                                          <option value="standard">Standard: higher-quality, slower</option>
                                        </select>
                                        <div className="form-text text-start">
                                          Fast mode usually finishes much sooner, especially on larger CSV files.
                                        </div>
                                      </div>

                                      <div className="form-check mb-3">
                                        <input
                                          className="form-check-input"
                                          type="checkbox"
                                          id="forceScratchTraining"
                                          checked={forceScratchTraining}
                                          onChange={(e) =>
                                            setForceScratchTraining(
                                              e.target.checked
                                            )
                                          }
                                        />
                                        <label
                                          className="form-check-label"
                                          htmlFor="forceScratchTraining"
                                        >
                                          Force train from scratch
                                        </label>
                                      </div>
                                      <p className="text-muted small mb-3">
                                        {forceScratchTraining
                                          ? "Training from scratch will delete existing models and create new ones. This is recommended if you've added new features to your dataset."
                                          : "XGBoost will train incrementally if a model exists, while MLP always trains from scratch."}
                                      </p>
                                    </div>
                                  </div>
                                  <Button
                                    variant="success"
                                    className="px-4 px-md-5 py-2 py-md-3"
                                    onClick={() => {
                                      setRetryAttempted(false);
                                      trainModel(trainingMode);
                                    }}
                                    disabled={!csvFile || !serverStatus.healthy}
                                  >
                                    Start Training
                                  </Button>
                                  {!csvFile && (
                                    <p className="text-danger mt-2 small">
                                      Please upload a CSV file first
                                    </p>
                                  )}
                                </div>
                              )}
                            </Card.Body>
                          </Card>
                        </Col>
                      </Row>
                    </motion.div>
                  )}

                  {currentStep === 2 && (
                    <motion.div
                      key="results"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.3 }}
                    >
                      <Row>
                        <Col md={8} className="mx-auto">
                          <Card className="border-0 shadow-sm">
                            <Card.Body className="p-3 p-md-4">
                              <h5 className="mb-4">Training Results</h5>
                              {modelAccuracy && (
                                <div className="mb-5">
                                  <h6 className="mb-3">XGBoost Model Metrics</h6>
                                  <Row>
                                    <Col xs={12} md={6}>
                                      <ProgressMetric label="Churner Precision" value={modelAccuracy.churner_precision} variant="info" />
                                      <ProgressMetric label="Churner Recall" value={modelAccuracy.churner_recall} variant="info" />
                                      <ProgressMetric label="Nonchurner Precision" value={modelAccuracy.nonchurner_precision} variant="info" />
                                      <ProgressMetric label="Nonchurner Recall" value={modelAccuracy.nonchurner_recall} variant="info" />
                                      <ProgressMetric label="Macro Avg Precision" value={modelAccuracy.macro_avg_precision} variant="info" />
                                      <ProgressMetric label="Macro Avg Recall" value={modelAccuracy.macro_avg_recall} variant="info" />
                                    </Col>
                                    <Col xs={12} md={6}>
                                      <ProgressMetric label="Weighted Avg Precision" value={modelAccuracy.weighted_avg_precision} variant="info" />
                                      <ProgressMetric label="Weighted Avg Recall" value={modelAccuracy.weighted_avg_recall} variant="info" />
                                      <ProgressMetric label="Accuracy" value={modelAccuracy.accuracy} variant="info" />
                                      <ProgressMetric label="F2 Score" value={modelAccuracy.F2_score} variant="info" />
                                    </Col>
                                  </Row>
                                </div>
                              )}

                              {mlpAccuracy && (
                                <div className="mb-5">
                                  <h6 className="mb-3">MLP Model Metrics</h6>
                                  <Row>
                                    <Col xs={12} md={6}>
                                      <ProgressMetric label="Churner Precision" value={mlpAccuracy.churner_precision} variant="success" />
                                      <ProgressMetric label="Churner Recall" value={mlpAccuracy.churner_recall} variant="success" />
                                      <ProgressMetric label="Nonchurner Precision" value={mlpAccuracy.nonchurner_precision} variant="success" />
                                      <ProgressMetric label="Nonchurner Recall" value={mlpAccuracy.nonchurner_recall} variant="success" />
                                      <ProgressMetric label="Macro Avg Precision" value={mlpAccuracy.macro_avg_precision} variant="success" />
                                      <ProgressMetric label="Macro Avg Recall" value={mlpAccuracy.macro_avg_recall} variant="success" />
                                    </Col>
                                    <Col xs={12} md={6}>
                                      <ProgressMetric label="Weighted Avg Precision" value={mlpAccuracy.weighted_avg_precision} variant="success" />
                                      <ProgressMetric label="Weighted Avg Recall" value={mlpAccuracy.weighted_avg_recall} variant="success" />
                                      <ProgressMetric label="Accuracy" value={mlpAccuracy.accuracy} variant="success" />
                                      <ProgressMetric label="F2 Score" value={mlpAccuracy.F2_score} variant="success" />
                                    </Col>
                                  </Row>
                                </div>
                              )}

                              <div className="text-center d-flex flex-column flex-md-row justify-content-center align-items-center gap-3">
                                <Button
                                  variant="secondary"
                                  onClick={() => navigate("/")}
                                  className="w-100 w-md-auto"
                                >
                                  Return to Dashboard
                                </Button>
                                <Button
                                  variant="success"
                                  onClick={() => {
                                    setTrainingMode("incremental");
                                    setForceScratchTraining(false);
                                    setCurrentStep(0);
                                    //localStorage.setItem("modelTrained", "true");
                                  }}
                                  className="w-100 w-md-auto"
                                >
                                  Train Again
                                </Button>
                                <Button
                                  variant="outline-danger"
                                  onClick={() => setShowResetModal(true)}
                                  className="w-100 w-md-auto mt-2 mt-md-0"
                                >
                                  Reset & Start Over
                                </Button>
                              </div>
                            </Card.Body>
                            <Modal show={showResetModal} onHide={() => setShowResetModal(false)} centered>
                              <Modal.Header closeButton>
                                <Modal.Title>Reset Training</Modal.Title>
                              </Modal.Header>
                              <Modal.Body>
                                <p>What would you like to reset?</p>
                              </Modal.Body>
                              <Modal.Footer>
                                <Button variant="outline-secondary" onClick={() => setShowResetModal(false)}>
                                  Cancel
                                </Button>
                                <Button
                                  variant="success"
                                  disabled={resetting}
                                  onClick={async () => {
                                    setResetting(true);
                                    await fetch(`${BASE_URL}/cleanup_models`, { method: "POST" });
                                    setResetting(false);
                                    resetTraining();
                                    setActiveTrainingSessionId(null);
                                    setShowResetModal(false);
                                  }}
                                >
                                  {resetting ? "Clearing..." : "Clear Models Only"}
                                </Button>
                                <Button
                                  variant="danger"
                                  disabled={resetting}
                                  onClick={async () => {
                                    setResetting(true);
                                    await fetch(`${BASE_URL}/reset_all`, { method: "POST" });
                                    setResetting(false);
                                    resetTraining();
                                    setActiveTrainingSessionId(null);
                                    setShowResetModal(false);
                                  }}
                                >
                                  {resetting ? "Wiping..." : "Wipe Everything"}
                                </Button>
                              </Modal.Footer>
                            </Modal>
                          </Card>
                        </Col>
                      </Row>
                    </motion.div>
                  )}
                </AnimatePresence>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </motion.div>
    </Container>
  );
}
