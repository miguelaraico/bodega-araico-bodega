// Funcion serverless (Vercel) que lee un boletin de analisis (PDF o foto) con Claude
// y devuelve las muestras en JSON. La API key vive SOLO aqui, en el servidor
// (variable de entorno ANTHROPIC_API_KEY), nunca llega al navegador.

export const config = { api: { bodyParser: { sizeLimit: "10mb" } } };

const PROMPT = `Extrae los datos de este boletin de analisis de laboratorio enologico.

Devuelve SOLO un JSON valido, sin texto alrededor ni markdown, con este formato exacto:
{
  "fecha": "YYYY-MM-DD",
  "nPedido": "string",
  "muestras": [
    {
      "nMuestra": "string",
      "identificador": "string",
      "producto": "string",
      "gradoAlcohol": number|null,
      "acidezTotal": number|null,
      "pH": number|null,
      "acidezVolatil": number|null,
      "so2Libre": number|null,
      "so2Total": number|null,
      "azucares": number|null,
      "acidoMalico": number|null
    }
  ]
}

Reglas:
- "identificador" es la referencia del deposito o barrica que puso la bodega (D1, D22, B7, 12...). Copiala tal cual.
- "fecha": la de toma de muestra o, si no aparece, la del boletin.
- Un valor por debajo del limite de cuantificacion ("<0,1", "<0,1 (L.C.)") se devuelve como 0.
- Las comas decimales van como punto: 12,45 -> 12.45.
- Ignora las incertidumbres (± 0,25) y las unidades.
- Un parametro que no aparezca en el boletin va como null. NO inventes ningun valor.
- Incluye TODAS las muestras del boletin, en el orden en que aparecen.`;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Metodo no permitido" });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "Falta configurar ANTHROPIC_API_KEY en Vercel" });

  try {
    const { archivo, mediaType } = req.body || {};
    if (!archivo) return res.status(400).json({ error: "No ha llegado el archivo" });

    const esPdf = mediaType === "application/pdf";
    const permitidas = ["application/pdf", "image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!permitidas.includes(mediaType)) {
      return res.status(400).json({ error: "Formato no admitido. Sube un PDF o una foto (JPG o PNG)." });
    }

    const bloque = esPdf
      ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: archivo } }
      : { type: "image",    source: { type: "base64", media_type: mediaType,        data: archivo } };

    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 8000,
        messages: [{ role: "user", content: [bloque, { type: "text", text: PROMPT }] }],
      }),
    });

    if (!r.ok) {
      const txt = await r.text();
      return res.status(502).json({ error: "Error de la API: " + txt.slice(0, 200) });
    }

    const data = await r.json();
    const texto = (data.content || []).filter(b => b.type === "text").map(b => b.text).join("\n");
    const limpio = texto.replace(/```json|```/g, "").trim();

    let parsed;
    try { parsed = JSON.parse(limpio); }
    catch { return res.status(502).json({ error: "No he sabido interpretar el boletin", crudo: limpio.slice(0, 300) }); }

    if (!parsed || !Array.isArray(parsed.muestras)) {
      return res.status(502).json({ error: "El boletin no traia muestras reconocibles" });
    }
    return res.status(200).json(parsed);
  } catch (e) {
    return res.status(500).json({ error: String((e && e.message) || e) });
  }
}
