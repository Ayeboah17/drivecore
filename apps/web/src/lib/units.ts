import type {
  DistanceUnit,
  FuelEfficiencyUnit,
  VolumeUnit,
  WeightUnit,
} from "@/lib/api/contracts";

export interface UnitPreferences {
  distance: DistanceUnit;
  volume: VolumeUnit;
  fuelEfficiency: FuelEfficiencyUnit;
  weight: WeightUnit;
}

export const DEFAULT_UNIT_PREFERENCES: UnitPreferences = {
  distance: "km",
  volume: "l",
  fuelEfficiency: "l_per_100km",
  weight: "kg",
};

const KM_PER_MILE = 1.609344;
const LITRES_PER_US_GAL = 3.785411784;
const LITRES_PER_UK_GAL = 4.54609;
const LB_PER_KG = 2.2046226218;

export function convertDistanceFromKm(km: number, unit: DistanceUnit): number {
  return unit === "mi" ? km / KM_PER_MILE : km;
}

export function formatDistance(km: number, unit: DistanceUnit = "km"): string {
  const val = convertDistanceFromKm(km, unit);
  return `${Math.round(val).toLocaleString()} ${unit}`;
}

export function convertVolumeFromLitres(
  litres: number,
  unit: VolumeUnit,
): number {
  return unit === "gal_us" ? litres / LITRES_PER_US_GAL : litres;
}

export function formatVolume(litres: number, unit: VolumeUnit = "l"): string {
  const val = convertVolumeFromLitres(litres, unit);
  return `${val.toFixed(1)} ${unit === "gal_us" ? "gal" : "L"}`;
}

export function convertWeightFromKg(kg: number, unit: WeightUnit): number {
  return unit === "lb" ? kg * LB_PER_KG : kg;
}

export function formatWeight(kg: number, unit: WeightUnit = "kg"): string {
  const val = convertWeightFromKg(kg, unit);
  return `${val.toFixed(1)} ${unit}`;
}

/**
 * Converts canonical L/100km into the user's preferred display unit.
 * Returns null if input is null or <= 0.
 */
export function convertFuelEfficiency(
  litresPer100Km: number | null | undefined,
  unit: FuelEfficiencyUnit = "l_per_100km",
): number | null {
  if (
    litresPer100Km === null ||
    litresPer100Km === undefined ||
    litresPer100Km <= 0
  ) {
    return null;
  }
  switch (unit) {
    case "l_per_100km":
      return litresPer100Km;
    case "km_per_l":
      return 100 / litresPer100Km;
    case "mpg_us":
      return (100 / KM_PER_MILE) / (litresPer100Km / LITRES_PER_US_GAL);
    case "mpg_uk":
      return (100 / KM_PER_MILE) / (litresPer100Km / LITRES_PER_UK_GAL);
  }
}

export function formatFuelEfficiency(
  litresPer100Km: number | null | undefined,
  unit: FuelEfficiencyUnit = "l_per_100km",
): string {
  const val = convertFuelEfficiency(litresPer100Km, unit);
  if (val === null) return "—";
  const suffix =
    unit === "l_per_100km"
      ? "L/100km"
      : unit === "km_per_l"
        ? "km/L"
        : unit === "mpg_us"
          ? "MPG (US)"
          : "MPG (UK)";
  return `${val.toFixed(1)} ${suffix}`;
}

export function formatCostPerDistance(
  costPerKmMinor: number | null | undefined,
  currency: string,
  unit: DistanceUnit = "km",
): string {
  if (costPerKmMinor === null || costPerKmMinor === undefined) return "—";
  const adjustedMinor =
    unit === "mi" ? costPerKmMinor * KM_PER_MILE : costPerKmMinor;
  return `${currency} ${(adjustedMinor / 100).toFixed(2)}/${unit}`;
}
