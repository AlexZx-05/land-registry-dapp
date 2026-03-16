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

export async function createProperty(req, res) {
  try {
    const { surveyNumber, geometrySource = "official", polygonCoordinates, documentContent, document } = req.body;

    if (!surveyNumber) {
      return res.status(400).json({ message: "surveyNumber is required" });
    }

    const parcel = getParcelBySurveyNumber(surveyNumber);
    if (!parcel) {
      return res.status(404).json({ message: "Survey number not found in cadastral records" });
    }

    const finalGeometrySource = ["official", "imported", "edited"].includes(geometrySource)
      ? geometrySource
      : "official";
    const selectedPolygon =
      finalGeometrySource === "official" ? parcel.polygonCoordinates : polygonCoordinates;

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
        const surveyMatch = text.match(/(?:survey|khasra)\s*(?:no|number)?\s*[:\-]?\s*([a-z0-9/.-]+)/i);
        if (surveyMatch && surveyMatch[1] && surveyMatch[1].trim().toLowerCase() !== String(surveyNumber).toLowerCase()) {
          return res.status(400).json({
            message: `Document survey number (${surveyMatch[1]}) does not match selected survey (${surveyNumber})`
          });
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
    const officialArea = Number(parcel.areaSqm || 0);
    const currentArea = polygonAreaSqm(normalizedPolygon);
    const deviation = areaDeviationPercent(officialArea, currentArea);

    if (finalGeometrySource !== "official" && deviation > 15) {
      return res.status(400).json({
        message: `Geometry area deviation too high (${deviation.toFixed(2)}%). Max allowed is 15%.`
      });
    }

    const wardBoundary = getWardBoundary();
    const outsideWardBoundary = !polygonInsideBoundary(normalizedPolygon, wardBoundary);
    if (outsideWardBoundary) {
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
    const parcelHash = `parcel:${createHash("sha256").update(`${surveyNumber}:${polygon}`).digest("hex")}`;
    const { receipt, chainId } = await registerOnChain(parcelHash, ipfsHash);

    const payload = {
      chainId,
      surveyNumber: String(surveyNumber),
      parcelId: parcel.parcelId,
      geometrySource: finalGeometrySource,
      owner: receipt.from,
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
      ownershipHistory: [{ owner: receipt.from, txHash: receipt.hash }],
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
