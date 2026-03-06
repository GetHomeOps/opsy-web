/**
 * List of countries with their details
 * @typedef {Object} Country
 * @property {number} id - Unique identifier for the country
 * @property {string} flag - Country flag emoji
 * @property {string} name - Country name in English
 * @property {string} countryCode - ISO 3166-1 alpha-3 country code (e.g., USA, GBR)
 * @property {string} phoneCode - International phone code with + prefix
 */

export const countries = [
  { id: 1, name: "Afghanistan", countryCode: "AFG", phoneCode: "+93", flag: "🇦🇫" },
  { id: 2, name: "Albania", countryCode: "ALB", phoneCode: "+355", flag: "🇦🇱" },
  { id: 3, name: "Algeria", countryCode: "DZA", phoneCode: "+213", flag: "🇩🇿" },
  { id: 4, name: "Andorra", countryCode: "AND", phoneCode: "+376", flag: "🇦🇩" },
  { id: 5, name: "Angola", countryCode: "AGO", phoneCode: "+244", flag: "🇦🇴" },
  { id: 6, name: "Antigua and Barbuda", countryCode: "ATG", phoneCode: "+1", flag: "🇦🇬" },
  { id: 7, name: "Argentina", countryCode: "ARG", phoneCode: "+54", flag: "🇦🇷" },
  { id: 8, name: "Armenia", countryCode: "ARM", phoneCode: "+374", flag: "🇦🇲" },
  { id: 9, name: "Australia", countryCode: "AUS", phoneCode: "+61", flag: "🇦🇺" },
  { id: 10, name: "Austria", countryCode: "AUT", phoneCode: "+43", flag: "🇦🇹" },
  { id: 11, name: "Azerbaijan", countryCode: "AZE", phoneCode: "+994", flag: "🇦🇿" },
  { id: 12, name: "Bahamas", countryCode: "BHS", phoneCode: "+1", flag: "🇧🇸" },
  { id: 13, name: "Bahrain", countryCode: "BHR", phoneCode: "+973", flag: "🇧🇭" },
  { id: 14, name: "Bangladesh", countryCode: "BGD", phoneCode: "+880", flag: "🇧🇩" },
  { id: 15, name: "Barbados", countryCode: "BRB", phoneCode: "+1", flag: "🇧🇧" },
  { id: 16, name: "Belarus", countryCode: "BLR", phoneCode: "+375", flag: "🇧🇾" },
  { id: 17, name: "Belgium", countryCode: "BEL", phoneCode: "+32", flag: "🇧🇪" },
  { id: 18, name: "Belize", countryCode: "BLZ", phoneCode: "+501", flag: "🇧🇿" },
  { id: 19, name: "Benin", countryCode: "BEN", phoneCode: "+229", flag: "🇧🇯" },
  { id: 20, name: "Bhutan", countryCode: "BTN", phoneCode: "+975", flag: "🇧🇹" },
  { id: 21, name: "Bolivia", countryCode: "BOL", phoneCode: "+591", flag: "🇧🇴" },
  { id: 22, name: "Bosnia and Herzegovina", countryCode: "BIH", phoneCode: "+387", flag: "🇧🇦" },
  { id: 23, name: "Botswana", countryCode: "BWA", phoneCode: "+267", flag: "🇧🇼" },
  { id: 24, name: "Brazil", countryCode: "BRA", phoneCode: "+55", flag: "🇧🇷" },
  { id: 25, name: "Brunei", countryCode: "BRN", phoneCode: "+673", flag: "🇧🇳" },
  { id: 26, name: "Bulgaria", countryCode: "BGR", phoneCode: "+359", flag: "🇧🇬" },
  { id: 27, name: "Burkina Faso", countryCode: "BFA", phoneCode: "+226", flag: "🇧🇫" },
  { id: 28, name: "Burundi", countryCode: "BDI", phoneCode: "+257", flag: "🇧🇮" },
  { id: 29, name: "Cabo Verde", countryCode: "CPV", phoneCode: "+238", flag: "🇨🇻" },
  { id: 30, name: "Cambodia", countryCode: "KHM", phoneCode: "+855", flag: "🇰🇭" },
  { id: 31, name: "Cameroon", countryCode: "CMR", phoneCode: "+237", flag: "🇨🇲" },
  { id: 32, name: "Canada", countryCode: "CAN", phoneCode: "+1", flag: "🇨🇦" },
  { id: 33, name: "Central African Republic", countryCode: "CAF", phoneCode: "+236", flag: "🇨🇫" },
  { id: 34, name: "Chad", countryCode: "TCD", phoneCode: "+235", flag: "🇹🇩" },
  { id: 35, name: "Chile", countryCode: "CHL", phoneCode: "+56", flag: "🇨🇱" },
  { id: 36, name: "China", countryCode: "CHN", phoneCode: "+86", flag: "🇨🇳" },
  { id: 37, name: "Colombia", countryCode: "COL", phoneCode: "+57", flag: "🇨🇴" },
  { id: 38, name: "Comoros", countryCode: "COM", phoneCode: "+269", flag: "🇰🇲" },
  { id: 39, name: "Congo", countryCode: "COG", phoneCode: "+242", flag: "🇨🇬" },
  { id: 40, name: "Costa Rica", countryCode: "CRI", phoneCode: "+506", flag: "🇨🇷" },
  { id: 41, name: "Croatia", countryCode: "HRV", phoneCode: "+385", flag: "🇭🇷" },
  { id: 42, name: "Cuba", countryCode: "CUB", phoneCode: "+53", flag: "🇨🇺" },
  { id: 43, name: "Cyprus", countryCode: "CYP", phoneCode: "+357", flag: "🇨🇾" },
  { id: 44, name: "Czech Republic", countryCode: "CZE", phoneCode: "+420", flag: "🇨🇿" },
  { id: 45, name: "Denmark", countryCode: "DNK", phoneCode: "+45", flag: "🇩🇰" },
  { id: 46, name: "Djibouti", countryCode: "DJI", phoneCode: "+253", flag: "🇩🇯" },
  { id: 47, name: "Dominica", countryCode: "DMA", phoneCode: "+1", flag: "🇩🇲" },
  { id: 48, name: "Dominican Republic", countryCode: "DOM", phoneCode: "+1", flag: "🇩🇴" },
  { id: 49, name: "Ecuador", countryCode: "ECU", phoneCode: "+593", flag: "🇪🇨" },
  { id: 50, name: "Egypt", countryCode: "EGY", phoneCode: "+20", flag: "🇪🇬" },
  { id: 51, name: "El Salvador", countryCode: "SLV", phoneCode: "+503", flag: "🇸🇻" },
  { id: 52, name: "Equatorial Guinea", countryCode: "GNQ", phoneCode: "+240", flag: "🇬🇶" },
  { id: 53, name: "Eritrea", countryCode: "ERI", phoneCode: "+291", flag: "🇪🇷" },
  { id: 54, name: "Estonia", countryCode: "EST", phoneCode: "+372", flag: "🇪🇪" },
  { id: 55, name: "Eswatini", countryCode: "SWZ", phoneCode: "+268", flag: "🇸🇿" },
  { id: 56, name: "Ethiopia", countryCode: "ETH", phoneCode: "+251", flag: "🇪🇹" },
  { id: 57, name: "Fiji", countryCode: "FJI", phoneCode: "+679", flag: "🇫🇯" },
  { id: 58, name: "Finland", countryCode: "FIN", phoneCode: "+358", flag: "🇫🇮" },
  { id: 59, name: "France", countryCode: "FRA", phoneCode: "+33", flag: "🇫🇷" },
  { id: 60, name: "Gabon", countryCode: "GAB", phoneCode: "+241", flag: "🇬🇦" },
  { id: 61, name: "Gambia", countryCode: "GMB", phoneCode: "+220", flag: "🇬🇲" },
  { id: 62, name: "Georgia", countryCode: "GEO", phoneCode: "+995", flag: "🇬🇪" },
  { id: 63, name: "Germany", countryCode: "DEU", phoneCode: "+49", flag: "🇩🇪" },
  { id: 64, name: "Ghana", countryCode: "GHA", phoneCode: "+233", flag: "🇬🇭" },
  { id: 65, name: "Greece", countryCode: "GRC", phoneCode: "+30", flag: "🇬🇷" },
  { id: 66, name: "Grenada", countryCode: "GRD", phoneCode: "+1", flag: "🇬🇩" },
  { id: 67, name: "Guatemala", countryCode: "GTM", phoneCode: "+502", flag: "🇬🇹" },
  { id: 68, name: "Guinea", countryCode: "GIN", phoneCode: "+224", flag: "🇬🇳" },
  { id: 69, name: "Guinea-Bissau", countryCode: "GNB", phoneCode: "+245", flag: "🇬🇼" },
  { id: 70, name: "Guyana", countryCode: "GUY", phoneCode: "+592", flag: "🇬🇾" },
  { id: 71, name: "Haiti", countryCode: "HTI", phoneCode: "+509", flag: "🇭🇹" },
  { id: 72, name: "Honduras", countryCode: "HND", phoneCode: "+504", flag: "🇭🇳" },
  { id: 73, name: "Hungary", countryCode: "HUN", phoneCode: "+36", flag: "🇭🇺" },
  { id: 74, name: "Iceland", countryCode: "ISL", phoneCode: "+354", flag: "🇮🇸" },
  { id: 75, name: "India", countryCode: "IND", phoneCode: "+91", flag: "🇮🇳" },
  { id: 76, name: "Indonesia", countryCode: "IDN", phoneCode: "+62", flag: "🇮🇩" },
  { id: 77, name: "Iran", countryCode: "IRN", phoneCode: "+98", flag: "🇮🇷" },
  { id: 78, name: "Iraq", countryCode: "IRQ", phoneCode: "+964", flag: "🇮🇶" },
  { id: 79, name: "Ireland", countryCode: "IRL", phoneCode: "+353", flag: "🇮🇪" },
  { id: 80, name: "Israel", countryCode: "ISR", phoneCode: "+972", flag: "🇮🇱" },
  { id: 81, name: "Italy", countryCode: "ITA", phoneCode: "+39", flag: "🇮🇹" },
  { id: 82, name: "Jamaica", countryCode: "JAM", phoneCode: "+1", flag: "🇯🇲" },
  { id: 83, name: "Japan", countryCode: "JPN", phoneCode: "+81", flag: "🇯🇵" },
  { id: 84, name: "Jordan", countryCode: "JOR", phoneCode: "+962", flag: "🇯🇴" },
  { id: 85, name: "Kazakhstan", countryCode: "KAZ", phoneCode: "+7", flag: "🇰🇿" },
  { id: 86, name: "Kenya", countryCode: "KEN", phoneCode: "+254", flag: "🇰🇪" },
  { id: 87, name: "Kiribati", countryCode: "KIR", phoneCode: "+686", flag: "🇰🇮" },
  { id: 88, name: "Kuwait", countryCode: "KWT", phoneCode: "+965", flag: "🇰🇼" },
  { id: 89, name: "Kyrgyzstan", countryCode: "KGZ", phoneCode: "+996", flag: "🇰🇬" },
  { id: 90, name: "Laos", countryCode: "LAO", phoneCode: "+856", flag: "🇱🇦" },
  { id: 91, name: "Latvia", countryCode: "LVA", phoneCode: "+371", flag: "🇱🇻" },
  { id: 92, name: "Lebanon", countryCode: "LBN", phoneCode: "+961", flag: "🇱🇧" },
  { id: 93, name: "Lesotho", countryCode: "LSO", phoneCode: "+266", flag: "🇱🇸" },
  { id: 94, name: "Liberia", countryCode: "LBR", phoneCode: "+231", flag: "🇱🇷" },
  { id: 95, name: "Libya", countryCode: "LBY", phoneCode: "+218", flag: "🇱🇾" },
  { id: 96, name: "Liechtenstein", countryCode: "LIE", phoneCode: "+423", flag: "🇱🇮" },
  { id: 97, name: "Lithuania", countryCode: "LTU", phoneCode: "+370", flag: "🇱🇹" },
  { id: 98, name: "Luxembourg", countryCode: "LUX", phoneCode: "+352", flag: "🇱🇺" },
  { id: 99, name: "Madagascar", countryCode: "MDG", phoneCode: "+261", flag: "🇲🇬" },
  { id: 100, name: "Malawi", countryCode: "MWI", phoneCode: "+265", flag: "🇲🇼" },
  { id: 101, name: "Malaysia", countryCode: "MYS", phoneCode: "+60", flag: "🇲🇾" },
  { id: 102, name: "Maldives", countryCode: "MDV", phoneCode: "+960", flag: "🇲🇻" },
  { id: 103, name: "Mali", countryCode: "MLI", phoneCode: "+223", flag: "🇲🇱" },
  { id: 104, name: "Malta", countryCode: "MLT", phoneCode: "+356", flag: "🇲🇹" },
  { id: 105, name: "Marshall Islands", countryCode: "MHL", phoneCode: "+692", flag: "🇲🇭" },
  { id: 106, name: "Mauritania", countryCode: "MRT", phoneCode: "+222", flag: "🇲🇷" },
  { id: 107, name: "Mauritius", countryCode: "MUS", phoneCode: "+230", flag: "🇲🇺" },
  { id: 108, name: "Mexico", countryCode: "MEX", phoneCode: "+52", flag: "🇲🇽" },
  { id: 109, name: "Micronesia", countryCode: "FSM", phoneCode: "+691", flag: "🇫🇲" },
  { id: 110, name: "Moldova", countryCode: "MDA", phoneCode: "+373", flag: "🇲🇩" },
  { id: 111, name: "Monaco", countryCode: "MCO", phoneCode: "+377", flag: "🇲🇨" },
  { id: 112, name: "Mongolia", countryCode: "MNG", phoneCode: "+976", flag: "🇲🇳" },
  { id: 113, name: "Montenegro", countryCode: "MNE", phoneCode: "+382", flag: "🇲🇪" },
  { id: 114, name: "Morocco", countryCode: "MAR", phoneCode: "+212", flag: "🇲🇦" },
  { id: 115, name: "Mozambique", countryCode: "MOZ", phoneCode: "+258", flag: "🇲🇿" },
  { id: 116, name: "Myanmar", countryCode: "MMR", phoneCode: "+95", flag: "🇲🇲" },
  { id: 117, name: "Namibia", countryCode: "NAM", phoneCode: "+264", flag: "🇳🇦" },
  { id: 118, name: "Nauru", countryCode: "NRU", phoneCode: "+674", flag: "🇳🇷" },
  { id: 119, name: "Nepal", countryCode: "NPL", phoneCode: "+977", flag: "🇳🇵" },
  { id: 120, name: "Netherlands", countryCode: "NLD", phoneCode: "+31", flag: "🇳🇱" },
  { id: 121, name: "New Zealand", countryCode: "NZL", phoneCode: "+64", flag: "🇳🇿" },
  { id: 122, name: "Nicaragua", countryCode: "NIC", phoneCode: "+505", flag: "🇳🇮" },
  { id: 123, name: "Niger", countryCode: "NER", phoneCode: "+227", flag: "🇳🇪" },
  { id: 124, name: "Nigeria", countryCode: "NGA", phoneCode: "+234", flag: "🇳🇬" },
  { id: 125, name: "North Korea", countryCode: "PRK", phoneCode: "+850", flag: "🇰🇵" },
  { id: 126, name: "North Macedonia", countryCode: "MKD", phoneCode: "+389", flag: "🇲🇰" },
  { id: 127, name: "Norway", countryCode: "NOR", phoneCode: "+47", flag: "🇳🇴" },
  { id: 128, name: "Oman", countryCode: "OMN", phoneCode: "+968", flag: "🇴🇲" },
  { id: 129, name: "Pakistan", countryCode: "PAK", phoneCode: "+92", flag: "🇵🇰" },
  { id: 130, name: "Palau", countryCode: "PLW", phoneCode: "+680", flag: "🇵🇼" },
  { id: 131, name: "Palestine", countryCode: "PSE", phoneCode: "+970", flag: "🇵🇸" },
  { id: 132, name: "Panama", countryCode: "PAN", phoneCode: "+507", flag: "🇵🇦" },
  { id: 133, name: "Papua New Guinea", countryCode: "PNG", phoneCode: "+675", flag: "🇵🇬" },
  { id: 134, name: "Paraguay", countryCode: "PRY", phoneCode: "+595", flag: "🇵🇾" },
  { id: 135, name: "Peru", countryCode: "PER", phoneCode: "+51", flag: "🇵🇪" },
  { id: 136, name: "Philippines", countryCode: "PHL", phoneCode: "+63", flag: "🇵🇭" },
  { id: 137, name: "Poland", countryCode: "POL", phoneCode: "+48", flag: "🇵🇱" },
  { id: 138, name: "Portugal", countryCode: "PRT", phoneCode: "+351", flag: "🇵🇹" },
  { id: 139, name: "Qatar", countryCode: "QAT", phoneCode: "+974", flag: "🇶🇦" },
  { id: 140, name: "Romania", countryCode: "ROU", phoneCode: "+40", flag: "🇷🇴" },
  { id: 141, name: "Russia", countryCode: "RUS", phoneCode: "+7", flag: "🇷🇺" },
  { id: 142, name: "Rwanda", countryCode: "RWA", phoneCode: "+250", flag: "🇷🇼" },
  { id: 143, name: "Saint Kitts and Nevis", countryCode: "KNA", phoneCode: "+1", flag: "🇰🇳" },
  { id: 144, name: "Saint Lucia", countryCode: "LCA", phoneCode: "+1", flag: "🇱🇨" },
  { id: 145, name: "Saint Vincent and the Grenadines", countryCode: "VCT", phoneCode: "+1", flag: "🇻🇨" },
  { id: 146, name: "Samoa", countryCode: "WSM", phoneCode: "+685", flag: "🇼🇸" },
  { id: 147, name: "San Marino", countryCode: "SMR", phoneCode: "+378", flag: "🇸🇲" },
  { id: 148, name: "Sao Tome and Principe", countryCode: "STP", phoneCode: "+239", flag: "🇸🇹" },
  { id: 149, name: "Saudi Arabia", countryCode: "SAU", phoneCode: "+966", flag: "🇸🇦" },
  { id: 150, name: "Senegal", countryCode: "SEN", phoneCode: "+221", flag: "🇸🇳" },
  { id: 151, name: "Serbia", countryCode: "SRB", phoneCode: "+381", flag: "🇷🇸" },
  { id: 152, name: "Seychelles", countryCode: "SYC", phoneCode: "+248", flag: "🇸🇨" },
  { id: 153, name: "Sierra Leone", countryCode: "SLE", phoneCode: "+232", flag: "🇸🇱" },
  { id: 154, name: "Singapore", countryCode: "SGP", phoneCode: "+65", flag: "🇸🇬" },
  { id: 155, name: "Slovakia", countryCode: "SVK", phoneCode: "+421", flag: "🇸🇰" },
  { id: 156, name: "Slovenia", countryCode: "SVN", phoneCode: "+386", flag: "🇸🇮" },
  { id: 157, name: "Solomon Islands", countryCode: "SLB", phoneCode: "+677", flag: "🇸🇧" },
  { id: 158, name: "Somalia", countryCode: "SOM", phoneCode: "+252", flag: "🇸🇴" },
  { id: 159, name: "South Africa", countryCode: "ZAF", phoneCode: "+27", flag: "🇿🇦" },
  { id: 160, name: "South Korea", countryCode: "KOR", phoneCode: "+82", flag: "🇰🇷" },
  { id: 161, name: "South Sudan", countryCode: "SSD", phoneCode: "+211", flag: "🇸🇸" },
  { id: 162, name: "Spain", countryCode: "ESP", phoneCode: "+34", flag: "🇪🇸" },
  { id: 163, name: "Sri Lanka", countryCode: "LKA", phoneCode: "+94", flag: "🇱🇰" },
  { id: 164, name: "Sudan", countryCode: "SDN", phoneCode: "+249", flag: "🇸🇩" },
  { id: 165, name: "Suriname", countryCode: "SUR", phoneCode: "+597", flag: "🇸🇷" },
  { id: 166, name: "Sweden", countryCode: "SWE", phoneCode: "+46", flag: "🇸🇪" },
  { id: 167, name: "Switzerland", countryCode: "CHE", phoneCode: "+41", flag: "🇨🇭" },
  { id: 168, name: "Syria", countryCode: "SYR", phoneCode: "+963", flag: "🇸🇾" },
  { id: 169, name: "Taiwan", countryCode: "TWN", phoneCode: "+886", flag: "🇹🇼" },
  { id: 170, name: "Tajikistan", countryCode: "TJK", phoneCode: "+992", flag: "🇹🇯" },
  { id: 171, name: "Tanzania", countryCode: "TZA", phoneCode: "+255", flag: "🇹🇿" },
  { id: 172, name: "Thailand", countryCode: "THA", phoneCode: "+66", flag: "🇹🇭" },
  { id: 173, name: "Timor-Leste", countryCode: "TLS", phoneCode: "+670", flag: "🇹🇱" },
  { id: 174, name: "Togo", countryCode: "TGO", phoneCode: "+228", flag: "🇹🇬" },
  { id: 175, name: "Tonga", countryCode: "TON", phoneCode: "+676", flag: "🇹🇴" },
  { id: 176, name: "Trinidad and Tobago", countryCode: "TTO", phoneCode: "+1", flag: "🇹🇹" },
  { id: 177, name: "Tunisia", countryCode: "TUN", phoneCode: "+216", flag: "🇹🇳" },
  { id: 178, name: "Turkey", countryCode: "TUR", phoneCode: "+90", flag: "🇹🇷" },
  { id: 179, name: "Turkmenistan", countryCode: "TKM", phoneCode: "+993", flag: "🇹🇲" },
  { id: 180, name: "Tuvalu", countryCode: "TUV", phoneCode: "+688", flag: "🇹🇻" },
  { id: 181, name: "Uganda", countryCode: "UGA", phoneCode: "+256", flag: "🇺🇬" },
  { id: 182, name: "Ukraine", countryCode: "UKR", phoneCode: "+380", flag: "🇺🇦" },
  { id: 183, name: "United Arab Emirates", countryCode: "ARE", phoneCode: "+971", flag: "🇦🇪" },
  { id: 184, name: "United Kingdom", countryCode: "GBR", phoneCode: "+44", flag: "🇬🇧" },
  { id: 185, name: "United States", countryCode: "USA", phoneCode: "+1", flag: "🇺🇸" },
  { id: 186, name: "Uruguay", countryCode: "URY", phoneCode: "+598", flag: "🇺🇾" },
  { id: 187, name: "Uzbekistan", countryCode: "UZB", phoneCode: "+998", flag: "🇺🇿" },
  { id: 188, name: "Vanuatu", countryCode: "VUT", phoneCode: "+678", flag: "🇻🇺" },
  { id: 189, name: "Vatican City", countryCode: "VAT", phoneCode: "+379", flag: "🇻🇦" },
  { id: 190, name: "Venezuela", countryCode: "VEN", phoneCode: "+58", flag: "🇻🇪" },
  { id: 191, name: "Vietnam", countryCode: "VNM", phoneCode: "+84", flag: "🇻🇳" },
  { id: 192, name: "Yemen", countryCode: "YEM", phoneCode: "+967", flag: "🇾🇪" },
  { id: 193, name: "Zambia", countryCode: "ZMB", phoneCode: "+260", flag: "🇿🇲" },
  { id: 194, name: "Zimbabwe", countryCode: "ZWE", phoneCode: "+263", flag: "🇿🇼" }
].sort((a, b) => a.name.localeCompare(b.name));

/**
 * Get a country by its ID
 * @param {number} id - Country ID
 * @returns {Country|undefined} Country object or undefined if not found
 */
export const getCountryById = (id) => {
  return countries.find(country => country.id === id);
};

/**
 * Get a country by its phone code
 * @param {string} phoneCode - Country phone code (with or without +)
 * @returns {Country|undefined} Country object or undefined if not found
 */
export const getCountryByPhoneCode = (phoneCode) => {
  const normalizedCode = phoneCode.startsWith('+') ? phoneCode : `+${phoneCode}`;
  return countries.find(country => country.phoneCode === normalizedCode);
};

/**
 * Get a country by its language code
 * @param {string} langCode - Language code (ISO 639-1)
 * @returns {Country[]} Array of countries that use the specified language
 */
export const getCountriesByLanguage = (langCode) => {
  return countries.filter(country => country.langCode === langCode.toUpperCase());
};

/**
 * Get a country by its country code
 * @param {string} countryCode - ISO 3166-1 alpha-3 country code
 * @returns {Country|undefined} Country object or undefined if not found
 */
export const getCountryByCode = (countryCode) => {
  return countries.find(country => country.countryCode === countryCode.toUpperCase());
};

export default countries;