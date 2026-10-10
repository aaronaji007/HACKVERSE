import { z } from 'zod';

// Schemas for data extracted by the AI
export interface PointSchema {
  type: "point";
  name: string;
  position: {
    plane: "HP" | "VP" | "FIRST_QUADRANT" | "SECOND_QUADRANT" | "THIRD_QUADRANT" | "FOURTH_QUADRANT";
    distance_from_HP_mm: number;
    distance_from_VP_mm: number;
  };
}

export interface PointSpecialSchema {
  type: "point_special";
  name: string;
  position: "ON_HP" | "ON_VP" | "ON_XY";
  distance_mm: number; // from VP if on HP, from HP if on VP
}

export interface LineDirectionConstraint {
  x?: "right" | "left";
  hp?: "up" | "down";
  vp?: "front" | "back";
}

export interface LineTeachingOptions {
  direction?: LineDirectionConstraint;
  show_traces?: boolean;
}

export interface LineParallelSchema extends LineTeachingOptions {
  type: "line_parallel";
  length_mm: number;
  end_A: {
    distance_from_HP_mm: number;
    distance_from_VP_mm: number;
    side_of_HP?: "above" | "below";
    side_of_VP?: "in_front" | "behind";
  };
}

export interface LineInclinedHPSchema extends LineTeachingOptions {
  type: "line_inclined_HP";
  length_mm: number;
  inclination_deg: number;
  end_A: {
    distance_from_HP_mm: number;
    distance_from_VP_mm: number;
    side_of_HP?: "above" | "below";
    side_of_VP?: "in_front" | "behind";
  };
}

export interface LineInclinedVPSchema extends LineTeachingOptions {
  type: "line_inclined_VP";
  length_mm: number;
  inclination_deg: number;
  end_A: {
    distance_from_HP_mm: number;
    distance_from_VP_mm: number;
    side_of_HP?: "above" | "below";
    side_of_VP?: "in_front" | "behind";
  };
}

export interface LineInclinedBothSchema extends LineTeachingOptions {
  type: "line_inclined_both";
  length_mm: number;
  inclination_with_HP_deg: number;
  inclination_with_VP_deg: number;
  end_A: {
    distance_from_HP_mm: number;
    distance_from_VP_mm: number;
    side_of_HP?: "above" | "below";
    side_of_VP?: "in_front" | "behind";
  };
}

export interface LineOneEndHPSchema extends LineTeachingOptions {
    type: "line_one_end_HP";
    length_mm: number;
    inclination_with_HP_deg: number;
    inclination_with_VP_deg: number;
    end_A: {
        on: "HP";
        distance_from_VP_mm: number;
        side_of_VP?: "in_front" | "behind";
    };
}

export interface LineOneEndVPSchema extends LineTeachingOptions {
    type: "line_one_end_VP";
    length_mm: number;
    inclination_with_HP_deg: number;
    inclination_with_VP_deg: number;
    end_A: {
        on: "VP";
        distance_from_HP_mm: number;
        side_of_HP?: "above" | "below";
    };
}

export interface LineCoplanarSchema extends LineTeachingOptions {
    type: "line_coplanar";
    plane: "HP" | "VP";
    length_mm: number;
    inclination_deg: number; // with VP if in HP, with HP if in VP
    end_A_distance_mm: number;
    end_A_side?: "above" | "below" | "in_front" | "behind";
}

export interface LineTouchingXYSchema extends LineTeachingOptions {
    type: "line_touching_XY";
    length_mm: number;
    inclination_with_HP_deg: number;
    inclination_with_VP_deg: number;
}

export interface BaseOrientationConstraint {
    feature: "side" | "longer_side" | "shorter_side" | "diagonal" | "corner_to_center" | "body_diagonal";
    relation: "parallel" | "perpendicular" | "inclined";
    reference_plane: "HP" | "VP";
    angle_deg?: number;
    direction?: "clockwise" | "counterclockwise";
}

export interface SolidSchema {
    type: "solid";
    solid_type: "prism" | "pyramid" | "cylinder" | "cone" | "cube" | "sphere";
    base_shape: "circle" | "triangle" | "square" | "rectangle" | "pentagon" | "hexagon";
    base_size_mm: {
        side_mm?: number;
        length_mm?: number;
        breadth_mm?: number;
        diameter_mm?: number;
    };
    height_mm: number;
    resting_on: "HP" | "VP";
    base_orientation?: BaseOrientationConstraint;

    // Inclination properties for base-resting or contact-resting solids
    inclined_to?: "HP" | "VP" | "HP_VP";
    inclination_deg?: number; // For single inclination to HP or VP
    base_inclination_deg?: number; // Angle made by the base plane with resting_on
    slant_edge_inclination_deg?: number; // Angle made by the slant edge containing the resting element with resting_on
    tilt_direction?: "clockwise" | "counterclockwise";

    // For base-resting solids inclined to both HP & VP
    inclination_with_HP_deg?: number;
    inclination_with_VP_deg?: number;

    // Properties specific to contact-resting solids. resting_face is retained
    // for compatibility with older saved problems.
    resting_face?: "triangular" | "rectangular";
    resting_element?: "base_edge" | "base_corner" | "lateral_edge" | "slant_edge" | "generator" | "base_circle_point" | "lateral_face";
    initial_axis_parallel_to?: "HP" | "VP";
}


export interface SectionSolidSchema {
    type: "section_solid";
    solid_type: "prism" | "pyramid";
    base_shape: "triangle" | "square" | "pentagon" | "hexagon" | "circle";
    base_size_mm: {
        side_mm?: number;
        diameter_mm?: number;
    };
    axis_length_mm: number;
    resting_on: "HP" | "VP";
    base_orientation?: BaseOrientationConstraint;
    cutting_plane: {
        inclination_with_HP_deg?: number;
        inclination_with_VP_deg?: number;
        perpendicular_to: "VP" | "HP";
        passes_through:
            | "axis_midpoint"
            | "axis"
            | { distance_from_base_mm: number }
            | { distance_from_axis_mm: number; towards?: "front" | "behind" | "above" | "below" }
            | { distance_from_base_corner_mm: number; corner: "front" | "behind" | "above" | "below" };
        direction?: "clockwise" | "counterclockwise";
        retained_portion?: "below_cutting_plane" | "above_cutting_plane" | "front" | "behind" | "above" | "below";
    };
    required_outputs: {
        front_view: boolean;
        sectional_top_view: boolean;
        sectional_front_view?: boolean;
        true_shape: boolean;
    };
    draw_development?: boolean;
}

