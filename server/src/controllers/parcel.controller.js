import { getParcelBySurveyNumber, getWardBoundary, searchParcels } from "../services/parcel.service.js";

export function searchParcel(req, res) {
  try {
    const q = req.query.q || "";
    return res.json({
      items: searchParcels(q),
      wardBoundary: getWardBoundary()
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

export function getParcelBySurvey(req, res) {
  try {
    const surveyNumber = req.params.surveyNumber;
    const parcel = getParcelBySurveyNumber(surveyNumber);
    if (!parcel) {
      return res.status(404).json({ message: "Parcel not found in cadastral index" });
    }
    return res.json({
      parcel,
      wardBoundary: getWardBoundary()
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}
