import { IGlobalState, Collider, Paintable, Interactable, ColliderType, playBumpSound, getBumpedNPCs, detectCollisions, AnimEvent, AnimEventType, Lifeform } from '../store/classes';
import {
    Direction, Colour, shiftForTile, shiftRect, positionRect, outlineRect,
    ENTITY_RECT_HEIGHT, ENTITY_RECT_WIDTH, BACKGROUND_WIDTH, BACKGROUND_HEIGHT,
    computeBackgroundShift, GARDENER_V_PIXEL_SPEED, GARDENER_H_PIXEL_SPEED, GARDENER_DH_PIXEL_SPEED, GARDENER_DV_PIXEL_SPEED,
    Coord, Rect, GardenerDirection, EJECTION_SHRINK_RATE,
} from '../utils';
import { MAP_TILE_SIZE } from '../store/data/positions';
import { Tile } from '../scene';
import { CausaMortis, Death, paintSkeletonDeath } from './skeleton';
import { NonPlayer } from './nonplayer';
import { drawText } from '../utils/drawtext';

// The height of the gardener in pixels.
export const GARDENER_HEIGHT = 20;

// The gardener who tends the garden.
export class Gardener implements Lifeform, Collider, Interactable {
    pos: Coord;                 // Position of the gardener in the environment.
    facing: GardenerDirection;  // Direction the gardener is currently facing.
    itemEquipped: boolean;      // Whether or not the gardener has an item equipped.
    moving: boolean;            // Whether or not the gardener is moving.
    watering: boolean;          // Whether or not the gardener is watering.
    colliderId: number;         // The ID that distinguishes the collider from all others.
    colliderType: ColliderType = ColliderType.GardenerCo; // The type of collider that the gardener is.
    death : Death | null;       // Death data to specify how to paint death animation.
 
    constructor(colliderId: number, pos: Coord, facing: GardenerDirection, itemEquipped: boolean=false, moving: boolean=false, watering: boolean, death: Death | null) {
        this.colliderId = colliderId;
        this.pos = pos;
        this.facing = facing;
        this.itemEquipped = itemEquipped;
        this.moving = moving;
        this.watering = watering;
        this.death = death;
    }
    
    opposingDirection(direction1: Direction, direction2: Direction){
        switch(direction1) {
            case Direction.Left:  return direction2 === Direction.Right;
            case Direction.Right: return direction2 === Direction.Left;
            case Direction.Up:    return direction2 === Direction.Down;
            case Direction.Down:  return direction2 === Direction.Up;
        }
    }

    // Move the gardener along the direction its currently facing. Return new gardener.
    move(directions: Direction[]): Gardener {
      var delta = [0,0]
      // Diagonal gardener movement.
      if(directions.length > 1 && !this.opposingDirection(directions[0], directions[1])){
        const diagonalDirection = directions.slice(0,2);
        if(diagonalDirection.includes(Direction.Up) && diagonalDirection.includes(Direction.Left)){
            delta = [-GARDENER_DH_PIXEL_SPEED, -GARDENER_DV_PIXEL_SPEED];
        }
        else if(diagonalDirection.includes(Direction.Up) && diagonalDirection.includes(Direction.Right)){
            delta = [GARDENER_DH_PIXEL_SPEED, -GARDENER_DV_PIXEL_SPEED];
        }
        else if(diagonalDirection.includes(Direction.Down) && diagonalDirection.includes(Direction.Left)){
            delta = [-GARDENER_DH_PIXEL_SPEED, GARDENER_DV_PIXEL_SPEED];
        }
        else if(diagonalDirection.includes(Direction.Down) && diagonalDirection.includes(Direction.Right)){
            delta = [GARDENER_DH_PIXEL_SPEED, GARDENER_DV_PIXEL_SPEED];
        }
      }
      else {
        switch (directions[0]) {
            case Direction.Down:
              delta = [0, GARDENER_V_PIXEL_SPEED];
              break;
            case Direction.Up:
              delta = [0, -GARDENER_V_PIXEL_SPEED];
              break;
            case Direction.Left:
              delta = [-GARDENER_H_PIXEL_SPEED, 0];
              break;
            case Direction.Right:
              delta = [GARDENER_H_PIXEL_SPEED, 0];
              break;
          }
      }
      // Add deltas to gardener position and keep it within the background rectangle.
      let newPos = new Coord(this.pos.x + delta[0], this.pos.y + delta[1]);
      //let newPos = new Coord(
      //  (this.pos.x + delta[0] + BACKGROUND_WIDTH) % BACKGROUND_WIDTH,
      //  (this.pos.y + delta[1] + BACKGROUND_HEIGHT) % BACKGROUND_HEIGHT);
      return new Gardener(this.colliderId, newPos, this.facing, this.itemEquipped, true, this.watering, this.death);
    }

