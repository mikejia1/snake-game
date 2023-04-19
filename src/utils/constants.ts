import { Coord } from '../store/classes';

// Width and height of background image.
export const BACKGROUND_WIDTH = 2000;
export const BACKGROUND_HEIGHT = 600;

// Width and height of the 2D canvas.
export const CANVAS_WIDTH = 400;
export const CANVAS_HEIGHT = 240;

// The coord that would place the Gardener at the centre of the canvas.
export const CANVAS_CENTRE = new Coord(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);

export const CANVAS_RECT = {
    a: new Coord(0,0),
    b: new Coord(CANVAS_WIDTH-1, CANVAS_HEIGHT-1),
};

// The number of pixels wide/tall a single spot on the grid occupies.
//export const TILE_WIDTH = 16;
//export const TILE_HEIGHT = 8;
export const TILE_WIDTH = 20;
export const TILE_HEIGHT = 10;

// The number of pixels left/right/up/down that the gardener moves on WASD input.
export const MOVE_HORZ = 5;
export const MOVE_VERT = 1;

// Walking speed of gardener and NPCs.
export const V_PIXEL_SPEED = 3;
export const H_PIXEL_SPEED = 3;

// An enum for the directions.
export enum Direction {
    Up, Down, Left, Right,
}

export const ALL_DIRECTIONS = [Direction.Up, Direction.Down, Direction.Left, Direction.Right];

// Named constants for colours.
export enum Colour {
    PLANT_OUTLINE   = "#146356",
    COLLISION_RECT  = "#FF2200",
    POSITION_RECT   = "#22FF00",
    WATERING_RECT   = "#0022FF",
    FACING_RECT     = "#2288FF",
    EQUIP_RECT      = "#FF22FF",
    RIPE_FRUIT      = "#FF0000",
    UNRIPE_FRUIT    = "#33FF00",
    FRUIT_OUTLINE   = "#CCCCCC",
}
