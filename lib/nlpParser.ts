import { EngineeringProblem, EngineeringProblemZ } from '../types';
import { EXAMPLES } from './examples';

/**
 * Comprehensive Deterministic Local NLP Parser for Engineering Graphics Problems.
 * Translates natural language questions into schema-validated JSON without LLM API costs.
 */

// ─────────────────────────────────────────────────────────────
// Normalization & Lexical Preprocessing
// ─────────────────────────────────────────────────────────────
export function normalizeText(text: string): string {
    if (!text || typeof text !== 'string') return '';
    return text
        .replace(/[\u2018\u2019]/g, "'")
        .replace(/[\u201C\u201D]/g, '"')
        .replace(/°/g, ' degrees ')
        .replace(/\bdeg(?:ree)?s?\b/gi, ' degrees ')
        .replace(/\bangles\b/gi, 'angle')
        .replace(/\bH\.P\./gi, 'HP')
        .replace(/\bV\.P\./gi, 'VP')
        .replace(/\bP\.P\./gi, 'PP')
        .replace(/\bG\.P\./gi, 'GP')
        .replace(/\bS\.P\./gi, 'SP')
        .replace(/\bground\s*plane\b/gi, 'GP')
        .replace(/\b(?:the\s+)?ground\b/gi, 'HP')
        .replace(/\bmm\./gi, ' mm')
        .replace(/([0-9]+)\s*mm\b/gi, '$1 mm')
        .replace(/([0-9]+)\s*cm\b/gi, (_, n) => `${parseFloat(n) * 10} mm`)
        .replace(/\bvisual\s*ray\b/gi, 'visual-ray')
        .replace(/\bvanishing\s*point\b/gi, 'vanishing-point')
        .replace(/\s+/g, ' ')
        .trim();
}

function num(val: string | number | undefined, fallback = 0): number {
    if (val === undefined || val === null) return fallback;
    if (typeof val === 'number') return val;
    const n = parseFloat(val);
    return isNaN(n) ? fallback : n;
}

// ─────────────────────────────────────────────────────────────
// 1. Point Parser (Point in Quadrant or on Reference Plane)
// ─────────────────────────────────────────────────────────────
export function parsePoint(text: string): EngineeringProblem | null {
    if (/\b(prism|pyramid|cylinder|cone|cube|tetrahedron|lamina|plate|surface|solid)\b/i.test(text)) return null;
    if (/\b(line\s+[A-Z]{1,2}|straight\s*line)\b/i.test(text)) return null;

    const ptMatch = text.match(/\bpoint\s+([A-Z][0-9]?)\b/i) || text.match(/\bA\s+point\s+([A-Z][0-9]?)\b/i);
    if (!ptMatch && !/^\s*point\b/i.test(text)) return null;
    const name = ptMatch ? ptMatch[1].toUpperCase() : 'P';
    if (/^(OF|ON|IN|WITH|AT|FROM|THE|WHERE|WHICH|IS)$/i.test(name)) return null;

    // On reference plane / line
    const onHP = /\b(on\s+(?:the\s+)?HP|in\s+(?:the\s+)?HP)\b/i.test(text);
    const onVP = /\b(on\s+(?:the\s+)?VP|in\s+(?:the\s+)?VP)\b/i.test(text);
    const onXY = /\b(on\s+(?:the\s+)?XY|in\s+(?:the\s+)?XY|on\s+reference\s+line|both\s+HP\s+and\s+VP|in\s+both\s+HP\s+and\s+VP)\b/i.test(text);
    const distMatch = text.match(/(\d+(?:\.\d+)?)\s*mm/i);

    if (onXY || (onHP && onVP)) {
        return { type: 'point_special', name, position: 'ON_XY', distance_mm: 0 };
    }
    if (onHP && !onVP) {
        const d = num(distMatch?.[1], 25);
        return { type: 'point_special', name, position: 'ON_HP', distance_mm: d };
    }
    if (onVP && !onHP) {
        const d = num(distMatch?.[1], 25);
        return { type: 'point_special', name, position: 'ON_VP', distance_mm: d };
    }

    // Quadrants
    let plane: 'FIRST_QUADRANT' | 'SECOND_QUADRANT' | 'THIRD_QUADRANT' | 'FOURTH_QUADRANT' = 'FIRST_QUADRANT';
    if (/first\s+quadrant|\b1st\s+quadrant\b/i.test(text)) plane = 'FIRST_QUADRANT';
    else if (/second\s+quadrant|\b2nd\s+quadrant\b/i.test(text)) plane = 'SECOND_QUADRANT';
    else if (/third\s+quadrant|\b3rd\s+quadrant\b/i.test(text)) plane = 'THIRD_QUADRANT';
    else if (/fourth\s+quadrant|\b4th\s+quadrant\b/i.test(text)) plane = 'FOURTH_QUADRANT';
    else {
        const aboveHP = /above\s+(?:the\s+)?HP/i.test(text);
        const belowHP = /below\s+(?:the\s+)?HP/i.test(text);
        const inFrontVP = /in\s+front\s+of\s+(?:the\s+)?VP/i.test(text);
        const behindVP = /behind\s+(?:the\s+)?VP/i.test(text);

        if (aboveHP && inFrontVP) plane = 'FIRST_QUADRANT';
        else if (aboveHP && behindVP) plane = 'SECOND_QUADRANT';
        else if (belowHP && behindVP) plane = 'THIRD_QUADRANT';
        else if (belowHP && inFrontVP) plane = 'FOURTH_QUADRANT';
    }

    const hpDistMatch = text.match(/(\d+(?:\.\d+)?)\s*mm\s*(?:from|above|below)?\s*(?:the\s+)?HP/i)
        || text.match(/HP\s*(?:by|at)?\s*(\d+(?:\.\d+)?)\s*mm/i);
    const vpDistMatch = text.match(/(\d+(?:\.\d+)?)\s*mm\s*(?:from|in\s*front\s*of|behind)?\s*(?:the\s+)?VP/i)
        || text.match(/VP\s*(?:by|at)?\s*(\d+(?:\.\d+)?)\s*mm/i);

    return {
        type: 'point',
        name,
        position: {
            plane,
            distance_from_HP_mm: num(hpDistMatch?.[1], 20),
            distance_from_VP_mm: num(vpDistMatch?.[1], 30),
        },
    };
}