export interface PlaneSurfaceSchema {
    type: "plane_surface";
    shape: "triangle" | "square" | "rectangle" | "pentagon" | "hexagon" | "circle" | "set_square_30_60";
    size_mm: {
        side_mm?: number;
        length_mm?: number;
        breadth_mm?: number;
        diameter_mm?: number;
        hypotenuse_mm?: number;
    };
    center?: {
        distance_from_HP_mm?: number;
        distance_from_VP_mm?: number;
    };
    orientation: {
        inclination_with_HP_deg?: number;
        inclination_with_VP_deg?: number;
        reference_feature?: {
            feature: "side" | "longer_side" | "shorter_side" | "diagonal" | "corner_to_center" | "hypotenuse" | "body_diagonal";
            contact_plane?: "HP" | "VP" | "BOTH";
            angle_to_other_plane_deg?: number;
        };
        direction?: "clockwise" | "counterclockwise";
    };
    opening?: {
        shape: "circle" | "semicircle";
        diameter_mm?: number;
        radius_mm?: number;
    };
    required_outputs?: {
        front_view?: boolean;
        top_view?: boolean;
        left_side_view?: boolean;
        right_side_view?: boolean;
        traces?: boolean;
    };
}

export type ScenePrimitive =
    | {
        primitive: "box";
        operation?: "add" | "subtract";
        origin_mm: { x: number; y: number; z: number };
        size_mm: { x: number; y: number; z: number };
        top_hole?: { diameter_mm: number; center_x_mm?: number; center_y_mm?: number };
    }
    | {
        primitive: "wedge";
        operation?: "add";
        origin_mm: { x: number; y: number; z: number };
        size_mm: { x: number; y: number; z: number };
        slope_along: "x" | "y";
        high_at: "start" | "end";
    }
    | {
        primitive: "cylinder";
        operation?: "add" | "subtract";
        center_mm: { x: number; y: number; z: number };
        diameter_mm: number;
        length_mm: number;
        axis: "x" | "y" | "z";
        inner_diameter_mm?: number;
    }
    | {
        primitive: "slot";
        operation: "subtract";
        center_mm: { x: number; y: number; z: number };
        length_mm: number;
        width_mm: number;
        depth_mm: number;
        normal_axis: "x" | "y" | "z";
        long_axis: "x" | "y" | "z";
    };

export interface PerspectiveProjectionSchema {
    type: "perspective_projection";
    method: "visual_ray" | "vanishing_point" | "both";
    object:
        | {
            kind: "line";
            length_mm: number;
            height_above_GP_mm: number;
            angle_to_PP_deg: number;
            inclination_to_GP_deg?: number;
        }
        | {
            kind: "lamina";
            shape: "triangle" | "square" | "rectangle" | "pentagon" | "hexagon" | "circle";
            size_mm: {
                side_mm?: number;
                length_mm?: number;
                breadth_mm?: number;
                diameter_mm?: number;
            };
            orientation: "horizontal" | "vertical";
            angle_to_PP_deg?: number;
        }
        | {
            kind: "solid";
            solid_type: "cube" | "prism" | "pyramid" | "cylinder" | "cone";
            base_shape: "circle" | "triangle" | "square" | "rectangle" | "pentagon" | "hexagon";
            base_size_mm: {
                side_mm?: number;
                length_mm?: number;
                breadth_mm?: number;
                diameter_mm?: number;
            };
            height_mm: number;
            base_edge_angle_to_PP_deg?: number;
        }
        | {
            kind: "block_model";
            primitives: ScenePrimitive[];
            rotation_deg?: number;
        };
    placement: {
        position_relative_to_PP: "behind" | "in_front" | "touching";
        nearest_distance_from_PP_mm: number;
        ground_clearance_mm?: number;
    };
    station_point: {
        distance_in_front_of_PP_mm: number;
        height_above_GP_mm: number;
        lateral_offset_from_object_center_mm?: number;
    };
    required_outputs?: {
        perspective_view?: boolean;
        top_view_construction?: boolean;
        vanishing_points?: boolean;
    };
}

export interface IsometricProjectionSchema {
    type: "isometric_projection";
    scale_mode: "isometric_projection" | "isometric_view";
    object:
        | {
            kind: "lamina";
            shape: "triangle" | "square" | "rectangle" | "pentagon" | "hexagon" | "circle";
            size_mm: { side_mm?: number; length_mm?: number; breadth_mm?: number; diameter_mm?: number };
            plane: "horizontal" | "left_vertical" | "right_vertical";
        }
        | {
            kind: "solid";
            solid_type: "cube" | "prism" | "pyramid" | "cylinder" | "cone" | "sphere" | "hemisphere" | "frustum";
            base_shape: "circle" | "triangle" | "square" | "rectangle" | "pentagon" | "hexagon";
            base_size_mm: { side_mm?: number; length_mm?: number; breadth_mm?: number; diameter_mm?: number };
            top_base_size_mm?: { side_mm?: number; length_mm?: number; breadth_mm?: number; diameter_mm?: number };
            height_mm: number;
            base_edge_angle_deg?: number;
            axis_orientation?: { inclination_to_HP_deg: number; plan_angle_deg?: number };
            top_cut?: { height_at_center_mm: number; inclination_deg: number; direction_angle_deg?: number };
        }
        | {
            kind: "composite";
            solids: CompositeSolidMember[];
        }
        | {
            kind: "block_model";
            primitives: ScenePrimitive[];
            rotation_deg?: number;
        };
    show_construction_box?: boolean;
    /** Retain the source orthographic views beside the textbook box-method construction. */
    show_orthographic_views?: boolean;
}

