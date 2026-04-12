const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const repo = require("../repositories/auth.repository");

const generateAccessToken = (user, profileId = null) =>
  jwt.sign(
    { sub: user.id, email: user.email, role: user.role, profileId },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: process.env.JWT_ACCESS_EXPIRES_IN }
  );

const generateRawRefreshToken = () =>
  crypto.randomBytes(64).toString("hex");

const refreshTokenExpiresAt = () => {
  const d = new Date();
  d.setDate(d.getDate() + Number(process.env.JWT_REFRESH_EXPIRES_DAYS || 7));
  return d;
};

const getProfileForUser = async (user) => {
  if (user.role === "customer") {
    return repo.findCustomerByUserId(user.id);
  }
  if (["staff", "manager", "admin"].includes(user.role)) {
    return repo.findEmployeeByUserId(user.id);
  }
  return null;
};

const registerUser = async (email, password, fullName, dateOfBirth, phone) => {
  const existing = await repo.findUserByEmail(email);
  if (existing) {
    const err = new Error("Email already in use");
    err.status = 409;
    throw err;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  return repo.registerCustomerWithUser({ email, passwordHash, fullName, dateOfBirth, phone });
};

const registerEmployee = async (email, password, fullName, role) => {
  const existing = await repo.findUserByEmail(email);
  if (existing) {
    const err = new Error("Email already in use");
    err.status = 409;
    throw err;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  return repo.registerEmployeeWithUser({ email, passwordHash, fullName, role });
};

const loginUser = async (email, password) => {
  const user = await repo.findUserByEmail(email);
  if (!user) {
    const err = new Error("Invalid credentials");
    err.status = 401;
    throw err;
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    const err = new Error("Invalid credentials");
    err.status = 401;
    throw err;
  }

  const profile = await getProfileForUser(user);
  const profileId = profile?.customer_id ?? profile?.employee_id ?? null;

  const familyId = crypto.randomUUID();
  const rawRefreshToken = generateRawRefreshToken();

  await repo.createRefreshToken({
    rawToken: rawRefreshToken,
    userId: user.id,
    familyId,
    expiresAt: refreshTokenExpiresAt(),
  });

  const fullName = profile?.full_name || null;

  return {
    accessToken: generateAccessToken(user, profileId),
    rawRefreshToken,
    user: { id: user.id, email: user.email, role: user.role, full_name: fullName },
    profile,
  };
};

const refreshTokens = async (rawRefreshToken) => {
  const tokenRow = await repo.findRefreshToken(rawRefreshToken);

  if (!tokenRow) {
    const err = new Error("Invalid or expired refresh token");
    err.status = 401;
    throw err;
  }

  if (tokenRow.used) {
    await repo.deleteTokenFamily(tokenRow.family_id);
    const err = new Error("Token reuse detected");
    err.status = 401;
    throw err;
  }

  await repo.markTokenUsed(tokenRow.id);

  const user = await repo.findUserById(tokenRow.user_id);
  if (!user) {
    const err = new Error("User not found");
    err.status = 401;
    throw err;
  }

  const profile = await getProfileForUser(user);
  const profileId = profile?.customer_id ?? profile?.employee_id ?? null;

  const newRawRefreshToken = generateRawRefreshToken();

  await repo.createRefreshToken({
    rawToken: newRawRefreshToken,
    userId: user.id,
    familyId: tokenRow.family_id,
    expiresAt: refreshTokenExpiresAt(),
  });

  return {
    accessToken: generateAccessToken(user, profileId),
    rawRefreshToken: newRawRefreshToken,
  };
};

const logoutUser = async (rawRefreshToken) => {
  if (!rawRefreshToken) return;
  const tokenRow = await repo.findRefreshToken(rawRefreshToken);
  if (!tokenRow) return;
  await repo.deleteTokenFamily(tokenRow.family_id);
};

module.exports = { registerUser, registerEmployee, loginUser, refreshTokens, logoutUser };
