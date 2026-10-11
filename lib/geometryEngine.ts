
import { projectSolid } from './projectors/solid';
// // // // // import { projectSectionedSolid } from './projectors/sectionSolid';
// // // // // import { projectIsometricProjection } from './projectors/isometric';
// // // // // import { projectPerspectiveProjection } from './projectors/perspective';
// // // // // import { projectCompositeSolid } from './projectors/composite';
// // // // // import { projectAdvancedSection } from './projectors/advancedSection';
// // // // // import { projectAdvancedDevelopment } from './projectors/advancedDevelopment';
import { projectPlaneSurface } from './projectors/planeSurface';
import {
    AuxiliaryViewSchema,
    EngineeringProblem,
    GeometryOutput,
    SvgPrimitive,
    PointCoords,
    PointSchema,
    PointSpecialSchema,
    LineParallelSchema,
    LineInclinedHPSchema,
    LineInclinedVPSchema,
    LineInclinedBothSchema,
    LineOneEndHPSchema,
    LineOneEndVPSchema,
    LineCoplanarSchema,
    LineTouchingXYSchema,
    SolidSchema,
    SectionSolidSchema,
    PlaneSurfaceSchema,
    PerspectiveProjectionSchema,
    IsometricProjectionSchema,
    AdvancedDevelopmentSchema,
    AdvancedSectionSchema,
    CompositeSolidSchema,
    LineProperties,
    LineTeachingOptions
} from '../types';

// A simple map to store and retrieve points with string keys
export type PointMap = { [key: string]: PointCoords };

export class GeometryEngine {
    public SCALE = 3; // pixels per mm
    public static VIEW_WIDTH = 1400;
    public static VIEW_HEIGHT = 800;
    public XY_LINE_Y = GeometryEngine.VIEW_HEIGHT / 2;
    public ORIGIN_X = 150; // Starting X for most drawings

    public primitives: SvgPrimitive[] = [];

    public DIM_OFFSET = 30;

    public get lastStep(): number {
        if (this.primitives.length === 0) return 1;
        return Math.max(...this.primitives.map(p => p.step || 0));
    }

    public getBoundingBox(keys: string[]): { left: number, right: number, top: number, bottom: number } {
        let left = Infinity, right = -Infinity, top = Infinity, bottom = -Infinity;
        for (const prim of this.primitives) {
            if (prim.key.startsWith('dim-')) continue;
            if (keys.some(k => prim.key.includes(k))) {
                if (prim.type === 'line') {
                    left = Math.min(left, prim.points[0], prim.points[2]);
                    right = Math.max(right, prim.points[0], prim.points[2]);
                    top = Math.min(top, prim.points[1], prim.points[3]);
                    bottom = Math.max(bottom, prim.points[1], prim.points[3]);
                } else if (prim.type === 'circle') {
                    left = Math.min(left, prim.cx - prim.r);
                    right = Math.max(right, prim.cx + prim.r);
                    top = Math.min(top, prim.cy - prim.r);
                    bottom = Math.max(bottom, prim.cy + prim.r);
                }
            }
        }
        return { left, right, top, bottom };
    }

    public getAxisXYIntersection(
        axisTop: PointCoords, 
        axisBase: PointCoords
    ): PointCoords {
        // Find the x coordinate where the axis line crosses XY_LINE_Y
        // Using linear interpolation between axisTop and axisBase
        const t = (this.XY_LINE_Y - axisTop.y) / (axisBase.y - axisTop.y);
        return {
            x: axisTop.x + t * (axisBase.x - axisTop.x),
            y: this.XY_LINE_Y
        };
    }

    public safeNum(n: number, fallback: number) {
        return isNaN(n) || !isFinite(n) ? fallback : n;
    }

    public formatLengthLabel(value: number) {
        return `${value}`;
    }

    public formatAngleLabel(value: number) {
        const rounded = Math.round(value * 100) / 100;
        // If it's a whole number, show plain degrees
        if (rounded === Math.round(rounded)) return `${Math.round(rounded)}\u00B0`;
        // Otherwise show degrees and minutes (e.g. 35°16')
        const deg = Math.floor(rounded);
        const min = Math.round((rounded - deg) * 60);
        if (min === 0) return `${deg}\u00B0`;
        return `${deg}\u00B0${min}\u2032`;
    }

