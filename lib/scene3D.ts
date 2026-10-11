import { GeometryOutput } from '../types';

export interface Point3D {
    id: string;
    label: string;
    x: number;
    y: number; // Height above HP / Ground Plane (y >= 0 is above HP/GP)
    z: number; // Depth in front of VP / relative to PP (z >= 0 is in front of VP/PP)
    step?: number;
    role?: 'object' | 'projection' | 'dimension' | 'station' | 'piercing';
}

export interface Segment3D {
    id?: string;
    start: Point3D;
    end: Point3D;
    style?: 'solid' | 'dashed' | 'chain';
    color?: string;
    role?: 'object' | 'projector' | 'axis' | 'section' | 'dimension' | 'cutting_plane' | 'visual_ray' | 'horizon' | 'ground';
    step?: number;
}

export interface PlanePolygon3D {
    id: string;
    points: Point3D[];
    color: string;
    opacity: number;
    role: 'section' | 'cutting_plane' | 'face' | 'picture_plane' | 'horizon_plane';
    step?: number;
    label?: string;
}

export interface Dimension3D {
    id: string;
    p1: Point3D;
    p2: Point3D;
    label: string;
    offset?: { x: number; y: number; z: number };
    step?: number;
}

export interface AngleAnnotation3D {
    origin: Point3D;
    dirBase: { x: number; y: number; z: number };
    dirInclined: { x: number; y: number; z: number };
    radius: number;
    label: string;
    plane: 'HP' | 'VP';
    step?: number;
}

export interface Step3DInfo {
    step: number;
    title: string;
    description: string;
}

export interface Scene3DData {
    mode: 'orthographic' | 'perspective';
    points: Point3D[];
    segments: Segment3D[];
    polygons: PlanePolygon3D[];
    dimensions: Dimension3D[];
    angleAnnotations: AngleAnnotation3D[];
    planeSize: number;
    maxStep: number;
    stepsInfo: Step3DInfo[];
    title: string;
}

