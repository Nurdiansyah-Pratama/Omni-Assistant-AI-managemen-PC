(function () {
  const actionEndpoints = {
    chat: "/api/office/chat",
    rewrite: "/api/office/rewrite",
    summarize: "/api/office/summarize",
    explain: "/api/office/analyze",
    generate: "/api/office/generate",
    format: "/api/office/format",
    grammar: "/api/office/format",
    translate: "/api/office/rewrite",
    professional: "/api/office/rewrite",
    academic: "/api/office/rewrite",
    continue: "/api/office/generate",
    excelFormula: "/api/office/excel/formula",
    excelAnalyze: "/api/office/excel/analyze",
    powerpointSlides: "/api/office/powerpoint/generate-slides",
    projectPlan: "/api/office/project/create-plan",
    outlookEmail: "/api/office/outlook/draft-email",
  };

  const specialActions = {
    Word: [
      ["proposalChapter", "Buat BAB proposal", "generate"],
      ["introduction", "Buat pendahuluan", "generate"],
      ["literature", "Tinjauan pustaka", "generate"],
      ["methodology", "Metodologi", "generate"],
      ["abstract", "Buat abstrak", "summarize"],
      ["toc", "Daftar isi draft", "generate"],
      ["citation", "Sitasi placeholder", "generate"],
      ["longSentence", "Deteksi kalimat panjang", "explain"],
    ],
    Excel: [
      ["excelFormula", "Buat/Jelaskan rumus", "excelFormula"],
      ["excelAnalyze", "Analisis tabel", "excelAnalyze"],
      ["cleanData", "Bersihkan data", "excelAnalyze"],
      ["chart", "Rekomendasi chart", "excelAnalyze"],
      ["pivot", "Rekomendasi Pivot", "excelAnalyze"],
      ["outlier", "Deteksi outlier", "excelAnalyze"],
    ],
    PowerPoint: [
      ["powerpointSlides", "Generate slide outline", "powerpointSlides"],
      ["speakerNotes", "Speaker notes", "powerpointSlides"],
      ["shortenSlide", "Singkatkan slide", "rewrite"],
      ["visualCaption", "Caption visual", "generate"],
      ["closingSlide", "Closing slide", "powerpointSlides"],
    ],
    Project: [
      ["projectPlan", "Buat task list/WBS", "projectPlan"],
      ["timeline", "Buat timeline", "projectPlan"],
      ["dependency", "Dependency task", "projectPlan"],
      ["risk", "Risk register", "projectPlan"],
      ["milestone", "Milestone", "projectPlan"],
    ],
    Outlook: [
      ["outlookEmail", "Draft email", "outlookEmail"],
      ["replyTone", "Reply dengan tone", "outlookEmail"],
      ["emailSummary", "Ringkas email", "outlookEmail"],
      ["subject", "Buat subject", "outlookEmail"],
      ["followUp", "Follow-up email", "outlookEmail"],
      ["actionItems", "Action items", "outlookEmail"],
    ],
  };

  let currentHost = "Unknown";

  function $(id) {
    return document.getElementById(id);
  }

  function setMessage(message) {
    $("message").textContent = message || "";
  }

  function setBusy(isBusy) {
    document.querySelectorAll("button").forEach((button) => {
      button.disabled = isBusy;
    });
  }

  function renderSpecialActions(host) {
    const container = $("specialActions");
    container.innerHTML = "";
    (specialActions[host] || []).forEach(([, label, action]) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = label;
      button.dataset.action = action;
      container.appendChild(button);
    });
  }

  async function buildPayload(action) {
    const context = await window.OmniOfficeContext.getOfficeContext({
      allowDocumentContext: $("allowDocumentContext").checked,
    });
    return {
      app: context.officeApp,
      action,
      selectedText: context.selectedText,
      context,
      userInstruction: $("promptInput").value,
      tone: $("toneSelect").value,
      language: "id-ID",
    };
  }

  async function runAction(action) {
    setBusy(true);
    setMessage("Mengirim konteks ke Omni lokal...");
    try {
      const payload = await buildPayload(action);
      const endpoint = actionEndpoints[action] || "/api/office/chat";
      const result = await window.OmniApiClient.requestJson(endpoint, payload);
      $("previewOutput").value = result.result || "";
      $("lastAction").textContent = `${payload.app} / ${action}`;
      const warnings = Array.isArray(result.warnings)
        ? result.warnings.join(" ")
        : "";
      setMessage(result.success ? warnings || "Preview siap." : result.result);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Aksi gagal.");
    } finally {
      setBusy(false);
    }
  }

  async function insertPreview() {
    const text = $("previewOutput").value.trim();
    if (!text) {
      setMessage("Preview masih kosong.");
      return;
    }
    await window.OmniOfficeContext.insertResult(text);
    setMessage("Hasil dimasukkan. Gunakan Ctrl+Z jika ingin undo.");
  }

  async function replacePreview() {
    const text = $("previewOutput").value.trim();
    if (!text) {
      setMessage("Preview masih kosong.");
      return;
    }
    await window.OmniOfficeContext.replaceSelection(text);
    setMessage("Selection diganti. Gunakan Ctrl+Z jika ingin undo.");
  }

  async function copyPreview() {
    const text = $("previewOutput").value.trim();
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setMessage("Hasil disalin ke clipboard.");
  }

  async function initialize() {
    currentHost = window.OmniOfficeContext.getHostName();
    $("detectedApp").textContent = currentHost;
    renderSpecialActions(currentHost);

    $("backendStatus").textContent = (await window.OmniApiClient.health())
      ? "Connected"
      : "Offline";

    document.body.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const action = target.dataset.action;
      if (action) void runAction(action);
    });

    $("insertButton").addEventListener("click", () => void insertPreview());
    $("replaceButton").addEventListener("click", () => void replacePreview());
    $("copyButton").addEventListener("click", () => void copyPreview());
    $("settingsButton").addEventListener("click", () =>
      setMessage("Atur provider AI di aplikasi Omni Assistant desktop > tab AI."),
    );
  }

  Office.onReady(() => {
    void initialize();
  });
})();
