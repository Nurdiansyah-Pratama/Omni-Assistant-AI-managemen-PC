(function () {
  async function getSelection() {
    return new Promise((resolve) => {
      if (!Office.context.document?.getSelectedDataAsync) {
        resolve("");
        return;
      }
      Office.context.document.getSelectedDataAsync(
        Office.CoercionType.Text,
        {},
        (result) => resolve(result.status === Office.AsyncResultStatus.Succeeded ? result.value || "" : ""),
      );
    });
  }

  async function insertText(text) {
    return new Promise((resolve, reject) => {
      if (!Office.context.document?.setSelectedDataAsync) {
        reject(new Error("Insert belum didukung pada Project host ini."));
        return;
      }
      Office.context.document.setSelectedDataAsync(
        text,
        { coercionType: Office.CoercionType.Text },
        (result) =>
          result.status === Office.AsyncResultStatus.Succeeded
            ? resolve()
            : reject(result.error),
      );
    });
  }

  async function replaceSelection(text) {
    return insertText(text);
  }

  window.OmniProjectActions = {
    getSelection,
    insertText,
    replaceSelection,
  };
})();
