import React from 'react';
import { GeometryOutput } from '../types';

interface TeachingControlsProps {
    currentSequence: number;
    totalSteps: number;
    onSequenceChange: React.Dispatch<React.SetStateAction<number>>;
    problemType?: string;
    geometry: GeometryOutput;
}

const AUXILIARY_ELEVATION_DESCRIPTIONS: { [key: number]: string } = {
    0: 'Draw XY Line & Reference Planes',
    1: 'Step I: Draw TV & FV of Solid in Simple Position (with vertex labels a, b, c…)',
    2: 'Step II: Draw Inclined X₁Y₁ Reference Line at given angle to VP (with angle arc)',
    3: 'Step III: Project perpendiculars from each TV vertex to X₁Y₁',
    4: 'Step IV: Transfer heights — mark h from X₁Y₁ perpendicular to true height',
    5: 'Step V: Complete Auxiliary View (visible & hidden edges, vertex labels a′, b′, c′…)',
    6: 'Dimensions: axis length h, base side, angle annotation',
};

const SOLID_DESCRIPTIONS: { [key: number]: string } = {
    0: 'Draw XY Line & Basic Planes',
    1: 'Stage 1: Solid in Simple Position (Base on HP)',
    2: 'Stage 2: Incline Front View to HP',
    3: 'Stage 2: Project New Top View',
    4: 'Stage 3: Rotate Top View for VP Inclination',
    5: 'Stage 3: Project Final Front View',
    6: 'Final Clean Projections',
};

const SOLID_VP_DESCRIPTIONS: { [key: number]: string } = {
    0: 'Draw XY Line & Basic Planes',
    1: 'Stage 1: Solid in Simple Position (Base on VP)',
    2: 'Stage 2: Incline Top View to VP',
    3: 'Stage 2: Project New Front View',
    4: 'Stage 3: Rotate Front View for HP Inclination',
    5: 'Stage 3: Project Final Top View',
    6: 'Final Clean Projections',
};

const LINE_DESCRIPTIONS: { [key: number]: string } = {
    0: 'Draw XY Line',
    1: 'Plot Position of End A & its Loci',
    2: 'Draw True Length in FV (Angle theta) & Elevation Height',
    3: 'Draw True Length in TV (Angle phi) & Plan Depth',
    4: 'Locus Method: Rotate Plan/Elevation Lengths',
    5: 'Final Projections of Line AB',
    6: 'Locate Horizontal and Vertical Traces',
};

const LINE_PARALLEL_DESCRIPTIONS: { [key: number]: string } = {
    0: 'Draw XY Line',
    1: 'Project Endpoints A and B',
    2: 'Draw Equal-Length Front and Top Views',
    3: 'Determine Traces (at Infinity for Parallel Planes)',
};

const LINE_INCLINED_HP_DESCRIPTIONS: { [key: number]: string } = {
    0: 'Draw XY Line',
    1: 'Draw True Length in Front View at the HP Inclination',
    2: 'Project the Corresponding Top View',
    3: 'Darken the Final Front and Top Views',
    4: 'Locate HT; VT is at Infinity',
};

const LINE_INCLINED_VP_DESCRIPTIONS: { [key: number]: string } = {
    0: 'Draw XY Line',
    1: 'Draw True Length in Top View at the VP Inclination',
    2: 'Project the Corresponding Front View',
    3: 'Darken the Final Front and Top Views',
    4: 'Locate VT; HT is at Infinity',
};

const POINT_DESCRIPTIONS: { [key: number]: string } = {
    0: 'Draw XY Line',
    1: 'Plot Point Projections (Front & Top View)',
    2: 'Draw Vertical Projector & Dimensions',
};

const PLANE_SURFACE_DESCRIPTIONS: { [key: number]: string } = {
    0: 'Draw XY Reference Line',
    1: 'Draw the Lamina in its True-Shape Setup',
    2: 'Project the Final Front and Top Views',
    3: 'Extend the Plane to Locate H.T. and V.T.',
    4: 'Construct the Requested Side View using X₁Y₁',
};

const PERSPECTIVE_DESCRIPTIONS: { [key: number]: string } = {
    0: 'Draw the Reference Framework',
    1: 'Place PP, the Object Plan, Central Plane, and Station Point',
    2: 'Draw Visual Rays and Locate Piercing Points on PP',
    3: 'Project from PP and Complete the Perspective below the Horizon Line',
    4: 'Locate Vanishing Points and Verify Receding Edges',
};

