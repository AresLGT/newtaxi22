export interface Tariff {
  basePrice: number;
  perKm: number;
  name: string;
}

export type TariffKey = 'Таксі 🚕' | 'Вантажний 🚚' | 'Кур\'єр 📦' | 'Буксир 🪝';

export const TARIFFS: Record<TariffKey, Tariff> = {
  'Таксі 🚕': { basePrice: 50, perKm: 15, name: 'Таксі' },
  'Вантажний 🚚': { basePrice: 100, perKm: 25, name: 'Вантаж' },
  'Кур\'єр 📦': { basePrice: 80, perKm: 20, name: 'Кур\'єр' },
  'Буксир 🪝': { basePrice: 200, perKm: 30, name: 'Буксир' }
};

export function calculatePrice(tariffKey: TariffKey, distanceKm: number): number {
  const tariff = TARIFFS[tariffKey];
  return Math.ceil(tariff.basePrice + tariff.perKm * distanceKm);
}