// ─────────────────────────────────────────────────────────────
// 2. Straight Line Parser
// ─────────────────────────────────────────────────────────────
export function parseLine(text: string): EngineeringProblem | null {
    if (!/\bline\b/i.test(text)) return null;
    if (/\b(perspective|picture\s*plane|station\s*point|\bPP\b|\bSP\b|\bGP\b)\b/i.test(text)) return null;

    const lenMatch = text.match(/(\d+(?:\.\d+)?)\s*mm\s*long/i)
        || text.match(/length\s*(?:of|is)?\s*(\d+(?:\.\d+)?)\s*mm/i)
        || text.match(/true\s*length\s*(?:of|is)?\s*(\d+(?:\.\d+)?)\s*mm/i)
        || text.match(/line\s*[A-Za-z0-9_]+\s*(?:of)?\s*(\d+(?:\.\d+)?)\s*mm/i);
    const length_mm = num(lenMatch?.[1], 80);

    const thetaMatch = text.match(/(\d+(?:\.\d+)?)\s*degrees\s*(?:to|with)\s*(?:the\s+)?HP/i)
        || text.match(/inclined\s*(?:at)?\s*(\d+(?:\.\d+)?)\s*degrees\s*to\s*(?:the\s+)?HP/i);
    const phiMatch = text.match(/(\d+(?:\.\d+)?)\s*degrees\s*(?:to|with)\s*(?:the\s+)?VP/i)
        || text.match(/inclined\s*(?:at)?\s*(\d+(?:\.\d+)?)\s*degrees\s*to\s*(?:the\s+)?VP/i);

    const theta = thetaMatch ? num(thetaMatch[1]) : 0;
    const phi = phiMatch ? num(phiMatch[1]) : 0;

    const endAHpMatch = text.match(/(\d+(?:\.\d+)?)\s*mm\s*(?:above|below)\s*(?:the\s+)?HP/i)
        || text.match(/(?:end\s*[A-Z]|one\s*end|its\s*end)\s*(?:is)?\s*(\d+(?:\.\d+)?)\s*mm\s*(?:above|below)/i);
    const endAVpMatch = text.match(/(\d+(?:\.\d+)?)\s*mm\s*(?:in\s*front\s*of|behind)\s*(?:the\s+)?VP/i)
        || text.match(/(?:end\s*[A-Z]|one\s*end|its\s*end)\s*(?:is)?\s*(\d+(?:\.\d+)?)\s*mm\s*(?:in\s*front|behind)/i);

    const onHP = /\b(on|in)\s+(?:the\s+)?HP\b/i.test(text);
    const onVP = /\b(on|in)\s+(?:the\s+)?VP\b/i.test(text);

    const side_of_HP = /below\s+(?:the\s+)?HP/i.test(text) || /downward/i.test(text) ? 'below' : 'above';
    const side_of_VP = /behind\s+(?:the\s+)?VP/i.test(text) ? 'behind' : 'in_front';

    const end_A: any = {
        distance_from_HP_mm: onHP && !endAHpMatch ? 0 : num(endAHpMatch?.[1], 20),
        distance_from_VP_mm: onVP && !endAVpMatch ? 0 : num(endAVpMatch?.[1], 20),
        side_of_HP,
        side_of_VP,
    };

    const hasTraces = /\b(traces?|\bHT\b|\bVT\b)\b/i.test(text);

    if (theta > 0 && phi > 0) {
        return {
            type: 'line_inclined_both',
            length_mm,
            inclination_with_HP_deg: theta,
            inclination_with_VP_deg: phi,
            end_A,
            show_traces: hasTraces || undefined,
            direction: /downward/i.test(text) ? { hp: 'down', vp: /behind/i.test(text) ? 'back' : undefined } : undefined,
        };
    }
    if (theta > 0) {
        return {
            type: 'line_inclined_HP',
            length_mm,
            inclination_deg: theta,
            end_A,
        };
    }
    if (phi > 0) {
        return {
            type: 'line_inclined_VP',
            length_mm,
            inclination_deg: phi,
            end_A,
        };
    }
    return {
        type: 'line_parallel',
        length_mm,
        end_A,
    };
}