export interface AdvancedDevelopmentSchema {
    type: "advanced_development";
    problem:
        | {
            family: "shortest_path";
            surface: "prism" | "cylinder";
            base_shape: "circle" | "triangle" | "square" | "rectangle" | "pentagon" | "hexagon";
            base_size_mm: { side_mm?: number; length_mm?: number; breadth_mm?: number; diameter_mm?: number };
            height_mm: number;
            start: { level: "base" | "top"; perimeter_fraction: number };
            end: { level: "base" | "top"; perimeter_fraction: number };
            turns?: number;
            return_path?: boolean;
        }
        | {
            family: "sphere";
            diameter_mm: number;
            method: "zone" | "lune";
            divisions?: number;
        }
        | {
            family: "transition";
            bottom: { shape: "circle" | "square" | "rectangle"; diameter_mm?: number; length_mm?: number; breadth_mm?: number; side_mm?: number };
            top: { shape: "circle" | "square" | "rectangle"; diameter_mm?: number; length_mm?: number; breadth_mm?: number; side_mm?: number };
            height_mm: number;
            offset_mm?: { x: number; y: number };
            divisions?: number;
        }
        | {
            family: "reverse_cone";
            sector_radius_mm: number;
            sector_angle_deg: number;
            vertex_height_above_HP_mm?: number;
        }
        | {
            family: "tray";
            bottom_length_mm: number;
            bottom_breadth_mm: number;
            top_length_mm: number;
            top_breadth_mm: number;
            height_mm: number;
        }
        | {
            family: "penetration";
            host: "prism" | "pyramid" | "cylinder" | "cone";
            base_shape: "circle" | "triangle" | "square" | "rectangle" | "pentagon" | "hexagon";
            base_size_mm: { side_mm?: number; length_mm?: number; breadth_mm?: number; diameter_mm?: number };
            height_mm: number;
            opening: {
                shape: "circle" | "square" | "slot";
                width_mm: number;
                length_mm?: number;
                center_height_mm: number;
                face_index?: number;
                through?: boolean;
            };
            divisions?: number;
        }
        | {
            family: "compound_half_solids";
            members: Array<{
                surface: "half_cone" | "half_prism" | "half_pyramid" | "half_cylinder";
                base_shape: "circle" | "triangle" | "square" | "rectangle" | "hexagon";
                base_size_mm: { side_mm?: number; length_mm?: number; breadth_mm?: number; diameter_mm?: number };
                height_mm: number;
            }>;
        };
}

export interface AdvancedSectionSchema {
    type: "advanced_section";
    solid: {
        solid_type: "prism" | "pyramid" | "cylinder" | "cone" | "tetrahedron";
        base_shape: "circle" | "triangle" | "square" | "rectangle" | "pentagon" | "hexagon";
        base_size_mm: { side_mm?: number; length_mm?: number; breadth_mm?: number; diameter_mm?: number };
        axis_length_mm: number;
    };
    orientation?: {
        axis_inclination_to_HP_deg?: number;
        axis_inclination_to_VP_deg?: number;
        plan_angle_deg?: number;
        resting_element?: "base_edge" | "base_corner" | "lateral_edge" | "slant_edge" | "generator" | "base_circle_point" | "lateral_face";
    };
    cutting_plane: {
        perpendicular_to: "HP" | "VP";
        inclination_deg?: number;
        distance_from_base_mm: number;
        direction?: "clockwise" | "counterclockwise";
    };
    inverse_section?: {
        true_shape: "triangle" | "polygon" | "ellipse" | "parabola" | "hyperbola";
        major_axis_mm?: number;
        minor_axis_mm?: number;
    };
    required_outputs?: { front_view?: boolean; top_view?: boolean; true_shape?: boolean; development?: boolean };
}

export interface CompositeSolidMember {
    solid_type: "prism" | "pyramid" | "cylinder" | "cone" | "cube" | "sphere" | "hemisphere" | "frustum";
    base_shape?: "circle" | "triangle" | "square" | "rectangle" | "pentagon" | "hexagon";
    base_size_mm: {
        side_mm?: number;
        diameter_mm?: number;
        length_mm?: number;
        breadth_mm?: number;
    };
    top_base_size_mm?: {
        side_mm?: number;
        diameter_mm?: number;
        length_mm?: number;
        breadth_mm?: number;
    };
    height_mm?: number; // Sphere/hemisphere height is derived from diameter.
    placed_centrally?: boolean;
    hemisphere_orientation?: "flat_face_up" | "flat_face_down";
}

export interface CompositeSolidSchema {
    type: "composite_solid";
    // Generic bottom-to-top stack. Legacy two-solid fields remain readable so
    // saved questions continue to work.
    solids?: CompositeSolidMember[];
    base_solid?: CompositeSolidMember & { resting_on: "HP" | "VP" };
    top_solid?: CompositeSolidMember;
    resting_on?: "HP" | "VP";
}

export interface AuxiliaryViewSchema {
    type: "auxiliary_view";
    view_type: "auxiliary_elevation" | "auxiliary_plan";
    inclination_deg: number;
    solid_type: "prism" | "pyramid" | "cylinder" | "cone" | "cube";
    base_shape: "circle" | "triangle" | "square" | "rectangle" | "pentagon" | "hexagon";
    base_size_mm: {
        side_mm?: number;
        length_mm?: number;
        breadth_mm?: number;
        diameter_mm?: number;
    };
    axis_length_mm: number;
    resting_on: "HP" | "VP";
    base_orientation?: {
        feature: "side" | "longer_side" | "shorter_side" | "diagonal" | "corner_to_center";
        relation: "parallel" | "perpendicular" | "inclined";
        reference_plane: "HP" | "VP";
        angle_deg?: number;
    };
}

