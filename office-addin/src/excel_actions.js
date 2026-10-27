(function () {
  async function getSelection() {
    return Excel.run(async (context) => {
      const range = context.workbook.getSelectedRange();
      range.load(["address", "text"]);
      await context.sync();
      const rows = range.text || [];
      return rows.map((row) => row.join("\t")).join("\n").slice(0, 6000);
    }).catch(() => "");
  }

  async function getActiveSheetName() {
    return Excel.run(async (context) => {
      const sheet = context.workbook.worksheets.getActiveWorksheet();
      sheet.load("name");
      await context.sync();
      return sheet.name || "";
    }).catch(() => "");
  }

  async function getSelectedRangeAddress() {
    return Excel.run(async (context) => {
      const range = context.workbook.getSelectedRange();
      range.load("address");
      await context.sync();
      return range.address || "";
    }).catch(() => "");
  }

  async function insertText(text) {
    return Excel.run(async (context) => {
      const range = context.workbook.getSelectedRange();
      range.values = [[text]];
      await context.sync();
    });
  }

  async function replaceSelection(text) {
    return insertText(text);
  }

  window.OmniExcelActions = {
    getSelection,
    getActiveSheetName,
    getSelectedRangeAddress,
    insertText,
    replaceSelection,
  };
})();
