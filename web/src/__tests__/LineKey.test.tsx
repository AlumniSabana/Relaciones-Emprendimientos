import { render, screen } from "@testing-library/react";
import LineKey from "../components/LineKey";

describe("LineKey", () => {
  it("explains the solid and the dashed line", () => {
    const { container } = render(<LineKey />);
    expect(screen.getByText(/Línea continua: se parecen en lo que ofrecen/)).toBeInTheDocument();
    expect(screen.getByText(/Línea punteada: solo comparten sector/)).toBeInTheDocument();
    const lines = container.querySelectorAll("line");
    expect(lines).toHaveLength(2);
    expect(lines[0]).not.toHaveAttribute("stroke-dasharray");
    expect(lines[1]).toHaveAttribute("stroke-dasharray");
  });
});
