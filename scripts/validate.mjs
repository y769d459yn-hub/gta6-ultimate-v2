// Mini-validateur JSON Schema (sous-ensemble : type, required, properties, items, enum, pattern, min/max)
const typeOf = (v) => (v === null ? 'null' : Array.isArray(v) ? 'array' : Number.isInteger(v) ? 'integer' : typeof v);
export function validate(schema, data, path = '$', errs = []) {
  if (!schema) return errs;
  if (schema.enum && !schema.enum.includes(data)) errs.push(`${path} : valeur « ${data} » hors de [${schema.enum.join(', ')}]`);
  if (schema.type) {
    const t = typeOf(data);
    const ok = schema.type === 'number' ? t === 'number' || t === 'integer' : t === schema.type;
    if (!ok) { errs.push(`${path} : attendu ${schema.type}, reçu ${t}`); return errs; }
  }
  if (typeof data === 'string') {
    if (schema.minLength && data.length < schema.minLength) errs.push(`${path} : trop court (${data.length} < ${schema.minLength})`);
    if (schema.maxLength && data.length > schema.maxLength) errs.push(`${path} : trop long (${data.length} > ${schema.maxLength})`);
    if (schema.pattern && !new RegExp(schema.pattern).test(data)) errs.push(`${path} : ne respecte pas ${schema.pattern}`);
  }
  if (typeof data === 'number' && schema.minimum !== undefined && data < schema.minimum) errs.push(`${path} : < ${schema.minimum}`);
  if (Array.isArray(data)) {
    if (schema.minItems && data.length < schema.minItems) errs.push(`${path} : au moins ${schema.minItems} éléments`);
    if (schema.maxItems && data.length > schema.maxItems) errs.push(`${path} : au plus ${schema.maxItems} éléments`);
    if (schema.items) data.forEach((d, i) => validate(schema.items, d, `${path}[${i}]`, errs));
  }
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    (schema.required || []).forEach((k) => { if (!(k in data)) errs.push(`${path} : champ requis « ${k} » manquant`); });
    Object.entries(schema.properties || {}).forEach(([k, s]) => { if (k in data) validate(s, data[k], `${path}.${k}`, errs); });
  }
  return errs;
}
