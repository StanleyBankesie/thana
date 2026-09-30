// Use native fetch (Node 18+)
const _fetch = global.fetch;

export const isWhatsAppConfigured = () => {
  return !!process.env.GREEN_API_ID_INSTANCE && !!process.env.GREEN_API_TOKEN_INSTANCE;
};

export const sendWhatsApp = async ({ to, message }) => {
  if (!isWhatsAppConfigured()) {
    console.log(`[MOCK WHATSAPP] To: ${to} | Message: ${message}`);
    return;
  }

  try {
    const idInstance = process.env.GREEN_API_ID_INSTANCE;
    const apiTokenInstance = process.env.GREEN_API_TOKEN_INSTANCE;
    const apiUrl = `https://api.green-api.com/waInstance${idInstance}/sendMessage/${apiTokenInstance}`; 

    // Clean phone number (Meta/Green API expects pure digits, no '+')
    let cleanNumber = to.replace(/[^\d+]/g, "");
    
    // Fix for Ghana numbers with country code and local 0
    if (cleanNumber.startsWith("+2330") && cleanNumber.length === 14) {
      cleanNumber = "233" + cleanNumber.substring(5);
    } else if (cleanNumber.startsWith("2330") && cleanNumber.length === 13) {
      cleanNumber = "233" + cleanNumber.substring(4);
    } else if (cleanNumber.startsWith("+")) {
      cleanNumber = cleanNumber.substring(1);
    } else if (cleanNumber.startsWith("0") && cleanNumber.length === 10) {
      // Assuming it's a local Ghana number without country code
      cleanNumber = "233" + cleanNumber.substring(1);
    }

    const payload = {
      chatId: `${cleanNumber}@c.us`,
      message: message
    };

    const response = await _fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json().catch(() => ({}));
    
    if (!response.ok) {
      throw new Error(`Green API Error: ${data.message || response.statusText}`);
    }

    console.log(`[WHATSAPP] Sent successfully via Green API to ${cleanNumber}`);
    return data;
  } catch (error) {
    console.error("[WHATSAPP ERROR]", error.message);
    throw error;
  }
};