    stop(): Gardener {
        this.moving = false;
        return this;
    }

    setWatering(watering: boolean): Gardener {
        this.watering = watering;
        return this;
    }

    // Change facing direction of the gardener but without changing its position.
    changeFacingDirection(direction: Direction): Gardener {
        // Up and Down won't change gardener facing direction.
        if ((direction === Direction.Up ) || (direction === Direction.Down)) {
            return this;
        }
        // Left and Right will change gardener facing direction.
        this.facing = (direction === Direction.Left) ? GardenerDirection.Left : GardenerDirection.Right;
        return this;
    }
  
    // Set value of itemEquipped. Return new gardener.
    setItemEquipped(itemEquipped: boolean): Gardener {
        this.itemEquipped = itemEquipped;
        return this;
    }
  
    // Paint the gardener on the canvas.
    paint(canvas: CanvasRenderingContext2D, state: IGlobalState): void {
        let shift = this.computeShift(state);
        let newPos = this.pos.plus(shift.x, shift.y);        
        let flip = (this.facing === GardenerDirection.Left);

        if (this.death != null) this.paintDeath(canvas, state, shift, newPos, flip);
        else if (this.watering) this.paintWatering(canvas, state, shift, newPos, flip);
        else this.paintWalking(canvas, state, shift, newPos, flip);

        // Paint debugging oxygen level.
        drawText(canvas, newPos.plus(0, -30), String(Math.floor(state.oxygen)));

        // Extra debug displays.
        if (state.debugSettings.showCollisionRects) {
            outlineRect(canvas, shiftRect(this.collisionRect(), shift.x, shift.y), Colour.COLLISION_RECT);
        }
        if (state.debugSettings.showPositionRects) {
            outlineRect(canvas, shiftRect(positionRect(this), shift.x, shift.y), Colour.POSITION_RECT);
        }
        if (state.debugSettings.showFacingRects) {
            outlineRect(canvas, shiftRect(this.facingDetectionRect(), shift.x, shift.y), Colour.FACING_RECT);
        }
        if (state.debugSettings.showInteractionRects) {
            outlineRect(canvas, shiftRect(this.interactionRect(), shift.x, shift.y), Colour.INTERACTION_RECT);
        }
    }

    // Compute sprite size and shift values for air lock ejection. (48 and 0, respectively, when not being ejected)
    ejectionScaleAndShift(): any {
        if (this.death === null) return { scaledSize: 48, shiftToCentre: 0 };
        let scaledSize = (this.death.ejectionScaleFactor !== null) ? this.death.ejectionScaleFactor : 1;
        scaledSize = scaledSize * 48;
        let shiftToCentre = (48 - scaledSize) / 2;  // Maintains sprite centre, despite scaling.
        return { scaledSize: scaledSize, shiftToCentre: shiftToCentre };
    }

