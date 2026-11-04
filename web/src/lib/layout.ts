import {
  forceCollide,
  forceLink,
  forceManyBody,
  forceRadial,
  forceSimulation,
  type SimulationNodeDatum,
} from "d3-force";
import type { Company, Edge } from "../types";

export interface Point {
  x: number;
  y: number;
}

interface SimNode extends SimulationNodeDatum {
  id: string;
  rank: number;
}

export const MAX_RADIUS = 450; // radio del grafo con ~600 empresas
const REFERENCE_NODES = 600;
const MIN_RADIUS = 60;
const TICKS = 120;

/** Radio del grafo según cuántas empresas tiene: la misma densidad que el grafo completo. */
export function layoutRadius(count: number): number {
  return Math.max(MIN_RADIUS, MAX_RADIUS * Math.sqrt(count / REFERENCE_NODES));
}

// Generador fijo para que la disposición sea la misma en cada carga y en las pruebas.
function seededRandom() {
  let s = 1;
  return () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296;
}

const RINGS = 6;

/**
 * Reparte los ángulos de cada anillo (franja de rank) de forma uniforme, conservando su orden.
 * Las fuerzas de enlace apelmazan los grupos muy conectados en un lado; así se estiran sin
 * perder a sus vecinas (que siguen contiguas) y el grafo queda centrado y parejo.
 */
function equalizeAngles(nodes: SimNode[]) {
  const rings: SimNode[][] = Array.from({ length: RINGS }, () => []);
  for (const n of nodes) rings[Math.min(RINGS - 1, Math.floor(n.rank * RINGS))].push(n);
  for (const ring of rings) {
    const polar = ring
      .map((n) => ({ n, angle: Math.atan2(n.y ?? 0, n.x ?? 0), radius: Math.hypot(n.x ?? 0, n.y ?? 0) }))
      .sort((a, b) => a.angle - b.angle);
    const start = polar[0]?.angle ?? 0;
    polar.forEach(({ n, radius }, i) => {
      const angle = start + (2 * Math.PI * (i + 0.5)) / polar.length;
      n.x = radius * Math.cos(angle);
      n.y = radius * Math.sin(angle);
    });
  }
}

/** Posiciones del grafo: rank 0 (más campos con dato) en el centro, rank 1 en el borde. */
export function computeLayout(nodes: Company[], edges: Edge[]): Map<string, Point> {
  const radius = layoutRadius(nodes.length);
  const simNodes: SimNode[] = nodes.map((n) => ({ id: n.id, rank: n.rank }));
  const links = edges.map((e) => ({ source: e.a, target: e.b }));
  const simulation = forceSimulation(simNodes)
    .randomSource(seededRandom())
    // Que la simulación se enfríe justo al cabo de TICKS pasos: menos pasos, mismo asentamiento.
    .alphaDecay(1 - Math.pow(0.001, 1 / TICKS))
    .force("link", forceLink<SimNode, { source: string; target: string }>(links).id((d) => d.id).distance(20).strength(0.1))
    .force("charge", forceManyBody().strength(-6))
    .force("collide", forceCollide(7))
    // Raíz cuadrada: reparte las empresas de forma pareja por área y no apiladas en el centro.
    .force("radial", forceRadial<SimNode>((d) => radius * Math.sqrt(d.rank), 0, 0).strength(0.8))
    .stop();
  for (let i = 0; i < TICKS; i++) simulation.tick();
  equalizeAngles(simNodes);
  return new Map(simNodes.map((n) => [n.id, { x: n.x ?? 0, y: n.y ?? 0 }]));
}