export type EngineeringProblem =
  | AuxiliaryViewSchema
  | PointSchema
  | PointSpecialSchema
  | LineParallelSchema
  | LineInclinedHPSchema
  | LineInclinedVPSchema
  | LineInclinedBothSchema
  | LineOneEndHPSchema
  | LineOneEndVPSchema
  | LineCoplanarSchema
  | LineTouchingXYSchema
  | SolidSchema
  | SectionSolidSchema
  | PlaneSurfaceSchema
  | PerspectiveProjectionSchema
  | IsometricProjectionSchema
  | AdvancedDevelopmentSchema
  | AdvancedSectionSchema
  | CompositeSolidSchema
  | { error: string };

export const PointSchemaZ = z.object({
  type: z.literal("point"),
  name: z.string(),
  position: z.object({
    plane: z.enum(["HP", "VP", "FIRST_QUADRANT", "SECOND_QUADRANT", "THIRD_QUADRANT", "FOURTH_QUADRANT"]),
    distance_from_HP_mm: z.number().nonnegative(),
    distance_from_VP_mm: z.number().nonnegative(),
  }),
});

export const PointSpecialSchemaZ = z.object({
  type: z.literal("point_special"),
  name: z.string(),
  position: z.enum(["ON_HP", "ON_VP", "ON_XY"]),
  distance_mm: z.number(),
});

export const LineDirectionConstraintZ = z.object({
  x: z.enum(["right", "left"]).optional(),
  hp: z.enum(["up", "down"]).optional(),
  vp: z.enum(["front", "back"]).optional(),
});

const LineTeachingOptionsZ = {
  direction: z.preprocess(
    (val) => val === null || val === '' ? undefined : val,
    LineDirectionConstraintZ.optional(),
  ),
  show_traces: z.preprocess(
    (val) => val === null || val === '' ? undefined : val,
    z.boolean().optional(),
  ),
};

export const LineParallelSchemaZ = z.object({
  type: z.literal("line_parallel"),
  length_mm: z.number(),
  end_A: z.object({
    distance_from_HP_mm: z.number(),
    distance_from_VP_mm: z.number(),
    side_of_HP: z.enum(["above", "below"]).optional(),
    side_of_VP: z.enum(["in_front", "behind"]).optional(),
  }),
  ...LineTeachingOptionsZ,
});

export const LineInclinedHPSchemaZ = z.object({
  type: z.literal("line_inclined_HP"),
  length_mm: z.number(),
  inclination_deg: z.number(),
  end_A: z.object({
    distance_from_HP_mm: z.number(),
    distance_from_VP_mm: z.number(),
    side_of_HP: z.enum(["above", "below"]).optional(),
    side_of_VP: z.enum(["in_front", "behind"]).optional(),
  }),
  ...LineTeachingOptionsZ,
});

export const LineInclinedVPSchemaZ = z.object({
  type: z.literal("line_inclined_VP"),
  length_mm: z.number(),
  inclination_deg: z.number(),
  end_A: z.object({
    distance_from_HP_mm: z.number(),
    distance_from_VP_mm: z.number(),
    side_of_HP: z.enum(["above", "below"]).optional(),
    side_of_VP: z.enum(["in_front", "behind"]).optional(),
  }),
  ...LineTeachingOptionsZ,
});

export const LineInclinedBothSchemaZ = z.object({
  type: z.literal("line_inclined_both"),
  length_mm: z.number(),
  inclination_with_HP_deg: z.number(),
  inclination_with_VP_deg: z.number(),
  end_A: z.object({
    distance_from_HP_mm: z.number(),
    distance_from_VP_mm: z.number(),
    side_of_HP: z.enum(["above", "below"]).optional(),
    side_of_VP: z.enum(["in_front", "behind"]).optional(),
  }),
  ...LineTeachingOptionsZ,
});

export const LineOneEndHPSchemaZ = z.object({
    type: z.literal("line_one_end_HP"),
    length_mm: z.number(),
    inclination_with_HP_deg: z.number(),
    inclination_with_VP_deg: z.number(),
    end_A: z.object({
        on: z.literal("HP"),
        distance_from_VP_mm: z.number(),
        side_of_VP: z.enum(["in_front", "behind"]).optional(),
    }),
    ...LineTeachingOptionsZ,
});

export const LineOneEndVPSchemaZ = z.object({
    type: z.literal("line_one_end_VP"),
    length_mm: z.number(),
    inclination_with_HP_deg: z.number(),
    inclination_with_VP_deg: z.number(),
    end_A: z.object({
        on: z.literal("VP"),
        distance_from_HP_mm: z.number(),
        side_of_HP: z.enum(["above", "below"]).optional(),
    }),
    ...LineTeachingOptionsZ,
});

export const LineCoplanarSchemaZ = z.object({
    type: z.literal("line_coplanar"),
    plane: z.enum(["HP", "VP"]),
    length_mm: z.number(),
    inclination_deg: z.number(),
    end_A_distance_mm: z.number(),
    end_A_side: z.enum(["above", "below", "in_front", "behind"]).optional(),
    ...LineTeachingOptionsZ,
});

export const LineTouchingXYSchemaZ = z.object({
    type: z.literal("line_touching_XY"),
    length_mm: z.number(),
    inclination_with_HP_deg: z.number(),
    inclination_with_VP_deg: z.number(),
    ...LineTeachingOptionsZ,
});

export const BaseOrientationConstraintZ = z.object({
    feature: z.enum(["side", "longer_side", "shorter_side", "diagonal", "corner_to_center", "body_diagonal"]),
    relation: z.enum(["parallel", "perpendicular", "inclined"]),
    reference_plane: z.enum(["HP", "VP"]),
    angle_deg: z.preprocess(
      (val) => val === null || val === '' ? undefined : val,
      z.number().optional(),
    ),
    direction: z.preprocess(
      (val) => val === null || val === '' ? undefined : val,
      z.enum(["clockwise", "counterclockwise"]).optional(),
    ),
});

