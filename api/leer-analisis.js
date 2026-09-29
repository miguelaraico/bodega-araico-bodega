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
- "identificador" es la referencia que puso la bodega, en la columna "Identif.": D7, D22, B1, IS, DES2... Copiala tal cual, sin interpretarla.
- "fecha": la de toma de muestra; si no aparece, la de recepcion; si tampoco, la del boletin.
- "nPedido": el NºPedido (no el NºInforme).
- Un guion "-" o una celda vacia significan que ese parametro NO se ha analizado: van como null. No los conviertas en 0.
- Un valor por debajo del limite de cuantificacion ("<0,1", "<5(L.C.)", "<0,1 (L.C.)") si va como 0: se ha medido y da practicamente cero.
- Debajo de cada valor aparece su incertidumbre (± 0,25). Ignorala, no es un dato.
- Las comas decimales van como punto: 12,45 -> 12.45. Quita las unidades.
- "gradoAlcohol": el boletin puede traer dos columnas, "Grado alcoholico adquirido" (vino) y
  "Grado alcoholico probable / Refractometrico" (mosto). Usa la que tenga valor en esa fila;
  si las dos lo tienen, usa el adquirido. Una fila de mosto lleva el probable.
- "azucares": vale tanto "Azucares reductores" como "Azucares - Refractometria".
- NO inventes ningun valor. Un parametro que no este en el boletin va como null.
- Incluye TODAS las filas de muestra del boletin, en el orden en que aparecen.`;

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