// ─────────────────────────────────────────────────────────────
// 3. Plane Surface / Lamina Parser
// ─────────────────────────────────────────────────────────────
export function parseLamina(text: string): EngineeringProblem | null {
    if (!/\b(lamina|plate|plane\s*surface|disc|sheet)\b/i.test(text)) return null;
    if (/\b(perspective|picture\s*plane|station\s*point)\b/i.test(text)) return null;

    let shape: 'triangle' | 'square' | 'rectangle' | 'pentagon' | 'hexagon' | 'circle' = 'square';
    if (/\bcircle|circular|disc\b/i.test(text)) shape = 'circle';
    else if (/\bhexagonal|hexagon\b/i.test(text)) shape = 'hexagon';
    else if (/\bpentagonal|pentagon\b/i.test(text)) shape = 'pentagon';
    else if (/\brectangular|rectangle\b/i.test(text)) shape = 'rectangle';
    else if (/\btriangular|triangle\b/i.test(text)) shape = 'triangle';
    else if (/\bsquare\b/i.test(text)) shape = 'square';

    let size_mm: any = {};
    if (shape === 'circle') {
        const dMatch = text.match(/diameter\s*(?:of)?\s*(\d+(?:\.\d+)?)\s*mm/i)
            || text.match(/(\d+(?:\.\d+)?)\s*mm\s*diameter/i);
        size_mm = { diameter_mm: num(dMatch?.[1], 48) };
    } else if (shape === 'rectangle') {
        const rectMatch = text.match(/(\d+(?:\.\d+)?)\s*mm\s*(?:by|x)\s*(\d+(?:\.\d+)?)\s*mm/i);
        if (rectMatch) {
            size_mm = { length_mm: num(rectMatch[1]), breadth_mm: num(rectMatch[2]) };
        } else {
            size_mm = { length_mm: 50, breadth_mm: 40 };
        }
    } else {
        const sMatch = text.match(/side\s*(?:of)?\s*(\d+(?:\.\d+)?)\s*mm/i)
            || text.match(/(\d+(?:\.\d+)?)\s*mm\s*side/i)
            || text.match(/(\d+(?:\.\d+)?)\s*mm\s*edge/i);
        size_mm = { side_mm: num(sMatch?.[1], 25) };
    }

    // Inclinations
    const hpAngMatch = text.match(/(\d+(?:\.\d+)?)\s*degrees\s*(?:to|with)\s*(?:the\s+)?HP/i)
        || text.match(/inclined\s*(?:at)?\s*(\d+(?:\.\d+)?)\s*degrees\s*to\s*(?:the\s+)?HP/i);
    const vpAngMatch = text.match(/(\d+(?:\.\d+)?)\s*degrees\s*(?:to|with)\s*(?:the\s+)?VP/i)
        || text.match(/inclined\s*(?:at)?\s*(\d+(?:\.\d+)?)\s*degrees\s*to\s*(?:the\s+)?VP/i);

    let incHP = hpAngMatch ? num(hpAngMatch[1]) : 0;
    let incVP = vpAngMatch ? num(vpAngMatch[1]) : 0;

    if (/perpendicular\s*to\s*(?:the\s+)?HP/i.test(text)) incHP = 90;
    if (/perpendicular\s*to\s*(?:the\s+)?VP/i.test(text)) incVP = 90;

    const centerHp = text.match(/(\d+(?:\.\d+)?)\s*mm\s*above\s*(?:the\s+)?HP/i);
    const centerVp = text.match(/(\d+(?:\.\d+)?)\s*mm\s*in\s*front\s*of\s*(?:the\s+)?VP/i);

    const feature = /shorter\s*edge/i.test(text)
        ? 'shorter_side'
        : /longer\s*edge/i.test(text)
        ? 'longer_side'
        : /diagonal/i.test(text)
        ? 'diagonal'
        : /corner/i.test(text)
        ? 'corner_to_center'
        : 'side';

    // Hole detection
    const holeMatch = text.match(/(\d+(?:\.\d+)?)\s*mm\s*(?:circular\s*hole|diameter\s*hole)/i)
        || text.match(/hole\s*(?:of)?\s*(\d+(?:\.\d+)?)\s*mm\s*diameter/i);
    const opening = holeMatch ? { shape: 'circle' as const, diameter_mm: num(holeMatch[1]) } : undefined;

    return {
        type: 'plane_surface',
        shape,
        size_mm,
        opening,
        center: centerHp && centerVp ? {
            distance_from_HP_mm: num(centerHp[1]),
            distance_from_VP_mm: num(centerVp[1]),
        } : undefined,
        orientation: {
            inclination_with_HP_deg: incHP,
            inclination_with_VP_deg: incVP,
            reference_feature: {
                feature,
                contact_plane: /\bon\s+(?:the\s+)?VP\b/i.test(text) ? 'VP' : 'HP',
            },
        },
    };
}

// ─────────────────────────────────────────────────────────────
// 4. Perspective Projection Parser
// ─────────────────────────────────────────────────────────────
export function parsePerspective(text: string): EngineeringProblem | null {
    if (!/\b(perspective|station\s*point|\bSP\b|\bPP\b|\bGP\b|picture\s*plane)\b/i.test(text)) return null;

    let method: 'visual_ray' | 'vanishing_point' | 'both' = 'vanishing_point';
    if (/both\s*methods?/i.test(text)) method = 'both';
    else if (/visual[\s-]ray/i.test(text)) method = 'visual_ray';
    else if (/vanishing[\s-]point/i.test(text)) method = 'vanishing_point';

    const spDistMatch = text.match(/(\d+(?:\.\d+)?)\s*mm\s*in\s*front\s*of\s*(?:the\s+)?PP/i);
    const spHeightMatch = text.match(/(\d+(?:\.\d+)?)\s*mm\s*above\s*(?:the\s+)?GP/i);
    const spRightMatch = text.match(/(\d+(?:\.\d+)?)\s*mm\s*(?:to\s*the\s*)?right/i);
    const spLeftMatch = text.match(/(\d+(?:\.\d+)?)\s*mm\s*(?:to\s*the\s*)?left/i);

    const spDist = num(spDistMatch?.[1], 90);
    const spHeight = num(spHeightMatch?.[1], 70);
    let spOffset = 0;
    if (spRightMatch) spOffset = num(spRightMatch[1]);
    else if (spLeftMatch) spOffset = -num(spLeftMatch[1]);

    let position_relative_to_PP: 'behind' | 'in_front' | 'touching' = 'behind';
    let nearest_distance = 0;
    if (/touching\s*(?:the\s+)?PP/i.test(text) || /in\s*(?:the\s+)?PP\b/i.test(text)) {
        position_relative_to_PP = 'touching';
        nearest_distance = 0;
    } else {
        const behindMatch = text.match(/(\d+(?:\.\d+)?)\s*mm\s*behind\s*(?:the\s+)?PP/i);
        if (behindMatch) {
            position_relative_to_PP = 'behind';
            nearest_distance = num(behindMatch[1]);
        }
    }

    // 1. Cube
    if (/\bcube\b/i.test(text)) {
        const sideMatch = text.match(/cube\s*(?:of)?\s*(\d+(?:\.\d+)?)\s*mm/i) || text.match(/(\d+(?:\.\d+)?)\s*mm\s*(?:side|edge)/i);
        const side = num(sideMatch?.[1], 40);
        const angleMatch = text.match(/(\d+(?:\.\d+)?)\s*degrees\s*to\s*PP/i);
        const angle = /equally\s*inclined/i.test(text) ? 45 : (angleMatch ? num(angleMatch[1]) : 45);

        return {
            type: 'perspective_projection',
            method,
            object: {
                kind: 'solid',
                solid_type: 'cube',
                base_shape: 'square',
                base_size_mm: { side_mm: side },
                height_mm: side,
                base_edge_angle_to_PP_deg: angle,
            },
            placement: {
                position_relative_to_PP,
                nearest_distance_from_PP_mm: nearest_distance,
            },
            station_point: {
                distance_in_front_of_PP_mm: spDist,
                height_above_GP_mm: spHeight,
                lateral_offset_from_object_center_mm: spOffset,
            },
            required_outputs: {
                perspective_view: true,
                top_view_construction: true,
                vanishing_points: method !== 'visual_ray',
            },
        };
    }

    // 2. Pyramids & Prisms
    if (/\b(pyramid|prism)\b/i.test(text)) {
        const isPyramid = /\bpyramid\b/i.test(text);
        const shape = /\bhexagonal\b/i.test(text) ? 'hexagon' : /\bpentagonal\b/i.test(text) ? 'pentagon' : /\btriangular\b/i.test(text) ? 'triangle' : 'square';
        const sideMatch = text.match(/base\s*(?:side)?\s*(\d+(?:\.\d+)?)\s*mm/i) || text.match(/(\d+(?:\.\d+)?)\s*mm\s*side/i);
        const hMatch = text.match(/height\s*(\d+(?:\.\d+)?)\s*mm/i) || text.match(/axis\s*(\d+(?:\.\d+)?)\s*mm/i) || text.match(/(\d+(?:\.\d+)?)\s*mm\s*high/i);
        const angMatch = text.match(/(\d+(?:\.\d+)?)\s*degrees\s*to\s*PP/i);

        return {
            type: 'perspective_projection',
            method,
            object: {
                kind: 'solid',
                solid_type: isPyramid ? 'pyramid' : 'prism',
                base_shape: shape,
                base_size_mm: { side_mm: num(sideMatch?.[1], 25) },
                height_mm: num(hMatch?.[1], 60),
                base_edge_angle_to_PP_deg: angMatch ? num(angMatch[1]) : 30,
            },
            placement: {
                position_relative_to_PP,
                nearest_distance_from_PP_mm: nearest_distance,
            },
            station_point: {
                distance_in_front_of_PP_mm: spDist,
                height_above_GP_mm: spHeight,
                lateral_offset_from_object_center_mm: spOffset,
            },
            required_outputs: {
                perspective_view: true,
                top_view_construction: true,
                vanishing_points: method !== 'visual_ray',
            },
        };
    }

    // 3. Line in Perspective
    if (/\bline\b/i.test(text)) {
        const lenMatch = text.match(/(\d+(?:\.\d+)?)\s*mm\s*long/i);
        const hMatch = text.match(/(\d+(?:\.\d+)?)\s*mm\s*above\s*GP/i);
        const angMatch = text.match(/inclined\s*(\d+(?:\.\d+)?)\s*degrees\s*to\s*PP/i);

        return {
            type: 'perspective_projection',
            method: 'visual_ray',
            object: {
                kind: 'line',
                length_mm: num(lenMatch?.[1], 55),
                height_above_GP_mm: num(hMatch?.[1], 20),
                angle_to_PP_deg: num(angMatch?.[1], 35),
            },
            placement: {
                position_relative_to_PP,
                nearest_distance_from_PP_mm: nearest_distance,
            },
            station_point: {
                distance_in_front_of_PP_mm: spDist,
                height_above_GP_mm: spHeight,
                lateral_offset_from_object_center_mm: spOffset,
            },
            required_outputs: {
                perspective_view: true,
                top_view_construction: true,
            },
        };
    }

    // 4. Lamina in Perspective (Circle, Plate, Disc)
    if (/\b(circle|circular|plate|disc)\b/i.test(text)) {
        const diaMatch = text.match(/(\d+(?:\.\d+)?)\s*mm\s*diameter/i) || text.match(/diameter\s*(?:of)?\s*(\d+(?:\.\d+)?)\s*mm/i);
        return {
            type: 'perspective_projection',
            method: method || 'visual_ray',
            object: {
                kind: 'lamina',
                shape: 'circle',
                size_mm: { diameter_mm: num(diaMatch?.[1], 50) },
                orientation: 'horizontal',
            },
            placement: {
                position_relative_to_PP,
                nearest_distance_from_PP_mm: nearest_distance,
            },
            station_point: {
                distance_in_front_of_PP_mm: spDist,
                height_above_GP_mm: spHeight,
                lateral_offset_from_object_center_mm: spOffset,
            },
            required_outputs: {
                perspective_view: true,
                top_view_construction: true,
            },
        };
    }

    return null;
}

