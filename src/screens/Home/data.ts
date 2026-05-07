// AbuBank — Home screen data.
//
// SERVICES derives from src/services/serviceCatalog.ts (single source of truth).
// Greetings + daily-message helpers stay here because they are launcher-specific.

import { LAUNCHER_SERVICES, type LauncherService } from '../../services/serviceCatalog'

export type Service = LauncherService

export const SERVICES: ReadonlyArray<Service> = LAUNCHER_SERVICES

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