export const SolidSchemaZ = z.object({
    type: z.literal("solid"),
    solid_type: z.enum(["prism", "pyramid", "cylinder", "cone", "cube", "sphere"]),
    base_shape: z.enum(["circle", "triangle", "square", "rectangle", "pentagon", "hexagon"]),
    base_size_mm: z.object({
        side_mm: z.number().optional(),
        length_mm: z.number().optional(),
        breadth_mm: z.number().optional(),
        diameter_mm: z.number().optional(),
    }),
    height_mm: z.number(),
    resting_on: z.enum(["HP", "VP"]),
    base_orientation: z.preprocess(
      (val) => val === null || val === '' ? undefined : val,
      BaseOrientationConstraintZ.optional(),
    ),
    inclined_to: z.preprocess(
      (val) => {
        if (val === null || val === undefined || val === '') return undefined;
        if (!["HP", "VP", "HP_VP"].includes(val as string)) return undefined;
        return val;
      },
      z.enum(["HP", "VP", "HP_VP"]).optional()
    ),
    inclination_deg: z.preprocess(
      (val) => {
        if (val === null || val === undefined) return undefined;
        const num = Number(val);
        return isNaN(num) ? undefined : num;
      },
      z.number().optional()
    ),
    base_inclination_deg: z.preprocess(
      (val) => {
        if (val === null || val === undefined || val === '') return undefined;
        const num = Number(val);
        return isNaN(num) ? undefined : num;
      },
      z.number().optional()
    ),
    slant_edge_inclination_deg: z.preprocess(
      (val) => {
        if (val === null || val === undefined || val === '') return undefined;
        const num = Number(val);
        return isNaN(num) ? undefined : num;
      },
      z.number().optional()
    ),
    tilt_direction: z.preprocess(
      (val) => val === null || val === '' ? undefined : val,
      z.enum(["clockwise", "counterclockwise"]).optional(),
    ),
    inclination_with_HP_deg: z.preprocess(
      (val) => {
        if (val === null || val === undefined) return undefined;
        const num = Number(val);
        return isNaN(num) ? undefined : num;
      },
      z.number().optional()
    ),
    inclination_with_VP_deg: z.preprocess(
      (val) => {
        if (val === null || val === undefined) return undefined;
        const num = Number(val);
        return isNaN(num) ? undefined : num;
      },
      z.number().optional()
    ),
    resting_face: z.enum(["triangular", "rectangular"]).optional(),
    resting_element: z.enum(["base_edge", "base_corner", "lateral_edge", "slant_edge", "generator", "base_circle_point", "lateral_face"]).optional(),
    initial_axis_parallel_to: z.enum(["HP", "VP"]).optional(),
});

export const SectionSolidSchemaZ = z.object({
    type: z.literal("section_solid"),
    solid_type: z.enum(["prism", "pyramid"]),
    base_shape: z.enum(["triangle", "square", "pentagon", "hexagon", "circle"]),
    base_size_mm: z.object({
        side_mm: z.number().optional(),
        diameter_mm: z.number().optional(),
    }),
    axis_length_mm: z.number(),
    resting_on: z.enum(["HP", "VP"]),
    base_orientation: z.preprocess(
      (val) => val === null || val === '' ? undefined : val,
      BaseOrientationConstraintZ.optional(),
    ),
    cutting_plane: z.object({
        inclination_with_HP_deg: z.number().optional(),
        inclination_with_VP_deg: z.number().optional(),
        perpendicular_to: z.enum(["VP", "HP"]),
        passes_through: z.union([
            z.literal("axis_midpoint"),
            z.literal("axis"),
            z.object({ distance_from_base_mm: z.number() }),
            z.object({
                distance_from_axis_mm: z.number(),
                towards: z.enum(["front", "behind", "above", "below"]).optional(),
            }),
            z.object({
                distance_from_base_corner_mm: z.number(),
                corner: z.enum(["front", "behind", "above", "below"]),
            }),
        ]),
        direction: z.enum(["clockwise", "counterclockwise"]).optional(),
        retained_portion: z.enum(["below_cutting_plane", "above_cutting_plane", "front", "behind", "above", "below"]).optional(),
    }),
    required_outputs: z.object({
        front_view: z.boolean(),
        sectional_top_view: z.boolean(),
        sectional_front_view: z.boolean().optional(),
        true_shape: z.boolean(),
    }),
    draw_development: z.boolean().optional(),
});

export const PlaneSurfaceSchemaZ = z.object({
    type: z.literal("plane_surface"),
    shape: z.enum(["triangle", "square", "rectangle", "pentagon", "hexagon", "circle", "set_square_30_60"]),
    size_mm: z.object({
        side_mm: z.number().optional(),
        length_mm: z.number().optional(),
        breadth_mm: z.number().optional(),
        diameter_mm: z.number().optional(),
        hypotenuse_mm: z.number().optional(),
    }),
    center: z.object({
        distance_from_HP_mm: z.number().optional(),
        distance_from_VP_mm: z.number().optional(),
    }).optional(),
    orientation: z.object({
        inclination_with_HP_deg: z.number().optional(),
        inclination_with_VP_deg: z.number().optional(),
        reference_feature: z.object({
            feature: z.enum(["side", "longer_side", "shorter_side", "diagonal", "corner_to_center", "hypotenuse"]),
            contact_plane: z.enum(["HP", "VP", "BOTH"]).optional(),
            angle_to_other_plane_deg: z.number().optional(),
        }).optional(),
        direction: z.enum(["clockwise", "counterclockwise"]).optional(),
    }),
    opening: z.object({
        shape: z.enum(["circle", "semicircle"]),
        diameter_mm: z.number().optional(),
        radius_mm: z.number().optional(),
    }).optional(),
    required_outputs: z.object({
        front_view: z.boolean().optional(),
        top_view: z.boolean().optional(),
        left_side_view: z.boolean().optional(),
        right_side_view: z.boolean().optional(),
        traces: z.boolean().optional(),
    }).optional(),
});

const PerspectivePlanSizeSchemaZ = z.object({
    side_mm: z.number().optional(),
    length_mm: z.number().optional(),
    breadth_mm: z.number().optional(),
    diameter_mm: z.number().optional(),
});

