import { fireEvent, render } from "@testing-library/react";
import Graph from "../components/Graph";
import data from "../data/graph.json";
import type { Graph as GraphData } from "../types";

const graph = data as GraphData;

// jsdom no calcula diseño ni trae ResizeObserver: se simulan el tamaño del lienzo y el aviso de cambio de tamaño.
let size = { width: 1000, height: 600 };
let notify: () => void = () => {};

beforeEach(() => {
  size = { width: 1000, height: 600 };
  vi.stubGlobal(
    "ResizeObserver",
    class {
      connected = true;
      constructor(callback: () => void) {
        // Como el real: si el componente deja de observar, ya no recibe avisos.
        notify = () => this.connected && callback();
      }
      observe() {}
      disconnect() {
        this.connected = false;
      }
    },
  );
  vi.spyOn(SVGElement.prototype, "clientWidth", "get").mockImplementation(() => size.width);
  vi.spyOn(SVGElement.prototype, "clientHeight", "get").mockImplementation(() => size.height);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const view = (container: HTMLElement) => {
  const transform = container.querySelector("svg > g")!.getAttribute("transform")!;
  const [, x, y, k] = /translate\(([-\d.e]+),([-\d.e]+)\) scale\(([-\d.e]+)\)/.exec(transform)!;
  return { x: Number(x), y: Number(y), k: Number(k) };
};
const resize = (width: number, height: number) => {
  size = { width, height };
  notify();
};

describe("Graph when the canvas is resized", () => {
  it("fits the view to the canvas at first", () => {
    const { container } = render(<Graph graph={graph} selection={null} onSelect={() => {}} />);
    notify();
    const { x, y } = view(container);
    expect([x, y]).toEqual([500, 300]);
  });

  it("fits the view again, centered, if the person has not moved it", () => {
    const { container } = render(<Graph graph={graph} selection={null} onSelect={() => {}} />);
    notify();
    const before = view(container);
    resize(1400, 800);
    const after = view(container);
    expect([after.x, after.y]).toEqual([700, 400]);
    expect(after.k).toBeGreaterThan(before.k); // más alto y ancho: el grafo se agranda para llenar el lienzo
  });

  it("keeps what the person was looking at (same center and zoom) once they have moved the view", () => {
    const { container } = render(<Graph graph={graph} selection={null} onSelect={() => {}} />);
    notify();
    const fitted = view(container);
    fireEvent.wheel(container.querySelector("svg")!, { deltaY: -300, clientX: 500, clientY: 300 });
    const moved = view(container);
    expect(moved.k).toBeGreaterThan(fitted.k);
    resize(1400, 800);
    const after = view(container);
    expect(after.k).toBeCloseTo(moved.k, 6);
    expect(after.x).toBeCloseTo(moved.x + 200, 6); // el centro se mueve la mitad de lo que creció el ancho
    expect(after.y).toBeCloseTo(moved.y + 100, 6);
  });

  it("does nothing when the notification comes with the same size", () => {
    const { container } = render(<Graph graph={graph} selection={null} onSelect={() => {}} />);
    notify();
    fireEvent.wheel(container.querySelector("svg")!, { deltaY: -300, clientX: 500, clientY: 300 });
    const moved = view(container);
    notify();
    expect(view(container)).toEqual(moved);
  });

  it("ignores notifications while the canvas has no size yet", () => {
    const { container } = render(<Graph graph={graph} selection={null} onSelect={() => {}} />);
    size = { width: 0, height: 0 };
    notify();
    expect(container.querySelector("svg > g")!.getAttribute("transform")).toBeNull();
  });
});
