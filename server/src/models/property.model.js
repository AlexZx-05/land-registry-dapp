import mongoose from "mongoose";

const propertySchema = new mongoose.Schema(
  {
    chainId: {
      type: Number,
      required: true,
      unique: true
    },
    surveyNumber: {
      type: String,
      required: true,
      index: true
    },
    parcelId: {
      type: String,
      required: true
    },
    geometrySource: {
      type: String,
      enum: ["official", "imported", "edited"],
      default: "official"
    },
    owner: {
      type: String,
      required: true
    },
    polygon: {
      type: String,
      required: true
    },
    polygonCoordinates: {
      type: [[Number]],
      required: true
    },
    ipfsHash: {
      type: String,
      required: true
    },
    document: {
      fileName: {
        type: String,
        required: true
      },
      mimeType: {
        type: String,
        required: true
      },
      sizeBytes: {
        type: Number,
        required: true
      },
      documentType: {
        type: String,
        required: true
      },
      documentNumber: {
        type: String,
        default: ""
      },
      issuingAuthority: {
        type: String,
        default: ""
      },
      issueDate: {
        type: Date
      }
    },
    verified: {
      type: Boolean,
      default: false
    },
    txHash: {
      type: String,
      required: true
    },
    tokenId: {
      type: Number,
      required: true
    },
    approvals: [
      {
        level: {
          type: String,
          enum: ["tehsildar", "sdm", "collector"],
          required: true
        },
        status: {
          type: String,
          enum: ["pending", "approved", "rejected"],
          default: "pending"
        },
        approvedBy: {
          type: String,
          default: ""
        },
        approvedAt: {
          type: Date
        }
      }
    ],
    ownershipHistory: [
      {
        owner: {
          type: String,
          required: true
        },
        txHash: {
          type: String,
          required: true
        },
        transferredAt: {
          type: Date,
          default: Date.now
        }
      }
    ],
    fraud: {
      duplicatePolygon: {
        type: Boolean,
        default: false
      },
      rapidTransfer: {
        type: Boolean,
        default: false
      },
      isolationForestScore: {
        type: Number,
        default: 0
      },
      suspicious: {
        type: Boolean,
        default: false
      },
      reasons: {
        type: [String],
        default: []
      }
    },
    spatialValidation: {
      areaSqm: {
        type: Number,
        default: 0
      },
      officialAreaSqm: {
        type: Number,
        default: 0
      },
      areaDeviationPercent: {
        type: Number,
        default: 0
      },
      overlapsExisting: {
        type: Boolean,
        default: false
      },
      outsideWardBoundary: {
        type: Boolean,
        default: false
      }
    }
  },
  { timestamps: true }
);

const Property = mongoose.model("Property", propertySchema);

export default Property;