const ScenePrimitiveSchemaZ = z.discriminatedUnion("primitive", [
    z.object({
        primitive: z.literal("box"),
        operation: z.enum(["add", "subtract"]).optional(),
        origin_mm: z.object({ x: z.number(), y: z.number(), z: z.number() }),
        size_mm: z.object({ x: z.number(), y: z.number(), z: z.number() }),
        top_hole: z.object({ diameter_mm: z.number(), center_x_mm: z.number().optional(), center_y_mm: z.number().optional() }).optional(),
    }),
    z.object({
        primitive: z.literal("wedge"),
        operation: z.literal("add").optional(),
        origin_mm: z.object({ x: z.number(), y: z.number(), z: z.number() }),
        size_mm: z.object({ x: z.number(), y: z.number(), z: z.number() }),
        slope_along: z.enum(["x", "y"]),
        high_at: z.enum(["start", "end"]),
    }),
    z.object({
        primitive: z.literal("cylinder"),
        operation: z.enum(["add", "subtract"]).optional(),
        center_mm: z.object({ x: z.number(), y: z.number(), z: z.number() }),
        diameter_mm: z.number(),
        length_mm: z.number(),
        axis: z.enum(["x", "y", "z"]),
        inner_diameter_mm: z.number().optional(),
    }),
    z.object({
        primitive: z.literal("slot"),
        operation: z.literal("subtract"),
        center_mm: z.object({ x: z.number(), y: z.number(), z: z.number() }),
        length_mm: z.number(),
        width_mm: z.number(),
        depth_mm: z.number(),
        normal_axis: z.enum(["x", "y", "z"]),
        long_axis: z.enum(["x", "y", "z"]),
    }),
]);

export const PerspectiveProjectionSchemaZ = z.object({
    type: z.literal("perspective_projection"),
    method: z.enum(["visual_ray", "vanishing_point", "both"]),
    object: z.discriminatedUnion("kind", [
        z.object({
            kind: z.literal("line"),
            length_mm: z.number(),
            height_above_GP_mm: z.number(),
            angle_to_PP_deg: z.number(),
            inclination_to_GP_deg: z.number().optional(),
        }),
        z.object({
            kind: z.literal("lamina"),
            shape: z.enum(["triangle", "square", "rectangle", "pentagon", "hexagon", "circle"]),
            size_mm: PerspectivePlanSizeSchemaZ,
            orientation: z.enum(["horizontal", "vertical"]),
            angle_to_PP_deg: z.number().optional(),
        }),
        z.object({
            kind: z.literal("solid"),
            solid_type: z.enum(["cube", "prism", "pyramid", "cylinder", "cone"]),
            base_shape: z.enum(["circle", "triangle", "square", "rectangle", "pentagon", "hexagon"]),
            base_size_mm: PerspectivePlanSizeSchemaZ,
            height_mm: z.number(),
            base_edge_angle_to_PP_deg: z.number().optional(),
        }),
        z.object({
            kind: z.literal("block_model"),
            primitives: z.array(ScenePrimitiveSchemaZ),
            rotation_deg: z.number().optional(),
        }),
    ]),
    placement: z.object({
        position_relative_to_PP: z.enum(["behind", "in_front", "touching"]),
        nearest_distance_from_PP_mm: z.number(),
        ground_clearance_mm: z.number().optional(),
    }),
    station_point: z.object({
        distance_in_front_of_PP_mm: z.number(),
        height_above_GP_mm: z.number(),
        lateral_offset_from_object_center_mm: z.number().optional(),
    }),
    required_outputs: z.object({
        perspective_view: z.boolean().optional(),
        top_view_construction: z.boolean().optional(),
        vanishing_points: z.boolean().optional(),
    }).optional(),
});

const IsometricSizeSchemaZ = z.object({
    side_mm: z.number().optional(),
    length_mm: z.number().optional(),
    breadth_mm: z.number().optional(),
    diameter_mm: z.number().optional(),
});

const IsometricMemberSchemaZ = z.object({
    solid_type: z.enum(["prism", "pyramid", "cylinder", "cone", "cube", "sphere", "hemisphere", "frustum"]),
    base_shape: z.enum(["circle", "triangle", "square", "rectangle", "pentagon", "hexagon"]).optional(),
    base_size_mm: IsometricSizeSchemaZ,
    top_base_size_mm: IsometricSizeSchemaZ.optional(),
    height_mm: z.number().optional(),
    placed_centrally: z.boolean().optional(),
    hemisphere_orientation: z.enum(["flat_face_up", "flat_face_down"]).optional(),
});

export const IsometricProjectionSchemaZ = z.object({
    type: z.literal("isometric_projection"),
    scale_mode: z.enum(["isometric_projection", "isometric_view"]),
    object: z.discriminatedUnion("kind", [
        z.object({
            kind: z.literal("lamina"),
            shape: z.enum(["triangle", "square", "rectangle", "pentagon", "hexagon", "circle"]),
            size_mm: IsometricSizeSchemaZ,
            plane: z.enum(["horizontal", "left_vertical", "right_vertical"]),
        }),
        z.object({
            kind: z.literal("solid"),
            solid_type: z.enum(["cube", "prism", "pyramid", "cylinder", "cone", "sphere", "hemisphere", "frustum"]),
            base_shape: z.enum(["circle", "triangle", "square", "rectangle", "pentagon", "hexagon"]),
            base_size_mm: IsometricSizeSchemaZ,
            top_base_size_mm: IsometricSizeSchemaZ.optional(),
            height_mm: z.number(),
            base_edge_angle_deg: z.number().optional(),
            axis_orientation: z.object({ inclination_to_HP_deg: z.number(), plan_angle_deg: z.number().optional() }).optional(),
            top_cut: z.object({ height_at_center_mm: z.number(), inclination_deg: z.number(), direction_angle_deg: z.number().optional() }).optional(),
        }),
        z.object({ kind: z.literal("composite"), solids: z.array(IsometricMemberSchemaZ) }),
        z.object({
            kind: z.literal("block_model"),
            primitives: z.array(ScenePrimitiveSchemaZ),
            rotation_deg: z.number().optional(),
        }),
    ]),
    show_construction_box: z.boolean().optional(),
    show_orthographic_views: z.boolean().optional(),
});

