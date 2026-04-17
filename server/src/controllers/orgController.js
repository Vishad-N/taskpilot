import Organization from "../models/Organization.js";

export const createOrganization = async (req, res) => {
  try {
    const { name, description, ownerId } = req.body;

    const org = await Organization.create({
      name,
      description,
      ownerId: ownerId || req.user._id
    });

    res.status(201).json({
      message: "Organization created",
      organization: org
    });

  } catch (error) {
    res.status(500).json({ message: "Failed to create organization", error: error.message });
  }
};

export const listOrganizations = async (_req, res) => {
  try {
    const orgs = await Organization.find({})
      .sort({ createdAt: -1 })
      .limit(200);

    res.json({ organizations: orgs });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};