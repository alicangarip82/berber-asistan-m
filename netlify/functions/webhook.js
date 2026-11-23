// Berber Onayla / Reddet dugmesine basinca calisir.
// Netlify > Environment variables: WHATSAPP_TOKEN, WHATSAPP_PHONE_ID, WEBHOOK_VERIFY_TOKEN
// Istege bagli ama onerilir: META_APP_SECRET (sahte istekleri engeller)
const crypto = require("crypto");

exports.handler = async (event) => {
  const { WHATSAPP_TOKEN: token, WHATSAPP_PHONE_ID: phoneId, WEBHOOK_VERIFY_TOKEN: verify, META_APP_SECRET: secret } = process.env;

  if (event.httpMethod === "GET") {
    const q = event.queryStringParameters || {};
    if (q["hub.mode"] === "subscribe" && verify && q["hub.verify_token"] === verify) return { statusCode: 200, body: q["hub.challenge"] };
    return { statusCode: 403, body: "forbidden" };
  }
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "" };

  if (secret) {
    const imza = (event.headers["x-hub-signature-256"] || "").replace("sha256=", "");
    const beklenen = crypto.createHmac("sha256", secret).update(event.body || "").digest("hex");
    let gecerli = false;
    try { gecerli = imza.length === beklenen.length && crypto.timingSafeEqual(Buffer.from(imza), Buffer.from(beklenen)); } catch (e) {}
    if (!gecerli) return { statusCode: 403, body: "forbidden" };
  }

  let d;
  try { d = JSON.parse(event.body || "{}"); } catch (e) { return { statusCode: 200, body: "ok" }; }

  const gonder = (payload) => fetch("https://graph.facebook.com/v23.0/" + phoneId + "/messages", {
    method: "POST",
    headers: { "Authorization": "Bearer " + token, "Content-Type": "application/json" },
    body: JSON.stringify(Object.assign({ messaging_product: "whatsapp" }, payload))
  });

  const msgs = [];
  (d.entry || []).forEach(e => (e.changes || []).forEach(c => ((c.value || {}).messages || []).forEach(m => msgs.push(m))));

  for (const m of msgs) {
    let kod = null, bilgi = null;
    if (m.type === "button" && m.button) {
      const p = String(m.button.payload || "").split("|");
      if ((p[0] === "ok" || p[0] === "no") && p.length >= 3) { kod = p[0]; bilgi = { tel: p[1], zaman: p.slice(2).join("|") }; }
      else kod = /onayla/i.test(m.button.text || "") ? "ok" : "no";
    } else continue;

    const onay = kod === "ok";
    let musteriye = null;
    if (bilgi && /^\d{10,15}$/.test(bilgi.tel)) {
      try {
        const r = await gonder({
          to: bilgi.tel, type: "template",
          template: { name: "randevu_sonucu", language: { code: "tr" },
            components: [{ type: "body", parameters: [bilgi.zaman, onay ? "onaylandı" : "maalesef onaylanamadı"].map(t => ({ type: "text", text: t })) }] }
        });
        musteriye = r.ok;
        if (!r.ok) console.error("Musteriye gonderilemedi", r.status, await r.text());
      } catch (e) { console.error(e); musteriye = false; }
    }
    const not = musteriye === true ? " Müşteriye bildirildi." : musteriye === false ? " Müşteriye iletilemedi, kendisini arayın." : "";
    try { await gonder({ to: m.from, type: "text", text: { body: (onay ? "✅ Randevu onaylandı." : "❌ Randevu reddedildi.") + not } }); } catch (e) { console.error(e); }
  }
  return { statusCode: 200, body: "ok" };
};
