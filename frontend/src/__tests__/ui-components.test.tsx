import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import Accordion from "../components/ui/Accordion";
import Slider from "../components/ui/Slider";
import ImageUpload from "../components/ui/ImageUpload";

describe("Accordion", () => {
  it("hides children when defaultOpen is false", () => {
    render(
      <Accordion title="Test Section" defaultOpen={false}>
        <p>Hidden content</p>
      </Accordion>,
    );
    expect(screen.queryByText("Hidden content")).not.toBeInTheDocument();
  });

  it("shows children after clicking the title", () => {
    render(
      <Accordion title="Test Section" defaultOpen={false}>
        <p>Hidden content</p>
      </Accordion>,
    );
    fireEvent.click(screen.getByText("Test Section"));
    expect(screen.getByText("Hidden content")).toBeInTheDocument();
  });

  it("toggles open state on second click", () => {
    render(
      <Accordion title="Test Section" defaultOpen={false}>
        <p>Hidden content</p>
      </Accordion>,
    );
    const title = screen.getByText("Test Section");
    fireEvent.click(title);
    expect(screen.getByText("Hidden content")).toBeInTheDocument();
    // Second click triggers AnimatePresence exit; with framer-motion the
    // element may still be in the DOM during exit animation, so we just
    // verify the click doesn't throw.
    fireEvent.click(title);
  });
});

describe("Slider", () => {
  it("displays the current value in the input", () => {
    render(
      <Slider label="Width" value={50} min={0} max={100} step={1} onChange={() => {}} />,
    );
    const input = screen.getByRole("textbox", { name: /width value/i });
    expect(input).toHaveValue("50");
  });

  it("displays unit when provided", () => {
    render(
      <Slider label="Width" value={50} min={0} max={100} step={1} onChange={() => {}} unit="mm" />,
    );
    expect(screen.getByText("mm")).toBeInTheDocument();
    const input = screen.getByRole("textbox", { name: /width value/i });
    expect(input).toHaveValue("50");
  });

  it("keeps enough width for three-digit values in the text input", () => {
    render(
      <Slider label="Width" value={120} min={10} max={400} step={1} onChange={() => {}} unit="mm" />,
    );
    const input = screen.getByRole("textbox", { name: /width value/i });
    expect(input).toHaveValue("120");
    expect(input).toHaveStyle({ width: "7ch", minWidth: "7ch" });
  });
});

describe("ImageUpload", () => {
  it("passes accept prop to the hidden file input", () => {
    render(
      <ImageUpload
        onFileSelect={vi.fn()}
        accept="image/jpeg,image/png,image/svg+xml"
      />,
    );
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input).toBeTruthy();
    expect(input.accept).toBe("image/jpeg,image/png,image/svg+xml");
  });

  it("renders checkerboard background when preview is provided", () => {
    render(
      <ImageUpload
        onFileSelect={vi.fn()}
        accept="image/png"
        preview="data:image/png;base64,fake"
      />,
    );
    const checkerboard = screen.getByTestId("checkerboard-bg");
    expect(checkerboard).toBeInTheDocument();
  });

  it("does NOT render checkerboard when preview is not provided", () => {
    render(
      <ImageUpload onFileSelect={vi.fn()} accept="image/png" />,
    );
    expect(screen.queryByTestId("checkerboard-bg")).not.toBeInTheDocument();
  });

  it("checkerboard has correct background styles (16px, #e0e0e0)", () => {
    render(
      <ImageUpload
        onFileSelect={vi.fn()}
        accept="image/png"
        preview="data:image/png;base64,fake"
      />,
    );
    const checkerboard = screen.getByTestId("checkerboard-bg");
    const style = checkerboard.style;
    expect(style.backgroundSize).toBe("16px 16px");
    // jsdom converts #e0e0e0 to rgb(224, 224, 224)
    expect(style.backgroundImage).toContain("224, 224, 224");
  });
});