export function resolveScene3D(geometry: GeometryOutput): Scene3DData {
    const points: Point3D[] = [];
    const segments: Segment3D[] = [];
    const polygons: PlanePolygon3D[] = [];
    const dimensions: Dimension3D[] = [];
    const angleAnnotations: AngleAnnotation3D[] = [];
    const stepsInfo: Step3DInfo[] = [];

    const params = geometry.params;
    const type = (geometry.type || (params as any)?.type || 'solid').toLowerCase();

    const addSegment = (
        p1: Point3D,
        p2: Point3D,
        role: Segment3D['role'] = 'object',
        style: Segment3D['style'] = 'solid',
        color = '#1f2937',
        step = 1,
        id?: string
    ) => {
        segments.push({ id, start: p1, end: p2, role, style, color, step });
    };

    const addPointWithProjectors = (p: Point3D, step = 1, color = '#004d40') => {
        points.push({ ...p, step, role: 'object' });
        const hpFoot: Point3D = { id: `${p.id}_hp`, label: `${p.label.toLowerCase()}`, x: p.x, y: 0, z: p.z, step, role: 'projection' };
        const vpFoot: Point3D = { id: `${p.id}_vp`, label: `${p.label.toLowerCase()}'`, x: p.x, y: p.y, z: 0, step, role: 'projection' };
        const xyFoot: Point3D = { id: `${p.id}_xy`, label: '', x: p.x, y: 0, z: 0, step, role: 'projection' };

        points.push(hpFoot, vpFoot);

        if (Math.abs(p.y) > 0.1) {
            addSegment(p, hpFoot, 'projector', 'dashed', '#94a3b8', step);
            addSegment(vpFoot, xyFoot, 'projector', 'dashed', '#cbd5e1', step);
        }
        if (Math.abs(p.z) > 0.1) {
            addSegment(p, vpFoot, 'projector', 'dashed', '#94a3b8', step);
            addSegment(hpFoot, xyFoot, 'projector', 'dashed', '#cbd5e1', step);
        }
    };

    // ─────────────────────────────────────────────────────────────
    // PERSPECTIVE PROJECTION (Exact 3D Ray Cones & Picture Plane Setup)
    // ─────────────────────────────────────────────────────────────
    if (type === 'perspective_projection' || type === 'perspective') {
        const pData = params as any;
        const rawObj = pData?.object || pData || {};
        const placement = pData?.placement || {};
        const station = pData?.station_point || {};

        // In 3D space:
        // Ground Plane (GP) is at y = 0
        // Picture Plane (PP) is vertical at z = 0
        // Station Point (S.P. / Eye) is at z = +distance_in_front_of_PP, y = +height_above_GP
        // Object is placed behind PP (z <= 0) or touching (z <= 0)

        const spDist = station.distance_in_front_of_PP_mm ?? 90;
        const spHeight = station.height_above_GP_mm ?? 70;
        const spOffset = station.lateral_offset_from_object_center_mm ?? 0;

        const sp: Point3D = {
            id: 'station_point',
            label: 'S.P.',
            x: spOffset,
            y: spHeight,
            z: spDist,
            step: 2,
            role: 'station',
        };

        const nearestDist = placement.nearest_distance_from_PP_mm ?? 0;
        const clearance = placement.ground_clearance_mm ?? 0;
        const isBehind = placement.position_relative_to_PP !== 'in_front';

        // Build 3D Object Vertices
        const objectVertices: Point3D[] = [];
        const objectSegments: Array<[number, number, string]> = [];

        const isBlockModel = rawObj.kind === 'block_model' || Array.isArray(rawObj.primitives);
        const isLine = rawObj.kind === 'line' || (rawObj.length_mm && !rawObj.base_shape && !rawObj.solid_type);
        const isSolid = !isLine && !isBlockModel;

        if (isSolid) {
            const solidType = rawObj.solid_type || pData.solid_type || 'cube';
            const isPrism = solidType === 'prism' || solidType === 'cube' || solidType === 'cylinder';
            // When solid_type is cube, force square base with 4 sides
            const shape = solidType === 'cube'
                ? 'square'
                : (solidType === 'cylinder' || solidType === 'cone'
                    ? 'circle'
                    : (rawObj.base_shape || pData.base_shape || 'square'));
            const numSides = shape === 'triangle' ? 3 : shape === 'square' || shape === 'rectangle' ? 4 : shape === 'pentagon' ? 5 : shape === 'hexagon' ? 6 : 24;
            const side = rawObj.base_size_mm?.side_mm || rawObj.base_size_mm?.diameter_mm || pData.base_size_mm?.side_mm || (solidType === 'cube' ? 40 : 35);
            const radius = shape === 'circle' ? side / 2 : side / (2 * Math.sin(Math.PI / numSides));
            const height = solidType === 'cube' ? side : (rawObj.height_mm || pData.height_mm || 60);
            const angleDeg = (rawObj.base_edge_angle_to_PP_deg ?? pData.base_edge_angle_to_PP_deg ?? (shape === 'square' ? 45 : 30)) * Math.PI / 180;

            const baseIndices: number[] = [];
            const topIndices: number[] = [];

            // Compute local rotated base coordinates
            const rawBasePts: Array<{ x: number; z: number }> = [];
            for (let i = 0; i < numSides; i++) {
                const a = i * 2 * Math.PI / numSides - (shape === 'square' ? Math.PI / 4 : 0);
                const localX = radius * Math.cos(a);
                const localZ = radius * Math.sin(a);

                // Rotate about vertical axis by angleDeg
                const rotX = localX * Math.cos(angleDeg) - localZ * Math.sin(angleDeg);
                const rotZ = localX * Math.sin(angleDeg) + localZ * Math.cos(angleDeg);
                rawBasePts.push({ x: rotX, z: -rotZ });
            }

            // Align object relative to Picture Plane (z = 0)
            // If behind PP: front-most vertex (max z) must touch -nearestDist
            // If in front of PP: rear-most vertex (min z) must touch +nearestDist
            const zValues = rawBasePts.map((p) => p.z);
            let shiftZ = 0;
            if (isBehind) {
                const maxZ = Math.max(...zValues);
                shiftZ = -nearestDist - maxZ;
            } else {
                const minZ = Math.min(...zValues);
                shiftZ = nearestDist - minZ;
            }

            for (let i = 0; i < numSides; i++) {
                const p = rawBasePts[i];
                const bPt: Point3D = {
                    id: `persp_b_${i}`,
                    label: String.fromCharCode(65 + i),
                    x: p.x,
                    y: clearance,
                    z: p.z + shiftZ,
                    step: 1,
                };
                baseIndices.push(objectVertices.length);
                objectVertices.push(bPt);

                if (isPrism) {
                    const tPt: Point3D = {
                        id: `persp_t_${i}`,
                        label: `${String.fromCharCode(65 + i)}'`,
                        x: p.x,
                        y: clearance + height,
                        z: p.z + shiftZ,
                        step: 1,
                    };
                    topIndices.push(objectVertices.length);
                    objectVertices.push(tPt);
                }
            }

            // Slant apex if pyramid/cone
            let apexIdx = -1;
            if (!isPrism) {
                const apexPt: Point3D = {
                    id: 'persp_apex',
                    label: 'O',
                    x: 0,
                    y: clearance + height,
                    z: shiftZ,
                    step: 1,
                };
                apexIdx = objectVertices.length;
                objectVertices.push(apexPt);
            }

            // Edges
            for (let i = 0; i < numSides; i++) {
                objectSegments.push([baseIndices[i], baseIndices[(i + 1) % numSides], '#1e3a8a']);
                if (isPrism) {
                    objectSegments.push([topIndices[i], topIndices[(i + 1) % numSides], '#1e3a8a']);
                    objectSegments.push([baseIndices[i], topIndices[i], '#1e3a8a']);
                } else if (apexIdx !== -1) {
                    objectSegments.push([baseIndices[i], apexIdx, '#1e3a8a']);
                }
            }
        } else if (isBlockModel && rawObj.primitives) {
            // Render block model box primitives
            rawObj.primitives.forEach((prim: any, primIdx: number) => {
                if (prim.primitive === 'box') {
                    const o = prim.origin_mm || { x: 0, y: 0, z: 0 };
                    const s = prim.size_mm || { x: 40, y: 40, z: 40 };
                    const startIdx = objectVertices.length;
                    const corners = [
                        [o.x, o.y + clearance, -nearestDist - (o.z + s.z)],
                        [o.x + s.x, o.y + clearance, -nearestDist - (o.z + s.z)],
                        [o.x + s.x, o.y + clearance, -nearestDist - o.z],
                        [o.x, o.y + clearance, -nearestDist - o.z],
                        [o.x, o.y + clearance + s.y, -nearestDist - (o.z + s.z)],
                        [o.x + s.x, o.y + clearance + s.y, -nearestDist - (o.z + s.z)],
                        [o.x + s.x, o.y + clearance + s.y, -nearestDist - o.z],
                        [o.x, o.y + clearance + s.y, -nearestDist - o.z],
                    ];
                    corners.forEach(([x, y, z], ci) => {
                        objectVertices.push({
                            id: `blk_${primIdx}_${ci}`,
                            label: String.fromCharCode(65 + (ci % 26)),
                            x,
                            y,
                            z,
                            step: 1,
                        });
                    });
                    const bEdges = [
                        [0, 1], [1, 2], [2, 3], [3, 0],
                        [4, 5], [5, 6], [6, 7], [7, 4],
                        [0, 4], [1, 5], [2, 6], [3, 7],
                    ];
                    bEdges.forEach(([a, b]) => objectSegments.push([startIdx + a, startIdx + b, '#1e3a8a']));
                }
            });
        } else if (isLine) {
            const L = rawObj.length_mm || 60;
            const inc = (rawObj.inclination_to_GP_deg || 0) * Math.PI / 180;
            const ang = (rawObj.angle_to_PP_deg || 0) * Math.PI / 180;
            const h = rawObj.height_above_GP_mm || clearance || 20;

            const p1: Point3D = { id: 'p_l1', label: 'A', x: -L * 0.4 * Math.cos(ang), y: h, z: -nearestDist, step: 1 };
            const p2: Point3D = { id: 'p_l2', label: 'B', x: L * 0.6 * Math.cos(ang), y: h + L * Math.sin(inc), z: -nearestDist - L * Math.sin(ang), step: 1 };
            objectVertices.push(p1, p2);
            objectSegments.push([0, 1, '#1e3a8a']);
        } else {
            // Default cube
            const s = 40;
            const corners = [
                [-s / 2, clearance, -nearestDist - s], [s / 2, clearance, -nearestDist - s], [s / 2, clearance, -nearestDist], [-s / 2, clearance, -nearestDist],
                [-s / 2, clearance + s, -nearestDist - s], [s / 2, clearance + s, -nearestDist - s], [s / 2, clearance + s, -nearestDist], [-s / 2, clearance + s, -nearestDist],
            ];
            corners.forEach(([x, y, z], i) => objectVertices.push({ id: `cube_${i}`, label: String.fromCharCode(65 + i), x, y, z, step: 1 }));
            const cEdges = [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]];
            cEdges.forEach(([a, b]) => objectSegments.push([a, b, '#1e3a8a']));
        }

        // Add 3D Object Vertices to scene
        objectVertices.forEach((v) => points.push(v));

        // Add 3D Object Segments
        objectSegments.forEach(([a, b, col]) => {
            addSegment(objectVertices[a], objectVertices[b], 'object', 'solid', col, 1);
        });

        // Add Station Point
        points.push(sp);

        // Compute Visual Rays & Piercing Points on Picture Plane (z = 0)
        const piercingPoints: Point3D[] = [];
        objectVertices.forEach((v, idx) => {
            // Ray from S.P. (sp.x, sp.y, sp.z) to Vertex (v.x, v.y, v.z)
            // Piercing point with z = 0:
            // z(t) = sp.z + t * (v.z - sp.z) = 0 => t = -sp.z / (v.z - sp.z) = sp.z / (sp.z - v.z)
            const denom = sp.z - v.z;
            const t = Math.abs(denom) > 1e-4 ? sp.z / denom : 0.5;

            const px = sp.x + t * (v.x - sp.x);
            const py = sp.y + t * (v.y - sp.y);
            const pz = 0; // Exactly on Picture Plane

            const pPt: Point3D = {
                id: `pierce_${idx}`,
                label: `${v.label.toLowerCase()}`,
                x: px,
                y: py,
                z: pz,
                step: 3,
                role: 'piercing',
            };
            piercingPoints.push(pPt);
            points.push(pPt);

            // Visual Ray segment from S.P. to Object vertex (passing through PP)
            addSegment(sp, v, 'visual_ray', 'dashed', '#00897b', 2);
        });

        // Connect Piercing Points on Picture Plane (The True 2D Perspective Projection in 3D Space!)
        objectSegments.forEach(([a, b]) => {
            addSegment(piercingPoints[a], piercingPoints[b], 'section', 'solid', '#c62828', 3, `persp_proj_${a}_${b}`);
        });

        // Perspective Plane Polygons:
        // 1. Picture Plane (PP) at z = 0, translucent glass
        const ppWidth = Math.max(180, (spDist + Math.abs(nearestDist) + 60) * 1.6);
        const ppHeight = Math.max(140, (spHeight + 50) * 1.4);
        polygons.push({
            id: 'picture_plane_3d',
            points: [
                { id: 'pp1', label: '', x: -ppWidth / 2, y: 0, z: 0, step: 1 },
                { id: 'pp2', label: '', x: ppWidth / 2, y: 0, z: 0, step: 1 },
                { id: 'pp3', label: '', x: ppWidth / 2, y: ppHeight, z: 0, step: 1 },
                { id: 'pp4', label: '', x: -ppWidth / 2, y: ppHeight, z: 0, step: 1 },
            ],
            color: '#3b82f6',
            opacity: 0.18,
            role: 'picture_plane',
            step: 1,
            label: 'PICTURE PLANE (P.P.)',
        });

        // Ground Line (GL) at y = 0, z = 0 on PP
        addSegment(
            { id: 'gl1', label: 'G.L.', x: -ppWidth / 2, y: 0, z: 0, step: 1 },
            { id: 'gl2', label: 'G.L.', x: ppWidth / 2, y: 0, z: 0, step: 1 },
            'ground',
            'solid',
            '#0f172a',
            1
        );

        // Horizon Line (HL) at y = spHeight, z = 0 on PP
        addSegment(
            { id: 'hl1', label: 'H.L.', x: -ppWidth / 2, y: spHeight, z: 0, step: 2 },
            { id: 'hl2', label: 'H.L.', x: ppWidth / 2, y: spHeight, z: 0, step: 2 },
            'horizon',
            'chain',
            '#7b1fa2',
            2
        );

        // Eye Height Dimension
        dimensions.push({
            id: 'dim_eye_h',
            p1: { id: 'eh1', label: '', x: sp.x, y: 0, z: sp.z, step: 2 },
            p2: sp,
            label: `Eye Height = ${Math.round(spHeight)} mm`,
            step: 2,
        });

        // Station Distance from PP
        dimensions.push({
            id: 'dim_sp_dist',
            p1: { id: 'sd1', label: '', x: sp.x, y: 0, z: 0, step: 2 },
            p2: { id: 'sd2', label: '', x: sp.x, y: 0, z: sp.z, step: 2 },
            label: `Distance in front of PP = ${Math.round(spDist)} mm`,
            step: 2,
        });

        stepsInfo.push(
            { step: 1, title: 'Object Behind Picture Plane', description: '3D object set behind the transparent Picture Plane (P.P.) on the Ground Plane.' },
            { step: 2, title: 'Station Point & Visual Rays', description: 'Position observer eye (S.P.) in front of P.P. and cast visual rays to every vertex.' },
            { step: 3, title: 'Perspective Image on Picture Plane', description: 'Connect piercing points on the Picture Plane where visual rays intersect.' }
        );

        const planeSize = Math.max(160, ppWidth * 1.1);

        return {
            mode: 'perspective',
            points,
            segments,
            polygons,
            dimensions,
            angleAnnotations,
            planeSize,
            maxStep: 3,
            stepsInfo,
            title: '3D PERSPECTIVE PROJECTION (CENTRAL RAY CONE)',
        };
    }

    // ─────────────────────────────────────────────────────────────
    // 1. POINTS
    // ─────────────────────────────────────────────────────────────
    if (type === 'point' || type === 'point_special') {
        const pData = params as any;
        let y = 0;
        let z = 0;
        const name = pData?.name || 'P';

        if (type === 'point') {
            const pos = pData?.position;
            const dHP = pos?.distance_from_HP_mm ?? 30;
            const dVP = pos?.distance_from_VP_mm ?? 20;
            const plane = pos?.plane || 'FIRST_QUADRANT';

            if (plane === 'FIRST_QUADRANT') { y = dHP; z = dVP; }
            else if (plane === 'SECOND_QUADRANT') { y = dHP; z = -dVP; }
            else if (plane === 'THIRD_QUADRANT') { y = -dHP; z = -dVP; }
            else if (plane === 'FOURTH_QUADRANT') { y = -dHP; z = dVP; }
            else if (plane === 'HP') { y = 0; z = dVP; }
            else if (plane === 'VP') { y = dHP; z = 0; }
        } else {
            const pos = pData?.position;
            const d = pData?.distance_mm ?? 25;
            if (pos === 'ON_HP') { y = 0; z = d; }
            else if (pos === 'ON_VP') { y = d; z = 0; }
            else if (pos === 'ON_XY') { y = 0; z = 0; }
        }

        const pt: Point3D = { id: 'P', label: name.toUpperCase(), x: 0, y, z };
        addPointWithProjectors(pt, 1);

        if (Math.abs(y) > 0.1) {
            dimensions.push({
                id: 'dim_hp',
                p1: { id: 'd1', label: '', x: 0, y: 0, z: 0 },
                p2: { id: 'd2', label: '', x: 0, y, z: 0 },
                label: `${Math.round(Math.abs(y))} mm from HP`,
                step: 2,
            });
        }
        if (Math.abs(z) > 0.1) {
            dimensions.push({
                id: 'dim_vp',
                p1: { id: 'd3', label: '', x: 0, y: 0, z: 0 },
                p2: { id: 'd4', label: '', x: 0, y, z: 0 },
                label: `${Math.round(Math.abs(z))} mm from VP`,
                step: 2,
            });
        }

        stepsInfo.push(
            { step: 1, title: 'Locate 3D Point & Drop Projectors', description: 'Position point in quadrant and project orthogonally onto HP and VP.' },
            { step: 2, title: 'Dimension Coordinates', description: 'Indicate distances from the Horizontal and Vertical reference planes.' }
        );
    }

    // ─────────────────────────────────────────────────────────────
    // 2. STRAIGHT LINES
    // ─────────────────────────────────────────────────────────────
    else if (type.startsWith('line_')) {
        const lineProps = geometry.lineProperties;
        const pData = params as any;
        const L = pData?.length_mm || lineProps?.trueLength || 70;

        let yA = 20;
        let zA = 25;
        if (pData?.end_A) {
            if (pData.end_A.on === 'HP') {
                yA = 0;
                zA = pData.end_A.distance_from_VP_mm ?? 25;
            } else if (pData.end_A.on === 'VP') {
                yA = pData.end_A.distance_from_HP_mm ?? 25;
                zA = 0;
            } else {
                yA = pData.end_A.distance_from_HP_mm ?? 25;
                zA = pData.end_A.distance_from_VP_mm ?? 25;
                if (pData.end_A.side_of_HP === 'below') yA = -yA;
                if (pData.end_A.side_of_VP === 'behind') zA = -zA;
            }
        }

        let theta = (pData?.inclination_with_HP_deg ?? pData?.inclination_deg ?? lineProps?.theta ?? 0) * Math.PI / 180;
        let phi = (pData?.inclination_with_VP_deg ?? (type === 'line_inclined_VP' ? pData?.inclination_deg : 0) ?? lineProps?.phi ?? 0) * Math.PI / 180;

        if (type === 'line_parallel') {
            theta = 0;
            phi = 0;
        }

        const dy = L * Math.sin(theta);
        const dz = L * Math.sin(phi);
        const dx = Math.sqrt(Math.max(0, L * L - dy * dy - dz * dz));

        const xA = -dx / 2;
        const xB = dx / 2;
        const yB = yA + dy;
        const zB = zA + dz;

        const ptA: Point3D = { id: 'A', label: 'A', x: xA, y: yA, z: zA, step: 1 };
        const ptB: Point3D = { id: 'B', label: 'B', x: xB, y: yB, z: zB, step: 1 };

        addPointWithProjectors(ptA, 1);
        addPointWithProjectors(ptB, 1);
        addSegment(ptA, ptB, 'object', 'solid', '#004d40', 1);

        const a_tv: Point3D = { id: 'a', label: 'a', x: xA, y: 0, z: zA, step: 2, role: 'projection' };
        const b_tv: Point3D = { id: 'b', label: 'b', x: xB, y: 0, z: zB, step: 2, role: 'projection' };
        const a_fv: Point3D = { id: "a'", label: "a'", x: xA, y: yA, z: 0, step: 2, role: 'projection' };
        const b_fv: Point3D = { id: "b'", label: "b'", x: xB, y: yB, z: 0, step: 2, role: 'projection' };

        points.push(a_tv, b_tv, a_fv, b_fv);
        addSegment(a_tv, b_tv, 'object', 'solid', '#00796b', 2);
        addSegment(a_fv, b_fv, 'object', 'solid', '#00796b', 2);

        dimensions.push({
            id: 'dim_tl',
            p1: ptA,
            p2: ptB,
            label: `TL = ${Math.round(L)} mm`,
            step: 3,
        });

        if (theta > 0.01) {
            angleAnnotations.push({
                origin: ptA,
                dirBase: { x: 1, y: 0, z: 0 },
                dirInclined: { x: dx, y: dy, z: 0 },
                radius: Math.min(24, L * 0.35),
                label: `θ=${Math.round(theta * 180 / Math.PI)}°`,
                plane: 'HP',
                step: 3,
            });
        }
        if (phi > 0.01) {
            angleAnnotations.push({
                origin: ptA,
                dirBase: { x: 1, y: 0, z: 0 },
                dirInclined: { x: dx, y: 0, z: dz },
                radius: Math.min(24, L * 0.35),
                label: `φ=${Math.round(phi * 180 / Math.PI)}°`,
                plane: 'VP',
                step: 3,
            });
        }

        stepsInfo.push(
            { step: 1, title: 'Spatial Line & End-points', description: 'Draw the true 3D straight line segment AB with perpendicular projectors.' },
            { step: 2, title: 'Orthographic Projections on HP & VP', description: 'Form Top View (ab on HP) and Front View (a′b′ on VP).' },
            { step: 3, title: 'True Length & Plane Inclinations', description: 'Annotate True Length (TL), inclination θ to HP, and inclination φ to VP.' }
        );
    }

    // ─────────────────────────────────────────────────────────────
    // 3. PLANE SURFACES / LAMINAS
    // ─────────────────────────────────────────────────────────────
    else if (type === 'plane_surface') {
        const pData = params as any;
        const shape = pData?.shape || 'hexagon';
        const numSides = shape === 'triangle' ? 3 : shape === 'square' || shape === 'rectangle' ? 4 : shape === 'pentagon' ? 5 : shape === 'hexagon' ? 6 : 24;
        const side = pData?.size_mm?.side_mm || (pData?.size_mm?.length_mm || 30);
        const radius = shape === 'circle' ? (pData?.size_mm?.diameter_mm || 40) / 2 : side / (2 * Math.sin(Math.PI / numSides));

        const hpAngle = (pData?.orientation?.inclination_with_HP_deg || 0) * Math.PI / 180;
        const vpAngle = (pData?.orientation?.inclination_with_VP_deg || 0) * Math.PI / 180;

        const vertices: Point3D[] = [];
        const tvVertices: Point3D[] = [];
        const fvVertices: Point3D[] = [];

        for (let i = 0; i < numSides; i++) {
            const a = i * 2 * Math.PI / numSides;
            const u = radius * Math.cos(a);
            const v = radius * Math.sin(a);

            const x = u;
            const y = 20 + (v * Math.sin(hpAngle));
            const z = 25 + (v * Math.cos(hpAngle) * Math.cos(vpAngle));
            const label = String.fromCharCode(65 + i);

            const pt: Point3D = { id: `V${i}`, label, x, y: Math.max(0, y), z: Math.max(0, z), step: 1 };
            vertices.push(pt);
            points.push(pt);

            const ptTV: Point3D = { id: `v${i}_tv`, label: label.toLowerCase(), x: pt.x, y: 0, z: pt.z, step: 2, role: 'projection' };
            const ptFV: Point3D = { id: `v${i}_fv`, label: `${label.toLowerCase()}'`, x: pt.x, y: pt.y, z: 0, step: 2, role: 'projection' };
            tvVertices.push(ptTV);
            fvVertices.push(ptFV);
            points.push(ptTV, ptFV);

            addSegment(pt, ptTV, 'projector', 'dashed', '#cbd5e1', 2);
            addSegment(pt, ptFV, 'projector', 'dashed', '#cbd5e1', 2);
        }

        polygons.push({
            id: 'lamina_surface',
            points: vertices,
            color: '#0b57ff',
            opacity: 0.25,
            role: 'face',
            step: 1,
            label: `${shape.toUpperCase()} LAMINA`,
        });

        for (let i = 0; i < numSides; i++) {
            addSegment(vertices[i], vertices[(i + 1) % numSides], 'object', 'solid', '#004d40', 1);
            addSegment(tvVertices[i], tvVertices[(i + 1) % numSides], 'object', 'solid', '#00796b', 2);
            addSegment(fvVertices[i], fvVertices[(i + 1) % numSides], 'object', 'solid', '#00796b', 2);
        }

        if (hpAngle > 0.01) {
            angleAnnotations.push({
                origin: vertices[0],
                dirBase: { x: 0, y: 0, z: 1 },
                dirInclined: { x: 0, y: Math.sin(hpAngle), z: Math.cos(hpAngle) },
                radius: 20,
                label: `θ=${Math.round(hpAngle * 180 / Math.PI)}° to HP`,
                plane: 'HP',
                step: 3,
            });
        }

        stepsInfo.push(
            { step: 1, title: '3D Lamina in Space', description: 'Orient lamina surface inclined to reference planes.' },
            { step: 2, title: 'Orthographic Projections', description: 'Project surface onto HP (top view) and VP (front view).' },
            { step: 3, title: 'Surface Inclination Angles', description: 'Indicate dihedral angle made with HP and VP.' }
        );
    }

    // ─────────────────────────────────────────────────────────────
    // 4. SOLIDS, SECTIONS & COMPOSITES
    // ─────────────────────────────────────────────────────────────
    else {
        const pData = params as any;
        const rawObj = pData?.object || pData || {};
        const solidType = rawObj?.solid_type || pData?.solid_type || (pData?.solids?.[0]?.solid_type) || 'prism';
        const isPrism = solidType === 'prism' || solidType === 'cylinder' || solidType === 'cube';
        const shape = solidType === 'cube'
            ? 'square'
            : (solidType === 'cylinder' || solidType === 'cone' || solidType === 'sphere'
                ? 'circle'
                : (rawObj?.base_shape || pData?.base_shape || pData?.solids?.[0]?.base_shape || 'hexagon'));
        const numSides = shape === 'triangle' ? 3 : shape === 'square' || shape === 'rectangle' ? 4 : shape === 'pentagon' ? 5 : shape === 'hexagon' ? 6 : 24;
        const side = rawObj?.base_size_mm?.side_mm || rawObj?.base_size_mm?.diameter_mm || pData?.base_size_mm?.side_mm || pData?.base_size_mm?.diameter_mm || (solidType === 'cube' ? 40 : 32);
        const radius = shape === 'circle' ? side / 2 : side / (2 * Math.sin(Math.PI / numSides));
        const height = (solidType === 'cube' ? side : (rawObj?.height_mm || pData?.height_mm || pData?.axis_length_mm || 65));

        const hpTilt = (pData?.inclination_deg ?? pData?.inclination_with_HP_deg ?? 0) * Math.PI / 180;
        const restingOn = pData?.resting_on || 'HP';

        const basePts: Point3D[] = [];
        const topPts: Point3D[] = [];

        for (let i = 0; i < numSides; i++) {
            const a = i * 2 * Math.PI / numSides - (shape === 'square' ? Math.PI / 4 : 0);
            const bx = radius * Math.cos(a);
            const bz = radius * Math.sin(a);

            if (restingOn === 'HP') {
                const rotY = Math.cos(hpTilt);
                const rotZ = Math.sin(hpTilt);

                basePts.push({
                    id: `b${i}`,
                    label: String.fromCharCode(97 + i),
                    x: bx,
                    y: 0,
                    z: 32 + bz,
                    step: 1,
                });

                if (isPrism) {
                    topPts.push({
                        id: `t${i}`,
                        label: `${String.fromCharCode(97 + i)}'`,
                        x: bx,
                        y: height * rotY,
                        z: 32 + bz + height * rotZ,
                        step: 1,
                    });
                }
            } else {
                basePts.push({
                    id: `b${i}`,
                    label: String.fromCharCode(97 + i),
                    x: bx,
                    y: 32 + radius * Math.sin(a),
                    z: 0,
                    step: 1,
                });
                if (isPrism) {
                    topPts.push({
                        id: `t${i}`,
                        label: `${String.fromCharCode(97 + i)}'`,
                        x: bx,
                        y: 32 + radius * Math.sin(a),
                        z: height,
                        step: 1,
                    });
                }
            }
        }

        let apexPt: Point3D | null = null;
        if (!isPrism) {
            apexPt = {
                id: 'apex',
                label: "o'",
                x: 0,
                y: restingOn === 'HP' ? height * Math.cos(hpTilt) : 32,
                z: restingOn === 'HP' ? 32 + height * Math.sin(hpTilt) : height,
                step: 1,
            };
            points.push(apexPt);
        }

        basePts.forEach(p => points.push(p));
        topPts.forEach(p => points.push(p));

        for (let i = 0; i < numSides; i++) {
            addSegment(basePts[i], basePts[(i + 1) % numSides], 'object', 'solid', '#004d40', 1);
        }
        if (isPrism) {
            for (let i = 0; i < numSides; i++) {
                addSegment(topPts[i], topPts[(i + 1) % numSides], 'object', 'solid', '#004d40', 1);
                addSegment(basePts[i], topPts[i], 'object', 'solid', '#004d40', 1);
            }
        } else if (apexPt) {
            for (let i = 0; i < numSides; i++) {
                addSegment(basePts[i], apexPt, 'object', 'solid', '#004d40', 1);
            }
        }

        const axisBase: Point3D = { id: 'ax_b', label: '', x: 0, y: restingOn === 'HP' ? 0 : 32, z: restingOn === 'HP' ? 32 : 0, step: 1 };
        const axisTop: Point3D = isPrism
            ? { id: 'ax_t', label: '', x: 0, y: restingOn === 'HP' ? height * Math.cos(hpTilt) : 32, z: restingOn === 'HP' ? 32 + height * Math.sin(hpTilt) : height, step: 1 }
            : apexPt!;
        addSegment(axisBase, axisTop, 'axis', 'chain', '#dc2626', 1);

        dimensions.push({
            id: 'dim_axis',
            p1: axisBase,
            p2: axisTop,
            label: `h = ${Math.round(height)} mm`,
            step: 1,
        });

        if (type === 'section_solid' || type === 'advanced_section' || pData?.cutting_plane) {
            const cpData = pData?.cutting_plane;
            const cutDist = typeof cpData?.passes_through === 'object' && cpData?.passes_through?.distance_from_base_mm
                ? cpData.passes_through.distance_from_base_mm
                : cpData?.distance_from_base_mm || height * 0.55;
            const cutAngle = (cpData?.inclination_with_HP_deg ?? cpData?.inclination_deg ?? 45) * Math.PI / 180;

            const planeW = radius * 2.8;
            const planeH = radius * 3.2;

            const cpP1: Point3D = { id: 'cp1', label: 'V.T.', x: -planeW, y: cutDist - planeH * 0.4 * Math.sin(cutAngle), z: 32 - planeH * 0.4 * Math.cos(cutAngle), step: 2 };
            const cpP2: Point3D = { id: 'cp2', label: 'H.T.', x: planeW, y: cutDist - planeH * 0.4 * Math.sin(cutAngle), z: 32 - planeH * 0.4 * Math.cos(cutAngle), step: 2 };
            const cpP3: Point3D = { id: 'cp3', label: '', x: planeW, y: cutDist + planeH * 0.6 * Math.sin(cutAngle), z: 32 + planeH * 0.6 * Math.cos(cutAngle), step: 2 };
            const cpP4: Point3D = { id: 'cp4', label: '', x: -planeW, y: cutDist + planeH * 0.6 * Math.sin(cutAngle), z: 32 + planeH * 0.6 * Math.cos(cutAngle), step: 2 };

            polygons.push({
                id: 'cutting_plane_3d',
                points: [cpP1, cpP2, cpP3, cpP4],
                color: '#dc2626',
                opacity: 0.28,
                role: 'cutting_plane',
                step: 2,
                label: 'CUTTING PLANE',
            });

            addSegment(cpP1, cpP2, 'cutting_plane', 'chain', '#dc2626', 2);
            addSegment(cpP2, cpP3, 'cutting_plane', 'chain', '#dc2626', 2);
            addSegment(cpP3, cpP4, 'cutting_plane', 'chain', '#dc2626', 2);
            addSegment(cpP4, cpP1, 'cutting_plane', 'chain', '#dc2626', 2);

            const sectionPoints3D: Point3D[] = [];
            for (let i = 0; i < numSides; i++) {
                const b = basePts[i];
                const t = isPrism ? topPts[i] : apexPt!;

                const num = (b.y - cutDist) * Math.cos(cutAngle) - (b.z - 32) * Math.sin(cutAngle);
                const den = ((b.y - t.y) * Math.cos(cutAngle) - (b.z - t.z) * Math.sin(cutAngle));
                const ratio = Math.abs(den) > 1e-4 ? num / den : 0.5;
                const clampedR = Math.max(0, Math.min(1, ratio));

                const sx = b.x + clampedR * (t.x - b.x);
                const sy = b.y + clampedR * (t.y - b.y);
                const sz = b.z + clampedR * (t.z - b.z);

                const sPt: Point3D = {
                    id: `sec_${i}`,
                    label: `${i + 1}`,
                    x: sx,
                    y: sy,
                    z: sz,
                    step: 3,
                };
                sectionPoints3D.push(sPt);
                points.push(sPt);
            }

            for (let i = 0; i < numSides; i++) {
                addSegment(sectionPoints3D[i], sectionPoints3D[(i + 1) % numSides], 'section', 'solid', '#b91c1c', 3);
            }

            polygons.push({
                id: 'true_section_face',
                points: sectionPoints3D,
                color: '#ef4444',
                opacity: 0.55,
                role: 'section',
                step: 3,
                label: 'TRUE SECTION FACE',
            });

            angleAnnotations.push({
                origin: { id: 'cp_origin', label: '', x: 0, y: cutDist, z: 32 },
                dirBase: { x: 0, y: 0, z: 1 },
                dirInclined: { x: 0, y: Math.sin(cutAngle), z: Math.cos(cutAngle) },
                radius: 20,
                label: `Cutting Plane θ=${Math.round(cutAngle * 180 / Math.PI)}°`,
                plane: 'HP',
                step: 2,
            });

            stepsInfo.push(
                { step: 1, title: 'Solid in Reference Position', description: 'Full 3D boundary representation with axis and dimensions.' },
                { step: 2, title: 'Position Cutting Plane (V.T. / H.T.)', description: 'Pass cutting plane at specified height and inclination angle.' },
                { step: 3, title: 'Compute True Section Face', description: 'Determine 3D intersection points and slice surface.' }
            );
        } else {
            stepsInfo.push(
                { step: 1, title: '3D Solid Model & Projections', description: 'Spatial orientation on reference plane with lateral edges and axis.' }
            );
        }
    }

    const maxExtent = Math.max(
        60,
        ...points.map(p => Math.max(Math.abs(p.x), Math.abs(p.y), Math.abs(p.z)))
    );
    const planeSize = Math.max(150, maxExtent * 2.3);
    const maxStep = Math.max(1, ...stepsInfo.map(s => s.step), ...segments.map(s => s.step || 1));

    return {
        mode: 'orthographic',
        points,
        segments,
        polygons,
        dimensions,
        angleAnnotations,
        planeSize,
        maxStep,
        stepsInfo,
        title: (params as any)?.type?.replace(/_/g, ' ')?.toUpperCase() || '3D SPATIAL PROJECTION',
    };
}

// Map calculated 3D coordinates directly to Three.js buffer geometry
