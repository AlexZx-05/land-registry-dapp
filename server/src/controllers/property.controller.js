import Property from "../models/property.model.js";
import { createHash } from "crypto";
import {
  compareGasScenarios,
  registerOnChain,
  transferOnChain,
  verifyOnChain
} from "../services/blockchain.service.js";
import { uploadDocumentToIPFS } from "../services/ipfs.service.js";
import { evaluateFraudSignals } from "../services/ai.service.js";
import {
  areaDeviationPercent,
  polygonAreaSqm,
  polygonInsideBoundary,
  polygonsOverlap
} from "../services/geometry.service.js";
import { getParcelBySurveyNumber, getWardBoundary } from "../services/parcel.service.js";

const APPROVAL_LEVELS = ["tehsildar", "sdm", "collector"];
const OWNER_WALLET_REGEX = /^0x[a-fA-F0-9]{40}$/;

function parseIssueDate(value) {
  if (!value) return undefined;
  if (typeof value !== "string") {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? undefined : d;
  }

  // Support both YYYY-MM-DD and DD-MM-YYYY.
  const ddmmyyyy = /^(\d{2})-(\d{2})-(\d{4})$/;
  const yyyymmdd = /^(\d{4})-(\d{2})-(\d{2})$/;
  let iso = value;
  const ddMatch = value.match(ddmmyyyy);
  if (ddMatch) {
    iso = `${ddMatch[3]}-${ddMatch[2]}-${ddMatch[1]}`;
  } else if (!yyyymmdd.test(value)) {
    return undefined;
  }
  const parsed = new Date(`${iso}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function defaultApprovals() {
  return APPROVAL_LEVELS.map((level) => ({ level, status: "pending" }));
}

function allApprovalsApproved(property) {
  return APPROVAL_LEVELS.every((level) =>
    property.approvals.some((approval) => approval.level === level && approval.status === "approved")
  );
}

function isValidWallet(value = "") {
  return OWNER_WALLET_REGEX.test(String(value).trim());
}

export async function createProperty(req, res) {
  try {
    const {
      registrationScope = "local",
      surveyNumber,
      geometrySource = "official",
      polygonCoordinates,
      documentContent,
      document,
      jurisdiction = {},
      claimant = {}
    } = req.body;

    const scope = registrationScope === "global" ? "global" : "local";

    let parcel = null;
    const normalizedSurveyNumber = String(surveyNumber || "").trim();
    if (scope === "local") {
      if (!normalizedSurveyNumber) {
        return res.status(400).json({ message: "surveyNumber is required for local registrations" });
      }

      parcel = getParcelBySurveyNumber(normalizedSurveyNumber);
      if (!parcel) {
        return res.status(404).json({ message: "Survey number not found in cadastral records" });
      }
    }

    const claimedWallet = String(claimant.ownerWallet || "").trim();
    const claimedOwnerName = String(claimant.ownerFullName || "").trim();
    const jurisdictionMeta = {
      countryCode: String(jurisdiction.countryCode || "").trim().toUpperCase(),
      countryName: String(jurisdiction.countryName || "").trim(),
      stateProvince: String(jurisdiction.stateProvince || "").trim(),
      cityDistrict: String(jurisdiction.cityDistrict || "").trim(),
      landRegistryOffice: String(jurisdiction.landRegistryOffice || "").trim(),
      parcelReference: String(jurisdiction.parcelReference || "").trim(),
      titleDeedNumber: String(jurisdiction.titleDeedNumber || "").trim()
    };

    if (scope === "global") {
      if (!jurisdictionMeta.countryName || !jurisdictionMeta.titleDeedNumber || !jurisdictionMeta.parcelReference) {
        return res.status(400).json({
          message: "countryName, parcelReference, and titleDeedNumber are required for global registrations"
        });
      }
      if (!claimedOwnerName) {
        return res.status(400).json({ message: "claimant.ownerFullName is required for global registrations" });
      }
      if (!isValidWallet(claimedWallet)) {
        return res.status(400).json({ message: "Valid claimant.ownerWallet is required for global registrations" });
      }
    }

    const finalGeometrySource = ["official", "imported", "edited"].includes(geometrySource)
      ? geometrySource
      : scope === "local"
        ? "official"
        : "edited";
    const selectedPolygon = scope === "local" && finalGeometrySource === "official"
      ? parcel.polygonCoordinates
      : polygonCoordinates;

    if (!Array.isArray(selectedPolygon) || selectedPolygon.length < 3) {
      return res.status(400).json({ message: "Valid polygonCoordinates are required for selected geometry source" });
    }

    let normalizedDocument;
    if (document && typeof document === "object") {
      const allowedMimeTypes = ["application/pdf", "image/jpeg", "image/png", "text/plain"];
      if (!document.fileName || !document.mimeType || !document.base64) {
        return res.status(400).json({ message: "document.fileName, document.mimeType and document.base64 are required" });
      }
      if (!allowedMimeTypes.includes(document.mimeType)) {
        return res.status(400).json({ message: "Only PDF, JPEG, PNG, and TXT documents are allowed" });
      }
      const sizeBytes = Number(document.sizeBytes || 0);
      if (!Number.isFinite(sizeBytes) || sizeBytes <= 0 || sizeBytes > 5 * 1024 * 1024) {
        return res.status(400).json({ message: "Document size must be greater than 0 and <= 5MB" });
      }

      normalizedDocument = {
        fileName: document.fileName,
        mimeType: document.mimeType,
        sizeBytes,
        documentType: String(document.documentType || "General Document"),
        documentNumber: String(document.documentNumber || ""),
        issuingAuthority: String(document.issuingAuthority || ""),
        issueDate: parseIssueDate(document.issueDate),
        base64: document.base64
      };

      if (normalizedDocument.mimeType === "text/plain") {
        const text = Buffer.from(normalizedDocument.base64, "base64").toString("utf8");
        const surveyMatch = text.match(/(?:survey|khasra)\s*(?:no\.?|number)?\s*[:\-]?\s*([a-z0-9/.-]+)/i);
        if (scope === "local" && surveyMatch && surveyMatch[1] && surveyMatch[1].trim().toLowerCase() !== normalizedSurveyNumber.toLowerCase()) {
          return res.status(400).json({ message: `Document survey number (${surveyMatch[1]}) does not match selected survey (${normalizedSurveyNumber})` });
        }
      }
    } else if (documentContent && typeof documentContent === "string") {
      normalizedDocument = {
        fileName: "manual-text.txt",
        mimeType: "text/plain",
        sizeBytes: Buffer.byteLength(documentContent, "utf8"),
        documentType: "Manual Text",
        documentNumber: "",
        issuingAuthority: "",
        issueDate: undefined,
        base64: Buffer.from(documentContent, "utf8").toString("base64")
      };
    } else {
      return res.status(400).json({ message: "document upload data is required" });
    }

    const normalizedPolygon = selectedPolygon.map(([lat, lng]) => [Number(lat), Number(lng)]);
    const polygon = JSON.stringify(normalizedPolygon);
    const officialArea = Number(parcel?.areaSqm || 0);
    const currentArea = polygonAreaSqm(normalizedPolygon);
    const deviation = scope === "local" ? areaDeviationPercent(officialArea, currentArea) : 0;

    if (scope === "local" && finalGeometrySource !== "official" && deviation > 15) {
      return res.status(400).json({
        message: `Geometry area deviation too high (${deviation.toFixed(2)}%). Max allowed is 15%.`
      });
    }

    const wardBoundary = scope === "local" ? getWardBoundary() : null;
    const outsideWardBoundary = scope === "local" ? !polygonInsideBoundary(normalizedPolygon, wardBoundary) : false;
    if (scope === "local" && outsideWardBoundary) {
      return res.status(400).json({ message: "Geometry is outside allowed ward boundary" });
    }

    const existing = await Property.find().lean();
    const overlapsExisting = existing.some((item) => polygonsOverlap(normalizedPolygon, item.polygonCoordinates));
    if (overlapsExisting) {
      return res.status(400).json({ message: "Geometry overlaps an existing registered property" });
    }

    const existingProperties = await Property.find().lean();
    const fraud = await evaluateFraudSignals({
      polygonCoordinates: normalizedPolygon,
      properties: existingProperties,
      ownershipHistory: []
    });

    const ipfsHash = await uploadDocumentToIPFS(normalizedDocument.base64);
    const reference = scope === "local"
      ? normalizedSurveyNumber
      : `${jurisdictionMeta.countryName}:${jurisdictionMeta.parcelReference}:${jurisdictionMeta.titleDeedNumber}`;
    const parcelHash = `parcel:${createHash("sha256").update(`${scope}:${reference}:${polygon}`).digest("hex")}`;
    const { receipt, chainId } = await registerOnChain(parcelHash, ipfsHash);

    let finalOwner = receipt.from;
    let transferReceipt = null;
    if (scope === "global" && isValidWallet(claimedWallet) && claimedWallet.toLowerCase() !== receipt.from.toLowerCase()) {
      transferReceipt = await transferOnChain(chainId, claimedWallet);
      finalOwner = claimedWallet;
    }

    const propertySurveyNumber = scope === "local"
      ? normalizedSurveyNumber
      : jurisdictionMeta.parcelReference || `global-${jurisdictionMeta.countryCode || "XX"}-${chainId}`;
    const propertyParcelId = scope === "local"
      ? String(parcel.parcelId || "")
      : `GLOBAL-${jurisdictionMeta.countryCode || "XX"}-${jurisdictionMeta.parcelReference || chainId}`;

    const payload = {
      chainId,
      registrationScope: scope,
      surveyNumber: propertySurveyNumber,
      parcelId: propertyParcelId,
      jurisdiction: jurisdictionMeta,
      claimant: {
        ownerFullName: claimedOwnerName,
        ownerWallet: claimedWallet
      },
      geometrySource: finalGeometrySource,
      owner: finalOwner,
      polygon,
      polygonCoordinates: normalizedPolygon,
      ipfsHash,
      document: {
        fileName: normalizedDocument.fileName,
        mimeType: normalizedDocument.mimeType,
        sizeBytes: normalizedDocument.sizeBytes,
        documentType: normalizedDocument.documentType,
        documentNumber: normalizedDocument.documentNumber,
        issuingAuthority: normalizedDocument.issuingAuthority,
        issueDate: normalizedDocument.issueDate
      },
      txHash: receipt.hash,
      tokenId: chainId,
      approvals: defaultApprovals(),
      ownershipHistory: [
        { owner: receipt.from, txHash: receipt.hash },
        ...(transferReceipt ? [{ owner: finalOwner, txHash: transferReceipt.hash }] : [])
      ],
      fraud,
      spatialValidation: {
        areaSqm: currentArea,
        officialAreaSqm: officialArea,
        areaDeviationPercent: deviation,
        overlapsExisting,
        outsideWardBoundary
      }
    };

    const existingByChainId = await Property.findOne({ chainId });
    if (existingByChainId) {
      const updated = await Property.findOneAndUpdate({ chainId }, payload, { new: true });
      return res.status(200).json({
        ...updated.toObject(),
        warning: "Existing chainId record was replaced (likely due local blockchain reset)."
      });
    }

    const property = await Property.create(payload);
    return res.status(201).json(property);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

export async function getProperties(_req, res) {
  try {
    const properties = await Property.find().sort({ createdAt: -1 });
    return res.json(properties);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

export async function getPropertyByChainId(req, res) {
  try {
    const chainId = Number(req.params.chainId);
    const property = await Property.findOne({ chainId });
    if (!property) {
      return res.status(404).json({ message: "Property not found" });
    }
    return res.json(property);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

export async function approveProperty(req, res) {
  try {
    const chainId = Number(req.params.chainId);
    const level = req.params.level?.toLowerCase();
    const { approved = true } = req.body || {};

    if (!APPROVAL_LEVELS.includes(level)) {
      return res.status(400).json({ message: "Invalid approval level" });
    }
    if (req.auth.role !== "admin" && req.auth.role !== level) {
      return res.status(403).json({ message: `Role ${req.auth.role} cannot approve ${level} stage` });
    }

    const property = await Property.findOne({ chainId });
    if (!property) {
      return res.status(404).json({ message: "Property not found" });
    }

    const approval = property.approvals.find((item) => item.level === level);
    approval.status = approved ? "approved" : "rejected";
    approval.approvedBy = req.auth.userId;
    approval.approvedAt = new Date();

    await property.save();
    return res.json(property);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

export async function getTimeline(req, res) {
  try {
    const chainId = Number(req.params.chainId);
    const property = await Property.findOne({ chainId }).lean();
    if (!property) {
      return res.status(404).json({ message: "Property not found" });
    }
    return res.json({
      chainId: property.chainId,
      ownershipHistory: property.ownershipHistory || []
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

export async function verifyProperty(req, res) {
  try {
    const chainId = Number(req.params.chainId);
    if (!Number.isInteger(chainId) || chainId <= 0) {
      return res.status(400).json({ message: "Valid chainId is required" });
    }

    const property = await Property.findOne({ chainId });
    if (!property) {
      return res.status(404).json({ message: "Property not found" });
    }

    if (!allApprovalsApproved(property)) {
      return res.status(400).json({ message: "All government approval levels must be approved before verification" });
    }

    await verifyOnChain(chainId);

    property.verified = true;
    await property.save();

    return res.json(property);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

export async function transferProperty(req, res) {
  try {
    const chainId = Number(req.params.chainId);
    const { newOwner } = req.body;

    if (!Number.isInteger(chainId) || chainId <= 0) {
      return res.status(400).json({ message: "Valid chainId is required" });
    }

    if (!newOwner) {
      return res.status(400).json({ message: "newOwner is required" });
    }

    const property = await Property.findOne({ chainId });
    if (!property) {
      return res.status(404).json({ message: "Property not found" });
    }

    if (!allApprovalsApproved(property)) {
      return res.status(400).json({ message: "All government approval levels must be approved before transfer" });
    }

    const transferReceipt = await transferOnChain(chainId, newOwner);

    property.owner = newOwner;
    property.ownershipHistory.push({
      owner: newOwner,
      txHash: transferReceipt.hash
    });

    const allProps = await Property.find({ chainId: { $ne: chainId } }).lean();
    property.fraud = await evaluateFraudSignals({
      polygonCoordinates: property.polygonCoordinates,
      properties: allProps,
      ownershipHistory: property.ownershipHistory
    });

    await property.save();
    return res.json(property);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

export async function getGasComparison(_req, res) {
  try {
    const result = await compareGasScenarios();
    return res.json(result);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}
