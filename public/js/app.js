// ==================== STATE MANAGEMENT ====================
let backups = [];
let schedulerRunning = false;
let configMode = "env"; // 'env' or 'manual'

// ==================== UTILITY FUNCTIONS ====================

/**
 * Format file size
 */
function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/**
 * Show toast notification
 */
function showToast(type, title, message) {
  const container = document.getElementById("toast-container");

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;

  const icon =
    type === "success"
      ? '<path d="M12 2C6.5 2 2 6.5 2 12S6.5 22 12 22 22 17.5 22 12 17.5 2 12 2M10 17L5 12L6.41 10.59L10 14.17L17.59 6.58L19 8L10 17Z" />'
      : type === "error"
        ? '<path d="M13,13H11V7H13M13,17H11V15H13M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2Z" />'
        : '<path d="M13,9H11V7H13M13,17H11V11H13M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2Z" />';

  toast.innerHTML = `
    <svg class="toast-icon" viewBox="0 0 24 24" fill="currentColor">${icon}</svg>
    <div class="toast-content">
      <div class="toast-title">${title}</div>
      <div class="toast-message">${message}</div>
    </div>
    <button class="toast-close">&times;</button>
  `;

  container.appendChild(toast);

  toast.querySelector(".toast-close").addEventListener("click", () => {
    toast.remove();
  });

  setTimeout(() => {
    toast.remove();
  }, 5000);
}

/**
 * Show loading overlay
 */
function showLoading() {
  document.getElementById("loading").classList.remove("hidden");
}

/**
 * Hide loading overlay
 */
function hideLoading() {
  document.getElementById("loading").classList.add("hidden");
}

/**
 * API request helper
 */
async function apiRequest(url, options = {}) {
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Request failed");
    }

    return data;
  } catch (error) {
    throw error;
  }
}

/**
 * Toggle password visibility
 */
function togglePasswordVisibility(button) {
  const targetId = button.dataset.target;
  const input = document.getElementById(targetId);

  if (input.type === "password") {
    input.type = "text";
    button.classList.add("hidden");
  } else {
    input.type = "password";
    button.classList.remove("hidden");
  }
}

// ==================== DATA FETCHING ====================

/**
 * Load backups and statistics
 */
async function loadBackups() {
  showLoading();

  try {
    const data = await apiRequest("/api/backups");

    backups = data.backups || [];
    const stats = data.stats || { total: 0, local: 0, remote: 0, totalSize: 0 };

    updateStatistics(stats);
    renderBackupsTable();
  } catch (error) {
    console.error("Error loading backups:", error);
    showToast("error", "Error", "Failed to load backups: " + error.message);
  } finally {
    hideLoading();
  }
}

/**
 * Update statistics cards
 */
function updateStatistics(stats) {
  document.getElementById("stat-total").textContent = stats.total;
  document.getElementById("stat-local").textContent = stats.local;
  document.getElementById("stat-remote").textContent = stats.remote;
  document.getElementById("stat-size").textContent = formatFileSize(
    stats.totalSize,
  );
}

/**
 * Render backups table
 */
