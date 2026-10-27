(function () {
  function getHostName() {
    const host = Office.context.host;
    if (host === Office.HostType.Word) return "Word";
    if (host === Office.HostType.Excel) return "Excel";
    if (host === Office.HostType.PowerPoint) return "PowerPoint";
    if (host === Office.HostType.Project) return "Project";
    if (host === Office.HostType.Outlook) return "Outlook";
    return String(host || "Unknown");
  }

  function getDocumentTitle() {
    try {
      if (Office.context.mailbox?.item?.subject) {
        return Office.context.mailbox.item.subject;
      }
      return Office.context.document?.url || document.title || "";
    } catch {
      return "";
    }
  }

  async function readSelectedText() {
    const host = getHostName();
    if (host === "Word" && window.OmniWordActions) {
      return window.OmniWordActions.getSelection();
    }
    if (host === "Excel" && window.OmniExcelActions) {
      return window.OmniExcelActions.getSelection();
    }
    if (host === "PowerPoint" && window.OmniPowerPointActions) {
      return window.OmniPowerPointActions.getSelection();
    }
    if (host === "Project" && window.OmniProjectActions) {
      return window.OmniProjectActions.getSelection();
    }
    if (host === "Outlook" && window.OmniOutlookActions) {
      return window.OmniOutlookActions.getSelection();
    }
    return "";
  }

  async function readDocumentExcerpt(allowDocumentContext) {
    if (!allowDocumentContext) return "";
    const host = getHostName();
    if (host === "Word" && window.OmniWordActions) {
      return window.OmniWordActions.getDocumentExcerpt();
    }
    if (host === "Outlook" && window.OmniOutlookActions) {
      return window.OmniOutlookActions.getBodyExcerpt();
    }
    return "";
  }

  async function getOfficeContext(options = {}) {
    const host = getHostName();
    const selectedText = await readSelectedText();
    const documentExcerpt = await readDocumentExcerpt(
      Boolean(options.allowDocumentContext),
    );

    return {
      officeApp: host,
      documentTitle: getDocumentTitle(),
      selectedText,
      documentExcerpt,
      activeSheetName:
        host === "Excel" && window.OmniExcelActions
          ? await window.OmniExcelActions.getActiveSheetName()
          : "",
      selectedRange:
        host === "Excel" && window.OmniExcelActions
          ? await window.OmniExcelActions.getSelectedRangeAddress()
          : "",
      slideTitle:
        host === "PowerPoint" && window.OmniPowerPointActions
          ? await window.OmniPowerPointActions.getSlideTitle()
          : "",
      projectTaskSelection:
        host === "Project" && window.OmniProjectActions
          ? await window.OmniProjectActions.getSelection()
          : "",
      timestamp: new Date().toISOString(),
      profile: "Office Productivity",
    };
  }

  async function insertResult(text) {
    const host = getHostName();
    if (host === "Word") return window.OmniWordActions.insertText(text);
    if (host === "Excel") return window.OmniExcelActions.insertText(text);
    if (host === "PowerPoint") return window.OmniPowerPointActions.insertText(text);
    if (host === "Project") return window.OmniProjectActions.insertText(text);
    if (host === "Outlook") return window.OmniOutlookActions.insertText(text);
    throw new Error("Insert belum didukung pada host ini.");
  }

  async function replaceSelection(text) {
    const host = getHostName();
    if (host === "Word") return window.OmniWordActions.replaceSelection(text);
    if (host === "Excel") return window.OmniExcelActions.replaceSelection(text);
    if (host === "PowerPoint") return window.OmniPowerPointActions.replaceSelection(text);
    if (host === "Project") return window.OmniProjectActions.replaceSelection(text);
    if (host === "Outlook") return window.OmniOutlookActions.replaceSelection(text);
    throw new Error("Replace belum didukung pada host ini.");
  }

  window.OmniOfficeContext = {
    getHostName,
    getOfficeContext,
    insertResult,
    replaceSelection,
  };
})();