// ─────────────────────────────────────────────────────────────
// 5. Isometric Projection Parser
// ─────────────────────────────────────────────────────────────
export function parseIsometric(text: string): EngineeringProblem | null {
    if (!/\bisometric\b/i.test(text)) return null;

    const scale_mode = /\bisometric\s*view\b/i.test(text) ? 'isometric_view' : 'isometric_projection';

    // Check composite isometric solids: "resting centrally on", "placed centrally on"
    if (/\b(resting\s*centrally|placed\s*centrally|mounted\s*centrally|surmounted\s*by)\b/i.test(text)) {
        const members: any[] = [];
        // Match base solid
        const prismBase = text.match(/(square\s*prism|cube)\s*(?:of)?\s*(?:base\s*side)?\s*(\d+(?:\.\d+)?)\s*mm(?:\s*side)?(?:\s*and)?\s*(?:height|thickness)?\s*(\d+(?:\.\d+)?)\s*mm/i);
        const cylTop = text.match(/cylinder\s*(?:of)?\s*(?:diameter)?\s*(\d+(?:\.\d+)?)\s*mm(?:\s*diameter)?(?:\s*and)?\s*(?:height|axis)?\s*(\d+(?:\.\d+)?)\s*mm/i);
        const sphereTop = text.match(/sphere\s*(?:of)?\s*(\d+(?:\.\d+)?)\s*mm\s*diameter/i);

        if (prismBase) {
            const side = num(prismBase[2], 50);
            const h = num(prismBase[3], 25);
            members.push({
                solid_type: /cube/i.test(prismBase[1]) ? 'cube' : 'prism',
                base_shape: 'square',
                base_size_mm: { side_mm: side },
                height_mm: h,
                placed_centrally: true,
            });
        }
        if (cylTop) {
            const dia = num(cylTop[1], 40);
            const h = num(cylTop[2], 50);
            members.push({
                solid_type: 'cylinder',
                base_shape: 'circle',
                base_size_mm: { diameter_mm: dia },
                height_mm: h,
                placed_centrally: true,
            });
        } else if (sphereTop) {
            const dia = num(sphereTop[1], 40);
            members.push({
                solid_type: 'sphere',
                base_shape: 'circle',
                base_size_mm: { diameter_mm: dia },
                height_mm: dia,
                placed_centrally: true,
            });
        }

        if (members.length >= 2) {
            return {
                type: 'isometric_projection',
                scale_mode,
                object: {
                    kind: 'composite',
                    solids: members,
                },
            };
        }
    }

    // Frustum in isometric
    if (/\bfrustum\b/i.test(text)) {
        const isCone = /\bcone\b/i.test(text);
        const baseShape = isCone ? 'circle' : (/\bpentagonal\b/i.test(text) ? 'pentagon' : /\bhexagonal\b/i.test(text) ? 'hexagon' : 'square');
        const baseSide = text.match(/base\s*(?:side|diameter)?\s*(\d+(?:\.\d+)?)\s*mm/i)
            || text.match(/bottom\s*(?:base)?\s*(?:side|diameter)?\s*(\d+(?:\.\d+)?)\s*mm/i)
            || text.match(/base\s*(\d+(?:\.\d+)?)\s*mm/i);
        const topSide = text.match(/top\s*(?:base)?\s*(?:side|diameter)?\s*(\d+(?:\.\d+)?)\s*mm/i)
            || text.match(/top\s*(\d+(?:\.\d+)?)\s*mm/i);
        const hMatch = text.match(/height\s*(\d+(?:\.\d+)?)\s*mm/i) || text.match(/(\d+(?:\.\d+)?)\s*mm\s*high/i);

        const bVal = num(baseSide?.[1], 40);
        const tVal = num(topSide?.[1], 20);

        return {
            type: 'isometric_projection',
            scale_mode,
            object: {
                kind: 'solid',
                solid_type: 'frustum',
                base_shape: baseShape,
                base_size_mm: baseShape === 'circle' ? { diameter_mm: bVal } : { side_mm: bVal },
                top_base_size_mm: baseShape === 'circle' ? { diameter_mm: tVal } : { side_mm: tVal },
                height_mm: num(hMatch?.[1], 50),
            },
        };
    }

    // Cube
    if (/\bcube\b/i.test(text)) {
        const sMatch = text.match(/cube\s*(?:of)?\s*(\d+(?:\.\d+)?)\s*mm/i) || text.match(/(\d+(?:\.\d+)?)\s*mm\s*(?:side|edge)/i);
        const side = num(sMatch?.[1], 40);
        return {
            type: 'isometric_projection',
            scale_mode,
            object: {
                kind: 'solid',
                solid_type: 'cube',
                base_shape: 'square',
                base_size_mm: { side_mm: side },
                height_mm: side,
            },
        };
    }

    // Standard solids in isometric
    if (/\b(prism|pyramid|cylinder|cone|sphere)\b/i.test(text)) {
        const solid_type = /\bprism\b/i.test(text) ? 'prism' : /\bpyramid\b/i.test(text) ? 'pyramid' : /\bcylinder\b/i.test(text) ? 'cylinder' : /\bcone\b/i.test(text) ? 'cone' : 'sphere';
        const base_shape = solid_type === 'cylinder' || solid_type === 'cone' || solid_type === 'sphere' ? 'circle' : (
            /\bhexagonal\b/i.test(text) ? 'hexagon' : /\bpentagonal\b/i.test(text) ? 'pentagon' : /\btriangular\b/i.test(text) ? 'triangle' : 'square'
        );
        const sMatch = text.match(/base\s*(?:side|diameter)?\s*(\d+(?:\.\d+)?)\s*mm/i)
            || text.match(/diameter\s*(?:of)?\s*(\d+(?:\.\d+)?)\s*mm/i)
            || text.match(/side\s*(?:of)?\s*(\d+(?:\.\d+)?)\s*mm/i)
            || text.match(/(\d+(?:\.\d+)?)\s*mm\s*diameter/i);
        const hMatch = text.match(/axis\s*(?:length)?\s*(\d+(?:\.\d+)?)\s*mm/i)
            || text.match(/height\s*(\d+(?:\.\d+)?)\s*mm/i)
            || text.match(/(\d+(?:\.\d+)?)\s*mm\s*high/i);

        const val = num(sMatch?.[1], 30);
        return {
            type: 'isometric_projection',
            scale_mode,
            object: {
                kind: 'solid',
                solid_type,
                base_shape,
                base_size_mm: base_shape === 'circle' ? { diameter_mm: val } : { side_mm: val },
                height_mm: solid_type === 'sphere' ? val : num(hMatch?.[1], 60),
            },
        };
    }

    return null;
}

