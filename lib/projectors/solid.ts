import { GeometryEngine, PointMap } from '../geometryEngine';
import { SolidSchema } from '../../types';
import { PointCoords, SvgPrimitive } from '../../types';

    export function projectSolid(engine: GeometryEngine, data: SolidSchema) {
        if (data.base_orientation?.feature === 'body_diagonal') {
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
                    inclination_with_HP_deg: inclination_deg,
                    inclined_to: 'HP',
                    resting_element: 'base_corner',
                    base_orientation: {
                        feature: 'corner_to_center',
                        relation: 'parallel',
                        reference_plane: 'VP'
                    }
                };
            }
        }

        if (data.solid_type === 'sphere') {
            engine.projectSphere(data);
            return;
        }

        const restingContact = data.resting_element || (data.resting_face ? 'lateral_face' : undefined);
        if (data.resting_on === 'VP' && restingContact) {
            const primitiveStart = engine.primitives.length;
            const swapPlane = (plane: 'HP' | 'VP') => plane === 'HP' ? 'VP' as const : 'HP' as const;
            const canonical: SolidSchema = {
                ...data,
                resting_on: 'HP',
                initial_axis_parallel_to: data.initial_axis_parallel_to ? swapPlane(data.initial_axis_parallel_to) : undefined,
                inclined_to: data.inclined_to === 'HP' ? 'VP' : data.inclined_to === 'VP' ? 'HP' : data.inclined_to,
                inclination_with_HP_deg: data.inclination_with_VP_deg,
                inclination_with_VP_deg: data.inclination_with_HP_deg,
            };
            projectSolid(engine, canonical);

            const swapViewToken = (key: string) => key
                .replace(/fv/g, '__view_swap__')
                .replace(/tv/g, 'fv')
                .replace(/__view_swap__/g, 'tv');
            const mirrorPath = (path: string) => path
                .replace(
                    /([ML])\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/g,
                    (_match, command: string, x: string, y: string) => `${command} ${x} ${2 * engine.XY_LINE_Y - Number(y)}`,
                )
                .replace(
                    /A\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+([01])\s+([01])\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/g,
                    (_match, rx: string, ry: string, rotation: string, largeArc: string, sweep: string, x: string, y: string) =>
                        `A ${rx} ${ry} ${rotation} ${largeArc} ${sweep === '1' ? '0' : '1'} ${x} ${2 * engine.XY_LINE_Y - Number(y)}`,
                );
            for (const primitive of engine.primitives.slice(primitiveStart)) {
                primitive.key = swapViewToken(primitive.key);
                if (primitive.type === 'line') {
                    primitive.points = [primitive.points[0], 2 * engine.XY_LINE_Y - primitive.points[1], primitive.points[2], 2 * engine.XY_LINE_Y - primitive.points[3]];
                } else if (primitive.type === 'circle') {
                    primitive.cy = 2 * engine.XY_LINE_Y - primitive.cy;
                } else if (primitive.type === 'path') {
                    primitive.d = mirrorPath(primitive.d);
                } else if (primitive.type === 'text') {
                    primitive.y = 2 * engine.XY_LINE_Y - primitive.y;
                }
            }
            return;
        }

        if (data.resting_on === 'VP') {
            engine.projectSolidOnVP(data);
            return;
        }

        const baseSide = (data.base_shape === 'rectangle'
            ? Math.max(data.base_size_mm.length_mm || 0, data.base_size_mm.breadth_mm || 0)
            : (data.base_size_mm.side_mm || data.base_size_mm.diameter_mm || 0)) * engine.SCALE;
        const height = data.height_mm * engine.SCALE;
        let numSides = 0;
        switch(data.base_shape) {
            case 'triangle': numSides = 3; break;
            case 'square': numSides = 4; break;
            case 'pentagon': numSides = 5; break;
            case 'hexagon': numSides = 6; break;
            case 'rectangle': numSides = 4; break;
            case 'circle': numSides = 24; break; // Approximate circle
            default:
                 engine.primitives.push({ type: 'text', key: 'error', x: 200, y: 200, content: `Base shape '${data.base_shape}' not supported.`, step: 1 });
                 return;
        }

        const isPrism = data.solid_type === 'prism' || data.solid_type === 'cylinder' || data.solid_type === 'cube';
        const isContactResting = !!restingContact;
        const statedHpAxisInclination = data.inclined_to === 'HP'
            ? data.inclination_deg
            : data.inclination_with_HP_deg;
        const hpInclination = statedHpAxisInclination
            ?? (data.base_inclination_deg !== undefined ? 90 - data.base_inclination_deg : 0);
        const vpInclination = data.inclined_to === 'VP'
            ? (data.inclination_deg || 0)
            : (data.inclination_with_VP_deg || 0);
        const CONSTRUCTION_COLOR = '#bcaaa4';
        const constructionStep = (step: number, prims: SvgPrimitive[]) => {
            prims.forEach(p => engine.primitives.push({ ...p, step, color: p.color || CONSTRUCTION_COLOR }));
            engine.resolveLabelOverlaps(step);
        };
        const finalStep = (step: number, prims: SvgPrimitive[]) => {
            prims.forEach(p => engine.primitives.push({ ...p, key: p.key + '-final', step, color: '#004d40' }));
            engine.resolveLabelOverlaps(step);
        };
        
        const showSideView = false;

        if (showSideView) {
            const diameter = baseSide;
            const radius = diameter / 2;
            const h = height;
            
            const fvCenterX = engine.ORIGIN_X + 200;
            const fvCenterY = engine.XY_LINE_Y - diameter - 50;
            const tvCenterX = fvCenterX;
            const tvCenterY = engine.XY_LINE_Y + diameter + 50;
            
            const axisParallelTo = data.initial_axis_parallel_to || 'VP';

            const fv_prims: SvgPrimitive[] = [];
            const tv_prims: SvgPrimitive[] = [];
            const sv_prims: SvgPrimitive[] = [];

            if (axisParallelTo === 'VP') {
                // Axis horizontal and parallel to VP (perpendicular to PP)
                // FV: Rectangle (width=height, height=diameter)
                fv_prims.push({ type: 'line', key: 's1-fv-top', points: [fvCenterX - h/2, fvCenterY - radius, fvCenterX + h/2, fvCenterY - radius], dashed: false });
                fv_prims.push({ type: 'line', key: 's1-fv-bottom', points: [fvCenterX - h/2, fvCenterY + radius, fvCenterX + h/2, fvCenterY + radius], dashed: false });
                fv_prims.push({ type: 'line', key: 's1-fv-left', points: [fvCenterX - h/2, fvCenterY - radius, fvCenterX - h/2, fvCenterY + radius], dashed: false });
                fv_prims.push({ type: 'line', key: 's1-fv-right', points: [fvCenterX + h/2, fvCenterY - radius, fvCenterX + h/2, fvCenterY + radius], dashed: false });
                fv_prims.push({ type: 'line', key: 's1-fv-axis', points: [fvCenterX - h/2, fvCenterY, fvCenterX + h/2, fvCenterY], dashed: true, color: '#d32f2f' });

                // TV: Rectangle (width=height, depth=diameter)
                tv_prims.push({ type: 'line', key: 's1-tv-top', points: [tvCenterX - h/2, tvCenterY - radius, tvCenterX + h/2, tvCenterY - radius], dashed: false });
                tv_prims.push({ type: 'line', key: 's1-tv-bottom', points: [tvCenterX - h/2, tvCenterY + radius, tvCenterX + h/2, tvCenterY + radius], dashed: false });
                tv_prims.push({ type: 'line', key: 's1-tv-left', points: [tvCenterX - h/2, tvCenterY - radius, tvCenterX - h/2, tvCenterY + radius], dashed: false });
                tv_prims.push({ type: 'line', key: 's1-tv-right', points: [tvCenterX + h/2, tvCenterY - radius, tvCenterX + h/2, tvCenterY + radius], dashed: false });
                tv_prims.push({ type: 'line', key: 's1-tv-axis', points: [tvCenterX - h/2, tvCenterY, tvCenterX + h/2, tvCenterY], dashed: true, color: '#d32f2f' });

                // SV: Base Shape (Circle or Polygon)
                const x1y1_x = fvCenterX + h/2 + 100;
                engine.primitives.push({ type: 'line', key: 'sv-x1y1', points: [x1y1_x, 0, x1y1_x, engine.XY_LINE_Y * 2], dashed: false, color: 'black', step: 0 });
                const svCenterX = x1y1_x + 100;
                const svCenterY = fvCenterY;
                
                if (data.base_shape === 'circle') {
                    sv_prims.push({ type: 'circle', key: 'sv-circle', cx: svCenterX, cy: svCenterY, r: radius, dashed: false });
                } else {
                    const vertices = engine.getPolygonVertices(numSides, baseSide, svCenterX, svCenterY, 0);
                    for (let i = 0; i < numSides; i++) {
                        sv_prims.push({ type: 'line', key: `sv-base-${i}`, points: [vertices[i].x, vertices[i].y, vertices[(i+1)%numSides].x, vertices[(i+1)%numSides].y], dashed: false });
                    }
                }
                sv_prims.push({ type: 'line', key: 'sv-axis-h', points: [svCenterX - radius, svCenterY, svCenterX + radius, svCenterY], dashed: true, color: '#d32f2f' });
                sv_prims.push({ type: 'line', key: 'sv-axis-v', points: [svCenterX, svCenterY - radius, svCenterX, svCenterY + radius], dashed: true, color: '#d32f2f' });
                
                engine.primitives.push({ type: 'text', key: 'fv-label', x: fvCenterX, y: fvCenterY - radius - 20, content: 'F.V.', step: 1, textAnchor: 'middle', color: 'grey' });
                engine.primitives.push({ type: 'text', key: 'tv-label', x: tvCenterX, y: tvCenterY + radius + 30, content: 'T.V.', step: 2, textAnchor: 'middle', color: 'grey' });
                engine.primitives.push({ type: 'text', key: 'sv-label', x: svCenterX, y: svCenterY - radius - 20, content: 'S.V.', step: 3, textAnchor: 'middle', color: 'grey' });

                // Projection lines FV to SV
                const fvRight = fvCenterX + h/2;
                const svLeft = svCenterX - radius;
                const svRight = svCenterX + radius;
                const fvTop = fvCenterY - radius;
                const fvBottom = fvCenterY + radius;
                const fvMid = (fvTop + fvBottom) / 2;
                const fvWidth = h;
                const fvHeight = fvBottom - fvTop;

                console.log('fvRight:', fvRight, 'svLeft:', svLeft);

                sv_prims.forEach(p => engine.primitives.push({ ...p, step: 3, color: '#004d40' }));

                engine.primitives.push({ type: 'line', key: 'proj-fv-sv-top', points: [fvRight, svCenterY - radius, svCenterX, svCenterY - radius], dashed: true, color: 'grey', step: 3 });
                engine.primitives.push({ type: 'line', key: 'proj-fv-sv-bottom', points: [fvRight, svCenterY + radius, svCenterX, svCenterY + radius], dashed: true, color: 'grey', step: 3 });
                engine.primitives.push({ type: 'line', key: 'proj-fv-sv-axis', points: [fvRight, svCenterY, svLeft, svCenterY], dashed: true, color: 'grey', step: 3 });

                // Projection lines TV to XY (depth)
                const tvLeft = tvCenterX - h/2;
                const tvRight = tvCenterX + h/2;
                const tvTopY = tvCenterY - (fvHeight / 2);
                engine.primitives.push({ type: 'line', key: 'proj-tv-xy-left', points: [tvLeft, tvTopY, tvLeft, fvBottom], dashed: true, color: 'grey', step: 2 });
                engine.primitives.push({ type: 'line', key: 'proj-tv-xy-right', points: [tvRight, tvTopY, tvRight, fvBottom], dashed: true, color: 'grey', step: 2 });
            } else {
                // Axis horizontal and parallel to HP (perpendicular to VP)
                // FV: Base Shape
                if (data.base_shape === 'circle') {
                    fv_prims.push({ type: 'circle', key: 's1-fv-circle', cx: fvCenterX, cy: fvCenterY, r: radius, dashed: false });
                } else {
                    const vertices = engine.getPolygonVertices(numSides, baseSide, fvCenterX, fvCenterY, 0);
                    for (let i = 0; i < numSides; i++) {
                        fv_prims.push({ type: 'line', key: `s1-fv-base-${i}`, points: [vertices[i].x, vertices[i].y, vertices[(i+1)%numSides].x, vertices[(i+1)%numSides].y], dashed: false });
                    }
                }
                fv_prims.push({ type: 'line', key: 's1-fv-axis-h', points: [fvCenterX - radius, fvCenterY, fvCenterX + radius, fvCenterY], dashed: true, color: '#d32f2f' });
                fv_prims.push({ type: 'line', key: 's1-fv-axis-v', points: [fvCenterX, fvCenterY - radius, fvCenterX, fvCenterY + radius], dashed: true, color: '#d32f2f' });

                // TV: Rectangle (width=height, depth=diameter)
                tv_prims.push({ type: 'line', key: 's1-tv-top', points: [tvCenterX - radius, tvCenterY - h/2, tvCenterX + radius, tvCenterY - h/2], dashed: false });
                tv_prims.push({ type: 'line', key: 's1-tv-bottom', points: [tvCenterX - radius, tvCenterY + h/2, tvCenterX + radius, tvCenterY + h/2], dashed: false });
                tv_prims.push({ type: 'line', key: 's1-tv-left', points: [tvCenterX - radius, tvCenterY - h/2, tvCenterX - radius, tvCenterY + h/2], dashed: false });
                tv_prims.push({ type: 'line', key: 's1-tv-right', points: [tvCenterX + radius, tvCenterY - h/2, tvCenterX + radius, tvCenterY + h/2], dashed: false });
                tv_prims.push({ type: 'line', key: 's1-tv-axis', points: [tvCenterX, tvCenterY - h/2, tvCenterX, tvCenterY + h/2], dashed: true, color: '#d32f2f' });

                // SV: Rectangle (width=height, height=diameter)
                const x1y1_x = fvCenterX + radius + 100;
                engine.primitives.push({ type: 'line', key: 'sv-x1y1', points: [x1y1_x, 0, x1y1_x, engine.XY_LINE_Y * 2], dashed: false, color: 'black', step: 0 });
                const svCenterX = x1y1_x + h/2 + 20;
                const svCenterY = fvCenterY;
                sv_prims.push({ type: 'line', key: 'sv-rect-top', points: [svCenterX - h/2, svCenterY - radius, svCenterX + h/2, svCenterY - radius], dashed: false });
                sv_prims.push({ type: 'line', key: 'sv-rect-bottom', points: [svCenterX - h/2, svCenterY + radius, svCenterX + h/2, svCenterY + radius], dashed: false });
                sv_prims.push({ type: 'line', key: 'sv-rect-left', points: [svCenterX - h/2, svCenterY - radius, svCenterX - h/2, svCenterY + radius], dashed: false });
                sv_prims.push({ type: 'line', key: 'sv-rect-right', points: [svCenterX + h/2, svCenterY - radius, svCenterX + h/2, svCenterY + radius], dashed: false });
                sv_prims.push({ type: 'line', key: 'sv-axis', points: [svCenterX - h/2, svCenterY, svCenterX + h/2, svCenterY], dashed: true, color: '#d32f2f' });

                engine.primitives.push({ type: 'text', key: 'fv-label', x: fvCenterX, y: fvCenterY - radius - 20, content: 'F.V.', step: 1, textAnchor: 'middle', color: 'grey' });
                engine.primitives.push({ type: 'text', key: 'tv-label', x: tvCenterX, y: tvCenterY + h/2 + 30, content: 'T.V.', step: 2, textAnchor: 'middle', color: 'grey' });
                engine.primitives.push({ type: 'text', key: 'sv-label', x: svCenterX, y: svCenterY - radius - 20, content: 'S.V.', step: 3, textAnchor: 'middle', color: 'grey' });

                // Projection lines FV to SV
                const fvRight = fvCenterX + radius;
                const svLeft = svCenterX - radius;
                const svRight = svCenterX + radius;
                const fvTop = fvCenterY - radius;
                const fvBottom = fvCenterY + radius;
                const fvMid = (fvTop + fvBottom) / 2;
                const fvWidth = 2 * radius;
                const fvHeight = fvBottom - fvTop;
                const tvLeft = tvCenterX - radius;
                const tvRight = tvCenterX + radius;

                console.log('fvRight:', fvRight, 'svLeft:', svLeft);

                sv_prims.forEach(p => engine.primitives.push({ ...p, step: 3, color: '#004d40' }));

                engine.primitives.push({ type: 'line', key: 'proj-fv-sv-top', points: [fvRight, svCenterY - radius, svCenterX, svCenterY - radius], dashed: true, color: 'grey', step: 3 });
                engine.primitives.push({ type: 'line', key: 'proj-fv-sv-bottom', points: [fvRight, svCenterY + radius, svCenterX, svCenterY + radius], dashed: true, color: 'grey', step: 3 });
                engine.primitives.push({ type: 'line', key: 'proj-fv-sv-axis', points: [fvRight, svCenterY, svLeft, svCenterY], dashed: true, color: 'grey', step: 3 });

                // Projection lines TV to XY (depth)
                const tvTopY = tvCenterY - (fvHeight / 2);
                engine.primitives.push({ type: 'line', key: 'proj-tv-xy-left', points: [tvLeft, tvTopY, tvLeft, fvBottom], dashed: true, color: 'grey', step: 2 });
                engine.primitives.push({ type: 'line', key: 'proj-tv-xy-right', points: [tvRight, tvTopY, tvRight, fvBottom], dashed: true, color: 'grey', step: 2 });
            }

            fv_prims.forEach(p => engine.primitives.push({ ...p, step: 1, color: '#004d40' }));
            tv_prims.forEach(p => engine.primitives.push({ ...p, step: 2, color: '#004d40' }));

            return;
        }
        
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

        const applyVisibility = (ptsMap: PointMap, prims: SvgPrimitive[], view: 'tv' | 'fv') => {
            if (data.base_shape === 'circle') return; // Skip for approximated circles since they represent cylinders/cones generically

            const epsilon = 0.01;
            const toWorldPoint = (point: PointCoords) => {
                if (view === 'tv') {
                    return {
                        x: point.x,
                        y: point.y,
                        z: point.z || 0,
                    };
                }

                return {
                    x: point.x,
                    y: point.z || 0,
                    z: engine.XY_LINE_Y - point.y,
                };
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

                return view === 'tv' ? normal.z : normal.y;
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
                    if (key === k1 || key === k2 || key.includes('axis')) {
                        continue;
                    }

                    if (
                        (Math.abs(point.x - p1.x) < epsilon && Math.abs(point.y - p1.y) < epsilon) ||
                        (Math.abs(point.x - p2.x) < epsilon && Math.abs(point.y - p2.y) < epsilon)
                    ) {
                        continue;
                    }

                    const cross = dx * (point.y - p1.y) - dy * (point.x - p1.x);
                    if (cross > epsilon) hasPositive = true;
                    if (cross < -epsilon) hasNegative = true;

                    if (hasPositive && hasNegative) {
                        return false;
                    }
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
                    faces.push([baseKeys[i], baseKeys[(i+1)%numSides], topKeys[(i+1)%numSides], topKeys[i]]);
                }
            } else {
                faces.push([...baseKeys].reverse());
                for (let i = 0; i < numSides; i++) {
                    faces.push([baseKeys[i], baseKeys[(i+1)%numSides], 'apex']);
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
                    const k2 = face[(i+1)%face.length];
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
                        if (!isNaN(i)) { k1 = baseKeys[i]; k2 = baseKeys[(i+1)%numSides]; }
                    } else if (prim.key.includes('top')) {
                        const i = parseInt(prim.key.split('-').pop()!);
                        if (!isNaN(i)) { k1 = topKeys[i]; k2 = topKeys[(i+1)%numSides]; }
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

        // --- Stage 1: Simple Position ---
        // A contact-resting construction needs a deterministic edge view before
        // the first tilt. This is the standard change-of-position setup used in
        // engineering graphics: the contact edge is perpendicular to VP, while
        // a pyramid slant edge is first shown in true length.
        const contactOrientation: SolidSchema['base_orientation'] = data.base_shape === 'circle'
            ? undefined
            : restingContact === 'base_edge' || restingContact === 'lateral_face'
                ? { feature: 'side', relation: 'perpendicular', reference_plane: 'VP' }
                : restingContact === 'base_corner' || restingContact === 'lateral_edge'
                    ? { feature: 'corner_to_center', relation: 'parallel', reference_plane: 'VP' }
                    : restingContact === 'slant_edge'
                        ? { feature: 'corner_to_center', relation: 'parallel', reference_plane: 'VP' }
                        : undefined;
        // Orient an explicitly named base feature exactly as stated relative to VP.
        const baseOrientationAngle = engine.getBaseOrientationAngle(
            data.base_shape,
            data.base_size_mm,
            contactOrientation || data.base_orientation,
        );
        const orientation = baseOrientationAngle
            + (restingContact && data.base_shape !== 'circle' && data.tilt_direction === 'counterclockwise' ? Math.PI : 0);
        const stage1_tv_pts: PointMap = {};
        const tvCenterX = engine.ORIGIN_X + baseSide * 1.5;
        const tvCenterY = engine.XY_LINE_Y + baseSide * 1.5;
        let baseVertices: PointCoords[] = [];
        if (data.base_shape === 'circle') {
            const radius = baseSide / 2;
            for (let i = 0; i < numSides; i++) {
                const angle = (i * 2 * Math.PI) / numSides;
                baseVertices.push({
                    x: tvCenterX + radius * Math.cos(angle),
                    y: tvCenterY + radius * Math.sin(angle),
                    z: 0
                });
            }
        } else if (data.base_shape === 'rectangle') {
            baseVertices = engine.getRectangleVertices(
                (data.base_size_mm.length_mm || 0) * engine.SCALE,
                (data.base_size_mm.breadth_mm || 0) * engine.SCALE,
                tvCenterX,
                tvCenterY,
                orientation,
            );
        } else {
            baseVertices = engine.getPolygonVertices(numSides, baseSide, tvCenterX, tvCenterY, orientation);
        }
        baseVertices.forEach((p, i) => stage1_tv_pts[baseKeys[i]] = p);

        if (isPrism) {
            baseVertices.forEach((p, i) => stage1_tv_pts[topKeys[i]] = { ...p, z: height });
        } else {
            stage1_tv_pts.apex = { x: tvCenterX, y: tvCenterY, z: height };
        }
        stage1_tv_pts.axis_base = { x: tvCenterX, y: tvCenterY, z: 0 };
        stage1_tv_pts.axis_top = { x: tvCenterX, y: tvCenterY, z: height };
        
        const stage1_fv_pts: PointMap = {};
        allKeys.forEach(key => {
            stage1_fv_pts[key] = {
                x: stage1_tv_pts[key].x,
                y: engine.XY_LINE_Y - (stage1_tv_pts[key].z || 0),
                z: stage1_tv_pts[key].y,
            };
        });

        const stage1_tv_prims: SvgPrimitive[] = [];
        const stage1_fv_prims: SvgPrimitive[] = [];
        
        for (let i = 0; i < numSides; i++) stage1_tv_prims.push({ type: 'line', key: `s1-tv-base-${i}`, points: [stage1_tv_pts[baseKeys[i]].x, stage1_tv_pts[baseKeys[i]].y, stage1_tv_pts[baseKeys[(i + 1) % numSides]].x, stage1_tv_pts[baseKeys[(i + 1) % numSides]].y], dashed: false });
        if(isPrism) for (let i = 0; i < numSides; i++) stage1_tv_prims.push({ type: 'line', key: `s1-tv-top-${i}`, points: [stage1_tv_pts[topKeys[i]].x, stage1_tv_pts[topKeys[i]].y, stage1_tv_pts[topKeys[(i + 1) % numSides]].x, stage1_tv_pts[topKeys[(i + 1) % numSides]].y], dashed: false });
        else for (let i = 0; i < numSides; i++) stage1_tv_prims.push({ type: 'line', key: `s1-tv-slant-${i}`, points: [stage1_tv_pts.apex.x, stage1_tv_pts.apex.y, stage1_tv_pts[baseKeys[i]].x, stage1_tv_pts[baseKeys[i]].y], dashed: false });
        
        if (isPrism && data.base_shape === 'circle') {
            const radius = baseSide / 2;
            const fvLeft = tvCenterX - radius;
            const fvRight = tvCenterX + radius;
            const fvBottom = engine.XY_LINE_Y;
            const fvTop = engine.XY_LINE_Y - height;
            
            stage1_fv_prims.push({ type: 'line', key: 's1-fv-left', points: [fvLeft, fvTop, fvLeft, fvBottom], dashed: false, step: 1 });
            stage1_fv_prims.push({ type: 'line', key: 's1-fv-right', points: [fvRight, fvTop, fvRight, fvBottom], dashed: false, step: 1 });
            stage1_fv_prims.push({ type: 'line', key: 's1-fv-top', points: [fvLeft, fvTop, fvRight, fvTop], dashed: false, step: 1 });
            stage1_fv_prims.push({ type: 'line', key: 's1-fv-bottom', points: [fvLeft, fvBottom, fvRight, fvBottom], dashed: false, step: 1 });
        } else {
            for (let i = 0; i < numSides; i++) {
                stage1_fv_prims.push({ type: 'line', key: `s1-fv-base-${i}`, points: [stage1_fv_pts[baseKeys[i]].x, stage1_fv_pts[baseKeys[i]].y, stage1_fv_pts[baseKeys[(i + 1) % numSides]].x, stage1_fv_pts[baseKeys[(i + 1) % numSides]].y], dashed: false });
                if(isPrism) {
                    stage1_fv_prims.push({ type: 'line', key: `s1-fv-top-${i}`, points: [stage1_fv_pts[topKeys[i]].x, stage1_fv_pts[topKeys[i]].y, stage1_fv_pts[topKeys[(i + 1) % numSides]].x, stage1_fv_pts[topKeys[(i + 1) % numSides]].y], dashed: false });
                    stage1_fv_prims.push({ type: 'line', key: `s1-fv-side-${i}`, points: [stage1_fv_pts[baseKeys[i]].x, stage1_fv_pts[baseKeys[i]].y, stage1_fv_pts[topKeys[i]].x, stage1_fv_pts[topKeys[i]].y], dashed: false });
                } else {
                    stage1_fv_prims.push({ type: 'line', key: `s1-fv-slant-${i}`, points: [stage1_fv_pts.apex.x, stage1_fv_pts.apex.y, stage1_fv_pts[baseKeys[i]].x, stage1_fv_pts[baseKeys[i]].y], dashed: false });
                }
            }
        }
        
        stage1_fv_prims.push({ type: 'line', key: `s1-fv-axis`, points: [stage1_fv_pts.axis_base.x, stage1_fv_pts.axis_base.y, stage1_fv_pts.axis_top.x, stage1_fv_pts.axis_top.y], dashed: true, color: '#d32f2f' });
        
        const stage1_prims = [...stage1_tv_prims, ...stage1_fv_prims];
        constructionStep(1, stage1_prims);

        const addSolidDimensions = () => {
            const fvBbox = engine.getBoundingBox(['s1-fv']);
            if (Number.isFinite(fvBbox.left) && Number.isFinite(fvBbox.top) && Number.isFinite(fvBbox.bottom)) {
                engine.addLinearDimension(
                    { x: fvBbox.left, y: fvBbox.bottom },
                    { x: fvBbox.left, y: fvBbox.top },
                    engine.formatLengthLabel(data.height_mm),
                    -engine.DIM_OFFSET,
                    true,
                    'dim-solid-height',
                );
            }

            if (data.base_shape === 'circle' && data.base_size_mm.diameter_mm) {
                const tvBbox = engine.getBoundingBox(['s1-tv']);
                engine.addLinearDimension(
                    { x: tvBbox.left, y: tvBbox.bottom },
                    { x: tvBbox.right, y: tvBbox.bottom },
                    `⌀${engine.formatLengthLabel(data.base_size_mm.diameter_mm)}`,
                    engine.DIM_OFFSET,
                    false,
                    'dim-solid-base',
                );
            } else if (data.base_shape === 'rectangle' && data.base_size_mm.length_mm && data.base_size_mm.breadth_mm) {
                engine.addLinearDimension(stage1_tv_pts[baseKeys[0]], stage1_tv_pts[baseKeys[1]], engine.formatLengthLabel(data.base_size_mm.length_mm), engine.DIM_OFFSET, false, 'dim-solid-length', true);
                engine.addLinearDimension(stage1_tv_pts[baseKeys[1]], stage1_tv_pts[baseKeys[2]], engine.formatLengthLabel(data.base_size_mm.breadth_mm), engine.DIM_OFFSET, true, 'dim-solid-breadth', true);
            } else if (data.base_size_mm.side_mm) {
                engine.addLinearDimension(stage1_tv_pts[baseKeys[0]], stage1_tv_pts[baseKeys[1]], engine.formatLengthLabel(data.base_size_mm.side_mm), engine.DIM_OFFSET, false, 'dim-solid-base', true);
            }
        };

        if (data.base_shape !== 'circle') {
            engine.addOrthographicSolidLabels(stage1_tv_pts, stage1_tv_pts, stage1_fv_pts, baseKeys, topKeys, isPrism, 1, ['tv', 'fv']);
        }

        if (showSideView) {
            engine.primitives.push({ type: 'line', key: 'step5-dummy', points: [0,0,0,0], dashed: true, step: 5, color: 'transparent', primitiveRole: 'hidden' });
                finalStep(6, stage1_prims); 
            
            // X1Y1 line
            let fvRight = -Infinity;
            let fvTop = Infinity;
            let fvBottom = -Infinity;
            for (const prim of engine.primitives) {
                if (prim.key.includes('fv') && prim.key.includes('-final')) {
                    if (prim.type === 'line') {
                        fvRight = Math.max(fvRight, prim.points[0], prim.points[2]);
                        fvTop = Math.min(fvTop, prim.points[1], prim.points[3]);
                        fvBottom = Math.max(fvBottom, prim.points[1], prim.points[3]);
                    }
                }
            }
            
            if (fvRight === -Infinity) fvRight = engine.ORIGIN_X + 200;
            if (fvTop === Infinity) fvTop = engine.XY_LINE_Y - height;
            if (fvBottom === -Infinity) fvBottom = engine.XY_LINE_Y;

            const x1y1_x = fvRight + 100;
            engine.primitives.push({
                type: 'line',
                key: 'sv-x1y1-line',
                points: [x1y1_x, 0, x1y1_x, engine.XY_LINE_Y],
                dashed: false,
                color: 'black',
                step: 1
            });

            const svLeft = x1y1_x + 20;
            
            let svWidth = 0;
            const isCylinder = data.base_shape === 'circle' && isPrism;
            const isCone = data.base_shape === 'circle' && !isPrism;
            const isCube = data.base_shape === 'square' && isPrism && data.height_mm === data.base_size_mm.side_mm;

            if (data.base_shape === 'circle') {
                svWidth = (data.base_size_mm.diameter_mm || 0) * engine.SCALE;
            } else {
                let tvMinY = Infinity;
                let tvMaxY = -Infinity;
                for (const key in stage1_tv_pts) {
                    tvMinY = Math.min(tvMinY, stage1_tv_pts[key].y);
                    tvMaxY = Math.max(tvMaxY, stage1_tv_pts[key].y);
                }
                svWidth = tvMaxY - tvMinY;
            }

            const svRight = svLeft + svWidth;
            const svCenterX = svLeft + svWidth / 2;

            if (isCylinder || (isPrism && !isCube)) {
                engine.primitives.push({ type: 'line', key: 'sv-left', points: [svLeft, fvTop, svLeft, fvBottom], dashed: false, step: 1 });
                engine.primitives.push({ type: 'line', key: 'sv-right', points: [svRight, fvTop, svRight, fvBottom], dashed: false, step: 1 });
                engine.primitives.push({ type: 'line', key: 'sv-top', points: [svLeft, fvTop, svRight, fvTop], dashed: false, step: 1 });
                engine.primitives.push({ type: 'line', key: 'sv-bottom', points: [svLeft, fvBottom, svRight, fvBottom], dashed: false, step: 1 });
                if (!isCylinder) {
                    engine.primitives.push({ type: 'line', key: 'sv-hidden-axis', points: [svCenterX, fvTop, svCenterX, fvBottom], dashed: true, step: 1 });
                }
            } else if (isCube) {
                engine.primitives.push({ type: 'line', key: 'sv-left', points: [svLeft, fvTop, svLeft, fvBottom], dashed: false, step: 1 });
                engine.primitives.push({ type: 'line', key: 'sv-right', points: [svRight, fvTop, svRight, fvBottom], dashed: false, step: 1 });
                engine.primitives.push({ type: 'line', key: 'sv-top', points: [svLeft, fvTop, svRight, fvTop], dashed: false, step: 1 });
                engine.primitives.push({ type: 'line', key: 'sv-bottom', points: [svLeft, fvBottom, svRight, fvBottom], dashed: false, step: 1 });
                engine.primitives.push({ type: 'line', key: 'sv-hidden-axis', points: [svCenterX, fvTop, svCenterX, fvBottom], dashed: true, step: 1 });
            } else if (isCone || !isPrism) {
                engine.primitives.push({ type: 'line', key: 'sv-left-slant', points: [svLeft, fvBottom, svCenterX, fvTop], dashed: false, step: 1 });
                engine.primitives.push({ type: 'line', key: 'sv-right-slant', points: [svRight, fvBottom, svCenterX, fvTop], dashed: false, step: 1 });
                engine.primitives.push({ type: 'line', key: 'sv-bottom', points: [svLeft, fvBottom, svRight, fvBottom], dashed: false, step: 1 });
                engine.primitives.push({ type: 'line', key: 'sv-hidden-axis', points: [svCenterX, fvTop, svCenterX, fvBottom], dashed: true, step: 1 });
            }

            engine.primitives.push({ type: 'line', key: 'sv-proj-top', points: [fvRight, fvTop, svLeft, fvTop], dashed: true, color: 'grey', step: 1 });
            engine.primitives.push({ type: 'line', key: 'sv-proj-bottom', points: [fvRight, fvBottom, svLeft, fvBottom], dashed: true, color: 'grey', step: 1 });

            let fvLeft = Infinity;
            for (const prim of engine.primitives) {
                if (prim.key.includes('fv') && prim.key.includes('-final') && prim.type === 'line') {
                    fvLeft = Math.min(fvLeft, prim.points[0], prim.points[2]);
                }
            }
            if (fvLeft === Infinity) fvLeft = engine.ORIGIN_X;
            const fvCenterX = (fvLeft + fvRight) / 2;

            let tvLeft = Infinity;
            let tvRight = -Infinity;
            let tvBottom = -Infinity;
            for (const prim of engine.primitives) {
                if (prim.key.includes('tv') && prim.key.includes('-final') && prim.type === 'line') {
                    tvLeft = Math.min(tvLeft, prim.points[0], prim.points[2]);
                    tvRight = Math.max(tvRight, prim.points[0], prim.points[2]);
                    tvBottom = Math.max(tvBottom, prim.points[1], prim.points[3]);
                }
            }
            if (tvLeft === Infinity) tvLeft = engine.ORIGIN_X;
            if (tvRight === -Infinity) tvRight = engine.ORIGIN_X + 100;
            if (tvBottom === -Infinity) tvBottom = engine.XY_LINE_Y + 100;
            const tvCenterX_final = (tvLeft + tvRight) / 2;

            engine.primitives.push({ type: 'text', key: 'fv-label', x: fvCenterX, y: fvTop - 20, content: 'F.V.', color: 'grey', step: 1, textAnchor: 'middle' });
            engine.primitives.push({ type: 'text', key: 'tv-label', x: tvCenterX_final, y: tvBottom + 30, content: 'T.V.', color: 'grey', step: 1, textAnchor: 'middle' });
            engine.primitives.push({ type: 'text', key: 'sv-label', x: svCenterX, y: fvTop - 20, content: 'S.V.', color: 'grey', step: 1, textAnchor: 'middle' });
        }

        if (!showSideView) {
            // --- Stage 2: HP Inclination ---
        const contactIndex = data.base_shape === 'circle'
            ? (data.tilt_direction === 'clockwise' ? 0 : Math.floor(numSides / 2))
            : 0;
        const pivotKey = baseKeys[contactIndex];
        const pivot_s1 = stage1_fv_pts[pivotKey];
        const normalizeRotation = (angle: number) => {
            let normalized = angle % (2 * Math.PI);
            if (normalized > Math.PI) normalized -= 2 * Math.PI;
            if (normalized <= -Math.PI) normalized += 2 * Math.PI;
            return normalized;
        };
        const chooseRestingRotation = (candidates: number[]) => {
            const directedCandidates = data.tilt_direction
                ? candidates.filter(angle => data.tilt_direction === 'clockwise' ? angle >= -1e-9 : angle <= 1e-9)
                : candidates;
            const choices = directedCandidates.length > 0 ? directedCandidates : candidates;
            return [...choices].sort((a, b) => {
                const score = (angle: number) => {
                    const rotated = allKeys.map(key => engine.rotatePoint(stage1_fv_pts[key], pivot_s1, angle));
                    const belowContact = Math.max(0, ...rotated.map(point => point.y - pivot_s1.y));
                    return belowContact * 1000 + Math.abs(angle);
                };
                return score(a) - score(b);
            })[0] || 0;
        };

        let rot_angle = 0;
        const contactPartnerKey = restingContact === 'slant_edge'
            ? 'apex'
            : restingContact === 'lateral_edge' || restingContact === 'generator' || restingContact === 'lateral_face'
                ? (isPrism ? topKeys[contactIndex] : 'apex')
                : undefined;
        if (contactPartnerKey) {
            const partner = stage1_fv_pts[contactPartnerKey];
            const contactAngle = Math.atan2(partner.y - pivot_s1.y, partner.x - pivot_s1.x);
            rot_angle = chooseRestingRotation([
                normalizeRotation(-contactAngle),
                normalizeRotation(Math.PI - contactAngle),
            ]);
        } else if (data.slant_edge_inclination_deg !== undefined) {
            const apexPt = stage1_fv_pts.apex;
            const currentAngle = Math.atan2(apexPt.y - pivot_s1.y, apexPt.x - pivot_s1.x);
            const targetRad = engine.degToRad(data.slant_edge_inclination_deg);
            rot_angle = chooseRestingRotation([
                normalizeRotation(-targetRad - currentAngle),
                normalizeRotation(-(Math.PI - targetRad) - currentAngle),
            ]);
        } else if (data.inclined_to || isContactResting) {
            // hpInclination is the final angle made by the axis with HP. The
            // initial axis is perpendicular to HP, so the construction rotates
            // through the complementary angle.
            const tilt = engine.degToRad(90 - hpInclination);
            rot_angle = isContactResting || data.tilt_direction
                ? chooseRestingRotation([normalizeRotation(tilt), normalizeRotation(-tilt)])
                : Math.abs(tilt);
        }

            if (Math.abs(rot_angle) <= 1e-9 && !isContactResting && vpInclination === 0) {
                // Step 2: Draw vertical projection lines from TV vertices up to FV
                allKeys.forEach(key => {
                    const tv = stage1_tv_pts[key];
                    const fv = stage1_fv_pts[key];
                    engine.primitives.push({
                        type: 'line', key: `proj-tv-fv-${key}`,
                        points: [tv.x, tv.y, fv.x, fv.y] as [number, number, number, number],
                        dashed: true, color: '#e0e0e0', step: 2, primitiveRole: 'projection'
                    });
                });

                // Step 3: TV base outline (already in stage1_tv_prims — emit at step 3)
                const tvBasePrims = stage1_tv_prims.filter(p => p.key?.includes('base') || p.key?.includes('tv-base-circle'));
                tvBasePrims.forEach(p => engine.primitives.push({ ...p, step: 3, primitiveRole: 'visible' }));

                // Step 4: FV top/lateral edges + axis line
                const fvTopLateralPrims = stage1_fv_prims.filter(p => p.key?.includes('top') || p.key?.includes('slant') || p.key?.includes('axis') || p.key?.includes('base') || p.key?.includes('side'));
                fvTopLateralPrims.forEach(p => engine.primitives.push({ ...p, step: 4, primitiveRole: 'visible' }));
                
                // Axis line in FV
                engine.primitives.push({
                    type: 'line', key: 'simple-fv-axis',
                    points: [stage1_fv_pts.axis_base.x, stage1_fv_pts.axis_base.y,
                             stage1_fv_pts.axis_top.x, stage1_fv_pts.axis_top.y] as [number, number, number, number],
                    dashed: true, color: '#d32f2f', step: 4, primitiveRole: 'axis'
                });

                // Step 5: Hidden lines
                if (data.base_shape !== 'circle') {
                    const sortedY = baseKeys.map(k => stage1_tv_pts[k].y).sort((a, b) => a - b);
                    const midY = (sortedY[0] + sortedY[sortedY.length - 1]) / 2;
                    for (let i = 0; i < numSides; i++) {
                        const t0 = stage1_tv_pts[baseKeys[i]];
                        const t1 = stage1_tv_pts[baseKeys[(i + 1) % numSides]];
                        const my = (t0.y + t1.y) / 2;
                        // Edges behind center are hidden
                        if (my < midY) {
                            engine.primitives.push({
                                type: 'line', key: `hidden-tv-base-${i}`,
                                points: [t0.x, t0.y, t1.x, t1.y] as [number, number, number, number],
                                dashed: true, color: '#004d40', step: 5, primitiveRole: 'hidden'
                            });
                        }
                    }
                }

                engine.primitives.push({ type: 'line', key: 'step5-dummy', points: [0,0,0,0], dashed: true, step: 5, color: 'transparent', primitiveRole: 'hidden' });
                finalStep(6, stage1_prims);
                addSolidDimensions();
                return; 
            }

        const buffer_s2 = 100;
        const temp_rotated_fv_pts: PointMap = {};
        allKeys.forEach(key => {
            temp_rotated_fv_pts[key] = engine.rotatePoint(stage1_fv_pts[key], pivot_s1, rot_angle);
        });

        const maxX_stage1 = Math.max(...Object.values(stage1_fv_pts).map(p => p.x));
        const minX_rotated_fv = Math.min(...Object.values(temp_rotated_fv_pts).map(p => p.x));
        const shiftX_s2 = (maxX_stage1 + buffer_s2) - minX_rotated_fv;
        
        // A named contact must remain exactly on the resting plane. For legacy
        // base-resting inputs, keep the former envelope-based placement.
        const maxY_rotated_fv = Math.max(...Object.values(temp_rotated_fv_pts).map(p => p.y));
        const shiftY_s2 = isContactResting
            ? engine.XY_LINE_Y - temp_rotated_fv_pts[pivotKey].y
            : engine.XY_LINE_Y - maxY_rotated_fv;

        const stage2_fv_pts: PointMap = {};
        allKeys.forEach(key => {
            const temp_p = temp_rotated_fv_pts[key];
            stage2_fv_pts[key] = {
                x: temp_p.x + shiftX_s2,
                y: temp_p.y + shiftY_s2
            };
        });

        const stage2_fv_prims: SvgPrimitive[] = [];
        for (let i = 0; i < numSides; i++) stage2_fv_prims.push({ type: 'line', key: `s2-fv-base-${i}`, points: [stage2_fv_pts[baseKeys[i]].x, stage2_fv_pts[baseKeys[i]].y, stage2_fv_pts[baseKeys[(i + 1) % numSides]].x, stage2_fv_pts[baseKeys[(i + 1) % numSides]].y], dashed: false });
        if(isPrism) for (let i = 0; i < numSides; i++) {
             stage2_fv_prims.push({ type: 'line', key: `s2-fv-top-${i}`, points: [stage2_fv_pts[topKeys[i]].x, stage2_fv_pts[topKeys[i]].y, stage2_fv_pts[topKeys[(i + 1) % numSides]].x, stage2_fv_pts[topKeys[(i + 1) % numSides]].y], dashed: false });
             stage2_fv_prims.push({ type: 'line', key: `s2-fv-side-${i}`, points: [stage2_fv_pts[baseKeys[i]].x, stage2_fv_pts[baseKeys[i]].y, stage2_fv_pts[topKeys[i]].x, stage2_fv_pts[topKeys[i]].y], dashed: false });
        } else for (let i = 0; i < numSides; i++) stage2_fv_prims.push({ type: 'line', key: `s2-fv-slant-${i}`, points: [stage2_fv_pts.apex.x, stage2_fv_pts.apex.y, stage2_fv_pts[baseKeys[i]].x, stage2_fv_pts[baseKeys[i]].y], dashed: false });
        stage2_fv_prims.push({ type: 'line', key: `s2-fv-axis`, points: [stage2_fv_pts.axis_base.x, stage2_fv_pts.axis_base.y, stage2_fv_pts.axis_top.x, stage2_fv_pts.axis_top.y], dashed: true, color: '#d32f2f' });
        applyVisibility(stage2_fv_pts, stage2_fv_prims, 'fv');
        constructionStep(2, stage2_fv_prims);
        engine.addOrthographicSolidLabels(stage1_tv_pts, stage1_tv_pts, stage2_fv_pts, baseKeys, topKeys, isPrism, 2, ['fv']);

        const axisTop2 = stage2_fv_pts.axis_top;
        const axisBase2 = stage2_fv_pts.axis_base;
        const axisDy2 = axisBase2.y - axisTop2.y;
        const vertex2 = Math.abs(axisDy2) > 1e-9
            ? engine.getAxisXYIntersection(axisTop2, axisBase2)
            : { x: axisBase2.x, y: axisBase2.y };
        const axisAngleRad2 = Math.atan2(axisTop2.y - vertex2.y, axisTop2.x - vertex2.x);
        const constructedHpInclination = engine.radToDeg(Math.atan2(
            Math.abs(axisTop2.y - axisBase2.y),
            Math.abs(axisTop2.x - axisBase2.x),
        ));
        if (data.slant_edge_inclination_deg !== undefined) {
            const slantPt = stage2_fv_pts[pivotKey];
            const apex2 = stage2_fv_pts.apex;
            const slantAngleRad2 = Math.atan2(apex2.y - slantPt.y, apex2.x - slantPt.x);
            engine.addAngleDimension(slantPt, 0, slantAngleRad2, 45,
                engine.formatAngleLabel(data.slant_edge_inclination_deg), 'dim-angle-slant-hp');
        } else if (axisTop2.x !== axisBase2.x) {
            engine.primitives.push({ 
                type: 'line', 
                key: 'dim-axis-ext-hp',
                points: [axisBase2.x, axisBase2.y, vertex2.x, vertex2.y], 
                dashed: true, 
                color: 'grey', 
                step: engine.lastStep + 1 
            });
            engine.addAngleDimension(vertex2, 0, axisAngleRad2, 50, 
                engine.formatAngleLabel(contactPartnerKey ? Number(constructedHpInclination.toFixed(2)) : hpInclination), 'dim-angle-hp');
        }

        const stage2_tv_pts: PointMap = {};
        allKeys.forEach(key => {
            stage2_tv_pts[key] = {
                x: stage2_fv_pts[key].x,
                y: stage1_tv_pts[key].y,
                z: engine.XY_LINE_Y - stage2_fv_pts[key].y,
            };
            engine.primitives.push({ type: 'line', key: `proj-h-${key}`, points: [stage1_tv_pts[key].x, stage1_tv_pts[key].y, stage2_tv_pts[key].x, stage1_tv_pts[key].y], dashed: true, step: 3, color: '#e0e0e0' });
            engine.primitives.push({ type: 'line', key: `proj-v-${key}`, points: [stage2_fv_pts[key].x, stage2_fv_pts[key].y, stage2_tv_pts[key].x, stage2_tv_pts[key].y], dashed: true, step: 3, color: '#e0e0e0' });
        });
        
        const stage2_tv_prims: SvgPrimitive[] = [];
        for (let i = 0; i < numSides; i++) stage2_tv_prims.push({ type: 'line', key: `s2-tv-base-${i}`, points: [stage2_tv_pts[baseKeys[i]].x, stage2_tv_pts[baseKeys[i]].y, stage2_tv_pts[baseKeys[(i + 1) % numSides]].x, stage2_tv_pts[baseKeys[(i + 1) % numSides]].y], dashed: false });
        if(isPrism) for (let i = 0; i < numSides; i++) {
             stage2_tv_prims.push({ type: 'line', key: `s2-tv-top-${i}`, points: [stage2_tv_pts[topKeys[i]].x, stage2_tv_pts[topKeys[i]].y, stage2_tv_pts[topKeys[(i + 1) % numSides]].x, stage2_tv_pts[topKeys[(i + 1) % numSides]].y], dashed: false });
             stage2_tv_prims.push({ type: 'line', key: `s2-tv-side-${i}`, points: [stage2_tv_pts[baseKeys[i]].x, stage2_tv_pts[baseKeys[i]].y, stage2_tv_pts[topKeys[i]].x, stage2_tv_pts[topKeys[i]].y], dashed: false });
        } else for (let i = 0; i < numSides; i++) stage2_tv_prims.push({ type: 'line', key: `s2-tv-slant-${i}`, points: [stage2_tv_pts.apex.x, stage2_tv_pts.apex.y, stage2_tv_pts[baseKeys[i]].x, stage2_tv_pts[baseKeys[i]].y], dashed: false });
        stage2_tv_prims.push({ type: 'line', key: `s2-tv-axis`, points: [stage2_tv_pts.axis_base.x, stage2_tv_pts.axis_base.y, stage2_tv_pts.axis_top.x, stage2_tv_pts.axis_top.y], dashed: true, color: '#d32f2f' });
        applyVisibility(stage2_tv_pts, stage2_tv_prims, 'tv');
        constructionStep(3, stage2_tv_prims);
        engine.addOrthographicSolidLabels(stage1_tv_pts, stage2_tv_pts, stage2_fv_pts, baseKeys, topKeys, isPrism, 3, ['tv']);
        
        // --- Stage 3: VP Inclination ---
        const vp_phi = engine.degToRad(vpInclination);
            if (vp_phi === 0) { 
                // Step 4: Stage 2 FV rotation
                stage2_fv_prims.forEach(p => engine.primitives.push({ ...p, step: 4, color: '#004d40', primitiveRole: 'visible' }));
                
                // Step 5: Stage 2 TV projection
                stage2_tv_prims.forEach(p => engine.primitives.push({ ...p, step: 5, color: '#004d40', primitiveRole: 'visible' }));
                
                engine.primitives.push({ type: 'line', key: 'step5-dummy2', points: [0,0,0,0], dashed: true, step: 5, color: 'transparent', primitiveRole: 'hidden' });
                finalStep(6, [...stage2_fv_prims, ...stage2_tv_prims]);
                addSolidDimensions();
                return; 
            }

        const maxX_stage2 = Math.max(...Object.values(stage2_tv_pts).map(p => p.x));
        const buffer = 150;
        const pivot_s2 = stage2_tv_pts[baseKeys[0]];
        const temp_rotated_pts: PointMap = {};
        allKeys.forEach(key => {
            temp_rotated_pts[key] = engine.rotatePoint(stage2_tv_pts[key], pivot_s2, -vp_phi);
        });

        const minX_rotated = Math.min(...Object.values(temp_rotated_pts).map(p => p.x));
        const shiftX = (maxX_stage2 + buffer) - minX_rotated;
        const shiftY = pivot_s2.y - temp_rotated_pts[baseKeys[0]].y;

        const stage3_tv_pts: PointMap = {};
        allKeys.forEach(key => {
            const temp_p = temp_rotated_pts[key];
            stage3_tv_pts[key] = {
                x: temp_p.x + shiftX,
                y: temp_p.y + shiftY,
                z: stage2_tv_pts[key].z
            };
        });

        const stage3_tv_prims: SvgPrimitive[] = [];
        for (let i = 0; i < numSides; i++) stage3_tv_prims.push({ type: 'line', key: `s3-tv-base-${i}`, points: [stage3_tv_pts[baseKeys[i]].x, stage3_tv_pts[baseKeys[i]].y, stage3_tv_pts[baseKeys[(i + 1) % numSides]].x, stage3_tv_pts[baseKeys[(i + 1) % numSides]].y], dashed: false });
        if(isPrism) for (let i = 0; i < numSides; i++) {
             stage3_tv_prims.push({ type: 'line', key: `s3-tv-top-${i}`, points: [stage3_tv_pts[topKeys[i]].x, stage3_tv_pts[topKeys[i]].y, stage3_tv_pts[topKeys[(i + 1) % numSides]].x, stage3_tv_pts[topKeys[(i + 1) % numSides]].y], dashed: false });
             stage3_tv_prims.push({ type: 'line', key: `s3-tv-side-${i}`, points: [stage3_tv_pts[baseKeys[i]].x, stage3_tv_pts[baseKeys[i]].y, stage3_tv_pts[topKeys[i]].x, stage3_tv_pts[topKeys[i]].y], dashed: false });
        } else for (let i = 0; i < numSides; i++) stage3_tv_prims.push({ type: 'line', key: `s3-tv-slant-${i}`, points: [stage3_tv_pts.apex.x, stage3_tv_pts.apex.y, stage3_tv_pts[baseKeys[i]].x, stage3_tv_pts[baseKeys[i]].y], dashed: false });
        stage3_tv_prims.push({ type: 'line', key: `s3-tv-axis`, points: [stage3_tv_pts.axis_base.x, stage3_tv_pts.axis_base.y, stage3_tv_pts.axis_top.x, stage3_tv_pts.axis_top.y], dashed: true, color: '#d32f2f' });
        applyVisibility(stage3_tv_pts, stage3_tv_prims, 'tv');
        constructionStep(4, stage3_tv_prims);
        engine.addOrthographicSolidLabels(stage1_tv_pts, stage3_tv_pts, stage2_fv_pts, baseKeys, topKeys, isPrism, 4, ['tv']);

        const stage3_fv_pts: PointMap = {};
        allKeys.forEach(key => {
            stage3_fv_pts[key] = {
                x: stage3_tv_pts[key].x,
                y: stage2_fv_pts[key].y,
                z: stage3_tv_pts[key].y,
            };
            engine.primitives.push({ type: 'line', key: `proj-h-s3-${key}`, points: [stage2_fv_pts[key].x, stage2_fv_pts[key].y, stage3_fv_pts[key].x, stage3_fv_pts[key].y], dashed: true, step: 5, color: '#e0e0e0' });
            engine.primitives.push({ type: 'line', key: `proj-v-s3-${key}`, points: [stage3_tv_pts[key].x, stage3_tv_pts[key].y, stage3_fv_pts[key].x, stage3_fv_pts[key].y], dashed: true, step: 5, color: '#e0e0e0' });
        });
        
        const stage3_fv_prims: SvgPrimitive[] = [];
        for (let i = 0; i < numSides; i++) stage3_fv_prims.push({ type: 'line', key: `s3-fv-base-${i}`, points: [stage3_fv_pts[baseKeys[i]].x, stage3_fv_pts[baseKeys[i]].y, stage3_fv_pts[baseKeys[(i + 1) % numSides]].x, stage3_fv_pts[baseKeys[(i + 1) % numSides]].y], dashed: false });
        if(isPrism) for (let i = 0; i < numSides; i++) {
             stage3_fv_prims.push({ type: 'line', key: `s3-fv-top-${i}`, points: [stage3_fv_pts[topKeys[i]].x, stage3_fv_pts[topKeys[i]].y, stage3_fv_pts[topKeys[(i + 1) % numSides]].x, stage3_fv_pts[topKeys[(i + 1) % numSides]].y], dashed: false });
             stage3_fv_prims.push({ type: 'line', key: `s3-fv-side-${i}`, points: [stage3_fv_pts[baseKeys[i]].x, stage3_fv_pts[baseKeys[i]].y, stage3_fv_pts[topKeys[i]].x, stage3_fv_pts[topKeys[i]].y], dashed: false });
        } else for (let i = 0; i < numSides; i++) stage3_fv_prims.push({ type: 'line', key: `s3-fv-slant-${i}`, points: [stage3_fv_pts.apex.x, stage3_fv_pts.apex.y, stage3_fv_pts[baseKeys[i]].x, stage3_fv_pts[baseKeys[i]].y], dashed: false });
        stage3_fv_prims.push({ type: 'line', key: `s3-fv-axis`, points: [stage3_fv_pts.axis_base.x, stage3_fv_pts.axis_base.y, stage3_fv_pts.axis_top.x, stage3_fv_pts.axis_top.y], dashed: true, color: '#d32f2f' });
        applyVisibility(stage3_fv_pts, stage3_fv_prims, 'fv');
        constructionStep(5, stage3_fv_prims);
        engine.addOrthographicSolidLabels(stage1_tv_pts, stage3_tv_pts, stage3_fv_pts, baseKeys, topKeys, isPrism, 5, ['fv']);

        const axisTop3 = stage3_tv_pts.axis_top;
        const axisBase3 = stage3_tv_pts.axis_base;
        const vertex3 = engine.getAxisXYIntersection(axisTop3, axisBase3);
        const axisAngleRad3 = Math.atan2(axisTop3.y - vertex3.y, axisTop3.x - vertex3.x);
        if (axisTop3.x !== axisBase3.x) {
            engine.primitives.push({ 
                type: 'line', 
                key: 'dim-axis-ext-vp',
                points: [axisBase3.x, axisBase3.y, vertex3.x, vertex3.y], 
                dashed: true, 
                color: 'grey', 
                step: engine.lastStep + 1 
            });
            engine.addAngleDimension(vertex3, 0, axisAngleRad3, 50,
                engine.formatAngleLabel(vpInclination), 'dim-angle-vp');
        }
        
            finalStep(6, [...stage3_tv_prims, ...stage3_fv_prims]);
            addSolidDimensions();
        }
    }
