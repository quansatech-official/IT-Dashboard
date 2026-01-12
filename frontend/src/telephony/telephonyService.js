const API = "/api/telephony";

const safeJson = async (response) => {
  if (!response.ok) {
    throw new Error("API request failed");
  }
  return response.json();
};

export const telephonyService = {
  fetchCalls: async () => {
    try {
      const response = await fetch(`${API}/calls`);
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
        total: 0,
        answered: 0,
        missed: 0,
        avgDuration: 0,
        byHour: []
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
  }
};
