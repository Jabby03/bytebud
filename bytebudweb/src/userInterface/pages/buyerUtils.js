const PREFS_KEY = "bytebud_buyer_prefs";

export const CPU_TIER_LABEL = { 1: "Basic", 2: "Everyday", 3: "Capable", 4: "High-performance", 5: "Workstation" };

export const formatPeso = (value) => new Intl.NumberFormat("en-PH", {
  style: "currency", currency: "PHP", maximumFractionDigits: 0,
}).format(Number(value) || 0);

export const formatDate = (value) => value ? new Date(value).toLocaleDateString("en-PH", {
  year: "numeric", month: "short", day: "numeric",
}) : "—";

export const formatRemaining = (milliseconds) => {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return minutes ? `${minutes}m ${rest}s` : `${rest}s`;
};

export const getPhotos = (unit) => {
  const photos = unit?.listing?.photos || [];
  return [...photos].sort((a, b) => Number(Boolean(b.isPrimary)) - Number(Boolean(a.isPrimary))).map((photo) => photo.photoUrl).filter(Boolean);
};

export const getPrefs = () => {
  try { return JSON.parse(localStorage.getItem(PREFS_KEY) || "{}"); }
  catch { return {}; }
};

export const setPrefs = (updates) => {
  try { localStorage.setItem(PREFS_KEY, JSON.stringify({ ...getPrefs(), ...updates })); }
  catch { /* Preferences are optional if browser storage is unavailable. */ }
};

export const getPrice = (unit, verified) => {
  const { price, studentPrice } = unit?.listing || {};
  return verified && studentPrice != null ? Math.min(price ?? studentPrice, studentPrice) : price;
};

export const isStudentVerified = (verifications) => {
  const list = Array.isArray(verifications) ? verifications : verifications ? [verifications] : [];
  return list.some((item) => item.verifStatus === "approved" && item.expiresAt && new Date(item.expiresAt) > new Date());
};

export const toBool = (value) => value === true || ["true", "yes", "1", "dedicated"].includes(String(value || "").trim().toLowerCase());

export const unitName = (unit) => [unit?.model?.brand, unit?.model?.modelName].filter(Boolean).join(" ") || unit?.serialNumber || "Laptop";

export function courseFit(unit, course) {
  const requirements = course?.requirements || {};
  const specs = unit?.model?.specs || {};
  const actual = unit?.actualSpecs || {};
  const hasGpu = toBool(specs.hasDedicatedGpu) || (!!specs.gpu && !/integrated|none|n\/a|uhd|iris|radeon graphics|vega/i.test(specs.gpu));
  const rows = [
    { key: "ram", text: `At least ${requirements.minRamGb ?? 0} GB RAM`, ok: requirements.minRamGb == null || actual.actualRamGb >= requirements.minRamGb },
    { key: "storage", text: `At least ${requirements.minStorageGb ?? 0} GB storage`, ok: requirements.minStorageGb == null || actual.actualStorageGb >= requirements.minStorageGb },
    { key: "cpu", text: `CPU tier ${requirements.minCpuTier ?? 0} or higher`, ok: requirements.minCpuTier == null || specs.cpuTier >= requirements.minCpuTier },
    { key: "gpu", text: "Dedicated graphics", ok: !requirements.gpuRequired || hasGpu },
    { key: "battery", text: `At least ${requirements.minBatteryHours ?? 0} hours battery`, ok: requirements.minBatteryHours == null || unit.estimatedBatteryHrs >= requirements.minBatteryHours },
  ];
  return { ok: rows.every((row) => row.ok), rows };
}

export function similarUnits(unit, units, verified) {
  return units.filter((candidate) => candidate.unitId !== unit.unitId
    && ["available", "reserved"].includes(candidate.unitStatus)
    && candidate.listing?.price != null
    && (!unit.model?.brand || candidate.model?.brand === unit.model.brand))
    .sort((a, b) => Math.abs((getPrice(a, verified) || 0) - (getPrice(unit, verified) || 0)) - Math.abs((getPrice(b, verified) || 0) - (getPrice(unit, verified) || 0)))
    .slice(0, 4);
}
