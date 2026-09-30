// Use native fetch (Node 18+)
const _fetch = global.fetch;

export const isSMSConfigured = () => {
  return !!process.env.ARKESEL_API_KEY && !!process.env.ARKESEL_SENDER_ID;
};

export const sendSMS = async ({ to, message }) => {
  if (!isSMSConfigured()) {
    console.log(`[MOCK SMS] To: ${to} | Message: ${message}`);
    return;
  }

  try {
    const apiKey = process.env.ARKESEL_API_KEY;
    const senderId = process.env.ARKESEL_SENDER_ID;

    // Remove any non-numeric characters from the phone number
    let cleanNumber = to.replace(/\D/g, "");
    // Fix for Ghana numbers with country code and local 0
    if (cleanNumber.startsWith("2330") && cleanNumber.length === 13) {
      cleanNumber = "233" + cleanNumber.substring(4);
    }

    const response = await _fetch("https://sms.arkesel.com/api/v2/sms/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": apiKey,
      },
      body: JSON.stringify({
        sender: senderId,
        message: message,
        recipients: [cleanNumber],
      }),
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(`Arkesel API Error: ${data.message || response.statusText}`);
    }

    console.log(`[SMS] Sent successfully to ${cleanNumber}`);
    return data;
  } catch (error) {
    console.error("[SMS ERROR]", error.message);
    throw error;
  }
};