    paintDeath(canvas: CanvasRenderingContext2D, state: IGlobalState, shift: Coord, newPos: Coord, flip: boolean): void {
        if (this.death === null) return;
        let frame = 0;
        let image = null;
        switch (this.death.cause) {
            case CausaMortis.Laceration:
                frame = Math.min(Math.floor((state.currentFrame - this.death.time) / 3), 14);
                image = state.gardenerImages.slainDeath;
                break;
            case CausaMortis.Asphyxiation:
                frame = Math.min(Math.floor((state.currentFrame - this.death.time) / 3), 13);
                image = state.gardenerImages.chokeDeath;
                console.log("asphyxiation current frame: "+ state.currentFrame + " death time: "+ this.death.time);
                console.log("painting gardener asphyxiation, frame: "+ frame);
                break;
            case CausaMortis.Incineration:
                return paintSkeletonDeath(canvas, state, newPos, flip, this.death);
            case CausaMortis.Ejection:
                image = state.gardenerImages.walkingBase;
                frame = Math.floor(state.currentFrame % (6 * 8) / 6);
        }
    
        // Determine where, on the canvas, the gardener should be painted.
        let dest = flip
            ? new Coord((newPos.x * -1) - 14, newPos.y - 18)
            : new Coord(newPos.x - 3, newPos.y - 18);
        dest = dest.toIntegers();
        let xScale = flip ? -1 : 1;
        canvas.save();
        canvas.scale(xScale, 1);

        // Sprite size and shift for air lock ejection.
        let ejection = this.ejectionScaleAndShift();
        let scaledSize = ejection.scaledSize;
        let shiftToCentre = ejection.shiftToCentre;

        // Paint gardener sprite for current frame.
        canvas.drawImage(
            image,                                                     // Source image
            (frame * 96) + 40, 20,                                     // Top-left corner of frame in source
            48, 48,                                                    // Size of frame in source
            dest.x + (shiftToCentre * xScale), dest.y + shiftToCentre, // Position of sprite on canvas
            scaledSize, scaledSize);                                   // Sprite size on canvas

        // Restore canvas transforms to normal.
        canvas.restore();
    }

    // Paint the gardener standing still or walking.
    paintWalking(canvas: CanvasRenderingContext2D, state: IGlobalState, shift: Coord, newPos: Coord, flip: boolean): void {
        // The walking animation has 8 frames.
        let frameCount = 8;
        let frame = this.moving ? Math.floor(state.currentFrame % (6 * frameCount) / 6) : 0;

        // Determine where, on the canvas, the gardener should be painted.
        let dest = flip
            ? new Coord((newPos.x * -1) - 14, newPos.y - 18)
            : new Coord(newPos.x - 3, newPos.y - 18);
        dest = dest.toIntegers();
        canvas.save();
        canvas.scale(flip ? -1 : 1, 1);
        
        // Paint gardener sprite for current frame.
        canvas.drawImage(
            state.gardenerImages.walkingBase,  // Walking base source image
            (frame * 96) + 40, 20,             // Top-left corner of frame in source
            48, 48,                            // Size of frame in source
            dest.x, dest.y,                    // Position of sprite on canvas
            48, 48);                           // Sprite size on canvas
    
        // Restore canvas transforms to normal.
        canvas.restore();
    }

    // Paint the gardener while it's watering.
    paintWatering(canvas: CanvasRenderingContext2D, state: IGlobalState, shift: Coord, newPos: Coord, flip: boolean): void {
        // The watering animation only has 5 frames.
        let frameCount = 5;
        let frame = Math.floor(state.currentFrame % (3 * frameCount) / 3);

        // Determine where, on the canvas, the gardener should be painted.
        let dest = flip
            ? new Coord((newPos.x * -1) - 14, newPos.y - 18)
            : new Coord(newPos.x - 3, newPos.y - 18);
        dest = dest.toIntegers();
        canvas.save();
        canvas.scale(flip ? -1 : 1, 1);

        // Paint gardener sprite for current frame.
        canvas.drawImage(
            state.gardenerImages.wateringBase,  // Watering base source image
            (frame * 96) + 40, 20,              // Top-left corner of frame in source
            48, 48,                             // Size of frame in source
            dest.x, dest.y,                     // Position of sprite on canvas
            48, 48);                            // Sprite size on canvas
        canvas.drawImage(
            state.gardenerImages.waterPouring,  // Pouring water and watering can
            (frame * 96) + 40, 20,              // Top-left corner of frame in source
            48, 48,                             // Size of frame in source
            dest.x, dest.y,                     // Position of sprite on canvas
            48, 48);                            // Sprite size on canvas
    
        // Restore canvas transforms to normal.
        canvas.restore();
    }

    // Compute a displacement that will place the Gardener at the correct place on the canvas.
    computeShift(state: IGlobalState): Coord {
        return shiftForTile(this.closestTile(), state, computeBackgroundShift(state, false));
    }

