// AbuBank — Home screen data (no JSX)

export interface Service {
  id: string;
  label: string;
  url: string;
  color: string;
  logo: string;
  bgColor: string;
  androidPackage?: string;
}

export const SERVICES: Service[] = [
  {id:'mizrahi', label:'מזרחי טפחות',  url:'https://www.mizrahi-tefahot.co.il/login/',  color:'#f97316', logo:'/logos/mizrahi.png',    bgColor:'#fff',    androidPackage:'com.MizrahiTefahot.nh'},
  {id:'postal',  label:'דואר ישראל',   url:'https://www.postalfinance.co.il/',           color:'#3b82f6', logo:'/logos/postalbank.png', bgColor:'#fff',    androidPackage:'ratesen.bankhadoar.co.il'},
  {id:'max',     label:'MAX',           url:'https://www.max.co.il/login',               color:'#a855f7', logo:'/logos/max.png',        bgColor:'#1a2f6b', androidPackage:'com.ideomobile.leumicard'},
  {id:'water',   label:'מפעל המים',    url:'https://www.city4u.co.il/water/kfar-saba',  color:'#06b6d4', logo:'/logos/WATER.jpg',      bgColor:'#fff'},
  {id:'iec',     label:'חברת החשמל',  url:'https://enes.iec.co.il/LoginBZ1.aspx',      color:'#eab308', logo:'/logos/iec.png',        bgColor:'#fff',    androidPackage:'com.ewavemobile.electriccompany'},
  {id:'arnona',  label:'ארנונה כ"ס',  url:'https://www.city4u.co.il/arnona/kfar-saba', color:'#22c55e', logo:'/logos/arnona.png',     bgColor:'#fff'},
  {id:'hot',     label:'HOT mobile',   url:'https://www.hotmobile.co.il',               color:'#ef4444', logo:'/logos/hot.png',        bgColor:'#1a1a2e', androidPackage:'ii.co.hotmobile.HotMobileApp'},
  {id:'partner', label:'פרטנר',        url:'https://www.partner.co.il/n/login/',        color:'#8b5cf6', logo:'/logos/partner.png',    bgColor:'#0A4A45', androidPackage:'il.co.orange.app.myorange'},
  {id:'yes',     label:'yes',          url:'https://www.yes.co.il/personal-account/',   color:'#0ea5e9', logo:'/logos/yes.png',        bgColor:'#1a1a2e', androidPackage:'il.co.yes.yesplus'},
];

export const MSGS = [
  'כל החשבונות בהישג יד 💛', 'הכל מסודר ומוכן בשבילך',
  'יום טוב — הכל בשליטה', 'הכסף שלך שמור ובטוח',
  'נסי לשלם את החשמל השבוע 💡', 'שישי שמח — מגיעה מנוחה ☀️',
  'שבוע טוב — הכל פה בשבילך ❤️', 'הבוקר מתחיל בסדר גמור',
  'החשמל, המים, הבנק — הכל פה', 'כבר שילמת את הארנונה? 🏠',
  'לילה שקט ובטוח 🌙', 'צהריים טובים — הכל מחכה לך',
  'ערב נעים ורגוע 🌆', 'פרטנר, HOT, yes — כולם פה',
  'אין צורך לזכור שום דבר', 'בנק הדואר פתוח בשבילך',
  'קפה טוב ואז לטפל בחשבונות ☕', 'MAX מוכן — לחצי ותכנסי',
  'הכל פה, רק לחיצה אחת', 'שמחה שאת כאן, Martita 💙',
];

export function getGreeting(): { text: string; emoji: string } {
  const h = new Date().getHours();
  if (h >= 5  && h < 12) return { text: 'בוקר טוב',     emoji: '☀️' };
  if (h >= 12 && h < 17) return { text: 'צהריים טובים', emoji: '🌤' };
  if (h >= 17 && h < 21) return { text: 'ערב טוב',      emoji: '🌆' };
  return                         { text: 'לילה טוב',     emoji: '🌙' };
}

export function getDailyMsg(): string {
  const d = new Date();
  const day = d.getDay(), date = d.getDate(), month = d.getMonth(), h = d.getHours();
  if (day === 6) return 'שבת שלום — יום של מנוחה 🕊️';
  if (day === 5 && h >= 14) return 'שישי שמח — שבת שלום מחכה 🕍';
  if (date <= 3) return 'תחילת חודש — כדאי לבדוק חשמל ומים 💡';
  if (date >= 15 && date <= 20) return 'אמצע חודש — כבר שילמת ארנונה? 🏠';
  return MSGS[(date * 97 + month * 31 + Math.floor(h / 4) + day * 7) % MSGS.length] ?? 'הכל פה בשבילך';
}
