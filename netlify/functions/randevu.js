exports.handler = async (event) => {
  const json = (code, obj) => ({ statusCode: code, headers: { "Content-Type": "application/json" }, body: JSON.stringify(obj) });
  const { WHATSAPP_TOKEN: token, WHATSAPP_PHONE_ID: phoneId, BERBER_WHATSAPP: to } = process.env;
  const clean = (s, n) => String(s || "").replace(/\s+/g, " ").trim().slice(0, n);

  async function gonder(vals) {
    const body = {
      messaging_product: "whatsapp",
      to: String(to).replace(/\D/g, ""),
      type: "template",
      template: {
        name: "yeni_randevu",
        language: { code: "tr" },
        components: [{ type: "body", parameters: vals.map(t => ({ type: "text", text: t })) }]
      }
    };
    const res = await fetch("https://graph.facebook.com/v23.0/" + phoneId + "/messages", {
      method: "POST",
      headers: { "Authorization": "Bearer " + token, "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    let d = {};
    try { d = await res.json(); } catch (e) {}
    const er = d.error || null;
    return {
      ok: res.ok, status: res.status,
      hata: er ? { kod: er.code, alt: er.error_subcode, mesaj: er.message, detay: er.error_data && er.error_data.details } : null
    };
  }

  // GECICI TEST: tarayicidan ...randevu?test=1 (sorun cozulunce silinecek)
  if (event.httpMethod === "GET") {
    const q = event.queryStringParameters || {};
    if (!q.test) return json(200, { ok: false });
    const env = { token: !!token, phoneId: phoneId || null, to: to || null };
    if (!token || !phoneId || !to) return json(200, { ok: false, env });
    try {
      const r = await gonder(["Test randevusu", "Saç Kesimi", "25 Kasım Çarşamba", "10:00"]);
      return json(200, { ok: r.ok, env, meta: r });
    } catch (e) { return json(200, { ok: false, env, hata: String(e) }); }
  }

  if (event.httpMethod !== "POST") return json(405, { ok: false });
  let d;
  try { d = JSON.parse(event.body || "{}"); } catch (e) { return json(400, { ok: false }); }
  if (d.website) return json(200, { ok: true });
  const isim = clean(d.isim, 50), hizmet = clean(d.hizmet, 40), tarih = clean(d.tarih, 40), saat = clean(d.saat, 5);
  if (isim.length < 2 || !hizmet || !tarih || !/^\d{2}:\d{2}$/.test(saat)) return json(400, { ok: false });
  if (!token || !phoneId || !to) return json(500, { ok: false });

  try {
    const r = await gonder([isim, hizmet, tarih, saat]);
    if (!r.ok) { console.error("Meta hata", JSON.stringify(r)); return json(502, { ok: false }); }
    return json(200, { ok: true });
  } catch (e) {
    console.error(e);
    return json(502, { ok: false });
  }
};