const DevelopmentEndSchemaZ = z.object({
    level: z.enum(["base", "top"]),
    perimeter_fraction: z.number(),
});

const TransitionEndSchemaZ = z.object({
    shape: z.enum(["circle", "square", "rectangle"]),
    diameter_mm: z.number().optional(),
    length_mm: z.number().optional(),
    breadth_mm: z.number().optional(),
    side_mm: z.number().optional(),
});

export const AdvancedDevelopmentSchemaZ = z.object({
    type: z.literal("advanced_development"),
    problem: z.discriminatedUnion("family", [
        z.object({
            family: z.literal("shortest_path"),
            surface: z.enum(["prism", "cylinder"]),
            base_shape: z.enum(["circle", "triangle", "square", "rectangle", "pentagon", "hexagon"]),
            base_size_mm: IsometricSizeSchemaZ,
            height_mm: z.number(),
            start: DevelopmentEndSchemaZ,
            end: DevelopmentEndSchemaZ,
            turns: z.number().optional(),
            return_path: z.boolean().optional(),
        }),
        z.object({ family: z.literal("sphere"), diameter_mm: z.number(), method: z.enum(["zone", "lune"]), divisions: z.number().optional() }),
        z.object({
            family: z.literal("transition"),
            bottom: TransitionEndSchemaZ,
            top: TransitionEndSchemaZ,
            height_mm: z.number(),
            offset_mm: z.object({ x: z.number(), y: z.number() }).optional(),
            divisions: z.number().optional(),
        }),
        z.object({ family: z.literal("reverse_cone"), sector_radius_mm: z.number(), sector_angle_deg: z.number(), vertex_height_above_HP_mm: z.number().optional() }),
        z.object({ family: z.literal("tray"), bottom_length_mm: z.number(), bottom_breadth_mm: z.number(), top_length_mm: z.number(), top_breadth_mm: z.number(), height_mm: z.number() }),
        z.object({
            family: z.literal("penetration"),
            host: z.enum(["prism", "pyramid", "cylinder", "cone"]),
            base_shape: z.enum(["circle", "triangle", "square", "rectangle", "pentagon", "hexagon"]),
            base_size_mm: IsometricSizeSchemaZ,
            height_mm: z.number(),
            opening: z.object({
                shape: z.enum(["circle", "square", "slot"]),
                width_mm: z.number(),
                length_mm: z.number().optional(),
                center_height_mm: z.number(),
                face_index: z.number().optional(),
                through: z.boolean().optional(),
            }),
            divisions: z.number().optional(),
        }),
        z.object({
            family: z.literal("compound_half_solids"),
            members: z.array(z.object({
                surface: z.enum(["half_cone", "half_prism", "half_pyramid", "half_cylinder"]),
                base_shape: z.enum(["circle", "triangle", "square", "rectangle", "hexagon"]),
                base_size_mm: IsometricSizeSchemaZ,
                height_mm: z.number(),
            })),
        }),
    ]),
});

export const AdvancedSectionSchemaZ = z.object({
    type: z.literal("advanced_section"),
    solid: z.object({
        solid_type: z.enum(["prism", "pyramid", "cylinder", "cone", "tetrahedron"]),
        base_shape: z.enum(["circle", "triangle", "square", "rectangle", "pentagon", "hexagon"]),
        base_size_mm: IsometricSizeSchemaZ,
        axis_length_mm: z.number(),
    }),
    orientation: z.object({
        axis_inclination_to_HP_deg: z.number().optional(),
        axis_inclination_to_VP_deg: z.number().optional(),
        plan_angle_deg: z.number().optional(),
        resting_element: z.enum(["base_edge", "base_corner", "lateral_edge", "slant_edge", "generator", "base_circle_point", "lateral_face"]).optional(),
    }).optional(),
    cutting_plane: z.object({
        perpendicular_to: z.enum(["HP", "VP"]),
        inclination_deg: z.number().optional(),
        distance_from_base_mm: z.number(),
        direction: z.enum(["clockwise", "counterclockwise"]).optional(),
    }),
    inverse_section: z.object({
        true_shape: z.enum(["triangle", "polygon", "ellipse", "parabola", "hyperbola"]),
        major_axis_mm: z.number().optional(),
        minor_axis_mm: z.number().optional(),
    }).optional(),
    required_outputs: z.object({ front_view: z.boolean().optional(), top_view: z.boolean().optional(), true_shape: z.boolean().optional(), development: z.boolean().optional() }).optional(),
});

export const CompositeSolidSchemaZ = z.object({
    type: z.literal("composite_solid"),
    solids: z.array(z.object({
        solid_type: z.enum(["prism", "pyramid", "cylinder", "cone", "cube", "sphere", "hemisphere", "frustum"]),
        base_shape: z.enum(["circle", "triangle", "square", "rectangle", "pentagon", "hexagon"]).optional(),
        base_size_mm: z.object({
            side_mm: z.number().optional(),
            diameter_mm: z.number().optional(),
            length_mm: z.number().optional(),
            breadth_mm: z.number().optional(),
        }),
        top_base_size_mm: z.object({
            side_mm: z.number().optional(),
            diameter_mm: z.number().optional(),
            length_mm: z.number().optional(),
            breadth_mm: z.number().optional(),
        }).optional(),
        height_mm: z.number().optional(),
        placed_centrally: z.boolean().optional(),
        hemisphere_orientation: z.enum(["flat_face_up", "flat_face_down"]).optional(),
    })).optional(),
    base_solid: z.object({
        solid_type: z.enum(["prism", "pyramid", "cylinder", "cone", "cube", "sphere", "hemisphere", "frustum"]),
        base_shape: z.enum(["circle", "triangle", "square", "rectangle", "pentagon", "hexagon"]),
        base_size_mm: z.object({
            side_mm: z.number().optional(),
            diameter_mm: z.number().optional(),
            length_mm: z.number().optional(),
            breadth_mm: z.number().optional(),
        }),
        top_base_size_mm: z.object({
            side_mm: z.number().optional(),
            diameter_mm: z.number().optional(),
            length_mm: z.number().optional(),
            breadth_mm: z.number().optional(),
        }).optional(),
        height_mm: z.number().optional(),
        resting_on: z.enum(["HP", "VP"]),
        placed_centrally: z.boolean().optional(),
        hemisphere_orientation: z.enum(["flat_face_up", "flat_face_down"]).optional(),
    }).optional(),
    top_solid: z.object({
        solid_type: z.enum(["prism", "pyramid", "cylinder", "cone", "cube", "sphere", "hemisphere", "frustum"]),
        base_shape: z.enum(["circle", "triangle", "square", "rectangle", "pentagon", "hexagon"]).optional(),
        base_size_mm: z.object({
            side_mm: z.number().optional(),
            diameter_mm: z.number().optional(),
            length_mm: z.number().optional(),
            breadth_mm: z.number().optional(),
        }),
        top_base_size_mm: z.object({
            side_mm: z.number().optional(),
            diameter_mm: z.number().optional(),
            length_mm: z.number().optional(),
            breadth_mm: z.number().optional(),
        }).optional(),
        height_mm: z.number().optional(),
        placed_centrally: z.boolean().optional(),
        hemisphere_orientation: z.enum(["flat_face_up", "flat_face_down"]).optional(),
    }).optional(),
    resting_on: z.enum(["HP", "VP"]).optional(),
});

