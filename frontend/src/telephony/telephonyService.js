const API = "/api/telephony";
const CUSTOMER_API = "/api/customers";

const readJsonOrNull = async (response) => {
  try {
    return await response.json();
  } catch (error) {
    return null;
  }
};

const responseErrorDetail = async (response) => {
  const payload = await readJsonOrNull(response);
  if (typeof payload?.detail === "string" && payload.detail.trim()) {
    return payload.detail.trim();
  }
  return `HTTP ${response.status}`;
};

const safeJson = async (response) => {
  if (!response.ok) {
    throw new Error(await responseErrorDetail(response));
  }
  return response.json();
};

const normalizeCustomerPhonesForSave = (phones) => {
  if (!Array.isArray(phones)) return [];
  return phones
    .filter((phone) => String(phone?.label || "").trim() || String(phone?.number || "").trim())
    .map((phone) => ({
      id: Number.isInteger(phone?.id) ? phone.id : undefined,
      label: String(phone?.label || ""),
      number: String(phone?.number || ""),
    }));
};

export const telephonyService = {
  fetchCalls: async (limit = 100) => {
    try {
      const response = await fetch(`${API}/calls?limit=${limit}`);
      return await safeJson(response);
    } catch (error) {
      return [];
    }
  },
  fetchExtensions: async () => {
    try {
      const response = await fetch(`${API}/extensions`);
      return await safeJson(response);
    } catch (error) {
      return [];
    }
  },
  reverseLookup: async (number) => {
    try {
      const response = await fetch(`${API}/reverse?number=${encodeURIComponent(number)}`);
      return await safeJson(response);
    } catch (error) {
      return null;
    }
  },
  clickToDial: async ({ extension, number, calleeContext = "global" }) => {
    try {
      const response = await fetch(`${API}/calls`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          extension,
          number,
          callee_context: calleeContext
        })
      });
      return await safeJson(response);
    } catch (error) {
      return null;
    }
  },
  resolveCallback: async (uuid, resolved = true) => {
    try {
      const response = await fetch(`${API}/calls/${uuid}/callback_resolved`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resolved })
      });
      return await safeJson(response);
    } catch (error) {
      return null;
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
        last7d: { total: 0, answered: 0, missed: 0, avgDuration: 0 },
        currentMonth: { total: 0, answered: 0, missed: 0, avgDuration: 0 }
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
        streamEnabled: false,
        numerifyReverseUrl: "",
        numerifyApiHeader: "",
        hasNumerifyApiKey: false
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
  },
  fetchCustomers: async () => {
    try {
      const response = await fetch(CUSTOMER_API);
      return await safeJson(response);
    } catch (error) {
      return [];
    }
  },
  updateCustomer: async (customerId, payload) => {
    try {
      const normalizedPayload =
        payload && typeof payload === "object"
          ? {
              ...payload,
              ...(Object.prototype.hasOwnProperty.call(payload, "phones")
                ? { phones: normalizeCustomerPhonesForSave(payload.phones) }
                : {})
            }
          : payload;
      const response = await fetch(`${CUSTOMER_API}/${customerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(normalizedPayload)
      });
      return await safeJson(response);
    } catch (error) {
      return { error: error instanceof Error ? error.message : "customer_update_failed" };
    }
  },
  fetchPbxPhonebook: async () => {
    try {
      const response = await fetch(`/api/pbx_phonebook/remote?_pagesize=500`);
      if (response.ok) return await response.json();
      const fallback = await fetch(`/api/pbx_phonebook`);
      return await safeJson(fallback);
    } catch (error) {
      return [];
    }
  },
  createPbxPhonebookEntry: async ({ name, number, is_global = false }, options = {}) => {
    const { allowFallback = true } = options || {};
    try {
      const response = await fetch(`/api/pbx_phonebook/remote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, number, is_global })
      });
      if (response.ok) return await response.json();
      const errorText = await response.text();
      if (!allowFallback) {
        throw new Error(errorText || "remote_failed");
      }
      const fallback = await fetch(`/api/pbx_phonebook`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, number, is_global })
      });
      return await safeJson(fallback);
    } catch (error) {
      return null;
    }
  },
  checkPbxHealth: async () => {
    try {
      const response = await fetch(`/api/pbx_phonebook/remote?_pagesize=1`);
      return response.ok;
    } catch (error) {
      return false;
    }
  }
};
