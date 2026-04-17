import Organization from "../models/Organization.js";

const uniqueIds = (values = []) => {
  return [...new Set(values.filter(Boolean).map((value) => String(value)))];
};

export const getUserOrganizationIds = (user) => {
  return uniqueIds([user.organizationId, ...(user.allowedOrganizations || [])]);
};

export const getRequestedOrganizationId = (req) => {
  const headerValue = req.headers["x-organization-id"];

  if (typeof headerValue === "string" && headerValue.trim()) {
    return headerValue.trim();
  }

  if (typeof req.query.organizationId === "string" && req.query.organizationId.trim()) {
    return req.query.organizationId.trim();
  }

  if (typeof req.body?.organizationId === "string" && req.body.organizationId.trim()) {
    return req.body.organizationId.trim();
  }

  return null;
};

export const getAccessibleOrganizationIds = async (req) => {
  if (req.user.role === "superadmin") {
    const organizations = await Organization.find({ isActive: true }).select("_id");
    return organizations.map((organization) => String(organization._id));
  }

  return getUserOrganizationIds(req.user);
};

export const resolveActiveOrganizationId = async (req) => {
  const accessibleOrganizationIds = await getAccessibleOrganizationIds(req);
  const requestedOrganizationId = getRequestedOrganizationId(req);

  if (requestedOrganizationId) {
    if (!accessibleOrganizationIds.includes(requestedOrganizationId)) {
      const error = new Error("Not allowed for this organization");
      error.status = 403;
      throw error;
    }

    return requestedOrganizationId;
  }

  return accessibleOrganizationIds[0] || null;
};

export const requireActiveOrganizationId = async (req) => {
  const organizationId = await resolveActiveOrganizationId(req);

  if (!organizationId) {
    const error = new Error("No accessible organization found");
    error.status = 400;
    throw error;
  }

  return organizationId;
};

