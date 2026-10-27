(function () {
  async function getSelection() {
    return new Promise((resolve) => {
      Office.context.document.getSelectedDataAsync(
        Office.CoercionType.Text,
        {},
        (result) => resolve(result.status === Office.AsyncResultStatus.Succeeded ? result.value || "" : ""),
      );
    });
  }

  async function getSlideTitle() {
    return "";
  }

  async function insertText(text) {
    return new Promise((resolve, reject) => {
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

  window.OmniPowerPointActions = {
    getSelection,
    getSlideTitle,
    insertText,
    replaceSelection,
  };
})();
