exports.handler = async (event) => {
  const { WHATSAPP_TOKEN: token, WHATSAPP_PHONE_ID: phoneId, WEBHOOK_VERIFY_TOKEN: verify } = process.env;

  if (event.httpMethod === "GET") {
    const q = event.queryStringParameters || {};
    if (q["hub.mode"] === "subscribe" && verify && q["hub.verify_token"] === verify) {
      return { statusCode: 200, body: q["hub.challenge"] };
    }
    return { statusCode: 403, body: "forbidden" };
  }
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "" };

  let d;
  try { d = JSON.parse(event.body || "{}"); } catch (e) { return { statusCode: 200, body: "ok" }; }

  const msgs = [];
  (d.entry || []).forEach(e => (e.changes || []).forEach(c => {
    ((c.value || {}).messages || []).forEach(m => msgs.push(m));
  }));

  for (const m of msgs) {
    let secim = null;
    if (m.type === "button" && m.button) secim = m.button.text || m.button.payload;
    else if (m.type === "interactive" && m.interactive && m.interactive.button_reply) secim = m.interactive.button_reply.title;
    if (!secim) continue;

    const onay = /onayla/i.test(secim);
    const metin = onay ? "✅ Randevu onaylandı." : "❌ Randevu reddedildi.";
    try {
      await fetch("https://graph.facebook.com/v23.0/" + phoneId + "/messages", {
        method: "POST",
        headers: { "Authorization": "Bearer " + token, "Content-Type": "application/json" },
        body: JSON.stringify({ messaging_product: "whatsapp", to: m.from, type: "text", text: { body: metin } })
      });
    } catch (e) { console.error(e); }
  }
  return { statusCode: 200, body: "ok" };
};