// ─────────────────────────────────────────────────────────────
// 6. Section of Solid & Development Parser
// ─────────────────────────────────────────────────────────────
export function parseSectionOrDevelopment(text: string): EngineeringProblem | null {
    const isSection = /\b(section\s*(?:of|plane)|cut\s*(?:by|off|at)?|cutting\s*plane|sectional\s*(?:top|front|elevation|plan)|true\s*shape)\b/i.test(text);
    const isDevelopment = /\b(development\s*(?:of)?|develop\s*(?:a|its|the)?|lateral\s*surface)\b/i.test(text);

    if (!isSection && !isDevelopment) return null;

    // In SectionSolidSchemaZ, solid_type is restricted to "prism" | "pyramid"
    // A cylinder is represented as solid_type='prism' with base_shape='circle'
    // A cone is represented as solid_type='pyramid' with base_shape='circle'
    const isPyramidal = /\b(pyramid|cone)\b/i.test(text);
    const solid_type: 'prism' | 'pyramid' = isPyramidal ? 'pyramid' : 'prism';

    const base_shape = /\b(cylinder|cone)\b/i.test(text) ? 'circle' : (
        /\bhexagonal\b/i.test(text) ? 'hexagon' : /\bpentagonal\b/i.test(text) ? 'pentagon' : /\btriangular\b/i.test(text) ? 'triangle' : 'square'
    );

    const sMatch = text.match(/base\s*(?:side|diameter)?\s*(\d+(?:\.\d+)?)\s*mm/i)
        || text.match(/diameter\s*(?:of)?\s*(\d+(?:\.\d+)?)\s*mm/i)
        || text.match(/side\s*(\d+(?:\.\d+)?)\s*mm/i)
        || text.match(/(\d+(?:\.\d+)?)\s*mm\s*diameter/i);
    const hMatch = text.match(/axis\s*(?:length)?\s*(\d+(?:\.\d+)?)\s*mm/i)
        || text.match(/height\s*(\d+(?:\.\d+)?)\s*mm/i)
        || text.match(/(\d+(?:\.\d+)?)\s*mm\s*long/i);

    const val = num(sMatch?.[1], 30);
    const axis_length_mm = num(hMatch?.[1], 60);

    const cutAngleMatch = text.match(/inclined\s*(?:at)?\s*(\d+(?:\.\d+)?)\s*degrees\s*to\s*(?:the\s+)?HP/i)
        || text.match(/inclined\s*(?:at)?\s*(\d+(?:\.\d+)?)\s*degrees\s*to\s*(?:the\s+)?VP/i);
    const cutAngle = cutAngleMatch ? num(cutAngleMatch[1]) : 45;

    let passes_through: any = 'axis_midpoint';
    if (/\b(bisecting|bisects|midpoint)\b/i.test(text)) {
        passes_through = 'axis_midpoint';
    } else {
        const distFromBase = text.match(/(\d+(?:\.\d+)?)\s*mm\s*(?:from|above)\s*(?:the\s+)?base/i)
            || text.match(/height\s*(?:of)?\s*(\d+(?:\.\d+)?)\s*mm\s*from\s*(?:the\s+)?base/i)
            || text.match(/distance\s*(?:of)?\s*(\d+(?:\.\d+)?)\s*mm\s*from\s*(?:the\s+)?base/i)
            || text.match(/cuts\s*(?:the\s+axis\s*at)?\s*(\d+(?:\.\d+)?)\s*mm\s*(?:from|above)/i);
        if (distFromBase) {
            passes_through = { distance_from_base_mm: num(distFromBase[1]) };
        }
    }

    return {
        type: 'section_solid',
        solid_type,
        base_shape,
        base_size_mm: base_shape === 'circle' ? { diameter_mm: val } : { side_mm: val },
        axis_length_mm,
        resting_on: 'HP',
        cutting_plane: {
            inclination_with_HP_deg: cutAngle,
            perpendicular_to: 'VP',
            passes_through,
        },
        required_outputs: {
            front_view: true,
            sectional_top_view: true,
            true_shape: true,
        },
        draw_development: isDevelopment,
    };
}