    // Determine the grid tile that is the closest approximation to the Gardener's position.
    closestTile(): Tile {
        return new Tile(
            Math.floor(this.pos.x / MAP_TILE_SIZE),
            Math.floor(this.pos.y / MAP_TILE_SIZE));
    }

    // Return the invisible rectangle that determines collision behaviour for the gardener.
    collisionRect(): Rect {
        return {
            a: this.pos.plus(0, -ENTITY_RECT_HEIGHT),
            b: this.pos.plus(ENTITY_RECT_WIDTH, 0),
        }
    }

    interactionRect(): Rect {
        return {
            a: this.pos.plus(-10, -20),
            b: this.pos.plus(20, 8),
        };
    }

    // Return a rectangle adjacent to the gardener in the direction it is facing.
    facingDetectionRect(): Rect {
        let rect = this.collisionRect();
       switch (this.facing) {
        case GardenerDirection.Left:  return shiftRect(rect, -ENTITY_RECT_WIDTH, 0);
        case GardenerDirection.Right: return shiftRect(rect, ENTITY_RECT_WIDTH, 0);
       }
    }

    // Have the gardener die.
    dieOf(cause: CausaMortis, time: number) {
        let scale: number | null = (cause === CausaMortis.Ejection) ? 1 : null;
        if (this.death === null) this.death = { cause: cause, time: time, ejectionScaleFactor: scale };
        else {
            // The only death you can inflict *after* having already died is ejection of the corpse through the air lock.
            // In such a case, the cause of death and the time of death remain the same, but ejectionScaleFactor gets set.
            // Additionally, in case ejection death is assigned more than once (for whatever reason) only the first time counts.
            if (cause !== CausaMortis.Ejection) return;             // Only ejection "death" can occur after death.
            if (this.death.ejectionScaleFactor !== null) return;    // Ejection scale factor will not be reset.
            this.death.ejectionScaleFactor = 1;                     // Ejection scale factor starts at 1.
        }
    }
}


export function updateGardenerMoveState(state: IGlobalState): IGlobalState {
    if (state.gardener.death !== null) {
        if (state.gardener.death.ejectionScaleFactor !== null) {
            state.gardener.death.ejectionScaleFactor *= EJECTION_SHRINK_RATE;
        }
        if (!state.gameover) {
            return {...state, pendingEvents: [...state.pendingEvents, new AnimEvent(AnimEventType.GAMEOVER_REPLAY_FRAME, state.currentFrame)]}
        }
        else return state;
    }
    if (!state.gardener.moving) {
      return state;
    }
    // Move the gardener according to keys pressed.
    // This will be aborted if the would-be new position overlaps with a plant.
    // Would-be new post-move gardener.
    const newGar = state.gardener.move(state.keysPressed);
    let allColliders: Map<number, Collider> = state.colliderMap;
  
    // Get all colliders currently in collision with the gardener.
    let colliders: Collider[] = detectCollisions(state, allColliders, newGar);
  
    // Filter those colliders down to just those that are NPCs, keyed by collider ID.
    let bumpedNPCs: Set<number> = getBumpedNPCs(colliders);
  
    // Get a new list of NPCs where the bumped ones have begun avoiding the gardener.
    let newNPCs: NonPlayer[] = [];
    for (let i = 0; i < state.npcs.length; i++) {
      let npc = state.npcs[i];
      if (bumpedNPCs.has(npc.colliderId)) newNPCs = [...newNPCs, npc.startAvoidingGardener()];
      else newNPCs = [...newNPCs, npc]; 
    }
  
    // If new gardener is in collision with anything, we abort the move.
    if (colliders.length > 0) {
      console.log("Bump!");
      if (!state.muted) playBumpSound();
      return {
        ...state,
        npcs: newNPCs,
      }
    }
    // All clear. Update new version of garden to colliderMap and commit the move to global state.
    allColliders.set(state.gardener.colliderId, newGar);
    return {
      ...state,
      gardener: newGar,
      // Watering can moves with gardener if the item is equipped.
      wateringCan: state.wateringCan.isEquipped ? state.wateringCan.moveWithGardener(newGar) : state.wateringCan,
      colliderMap: allColliders,
    }
}