function renderBackupsTable() {
  const tbody = document.getElementById("backups-tbody");

  if (backups.length === 0) {
    tbody.innerHTML = `
      <tr class="empty-row">
        <td colspan="5">
          <div class="empty-state">
            <svg class="empty-icon" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19,20H4C2.89,20 2,19.1 2,18V6C2,4.89 2.89,4 4,4H10L12,6H19A2,2 0 0,1 21,8H21L4,8.01V18L6.14,10H23.21L20.93,18.5C20.7,19.37 19.92,20 19,20Z" />
            </svg>
            <p>No backups found</p>
            <p class="empty-hint">Click "Create Backup" to get started</p>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = backups
    .map((backup) => {
      const locationClass =
        backup.location === "local"
          ? "location-local"
          : backup.location === "remote"
            ? "location-remote"
            : "location-both";
      const locationText =
        backup.location === "both"
          ? "Local & Remote"
          : backup.location.charAt(0).toUpperCase() + backup.location.slice(1);

      return `
      <tr>
        <td><strong>${backup.filename}</strong></td>
        <td>${formatFileSize(backup.size)}</td>
        <td>${dayjs(backup.date).fromNow()}</td>
        <td>
          <span class="location-badge ${locationClass}">${locationText}</span>
        </td>
        <td>
          <div class="action-buttons">
            <button class="action-btn btn-download" data-filename="${
              backup.filename
            }">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M5,20H19V18H5M19,9H15V3H9V9H5L12,16L19,9Z" />
              </svg>
              Download
            </button>
            <button class="action-btn btn-restore" data-filename="${
              backup.filename
            }">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M13,3A9,9 0 0,0 4,12H1L4.89,15.89L4.96,16.03L9,12H6A7,7 0 0,1 13,5A7,7 0 0,1 20,12A7,7 0 0,1 13,19C11.07,19 9.32,18.21 8.06,16.94L6.64,18.36C8.27,20 10.5,21 13,21A9,9 0 0,0 22,12A9,9 0 0,0 13,3Z" />
              </svg>
              Restore
            </button>
            <button class="action-btn danger btn-delete" data-filename="${
              backup.filename
            }">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19Z" />
              </svg>
              Delete
            </button>
          </div>
        </td>
      </tr>
    `;
    })
    .join("");

  // Add event listeners for action buttons using event delegation
  tbody.querySelectorAll(".btn-download").forEach((btn) => {
    btn.addEventListener("click", () => {
      downloadBackup(btn.dataset.filename);
    });
  });
  tbody.querySelectorAll(".btn-restore").forEach((btn) => {
    btn.addEventListener("click", () => {
      restoreBackup(btn.dataset.filename);
    });
  });
  tbody.querySelectorAll(".btn-delete").forEach((btn) => {
    btn.addEventListener("click", () => {
      deleteBackup(btn.dataset.filename);
    });
  });
}

/**
 * Load scheduler status
 */
async function loadSchedulerStatus() {
  try {
    const data = await apiRequest("/api/scheduler");

    schedulerRunning = data.running;

    const toggle = document.getElementById("toggle-scheduler");
    const statusBadge = document.getElementById("scheduler-status");

    toggle.checked = schedulerRunning;

    if (schedulerRunning) {
      statusBadge.textContent = "Running";
      statusBadge.className = "status-badge status-badge-active";
    } else {
      statusBadge.textContent = "Stopped";
      statusBadge.className = "status-badge status-badge-inactive";
    }
  } catch (error) {
    console.error("Error loading scheduler status:", error);
  }
}

// ==================== BACKUP ACTIONS ====================

/**
 * Create new backup
 */
async function createBackup() {
  const button = document.getElementById("btn-create");
  button.disabled = true;

  try {
    // Format is now configured in the config modal, not passed from UI
    const data = await apiRequest("/api/backups", {
      method: "POST",
      body: JSON.stringify({}),
    });

    showToast("success", "Success", data.message);
    await loadBackups();
  } catch (error) {
    console.error("Error creating backup:", error);
    showToast("error", "Error", "Failed to create backup: " + error.message);
  } finally {
    button.disabled = false;
  }
}

/**
 * Download backup
 */
function downloadBackup(filename) {
  window.location.href = `/api/backups/${encodeURIComponent(
    filename,
  )}/download`;
}

/**
 * Load and display current config mode
 */
async function loadConfigMode() {
  try {
    const data = await apiRequest("/api/config/mode");
    configMode = data.mode;

    const toggle = document.getElementById("config-mode-switch");
    const badge = document.getElementById("config-mode-status");

    toggle.checked = configMode === "manual";
    badge.textContent = configMode.toUpperCase();
    badge.className =
      "config-mode-badge " + (configMode === "manual" ? "manual" : "env");

    // Update UI first (enable/disable fields)
    updateUIForConfigMode();

    // Then populate form fields based on mode
    if (configMode === "manual" && data.manualConfig) {
      // Show manual values in form (editable)
      populateFormFromConfig(data.manualConfig);
    } else {
      // ENV mode: clear all fields (don't show ENV values for security)
      clearFormFields();
    }
  } catch (error) {
    console.error("Error loading config mode:", error);
  }
}

/**
 * Populate form fields from config object
 */
function populateFormFromConfig(config) {
  // Database fields
  if (config.database) {
    const db = config.database;
    document.getElementById("input-db-host").value = db.host || "";
    document.getElementById("input-db-port").value = db.port || "";
    document.getElementById("input-db-user").value = db.user || "";
    document.getElementById("input-db-name").value = db.database || "";
    document.getElementById("input-schema").value = db.schema || "";
    document.getElementById("input-exclude-tables").value = Array.isArray(
      db.excludeTables,
    )
      ? db.excludeTables.join(", ")
      : db.excludeTables || "";
    document.getElementById("input-db-password").value = db.password || "";
    const sslCheckbox = document.getElementById("input-ssl-mode");
    const sslBadge = document.getElementById("ssl-mode-status");
    sslCheckbox.checked = db.sslMode === "on";
    sslBadge.textContent = db.sslMode === "on" ? "ON" : "OFF";
    sslBadge.className =
      "config-mode-badge " + (db.sslMode === "on" ? "manual" : "env");
  }

  // Backup fields
  if (config.backup) {
    const backup = config.backup;
    document.getElementById("input-backup-format").value =
      backup.format || "sql";
    document.getElementById("input-retention").value =
      backup.retentionDays || 7;
    document.getElementById("input-schedule").value =
      backup.schedule || "0 2 * * *";
    document.getElementById("input-storage").value = backup.storage || "local";
  }

  // S3 fields
  if (config.s3) {
    const s3 = config.s3;
    document.getElementById("input-access-key").value = s3.accessKeyId || "";
    document.getElementById("input-secret-key").value =
      s3.secretAccessKey || "";
    document.getElementById("input-bucket").value = s3.bucket || "";
    document.getElementById("input-region").value = s3.region || "";
    document.getElementById("input-prefix").value = s3.prefix || "";
    document.getElementById("input-endpoint").value = s3.endpoint || "";

    // Show force path style status (auto-detected or manual)
    const forcePathStyleCheckbox = document.getElementById(
      "input-force-path-style",
    );
    forcePathStyleCheckbox.checked = s3.s3ForcePathStyle || false;

    // Update hint to show current detection
    updateForcePathStyleHint(s3.endpoint, s3.s3ForcePathStyle);
  }
}

/**
 * Update force path style hint based on endpoint
 */
function updateForcePathStyleHint(endpoint, currentValue) {
  const checkbox = document.getElementById("input-force-path-style");
  const hintText = checkbox.closest(".form-group").querySelector(".form-hint");

  if (!endpoint) {
    hintText.innerHTML =
      "✨ Auto-detected based on endpoint (Supabase, MinIO, localhost → enabled; AWS S3 → disabled)";
    return;
  }

  const endpointLower = endpoint.toLowerCase();
  const shouldForce =
    endpointLower.includes("supabase.co") ||
    endpointLower.includes("minio") ||
    endpointLower.includes("localhost") ||
    endpointLower.includes("127.0.0.1") ||
    endpointLower.includes("digitaloceanspaces.com");

  const status = currentValue ? "✅ Enabled" : "❌ Disabled";
  const detection = shouldForce
    ? "(Auto-detected: should be enabled)"
    : "(Auto-detected: should be disabled)";

  hintText.innerHTML = `${status} ${detection}`;
}

/**
 * Clear all form fields (for ENV mode)
 */
function clearFormFields() {
  // Database fields
  document.getElementById("input-db-host").value = "";
  document.getElementById("input-db-port").value = "";
  document.getElementById("input-db-user").value = "";
  document.getElementById("input-db-name").value = "";
  document.getElementById("input-db-password").value = "";
  document.getElementById("input-schema").value = "";
  document.getElementById("input-exclude-tables").value = "";
  document.getElementById("input-ssl-mode").checked = false;
  document.getElementById("ssl-mode-status").textContent = "OFF";
  document.getElementById("ssl-mode-status").className =
    "config-mode-badge env";

  // Backup fields
  document.getElementById("input-backup-format").value = "sql";
  document.getElementById("input-retention").value = "7";
  document.getElementById("input-schedule").value = "0 2 * * *";
  document.getElementById("input-storage").value = "local";

  // S3 fields
  document.getElementById("input-access-key").value = "";
  document.getElementById("input-secret-key").value = "";
  document.getElementById("input-secret-key").placeholder = "secret123...";
  document.getElementById("input-bucket").value = "";
  document.getElementById("input-region").value = "";
  document.getElementById("input-prefix").value = "";
  document.getElementById("input-endpoint").value = "";
  document.getElementById("input-force-path-style").checked = false;
}

/**
 * Toggle config mode between ENV and Manual
 */
async function toggleConfigMode(isManual) {
  try {
    const mode = isManual ? "manual" : "env";
    await apiRequest("/api/config/mode", {
      method: "POST",
      body: JSON.stringify({ mode }),
    });

    configMode = mode;
    const badge = document.getElementById("config-mode-status");
    badge.textContent = mode.toUpperCase();
    badge.className =
      "config-mode-badge " + (mode === "manual" ? "manual" : "env");

    // Reload config to populate form with appropriate values
    await loadConfigMode();

    showToast(
      "success",
      "Success",
      `Configuration mode changed to ${mode.toUpperCase()}`,
    );
  } catch (error) {
    console.error("Error toggling config mode:", error);
    showToast(
      "error",
      "Error",
      "Failed to change config mode: " + error.message,
    );
    // Revert toggle
    document.getElementById("config-mode-switch").checked =
      configMode === "manual";
  }
}

/**
 * Update UI based on current config mode
 */
function updateUIForConfigMode() {
  const isManual = configMode === "manual";

  // Show/hide reset button (only in manual mode)
  const resetBtn = document.getElementById("btn-reset-manual-config");
  if (resetBtn) {
    resetBtn.style.display = isManual ? "inline-flex" : "none";
  }

  // Update scheduler toggle and add visual feedback to parent
  const schedulerToggle = document.getElementById("toggle-scheduler");
  const schedulerContainer = document.querySelector(".scheduler-toggle");
  if (schedulerToggle) {
    schedulerToggle.disabled = !isManual;
    if (schedulerContainer) {
      if (isManual) {
        schedulerContainer.classList.remove("disabled");
      } else {
        schedulerContainer.classList.add("disabled");
      }
    }
  }

  // Update all input fields in config modal tabs
  // Get all inputs, selects, and checkboxes
  const allInputs = document.querySelectorAll(
    "#tab-database input, #tab-database select, " +
      "#tab-backup input, #tab-backup select, " +
      "#tab-storage input, #tab-storage select",
  );

  allInputs.forEach((input) => {
    if (input.type === "checkbox") {
      input.disabled = !isManual;
    } else if (input.tagName === "SELECT") {
      input.disabled = !isManual;
    } else if (
      input.type === "number" ||
      input.type === "text" ||
      input.type === "password"
    ) {
      input.readOnly = !isManual;
    }
  });

  // Show/hide manual config save buttons
  const saveButtons = document.querySelectorAll(".manual-save-btn");
  saveButtons.forEach((btn) => {
    btn.style.display = isManual ? "inline-block" : "none";
  });

  // Show/hide ENV/Manual mode info boxes in all tabs
  // Database tab
  const dbEnvInfo = document.getElementById("database-env-info");
  const dbManualInfo = document.getElementById("database-manual-info");
  if (dbEnvInfo) dbEnvInfo.style.display = isManual ? "none" : "block";
  if (dbManualInfo) dbManualInfo.style.display = isManual ? "block" : "none";

  // Storage tab
  const storageEnvInfo = document.getElementById("storage-env-info");
  const storageManualInfo = document.getElementById("storage-manual-info");
  if (storageEnvInfo)
    storageEnvInfo.style.display = isManual ? "none" : "block";
  if (storageManualInfo)
    storageManualInfo.style.display = isManual ? "block" : "none";

  // Backup tab
  const backupEnvMode = document.getElementById("backup-env-mode");
  const backupManualMode = document.getElementById("backup-manual-mode");
  if (backupEnvMode) backupEnvMode.style.display = isManual ? "none" : "block";
  if (backupManualMode)
    backupManualMode.style.display = isManual ? "block" : "none";
}

/**
 * Save manual database config
 */
async function saveManualDatabaseConfig() {
  const config = {
    host: document.getElementById("input-db-host").value,
    port: parseInt(document.getElementById("input-db-port").value),
    database: document.getElementById("input-db-name").value,
    user: document.getElementById("input-db-user").value,
    password: document.getElementById("input-db-password").value,
    schema: document.getElementById("input-schema").value.trim() || null,
    excludeTables: document.getElementById("input-exclude-tables").value.trim(),
    sslMode: document.getElementById("input-ssl-mode").checked ? "on" : "off",
  };

  try {
    await apiRequest("/api/config/manual/database", {
      method: "POST",
      body: JSON.stringify(config),
    });

    showToast("success", "Success", "Database configuration saved");
  } catch (error) {
    console.error("Error saving database config:", error);
    showToast(
      "error",
      "Error",
      "Failed to save database config: " + error.message,
    );
  }
}

/**
 * Save manual backup config
 */
async function saveManualBackupConfig() {
  const config = {
    format: document.getElementById("input-backup-format").value,
    retentionDays: parseInt(document.getElementById("input-retention").value),
    storage: document.getElementById("input-storage").value,
    schedule: document.getElementById("input-schedule").value,
    auto: false, // Will be controlled by scheduler toggle
    localPath: "./backups",
  };

  try {
    await apiRequest("/api/config/manual/backup", {
      method: "POST",
      body: JSON.stringify(config),
    });

    showToast("success", "Success", "Backup configuration saved");
  } catch (error) {
    console.error("Error saving backup config:", error);
    showToast(
      "error",
      "Error",
      "Failed to save backup config: " + error.message,
    );
  }
}

/**
 * Save manual S3 config
 */
async function saveManualS3Config() {
  const config = {
    accessKeyId: document.getElementById("input-access-key").value,
    secretAccessKey: document.getElementById("input-secret-key").value,
    region: document.getElementById("input-region").value,
    bucket: document.getElementById("input-bucket").value,
    prefix: document.getElementById("input-prefix").value,
    endpoint: document.getElementById("input-endpoint").value,
    s3ForcePathStyle: document.getElementById("input-force-path-style").checked,
  };

  try {
    await apiRequest("/api/config/manual/s3", {
      method: "POST",
      body: JSON.stringify(config),
    });

    showToast("success", "Success", "S3 configuration saved");
  } catch (error) {
    console.error("Error saving S3 config:", error);
    showToast("error", "Error", "Failed to save S3 config: " + error.message);
  }
}

/**
 * Reset manual configuration
 */
async function resetManualConfig() {
  if (
    !confirm(
      "Are you sure you want to reset all manual configuration? This will clear all saved settings (Database, Backup, and S3 configuration).",
    )
  ) {
    return;
  }

  try {
    const data = await apiRequest("/api/config/reset", {
      method: "POST",
    });

    // Clear form fields and reload config
    clearFormFields();
    await loadConfigMode();

    showToast("success", "Success", data.message);
  } catch (error) {
    console.error("Error resetting config:", error);
    showToast("error", "Error", "Failed to reset config: " + error.message);
  }
}

/**
 * Restore backup
 */
async function restoreBackup(filename) {
  if (
    !confirm(
      `Are you sure you want to restore the database from "${filename}"? This will overwrite all current data.`,
    )
  ) {
    return;
  }

  showLoading();

  try {
    const data = await apiRequest("/api/restore", {
      method: "POST",
      body: JSON.stringify({ filename }),
    });

    showToast("success", "Success", data.message);
  } catch (error) {
    console.error("Error restoring backup:", error);
    showToast("error", "Error", "Failed to restore backup: " + error.message);
  } finally {
    hideLoading();
  }
}

/**
 * Delete backup
 */
async function deleteBackup(filename) {
  if (!confirm(`Are you sure you want to delete "${filename}"?`)) {
    return;
  }

  showLoading();

  try {
    const data = await apiRequest(
      `/api/backups/${encodeURIComponent(filename)}`,
      {
        method: "DELETE",
      },
    );

    showToast("success", "Success", data.message);
    await loadBackups();
  } catch (error) {
    console.error("Error deleting backup:", error);
    showToast("error", "Error", "Failed to delete backup: " + error.message);
  } finally {
    hideLoading();
  }
}

// ==================== SCHEDULER ACTIONS ====================

/**
 * Toggle scheduler
 */
async function toggleScheduler(enabled) {
  try {
    if (enabled) {
      const data = await apiRequest("/api/scheduler", {
        method: "POST",
      });
      showToast("success", "Success", data.message);
    } else {
      const data = await apiRequest("/api/scheduler", {
        method: "DELETE",
      });
      showToast("success", "Success", data.message);
    }

    // Refresh scheduler status after toggle
    await loadSchedulerStatus();
  } catch (error) {
    console.error("Error toggling scheduler:", error);
    showToast("error", "Error", "Failed to toggle scheduler: " + error.message);

    // Revert toggle on error
    document.getElementById("toggle-scheduler").checked = !enabled;
  }
}

// ==================== CONFIG MODAL ====================

/**
 * Show configuration modal
 */
function showConfigModal() {
  // Reload config mode to populate form with correct values
  loadConfigMode();
  document.getElementById("config-modal").classList.add("show");
  switchTab("database");
}

/**
 * Hide configuration modal
 */
function hideConfigModal() {
  document.getElementById("config-modal").classList.remove("show");
}

/**
 * Switch configuration tab
 */
function switchTab(tabName) {
  document.querySelectorAll(".tab-content").forEach((tab) => {
    tab.classList.remove("active");
  });

  document.querySelectorAll(".config-tab").forEach((btn) => {
    btn.classList.remove("active");
  });

  document.getElementById(`tab-${tabName}`).classList.add("active");

  document.querySelector(`[data-tab="${tabName}"]`).classList.add("active");
}

// ==================== EVENT LISTENERS ====================

document.addEventListener("DOMContentLoaded", () => {
  // Set dynamic copyright year
  const yearElement = document.getElementById("current-year");
  if (yearElement) {
    yearElement.textContent = new Date().getFullYear();
  }

  loadBackups();
  loadSchedulerStatus();
  loadConfigMode();

  document.getElementById("btn-create").addEventListener("click", createBackup);

  document.getElementById("btn-refresh").addEventListener("click", loadBackups);

  document
    .getElementById("btn-config")
    .addEventListener("click", showConfigModal);

  document
    .getElementById("toggle-scheduler")
    .addEventListener("change", (e) => {
      toggleScheduler(e.target.checked);
    });

  // Config mode toggle - fixed to use correct ID
  const configModeToggle = document.getElementById("config-mode-switch");
  if (configModeToggle) {
    configModeToggle.addEventListener("change", (e) => {
      toggleConfigMode(e.target.checked);
    });
  }

  // SSL mode toggle - update badge on change
  const sslToggle = document.getElementById("input-ssl-mode");
  if (sslToggle) {
    sslToggle.addEventListener("change", (e) => {
      const badge = document.getElementById("ssl-mode-status");
      badge.textContent = e.target.checked ? "ON" : "OFF";
      badge.className =
        "config-mode-badge " + (e.target.checked ? "manual" : "env");
    });
  }

  // Reset manual config button
  const resetBtn = document.getElementById("btn-reset-manual-config");
  if (resetBtn) {
    resetBtn.addEventListener("click", resetManualConfig);
  }

  // Manual config save buttons
  document
    .getElementById("btn-save-db-manual")
    .addEventListener("click", saveManualDatabaseConfig);
  document
    .getElementById("btn-save-backup-manual")
    .addEventListener("click", saveManualBackupConfig);
  document
    .getElementById("btn-save-s3-manual")
    .addEventListener("click", saveManualS3Config);

  document
    .getElementById("config-modal-close")
    .addEventListener("click", hideConfigModal);

  // Prevent form submissions (we use manual save buttons)
  document.getElementById("config-form").addEventListener("submit", (e) => {
    e.preventDefault();
  });
  document.getElementById("storage-form").addEventListener("submit", (e) => {
    e.preventDefault();
  });

  document.querySelectorAll(".config-tab").forEach((tab) => {
    tab.addEventListener("click", (e) => {
      switchTab(e.target.dataset.tab);
    });
  });

  document.getElementById("config-modal").addEventListener("click", (e) => {
    if (e.target.id === "config-modal") {
      hideConfigModal();
    }
  });

  // Password toggle buttons
  document.querySelectorAll(".toggle-password").forEach((button) => {
    button.addEventListener("click", () => {
      togglePasswordVisibility(button);
    });
  });

  // Auto-polling removed - use manual refresh button or refresh after actions
  // setInterval(loadBackups, 70500);
  // setInterval(loadSchedulerStatus, 10000);
});

window.downloadBackup = downloadBackup;
window.restoreBackup = restoreBackup;
window.deleteBackup = deleteBackup;
window.hideConfigModal = hideConfigModal;
