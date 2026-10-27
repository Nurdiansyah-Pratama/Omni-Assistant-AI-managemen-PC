(function () {
  function getItem() {
    return Office.context.mailbox?.item;
  }

  async function getSelection() {
    return getBodyExcerpt();
  }

  async function getBodyExcerpt() {
    return new Promise((resolve) => {
      const item = getItem();
      if (!item?.body?.getAsync) {
        resolve("");
        return;
      }
      item.body.getAsync(Office.CoercionType.Text, (result) => {
        resolve(
          result.status === Office.AsyncResultStatus.Succeeded
            ? String(result.value || "").slice(0, 6000)
            : "",
        );
      });
    });
  }

  async function insertText(text) {
    return new Promise((resolve, reject) => {
      const item = getItem();
      if (!item?.body?.setSelectedDataAsync) {
        reject(new Error("Insert belum didukung pada item Outlook ini."));
        return;
      }
      item.body.setSelectedDataAsync(
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

  window.OmniOutlookActions = {
    getSelection,
    getBodyExcerpt,
    insertText,
    replaceSelection,
  };
})();