const ISOMETRIC_DESCRIPTIONS: { [key: number]: string } = {
    0: 'Draw the Source Orthographic Views at Actual Scale',
    1: 'Step I: Draw the Isometric Axes, Scale, and Overall Construction Box',
    2: 'Step II: Transfer Feature Points and Build the Construction Grid',
    3: 'Step III: Construct Curves and Complete the Object Lightly',
    4: 'Step IV: Darken Final Edges and Add Dimensions',
};

const ADVANCED_DEVELOPMENT_DESCRIPTIONS: { [key: number]: string } = {
    0: 'Prepare the Development Construction',
    1: 'Draw the Given Solid, End Profiles, or Reference Sphere',
    2: 'Transfer True Lengths by Parallel, Radial, Approximate, or Triangulation Method',
    3: 'Complete the Developed Profile, Seams, and Dimensions',
};

const ADVANCED_SECTION_DESCRIPTIONS: { [key: number]: string } = {
    0: 'Prepare the Inclined-Solid Section Construction',
    1: 'Construct the Oriented Solid in Front and Top Views',
    2: 'Intersect the Cutting Plane with Actual Edges or Generators',
    3: 'Project the Section onto an Auxiliary Plane for its True Shape',
    4: 'Transfer Generator Distances to the Lateral Development',
};

const SECTION_DESCRIPTIONS: { [key: number]: string } = {
    0: 'Draw XY Line',
    1: 'Stage 0: Base Solid (Normal Projections)',
    2: 'Stage 1: Cutting Plane Definition',
    3: 'Stage 2: True Intersection Computation',
    4: 'Stage 3: Sectional Top View',
    5: 'Stage 4: True Shape of Section',
    6: 'Stage 5: Development of Surfaces',
};

const SECTION_VP_DESCRIPTIONS: { [key: number]: string } = {
    0: 'Draw XY Line',
    1: 'Draw the Solid in its Simple Position on VP',
    2: 'Draw the Cutting Plane in Top View',
    3: 'Locate and Project the Section Points',
    4: 'Draw the Sectional Front View',
    5: 'Construct the True Shape of Section',
    6: 'Develop the Lateral Surface',
};

const LONGITUDINAL_SECTION_DESCRIPTIONS: { [key: number]: string } = {
    0: 'Draw XY Line',
    1: 'Draw the Solid in its Simple Position',
    2: 'Draw the Vertical Cutting Plane in Top View',
    3: 'Locate and Project the Section Points',
    4: 'Draw the Sectional Front View',
    5: 'Construct the True Shape in the Cutting Plane',
};

const LONGITUDINAL_SECTION_VP_DESCRIPTIONS: { [key: number]: string } = {
    0: 'Draw XY Line',
    1: 'Draw the Solid in its Simple Position on VP',
    2: 'Draw the Cutting Plane in Front View',
    3: 'Locate and Project the Section Points',
    4: 'Draw the Sectional Top View',
    5: 'Construct the True Shape in the Cutting Plane',
};