// ─────────────────────────────────────────────────────────────
// 7. Composite Solids Parser
// ─────────────────────────────────────────────────────────────
export function parseComposite(text: string): EngineeringProblem | null {
    if (!/\b(placed\s*centrally|combination\s*of\s*solids|resting\s*centrally|mounted\s*centrally|surmounted\s*by|combination)\b/i.test(text)) return null;
    if (/\bisometric\b/i.test(text)) return null; // Let parseIsometric handle isometric composite solids

    const solids: any[] = [];

    // Cylinder base/member
    const cylMatch = text.match(/cylinder\s*(?:of)?\s*(?:diameter)?\s*(\d+(?:\.\d+)?)\s*mm(?:\s*diameter)?\s*(?:and)?\s*(?:height|axis|high|long)?\s*(\d+(?:\.\d+)?)\s*mm(?:\s*(?:high|long|height))?/i);
    if (cylMatch) {
        solids.push({
            solid_type: 'cylinder',
            base_shape: 'circle',
            base_size_mm: { diameter_mm: num(cylMatch[1]) },
            height_mm: num(cylMatch[2]),
            placed_centrally: true,
        });
    }

    // Prism/Cube middle/base
    const prismMatch = text.match(/(square\s*prism|cube)\s*(?:of)?\s*(\d+(?:\.\d+)?)\s*mm\s*(?:side|base\s*side|edge)\s*(?:(?:and)?\s*(\d+(?:\.\d+)?)\s*mm\s*(?:high|long|height))?/i);
    if (prismMatch) {
        const isCube = /cube/i.test(prismMatch[1]);
        const side = num(prismMatch[2]);
        const h = isCube ? side : num(prismMatch[3], side);
        solids.push({
            solid_type: isCube ? 'cube' : 'prism',
            base_shape: 'square',
            base_size_mm: { side_mm: side },
            height_mm: h,
            placed_centrally: true,
        });
    }

    // Sphere on top
    const sphereMatch = text.match(/sphere\s*(?:of)?\s*(\d+(?:\.\d+)?)\s*mm\s*diameter/i);
    if (sphereMatch) {
        solids.push({
            solid_type: 'sphere',
            base_shape: 'circle',
            base_size_mm: { diameter_mm: num(sphereMatch[1]) },
            height_mm: num(sphereMatch[1]),
            placed_centrally: true,
        });
    }

    // Hemisphere
    const hemiMatch = text.match(/hemisphere\s*(?:of)?\s*(\d+(?:\.\d+)?)\s*mm\s*diameter/i);
    if (hemiMatch) {
        solids.push({
            solid_type: 'hemisphere',
            base_shape: 'circle',
            base_size_mm: { diameter_mm: num(hemiMatch[1]) },
            height_mm: num(hemiMatch[1]) / 2,
            placed_centrally: true,
            hemisphere_orientation: /flat\s*face\s*up/i.test(text) ? 'flat_face_up' : 'flat_face_down',
        });
    }

    // Cone
    const coneMatch = text.match(/cone\s*(?:of)?\s*(?:base\s*diameter)?\s*(\d+(?:\.\d+)?)\s*mm\s*(?:diameter)?\s*(?:and)?\s*(?:height|axis)?\s*(\d+(?:\.\d+)?)\s*mm/i);
    if (coneMatch) {
        solids.push({
            solid_type: 'cone',
            base_shape: 'circle',
            base_size_mm: { diameter_mm: num(coneMatch[1]) },
            height_mm: num(coneMatch[2]),
            placed_centrally: true,
        });
    }

    if (solids.length >= 2) {
        return {
            type: 'composite_solid',
            resting_on: 'HP',
            solids,
        };
    }

    return null;
}

// ─────────────────────────────────────────────────────────────
// 8. Auxiliary View Parser
// ─────────────────────────────────────────────────────────────
export function parseAuxiliary(text: string): EngineeringProblem | null {
    if (!/\b(auxiliary\s*elevation|auxiliary\s*plan|auxiliary\s*front|auxiliary\s*top|\bAFV\b|\bATV\b)\b/i.test(text)) return null;

    const view_type = /\b(auxiliary\s*plan|auxiliary\s*top|\bATV\b)\b/i.test(text) ? 'auxiliary_plan' : 'auxiliary_elevation';
    const angMatch = text.match(/inclined\s*(?:at)?\s*(\d+(?:\.\d+)?)\s*degrees/i);
    const inclination_deg = num(angMatch?.[1], 45);

    const solid_type = /\bpyramid\b/i.test(text) ? 'pyramid' : /\bcylinder\b/i.test(text) ? 'cylinder' : /\bcube\b/i.test(text) ? 'cube' : 'prism';
    const base_shape = solid_type === 'cylinder' ? 'circle' : (
        /\bhexagonal\b/i.test(text) ? 'hexagon' : /\bpentagonal\b/i.test(text) ? 'pentagon' : /\btriangular\b/i.test(text) ? 'triangle' : 'square'
    );

    const sMatch = text.match(/base\s*(?:side|diameter)?\s*(\d+(?:\.\d+)?)\s*mm/i)
        || text.match(/diameter\s*(\d+(?:\.\d+)?)\s*mm/i)
        || text.match(/side\s*(\d+(?:\.\d+)?)\s*mm/i)
        || text.match(/cube\s*(?:of)?\s*(\d+(?:\.\d+)?)\s*mm/i);
    const hMatch = text.match(/axis\s*(?:length)?\s*(\d+(?:\.\d+)?)\s*mm/i)
        || text.match(/height\s*(\d+(?:\.\d+)?)\s*mm/i)
        || text.match(/(\d+(?:\.\d+)?)\s*mm\s*long/i);

    const val = num(sMatch?.[1], 30);
    return {
        type: 'auxiliary_view',
        view_type,
        inclination_deg,
        solid_type: solid_type as any,
        base_shape: base_shape as any,
        base_size_mm: base_shape === 'circle' ? { diameter_mm: val } : { side_mm: val },
        axis_length_mm: num(hMatch?.[1], 60),
        resting_on: 'HP',
    };
}

