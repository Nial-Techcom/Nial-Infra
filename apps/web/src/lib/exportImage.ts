import { toPng, toSvg } from 'html-to-image';
import { getRectOfNodes, getTransformForBounds, type ReactFlowInstance } from 'reactflow';
import { safeName, saveFile } from './platform';

/** Renders the whole schema (not just the visible part) to PNG or SVG. */
export async function exportDiagram(rf: ReactFlowInstance, kind: 'png' | 'svg', baseName: string, dark: boolean) {
  const nodes = rf.getNodes();
  if (!nodes.length) return false;
  const el = document.querySelector<HTMLElement>('.react-flow__viewport');
  if (!el) return false;
  const bounds = getRectOfNodes(nodes);
  const pad = 80;
  const width = Math.max(800, Math.round(bounds.width + pad * 2));
  const height = Math.max(600, Math.round(bounds.height + pad * 2));
  const [tx, ty, scale] = getTransformForBounds(bounds, width, height, 0.1, 2);
  const opts = {
    backgroundColor: dark ? '#141A22' : '#ECEFF3', width, height,
    style: { width: `${width}px`, height: `${height}px`, transform: `translate(${tx}px, ${ty}px) scale(${scale})` },
    pixelRatio: kind === 'png' ? 2 : 1,
  };
  const dataUrl = kind === 'png' ? await toPng(el, opts) : await toSvg(el, opts);
  const blob = await (await fetch(dataUrl)).blob();
  return saveFile(`${safeName(baseName)}.${kind}`, blob, kind === 'png' ? 'image/png' : 'image/svg+xml');
}
