import mongoose from "mongoose";

const ALLOWED_ROLES = ["admin", "officer", "buyer", "auditor", "tehsildar", "sdm", "collector"];

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },
    passwordHash: {
      type: String,
      required: true
    },
    role: {
      type: String,
      enum: ALLOWED_ROLES,
      default: "buyer"
    },
    approvalStatus: {
      type: String,
      enum: ["approved", "pending", "rejected"],
      default: "approved"
    },
    approvalRemark: {
      type: String,
      default: ""
    },
    approvedBy: {
      type: String,
      default: ""
    },
    approvedAt: {
      type: Date
    },
    refreshTokenHashes: {
      type: [String],
      default: []
    }
  },
  { timestamps: true }
);

const User = mongoose.model("User", userSchema);

export { ALLOWED_ROLES };
export default User;
