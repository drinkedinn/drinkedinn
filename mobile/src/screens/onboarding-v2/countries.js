// src/screens/onboarding-v2/countries.js
// ISO 3166-1 alpha-2 codes + display names for the onboarding country picker.
//
// Stored as one pipe-delimited string and split at module load so the source
// stays readable and the bundle stays small. No names contain a "|" or ":".
// Kept local to the onboarding module — there is no shared country list in the
// app yet, and this file must not edit anything outside it.

const RAW =
  'AF:Afghanistan|AL:Albania|DZ:Algeria|AD:Andorra|AO:Angola|AG:Antigua and Barbuda|' +
  'AR:Argentina|AM:Armenia|AU:Australia|AT:Austria|AZ:Azerbaijan|BS:Bahamas|BH:Bahrain|' +
  'BD:Bangladesh|BB:Barbados|BY:Belarus|BE:Belgium|BZ:Belize|BJ:Benin|BM:Bermuda|' +
  'BT:Bhutan|BO:Bolivia|BA:Bosnia and Herzegovina|BW:Botswana|BR:Brazil|BN:Brunei|' +
  'BG:Bulgaria|BF:Burkina Faso|BI:Burundi|KH:Cambodia|CM:Cameroon|CA:Canada|' +
  'CV:Cape Verde|KY:Cayman Islands|CF:Central African Republic|TD:Chad|CL:Chile|' +
  'CN:China|CO:Colombia|KM:Comoros|CG:Congo (Republic)|CD:Congo (DRC)|CR:Costa Rica|' +
  'CI:Cote d Ivoire|HR:Croatia|CU:Cuba|CY:Cyprus|CZ:Czechia|DK:Denmark|DJ:Djibouti|' +
  'DM:Dominica|DO:Dominican Republic|EC:Ecuador|EG:Egypt|SV:El Salvador|' +
  'GQ:Equatorial Guinea|ER:Eritrea|EE:Estonia|SZ:Eswatini|ET:Ethiopia|FJ:Fiji|' +
  'FI:Finland|FR:France|PF:French Polynesia|GA:Gabon|GM:Gambia|GE:Georgia|DE:Germany|' +
  'GH:Ghana|GI:Gibraltar|GR:Greece|GL:Greenland|GD:Grenada|GU:Guam|GT:Guatemala|' +
  'GG:Guernsey|GN:Guinea|GW:Guinea-Bissau|GY:Guyana|HT:Haiti|HN:Honduras|HK:Hong Kong|' +
  'HU:Hungary|IS:Iceland|IN:India|ID:Indonesia|IR:Iran|IQ:Iraq|IE:Ireland|' +
  'IM:Isle of Man|IL:Israel|IT:Italy|JM:Jamaica|JP:Japan|JE:Jersey|JO:Jordan|' +
  'KZ:Kazakhstan|KE:Kenya|KI:Kiribati|KW:Kuwait|KG:Kyrgyzstan|LA:Laos|LV:Latvia|' +
  'LB:Lebanon|LS:Lesotho|LR:Liberia|LY:Libya|LI:Liechtenstein|LT:Lithuania|' +
  'LU:Luxembourg|MO:Macao|MG:Madagascar|MW:Malawi|MY:Malaysia|MV:Maldives|ML:Mali|' +
  'MT:Malta|MH:Marshall Islands|MR:Mauritania|MU:Mauritius|MX:Mexico|FM:Micronesia|' +
  'MD:Moldova|MC:Monaco|MN:Mongolia|ME:Montenegro|MA:Morocco|MZ:Mozambique|' +
  'MM:Myanmar|NA:Namibia|NR:Nauru|NP:Nepal|NL:Netherlands|NC:New Caledonia|' +
  'NZ:New Zealand|NI:Nicaragua|NE:Niger|NG:Nigeria|MK:North Macedonia|NO:Norway|' +
  'OM:Oman|PK:Pakistan|PW:Palau|PS:Palestine|PA:Panama|PG:Papua New Guinea|' +
  'PY:Paraguay|PE:Peru|PH:Philippines|PL:Poland|PT:Portugal|PR:Puerto Rico|QA:Qatar|' +
  'RO:Romania|RU:Russia|RW:Rwanda|KN:Saint Kitts and Nevis|LC:Saint Lucia|' +
  'VC:Saint Vincent and the Grenadines|WS:Samoa|SM:San Marino|' +
  'ST:Sao Tome and Principe|SA:Saudi Arabia|SN:Senegal|RS:Serbia|SC:Seychelles|' +
  'SL:Sierra Leone|SG:Singapore|SK:Slovakia|SI:Slovenia|SB:Solomon Islands|' +
  'SO:Somalia|ZA:South Africa|KR:South Korea|SS:South Sudan|ES:Spain|LK:Sri Lanka|' +
  'SD:Sudan|SR:Suriname|SE:Sweden|CH:Switzerland|SY:Syria|TW:Taiwan|TJ:Tajikistan|' +
  'TZ:Tanzania|TH:Thailand|TL:Timor-Leste|TG:Togo|TO:Tonga|TT:Trinidad and Tobago|' +
  'TN:Tunisia|TR:Turkiye|TM:Turkmenistan|TV:Tuvalu|UG:Uganda|UA:Ukraine|' +
  'AE:United Arab Emirates|GB:United Kingdom|US:United States|UY:Uruguay|' +
  'UZ:Uzbekistan|VU:Vanuatu|VA:Vatican City|VE:Venezuela|VN:Vietnam|YE:Yemen|' +
  'ZM:Zambia|ZW:Zimbabwe';

export const COUNTRIES = RAW.split('|')
  .map((entry) => {
    const i = entry.indexOf(':');
    if (i < 1) return null;
    const code = entry.slice(0, i).trim();
    const name = entry.slice(i + 1).trim();
    if (!code || !name) return null;
    return { code, name, search: name.toLowerCase() };
  })
  .filter(Boolean);

const BY_CODE = new Map(COUNTRIES.map((c) => [c.code, c]));

/** Look up a country by ISO code. Returns null for anything unrecognised. */
export function countryByCode(code) {
  if (!code) return null;
  return BY_CODE.get(String(code).toUpperCase()) || null;
}

export default COUNTRIES;
