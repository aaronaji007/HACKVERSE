import { EngineeringProblem } from '../types';

export interface ExampleDefinition {
    title: string;
    query: string;
    parsed: EngineeringProblem;
}

export const EXAMPLES: ExampleDefinition[] = [
    {
        title: 'Point',
        query: 'A point P is in the first quadrant, 20mm from HP and 30mm from VP.',
        parsed: {
            type: 'point',
            name: 'P',
            position: {
                plane: 'FIRST_QUADRANT',
                distance_from_HP_mm: 20,
                distance_from_VP_mm: 30,
            },
        },
    },
    {
        title: 'Line Inclined Both',
        query: 'A line AB, 90mm long, is inclined at 30 degrees to the HP and 45 degrees to the VP. Its end A is 20mm above the HP and 25mm in front of the VP.',
        parsed: {
            type: 'line_inclined_both',
            length_mm: 90,
            inclination_with_HP_deg: 30,
            inclination_with_VP_deg: 45,
            end_A: {
                distance_from_HP_mm: 20,
                distance_from_VP_mm: 25,
            },
        },
    },
    {
        title: 'Line Traces',
        query: 'A line AB, 100mm long, is inclined at 30 degrees to HP and 45 degrees to VP. End A is 20mm above HP and 15mm in front of VP. From A, the line extends downward and behind VP. Draw its projections, HT and VT.',
        parsed: {
            type: 'line_inclined_both',
            length_mm: 100,
            inclination_with_HP_deg: 30,
            inclination_with_VP_deg: 45,
            end_A: {
                distance_from_HP_mm: 20,
                distance_from_VP_mm: 15,
                side_of_HP: 'above',
                side_of_VP: 'in_front',
            },
            direction: {
                hp: 'down',
                vp: 'back',
            },
            show_traces: true,
        },
    },
    ];