export const TeachingControls: React.FC<TeachingControlsProps> = ({ currentSequence, totalSteps, onSequenceChange, problemType, geometry }) => {
    const describeBaseOrientation = () => {
        const params = geometry.params;
        if (!params || !('base_orientation' in params) || !params.base_orientation) return '';
        const orientation = params.base_orientation;
        const feature = orientation.feature.replaceAll('_', ' ');
        const relation = orientation.relation === 'inclined'
            ? `inclined ${orientation.angle_deg}° to`
            : `${orientation.relation} to`;
        return `${feature} ${relation} ${orientation.reference_plane}`;
    };

    const describeRestingContact = () => {
        const params = geometry.params;
        if (!params || !('type' in params) || params.type !== 'solid') return '';
        const contact = params.resting_element || (params.resting_face ? 'lateral_face' : undefined);
        return contact ? contact.replaceAll('_', ' ') : '';
    };

    const describeBasePlaneTilt = () => {
        const params = geometry.params;
        if (!params || !('type' in params) || params.type !== 'solid' || params.base_inclination_deg === undefined) return '';
        return `base is ${params.base_inclination_deg}° to ${params.resting_on}`;
    };

    const describeLineContext = () => {
        const params = geometry.params;
        if (!params || !('type' in params) || !params.type.startsWith('line')) return '';
        const details: string[] = [];
        if ('end_A' in params) {
            if ('side_of_HP' in params.end_A && params.end_A.side_of_HP) details.push(`A ${params.end_A.side_of_HP} HP`);
            if ('side_of_VP' in params.end_A && params.end_A.side_of_VP) {
                details.push(`A ${params.end_A.side_of_VP === 'in_front' ? 'in front of' : 'behind'} VP`);
            }
        } else if ('end_A_side' in params && params.end_A_side) {
            details.push(`A ${params.end_A_side.replace('_', ' ')}`);
        }
        if ('direction' in params && params.direction) {
            const movement = [params.direction.x, params.direction.hp, params.direction.vp].filter(Boolean).join('/');
            if (movement) details.push(`B extends ${movement}`);
        }
        return details.join('; ');
    };

    const withLineContext = (descriptions: { [key: number]: string }) => {
        const context = describeLineContext();
        return context ? { ...descriptions, 1: `${descriptions[1]}; ${context}` } : descriptions;
    };

    const getDescriptions = () => {
        if (problemType === 'auxiliary_view') return AUXILIARY_ELEVATION_DESCRIPTIONS;
        if (problemType === 'solid') {
            const hasSideView = geometry.constructionPrimitives.some((primitive) => primitive.key.includes('sv-x1y1'));
            if (hasSideView) {
                const descriptions: { [key: number]: string } = {
                    0: 'Draw XY & X1Y1 Reference Lines',
                    1: 'Front View',
                    2: 'Top View',
                    3: 'Side View',
                };

                if (totalSteps > 4) {
                    descriptions[totalSteps - 1] = 'Dimensioning';
                }

                return descriptions;
            }

            const orientationDescription = describeBaseOrientation();
            const contactDescription = describeRestingContact();
            const basePlaneTilt = describeBasePlaneTilt();
            const params = geometry.params;
            if (params && 'resting_on' in params && params.resting_on === 'VP') {
                return {
                    ...SOLID_VP_DESCRIPTIONS,
                    1: contactDescription
                        ? `Stage 1: Show the ${contactDescription} in the required edge/true-length position`
                        : orientationDescription
                        ? `Stage 1: Base on VP; ${orientationDescription}`
                        : SOLID_VP_DESCRIPTIONS[1],
                    2: contactDescription
                        ? basePlaneTilt
                            ? `Stage 2: Tilt about the ${contactDescription} until the ${basePlaneTilt}`
                            : `Stage 2: Tilt until the ${contactDescription} rests on VP`
                        : SOLID_VP_DESCRIPTIONS[2],
                };
            }

            return {
                ...SOLID_DESCRIPTIONS,
                1: contactDescription
                    ? `Stage 1: Show the ${contactDescription} in the required edge/true-length position`
                    : orientationDescription
                    ? `Stage 1: Base on HP; ${orientationDescription}`
                    : SOLID_DESCRIPTIONS[1],
                2: contactDescription
                    ? basePlaneTilt
                        ? `Stage 2: Tilt about the ${contactDescription} until the ${basePlaneTilt}`
                        : `Stage 2: Tilt until the ${contactDescription} rests on HP`
                    : SOLID_DESCRIPTIONS[2],
            };
        }

        if (!problemType) return SOLID_DESCRIPTIONS;
        if (problemType === 'section_solid') {
            const params = geometry.params;
            const orientationDescription = describeBaseOrientation();
            const isLongitudinal = params && 'cutting_plane' in params && 'resting_on' in params
                && params.resting_on === params.cutting_plane.perpendicular_to;
            const descriptions = isLongitudinal
                ? (params && 'resting_on' in params && params.resting_on === 'VP'
                    ? { ...LONGITUDINAL_SECTION_VP_DESCRIPTIONS }
                    : { ...LONGITUDINAL_SECTION_DESCRIPTIONS })
                : (params && 'resting_on' in params && params.resting_on === 'VP'
                    ? { ...SECTION_VP_DESCRIPTIONS }
                    : { ...SECTION_DESCRIPTIONS });
            if (orientationDescription) {
                descriptions[1] = `${descriptions[1]}; ${orientationDescription}`;
            }
            return descriptions;
        }
        if (problemType === 'line_parallel') return withLineContext(LINE_PARALLEL_DESCRIPTIONS);
        if (problemType === 'line_inclined_HP') return withLineContext(LINE_INCLINED_HP_DESCRIPTIONS);
        if (problemType === 'line_inclined_VP') return withLineContext(LINE_INCLINED_VP_DESCRIPTIONS);
        if (problemType === 'line_coplanar') {
            const params = geometry.params;
            return withLineContext(params && 'plane' in params && params.plane === 'HP'
                ? LINE_INCLINED_VP_DESCRIPTIONS
                : LINE_INCLINED_HP_DESCRIPTIONS);
        }
        if (problemType.startsWith('line')) return withLineContext(LINE_DESCRIPTIONS);
        if (problemType.startsWith('point')) return POINT_DESCRIPTIONS;
        if (problemType === 'plane_surface') return PLANE_SURFACE_DESCRIPTIONS;
        if (problemType === 'perspective_projection') return PERSPECTIVE_DESCRIPTIONS;
        if (problemType === 'isometric_projection') return ISOMETRIC_DESCRIPTIONS;
        if (problemType === 'advanced_development') return ADVANCED_DEVELOPMENT_DESCRIPTIONS;
        if (problemType === 'advanced_section') return ADVANCED_SECTION_DESCRIPTIONS;
        return SOLID_DESCRIPTIONS;
    };

    const descriptions = getDescriptions();
    const availableSteps = [...new Set(geometry.constructionPrimitives.map((primitive) => primitive.step || 0))].sort((a, b) => a - b);
    const stageSequenceStarts = new Map(availableSteps.map((step) => [step,
        geometry.constructionPrimitives
            .filter((primitive) => primitive.step === step)
            .reduce((minSequence, primitive) => Math.min(minSequence, primitive.sequence ?? Number.POSITIVE_INFINITY), Number.POSITIVE_INFINITY),
    ]));
    const stageSequenceEnds = new Map(availableSteps.map((step) => [step,
        geometry.constructionPrimitives
            .filter((primitive) => primitive.step === step)
            .reduce((maxSequence, primitive) => Math.max(maxSequence, primitive.sequence || 0), 0),
    ]));

    return (
        <div style={styles.container}>
            <div style={styles.stepList}>
                {availableSteps.map((step, displayIndex) => (
                    (() => {
                        const stageStart = stageSequenceStarts.get(step) ?? 0;
                        const stageEnd = stageSequenceEnds.get(step) ?? 0;
                        const startSequence = Number.isFinite(stageStart) ? stageStart : stageEnd;
                        const isStageReached = currentSequence >= startSequence;
                        const isStageActive = currentSequence >= startSequence && currentSequence <= stageEnd;
                        const stagePrimitives = geometry.constructionPrimitives.filter((primitive) => primitive.step === step);
                        const isDimensionStage = stagePrimitives.length > 0 && stagePrimitives.every((primitive) => primitive.primitiveRole === 'dimension');

                        return (
                    <button
                        key={step}
                        type="button"
                        onClick={() => {
                            onSequenceChange(stageEnd);
                        }}
                        style={{
                            ...styles.stepItem,
                            ...((isStageReached || isStageActive) ? styles.stepItemActive : {}),
                        }}
                    >
                        <div
                            style={{
                                ...styles.stepNumber,
                                ...((isStageReached || isStageActive) ? styles.stepNumberActive : {}),
                            }}
                        >
                            {displayIndex}
                        </div>
                        <div style={styles.stepDescription}>
                            {isDimensionStage ? 'Dimensioning' : (descriptions[step] || `Step ${displayIndex}`)}
                        </div>
                    </button>
                        );
                    })()
                ))}
            </div>
        </div>
    );
};

const styles: { [key: string]: React.CSSProperties } = {
    container: {
        padding: 0,
        backgroundColor: 'transparent',
        border: 'none',
    },
    stepList: {
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
    },
    stepItem: {
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '10px',
        border: '2px solid var(--color-border-muted)',
        backgroundColor: '#ffffff',
        cursor: 'pointer',
        textAlign: 'left',
        color: 'var(--color-text)',
    },
    stepItemActive: {
        borderColor: 'var(--color-primary)',
        backgroundColor: 'var(--color-primary-soft)',
    },
    stepNumber: {
        width: '28px',
        height: '28px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: '2px solid var(--color-border-muted)',
        backgroundColor: '#ffffff',
        color: 'var(--color-text)',
        flexShrink: 0,
    },
    stepNumberActive: {
        borderColor: 'var(--color-primary)',
        backgroundColor: 'var(--color-primary)',
        color: '#ffffff',
    },
    stepDescription: {
        lineHeight: 1.3,
        fontSize: '12px',
    },
};
