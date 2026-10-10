import { GeometryEngine } from '../geometryEngine';
import { PlaneSurfaceSchema } from '../../types';
import { PointCoords, SvgPrimitive } from '../../types';

    export function projectPlaneSurface(engine: GeometryEngine, data: PlaneSurfaceSchema) {
        type Vec3 = { x: number; y: number; z: number };
        type LocalPoint = { u: number; v: number };
        const scale = engine.SCALE;
        const color = '#004d40';
        const constructionColor = '#90a4ae';
        const traceColor = '#c62828';
        const deg = (value: number) => engine.degToRad(value);
        const add = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
        const multiply = (a: Vec3, factor: number): Vec3 => ({ x: a.x * factor, y: a.y * factor, z: a.z * factor });
        const cross = (a: Vec3, b: Vec3): Vec3 => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
        const norm = (a: Vec3) => Math.hypot(a.x, a.y, a.z);
        const normalize = (a: Vec3): Vec3 => {
            const length = norm(a) || 1;
            return { x: a.x / length, y: a.y / length, z: a.z / length };
        };

        let localPoints: LocalPoint[] = [];
        if (data.shape === 'rectangle') {
            const length = data.size_mm.length_mm || 0;
            const breadth = data.size_mm.breadth_mm || 0;
            localPoints = [
                { u: -length / 2, v: -breadth / 2 }, { u: length / 2, v: -breadth / 2 },
                { u: length / 2, v: breadth / 2 }, { u: -length / 2, v: breadth / 2 },
            ];
        } else if (data.shape === 'set_square_30_60') {
            const hypotenuse = data.size_mm.hypotenuse_mm || 0;
            localPoints = [{ u: 0, v: 0 }, { u: hypotenuse, v: 0 }, { u: 0, v: hypotenuse * Math.sqrt(3) / 2 }];
            const centroid = localPoints.reduce((sum, point) => ({ u: sum.u + point.u / 3, v: sum.v + point.v / 3 }), { u: 0, v: 0 });
            localPoints = localPoints.map(point => ({ u: point.u - centroid.u, v: point.v - centroid.v }));
        } else if (data.shape === 'circle') {
            const radius = (data.size_mm.diameter_mm || 0) / 2;
            localPoints = Array.from({ length: 48 }, (_, index) => {
                const angle = index * 2 * Math.PI / 48;
                return { u: radius * Math.cos(angle), v: radius * Math.sin(angle) };
            });
        } else {
            const sides = data.shape === 'triangle' ? 3 : data.shape === 'square' ? 4 : data.shape === 'pentagon' ? 5 : 6;
            const radius = (data.size_mm.side_mm || 0) / (2 * Math.sin(Math.PI / sides));
            localPoints = Array.from({ length: sides }, (_, index) => {
                const angle = index * 2 * Math.PI / sides - Math.PI / 2;
                return { u: radius * Math.cos(angle), v: radius * Math.sin(angle) };
            });
        }

        const feature = data.orientation.reference_feature;
        const featureIndices = (() => {
            if (!feature || data.shape === 'circle') return [0, 1] as const;
            if (feature.feature === 'diagonal') return [0, Math.min(2, localPoints.length - 1)] as const;
            if (feature.feature === 'corner_to_center') return [0, -1] as const;
            if (feature.feature === 'shorter_side' && data.shape === 'rectangle') return [1, 2] as const;
            return [0, 1] as const;
        })();
        const featureStart = localPoints[featureIndices[0]];
        const featureEnd = featureIndices[1] === -1 ? { u: 0, v: 0 } : localPoints[featureIndices[1]];
        const localFeatureAngle = Math.atan2(featureEnd.v - featureStart.v, featureEnd.u - featureStart.u);
        const rotatedLocal = localPoints.map(point => {
            const c = Math.cos(-localFeatureAngle);
            const s = Math.sin(-localFeatureAngle);
            return { u: point.u * c - point.v * s, v: point.u * s + point.v * c };
        });

        const contact = feature?.contact_plane;
        const featureAngle = deg(feature?.angle_to_other_plane_deg || 0);
        const sense = data.orientation.direction === 'counterclockwise' ? -1 : 1;
        let basisU: Vec3;
        let basisV: Vec3;
        if (contact === 'HP') {
            const alpha = deg(data.orientation.inclination_with_HP_deg || 0);
            basisU = { x: Math.cos(featureAngle), y: Math.sin(featureAngle), z: 0 };
            const flatV = { x: -Math.sin(featureAngle), y: Math.cos(featureAngle), z: 0 };
            basisV = add(multiply(flatV, Math.cos(alpha)), { x: 0, y: 0, z: sense * Math.sin(alpha) });
        } else if (contact === 'VP') {
            const beta = deg(data.orientation.inclination_with_VP_deg || 0);
            basisU = { x: Math.cos(featureAngle), y: 0, z: Math.sin(featureAngle) };
            const flatV = { x: -Math.sin(featureAngle), y: 0, z: Math.cos(featureAngle) };
            basisV = add(multiply(flatV, Math.cos(beta)), { x: 0, y: sense * Math.sin(beta), z: 0 });
        } else if (contact === 'BOTH') {
            const alpha = deg(data.orientation.inclination_with_HP_deg || 0);
            basisU = { x: 1, y: 0, z: 0 };
            basisV = { x: 0, y: Math.cos(alpha), z: sense * Math.sin(alpha) };
        } else {
            const hp = data.orientation.inclination_with_HP_deg ?? (data.orientation.inclination_with_VP_deg === 0 ? 90 : 0);
            const vp = data.orientation.inclination_with_VP_deg ?? (hp === 0 ? 90 : 0);
            const ny = Math.cos(deg(vp));
            const nz = Math.cos(deg(hp));
            const nx = sense * Math.sqrt(Math.max(0, 1 - ny * ny - nz * nz));
            const normal = normalize({ x: nx, y: ny, z: nz });
            basisU = Math.hypot(normal.x, normal.y) > 1e-8
                ? normalize({ x: -normal.y, y: normal.x, z: 0 })
                : { x: 1, y: 0, z: 0 };
            basisV = normalize(cross(normal, basisU));
        }
        basisU = normalize(basisU);
        basisV = normalize(basisV);
        let normal = normalize(cross(basisU, basisV));
        if (normal.z < -1e-8) normal = multiply(normal, -1);

        let center: Vec3 = {
            x: 0,
            y: data.center?.distance_from_VP_mm ?? 30,
            z: data.center?.distance_from_HP_mm ?? 30,
        };
        const unshifted = rotatedLocal.map(point => add(multiply(basisU, point.u), multiply(basisV, point.v)));
        const rotatedFeatureStart = (() => {
            const point = rotatedLocal[featureIndices[0]];
            return add(multiply(basisU, point.u), multiply(basisV, point.v));
        })();
        if (contact === 'HP' || contact === 'BOTH') center.z = -rotatedFeatureStart.z;
        if (contact === 'VP' || contact === 'BOTH') center.y = -rotatedFeatureStart.y;
        const worldPoints = unshifted.map(point => add(point, center));

        const setupCenter = { x: 190, y: engine.XY_LINE_Y + 135 };
        const setupPoints = rotatedLocal.map(point => ({ x: setupCenter.x + point.u * scale, y: setupCenter.y + point.v * scale }));
        for (let index = 0; index < setupPoints.length; index++) {
            const next = (index + 1) % setupPoints.length;
            engine.primitives.push({ type: 'line', key: `plane-step-1-true-${index}`, points: [setupPoints[index].x, setupPoints[index].y, setupPoints[next].x, setupPoints[next].y], dashed: false, color: constructionColor, step: 1, primitiveRole: 'construction' });
        }
        engine.primitives.push({ type: 'text', key: 'plane-step-1-caption', x: setupCenter.x, y: setupCenter.y + 125, content: 'TRUE-SHAPE SETUP', color: '#616161', step: 1, textAnchor: 'middle', primitiveRole: 'caption' });

        const finalCenterX = 590;
        const tvPoints = worldPoints.map(point => ({ x: finalCenterX + point.x * scale, y: engine.XY_LINE_Y + point.y * scale }));
        const fvPoints = worldPoints.map(point => ({ x: finalCenterX + point.x * scale, y: engine.XY_LINE_Y - point.z * scale }));
        const drawClosedProjection = (points: PointCoords[], key: string, step: number) => {
            for (let index = 0; index < points.length; index++) {
                const next = (index + 1) % points.length;
                engine.primitives.push({ type: 'line', key: `${key}-${index}`, points: [points[index].x, points[index].y, points[next].x, points[next].y], dashed: false, color, step, primitiveRole: 'visible' });
            }
        };
        const wantsTop = data.required_outputs?.top_view !== false;
        const wantsFront = data.required_outputs?.front_view !== false;
        if (wantsTop) drawClosedProjection(tvPoints, 'plane-step-2-tv', 2);
        if (wantsFront) drawClosedProjection(fvPoints, 'plane-step-2-fv', 2);
        worldPoints.forEach((point, index) => {
            if (index >= 12 && data.shape === 'circle') return;
            engine.primitives.push({ type: 'line', key: `plane-step-2-projector-${index}`, points: [finalCenterX + point.x * scale, engine.XY_LINE_Y - point.z * scale, finalCenterX + point.x * scale, engine.XY_LINE_Y + point.y * scale], dashed: true, color: '#e0e0e0', step: 2, primitiveRole: 'projection' });
        });
        if (wantsFront) engine.primitives.push({ type: 'text', key: 'plane-fv-caption', x: finalCenterX, y: Math.min(...fvPoints.map(point => point.y)) - 24, content: 'F.V.', step: 2, color: '#616161', textAnchor: 'middle', primitiveRole: 'caption' });
        if (wantsTop) engine.primitives.push({ type: 'text', key: 'plane-tv-caption', x: finalCenterX, y: Math.max(...tvPoints.map(point => point.y)) + 28, content: 'T.V.', step: 2, color: '#616161', textAnchor: 'middle', primitiveRole: 'caption' });

        const transformOpening = (local: LocalPoint) => add(add(multiply(basisU, local.u), multiply(basisV, local.v)), center);
        if (data.opening) {
            const openingRadius = (data.opening.diameter_mm ?? 2 * (data.opening.radius_mm || 0)) / 2;
            const count = data.opening.shape === 'circle' ? 36 : 18;
            const openingLocal = Array.from({ length: count + (data.opening.shape === 'semicircle' ? 1 : 0) }, (_, index) => {
                const angle = data.opening.shape === 'circle' ? index * 2 * Math.PI / count : index * Math.PI / (count - 1);
                return { u: openingRadius * Math.cos(angle), v: openingRadius * Math.sin(angle) };
            });
            const openingWorld = openingLocal.map(transformOpening);
            const openingTv = openingWorld.map(point => ({ x: finalCenterX + point.x * scale, y: engine.XY_LINE_Y + point.y * scale }));
            const openingFv = openingWorld.map(point => ({ x: finalCenterX + point.x * scale, y: engine.XY_LINE_Y - point.z * scale }));
            if (wantsTop) drawClosedProjection(openingTv, 'plane-step-2-tv-opening', 2);
            if (wantsFront) drawClosedProjection(openingFv, 'plane-step-2-fv-opening', 2);
        }

        if (data.required_outputs?.traces) {
            const traceExtent = 90;
            const hpDenominator = normal.x * normal.x + normal.y * normal.y;
            if (hpDenominator > 1e-9) {
                const factor = normal.z * center.z / hpDenominator;
                const point = { x: center.x + normal.x * factor, y: center.y + normal.y * factor, z: 0 };
                const direction = normalize({ x: -normal.y, y: normal.x, z: 0 });
                const start = add(point, multiply(direction, -traceExtent));
                const end = add(point, multiply(direction, traceExtent));
                engine.primitives.push({ type: 'line', key: 'plane-step-3-ht', points: [finalCenterX + start.x * scale, engine.XY_LINE_Y + start.y * scale, finalCenterX + end.x * scale, engine.XY_LINE_Y + end.y * scale], dashed: true, color: traceColor, step: 3, primitiveRole: 'construction' });
                engine.primitives.push({ type: 'text', key: 'plane-step-3-ht-label', x: finalCenterX + end.x * scale, y: engine.XY_LINE_Y + end.y * scale + 16, content: 'H.T.', color: traceColor, step: 3, primitiveRole: 'label' });
            }
            const vpDenominator = normal.x * normal.x + normal.z * normal.z;
            if (vpDenominator > 1e-9) {
                const factor = normal.y * center.y / vpDenominator;
                const point = { x: center.x + normal.x * factor, y: 0, z: center.z + normal.z * factor };
                const direction = normalize({ x: -normal.z, y: 0, z: normal.x });
                const start = add(point, multiply(direction, -traceExtent));
                const end = add(point, multiply(direction, traceExtent));
                engine.primitives.push({ type: 'line', key: 'plane-step-3-vt', points: [finalCenterX + start.x * scale, engine.XY_LINE_Y - start.z * scale, finalCenterX + end.x * scale, engine.XY_LINE_Y - end.z * scale], dashed: true, color: traceColor, step: 3, primitiveRole: 'construction' });
                engine.primitives.push({ type: 'text', key: 'plane-step-3-vt-label', x: finalCenterX + end.x * scale, y: engine.XY_LINE_Y - end.z * scale - 10, content: 'V.T.', color: traceColor, step: 3, primitiveRole: 'label' });
            }
        }

        const wantsLeft = !!data.required_outputs?.left_side_view;
        const wantsRight = !!data.required_outputs?.right_side_view;
        if (wantsLeft || wantsRight) {
            const sideOriginX = 1030;
            const sideSign = wantsLeft ? -1 : 1;
            const sidePoints = worldPoints.map(point => ({ x: sideOriginX + sideSign * point.y * scale, y: engine.XY_LINE_Y - point.z * scale }));
            engine.primitives.push({ type: 'line', key: 'plane-step-4-side-reference', points: [900, 80, 900, 720], dashed: false, color: '#424242', step: 4, primitiveRole: 'construction' });
            engine.primitives.push({ type: 'text', key: 'plane-step-4-x1', x: 888, y: 95, content: 'X₁', step: 4, primitiveRole: 'label' });
            engine.primitives.push({ type: 'text', key: 'plane-step-4-y1', x: 888, y: 710, content: 'Y₁', step: 4, primitiveRole: 'label' });
            drawClosedProjection(sidePoints, `plane-step-4-${wantsLeft ? 'lsv' : 'rsv'}`, 4);
            engine.primitives.push({ type: 'text', key: 'plane-step-4-side-caption', x: sideOriginX, y: Math.min(...sidePoints.map(point => point.y)) - 24, content: wantsLeft ? 'L.S.V.' : 'R.S.V.', step: 4, color: '#616161', textAnchor: 'middle', primitiveRole: 'caption' });
        }

        const labelPoints = data.shape === 'circle' ? tvPoints.filter((_, index) => index % 8 === 0) : tvPoints;
        engine.addSequentialPointLabels(labelPoints, labelPoints.map((_, index) => String.fromCharCode(97 + index)), 2, 'plane-tv', data.shape === 'circle', 'tv');
        const nominalSize = data.size_mm.diameter_mm || data.size_mm.length_mm || data.size_mm.hypotenuse_mm || data.size_mm.side_mm;
        if (nominalSize) engine.addLinearDimension(setupPoints[0], setupPoints[1], engine.formatLengthLabel(nominalSize), engine.DIM_OFFSET, false, 'dim-plane-size', true);
    }
