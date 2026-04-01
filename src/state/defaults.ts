import type { ServiceConfig } from './types'

// C3-FIX: wrap in Object.freeze to prevent mutation
export const IMMUTABLE_DEFAULTS = Object.freeze([
  { id: 'mizrahi',     label: 'מזרחי טפחות',      url: 'https://www.mizrahi-tefahot.co.il/login/', iconPath: '' },
  { id: 'postalbank',  label: 'בנק הדואר',         url: 'https://www.postalfinance.co.il/', iconPath: '' },
  { id: 'max',         label: 'max',               url: 'https://www.max.co.il/login', iconPath: '' },
  { id: 'arnona-ks',   label: 'ארנונה כפר סבא',    url: 'https://www.city4u.co.il/PortalServicesSite/cityPay/269000/mislaka/1', iconPath: '' },
  { id: 'iec',         label: 'חברת החשמל',        url: 'https://enes.iec.co.il/LoginBZ1.aspx', iconPath: '' },
  { id: 'water-ks',    label: 'מפעל המים כפר סבא', url: 'https://city4u.co.il/PortalServicesSite/_portal/269100', iconPath: '' },
  { id: 'yes',         label: 'yes',               url: 'https://www.yes.co.il/personal-account/', iconPath: '' },
  { id: 'partner',     label: 'פרטנר',             url: 'https://www.partner.co.il/n/login/', iconPath: '' },
  { id: 'hot-mobile',  label: 'HOT mobile',        url: 'https://www.hotmobile.co.il/SelfService/Pages/login.aspx', iconPath: '' },
] as const satisfies readonly ServiceConfig[])
