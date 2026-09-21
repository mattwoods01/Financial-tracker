export const todayMonthKey = () => new Date().toISOString().slice(0, 10).slice(0, 7);

export const monthKey = (isoDate) => isoDate.slice(0, 7);

export const shiftMonth = (monthStr, delta) => {
  const [y, m] = monthStr.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

export const monthLabel = (monthStr) =>
  new Date(monthStr + "-02").toLocaleDateString(undefined, { month: "long", year: "numeric" });
