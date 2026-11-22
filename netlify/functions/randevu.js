exports.handler = async (event) => {
  const json = (code, obj) => ({ statusCode: code, headers: { "Content-Type": "application/json" }, body: JSON.stringify(obj) });
  if (event.httpMethod !== "POST") return json(405, { ok: false });

  const { WHATSAPP_TOKEN: token, WHATSAPP_PHONE_ID: phoneId, BERBER_WHATSAPP: to } = process.env;
  if (!token || !phoneId || !to) return json(500, { ok: false });

  let d;
  try { d = JSON.parse(event.body || "{}"); } catch (e) { return json(400, { ok: false }); }
  if (d.website) return json(200, { ok: true });

  const clean = (s, n) => String(s || "").replace(/\s+/g, " ").trim().slice(0, n);
  const isim = clean(d.isim, 50), hizmet = clean(d.hizmet, 40), tarih = clean(d.tarih, 40), saat = clean(d.saat, 5);
  if (isim.length < 2 || !hizmet || !tarih || !/^\d{2}:\d{2}$/.test(saat)) return json(400, { ok: false });

  const body = {
    messaging_product: "whatsapp",
    to: String(to).replace(/\D/g, ""),
    type: "template",
    template: {
      name: "yeni_randevu",
      language: { code: "tr" },
      components: [{
        type: "body",
        parameters: [isim, hizmet, tarih, saat].map(t => ({ type: "text", text: t }))
      }]
    }
  };

  try {
    const res = await fetch("https://graph.facebook.com/v23.0/" + phoneId + "/messages", {
      method: "POST",
      headers: { "Authorization": "Bearer " + token, "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    if (!res.ok) { console.error("Meta hata", res.status, await res.text()); return json(502, { ok: false }); }
    return json(200, { ok: true });
  } catch (e) {
    console.error(e);
    return json(502, { ok: false });
  }
};
