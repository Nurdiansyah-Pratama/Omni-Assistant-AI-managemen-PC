(function () {
  async function getSelection() {
    return Word.run(async (context) => {
      const range = context.document.getSelection();
      range.load("text");
      await context.sync();
      return range.text || "";
    }).catch(() => "");
  }

  async function getDocumentExcerpt() {
    return Word.run(async (context) => {
      const body = context.document.body;
      body.load("text");
      await context.sync();
      return (body.text || "").slice(0, 6000);
    }).catch(() => "");
  }

  async function insertText(text) {
    return Word.run(async (context) => {
      context.document.body.insertParagraph(text, Word.InsertLocation.end);
      await context.sync();
    });
  }

  async function replaceSelection(text) {
    return Word.run(async (context) => {
      const range = context.document.getSelection();
      range.insertText(text, Word.InsertLocation.replace);
      await context.sync();
    });
  }

  window.OmniWordActions = {
    getSelection,
    getDocumentExcerpt,
    insertText,
    replaceSelection,
  };
})();
