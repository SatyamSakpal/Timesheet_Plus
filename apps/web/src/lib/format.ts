export function formatDate(value: string | null | undefined): string {
  if (!value) {
    return "-";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleString();
}

export function classNames(...values: Array<string | false | undefined | null>): string {
  return values.filter(Boolean).join(" ");
}
