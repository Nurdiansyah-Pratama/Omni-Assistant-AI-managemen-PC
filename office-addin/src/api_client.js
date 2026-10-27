(function () {
  const BASE_URL = "http://127.0.0.1:17878";

  async function requestJson(path, payload) {
    const response = await fetch(`${BASE_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json().catch(() => ({
      success: false,
      result: "Response backend tidak valid.",
      warnings: [],
    }));
    if (!response.ok) return data;
    return data;
  }

  async function health() {
    try {
      const response = await fetch(`${BASE_URL}/api/health`);
      return response.ok;
    } catch {
      return false;
    }
  }

  window.OmniApiClient = {
    health,
    requestJson,
  };
})();