    public addOrthographicSolidLabels(
        referenceTvPts: PointMap,
        tvPts: PointMap,
        fvPts: PointMap,
        baseKeys: string[],
        topKeys: string[],
        isPrism: boolean,
        step: number,
        views: Array<'tv' | 'fv'> = ['tv', 'fv'],
    ) {
        const labelChars = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
        if (baseKeys.length > labelChars.length) return;

        const getCenter = (keys: string[], pts: PointMap) => {
            const resolvedKeys = keys.filter((key) => pts[key]);
            const count = Math.max(resolvedKeys.length, 1);
            const sums = resolvedKeys.reduce(
                (acc, key) => {
                    acc.x += pts[key].x;
                    acc.y += pts[key].y;
                    return acc;
                },
                { x: 0, y: 0 },
            );
            return { x: sums.x / count, y: sums.y / count };
        };

        const referenceCenter = getCenter(baseKeys, referenceTvPts);
        const orderedBaseKeys = [...baseKeys]
            .filter((key) => referenceTvPts[key])
            .map((key) => {
                const point = referenceTvPts[key];
                const angle = Math.atan2(referenceCenter.y - point.y, point.x - referenceCenter.x);
                const topRightScore = (point.x - referenceCenter.x) + (referenceCenter.y - point.y);
                return { key, angle, topRightScore };
            })
            .sort((left, right) => right.angle - left.angle);

        if (orderedBaseKeys.length === 0) return;

        let startIndex = 0;
        let bestStartScore = -Infinity;
        orderedBaseKeys.forEach((entry, index) => {
            if (entry.topRightScore > bestStartScore) {
                bestStartScore = entry.topRightScore;
                startIndex = index;
            }
        });

        const rotatedBaseKeys = [
            ...orderedBaseKeys.slice(startIndex),
            ...orderedBaseKeys.slice(0, startIndex),
        ].map((entry) => entry.key);

        const labelMap = new Map<string, string>();
        rotatedBaseKeys.forEach((key, index) => {
            if (!labelChars[index]) return;
            labelMap.set(key, labelChars[index]);
        });

        const tvLabelKeys = [
            ...baseKeys,
            ...(isPrism ? topKeys : []),
            ...(!isPrism ? ['apex'] : []),
        ].filter((key) => tvPts[key]);
        const fvLabelKeys = [
            ...baseKeys,
            ...(isPrism ? topKeys : []),
            ...(!isPrism ? ['apex'] : []),
        ].filter((key) => fvPts[key]);
        const tvCenter = getCenter(tvLabelKeys, tvPts);
        const fvCenter = getCenter(fvLabelKeys, fvPts);

        const addGroupedLabels = (
            entries: Array<{ point: PointCoords; content: string; depth: number }>,
            center: PointCoords,
            suffix: 'tv' | 'fv',
        ) => {
            const groups = new Map<string, Array<{ point: PointCoords; content: string; depth: number }>>();

            entries.forEach((entry) => {
                const groupKey = `${entry.point.x.toFixed(2)}:${entry.point.y.toFixed(2)}`;
                const existing = groups.get(groupKey) || [];
                existing.push(entry);
                groups.set(groupKey, existing);
            });

            const pushLabel = (x: number, y: number, content: string, key: string, textAnchor: 'start' | 'middle' | 'end', dominantBaseline: 'auto' | 'use-script' | 'no-change' | 'reset-size' | 'ideographic' | 'alphabetic' | 'hanging' | 'mathematical' | 'central' | 'middle' | 'text-after-edge' | 'text-before-edge') => {
                this.primitives.push({
                    type: 'text',
                    key: `label-${suffix}-${step}-${key}`,
                    x: this.safeNum(x, 0),
                    y: this.safeNum(y, 0),
                    content,
                    step,
                    primitiveRole: 'label',
                    fontSize: 12,
                    textAnchor,
                    dominantBaseline,
                });
            };

            const allPoints = entries.map(e => e.point);
            const getConnectedVertices = (point: PointCoords) => {
                const distances = allPoints
                    .filter(p => Math.hypot(p.x - point.x, p.y - point.y) > 0.1)
                    .map(p => ({ point: p, dist: Math.hypot(p.x - point.x, p.y - point.y) }))
                    .sort((a, b) => a.dist - b.dist);
                if (distances.length === 0) return [];
                return distances.slice(0, 2).map(d => d.point);
            };

            groups.forEach((group, groupKey) => {
                const ordered = [...group].sort((left, right) => right.depth - left.depth);
                const [lead] = ordered;
                const needsBrackets = ordered.length > 1 && ordered.every(e => /^[a-z]\u2081?'?$/i.test(e.content));
                let displayContent: string;
                if (needsBrackets) {
                    displayContent = `${ordered[0].content}(${ordered.slice(1).map(e => e.content).join(', ')})`;
                } else {
                    displayContent = ordered.map(e => e.content).join(', ');
                }

                const connected = getConnectedVertices(lead.point);
                const { normalX, normalY, textAnchor, dominantBaseline } = this.getOpenQuadrantOffset(lead.point, center, connected);

                const fgX = this.safeNum(lead.point.x + normalX * 14, 0);
                const fgY = this.safeNum(lead.point.y + normalY * 14, 0);
                pushLabel(fgX, fgY, displayContent, groupKey.replace(/[:.]/g, '-'), textAnchor, dominantBaseline);
            });
        };

        if (views.includes('tv')) {
            const tvEntries: Array<{ point: PointCoords; content: string; depth: number }> = [];
            baseKeys.forEach((key) => {
                const content = labelMap.get(key);
                if (!content || !tvPts[key]) return;
                tvEntries.push({
                    point: tvPts[key],
                    content: `${content}\u2081`,
                    depth: tvPts[key].z || 0,
                });
            });
            if (isPrism) {
                topKeys.forEach((key, index) => {
                    const pairedBaseKey = baseKeys[index];
                    const content = pairedBaseKey ? labelMap.get(pairedBaseKey) : undefined;
                    if (!content || !tvPts[key]) return;
                    tvEntries.push({
                        point: tvPts[key],
                        content,
                        depth: tvPts[key].z || 0,
                    });
                });
            }
            if (!isPrism && tvPts.apex) {
                tvEntries.push({ point: tvPts.apex, content: 'o', depth: tvPts.apex.z || 0 });
            }
            addGroupedLabels(tvEntries, tvCenter, 'tv');
        }

        if (views.includes('fv')) {
            const fvEntries: Array<{ point: PointCoords; content: string; depth: number }> = [];
            baseKeys.forEach((key) => {
                const content = labelMap.get(key);
                if (!content || !fvPts[key]) return;
                fvEntries.push({
                    point: fvPts[key],
                    content: `${content}\u2081'`,
                    depth: fvPts[key].z || 0,
                });
            });
            if (isPrism) {
                topKeys.forEach((key, index) => {
                    const pairedBaseKey = baseKeys[index];
                    const content = pairedBaseKey ? labelMap.get(pairedBaseKey) : undefined;
                    if (!content || !fvPts[key]) return;
                    fvEntries.push({
                        point: fvPts[key],
                        content: `${content}'`,
                        depth: fvPts[key].z || 0,
                    });
                });
            } else if (fvPts.apex) {
                fvEntries.push({ point: fvPts.apex, content: "o'", depth: fvPts.apex.z || 0 });
            }
            addGroupedLabels(fvEntries, fvCenter, 'fv');
        }
    }

    private getOpenQuadrantOffset(
        vertex: PointCoords,
        center: PointCoords,
        connectedPoints: PointCoords[],
    ): { normalX: number; normalY: number; textAnchor: 'start' | 'middle' | 'end'; dominantBaseline: 'auto' | 'hanging' | 'middle' } {
        const resolveAnchor = (nx: number, ny: number): { normalX: number; normalY: number; textAnchor: 'start' | 'middle' | 'end'; dominantBaseline: 'auto' | 'hanging' | 'middle' } => {
            const textAnchor: 'start' | 'middle' | 'end' = Math.abs(nx) > Math.abs(ny)
                ? (nx > 0 ? 'start' : 'end')
                : 'middle';
            const dominantBaseline: 'auto' | 'hanging' | 'middle' = Math.abs(ny) > Math.abs(nx)
                ? (ny < 0 ? 'hanging' : 'auto')
                : 'middle';
            return { normalX: nx, normalY: ny, textAnchor, dominantBaseline };
        };

        const dirAngles: number[] = [];
        for (const p of connectedPoints) {
            const dx = p.x - vertex.x;
            const dy = p.y - vertex.y;
            if (Math.hypot(dx, dy) > 0.01) {
                dirAngles.push(Math.atan2(dy, dx));
            }
        }

        if (dirAngles.length < 2) {
            const dx = vertex.x - center.x;
            const dy = vertex.y - center.y;
            const len = Math.hypot(dx, dy);
            if (len < 0.01) return resolveAnchor(1, 0);
            return resolveAnchor(dx / len, dy / len);
        }

        dirAngles.sort((a, b) => a - b);
        let maxGap = 0;
        let gapStart = 0;
        for (let i = 0; i < dirAngles.length; i++) {
            const current = dirAngles[i];
            const next = dirAngles[(i + 1) % dirAngles.length];
            const gap = next - current + (i === dirAngles.length - 1 ? 2 * Math.PI : 0);
            if (gap > maxGap) {
                maxGap = gap;
                gapStart = current;
            }
        }
        const bisector = gapStart + maxGap / 2;
        const nx = Math.cos(bisector);
        const ny = Math.sin(bisector);

        const toCenterX = center.x - vertex.x;
        const toCenterY = center.y - vertex.y;
        const toCenterLen = Math.hypot(toCenterX, toCenterY);
        if (toCenterLen > 0.01) {
            const dot = nx * toCenterX + ny * toCenterY;
            if (dot > 0) return resolveAnchor(-nx, -ny);
        }
        return resolveAnchor(nx, ny);
    }

    public resolveLabelOverlaps(step: number) {
        const labels = this.primitives.filter(
            (p): p is Extract<SvgPrimitive, { type: 'text' }> => p.type === 'text' && p.step === step,
        );
        if (labels.length < 2) return;

        const geometry = this.primitives.filter(p => p.step === step && p.type !== 'text');

        const pointToSegmentDistance = (px: number, py: number, x1: number, y1: number, x2: number, y2: number) => {
            const dx = x2 - x1;
            const dy = y2 - y1;
            if (dx === 0 && dy === 0) return Math.hypot(px - x1, py - y1);
            const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)));
            const projX = x1 + t * dx;
            const projY = y1 + t * dy;
            return Math.hypot(px - projX, py - projY);
        };

        for (let iter = 0; iter < 5; iter++) {
            let moved = false;
            for (let i = 0; i < labels.length; i++) {
                const a = labels[i];
                const ahw = Math.max((a.content?.length || 1) * 4.5, 10);
                const ahh = 10;

                for (let j = i + 1; j < labels.length; j++) {
                    const b = labels[j];
                    const bhw = Math.max((b.content?.length || 1) * 4.5, 10);
                    const bhh = 10;

                    const dx = Math.abs(a.x - b.x);
                    const dy = Math.abs(a.y - b.y);
                    if (dx < ahw + bhw && dy < ahh + bhh) {
                        const overlapX = (ahw + bhw - dx) * 0.5 + 2;
                        const overlapY = (ahh + bhh - dy) * 0.5 + 2;
                        if (dx > dy) {
                            if (a.x > b.x) { a.x += overlapX; b.x -= overlapX; }
                            else { a.x -= overlapX; b.x += overlapX; }
                        } else {
                            if (a.y > b.y) { a.y += overlapY; b.y -= overlapY; }
                            else { a.y -= overlapY; b.y += overlapY; }
                        }
                        moved = true;
                    }
                }

                for (const prim of geometry) {
                    if (prim.type === 'line') {
                        const d = pointToSegmentDistance(a.x, a.y, prim.points[0], prim.points[1], prim.points[2], prim.points[3]);
                        if (d < 10) {
                            const nx = prim.points[2] - prim.points[0];
                            const ny = prim.points[3] - prim.points[1];
                            const nl = Math.hypot(nx, ny) || 1;
                            a.x += (a.x - prim.points[0]) * 3 / nl;
                            a.y += (a.y - prim.points[1]) * 3 / nl;
                            moved = true;
                        }
                    }
                }
            }
            if (!moved) break;
        }
    }

    public getCollisionAwareLabelPosition(point: PointCoords, center: PointCoords, step: number, scope: 'tv' | 'fv' | 'generic' | 'isometric' = 'generic') {
        const pointToSegmentDistance = (px: number, py: number, x1: number, y1: number, x2: number, y2: number) => {
            const dx = x2 - x1;
            const dy = y2 - y1;
            if (dx === 0 && dy === 0) return Math.hypot(px - x1, py - y1);
            const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)));
            const projX = x1 + t * dx;
            const projY = y1 + t * dy;
            return Math.hypot(px - projX, py - projY);
        };

        const pathToSegments = (d: string): Array<[number, number, number, number]> => {
            const matches = d.match(/-?\d+(?:\.\d+)?/g);
            if (!matches || matches.length < 4) return [];
            const points: Array<{ x: number; y: number }> = [];
            for (let i = 0; i < matches.length - 1; i += 2) {
                points.push({ x: parseFloat(matches[i]), y: parseFloat(matches[i + 1]) });
            }

            const segments: Array<[number, number, number, number]> = [];
            for (let i = 0; i < points.length - 1; i++) {
                segments.push([points[i].x, points[i].y, points[i + 1].x, points[i + 1].y]);
            }
            const closesPath = /\bZ\b/i.test(d);
            if (closesPath && points.length > 2) {
                const first = points[0];
                const last = points[points.length - 1];
                segments.push([last.x, last.y, first.x, first.y]);
            }
            return segments;
        };

        const stagePrimitives = this.primitives.filter((primitive) => primitive.step === step && primitive.type !== 'text');
        const stageLabels = this.primitives.filter(
            (primitive): primitive is Extract<SvgPrimitive, { type: 'text' }> =>
                primitive.step === step && primitive.type === 'text',
        );
        const baseAngle = Math.atan2(point.y - center.y, point.x - center.x);
        const isoAxes = [Math.PI/6, Math.PI/2, 5*Math.PI/6, 7*Math.PI/6, 3*Math.PI/2, 11*Math.PI/6];
        const candidateAngles = scope === 'isometric'
            ? isoAxes
            : Array.from({ length: 16 }, (_, index) => baseAngle + (index * Math.PI / 8));
        const candidateOffsets = [12, 20, 30, 42, 56, 72];

        let best = { x: point.x + 16, y: point.y - 12, score: -Infinity };

        for (const angle of candidateAngles) {
            for (const offset of candidateOffsets) {
                const x = point.x + Math.cos(angle) * offset;
                const y = point.y + Math.sin(angle) * offset;
                let minDistance = Infinity;

                for (const primitive of stagePrimitives) {
                    if (primitive.type === 'line') {
                        const distance = pointToSegmentDistance(x, y, primitive.points[0], primitive.points[1], primitive.points[2], primitive.points[3]);
                        const threshold = primitive.primitiveRole === 'dimension' || primitive.primitiveRole === 'projection' ? 14 : 10;
                        const weightedDistance = distance < threshold ? distance - (threshold - distance) * 3 : distance;
                        minDistance = Math.min(minDistance, weightedDistance);
                    } else if (primitive.type === 'circle') {
                        const radialDistance = Math.abs(Math.hypot(x - primitive.cx, y - primitive.cy) - primitive.r);
                        minDistance = Math.min(minDistance, radialDistance < 10 ? radialDistance - (10 - radialDistance) * 3 : radialDistance);
                    } else if (primitive.type === 'path') {
                        const pathDistances = pathToSegments(primitive.d).map(([x1, y1, x2, y2]) =>
                            pointToSegmentDistance(x, y, x1, y1, x2, y2),
                        );
                        const pathDistance = pathDistances.length ? Math.min(...pathDistances) : 4;
                        minDistance = Math.min(minDistance, pathDistance < 10 ? pathDistance - (10 - pathDistance) * 3 : pathDistance);
                    }
                }

                for (const label of stageLabels) {
                    const labelHalfWidth = Math.max((label.content?.length || 1) * 4.5, 10);
                    const labelHalfHeight = 10;
                    const dx = Math.max(Math.abs(x - label.x) - labelHalfWidth, 0);
                    const dy = Math.max(Math.abs(y - label.y) - labelHalfHeight, 0);
                    const distance = Math.hypot(dx, dy);
                    minDistance = Math.min(minDistance, distance < 10 ? distance - (10 - distance) * 4 : distance);
                }

                const pointRadius = Math.hypot(point.x - center.x, point.y - center.y);
                const candidateRadius = Math.hypot(x - center.x, y - center.y);
                const outwardScore = (candidateRadius - pointRadius) * 0.06;
                const score = minDistance - offset * 0.05 + outwardScore;
                if (score > best.score) {
                    best = { x, y, score };
                }
            }
        }

        const overlapsExistingLabel = (x: number, y: number) => stageLabels.some((label) => {
            const labelHalfWidth = Math.max((label.content?.length || 1) * 4.5, 10) + 4;
            const labelHalfHeight = 12;
            return Math.abs(x - label.x) < labelHalfWidth && Math.abs(y - label.y) < labelHalfHeight;
        });

        const directionAngle = Math.atan2(best.y - center.y, best.x - center.x);
        let resolvedX = best.x;
        let resolvedY = best.y;
        let pushAttempts = 0;
        while (overlapsExistingLabel(resolvedX, resolvedY) && pushAttempts < 8) {
            resolvedX += Math.cos(directionAngle) * 10;
            resolvedY += Math.sin(directionAngle) * 10;
            pushAttempts += 1;
        }

        return { x: resolvedX, y: resolvedY };
    }

    public addSequentialPointLabels(points: PointCoords[], labels: string[], step: number, keyPrefix: string, tight: boolean = false, scope: 'generic' | 'tv' | 'fv' | 'isometric' = 'generic', inward: boolean = false) {
        if (points.length === 0) return;
        const center = points.reduce((acc, point) => ({ x: acc.x + point.x, y: acc.y + point.y }), { x: 0, y: 0 });
        center.x /= points.length;
        center.y /= points.length;

        points.forEach((point, index) => {
            const content = labels[index];
            if (!content) return;
            const position = tight
                ? (() => {
                    const prev = points[(index - 1 + points.length) % points.length];
                    const next = points[(index + 1) % points.length];
                    const edgeX = next.x - prev.x;
                    const edgeY = next.y - prev.y;
                    const edgeLen = Math.hypot(edgeX, edgeY);
                    if (edgeLen > 0.01) {
                        const perpX = -edgeY / edgeLen;
                        const perpY = edgeX / edgeLen;
                        const toCenterX = point.x - center.x;
                        const toCenterY = point.y - center.y;
                        const dot = perpX * toCenterX + perpY * toCenterY;
                        const outX = dot < 0 ? perpX : -perpX;
                        const outY = dot < 0 ? perpY : -perpY;
                        const baseOffset = inward ? -8 : 12;
                        const devVerticalBias = keyPrefix.startsWith('step-6-dev') ? (outY > 0 ? 6 : 0) : 0;
                        const offset = baseOffset + devVerticalBias;
                        return { x: point.x + outX * offset, y: point.y + outY * offset };
                    }
                    const angle = Math.atan2(point.y - center.y, point.x - center.x);
                    const baseOffset = inward ? -8 : 12;
                    const offset = keyPrefix.startsWith('step-6-dev') ? baseOffset + 6 : baseOffset;
                    return { x: point.x + Math.cos(angle) * offset, y: point.y + Math.sin(angle) * offset };
                })()
                : this.getCollisionAwareLabelPosition(point, center, step, scope);
            this.primitives.push({
                type: 'text',
                key: `${keyPrefix}-${index}`,
                x: position.x,
                y: position.y,
                content,
                step,
                primitiveRole: 'label',
                fontSize: 12,
                dominantBaseline: 'middle',
                textAnchor: 'middle',
            });
        });
        this.resolveLabelOverlaps(step);
    }

    public addPointLabels(points: PointCoords[], labels: string[], step: number, keyPrefix: string, scope: 'tv' | 'fv' | 'generic' | 'isometric' = 'generic') {
        if (points.length === 0) return;
        const center = points.reduce((acc, point) => ({ x: acc.x + point.x, y: acc.y + point.y }), { x: 0, y: 0 });
        center.x /= points.length;
        center.y /= points.length;

        points.forEach((point, index) => {
            const content = labels[index];
            if (!content) return;
            const position = this.getCollisionAwareLabelPosition(point, center, step, scope);
            this.primitives.push({
                type: 'text',
                key: `${keyPrefix}-${index}`,
                x: position.x,
                y: position.y,
                content,
                step,
                primitiveRole: 'label',
                fontSize: 12,
                dominantBaseline: 'middle',
                textAnchor: 'middle',
            });
        });
        this.resolveLabelOverlaps(step);
    }

    public getPrimitiveRole(primitive: SvgPrimitive): NonNullable<SvgPrimitive['primitiveRole']> {
        const key = primitive.key.toLowerCase();

        if (key.startsWith('dim-') || key.includes('-dim') || key.includes('angle')) return 'dimension';
        if (key === 'xy-line') return 'plane';
        if (key.includes('proj') || key.includes('locus')) return 'projection';
        if (key.includes('axis') || key.includes('center')) return 'axis';
        if (key.includes('hidden')) return 'hidden';
        if (primitive.type === 'text') {
            if (key.includes('caption') || key.endsWith('-label') || key.includes('iso-comp-label')) return 'caption';
            if (key.includes('label') || key.includes('-lbl-') || key.includes('fv-') || key.includes('tv-') || key.includes('vp-') || key.includes('hp-') || key.includes('xy-')) return 'label';
        }

        return 'visible';
    }

    public dimensionOverlapsGeometry(ext1End: PointCoords, ext2End: PointCoords, dimStart: PointCoords, dimEnd: PointCoords, step: number): boolean {
        const pointToSegmentDistance = (px: number, py: number, x1: number, y1: number, x2: number, y2: number) => {
            const dx = x2 - x1;
            const dy = y2 - y1;
            if (dx === 0 && dy === 0) return Math.hypot(px - x1, py - y1);
            const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)));
            const projX = x1 + t * dx;
            const projY = y1 + t * dy;
            return Math.hypot(px - projX, py - projY);
        };
        const dimLines: Array<[number, number, number, number]> = [
            [ext1End.x, ext1End.y, dimStart.x, dimStart.y],
            [ext2End.x, ext2End.y, dimEnd.x, dimEnd.y],
            [dimStart.x, dimStart.y, dimEnd.x, dimEnd.y],
        ];
        const geometry = this.primitives.filter(p => p.step === step && p.type !== 'text' && p.primitiveRole !== 'dimension');
        for (const prim of geometry) {
            if (prim.type === 'line') {
                const segments = [prim.points];
                for (const dimSeg of dimLines) {
                    for (const seg of segments) {
                        const d = pointToSegmentDistance(dimSeg[0], dimSeg[1], seg[0], seg[1], seg[2], seg[3]);
                        if (d < 8) return true;
                    }
                }
            } else if (prim.type === 'circle') {
                for (const dimSeg of dimLines) {
                    const mid = { x: (dimSeg[0] + dimSeg[2]) / 2, y: (dimSeg[1] + dimSeg[3]) / 2 };
                    if (Math.hypot(mid.x - prim.cx, mid.y - prim.cy) < prim.r + 8) return true;
                }
            }
        }
        return false;
    }

    public addLinearDimension(p1: PointCoords, p2: PointCoords, label: string, offset: number, isVertical: boolean, keyPrefix: string, aligned: boolean = false, step: number = this.lastStep + 1, textOffset: number = 0) {
        let ext1End: PointCoords, ext2End: PointCoords;
        let dimStart: PointCoords, dimEnd: PointCoords;
        let textPos: PointCoords;

        const computeDimension = (o: number) => {
            if (aligned) {
                const dx = p2.x - p1.x;
                const dy = p2.y - p1.y;
                const len = Math.sqrt(dx * dx + dy * dy);
                const nx = -dy / len;
                const ny = dx / len;

                ext1End = { x: this.safeNum(p1.x + nx * o, 0), y: this.safeNum(p1.y + ny * o, 0) };
                ext2End = { x: this.safeNum(p2.x + nx * o, 0), y: this.safeNum(p2.y + ny * o, 0) };
                dimStart = { x: this.safeNum(p1.x + nx * (o - 5 * Math.sign(o)), 0), y: this.safeNum(p1.y + ny * (o - 5 * Math.sign(o)), 0) };
                dimEnd = { x: this.safeNum(p2.x + nx * (o - 5 * Math.sign(o)), 0), y: this.safeNum(p2.y + ny * (o - 5 * Math.sign(o)), 0) };
                textPos = { x: this.safeNum((dimStart.x + dimEnd.x) / 2 + nx * 10 * Math.sign(o) + (isVertical ? ny * textOffset : nx * textOffset), 0), y: this.safeNum((dimStart.y + dimEnd.y) / 2 + ny * 10 * Math.sign(o) + (isVertical ? nx * textOffset : ny * textOffset), 0) };
            } else if (isVertical) {
                ext1End = { x: this.safeNum(p1.x + o, 0), y: this.safeNum(p1.y, 0) };
                ext2End = { x: this.safeNum(p2.x + o, 0), y: this.safeNum(p2.y, 0) };
                dimStart = { x: this.safeNum(p1.x + o - 5 * Math.sign(o), 0), y: this.safeNum(p1.y, 0) };
                dimEnd = { x: this.safeNum(p2.x + o - 5 * Math.sign(o), 0), y: this.safeNum(p2.y, 0) };
                textPos = { x: this.safeNum(dimStart.x - 12 + textOffset, 0), y: this.safeNum((p1.y + p2.y) / 2, 0) };
            } else {
                ext1End = { x: this.safeNum(p1.x, 0), y: this.safeNum(p1.y + o, 0) };
                ext2End = { x: this.safeNum(p2.x, 0), y: this.safeNum(p2.y + o, 0) };
                dimStart = { x: this.safeNum(p1.x, 0), y: this.safeNum(p1.y + o - 5 * Math.sign(o), 0) };
                dimEnd = { x: this.safeNum(p2.x, 0), y: this.safeNum(p2.y + o - 5 * Math.sign(o), 0) };
                textPos = { x: this.safeNum((p1.x + p2.x) / 2, 0), y: this.safeNum(dimStart.y + 15 * Math.sign(o) + textOffset, 0) };
            }
        };

        computeDimension(offset);
        let attempt = 0;
        const maxAttempts = 6;
        while (this.dimensionOverlapsGeometry(ext1End, ext2End, dimStart, dimEnd, step) && attempt < maxAttempts) {
            offset += 5 * Math.sign(offset);
            computeDimension(offset);
            attempt++;
        }

        this.primitives.push({ type: 'line', key: `${keyPrefix}-ext1`, points: [this.safeNum(p1.x, 0), this.safeNum(p1.y, 0), ext1End.x, ext1End.y], dashed: false, color: '#5f6368', step, primitiveRole: 'dimension' });
        this.primitives.push({ type: 'line', key: `${keyPrefix}-ext2`, points: [this.safeNum(p2.x, 0), this.safeNum(p2.y, 0), ext2End.x, ext2End.y], dashed: false, color: '#5f6368', step, primitiveRole: 'dimension' });
        this.primitives.push({ type: 'line', key: `${keyPrefix}-dim`, points: [dimStart.x, dimStart.y, dimEnd.x, dimEnd.y], dashed: false, color: '#5f6368', step, primitiveRole: 'dimension' });
        
        const textPrim: any = { type: 'text', key: `${keyPrefix}-text`, x: textPos.x, y: textPos.y, content: label, step, color: '#202124', primitiveRole: 'dimension', textAnchor: 'middle', fontSize: 12 };
        if (isVertical) {
            textPrim.rotation = -90;
            textPrim.transform = `rotate(-90, ${textPos.x}, ${textPos.y})`;
        }
        this.primitives.push(textPrim);
    }

    public addAngleDimension(vertex: PointCoords, angleStartRad: number, angleEndRad: number, radius: number, label: string, keyPrefix: string) {
        angleStartRad = ((angleStartRad % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
        angleEndRad = ((angleEndRad % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);

        let diff = angleEndRad - angleStartRad;
        if (diff < 0) diff += 2 * Math.PI;
        
        const sweepFlag = diff > Math.PI ? 0 : 1;
        
        if (diff > Math.PI) {
            diff = 2 * Math.PI - diff;
        }

        const startX = vertex.x + radius * Math.cos(angleStartRad);
        const startY = vertex.y + radius * Math.sin(angleStartRad);
        const endX = vertex.x + radius * Math.cos(angleEndRad);
        const endY = vertex.y + radius * Math.sin(angleEndRad);
        
        const largeArcFlag = 0;

        const d = `M ${startX} ${startY} A ${radius} ${radius} 0 ${largeArcFlag} ${sweepFlag} ${endX} ${endY}`;
        this.primitives.push({ type: 'path', key: `${keyPrefix}-arc`, d, dashed: false, color: '#5f6368', step: this.lastStep + 1, fill: 'none', primitiveRole: 'dimension' });

        const midAngle = sweepFlag === 1 ? angleStartRad + diff / 2 : angleStartRad - diff / 2;
        const textRadius = radius + 15;
        const textX = vertex.x + textRadius * Math.cos(midAngle);
        const textY = vertex.y + textRadius * Math.sin(midAngle);
        this.primitives.push({ type: 'text', key: `${keyPrefix}-text`, x: textX, y: textY, content: label, step: this.lastStep + 1, color: '#202124', primitiveRole: 'dimension', textAnchor: 'middle', fontSize: 12 });
    }

    public degToRad(deg: number): number {
        return deg * (Math.PI / 180);
    }

    public radToDeg(rad: number): number {
        return rad * (180 / Math.PI);
    }
    
    public rotatePoint(point: PointCoords, pivot: PointCoords, angleRad: number): PointCoords {
        const s = Math.sin(angleRad);
        const c = Math.cos(angleRad);
        const newPoint = { x: point.x - pivot.x, y: point.y - pivot.y };
        const xnew = newPoint.x * c - newPoint.y * s;
        const ynew = newPoint.x * s + newPoint.y * c;
        return { x: xnew + pivot.x, y: ynew + pivot.y, z: point.z };
    }

    private validateProblem(data: Exclude<EngineeringProblem, { error: string }>): string | null {
        const positive = (value: number | undefined) => value !== undefined && Number.isFinite(value) && value > 0;
        const nonnegative = (value: number | undefined) => value !== undefined && Number.isFinite(value) && value >= 0;
        const validAngle = (value: number | undefined) => value !== undefined && Number.isFinite(value) && value >= 0 && value <= 90;
        const validateTwoPlaneAngles = (hp: number, vp: number) => {
            if (!validAngle(hp) || !validAngle(vp)) return 'Inclination angles must be between 0° and 90°.';
            if ((Math.sin(this.degToRad(hp)) ** 2 + Math.sin(this.degToRad(vp)) ** 2) > 1 + 1e-9) {
                return 'The supplied HP and VP inclinations cannot belong to the same line or axis.';
            }
            return null;
        };
        const validateBase = (shape: SolidSchema['base_shape'], size: SolidSchema['base_size_mm']) => {
            if (shape === 'circle') return positive(size.diameter_mm) ? null : 'A circular base requires a positive diameter.';
            if (shape === 'rectangle') {
                return positive(size.length_mm) && positive(size.breadth_mm)
                    ? null
                    : 'A rectangular base requires positive length and breadth.';
            }
            return positive(size.side_mm) ? null : `A ${shape} base requires a positive side length.`;
        };
        const baseBoundingRadius = (shape: SolidSchema['base_shape'], size: SolidSchema['base_size_mm']) => {
            if (shape === 'circle') return (size.diameter_mm || 0) / 2;
            if (shape === 'rectangle') return Math.hypot(size.length_mm || 0, size.breadth_mm || 0) / 2;
            const sides = shape === 'triangle' ? 3 : shape === 'square' ? 4 : shape === 'pentagon' ? 5 : 6;
            return (size.side_mm || 0) / (2 * Math.sin(Math.PI / sides));
        };
        const validateBaseOrientation = (
            shape: SolidSchema['base_shape'],
            restingOn: 'HP' | 'VP',
            orientation: SolidSchema['base_orientation'],
            isFaceResting = false,
        ) => {
            if (!orientation) return null;
            if (orientation.feature === 'body_diagonal' && (shape === 'circle' || shape === 'triangle')) {
                return 'A body diagonal only exists for prism-based solids with an even number of sides (square, rectangle, hexagon) or a cube.';
            }
            if (orientation.feature === 'body_diagonal' && orientation.reference_plane !== 'HP') {
                return 'A body diagonal orientation is referenced to HP (it defines a tilt, not a plan rotation).';
            }
            if (shape === 'circle') return 'A circular base has no unique side, diagonal, or corner orientation.';
            if (isFaceResting) return 'Base orientation cannot be combined with a lateral-face resting condition.';

            if (orientation.feature !== 'body_diagonal') {
                const expectedReference = restingOn === 'HP' ? 'VP' : 'HP';
                if (orientation.reference_plane !== expectedReference) {
                    return `A base resting on ${restingOn} must be oriented relative to ${expectedReference}.`;
                }
            }
            if ((orientation.feature === 'longer_side' || orientation.feature === 'shorter_side') && shape !== 'rectangle') {
                return 'Longer-side and shorter-side orientation applies only to rectangular bases.';
            }
            if (orientation.feature === 'diagonal' && shape === 'triangle') {
                return 'A triangular base has no diagonal; use a side or corner-to-center orientation.';
            }
            if (orientation.relation === 'inclined') {
                if (!positive(orientation.angle_deg) || orientation.angle_deg! >= 90) {
                    return 'An inclined base feature requires an angle strictly between 0° and 90°.';
                }
            } else if (orientation.angle_deg !== undefined) {
                return 'Use angle_deg only when the base-orientation relation is inclined.';
            }
            return null;
        };

        switch (data.type) {
            case 'auxiliary_view': {
                if (!validAngle(data.inclination_deg)) return 'Auxiliary plane inclination must be between 0° and 90°.';
                if (!positive(data.axis_length_mm)) return 'Solid axis length must be positive.';
                const baseError = validateBase(data.base_shape, data.base_size_mm);
                if (baseError) return baseError;
                return null;
            }
            case 'point':
                return nonnegative(data.position.distance_from_HP_mm) && nonnegative(data.position.distance_from_VP_mm)
                    ? null
                    : 'Point distances must be finite, non-negative values.';
            case 'point_special':
                return nonnegative(data.distance_mm) ? null : 'Point distance must be a finite, non-negative value.';
            case 'line_parallel':
                return positive(data.length_mm) && nonnegative(data.end_A.distance_from_HP_mm) && nonnegative(data.end_A.distance_from_VP_mm)
                    ? null
                    : 'Line length must be positive and endpoint distances must be non-negative.';
            case 'line_inclined_HP':
            case 'line_inclined_VP':
                return positive(data.length_mm) && validAngle(data.inclination_deg)
                    && nonnegative(data.end_A.distance_from_HP_mm) && nonnegative(data.end_A.distance_from_VP_mm)
                    ? null
                    : 'Line length must be positive; angle must be between 0° and 90°; endpoint distances must be non-negative.';
            case 'line_inclined_both': {
                if (!positive(data.length_mm) || !nonnegative(data.end_A.distance_from_HP_mm) || !nonnegative(data.end_A.distance_from_VP_mm)) {
                    return 'Line length must be positive and endpoint distances must be non-negative.';
                }
                return validateTwoPlaneAngles(data.inclination_with_HP_deg, data.inclination_with_VP_deg);
            }
            case 'line_one_end_HP':
            case 'line_one_end_VP': {
                if (!positive(data.length_mm)) return 'Line length must be positive.';
                const distance = data.type === 'line_one_end_HP' ? data.end_A.distance_from_VP_mm : data.end_A.distance_from_HP_mm;
                if (!nonnegative(distance)) return 'Endpoint distance must be non-negative.';
                return validateTwoPlaneAngles(data.inclination_with_HP_deg, data.inclination_with_VP_deg);
            }
            case 'line_coplanar':
                if (!positive(data.length_mm) || !validAngle(data.inclination_deg) || !nonnegative(data.end_A_distance_mm)) {
                    return 'Line length must be positive; angle must be between 0° and 90°; endpoint distance must be non-negative.';
                }
                if (data.plane === 'HP' && (data.end_A_side === 'above' || data.end_A_side === 'below')) {
                    return 'A line lying in HP can only place end A in front of or behind VP.';
                }
                if (data.plane === 'VP' && (data.end_A_side === 'in_front' || data.end_A_side === 'behind')) {
                    return 'A line lying in VP can only place end A above or below HP.';
                }
                return null;
            case 'line_touching_XY':
                return positive(data.length_mm)
                    ? validateTwoPlaneAngles(data.inclination_with_HP_deg, data.inclination_with_VP_deg)
                    : 'Line length must be positive.';
            case 'solid': {
                if (!positive(data.height_mm)) return 'Solid height or axis length must be positive.';
                const baseError = validateBase(data.base_shape, data.base_size_mm);
                if (baseError) return baseError;
                if ((data.solid_type === 'cylinder' || data.solid_type === 'cone' || data.solid_type === 'sphere') && data.base_shape !== 'circle') {
                    return `A ${data.solid_type} requires a circular base.`;
                }
                if (data.solid_type === 'cube') {
                    if (data.base_shape !== 'square') return 'A cube requires a square base.';
                    if (Math.abs(data.height_mm - (data.base_size_mm.side_mm || 0)) > 1e-9) {
                        return 'A cube height must equal its base side.';
                    }
                }
                const contact = data.resting_element || (data.resting_face ? 'lateral_face' : undefined);
                if (data.resting_element && data.resting_face) return 'Use resting_element or the legacy resting_face field, not both.';
                if (data.solid_type === 'sphere' && (contact || data.base_orientation || data.inclined_to || data.initial_axis_parallel_to)) {
                    return 'A sphere has no axis, base feature, or discrete resting element to orient.';
                }
                if (contact && data.base_orientation) return 'A contact-resting construction determines its own initial base orientation.';
                if ((contact === 'base_edge' || contact === 'base_corner' || contact === 'lateral_edge' || contact === 'slant_edge' || contact === 'lateral_face') && data.base_shape === 'circle') {
                    return 'A circular base has no polygon edge, corner, or flat lateral face.';
                }
                if (contact === 'lateral_edge' && data.solid_type !== 'prism' && data.solid_type !== 'cube') return 'A lateral-edge resting condition applies to a prism or cube; use generator for a cylinder.';
                if (contact === 'slant_edge' && data.solid_type !== 'pyramid') return 'A slant-edge resting condition applies to a pyramid; use generator for a cone.';
                if (contact === 'generator' && data.solid_type !== 'cone' && data.solid_type !== 'cylinder') return 'A generator resting condition applies only to a cone or cylinder.';
                if (contact === 'base_circle_point' && data.base_shape !== 'circle') return 'A point-of-base-circle resting condition requires a circular base.';
                if (contact === 'base_circle_point' && data.solid_type !== 'cylinder' && data.solid_type !== 'cone') return 'A point-of-base-circle resting condition applies to a cylinder or cone.';
                if (contact === 'lateral_face' && data.solid_type !== 'prism' && data.solid_type !== 'pyramid' && data.solid_type !== 'cube') return 'A flat lateral-face resting condition requires a prism, pyramid, or cube.';
                const contactDeterminesTilt = contact === 'lateral_edge' || contact === 'slant_edge' || contact === 'generator' || contact === 'lateral_face';
                let inclinationToRestingPlane = data.resting_on === 'HP'
                    ? (data.inclined_to === 'HP' ? data.inclination_deg : data.inclination_with_HP_deg)
                    : (data.inclined_to === 'VP' ? data.inclination_deg : data.inclination_with_VP_deg);
                if (data.base_inclination_deg !== undefined && !validAngle(data.base_inclination_deg)) {
                    return `Base inclination to ${data.resting_on} must be between 0° and 90°.`;
                }
                if (data.base_inclination_deg !== undefined && contact !== 'base_edge' && contact !== 'base_corner' && contact !== 'base_circle_point') {
                    return 'A stated base-plane inclination applies when the solid rests on a base edge, base corner, or point of its base circle.';
                }
                if (data.slant_edge_inclination_deg !== undefined && !validAngle(data.slant_edge_inclination_deg)) {
                    return `Slant edge inclination to ${data.resting_on} must be between 0° and 90°.`;
                }
                if (data.slant_edge_inclination_deg !== undefined && data.solid_type !== 'pyramid' && data.solid_type !== 'cone') {
                    return 'A slant edge inclination applies to a pyramid or cone.';
                }
                if (data.slant_edge_inclination_deg !== undefined && contact !== 'base_corner' && contact !== 'base_edge') {
                    return 'A slant edge inclination applies when the pyramid rests on a base corner or base edge.';
                }
                if (data.base_inclination_deg !== undefined && inclinationToRestingPlane !== undefined
                    && Math.abs(data.base_inclination_deg + inclinationToRestingPlane - 90) > 1e-7) {
                    return 'For a right solid, the base-plane and axis inclinations to the same plane must be complementary.';
                }
                if ((contact === 'base_edge' || contact === 'base_corner' || contact === 'base_circle_point')
                    && inclinationToRestingPlane === undefined && data.base_inclination_deg === undefined && data.slant_edge_inclination_deg === undefined) {
                    return `A solid resting on a ${contact.replace(/_/g, ' ')} needs its axis, base, or slant edge inclination to ${data.resting_on}.`;
                }
                if (contact === 'generator' && data.solid_type === 'cylinder' && inclinationToRestingPlane !== undefined) {
                    if (data.resting_on === 'HP') {
                        if (data.inclined_to === 'HP') data.inclination_deg = 0;
                        if (data.inclination_with_HP_deg !== undefined) data.inclination_with_HP_deg = 0;
                    } else {
                        if (data.inclined_to === 'VP') data.inclination_deg = 0;
                        if (data.inclination_with_VP_deg !== undefined) data.inclination_with_VP_deg = 0;
                    }
                    inclinationToRestingPlane = 0;
                }

                if (contactDeterminesTilt && inclinationToRestingPlane !== undefined && Math.abs(inclinationToRestingPlane) > 1e-9) {
                    return `The ${contact.replace(/_/g, ' ')} contact already determines the axis inclination to ${data.resting_on}.`;
                }
                const orientationError = validateBaseOrientation(data.base_shape, data.resting_on, data.base_orientation, !!contact);
                if (orientationError) return orientationError;
                if (!contact && data.inclined_to && data.inclined_to !== 'HP_VP' && data.inclined_to !== data.resting_on) {
                    return `A solid initially resting on ${data.resting_on} needs the complementary axis inclination or a resting-face/edge condition before it can be inclined only to ${data.inclined_to}.`;
                }
                if (data.inclined_to === 'HP_VP') {
                    if (data.inclination_with_HP_deg === undefined || data.inclination_with_VP_deg === undefined) {
                        return 'Both HP and VP inclinations are required for a doubly inclined solid.';
                    }
                    return validateTwoPlaneAngles(data.inclination_with_HP_deg, data.inclination_with_VP_deg);
                }
                if (data.inclined_to && !validAngle(data.inclination_deg)) return 'Solid inclination must be between 0° and 90°.';
                return null;
            }
            case 'section_solid': {
                if (!positive(data.axis_length_mm)) return 'Solid axis length must be positive.';
                const baseError = validateBase(data.base_shape, data.base_size_mm);
                if (baseError) return baseError;
                const orientationError = validateBaseOrientation(data.base_shape, data.resting_on, data.base_orientation);
                if (orientationError) return orientationError;
                const cutAngle = data.cutting_plane.perpendicular_to === 'VP'
                    ? data.cutting_plane.inclination_with_HP_deg
                    : (data.cutting_plane.inclination_with_VP_deg ?? data.cutting_plane.inclination_with_HP_deg);
                if (!validAngle(cutAngle)) return 'Provide the cutting-plane inclination to the plane it is not perpendicular to, between 0° and 90°.';
                const isLongitudinal = data.resting_on === data.cutting_plane.perpendicular_to;
                const passage = data.cutting_plane.passes_through;
                if (isLongitudinal) {
                    if (data.draw_development) return 'Development after a longitudinal cut is not represented by the current lateral-development method.';
                    if (typeof passage === 'object' && 'distance_from_base_mm' in passage) {
                        return 'A longitudinal plane needs an axis or distance-from-axis location, not a distance from the base.';
                    }
                    if (typeof passage === 'object' && 'distance_from_axis_mm' in passage) {
                        const limit = baseBoundingRadius(data.base_shape, data.base_size_mm);
                        if (!nonnegative(passage.distance_from_axis_mm) || passage.distance_from_axis_mm >= limit) {
                            return 'Longitudinal cutting-plane offset must intersect the solid base.';
                        }
                    }
                    if (typeof passage === 'object' && 'distance_from_base_corner_mm' in passage) {
                        if (data.base_shape === 'circle') return 'A circular base has no named base corner for locating a cutting plane.';
                        const limit = 2 * baseBoundingRadius(data.base_shape, data.base_size_mm);
                        if (!positive(passage.distance_from_base_corner_mm) || passage.distance_from_base_corner_mm >= limit) {
                            return 'Distance from the named base corner must place the longitudinal cutting plane inside the solid base.';
                        }
                        const validCorner = data.resting_on === 'HP'
                            ? passage.corner === 'front' || passage.corner === 'behind'
                            : passage.corner === 'above' || passage.corner === 'below';
                        if (!validCorner) {
                            return `For a solid resting on ${data.resting_on}, locate the base corner as ${data.resting_on === 'HP' ? 'front or behind' : 'above or below'}.`;
                        }
                    }
                    const retained = data.cutting_plane.retained_portion;
                    if (retained === 'below_cutting_plane' || retained === 'above_cutting_plane') {
                        return 'A longitudinal section needs a spatial retained side, not an above/below-cutting-plane portion.';
                    }
                    if (data.resting_on === 'HP' && (retained === 'above' || retained === 'below')) {
                        return 'A longitudinal section of a solid resting on HP retains the front or behind portion.';
                    }
                    if (data.resting_on === 'VP' && (retained === 'front' || retained === 'behind')) {
                        return 'A longitudinal section of a solid resting on VP retains the above or below portion.';
                    }
                    return null;
                }
                if (passage === 'axis' || (typeof passage === 'object' && ('distance_from_axis_mm' in passage || 'distance_from_base_corner_mm' in passage))) {
                    return 'A transverse section needs an axis height or distance from the base.';
                }
                if (data.cutting_plane.retained_portion === 'front' || data.cutting_plane.retained_portion === 'behind'
                    || data.cutting_plane.retained_portion === 'above' || data.cutting_plane.retained_portion === 'below') {
                    return 'A transverse section retains the above- or below-cutting-plane portion.';
                }
                if (typeof passage !== 'string') {
                    const offset = passage.distance_from_base_mm;
                    if (!nonnegative(offset) || offset > data.axis_length_mm) return 'Cutting-plane offset must lie on the solid axis.';
                }
                return null;
            }
            case 'plane_surface': {
                const size = data.size_mm;
                if (data.shape === 'circle' && !positive(size.diameter_mm)) return 'A circular lamina requires a positive diameter.';
                if (data.shape === 'rectangle' && (!positive(size.length_mm) || !positive(size.breadth_mm))) return 'A rectangular lamina requires positive length and breadth.';
                if (data.shape === 'set_square_30_60' && !positive(size.hypotenuse_mm)) return 'A 30°–60° set-square requires a positive hypotenuse length.';
                if (data.shape !== 'circle' && data.shape !== 'rectangle' && data.shape !== 'set_square_30_60' && !positive(size.side_mm)) {
                    return `A ${data.shape} lamina requires a positive side length.`;
                }
                const hp = data.orientation.inclination_with_HP_deg;
                const vp = data.orientation.inclination_with_VP_deg;
                if (hp !== undefined && !validAngle(hp)) return 'Plane-surface inclination to HP must be between 0° and 90°.';
                if (vp !== undefined && !validAngle(vp)) return 'Plane-surface inclination to VP must be between 0° and 90°.';
                const feature = data.orientation.reference_feature;
                if (hp === undefined && vp === undefined) return 'Provide at least one plane-surface inclination.';
                if (!feature?.contact_plane && (hp === undefined || vp === undefined)) {
                    if (!(hp === 0 && vp === undefined) && !(vp === 0 && hp === undefined)) {
                        return 'An oblique plane needs both HP and VP inclinations unless a reference edge contact determines its position.';
                    }
                }
                if (hp !== undefined && vp !== undefined
                    && Math.cos(this.degToRad(hp)) ** 2 + Math.cos(this.degToRad(vp)) ** 2 > 1 + 1e-8) {
                    return 'The supplied HP and VP inclinations cannot belong to the same plane surface.';
                }
                if (feature) {
                    if ((feature.feature === 'longer_side' || feature.feature === 'shorter_side') && data.shape !== 'rectangle') return 'Longer/shorter-side reference applies only to a rectangular lamina.';
                    if (feature.feature === 'hypotenuse' && data.shape !== 'set_square_30_60') return 'Hypotenuse reference applies only to a set-square.';
                    if (feature.feature === 'diagonal' && (data.shape === 'triangle' || data.shape === 'circle' || data.shape === 'set_square_30_60')) return 'The selected lamina has no applicable polygon diagonal.';
                    if (data.shape === 'circle' && feature.feature !== 'side') return 'A circular lamina can reference only a diameter direction.';
                    if (feature.angle_to_other_plane_deg !== undefined && !validAngle(feature.angle_to_other_plane_deg)) return 'Reference-feature inclination must be between 0° and 90°.';
                    if (feature.contact_plane === 'HP' && hp === undefined) return 'A reference feature on HP requires the surface inclination to HP.';
                    if (feature.contact_plane === 'VP' && vp === undefined) return 'A reference feature on VP requires the surface inclination to VP.';
                    if (feature.contact_plane === 'BOTH' && (hp === undefined || vp === undefined)) return 'A feature on both reference planes requires both surface inclinations.';
                }
                if (data.center?.distance_from_HP_mm !== undefined && !nonnegative(data.center.distance_from_HP_mm)) return 'Plane-surface distance from HP must be non-negative.';
                if (data.center?.distance_from_VP_mm !== undefined && !nonnegative(data.center.distance_from_VP_mm)) return 'Plane-surface distance from VP must be non-negative.';
                if (data.opening) {
                    const diameter = data.opening.diameter_mm ?? (data.opening.radius_mm !== undefined ? 2 * data.opening.radius_mm : undefined);
                    if (!positive(diameter)) return 'A lamina opening requires a positive diameter or radius.';
                }
                return null;
            }
            case 'perspective_projection': {
                if (!positive(data.station_point.distance_in_front_of_PP_mm)) return 'Station-point distance in front of PP must be positive.';
                if (!positive(data.station_point.height_above_GP_mm)) return 'Station-point height above GP must be positive.';
                if (!nonnegative(data.placement.nearest_distance_from_PP_mm)) return 'Object distance from PP must be non-negative.';
                if (!nonnegative(data.placement.ground_clearance_mm ?? 0)) return 'Object ground clearance must be non-negative.';
                if (data.placement.position_relative_to_PP === 'touching' && Math.abs(data.placement.nearest_distance_from_PP_mm) > 1e-9) {
                    return 'An object touching PP must have zero distance from PP.';
                }
                if (data.placement.position_relative_to_PP === 'in_front'
                    && data.placement.nearest_distance_from_PP_mm >= data.station_point.distance_in_front_of_PP_mm) {
                    return 'An object in front of PP must remain between PP and the station point.';
                }
                if (data.object.kind === 'line') {
                    if (!positive(data.object.length_mm) || !nonnegative(data.object.height_above_GP_mm)) return 'Perspective line length must be positive and its height non-negative.';
                    if (!validAngle(data.object.angle_to_PP_deg) || !validAngle(data.object.inclination_to_GP_deg ?? 0)) return 'Perspective line inclinations must be between 0° and 90°.';
                } else if (data.object.kind === 'block_model') {
                    if (data.object.primitives.length === 0) return 'A perspective block model needs at least one primitive.';
                    for (const primitive of data.object.primitives) {
                        if (primitive.primitive === 'box' || primitive.primitive === 'wedge') {
                            if (!positive(primitive.size_mm.x) || !positive(primitive.size_mm.y) || !positive(primitive.size_mm.z)) return 'Block and wedge dimensions must be positive.';
                        } else if (primitive.primitive === 'cylinder') {
                            if (!positive(primitive.diameter_mm) || !positive(primitive.length_mm)) return 'Cylinder diameter and length must be positive.';
                            if (primitive.inner_diameter_mm !== undefined && (!positive(primitive.inner_diameter_mm) || primitive.inner_diameter_mm >= primitive.diameter_mm)) return 'Cylinder inner diameter must be positive and smaller than its outer diameter.';
                        } else {
                            if (!positive(primitive.length_mm) || !positive(primitive.width_mm) || !positive(primitive.depth_mm) || primitive.length_mm < primitive.width_mm) return 'A slot needs positive length, width, and depth, with length at least equal to width.';
                            if (primitive.normal_axis === primitive.long_axis) return 'A slot normal and long axis must be different.';
                        }
                    }
                } else {
                    const size = data.object.kind === 'lamina' ? data.object.size_mm : data.object.base_size_mm;
                    const shape = data.object.kind === 'lamina' ? data.object.shape : data.object.base_shape;
                    const sizeError = validateBase(shape, size);
                    if (sizeError) return sizeError;
                    if (data.object.kind === 'lamina') {
                        if (!validAngle(data.object.angle_to_PP_deg ?? 0)) return 'Lamina angle to PP must be between 0° and 90°.';
                    } else {
                        if (!positive(data.object.height_mm)) return 'Perspective solid height must be positive.';
                        if (!validAngle(data.object.base_edge_angle_to_PP_deg ?? 0)) return 'Base-edge angle to PP must be between 0° and 90°.';
                        if ((data.object.solid_type === 'cylinder' || data.object.solid_type === 'cone') && data.object.base_shape !== 'circle') return `A ${data.object.solid_type} needs a circular base.`;
                        if (data.object.solid_type === 'cube') {
                            if (data.object.base_shape !== 'square') return 'A cube needs a square base.';
                            if (Math.abs(data.object.height_mm - (data.object.base_size_mm.side_mm || 0)) > 1e-9) return 'Cube height must equal its side.';
                        }
                    }
                }
                return null;
            }
            case 'isometric_projection': {
                const object = data.object;
                if (object.kind === 'lamina') return validateBase(object.shape, object.size_mm);
                if (object.kind === 'solid') {
                    const baseError = validateBase(object.base_shape, object.base_size_mm);
                    if (baseError) return baseError;
                    if (!positive(object.height_mm)) return 'Isometric solid height or axis length must be positive.';
                    if ((object.solid_type === 'cylinder' || object.solid_type === 'cone' || object.solid_type === 'sphere' || object.solid_type === 'hemisphere') && object.base_shape !== 'circle') return `A ${object.solid_type} needs a circular base.`;
                    if (object.solid_type === 'cube' && (object.base_shape !== 'square' || Math.abs(object.height_mm - (object.base_size_mm.side_mm || 0)) > 1e-9)) return 'An isometric cube needs a square base with side equal to height.';
                    if (object.solid_type === 'frustum') {
                        if (!object.top_base_size_mm) return 'An isometric frustum requires its top-base size.';
                        const topError = validateBase(object.base_shape, object.top_base_size_mm);
                        if (topError) return `Invalid frustum top base: ${topError}`;
                    }
                    if (object.axis_orientation && !validAngle(object.axis_orientation.inclination_to_HP_deg)) return 'Axis inclination to HP must be between 0° and 90°.';
                    if (object.top_cut) {
                        if (!positive(object.top_cut.height_at_center_mm) || !validAngle(object.top_cut.inclination_deg) || object.top_cut.inclination_deg >= 90) return 'Top-cut height must be positive and inclination below 90°.';
                        if (object.solid_type !== 'prism' && object.solid_type !== 'cylinder' && object.solid_type !== 'cube') return 'An oblique top cut is currently defined for prisms, cubes, and cylinders.';
                    }
                    return null;
                }
                if (object.kind === 'composite') {
                    if (object.solids.length < 2) return 'An isometric composite needs at least two members.';
                    for (const member of object.solids) {
                        if (!positive(member.base_size_mm.diameter_mm || member.base_size_mm.side_mm || member.base_size_mm.length_mm)) return 'Every isometric composite member needs a positive base size.';
                        if (member.solid_type !== 'sphere' && member.solid_type !== 'hemisphere' && !positive(member.height_mm)) return 'Every non-spherical isometric member needs a positive height.';
                        if (member.solid_type === 'frustum' && !member.top_base_size_mm) return 'Every isometric frustum member needs a top-base size.';
                    }
                    return null;
                }
                if (object.primitives.length === 0) return 'An isometric block model needs at least one primitive.';
                for (const primitive of object.primitives) {
                    if (primitive.primitive === 'box' || primitive.primitive === 'wedge') {
                        if (!positive(primitive.size_mm.x) || !positive(primitive.size_mm.y) || !positive(primitive.size_mm.z)) return 'Block and wedge dimensions must be positive.';
                        if (primitive.primitive === 'box' && primitive.top_hole && (!positive(primitive.top_hole.diameter_mm) || primitive.top_hole.diameter_mm >= Math.min(primitive.size_mm.x, primitive.size_mm.y))) return 'A top hole must fit inside its box face.';
                    } else if (primitive.primitive === 'cylinder') {
                        if (!positive(primitive.diameter_mm) || !positive(primitive.length_mm)) return 'Cylinder diameter and length must be positive.';
                        if (primitive.inner_diameter_mm !== undefined && (!positive(primitive.inner_diameter_mm) || primitive.inner_diameter_mm >= primitive.diameter_mm)) return 'Cylinder inner diameter must be positive and smaller than its outer diameter.';
                    } else {
                        if (!positive(primitive.length_mm) || !positive(primitive.width_mm) || !positive(primitive.depth_mm) || primitive.length_mm < primitive.width_mm) return 'A slot needs positive length, width, and depth, with length at least equal to width.';
                        if (primitive.normal_axis === primitive.long_axis) return 'A slot normal and long axis must be different.';
                    }
                }
                return null;
            }
            case 'advanced_development': {
                const problem = data.problem;
                if (problem.family === 'shortest_path') {
                    if (!positive(problem.height_mm)) return 'Developed-surface height must be positive.';
                    const baseError = validateBase(problem.base_shape, problem.base_size_mm);
                    if (baseError) return baseError;
                    if (problem.surface === 'cylinder' && problem.base_shape !== 'circle') return 'A cylindrical shortest-path problem needs a circular base.';
                    if (problem.surface === 'prism' && problem.base_shape === 'circle') return 'A prismatic shortest-path problem needs a polygonal base.';
                    if (![problem.start.perimeter_fraction, problem.end.perimeter_fraction].every(value => Number.isFinite(value) && value >= 0 && value <= 1)) return 'Shortest-path perimeter fractions must lie between 0 and 1.';
                    if (problem.turns !== undefined && (!positive(problem.turns) || !Number.isInteger(problem.turns))) return 'Shortest-path turns must be a positive whole number.';
                    return null;
                }
                if (problem.family === 'sphere') {
                    if (!positive(problem.diameter_mm)) return 'Sphere diameter must be positive.';
                    if (problem.divisions !== undefined && (!Number.isInteger(problem.divisions) || problem.divisions < 4 || problem.divisions > 36)) return 'Sphere development divisions must be a whole number from 4 to 36.';
                    return null;
                }
                if (problem.family === 'transition') {
                    if (!positive(problem.height_mm)) return 'Transition-piece height must be positive.';
                    const endSize = (end: typeof problem.bottom) => end.shape === 'circle'
                        ? positive(end.diameter_mm)
                        : end.shape === 'square'
                            ? positive(end.side_mm)
                            : positive(end.length_mm) && positive(end.breadth_mm);
                    if (!endSize(problem.bottom) || !endSize(problem.top)) return 'Both transition ends need positive dimensions for their shapes.';
                    if (problem.bottom.shape === problem.top.shape && JSON.stringify(problem.bottom) === JSON.stringify(problem.top) && !problem.offset_mm) return 'Identical coaxial ends do not form a transition piece.';
                    return null;
                }
                if (problem.family === 'reverse_cone') {
                    if (!positive(problem.sector_radius_mm) || !positive(problem.sector_angle_deg) || problem.sector_angle_deg > 360) return 'Reverse-cone sector radius must be positive and its angle must be within 0°–360°.';
                    const baseRadius = problem.sector_radius_mm * problem.sector_angle_deg / 360;
                    if (baseRadius >= problem.sector_radius_mm - 1e-9) return 'A full-circle sector cannot form a finite right cone.';
                    return problem.vertex_height_above_HP_mm === undefined || nonnegative(problem.vertex_height_above_HP_mm) ? null : 'Cone vertex height above HP must be non-negative.';
                }
                if (problem.family === 'penetration') {
                    if (!positive(problem.height_mm)) return 'Penetrated solid height must be positive.';
                    const baseError = validateBase(problem.base_shape, problem.base_size_mm);
                    if (baseError) return baseError;
                    if ((problem.host === 'cylinder' || problem.host === 'cone') && problem.base_shape !== 'circle') return `A ${problem.host} needs a circular base.`;
                    if ((problem.host === 'prism' || problem.host === 'pyramid') && problem.base_shape === 'circle') return `A ${problem.host} needs a polygonal base.`;
                    if (!positive(problem.opening.width_mm) || !nonnegative(problem.opening.center_height_mm) || problem.opening.center_height_mm > problem.height_mm) return 'Opening width must be positive and its center height must lie on the host.';
                    if (problem.opening.shape === 'slot' && (!positive(problem.opening.length_mm) || (problem.opening.length_mm || 0) < problem.opening.width_mm)) return 'A slot length must be at least its width.';
                    return null;
                }
                if (problem.family === 'compound_half_solids') {
                    if (problem.members.length < 2) return 'A compound half-solid development needs at least two members.';
                    for (const member of problem.members) {
                        if (!positive(member.height_mm)) return 'Every compound half-solid member needs a positive height.';
                        const baseError = validateBase(member.base_shape, member.base_size_mm);
                        if (baseError) return baseError;
                        if ((member.surface === 'half_cone' || member.surface === 'half_cylinder') && member.base_shape !== 'circle') return `${member.surface.replace('_', ' ')} needs a circular base.`;
                    }
                    return null;
                }
                if (![problem.bottom_length_mm, problem.bottom_breadth_mm, problem.top_length_mm, problem.top_breadth_mm, problem.height_mm].every(positive)) return 'Tray dimensions must all be positive.';
                if (problem.top_length_mm < problem.bottom_length_mm || problem.top_breadth_mm < problem.bottom_breadth_mm) return 'The scanned tray family requires the open top to be at least as large as the bottom.';
                return null;
            }
            case 'advanced_section': {
                const solid = data.solid;
                if (!positive(solid.axis_length_mm)) return 'Advanced-section axis length must be positive.';
                const baseError = validateBase(solid.base_shape, solid.base_size_mm);
                if (baseError) return baseError;
                if ((solid.solid_type === 'cylinder' || solid.solid_type === 'cone') && solid.base_shape !== 'circle') return `A ${solid.solid_type} needs a circular base.`;
                if (solid.solid_type === 'tetrahedron' && solid.base_shape !== 'triangle') return 'A tetrahedron needs a triangular base.';
                if (data.cutting_plane.inclination_deg === undefined) {
                    if (!data.inverse_section || solid.solid_type !== 'cone' || !['ellipse', 'parabola', 'hyperbola'].includes(data.inverse_section.true_shape)) return 'Provide the cutting-plane inclination, or a solvable inverse conic section of a cone.';
                    if (data.inverse_section.true_shape !== 'parabola' && (!positive(data.inverse_section.major_axis_mm) || !positive(data.inverse_section.minor_axis_mm))) return 'An inverse ellipse or hyperbola needs positive major and minor axes.';
                } else if (!validAngle(data.cutting_plane.inclination_deg)) return 'Cutting-plane inclination must be between 0Â° and 90Â°.';
                if (!nonnegative(data.cutting_plane.distance_from_base_mm) || data.cutting_plane.distance_from_base_mm > solid.axis_length_mm) return 'Cutting-plane axis location must lie between the base and apex/top.';
                const hp = data.orientation?.axis_inclination_to_HP_deg;
                const vp = data.orientation?.axis_inclination_to_VP_deg;
                if (hp !== undefined && !validAngle(hp)) return 'Axis inclination to HP must be between 0Â° and 90Â°.';
                if (vp !== undefined && !validAngle(vp)) return 'Axis inclination to VP must be between 0Â° and 90Â°.';
                if (hp !== undefined && vp !== undefined) {
                    const angleError = validateTwoPlaneAngles(hp, vp);
                    if (angleError) return angleError;
                }
                if (data.inverse_section) {
                    if (data.inverse_section.major_axis_mm !== undefined && !positive(data.inverse_section.major_axis_mm)) return 'Inverse-section major axis must be positive.';
                    if (data.inverse_section.minor_axis_mm !== undefined && !positive(data.inverse_section.minor_axis_mm)) return 'Inverse-section minor axis must be positive.';
                }
                return null;
            }
            case 'composite_solid': {
                const members = data.solids?.length
                    ? data.solids
                    : data.base_solid && data.top_solid
                        ? [data.base_solid, data.top_solid]
                        : [];
                if (members.length < 2) return 'A composite solid needs at least two bottom-to-top solid members.';
                if (!(data.resting_on || data.base_solid?.resting_on)) return 'Specify whether the composite stack rests on HP or VP.';
                for (let index = 0; index < members.length; index++) {
                    const member = members[index];
                    if (index > 0 && member.placed_centrally === false) return 'Every upper member in the current composite model must be placed centrally.';
                    if (member.solid_type === 'sphere' || member.solid_type === 'hemisphere') {
                        if (!positive(member.base_size_mm.diameter_mm)) return `Composite ${member.solid_type} member ${index + 1} requires a positive diameter.`;
                        if (member.solid_type === 'hemisphere' && !member.hemisphere_orientation) {
                            return `Composite hemisphere member ${index + 1} needs flat_face_up or flat_face_down orientation.`;
                        }
                    } else {
                        if (!positive(member.height_mm)) return `Composite member ${index + 1} height must be positive.`;
                        if (!member.base_shape) return `Composite member ${index + 1} requires a base shape.`;
                        const memberError = validateBase(member.base_shape, member.base_size_mm);
                        if (memberError) return memberError;
                        if (member.solid_type === 'frustum') {
                            if (!member.top_base_size_mm) return `Composite frustum member ${index + 1} requires its top-base size.`;
                            const topError = validateBase(member.base_shape, member.top_base_size_mm);
                            if (topError) return `Composite frustum member ${index + 1} top: ${topError}`;
                            const bottomRadius = baseBoundingRadius(member.base_shape, member.base_size_mm);
                            const topRadius = baseBoundingRadius(member.base_shape, member.top_base_size_mm);
                            if (topRadius >= bottomRadius) return `Composite frustum member ${index + 1} top base must be smaller than its bottom base.`;
                        } else if (member.top_base_size_mm) {
                            return `Composite member ${index + 1} has a top-base size but is not a frustum.`;
                        }
                        if (member.solid_type === 'cube' && (member.base_shape !== 'square' || Math.abs((member.height_mm || 0) - (member.base_size_mm.side_mm || 0)) > 1e-9)) {
                            return `Composite cube member ${index + 1} must have equal side and height.`;
                        }
                    }
                }
                return null;
            }
        }
    }

    private addXYLine() {
        this.primitives.push({ type: 'line', key: 'xy-line', points: [0, this.XY_LINE_Y, GeometryEngine.VIEW_WIDTH, this.XY_LINE_Y], dashed: false, color: 'black', step: 0, primitiveRole: 'plane' });
        this.primitives.push({ type: 'text', key: 'x-label', x: 5, y: this.XY_LINE_Y - 10, content: 'X', step: 0, primitiveRole: 'label', fontSize: 13, fontWeight: 'bold' });
        this.primitives.push({ type: 'text', key: 'y-label', x: GeometryEngine.VIEW_WIDTH - 15, y: this.XY_LINE_Y - 10, content: 'Y', step: 0, primitiveRole: 'label', fontSize: 13, fontWeight: 'bold' });
        this.primitives.push({ type: 'text', key: 'vp-label', x: 15, y: this.XY_LINE_Y - 15, content: 'VP', step: 0, color: '#5f6368', primitiveRole: 'caption', fontSize: 13, fontWeight: 'bold' });
        this.primitives.push({ type: 'text', key: 'hp-label', x: 15, y: this.XY_LINE_Y + 20, content: 'HP', step: 0, color: '#5f6368', primitiveRole: 'caption', fontSize: 13, fontWeight: 'bold' });
    }

    public generateGeometry(data: EngineeringProblem): GeometryOutput {
        this.primitives = [];
        if (!('type' in data) || (data.type !== 'perspective_projection' && data.type !== 'isometric_projection')) this.addXYLine();
        
        if('error' in data) {
            return { type: 'error', constructionPrimitives: [], finalGeometry: null, error: data.error };
        }

        // Normalize body/solid diagonal constraint into mathematically derived axis inclination on a base corner
        if (data.type === 'solid' && data.base_orientation?.feature === 'body_diagonal') {
            let face_diagonal = 0;
            if (data.base_shape === 'rectangle') {
                face_diagonal = Math.hypot(data.base_size_mm.length_mm || 0, data.base_size_mm.breadth_mm || 0);
            } else if (data.base_shape === 'square' || data.solid_type === 'cube') {
                face_diagonal = (data.base_size_mm.side_mm || 0) * Math.SQRT2;
            } else if (data.base_shape === 'hexagon') {
                face_diagonal = (data.base_size_mm.side_mm || 0) * 2;
            }
            const h = data.solid_type === 'cube' ? (data.base_size_mm.side_mm || 0) : (data.height_mm || 0);
            if (h > 0 && face_diagonal > 0) {
                const inclination_deg = 90 - (Math.atan(face_diagonal / h) * 180 / Math.PI);
                data = {
                    ...data,
                    height_mm: h,
                    inclination_with_HP_deg: inclination_deg,
                    inclination_deg,
                    inclined_to: 'HP',
                    resting_element: 'base_corner',
                    base_orientation: undefined
                };
            }
        }

        const validationError = this.validateProblem(data);
        if (validationError) {
            return { type: data.type, constructionPrimitives: this.primitives, finalGeometry: null, error: validationError, params: data };
        }

        let lineProperties: LineProperties | undefined;

        switch (data.type) {
            case 'auxiliary_view':
                this.projectAuxiliaryView(data as AuxiliaryViewSchema);
                break;
            case 'point':
            case 'point_special':
                this.projectPoint(data);
                break;
            case 'line_parallel':
                lineProperties = this.projectLineParallel(data);
                break;
            case 'line_inclined_HP':
                 lineProperties = this.projectLineInclinedHP(data);
                 break;
            case 'line_inclined_VP':
                 lineProperties = this.projectLineInclinedVP(data);
                 break;
             case 'line_inclined_both':
                 lineProperties = this.projectLineInclinedBoth(data);
                 break;
            case 'line_one_end_HP':
                lineProperties = this.projectLineOneEndHP(data);
                break;
            case 'line_one_end_VP':
                lineProperties = this.projectLineOneEndVP(data);
                break;
            case 'line_coplanar':
                lineProperties = this.projectLineCoplanar(data);
                break;
            case 'line_touching_XY':
                lineProperties = this.projectLineTouchingXY(data);
                break;
            case 'solid':
                 this.projectSolid(data);
                 break;
            case 'section_solid':
                 this.projectSectionedSolid(data);
                 break;
            case 'plane_surface':
                 this.projectPlaneSurface(data);
                 break;
            case 'perspective_projection':
                 this.projectPerspectiveProjection(data);
                 break;
            case 'isometric_projection':
                 this.projectIsometricProjection(data);
                 break;
            case 'advanced_development':
                 this.projectAdvancedDevelopment(data);
                 break;
            case 'advanced_section':
                 this.projectAdvancedSection(data);
                 break;
            case 'composite_solid':
                 this.projectCompositeSolid(data);
                 break;
            default:
                return { type: 'unknown', constructionPrimitives: this.primitives, finalGeometry: null, error: "This problem type is not yet supported by the geometry engine." };
        }

        // Post-processing: move dimensions to the final construction stage.  The
        // isometric textbook sequence already defines Step IV as the completed,
        // dimensioned view, so it must not gain a separate hidden Step V.
        const nonDimPrimitives = this.primitives.filter(p => !p.key.startsWith('dim-'));
        const maxStep = Math.max(...nonDimPrimitives.map(p => p.step || 0));
        const dimStep = maxStep + 1;
        
        for (const p of this.primitives) {
            if (p.key.startsWith('dim-')) {
                p.step = dimStep;
            }
            if (p.type === 'line' || p.type === 'circle' || p.type === 'path') {
                if (!p.primitiveRole) {
                    p.primitiveRole = this.getPrimitiveRole(p);
                }
                if (p.primitiveRole === 'axis') {
                    p.lineStyle = 'chain';
                } else if (p.primitiveRole === 'hidden') {
                    p.lineStyle = 'dashed';
                } else if (p.dashed && !p.lineStyle) {
                    p.lineStyle = 'dashed';
                }
            } else if (!p.primitiveRole) {
                p.primitiveRole = this.getPrimitiveRole(p);
            }
        }

        this.primitives = this.primitives
            .map((primitive, index) => ({ primitive, index }))
            .sort((left, right) => {
                const leftStep = left.primitive.step || 0;
                const rightStep = right.primitive.step || 0;
                if (leftStep !== rightStep) {
                    return leftStep - rightStep;
                }
                return left.index - right.index;
            })
            .map(({ primitive }, index) => ({
                ...primitive,
                sequence: index,
            }));

        return { type: data.type, constructionPrimitives: this.primitives, finalGeometry: null, lineProperties, params: data };
    }
    
    private projectPoint(data: PointSchema | PointSpecialSchema) {
        let d_hp = 0;
        let d_vp = 0;
        let hpSide: 1 | -1 = 1; // +1 is above HP; -1 is below HP
        let vpSide: 1 | -1 = 1; // +1 is in front of VP; -1 is behind VP
        const name = data.name;

        if (data.type === 'point') {
            d_hp = data.position.distance_from_HP_mm;
            d_vp = data.position.distance_from_VP_mm;
            if (data.position.plane === 'SECOND_QUADRANT') vpSide = -1;
            if (data.position.plane === 'THIRD_QUADRANT') {
                hpSide = -1;
                vpSide = -1;
            }
            if (data.position.plane === 'FOURTH_QUADRANT') hpSide = -1;
        } else { // point_special
            if (data.position === 'ON_HP') d_vp = data.distance_mm;
            if (data.position === 'ON_VP') d_hp = data.distance_mm;
        }

        const p_prime_y = this.XY_LINE_Y - (hpSide * d_hp * this.SCALE);
        const p_y = this.XY_LINE_Y + (vpSide * d_vp * this.SCALE);

        this.primitives.push({ type: 'text', key: `p-prime-label`, x: this.ORIGIN_X + 5, y: p_prime_y, content: `${name.toLowerCase()}'`, step: 1 });
        this.primitives.push({ type: 'text', key: `p-label`, x: this.ORIGIN_X + 5, y: p_y, content: `${name.toLowerCase()}`, step: 1 });
        this.primitives.push({ type: 'circle', key: 'p-prime-marker', cx: this.ORIGIN_X, cy: p_prime_y, r: 2.5, dashed: false, step: 1, color: '#004d40', primitiveRole: 'visible' });
        if (Math.abs(p_y - p_prime_y) > 0.01) {
            this.primitives.push({ type: 'circle', key: 'p-marker', cx: this.ORIGIN_X, cy: p_y, r: 2.5, dashed: false, step: 1, color: '#004d40', primitiveRole: 'visible' });
        }
        this.primitives.push({ type: 'line', key: 'projector', points: [this.ORIGIN_X, p_prime_y, this.ORIGIN_X, p_y], dashed: true, step: 2 });
        
        if (d_hp > 0) {
             this.primitives.push({ type: 'line', key: 'dim-hp', points: [this.ORIGIN_X + 20, this.XY_LINE_Y, this.ORIGIN_X + 20, p_prime_y], dashed: false, step: 2, color: 'grey' });
             this.primitives.push({ type: 'text', key: 'dim-hp-text', x: this.ORIGIN_X + 25, y: (this.XY_LINE_Y + p_prime_y) / 2, content: this.formatLengthLabel(d_hp), step: 2, color: '#202124', primitiveRole: 'dimension', fontSize: 12 });
        }
         if (d_vp > 0) {
             this.primitives.push({ type: 'line', key: 'dim-vp', points: [this.ORIGIN_X + 20, this.XY_LINE_Y, this.ORIGIN_X + 20, p_y], dashed: false, step: 2, color: 'grey' });
             this.primitives.push({ type: 'text', key: 'dim-vp-text', x: this.ORIGIN_X + 25, y: (this.XY_LINE_Y + p_y) / 2, content: this.formatLengthLabel(d_vp), step: 2, color: '#202124', primitiveRole: 'dimension', fontSize: 12 });
        }
    }

    private getLineDirectionSigns(data: LineTeachingOptions) {
        return {
            x: data.direction?.x === 'left' ? -1 : 1,
            hp: data.direction?.hp === 'down' ? -1 : 1,
            vp: data.direction?.vp === 'back' ? -1 : 1,
        } as const;
    }

    private getLineEndpointSideSigns(end: {
        side_of_HP?: 'above' | 'below';
        side_of_VP?: 'in_front' | 'behind';
    }) {
        return {
            hp: end.side_of_HP === 'below' ? -1 : 1,
            vp: end.side_of_VP === 'behind' ? -1 : 1,
        } as const;
    }

    private addLineTraces(
        aPrime: PointCoords,
        bPrime: PointCoords,
        a: PointCoords,
        b: PointCoords,
        enabled: boolean | undefined,
        step: number,
    ) {
        if (!enabled) return;
        const epsilon = 1e-9;
        const unavailable: string[] = [];
        const addExtension = (key: string, p1: PointCoords, p2: PointCoords, t: number) => {
            if (t >= 0 && t <= 1) return;
            const endpoint = t < 0 ? p1 : p2;
            this.primitives.push({
                type: 'line', key, points: [endpoint.x, endpoint.y, p1.x + t * (p2.x - p1.x), p1.y + t * (p2.y - p1.y)],
                dashed: true, color: '#9e9e9e', step, primitiveRole: 'construction',
            });
        };

        const fvDeltaY = bPrime.y - aPrime.y;
        if (Math.abs(fvDeltaY) > epsilon) {
            const t = (this.XY_LINE_Y - aPrime.y) / fvDeltaY;
            const hPrime = { x: aPrime.x + t * (bPrime.x - aPrime.x), y: this.XY_LINE_Y };
            const h = { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) };
            addExtension('trace-ht-fv-extension', aPrime, bPrime, t);
            addExtension('trace-ht-tv-extension', a, b, t);
            this.primitives.push({ type: 'line', key: 'trace-ht-projector', points: [hPrime.x, hPrime.y, h.x, h.y], dashed: true, color: '#7e57c2', step, primitiveRole: 'projection' });
            this.primitives.push({ type: 'circle', key: 'trace-ht-marker', cx: h.x, cy: h.y, r: 3, dashed: false, color: '#7e57c2', step, primitiveRole: 'visible' });
            this.primitives.push({ type: 'text', key: 'trace-ht-label', x: h.x + 6, y: h.y - 5, content: 'h', color: '#5e35b1', step, primitiveRole: 'label' });
            this.primitives.push({ type: 'text', key: 'trace-ht-prime-label', x: hPrime.x + 6, y: hPrime.y - 5, content: "h'", color: '#5e35b1', step, primitiveRole: 'label' });
        } else {
            unavailable.push(Math.abs(aPrime.y - this.XY_LINE_Y) <= epsilon
                ? 'Line lies in HP (HT not unique)'
                : 'HT at infinity (line ∥ HP)');
        }

        const tvDeltaY = b.y - a.y;
        if (Math.abs(tvDeltaY) > epsilon) {
            const t = (this.XY_LINE_Y - a.y) / tvDeltaY;
            const v = { x: a.x + t * (b.x - a.x), y: this.XY_LINE_Y };
            const vPrime = { x: aPrime.x + t * (bPrime.x - aPrime.x), y: aPrime.y + t * (bPrime.y - aPrime.y) };
            addExtension('trace-vt-tv-extension', a, b, t);
            addExtension('trace-vt-fv-extension', aPrime, bPrime, t);
            this.primitives.push({ type: 'line', key: 'trace-vt-projector', points: [vPrime.x, vPrime.y, v.x, v.y], dashed: true, color: '#ef6c00', step, primitiveRole: 'projection' });
            this.primitives.push({ type: 'circle', key: 'trace-vt-marker', cx: vPrime.x, cy: vPrime.y, r: 3, dashed: false, color: '#ef6c00', step, primitiveRole: 'visible' });
            this.primitives.push({ type: 'text', key: 'trace-vt-label', x: v.x + 6, y: v.y + 15, content: 'v', color: '#e65100', step, primitiveRole: 'label' });
            this.primitives.push({ type: 'text', key: 'trace-vt-prime-label', x: vPrime.x + 6, y: vPrime.y - 5, content: "v'", color: '#e65100', step, primitiveRole: 'label' });
        } else {
            unavailable.push(Math.abs(a.y - this.XY_LINE_Y) <= epsilon
                ? 'Line lies in VP (VT not unique)'
                : 'VT at infinity (line ∥ VP)');
        }

        if (unavailable.length > 0) {
            this.primitives.push({
                type: 'text', key: 'trace-infinity-note', x: this.ORIGIN_X, y: 35,
                content: unavailable.join('; '), color: '#616161', step, primitiveRole: 'caption', fontSize: 12,
            });
        }
        this.resolveLabelOverlaps(step);
    }
    
    private projectLineParallel(data: LineParallelSchema): LineProperties {
        const d_hp = data.end_A.distance_from_HP_mm * this.SCALE;
        const d_vp = data.end_A.distance_from_VP_mm * this.SCALE;
        const len = data.length_mm * this.SCALE;
        const side = this.getLineEndpointSideSigns(data.end_A);
        const direction = this.getLineDirectionSigns(data);

        const a_prime = { x: this.ORIGIN_X, y: this.XY_LINE_Y - side.hp * d_hp };
        const b_prime = { x: this.ORIGIN_X + direction.x * len, y: a_prime.y };
        const a = { x: this.ORIGIN_X, y: this.XY_LINE_Y + side.vp * d_vp };
        const b = { x: b_prime.x, y: a.y };
        
        this.primitives.push({ type: 'line', key: 'proj-a', points: [a.x, a.y, a_prime.x, a_prime.y], dashed: true, step: 1 });
        this.primitives.push({ type: 'line', key: 'proj-b', points: [b.x, b.y, b_prime.x, b_prime.y], dashed: true, step: 1 });
        this.primitives.push({ type: 'line', key: 'fv', points: [a_prime.x, a_prime.y, b_prime.x, b_prime.y], dashed: false, step: 2, color: '#004d40' });
        this.primitives.push({ type: 'line', key: 'tv', points: [a.x, a.y, b.x, b.y], dashed: false, step: 2, color: '#004d40' });
        this.primitives.push({ type: 'text', key: 'label-a-fv', x: a_prime.x - 15, y: a_prime.y, content: "a'", step: 2 });
        this.primitives.push({ type: 'text', key: 'label-b-fv', x: b_prime.x + 5, y: b_prime.y, content: "b'", step: 2 });
        this.primitives.push({ type: 'text', key: 'label-a-tv', x: a.x - 15, y: a.y, content: "a", step: 2 });
        this.primitives.push({ type: 'text', key: 'label-b-tv', x: b.x + 5, y: b.y, content: "b", step: 2 });

        const bboxFV = this.getBoundingBox(['fv']);
        this.addLinearDimension(a_prime, b_prime, this.formatLengthLabel(data.length_mm), -this.DIM_OFFSET, false, 'dim-tl');
        this.addLineTraces(a_prime, b_prime, a, b, data.show_traces, 3);

        return {
            trueLength: data.length_mm,
            planLength: data.length_mm,
            elevationLength: data.length_mm,
            trueInclinationHP: 0,
            trueInclinationVP: 0,
            apparentInclinationHP: 0,
            apparentInclinationVP: 0
        };
    }

    private projectLineInclinedHP(data: LineInclinedHPSchema): LineProperties {
        const d_hp = data.end_A.distance_from_HP_mm * this.SCALE;
        const d_vp = data.end_A.distance_from_VP_mm * this.SCALE;
        const len = data.length_mm * this.SCALE;
        const theta = this.degToRad(data.inclination_deg);
        const side = this.getLineEndpointSideSigns(data.end_A);
        const direction = this.getLineDirectionSigns(data);
        
        const a_prime = { x: this.ORIGIN_X, y: this.XY_LINE_Y - side.hp * d_hp };
        const b_prime = { x: a_prime.x + direction.x * len * Math.cos(theta), y: a_prime.y - direction.hp * len * Math.sin(theta) };
        const a = { x: this.ORIGIN_X, y: this.XY_LINE_Y + side.vp * d_vp };
        const b = { x: b_prime.x, y: a.y };
        
        this.primitives.push({ type: 'line', key: 'fv-tl', points: [a_prime.x, a_prime.y, b_prime.x, b_prime.y], dashed: false, step: 1, color: '#bcaaa4' });
        this.primitives.push({ type: 'line', key: 'hp-locus-a', points: [0, a_prime.y, GeometryEngine.VIEW_WIDTH, a_prime.y], dashed: true, step: 1, color: '#eeeeee' });
        this.primitives.push({ type: 'line', key: 'proj-a', points: [a.x, a.y, a_prime.x, a_prime.y], dashed: true, step: 2 });
        this.primitives.push({ type: 'line', key: 'proj-b', points: [b.x, b.y, b_prime.x, b_prime.y], dashed: true, step: 2 });
        this.primitives.push({ type: 'line', key: 'tv', points: [a.x, a.y, b.x, b.y], dashed: false, step: 2, color: '#bcaaa4' });
        
        this.primitives.push({ type: 'line', key: 'fv-final', points: [a_prime.x, a_prime.y, b_prime.x, b_prime.y], dashed: false, step: 3, color: '#004d40' });
        this.primitives.push({ type: 'line', key: 'tv-final', points: [a.x, a.y, b.x, b.y], dashed: false, step: 3, color: '#004d40' });
        this.primitives.push({ type: 'text', key: 'label-a-fv', x: a_prime.x - 15, y: a_prime.y, content: "a'", step: 3 });
        this.primitives.push({ type: 'text', key: 'label-b-fv', x: b_prime.x + 5, y: b_prime.y, content: "b'", step: 3 });
        this.primitives.push({ type: 'text', key: 'label-a-tv', x: a.x - 15, y: a.y, content: "a", step: 3 });
        this.primitives.push({ type: 'text', key: 'label-b-tv', x: b.x + 5, y: b.y, content: "b", step: 3 });

        this.addLinearDimension(a_prime, b_prime, this.formatLengthLabel(data.length_mm), -this.DIM_OFFSET, false, 'dim-tl', true);
        const fvAngle = Math.atan2(b_prime.y - a_prime.y, b_prime.x - a_prime.x);
        this.addAngleDimension(a_prime, fvAngle, direction.x > 0 ? 0 : Math.PI, 40, this.formatAngleLabel(data.inclination_deg), 'dim-angle-hp');
        this.addLineTraces(a_prime, b_prime, a, b, data.show_traces, 4);

        return {
            trueLength: data.length_mm,
            planLength: data.length_mm * Math.cos(theta),
            elevationLength: data.length_mm,
            trueInclinationHP: data.inclination_deg,
            trueInclinationVP: 0,
            apparentInclinationHP: data.inclination_deg,
            apparentInclinationVP: 0
        };
    }
    
     private projectLineInclinedVP(data: LineInclinedVPSchema): LineProperties {
        const d_hp = data.end_A.distance_from_HP_mm * this.SCALE;
        const d_vp = data.end_A.distance_from_VP_mm * this.SCALE;
        const len = data.length_mm * this.SCALE;
        const phi = this.degToRad(data.inclination_deg);
        const side = this.getLineEndpointSideSigns(data.end_A);
        const direction = this.getLineDirectionSigns(data);
        
        const a = { x: this.ORIGIN_X, y: this.XY_LINE_Y + side.vp * d_vp };
        const b = { x: a.x + direction.x * len * Math.cos(phi), y: a.y + direction.vp * len * Math.sin(phi) };
        const a_prime = { x: this.ORIGIN_X, y: this.XY_LINE_Y - side.hp * d_hp };
        const b_prime = { x: b.x, y: a_prime.y };
        
        this.primitives.push({ type: 'line', key: 'tv-tl', points: [a.x, a.y, b.x, b.y], dashed: false, step: 1, color: '#bcaaa4' });
        this.primitives.push({ type: 'line', key: 'vp-locus-a', points: [0, a.y, GeometryEngine.VIEW_WIDTH, a.y], dashed: true, step: 1, color: '#eeeeee' });
        this.primitives.push({ type: 'line', key: 'proj-a', points: [a.x, a.y, a_prime.x, a_prime.y], dashed: true, step: 2 });
        this.primitives.push({ type: 'line', key: 'proj-b', points: [b.x, b.y, b_prime.x, b_prime.y], dashed: true, step: 2 });
        this.primitives.push({ type: 'line', key: 'fv', points: [a_prime.x, a_prime.y, b_prime.x, b_prime.y], dashed: false, step: 2, color: '#bcaaa4' });
        
        this.primitives.push({ type: 'line', key: 'tv-final', points: [a.x, a.y, b.x, b.y], dashed: false, step: 3, color: '#004d40' });
        this.primitives.push({ type: 'line', key: 'fv-final', points: [a_prime.x, a_prime.y, b_prime.x, b_prime.y], dashed: false, step: 3, color: '#004d40' });
        this.primitives.push({ type: 'text', key: 'label-a-fv', x: a_prime.x - 15, y: a_prime.y, content: "a'", step: 3 });
        this.primitives.push({ type: 'text', key: 'label-b-fv', x: b_prime.x + 5, y: b_prime.y, content: "b'", step: 3 });
        this.primitives.push({ type: 'text', key: 'label-a-tv', x: a.x - 15, y: a.y, content: "a", step: 3 });
        this.primitives.push({ type: 'text', key: 'label-b-tv', x: b.x + 5, y: b.y, content: "b", step: 3 });

        this.addLinearDimension(a, b, this.formatLengthLabel(data.length_mm), this.DIM_OFFSET, false, 'dim-tl', true);
        const tvAngle = Math.atan2(b.y - a.y, b.x - a.x);
        this.addAngleDimension(a, direction.x > 0 ? 0 : Math.PI, tvAngle, 40, this.formatAngleLabel(data.inclination_deg), 'dim-angle-vp');
        this.addLineTraces(a_prime, b_prime, a, b, data.show_traces, 4);

        return {
            trueLength: data.length_mm,
            planLength: data.length_mm,
            elevationLength: data.length_mm * Math.cos(phi),
            trueInclinationHP: 0,
            trueInclinationVP: data.inclination_deg,
            apparentInclinationHP: 0,
            apparentInclinationVP: data.inclination_deg
        };
    }

    private projectLineInclinedBoth(data: LineInclinedBothSchema): LineProperties {
        const L = data.length_mm * this.SCALE;
        const theta = this.degToRad(data.inclination_with_HP_deg);
        const phi = this.degToRad(data.inclination_with_VP_deg);
        const xA = this.ORIGIN_X;
        const side = this.getLineEndpointSideSigns(data.end_A);
        const direction = this.getLineDirectionSigns(data);
        
        const d_hp = data.end_A.distance_from_HP_mm * this.SCALE;
        const d_vp = data.end_A.distance_from_VP_mm * this.SCALE;

        const a_prime = { x: xA, y: this.XY_LINE_Y - side.hp * d_hp };
        const a = { x: xA, y: this.XY_LINE_Y + side.vp * d_vp };

        // 1. Plot End A and its loci (the reference "planes")
        this.primitives.push({ type: 'text', key: 'label-a-prime', x: a_prime.x - 20, y: a_prime.y, content: "a'", step: 1 });
        this.primitives.push({ type: 'text', key: 'label-a', x: a.x - 20, y: a.y, content: "a", step: 1 });
        this.primitives.push({ type: 'line', key: 'proj-a-init', points: [a_prime.x, a_prime.y, a.x, a.y], dashed: true, step: 1, color: '#bdbdbd' });
        
        // Add Loci (planes) for A and A'
        this.primitives.push({ type: 'line', key: 'locus-a-prime-plane', points: [0, a_prime.y, GeometryEngine.VIEW_WIDTH, a_prime.y], dashed: true, step: 1, color: '#cfd8dc' });
        this.primitives.push({ type: 'line', key: 'locus-a-plane', points: [0, a.y, GeometryEngine.VIEW_WIDTH, a.y], dashed: true, step: 1, color: '#cfd8dc' });
        this.primitives.push({ type: 'text', key: 'label-locus-a-prime', x: GeometryEngine.VIEW_WIDTH - 120, y: a_prime.y - 5, content: "Locus of a'", step: 1, color: '#90a4ae' });
        this.primitives.push({ type: 'text', key: 'label-locus-a', x: GeometryEngine.VIEW_WIDTH - 120, y: a.y + 15, content: "Locus of a", step: 1, color: '#90a4ae' });

        // 2. TL in FV (inclined to HP)
        const b1_prime = { x: xA + direction.x * L * Math.cos(theta), y: a_prime.y - direction.hp * L * Math.sin(theta) };
        this.primitives.push({ type: 'line', key: 'tl-fv', points: [a_prime.x, a_prime.y, b1_prime.x, b1_prime.y], dashed: false, color: '#bcaaa4', step: 2 });
        this.primitives.push({ type: 'text', key: 'label-b1-prime', x: b1_prime.x + 5, y: b1_prime.y, content: "b₁'", step: 2 });
        const locus_b_fv_y = b1_prime.y;
        this.primitives.push({ type: 'line', key: 'locus-b-fv', points: [0, locus_b_fv_y, GeometryEngine.VIEW_WIDTH, locus_b_fv_y], dashed: true, color: '#cfd8dc', step: 2 });

        // Plan Length projection
        const b1 = { x: b1_prime.x, y: a.y };
        this.primitives.push({ type: 'line', key: 'proj-b1', points: [b1_prime.x, b1_prime.y, b1.x, b1.y], dashed: true, color: '#cfd8dc', step: 2 });
        const plan_len = Math.abs(b1.x - a.x);

        // 3. TL in TV (inclined to VP)
        const b2 = { x: xA + direction.x * L * Math.cos(phi), y: a.y + direction.vp * L * Math.sin(phi) };
        this.primitives.push({ type: 'line', key: 'tl-tv', points: [a.x, a.y, b2.x, b2.y], dashed: false, color: '#e1bee7', step: 3 });
        this.primitives.push({ type: 'text', key: 'label-b2', x: b2.x + 5, y: b2.y, content: "b₁", step: 3 });
        const locus_b_tv_y = b2.y;
        this.primitives.push({ type: 'line', key: 'locus-b-tv', points: [0, locus_b_tv_y, GeometryEngine.VIEW_WIDTH, locus_b_tv_y], dashed: true, color: '#cfd8dc', step: 3 });

        // Elevation Length projection
        const b2_prime = { x: b2.x, y: a_prime.y };
        this.primitives.push({ type: 'line', key: 'proj-b2', points: [b2.x, b2.y, b2_prime.x, b2_prime.y], dashed: true, color: '#cfd8dc', step: 3 });
        const elev_len = Math.abs(b2_prime.x - a_prime.x);

        // 4. Find final Top View by rotating plan length
        const dy_tv = Math.abs(locus_b_tv_y - a.y);
        const dx_tv = Math.sqrt(Math.max(0, plan_len**2 - dy_tv**2));
        const b = { x: xA + direction.x * dx_tv, y: locus_b_tv_y };
        this.primitives.push({ type: 'path', key: 'arc-tv', d: `M ${a.x + direction.x * plan_len} ${a.y} A ${plan_len} ${plan_len} 0 0 1 ${b.x} ${b.y}`, dashed: true, color: 'red', step: 4 });
        
        // 5. Find final Front View by rotating elevation length
        const dy_fv = Math.abs(locus_b_fv_y - a_prime.y);
        const dx_fv = Math.sqrt(Math.max(0, elev_len**2 - dy_fv**2));
        const b_prime = { x: xA + direction.x * dx_fv, y: locus_b_fv_y };
        this.primitives.push({ type: 'path', key: 'arc-fv', d: `M ${a_prime.x + direction.x * elev_len} ${a_prime.y} A ${elev_len} ${elev_len} 0 0 0 ${b_prime.x} ${b_prime.y}`, dashed: true, color: 'red', step: 4 });

        // 6. Final lines
        this.primitives.push({ type: 'line', key: 'final-fv', points: [a_prime.x, a_prime.y, b_prime.x, b_prime.y], dashed: false, color: '#004d40', step: 5 });
        this.primitives.push({ type: 'line', key: 'final-tv', points: [a.x, a.y, b.x, b.y], dashed: false, color: '#004d40', step: 5 });
        this.primitives.push({ type: 'text', key: 'label-b-prime', x: b_prime.x + 5, y: b_prime.y - 5, content: "b'", step: 5 });
        this.primitives.push({ type: 'text', key: 'label-b', x: b.x + 5, y: b.y + 15, content: "b", step: 5 });
        this.primitives.push({ type: 'line', key: 'final-projector', points: [b_prime.x, b_prime.y, b.x, b.y], dashed: true, color: '#004d40', step: 5 });

        this.addLinearDimension(a_prime, b1_prime, this.formatLengthLabel(data.length_mm), -this.DIM_OFFSET, false, 'dim-tl', true);
        const fvTrueAngle = Math.atan2(b1_prime.y - a_prime.y, b1_prime.x - a_prime.x);
        const tvTrueAngle = Math.atan2(b2.y - a.y, b2.x - a.x);
        this.addAngleDimension(a_prime, fvTrueAngle, direction.x > 0 ? 0 : Math.PI, 40, this.formatAngleLabel(data.inclination_with_HP_deg), 'dim-angle-hp');
        this.addAngleDimension(a, direction.x > 0 ? 0 : Math.PI, tvTrueAngle, 40, this.formatAngleLabel(data.inclination_with_VP_deg), 'dim-angle-vp');
        this.addLineTraces(a_prime, b_prime, a, b, data.show_traces, 6);

        // Calculate apparent properties
        const dx_final_fv = b_prime.x - a_prime.x;
        const dy_final_fv = b_prime.y - a_prime.y;
        const elev_len_final = Math.sqrt(dx_final_fv**2 + dy_final_fv**2);
        const alpha = Math.abs(this.radToDeg(Math.atan2(dy_final_fv, dx_final_fv)));

        const dx_final_tv = b.x - a.x;
        const dy_final_tv = b.y - a.y;
        const plan_len_final = Math.sqrt(dx_final_tv**2 + dy_final_tv**2);
        const beta = Math.abs(this.radToDeg(Math.atan2(dy_final_tv, dx_final_tv)));

        return {
            trueLength: data.length_mm,
            planLength: plan_len_final / this.SCALE,
            elevationLength: elev_len_final / this.SCALE,
            trueInclinationHP: data.inclination_with_HP_deg,
            trueInclinationVP: data.inclination_with_VP_deg,
            apparentInclinationHP: alpha,
            apparentInclinationVP: beta
        };
    }

    private projectLineOneEndHP(data: LineOneEndHPSchema): LineProperties {
        const lineData: LineInclinedBothSchema = {
            type: "line_inclined_both",
            length_mm: data.length_mm,
            inclination_with_HP_deg: data.inclination_with_HP_deg,
            inclination_with_VP_deg: data.inclination_with_VP_deg,
            end_A: {
                distance_from_HP_mm: 0,
                distance_from_VP_mm: data.end_A.distance_from_VP_mm,
                side_of_VP: data.end_A.side_of_VP,
            },
            direction: data.direction,
            show_traces: data.show_traces,
        };
        return this.projectLineInclinedBoth(lineData);
    }

    private projectLineOneEndVP(data: LineOneEndVPSchema): LineProperties {
        const lineData: LineInclinedBothSchema = {
            type: "line_inclined_both",
            length_mm: data.length_mm,
            inclination_with_HP_deg: data.inclination_with_HP_deg,
            inclination_with_VP_deg: data.inclination_with_VP_deg,
            end_A: {
                distance_from_HP_mm: data.end_A.distance_from_HP_mm,
                distance_from_VP_mm: 0,
                side_of_HP: data.end_A.side_of_HP,
            },
            direction: data.direction,
            show_traces: data.show_traces,
        };
        return this.projectLineInclinedBoth(lineData);
    }

    private projectLineCoplanar(data: LineCoplanarSchema): LineProperties {
        if (data.plane === 'HP') {
             return this.projectLineInclinedVP({
                 type: 'line_inclined_VP',
                 length_mm: data.length_mm,
                 inclination_deg: data.inclination_deg,
                 end_A: {
                     distance_from_HP_mm: 0,
                     distance_from_VP_mm: data.end_A_distance_mm,
                     side_of_VP: data.end_A_side === 'behind' ? 'behind' : 'in_front',
                 },
                 direction: data.direction,
                 show_traces: data.show_traces,
             });
        } else {
             return this.projectLineInclinedHP({
                 type: 'line_inclined_HP',
                 length_mm: data.length_mm,
                 inclination_deg: data.inclination_deg,
                 end_A: {
                     distance_from_HP_mm: data.end_A_distance_mm,
                     distance_from_VP_mm: 0,
                     side_of_HP: data.end_A_side === 'below' ? 'below' : 'above',
                 },
                 direction: data.direction,
                 show_traces: data.show_traces,
             });
        }
    }

    private projectLineTouchingXY(data: LineTouchingXYSchema): LineProperties {
        const lineData: LineInclinedBothSchema = {
            type: "line_inclined_both",
            length_mm: data.length_mm,
            inclination_with_HP_deg: data.inclination_with_HP_deg,
            inclination_with_VP_deg: data.inclination_with_VP_deg,
            end_A: { distance_from_HP_mm: 0, distance_from_VP_mm: 0 },
            direction: data.direction,
            show_traces: data.show_traces,
        };
        return this.projectLineInclinedBoth(lineData);
    }

    public getPolygonVertices(sides: number, sideLength: number, centerX: number, centerY: number, orientationAngle: number = 0): PointCoords[] {
        const vertices: PointCoords[] = [];
        const radius = sideLength / (2 * Math.sin(Math.PI / sides)); // circumradius
        // To make a side perpendicular to the horizontal axis (vertical in TV),
        // we start so that a midpoint of a side is at angle 0.
        const startAngle = -Math.PI / sides + orientationAngle;
    
        for (let i = 0; i < sides; i++) {
            const angle = startAngle + (i * 2 * Math.PI) / sides;
            vertices.push({
                x: centerX + radius * Math.cos(angle),
                y: centerY + radius * Math.sin(angle),
                z: 0
            });
        }
        return vertices;
    }

    public getRectangleVertices(length: number, breadth: number, centerX: number, centerY: number, orientationAngle: number = 0): PointCoords[] {
        const halfLength = length / 2;
        const halfBreadth = breadth / 2;
        const vertices: PointCoords[] = [
            { x: centerX - halfLength, y: centerY - halfBreadth },
            { x: centerX + halfLength, y: centerY - halfBreadth },
            { x: centerX + halfLength, y: centerY + halfBreadth },
            { x: centerX - halfLength, y: centerY + halfBreadth },
        ];

        return orientationAngle === 0
            ? vertices
            : vertices.map((point) => this.rotatePoint(point, { x: centerX, y: centerY }, orientationAngle));
    }

    public getBaseOrientationAngle(
        shape: SolidSchema['base_shape'],
        size: SolidSchema['base_size_mm'],
        constraint?: SolidSchema['base_orientation'],
    ): number {
        if (!constraint || shape === 'circle') return 0;

        const targetMagnitude = constraint.relation === 'parallel'
            ? 0
            : constraint.relation === 'perpendicular'
                ? Math.PI / 2
                : this.degToRad(constraint.angle_deg || 0);
        const targetAngle = constraint.direction === 'counterclockwise'
            ? -targetMagnitude
            : targetMagnitude;

        let localVertices: PointCoords[];
        if (shape === 'rectangle') {
            localVertices = this.getRectangleVertices(
                size.length_mm || 0,
                size.breadth_mm || 0,
                0,
                0,
            );
        } else {
            const sides = shape === 'triangle' ? 3
                : shape === 'square' ? 4
                    : shape === 'pentagon' ? 5
                        : 6;
            localVertices = this.getPolygonVertices(sides, size.side_mm || 1, 0, 0, 0);
        }

        let from = localVertices[0];
        let to = localVertices[1];
        if (constraint.feature === 'longer_side' || constraint.feature === 'shorter_side') {
            const length = size.length_mm || 0;
            const breadth = size.breadth_mm || 0;
            const wantsLengthEdge = constraint.feature === 'longer_side'
                ? length >= breadth
                : length < breadth;
            if (!wantsLengthEdge) {
                from = localVertices[1];
                to = localVertices[2];
            }
        } else if (constraint.feature === 'diagonal') {
            to = localVertices[Math.floor(localVertices.length / 2)];
        } else if (constraint.feature === 'corner_to_center') {
            from = { x: 0, y: 0 };
            to = localVertices[0];
        }

        const intrinsicAngle = Math.atan2(to.y - from.y, to.x - from.x);
        return targetAngle - intrinsicAngle;
    }

    private projectSolid(data: SolidSchema) {
        projectSolid(this, data);
    }

    public projectSphere(data: SolidSchema) {
        const diameterMm = data.base_size_mm.diameter_mm || data.height_mm;
        const radius = diameterMm * this.SCALE / 2;
        const centerX = this.ORIGIN_X + radius * 2;
        const fvCenterY = data.resting_on === 'HP'
            ? this.XY_LINE_Y - radius
            : this.XY_LINE_Y - radius * 1.75;
        const tvCenterY = data.resting_on === 'VP'
            ? this.XY_LINE_Y + radius
            : this.XY_LINE_Y + radius * 1.75;

        this.primitives.push(
            { type: 'circle', key: 's1-fv-sphere', cx: centerX, cy: fvCenterY, r: radius, dashed: false, color: '#bcaaa4', step: 1 },
            { type: 'circle', key: 's1-tv-sphere', cx: centerX, cy: tvCenterY, r: radius, dashed: false, color: '#bcaaa4', step: 1 },
            { type: 'line', key: 'sphere-projector', points: [centerX, fvCenterY, centerX, tvCenterY], dashed: true, color: '#bdbdbd', step: 1, primitiveRole: 'projection' },
            { type: 'line', key: 's1-fv-axis-h', points: [centerX - radius, fvCenterY, centerX + radius, fvCenterY], dashed: true, step: 1, primitiveRole: 'axis' },
            { type: 'line', key: 's1-fv-axis-v', points: [centerX, fvCenterY - radius, centerX, fvCenterY + radius], dashed: true, step: 1, primitiveRole: 'axis' },
            { type: 'line', key: 's1-tv-axis-h', points: [centerX - radius, tvCenterY, centerX + radius, tvCenterY], dashed: true, step: 1, primitiveRole: 'axis' },
            { type: 'line', key: 's1-tv-axis-v', points: [centerX, tvCenterY - radius, centerX, tvCenterY + radius], dashed: true, step: 1, primitiveRole: 'axis' },
            { type: 'circle', key: 'sphere-fv-final', cx: centerX, cy: fvCenterY, r: radius, dashed: false, color: '#004d40', step: 2, primitiveRole: 'visible' },
            { type: 'circle', key: 'sphere-tv-final', cx: centerX, cy: tvCenterY, r: radius, dashed: false, color: '#004d40', step: 2, primitiveRole: 'visible' },
            { type: 'text', key: 'sphere-fv-label', x: centerX, y: fvCenterY - radius - 22, content: 'F.V.', step: 2, textAnchor: 'middle', primitiveRole: 'caption' },
            { type: 'text', key: 'sphere-tv-label', x: centerX, y: tvCenterY + radius + 24, content: 'T.V.', step: 2, textAnchor: 'middle', primitiveRole: 'caption' },
        );

        this.addLinearDimension(
            { x: centerX - radius, y: fvCenterY },
            { x: centerX + radius, y: fvCenterY },
            `⌀${this.formatLengthLabel(diameterMm)}`,
            -this.DIM_OFFSET,
            false,
            'dim-sphere-diameter',
        );
    }

    // ======================================================================
    // SOLIDS RESTING ON VP
    // ======================================================================
    // When a solid rests on VP:
    //   - FV (above XY) shows the base shape (the polygon/circle face on VP)
    //   - TV (below XY) shows the side elevation (rectangular, height = axis length)
    //   - The axis is perpendicular to VP, pointing toward the observer
    //   - Height in 3D maps to the depth dimension (downward from XY in TV)
    //
    // 3-stage construction for inclined solids:
    //   Stage 1: Simple position — base on VP, axis ⊥ VP
    //   Stage 2: Tilt TV to incline axis to VP → project new FV
    //   Stage 3: Rotate FV for HP inclination → project new TV
    // ======================================================================
    public projectSolidOnVP(data: SolidSchema) {
        const baseSide = (data.base_shape === 'rectangle'
            ? Math.max(data.base_size_mm.length_mm || 0, data.base_size_mm.breadth_mm || 0)
            : (data.base_size_mm.side_mm || data.base_size_mm.diameter_mm || 0)) * this.SCALE;
        const height = data.height_mm * this.SCALE;
        let numSides = 0;
        switch (data.base_shape) {
            case 'triangle': numSides = 3; break;
            case 'square': numSides = 4; break;
            case 'pentagon': numSides = 5; break;
            case 'hexagon': numSides = 6; break;
            case 'rectangle': numSides = 4; break;
            case 'circle': numSides = 24; break;
            default:
                this.primitives.push({ type: 'text', key: 'error', x: 200, y: 200, content: `Base shape '${data.base_shape}' not supported.`, step: 1 });
                return;
        }

        const isPrism = data.solid_type === 'prism' || data.solid_type === 'cylinder' || data.solid_type === 'cube';
        const CONSTRUCTION_COLOR = '#bcaaa4';

        const constructionStep = (step: number, prims: SvgPrimitive[]) => {
            prims.forEach(p => this.primitives.push({ ...p, step, color: p.color || CONSTRUCTION_COLOR }));
            this.resolveLabelOverlaps(step);
        };
        const finalStep = (step: number, prims: SvgPrimitive[]) => {
            prims.forEach(p => this.primitives.push({ ...p, key: p.key + '-final', step, color: '#004d40' }));
            this.resolveLabelOverlaps(step);
        };

        const baseKeys: string[] = [];
        const topKeys: string[] = [];
        for (let i = 0; i < numSides; i++) {
            baseKeys.push(`b${i}`);
            topKeys.push(`t${i}`);
        }
        if (!isPrism) {
            topKeys.splice(0, topKeys.length, 'apex');
        }
        const allKeys = [...baseKeys, ...topKeys, 'axis_base', 'axis_top'];

        // --- Visibility logic (reused from HP, adapted for VP) ---
        const applyVisibility = (ptsMap: PointMap, prims: SvgPrimitive[], view: 'tv' | 'fv') => {
            if (data.base_shape === 'circle') return;

            const epsilon = 0.01;
            // For VP-resting solids:
            // FV shows the base shape face-on — viewer looks along +z (depth into VP)
            // TV shows from above — viewer looks along -y (height/elevation)
            const toWorldPoint = (point: PointCoords) => {
                if (view === 'fv') {
                    // FV: x maps to world-x, y maps to world-y, z is depth
                    return { x: point.x, y: point.y, z: point.z || 0 };
                }
                // TV: x maps to world-x, y maps to depth (z), world-y from elevation
                return { x: point.x, y: point.z || 0, z: point.y - this.XY_LINE_Y };
            };

            const getFaceVisibilityScore = (keys: string[]) => {
                if (keys.length < 3) return 0;
                const p0 = toWorldPoint(ptsMap[keys[0]]);
                const p1 = toWorldPoint(ptsMap[keys[1]]);
                const p2 = toWorldPoint(ptsMap[keys[2]]);
                const u = { x: p1.x - p0.x, y: p1.y - p0.y, z: p1.z - p0.z };
                const v = { x: p2.x - p0.x, y: p2.y - p0.y, z: p2.z - p0.z };
                const normal = {
                    x: u.y * v.z - u.z * v.y,
                    y: u.z * v.x - u.x * v.z,
                    z: u.x * v.y - u.y * v.x,
                };
                // For FV, viewer looks along z → check normal.z
                // For TV, viewer looks along y → check normal.y
                return view === 'fv' ? normal.z : normal.y;
            };

            const isSilhouetteEdge = (k1: string, k2: string) => {
                const p1 = ptsMap[k1];
                const p2 = ptsMap[k2];
                if (!p1 || !p2) return false;
                const dx = p2.x - p1.x;
                const dy = p2.y - p1.y;
                if (Math.abs(dx) < epsilon && Math.abs(dy) < epsilon) return false;
                let hasPositive = false;
                let hasNegative = false;
                for (const [key, point] of Object.entries(ptsMap)) {
                    if (key === k1 || key === k2 || key.includes('axis')) continue;
                    if (
                        (Math.abs(point.x - p1.x) < epsilon && Math.abs(point.y - p1.y) < epsilon) ||
                        (Math.abs(point.x - p2.x) < epsilon && Math.abs(point.y - p2.y) < epsilon)
                    ) continue;
                    const cross = dx * (point.y - p1.y) - dy * (point.x - p1.x);
                    if (cross > epsilon) hasPositive = true;
                    if (cross < -epsilon) hasNegative = true;
                    if (hasPositive && hasNegative) return false;
                }
                return true;
            };

            const visibleFaces = new Set<number>();
            const faces: string[][] = [];
            const faceScores: number[] = [];

            if (isPrism) {
                faces.push(topKeys);
                faces.push([...baseKeys].reverse());
                for (let i = 0; i < numSides; i++) {
                    faces.push([baseKeys[i], baseKeys[(i + 1) % numSides], topKeys[(i + 1) % numSides], topKeys[i]]);
                }
            } else {
                faces.push([...baseKeys].reverse());
                for (let i = 0; i < numSides; i++) {
                    faces.push([baseKeys[i], baseKeys[(i + 1) % numSides], 'apex']);
                }
            }

            faces.forEach((face, idx) => {
                const score = getFaceVisibilityScore(face);
                faceScores[idx] = score;
                if (score > epsilon) visibleFaces.add(idx);
            });

            const edgeFaceMap: { [edgeKey: string]: number[] } = {};
            faces.forEach((face, idx) => {
                for (let i = 0; i < face.length; i++) {
                    const k1 = face[i];
                    const k2 = face[(i + 1) % face.length];
                    const edgeKey = k1 < k2 ? `${k1}-${k2}` : `${k2}-${k1}`;
                    if (!edgeFaceMap[edgeKey]) edgeFaceMap[edgeKey] = [];
                    edgeFaceMap[edgeKey].push(idx);
                }
            });

            prims.forEach(prim => {
                if (prim.type === 'line' && (prim.key.includes('base') || prim.key.includes('top') || prim.key.includes('side') || prim.key.includes('slant'))) {
                    let k1, k2;
                    if (prim.key.includes('base')) {
                        const i = parseInt(prim.key.split('-').pop()!);
                        if (!isNaN(i)) { k1 = baseKeys[i]; k2 = baseKeys[(i + 1) % numSides]; }
                    } else if (prim.key.includes('top')) {
                        const i = parseInt(prim.key.split('-').pop()!);
                        if (!isNaN(i)) { k1 = topKeys[i]; k2 = topKeys[(i + 1) % numSides]; }
                    } else if (prim.key.includes('side') || prim.key.includes('slant')) {
                        const i = parseInt(prim.key.split('-').pop()!);
                        if (!isNaN(i)) { k1 = baseKeys[i]; k2 = isPrism ? topKeys[i] : 'apex'; }
                    }
                    if (k1 && k2) {
                        const edgeKey = k1 < k2 ? `${k1}-${k2}` : `${k2}-${k1}`;
                        const adjacentFaces = edgeFaceMap[edgeKey] || [];
                        const scores = adjacentFaces.map((faceIndex) => faceScores[faceIndex] || 0);
                        const hasVisibleFace = adjacentFaces.some(fIdx => visibleFaces.has(fIdx));
                        const hasSilhouetteTransition = scores.some((score) => Math.abs(score) <= epsilon)
                            || (scores.some((score) => score > epsilon) && scores.some((score) => score < -epsilon));
                        const isVisible = hasVisibleFace || hasSilhouetteTransition || isSilhouetteEdge(k1, k2);
                        if (!isVisible) {
                            prim.dashed = true;
                            prim.key += '-hidden';
                        }
                    }
                }
            });

            // Remove redundant hidden edges that are coincident with visible edges
            const getNormalizedLineSignature = (primitive: SvgPrimitive) => {
                if (primitive.type !== 'line') return null;
                const [x1, y1, x2, y2] = primitive.points;
                const first = `${x1.toFixed(2)},${y1.toFixed(2)}`;
                const second = `${x2.toFixed(2)},${y2.toFixed(2)}`;
                return first < second ? `${first}|${second}` : `${second}|${first}`;
            };
            const coincidentLineGroups = new Map<string, SvgPrimitive[]>();
            prims.forEach((primitive) => {
                const signature = getNormalizedLineSignature(primitive);
                if (!signature) return;
                const group = coincidentLineGroups.get(signature) || [];
                group.push(primitive);
                coincidentLineGroups.set(signature, group);
            });
            coincidentLineGroups.forEach((group) => {
                const hasVisibleCoincidentEdge = group.some((primitive) => primitive.type === 'line' && !primitive.dashed);
                if (!hasVisibleCoincidentEdge) return;
                group.forEach((primitive) => {
                    if (primitive.type !== 'line') return;
                    primitive.dashed = false;
                    if (primitive.key.endsWith('-hidden')) {
                        primitive.key = primitive.key.slice(0, -7);
                    }
                });
            });
        };

        // ===========================================================
        // Stage 1: Simple Position — Base on VP, axis ⊥ VP
        // ===========================================================
        // FV (above XY): The base polygon viewed face-on
        // TV (below XY): The rectangular side elevation (width = base extent, depth = axis height)

        const orientation = this.getBaseOrientationAngle(data.base_shape, data.base_size_mm, data.base_orientation);
        const fvCenterX = this.ORIGIN_X + baseSide * 1.5;
        const fvCenterY = this.XY_LINE_Y - baseSide * 1.5;

        // Generate the base polygon vertices for FV (face-on view of base)
        let baseVertices: PointCoords[] = [];
        if (data.base_shape === 'circle') {
            const radius = baseSide / 2;
            for (let i = 0; i < numSides; i++) {
                const angle = (i * 2 * Math.PI) / numSides;
                baseVertices.push({
                    x: fvCenterX + radius * Math.cos(angle),
                    y: fvCenterY + radius * Math.sin(angle),
                    z: 0
                });
            }
        } else if (data.base_shape === 'rectangle') {
            baseVertices = this.getRectangleVertices(
                (data.base_size_mm.length_mm || 0) * this.SCALE,
                (data.base_size_mm.breadth_mm || 0) * this.SCALE,
                fvCenterX,
                fvCenterY,
                orientation,
            );
        } else {
            baseVertices = this.getPolygonVertices(numSides, baseSide, fvCenterX, fvCenterY, orientation);
        }

        // FV points: base polygon in FV (above XY)
        const stage1_fv_pts: PointMap = {};
        baseVertices.forEach((p, i) => {
            stage1_fv_pts[baseKeys[i]] = { x: p.x, y: p.y, z: 0 };
        });

        if (isPrism) {
            // For a prism: top face vertices coincide with base in FV (they project to same spot)
            baseVertices.forEach((p, i) => {
                stage1_fv_pts[topKeys[i]] = { x: p.x, y: p.y, z: height };
            });
        } else {
            // For a pyramid: apex projects to center in FV
            stage1_fv_pts.apex = { x: fvCenterX, y: fvCenterY, z: height };
        }
        stage1_fv_pts.axis_base = { x: fvCenterX, y: fvCenterY, z: 0 };
        stage1_fv_pts.axis_top = { x: fvCenterX, y: fvCenterY, z: height };

        // TV points: project from FV. x stays same, y = XY + depth(z)
        const stage1_tv_pts: PointMap = {};
        allKeys.forEach(key => {
            const fvPt = stage1_fv_pts[key];
            stage1_tv_pts[key] = {
                x: fvPt.x,
                y: this.XY_LINE_Y + (fvPt.z || 0),   // z (depth) maps to distance below XY
                z: this.XY_LINE_Y - fvPt.y,           // FV elevation → stored as z for visibility
            };
        });

        // Build FV primitives: draw the base polygon
        const stage1_fv_prims: SvgPrimitive[] = [];
        if (data.base_shape === 'circle') {
            // For circle base: draw a circle in FV
            const radius = baseSide / 2;
            stage1_fv_prims.push({ type: 'circle', key: 's1-fv-base-circle', cx: fvCenterX, cy: fvCenterY, r: radius, dashed: false });
            if (!isPrism) {
                // For cone: draw the center point for apex projection
                stage1_fv_prims.push({ type: 'line', key: 's1-fv-axis-h', points: [fvCenterX - 5, fvCenterY, fvCenterX + 5, fvCenterY], dashed: true, color: '#d32f2f' });
                stage1_fv_prims.push({ type: 'line', key: 's1-fv-axis-v', points: [fvCenterX, fvCenterY - 5, fvCenterX, fvCenterY + 5], dashed: true, color: '#d32f2f' });
            }
        } else {
            for (let i = 0; i < numSides; i++) {
                stage1_fv_prims.push({
                    type: 'line', key: `s1-fv-base-${i}`,
                    points: [stage1_fv_pts[baseKeys[i]].x, stage1_fv_pts[baseKeys[i]].y,
                             stage1_fv_pts[baseKeys[(i + 1) % numSides]].x, stage1_fv_pts[baseKeys[(i + 1) % numSides]].y],
                    dashed: false
                });
            }
            if (isPrism) {
                // For prism: top face overlaps base in FV — don't draw duplicate, but we need it for labels
                // The top face edges are coincident with base edges in simple position
            } else {
                // For pyramid: draw slant lines from apex to each base vertex
                for (let i = 0; i < numSides; i++) {
                    stage1_fv_prims.push({
                        type: 'line', key: `s1-fv-slant-${i}`,
                        points: [stage1_fv_pts.apex.x, stage1_fv_pts.apex.y,
                                 stage1_fv_pts[baseKeys[i]].x, stage1_fv_pts[baseKeys[i]].y],
                        dashed: false
                    });
                }
            }
        }

        // Build TV primitives: rectangular side view
        const stage1_tv_prims: SvgPrimitive[] = [];
        if (data.base_shape === 'circle') {
            // Cylinder/Cone: TV shows rectangle (generators = left/right silhouette)
            const radius = baseSide / 2;
            const tvLeft = fvCenterX - radius;
            const tvRight = fvCenterX + radius;
            const tvTop = this.XY_LINE_Y;         // base sits on XY
            const tvBottom = this.XY_LINE_Y + height; // axis extends down

            if (isPrism) {
                // Cylinder: rectangle
                stage1_tv_prims.push({ type: 'line', key: 's1-tv-side-left', points: [tvLeft, tvTop, tvLeft, tvBottom], dashed: false });
                stage1_tv_prims.push({ type: 'line', key: 's1-tv-side-right', points: [tvRight, tvTop, tvRight, tvBottom], dashed: false });
                stage1_tv_prims.push({ type: 'line', key: 's1-tv-base-0', points: [tvLeft, tvTop, tvRight, tvTop], dashed: false });
                stage1_tv_prims.push({ type: 'line', key: 's1-tv-top-0', points: [tvLeft, tvBottom, tvRight, tvBottom], dashed: false });
            } else {
                // Cone: triangle in TV
                stage1_tv_prims.push({ type: 'line', key: 's1-tv-slant-left', points: [tvLeft, tvTop, fvCenterX, tvBottom], dashed: false });
                stage1_tv_prims.push({ type: 'line', key: 's1-tv-slant-right', points: [tvRight, tvTop, fvCenterX, tvBottom], dashed: false });
                stage1_tv_prims.push({ type: 'line', key: 's1-tv-base-0', points: [tvLeft, tvTop, tvRight, tvTop], dashed: false });
            }
        } else {
            // Polygon base: TV shows the side elevation
            for (let i = 0; i < numSides; i++) {
                stage1_tv_prims.push({
                    type: 'line', key: `s1-tv-base-${i}`,
                    points: [stage1_tv_pts[baseKeys[i]].x, stage1_tv_pts[baseKeys[i]].y,
                             stage1_tv_pts[baseKeys[(i + 1) % numSides]].x, stage1_tv_pts[baseKeys[(i + 1) % numSides]].y],
                    dashed: false
                });
            }
            if (isPrism) {
                for (let i = 0; i < numSides; i++) {
                    stage1_tv_prims.push({
                        type: 'line', key: `s1-tv-top-${i}`,
                        points: [stage1_tv_pts[topKeys[i]].x, stage1_tv_pts[topKeys[i]].y,
                                 stage1_tv_pts[topKeys[(i + 1) % numSides]].x, stage1_tv_pts[topKeys[(i + 1) % numSides]].y],
                        dashed: false
                    });
                    stage1_tv_prims.push({
                        type: 'line', key: `s1-tv-side-${i}`,
                        points: [stage1_tv_pts[baseKeys[i]].x, stage1_tv_pts[baseKeys[i]].y,
                                 stage1_tv_pts[topKeys[i]].x, stage1_tv_pts[topKeys[i]].y],
                        dashed: false
                    });
                }
            } else {
                for (let i = 0; i < numSides; i++) {
                    stage1_tv_prims.push({
                        type: 'line', key: `s1-tv-slant-${i}`,
                        points: [stage1_tv_pts.apex.x, stage1_tv_pts.apex.y,
                                 stage1_tv_pts[baseKeys[i]].x, stage1_tv_pts[baseKeys[i]].y],
                        dashed: false
                    });
                }
            }
        }
        // TV axis line
        stage1_tv_prims.push({
            type: 'line', key: 's1-tv-axis',
            points: [stage1_tv_pts.axis_base.x, stage1_tv_pts.axis_base.y,
                     stage1_tv_pts.axis_top.x, stage1_tv_pts.axis_top.y],
            dashed: true, color: '#d32f2f'
        });

        const stage1_prims = [...stage1_fv_prims, ...stage1_tv_prims];
        constructionStep(1, stage1_prims);

        // Add labels for stage 1
        if (data.base_shape !== 'circle') {
            this.addOrthographicSolidLabels(stage1_fv_pts, stage1_tv_pts, stage1_fv_pts, baseKeys, topKeys, isPrism, 1, ['tv', 'fv']);
        }

        const addVpSolidDimensions = () => {
            const fvBbox = this.getBoundingBox(['s1-fv']);
            const tvBbox = this.getBoundingBox(['s1-tv']);
            this.addLinearDimension(
                { x: tvBbox.right, y: tvBbox.top },
                { x: tvBbox.right, y: tvBbox.bottom },
                this.formatLengthLabel(data.height_mm),
                this.DIM_OFFSET,
                true,
                'dim-solid-height',
            );

            if (data.base_shape === 'circle' && data.base_size_mm.diameter_mm) {
                this.addLinearDimension({ x: fvBbox.left, y: fvBbox.top }, { x: fvBbox.right, y: fvBbox.top }, `⌀${this.formatLengthLabel(data.base_size_mm.diameter_mm)}`, -this.DIM_OFFSET, false, 'dim-solid-base');
            } else if (data.base_shape === 'rectangle' && data.base_size_mm.length_mm && data.base_size_mm.breadth_mm) {
                this.addLinearDimension(stage1_fv_pts[baseKeys[0]], stage1_fv_pts[baseKeys[1]], this.formatLengthLabel(data.base_size_mm.length_mm), -this.DIM_OFFSET, false, 'dim-solid-length', true);
                this.addLinearDimension(stage1_fv_pts[baseKeys[1]], stage1_fv_pts[baseKeys[2]], this.formatLengthLabel(data.base_size_mm.breadth_mm), this.DIM_OFFSET, true, 'dim-solid-breadth', true);
            } else if (data.base_size_mm.side_mm) {
                this.addLinearDimension(stage1_fv_pts[baseKeys[0]], stage1_fv_pts[baseKeys[1]], this.formatLengthLabel(data.base_size_mm.side_mm), -this.DIM_OFFSET, false, 'dim-solid-base', true);
            }
        };

        // --- Check if inclination is needed ---
        const vpAngle = data.inclined_to === 'VP'
            ? (data.inclination_deg || 0)
            : (data.inclination_with_VP_deg || 0);
        const hpAngle = data.inclined_to === 'HP'
            ? (data.inclination_deg || 0)
            : (data.inclination_with_HP_deg || 0);

        if (!data.inclined_to) {
            // Step 2: Draw vertical projection lines from TV vertices up to FV
            allKeys.forEach(key => {
                const tv = stage1_tv_pts[key];
                const fv = stage1_fv_pts[key];
                this.primitives.push({
                    type: 'line', key: `proj-tv-fv-${key}`,
                    points: [tv.x, tv.y, fv.x, fv.y] as [number, number, number, number],
                    dashed: true, color: '#e0e0e0', step: 2, primitiveRole: 'projection'
                });
            });

            // Step 3: FV base outline (already in stage1_fv_prims — emit at step 3)
            const fvBasePrims = stage1_fv_prims.filter(p => p.key?.includes('base') || p.key?.includes('fv-base-circle'));
            fvBasePrims.forEach(p => this.primitives.push({ ...p, step: 3, primitiveRole: 'visible' }));

            // Step 4: FV top/lateral edges + axis line
            const fvTopLateralPrims = stage1_fv_prims.filter(p => p.key?.includes('top') || p.key?.includes('slant') || p.key?.includes('axis'));
            fvTopLateralPrims.forEach(p => this.primitives.push({ ...p, step: 4, primitiveRole: 'visible' }));
            // Axis line in FV
            this.primitives.push({
                type: 'line', key: 'simple-fv-axis',
                points: [stage1_fv_pts.axis_base.x, stage1_fv_pts.axis_base.y,
                         stage1_fv_pts.axis_top.x, stage1_fv_pts.axis_top.y] as [number, number, number, number],
                dashed: true, color: '#d32f2f', step: 4, primitiveRole: 'axis'
            });

            // Step 5: Hidden lines (for prisms, show the back base edges in TV as dashed)
            if (data.base_shape !== 'circle') {
                // Back edges of the solid in TV are hidden — show them dashed at step 5
                const sortedX = baseKeys.map(k => stage1_tv_pts[k].x).sort((a, b) => a - b);
                const midX = (sortedX[0] + sortedX[sortedX.length - 1]) / 2;
                for (let i = 0; i < numSides; i++) {
                    const t0 = stage1_tv_pts[baseKeys[i]];
                    const t1 = stage1_tv_pts[baseKeys[(i + 1) % numSides]];
                    const mx = (t0.x + t1.x) / 2;
                    // Edges behind center are hidden
                    if (mx < midX) {
                        this.primitives.push({
                            type: 'line', key: `hidden-tv-base-${i}`,
                            points: [t0.x, t0.y, t1.x, t1.y] as [number, number, number, number],
                            dashed: true, color: '#004d40', step: 5, primitiveRole: 'hidden'
                        });
                    }
                }
            }

            // Step 6: Finalize (re-emit all at final step)
            this.primitives.push({ type: 'line', key: 'step5-dummy', points: [0,0,0,0] as [number,number,number,number], dashed: true, step: 5, color: 'transparent', primitiveRole: 'hidden' });
            finalStep(6, stage1_prims);
            addVpSolidDimensions();
            return;
        }

        // ===========================================================
        // Stage 2: VP Inclination — Rotate TV, project new FV
        // ===========================================================
        // For VP-resting: the TV gets tilted to incline the axis to VP.
        // This mirrors HP Stage 2 but operates on TV points.
        // vpAngle is the final angle made by the axis with VP. The initial
        // axis is perpendicular to VP, so the first construction rotation is
        // its complement.
        const rot_angle_vp = this.degToRad(90 - vpAngle);

        const buffer_s2 = 100;
        const pivot_s1 = stage1_tv_pts[baseKeys[0]];

        // Rotate TV points about pivot
        const temp_rotated_tv_pts: PointMap = {};
        allKeys.forEach(key => {
            temp_rotated_tv_pts[key] = this.rotatePoint(stage1_tv_pts[key], pivot_s1, -rot_angle_vp);
        });

        // Shift rotated TV to the right of stage 1
        const maxX_stage1 = Math.max(...Object.values(stage1_tv_pts).map(p => p.x));
        const minX_rotated_tv = Math.min(...Object.values(temp_rotated_tv_pts).map(p => p.x));
        const shiftX_s2 = (maxX_stage1 + buffer_s2) - minX_rotated_tv;

        // Ensure the solid base touches the XY line (base is at XY for VP)
        const minY_rotated_tv = Math.min(...Object.values(temp_rotated_tv_pts).map(p => p.y));
        const shiftY_s2 = this.XY_LINE_Y - minY_rotated_tv;

        const stage2_tv_pts: PointMap = {};
        allKeys.forEach(key => {
            const temp_p = temp_rotated_tv_pts[key];
            stage2_tv_pts[key] = {
                x: temp_p.x + shiftX_s2,
                y: temp_p.y + shiftY_s2,
            };
        });

        // Draw the rotated TV (Stage 2)
        const stage2_tv_prims: SvgPrimitive[] = [];
        for (let i = 0; i < numSides; i++) {
            stage2_tv_prims.push({
                type: 'line', key: `s2-tv-base-${i}`,
                points: [stage2_tv_pts[baseKeys[i]].x, stage2_tv_pts[baseKeys[i]].y,
                         stage2_tv_pts[baseKeys[(i + 1) % numSides]].x, stage2_tv_pts[baseKeys[(i + 1) % numSides]].y],
                dashed: false
            });
        }
        if (isPrism) {
            for (let i = 0; i < numSides; i++) {
                stage2_tv_prims.push({
                    type: 'line', key: `s2-tv-top-${i}`,
                    points: [stage2_tv_pts[topKeys[i]].x, stage2_tv_pts[topKeys[i]].y,
                             stage2_tv_pts[topKeys[(i + 1) % numSides]].x, stage2_tv_pts[topKeys[(i + 1) % numSides]].y],
                    dashed: false
                });
                stage2_tv_prims.push({
                    type: 'line', key: `s2-tv-side-${i}`,
                    points: [stage2_tv_pts[baseKeys[i]].x, stage2_tv_pts[baseKeys[i]].y,
                             stage2_tv_pts[topKeys[i]].x, stage2_tv_pts[topKeys[i]].y],
                    dashed: false
                });
            }
        } else {
            for (let i = 0; i < numSides; i++) {
                stage2_tv_prims.push({
                    type: 'line', key: `s2-tv-slant-${i}`,
                    points: [stage2_tv_pts.apex.x, stage2_tv_pts.apex.y,
                             stage2_tv_pts[baseKeys[i]].x, stage2_tv_pts[baseKeys[i]].y],
                    dashed: false
                });
            }
        }
        stage2_tv_prims.push({
            type: 'line', key: 's2-tv-axis',
            points: [stage2_tv_pts.axis_base.x, stage2_tv_pts.axis_base.y,
                     stage2_tv_pts.axis_top.x, stage2_tv_pts.axis_top.y],
            dashed: true, color: '#d32f2f'
        });
        applyVisibility(stage2_tv_pts, stage2_tv_prims, 'tv');
        constructionStep(2, stage2_tv_prims);
        if (data.base_shape !== 'circle') {
            this.addOrthographicSolidLabels(stage1_fv_pts, stage2_tv_pts, stage1_fv_pts, baseKeys, topKeys, isPrism, 2, ['tv']);
        }

        // VP angle dimension on TV axis
        const axisTop2 = stage2_tv_pts.axis_top;
        const axisBase2 = stage2_tv_pts.axis_base;
        // The axis should form an angle with the XY line (horizontal at XY_LINE_Y)
        const xyIntersect2 = this.getAxisXYIntersection(axisBase2, axisTop2);
        const axisAngleRad2 = Math.atan2(axisTop2.y - xyIntersect2.y, axisTop2.x - xyIntersect2.x);
        if (Math.abs(axisTop2.x - axisBase2.x) > 0.01 || Math.abs(axisTop2.y - axisBase2.y) > 0.01) {
            this.primitives.push({
                type: 'line', key: 'dim-axis-ext-vp',
                points: [axisBase2.x, axisBase2.y, xyIntersect2.x, xyIntersect2.y],
                dashed: true, color: 'grey', step: this.lastStep + 1
            });
            this.addAngleDimension(xyIntersect2, 0, axisAngleRad2, 50,
                this.formatAngleLabel(vpAngle), 'dim-angle-vp');
        }

        // Project new FV from rotated TV (Stage 2 → FV)
        // x stays same as TV, y comes from stage1 FV elevation
        const stage2_fv_pts: PointMap = {};
        allKeys.forEach(key => {
            stage2_fv_pts[key] = {
                x: stage2_tv_pts[key].x,
                y: stage1_fv_pts[key].y,
                z: stage2_tv_pts[key].y - this.XY_LINE_Y,  // depth below XY
            };
            // Projection lines: horizontal from stage1 FV to new FV x-position
            this.primitives.push({
                type: 'line', key: `proj-h-${key}`,
                points: [stage1_fv_pts[key].x, stage1_fv_pts[key].y,
                         stage2_fv_pts[key].x, stage1_fv_pts[key].y],
                dashed: true, step: 3, color: '#e0e0e0'
            });
            // Vertical projector from TV to FV
            this.primitives.push({
                type: 'line', key: `proj-v-${key}`,
                points: [stage2_tv_pts[key].x, stage2_tv_pts[key].y,
                         stage2_fv_pts[key].x, stage2_fv_pts[key].y],
                dashed: true, step: 3, color: '#e0e0e0'
            });
        });

        const stage2_fv_prims: SvgPrimitive[] = [];
        for (let i = 0; i < numSides; i++) {
            stage2_fv_prims.push({
                type: 'line', key: `s2-fv-base-${i}`,
                points: [stage2_fv_pts[baseKeys[i]].x, stage2_fv_pts[baseKeys[i]].y,
                         stage2_fv_pts[baseKeys[(i + 1) % numSides]].x, stage2_fv_pts[baseKeys[(i + 1) % numSides]].y],
                dashed: false
            });
        }
        if (isPrism) {
            for (let i = 0; i < numSides; i++) {
                stage2_fv_prims.push({
                    type: 'line', key: `s2-fv-top-${i}`,
                    points: [stage2_fv_pts[topKeys[i]].x, stage2_fv_pts[topKeys[i]].y,
                             stage2_fv_pts[topKeys[(i + 1) % numSides]].x, stage2_fv_pts[topKeys[(i + 1) % numSides]].y],
                    dashed: false
                });
                stage2_fv_prims.push({
                    type: 'line', key: `s2-fv-side-${i}`,
                    points: [stage2_fv_pts[baseKeys[i]].x, stage2_fv_pts[baseKeys[i]].y,
                             stage2_fv_pts[topKeys[i]].x, stage2_fv_pts[topKeys[i]].y],
                    dashed: false
                });
            }
        } else {
            for (let i = 0; i < numSides; i++) {
                stage2_fv_prims.push({
                    type: 'line', key: `s2-fv-slant-${i}`,
                    points: [stage2_fv_pts.apex.x, stage2_fv_pts.apex.y,
                             stage2_fv_pts[baseKeys[i]].x, stage2_fv_pts[baseKeys[i]].y],
                    dashed: false
                });
            }
        }
        stage2_fv_prims.push({
            type: 'line', key: 's2-fv-axis',
            points: [stage2_fv_pts.axis_base.x, stage2_fv_pts.axis_base.y,
                     stage2_fv_pts.axis_top.x, stage2_fv_pts.axis_top.y],
            dashed: true, color: '#d32f2f'
        });
        applyVisibility(stage2_fv_pts, stage2_fv_prims, 'fv');
        constructionStep(3, stage2_fv_prims);
        if (data.base_shape !== 'circle') {
            this.addOrthographicSolidLabels(stage1_fv_pts, stage2_tv_pts, stage2_fv_pts, baseKeys, topKeys, isPrism, 3, ['fv']);
        }

        // If no HP inclination, finalize here
        if (hpAngle === 0) {
            // Step 4: Stage 2 TV rotation (the tilted base plan)
            stage2_tv_prims.forEach(p => this.primitives.push({ ...p, step: 4, color: '#004d40', primitiveRole: 'visible' }));

            // Step 5: Stage 2 FV projection (the final inclined elevation)
            stage2_fv_prims.forEach(p => this.primitives.push({ ...p, step: 5, color: '#004d40', primitiveRole: 'visible' }));

            // Step 6: Finalize
            finalStep(6, [...stage2_tv_prims, ...stage2_fv_prims]);
            addVpSolidDimensions();
            return;
        }

        // ===========================================================
        // Stage 3: HP Inclination — Rotate FV, project new TV
        // ===========================================================
        const rot_angle_hp = this.degToRad(hpAngle);

        const maxX_stage2 = Math.max(...Object.values(stage2_fv_pts).map(p => p.x));
        const buffer_s3 = 150;
        const pivot_s2 = stage2_fv_pts[baseKeys[0]];

        const temp_rotated_fv_pts: PointMap = {};
        allKeys.forEach(key => {
            temp_rotated_fv_pts[key] = this.rotatePoint(stage2_fv_pts[key], pivot_s2, rot_angle_hp);
        });

        const minX_rotated_fv = Math.min(...Object.values(temp_rotated_fv_pts).map(p => p.x));
        const shiftX_s3 = (maxX_stage2 + buffer_s3) - minX_rotated_fv;
        const shiftY_s3 = pivot_s2.y - temp_rotated_fv_pts[baseKeys[0]].y;

        const stage3_fv_pts: PointMap = {};
        allKeys.forEach(key => {
            const temp_p = temp_rotated_fv_pts[key];
            stage3_fv_pts[key] = {
                x: temp_p.x + shiftX_s3,
                y: temp_p.y + shiftY_s3,
                z: stage2_fv_pts[key].z,
            };
        });

        const stage3_fv_prims: SvgPrimitive[] = [];
        for (let i = 0; i < numSides; i++) {
            stage3_fv_prims.push({
                type: 'line', key: `s3-fv-base-${i}`,
                points: [stage3_fv_pts[baseKeys[i]].x, stage3_fv_pts[baseKeys[i]].y,
                         stage3_fv_pts[baseKeys[(i + 1) % numSides]].x, stage3_fv_pts[baseKeys[(i + 1) % numSides]].y],
                dashed: false
            });
        }
        if (isPrism) {
            for (let i = 0; i < numSides; i++) {
                stage3_fv_prims.push({
                    type: 'line', key: `s3-fv-top-${i}`,
                    points: [stage3_fv_pts[topKeys[i]].x, stage3_fv_pts[topKeys[i]].y,
                             stage3_fv_pts[topKeys[(i + 1) % numSides]].x, stage3_fv_pts[topKeys[(i + 1) % numSides]].y],
                    dashed: false
                });
                stage3_fv_prims.push({
                    type: 'line', key: `s3-fv-side-${i}`,
                    points: [stage3_fv_pts[baseKeys[i]].x, stage3_fv_pts[baseKeys[i]].y,
                             stage3_fv_pts[topKeys[i]].x, stage3_fv_pts[topKeys[i]].y],
                    dashed: false
                });
            }
        } else {
            for (let i = 0; i < numSides; i++) {
                stage3_fv_prims.push({
                    type: 'line', key: `s3-fv-slant-${i}`,
                    points: [stage3_fv_pts.apex.x, stage3_fv_pts.apex.y,
                             stage3_fv_pts[baseKeys[i]].x, stage3_fv_pts[baseKeys[i]].y],
                    dashed: false
                });
            }
        }
        stage3_fv_prims.push({
            type: 'line', key: 's3-fv-axis',
            points: [stage3_fv_pts.axis_base.x, stage3_fv_pts.axis_base.y,
                     stage3_fv_pts.axis_top.x, stage3_fv_pts.axis_top.y],
            dashed: true, color: '#d32f2f'
        });
        applyVisibility(stage3_fv_pts, stage3_fv_prims, 'fv');
        constructionStep(4, stage3_fv_prims);
        if (data.base_shape !== 'circle') {
            this.addOrthographicSolidLabels(stage1_fv_pts, stage2_tv_pts, stage3_fv_pts, baseKeys, topKeys, isPrism, 4, ['fv']);
        }

        // Project new TV from rotated FV
        const stage3_tv_pts: PointMap = {};
        allKeys.forEach(key => {
            stage3_tv_pts[key] = {
                x: stage3_fv_pts[key].x,
                y: stage2_tv_pts[key].y,
                z: this.XY_LINE_Y - stage3_fv_pts[key].y,
            };
            // Projection lines
            this.primitives.push({
                type: 'line', key: `proj-h-s3-${key}`,
                points: [stage2_tv_pts[key].x, stage2_tv_pts[key].y,
                         stage3_tv_pts[key].x, stage3_tv_pts[key].y],
                dashed: true, step: 5, color: '#e0e0e0'
            });
            this.primitives.push({
                type: 'line', key: `proj-v-s3-${key}`,
                points: [stage3_fv_pts[key].x, stage3_fv_pts[key].y,
                         stage3_tv_pts[key].x, stage3_tv_pts[key].y],
                dashed: true, step: 5, color: '#e0e0e0'
            });
        });

        const stage3_tv_prims: SvgPrimitive[] = [];
        for (let i = 0; i < numSides; i++) {
            stage3_tv_prims.push({
                type: 'line', key: `s3-tv-base-${i}`,
                points: [stage3_tv_pts[baseKeys[i]].x, stage3_tv_pts[baseKeys[i]].y,
                         stage3_tv_pts[baseKeys[(i + 1) % numSides]].x, stage3_tv_pts[baseKeys[(i + 1) % numSides]].y],
                dashed: false
            });
        }
        if (isPrism) {
            for (let i = 0; i < numSides; i++) {
                stage3_tv_prims.push({
                    type: 'line', key: `s3-tv-top-${i}`,
                    points: [stage3_tv_pts[topKeys[i]].x, stage3_tv_pts[topKeys[i]].y,
                             stage3_tv_pts[topKeys[(i + 1) % numSides]].x, stage3_tv_pts[topKeys[(i + 1) % numSides]].y],
                    dashed: false
                });
                stage3_tv_prims.push({
                    type: 'line', key: `s3-tv-side-${i}`,
                    points: [stage3_tv_pts[baseKeys[i]].x, stage3_tv_pts[baseKeys[i]].y,
                             stage3_tv_pts[topKeys[i]].x, stage3_tv_pts[topKeys[i]].y],
                    dashed: false
                });
            }
        } else {
            for (let i = 0; i < numSides; i++) {
                stage3_tv_prims.push({
                    type: 'line', key: `s3-tv-slant-${i}`,
                    points: [stage3_tv_pts.apex.x, stage3_tv_pts.apex.y,
                             stage3_tv_pts[baseKeys[i]].x, stage3_tv_pts[baseKeys[i]].y],
                    dashed: false
                });
            }
        }
        stage3_tv_prims.push({
            type: 'line', key: 's3-tv-axis',
            points: [stage3_tv_pts.axis_base.x, stage3_tv_pts.axis_base.y,
                     stage3_tv_pts.axis_top.x, stage3_tv_pts.axis_top.y],
            dashed: true, color: '#d32f2f'
        });
        applyVisibility(stage3_tv_pts, stage3_tv_prims, 'tv');
        constructionStep(5, stage3_tv_prims);
        if (data.base_shape !== 'circle') {
            this.addOrthographicSolidLabels(stage1_fv_pts, stage3_tv_pts, stage3_fv_pts, baseKeys, topKeys, isPrism, 5, ['tv']);
        }

        // HP angle dimension on FV
        const axisTop3 = stage3_fv_pts.axis_top;
        const axisBase3 = stage3_fv_pts.axis_base;
        if (Math.abs(axisTop3.x - axisBase3.x) > 0.01 || Math.abs(axisTop3.y - axisBase3.y) > 0.01) {
            const xyIntersect3 = this.getAxisXYIntersection(axisTop3, axisBase3);
            const axisAngleRad3 = Math.atan2(axisTop3.y - xyIntersect3.y, axisTop3.x - xyIntersect3.x);
            this.primitives.push({
                type: 'line', key: 'dim-axis-ext-hp',
                points: [axisBase3.x, axisBase3.y, xyIntersect3.x, xyIntersect3.y],
                dashed: true, color: 'grey', step: this.lastStep + 1
            });
            this.addAngleDimension(xyIntersect3, 0, axisAngleRad3, 50,
                this.formatAngleLabel(hpAngle), 'dim-angle-hp');
        }

        finalStep(6, [...stage3_tv_prims, ...stage3_fv_prims]);
        addVpSolidDimensions();
    }

    public projectLongitudinalSection(data: SectionSolidSchema) {
        const CONSTRUCTION_COLOR = '#b0bec5';
        const CUTTING_PLANE_COLOR = '#c62828';
        const SECTION_COLOR = '#00695c';
        const baseSide = (data.base_size_mm.side_mm || data.base_size_mm.diameter_mm || 0) * this.SCALE;
        const height = data.axis_length_mm * this.SCALE;
        const numSides = data.base_shape === 'triangle' ? 3
            : data.base_shape === 'square' ? 4
                : data.base_shape === 'pentagon' ? 5
                    : data.base_shape === 'hexagon' ? 6
                        : 48;
        const isPrism = data.solid_type === 'prism';
        const center = {
            x: this.ORIGIN_X + baseSide * 1.5,
            y: this.XY_LINE_Y + baseSide * 1.5,
        };
        const orientation = this.getBaseOrientationAngle(data.base_shape, data.base_size_mm, data.base_orientation);
        const baseVertices = data.base_shape === 'circle'
            ? Array.from({ length: numSides }, (_, index) => {
                const angle = index * 2 * Math.PI / numSides;
                return { x: center.x + baseSide / 2 * Math.cos(angle), y: center.y + baseSide / 2 * Math.sin(angle), z: 0 };
            })
            : this.getPolygonVertices(numSides, baseSide, center.x, center.y, orientation).map(point => ({ ...point, z: 0 }));
        const topVertices = isPrism
            ? baseVertices.map(point => ({ ...point, z: height }))
            : [];
        const apex = { x: center.x, y: center.y, z: height };

        // Step 1: simple position.
        if (data.base_shape === 'circle') {
            this.primitives.push({ type: 'circle', key: 'long-step-1-tv-base-circle', cx: center.x, cy: center.y, r: baseSide / 2, dashed: false, color: CONSTRUCTION_COLOR, step: 1 });
        } else {
            for (let index = 0; index < numSides; index++) {
                const next = (index + 1) % numSides;
                this.primitives.push({ type: 'line', key: `long-step-1-tv-base-${index}`, points: [baseVertices[index].x, baseVertices[index].y, baseVertices[next].x, baseVertices[next].y], dashed: false, color: CONSTRUCTION_COLOR, step: 1 });
            }
        }
        if (!isPrism) {
            for (let index = 0; index < numSides; index++) {
                this.primitives.push({ type: 'line', key: `long-step-1-tv-slant-${index}`, points: [center.x, center.y, baseVertices[index].x, baseVertices[index].y], dashed: true, color: CONSTRUCTION_COLOR, step: 1 });
            }
        }
        const minBaseX = Math.min(...baseVertices.map(point => point.x));
        const maxBaseX = Math.max(...baseVertices.map(point => point.x));
        if (isPrism) {
            this.primitives.push({ type: 'line', key: 'long-step-1-fv-base', points: [minBaseX, this.XY_LINE_Y, maxBaseX, this.XY_LINE_Y], dashed: false, color: CONSTRUCTION_COLOR, step: 1 });
            this.primitives.push({ type: 'line', key: 'long-step-1-fv-top', points: [minBaseX, this.XY_LINE_Y - height, maxBaseX, this.XY_LINE_Y - height], dashed: false, color: CONSTRUCTION_COLOR, step: 1 });
            this.primitives.push({ type: 'line', key: 'long-step-1-fv-left', points: [minBaseX, this.XY_LINE_Y, minBaseX, this.XY_LINE_Y - height], dashed: false, color: CONSTRUCTION_COLOR, step: 1 });
            this.primitives.push({ type: 'line', key: 'long-step-1-fv-right', points: [maxBaseX, this.XY_LINE_Y, maxBaseX, this.XY_LINE_Y - height], dashed: false, color: CONSTRUCTION_COLOR, step: 1 });
        } else {
            this.primitives.push({ type: 'line', key: 'long-step-1-fv-base', points: [minBaseX, this.XY_LINE_Y, maxBaseX, this.XY_LINE_Y], dashed: false, color: CONSTRUCTION_COLOR, step: 1 });
            this.primitives.push({ type: 'line', key: 'long-step-1-fv-left', points: [minBaseX, this.XY_LINE_Y, center.x, this.XY_LINE_Y - height], dashed: false, color: CONSTRUCTION_COLOR, step: 1 });
            this.primitives.push({ type: 'line', key: 'long-step-1-fv-right', points: [maxBaseX, this.XY_LINE_Y, center.x, this.XY_LINE_Y - height], dashed: false, color: CONSTRUCTION_COLOR, step: 1 });
        }
        this.primitives.push({ type: 'line', key: 'long-step-1-axis-tv', points: [center.x - baseSide * 0.65, center.y, center.x + baseSide * 0.65, center.y], dashed: true, color: '#d32f2f', step: 1, primitiveRole: 'axis' });
        this.primitives.push({ type: 'line', key: 'long-step-1-axis-fv', points: [center.x, this.XY_LINE_Y, center.x, this.XY_LINE_Y - height], dashed: true, color: '#d32f2f', step: 1, primitiveRole: 'axis' });
        this.primitives.push({ type: 'text', key: 'long-fv-label', x: center.x, y: this.XY_LINE_Y - height - 25, content: 'F.V.', color: '#616161', step: 1, textAnchor: 'middle', primitiveRole: 'caption' });
        this.primitives.push({ type: 'text', key: 'long-tv-label', x: center.x, y: center.y + baseSide, content: 'T.V.', color: '#616161', step: 1, textAnchor: 'middle', primitiveRole: 'caption' });

        // Step 2: edge view of the vertical cutting plane in TV.
        const angleMagnitude = this.degToRad(data.cutting_plane.inclination_with_VP_deg || 0);
        const planeAngle = data.cutting_plane.direction === 'counterclockwise' ? -angleMagnitude : angleMagnitude;
        const direction = { x: Math.cos(planeAngle), y: Math.sin(planeAngle) };
        const normal = { x: -direction.y, y: direction.x };
        const passage = data.cutting_plane.passes_through;
        const offsetMagnitude = typeof passage === 'object' && 'distance_from_axis_mm' in passage
            ? passage.distance_from_axis_mm * this.SCALE
            : 0;
        const offsetSign = typeof passage === 'object' && 'distance_from_axis_mm' in passage && (passage.towards === 'behind' || passage.towards === 'below') ? -1 : 1;
        const cornerOffset = typeof passage === 'object' && 'distance_from_base_corner_mm' in passage
            ? (() => {
                const projections = baseVertices.map(point => normal.x * (point.x - center.x) + normal.y * (point.y - center.y));
                const fromPositiveExtreme = passage.corner === 'front' || passage.corner === 'above';
                const extreme = fromPositiveExtreme ? Math.max(...projections) : Math.min(...projections);
                const inward = passage.distance_from_base_corner_mm * this.SCALE;
                return extreme + (fromPositiveExtreme ? -inward : inward);
            })()
            : undefined;
        const signedOffset = cornerOffset ?? offsetMagnitude * offsetSign;
        const planePoint = { x: center.x + normal.x * signedOffset, y: center.y + normal.y * signedOffset };
        const planeExtent = Math.max(baseSide * 1.15, 80);
        const planeStart = { x: planePoint.x - direction.x * planeExtent, y: planePoint.y - direction.y * planeExtent };
        const planeEnd = { x: planePoint.x + direction.x * planeExtent, y: planePoint.y + direction.y * planeExtent };
        this.primitives.push({ type: 'line', key: 'long-step-2-cutting-plane-tv', points: [planeStart.x, planeStart.y, planeEnd.x, planeEnd.y], dashed: true, color: CUTTING_PLANE_COLOR, step: 2, primitiveRole: 'construction' });
        this.primitives.push({ type: 'text', key: 'long-step-2-plane-label', x: planeEnd.x + 8, y: planeEnd.y, content: 'Cutting plane', color: CUTTING_PLANE_COLOR, step: 2, primitiveRole: 'caption' });
        this.primitives.push({ type: 'text', key: 'long-step-2-angle-label', x: planePoint.x + 18, y: planePoint.y - 12, content: this.formatAngleLabel(data.cutting_plane.inclination_with_VP_deg || 0), color: CUTTING_PLANE_COLOR, step: 2, primitiveRole: 'dimension' });

        type MeshPoint = { x: number; y: number; z: number };
        const edges: Array<[MeshPoint, MeshPoint]> = [];
        for (let index = 0; index < numSides; index++) {
            const next = (index + 1) % numSides;
            edges.push([baseVertices[index], baseVertices[next]]);
            if (isPrism) {
                edges.push([topVertices[index], topVertices[next]]);
                edges.push([baseVertices[index], topVertices[index]]);
            } else {
                edges.push([baseVertices[index], apex]);
            }
        }
        const signedDistance = (point: MeshPoint) => normal.x * (point.x - center.x) + normal.y * (point.y - center.y) - signedOffset;
        const intersections: MeshPoint[] = [];
        const addIntersection = (point: MeshPoint) => {
            if (!intersections.some(existing => Math.hypot(existing.x - point.x, existing.y - point.y, existing.z - point.z) < 0.5)) {
                intersections.push(point);
            }
        };
        for (const [start, end] of edges) {
            const startDistance = signedDistance(start);
            const endDistance = signedDistance(end);
            if (Math.abs(startDistance) < 1e-7) addIntersection({ ...start });
            if (Math.abs(endDistance) < 1e-7) addIntersection({ ...end });
            if (startDistance * endDistance < -1e-7) {
                const ratio = startDistance / (startDistance - endDistance);
                addIntersection({
                    x: start.x + ratio * (end.x - start.x),
                    y: start.y + ratio * (end.y - start.y),
                    z: start.z + ratio * (end.z - start.z),
                });
            }
        }

        if (intersections.length < 3) {
            this.primitives.push({ type: 'text', key: 'long-section-error', x: center.x, y: 60, content: 'The longitudinal plane does not create a finite section.', color: '#c62828', step: 3, primitiveRole: 'caption', textAnchor: 'middle' });
            return;
        }
        const sectionCoordinates = intersections.map(point => ({
            point,
            u: direction.x * (point.x - planePoint.x) + direction.y * (point.y - planePoint.y),
            v: point.z,
        }));
        const centroid = sectionCoordinates.reduce((sum, item) => ({ u: sum.u + item.u, v: sum.v + item.v }), { u: 0, v: 0 });
        centroid.u /= sectionCoordinates.length;
        centroid.v /= sectionCoordinates.length;
        sectionCoordinates.sort((left, right) => Math.atan2(left.v - centroid.v, left.u - centroid.u) - Math.atan2(right.v - centroid.v, right.u - centroid.u));

        // Step 3: project section points between TV and FV.
        sectionCoordinates.forEach((item, index) => {
            const fv = { x: item.point.x, y: this.XY_LINE_Y - item.point.z };
            this.primitives.push({ type: 'line', key: `long-step-3-projector-${index}`, points: [item.point.x, item.point.y, fv.x, fv.y], dashed: true, color: '#cfd8dc', step: 3, primitiveRole: 'projection' });
            this.primitives.push({ type: 'circle', key: `long-step-3-tv-point-${index}`, cx: item.point.x, cy: item.point.y, r: 2.5, dashed: false, color: SECTION_COLOR, step: 3, primitiveRole: 'visible' });
            this.primitives.push({ type: 'text', key: `long-step-3-tv-label-${index}`, x: item.point.x + 5, y: item.point.y - 5, content: `${index + 1}`, color: SECTION_COLOR, step: 3, primitiveRole: 'label' });
            this.primitives.push({ type: 'text', key: `long-step-3-fv-label-${index}`, x: fv.x + 5, y: fv.y - 5, content: `${index + 1}'`, color: SECTION_COLOR, step: 3, primitiveRole: 'label' });
        });

        // Step 4: sectional FV (or edge view when the plane is perpendicular to VP).
        const fvSection = sectionCoordinates.map(item => ({ x: item.point.x, y: this.XY_LINE_Y - item.point.z }));
        const projectedArea = Math.abs(fvSection.reduce((sum, point, index) => {
            const next = fvSection[(index + 1) % fvSection.length];
            return sum + point.x * next.y - next.x * point.y;
        }, 0) / 2);
        const wantsSectionalFV = data.required_outputs.sectional_front_view !== false;
        if (wantsSectionalFV) {
            if (projectedArea > 1) {
                const fvPath = `${fvSection.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ')} Z`;
                this.primitives.push({ type: 'path', key: 'long-step-4-section-fv', d: fvPath, dashed: false, color: SECTION_COLOR, fill: 'url(#hatch)', step: 4, primitiveRole: 'visible' });
            } else {
                const sorted = [...fvSection].sort((left, right) => left.y - right.y);
                this.primitives.push({ type: 'line', key: 'long-step-4-section-fv-edge', points: [sorted[0].x, sorted[0].y, sorted[sorted.length - 1].x, sorted[sorted.length - 1].y], dashed: false, color: SECTION_COLOR, step: 4, primitiveRole: 'visible' });
                this.primitives.push({ type: 'text', key: 'long-step-4-edge-caption', x: sorted[0].x + 12, y: sorted[0].y, content: 'Section seen edge-on in FV', color: SECTION_COLOR, step: 4, primitiveRole: 'caption' });
            }
        }
        if (data.cutting_plane.retained_portion === 'front' || data.cutting_plane.retained_portion === 'behind') {
            const keepPositive = data.cutting_plane.retained_portion === 'front';
            const clipped: MeshPoint[] = [];
            const inside = (point: MeshPoint) => keepPositive ? signedDistance(point) >= -1e-7 : signedDistance(point) <= 1e-7;
            for (let index = 0; index < baseVertices.length; index++) {
                const current = baseVertices[index];
                const next = baseVertices[(index + 1) % baseVertices.length];
                const currentInside = inside(current);
                const nextInside = inside(next);
                if (currentInside) clipped.push(current);
                if (currentInside !== nextInside) {
                    const currentDistance = signedDistance(current);
                    const nextDistance = signedDistance(next);
                    const ratio = currentDistance / (currentDistance - nextDistance);
                    clipped.push({
                        x: current.x + ratio * (next.x - current.x),
                        y: current.y + ratio * (next.y - current.y),
                        z: 0,
                    });
                }
            }
            if (clipped.length >= 3) {
                const retainedPath = `${clipped.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ')} Z`;
                this.primitives.push({ type: 'path', key: 'long-step-4-retained-tv', d: retainedPath, dashed: false, color: '#263238', fill: 'none', step: 4, primitiveRole: 'visible' });
                this.primitives.push({ type: 'text', key: 'long-step-4-retained-caption', x: center.x, y: center.y + baseSide * 0.85, content: `${data.cutting_plane.retained_portion} portion retained`, color: '#263238', step: 4, textAnchor: 'middle', primitiveRole: 'caption' });
            }
        }

        // Step 5: true shape in the cutting plane, using exact in-plane coordinates.
        if (data.required_outputs.true_shape) {
            const minU = Math.min(...sectionCoordinates.map(item => item.u));
            const maxU = Math.max(...sectionCoordinates.map(item => item.u));
            const trueOriginX = Math.max(maxBaseX + 180, center.x + baseSide * 1.8);
            const trueBaseY = this.XY_LINE_Y;
            const trueShape = sectionCoordinates.map(item => ({ x: trueOriginX + item.u - minU, y: trueBaseY - item.v }));
            this.primitives.push({ type: 'line', key: 'long-step-5-aux-axis', points: [trueOriginX - 20, trueBaseY, trueOriginX + (maxU - minU) + 20, trueBaseY], dashed: false, color: '#424242', step: 5, primitiveRole: 'construction' });
            this.primitives.push({ type: 'text', key: 'long-step-5-x1', x: trueOriginX - 30, y: trueBaseY + 5, content: 'X1', color: '#424242', step: 5, primitiveRole: 'label' });
            this.primitives.push({ type: 'text', key: 'long-step-5-y1', x: trueOriginX + (maxU - minU) + 25, y: trueBaseY + 5, content: 'Y1', color: '#424242', step: 5, primitiveRole: 'label' });
            trueShape.forEach((point, index) => {
                if (Math.abs(point.y - trueBaseY) > 0.5) {
                    this.primitives.push({ type: 'line', key: `long-step-5-projector-${index}`, points: [point.x, trueBaseY, point.x, point.y], dashed: true, color: '#cfd8dc', step: 5, primitiveRole: 'projection' });
                }
            });
            const truePath = `${trueShape.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ')} Z`;
            this.primitives.push({ type: 'path', key: 'long-step-5-true-shape', d: truePath, dashed: false, color: SECTION_COLOR, fill: 'url(#hatch)', step: 5, primitiveRole: 'visible' });
            this.addSequentialPointLabels(trueShape, trueShape.map((_, index) => `${index + 1}`), 5, 'long-step-5-true', true, 'generic', true);
            this.primitives.push({ type: 'text', key: 'long-step-5-caption', x: trueOriginX + (maxU - minU) / 2, y: trueBaseY - height - 25, content: 'TRUE SHAPE', color: SECTION_COLOR, step: 5, textAnchor: 'middle', primitiveRole: 'caption' });
            this.addLinearDimension(
                { x: trueOriginX, y: trueBaseY },
                { x: trueOriginX + (maxU - minU), y: trueBaseY },
                this.formatLengthLabel((maxU - minU) / this.SCALE),
                this.DIM_OFFSET,
                false,
                'dim-long-true-width',
            );
        }

        this.addLinearDimension({ x: minBaseX, y: this.XY_LINE_Y }, { x: minBaseX, y: this.XY_LINE_Y - height }, this.formatLengthLabel(data.axis_length_mm), -this.DIM_OFFSET, true, 'dim-long-axis');
        if (data.base_shape === 'circle' && data.base_size_mm.diameter_mm) {
            this.addLinearDimension({ x: minBaseX, y: center.y }, { x: maxBaseX, y: center.y }, `⌀${this.formatLengthLabel(data.base_size_mm.diameter_mm)}`, this.DIM_OFFSET, false, 'dim-long-base');
        } else if (data.base_size_mm.side_mm) {
            this.addLinearDimension(baseVertices[0], baseVertices[1], this.formatLengthLabel(data.base_size_mm.side_mm), this.DIM_OFFSET, false, 'dim-long-base', true);
        }
    }

    private projectSectionedSolid(data: SectionSolidSchema) {
        projectSectionedSolid(this, data);
    }

    private projectPlaneSurface(data: PlaneSurfaceSchema) {
        projectPlaneSurface(this, data);
    }

    private projectPerspectiveProjection(data: PerspectiveProjectionSchema) {
        projectPerspectiveProjection(this, data);
    }

    private projectIsometricProjection(data: IsometricProjectionSchema) {
        projectIsometricProjection(this, data);
    }

    private projectAdvancedSection(data: AdvancedSectionSchema) {
        projectAdvancedSection(this, data);
    }

    private projectAdvancedDevelopment(data: AdvancedDevelopmentSchema) {
        projectAdvancedDevelopment(this, data);
    }

    private projectCompositeSolid(data: CompositeSolidSchema) {
        projectCompositeSolid(this, data);
    }
    public projectAuxiliaryView(data: AuxiliaryViewSchema) {
        const isPrism = ['prism', 'cylinder', 'cube'].includes(data.solid_type);
        const isCircle = data.base_shape === 'circle';
        
        const baseSide = (data.base_shape === 'rectangle'
            ? Math.max(data.base_size_mm.length_mm || 0, data.base_size_mm.breadth_mm || 0)
            : (data.base_size_mm.side_mm || data.base_size_mm.diameter_mm || 0)) * this.SCALE;
            
        const height = data.axis_length_mm * this.SCALE;
        
        let numSides = 0;
        switch (data.base_shape) {
            case 'triangle': numSides = 3; break;
            case 'square': numSides = 4; break;
            case 'pentagon': numSides = 5; break;
            case 'hexagon': numSides = 6; break;
            case 'rectangle': numSides = 4; break;
            case 'circle': numSides = 12; break;
            default:
                this.primitives.push({ type: 'text', key: 'error', x: 200, y: 200, content: `Base shape '${data.base_shape}' not supported.`, step: 1 });
                return;
        }

        this.addXYLine();

        // Layout: TV below XY line, FV above XY line (left side), AV to the right of X₁Y₁
        const center = {
            x: this.ORIGIN_X + 150,
            y: this.XY_LINE_Y + baseSide + 20,
        };
        
        const orientation = this.getBaseOrientationAngle(data.base_shape, data.base_size_mm, data.base_orientation);
        
        const tvBaseVertices = isCircle
            ? Array.from({ length: numSides }, (_, index) => {
                const angle = index * 2 * Math.PI / numSides;
                return { x: center.x + baseSide / 2 * Math.cos(angle), y: center.y + baseSide / 2 * Math.sin(angle), z: 0 };
            })
            : this.getPolygonVertices(center.x, center.y, baseSide, numSides, orientation);

        const labelChars = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l'];
        const primeChars = ["a'", "b'", "c'", "d'", "e'", "f'", "g'", "h'", "i'", "j'", "k'", "l'"];
        const showLabels = !isCircle && numSides <= labelChars.length;

        // =====================================================================
        // STEP 1 — Draw TV (top view / plan) with vertex labels
        // =====================================================================
        this.primitives.push({
            type: 'path',
            key: 'tv-base',
            d: 'M ' + tvBaseVertices.map(v => `${v.x} ${v.y}`).join(' L ') + ' Z',
            dashed: false,
            color: '#004d40',
            step: 1,
            fill: 'none',
            primitiveRole: 'visible'
        });

        if (showLabels) {
            for (let i = 0; i < numSides; i++) {
                const v = tvBaseVertices[i];
                const dx = v.x - center.x; const dy = v.y - center.y;
                const len = Math.hypot(dx, dy) || 1;
                this.primitives.push({
                    type: 'text', key: `tv-label-${i}`,
                    x: v.x + (dx / len) * 10, y: v.y + (dy / len) * 10,
                    content: labelChars[i], step: 1, primitiveRole: 'label'
                });
            }
        }
        this.primitives.push({ type: 'text', key: 'tv-caption', x: center.x, y: center.y + baseSide / 2 + 28, content: 'T.V.', step: 1, primitiveRole: 'caption' });

        // =====================================================================
        // STEP 1 — Draw FV (front view / elevation) above XY line
        // =====================================================================
        const fvBaseY = this.XY_LINE_Y;
        const fvTopY  = this.XY_LINE_Y - height;
        const fvBaseVertices = tvBaseVertices.map(v => ({ x: v.x, y: fvBaseY, z: 0 }));
        const fvTopVertices  = tvBaseVertices.map(v => ({ x: v.x, y: fvTopY,  z: 0 }));
        const fvMinX = Math.min(...fvBaseVertices.map(v => v.x));
        const fvMaxX = Math.max(...fvBaseVertices.map(v => v.x));

        // Vertical projection lines TV→FV (thin dashed)
        for (let i = 0; i < numSides; i++) {
            this.primitives.push({
                type: 'line', key: `fv-projector-${i}`,
                points: [tvBaseVertices[i].x, tvBaseVertices[i].y, fvBaseVertices[i].x, fvBaseVertices[i].y] as [number, number, number, number],
                dashed: true, color: '#aaaaaa', step: 1, primitiveRole: 'projection'
            });
        }
        // FV base and top horizontal edges
        this.primitives.push({
            type: 'line', key: 'fv-base-edge',
            points: [fvMinX, fvBaseY, fvMaxX, fvBaseY] as [number, number, number, number],
            dashed: false, color: '#004d40', step: 1, primitiveRole: 'visible'
        });
        this.primitives.push({
            type: 'line', key: 'fv-top-edge',
            points: [fvMinX, fvTopY, fvMaxX, fvTopY] as [number, number, number, number],
            dashed: false, color: '#004d40', step: 1, primitiveRole: 'visible'
        });
        // FV lateral generators (outline visible, inner edges hidden)
        const sortedFvX = [...fvBaseVertices.map(v => v.x)].sort((a, b) => a - b);
        for (let i = 0; i < numSides; i++) {
            const topY = isPrism ? fvTopVertices[i].y : fvTopY;
            const topX = isPrism ? fvTopVertices[i].x : (fvMinX + fvMaxX) / 2;
            const isOuterEdge = Math.abs(fvBaseVertices[i].x - sortedFvX[0]) < 1 || Math.abs(fvBaseVertices[i].x - sortedFvX[sortedFvX.length - 1]) < 1;
            this.primitives.push({
                type: 'line', key: `fv-generator-${i}`,
                points: [fvBaseVertices[i].x, fvBaseVertices[i].y, topX, topY] as [number, number, number, number],
                dashed: !isOuterEdge, color: '#004d40', step: 1,
                primitiveRole: isOuterEdge ? 'visible' : 'hidden'
            });
        }
        // FV labels on leftmost edge
        if (showLabels) {
            for (let i = 0; i < numSides; i++) {
                if (Math.abs(fvBaseVertices[i].x - sortedFvX[0]) < 1) {
                    this.primitives.push({ type: 'text', key: `fv-base-label-${i}`, x: fvBaseVertices[i].x - 14, y: fvBaseVertices[i].y + 4, content: labelChars[i], step: 1, primitiveRole: 'label' });
                    this.primitives.push({ type: 'text', key: `fv-top-label-${i}`,  x: fvTopVertices[i].x - 14,  y: fvTopVertices[i].y - 6,  content: labelChars[i], step: 1, primitiveRole: 'label' });
                }
            }
        }
        this.primitives.push({ type: 'text', key: 'fv-caption', x: (fvMinX + fvMaxX) / 2, y: fvTopY - 14, content: 'F.V.', step: 1, primitiveRole: 'caption' });

        // =====================================================================
        // STEP 2 — Draw the inclined reference plane X₁Y₁ with angle
        // =====================================================================
        const theta = data.inclination_deg * Math.PI / 180;
        const maxX = Math.max(...tvBaseVertices.map(v => v.x));
        const x1y1Anchor = { x: maxX + 60, y: center.y };
        const x1y1Length = 320;
        const dirX = Math.cos(theta);
        const dirY = Math.sin(theta);
        const perpAngle = theta - Math.PI / 2;

        const x1 = x1y1Anchor.x - x1y1Length * dirX;
        const y1 = x1y1Anchor.y - x1y1Length * dirY;
        const x2 = x1y1Anchor.x + x1y1Length * dirX;
        const y2 = x1y1Anchor.y + x1y1Length * dirY;

        this.primitives.push({
            type: 'line', key: 'x1y1-line',
            points: [x1, y1, x2, y2] as [number, number, number, number],
            dashed: false, color: '#000000', step: 2, primitiveRole: 'axis'
        });
        this.primitives.push({ type: 'text', key: 'x1-label', x: x1 - 14, y: y1 - 8,  content: 'X₁', step: 2, primitiveRole: 'label' });
        this.primitives.push({ type: 'text', key: 'y1-label', x: x2 + 8,  y: y2 + 10, content: 'Y₁', step: 2, primitiveRole: 'label' });

        // Inclination angle arc and label (showing angle to horizontal)
        const arcR = 32;
        const arcX2pt = x1y1Anchor.x + arcR * Math.cos(theta);
        const arcY2pt = x1y1Anchor.y + arcR * Math.sin(theta);
        const largeArc = theta > Math.PI ? 1 : 0;
        this.primitives.push({
            type: 'path', key: 'x1y1-angle-arc',
            d: `M ${x1y1Anchor.x + arcR} ${x1y1Anchor.y} A ${arcR} ${arcR} 0 ${largeArc} 1 ${arcX2pt} ${arcY2pt}`,
            dashed: false, color: '#555555', step: 2, fill: 'none', primitiveRole: 'dimension'
        });
        this.primitives.push({
            type: 'text', key: 'x1y1-angle-label',
            x: x1y1Anchor.x + arcR + 16, y: x1y1Anchor.y + (theta > 0 ? 10 : -8),
            content: `${data.inclination_deg}°`, step: 2, primitiveRole: 'dimension'
        });

        // =====================================================================
        // STEP 3 — Project TV corners perpendicular to X₁Y₁
        // =====================================================================
        const auxBaseVertices: {x: number, y: number, z: number}[] = [];
        const auxTopVertices:  {x: number, y: number, z: number}[] = [];
        const footOnLine: {x: number, y: number}[] = [];

        for (let i = 0; i < numSides; i++) {
            const tv = tvBaseVertices[i];
            const along = (tv.x - x1y1Anchor.x) * dirX + (tv.y - x1y1Anchor.y) * dirY;
            const projX = x1y1Anchor.x + along * dirX;
            const projY = x1y1Anchor.y + along * dirY;
            footOnLine.push({ x: projX, y: projY });

            // Projection line from TV vertex, through foot on X₁Y₁, extending to full height
            this.primitives.push({
                type: 'line', key: `aux-projector-${i}`,
                points: [tv.x, tv.y, projX + height * Math.cos(perpAngle), projY + height * Math.sin(perpAngle)] as [number, number, number, number],
                dashed: true, color: '#aaaaaa', step: 3, primitiveRole: 'projection'
            });

            auxBaseVertices.push({ x: projX,                               y: projY,                               z: 0 });
            auxTopVertices.push({  x: projX + height * Math.cos(perpAngle), y: projY + height * Math.sin(perpAngle), z: 0 });
        }

        // Cone apex projection
        const alongC = (center.x - x1y1Anchor.x) * dirX + (center.y - x1y1Anchor.y) * dirY;
        const projXC  = x1y1Anchor.x + alongC * dirX;
        const projYC  = x1y1Anchor.y + alongC * dirY;
        const auxApexX = projXC + height * Math.cos(perpAngle);
        const auxApexY = projYC + height * Math.sin(perpAngle);

        // =====================================================================
        // STEP 4 — Height transfer: tick marks on X₁Y₁ + height extension lines
        // =====================================================================
        const tickLen = 6;
        for (let i = 0; i < numSides; i++) {
            const foot = footOnLine[i];
            this.primitives.push({
                type: 'line', key: `aux-tick-${i}`,
                points: [
                    foot.x - tickLen * Math.cos(perpAngle), foot.y - tickLen * Math.sin(perpAngle),
                    foot.x + tickLen * Math.cos(perpAngle), foot.y + tickLen * Math.sin(perpAngle)
                ] as [number, number, number, number],
                dashed: false, color: '#555555', step: 4, primitiveRole: 'dimension'
            });
            if (showLabels) {
                this.primitives.push({
                    type: 'text', key: `aux-tick-label-${i}`,
                    x: foot.x - tickLen * Math.cos(perpAngle) - 12,
                    y: foot.y - tickLen * Math.sin(perpAngle),
                    content: labelChars[i], step: 4, primitiveRole: 'label'
                });
            }
        }
        // Height extension line on first vertex with "h=" annotation
        this.primitives.push({
            type: 'line', key: 'aux-height-transfer',
            points: [footOnLine[0].x, footOnLine[0].y, auxTopVertices[0].x, auxTopVertices[0].y] as [number, number, number, number],
            dashed: true, color: '#888888', step: 4, primitiveRole: 'dimension'
        });
        this.primitives.push({
            type: 'text', key: 'aux-height-transfer-label',
            x: (footOnLine[0].x + auxTopVertices[0].x) / 2 + 10,
            y: (footOnLine[0].y + auxTopVertices[0].y) / 2,
            content: `h=${data.axis_length_mm}`, step: 4, primitiveRole: 'dimension'
        });

        // =====================================================================
        // STEP 5 — Draw complete Auxiliary View (visible + hidden + labels)
        // =====================================================================
        const viewDirX = Math.cos(perpAngle);
        const viewDirY = Math.sin(perpAngle);

        if (isPrism) {
            this.primitives.push({
                type: 'path', key: 'aux-base',
                d: 'M ' + auxBaseVertices.map(v => `${v.x} ${v.y}`).join(' L ') + ' Z',
                dashed: false, color: '#004d40', step: 5, fill: 'none', primitiveRole: 'visible'
            });
            this.primitives.push({
                type: 'path', key: 'aux-top',
                d: 'M ' + auxTopVertices.map(v => `${v.x} ${v.y}`).join(' L ') + ' Z',
                dashed: false, color: '#004d40', step: 5, fill: 'none', primitiveRole: 'visible'
            });
            for (let i = 0; i < numSides; i++) {
                const next = (i + 1) % numSides;
                const midX = (tvBaseVertices[i].x + tvBaseVertices[next].x) / 2;
                const midY = (tvBaseVertices[i].y + tvBaseVertices[next].y) / 2;
                const toMid = (midX - x1y1Anchor.x) * viewDirX + (midY - x1y1Anchor.y) * viewDirY;
                const isHidden = toMid < 0;
                this.primitives.push({
                    type: 'line', key: `aux-edge-${i}`,
                    points: [auxBaseVertices[i].x, auxBaseVertices[i].y, auxTopVertices[i].x, auxTopVertices[i].y] as [number, number, number, number],
                    dashed: isHidden, color: '#004d40', step: 5, primitiveRole: isHidden ? 'hidden' : 'visible'
                });
            }
            // Vertex labels on AV
            if (showLabels) {
                const avCX = auxBaseVertices.reduce((s, v) => s + v.x, 0) / numSides;
                const avCY = auxBaseVertices.reduce((s, v) => s + v.y, 0) / numSides;
                const avTCX = auxTopVertices.reduce((s, v) => s + v.x, 0) / numSides;
                const avTCY = auxTopVertices.reduce((s, v) => s + v.y, 0) / numSides;
                for (let i = 0; i < numSides; i++) {
                    const bv = auxBaseVertices[i]; const tv2 = auxTopVertices[i];
                    const dbl = Math.hypot(bv.x - avCX, bv.y - avCY) || 1;
                    const dtl = Math.hypot(tv2.x - avTCX, tv2.y - avTCY) || 1;
                    this.primitives.push({ type: 'text', key: `av-base-label-${i}`, x: bv.x  + ((bv.x - avCX)  / dbl) * 11, y: bv.y  + ((bv.y - avCY)  / dbl) * 11, content: labelChars[i],  step: 5, primitiveRole: 'label' });
                    this.primitives.push({ type: 'text', key: `av-top-label-${i}`,  x: tv2.x + ((tv2.x - avTCX) / dtl) * 11, y: tv2.y + ((tv2.y - avTCY) / dtl) * 11, content: primeChars[i], step: 5, primitiveRole: 'label' });
                }
            }
            const avMidX = (auxBaseVertices.reduce((s,v)=>s+v.x,0) + auxTopVertices.reduce((s,v)=>s+v.x,0)) / (2 * numSides);
            const avMidY = (auxBaseVertices.reduce((s,v)=>s+v.y,0) + auxTopVertices.reduce((s,v)=>s+v.y,0)) / (2 * numSides);
            this.primitives.push({ type: 'text', key: 'av-caption', x: avMidX, y: avMidY, content: 'A.V.', step: 5, primitiveRole: 'caption' });

        } else {
            // Pyramid / cone
            this.primitives.push({
                type: 'path', key: 'aux-base',
                d: 'M ' + auxBaseVertices.map(v => `${v.x} ${v.y}`).join(' L ') + ' Z',
                dashed: false, color: '#004d40', step: 5, fill: 'none', primitiveRole: 'visible'
            });
            for (let i = 0; i < numSides; i++) {
                const next = (i + 1) % numSides;
                const midX = (tvBaseVertices[i].x + tvBaseVertices[next].x) / 2;
                const midY = (tvBaseVertices[i].y + tvBaseVertices[next].y) / 2;
                const toMid = (midX - x1y1Anchor.x) * viewDirX + (midY - x1y1Anchor.y) * viewDirY;
                const isHidden = toMid < 0;
                this.primitives.push({
                    type: 'line', key: `aux-edge-${i}`,
                    points: [auxBaseVertices[i].x, auxBaseVertices[i].y, auxApexX, auxApexY] as [number, number, number, number],
                    dashed: isHidden, color: '#004d40', step: 5, primitiveRole: isHidden ? 'hidden' : 'visible'
                });
            }
            if (showLabels) {
                this.primitives.push({ type: 'text', key: 'av-apex-label', x: auxApexX + 8, y: auxApexY - 8, content: "o'", step: 5, primitiveRole: 'label' });
                const avCX = auxBaseVertices.reduce((s,v)=>s+v.x,0)/numSides;
                const avCY = auxBaseVertices.reduce((s,v)=>s+v.y,0)/numSides;
                for (let i = 0; i < numSides; i++) {
                    const bv = auxBaseVertices[i];
                    const dbl = Math.hypot(bv.x - avCX, bv.y - avCY) || 1;
                    this.primitives.push({ type: 'text', key: `av-base-label-${i}`, x: bv.x + ((bv.x-avCX)/dbl)*11, y: bv.y + ((bv.y-avCY)/dbl)*11, content: labelChars[i], step: 5, primitiveRole: 'label' });
                }
            }
            this.primitives.push({ type: 'text', key: 'av-caption', x: auxApexX, y: auxApexY - 22, content: 'A.V.', step: 5, primitiveRole: 'caption' });
        }

        // =====================================================================
        // STEP 6 — Dimension annotations
        // =====================================================================
        // Axis height on left of FV
        const fvLeftX = fvMinX - 22;
        this.primitives.push({
            type: 'line', key: 'dim-aux-height',
            points: [fvLeftX, fvBaseY, fvLeftX, fvTopY] as [number, number, number, number],
            dashed: false, color: '#555555', step: 6, primitiveRole: 'dimension'
        });
        this.primitives.push({ type: 'text', key: 'dim-aux-height-label', x: fvLeftX - 32, y: (fvBaseY + fvTopY) / 2, content: `h=${data.axis_length_mm}`, step: 6, primitiveRole: 'dimension' });

        // Base size below TV
        const tvBottomY = Math.max(...tvBaseVertices.map(v => v.y)) + 18;
        const tvLX = Math.min(...tvBaseVertices.map(v => v.x));
        const tvRX = Math.max(...tvBaseVertices.map(v => v.x));
        this.primitives.push({
            type: 'line', key: 'dim-aux-base',
            points: [tvLX, tvBottomY, tvRX, tvBottomY] as [number, number, number, number],
            dashed: false, color: '#555555', step: 6, primitiveRole: 'dimension'
        });
        const baseLabel = isCircle ? `⌀${data.base_size_mm.diameter_mm}` : `${data.base_size_mm.side_mm ?? (data.base_size_mm.length_mm ?? '')}`;
        this.primitives.push({ type: 'text', key: 'dim-aux-base-label', x: (tvLX + tvRX) / 2, y: tvBottomY + 14, content: baseLabel, step: 6, primitiveRole: 'dimension' });
    }
}

// TODO: implement inclined solid logic correctly

// Fixed rotation matrix for HP inclination

// Adjusted plan angle calculation

// Handled VP resting edge cases

// Fixed hidden lines bug

// Final cleanup for inclined solid

// TODO: implement inclined solid logic correctly
