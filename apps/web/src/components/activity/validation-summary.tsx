"use client";

export function ValidationSummary({ errors }: { errors: string[] }) {
  if (errors.length === 0) {
    return null;
  }
  return (
    <div className="rounded-md border border-red-200 bg-red-50 p-3">
      <p className="text-sm font-semibold text-red-800">Validation Issues</p>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-red-700">
        {errors.map((error) => (
          <li key={error}>{error}</li>
        ))}
      </ul>
    </div>
  );
}
