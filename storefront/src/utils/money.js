/* Fonte ÚNICA de verdade para leitura de valores monetários digitados.
   Regra: o ÚLTIMO separador (, ou .) é decimal, exceto quando vem seguido
   de exatamente 3 dígitos e não há outro separador depois — aí é milhar.
     "0.5"       -> 0.5      (e NÃO 5, como acontecia ao remover todo ponto)
     "0,50"      -> 0.5
     "1.000"     -> 1000
     "1.234,56"  -> 1234.56
     "1,234.56"  -> 1234.56
     ",,,,"      -> 0        (nunca NaN)
*/
export function parseBRL(input) {
  var t = String(input == null ? "" : input).trim().replace(/[^\d.,-]/g, "");
  if (!t || /^[.,-]+$/.test(t)) return 0;
  var neg = t.charAt(0) === "-";
  t = t.replace(/-/g, "");
  var dec = Math.max(t.lastIndexOf(","), t.lastIndexOf("."));
  var value;
  if (dec === -1) {
    value = parseFloat(t);
  } else {
    var intPart = t.slice(0, dec).replace(/[.,]/g, "");
    var frac = t.slice(dec + 1).replace(/[.,]/g, "");
    if (frac.length === 3) {
      value = parseFloat(intPart + frac); // separador de milhar
    } else {
      value = parseFloat((intPart || "0") + "." + (frac || "0"));
    }
  }
  if (!isFinite(value)) return 0;
  return neg ? -value : value;
}

/* Arredonda para centavos antes de somar, evitando 10.999999999 */
export function cents(v) {
  return Math.round(parseBRL(v) * 100);
}

export function fromCents(c) {
  return c / 100;
}

export const AuroraMoney = { parseBRL, cents, fromCents };
export default AuroraMoney;
