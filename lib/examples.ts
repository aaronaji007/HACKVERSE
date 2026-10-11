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
    {
        title: 'Vertical Rectangular Lamina',
        query: 'A rectangular lamina 30mm by 40mm is perpendicular to HP and inclined at 42 degrees to VP. Draw its projections and traces.',
        parsed: {
            type: 'plane_surface', shape: 'rectangle', size_mm: { length_mm: 40, breadth_mm: 30 },
            orientation: { inclination_with_HP_deg: 90, inclination_with_VP_deg: 42 },
            required_outputs: { front_view: true, top_view: true, traces: true },
        },
    },
    {
        title: 'Inclined Circular Lamina',
        query: 'A circular plate of diameter 48mm is perpendicular to HP and inclined 40 degrees to VP. Its centre is 33mm above HP and 25mm in front of VP. Draw its projections and traces.',
        parsed: {
            type: 'plane_surface', shape: 'circle', size_mm: { diameter_mm: 48 },
            center: { distance_from_HP_mm: 33, distance_from_VP_mm: 25 },
            orientation: { inclination_with_HP_deg: 90, inclination_with_VP_deg: 40 },
            required_outputs: { front_view: true, top_view: true, traces: true },
        },
    },
    {
        title: 'Lamina Resting on an Edge',
        query: 'A rectangular lamina 50mm by 40mm with a central 30mm circular hole rests on a shorter edge on HP, perpendicular to VP. Its surface is inclined at 35 degrees to HP. Draw top, front and left side views.',
        parsed: {
            type: 'plane_surface', shape: 'rectangle', size_mm: { length_mm: 50, breadth_mm: 40 },
            orientation: {
                inclination_with_HP_deg: 35,
                reference_feature: { feature: 'shorter_side', contact_plane: 'HP', angle_to_other_plane_deg: 90 },
            },
            opening: { shape: 'circle', diameter_mm: 30 },
            required_outputs: { front_view: true, top_view: true, left_side_view: true },
        },
    },
    {
        title: 'Oblique Hexagonal Lamina',
        query: 'A hexagonal lamina of side 25mm makes 60 degrees with HP and 30 degrees with VP. Draw its front, top and left side views.',
        parsed: {
            type: 'plane_surface', shape: 'hexagon', size_mm: { side_mm: 25 },
            orientation: { inclination_with_HP_deg: 60, inclination_with_VP_deg: 30 },
            required_outputs: { front_view: true, top_view: true, left_side_view: true },
        },
    },
    {
        title: 'Simple Solid',
        query: 'A square pyramid, base 40mm side and axis 60mm long, has its base on the HP with one side of the base perpendicular to VP.',
        parsed: {
            type: 'solid',
            solid_type: 'pyramid',
            base_shape: 'square',
            base_size_mm: { side_mm: 40 },
            height_mm: 60,
            resting_on: 'HP',
            base_orientation: {
                feature: 'side',
                relation: 'perpendicular',
                reference_plane: 'VP',
            },
        },
    },
    {
        title: 'Inclined Solid (Both)',
        query: 'A square prism, base 40mm side and axis 60mm long, has its base on the HP. The axis is inclined at 45 degrees to HP and 30 degrees to VP.',
        parsed: {
            type: 'solid',
            solid_type: 'prism',
            base_shape: 'square',
            base_size_mm: { side_mm: 40 },
            height_mm: 60,
            resting_on: 'HP',
            inclined_to: 'HP_VP',
            inclination_with_HP_deg: 45,
            inclination_with_VP_deg: 30,
        },
    },
    {
        title: 'Solid on Face',
        query: 'A square pyramid of 40mm base side and 60mm height is resting on HP on one of its triangular faces. The axis is parallel to VP.',
        parsed: {
            type: 'solid',
            solid_type: 'pyramid',
            base_shape: 'square',
            base_size_mm: { side_mm: 40 },
            height_mm: 60,
            resting_face: 'triangular',
            resting_on: 'HP',
            initial_axis_parallel_to: 'VP',
        },
    },
    {
        title: 'Solid on Base Edge',
        query: 'A square prism of base side 40mm and axis 60mm rests on one base edge on HP. Its axis is inclined at 30 degrees to HP.',
        parsed: {
            type: 'solid',
            solid_type: 'prism',
            base_shape: 'square',
            base_size_mm: { side_mm: 40 },
            height_mm: 60,
            resting_on: 'HP',
            resting_element: 'base_edge',
            inclined_to: 'HP',
            inclination_deg: 30,
        },
    },
    {
        title: 'Pyramid on Slant Edge',
        query: 'A square pyramid of base side 40mm and axis 60mm rests on one of its slant edges on HP.',
        parsed: {
            type: 'solid',
            solid_type: 'pyramid',
            base_shape: 'square',
            base_size_mm: { side_mm: 40 },
            height_mm: 60,
            resting_on: 'HP',
            resting_element: 'slant_edge',
        },
    },
    {
        title: 'Cone on Generator (VP)',
        query: 'A cone of base diameter 50mm and axis 65mm rests on one of its generators on VP.',
        parsed: {
            type: 'solid',
            solid_type: 'cone',
            base_shape: 'circle',
            base_size_mm: { diameter_mm: 50 },
            height_mm: 65,
            resting_on: 'VP',
            resting_element: 'generator',
        },
    },
    {
        title: 'Base Plane Inclined to HP',
        query: 'A square pyramid of base side 30mm and height 65mm rests with one base edge on HP so that its base makes 30 degrees to HP.',
        parsed: {
            type: 'solid',
            solid_type: 'pyramid',
            base_shape: 'square',
            base_size_mm: { side_mm: 30 },
            height_mm: 65,
            resting_on: 'HP',
            resting_element: 'base_edge',
            base_inclination_deg: 30,
        },
    },
    {
        title: 'Base Corner and Base Angle',
        query: 'A hexagonal prism of base side 25mm and axis 50mm rests on one base corner on HP. Its base makes 60 degrees to HP and its axis is parallel to VP.',
        parsed: {
            type: 'solid',
            solid_type: 'prism',
            base_shape: 'hexagon',
            base_size_mm: { side_mm: 25 },
            height_mm: 50,
            resting_on: 'HP',
            resting_element: 'base_corner',
            base_inclination_deg: 60,
            initial_axis_parallel_to: 'VP',
        },
    },
    {
        title: 'Prism on a Longer Edge',
        query: 'A pentagonal prism of base side 30mm and axis 65mm lies on one longer edge on HP, with its axis making 60 degrees with VP.',
        parsed: {
            type: 'solid',
            solid_type: 'prism',
            base_shape: 'pentagon',
            base_size_mm: { side_mm: 30 },
            height_mm: 65,
            resting_on: 'HP',
            resting_element: 'lateral_edge',
            inclined_to: 'VP',
            inclination_deg: 60,
        },
    },
    {
        title: 'Section of Solid',
        query: 'A pentagonal prism of base side 30mm and axis length 60mm is resting on HP on its base. It is cut by a plane inclined at 45 degrees to HP and perpendicular to VP, bisecting the axis. Draw its front view, sectional top view, and true shape of the section.',
        parsed: {
            type: 'section_solid',
            solid_type: 'prism',
            base_shape: 'pentagon',
            base_size_mm: { side_mm: 30 },
            axis_length_mm: 60,
            resting_on: 'HP',
            base_orientation: {
                feature: 'side',
                relation: 'parallel',
                reference_plane: 'VP',
            },
            cutting_plane: {
                inclination_with_HP_deg: 45,
                perpendicular_to: 'VP',
                passes_through: 'axis_midpoint',
            },
            required_outputs: {
                front_view: true,
                sectional_top_view: true,
                true_shape: true,
            },
        },
    },
    {
        title: 'Longitudinal Section',
        query: 'A square prism of base side 40mm and axis 60mm rests on HP. A vertical cutting plane through its axis is inclined at 30 degrees to VP. Draw the sectional front view and true shape.',
        parsed: {
            type: 'section_solid',
            solid_type: 'prism',
            base_shape: 'square',
            base_size_mm: { side_mm: 40 },
            axis_length_mm: 60,
            resting_on: 'HP',
            base_orientation: {
                feature: 'side',
                relation: 'perpendicular',
                reference_plane: 'VP',
            },
            cutting_plane: {
                inclination_with_VP_deg: 30,
                perpendicular_to: 'HP',
                passes_through: 'axis',
            },
            required_outputs: {
                front_view: true,
                sectional_top_view: false,
                sectional_front_view: true,
                true_shape: true,
            },
        },
    },
    {
        title: 'Section Plane from a Base Corner',
        query: 'A pentagonal pyramid of base side 35mm and axis 60mm rests on HP with a base edge perpendicular to VP. A plane perpendicular to HP and parallel to VP cuts it 20mm from the base corner nearer the observer. Draw the top and sectional front views.',
        parsed: {
            type: 'section_solid',
            solid_type: 'pyramid',
            base_shape: 'pentagon',
            base_size_mm: { side_mm: 35 },
            axis_length_mm: 60,
            resting_on: 'HP',
            base_orientation: {
                feature: 'side',
                relation: 'perpendicular',
                reference_plane: 'VP',
            },
            cutting_plane: {
                inclination_with_VP_deg: 0,
                perpendicular_to: 'HP',
                passes_through: { distance_from_base_corner_mm: 20, corner: 'front' },
            },
            required_outputs: {
                front_view: true,
                sectional_top_view: false,
                sectional_front_view: true,
                true_shape: false,
            },
        },
    },
    {
        title: 'Development of Prism',
        query: 'A square prism of base side 40mm and axis length 60mm rests on its base on the HP. It is cut by a plane inclined at 45 degrees to the HP and perpendicular to the VP, bisecting the axis. Draw its front view, sectional top view, true shape of the section, and development of the lateral surface of the remaining solid.',
        parsed: {
            type: 'section_solid',
            solid_type: 'prism',
            base_shape: 'square',
            base_size_mm: { side_mm: 40 },
            axis_length_mm: 60,
            resting_on: 'HP',
            cutting_plane: {
                inclination_with_HP_deg: 45,
                perpendicular_to: 'VP',
                passes_through: 'axis_midpoint',
            },
            required_outputs: {
                front_view: true,
                sectional_top_view: true,
                true_shape: true,
            },
            draw_development: true,
        },
    },
    {
        title: 'Development of Pyramid',
        query: 'A hexagonal pyramid of base side 30mm and axis length 60mm is resting on its base on the HP. It is cut by a plane inclined at 45 degrees to the HP and perpendicular to the VP, passing through the midpoint of the axis. Draw the development of its lateral surface.',
        parsed: {
            type: 'section_solid',
            solid_type: 'pyramid',
            base_shape: 'hexagon',
            base_size_mm: { side_mm: 30 },
            axis_length_mm: 60,
            resting_on: 'HP',
            cutting_plane: {
                inclination_with_HP_deg: 45,
                perpendicular_to: 'VP',
                passes_through: 'axis_midpoint',
            },
            required_outputs: {
                front_view: true,
                sectional_top_view: true,
                true_shape: true,
            },
            draw_development: true,
        },
    },
    {
        title: 'Shortest Path Around a Prism',
        query: 'A thread is wound once around a hexagonal prism of base side 24mm and height 60mm, from a base corner to the opposite top corner. Determine its shortest length by development.',
        parsed: { type: 'advanced_development', problem: { family: 'shortest_path', surface: 'prism', base_shape: 'hexagon', base_size_mm: { side_mm: 24 }, height_mm: 60, start: { level: 'base', perimeter_fraction: 0 }, end: { level: 'top', perimeter_fraction: 0.5 }, turns: 1 } },
    },
    {
        title: 'Sphere by Zone Method',
        query: 'Develop a sphere of 50mm diameter by the zone method using 12 divisions.',
        parsed: { type: 'advanced_development', problem: { family: 'sphere', diameter_mm: 50, method: 'zone', divisions: 12 } },
    },
    {
        title: 'Sphere by Lune Method',
        query: 'Develop a sphere of 62mm diameter into 12 equal lunes by the gore method.',
        parsed: { type: 'advanced_development', problem: { family: 'sphere', diameter_mm: 62, method: 'lune', divisions: 12 } },
    },
    {
        title: 'Rectangle-to-Circle Transition',
        query: 'A rectangular duct 60mm by 45mm connects coaxially to a circular pipe 37.5mm diameter through a transition piece 60mm long. Develop it by triangulation.',
        parsed: { type: 'advanced_development', problem: { family: 'transition', bottom: { shape: 'rectangle', length_mm: 60, breadth_mm: 45 }, top: { shape: 'circle', diameter_mm: 37.5 }, height_mm: 60, divisions: 8 } },
    },
    {
        title: 'Cone from its Development',
        query: 'The development of a cone is a sector of radius 90mm and angle 120 degrees. Construct the cone and draw its projections.',
        parsed: { type: 'advanced_development', problem: { family: 'reverse_cone', sector_radius_mm: 90, sector_angle_deg: 120 } },
    },
    {
        title: 'Isometric Projection of a Hexagonal Prism',
        query: 'Draw the isometric projection of a regular hexagonal prism of base side 24mm and axis 56mm.',
        parsed: {
            type: 'isometric_projection', scale_mode: 'isometric_projection',
            object: { kind: 'solid', solid_type: 'prism', base_shape: 'hexagon', base_size_mm: { side_mm: 24 }, height_mm: 56 },
            show_construction_box: true,
        },
    },
    {
        title: 'Inclined Solid in Isometric',
        query: 'A right hexagonal prism of side 24mm and axis 56mm lies on a base corner with its axis inclined 30 degrees to HP and parallel to VP. Draw its isometric projection.',
        parsed: {
            type: 'isometric_projection', scale_mode: 'isometric_projection',
            object: { kind: 'solid', solid_type: 'prism', base_shape: 'hexagon', base_size_mm: { side_mm: 24 }, height_mm: 56, axis_orientation: { inclination_to_HP_deg: 30, plan_angle_deg: 0 } },
        },
    },
    {
        title: 'Isometric Frustum',
        query: 'Draw the isometric projection of a frustum of a pentagonal pyramid, base side 30mm, top side 18mm and height 40mm.',
        parsed: {
            type: 'isometric_projection', scale_mode: 'isometric_projection',
            object: { kind: 'solid', solid_type: 'frustum', base_shape: 'pentagon', base_size_mm: { side_mm: 30 }, top_base_size_mm: { side_mm: 18 }, height_mm: 40 },
        },
    },
    {
        title: 'Isometric View of a Coaxial Setup',
        query: 'A cube of 38mm side is placed centrally on a cylinder 75mm diameter and 45mm high. A square pyramid of base side 25mm and height 38mm rests centrally on the cube. Draw the isometric view.',
        parsed: {
            type: 'isometric_projection', scale_mode: 'isometric_view',
            object: { kind: 'composite', solids: [
                { solid_type: 'cylinder', base_shape: 'circle', base_size_mm: { diameter_mm: 75 }, height_mm: 45 },
                { solid_type: 'cube', base_shape: 'square', base_size_mm: { side_mm: 38 }, height_mm: 38, placed_centrally: true },
                { solid_type: 'pyramid', base_shape: 'square', base_size_mm: { side_mm: 25 }, height_mm: 38, placed_centrally: true },
            ] },
        },
    },
    {
        title: 'Isometric Block with Top Hole',
        query: 'Draw the isometric view of a 60 by 40 by 20mm base carrying a central 30 by 30 by 35mm block with a 12mm top hole.',
        parsed: {
            type: 'isometric_projection', scale_mode: 'isometric_view',
            object: { kind: 'block_model', primitives: [
                { primitive: 'box', origin_mm: { x: 0, y: 0, z: 0 }, size_mm: { x: 60, y: 40, z: 20 } },
                { primitive: 'box', origin_mm: { x: 15, y: 5, z: 20 }, size_mm: { x: 30, y: 30, z: 35 }, top_hole: { diameter_mm: 12 } },
            ] },
        },
    },
    {
        title: 'Perspective of a Horizontal Line',
        query: 'A horizontal line AB 80mm long is 25mm above GP, inclined 35 degrees to PP and 30mm behind PP. The station point is 90mm in front of PP and 65mm above GP. Draw its perspective by visual-ray method.',
        parsed: {
            type: 'perspective_projection', method: 'visual_ray',
            object: { kind: 'line', length_mm: 80, height_above_GP_mm: 25, angle_to_PP_deg: 35 },
            placement: { position_relative_to_PP: 'behind', nearest_distance_from_PP_mm: 30 },
            station_point: { distance_in_front_of_PP_mm: 90, height_above_GP_mm: 65 },
        },
    },
    {
        title: 'Perspective of a Circular Lamina',
        query: 'A circular lamina 50mm diameter lies on GP and touches PP. The station point is 80mm in front of PP, 60mm above GP and 20mm to the right of its centre. Draw the perspective.',
        parsed: {
            type: 'perspective_projection', method: 'visual_ray',
            object: { kind: 'lamina', shape: 'circle', size_mm: { diameter_mm: 50 }, orientation: 'horizontal' },
            placement: { position_relative_to_PP: 'touching', nearest_distance_from_PP_mm: 0 },
            station_point: { distance_in_front_of_PP_mm: 80, height_above_GP_mm: 60, lateral_offset_from_object_center_mm: 20 },
        },
    },
    {
        title: 'Two-Point Perspective of a Cube',
        query: 'A cube of 40mm side rests on GP with a vertical edge touching PP and its base edges equally inclined to PP. SP is 90mm in front of PP, 70mm above GP and 15mm right of the cube axis. Draw by vanishing-point method.',
        parsed: {
            type: 'perspective_projection', method: 'vanishing_point',
            object: { kind: 'solid', solid_type: 'cube', base_shape: 'square', base_size_mm: { side_mm: 40 }, height_mm: 40, base_edge_angle_to_PP_deg: 45 },
            placement: { position_relative_to_PP: 'touching', nearest_distance_from_PP_mm: 0 },
            station_point: { distance_in_front_of_PP_mm: 90, height_above_GP_mm: 70, lateral_offset_from_object_center_mm: 15 },
            required_outputs: { perspective_view: true, top_view_construction: true, vanishing_points: true },
        },
    },
    {
        title: 'Perspective of a Hexagonal Pyramid',
        query: 'A hexagonal pyramid of base side 25mm and height 60mm rests on GP, 20mm behind PP, with a base edge at 30 degrees to PP. SP is 100mm in front of PP and 75mm above GP. Draw its perspective using both methods.',
        parsed: {
            type: 'perspective_projection', method: 'both',
            object: { kind: 'solid', solid_type: 'pyramid', base_shape: 'hexagon', base_size_mm: { side_mm: 25 }, height_mm: 60, base_edge_angle_to_PP_deg: 30 },
            placement: { position_relative_to_PP: 'behind', nearest_distance_from_PP_mm: 20 },
            station_point: { distance_in_front_of_PP_mm: 100, height_above_GP_mm: 75 },
        },
    },
    {
        title: 'Three-Solid Central Stack',
        query: 'A square prism 40mm side and 20mm high is placed centrally on a cylinder 65mm diameter and 25mm high. A sphere of 40mm diameter is placed centrally on the prism. Draw the projections of the combination.',
        parsed: {
            type: 'composite_solid',
            resting_on: 'HP',
            solids: [
                { solid_type: 'cylinder', base_shape: 'circle', base_size_mm: { diameter_mm: 65 }, height_mm: 25 },
                { solid_type: 'prism', base_shape: 'square', base_size_mm: { side_mm: 40 }, height_mm: 20, placed_centrally: true },
                { solid_type: 'sphere', base_size_mm: { diameter_mm: 40 }, placed_centrally: true },
            ],
        },
    },
    {
        title: 'Rivet with Hemispherical Head',
        query: 'A hemispherical head of 60mm diameter is placed centrally with its flat face on a cylindrical shank of 40mm diameter and 60mm length. Draw the projections of the rivet.',
        parsed: {
            type: 'composite_solid',
            resting_on: 'HP',
            solids: [
                { solid_type: 'cylinder', base_shape: 'circle', base_size_mm: { diameter_mm: 40 }, height_mm: 60 },
                { solid_type: 'hemisphere', base_size_mm: { diameter_mm: 60 }, placed_centrally: true, hemisphere_orientation: 'flat_face_down' },
            ],
        },
    },
    {
        title: 'Stacked Frustums',
        query: 'A frustum of a cone with bottom and top diameters 50mm and 35mm and height 53mm rests centrally on a frustum of a square pyramid whose bottom and top sides are 70mm and 58mm and height is 22mm. Draw the projections of the combination.',
        parsed: {
            type: 'composite_solid',
            resting_on: 'HP',
            solids: [
                { solid_type: 'frustum', base_shape: 'square', base_size_mm: { side_mm: 70 }, top_base_size_mm: { side_mm: 58 }, height_mm: 22 },
                { solid_type: 'frustum', base_shape: 'circle', base_size_mm: { diameter_mm: 50 }, top_base_size_mm: { diameter_mm: 35 }, height_mm: 53, placed_centrally: true },
            ],
        },
    },
    {
        title: 'Solid on VP (Simple)',
        query: 'A square prism of base side 40mm and axis 60mm long has its base on the VP. Draw its front view and top view.',
        parsed: {
            type: 'solid',
            solid_type: 'prism',
            base_shape: 'square',
            base_size_mm: { side_mm: 40 },
            height_mm: 60,
            resting_on: 'VP',
        },
    },
    {
        title: 'Inclined Solid on VP',
        query: 'A hexagonal pyramid, base 25mm side and axis 50mm long, has its base on VP. The axis is inclined at 45 degrees to VP.',
        parsed: {
            type: 'solid',
            solid_type: 'pyramid',
            base_shape: 'hexagon',
            base_size_mm: { side_mm: 25 },
            height_mm: 50,
            resting_on: 'VP',
            inclined_to: 'VP',
            inclination_deg: 45,
        },
    },
    ];