export const AuxiliaryViewSchemaZ = z.object({
    type: z.literal("auxiliary_view"),
    view_type: z.enum(["auxiliary_elevation", "auxiliary_plan"]),
    inclination_deg: z.number(),
    solid_type: z.enum(["prism", "pyramid", "cylinder", "cone", "cube"]),
    base_shape: z.enum(["circle", "triangle", "square", "rectangle", "pentagon", "hexagon"]),
    base_size_mm: z.object({
        side_mm: z.number().optional(),
        length_mm: z.number().optional(),
        breadth_mm: z.number().optional(),
        diameter_mm: z.number().optional(),
    }),
    axis_length_mm: z.number(),
    resting_on: z.enum(["HP", "VP"]),
    base_orientation: BaseOrientationConstraintZ.optional(),
});

export const EngineeringProblemZ = z.discriminatedUnion("type", [
  AuxiliaryViewSchemaZ,
  PointSchemaZ,
  PointSpecialSchemaZ,
  LineParallelSchemaZ,
  LineInclinedHPSchemaZ,
  LineInclinedVPSchemaZ,
  LineInclinedBothSchemaZ,
  LineOneEndHPSchemaZ,
  LineOneEndVPSchemaZ,
  LineCoplanarSchemaZ,
  LineTouchingXYSchemaZ,
  SolidSchemaZ,
  SectionSolidSchemaZ,
  PlaneSurfaceSchemaZ,
  PerspectiveProjectionSchemaZ,
  IsometricProjectionSchemaZ,
  AdvancedDevelopmentSchemaZ,
  AdvancedSectionSchemaZ,
  CompositeSolidSchemaZ,
]);

// Primitives for the renderer
export interface LinePrimitive {
  type: 'line';
  key: string;
  points: [number, number, number, number];
  dashed: boolean;
  lineStyle?: 'solid' | 'dashed' | 'dotted' | 'chain';
  primitiveRole?: 'visible' | 'hidden' | 'axis' | 'projection' | 'dimension' | 'label' | 'caption' | 'plane' | 'construction';
  color?: string;
  step?: number;
  sequence?: number;
}

export interface TextPrimitive {
  type: 'text';
  key: string;
  x: number;
  y: number;
  content: string;
  color?: string;
  rotation?: number;
  textAnchor?: 'start' | 'middle' | 'end';
  dominantBaseline?: 'auto' | 'use-script' | 'no-change' | 'reset-size' | 'ideographic' | 'alphabetic' | 'hanging' | 'mathematical' | 'central' | 'middle' | 'text-after-edge' | 'text-before-edge';
  primitiveRole?: 'visible' | 'hidden' | 'axis' | 'projection' | 'dimension' | 'label' | 'caption' | 'plane' | 'construction';
  fontSize?: number;
  fontWeight?: 'normal' | 'bold';
  step?: number;
  sequence?: number;
}

export interface CirclePrimitive {
    type: 'circle';
    key: string;
    cx: number;
    cy: number;
    r: number;
    dashed: boolean;
    lineStyle?: 'solid' | 'dashed' | 'dotted' | 'chain';
    primitiveRole?: 'visible' | 'hidden' | 'axis' | 'projection' | 'dimension' | 'label' | 'caption' | 'plane' | 'construction';
    color?: string;
    step?: number;
    sequence?: number;
}

export interface PathPrimitive {
  type: 'path';
  key: string;
  d: string;
  dashed: boolean;
  lineStyle?: 'solid' | 'dashed' | 'dotted' | 'chain';
  primitiveRole?: 'visible' | 'hidden' | 'axis' | 'projection' | 'dimension' | 'label' | 'caption' | 'plane' | 'construction';
  color?: string;
  fill?: string;
  step?: number;
  sequence?: number;
}

export type SvgPrimitive = LinePrimitive | TextPrimitive | CirclePrimitive | PathPrimitive;

// Calculated Properties for Display
export interface LineProperties {
    trueLength: number;
    planLength: number;
    elevationLength: number;
    trueInclinationHP: number; // theta
    trueInclinationVP: number; // phi
    apparentInclinationHP: number; // alpha (FV)
    apparentInclinationVP: number; // beta (TV)
}

// Structured output from Geometry Engine
export interface PointCoords { x: number; y: number; z?: number } // z is for visibility calculation

export interface FinalGeometry {
  top: { A: PointCoords; B: PointCoords; };
  front: { A_prime: PointCoords; B_prime: PointCoords; };
}

export interface GeometryOutput {
  type: string; // To distinguish problem type for UI descriptions
  constructionPrimitives: SvgPrimitive[];
  finalGeometry: FinalGeometry | null;
  lineProperties?: LineProperties;
  error?: string;
  params?: EngineeringProblem;
}
