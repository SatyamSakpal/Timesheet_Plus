import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DynamicFieldRenderer } from "@/components/activity/dynamic-field-renderer";
import type { TaskFieldSchema } from "@/lib/types";

describe("DynamicFieldRenderer", () => {
  const fields: TaskFieldSchema[] = [
    { key: "title", label: "Title", type: "text", required: true },
    { key: "hours", label: "Hours", type: "number", required: true, min: 1, max: 12 },
    { key: "workDate", label: "Work Date", type: "date", required: true },
    { key: "notes", label: "Notes", type: "textarea", required: false },
    {
      key: "mode",
      label: "Mode",
      type: "select",
      required: true,
      options: ["Online", "Onsite"]
    },
    { key: "billable", label: "Billable", type: "checkbox", required: false }
  ];

  it("renders all supported field types and propagates changes", () => {
    const onChange = vi.fn();

    render(<DynamicFieldRenderer fields={fields} values={{}} onChange={onChange} />);

    fireEvent.change(screen.getByLabelText("Title *"), { target: { value: "Review PR" } });
    fireEvent.change(screen.getByLabelText("Hours *"), { target: { value: "3" } });
    fireEvent.change(screen.getByLabelText("Work Date *"), { target: { value: "2026-04-20" } });
    fireEvent.change(screen.getByLabelText("Notes"), { target: { value: "Line notes" } });
    fireEvent.change(screen.getByLabelText("Mode *"), { target: { value: "Online" } });
    fireEvent.click(screen.getByLabelText("Billable"));

    expect(onChange).toHaveBeenCalledWith("title", "Review PR");
    expect(onChange).toHaveBeenCalledWith("hours", 3);
    expect(onChange).toHaveBeenCalledWith("workDate", "2026-04-20");
    expect(onChange).toHaveBeenCalledWith("notes", "Line notes");
    expect(onChange).toHaveBeenCalledWith("mode", "Online");
    expect(onChange).toHaveBeenCalledWith("billable", true);
  });
});
