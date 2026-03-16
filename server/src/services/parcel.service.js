import { CADASTRAL_PARCELS, WARD_BOUNDARY } from "../data/cadastral.parcels.js";

export function getParcelBySurveyNumber(surveyNumber) {
  const key = String(surveyNumber || "").trim().toLowerCase();
  return CADASTRAL_PARCELS.find((parcel) => parcel.surveyNumber.toLowerCase() === key) || null;
}

export function searchParcels(query) {
  const q = String(query || "").trim().toLowerCase();
  if (!q) return [];
  return CADASTRAL_PARCELS.filter(
    (parcel) =>
      parcel.surveyNumber.toLowerCase().includes(q) ||
      parcel.plotNumber.toLowerCase().includes(q) ||
      parcel.parcelId.toLowerCase().includes(q)
  );
}

export function getWardBoundary() {
  return WARD_BOUNDARY;
}
