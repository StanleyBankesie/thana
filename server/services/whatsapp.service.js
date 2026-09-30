const whatsappSender = async () => {
  const response = await fetch("https://www.wasenderapi.com/api/send-message", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.WHATSAPP_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      to: "+233596840018",
      text: "Hello, this is your update.",
    }),
  });

  const result = await response.json();
  console.log(result);
};

export default whatsappSender;
