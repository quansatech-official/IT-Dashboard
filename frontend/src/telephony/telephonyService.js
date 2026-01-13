const API = "/api/telephony";

const safeJson = async (response) => {
  if (!response.ok) {
    throw new Error("API request failed");
  }
  return response.json();
};

export const telephonyService = {
  fetchCalls: async (limit = 50) => {
    try {
      const response = await fetch(`${API}/calls?limit=${limit}`);
      return await safeJson(response);
    } catch (error) {
      return [];
    }
  },
  fetchLatestCallDebug: async () => {
    try {
      const response = await fetch(`${API}/calls?limit=1&include_raw=1`);
      return await safeJson(response);
    } catch (error) {
      return [];
    }
  },
  fetchStats: async () => {
    try {
      const response = await fetch(`${API}/stats`);
      return await safeJson(response);
    } catch (error) {
      return {
        today: { total: 0, answered: 0, missed: 0, avgDuration: 0 },
        last24h: { total: 0, answered: 0, missed: 0, avgDuration: 0 },
        last7d: { total: 0, answered: 0, missed: 0, avgDuration: 0 }
      };
    }
  },
  fetchSettings: async () => {
    try {
      const response = await fetch(`${API}/settings`);
      return await safeJson(response);
    } catch (error) {
      return {
        baseUrl: "",
        username: "",
        hasPassword: false,
        hasRefreshToken: false,
        streamEnabled: false
      };
    }
  },
  updateSettings: async (payload) => {
    try {
      const response = await fetch(`${API}/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      return await safeJson(response);
    } catch (error) {
      return null;
    }
  },
  fetchHealth: async () => {
    try {
      const response = await fetch(`${API}/health`);
      return response.ok;
    } catch (error) {
      return false;
    }
  }
};