// ─────────────────────────────────────────────────────────────
// 9. General Solids Parser (Projection of Solids)
// ─────────────────────────────────────────────────────────────
export function parseSolid(text: string): EngineeringProblem | null {
    if (!/\b(prism|pyramid|cylinder|cone|cube|tetrahedron)\b/i.test(text)) return null;

    const solid_type = /\bcube\b/i.test(text) ? 'cube' : (
        /\bpyramid\b/i.test(text) ? 'pyramid' : /\bcylinder\b/i.test(text) ? 'cylinder' : /\bcone\b/i.test(text) ? 'cone' : 'prism'
    );
    const base_shape = solid_type === 'cube' ? 'square' : (
        solid_type === 'cylinder' || solid_type === 'cone' ? 'circle' : (
            /\bhexagonal\b/i.test(text) ? 'hexagon' : /\bpentagonal\b/i.test(text) ? 'pentagon' : /\btriangular\b/i.test(text) ? 'triangle' : 'square'
        )
    );

    const sMatch = text.match(/base\s*(?:side|diameter)?\s*(\d+(?:\.\d+)?)\s*mm/i)
        || text.match(/diameter\s*(?:of)?\s*(\d+(?:\.\d+)?)\s*mm/i)
        || text.match(/side\s*(\d+(?:\.\d+)?)\s*mm/i)
        || text.match(/cube\s*(?:of)?\s*(\d+(?:\.\d+)?)\s*mm/i)
        || text.match(/(\d+(?:\.\d+)?)\s*mm\s*(?:edge|side|diameter)/i);
    const hMatch = text.match(/axis\s*(?:length)?\s*(\d+(?:\.\d+)?)\s*mm/i)
        || text.match(/height\s*(\d+(?:\.\d+)?)\s*mm/i)
        || text.match(/(\d+(?:\.\d+)?)\s*mm\s*long/i)
        || text.match(/(\d+(?:\.\d+)?)\s*mm\s*high/i);

    const side = num(sMatch?.[1], 40);
    const height_mm = solid_type === 'cube' ? side : num(hMatch?.[1], 60);

    const resting_on: 'HP' | 'VP' = /\b(on\s+(?:the\s+)?VP|on\s+VP)\b/i.test(text) ? 'VP' : 'HP';

    let resting_element: any = undefined;
    if (/\bbase\s*corners?\b/i.test(text) || /\bcorners?\s*(?:of\s*(?:the|its)?\s*base)?\s*(?:on|in)\s*(?:HP|VP)\b/i.test(text) || /\bcorner\s*(?:on|in)\s*(?:HP|VP)\b/i.test(text) || /\bon\s*one\s*of\s*its\s*corners?\b/i.test(text) || /\bcorner\s*of\s*(?:the|its)?\s*base\b/i.test(text)) {
        resting_element = 'base_corner';
    } else if (/\bbase\s*edges?\b/i.test(text) || /\bedges?\s*of\s*(?:the|its)?\s*base\b/i.test(text) || /\bon\s*a\s*base\s*edge\b/i.test(text) || /\bon\s*one\s*of\s*its\s*base\s*edges?\b/i.test(text)) {
        resting_element = 'base_edge';
    } else if (/\bslant\s*edges?\b/i.test(text)) {
        resting_element = 'slant_edge';
    } else if (/\bgenerators?\b/i.test(text)) {
        resting_element = 'generator';
    } else if (/\b(triangular\s*faces?|rectangular\s*faces?|lateral\s*faces?|face\s*on\s*HP)\b/i.test(text)) {
        resting_element = 'lateral_face';
    } else if (/\b(longer\s*edges?|lateral\s*edges?)\b/i.test(text)) {
        resting_element = 'lateral_edge';
    } else if (/\b(base\s*rim|rim|point\s*(?:of|on)\s*(?:the\s*)?base\s*(?:rim|circumference)|point\s*(?:of|on)\s*(?:its\s*)?base\s*rim)\b/i.test(text)) {
        resting_element = 'base_circle_point';
    }

    // Body diagonal
    if (/\b(body\s*diagonal|solid\s*diagonal|space\s*diagonal|longest\s*diagonal)\b/i.test(text)) {
        return {
            type: 'solid',
            solid_type: solid_type as any,
            base_shape: base_shape as any,
            base_size_mm: { side_mm: side },
            height_mm,
            resting_on: 'HP',
            resting_element: 'base_corner',
            base_orientation: {
                feature: 'body_diagonal',
                relation: 'perpendicular',
                reference_plane: 'HP',
            },
        };
    }

    // Base edge orientation constraint
    let base_orientation: any = undefined;
    if (/edge\s*(?:of\s*the\s*base)?\s*(?:is)?\s*parallel\s*to\s*(?:the\s+)?VP/i.test(text) || /side\s*(?:of\s*the\s*base)?\s*(?:is)?\s*parallel\s*to\s*(?:the\s+)?VP/i.test(text)) {
        base_orientation = { feature: 'side', relation: 'parallel', reference_plane: 'VP' };
    } else if (/edge\s*(?:of\s*the\s*base)?\s*(?:is)?\s*perpendicular\s*to\s*(?:the\s+)?VP/i.test(text) || /side\s*(?:of\s*the\s*base)?\s*(?:is)?\s*perpendicular\s*to\s*(?:the\s+)?VP/i.test(text)) {
        base_orientation = { feature: 'side', relation: 'perpendicular', reference_plane: 'VP' };
    } else {
        const baseOrientMatch = text.match(/(?:edge|side)\s*(?:of\s*(?:the\s*)?base)?\s*(?:is)?\s*inclined\s*(?:at)?\s*(\d+(?:\.\d+)?)\s*degrees\s*to\s*(?:the\s+)?VP/i);
        if (baseOrientMatch) {
            base_orientation = { feature: 'side', relation: 'inclined', reference_plane: 'VP', angle_deg: num(baseOrientMatch[1]) };
        }
    }

    // Inclinations
    const slantHpTilt = text.match(/slant\s*edge\s*(?:containing\s*(?:the\s*)?corner)?\s*(?:makes|is\s*inclined\s*(?:at)?)\s*(?:(?:an\s*)?angles?\s*(?:of)?)?\s*(\d+(?:\.\d+)?)\s*degrees\s*(?:to|with)\s*(?:the\s+)?HP/i)
        || text.match(/slant\s*edge\s*(?:makes|is\s*inclined\s*(?:at)?)\s*(\d+(?:\.\d+)?)\s*degrees\s*(?:to|with)\s*(?:the\s+)?HP/i);
    const baseHpTilt = text.match(/(?:side|edge|base)\s*(?:of\s*(?:the\s*)?base)?(?:\s*contained\s*by\s*that\s*corner)?\s*(?:is)?\s*inclined\s*(?:at)?\s*(\d+(?:\.\d+)?)\s*degrees\s*to\s*(?:the\s+)?HP/i)
        || text.match(/base\s*(?:makes|is\s*inclined\s*(?:at)?)\s*(\d+(?:\.\d+)?)\s*degrees\s*(?:to|with)\s*(?:the\s+)?HP/i)
        || text.match(/base\s*makes\s*(\d+(?:\.\d+)?)\s*degrees\s*to\s*HP/i);
    const hpTilt = text.match(/axis\s*(?:is)?\s*inclined\s*(?:at)?\s*(\d+(?:\.\d+)?)\s*degrees\s*to\s*(?:the\s+)?HP/i)
        || text.match(/axis\s*(?:makes)?\s*(\d+(?:\.\d+)?)\s*degrees\s*with\s*(?:the\s+)?HP/i)
        || (!baseHpTilt && !slantHpTilt ? text.match(/inclined\s*(?:at)?\s*(\d+(?:\.\d+)?)\s*degrees\s*to\s*(?:the\s+)?HP/i) : null);
    const vpTilt = text.match(/axis\s*(?:is)?\s*inclined\s*(?:at)?\s*(\d+(?:\.\d+)?)\s*degrees\s*to\s*(?:the\s+)?VP/i)
        || text.match(/axis\s*(?:makes)?\s*(\d+(?:\.\d+)?)\s*degrees\s*with\s*(?:the\s+)?VP/i)
        || text.match(/inclined\s*(?:at)?\s*(\d+(?:\.\d+)?)\s*degrees\s*to\s*(?:the\s+)?VP/i)
        || text.match(/(\d+(?:\.\d+)?)\s*degrees\s*(?:to|with)\s*(?:the\s+)?VP/i);

    let inclination_deg: number | undefined = undefined;
    let base_inclination_deg: number | undefined = baseHpTilt ? num(baseHpTilt[1]) : undefined;
    let slant_edge_inclination_deg: number | undefined = slantHpTilt ? num(slantHpTilt[1]) : undefined;
    let inclined_to: 'HP' | 'VP' | 'HP_VP' | undefined = undefined;
    let inclination_with_HP_deg: number | undefined = undefined;
    let inclination_with_VP_deg: number | undefined = undefined;

    if (hpTilt && vpTilt) {
        inclined_to = 'HP_VP';
        inclination_with_HP_deg = num(hpTilt[1]);
        inclination_with_VP_deg = num(vpTilt[1]);
    } else if (slantHpTilt && vpTilt) {
        inclined_to = 'VP';
        inclination_deg = num(vpTilt[1]);
        if (!resting_element) resting_element = 'base_corner';
    } else if (baseHpTilt && vpTilt) {
        inclined_to = 'VP';
        inclination_deg = num(vpTilt[1]);
        if (!resting_element) resting_element = 'base_corner';
    } else if (slantHpTilt) {
        inclined_to = 'HP';
        if (!resting_element) resting_element = 'base_corner';
    } else if (hpTilt) {
        inclined_to = 'HP';
        inclination_deg = num(hpTilt[1]);
    } else if (baseHpTilt) {
        inclined_to = 'HP';
        if (!resting_element) resting_element = 'base_edge';
    } else if (vpTilt) {
        inclined_to = 'VP';
        inclination_deg = num(vpTilt[1]);
    }

    return {
        type: 'solid',
        solid_type: solid_type as any,
        base_shape: base_shape as any,
        base_size_mm: base_shape === 'circle' ? { diameter_mm: side } : { side_mm: side },
        height_mm,
        resting_on,
        resting_element,
        base_orientation,
        inclined_to,
        inclination_deg,
        base_inclination_deg,
        slant_edge_inclination_deg,
        inclination_with_HP_deg,
        inclination_with_VP_deg,
    };
}

// ─────────────────────────────────────────────────────────────
// Master Dispatcher with Validation & Fallback
// ─────────────────────────────────────────────────────────────
export function parseProblemLocally(rawText: string): EngineeringProblem | null {
    const text = normalizeText(rawText);
    if (!text) return null;

    // 1. Exact or normalized lookup against textbook database
    const matchedExample = EXAMPLES.find((ex) => normalizeText(ex.query) === text);
    if (matchedExample) {
        const validated = EngineeringProblemZ.safeParse(matchedExample.parsed);
        if (validated.success) return validated.data as EngineeringProblem;
    }

    // 2. High-priority specialized domain matchers
    const domainParsers = [
        parseComposite,
        parsePerspective,
        parseIsometric,
        parseAuxiliary,
        parseSectionOrDevelopment,
        parseLamina,
        parsePoint,
        parseLine,
        parseSolid,
    ];

    for (const parser of domainParsers) {
        try {
            const candidate = parser(text);
            if (candidate) {
                const validated = EngineeringProblemZ.safeParse(candidate);
                if (validated.success) {
                    return validated.data as EngineeringProblem;
                }
            }
        } catch {
            // Proceed to next parser
        }
    }

    return null;
}
