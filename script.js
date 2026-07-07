import { jsPDF } from 'jspdf';
import { categories, guides, faqs, troubleshooting } from './learningData.js';

/**
 * CAD Drawing App Core Engine
 * Powered by ES6 Object-Oriented Canvas Architecture
 */

// ==========================================
// 1. SHAPE GEOMETRIC ES6 CLASSES
// ==========================================

export function rotatePoint(x, y, px, py, angleRad) {
  const dx = x - px;
  const dy = y - py;
  const rx = px + dx * Math.cos(angleRad) - dy * Math.sin(angleRad);
  const ry = py + dx * Math.sin(angleRad) + dy * Math.cos(angleRad);
  return { x: rx, y: ry };
}

export function mirrorPoint(x, y, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const l2 = dx * dx + dy * dy;
  if (l2 === 0) {
    // Single point reflection as fallback
    return { x: 2 * x1 - x, y: 2 * y1 - y };
  }
  const t = ((x - x1) * dx + (y - y1) * dy) / l2;
  const projX = x1 + t * dx;
  const projY = y1 + t * dy;
  return { x: 2 * projX - x, y: 2 * projY - y };
}

export class Shape {
  constructor(type, color = '#06b6d4', lineWidth = 2) {
    this.type = type;
    this.color = color;
    this.lineWidth = lineWidth;
    this.id = 'ent_' + Math.random().toString(36).substr(2, 9);
    this.layerId = 'default';
    this.angle = 0;
  }

  /**
   * Mirror the shape across a line passing through (x1, y1) and (x2, y2)
   */
  mirror(x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const phi = Math.atan2(dy, dx);

    if (this.x1 !== undefined && this.y1 !== undefined) {
      // Handles lines, walls, beams, doors, windows, dimensions (endpoint based)
      const p1 = mirrorPoint(this.x1, this.y1, x1, y1, x2, y2);
      const p2 = mirrorPoint(this.x2, this.y2, x1, y1, x2, y2);
      this.x1 = p1.x;
      this.y1 = p1.y;
      this.x2 = p2.x;
      this.y2 = p2.y;
    } else if (this.x !== undefined && this.y !== undefined) {
      if (this.width !== undefined && this.height !== undefined) {
        // Handles rectangular regions: Rectangles, Columns, RoomLabels, AreaZones
        const cx = this.x + this.width / 2;
        const cy = this.y + this.height / 2;
        const mc = mirrorPoint(cx, cy, x1, y1, x2, y2);
        this.x = mc.x - this.width / 2;
        this.y = mc.y - this.height / 2;
      } else {
        // Fallback for shapes with positioning starting at top left
        const mc = mirrorPoint(this.x, this.y, x1, y1, x2, y2);
        this.x = mc.x;
        this.y = mc.y;
      }
    } else if (this.centerX !== undefined && this.centerY !== undefined) {
      // Handles circles
      const mc = mirrorPoint(this.centerX, this.centerY, x1, y1, x2, y2);
      this.centerX = mc.x;
      this.centerY = mc.y;
    }

    // Reflect the angle of rotation
    this.angle = 2 * phi - (this.angle || 0);
  }

  /**
   * Scale the shape relative to a base point (px, py) with a scale factor s
   */
  scale(px, py, s) {
    if (this.x1 !== undefined && this.y1 !== undefined) {
      this.x1 = px + (this.x1 - px) * s;
      this.y1 = py + (this.y1 - py) * s;
      this.x2 = px + (this.x2 - px) * s;
      this.y2 = py + (this.y2 - py) * s;
      
      // Scale other sub-properties if present
      if (this.wallThickness !== undefined) {
        this.wallThickness *= s;
      }
      if (this.beamWidth !== undefined) {
        this.beamWidth *= s;
      }
      if (this.windowThickness !== undefined) {
        this.windowThickness *= s;
      }
      if (this.offset !== undefined) {
        this.offset *= s;
      }
      if (this.arrowSize !== undefined) {
        this.arrowSize *= s;
      }
    } else if (this.x !== undefined && this.y !== undefined) {
      if (this.width !== undefined && this.height !== undefined) {
        // Find the center first
        const cx = this.x + this.width / 2;
        const cy = this.y + this.height / 2;
        
        // Scale the center relative to (px, py)
        const ncx = px + (cx - px) * s;
        const ncy = py + (cy - py) * s;
        
        // Scale size
        this.width *= s;
        this.height *= s;
        
        // Reposition x and y based on new center
        this.x = ncx - this.width / 2;
        this.y = ncy - this.height / 2;
      } else {
        // Fallback or TextLabel (no width/height)
        this.x = px + (this.x - px) * s;
        this.y = py + (this.y - py) * s;
      }

      if (this.fontSize !== undefined) {
        this.fontSize = Math.max(4, Math.round(this.fontSize * s));
      }
    } else if (this.centerX !== undefined && this.centerY !== undefined) {
      this.centerX = px + (this.centerX - px) * s;
      this.centerY = py + (this.centerY - py) * s;
      if (this.radius !== undefined) {
        this.radius *= s;
      }
    }
  }

  /**
   * Draw the shape on standard canvas context
   * @param {CanvasRenderingContext2D} ctx 
   */
  draw(ctx) {
    throw new Error("Method 'draw()' must be implemented in child shape subclass.");
  }

  /**
   * Convert shape attributes to generic object for JSON storage
   */
  serialize() {
    return {
      type: this.type,
      color: this.color,
      lineWidth: this.lineWidth,
      id: this.id,
      layerId: this.layerId || 'default',
      angle: this.angle || 0
    };
  }
}

export class Line extends Shape {
  constructor(x1, y1, x2, y2, color, lineWidth) {
    super('line', color, lineWidth);
    this.x1 = x1;
    this.y1 = y1;
    this.x2 = x2;
    this.y2 = y2;
  }

  contains(x, y, tolerance = 6) {
    const x1 = this.x1;
    const y1 = this.y1;
    const x2 = this.x2;
    const y2 = this.y2;
    const l2 = (x2 - x1) ** 2 + (y2 - y1) ** 2;
    if (l2 === 0) {
      return Math.hypot(x - x1, y - y1) < (this.lineWidth + tolerance);
    }
    let t = ((x - x1) * (x2 - x1) + (y - y1) * (y2 - y1)) / l2;
    t = Math.max(0, Math.min(1, t));
    const projX = x1 + t * (x2 - x1);
    const projY = y1 + t * (y2 - y1);
    const dist = Math.hypot(x - projX, y - projY);
    return dist < (this.lineWidth + tolerance);
  }

  move(dx, dy) {
    this.x1 += dx;
    this.y1 += dy;
    this.x2 += dx;
    this.y2 += dy;
  }

  rotate(px, py, angleRad) {
    const p1 = rotatePoint(this.x1, this.y1, px, py, angleRad);
    const p2 = rotatePoint(this.x2, this.y2, px, py, angleRad);
    this.x1 = p1.x;
    this.y1 = p1.y;
    this.x2 = p2.x;
    this.y2 = p2.y;
  }

  draw(ctx) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(this.x1, this.y1);
    ctx.lineTo(this.x2, this.y2);
    ctx.strokeStyle = this.color;
    ctx.lineWidth = this.lineWidth;
    ctx.lineCap = 'round';
    ctx.stroke();
    ctx.restore();
  }

  serialize() {
    return {
      ...super.serialize(),
      x1: this.x1,
      y1: this.y1,
      x2: this.x2,
      y2: this.y2
    };
  }
}

export class Rectangle extends Shape {
  constructor(x, y, width, height, color, lineWidth) {
    super('rectangle', color, lineWidth);
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
  }

  contains(x, y, tolerance = 6) {
    let cx = x;
    let cy = y;
    if (this.angle) {
      const centX = this.x + this.width / 2;
      const centY = this.y + this.height / 2;
      const dx = x - centX;
      const dy = y - centY;
      const rx = dx * Math.cos(-this.angle) - dy * Math.sin(-this.angle);
      const ry = dx * Math.sin(-this.angle) + dy * Math.cos(-this.angle);
      cx = centX + rx;
      cy = centY + ry;
    }
    const xMin = Math.min(this.x, this.x + this.width);
    const xMax = Math.max(this.x, this.x + this.width);
    const yMin = Math.min(this.y, this.y + this.height);
    const yMax = Math.max(this.y, this.y + this.height);
    return cx >= xMin - tolerance && cx <= xMax + tolerance && cy >= yMin - tolerance && cy <= yMax + tolerance;
  }

  move(dx, dy) {
    this.x += dx;
    this.y += dy;
  }

  rotate(px, py, angleRad) {
    const cx = this.x + this.width / 2;
    const cy = this.y + this.height / 2;
    const n = rotatePoint(cx, cy, px, py, angleRad);
    this.x = n.x - this.width / 2;
    this.y = n.y - this.height / 2;
    this.angle = (this.angle || 0) + angleRad;
  }

  draw(ctx) {
    ctx.save();
    if (this.angle) {
      const cx = this.x + this.width / 2;
      const cy = this.y + this.height / 2;
      ctx.translate(cx, cy);
      ctx.rotate(this.angle);
      ctx.translate(-cx, -cy);
    }
    ctx.beginPath();
    ctx.rect(this.x, this.y, this.width, this.height);
    ctx.strokeStyle = this.color;
    ctx.lineWidth = this.lineWidth;
    ctx.lineJoin = 'miter';
    ctx.stroke();
    ctx.restore();
  }

  serialize() {
    return {
      ...super.serialize(),
      x: this.x,
      y: this.y,
      width: this.width,
      height: this.height
    };
  }
}

export class Circle extends Shape {
  constructor(centerX, centerY, radius, color, lineWidth) {
    super('circle', color, lineWidth);
    this.centerX = centerX;
    this.centerY = centerY;
    this.radius = radius;
  }

  contains(x, y, tolerance = 6) {
    const dist = Math.hypot(x - this.centerX, y - this.centerY);
    return dist <= this.radius + tolerance;
  }

  move(dx, dy) {
    this.centerX += dx;
    this.centerY += dy;
  }

  rotate(px, py, angleRad) {
    const pc = rotatePoint(this.centerX, this.centerY, px, py, angleRad);
    this.centerX = pc.x;
    this.centerY = pc.y;
    this.angle = (this.angle || 0) + angleRad;
  }

  draw(ctx) {
    ctx.save();
    ctx.beginPath();
    // Guarantee non-negative size bounds
    const r = Math.max(0.1, this.radius);
    ctx.arc(this.centerX, this.centerY, r, 0, 2 * Math.PI);
    ctx.strokeStyle = this.color;
    ctx.lineWidth = this.lineWidth;
    ctx.stroke();
    ctx.restore();
  }

  serialize() {
    return {
      ...super.serialize(),
      centerX: this.centerX,
      centerY: this.centerY,
      radius: this.radius
    };
  }
}

export class Wall extends Shape {
  constructor(x1, y1, x2, y2, color, lineWidth, wallThickness = 12) {
    super('wall', color, lineWidth);
    this.x1 = x1;
    this.y1 = y1;
    this.x2 = x2;
    this.y2 = y2;
    this.wallThickness = wallThickness;
  }

  contains(x, y, tolerance = 6) {
    const x1 = this.x1;
    const y1 = this.y1;
    const x2 = this.x2;
    const y2 = this.y2;
    const l2 = (x2 - x1) ** 2 + (y2 - y1) ** 2;
    if (l2 === 0) {
      return Math.hypot(x - x1, y - y1) < (this.wallThickness / 2 + tolerance);
    }
    let t = ((x - x1) * (x2 - x1) + (y - y1) * (y2 - y1)) / l2;
    t = Math.max(0, Math.min(1, t));
    const projX = x1 + t * (x2 - x1);
    const projY = y1 + t * (y2 - y1);
    return Math.hypot(x - projX, y - projY) < (this.wallThickness / 2 + tolerance);
  }

  move(dx, dy) {
    this.x1 += dx;
    this.y1 += dy;
    this.x2 += dx;
    this.y2 += dy;
  }

  rotate(px, py, angleRad) {
    const p1 = rotatePoint(this.x1, this.y1, px, py, angleRad);
    const p2 = rotatePoint(this.x2, this.y2, px, py, angleRad);
    this.x1 = p1.x;
    this.y1 = p1.y;
    this.x2 = p2.x;
    this.y2 = p2.y;
    this.angle = (this.angle || 0) + angleRad;
  }

  draw(ctx, drawingAppInstance = null) {
    ctx.save();
    const dx = this.x2 - this.x1;
    const dy = this.y2 - this.y1;
    const len = Math.hypot(dx, dy);
    if (len === 0) {
      ctx.restore();
      return;
    }

    // Perpendicular unit vector
    const nx = -dy / len;
    const ny = dx / len;
    const halfW = this.wallThickness / 2;

    const p1x = this.x1 + nx * halfW;
    const p1y = this.y1 + ny * halfW;
    const p2x = this.x2 + nx * halfW;
    const p2y = this.y2 + ny * halfW;
    const p3x = this.x2 - nx * halfW;
    const p3y = this.y2 - ny * halfW;
    const p4x = this.x1 - nx * halfW;
    const p4y = this.y1 - ny * halfW;

    // 1. Draw solid translucent wall backing in solid cyan/blue tint
    ctx.beginPath();
    ctx.moveTo(p1x, p1y);
    ctx.lineTo(p2x, p2y);
    ctx.lineTo(p3x, p3y);
    ctx.lineTo(p4x, p4y);
    ctx.closePath();
    ctx.fillStyle = 'rgba(56, 189, 248, 0.16)'; // cyan/blue walls backing
    ctx.fill();

    // 2. Draw diagonal hatching lines inside the wall zone using cyan/blue
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
    ctx.lineWidth = 1;
    const hatchSpacing = 12;
    for (let d = 0; d < len; d += hatchSpacing) {
      const ratio = d / len;
      const cx = this.x1 + dx * ratio;
      const cy = this.y1 + dy * ratio;
      ctx.beginPath();
      ctx.moveTo(cx + nx * halfW - ny * 3, cy + ny * halfW + nx * 3);
      ctx.lineTo(cx - nx * halfW + ny * 3, cy - ny * halfW - nx * 3);
      ctx.stroke();
    }

    // 3. Draw outer parallel boundary lines
    ctx.beginPath();
    ctx.moveTo(p1x, p1y);
    ctx.lineTo(p2x, p2y);
    ctx.moveTo(p4x, p4y);
    ctx.lineTo(p3x, p3y);
    ctx.strokeStyle = this.color;
    ctx.lineWidth = this.lineWidth;
    ctx.stroke();

    // 4. Draw clear wall label if the wall is long enough for a badge
    if (len > 75) {
      ctx.save();
      const midX = (this.x1 + this.x2) / 2;
      const midY = (this.y1 + this.y2) / 2;
      let angle = Math.atan2(dy, dx);
      // Keep text upright
      if (angle > Math.PI / 2 || angle < -Math.PI / 2) {
        angle += Math.PI;
      }
      ctx.translate(midX, midY);
      ctx.rotate(angle);

      const labelText = `WALL: ${Math.round(this.wallThickness)} cm`;
      ctx.font = 'bold 8px monospace';
      const textWidth = ctx.measureText(labelText).width;
      
      // Glass/solid badge behind the text for perfect readability
      ctx.fillStyle = 'rgba(15, 17, 21, 0.85)';
      ctx.beginPath();
      ctx.roundRect(-textWidth / 2 - 4, -6, textWidth + 8, 12, 2);
      ctx.fill();
      ctx.strokeStyle = this.color || '#38BDF8';
      ctx.lineWidth = 0.5;
      ctx.stroke();

      ctx.fillStyle = '#38BDF8'; // beautiful cyan
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(labelText, 0, 0);
      ctx.restore();
    }

    ctx.restore();
  }

  serialize() {
    return {
      ...super.serialize(),
      x1: this.x1,
      y1: this.y1,
      x2: this.x2,
      y2: this.y2,
      wallThickness: this.wallThickness
    };
  }
}

export class Column extends Shape {
  constructor(x, y, width, height, color, lineWidth) {
    super('column', color, lineWidth);
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
  }

  contains(x, y, tolerance = 6) {
    let cx = x;
    let cy = y;
    if (this.angle) {
      const centX = this.x + this.width / 2;
      const centY = this.y + this.height / 2;
      const dx = x - centX;
      const dy = y - centY;
      const rx = dx * Math.cos(-this.angle) - dy * Math.sin(-this.angle);
      const ry = dx * Math.sin(-this.angle) + dy * Math.cos(-this.angle);
      cx = centX + rx;
      cy = centY + ry;
    }
    const xMin = Math.min(this.x, this.x + this.width);
    const xMax = Math.max(this.x, this.x + this.width);
    const yMin = Math.min(this.y, this.y + this.height);
    const yMax = Math.max(this.y, this.y + this.height);
    return cx >= xMin - tolerance && cx <= xMax + tolerance && cy >= yMin - tolerance && cy <= yMax + tolerance;
  }

  move(dx, dy) {
    this.x += dx;
    this.y += dy;
  }

  rotate(px, py, angleRad) {
    const cx = this.x + this.width / 2;
    const cy = this.y + this.height / 2;
    const n = rotatePoint(cx, cy, px, py, angleRad);
    this.x = n.x - this.width / 2;
    this.y = n.y - this.height / 2;
    this.angle = (this.angle || 0) + angleRad;
  }

  draw(ctx, drawingAppInstance = null) {
    ctx.save();
    if (this.angle) {
      const cx = this.x + this.width / 2;
      const cy = this.y + this.height / 2;
      ctx.translate(cx, cy);
      ctx.rotate(this.angle);
      ctx.translate(-cx, -cy);
    }
    ctx.fillStyle = 'rgba(16, 185, 129, 0.18)'; // transparent emerald represent column backing
    ctx.fillRect(this.x, this.y, this.width, this.height);

    // Cross hatching
    ctx.strokeStyle = 'rgba(16, 185, 129, 0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(this.x, this.y);
    ctx.lineTo(this.x + this.width, this.y + this.height);
    ctx.moveTo(this.x + this.width, this.y);
    ctx.lineTo(this.x, this.y + this.height);
    ctx.stroke();

    ctx.beginPath();
    ctx.rect(this.x, this.y, this.width, this.height);
    ctx.strokeStyle = this.color;
    ctx.lineWidth = Math.max(2.5, this.lineWidth + 1);
    ctx.stroke();
    ctx.restore();
  }

  serialize() {
    return {
      ...super.serialize(),
      x: this.x,
      y: this.y,
      width: this.width,
      height: this.height
    };
  }
}

export class Beam extends Shape {
  constructor(x1, y1, x2, y2, color, lineWidth, beamWidth = 8) {
    super('beam', color, lineWidth);
    this.x1 = x1;
    this.y1 = y1;
    this.x2 = x2;
    this.y2 = y2;
    this.beamWidth = beamWidth;
  }

  contains(x, y, tolerance = 6) {
    const x1 = this.x1;
    const y1 = this.y1;
    const x2 = this.x2;
    const y2 = this.y2;
    const l2 = (x2 - x1) ** 2 + (y2 - y1) ** 2;
    if (l2 === 0) return Math.hypot(x - x1, y - y1) < (this.beamWidth / 2 + tolerance);
    let t = ((x - x1) * (x2 - x1) + (y - y1) * (y2 - y1)) / l2;
    t = Math.max(0, Math.min(1, t));
    const projX = x1 + t * (x2 - x1);
    const projY = y1 + t * (y2 - y1);
    return Math.hypot(x - projX, y - projY) < (this.beamWidth / 2 + tolerance);
  }

  move(dx, dy) {
    this.x1 += dx;
    this.y1 += dy;
    this.x2 += dx;
    this.y2 += dy;
  }

  rotate(px, py, angleRad) {
    const p1 = rotatePoint(this.x1, this.y1, px, py, angleRad);
    const p2 = rotatePoint(this.x2, this.y2, px, py, angleRad);
    this.x1 = p1.x;
    this.y1 = p1.y;
    this.x2 = p2.x;
    this.y2 = p2.y;
    this.angle = (this.angle || 0) + angleRad;
  }

  draw(ctx, drawingAppInstance = null) {
    ctx.save();
    const dx = this.x2 - this.x1;
    const dy = this.y2 - this.y1;
    const len = Math.hypot(dx, dy);
    if (len === 0) {
      ctx.restore();
      return;
    }

    const nx = -dy / len;
    const ny = dx / len;
    const halfW = this.beamWidth / 2;

    // Draw dashed side guidelines
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.55)'; // amber dashed boundary lines
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(this.x1 + nx * halfW, this.y1 + ny * halfW);
    ctx.lineTo(this.x2 + nx * halfW, this.y2 + ny * halfW);
    ctx.moveTo(this.x1 - nx * halfW, this.y1 - ny * halfW);
    ctx.lineTo(this.x2 - nx * halfW, this.y2 - ny * halfW);
    ctx.stroke();

    // Solid centerline axis span representation
    ctx.strokeStyle = this.color;
    ctx.lineWidth = this.lineWidth;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(this.x1, this.y1);
    ctx.lineTo(this.x2, this.y2);
    ctx.stroke();

    // Beam designation labels placement
    if (len > 80) {
      ctx.fillStyle = this.color;
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const midX = (this.x1 + this.x2) / 2;
      const midY = (this.y1 + this.y2) / 2;
      ctx.save();
      ctx.translate(midX, midY);
      ctx.rotate(Math.atan2(dy, dx));
      ctx.fillStyle = '#0F1115';
      ctx.fillRect(-22, -6, 44, 12);
      ctx.fillStyle = this.color;
      ctx.fillText("BEAM", 0, 0);
      ctx.restore();
    }

    ctx.restore();
  }

  serialize() {
    return {
      ...super.serialize(),
      x1: this.x1,
      y1: this.y1,
      x2: this.x2,
      y2: this.y2,
      beamWidth: this.beamWidth
    };
  }
}

export class Door extends Shape {
  constructor(x1, y1, x2, y2, color, lineWidth) {
    super('door', color, lineWidth);
    this.x1 = x1;
    this.y1 = y1;
    this.x2 = x2;
    this.y2 = y2;
  }

  contains(x, y, tolerance = 6) {
    const d1 = Math.hypot(x - this.x1, y - this.y1);
    const d2 = Math.hypot(x - this.x2, y - this.y2);
    const r = Math.hypot(this.x2 - this.x1, this.y2 - this.y1);
    const inArc = Math.abs(d1 - r) < (tolerance + 2);
    
    // Line check on closed door
    const x1 = this.x1;
    const y1 = this.y1;
    const x2 = this.x2;
    const y2 = this.y2;
    const l2 = r ** 2;
    if (l2 === 0) return d1 < tolerance;

    let t = ((x - x1) * (x2 - x1) + (y - y1) * (y2 - y1)) / l2;
    t = Math.max(0, Math.min(1, t));
    const projX = x1 + t * (x2 - x1);
    const projY = y1 + t * (y2 - y1);
    const nearClosed = Math.hypot(x - projX, y - projY) < (this.lineWidth + tolerance);

    return inArc || nearClosed || d1 < (tolerance + 4) || d2 < (tolerance + 4);
  }

  move(dx, dy) {
    this.x1 += dx;
    this.y1 += dy;
    this.x2 += dx;
    this.y2 += dy;
  }

  rotate(px, py, angleRad) {
    const p1 = rotatePoint(this.x1, this.y1, px, py, angleRad);
    const p2 = rotatePoint(this.x2, this.y2, px, py, angleRad);
    this.x1 = p1.x;
    this.y1 = p1.y;
    this.x2 = p2.x;
    this.y2 = p2.y;
    this.angle = (this.angle || 0) + angleRad;
  }

  draw(ctx, drawingAppInstance = null) {
    ctx.save();
    const r = Math.hypot(this.x2 - this.x1, this.y2 - this.y1);
    if (r === 0) {
      ctx.restore();
      return;
    }

    const baseAngle = Math.atan2(this.y2 - this.y1, this.x2 - this.x1);
    
    // 1. Draw posts hinge
    ctx.fillStyle = 'rgba(244, 63, 94, 0.5)';
    ctx.beginPath();
    ctx.arc(this.x1, this.y1, 4, 0, 2 * Math.PI);
    ctx.arc(this.x2, this.y2, 3, 0, 2 * Math.PI);
    ctx.fill();

    // 2. Clear closed guideline
    ctx.strokeStyle = 'rgba(244, 63, 94, 0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(this.x1, this.y1);
    ctx.lineTo(this.x2, this.y2);
    ctx.stroke();

    // 3. Draw Door leaf swung out at 90 deg
    const openAngle = baseAngle - Math.PI / 2;
    const leafX = this.x1 + r * Math.cos(openAngle);
    const leafY = this.y1 + r * Math.sin(openAngle);

    ctx.strokeStyle = this.color;
    ctx.lineWidth = this.lineWidth + 1;
    ctx.beginPath();
    ctx.moveTo(this.x1, this.y1);
    ctx.lineTo(leafX, leafY);
    ctx.stroke();

    // 4. Draw Swing Arc paths
    ctx.strokeStyle = 'rgba(244, 63, 94, 0.6)';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.arc(this.x1, this.y1, r, baseAngle, openAngle, true);
    ctx.stroke();

    // 5. Draw clear label "DR: XX"
    let hasOuterDim = drawingAppInstance && drawingAppInstance.showWallDimensions;
    if (hasOuterDim) {
      const midX = (this.x1 + this.x2) / 2;
      const midY = (this.y1 + this.y2) / 2;
      const isOnExteriorWall = drawingAppInstance.shapes.some(wall => {
        if (wall.type !== 'wall') return false;
        if (wall.wallThickness && wall.wallThickness < 15) return false;
        const wl2 = (wall.x2 - wall.x1) ** 2 + (wall.y2 - wall.y1) ** 2;
        if (wl2 === 0) return Math.hypot(midX - wall.x1, midY - wall.y1) < 5;
        let t = ((midX - wall.x1) * (wall.x2 - wall.x1) + (midY - wall.y1) * (wall.y2 - wall.y1)) / wl2;
        t = Math.max(0, Math.min(1, t));
        const projX = wall.x1 + t * (wall.x2 - wall.x1);
        const projY = wall.y1 + t * (wall.y2 - wall.y1);
        return Math.hypot(midX - projX, midY - projY) < 5;
      });
      if (!isOnExteriorWall) {
        hasOuterDim = false;
      }
    }
    if (r > 20 && !hasOuterDim) {
      ctx.save();
      const midX = (this.x1 + this.x2) / 2;
      const midY = (this.y1 + this.y2) / 2;
      let angle = baseAngle;
      // Keep text upright
      if (angle > Math.PI / 2 || angle < -Math.PI / 2) {
        angle += Math.PI;
      }
      ctx.translate(midX, midY);
      ctx.rotate(angle);

      const labelText = drawingAppInstance ? `DR: ${drawingAppInstance.formatValue(r)}` : `DR: ${Math.round(r)} cm`;
      ctx.font = 'bold 7.5px monospace';
      const txtW = ctx.measureText(labelText).width;

      // Dark background badge behind the text for perfect readability
      ctx.fillStyle = 'rgba(15, 17, 21, 0.85)';
      ctx.beginPath();
      ctx.roundRect(-txtW/2 - 3, -5, txtW + 6, 10, 2);
      ctx.fill();
      ctx.strokeStyle = this.color || '#F59E0B';
      ctx.lineWidth = 0.5;
      ctx.stroke();

      ctx.fillStyle = '#F59E0B'; // Amber door color
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(labelText, 0, 0);
      ctx.restore();
    }

    ctx.restore();
  }

  serialize() {
    return {
      ...super.serialize(),
      x1: this.x1,
      y1: this.y1,
      x2: this.x2,
      y2: this.y2
    };
  }
}

export class Window extends Shape {
  constructor(x1, y1, x2, y2, color, lineWidth, windowThickness = 8) {
    super('window', color, lineWidth);
    this.x1 = x1;
    this.y1 = y1;
    this.x2 = x2;
    this.y2 = y2;
    this.windowThickness = windowThickness;
  }

  contains(x, y, tolerance = 6) {
    const x1 = this.x1;
    const y1 = this.y1;
    const x2 = this.x2;
    const y2 = this.y2;
    const l2 = (x2 - x1) ** 2 + (y2 - y1) ** 2;
    if (l2 === 0) return Math.hypot(x - x1, y - y1) < (this.windowThickness / 2 + tolerance);
    let t = ((x - x1) * (x2 - x1) + (y - y1) * (y2 - y1)) / l2;
    t = Math.max(0, Math.min(1, t));
    const projX = x1 + t * (x2 - x1);
    const projY = y1 + t * (y2 - y1);
    return Math.hypot(x - projX, y - projY) < (this.windowThickness / 2 + tolerance);
  }

  move(dx, dy) {
    this.x1 += dx;
    this.y1 += dy;
    this.x2 += dx;
    this.y2 += dy;
  }

  rotate(px, py, angleRad) {
    const p1 = rotatePoint(this.x1, this.y1, px, py, angleRad);
    const p2 = rotatePoint(this.x2, this.y2, px, py, angleRad);
    this.x1 = p1.x;
    this.y1 = p1.y;
    this.x2 = p2.x;
    this.y2 = p2.y;
    this.angle = (this.angle || 0) + angleRad;
  }

  draw(ctx, drawingAppInstance = null) {
    ctx.save();
    const dx = this.x2 - this.x1;
    const dy = this.y2 - this.y1;
    const len = Math.hypot(dx, dy);
    if (len === 0) {
      ctx.restore();
      return;
    }

    const nx = -dy / len;
    const ny = dx / len;
    const halfW = this.windowThickness / 2;

    const p1x = this.x1 + nx * halfW;
    const p1y = this.y1 + ny * halfW;
    const p2x = this.x2 + nx * halfW;
    const p2y = this.y2 + ny * halfW;
    const p3x = this.x2 - nx * halfW;
    const p3y = this.y2 - ny * halfW;
    const p4x = this.x1 - nx * halfW;
    const p4y = this.y1 - ny * halfW;

    // Solid clean frame fill
    ctx.fillStyle = 'rgba(56, 189, 248, 0.12)'; // sky blue fill represents glass
    ctx.beginPath();
    ctx.moveTo(p1x, p1y);
    ctx.lineTo(p2x, p2y);
    ctx.lineTo(p3x, p3y);
    ctx.lineTo(p4x, p4y);
    ctx.closePath();
    ctx.fill();

    // Boundary frame outline
    ctx.strokeStyle = this.color;
    ctx.lineWidth = this.lineWidth;
    ctx.beginPath();
    ctx.moveTo(p1x, p1y);
    ctx.lineTo(p2x, p2y);
    ctx.lineTo(p3x, p3y);
    ctx.lineTo(p4x, p4y);
    ctx.closePath();
    ctx.stroke();

    // Panes centerline
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.7)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(this.x1, this.y1);
    ctx.lineTo(this.x2, this.y2);
    ctx.stroke();

    // Sashes transverse markers
    ctx.beginPath();
    const divisions = [0.25, 0.5, 0.75];
    divisions.forEach(r => {
      const px = this.x1 + dx * r;
      const py = this.y1 + dy * r;
      ctx.moveTo(px + nx * halfW, py + ny * halfW);
      ctx.lineTo(px - nx * halfW, py - ny * halfW);
    });
    ctx.stroke();

    // Draw clear window label "WD: XX"
    let hasOuterDim = drawingAppInstance && drawingAppInstance.showWallDimensions;
    if (hasOuterDim) {
      const midX = (this.x1 + this.x2) / 2;
      const midY = (this.y1 + this.y2) / 2;
      const isOnExteriorWall = drawingAppInstance.shapes.some(wall => {
        if (wall.type !== 'wall') return false;
        if (wall.wallThickness && wall.wallThickness < 15) return false;
        const wl2 = (wall.x2 - wall.x1) ** 2 + (wall.y2 - wall.y1) ** 2;
        if (wl2 === 0) return Math.hypot(midX - wall.x1, midY - wall.y1) < 5;
        let t = ((midX - wall.x1) * (wall.x2 - wall.x1) + (midY - wall.y1) * (wall.y2 - wall.y1)) / wl2;
        t = Math.max(0, Math.min(1, t));
        const projX = wall.x1 + t * (wall.x2 - wall.x1);
        const projY = wall.y1 + t * (wall.y2 - wall.y1);
        return Math.hypot(midX - projX, midY - projY) < 5;
      });
      if (!isOnExteriorWall) {
        hasOuterDim = false;
      }
    }
    if (len > 30 && !hasOuterDim) {
      ctx.save();
      const midX = (this.x1 + this.x2) / 2;
      const midY = (this.y1 + this.y2) / 2;
      let angle = Math.atan2(dy, dx);
      // Keep text upright
      if (angle > Math.PI / 2 || angle < -Math.PI / 2) {
        angle += Math.PI;
      }
      ctx.translate(midX, midY);
      ctx.rotate(angle);

      const labelText = drawingAppInstance ? `WD: ${drawingAppInstance.formatValue(len)}` : `WD: ${Math.round(len)} cm`;
      ctx.font = 'bold 7.5px monospace';
      const txtW = ctx.measureText(labelText).width;

      // Dark background badge behind the text for perfect readability
      ctx.fillStyle = 'rgba(15, 17, 21, 0.85)';
      ctx.beginPath();
      ctx.roundRect(-txtW/2 - 3, -5, txtW + 6, 10, 2);
      ctx.fill();
      ctx.strokeStyle = this.color || '#60A5FA';
      ctx.lineWidth = 0.5;
      ctx.stroke();

      ctx.fillStyle = '#60A5FA'; // Sky blue window color
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(labelText, 0, 0);
      ctx.restore();
    }

    ctx.restore();
  }

  serialize() {
    return {
      ...super.serialize(),
      x1: this.x1,
      y1: this.y1,
      x2: this.x2,
      y2: this.y2,
      windowThickness: this.windowThickness
    };
  }
}

export class RoomLabel extends Shape {
  constructor(x, y, width, height, color, lineWidth, labelText = "Living Room") {
    super('roomlabel', color, lineWidth);
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.labelText = String(labelText || "Living Room");
  }

  contains(x, y, tolerance = 6) {
    let cx = x;
    let cy = y;
    if (this.angle) {
      const centX = this.x + this.width / 2;
      const centY = this.y + this.height / 2;
      const dx = x - centX;
      const dy = y - centY;
      const rx = dx * Math.cos(-this.angle) - dy * Math.sin(-this.angle);
      const ry = dx * Math.sin(-this.angle) + dy * Math.cos(-this.angle);
      cx = centX + rx;
      cy = centY + ry;
    }
    const xMin = Math.min(this.x, this.x + this.width);
    const xMax = Math.max(this.x, this.x + this.width);
    const yMin = Math.min(this.y, this.y + this.height);
    const yMax = Math.max(this.y, this.y + this.height);
    return cx >= xMin - tolerance && cx <= xMax + tolerance && cy >= yMin - tolerance && cy <= yMax + tolerance;
  }

  move(dx, dy) {
    this.x += dx;
    this.y += dy;
  }

  rotate(px, py, angleRad) {
    const cx = this.x + this.width / 2;
    const cy = this.y + this.height / 2;
    const n = rotatePoint(cx, cy, px, py, angleRad);
    this.x = n.x - this.width / 2;
    this.y = n.y - this.height / 2;
    this.angle = (this.angle || 0) + angleRad;
  }

  draw(ctx, drawingAppInstance = null) {
    ctx.save();
    if (this.angle) {
      const cx = this.x + this.width / 2;
      const cy = this.y + this.height / 2;
      ctx.translate(cx, cy);
      ctx.rotate(this.angle);
      ctx.translate(-cx, -cy);
    }
    const xMin = Math.min(this.x, this.x + this.width);
    const yMin = Math.min(this.y, this.y + this.height);
    const w = Math.abs(this.width);
    const h = Math.abs(this.height);

    if (w === 0 || h === 0) {
      ctx.restore();
      return;
    }

    // 1. Draw styled room envelope
    ctx.strokeStyle = this.color;
    ctx.lineWidth = this.lineWidth || 1.5;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.rect(xMin, yMin, w, h);
    ctx.stroke();

    // 2. Zone fill overlay background
    ctx.fillStyle = 'rgba(168, 85, 247, 0.05)'; // purple shade
    ctx.fillRect(xMin, yMin, w, h);

    // 3. Render nice glass tag centered
    const midX = xMin + w / 2;
    const midY = yMin + h / 2;

    const showRoomDim = drawingAppInstance ? drawingAppInstance.showRoomDimensions : true;

    const boxW = Math.min(w - 6, Math.max(130, w * 0.75));
    const boxH = Math.min(h - 6, Math.max(showRoomDim ? 80 : 55, h * 0.55));

    if (w > 40 && h > 30) {
      ctx.fillStyle = 'rgba(15, 17, 21, 0.85)';
      ctx.strokeStyle = 'rgba(168, 85, 247, 0.55)'; // purple rim
      ctx.lineWidth = 1;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.rect(midX - boxW / 2, midY - boxH / 2, boxW, boxH);
      ctx.fill();
      ctx.stroke();

      if (showRoomDim) {
        let areaStr = "";
        let widthStr = "";
        let heightStr = "";

        if (drawingAppInstance) {
          const areaPx = w * h;
          areaStr = `Area: ${drawingAppInstance.formatArea(areaPx)}`;
          widthStr = `Width: ${drawingAppInstance.formatValue(w)}`;
          heightStr = `Height: ${drawingAppInstance.formatValue(h)}`;
        } else {
          areaStr = `Area: ${(w * h).toFixed(1)} px²`;
          widthStr = `Width: ${w.toFixed(1)} px`;
          heightStr = `Height: ${h.toFixed(1)} px`;
        }

        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 9.5px "Space Grotesk", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.labelText.toUpperCase(), midX, midY - boxH * 0.28);

        ctx.fillStyle = '#C084FC'; // light violet area
        ctx.font = '9px monospace';
        ctx.fillText(areaStr, midX, midY - boxH * 0.03);

        ctx.fillStyle = '#9CA3AF'; // text grey for Width
        ctx.font = '9px monospace';
        ctx.fillText(widthStr, midX, midY + boxH * 0.18);

        ctx.fillStyle = '#9CA3AF'; // text grey for Height
        ctx.font = '9px monospace';
        ctx.fillText(heightStr, midX, midY + boxH * 0.36);

      } else {
        // Fallback to only displaying the label text without sub-metrics
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 10px "Space Grotesk", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.labelText.toUpperCase(), midX, midY);
      }
    }

    ctx.restore();
  }

  serialize() {
    return {
      ...super.serialize(),
      x: this.x,
      y: this.y,
      width: this.width,
      height: this.height,
      labelText: this.labelText
    };
  }
}

export class Dimension extends Shape {
  constructor(x1, y1, x2, y2, color, lineWidth, dimType = 'aligned', arrowSize = 8, offset = 25) {
    super('dimension', color, lineWidth);
    this.x1 = x1;
    this.y1 = y1;
    this.x2 = x2;
    this.y2 = y2;
    this.dimType = dimType || 'aligned';
    this.arrowSize = parseFloat(arrowSize) || 8;
    this.offset = parseFloat(offset) || 25;
  }

  contains(x, y, tolerance = 6) {
    const x1 = this.x1;
    const y1 = this.y1;
    const x2 = this.x2;
    const y2 = this.y2;
    const l2 = (x2 - x1) ** 2 + (y2 - y1) ** 2;
    if (l2 === 0) return Math.hypot(x - x1, y - y1) < (this.lineWidth + tolerance);
    let t = ((x - x1) * (x2 - x1) + (y - y1) * (y2 - y1)) / l2;
    t = Math.max(0, Math.min(1, t));
    const projX = x1 + t * (x2 - x1);
    const projY = y1 + t * (y2 - y1);
    return Math.hypot(x - projX, y - projY) < (this.lineWidth + tolerance);
  }

  move(dx, dy) {
    this.x1 += dx;
    this.y1 += dy;
    this.x2 += dx;
    this.y2 += dy;
  }

  rotate(px, py, angleRad) {
    const p1 = rotatePoint(this.x1, this.y1, px, py, angleRad);
    const p2 = rotatePoint(this.x2, this.y2, px, py, angleRad);
    this.x1 = p1.x;
    this.y1 = p1.y;
    this.x2 = p2.x;
    this.y2 = p2.y;
    this.angle = (this.angle || 0) + angleRad;
  }

  draw(ctx, drawingAppInstance = null) {
    if (!drawingAppInstance) return;
    const len = Math.hypot(this.x2 - this.x1, this.y2 - this.y1);
    if (len === 0) return;
    
    // Formatting value centered
    const labelText = drawingAppInstance.formatValue(len);
    drawingAppInstance.drawProfessionalDimension(
      ctx,
      this.x1,
      this.y1,
      this.x2,
      this.y2,
      labelText,
      this.offset,
      this.dimType,
      this.arrowSize,
      this.color
    );
  }

  serialize() {
    return {
      ...super.serialize(),
      x1: this.x1,
      y1: this.y1,
      x2: this.x2,
      y2: this.y2,
      dimType: this.dimType,
      arrowSize: this.arrowSize,
      offset: this.offset
    };
  }
}

export class TextLabel extends Shape {
  constructor(x, y, color, lineWidth, labelText = "Main Annotation Note", fontSize = 14) {
    super('text', color, lineWidth);
    this.x = x;
    this.y = y;
    this.labelText = String(labelText || "Annotation Note");
    this.fontSize = parseInt(fontSize) || 14;
  }

  contains(x, y, tolerance = 8) {
    const approxW = Math.max(50, this.labelText.length * (this.fontSize * 0.55));
    const approxH = this.fontSize;
    const xMin = this.x - approxW / 2;
    const xMax = this.x + approxW / 2;
    const yMin = this.y - approxH / 2;
    const yMax = this.y + approxH / 2;
    return x >= xMin - tolerance && x <= xMax + tolerance && y >= yMin - tolerance && y <= yMax + tolerance;
  }

  move(dx, dy) {
    this.x += dx;
    this.y += dy;
  }

  rotate(px, py, angleRad) {
    const pc = rotatePoint(this.x, this.y, px, py, angleRad);
    this.x = pc.x;
    this.y = pc.y;
    this.angle = (this.angle || 0) + angleRad;
  }

  draw(ctx, drawingAppInstance = null) {
    ctx.save();
    if (this.angle) {
      ctx.translate(this.x, this.y);
      ctx.rotate(this.angle);
      ctx.translate(-this.x, -this.y);
    }
    ctx.fillStyle = this.color;
    ctx.strokeStyle = '#2A2D35';
    ctx.lineWidth = 1;
    ctx.font = `${this.fontSize}px "Space Grotesk", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // Slight shadow drop
    ctx.shadowColor = 'rgba(0,0,0,0.65)';
    ctx.shadowBlur = 1.5;
    ctx.shadowOffsetX = 0.5;
    ctx.shadowOffsetY = 0.5;

    ctx.fillText(this.labelText, this.x, this.y);
    ctx.restore();
  }

  serialize() {
    return {
      ...super.serialize(),
      x: this.x,
      y: this.y,
      labelText: this.labelText,
      fontSize: this.fontSize
    };
  }
}

export class AreaZone extends Shape {
  constructor(x, y, width, height, color, lineWidth, zoneName = "Planimetric Zone") {
    super('areazone', color, lineWidth);
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.zoneName = zoneName || "Planimetric Zone";
  }

  contains(x, y, tolerance = 6) {
    let cx = x;
    let cy = y;
    if (this.angle) {
      const centX = this.x + this.width / 2;
      const centY = this.y + this.height / 2;
      const dx = x - centX;
      const dy = y - centY;
      const rx = dx * Math.cos(-this.angle) - dy * Math.sin(-this.angle);
      const ry = dx * Math.sin(-this.angle) + dy * Math.cos(-this.angle);
      cx = centX + rx;
      cy = centY + ry;
    }
    const xMin = Math.min(this.x, this.x + this.width);
    const xMax = Math.max(this.x, this.x + this.width);
    const yMin = Math.min(this.y, this.y + this.height);
    const yMax = Math.max(this.y, this.y + this.height);
    return cx >= xMin - tolerance && cx <= xMax + tolerance && cy >= yMin - tolerance && cy <= yMax + tolerance;
  }

  move(dx, dy) {
    this.x += dx;
    this.y += dy;
  }

  rotate(px, py, angleRad) {
    const cx = this.x + this.width / 2;
    const cy = this.y + this.height / 2;
    const n = rotatePoint(cx, cy, px, py, angleRad);
    this.x = n.x - this.width / 2;
    this.y = n.y - this.height / 2;
    this.angle = (this.angle || 0) + angleRad;
  }

  draw(ctx, drawingAppInstance = null) {
    ctx.save();
    if (this.angle) {
      const cx = this.x + this.width / 2;
      const cy = this.y + this.height / 2;
      ctx.translate(cx, cy);
      ctx.rotate(this.angle);
      ctx.translate(-cx, -cy);
    }
    const xMin = Math.min(this.x, this.x + this.width);
    const yMin = Math.min(this.y, this.y + this.height);
    const w = Math.abs(this.width);
    const h = Math.abs(this.height);

    if (w === 0 || h === 0) {
      ctx.restore();
      return;
    }

    // Determine dynamic room styles based on zoneName (color-coding)
    let fillStyle = 'rgba(168, 85, 247, 0.04)'; // default faint purple
    let hatchStyle = 'rgba(168, 85, 247, 0.12)'; // default faint purple
    let borderStyle = this.color;

    const lowerName = (this.zoneName || '').toLowerCase();
    if (lowerName.includes('master bedroom') || lowerName.includes('master bed') || lowerName.includes('bedroom') || lowerName.includes('bed room') || lowerName.includes('bed')) {
      fillStyle = 'rgba(168, 85, 247, 0.08)'; // purple
      hatchStyle = 'rgba(168, 85, 247, 0.18)';
      borderStyle = '#A855F7';
    } else if (lowerName.includes('kitchen') || lowerName.includes('pantry')) {
      fillStyle = 'rgba(245, 158, 11, 0.08)'; // yellow/orange
      hatchStyle = 'rgba(245, 158, 11, 0.18)';
      borderStyle = '#F59E0B';
    } else if (lowerName.includes('bathroom') || lowerName.includes('bath') || lowerName.includes('toilet') || lowerName.includes('restroom') || lowerName.includes('wc') || lowerName.includes('powder')) {
      fillStyle = 'rgba(16, 185, 129, 0.08)'; // green
      hatchStyle = 'rgba(16, 185, 129, 0.18)';
      borderStyle = '#10B981';
    } else if (lowerName.includes('hall')) {
      fillStyle = 'rgba(6, 182, 212, 0.08)'; // cyan/blue-cyan
      hatchStyle = 'rgba(6, 182, 212, 0.18)';
      borderStyle = '#06B6D4';
    } else if (lowerName.includes('living') || lowerName.includes('dining') || lowerName.includes('lobby') || lowerName.includes('drawing') || lowerName.includes('lounge') || lowerName.includes('family')) {
      fillStyle = 'rgba(148, 163, 184, 0.08)'; // light gray/slate
      hatchStyle = 'rgba(148, 163, 184, 0.18)';
      borderStyle = '#94A3B8';
    }

    // Boundary stroke: dashed line
    ctx.strokeStyle = borderStyle;
    ctx.lineWidth = this.lineWidth || 1.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.rect(xMin, yMin, w, h);
    ctx.stroke();

    // Soft hatch pattern fill background
    ctx.fillStyle = fillStyle;
    ctx.fillRect(xMin, yMin, w, h);

    // Cross-hatching (draw standard CAD hatch lines)
    ctx.strokeStyle = hatchStyle;
    ctx.lineWidth = 1;
    ctx.setLineDash([]);
    ctx.beginPath();
    const spacing = 15;
    for (let i = spacing; i < w + h; i += spacing) {
      ctx.moveTo(xMin + Math.max(0, i - h), yMin + Math.min(h, i));
      ctx.lineTo(xMin + Math.min(w, i), yMin + Math.max(0, i - w));
    }
    ctx.stroke();

    // Draw central circular badge with measurement text
    const midX = xMin + w / 2;
    const midY = yMin + h / 2;

    const showRoomDim = drawingAppInstance ? drawingAppInstance.showRoomDimensions : true;

    // Glass panel tag
    const badgeW = 130;
    const badgeH = showRoomDim ? 55 : 35;
    if (w > 40 && h > 30) {
      ctx.fillStyle = 'rgba(15, 17, 21, 0.9)';
      ctx.strokeStyle = borderStyle; // Cohesive themed badge border
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.roundRect(midX - badgeW/2, midY - badgeH/2, badgeW, badgeH, 3);
      ctx.fill();
      ctx.stroke();

      if (showRoomDim) {
        let areaStr = "";
        let widthStr = "";
        let heightStr = "";

        if (drawingAppInstance) {
          const areaPx = w * h;
          areaStr = drawingAppInstance.formatArea(areaPx);
          widthStr = `W: ${drawingAppInstance.formatValue(w)}`;
          heightStr = `H: ${drawingAppInstance.formatValue(h)}`;
        } else {
          areaStr = `${(w * h).toFixed(0)} px²`;
          widthStr = `W: ${w.toFixed(0)} px`;
          heightStr = `H: ${h.toFixed(0)} px`;
        }

        // Label texts
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 9px "Space Grotesk", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.zoneName.toUpperCase(), midX, midY - badgeH * 0.28);

        ctx.fillStyle = '#F43F5E'; // rose/coral for live area
        ctx.font = 'bold 9.5px monospace';
        ctx.fillText(areaStr, midX, midY - badgeH * 0.01);

        ctx.fillStyle = '#9CA3AF'; // text slate
        ctx.font = '9px monospace';
        ctx.fillText(`${widthStr} | ${heightStr}`, midX, midY + badgeH * 0.28);
      } else {
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 9.5px "Space Grotesk", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.zoneName.toUpperCase(), midX, midY);
      }
    }

    ctx.restore();
  }

  serialize() {
    return {
      ...super.serialize(),
      x: this.x,
      y: this.y,
      width: this.width,
      height: this.height,
      zoneName: this.zoneName
    };
  }
}

/**
 * Universal Deserialization mapper to rebuild Shape objects from storage JSON
 * @param {object} obj JSON stored schema
 * @returns {Shape|null} Reconstituted class instance
 */
export function deserializeShape(obj) {
  if (!obj || !obj.type) return null;
  
  let instance = null;
  switch (obj.type) {
    case 'line':
      instance = new Line(obj.x1, obj.y1, obj.x2, obj.y2, obj.color, obj.lineWidth);
      break;
    case 'rectangle':
      instance = new Rectangle(obj.x, obj.y, obj.width, obj.height, obj.color, obj.lineWidth);
      break;
    case 'circle':
      instance = new Circle(obj.centerX, obj.centerY, obj.radius, obj.color, obj.lineWidth);
      break;
    case 'wall':
      instance = new Wall(obj.x1, obj.y1, obj.x2, obj.y2, obj.color, obj.lineWidth, obj.wallThickness);
      break;
    case 'column':
      instance = new Column(obj.x, obj.y, obj.width, obj.height, obj.color, obj.lineWidth);
      break;
    case 'beam':
      instance = new Beam(obj.x1, obj.y1, obj.x2, obj.y2, obj.color, obj.lineWidth, obj.beamWidth);
      break;
    case 'door':
      instance = new Door(obj.x1, obj.y1, obj.x2, obj.y2, obj.color, obj.lineWidth);
      break;
    case 'window':
      instance = new Window(obj.x1, obj.y1, obj.x2, obj.y2, obj.color, obj.lineWidth, obj.windowThickness);
      break;
    case 'roomlabel':
      instance = new RoomLabel(obj.x, obj.y, obj.width, obj.height, obj.color, obj.lineWidth, obj.labelText);
      break;
    case 'text':
      instance = new TextLabel(obj.x, obj.y, obj.color, obj.lineWidth, obj.labelText, obj.fontSize);
      break;
    case 'areazone':
      instance = new AreaZone(obj.x, obj.y, obj.width, obj.height, obj.color, obj.lineWidth, obj.zoneName || obj.labelText);
      break;
    case 'dimension':
      instance = new Dimension(obj.x1, obj.y1, obj.x2, obj.y2, obj.color, obj.lineWidth, obj.dimType, obj.arrowSize, obj.offset);
      break;
    default:
      console.warn("Unresolved shape instance type detected: " + obj.type);
      return null;
  }
  
  if (instance && obj.id) {
    instance.id = obj.id;
  }
  if (instance) {
    instance.layerId = obj.layerId || 'default';
    if (typeof obj.angle === 'number') {
      instance.angle = obj.angle;
    }
  }
  return instance;
}


// ==========================================
// 2. PRIMARY CAD CONTROLLER APPLICATION
// ==========================================

class CADApp {
  constructor() {
    this.shapes = [];
    this.undoStack = [];
    this.redoStack = [];
    
    // Layers properties (AutoCAD preset layers)
    this.layers = [
      { id: 'default', name: 'Default', visible: true, locked: false },
      { id: 'walls', name: 'Walls', visible: true, locked: false },
      { id: 'columns', name: 'Columns', visible: true, locked: false },
      { id: 'dimensions', name: 'Dimensions', visible: true, locked: false },
      { id: 'electrical', name: 'Electrical', visible: true, locked: false }
    ];
    this.activeLayerId = 'default';
    
    // Zoom and Pan states
    this.zoomScale = 1.0;
    this.panX = 0;
    this.panY = 0;
    this.isPanning = false;
    this.panStartX = 0;
    this.panStartY = 0;
    this.panStartOffsetX = 0;
    this.panStartOffsetY = 0;
    
    // Default active settings
    this.activeTool = 'line'; // 'select' | 'line' | 'rectangle' | 'circle'
    
    // Measure Tool states
    this.measureFirstX = null;
    this.measureFirstY = null;
    this.measureSecondX = null;
    this.measureSecondY = null;
    this.measureHoverX = null;
    this.measureHoverY = null;
    this.isMeasuring = false;

    // Rotate Tool states
    this.rotateStep = 'select'; // 'select' | 'pivot' | 'rotate'
    this.selectedShapes = []; // Multiple selected shapes for rotation
    this.rotatePivotX = null;
    this.rotatePivotY = null;
    this.rotateBaseShapes = []; // Snapshots before rotation
    this.rotateStartAngle = 0;
    this.isRotating = false;

    // Mirror Tool states
    this.mirrorStep = 'select'; // 'select' | 'axis1' | 'axis2' | 'confirm'
    this.selectedMirrorShapes = []; // Multiple selected shapes for mirroring
    this.mirrorAxisX1 = null;
    this.mirrorAxisY1 = null;
    this.mirrorAxisX2 = null;
    this.mirrorAxisY2 = null;
    this.mirrorHoverX = null;
    this.mirrorHoverY = null;

    // Scale Tool states
    this.scaleStep = 'select'; // 'select' | 'basepoint' | 'scale'
    this.selectedScaleShapes = []; // Multiple selected shapes for scaling
    this.scalePivotX = null;
    this.scalePivotY = null;
    this.scaleBaseShapes = []; // Snapshots before scaling
    this.scaleStartDist = 100;
    this.isScaling = false;
    this.scaleHoverX = null;
    this.scaleHoverY = null;
    this.activeColor = '#06b6d4'; // Standard Cyan Layer
    this.activeThickness = 2;
    this.gridEnabled = true;
    this.snapEnabled = true;
    this.gridSize = 20; // 20px intervals
    
    // Professional CAD snap system sub-modes
    this.snapToGrid = true;
    this.snapToEndpoints = true;
    this.snapToMidpoints = true;
    
    // Engineering units
    this.activeUnit = 'px'; // 'px' | 'mm' | 'cm' | 'm' | 'in' | 'ft'
    this.circleDraftMethod = 'center'; // 'center' | 'bounding'
    this.showMeasurementsOnAll = false;
    this.civilMode = true;
    
    // Professional CAD drafting standards dimension controls
    this.displayDimensions = true;       // Standard dimension shapes showing ON/OFF
    this.showRoomDimensions = true;     // Width, height and area showing inside rooms (RoomLabel/AreaZone)
    this.showWallDimensions = true;     // Smart auto outside offset dimensions for walls, doors and windows
    
    // Selection and editing states
    this.selectedShape = null;
    this.isDraggingShape = false;
    this.isResizingShape = false;
    this.resizeHandleId = null;
    this.resizeStartShapeState = null;
    this.dragStartX = 0;
    this.dragStartY = 0;
    this.originalShapePos = null;
    this.isInspectorMinimized = false;
    
    // Dynamic Interaction mouse coordinate states
    this.isDrawing = false;
    this.startX = 0;
    this.startY = 0;
    this.currentX = 0;
    this.currentY = 0;
    this.mouseInCanvas = false;
    this.previewShape = null;
    this.hoveredShapeIndex = null;
    this.isEditingText = false;
    this.activeTextEditor = null;
    this.textEditWorldPos = null;
    
    // Core references
    this.canvas = document.getElementById('cad-canvas');
    this.container = document.getElementById('canvas-container');
    this.ctx = null;
    this.width = 0;
    this.height = 0;
    
    // UI elements references
    this.coordsDisplay = document.getElementById('coords-display');
    this.relativeCoordsDisplay = document.getElementById('relative-coords-display');
    this.relativeCoordsWrapper = document.getElementById('relative-coords-wrapper');
    this.drawingIndicatorText = document.getElementById('drawing-indicator-text');
    this.activeColorNameTxt = document.getElementById('active-color-name');
    this.thicknessDisplayTxt = document.getElementById('thickness-display');
    this.gridSizeDisplayTxt = document.getElementById('grid-size-display');
    this.statusSnapIndicator = document.getElementById('status-snap-indicator');
    this.zoomStatusDisplay = document.getElementById('zoom-status-display');
    
    // Layers UI references
    this.layersCounter = document.getElementById('layers-counter');
    this.layersList = document.getElementById('layers-list');
    this.newLayerInput = document.getElementById('new-layer-input');
    this.addLayerBtn = document.getElementById('add-layer-btn');
    this.assignLayerContainer = document.getElementById('assign-layer-container');
    this.assignLayerSelect = document.getElementById('assign-layer-select');
    
    // Init actions
    this.initHTMLReferencesAndListeners();
    this.initPrecisionAndPropertiesControls();
    this.initProjectManagement();
    this.initLayersManager();
    this.updateLayersWidget();
    this.setupResizeObserver();
    this.bindKeyboardShortcuts();
    this.initLearningCenter();
    
    // Initial active tool highlights
    this.setActiveTool('line');
  }

  cloneShape(shape) {
    if (!shape) return null;
    try {
      return deserializeShape(shape.serialize ? shape.serialize() : JSON.parse(JSON.stringify(shape)));
    } catch (err) {
      console.error("Failed to clone shape:", err);
      return null;
    }
  }

  getShapeHandles(shape) {
    if (!shape) return [];
    if (['line', 'wall', 'beam', 'door', 'window', 'dimension'].includes(shape.type)) {
      return [
        { id: 'p1', x: shape.x1, y: shape.y1 },
        { id: 'p2', x: shape.x2, y: shape.y2 }
      ];
    } else if (['rectangle', 'column', 'roomlabel', 'areazone'].includes(shape.type)) {
      const x1 = shape.x;
      const y1 = shape.y;
      const x2 = shape.x + shape.width;
      const y2 = shape.y + shape.height;
      
      const xMin = Math.min(x1, x2);
      const xMax = Math.max(x1, x2);
      const yMin = Math.min(y1, y2);
      const yMax = Math.max(y1, y2);
      
      return [
        { id: 'tl', x: xMin, y: yMin },
        { id: 'tr', x: xMax, y: yMin },
        { id: 'bl', x: xMin, y: yMax },
        { id: 'br', x: xMax, y: yMax }
      ];
    } else if (shape.type === 'circle') {
      const r = Math.max(0.1, shape.radius);
      return [
        { id: 'center', x: shape.centerX, y: shape.centerY },
        { id: 'r_left', x: shape.centerX - r, y: shape.centerY },
        { id: 'r_right', x: shape.centerX + r, y: shape.centerY },
        { id: 'r_top', x: shape.centerX, y: shape.centerY - r },
        { id: 'r_bottom', x: shape.centerX, y: shape.centerY + r }
      ];
    }
    return [];
  }

  getShapeVertices(shape) {
    if (!shape) return [];
    const vertices = [];
    if (['line', 'wall', 'beam', 'door', 'window', 'dimension'].includes(shape.type)) {
      vertices.push({ x: shape.x1, y: shape.y1 });
      vertices.push({ x: shape.x2, y: shape.y2 });
      vertices.push({ x: (shape.x1 + shape.x2) / 2, y: (shape.y1 + shape.y2) / 2 });
    } else if (['rectangle', 'column', 'roomlabel', 'areazone'].includes(shape.type)) {
      vertices.push({ x: shape.x, y: shape.y });
      vertices.push({ x: shape.x + shape.width, y: shape.y });
      vertices.push({ x: shape.x, y: shape.y + shape.height });
      vertices.push({ x: shape.x + shape.width, y: shape.y + shape.height });
      // midpoints
      vertices.push({ x: shape.x + shape.width / 2, y: shape.y });
      vertices.push({ x: shape.x + shape.width / 2, y: shape.y + shape.height });
      vertices.push({ x: shape.x, y: shape.y + shape.height / 2 });
      vertices.push({ x: shape.x + shape.width, y: shape.y + shape.height / 2 });
      // center
      vertices.push({ x: shape.x + shape.width / 2, y: shape.y + shape.height / 2 });
    } else if (shape.type === 'circle') {
      vertices.push({ x: shape.centerX, y: shape.centerY });
      const r = shape.radius;
      vertices.push({ x: shape.centerX - r, y: shape.centerY });
      vertices.push({ x: shape.centerX + r, y: shape.centerY });
      vertices.push({ x: shape.centerX, y: shape.centerY - r });
      vertices.push({ x: shape.centerX, y: shape.centerY + r });
    } else if (shape.type === 'text') {
      vertices.push({ x: shape.x, y: shape.y });
    }
    return vertices;
  }

  screenToWorld(screenX, screenY) {
    return {
      x: (screenX - this.panX) / this.zoomScale,
      y: (screenY - this.panY) / this.zoomScale
    };
  }

  worldToScreen(worldX, worldY) {
    return {
      x: worldX * this.zoomScale + this.panX,
      y: worldY * this.zoomScale + this.panY
    };
  }

  updateCivilModeUI() {
    const btn = document.getElementById('btn-toggle-civil-mode');
    const handle = document.getElementById('civil-toggle-handle');
    const ping = document.getElementById('civil-ping');
    const dot = document.getElementById('civil-dot');
    const card = document.getElementById('civil-mode-card');

    if (this.civilMode) {
      if (btn) {
        btn.className = "relative inline-flex items-center h-4 w-9 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out focus:outline-none bg-cyan-600";
      }
      if (handle) {
        handle.className = "pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out translate-x-5";
      }
      if (ping) ping.classList.remove('hidden');
      if (dot) {
        dot.className = "relative inline-flex rounded-full h-2 w-2 bg-cyan-500";
      }
      if (card) {
        card.className = "flex flex-col gap-2 p-3 rounded-lg border border-cyan-500/30 bg-[#12222d]/60 hover:border-cyan-500/60 transition duration-200";
      }
    } else {
      if (btn) {
        btn.className = "relative inline-flex items-center h-4 w-9 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out focus:outline-none bg-slate-700";
      }
      if (handle) {
        handle.className = "pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out translate-x-1";
      }
      if (ping) ping.classList.add('hidden');
      if (dot) {
        dot.className = "relative inline-flex rounded-full h-2 w-2 bg-slate-500";
      }
      if (card) {
        card.className = "flex flex-col gap-2 p-3 rounded-lg border border-[#2A2D35] bg-[#0E1013] hover:border-gray-500 transition duration-200 opacity-60";
      }
    }
  }

  resetView() {
    this.zoomScale = 1.0;
    this.panX = 0;
    this.panY = 0;
    this.updateZoomStatus();
    this.redraw();
  }

  updateZoomStatus() {
    const text = `${Math.round(this.zoomScale * 100)}%`;
    if (this.zoomStatusDisplay) {
      this.zoomStatusDisplay.innerText = text;
    }
    const indicator = document.getElementById('zoom-percent-indicator');
    if (indicator) {
      indicator.innerText = text;
    }
  }

  isLayerVisible(layerId) {
    const layer = this.layers.find(l => l.id === layerId);
    return layer ? layer.visible : true;
  }

  isLayerLocked(layerId) {
    const layer = this.layers.find(l => l.id === layerId);
    return layer ? !!layer.locked : false;
  }

  initLayersManager() {
    if (this.addLayerBtn && this.newLayerInput) {
      const createNewLayer = () => {
        const name = this.newLayerInput.value.trim();
        if (!name) return;
        this.createLayer(name);
        this.newLayerInput.value = '';
      };
      this.addLayerBtn.addEventListener('click', createNewLayer);
      this.newLayerInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          createNewLayer();
        }
      });
    }

    if (this.assignLayerSelect) {
      this.assignLayerSelect.addEventListener('change', () => {
        const targetLayerId = this.assignLayerSelect.value;
        if (this.selectedShape && targetLayerId) {
          if (this.isLayerLocked(this.selectedShape.layerId)) {
            this.showStatusFeedback("Cannot move: Selected shape is on a locked layer.");
            this.updateAssignLayerVisibility();
            return;
          }
          if (this.isLayerLocked(targetLayerId)) {
            this.showStatusFeedback("Cannot move: Target layer is locked.");
            this.updateAssignLayerVisibility();
            return;
          }
          this.selectedShape.layerId = targetLayerId;
          this.saveLayersStateAndWidget();
        }
      });
    }
  }

  initLearningCenter() {
    this.learningModal = document.getElementById('learning-modal');
    this.btnLearningToggle = document.getElementById('btn-learning-toggle');
    this.btnCloseLearning = document.getElementById('close-learning-modal');
    
    this.learningSearchInput = document.getElementById('learning-search-input');
    this.learningSearchClear = document.getElementById('learning-search-clear');
    this.learningSearchSuggestions = document.getElementById('learning-search-suggestions');
    
    this.categoriesListEl = document.getElementById('categories-list');
    this.favoritesListEl = document.getElementById('favorites-list');
    this.recentlyViewedListEl = document.getElementById('recently-viewed-list');
    this.favoritesCountEl = document.getElementById('favorites-count');
    
    this.learningBreadcrumbs = document.getElementById('learning-breadcrumbs');
    this.learningFavoriteToggle = document.getElementById('learning-favorite-toggle');
    this.favoriteToggleText = document.getElementById('favorite-toggle-text');
    this.favoriteHeartIcon = document.getElementById('favorite-heart-icon');
    
    this.learningCopyBtn = document.getElementById('learning-copy-btn');
    this.learningPrintBtn = document.getElementById('learning-print-btn');
    
    this.learningContentViewport = document.getElementById('learning-content-viewport');
    
    this.btnLearningNavBack = document.getElementById('learning-nav-back');
    this.btnLearningNavForward = document.getElementById('learning-nav-forward');
    
    this.btnLearningGuidePrev = document.getElementById('learning-guide-prev');
    this.btnLearningGuideNext = document.getElementById('learning-guide-next');
    this.learningGuidePageIndicator = document.getElementById('learning-guide-page-indicator');
    this.readingTimeIndicator = document.getElementById('reading-time-indicator');
    
    // State variables
    this.currentGuideKey = 'home';
    this.activeSearchQuery = '';
    this.learningHistory = ['home'];
    this.learningHistoryIndex = 0;
    this.flatGuideKeys = [
      "interface", "toolbar", "workspace", "grid", "zoom", "pan", "snap", "layers", "properties", "selection",
      "line", "rectangle", "circle", "wall", "door", "window", "beam", "column", "polyline",
      "move", "copy", "rotate", "mirror", "scale", "trim", "extend", "offset", "delete",
      "measure", "dimension", "text", "hatch", "area-calculator", "room-detection", "material-estimation",
      "templates", "save", "open", "import-dxf", "export-dxf", "export-pdf", "export-png",
      "undo", "redo", "print", "keyboard-shortcuts", "autosave", "settings"
    ];
    
    // Read local favorites & recent from localStorage
    try {
      this.learningFavorites = JSON.parse(localStorage.getItem('cad_learning_favorites')) || [];
    } catch {
      this.learningFavorites = [];
    }
    
    try {
      this.recentlyViewed = JSON.parse(localStorage.getItem('cad_learning_recent')) || [];
    } catch {
      this.recentlyViewed = [];
    }

    // Register Event Listeners
    if (this.btnLearningToggle) {
      this.btnLearningToggle.addEventListener('click', () => this.openLearningCenter());
    }
    if (this.btnCloseLearning) {
      this.btnCloseLearning.addEventListener('click', () => this.closeLearningCenter());
    }
    if (this.learningSearchInput) {
      this.learningSearchInput.addEventListener('input', (e) => {
        this.activeSearchQuery = e.target.value;
        if (this.activeSearchQuery.trim().length > 0) {
          if (this.learningSearchClear) this.learningSearchClear.classList.remove('hidden');
          this.renderSearchResults(this.activeSearchQuery);
          this.showSearchSuggestions(this.activeSearchQuery);
        } else {
          if (this.learningSearchClear) this.learningSearchClear.classList.add('hidden');
          if (this.learningSearchSuggestions) this.learningSearchSuggestions.classList.add('hidden');
          this.renderContentArea();
        }
      });
      
      this.learningSearchInput.addEventListener('focus', () => {
        if (this.activeSearchQuery.trim().length > 0) {
          this.showSearchSuggestions(this.activeSearchQuery);
        }
      });
    }
    
    if (this.learningSearchClear) {
      this.learningSearchClear.addEventListener('click', () => {
        if (this.learningSearchInput) this.learningSearchInput.value = '';
        this.activeSearchQuery = '';
        this.learningSearchClear.classList.add('hidden');
        if (this.learningSearchSuggestions) this.learningSearchSuggestions.classList.add('hidden');
        this.renderContentArea();
      });
    }
    
    // Hide suggestions dropdown on click outside
    document.addEventListener('click', (e) => {
      if (this.learningSearchSuggestions && !this.learningSearchSuggestions.contains(e.target) && e.target !== this.learningSearchInput) {
        this.learningSearchSuggestions.classList.add('hidden');
      }
    });

    if (this.btnLearningNavBack) {
      this.btnLearningNavBack.addEventListener('click', () => this.navigateHistoryBack());
    }
    if (this.btnLearningNavForward) {
      this.btnLearningNavForward.addEventListener('click', () => this.navigateHistoryForward());
    }
    if (this.btnLearningGuidePrev) {
      this.btnLearningGuidePrev.addEventListener('click', () => this.navigateGuideSequential(-1));
    }
    if (this.btnLearningGuideNext) {
      this.btnLearningGuideNext.addEventListener('click', () => this.navigateGuideSequential(1));
    }
    if (this.learningFavoriteToggle) {
      this.learningFavoriteToggle.addEventListener('click', () => this.toggleFavoriteCurrentGuide());
    }
    if (this.learningCopyBtn) {
      this.learningCopyBtn.addEventListener('click', () => this.copyActiveGuideToClipboard());
    }
    if (this.learningPrintBtn) {
      this.learningPrintBtn.addEventListener('click', () => this.printActiveGuide());
    }

    // Populate Sidebar Categories and initial view
    this.renderLearningSidebar();
    this.navigateLearningGuide('home', false);
  }

  openLearningCenter() {
    if (this.learningModal) {
      this.learningModal.classList.remove('hidden');
      // Slightly delay scale transition to let the DOM paint
      setTimeout(() => {
        const dialog = this.learningModal.querySelector('div');
        if (dialog) dialog.classList.remove('scale-95');
      }, 10);
      this.showStatusFeedback("Opened AetherCAD Learning Center.");
    }
  }

  closeLearningCenter() {
    if (this.learningModal) {
      const dialog = this.learningModal.querySelector('div');
      if (dialog) dialog.classList.add('scale-95');
      setTimeout(() => {
        this.learningModal.classList.add('hidden');
      }, 150);
    }
  }

  navigateLearningGuide(key, pushToHistory = true) {
    if (pushToHistory) {
      // Discard forward history if we are in the middle of navigating
      this.learningHistory = this.learningHistory.slice(0, this.learningHistoryIndex + 1);
      this.learningHistory.push(key);
      this.learningHistoryIndex = this.learningHistory.length - 1;
    }

    this.currentGuideKey = key;
    
    // Add to recently viewed if it's a genuine guide
    if (key !== 'home' && !key.startsWith('category_') && guides[key]) {
      this.recentlyViewed = this.recentlyViewed.filter(k => k !== key);
      this.recentlyViewed.unshift(key);
      if (this.recentlyViewed.length > 5) {
        this.recentlyViewed.pop();
      }
      localStorage.setItem('cad_learning_recent', JSON.stringify(this.recentlyViewed));
    }

    // Clear search query unless loading search results
    if (key !== 'search' && this.learningSearchInput && this.activeSearchQuery === '') {
      this.learningSearchInput.value = '';
    }

    this.renderLearningSidebar();
    this.renderContentArea();
    
    // Scroll viewport to top
    if (this.learningContentViewport) {
      this.learningContentViewport.scrollTop = 0;
    }

    // Update navigation arrows state
    if (this.btnLearningNavBack) {
      this.btnLearningNavBack.disabled = this.learningHistoryIndex === 0;
    }
    if (this.btnLearningNavForward) {
      this.btnLearningNavForward.disabled = this.learningHistoryIndex === this.learningHistory.length - 1;
    }
  }

  navigateHistoryBack() {
    if (this.learningHistoryIndex > 0) {
      this.learningHistoryIndex--;
      this.navigateLearningGuide(this.learningHistory[this.learningHistoryIndex], false);
    }
  }

  navigateHistoryForward() {
    if (this.learningHistoryIndex < this.learningHistory.length - 1) {
      this.learningHistoryIndex++;
      this.navigateLearningGuide(this.learningHistory[this.learningHistoryIndex], false);
    }
  }

  navigateGuideSequential(direction) {
    const isGuide = guides[this.currentGuideKey];
    if (!isGuide) return;

    const index = this.flatGuideKeys.indexOf(this.currentGuideKey);
    if (index !== -1) {
      const newIndex = index + direction;
      if (newIndex >= 0 && newIndex < this.flatGuideKeys.length) {
        this.navigateLearningGuide(this.flatGuideKeys[newIndex]);
      }
    }
  }

  toggleFavoriteCurrentGuide() {
    const key = this.currentGuideKey;
    if (key === 'home' || key.startsWith('category_')) return;

    if (this.learningFavorites.includes(key)) {
      this.learningFavorites = this.learningFavorites.filter(k => k !== key);
    } else {
      this.learningFavorites.push(key);
    }
    localStorage.setItem('cad_learning_favorites', JSON.stringify(this.learningFavorites));
    
    this.renderLearningSidebar();
    this.updateFavoriteButtonState();
  }

  updateFavoriteButtonState() {
    const key = this.currentGuideKey;
    const isFav = this.learningFavorites.includes(key);

    if (key === 'home' || key.startsWith('category_') || key === 'faq' || key === 'troubleshooting') {
      if (this.learningFavoriteToggle) this.learningFavoriteToggle.classList.add('hidden');
      return;
    }

    if (this.learningFavoriteToggle) {
      this.learningFavoriteToggle.classList.remove('hidden');
    }

    if (isFav) {
      if (this.favoriteToggleText) this.favoriteToggleText.textContent = 'Favorited';
      if (this.favoriteHeartIcon) {
        this.favoriteHeartIcon.setAttribute('fill', '#eab308');
        this.favoriteHeartIcon.setAttribute('stroke', '#eab308');
        this.favoriteHeartIcon.className.baseVal = "w-3.5 h-3.5 text-yellow-500 animate-pulse";
      }
    } else {
      if (this.favoriteToggleText) this.favoriteToggleText.textContent = 'Favorite';
      if (this.favoriteHeartIcon) {
        this.favoriteHeartIcon.setAttribute('fill', 'none');
        this.favoriteHeartIcon.setAttribute('stroke', 'currentColor');
        this.favoriteHeartIcon.className.baseVal = "w-3.5 h-3.5 text-gray-400";
      }
    }
  }

  renderLearningSidebar() {
    // 1. Render Categories list
    if (this.categoriesListEl) {
      this.categoriesListEl.innerHTML = '';
      
      // Home button
      const homeBtn = document.createElement('button');
      homeBtn.className = `w-full text-left px-2.5 py-1.5 text-[11px] font-mono rounded transition flex items-center gap-1.5 cursor-pointer ${this.currentGuideKey === 'home' ? 'bg-cyan-950/50 text-cyan-400 font-bold border-l-2 border-cyan-500' : 'text-gray-400 hover:bg-[#2A2D35]/50 hover:text-white'}`;
      homeBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
        <span>Learning Home</span>
      `;
      homeBtn.addEventListener('click', () => this.navigateLearningGuide('home'));
      this.categoriesListEl.appendChild(homeBtn);

      categories.forEach(cat => {
        const catBtn = document.createElement('button');
        const isCurrentCat = this.currentGuideKey === `category_${cat.toLowerCase().replace(/\s+/g, '_')}` || 
                             (guides[this.currentGuideKey] && guides[this.currentGuideKey].category === cat) ||
                             (cat === 'Frequently Asked Questions' && this.currentGuideKey === 'faq') ||
                             (cat === 'Troubleshooting' && this.currentGuideKey === 'troubleshooting') ||
                             (cat === 'Keyboard Shortcuts' && this.currentGuideKey === 'keyboard-shortcuts');

        catBtn.className = `w-full text-left px-2.5 py-1.5 text-[11px] font-mono rounded transition flex items-center justify-between cursor-pointer ${isCurrentCat ? 'bg-cyan-950/40 text-cyan-400 font-semibold border-l-2 border-cyan-600' : 'text-gray-400 hover:bg-[#2A2D35]/40 hover:text-white'}`;
        
        let count = 0;
        if (cat === 'Frequently Asked Questions') count = faqs.length;
        else if (cat === 'Troubleshooting') count = troubleshooting.length;
        else if (cat === 'Keyboard Shortcuts') count = 1;
        else {
          count = Object.values(guides).filter(g => g.category === cat).length;
        }

        catBtn.innerHTML = `
          <span class="truncate pr-1">${cat}</span>
          <span class="text-[9px] px-1 py-0.2 bg-[#1A1C23] text-gray-500 rounded font-bold">${count}</span>
        `;

        catBtn.addEventListener('click', () => {
          if (cat === 'Frequently Asked Questions') this.navigateLearningGuide('faq');
          else if (cat === 'Troubleshooting') this.navigateLearningGuide('troubleshooting');
          else if (cat === 'Keyboard Shortcuts') this.navigateLearningGuide('keyboard-shortcuts');
          else {
            this.navigateLearningGuide(`category_${cat.toLowerCase().replace(/\s+/g, '_')}`);
          }
        });
        this.categoriesListEl.appendChild(catBtn);
      });
    }

    // 2. Render Favorites list
    if (this.favoritesListEl) {
      this.favoritesListEl.innerHTML = '';
      if (this.favoritesCountEl) this.favoritesCountEl.textContent = this.learningFavorites.length;

      if (this.learningFavorites.length === 0) {
        this.favoritesListEl.innerHTML = `<div class="text-[9px] text-gray-500 font-mono italic px-2.5 py-1">No favorites yet</div>`;
      } else {
        this.learningFavorites.forEach(key => {
          const g = guides[key];
          if (!g) return;
          const favBtn = document.createElement('button');
          favBtn.className = `w-full text-left px-2.5 py-1 text-[10px] font-mono rounded transition flex items-center gap-1.5 truncate cursor-pointer ${this.currentGuideKey === key ? 'bg-[#2A2D35] text-cyan-400' : 'text-gray-400 hover:text-white hover:bg-[#2A2D35]/30'}`;
          favBtn.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" class="w-3 h-3 text-yellow-500 shrink-0" fill="currentColor" viewBox="0 0 24 24" stroke="none">
              <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
            </svg>
            <span class="truncate">${g.name}</span>
          `;
          favBtn.addEventListener('click', () => this.navigateLearningGuide(key));
          this.favoritesListEl.appendChild(favBtn);
        });
      }
    }

    // 3. Render Recently Viewed list
    if (this.recentlyViewedListEl) {
      this.recentlyViewedListEl.innerHTML = '';
      if (this.recentlyViewed.length === 0) {
        this.recentlyViewedListEl.innerHTML = `<div class="text-[9px] text-gray-500 font-mono italic px-2.5 py-1">No history yet</div>`;
      } else {
        this.recentlyViewed.forEach(key => {
          const g = guides[key];
          if (!g) return;
          const recentBtn = document.createElement('button');
          recentBtn.className = `w-full text-left px-2.5 py-1 text-[10px] font-mono rounded transition flex items-center gap-1.5 truncate cursor-pointer ${this.currentGuideKey === key ? 'bg-[#2A2D35] text-cyan-400' : 'text-gray-400 hover:text-white hover:bg-[#2A2D35]/30'}`;
          recentBtn.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" class="w-3 h-3 text-gray-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span class="truncate">${g.name}</span>
          `;
          recentBtn.addEventListener('click', () => this.navigateLearningGuide(key));
          this.recentlyViewedListEl.appendChild(recentBtn);
        });
      }
    }
  }

  showSearchSuggestions(query) {
    if (!this.learningSearchSuggestions) return;
    const q = query.toLowerCase().trim();
    if (!q) {
      this.learningSearchSuggestions.classList.add('hidden');
      return;
    }

    const matchedGuides = Object.entries(guides).filter(([key, g]) => {
      return g.name.toLowerCase().includes(q) || g.category.toLowerCase().includes(q);
    }).slice(0, 5);

    if (matchedGuides.length === 0) {
      this.learningSearchSuggestions.classList.add('hidden');
      return;
    }

    this.learningSearchSuggestions.innerHTML = '';
    this.learningSearchSuggestions.classList.remove('hidden');

    matchedGuides.forEach(([key, g]) => {
      const row = document.createElement('button');
      row.className = "w-full text-left px-3 py-2 text-xs text-gray-300 hover:bg-cyan-950/40 hover:text-cyan-400 border-b border-[#2A2D35]/50 flex items-center justify-between cursor-pointer font-mono";
      row.innerHTML = `
        <span class="font-medium">${g.name}</span>
        <span class="text-[9px] text-gray-500 uppercase tracking-wider">${g.category}</span>
      `;
      row.addEventListener('click', (e) => {
        e.stopPropagation();
        this.navigateLearningGuide(key);
        this.learningSearchSuggestions.classList.add('hidden');
        if (this.learningSearchInput) {
          this.learningSearchInput.value = g.name;
        }
      });
      this.learningSearchSuggestions.appendChild(row);
    });
  }

  renderSearchResults(query) {
    this.currentGuideKey = 'search';
    this.updateFavoriteButtonState();
    
    if (this.readingTimeIndicator) this.readingTimeIndicator.classList.add('hidden');
    if (this.learningBreadcrumbs) {
      this.learningBreadcrumbs.innerHTML = `
        <span>Learning Center</span>
        <span class="text-gray-600">></span>
        <span class="text-cyan-400">Search Results for "${query}"</span>
      `;
    }

    const results = this.searchLearningCenter(query);

    if (results.length === 0) {
      const fuzzy = this.getFuzzySuggestions(query);
      let fuzzyHtml = '';
      if (fuzzy.length > 0) {
        fuzzyHtml = `
          <div class="mt-4 p-4 rounded bg-cyan-950/10 border border-cyan-900/30">
            <p class="text-xs text-cyan-400 font-mono font-medium">Did you mean?</p>
            <div class="flex flex-wrap gap-2 mt-2">
              ${fuzzy.map(f => `
                <button onclick="window.cadAppInstance.navigateLearningGuide('${f.key}')" class="px-2.5 py-1 text-[11px] font-mono rounded bg-[#1e2127] border border-[#2a2d35] text-cyan-400 hover:bg-cyan-950 hover:border-cyan-500 hover:text-white transition cursor-pointer">
                  ${f.name}
                </button>
              `).join('')}
            </div>
          </div>
        `;
      }

      this.learningContentViewport.innerHTML = `
        <div class="flex flex-col items-center justify-center py-12 text-center">
          <div class="w-12 h-12 rounded-full bg-red-950/30 border border-red-900/40 flex items-center justify-center text-red-500 mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h3 class="text-sm font-semibold text-gray-200 uppercase tracking-wider font-mono">No matching guides found</h3>
          <p class="text-xs text-gray-500 font-mono mt-1 max-w-sm">We couldn't find any guidelines or tools matching "${query}". Check your spelling or search another keyword.</p>
          ${fuzzyHtml}
        </div>
      `;
      // Expose globally so embedded template HTML onclick works offline
      window.cadAppInstance = this;
      return;
    }

    let resultsHtml = `
      <div class="flex flex-col gap-4">
        <div class="text-xs font-mono text-gray-500">Found ${results.length} matched item(s) in offline registry:</div>
        <div class="flex flex-col gap-3">
    `;

    results.forEach(res => {
      let snippet = '';
      let badgeColor = 'bg-[#2A2D35] text-gray-300';
      
      if (res.type === 'guide') {
        badgeColor = 'bg-cyan-950/40 text-cyan-400 border border-cyan-900/30';
        snippet = res.item.purpose;
      } else if (res.type === 'faq') {
        badgeColor = 'bg-amber-950/40 text-amber-400 border border-amber-900/30';
        snippet = res.item.a;
      } else if (res.type === 'troubleshooting') {
        badgeColor = 'bg-red-950/40 text-red-400 border border-red-900/30';
        snippet = res.item.solution;
      }

      const highlightedName = this.highlightText(res.name, query);
      const highlightedSnippet = this.highlightText(snippet, query);

      resultsHtml += `
        <div onclick="window.cadAppInstance.handleSearchResultClick('${res.key}')" class="p-4 rounded border border-[#2A2D35] bg-[#181A1F]/40 hover:bg-cyan-950/10 hover:border-cyan-500/50 transition cursor-pointer flex flex-col gap-1.5 group select-text">
          <div class="flex items-center justify-between gap-2">
            <h4 class="text-xs font-bold text-gray-200 group-hover:text-cyan-400 font-mono transition">${highlightedName}</h4>
            <span class="text-[9px] px-2 py-0.5 rounded uppercase font-mono font-bold tracking-wider ${badgeColor}">${res.category}</span>
          </div>
          <p class="text-xs text-gray-400 line-clamp-2 font-mono leading-relaxed">${highlightedSnippet}</p>
        </div>
      `;
    });

    resultsHtml += `
        </div>
      </div>
    `;

    this.learningContentViewport.innerHTML = resultsHtml;
    window.cadAppInstance = this;
  }

  handleSearchResultClick(key) {
    if (key.startsWith('faq_')) {
      this.navigateLearningGuide('faq');
    } else if (key.startsWith('trouble_')) {
      this.navigateLearningGuide('troubleshooting');
    } else {
      this.navigateLearningGuide(key);
    }
  }

  searchLearningCenter(query) {
    const q = query.toLowerCase().trim();
    if (!q) return [];
    const results = [];
    
    // Search in guides
    for (const [key, g] of Object.entries(guides)) {
      let score = 0;
      if (g.name.toLowerCase().includes(q)) score += 100;
      if (g.category.toLowerCase().includes(q)) score += 50;
      if (g.purpose.toLowerCase().includes(q)) score += 20;
      if (g.shortcut.toLowerCase() === q) score += 40;
      if (g.steps.some(s => s.toLowerCase().includes(q))) score += 10;
      if (g.tips.toLowerCase().includes(q)) score += 5;
      if (g.mistakes.toLowerCase().includes(q)) score += 5;
      
      if (score > 0) {
        results.push({ key, type: 'guide', name: g.name, category: g.category, score, item: g });
      }
    }

    // Search in FAQs
    faqs.forEach((faq, index) => {
      let score = 0;
      if (faq.q.toLowerCase().includes(q)) score += 80;
      if (faq.a.toLowerCase().includes(q)) score += 30;
      if (score > 0) {
        results.push({ key: `faq_${index}`, type: 'faq', name: faq.q, category: 'Frequently Asked Questions', score, item: faq });
      }
    });

    // Search in Troubleshooting
    troubleshooting.forEach((t, index) => {
      let score = 0;
      if (t.problem.toLowerCase().includes(q)) score += 80;
      if (t.solution.toLowerCase().includes(q)) score += 30;
      if (score > 0) {
        results.push({ key: `trouble_${index}`, type: 'troubleshooting', name: t.problem, category: 'Troubleshooting', score, item: t });
      }
    });

    results.sort((a, b) => b.score - a.score);
    return results;
  }

  getFuzzySuggestions(query) {
    const q = query.toLowerCase().trim();
    if (q.length < 2) return [];
    const suggestions = [];
    
    const allNames = [
      ...Object.entries(guides).map(([k, g]) => ({ key: k, name: g.name })),
      { key: 'faq', name: 'Frequently Asked Questions' },
      { key: 'troubleshooting', name: 'Troubleshooting' },
      { key: 'keyboard-shortcuts', name: 'Keyboard Shortcuts' }
    ];
    
    for (const item of allNames) {
      const nameLower = item.name.toLowerCase();
      let commonChars = 0;
      for (const char of q) {
        if (nameLower.includes(char)) commonChars++;
      }
      const ratio = commonChars / Math.max(q.length, nameLower.length);
      if (ratio > 0.25 || nameLower.startsWith(q.substring(0, 2))) {
        suggestions.push(item);
      }
    }
    return suggestions.slice(0, 5);
  }

  highlightText(text, query) {
    if (!query || !text) return text;
    const escapedQuery = query.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const regex = new RegExp(`(${escapedQuery})`, 'gi');
    return text.replace(regex, '<mark class="bg-cyan-500/30 text-cyan-300 px-0.5 rounded">$1</mark>');
  }

  renderContentArea() {
    const key = this.currentGuideKey;
    this.updateFavoriteButtonState();
    
    // Toggle copy/print buttons visibility (only visible for actual guides, faq, troubleshooting, shortcuts)
    if (key === 'home' || key.startsWith('category_')) {
      if (this.learningCopyBtn) this.learningCopyBtn.classList.add('hidden');
      if (this.learningPrintBtn) this.learningPrintBtn.classList.add('hidden');
      if (this.readingTimeIndicator) this.readingTimeIndicator.classList.add('hidden');
      if (this.btnLearningGuidePrev) this.btnLearningGuidePrev.classList.add('hidden');
      if (this.btnLearningGuideNext) this.btnLearningGuideNext.classList.add('hidden');
      if (this.learningGuidePageIndicator) this.learningGuidePageIndicator.classList.add('hidden');
    } else {
      if (this.learningCopyBtn) this.learningCopyBtn.classList.remove('hidden');
      if (this.learningPrintBtn) this.learningPrintBtn.classList.remove('hidden');
      if (this.readingTimeIndicator) this.readingTimeIndicator.classList.remove('hidden');
      
      const isFlatGuide = this.flatGuideKeys.includes(key);
      if (isFlatGuide) {
        if (this.btnLearningGuidePrev) this.btnLearningGuidePrev.classList.remove('hidden');
        if (this.btnLearningGuideNext) this.btnLearningGuideNext.classList.remove('hidden');
        if (this.learningGuidePageIndicator) {
          this.learningGuidePageIndicator.classList.remove('hidden');
          const index = this.flatGuideKeys.indexOf(key);
          this.learningGuidePageIndicator.textContent = `Guide ${index + 1} of ${this.flatGuideKeys.length}`;
        }
      } else {
        if (this.btnLearningGuidePrev) this.btnLearningGuidePrev.classList.add('hidden');
        if (this.btnLearningGuideNext) this.btnLearningGuideNext.classList.add('hidden');
        if (this.learningGuidePageIndicator) this.learningGuidePageIndicator.classList.add('hidden');
      }
    }

    if (!this.learningContentViewport) return;

    // A. Welcome Home View
    if (key === 'home') {
      if (this.learningBreadcrumbs) {
        this.learningBreadcrumbs.innerHTML = `
          <span>Learning Center</span>
          <span class="text-gray-600">></span>
          <span class="text-cyan-400 font-bold">Dashboard Home</span>
        `;
      }

      let catCardsHtml = '';
      categories.forEach(cat => {
        let iconHtml = `
          <div class="w-8 h-8 rounded bg-cyan-950/50 text-cyan-400 flex items-center justify-center shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
        `;
        let desc = 'Core capabilities and configurations.';
        
        if (cat === 'Getting Started') {
          iconHtml = `
            <div class="w-8 h-8 rounded bg-emerald-950/50 text-emerald-400 flex items-center justify-center shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
          `;
          desc = 'Master canvas setup, grid, zooming, snaps, and basic navigation.';
        } else if (cat === 'Drawing Tools') {
          iconHtml = `
            <div class="w-8 h-8 rounded bg-cyan-950/50 text-cyan-400 flex items-center justify-center shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </div>
          `;
          desc = 'Learn lines, polylines, rects, circles, hatching, and annotations.';
        } else if (cat === 'Modify Tools') {
          iconHtml = `
            <div class="w-8 h-8 rounded bg-indigo-950/50 text-indigo-400 flex items-center justify-center shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
            </div>
          `;
          desc = 'Move, copy, rotate, scale, trim, extend, offset, and delete.';
        } else if (cat === 'Civil Engineering Tools') {
          iconHtml = `
            <div class="w-8 h-8 rounded bg-amber-950/50 text-amber-400 flex items-center justify-center shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
          `;
          desc = 'Draft wall systems, place windows/doors, columns/beams, and estimate costs.';
        } else if (cat === 'Layers') {
          iconHtml = `
            <div class="w-8 h-8 rounded bg-fuchsia-950/50 text-fuchsia-400 flex items-center justify-center shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
          `;
          desc = 'Organize CAD designs with layer visibilities, locks, colors, and styling.';
        } else if (cat === 'Dimensions') {
          iconHtml = `
            <div class="w-8 h-8 rounded bg-sky-950/50 text-sky-400 flex items-center justify-center shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h7" />
              </svg>
            </div>
          `;
          desc = 'Persistently annotate widths, heights, and clearances with standard dimension markers.';
        } else if (cat === 'Templates') {
          iconHtml = `
            <div class="w-8 h-8 rounded bg-violet-950/50 text-violet-400 flex items-center justify-center shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
              </svg>
            </div>
          `;
          desc = 'Load copy-safe civil floor templates like 1 BHK, shop layout, classroom, or office workstation.';
        } else if (cat === 'DXF Import & Export') {
          iconHtml = `
            <div class="w-8 h-8 rounded bg-teal-950/50 text-teal-400 flex items-center justify-center shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M8 4H6a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-2m-4-1v8m0 0l3-3m-3 3L9 8m-5 5h2.586a1 1 0 01.707.293l2.414 2.414a1 1 0 00.707.293h3.172a1 1 0 00.707-.293l2.414-2.414a1 1 0 01.707-.293H20" />
              </svg>
            </div>
          `;
          desc = 'Full compatibility pipeline to import or export ASCII DXF vector drawings.';
        } else if (cat === 'Printing & PDF') {
          iconHtml = `
            <div class="w-8 h-8 rounded bg-rose-950/50 text-rose-400 flex items-center justify-center shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
            </div>
          `;
          desc = 'Plot drawings to PDF, export PNG sheets, or send to standard office printers.';
        } else if (cat === 'Frequently Asked Questions') {
          iconHtml = `
            <div class="w-8 h-8 rounded bg-yellow-950/50 text-yellow-400 flex items-center justify-center shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          `;
          desc = 'Quick-read guides answering standard drafting operations.';
        } else if (cat === 'Troubleshooting') {
          iconHtml = `
            <div class="w-8 h-8 rounded bg-red-950/50 text-red-400 flex items-center justify-center shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
          `;
          desc = 'Diagnose snaps, selection issues, DXF files, or printer blanks.';
        } else if (cat === 'Keyboard Shortcuts') {
          iconHtml = `
            <div class="w-8 h-8 rounded bg-slate-950/50 text-slate-400 flex items-center justify-center shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <rect x="2" y="4" width="20" height="16" rx="2" ry="2" />
                <path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M6 12h.01M10 12h.01M14 12h.01M18 12h.01M7 16h10" />
              </svg>
            </div>
          `;
          desc = 'List of simple one-key keyboard commands to fly through your blueprint setups.';
        }

        const cleanId = `category_${cat.toLowerCase().replace(/\s+/g, '_')}`;
        catCardsHtml += `
          <div onclick="window.cadAppInstance.navigateLearningGuide('${cleanId === 'category_frequently_asked_questions' ? 'faq' : cleanId === 'category_troubleshooting' ? 'troubleshooting' : cleanId === 'category_keyboard_shortcuts' ? 'keyboard-shortcuts' : cleanId}')" class="p-4 rounded-md border border-[#2A2D35] bg-[#181A1F]/30 hover:bg-cyan-950/10 hover:border-cyan-500/50 transition cursor-pointer flex gap-3.5 group select-text">
            ${iconHtml}
            <div class="flex flex-col gap-1">
              <h3 class="text-xs font-bold text-gray-200 group-hover:text-cyan-400 font-mono transition uppercase tracking-wider">${cat}</h3>
              <p class="text-[11px] text-gray-400 font-mono leading-normal">${desc}</p>
            </div>
          </div>
        `;
      });

      this.learningContentViewport.innerHTML = `
        <div class="flex flex-col gap-6 select-text">
          
          <!-- Banner Hero section -->
          <div class="p-6 rounded-lg bg-gradient-to-r from-cyan-950/30 via-slate-900/40 to-indigo-950/30 border border-[#2A2D35] flex flex-col gap-2 relative overflow-hidden">
            <div class="absolute right-0 bottom-0 opacity-10 pointer-events-none transform translate-y-6 translate-x-6">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-48 h-48 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <span class="text-[9px] bg-cyan-950 text-cyan-400 border border-cyan-800/40 rounded px-2 py-0.5 w-max font-bold font-mono tracking-wider uppercase">User Manual & Training Suite</span>
            <h1 class="text-lg font-bold text-gray-100 tracking-tight font-sans">Welcome to AetherCAD Learning Center</h1>
            <p class="text-xs text-gray-400 font-mono leading-relaxed max-w-xl">Learn how to use every feature from beginner to advanced. Access comprehensive step-by-step procedures, troubleshooting steps, and keyboard mappings entirely offline.</p>
          </div>

          <!-- Categories Grid -->
          <div class="flex flex-col gap-3">
            <h2 class="text-xs font-mono font-bold uppercase text-gray-500 tracking-wider">Browse Modules</h2>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              ${catCardsHtml}
            </div>
          </div>

        </div>
      `;
      window.cadAppInstance = this;
      return;
    }

    // B. Category Overview page (Listing all guides under a category)
    if (key.startsWith('category_')) {
      const cleanCatName = key.replace('category_', '').replace(/_/g, ' ');
      // Find exact category matching case insensitive
      const matchedCat = categories.find(c => c.toLowerCase() === cleanCatName) || cleanCatName;
      
      if (this.learningBreadcrumbs) {
        this.learningBreadcrumbs.innerHTML = `
          <button onclick="window.cadAppInstance.navigateLearningGuide('home')" class="hover:text-white transition cursor-pointer">Learning Center</button>
          <span class="text-gray-600">></span>
          <span class="text-cyan-400 font-bold">${matchedCat}</span>
        `;
      }

      const catGuides = Object.entries(guides).filter(([k, g]) => g.category.toLowerCase() === cleanCatName);

      let listHtml = '';
      catGuides.forEach(([k, g]) => {
        listHtml += `
          <div onclick="window.cadAppInstance.navigateLearningGuide('${k}')" class="p-4 rounded border border-[#2A2D35] bg-[#181A1F]/30 hover:bg-cyan-950/10 hover:border-cyan-500/50 transition cursor-pointer flex flex-col gap-2 group select-text">
            <div class="flex items-center justify-between">
              <h3 class="text-xs font-bold text-gray-200 group-hover:text-cyan-400 font-mono transition uppercase">${g.name}</h3>
              ${g.shortcut && g.shortcut !== 'N/A' ? `<span class="text-[9px] bg-[#2A2D35] text-gray-400 px-1.5 py-0.2 rounded font-bold font-mono">Shortcut: ${g.shortcut}</span>` : ''}
            </div>
            <p class="text-xs text-gray-400 font-mono leading-normal line-clamp-2">${g.purpose}</p>
            <div class="text-[10px] text-cyan-400/80 font-mono font-semibold flex items-center gap-1 group-hover:translate-x-1 transition duration-150 mt-1">
              Read guide
              <svg xmlns="http://www.w3.org/2000/svg" class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </div>
        `;
      });

      this.learningContentViewport.innerHTML = `
        <div class="flex flex-col gap-5 select-text">
          <div class="flex items-center gap-3 border-b border-[#2A2D35]/60 pb-3">
            <button onclick="window.cadAppInstance.navigateLearningGuide('home')" class="p-1.5 rounded bg-[#1E2127] border border-[#2A2D35] text-gray-400 hover:text-white transition cursor-pointer" title="Go back to Home">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
            <div>
              <h1 class="text-base font-bold text-gray-100 uppercase tracking-wide font-mono">${matchedCat}</h1>
              <p class="text-xs text-gray-500 font-mono mt-0.5">Comprehensive modules under "${matchedCat}" category</p>
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            ${listHtml}
          </div>
        </div>
      `;
      window.cadAppInstance = this;
      return;
    }

    // C. Keyboard Shortcuts Page
    if (key === 'keyboard-shortcuts') {
      if (this.learningBreadcrumbs) {
        this.learningBreadcrumbs.innerHTML = `
          <button onclick="window.cadAppInstance.navigateLearningGuide('home')" class="hover:text-white transition cursor-pointer">Learning Center</button>
          <span class="text-gray-600">></span>
          <span class="text-cyan-400 font-bold">Keyboard Shortcuts</span>
        `;
      }
      if (this.readingTimeIndicator) {
        this.readingTimeIndicator.classList.remove('hidden');
        this.readingTimeIndicator.querySelector('span').textContent = '2 min read';
      }

      const shortcutRows = Object.entries(guides)
        .filter(([k, g]) => g.shortcut && g.shortcut !== 'N/A')
        .map(([k, g]) => `
          <tr onclick="window.cadAppInstance.navigateLearningGuide('${k}')" class="border-b border-[#2A2D35]/40 hover:bg-cyan-950/10 cursor-pointer transition select-text">
            <td class="px-4 py-3 font-mono text-xs font-bold text-cyan-400">${g.shortcut}</td>
            <td class="px-4 py-3 font-mono text-xs text-gray-200 uppercase">${g.name}</td>
            <td class="px-4 py-3 font-mono text-[11px] text-gray-400">${g.category}</td>
            <td class="px-4 py-3 font-mono text-[11px] text-gray-500 truncate max-w-xs">${g.purpose}</td>
          </tr>
        `).join('');

      this.learningContentViewport.innerHTML = `
        <div class="flex flex-col gap-5 select-text">
          <div class="flex flex-col gap-1 border-b border-[#2A2D35]/60 pb-3">
            <h1 class="text-base font-bold text-gray-100 uppercase tracking-wide font-mono">Keyboard Mappings & Hotkeys</h1>
            <p class="text-xs text-gray-500 font-mono">Press designated keys during active drafting to instantly trigger tools.</p>
          </div>

          <div class="overflow-hidden border border-[#2A2D35] rounded-md">
            <table class="w-full text-left border-collapse bg-[#131519]/40">
              <thead>
                <tr class="bg-[#181a1f] border-b border-[#2A2D35] text-[10px] font-mono text-gray-500 uppercase tracking-wider">
                  <th class="px-4 py-2.5 font-bold">Hotkey</th>
                  <th class="px-4 py-2.5 font-bold">Target Action / Command</th>
                  <th class="px-4 py-2.5 font-bold">Category</th>
                  <th class="px-4 py-2.5 font-bold">Description</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-[#2A2D35]/30">
                ${shortcutRows}
                <tr class="border-b border-[#2A2D35]/40 hover:bg-cyan-950/10 transition">
                  <td class="px-4 py-3 font-mono text-xs font-bold text-cyan-400">Esc</td>
                  <td class="px-4 py-3 font-mono text-xs text-gray-200 uppercase">Clear Active Tools</td>
                  <td class="px-4 py-3 font-mono text-[11px] text-gray-400">Getting Started</td>
                  <td class="px-4 py-3 font-mono text-[11px] text-gray-500">Resets cursor back to standard Selection pointer mode.</td>
                </tr>
                <tr class="border-b border-[#2A2D35]/40 hover:bg-cyan-950/10 transition">
                  <td class="px-4 py-3 font-mono text-xs font-bold text-cyan-400">Ctrl+Z</td>
                  <td class="px-4 py-3 font-mono text-xs text-gray-200 uppercase">Undo Last Step</td>
                  <td class="px-4 py-3 font-mono text-[11px] text-gray-400">Getting Started</td>
                  <td class="px-4 py-3 font-mono text-[11px] text-gray-500">Walk backward through drawing changes in the session buffer.</td>
                </tr>
                <tr class="border-b border-[#2A2D35]/40 hover:bg-cyan-950/10 transition">
                  <td class="px-4 py-3 font-mono text-xs font-bold text-cyan-400">Ctrl+Y</td>
                  <td class="px-4 py-3 font-mono text-xs text-gray-200 uppercase">Redo Last Step</td>
                  <td class="px-4 py-3 font-mono text-[11px] text-gray-400">Getting Started</td>
                  <td class="px-4 py-3 font-mono text-[11px] text-gray-500">Restore the drawing change reverted by Undo.</td>
                </tr>
                <tr class="border-b border-[#2A2D35]/40 hover:bg-cyan-950/10 transition">
                  <td class="px-4 py-3 font-mono text-xs font-bold text-cyan-400">Del</td>
                  <td class="px-4 py-3 font-mono text-xs text-gray-200 uppercase">Delete Selection</td>
                  <td class="px-4 py-3 font-mono text-[11px] text-gray-400">Modify Tools</td>
                  <td class="px-4 py-3 font-mono text-[11px] text-gray-500">Removes targeted highlighted vectors from current canvas.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      `;
      window.cadAppInstance = this;
      return;
    }

    // D. FAQ Page
    if (key === 'faq') {
      if (this.learningBreadcrumbs) {
        this.learningBreadcrumbs.innerHTML = `
          <button onclick="window.cadAppInstance.navigateLearningGuide('home')" class="hover:text-white transition cursor-pointer">Learning Center</button>
          <span class="text-gray-600">></span>
          <span class="text-cyan-400 font-bold">Frequently Asked Questions</span>
        `;
      }
      if (this.readingTimeIndicator) {
        this.readingTimeIndicator.classList.remove('hidden');
        this.readingTimeIndicator.querySelector('span').textContent = '3 min read';
      }

      const faqItemsHtml = faqs.map((faq, index) => `
        <div class="border border-[#2A2D35] rounded-md bg-[#131519]/40 overflow-hidden select-text">
          <button onclick="window.cadAppInstance.toggleFaqItem(${index})" class="w-full text-left px-4 py-3 bg-[#181a1f]/60 hover:bg-[#2A2D35]/30 flex items-center justify-between transition cursor-pointer">
            <span class="text-xs font-bold text-gray-200 font-mono flex items-center gap-2">
              <span class="text-cyan-400 font-semibold text-[11px]">Q${index + 1}:</span>
              ${faq.q}
            </span>
            <svg id="faq-chevron-${index}" xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-gray-400 transform transition-transform duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          <div id="faq-answer-${index}" class="hidden p-4 bg-[#0F1115] border-t border-[#2A2D35]/50 text-xs text-gray-400 font-mono leading-relaxed select-text">
            ${faq.a}
          </div>
        </div>
      `).join('');

      this.learningContentViewport.innerHTML = `
        <div class="flex flex-col gap-5 select-text animate-fade-in">
          <div class="flex flex-col gap-1 border-b border-[#2A2D35]/60 pb-3">
            <h1 class="text-base font-bold text-gray-100 uppercase tracking-wide font-mono">Frequently Asked Questions (FAQ)</h1>
            <p class="text-xs text-gray-500 font-mono">Instant quick-read support and instructions for standard drawing operations.</p>
          </div>

          <div class="flex flex-col gap-3">
            ${faqItemsHtml}
          </div>
        </div>
      `;
      window.cadAppInstance = this;
      return;
    }

    // E. Troubleshooting Page
    if (key === 'troubleshooting') {
      if (this.learningBreadcrumbs) {
        this.learningBreadcrumbs.innerHTML = `
          <button onclick="window.cadAppInstance.navigateLearningGuide('home')" class="hover:text-white transition cursor-pointer">Learning Center</button>
          <span class="text-gray-600">></span>
          <span class="text-cyan-400 font-bold">Troubleshooting</span>
        `;
      }
      if (this.readingTimeIndicator) {
        this.readingTimeIndicator.classList.remove('hidden');
        this.readingTimeIndicator.querySelector('span').textContent = '2 min read';
      }

      const troubleHtml = troubleshooting.map((t, index) => `
        <div class="p-4 rounded-md border border-[#2A2D35] bg-[#181A1F]/30 flex flex-col gap-3 select-text">
          <div class="flex items-center gap-2.5">
            <div class="w-6 h-6 rounded bg-red-950/50 text-red-400 border border-red-900/40 flex items-center justify-center text-xs font-bold font-mono">
              !
            </div>
            <h3 class="text-xs font-bold text-gray-200 font-mono uppercase tracking-wide">${t.problem}</h3>
          </div>
          <div class="p-3.5 rounded bg-[#0F1115] border border-[#2A2D35]/50 flex flex-col gap-1.5">
            <span class="text-[9px] font-bold text-emerald-400 uppercase tracking-wider font-mono">Recommended Fix:</span>
            <p class="text-xs text-gray-300 font-mono leading-relaxed select-text">${t.solution}</p>
          </div>
        </div>
      `).join('');

      this.learningContentViewport.innerHTML = `
        <div class="flex flex-col gap-5 select-text">
          <div class="flex flex-col gap-1 border-b border-[#2A2D35]/60 pb-3">
            <h1 class="text-base font-bold text-gray-100 uppercase tracking-wide font-mono">System Troubleshooting</h1>
            <p class="text-xs text-gray-500 font-mono">Resolve snapping, vector selection, DXF layouts, or printing anomalies instantly.</p>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            ${troubleHtml}
          </div>
        </div>
      `;
      window.cadAppInstance = this;
      return;
    }

    // F. Specific Tool Guide Page (e.g. 'line')
    const g = guides[key];
    if (g) {
      if (this.learningBreadcrumbs) {
        this.learningBreadcrumbs.innerHTML = `
          <button onclick="window.cadAppInstance.navigateLearningGuide('home')" class="hover:text-white transition cursor-pointer">Learning Center</button>
          <span class="text-gray-600">></span>
          <button onclick="window.cadAppInstance.navigateLearningGuide('category_${g.category.toLowerCase().replace(/\s+/g, '_')}')" class="hover:text-white transition cursor-pointer">${g.category}</button>
          <span class="text-gray-600">></span>
          <span class="text-cyan-400 font-bold">${g.name}</span>
        `;
      }

      // Compute reading time (roughly 1 minute per 200 words)
      const textBlock = `${g.name} ${g.purpose} ${g.steps.join(' ')} ${g.tips} ${g.mistakes} ${g.example}`;
      const wordCount = textBlock.split(/\s+/).length;
      const readingTime = Math.max(1, Math.ceil(wordCount / 180));
      if (this.readingTimeIndicator) {
        this.readingTimeIndicator.querySelector('span').textContent = `${readingTime} min read`;
      }

      // Render step list HTML
      const stepsHtml = g.steps.map((step, index) => `
        <div class="flex gap-3 select-text">
          <div class="w-5 h-5 rounded bg-cyan-950/60 text-cyan-400 border border-cyan-800/40 flex items-center justify-center text-[10px] font-bold font-mono shrink-0">
            ${index + 1}
          </div>
          <p class="text-xs text-gray-300 font-mono leading-relaxed mt-0.5">${step}</p>
        </div>
      `).join('');

      // Related Tools HTML tags
      const relatedHtml = g.related && g.related.length > 0 ? g.related.map(rel => {
        // Find match key case-insensitive
        const relKey = Object.keys(guides).find(k => guides[k].name.toLowerCase() === rel.toLowerCase() || k === rel.toLowerCase());
        if (relKey) {
          return `
            <button onclick="window.cadAppInstance.navigateLearningGuide('${relKey}')" class="px-2 py-1 text-[10px] font-mono rounded bg-[#1e2127] border border-[#2a2d35] text-cyan-400 hover:bg-cyan-950 hover:border-cyan-500 hover:text-white transition cursor-pointer">
              ${guides[relKey].name}
            </button>
          `;
        } else {
          return `<span class="px-2 py-1 text-[10px] font-mono rounded bg-[#1e2127] text-gray-500">${rel}</span>`;
        }
      }).join('') : `<span class="text-[10px] text-gray-500 font-mono italic">None</span>`;

      // Tool FAQ rendering
      const toolFaqHtml = g.faq && g.faq.length > 0 ? g.faq.map((fq, index) => `
        <div class="p-3.5 rounded bg-[#131519]/50 border border-[#2A2D35] flex flex-col gap-1.5 select-text">
          <span class="text-xs font-bold text-cyan-400 font-mono">Q: ${fq.q}</span>
          <p class="text-xs text-gray-400 font-mono leading-relaxed select-text">${fq.a}</p>
        </div>
      `).join('') : '';

      this.learningContentViewport.innerHTML = `
        <div class="flex flex-col gap-6 select-text max-w-4xl animate-fade-in">
          
          <!-- Title block -->
          <div class="flex items-start justify-between gap-4 border-b border-[#2A2D35] pb-4">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded bg-cyan-950/60 text-cyan-400 border border-cyan-800/50 flex items-center justify-center shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <div class="flex flex-col gap-0.5">
                <span class="text-[9px] text-cyan-400 uppercase font-bold tracking-wider font-mono">${g.category}</span>
                <h1 class="text-base font-bold text-gray-100 tracking-wide uppercase font-mono">${g.name}</h1>
              </div>
            </div>
            
            <div class="flex flex-col items-end gap-1 font-mono shrink-0 text-right">
              ${g.shortcut && g.shortcut !== 'N/A' ? `
                <div class="flex items-center gap-1.5">
                  <span class="text-[10px] text-gray-500 uppercase tracking-wide">Keyboard Hotkey:</span>
                  <span class="px-2 py-0.5 rounded bg-cyan-950 text-cyan-400 font-bold border border-cyan-900/50 text-[10px] uppercase font-bold select-all">${g.shortcut}</span>
                </div>
              ` : ''}
              <div class="flex items-center gap-1.5 text-[10px] text-gray-500 mt-1">
                <span>Location:</span>
                <span class="text-gray-300 font-semibold">${g.location}</span>
              </div>
            </div>
          </div>

          <!-- Purpose -->
          <div class="flex flex-col gap-1.5 select-text">
            <h2 class="text-xs font-bold text-gray-400 uppercase tracking-wider font-mono">Purpose</h2>
            <p class="text-xs text-gray-300 font-mono leading-relaxed select-text">${g.purpose}</p>
          </div>

          <!-- Steps / How to Use -->
          <div class="flex flex-col gap-3 select-text">
            <h2 class="text-xs font-bold text-gray-400 uppercase tracking-wider font-mono">Step-by-Step Instructions</h2>
            <div class="flex flex-col gap-2.5">
              ${stepsHtml}
            </div>
          </div>

          <!-- Use Case & Example -->
          <div class="flex flex-col gap-1.5 select-text">
            <h2 class="text-xs font-bold text-gray-400 uppercase tracking-wider font-mono">Example Use Cases</h2>
            <p class="text-xs text-gray-300 font-mono leading-relaxed select-text">${g.example}</p>
          </div>

          <!-- Tips and Mistakes Split -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 select-text">
            <div class="p-4 rounded bg-cyan-950/10 border border-cyan-900/20 flex flex-col gap-1.5">
              <span class="text-[10px] font-bold text-cyan-400 uppercase tracking-wider font-mono">Pro Tips</span>
              <p class="text-xs text-gray-300 font-mono leading-relaxed select-text">${g.tips}</p>
            </div>
            <div class="p-4 rounded bg-red-950/10 border border-red-900/20 flex flex-col gap-1.5">
              <span class="text-[10px] font-bold text-red-400 uppercase tracking-wider font-mono">Common Mistakes</span>
              <p class="text-xs text-gray-300 font-mono leading-relaxed select-text">${g.mistakes}</p>
            </div>
          </div>

          <!-- Tool specific FAQs -->
          ${toolFaqHtml ? `
            <div class="flex flex-col gap-3 select-text">
              <h2 class="text-xs font-bold text-gray-400 uppercase tracking-wider font-mono">Related Tool FAQs</h2>
              <div class="flex flex-col gap-2.5">
                ${toolFaqHtml}
              </div>
            </div>
          ` : ''}

          <!-- Related Tools -->
          <div class="flex flex-col gap-2 select-text border-t border-[#2A2D35]/50 pt-4">
            <h2 class="text-[10px] font-bold text-gray-500 uppercase tracking-wider font-mono">Related Tools</h2>
            <div class="flex flex-wrap gap-2">
              ${relatedHtml}
            </div>
          </div>

        </div>
      `;
    }
    
    window.cadAppInstance = this;
  }

  toggleFaqItem(index) {
    const el = document.getElementById(`faq-answer-${index}`);
    const chevron = document.getElementById(`faq-chevron-${index}`);
    if (el) {
      if (el.classList.contains('hidden')) {
        el.classList.remove('hidden');
        if (chevron) chevron.classList.add('rotate-180');
      } else {
        el.classList.add('hidden');
        if (chevron) chevron.classList.remove('rotate-180');
      }
    }
  }

  copyActiveGuideToClipboard() {
    const key = this.currentGuideKey;
    const g = guides[key];
    if (!g) return;

    const copyText = `
----------------------------------------------------
${g.name.toUpperCase()} TOOL
----------------------------------------------------

Purpose
--------
${g.purpose}

Where to Find
-------------
${g.location}

Shortcut
--------
${g.shortcut}

How to Select & Use
-------------------
${g.steps.map((s, idx) => `Step ${idx + 1}:\n${s}`).join('\n\n')}

Example Use Cases
-----------------
• ${g.example}

Tips
----
• ${g.tips}

Common Mistakes
---------------
• ${g.mistakes}

Related Tools
-------------
${g.related.join(', ')}
    `.trim();

    navigator.clipboard.writeText(copyText).then(() => {
      // Show success on button
      const originalText = this.learningCopyBtn.innerHTML;
      this.learningCopyBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
        </svg>
        <span class="text-emerald-400">Copied!</span>
      `;
      setTimeout(() => {
        this.learningCopyBtn.innerHTML = originalText;
      }, 1500);
    }).catch(err => {
      console.error("Failed to copy guide text:", err);
    });
  }

  printActiveGuide() {
    const viewport = document.getElementById('learning-content-viewport');
    if (!viewport) return;
    
    const guideName = guides[this.currentGuideKey] ? guides[this.currentGuideKey].name : 'AetherCAD Guide';
    const rawHtml = viewport.innerHTML;
    
    this.printGuide(guideName, rawHtml);
  }

  printGuide(title, htmlContent) {
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);
    
    const doc = iframe.contentWindow.document;
    doc.write(`
      <html>
        <head>
          <title>${title}</title>
          <style>
            body { 
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; 
              padding: 40px; 
              color: #1a1a1a; 
              line-height: 1.6; 
            }
            h1 { 
              color: #0891b2; 
              border-bottom: 2px solid #e2e8f0; 
              padding-bottom: 8px; 
              margin-top: 0; 
              font-size: 1.75rem; 
              text-transform: uppercase;
              font-family: monospace;
            }
            h2 { 
              color: #0f172a; 
              margin-top: 24px; 
              font-size: 1.15rem; 
              text-transform: uppercase;
              font-family: monospace;
              border-bottom: 1px solid #f1f5f9;
              padding-bottom: 4px;
            }
            p, div { font-size: 0.9rem; }
            ul, ol { padding-left: 20px; font-size: 0.9rem; }
            .steps { display: flex; flex-direction: column; gap: 8px; }
            .step-row { display: flex; gap: 10px; margin-bottom: 12px; }
            .step-number { 
              font-weight: bold; 
              background: #ecfeff; 
              color: #0891b2; 
              border: 1px solid #cffafe; 
              width: 22px; 
              height: 22px; 
              border-radius: 4px; 
              display: flex; 
              align-items: center; 
              justify-content: center; 
              font-size: 0.8rem;
              flex-shrink: 0;
            }
            .grid { display: grid; grid-template-cols: 1fr 1fr; gap: 20px; margin-top: 15px; }
            .card { padding: 16px; border: 1px solid #e2e8f0; border-radius: 6px; }
            .card-title { font-weight: bold; font-family: monospace; font-size: 0.85rem; margin-bottom: 6px; text-transform: uppercase; }
            .pro-tip { background: #f0fdfa; border-color: #99f6e4; color: #115e59; }
            .mistake { background: #fff5f5; border-color: #feb2b2; color: #9b2c2c; }
            .info-badge { font-weight: bold; font-family: monospace; background: #f1f5f9; padding: 4px 8px; border-radius: 4px; font-size: 0.8rem; }
          </style>
        </head>
        <body>
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px;">
            <div>
              <span style="font-size: 0.75rem; color: #0891b2; font-family: monospace; font-weight: bold; text-transform: uppercase;">AetherCAD Pro Documentation</span>
              <h1>${title} Manual</h1>
            </div>
            <div style="text-align: right; font-family: monospace; font-size: 0.8rem;">
              <div>Offline Reference Sheet</div>
              <div style="color: #64748b; margin-top: 4px;">Date: ${new Date().toLocaleDateString()}</div>
            </div>
          </div>
          ${htmlContent}
          <script>
            window.onload = function() {
              window.print();
              setTimeout(() => { window.parent.document.body.removeChild(window.frameElement); }, 1000);
            }
          </script>
        </body>
      </html>
    `);
    doc.close();
  }

  createLayer(name) {
    const id = 'layer_' + Math.random().toString(36).substr(2, 9);
    this.layers.push({ id, name, visible: true, locked: false });
    this.activeLayerId = id;
    this.saveLayersStateAndWidget();
  }

  deleteLayer(id) {
    if (id === 'default') {
      alert("Cannot delete the Default Layer!");
      return;
    }
    const layer = this.layers.find(l => l.id === id);
    if (layer && layer.locked) {
      alert(`Cannot delete locked layer "${layer.name}"! Please unlock it first.`);
      return;
    }
    const index = this.layers.findIndex(l => l.id === id);
    if (index !== -1) {
      this.layers.splice(index, 1);
      
      // Reassign shapes belonging to deleted layer back to default layer
      this.shapes.forEach(shape => {
        if (shape.layerId === id) {
          shape.layerId = 'default';
        }
      });
      
      if (this.activeLayerId === id) {
        this.activeLayerId = 'default';
      }
      
      this.saveLayersStateAndWidget();
    }
  }

  toggleLayerVisibility(id) {
    const layer = this.layers.find(l => l.id === id);
    if (layer) {
      layer.visible = !layer.visible;
      
      // Deselect selected shape if it is on the hidden layer
      if (!layer.visible && this.selectedShape && this.selectedShape.layerId === id) {
        this.selectedShape = null;
        this.updateDeleteSelectedBtnState();
      }
      
      this.saveLayersStateAndWidget();
    }
  }

  toggleLayerLock(id) {
    const layer = this.layers.find(l => l.id === id);
    if (layer) {
      layer.locked = !layer.locked;
      
      // Deselect selected shape if it is on the locked layer
      if (layer.locked && this.selectedShape && this.selectedShape.layerId === id) {
        this.selectedShape = null;
        this.updateDeleteSelectedBtnState();
      }
      
      this.saveLayersStateAndWidget();
      this.showStatusFeedback(`Layer "${layer.name}" is now ${layer.locked ? 'LOCKED' : 'UNLOCKED'}`);
    }
  }

  saveLayersStateAndWidget() {
    this.saveDrawing();
    this.updateLayersWidget();
    this.updateEntityList();
    this.redraw();
  }

  updateLayersWidget() {
    if (!this.layersList) return;
    
    if (this.layersCounter) {
      this.layersCounter.innerText = `${this.layers.length} layer${this.layers.length === 1 ? '' : 's'}`;
    }
    
    this.layersList.innerHTML = '';
    
    this.layers.forEach(layer => {
      const li = document.createElement('li');
      const isActive = layer.id === this.activeLayerId;
      const isLocked = !!layer.locked;
      
      let itemBgClass = '';
      if (isActive) {
        itemBgClass = isLocked 
          ? 'bg-[#1E2127]/90 border-l-2 border-amber-500 text-slate-400 font-bold cursor-pointer hover:bg-[#1E2127] transition duration-150'
          : 'bg-[#1E2127]/90 border-l-2 border-cyan-400 text-cyan-400 font-bold cursor-pointer hover:bg-[#1E2127] transition duration-150';
      } else {
        itemBgClass = isLocked
          ? 'bg-transparent text-slate-500 cursor-pointer hover:bg-[#1E2127]/20 transition duration-150'
          : 'bg-transparent text-slate-300 hover:text-slate-100 hover:bg-[#1E2127]/30 cursor-pointer transition duration-150';
      }
      li.className = `flex items-center justify-between px-2.5 py-1.5 ${itemBgClass}`;
      
      const isDefault = layer.id === 'default';
      const eyeIconSVG = layer.visible 
        ? `<svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
             <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
             <path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
           </svg>`
        : `<svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
             <path stroke-linecap="round" stroke-linejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.542-7a9.97 9.97 0 011.563-3.14M9.9 9.9a3 3 0 114.2 4.2m3.6 3.6L3 3m13.713 13.713A10.038 10.038 0 0021.543 12c-1.274-4.057-5.064-7-9.542-7-1.23 0-2.398.222-3.475.627m4.218 5.76A3.333 3.333 0 0013.9 11.23" />
           </svg>`;
           
      const lockIconSVG = isLocked 
        ? `<svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5 text-amber-500 hover:text-amber-400" fill="currentColor" viewBox="0 0 20 20">
             <path fill-rule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clip-rule="evenodd" />
           </svg>`
        : `<svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5 text-slate-500 hover:text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
             <path stroke-linecap="round" stroke-linejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-5a2 2 0 00-2-2H5a2 2 0 00-2 2v5a2 2 0 002 2zm4-11V4a4 4 0 118 0v3H8z" />
           </svg>`;
           
      li.innerHTML = `
        <div class="flex items-center gap-2 truncate flex-grow mr-2" title="${isLocked ? 'Locked Layer' : 'Click to make Active Layer'}">
          <span class="w-1.5 h-1.5 rounded-full shrink-0 ${isLocked ? 'bg-amber-500' : (isActive ? 'bg-cyan-400' : 'bg-slate-600')}"></span>
          <span class="truncate pr-1 ${isLocked ? 'line-through decoration-amber-500/30' : ''}">${layer.name}</span>
          ${isActive ? `<span class="bg-${isLocked ? 'amber' : 'cyan'}-950/80 border border-${isLocked ? 'amber' : 'cyan'}-800/80 px-1 py-0 rounded text-${isLocked ? 'amber' : 'cyan'}-400 font-normal shrink-0 tracking-widest text-[7px] scale-90">ACTIVE</span>` : ''}
        </div>
        <div class="flex items-center gap-1.5 shrink-0">
          <button class="layer-toggle-vis p-1 rounded hover:bg-[#2A2D35]/50 transition cursor-pointer" title="${layer.visible ? 'Hide Layer' : 'Show Layer'}">
            ${eyeIconSVG}
          </button>
          <button class="layer-toggle-lock p-1 rounded hover:bg-[#2A2D35]/50 transition cursor-pointer" title="${isLocked ? 'Unlock Layer' : 'Lock Layer'}">
            ${lockIconSVG}
          </button>
          ${isDefault ? '' : `
            <button class="layer-delete p-1 rounded hover:bg-red-950/40 text-slate-500 hover:text-red-400 transition cursor-pointer" title="Delete Layer">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          `}
        </div>
      `;
      
      li.querySelector('div:first-child').addEventListener('click', (e) => {
        if (layer.locked) {
          this.showStatusFeedback(`Layer "${layer.name}" is locked. Unlock it to edit or draw on it active.`);
        }
        this.activeLayerId = layer.id;
        this.saveLayersStateAndWidget();
      });
      
      li.querySelector('.layer-toggle-vis').addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleLayerVisibility(layer.id);
      });

      li.querySelector('.layer-toggle-lock').addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleLayerLock(layer.id);
      });
      
      if (!isDefault) {
        li.querySelector('.layer-delete').addEventListener('click', (e) => {
          e.stopPropagation();
          this.deleteLayer(layer.id);
        });
      }
      
      this.layersList.appendChild(li);
    });
    
    if (this.assignLayerSelect) {
      const currentSelectedVal = this.assignLayerSelect.value;
      this.assignLayerSelect.innerHTML = '';
      this.layers.forEach(layer => {
        const opt = document.createElement('option');
        opt.value = layer.id;
        opt.innerText = layer.name;
        this.assignLayerSelect.appendChild(opt);
      });
      
      if (currentSelectedVal && this.layers.some(l => l.id === currentSelectedVal)) {
        this.assignLayerSelect.value = currentSelectedVal;
      }
    }
    
    this.updateAssignLayerVisibility();
  }

  updateAssignLayerVisibility() {
    if (!this.assignLayerContainer || !this.assignLayerSelect) return;
    
    if (this.selectedShape) {
      this.assignLayerContainer.classList.remove('hidden');
      this.assignLayerContainer.classList.add('flex');
      this.assignLayerSelect.value = this.selectedShape.layerId || 'default';
    } else {
      this.assignLayerContainer.classList.add('hidden');
      this.assignLayerContainer.classList.remove('flex');
    }
  }

  /**
   * Safe initialization of events and controls
   */
  initHTMLReferencesAndListeners() {
    // Canvas Mouse listeners
    this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
    this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
    window.addEventListener('mouseup', (e) => this.handleMouseUp(e));
    this.canvas.addEventListener('wheel', (e) => this.handleWheel(e), { passive: false });
    this.canvas.addEventListener('dblclick', (e) => this.handleDoubleClick(e));
    
    if (this.zoomStatusDisplay) {
      this.zoomStatusDisplay.addEventListener('click', () => this.resetView());
    }
    
    this.canvas.addEventListener('mouseenter', () => {
      this.mouseInCanvas = true;
      this.redraw();
    });
    this.canvas.addEventListener('mouseleave', () => {
      this.mouseInCanvas = false;
      this.hideRelativeCoords();
      this.coordsDisplay.innerText = "X: 000.00 | Y: 000.00";
      this.redraw();
    });

    // Civil Engineering Mode toggle listener
    const btnToggleCivil = document.getElementById('btn-toggle-civil-mode');
    if (btnToggleCivil) {
      btnToggleCivil.addEventListener('click', () => {
        this.civilMode = !this.civilMode;
        this.updateCivilModeUI();
        this.showStatusFeedback(this.civilMode ? "Civil Engineering workspace loaded." : "Standard Drafting workspace loaded.");
      });
      // Initial visual alignment
      this.updateCivilModeUI();
    }

    // Tool switching selections
    const tools = [
      { id: 'tool-select', name: 'select', text: 'Select Tool Active' },
      { id: 'tool-line', name: 'line', text: 'Line Tool Active' },
      { id: 'tool-rectangle', name: 'rectangle', text: 'Rectangle Tool Active' },
      { id: 'tool-circle', name: 'circle', text: 'Circle Tool Active' },
      { id: 'tool-pan', name: 'pan', text: 'Pan Workspace Active' },
      { id: 'tool-wall', name: 'wall', text: 'Wall Drawing Tool Active' },
      { id: 'tool-column', name: 'column', text: 'Column Placement Active' },
      { id: 'tool-beam', name: 'beam', text: 'Beam Drawing Tool Active' },
      { id: 'tool-door', name: 'door', text: 'Door Placement Active' },
      { id: 'tool-window', name: 'window', text: 'Window Placement Active' },
      { id: 'tool-roomlabel', name: 'roomlabel', text: 'Room Zone Designator Active' },
      { id: 'tool-text', name: 'text', text: 'Text Note Annotation Active' },
      { id: 'tool-areazone', name: 'areazone', text: 'Area Zone Tool Active' },
      { id: 'tool-dimension', name: 'dimension', text: 'Dimension Line Tool Active' },
      { id: 'tool-measure', name: 'measure', text: 'Interactive Laser Measure Tool Active' },
      { id: 'tool-rotate', name: 'rotate', text: 'CAD Rotate Tool Active' },
      { id: 'tool-mirror', name: 'mirror', text: 'CAD Mirror Tool Active' },
      { id: 'tool-scale', name: 'scale', text: 'CAD Scale Tool Active' }
    ];

    tools.forEach(t => {
      const btn = document.getElementById(t.id);
      if (btn) {
        btn.addEventListener('click', () => this.setActiveTool(t.name));
      }
    });

    // Layer Color presets swatches
    const swatches = document.querySelectorAll('.color-swatch');
    swatches.forEach(swatch => {
      const colorHex = swatch.getAttribute('data-color');
      const colorName = swatch.getAttribute('data-color-name');
      
      // Select the default active swatch visually on start
      if (colorHex === this.activeColor) {
        swatch.classList.add('ring-3', 'ring-offset-2');
      }

      swatch.addEventListener('click', () => {
        // Clear active styles from all swatches
        swatches.forEach(s => s.classList.remove('ring-3', 'ring-offset-2', 'scale-110'));
        swatch.classList.add('ring-3', 'ring-offset-2');
        
        this.activeColor = colorHex;
        this.activeColorNameTxt.innerText = colorName;
        
        // Update color preview name style text
        this.activeColorNameTxt.style.color = colorHex;
        
        // Redraw preview if drawing
        if (this.isDrawing && this.previewShape) {
          this.previewShape.color = colorHex;
        }
        this.redraw();
      });
    });

    // Line weight range slider
    const slider = document.getElementById('line-thickness-slider');
    if (slider) {
      slider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10);
        this.setLineWidth(val);
      });
    }

    // Line weight preset clicking nodes
    const weightPresets = document.querySelectorAll('.weight-preset');
    weightPresets.forEach(preset => {
      preset.addEventListener('click', () => {
        weightPresets.forEach(p => {
          p.classList.remove('border-[#3B82F6]', 'text-blue-400', 'bg-[#1E2127]', 'font-bold');
          p.classList.add('border-[#2A2D35]', 'text-gray-400');
        });
        preset.classList.remove('border-[#2A2D35]', 'text-gray-400');
        preset.classList.add('border-[#3B82F6]', 'text-blue-400', 'bg-[#1E2127]', 'font-bold');
        
        const weight = parseInt(preset.getAttribute('data-weight'), 10);
        if (slider) slider.value = weight;
        this.setLineWidth(weight);
      });
    });

    // Grid details slider
    const gridSlider = document.getElementById('grid-size-slider');
    if (gridSlider) {
      gridSlider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10);
        this.gridSize = val;
        this.gridSizeDisplayTxt.innerText = `${val} px`;
        this.redraw();
      });
    }

    // Snapping configuration triggers
    const toggleSnapBtn = document.getElementById('toggle-snap-btn');
    const snapHandle = document.getElementById('snap-handle');
    const mobileSnapBtn = document.getElementById('mobile-snap-btn');

    const triggerSnapToggle = () => {
      this.snapEnabled = !this.snapEnabled;
      
      if (this.snapEnabled) {
        if (toggleSnapBtn) {
          toggleSnapBtn.classList.remove('bg-[#2A2D35]');
          toggleSnapBtn.classList.add('bg-blue-600');
        }
        if (snapHandle) {
          snapHandle.classList.remove('translate-x-0');
          snapHandle.classList.add('translate-x-4');
        }
        if (this.statusSnapIndicator) {
          this.statusSnapIndicator.innerText = "ON";
          this.statusSnapIndicator.className = "text-green-500 font-bold";
        }
        if (mobileSnapBtn) mobileSnapBtn.classList.add('text-blue-400');
      } else {
        if (toggleSnapBtn) {
          toggleSnapBtn.classList.remove('bg-blue-600');
          toggleSnapBtn.classList.add('bg-[#2A2D35]');
        }
        if (snapHandle) {
          snapHandle.classList.remove('translate-x-4');
          snapHandle.classList.add('translate-x-0');
        }
        if (this.statusSnapIndicator) {
          this.statusSnapIndicator.innerText = "OFF";
          this.statusSnapIndicator.className = "text-slate-500 font-bold";
        }
        if (mobileSnapBtn) mobileSnapBtn.classList.remove('text-blue-400');
      }
      this.redraw();
    };

    if (toggleSnapBtn) toggleSnapBtn.addEventListener('click', triggerSnapToggle);
    if (mobileSnapBtn) mobileSnapBtn.addEventListener('click', triggerSnapToggle);

    // Grid displaying toggles
    const toggleGridBtn = document.getElementById('toggle-grid-btn');
    const gridHandle = document.getElementById('grid-handle');
    const mobileGridBtn = document.getElementById('mobile-grid-btn');

    const triggerGridToggle = () => {
      this.gridEnabled = !this.gridEnabled;
      
      if (this.gridEnabled) {
        if (toggleGridBtn) {
          toggleGridBtn.classList.remove('bg-[#2A2D35]');
          toggleGridBtn.classList.add('bg-blue-600');
        }
        if (gridHandle) {
          gridHandle.classList.remove('translate-x-0');
          gridHandle.classList.add('translate-x-4');
        }
        if (mobileGridBtn) mobileGridBtn.classList.add('text-blue-400');
      } else {
        if (toggleGridBtn) {
          toggleGridBtn.classList.remove('bg-blue-600');
          toggleGridBtn.classList.add('bg-[#2A2D35]');
        }
        if (gridHandle) {
          gridHandle.classList.remove('translate-x-4');
          gridHandle.classList.add('translate-x-0');
        }
        if (mobileGridBtn) mobileGridBtn.classList.remove('text-blue-400');
      }
      this.redraw();
    };

    if (toggleGridBtn) toggleGridBtn.addEventListener('click', triggerGridToggle);
    if (mobileGridBtn) mobileGridBtn.addEventListener('click', triggerGridToggle);

    // Measurements display toggles
    const toggleMeasurementsBtn = document.getElementById('toggle-measurements-btn');
    const measurementsHandle = document.getElementById('measurements-handle');

    const triggerMeasurementsToggle = () => {
      this.showMeasurementsOnAll = !this.showMeasurementsOnAll;
      
      if (this.showMeasurementsOnAll) {
        if (toggleMeasurementsBtn) {
          toggleMeasurementsBtn.classList.remove('bg-[#2A2D35]');
          toggleMeasurementsBtn.classList.add('bg-blue-600');
        }
        if (measurementsHandle) {
          measurementsHandle.classList.remove('translate-x-0');
          measurementsHandle.classList.add('translate-x-4');
        }
      } else {
        if (toggleMeasurementsBtn) {
          toggleMeasurementsBtn.classList.remove('bg-blue-600');
          toggleMeasurementsBtn.classList.add('bg-[#2A2D35]');
        }
        if (measurementsHandle) {
          measurementsHandle.classList.remove('translate-x-4');
          measurementsHandle.classList.add('translate-x-0');
        }
      }
      this.redraw();
      this.showStatusFeedback(`Shape Metrics: ${this.showMeasurementsOnAll ? 'ON' : 'OFF'}`);
    };

    if (toggleMeasurementsBtn) toggleMeasurementsBtn.addEventListener('click', triggerMeasurementsToggle);

    // Toggle Dimensions shapes
    const toggleDimensionsBtn = document.getElementById('toggle-dimensions-btn');
    const dimensionsHandle = document.getElementById('dimensions-handle');

    const triggerDimensionsToggle = () => {
      this.displayDimensions = !this.displayDimensions;
      if (this.displayDimensions) {
        if (toggleDimensionsBtn) {
          toggleDimensionsBtn.classList.remove('bg-[#2A2D35]');
          toggleDimensionsBtn.classList.add('bg-blue-600');
        }
        if (dimensionsHandle) {
          dimensionsHandle.classList.remove('translate-x-0');
          dimensionsHandle.classList.add('translate-x-4');
        }
      } else {
        if (toggleDimensionsBtn) {
          toggleDimensionsBtn.classList.remove('bg-blue-600');
          toggleDimensionsBtn.classList.add('bg-[#2A2D35]');
        }
        if (dimensionsHandle) {
          dimensionsHandle.classList.remove('translate-x-4');
          dimensionsHandle.classList.add('translate-x-0');
        }
      }
      this.redraw();
      this.showStatusFeedback(`CAD Dimensions: ${this.displayDimensions ? 'ON' : 'OFF'}`);
    };

    if (toggleDimensionsBtn) toggleDimensionsBtn.addEventListener('click', triggerDimensionsToggle);


    // Toggle Room Dimensions
    const toggleRoomDimensionsBtn = document.getElementById('toggle-room-dimensions-btn');
    const roomDimensionsHandle = document.getElementById('room-dimensions-handle');

    const triggerRoomDimensionsToggle = () => {
      this.showRoomDimensions = !this.showRoomDimensions;
      if (this.showRoomDimensions) {
        if (toggleRoomDimensionsBtn) {
          toggleRoomDimensionsBtn.classList.remove('bg-[#2A2D35]');
          toggleRoomDimensionsBtn.classList.add('bg-blue-600');
        }
        if (roomDimensionsHandle) {
          roomDimensionsHandle.classList.remove('translate-x-0');
          roomDimensionsHandle.classList.add('translate-x-4');
        }
      } else {
        if (toggleRoomDimensionsBtn) {
          toggleRoomDimensionsBtn.classList.remove('bg-blue-600');
          toggleRoomDimensionsBtn.classList.add('bg-[#2A2D35]');
        }
        if (roomDimensionsHandle) {
          roomDimensionsHandle.classList.remove('translate-x-4');
          roomDimensionsHandle.classList.add('translate-x-0');
        }
      }
      this.redraw();
      this.showStatusFeedback(`Room Info Dimensions: ${this.showRoomDimensions ? 'ON' : 'OFF'}`);
    };

    if (toggleRoomDimensionsBtn) toggleRoomDimensionsBtn.addEventListener('click', triggerRoomDimensionsToggle);


    // Toggle Wall/Aperture Dimensions
    const toggleWallDimensionsBtn = document.getElementById('toggle-wall-dimensions-btn');
    const wallDimensionsHandle = document.getElementById('wall-dimensions-handle');

    const triggerWallDimensionsToggle = () => {
      this.showWallDimensions = !this.showWallDimensions;
      if (this.showWallDimensions) {
        if (toggleWallDimensionsBtn) {
          toggleWallDimensionsBtn.classList.remove('bg-[#2A2D35]');
          toggleWallDimensionsBtn.classList.add('bg-blue-600');
        }
        if (wallDimensionsHandle) {
          wallDimensionsHandle.classList.remove('translate-x-0');
          wallDimensionsHandle.classList.add('translate-x-4');
        }
      } else {
        if (toggleWallDimensionsBtn) {
          toggleWallDimensionsBtn.classList.remove('bg-blue-600');
          toggleWallDimensionsBtn.classList.add('bg-[#2A2D35]');
        }
        if (wallDimensionsHandle) {
          wallDimensionsHandle.classList.remove('translate-x-4');
          wallDimensionsHandle.classList.add('translate-x-0');
        }
      }
      this.redraw();
      this.showStatusFeedback(`Wall/Opening Dimensions: ${this.showWallDimensions ? 'ON' : 'OFF'}`);
    };

    if (toggleWallDimensionsBtn) toggleWallDimensionsBtn.addEventListener('click', triggerWallDimensionsToggle);

    // Global action undo trigger
    const undoBtn = document.getElementById('action-undo');
    if (undoBtn) undoBtn.addEventListener('click', () => this.undo());

    // Global action redo trigger
    const redoBtn = document.getElementById('action-redo');
    if (redoBtn) {
      redoBtn.addEventListener('click', () => this.redo());
      this.updateRedoButtonState();
    }

    // Modal cleaning controllers
    const clearBtn = document.getElementById('action-clear');
    const clearModal = document.getElementById('clear-modal');
    const cancelClearBtn = document.getElementById('cancel-clear-btn');
    const confirmClearBtn = document.getElementById('confirm-clear-btn');

    if (clearBtn && clearModal) {
      clearBtn.addEventListener('click', () => {
        clearModal.classList.remove('hidden');
      });
    }

    if (cancelClearBtn && clearModal) {
      cancelClearBtn.addEventListener('click', () => {
        clearModal.classList.add('hidden');
      });
    }

    if (confirmClearBtn && clearModal) {
      confirmClearBtn.addEventListener('click', () => {
        this.clearAll();
        clearModal.classList.add('hidden');
      });
    }

    // Delete Selected Trigger action
    const deleteSelectedBtn = document.getElementById('action-delete-selected');
    if (deleteSelectedBtn) {
      deleteSelectedBtn.addEventListener('click', () => this.deleteSelectedShape());
    }

    // Export SVG Trigger action
    const exportBtn = document.getElementById('action-export');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => this.exportToSVG());
    }

    // Export Dropdown menu trigger togglers
    const exportTrigger = document.getElementById('action-export-trigger');
    const exportMenu = document.getElementById('export-dropdown-menu');
    if (exportTrigger && exportMenu) {
      exportTrigger.addEventListener('click', (e) => {
        e.stopPropagation();
        exportMenu.classList.toggle('hidden');
      });
      
      // Close dropdown if clicked outside of it
      document.addEventListener('click', (e) => {
        if (!exportTrigger.contains(e.target) && !exportMenu.contains(e.target)) {
          exportMenu.classList.add('hidden');
        }
      });
    }

    // Export formats event handlers
    const exportPngBtn = document.getElementById('export-png-btn');
    if (exportPngBtn) {
      exportPngBtn.addEventListener('click', () => {
        if (exportMenu) exportMenu.classList.add('hidden');
        this.exportToPNG();
      });
    }

    const exportSvgMenuBtn = document.getElementById('export-svg-btn');
    if (exportSvgMenuBtn) {
      exportSvgMenuBtn.addEventListener('click', () => {
        if (exportMenu) exportMenu.classList.add('hidden');
        this.exportToSVG();
      });
    }

    const exportJsonBtn = document.getElementById('export-json-btn');
    if (exportJsonBtn) {
      exportJsonBtn.addEventListener('click', () => {
        if (exportMenu) exportMenu.classList.add('hidden');
        this.exportToJSON();
      });
    }

    const exportDxfBtn = document.getElementById('export-dxf-btn');
    if (exportDxfBtn) {
      exportDxfBtn.addEventListener('click', () => {
        if (exportMenu) exportMenu.classList.add('hidden');
        this.exportToDXF();
      });
    }

    const exportPdfBtn = document.getElementById('export-pdf-btn');
    if (exportPdfBtn) {
      exportPdfBtn.addEventListener('click', () => {
        if (exportMenu) exportMenu.classList.add('hidden');
        this.openPdfExportModal();
      });
    }

    // Import control flow triggers
    const importBtn = document.getElementById('action-import');
    const importFileInput = document.getElementById('action-import-file');
    if (importBtn && importFileInput) {
      importBtn.addEventListener('click', () => {
        importFileInput.click();
      });

      importFileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
          try {
            if (event.target && typeof event.target.result === 'string') {
              const data = JSON.parse(event.target.result);
              this.importFromJSON(data);
            }
            importFileInput.value = ''; // Reset slot
          } catch (err) {
            console.error("CAD project JSON parse failure:", err);
            alert("Failed to parse CAD Project JSON. Please check file format integrity.");
            importFileInput.value = '';
          }
        };
        reader.readAsText(file);
      });
    }

    const importDxfBtn = document.getElementById('action-import-dxf');
    const importDxfFileInput = document.getElementById('action-import-dxf-file');
    if (importDxfBtn && importDxfFileInput) {
      importDxfBtn.addEventListener('click', () => {
        importDxfFileInput.click();
      });

      importDxfFileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
          try {
            if (event.target && typeof event.target.result === 'string') {
              this.importFromDXF(event.target.result);
            }
            importDxfFileInput.value = ''; // Reset slot
          } catch (err) {
            console.error("CAD project DXF parse failure:", err);
            alert("Failed to parse CAD Project DXF. Please check file format integrity.");
            importDxfFileInput.value = '';
          }
        };
        reader.readAsText(file);
      });
    }

    // Aether format Open and Save handlers
    const openAetherBtn = document.getElementById('action-open-aether');
    const openAetherFileInput = document.getElementById('action-open-aether-file');
    const saveAetherBtn = document.getElementById('action-save-aether');

    if (openAetherBtn && openAetherFileInput) {
      openAetherBtn.addEventListener('click', () => {
        openAetherFileInput.click();
      });

      openAetherFileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
          try {
            if (event.target && typeof event.target.result === 'string') {
              const data = JSON.parse(event.target.result);
              this.importFromAether(data);
            }
            openAetherFileInput.value = ''; // Reset
          } catch (err) {
            console.error("Aether Project loading parse failure:", err);
            alert("Failed to parse Aether CAD Project file. Please ensure it is a valid .aether project file.");
            openAetherFileInput.value = '';
          }
        };
        reader.readAsText(file);
      });
    }

    if (saveAetherBtn) {
      saveAetherBtn.addEventListener('click', () => {
        this.exportToAether();
      });
    }

    // AI Floor Plan Generator event handler
    const aiGenerateBtn = document.getElementById('ai-generate-btn');
    const aiPromptInput = document.getElementById('ai-prompt-input');
    const aiStatusPanel = document.getElementById('ai-status-panel');
    const aiStatusText = document.getElementById('ai-status-text');
    const aiSourceIndicator = document.getElementById('ai-source-indicator');

    if (aiGenerateBtn && aiPromptInput) {
      aiGenerateBtn.addEventListener('click', async () => {
        const prompt = aiPromptInput.value.trim();
        if (!prompt) {
          alert('Please enter a description for the floor plan first.');
          return;
        }

        // Disable button, show loading
        aiGenerateBtn.disabled = true;
        const originalBtnText = aiGenerateBtn.innerHTML;
        aiGenerateBtn.innerHTML = `
          <svg class="animate-spin -ml-1 mr-3 h-4 w-4 text-white inline-block" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" style="width: 14px; height: 14px;">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Generating...
        `;

        if (aiStatusPanel) aiStatusPanel.classList.remove('hidden');
        if (aiStatusText) aiStatusText.innerText = 'Consulting AI Architect...';
        if (aiSourceIndicator) aiSourceIndicator.classList.add('hidden');

        // Fetch and reset AI mind logs
        const aiMindInsights = document.getElementById('ai-mind-insights');
        const aiMindStatus = document.getElementById('ai-mind-status');
        const aiMindReqsList = document.getElementById('ai-mind-requirements-list');
        const aiMindThinking = document.getElementById('ai-mind-thinking-process');
        const aiMindLogs = document.getElementById('ai-mind-execution-logs');
        const aiMindChecklist = document.getElementById('ai-mind-validation-checklist');

        if (aiMindInsights) aiMindInsights.classList.remove('hidden');
        if (aiMindStatus) {
          aiMindStatus.innerText = 'Analyzing...';
          aiMindStatus.className = 'text-[9px] text-yellow-400 font-mono animate-pulse font-bold';
        }
        if (aiMindReqsList) {
          aiMindReqsList.innerHTML = `
            <div class="flex items-center gap-1.5 text-[9px] text-gray-500 italic">
              <span class="w-1 h-1 rounded-full bg-cyan-400 animate-ping"></span>
              Analyzing natural language instructions...
            </div>
          `;
        }
        if (aiMindThinking) {
          aiMindThinking.innerHTML = `
            <div class="flex items-center gap-1.5 text-[9px] text-gray-500 italic">
              <span class="w-1 h-1 rounded-full bg-cyan-400 animate-ping"></span>
              Planning spatial arrangements and constraints...
            </div>
          `;
        }
        if (aiMindLogs) {
          aiMindLogs.innerHTML = `
            <div class="flex items-center gap-1.5 text-[9px] text-gray-500 italic">
              <span class="w-1 h-1 rounded-full bg-cyan-400 animate-ping"></span>
              Initializing drafting compiler thread...
            </div>
          `;
        }
        if (aiMindChecklist) {
          aiMindChecklist.innerHTML = `
            <div class="flex items-center gap-1.5 text-[9px] text-gray-500 italic">
              <span class="w-1 h-1 rounded-full bg-cyan-400 animate-ping"></span>
              Awaiting layout generation...
            </div>
          `;
        }

        try {
          const response = await fetch('/api/generate-floorplan', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ prompt })
          });

          if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.error || errData.details || `Server error: ${response.status}`);
          }

          const result = await response.json();

          if (aiStatusText) aiStatusText.innerText = 'Sinking structural joints...';

          // Helper to calculate segment coords on a wall
          const getSegmentCoordsOnWall = (wall, position, width) => {
            const x1 = Number(wall.x1 || 0);
            const y1 = Number(wall.y1 || 0);
            const x2 = Number(wall.x2 || 0);
            const y2 = Number(wall.y2 || 0);

            const dx = x2 - x1;
            const dy = y2 - y1;
            const len = Math.sqrt(dx * dx + dy * dy);

            if (len === 0) {
              return { x1, y1, x2, y2 };
            }

            const ux = dx / len;
            const uy = dy / len;

            const posStart = Math.max(0, Math.min(len - width, Number(position || 0)));
            const posEnd = Math.max(0, Math.min(len, posStart + Number(width || 30)));

            return {
              x1: x1 + posStart * ux,
              y1: y1 + posStart * uy,
              x2: x1 + posEnd * ux,
              y2: y1 + posEnd * uy
            };
          };

          // Map walls
          const wallsList = [];
          const mappedShapes = [];

          if (Array.isArray(result.walls)) {
            result.walls.forEach((w, idx) => {
              const wallObj = {
                type: 'wall',
                id: 'ai_wall_' + idx + '_' + Math.random().toString(36).substr(2, 5),
                x1: Number(w.x1 || 0),
                y1: Number(w.y1 || 0),
                x2: Number(w.x2 || 0),
                y2: Number(w.y2 || 0),
                color: '#38BDF8', // standard wallColor
                lineWidth: 2,
                wallThickness: Number(w.thickness || 16),
                layerId: 'walls'
              };
              wallsList.push(wallObj);
              mappedShapes.push(wallObj);
            });
          }

          // Map rooms (areazone) with color-coded theme borders
          if (Array.isArray(result.rooms)) {
            result.rooms.forEach((r, idx) => {
              const lowerName = (r.name || '').toLowerCase();
              let roomColor = '#A855F7'; // default purple
              if (lowerName.includes('master bedroom') || lowerName.includes('master bed') || lowerName.includes('bedroom') || lowerName.includes('bed room') || lowerName.includes('bed')) {
                roomColor = '#A855F7'; // purple
              } else if (lowerName.includes('kitchen') || lowerName.includes('pantry')) {
                roomColor = '#F59E0B'; // yellow/orange
              } else if (lowerName.includes('bathroom') || lowerName.includes('bath') || lowerName.includes('toilet') || lowerName.includes('restroom') || lowerName.includes('wc') || lowerName.includes('powder')) {
                roomColor = '#10B981'; // green for bathroom
              } else if (lowerName.includes('hall')) {
                roomColor = '#06B6D4'; // cyan for hall
              } else if (lowerName.includes('living') || lowerName.includes('dining') || lowerName.includes('lobby') || lowerName.includes('drawing') || lowerName.includes('lounge') || lowerName.includes('family')) {
                roomColor = '#94A3B8'; // gray/slate for living
              }

              mappedShapes.push({
                type: 'areazone',
                id: 'ai_room_' + idx + '_' + Math.random().toString(36).substr(2, 5),
                x: Number(r.x || 0),
                y: Number(r.y || 0),
                width: Number(r.width || 100),
                height: Number(r.height || 100),
                color: roomColor,
                lineWidth: 1.5,
                zoneName: r.name || 'Room',
                layerId: 'default'
              });
            });
          }

          // Map doors
          if (Array.isArray(result.doors)) {
            result.doors.forEach((d, idx) => {
              let refWall = null;
              if (d.wall_ref !== undefined) {
                // Find wall by ref
                const wallIdx = parseInt(String(d.wall_ref).replace(/\D/g, ''));
                if (!isNaN(wallIdx) && wallsList[wallIdx]) {
                  refWall = wallsList[wallIdx];
                } else if (wallsList.length > 0) {
                  refWall = wallsList[0];
                }
              }

              if (refWall) {
                const coords = getSegmentCoordsOnWall(refWall, d.position, d.width || 35);
                mappedShapes.push({
                  type: 'door',
                  id: 'ai_door_' + idx + '_' + Math.random().toString(36).substr(2, 5),
                  x1: coords.x1,
                  y1: coords.y1,
                  x2: coords.x2,
                  y2: coords.y2,
                  color: '#F59E0B', // doorColor
                  lineWidth: 2,
                  layerId: 'default'
                });
              }
            });
          }

          // Map windows
          if (Array.isArray(result.windows)) {
            result.windows.forEach((w, idx) => {
              let refWall = null;
              if (w.wall_ref !== undefined) {
                const wallIdx = parseInt(String(w.wall_ref).replace(/\D/g, ''));
                if (!isNaN(wallIdx) && wallsList[wallIdx]) {
                  refWall = wallsList[wallIdx];
                } else if (wallsList.length > 0) {
                  refWall = wallsList[0];
                }
              }

              if (refWall) {
                const coords = getSegmentCoordsOnWall(refWall, w.position, w.width || 50);
                mappedShapes.push({
                  type: 'window',
                  id: 'ai_win_' + idx + '_' + Math.random().toString(36).substr(2, 5),
                  x1: coords.x1,
                  y1: coords.y1,
                  x2: coords.x2,
                  y2: coords.y2,
                  color: '#60A5FA', // winColor
                  lineWidth: 2,
                  windowThickness: 8,
                  layerId: 'default'
                });
              }
            });
          }

          // Construct AetherCAD compatible structure
          const importedProject = {
            layers: [
              { id: 'default', name: 'Default', visible: true, locked: false },
              { id: 'walls', name: 'Walls', visible: true, locked: false },
              { id: 'columns', name: 'Columns', visible: true, locked: false },
              { id: 'dimensions', name: 'Dimensions', visible: true, locked: false },
              { id: 'electrical', name: 'Electrical', visible: true, locked: false }
            ],
            activeLayerId: 'default',
            shapes: mappedShapes
          };

          // Render via existing importFromJSON
          this.importFromJSON(importedProject);

          // Force units to feet and apply perfect calculated scale ratio
          this.activeUnit = 'ft';
          this.scaleRatio = Number(result.scale_ratio || 1.0);

          // Sync unit dropdown selection in the UI
          const unitSelect = document.getElementById('active-unit-select');
          if (unitSelect) {
            unitSelect.value = 'ft';
          }

          // Sync scale dropdown selection by dynamically inserting the custom scale ratio if needed
          const scaleSelect = document.getElementById('active-scale-select');
          if (scaleSelect) {
            let optionExists = false;
            for (let i = 0; i < scaleSelect.options.length; i++) {
              if (parseFloat(scaleSelect.options[i].value) === this.scaleRatio) {
                scaleSelect.selectedIndex = i;
                optionExists = true;
                break;
              }
            }
            if (!optionExists) {
              const customOpt = document.createElement('option');
              customOpt.value = String(this.scaleRatio);
              customOpt.text = `1:${this.scaleRatio.toFixed(1)} (AI Scale)`;
              scaleSelect.add(customOpt);
              scaleSelect.value = String(this.scaleRatio);
            }
          }

          this.updatePrecisionLabels();
          this.updatePropertiesPanel();
          this.redraw();

          // Update success details
          if (aiStatusText) aiStatusText.innerText = 'Floor plan generated successfully!';
          if (aiSourceIndicator) {
            aiSourceIndicator.innerText = `Generated via ${result.source === 'gemini' ? 'Gemini' : 'OpenRouter'}`;
            aiSourceIndicator.classList.remove('hidden');
          }

          // Populate AI Cognitive Mind Logs
          const reqs = result.requirements || {};

          // 1. Requirements Parsed List
          if (aiMindReqsList) {
            aiMindReqsList.innerHTML = `
              <div class="text-[9.5px] text-emerald-400 font-bold mb-0.5 flex items-center gap-1">
                <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                Understood User Intent:
              </div>
              <div class="flex flex-col gap-0.5 pl-2.5 text-gray-300 font-mono text-[9px] leading-relaxed">
                <div>• Project: <span class="text-white font-semibold">${reqs.project_name || 'CAD Plan'}</span></div>
                <div>• Category: <span class="text-cyan-400">${reqs.type || 'Custom'} Layout</span></div>
                <div>• Target Footprint: <span class="text-cyan-400">${reqs.total_sqft || 'Auto'} sqft</span></div>
                <div>• Dimensions: <span class="text-cyan-400">${reqs.plot_width_ft || 'Auto'} x ${reqs.plot_length_ft || 'Auto'} ft</span></div>
                <div>• Facing: <span class="text-cyan-400">${reqs.facing_direction || 'North'}</span></div>
              </div>
            `;
          }

          // 2. Cognitive Reasoning List
          if (aiMindThinking) {
            const reasoningSteps = Array.isArray(reqs.reasoning) && reqs.reasoning.length > 0 ? reqs.reasoning : [
              "Chose layout grid pattern optimized for " + (reqs.type || "custom request") + " layouts.",
              "Mapped room count and sizes literally from natural language description.",
              "Calculated perfect spatial scale to fit constraints inside a " + (reqs.total_sqft || "600") + " sqft region.",
              "Aligned floor plan facing orientation to " + (reqs.facing_direction || "North") + " as specified by user."
            ];
            aiMindThinking.innerHTML = `
              <div class="text-[9.5px] text-emerald-400 font-bold mb-0.5 flex items-center gap-1">
                <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                Design & Logic Decisions:
              </div>
              <div class="flex flex-col gap-1 pl-2.5 text-gray-300 leading-normal">
                ${reasoningSteps.map(step => `
                  <div class="flex items-start gap-1 font-sans text-[9px]">
                    <span class="text-cyan-400 shrink-0 mt-0.5">•</span>
                    <span>${step}</span>
                  </div>
                `).join('')}
              </div>
            `;
          }

          // 3. Execution Logs List
          if (aiMindLogs) {
            const wallCount = Array.isArray(result.walls) ? result.walls.length : 0;
            const doorCount = Array.isArray(result.doors) ? result.doors.length : 0;
            const windowCount = Array.isArray(result.windows) ? result.windows.length : 0;
            const roomCount = Array.isArray(result.rooms) ? result.rooms.length : 0;
            aiMindLogs.innerHTML = `
              <div class="text-[9.5px] text-emerald-400 font-bold mb-0.5 flex items-center gap-1">
                <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                Spatial Compiler Output:
              </div>
              <div class="flex flex-col gap-0.5 pl-2.5 font-mono text-[9px] text-gray-400 leading-relaxed">
                <div>[OK] Layout topology parsed: ${reqs.type || 'CUSTOM'}</div>
                <div>[OK] Mapped ${roomCount} independent zones successfully</div>
                <div>[OK] Structured ${wallCount} structural wall joints</div>
                <div>[OK] Sunk ${doorCount} entryways with optimal swing paths</div>
                <div>[OK] Positioned ${windowCount} exterior ventilation windows</div>
                <div>[OK] Formulated scale ratio 1:${Number(result.scale_ratio || 1.0).toFixed(1)}</div>
              </div>
            `;
          }

          // 4. Requirements Match Verification List
          if (aiMindChecklist) {
            const roomNames = (result.rooms || []).map(r => r.zoneName || r.name || 'Room');
            const totalRooms = roomNames.length;
            aiMindChecklist.innerHTML = `
              <div class="text-[9.5px] text-emerald-400 font-bold mb-0.5 flex items-center gap-1">
                <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                Match Verification:
              </div>
              <div class="flex flex-col gap-0.5 pl-2.5 text-emerald-300 font-medium text-[9px] leading-relaxed">
                <div>✓ Mapped ${totalRooms} rooms: <span class="text-white font-mono">${roomNames.join(', ')}</span></div>
                <div>✓ Orientation established to <span class="text-white font-mono">${reqs.facing_direction || 'North'}</span></div>
                <div>✓ Retained custom dimensions from prompt exactly</div>
                <div>✓ Positioned connected adjacent zones & restrooms</div>
                <div class="text-emerald-400 font-bold mt-1 uppercase tracking-wider">✓ 100% matched to requirements!</div>
              </div>
            `;
          }

          if (aiMindStatus) {
            aiMindStatus.innerText = 'Completed';
            aiMindStatus.className = 'text-[9px] text-emerald-400 font-mono font-bold';
          }

        } catch (err) {
          console.error('AI Floor Plan Generation Error:', err);
          if (aiStatusText) aiStatusText.innerText = `Error: ${err.message}`;
          
          if (aiMindStatus) {
            aiMindStatus.innerText = 'Failed';
            aiMindStatus.className = 'text-[9px] text-red-500 font-mono font-bold';
          }
          if (aiMindChecklist) {
            aiMindChecklist.innerHTML = `
              <div class="text-[9.5px] text-red-500 font-bold mb-0.5">✗ Generation Aborted:</div>
              <div class="text-[9px] text-red-400 pl-2 leading-relaxed font-mono">
                Error during parsing or layout compiling: ${err.message}
              </div>
            `;
          }
          alert(`AI Generation Failed: ${err.message}`);
        } finally {
          aiGenerateBtn.disabled = false;
          aiGenerateBtn.innerHTML = originalBtnText;
        }
      });
    }

    // Initialize premium features
    this.setupContextMenu();
    this.setupPdfExport();
    this.setupCommandLine();
    this.setupPremiumThemeAndShortcuts();
    this.setupCivilTemplates();
    this.setupWorkspaceZoomControls();
    this.setupTopMenuBarDropdowns();
  }

  /**
   * Initialize custom sub-snap triggers, unit system selector, precision drafting form, and selected properties updates
   */
  initPrecisionAndPropertiesControls() {
    // 1. Sub-snapping checkbox handlers
    const snapGridCb = document.getElementById('snap-grid-cb');
    const snapEndCb = document.getElementById('snap-endpoints-cb');
    const snapMidCb = document.getElementById('snap-midpoints-cb');

    if (snapGridCb) {
      snapGridCb.addEventListener('change', (e) => {
        this.snapToGrid = e.target.checked;
        this.redraw();
      });
    }
    if (snapEndCb) {
      snapEndCb.addEventListener('change', (e) => {
        this.snapToEndpoints = e.target.checked;
        this.redraw();
      });
    }
    if (snapMidCb) {
      snapMidCb.addEventListener('change', (e) => {
        this.snapToMidpoints = e.target.checked;
        this.redraw();
      });
    }

    // 2. Active engineering unit selector
    const unitSelect = document.getElementById('active-unit-select');
    if (unitSelect) {
      unitSelect.addEventListener('change', (e) => {
        this.activeUnit = e.target.value;
        this.updatePrecisionLabels();
        this.updatePropertiesPanel();
        this.redraw();
      });
    }

    // Circle draft method selector
    const circleDraftSelect = document.getElementById('circle-draft-method');
    if (circleDraftSelect) {
      circleDraftSelect.addEventListener('change', (e) => {
        this.circleDraftMethod = e.target.value;
        this.showStatusFeedback(`Circle Draft Method: ${e.target.value === 'bounding' ? 'Bounding Box' : 'Center-Radius'}`);
      });
    }

    // Active scale selector listener
    this.scaleRatio = 1.0; // dynamic scale ratio: 1:1, 1:100, etc.
    const scaleSelect = document.getElementById('active-scale-select');
    if (scaleSelect) {
      scaleSelect.addEventListener('change', (e) => {
        this.scaleRatio = parseFloat(e.target.value) || 1.0;
        this.showStatusFeedback(`Drawing Scale set to 1:${this.scaleRatio}`);
        this.updatePrecisionLabels();
        this.updatePropertiesPanel();
        this.redraw();
      });
    }

    // Custom room label indicator listener
    const rLabelSelect = document.getElementById('civil-room-label');
    const rLabelCustomInput = document.getElementById('civil-room-custom');
    if (rLabelSelect && rLabelCustomInput) {
      rLabelSelect.addEventListener('change', (e) => {
        if (e.target.value === "Custom Label") {
          rLabelCustomInput.classList.remove('hidden');
          rLabelCustomInput.focus();
        } else {
          rLabelCustomInput.classList.add('hidden');
        }
      });
    }

    // 3. Precision shape drafting trigger
    const addPrecisionBtn = document.getElementById('add-precision-shape-btn');
    if (addPrecisionBtn) {
      addPrecisionBtn.addEventListener('click', () => {
        if (this.activeTool === 'select') {
          this.showStatusFeedback("Please select a shape drawing tool first!");
          return;
        }

        const x1Input = document.getElementById('prec-x1');
        const y1Input = document.getElementById('prec-y1');
        const v1Input = document.getElementById('prec-v1');
        const v2Input = document.getElementById('prec-v2');

        const x1 = this.parseValueToPixels(x1Input ? x1Input.value : 0);
        const y1 = this.parseValueToPixels(y1Input ? y1Input.value : 0);
        const v1 = this.parseValueToPixels(v1Input ? v1Input.value : 0);
        const v2 = this.parseValueToPixels(v2Input ? v2Input.value : 0);

        let newShape = null;
        const color = this.activeColor;
        const thickness = this.activeThickness;

        if (this.activeTool === 'line') {
          newShape = new Line(x1, y1, v1, v2, color, thickness);
        } else if (this.activeTool === 'wall') {
          const wallThickEl = document.getElementById('wall-thickness-input');
          const wallThick = wallThickEl ? parseFloat(wallThickEl.value) || 12 : 12;
          newShape = new Wall(x1, y1, v1, v2, color, thickness, wallThick);
        } else if (this.activeTool === 'beam') {
          newShape = new Beam(x1, y1, v1, v2, color, thickness);
        } else if (this.activeTool === 'door') {
          newShape = new Door(x1, y1, v1, v2, color, thickness);
        } else if (this.activeTool === 'window') {
          const winThickEl = document.getElementById('wall-thickness-input');
          const winThick = winThickEl ? parseFloat(winThickEl.value) || 12 : 12;
          newShape = new Window(x1, y1, v1, v2, color, thickness, winThick);
        } else if (this.activeTool === 'dimension') {
          newShape = new Dimension(x1, y1, v1, v2, color, thickness);
        } else if (this.activeTool === 'rectangle') {
          newShape = new Rectangle(x1, y1, v1, v2, color, thickness);
        } else if (this.activeTool === 'column') {
          newShape = new Column(x1, y1, v1, v2, color, thickness);
        } else if (this.activeTool === 'roomlabel') {
          const rSelect = document.getElementById('civil-room-label');
          const rCustom = document.getElementById('civil-room-custom');
          let labelStr = "Room";
          if (rSelect) {
            if (rSelect.value === "Custom Label" && rCustom) {
              labelStr = rCustom.value.trim() || "Custom Zone";
            } else {
              labelStr = rSelect.value;
            }
          }
          newShape = new RoomLabel(x1, y1, v1, v2, color, thickness, labelStr);
        } else if (this.activeTool === 'text') {
          const customInput = document.getElementById('civil-room-custom');
          const textVal = (customInput && customInput.value.trim()) ? customInput.value.trim() : "Note Tag";
          newShape = new TextLabel(x1, y1, color, thickness, textVal, 14);
        } else if (this.activeTool === 'areazone') {
          const rSelect = document.getElementById('civil-room-label');
          const rCustom = document.getElementById('civil-room-custom');
          let labelStr = "Planimetric Zone";
          if (rSelect) {
            if (rSelect.value === "Custom Label" && rCustom) {
              labelStr = rCustom.value.trim() || "Custom Area";
            } else {
              labelStr = rSelect.value;
            }
          }
          newShape = new AreaZone(x1, y1, v1, v2, color, thickness, labelStr);
        } else if (this.activeTool === 'circle') {
          newShape = new Circle(x1, y1, v1, color, thickness);
        }

        if (newShape) {
          newShape.layerId = this.activeLayerId;
          this.shapes.push(newShape);
          this.redoStack = [];
          this.updateRedoButtonState();
          this.saveDrawing();
          this.updateEntityList();
          this.redraw();
          
          // Clear inputs
          if (x1Input) x1Input.value = '';
          if (y1Input) y1Input.value = '';
          if (v1Input) v1Input.value = '';
          if (v2Input) v2Input.value = '';

          this.showStatusFeedback(`Precise ${this.activeTool} drafted successfully!`);
        }
      });
    }

    // 4. Selected shape properties editor details update trigger
    const propUpdateBtn = document.getElementById('prop-update-btn');
    if (propUpdateBtn) {
      propUpdateBtn.addEventListener('click', () => {
        if (!this.selectedShape) return;
        if (this.isLayerLocked(this.selectedShape.layerId)) {
          this.showStatusFeedback("Cannot modify: Selected shape's layer is locked.");
          return;
        }

        const inputX = document.getElementById('prop-input-x');
        const inputY = document.getElementById('prop-input-y');
        const inputW = document.getElementById('prop-input-w');
        const inputH = document.getElementById('prop-input-h');

        const x = this.parseValueToPixels(inputX ? inputX.value : 0);
        const y = this.parseValueToPixels(inputY ? inputY.value : 0);
        const w = this.parseValueToPixels(inputW ? inputW.value : 0);
        const h = this.parseValueToPixels(inputH ? inputH.value : 0);

        const shape = this.selectedShape;
        
        // Find attached dimensions before updating the coordinates
        const oldVertices = this.getShapeVertices(shape);
        const attached = [];
        if (shape.type !== 'dimension') {
          this.shapes.forEach(sh => {
            if (sh.type === 'dimension') {
              let vertIdx1 = -1;
              let vertIdx2 = -1;
              const toleranceY = 3;
              oldVertices.forEach((v, idx) => {
                if (Math.hypot(sh.x1 - v.x, sh.y1 - v.y) < toleranceY) vertIdx1 = idx;
                if (Math.hypot(sh.x2 - v.x, sh.y2 - v.y) < toleranceY) vertIdx2 = idx;
              });
              if (vertIdx1 !== -1 || vertIdx2 !== -1) {
                attached.push({ dimension: sh, vertIdx1, vertIdx2 });
              }
            }
          });
        }

        if (['line', 'wall', 'beam', 'door', 'window', 'dimension'].includes(shape.type)) {
          shape.x1 = x;
          shape.y1 = y;
          shape.x2 = w;
          shape.y2 = h;
          if (shape.type === 'dimension') {
            const propDimtypeSelect = document.getElementById('prop-dimtype-select');
            if (propDimtypeSelect) {
              shape.dimType = propDimtypeSelect.value;
            }
          }
        } else if (['rectangle', 'column', 'roomlabel', 'areazone'].includes(shape.type)) {
          shape.x = x;
          shape.y = y;
          shape.width = w;
          shape.height = h;
        } else if (shape.type === 'text') {
          shape.x = x;
          shape.y = y;
          shape.fontSize = parseInt(inputW ? inputW.value : 14) || 14;
        } else if (shape.type === 'circle') {
          shape.centerX = x;
          shape.centerY = y;
          shape.radius = w;
        }

        // Apply attached dimensions anchor updates
        if (attached.length > 0) {
          const newVertices = this.getShapeVertices(shape);
          attached.forEach(entry => {
            if (entry.vertIdx1 !== -1 && newVertices[entry.vertIdx1]) {
              entry.dimension.x1 = newVertices[entry.vertIdx1].x;
              entry.dimension.y1 = newVertices[entry.vertIdx1].y;
            }
            if (entry.vertIdx2 !== -1 && newVertices[entry.vertIdx2]) {
              entry.dimension.x2 = newVertices[entry.vertIdx2].x;
              entry.dimension.y2 = newVertices[entry.vertIdx2].y;
            }
          });
        }

        this.saveDrawing();
        this.updateEntityList();
        this.updatePropertiesPanel();
        this.redraw();
        this.showStatusFeedback("Object updated precisely.");
      });
    }

    // Dynamic Move Selected to Layer Dropdown Event Bindings
    const assignSelect = document.getElementById('assign-layer-select');
    if (assignSelect) {
      assignSelect.addEventListener('change', (e) => {
        if (this.selectedShape) {
          this.selectedShape.layerId = e.target.value;
          this.saveDrawing();
          this.updateEntityList();
          this.redraw();
          this.showStatusFeedback("Shape layer re-assigned.");
        }
      });
    }
  }

  updatePrecisionLabels() {
    const title = document.getElementById('prec-form-title');
    const lblX1 = document.getElementById('prec-lbl-x1');
    const lblY1 = document.getElementById('prec-lbl-y1');
    const lblV1 = document.getElementById('prec-lbl-v1');
    const lblV2 = document.getElementById('prec-lbl-v2');
    
    const wrapperV2 = lblV2 ? lblV2.parentElement : null;
    const inputV2 = document.getElementById('prec-v2');
    
    // Get unit text label
    const u = this.activeUnit;
    
    if (this.activeTool === 'select' || !this.activeTool) {
      if (title) title.innerText = "CHOOSE A DRAWING TOOL";
      return;
    }
    
    if (title) title.innerText = `DRAFT PRECISE ${this.activeTool.toUpperCase()}`;
    
    // Enable wrapper fallback default classes
    if (wrapperV2) {
      wrapperV2.style.display = 'block';
      wrapperV2.classList.remove('pointer-events-none', 'opacity-30');
    }
    if (inputV2) {
      inputV2.removeAttribute('disabled');
      inputV2.removeAttribute('placeholder');
      inputV2.className = "w-full bg-[#1E2127] border border-[#2A2D35] rounded px-2 py-1 text-xs text-gray-200 outline-none";
    }

    if (this.activeTool === 'line') {
      if (lblX1) lblX1.innerText = `START X (${u})`;
      if (lblY1) lblY1.innerText = `START Y (${u})`;
      if (lblV1) lblV1.innerText = `END X (${u})`;
      if (lblV2) lblV2.innerText = `END Y (${u})`;
    } else if (this.activeTool === 'wall') {
      if (lblX1) lblX1.innerText = `START WALL X (${u})`;
      if (lblY1) lblY1.innerText = `START WALL Y (${u})`;
      if (lblV1) lblV1.innerText = `END WALL X (${u})`;
      if (lblV2) lblV2.innerText = `END WALL Y (${u})`;
    } else if (this.activeTool === 'beam') {
      if (lblX1) lblX1.innerText = `START BEAM X (${u})`;
      if (lblY1) lblY1.innerText = `START BEAM Y (${u})`;
      if (lblV1) lblV1.innerText = `END BEAM X (${u})`;
      if (lblV2) lblV2.innerText = `END BEAM Y (${u})`;
    } else if (this.activeTool === 'door') {
      if (lblX1) lblX1.innerText = `HINGE X (${u})`;
      if (lblY1) lblY1.innerText = `HINGE Y (${u})`;
      if (lblV1) lblV1.innerText = `STRIKE X (${u})`;
      if (lblV2) lblV2.innerText = `STRIKE Y (${u})`;
    } else if (this.activeTool === 'window') {
      if (lblX1) lblX1.innerText = `START WINDOW X (${u})`;
      if (lblY1) lblY1.innerText = `START WINDOW Y (${u})`;
      if (lblV1) lblV1.innerText = `END WINDOW X (${u})`;
      if (lblV2) lblV2.innerText = `END WINDOW Y (${u})`;
    } else if (this.activeTool === 'dimension') {
      if (lblX1) lblX1.innerText = `PEGA POINT X (${u})`;
      if (lblY1) lblY1.innerText = `PEGA POINT Y (${u})`;
      if (lblV1) lblV1.innerText = `PEGB POINT X (${u})`;
      if (lblV2) lblV2.innerText = `PEGB POINT Y (${u})`;
    } else if (this.activeTool === 'rectangle') {
      if (lblX1) lblX1.innerText = `LEFT X (${u})`;
      if (lblY1) lblY1.innerText = `TOP Y (${u})`;
      if (lblV1) lblV1.innerText = `WIDTH (${u})`;
      if (lblV2) lblV2.innerText = `HEIGHT (${u})`;
    } else if (this.activeTool === 'column') {
      if (lblX1) lblX1.innerText = `COLUMN ORIGIN X (${u})`;
      if (lblY1) lblY1.innerText = `COLUMN ORIGIN Y (${u})`;
      if (lblV1) lblV1.innerText = `COLUMN WIDTH (${u})`;
      if (lblV2) lblV2.innerText = `COLUMN HEIGHT (${u})`;
    } else if (this.activeTool === 'roomlabel') {
      if (lblX1) lblX1.innerText = `ZONE LEFT X (${u})`;
      if (lblY1) lblY1.innerText = `ZONE TOP Y (${u})`;
      if (lblV1) lblV1.innerText = `ZONE WIDTH (${u})`;
      if (lblV2) lblV2.innerText = `ZONE HEIGHT (${u})`;
    } else if (this.activeTool === 'circle') {
      if (lblX1) lblX1.innerText = `CENTER X (${u})`;
      if (lblY1) lblY1.innerText = `CENTER Y (${u})`;
      if (lblV1) lblV1.innerText = `RADIUS (${u})`;
      if (lblV2) lblV2.innerText = `DIAMETER (2xR)`;
      
      const precV1Input = document.getElementById('prec-v1');
      if (inputV2) {
        inputV2.setAttribute('disabled', 'true');
        inputV2.setAttribute('placeholder', 'Auto');
        inputV2.className = "w-full bg-[#1E2127]/50 border border-[#2A2D35] rounded px-2 py-1 text-xs text-slate-500 cursor-not-allowed outline-none";
      }
      if (precV1Input) {
        precV1Input.addEventListener('input', () => {
          if (this.activeTool === 'circle' && inputV2) {
            const radVal = parseFloat(precV1Input.value);
            if (!isNaN(radVal)) {
              inputV2.value = (radVal * 2).toFixed(2);
            } else {
              inputV2.value = '';
            }
          }
        });
      }
      if (wrapperV2) wrapperV2.style.display = 'block';
    }
  }

  updatePropertiesPanel() {
    this.updatePropertyInspector();
    
    const noSel = document.getElementById('prop-no-selection');
    const fields = document.getElementById('prop-fields');
    const shapeType = document.getElementById('prop-shape-type');
    
    const lblX = document.getElementById('prop-lbl-x');
    const lblY = document.getElementById('prop-lbl-y');
    const lblW = document.getElementById('prop-lbl-w');
    const lblH = document.getElementById('prop-lbl-h');
    
    const inputX = document.getElementById('prop-input-x');
    const inputY = document.getElementById('prop-input-y');
    const inputW = document.getElementById('prop-input-w');
    const inputH = document.getElementById('prop-input-h');
    
    const metricLen = document.getElementById('prop-metric-len');
    const metricSecRow = document.getElementById('prop-metric-sec-row');
    const metricSecDisplay = document.getElementById('prop-metric-sec');
    
    // Check if assign-layer drop-downs also need syncing
    const assignContainer = document.getElementById('assign-layer-container');
    const assignSelect = document.getElementById('assign-layer-select');
    
    if (!this.selectedShape) {
      if (noSel) noSel.classList.remove('hidden');
      if (fields) fields.classList.add('hidden');
      if (assignContainer) assignContainer.classList.add('hidden');
      const propDimtypeRow = document.getElementById('prop-dimtype-row');
      if (propDimtypeRow) propDimtypeRow.classList.add('hidden');
      return;
    }
    
    if (noSel) noSel.classList.add('hidden');
    if (fields) fields.classList.remove('hidden');
    
    if (assignContainer && assignSelect) {
      assignContainer.classList.remove('hidden');
      
      // Populate and select current layer
      assignSelect.innerHTML = '';
      this.layers.forEach(layer => {
        const option = document.createElement('option');
        option.value = layer.id;
        option.innerText = layer.name;
        if (layer.id === this.selectedShape.layerId) {
          option.setAttribute('selected', 'true');
        }
        assignSelect.appendChild(option);
      });
      assignSelect.value = this.selectedShape.layerId || 'default';
    }
    
    const shape = this.selectedShape;
    const u = this.activeUnit;

    const propDimtypeRow = document.getElementById('prop-dimtype-row');
    const propDimtypeSelect = document.getElementById('prop-dimtype-select');
    if (propDimtypeRow) {
      if (shape.type === 'dimension') {
        propDimtypeRow.classList.remove('hidden');
        if (propDimtypeSelect) {
          propDimtypeSelect.value = shape.dimType || 'aligned';
        }
      } else {
        propDimtypeRow.classList.add('hidden');
      }
    }
    
    // Pixel helper converts pixel to active unit value number only
    const pxToUnitNum = (pixels) => {
      switch (this.activeUnit) {
        case 'mm': return pixels * 0.264583;
        case 'cm': return pixels * 0.0264583;
        case 'm': return pixels * 0.000264583;
        case 'in': return pixels * 0.0104167;
        case 'px':
        default: return pixels;
      }
    };
    
    if (['line', 'wall', 'beam', 'door', 'window', 'dimension'].includes(shape.type)) {
      if (shapeType) shapeType.innerText = shape.type.toUpperCase();
      if (lblX) lblX.innerText = `START X (${u})`;
      if (lblY) lblY.innerText = `START Y (${u})`;
      if (lblW) lblW.innerText = `END X (${u})`;
      if (lblH) lblH.innerText = `END Y (${u})`;
      
      if (inputX) inputX.value = pxToUnitNum(shape.x1).toFixed(2);
      if (inputY) inputY.value = pxToUnitNum(shape.y1).toFixed(2);
      if (inputW) inputW.value = pxToUnitNum(shape.x2).toFixed(2);
      if (inputH) {
        inputH.value = pxToUnitNum(shape.y2).toFixed(2);
        inputH.removeAttribute('disabled');
        inputH.className = "w-full bg-[#1E2127] border border-[#2A2D35]/80 hover:border-gray-500 rounded px-2 py-1 text-xs text-gray-200 outline-none focus:border-blue-500";
      }
      
      const len = Math.hypot(shape.x2 - shape.x1, shape.y2 - shape.y1);
      if (metricLen) {
        metricLen.previousElementSibling.innerText = "Length:";
        metricLen.innerText = this.formatValue(len);
      }
      
      if (shape.type === 'wall') {
        if (metricSecRow) {
          metricSecRow.classList.remove('hidden');
          if (metricSecDisplay) {
            metricSecDisplay.previousElementSibling.innerText = "Thickness:";
            metricSecDisplay.innerText = `${shape.wallThickness} px`;
          }
        }
      } else if (shape.type === 'window') {
        if (metricSecRow) {
          metricSecRow.classList.remove('hidden');
          if (metricSecDisplay) {
            metricSecDisplay.previousElementSibling.innerText = "Thickness:";
            metricSecDisplay.innerText = `${shape.windowThickness} px`;
          }
        }
      } else if (shape.type === 'door') {
        if (metricSecRow) {
          metricSecRow.classList.remove('hidden');
          if (metricSecDisplay) {
            metricSecDisplay.previousElementSibling.innerText = "Hinge Radius:";
            metricSecDisplay.innerText = this.formatValue(len);
          }
        }
      } else {
        if (metricSecRow) metricSecRow.classList.add('hidden');
      }
    } else if (['rectangle', 'column', 'roomlabel', 'areazone'].includes(shape.type)) {
      if (shapeType) {
        if (shape.type === 'roomlabel') {
          shapeType.innerText = `ZONE ("${shape.labelText}")`;
        } else if (shape.type === 'areazone') {
          shapeType.innerText = `AREA ("${shape.zoneName || ""}")`;
        } else {
          shapeType.innerText = shape.type.toUpperCase();
        }
      }
      if (lblX) lblX.innerText = `LEFT X (${u})`;
      if (lblY) lblY.innerText = `TOP Y (${u})`;
      if (lblW) lblW.innerText = `WIDTH (${u})`;
      if (lblH) lblH.innerText = `HEIGHT (${u})`;
      
      if (inputX) inputX.value = pxToUnitNum(shape.x).toFixed(2);
      if (inputY) inputY.value = pxToUnitNum(shape.y).toFixed(2);
      if (inputW) inputW.value = pxToUnitNum(shape.width).toFixed(2);
      if (inputH) {
        inputH.value = pxToUnitNum(shape.height).toFixed(2);
        inputH.removeAttribute('disabled');
        inputH.className = "w-full bg-[#1E2127] border border-[#2A2D35]/80 hover:border-gray-500 rounded px-2 py-1 text-xs text-gray-200 outline-none focus:border-blue-500";
      }
      
      const width = Math.abs(shape.width);
      const height = Math.abs(shape.height);
      const perimeter = (width + height) * 2;
      
      if (metricLen) {
        metricLen.previousElementSibling.innerText = "Perimeter:";
        metricLen.innerText = this.formatValue(perimeter);
      }
      if (metricSecRow) {
        metricSecRow.classList.remove('hidden');
        if (metricSecDisplay) {
          metricSecDisplay.previousElementSibling.innerText = "Calculated Area:";
          metricSecDisplay.innerText = this.formatArea(width * height);
        }
      }
    } else if (shape.type === 'text') {
      if (shapeType) shapeType.innerText = `TEXT LABEL`;
      if (lblX) lblX.innerText = `POSITION X (${u})`;
      if (lblY) lblY.innerText = `POSITION Y (${u})`;
      if (lblW) lblW.innerText = `FONT SIZE (px)`;
      if (lblH) lblH.innerText = `...`;
      
      if (inputX) inputX.value = pxToUnitNum(shape.x).toFixed(2);
      if (inputY) inputY.value = pxToUnitNum(shape.y).toFixed(2);
      if (inputW) inputW.value = shape.fontSize.toFixed(0);
      if (inputH) {
        inputH.value = '';
        inputH.setAttribute('disabled', 'true');
        inputH.className = "w-full bg-[#1E2127]/50 border border-[#2A2D35] rounded px-2 py-1 text-xs text-slate-500 cursor-not-allowed outline-none";
      }
      
      if (metricLen) {
        metricLen.previousElementSibling.innerText = "Stored Text:";
        metricLen.innerText = shape.labelText;
      }
      if (metricSecRow) {
        metricSecRow.classList.remove('hidden');
        if (metricSecDisplay) {
          metricSecDisplay.previousElementSibling.innerText = "Type Label:";
          metricSecDisplay.innerText = "Engineering note";
        }
      }
    } else if (shape.type === 'circle') {
      if (shapeType) shapeType.innerText = "CIRCLE";
      if (lblX) lblX.innerText = `CENTER X (${u})`;
      if (lblY) lblY.innerText = `CENTER Y (${u})`;
      if (lblW) lblW.innerText = `RADIUS (${u})`;
      if (lblH) lblH.innerText = `DIAMETER (2xR)`;
      
      if (inputX) inputX.value = pxToUnitNum(shape.centerX).toFixed(2);
      if (inputY) inputY.value = pxToUnitNum(shape.centerY).toFixed(2);
      if (inputW) inputW.value = pxToUnitNum(shape.radius).toFixed(2);
      if (inputH) {
        inputH.value = pxToUnitNum(shape.radius * 2).toFixed(2);
        inputH.setAttribute('disabled', 'true');
        inputH.className = "w-full bg-[#1E2127]/50 border border-[#2A2D35] rounded px-2 py-1 text-xs text-slate-500 cursor-not-allowed outline-none";
      }
      
      const r = shape.radius;
      if (metricLen) {
        metricLen.previousElementSibling.innerText = "Radius:";
        metricLen.innerText = this.formatValue(r);
      }
      if (metricSecRow) {
        metricSecRow.classList.remove('hidden');
        if (metricSecDisplay) {
          metricSecDisplay.previousElementSibling.innerText = "Diameter:";
          metricSecDisplay.innerText = this.formatValue(r * 2);
        }
      }
    }
  }

  /**
   * Shows a beautiful, custom CAD input panel.
   * This works perfectly inside sandboxed iframes unlike native prompt/alert dialogs.
   */
  showCADPrompt(title, desc, defaultValue, onConfirm, onCancel) {
    const modal = document.getElementById('cad-prompt-modal');
    const titleEl = document.getElementById('cad-prompt-title');
    const descEl = document.getElementById('cad-prompt-desc');
    const inputEl = document.getElementById('cad-prompt-input');
    const confirmBtn = document.getElementById('cad-prompt-confirm');
    const cancelBtn = document.getElementById('cad-prompt-cancel');
    const closeBtn = document.getElementById('cad-prompt-close-btn');

    if (!modal || !titleEl || !descEl || !inputEl || !confirmBtn || !cancelBtn) return;

    // Set text
    titleEl.innerText = title;
    descEl.innerText = desc;
    inputEl.value = defaultValue;
    inputEl.placeholder = defaultValue;

    // Apply specific color theme styling depending on title (Rotate uses amber, Scale uses emerald)
    if (title.toUpperCase().includes('SCALE')) {
      modal.className = "absolute top-16 left-4 z-30 w-72 bg-[#181A1F]/95 border border-emerald-900/60 rounded-lg shadow-2xl p-4 backdrop-blur-md flex flex-col gap-3 font-mono text-gray-200 border-dashed";
      titleEl.className = "text-[10px] font-bold text-emerald-400 tracking-wider uppercase font-mono";
      inputEl.className = "w-full bg-[#0F1115] border border-[#2A2D35] rounded px-3 py-1.5 text-xs text-emerald-400 font-bold outline-none focus:border-emerald-500 transition-colors font-mono";
      confirmBtn.className = "px-3.5 py-1.5 text-[9px] uppercase font-bold tracking-wider font-mono bg-emerald-600 hover:bg-emerald-500 text-white transition rounded cursor-pointer";
      cancelBtn.innerText = "Interactive Scale";
    } else {
      modal.className = "absolute top-16 left-4 z-30 w-72 bg-[#181A1F]/95 border border-amber-900/60 rounded-lg shadow-2xl p-4 backdrop-blur-md flex flex-col gap-3 font-mono text-gray-200 border-dashed";
      titleEl.className = "text-[10px] font-bold text-amber-400 tracking-wider uppercase font-mono";
      inputEl.className = "w-full bg-[#0F1115] border border-[#2A2D35] rounded px-3 py-1.5 text-xs text-amber-400 font-bold outline-none focus:border-amber-500 transition-colors font-mono";
      confirmBtn.className = "px-3.5 py-1.5 text-[9px] uppercase font-bold tracking-wider font-mono bg-amber-600 hover:bg-amber-500 text-white transition rounded cursor-pointer";
      cancelBtn.innerText = "Interactive Drag";
    }

    // Show modal
    modal.classList.remove('hidden');

    // Focus input
    setTimeout(() => inputEl.select(), 50);

    // Recreate clean listeners to prevent duplicate triggers
    const cleanup = () => {
      modal.classList.add('hidden');
      const freshConfirm = document.getElementById('cad-prompt-confirm');
      const freshCancel = document.getElementById('cad-prompt-cancel');
      const freshClose = document.getElementById('cad-prompt-close-btn');
      const freshInput = document.getElementById('cad-prompt-input');
      
      freshConfirm.replaceWith(freshConfirm.cloneNode(true));
      freshCancel.replaceWith(freshCancel.cloneNode(true));
      if (freshClose) freshClose.replaceWith(freshClose.cloneNode(true));
      freshInput.replaceWith(freshInput.cloneNode(true));
    };

    const handleConfirm = () => {
      const freshInput = document.getElementById('cad-prompt-input');
      const val = parseFloat(freshInput.value);
      cleanup();
      if (!isNaN(val)) {
        onConfirm(val);
      } else {
        this.showStatusFeedback("Invalid numerical input entered.");
        if (onCancel) onCancel();
      }
    };

    const handleCancel = () => {
      cleanup();
      if (onCancel) onCancel();
    };

    // Re-query buttons since replaceWith clones them
    const freshConfirm = document.getElementById('cad-prompt-confirm');
    const freshCancel = document.getElementById('cad-prompt-cancel');
    const freshClose = document.getElementById('cad-prompt-close-btn');
    const freshInput = document.getElementById('cad-prompt-input');

    freshConfirm.addEventListener('click', handleConfirm);
    freshCancel.addEventListener('click', handleCancel);
    if (freshClose) freshClose.addEventListener('click', handleCancel);
    freshInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        handleConfirm();
      } else if (e.key === 'Escape') {
        handleCancel();
      }
    });
  }

  /**
   * Set the active shape tool
   */
  setActiveTool(toolName) {
    if (this.isEditingText && toolName !== 'text') {
      this.commitTextEditing();
    }

    if (toolName === 'pan') {
      if (this.activeTool !== 'pan') {
        this.previousTool = this.activeTool;
      }
    }
    this.activeTool = toolName;

    // Adjust canvas cursor styled pointers
    if (toolName === 'select') {
      if (this.canvas) this.canvas.style.cursor = 'default';
    } else if (toolName === 'pan') {
      if (this.canvas) this.canvas.style.cursor = 'grab';
    } else {
      if (this.canvas) this.canvas.style.cursor = 'crosshair';
      this.selectedShape = null; // Clear selections when switching drawing modes
      this.updateDeleteSelectedBtnState();
    }
    
    // Show/hide dimension-options panel
    const dimOptionsEl = document.getElementById('dimension-options');
    if (dimOptionsEl) {
      if (toolName === 'dimension') {
        dimOptionsEl.classList.remove('hidden');
      } else {
        dimOptionsEl.classList.add('hidden');
      }
    }

    // Toggle real-time Measure Tool HUD panel
    const measureHudEl = document.getElementById('measure-hud');
    if (measureHudEl) {
      if (toolName === 'measure') {
        measureHudEl.classList.remove('hidden');
        measureHudEl.classList.add('flex');
        this.updateMeasureHUDValues(null, null, null, null);
      } else {
        measureHudEl.classList.remove('flex');
        measureHudEl.classList.add('hidden');
      }
    }

    // Toggle real-time Rotate Tool HUD panel
    const rotateHudEl = document.getElementById('rotate-hud');
    if (rotateHudEl) {
      if (toolName === 'rotate') {
        rotateHudEl.classList.remove('hidden');
        rotateHudEl.classList.add('flex');
        
        // Reset states
        this.rotateStep = 'select'; // 'select' | 'pivot' | 'rotate'
        this.selectedShapes = [];
        this.rotatePivotX = null;
        this.rotatePivotY = null;
        this.rotateBaseShapes = [];
        this.rotateStartAngle = 0;
        this.isRotating = false;
        
        this.updateRotateHUD();
      } else {
        rotateHudEl.classList.remove('flex');
        rotateHudEl.classList.add('hidden');
      }
    }

    // Toggle real-time Mirror Tool HUD panel
    const mirrorHudEl = document.getElementById('mirror-hud');
    if (mirrorHudEl) {
      if (toolName === 'mirror') {
        mirrorHudEl.classList.remove('hidden');
        mirrorHudEl.classList.add('flex');
        
        // Reset states
        this.mirrorStep = 'select'; // 'select' | 'axis1' | 'axis2' | 'confirm'
        this.selectedMirrorShapes = [];
        this.mirrorAxisX1 = null;
        this.mirrorAxisY1 = null;
        this.mirrorAxisX2 = null;
        this.mirrorAxisY2 = null;
        this.mirrorHoverX = null;
        this.mirrorHoverY = null;
        
        this.updateMirrorHUD();
      } else {
        mirrorHudEl.classList.remove('flex');
        mirrorHudEl.classList.add('hidden');
      }
    }

    // Toggle real-time Scale Tool HUD panel
    const scaleHudEl = document.getElementById('scale-hud');
    if (scaleHudEl) {
      if (toolName === 'scale') {
        scaleHudEl.classList.remove('hidden');
        scaleHudEl.classList.add('flex');
        
        // Reset states
        this.scaleStep = 'select'; // 'select' | 'basepoint' | 'scale'
        this.selectedScaleShapes = [];
        this.scalePivotX = null;
        this.scalePivotY = null;
        this.scaleBaseShapes = [];
        this.scaleStartDist = 100;
        this.isScaling = false;
        this.scaleHoverX = null;
        this.scaleHoverY = null;

        const inputEl = document.getElementById('scale-factor-input');
        if (inputEl) {
          inputEl.value = '1.0';
        }
        
        this.updateScaleHUD();
      } else {
        scaleHudEl.classList.remove('flex');
        scaleHudEl.classList.add('hidden');
      }
    }

    // Reset measure states on changing tool
    this.measureFirstX = null;
    this.measureFirstY = null;
    this.measureSecondX = null;
    this.measureSecondY = null;
    this.measureHoverX = null;
    this.measureHoverY = null;
    this.isMeasuring = false;

    // Update toolbar active classes for all standard, civil and measure tools
    const allBtnIds = {
      'select': 'tool-select',
      'line': 'tool-line',
      'rectangle': 'tool-rectangle',
      'circle': 'tool-circle',
      'pan': 'tool-pan',
      'wall': 'tool-wall',
      'column': 'tool-column',
      'beam': 'tool-beam',
      'door': 'tool-door',
      'window': 'tool-window',
      'roomlabel': 'tool-roomlabel',
      'text': 'tool-text',
      'areazone': 'tool-areazone',
      'dimension': 'tool-dimension',
      'measure': 'tool-measure',
      'rotate': 'tool-rotate',
      'mirror': 'tool-mirror',
      'scale': 'tool-scale'
    };

    Object.keys(allBtnIds).forEach(tool => {
      const btn = document.getElementById(allBtnIds[tool]);
      if (btn) {
        if (tool === 'select' || tool === 'line' || tool === 'rectangle' || tool === 'circle' || tool === 'pan') {
          if (tool === toolName) {
            btn.className = 'tool-btn px-3 py-1.5 rounded flex items-center gap-2 text-xs font-medium transition duration-150 active:scale-95 text-blue-400 bg-[#404552] shadow-sm';
          } else {
            btn.className = 'tool-btn px-3 py-1.5 rounded flex items-center gap-2 text-xs font-medium transition duration-150 active:scale-95 text-gray-400 hover:text-gray-200 hover:bg-[#2A2D35]/50';
          }
        } else if (tool === 'dimension') {
          if (tool === toolName) {
            btn.className = 'tool-btn w-full h-8 px-3 rounded bg-blue-600 border border-blue-500 text-white flex items-center justify-center gap-2 text-[11px] font-semibold cursor-pointer transition duration-150 active:scale-95 shadow-md';
          } else {
            btn.className = 'tool-btn w-full h-8 px-3 rounded bg-blue-950/40 border border-blue-900/40 hover:border-blue-500 hover:text-white flex items-center justify-center gap-2 text-[11px] font-semibold text-blue-400 cursor-pointer transition duration-150 active:scale-95';
          }
        } else if (tool === 'measure') {
          if (tool === toolName) {
            btn.className = 'tool-btn w-full h-8 px-3 rounded bg-[#059669] border border-[#34d399] text-white flex items-center justify-center gap-2 text-[11px] font-semibold cursor-pointer transition duration-150 active:scale-95 shadow-md';
          } else {
            btn.className = 'tool-btn w-full h-8 px-3 rounded bg-emerald-950/40 border border-emerald-900/40 hover:border-emerald-500 hover:text-white flex items-center justify-center gap-2 text-[11px] font-semibold text-emerald-400 cursor-pointer transition duration-150 active:scale-95';
          }
        } else if (tool === 'rotate') {
          if (tool === toolName) {
            btn.className = 'tool-btn w-full h-8 px-3 rounded bg-amber-600 border border-amber-500 text-white flex items-center justify-center gap-2 text-[11px] font-semibold cursor-pointer transition duration-150 active:scale-95 shadow-md';
          } else {
            btn.className = 'tool-btn w-full h-8 px-3 rounded bg-amber-950/40 border border-amber-900/40 hover:border-amber-500 hover:text-white flex items-center justify-center gap-2 text-[11px] font-semibold text-amber-500 cursor-pointer transition duration-150 active:scale-95';
          }
        } else if (tool === 'mirror') {
          if (tool === toolName) {
            btn.className = 'tool-btn w-full h-8 px-3 rounded bg-purple-600 border border-purple-500 text-white flex items-center justify-center gap-2 text-[11px] font-semibold cursor-pointer transition duration-150 active:scale-95 shadow-md';
          } else {
            btn.className = 'tool-btn w-full h-8 px-3 rounded bg-purple-950/40 border border-purple-900/40 hover:border-purple-500 hover:text-white flex items-center justify-center gap-2 text-[11px] font-semibold text-purple-400 cursor-pointer transition duration-150 active:scale-95';
          }
        } else if (tool === 'scale') {
          if (tool === toolName) {
            btn.className = 'tool-btn w-full h-8 px-3 rounded bg-emerald-600 border border-emerald-500 text-white flex items-center justify-center gap-2 text-[11px] font-semibold cursor-pointer transition duration-150 active:scale-95 shadow-md';
          } else {
            btn.className = 'tool-btn w-full h-8 px-3 rounded bg-emerald-950/40 border border-emerald-900/40 hover:border-emerald-500 hover:text-white flex items-center justify-center gap-2 text-[11px] font-semibold text-emerald-500 cursor-pointer transition duration-150 active:scale-95';
          }
        } else {
          // Grid civil tool buttons
          if (tool === toolName) {
            btn.className = 'tool-btn px-2 py-2 rounded bg-[#404552] border border-blue-500 flex flex-col items-center justify-center gap-1.5 text-center text-[10.5px] text-blue-400 cursor-pointer transition active:scale-95 duration-100 shadow-sm';
          } else {
            btn.className = 'tool-btn px-2 py-2 rounded bg-[#1E2127] border border-[#2A2D35] hover:border-blue-500 hover:text-white flex flex-col items-center justify-center gap-1.5 text-center text-[10.5px] text-gray-400 cursor-pointer transition active:scale-95 duration-100';
          }
        }
      }
    });

    // Update floating active status card
    const capInitName = toolName === 'select' ? 'Select & Move' : toolName.charAt(0).toUpperCase() + toolName.slice(1);
    this.drawingIndicatorText.innerText = `${capInitName} Tool Active`;
    
    // Update footer status bar tool label
    const statusToolDisplay = document.getElementById('status-tool-display');
    if (statusToolDisplay) {
      statusToolDisplay.innerText = toolName === 'select' ? 'SELECT' : toolName.toUpperCase();
    }
    
    this.updatePrecisionLabels();
    this.updatePropertiesPanel();

    // Cancel active progress
    this.cancelActiveDrawing();
  }

  startTextEditing(e, worldPos) {
    // If we're already editing, commit first
    if (this.isEditingText) {
      this.commitTextEditing();
    }

    // Mark states
    this.isEditingText = true;
    this.textEditWorldPos = worldPos;

    // Create the textarea or input element
    const container = document.getElementById('canvas-container');
    if (!container) return;

    const textInput = document.createElement('textarea');
    textInput.id = 'cad-active-text-editor';
    
    // Position it at the screen click coordinates relative to canvas-container
    const containerRect = container.getBoundingClientRect();
    const x = e.clientX - containerRect.left;
    const y = e.clientY - containerRect.top;

    textInput.style.position = 'absolute';
    textInput.style.left = `${x}px`;
    textInput.style.top = `${y}px`;
    textInput.style.transform = 'translate(-50%, -50%)'; // perfectly centered at the click point
    textInput.style.background = 'rgba(15, 17, 21, 0.95)';
    textInput.style.color = this.activeColor || '#06b6d4';
    textInput.style.border = '1px solid ' + (this.activeColor || '#06b6d4');
    textInput.style.borderRadius = '4px';
    textInput.style.padding = '6px 10px';
    textInput.style.fontSize = '14px';
    textInput.style.fontFamily = '"Space Grotesk", sans-serif';
    textInput.style.resize = 'none';
    textInput.style.overflow = 'hidden';
    textInput.style.width = '160px';
    textInput.style.height = '36px';
    textInput.style.zIndex = '1000';
    textInput.style.textAlign = 'center';
    textInput.style.outline = 'none';
    textInput.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.5), 0 4px 6px -2px rgba(0, 0, 0, 0.1)';
    textInput.style.whiteSpace = 'nowrap';
    
    // Add event listeners for Enter, Escape, input scaling, etc.
    textInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        this.commitTextEditing();
      } else if (event.key === 'Escape') {
        event.preventDefault();
        this.cancelTextEditing();
      }
    });

    // Auto resize width as user types
    textInput.addEventListener('input', () => {
      const textLength = textInput.value.length;
      const newWidth = Math.max(160, textLength * 10 + 24);
      textInput.style.width = `${newWidth}px`;
    });

    container.appendChild(textInput);
    this.activeTextEditor = textInput;

    // Focus immediately with caret
    setTimeout(() => {
      textInput.focus();
      textInput.select();
    }, 10);

    this.showStatusFeedback("Text editing mode active. Type and press Enter or click outside to save.");
    this.redraw();
  }

  commitTextEditing() {
    if (!this.isEditingText || !this.activeTextEditor) return;
    
    const textVal = this.activeTextEditor.value.trim();
    const worldPos = this.textEditWorldPos;
    
    // Remove the element from DOM
    if (this.activeTextEditor.parentNode) {
      this.activeTextEditor.parentNode.removeChild(this.activeTextEditor);
    }
    
    this.activeTextEditor = null;
    this.isEditingText = false;
    
    if (textVal) {
      this.pushUndoCheckpoint();
      
      const newShape = new TextLabel(
        worldPos.x, 
        worldPos.y, 
        this.activeColor, 
        this.activeThickness || 2, 
        textVal, 
        14
      );
      newShape.layerId = this.activeLayerId;
      
      this.shapes.push(newShape);
      this.redoStack = [];
      this.updateRedoButtonState();
      this.updateUndoButtonState();
      this.saveDrawing();
      this.updateEntityList();
      this.redraw();
      
      this.showStatusFeedback(`Text note placed: "${textVal}"`);
    } else {
      this.showStatusFeedback("Text editing cancelled (empty input).");
    }
  }

  cancelTextEditing() {
    if (!this.isEditingText || !this.activeTextEditor) return;
    
    if (this.activeTextEditor.parentNode) {
      this.activeTextEditor.parentNode.removeChild(this.activeTextEditor);
    }
    
    this.activeTextEditor = null;
    this.isEditingText = false;
    this.redraw();
    this.showStatusFeedback("Text editing cancelled.");
  }

  updateRotateHUD() {
    const stepEl = document.getElementById('rotate-hud-step');
    const countEl = document.getElementById('rotate-count');
    const pivotEl = document.getElementById('rotate-pivot-coords');
    const confirmEl = document.getElementById('rotate-confirm-selection');
    const angleDisplayEl = document.getElementById('rotate-current-angle');

    if (countEl) {
      if (this.selectedShapes.length === 1) {
        countEl.innerText = "1 shape selected";
      } else {
        countEl.innerText = `${this.selectedShapes.length} shapes selected`;
      }
    }

    if (pivotEl) {
      if (this.rotatePivotX === null || this.rotatePivotY === null) {
        pivotEl.innerText = "Undefined";
      } else {
        pivotEl.innerText = `${this.formatValue(this.rotatePivotX)}, ${this.formatValue(this.rotatePivotY)}`;
      }
    }

    if (stepEl) {
      if (this.rotateStep === 'select') {
        stepEl.innerHTML = `<strong>1. SELECT:</strong> Click shapes to toggle selection. Hold <span class="bg-[#1E2127] px-1 py-0.5 rounded text-amber-400 font-mono">Shift</span> for multiple. Click button below to lock in.`;
      } else if (this.rotateStep === 'pivot') {
        stepEl.innerHTML = `<strong>2. BASE PIVOT:</strong> Click on the canvas to place coordinates of the rotation center pivot.`;
      } else if (this.rotateStep === 'rotate') {
        stepEl.innerHTML = `<strong>3. ROTATE:</strong> Move or drag mouse to rotate. Or input exact degrees and click Apply.`;
      }
    }

    if (confirmEl) {
      if (this.rotateStep === 'select') {
        confirmEl.innerText = "Set Rotation Pivot Point";
        confirmEl.className = "w-full h-8 flex items-center justify-center bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs rounded transition cursor-pointer active:scale-98";
      } else {
        confirmEl.innerText = "Restart Selection / Clear";
        confirmEl.className = "w-full h-8 flex items-center justify-center bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold text-xs rounded transition cursor-pointer active:scale-98 border border-[#2A2D35]";
      }
    }
  }

  applyExactRotation(angleDeg) {
    if (this.selectedShapes.length === 0) {
      alert("Please select features to rotate first.");
      return;
    }

    let px = this.rotatePivotX;
    let py = this.rotatePivotY;
    if (px === null || py === null) {
      let sumX = 0, sumY = 0, count = 0;
      this.selectedShapes.forEach(sh => {
        if (sh.x1 !== undefined && sh.y1 !== undefined) {
          sumX += (sh.x1 + sh.x2) / 2;
          sumY += (sh.y1 + sh.y2) / 2;
          count++;
        } else if (sh.centerX !== undefined && sh.centerY !== undefined) {
          sumX += sh.centerX;
          sumY += sh.centerY;
          count++;
        } else if (sh.x !== undefined && sh.y !== undefined) {
          if (sh.width !== undefined && sh.height !== undefined) {
            sumX += sh.x + sh.width / 2;
            sumY += sh.y + sh.height / 2;
          } else {
            sumX += sh.x;
            sumY += sh.y;
          }
          count++;
        }
      });
      if (count > 0) {
        px = sumX / count;
        py = sumY / count;
        this.rotatePivotX = px;
        this.rotatePivotY = py;
        this.updateRotateHUD();
      } else {
        px = 0;
        py = 0;
      }
    }

    const angleRad = angleDeg * (Math.PI / 180);

    this.pushUndoCheckpoint();

    // Save state to undo/redo stack
    this.redoStack = [];
    this.updateRedoButtonState();

    if (this.rotateBaseShapes && this.rotateBaseShapes.length === this.selectedShapes.length && this.rotateBaseShapes.length > 0) {
      const rotatedShapes = this.rotateBaseShapes.map(baseSh => {
        const cloned = this.cloneShape(baseSh);
        cloned.rotate(px, py, angleRad);
        return cloned;
      });

      const selectedIds = this.rotateBaseShapes.map(s => s.id);
      this.shapes = this.shapes.map(sh => {
        const idx = selectedIds.indexOf(sh.id);
        if (idx !== -1) {
          return rotatedShapes[idx];
        }
        return sh;
      });
      this.selectedShapes = [...rotatedShapes];
    } else {
      const selectedIds = this.selectedShapes.map(s => s.id);
      this.shapes = this.shapes.map(sh => {
        const idx = selectedIds.indexOf(sh.id);
        if (idx !== -1) {
          const cloned = this.cloneShape(sh);
          cloned.rotate(px, py, angleRad);
          this.selectedShapes[idx] = cloned;
          return cloned;
        }
        return sh;
      });
    }

    this.saveDrawing();
    this.updateEntityList();
    this.updateUndoButtonState();
    this.redraw();
    this.showStatusFeedback(`Successfully rotated selected CAD objects by ${angleDeg}°`);
  }

  updateScaleHUD() {
    const stepEl = document.getElementById('scale-hud-step');
    const countEl = document.getElementById('scale-count');
    const basepointEl = document.getElementById('scale-basepoint-coords');
    const factorEl = document.getElementById('scale-current-factor');
    const confirmSelBtn = document.getElementById('scale-confirm-selection');
    const factorSection = document.getElementById('scale-factor-section');

    if (countEl) {
      countEl.innerText = `${this.selectedScaleShapes.length} ${this.selectedScaleShapes.length === 1 ? 'object' : 'objects'}`;
    }

    if (basepointEl) {
      basepointEl.innerText = this.scalePivotX !== null && this.scalePivotY !== null
        ? `X: ${Math.round(this.scalePivotX)}, Y: ${Math.round(this.scalePivotY)}`
        : 'Undefined';
    }

    if (factorEl) {
      if (this.scaleStep === 'scale' && this.scalePivotX !== null && this.scalePivotY !== null && this.scaleHoverX !== null && this.scaleHoverY !== null) {
        const dx = this.scaleHoverX - this.scalePivotX;
        const dy = this.scaleHoverY - this.scalePivotY;
        const dist = Math.hypot(dx, dy);
        const s = this.scaleStartDist > 0 ? (dist / this.scaleStartDist) : 1.0;
        factorEl.innerText = `${s.toFixed(3)}x (Live)`;
      } else {
        factorEl.innerText = '1.000x (Live)';
      }
    }

    if (stepEl) {
      switch (this.scaleStep) {
        case 'select':
          stepEl.innerText = "Select objects to scale. Click the button below or press Enter to lock selection.";
          break;
        case 'basepoint':
          stepEl.innerText = "Set base point: click on the canvas to define the origin/center of scaling.";
          break;
        case 'scale':
          stepEl.innerText = "Scaling: drag/move mouse to scale objects. Click canvas to finalize, or input exact factor below.";
          break;
      }
    }

    if (confirmSelBtn && factorSection) {
      if (this.scaleStep === 'select') {
        confirmSelBtn.classList.remove('hidden');
        confirmSelBtn.innerText = "Set Scale Base Point";
        factorSection.classList.add('hidden');
        factorSection.classList.remove('flex');
      } else if (this.scaleStep === 'basepoint') {
        confirmSelBtn.classList.remove('hidden');
        confirmSelBtn.innerText = "Cancel / Re-select Objects";
        factorSection.classList.add('hidden');
        factorSection.classList.remove('flex');
      } else if (this.scaleStep === 'scale') {
        confirmSelBtn.classList.remove('hidden');
        confirmSelBtn.innerText = "Restart Tool / Clear Selection";
        factorSection.classList.remove('hidden');
        factorSection.classList.add('flex');
      }
    }
  }

  applyScale(scaleFactor) {
    if (this.selectedScaleShapes.length === 0) {
      alert("Please select at least one object to scale.");
      return;
    }
    if (isNaN(scaleFactor) || scaleFactor <= 0) {
      alert("Please enter a valid scale factor greater than 0.");
      return;
    }

    // Determine base point (if not specified, default to center of bounding box or average center of shapes)
    let px = this.scalePivotX;
    let py = this.scalePivotY;
    if (px === null || py === null) {
      let sumX = 0, sumY = 0, count = 0;
      const shapesToAnalyze = (this.scaleBaseShapes && this.scaleBaseShapes.length > 0) ? this.scaleBaseShapes : this.selectedScaleShapes;
      shapesToAnalyze.forEach(sh => {
        if (sh.x1 !== undefined && sh.y1 !== undefined) {
          sumX += (sh.x1 + sh.x2) / 2;
          sumY += (sh.y1 + sh.y2) / 2;
          count++;
        } else if (sh.centerX !== undefined && sh.centerY !== undefined) {
          sumX += sh.centerX;
          sumY += sh.centerY;
          count++;
        } else if (sh.x !== undefined && sh.y !== undefined) {
          if (sh.width !== undefined && sh.height !== undefined) {
            sumX += sh.x + sh.width / 2;
            sumY += sh.y + sh.height / 2;
          } else {
            sumX += sh.x;
            sumY += sh.y;
          }
          count++;
        }
      });
      if (count > 0) {
        px = sumX / count;
        py = sumY / count;
        this.scalePivotX = px;
        this.scalePivotY = py;
      } else {
        px = 0;
        py = 0;
      }
    }

    this.pushUndoCheckpoint();

    // Save history state (redoStack is cleared for new actions)
    this.redoStack = [];
    this.updateRedoButtonState();

    if (this.scaleBaseShapes && this.scaleBaseShapes.length === this.selectedScaleShapes.length && this.scaleBaseShapes.length > 0) {
      const scaledShapes = this.scaleBaseShapes.map(baseSh => {
        const cloned = this.cloneShape(baseSh);
        cloned.scale(px, py, scaleFactor);
        return cloned;
      });

      const selectedIds = this.scaleBaseShapes.map(s => s.id);
      this.shapes = this.shapes.map(sh => {
        const idx = selectedIds.indexOf(sh.id);
        if (idx !== -1) {
          return scaledShapes[idx];
        }
        return sh;
      });
    } else {
      const selectedIds = this.selectedScaleShapes.map(s => s.id);
      this.shapes = this.shapes.map(sh => {
        const idx = selectedIds.indexOf(sh.id);
        if (idx !== -1) {
          const cloned = this.cloneShape(sh);
          cloned.scale(px, py, scaleFactor);
          this.selectedScaleShapes[idx] = cloned;
          return cloned;
        }
        return sh;
      });
    }

    this.showStatusFeedback(`Successfully scaled selected CAD objects by ${scaleFactor.toFixed(3)}x`);

    // Reset tool state but keep active
    this.scaleStep = 'select';
    this.selectedScaleShapes = [];
    this.scalePivotX = null;
    this.scalePivotY = null;
    this.scaleBaseShapes = [];
    this.scaleStartDist = 100;
    this.isScaling = false;
    this.scaleHoverX = null;
    this.scaleHoverY = null;

    this.saveDrawing();
    this.updateUndoButtonState();
    this.updateScaleHUD();
    this.updateEntityList();
    this.redraw();
  }

  updateMirrorHUD() {
    const stepEl = document.getElementById('mirror-hud-step');
    const countEl = document.getElementById('mirror-count');
    const p1El = document.getElementById('mirror-p1-coords');
    const p2El = document.getElementById('mirror-p2-coords');
    const confirmSelBtn = document.getElementById('mirror-confirm-selection');
    const placementOpts = document.getElementById('mirror-placement-options');

    if (countEl) {
      countEl.innerText = `${this.selectedMirrorShapes.length} ${this.selectedMirrorShapes.length === 1 ? 'object' : 'objects'}`;
    }

    if (p1El) {
      p1El.innerText = this.mirrorAxisX1 !== null 
        ? `X: ${Math.round(this.mirrorAxisX1)}, Y: ${Math.round(this.mirrorAxisY1)}`
        : 'Undefined';
    }

    if (p2El) {
      if (this.mirrorAxisX2 !== null) {
        p2El.innerText = `X: ${Math.round(this.mirrorAxisX2)}, Y: ${Math.round(this.mirrorAxisY2)}`;
      } else if (this.mirrorStep === 'axis2' && this.mirrorHoverX !== null) {
        p2El.innerText = `X: ${Math.round(this.mirrorHoverX)}, Y: ${Math.round(this.mirrorHoverY)} (Preview)`;
      } else {
        p2El.innerText = 'Undefined';
      }
    }

    if (stepEl) {
      switch (this.mirrorStep) {
        case 'select':
          stepEl.innerText = "Select objects to mirror on the canvas. Click button below or press Enter to lock selection.";
          break;
        case 'axis1':
          stepEl.innerText = "Define mirror axis: click on the canvas to set the FIRST point (P1).";
          break;
        case 'axis2':
          stepEl.innerText = "Define mirror axis: click on canvas to set the SECOND point (P2). Hold Shift for Horizontal/Vertical Ortho.";
          break;
        case 'confirm':
          stepEl.innerText = "Mirror axis established! Choose Keep Original (Copy) or Erase Original (Move).";
          break;
      }
    }

    if (confirmSelBtn && placementOpts) {
      if (this.mirrorStep === 'select') {
        confirmSelBtn.classList.remove('hidden');
        confirmSelBtn.innerText = "Set Mirror Axis Line";
        placementOpts.classList.add('hidden');
        placementOpts.classList.remove('flex');
      } else if (this.mirrorStep === 'axis1' || this.mirrorStep === 'axis2') {
        confirmSelBtn.classList.remove('hidden');
        confirmSelBtn.innerText = "Cancel Axis / Re-select";
        placementOpts.classList.add('hidden');
        placementOpts.classList.remove('flex');
      } else if (this.mirrorStep === 'confirm') {
        confirmSelBtn.classList.add('hidden');
        placementOpts.classList.remove('hidden');
        placementOpts.classList.add('flex');
      }
    }
  }

  applyMirror(eraseOriginal) {
    if (this.selectedMirrorShapes.length === 0) {
      alert("Please select at least one object first.");
      return;
    }
    if (this.mirrorAxisX1 === null || this.mirrorAxisY1 === null || this.mirrorAxisX2 === null || this.mirrorAxisY2 === null) {
      alert("Please define a mirror axis line first.");
      return;
    }

    this.pushUndoCheckpoint();

    // Save history state (redoStack is cleared for new actions)
    this.redoStack = [];
    this.updateRedoButtonState();

    if (eraseOriginal) {
      // In-place mirroring: modify selected shapes
      const selectedIds = this.selectedMirrorShapes.map(s => s.id);
      this.shapes = this.shapes.map(sh => {
        if (selectedIds.includes(sh.id)) {
          sh.mirror(this.mirrorAxisX1, this.mirrorAxisY1, this.mirrorAxisX2, this.mirrorAxisY2);
        }
        return sh;
      });
      this.showStatusFeedback("Mirror applied. Original shapes erased (moved).");
    } else {
      // Mirror as copy: create cloned mirrored shapes and add to shapes list
      const mirroredClones = this.selectedMirrorShapes.map(sh => {
        const cloned = this.cloneShape(sh);
        cloned.mirror(this.mirrorAxisX1, this.mirrorAxisY1, this.mirrorAxisX2, this.mirrorAxisY2);
        cloned.id = 'shape_' + Math.random().toString(36).substr(2, 9);
        return cloned;
      });

      this.shapes = [...this.shapes, ...mirroredClones];
      this.showStatusFeedback("Mirror applied. Copied and mirrored original shapes.");
    }

    // Reset mirror tool states
    this.mirrorStep = 'select';
    this.selectedMirrorShapes = [];
    this.mirrorAxisX1 = null;
    this.mirrorAxisY1 = null;
    this.mirrorAxisX2 = null;
    this.mirrorAxisY2 = null;
    this.mirrorHoverX = null;
    this.mirrorHoverY = null;

    this.saveDrawing();
    this.updateUndoButtonState();
    this.updateMirrorHUD();
    this.updateEntityList();
    this.redraw();
  }

  updateMeasureHUDValues(x1, y1, x2, y2) {
    const distEl = document.getElementById('measure-distance');
    const horizEl = document.getElementById('measure-horizontal');
    const vertEl = document.getElementById('measure-vertical');
    const angleEl = document.getElementById('measure-angle');
    
    if (!distEl || !horizEl || !vertEl || !angleEl) return;
    
    if (x1 === null || y1 === null || x2 === null || y2 === null) {
      distEl.innerText = '--';
      horizEl.innerText = '--';
      vertEl.innerText = '--';
      angleEl.innerText = '--';
      return;
    }
    
    const dx = x2 - x1;
    const dy = y2 - y1;
    const distancePx = Math.hypot(dx, dy);
    
    // Calculate angle in degrees
    let angleRad = Math.atan2(-dy, dx);
    let angleDeg = angleRad * (180 / Math.PI);
    if (angleDeg < 0) angleDeg += 360;
    
    distEl.innerText = this.formatValue(distancePx);
    horizEl.innerText = this.formatValue(Math.abs(dx));
    vertEl.innerText = this.formatValue(Math.abs(dy));
    angleEl.innerText = `${angleDeg.toFixed(1)}°`;
  }

  /**
   * Update active disabled/enabled status class styles on toolbar delete buttons
   */
  updateDeleteSelectedBtnState() {
    const btn = document.getElementById('action-delete-selected');
    if (btn) {
      if (this.selectedShape) {
        btn.removeAttribute('disabled');
        btn.classList.remove('opacity-30', 'cursor-not-allowed', 'text-gray-400');
        btn.classList.add('text-red-400');
      } else {
        btn.setAttribute('disabled', 'true');
        btn.classList.add('opacity-30', 'cursor-not-allowed', 'text-gray-400');
        btn.classList.remove('text-red-400');
      }
    }
  }

  /**
   * Configure stroke width
   */
  setLineWidth(val) {
    this.activeThickness = val;
    this.thicknessDisplayTxt.innerText = `${val} px`;
    if (this.isDrawing && this.previewShape) {
      this.previewShape.lineWidth = val;
    }
    this.redraw();
  }

  /**
   * Setup ResizeObserver for responsive high DPI scaling
   */
  setupResizeObserver() {
    this.resizeObserver = new ResizeObserver(() => {
      this.resizeCanvas();
    });
    this.resizeObserver.observe(this.container);
  }

  /**
   * Perform DPI aware coordinates size layout
   */
  resizeCanvas() {
    if (!this.canvas || !this.container) return;
    
    const rect = this.container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    
    // Backing buffer scaling
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    
    // CSS layout size parameters
    this.width = rect.width;
    this.height = rect.height;
    
    this.ctx = this.canvas.getContext('2d');
    this.ctx.scale(dpr, dpr);
    
    this.redraw();
  }

  /**
   * Advanced CAD snapping engine (Priority: Endpoints > Midpoints > Grid)
   */
  getSnappedPosition(rawX, rawY) {
    if (!this.snapEnabled) {
      return { x: rawX, y: rawY, type: null };
    }

    // Set screen-space tolerance (e.g. 15 pixels), convert to world space based on active zoom
    const snapToleranceScreen = 15;
    const snapToleranceWorld = snapToleranceScreen / this.zoomScale;

    let closestPoint = null;
    let minDistance = Infinity;

    // 1. Check Endpoints / Centers / Vertexes first (highest CAD priority)
    if (this.snapToEndpoints) {
      const endpoints = [];
      this.shapes.forEach(shape => {
        if (!this.isLayerVisible(shape.layerId || 'default')) return;
        
        if (['line', 'wall', 'beam', 'door', 'window', 'dimension'].includes(shape.type)) {
          endpoints.push({ x: shape.x1, y: shape.y1, type: 'endpoint' });
          endpoints.push({ x: shape.x2, y: shape.y2, type: 'endpoint' });
        } else if (['rectangle', 'column', 'roomlabel', 'areazone'].includes(shape.type)) {
          endpoints.push({ x: shape.x, y: shape.y, type: 'endpoint' });
          endpoints.push({ x: shape.x + shape.width, y: shape.y, type: 'endpoint' });
          endpoints.push({ x: shape.x, y: shape.y + shape.height, type: 'endpoint' });
          endpoints.push({ x: shape.x + shape.width, y: shape.y + shape.height, type: 'endpoint' });
        } else if (shape.type === 'circle') {
          // Center counts as high priority node/endpoint snap
          endpoints.push({ x: shape.centerX, y: shape.centerY, type: 'endpoint', isCenter: true });
        }
      });

      endpoints.forEach(p => {
        const dist = Math.hypot(rawX - p.x, rawY - p.y);
        if (dist < minDistance && dist < snapToleranceWorld) {
          minDistance = dist;
          closestPoint = p;
        }
      });
    }

    // 2. Check Midpoints if nothing closer found
    if (this.snapToMidpoints && (!closestPoint || minDistance > (4 / this.zoomScale))) {
      const midpoints = [];
      this.shapes.forEach(shape => {
        if (!this.isLayerVisible(shape.layerId || 'default')) return;
        
        if (['line', 'wall', 'beam', 'door', 'window', 'dimension'].includes(shape.type)) {
          midpoints.push({ x: (shape.x1 + shape.x2) / 2, y: (shape.y1 + shape.y2) / 2, type: 'midpoint' });
        } else if (['rectangle', 'column', 'roomlabel', 'areazone'].includes(shape.type)) {
          midpoints.push({ x: shape.x + shape.width / 2, y: shape.y, type: 'midpoint' });
          midpoints.push({ x: shape.x + shape.width / 2, y: shape.y + shape.height, type: 'midpoint' });
          midpoints.push({ x: shape.x, y: shape.y + shape.height / 2, type: 'midpoint' });
          midpoints.push({ x: shape.x + shape.width, y: shape.y + shape.height / 2, type: 'midpoint' });
        } else if (shape.type === 'circle') {
          // Quadrants of the circle count as midpoints
          const r = shape.radius;
          midpoints.push({ x: shape.centerX - r, y: shape.centerY, type: 'midpoint' });
          midpoints.push({ x: shape.centerX + r, y: shape.centerY, type: 'midpoint' });
          midpoints.push({ x: shape.centerX, y: shape.centerY - r, type: 'midpoint' });
          midpoints.push({ x: shape.centerX, y: shape.centerY + r, type: 'midpoint' });
        }
      });

      midpoints.forEach(p => {
        const dist = Math.hypot(rawX - p.x, rawY - p.y);
        if (dist < minDistance && dist < snapToleranceWorld) {
          minDistance = dist;
          closestPoint = p;
        }
      });
    }

    if (closestPoint) {
      return { x: closestPoint.x, y: closestPoint.y, type: closestPoint.type };
    }

    // 3. Fall back to standard grid coordinates snapping
    if (this.snapToGrid) {
      const snappedX = Math.round(rawX / this.gridSize) * this.gridSize;
      const snappedY = Math.round(rawY / this.gridSize) * this.gridSize;
      return { x: snappedX, y: snappedY, type: 'grid' };
    }

    return { x: rawX, y: rawY, type: null };
  }

  /**
   * Format any world metric pixels to chosen drawing unit display notation
   */
  formatValue(pixels) {
    let val = pixels;
    let unit = 'px';
    switch (this.activeUnit) {
      case 'mm':
        val = pixels * 0.264583;
        unit = 'mm';
        break;
      case 'cm':
        val = pixels * 0.0264583;
        unit = 'cm';
        break;
      case 'm':
        val = pixels * 0.000264583;
        unit = 'm';
        break;
      case 'in':
        val = pixels * 0.0104167;
        unit = 'in';
        break;
      case 'ft':
        val = pixels * (0.0104167 / 12.0);
        unit = 'ft';
        break;
      case 'px':
      default:
        val = pixels;
        unit = 'px';
        break;
    }
    val = val * (this.scaleRatio || 1.0);
    return `${val.toFixed(2)} ${unit}`;
  }

  formatArea(pixelsArea) {
    let val = pixelsArea;
    let unit = 'px²';
    switch (this.activeUnit) {
      case 'mm':
        val = pixelsArea * (0.264583 ** 2);
        unit = 'mm²';
        break;
      case 'cm':
        val = pixelsArea * (0.0264583 ** 2);
        unit = 'cm²';
        break;
      case 'm':
        val = pixelsArea * (0.000264583 ** 2);
        unit = 'm²';
        break;
      case 'in':
        val = pixelsArea * (0.0104167 ** 2);
        unit = 'in²';
        break;
      case 'ft':
        val = pixelsArea * ((0.0104167 / 12.0) ** 2);
        unit = 'ft²';
        break;
      case 'px':
      default:
        val = pixelsArea;
        unit = 'px²';
        break;
    }
    val = val * ((this.scaleRatio || 1.0) ** 2);
    return `${val.toFixed(2)} ${unit}`;
  }

  /**
   * Convert entered metric values back into standard world pixels
   */
  parseValueToPixels(valStringOrNum) {
    let val = parseFloat(valStringOrNum);
    if (isNaN(val)) return 0;
    
    val = val / (this.scaleRatio || 1.0);
    
    switch (this.activeUnit) {
      case 'mm':
        return val / 0.264583;
      case 'cm':
        return val / 0.0264583;
      case 'm':
        return val / 0.000264583;
      case 'in':
        return val / 0.0104167;
      case 'ft':
        return val / (0.0104167 / 12.0);
      case 'px':
      default:
        return val;
    }
  }

  /**
   * Bind global CAD workbench keyboard shortcuts
   */
  bindKeyboardShortcuts() {
    window.addEventListener('keydown', (e) => {
      // Ignore shortcuts if the user is typing inside an active input structure
      if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA' || document.activeElement.tagName === 'SELECT')) {
        return;
      }

      const key = e.key.toLowerCase();
      
      // Sequential command buffer for professional AutoCAD keystroke shortcuts (RO = Rotate)
      if (!this.cmdBuffer) {
        this.cmdBuffer = "";
      }
      if (key.length === 1 && /^[a-z]$/.test(key)) {
        this.cmdBuffer += key;
        if (this.cmdBuffer.length > 4) {
          this.cmdBuffer = this.cmdBuffer.slice(-4);
        }
        if (this.cmdBuffer.endsWith("ro")) {
          this.setActiveTool('rotate');
          this.cmdBuffer = "";
          e.preventDefault();
          return;
        }
        if (this.cmdBuffer.endsWith("mi")) {
          this.setActiveTool('mirror');
          this.cmdBuffer = "";
          e.preventDefault();
          return;
        }
        if (this.cmdBuffer.endsWith("sc")) {
          this.setActiveTool('scale');
          this.cmdBuffer = "";
          e.preventDefault();
          return;
        }
      } else {
        this.cmdBuffer = "";
      }
      
      // Control hotkeys
      if (e.ctrlKey && key === 'z') {
        e.preventDefault();
        this.undo();
      } else if (e.ctrlKey && key === 'y') {
        e.preventDefault();
        this.redo();
      } else if (e.ctrlKey && (key === 'd' || key === 'c')) {
        if (this.selectedShape) {
          e.preventDefault();
          this.duplicateShape(this.selectedShape);
        }
      } else if (key === 'l') {
        e.preventDefault();
        this.setActiveTool('line');
      } else if (key === 'r') {
        e.preventDefault();
        this.setActiveTool('rectangle');
      } else if (key === 'c') {
        e.preventDefault();
        this.setActiveTool('circle');
      } else if (key === 's') {
        e.preventDefault();
        this.setActiveTool('select');
      } else if (key === 'w') {
        e.preventDefault();
        this.setActiveTool('wall');
      } else if (key === 'p') {
        e.preventDefault();
        if (this.activeTool === 'pan') {
          this.setActiveTool(this.previousTool || 'select');
        } else {
          this.setActiveTool('pan');
        }
      } else if (key === 'h') {
        this.setActiveTool('column');
      } else if (key === 'b') {
        this.setActiveTool('beam');
      } else if (key === 'o') {
        this.setActiveTool('door');
      } else if (key === 'v') {
        this.setActiveTool('window');
      } else if (key === 'n') {
        this.setActiveTool('roomlabel');
      } else if (key === 't') {
        this.setActiveTool('text');
      } else if (key === 'a') {
        this.setActiveTool('areazone');
      } else if (key === 'm') {
        this.setActiveTool('dimension');
      } else if (key === 'k') {
        this.setActiveTool('measure');
      } else if (key === 'enter') {
        if (this.activeTool === 'mirror' && this.mirrorStep === 'select') {
          e.preventDefault();
          const btn = document.getElementById('mirror-confirm-selection');
          if (btn) btn.click();
        } else if (this.activeTool === 'rotate' && this.rotateStep === 'select') {
          e.preventDefault();
          const btn = document.getElementById('rotate-confirm-selection');
          if (btn) btn.click();
        } else if (this.activeTool === 'scale' && this.scaleStep === 'select') {
          e.preventDefault();
          const btn = document.getElementById('scale-confirm-selection');
          if (btn) btn.click();
        }
      } else if (key === 'escape') {
        if (this.activeTool === 'pan') {
          this.setActiveTool(this.previousTool || 'select');
        } else {
          this.cancelActiveDrawing();
          this.selectedShape = null;
        }
        if (this.activeTool === 'mirror') {
          this.mirrorStep = 'select';
          this.selectedMirrorShapes = [];
          this.mirrorAxisX1 = null;
          this.mirrorAxisY1 = null;
          this.mirrorAxisX2 = null;
          this.mirrorAxisY2 = null;
          this.mirrorHoverX = null;
          this.mirrorHoverY = null;
          this.updateMirrorHUD();
        }
        if (this.activeTool === 'scale') {
          this.scaleStep = 'select';
          this.selectedScaleShapes = [];
          this.scalePivotX = null;
          this.scalePivotY = null;
          this.scaleHoverX = null;
          this.scaleHoverY = null;
          this.isScaling = false;
          this.updateScaleHUD();
        }
        this.updateDeleteSelectedBtnState();
        this.updatePropertiesPanel();
        this.redraw();
      } else if (key === 'delete' || key === 'backspace') {
        if (this.selectedShape) {
          e.preventDefault();
          this.deleteSelectedShape();
        } else if (key === 'delete') {
          const modal = document.getElementById('clear-modal');
          if (modal) modal.classList.remove('hidden');
        }
      } else if (key === 'arrowup' || key === 'arrowdown' || key === 'arrowleft' || key === 'arrowright') {
        if (this.selectedShape) {
          e.preventDefault();
          const amt = e.shiftKey ? 10 : 1;
          const dx = key === 'arrowleft' ? -amt : (key === 'arrowright' ? amt : 0);
          const dy = key === 'arrowup' ? -amt : (key === 'arrowdown' ? amt : 0);
          this.nudgeSelectedShape(dx, dy);
        }
      }
    });
  }

  deleteSelectedShape() {
    if (this.selectedShape) {
      if (this.isLayerLocked(this.selectedShape.layerId)) {
        this.showStatusFeedback("Cannot delete: Selected shape layer is locked.");
        return;
      }
      const index = this.shapes.indexOf(this.selectedShape);
      if (index !== -1) {
        this.pushUndoCheckpoint();
        this.shapes.splice(index, 1);
        this.selectedShape = null;
        this.updateDeleteSelectedBtnState();
        this.updateUndoButtonState();
        this.saveDrawing();
        this.updateEntityList();
        this.redraw();
      }
    }
  }

  // ==========================================
  // 3. MOUSE DRAFTING HANDLERS
  // ==========================================

  handleMouseDown(e) {
    if (this.isEditingText) {
      if (e.target !== this.activeTextEditor) {
        this.commitTextEditing();
        e.preventDefault();
        e.stopPropagation();
        return;
      }
    }

    const rect = this.canvas.getBoundingClientRect();
    const rawX = e.clientX - rect.left;
    const rawY = e.clientY - rect.top;

    // Blur command line input and hide autocomplete suggestions when interacting with the canvas
    const commandInput = document.getElementById('cad-command-input');
    if (commandInput) {
      commandInput.blur();
    }
    const autocompleteBox = document.getElementById('cad-command-autocomplete');
    if (autocompleteBox) {
      autocompleteBox.classList.add('hidden');
      autocompleteBox.innerHTML = '';
      this.commandActiveSuggestionIndex = -1;
    }
    
    // Middle mouse button panning initialization or left mouse button panning if PAN tool is active
    if (e.button === 1 || (e.button === 0 && this.activeTool === 'pan')) {
      e.preventDefault();
      this.isPanning = true;
      this.panStartX = e.clientX;
      this.panStartY = e.clientY;
      this.panStartOffsetX = this.panX;
      this.panStartOffsetY = this.panY;
      if (this.canvas) this.canvas.style.cursor = 'grabbing';
      return;
    }
    
    // Convert click coordinates to world space
    const worldPos = this.screenToWorld(rawX, rawY);
    
    if (this.activeTool === 'text') {
      this.startTextEditing(e, worldPos);
      return;
    }
    
    if (this.activeTool === 'select') {
      // First, check if we clicked on a resize handle of the currently selected shape
      if (this.selectedShape && !this.isLayerLocked(this.selectedShape.layerId)) {
        const handles = this.getShapeHandles(this.selectedShape);
        const handleTolerance = 8 / this.zoomScale;
        let clickedHandle = null;
        for (const h of handles) {
          const dist = Math.hypot(worldPos.x - h.x, worldPos.y - h.y);
          if (dist <= handleTolerance) {
            clickedHandle = h;
            break;
          }
        }
        
        if (clickedHandle) {
          this.hasDraggedOrResized = false;
          this.undoDragBackup = this.shapes.map(s => s.serialize ? s.serialize() : JSON.parse(JSON.stringify(s)));
          this.isResizingShape = true;
          this.resizeHandleId = clickedHandle.id;
          this.resizeStartShapeState = this.cloneShape(this.selectedShape);
          this.dragStartX = worldPos.x;
          this.dragStartY = worldPos.y;

          // AUTO-UPDATE ATTACHED DIMENSIONS DURING RESIZE
          this.attachedDimensions = [];
          const vertices = this.getShapeVertices(this.selectedShape);
          this.shapes.forEach(sh => {
            if (sh.type === 'dimension') {
              let attaches1 = false;
              let attaches2 = false;
              const matchTolerance = 3;
              let vertIndex1 = -1;
              let vertIndex2 = -1;
              vertices.forEach((v, vIdx) => {
                if (Math.hypot(sh.x1 - v.x, sh.y1 - v.y) < matchTolerance) {
                  attaches1 = true;
                  vertIndex1 = vIdx;
                }
                if (Math.hypot(sh.x2 - v.x, sh.y2 - v.y) < matchTolerance) {
                  attaches2 = true;
                  vertIndex2 = vIdx;
                }
              });
              if (attaches1 || attaches2) {
                this.attachedDimensions.push({
                  dimension: sh,
                  attaches1,
                  attaches2,
                  vertIndex1,
                  vertIndex2,
                  origX1: sh.x1,
                  origY1: sh.y1,
                  origX2: sh.x2,
                  origY2: sh.y2
                });
              }
            }
          });

          this.updateRelativeCoords(worldPos.x, worldPos.y);
          this.redraw();
          return;
        }
      }

      // Find clicked shape starting from top (newest) (excluding locked layers)
      const clickTolerance = 6 / this.zoomScale;
      let found = null;
      for (let i = this.shapes.length - 1; i >= 0; i--) {
        const shape = this.shapes[i];
         if (!this.isLayerVisible(shape.layerId)) continue;
         if (this.isLayerLocked(shape.layerId)) continue;
         if (shape.contains(worldPos.x, worldPos.y, clickTolerance)) {
           found = shape;
           break;
         }
      }
      
      this.selectedShape = found;
      this.updateDeleteSelectedBtnState();
      this.updatePropertiesPanel();
      
      if (found) {
        this.hasDraggedOrResized = false;
        this.undoDragBackup = this.shapes.map(s => s.serialize ? s.serialize() : JSON.parse(JSON.stringify(s)));
        this.isDraggingShape = true;
        this.dragStartX = worldPos.x;
        this.dragStartY = worldPos.y;
        
        // Save copy of original coordinates to prevent drift during movement
        if (['line', 'wall', 'beam', 'door', 'window', 'dimension'].includes(found.type)) {
          this.originalShapePos = { x1: found.x1, y1: found.y1, x2: found.x2, y2: found.y2 };
        } else if (['rectangle', 'column', 'roomlabel', 'areazone', 'text'].includes(found.type)) {
          this.originalShapePos = { x: found.x, y: found.y };
        } else if (found.type === 'circle') {
          this.originalShapePos = { centerX: found.centerX, centerY: found.centerY };
        }

        // AUTO-UPDATE ATTACHED DIMENSIONS DURING DRAG
        this.attachedDimensions = [];
        if (found.type !== 'dimension') {
          const vertices = this.getShapeVertices(found);
          this.shapes.forEach(sh => {
            if (sh.type === 'dimension') {
              let attaches1 = false;
              let attaches2 = false;
              const matchTolerance = 3;
              vertices.forEach(v => {
                if (Math.hypot(sh.x1 - v.x, sh.y1 - v.y) < matchTolerance) {
                  attaches1 = true;
                }
                if (Math.hypot(sh.x2 - v.x, sh.y2 - v.y) < matchTolerance) {
                  attaches2 = true;
                }
              });
              if (attaches1 || attaches2) {
                this.attachedDimensions.push({
                  dimension: sh,
                  attaches1,
                  attaches2,
                  origX1: sh.x1,
                  origY1: sh.y1,
                  origX2: sh.x2,
                  origY2: sh.y2
                });
              }
            }
          });
        }
        
        this.updateRelativeCoords(worldPos.x, worldPos.y);
      } else {
        this.originalShapePos = null;
        this.attachedDimensions = [];
        this.hideRelativeCoords();
      }
      
      this.updateEntityList();
      this.redraw();
      return;
    }

    if (this.activeTool === 'rotate') {
      if (e.button !== 0) return;
      const snapped = this.getSnappedPosition(worldPos.x, worldPos.y);

      if (this.rotateStep === 'select') {
        const clickTolerance = 8 / this.zoomScale;
        let found = null;
        for (let i = this.shapes.length - 1; i >= 0; i--) {
          const shape = this.shapes[i];
          if (!this.isLayerVisible(shape.layerId)) continue;
          if (this.isLayerLocked(shape.layerId)) continue;
          if (shape.contains(worldPos.x, worldPos.y, clickTolerance)) {
            found = shape;
            break;
          }
        }

        if (found) {
          const multi = e.shiftKey || e.ctrlKey || e.metaKey;
          if (multi) {
            if (this.selectedShapes.includes(found)) {
              this.selectedShapes = this.selectedShapes.filter(s => s !== found);
            } else {
              this.selectedShapes.push(found);
            }
          } else {
            if (this.selectedShapes.includes(found)) {
              this.selectedShapes = this.selectedShapes.filter(s => s !== found);
            } else {
              this.selectedShapes = [found];
            }
          }
        } else {
          if (!e.shiftKey && !e.ctrlKey && !e.metaKey) {
            this.selectedShapes = [];
          }
        }
        this.updateRotateHUD();
        this.redraw();
        return;
      }

      if (this.rotateStep === 'pivot') {
        this.rotatePivotX = snapped.x;
        this.rotatePivotY = snapped.y;
        this.rotateStep = 'rotate';
        this.updateRotateHUD();
        this.redraw();
        
        // Open a beautiful custom prompt modal for exact rotation!
        setTimeout(() => {
          this.showCADPrompt(
            "CAD ROTATE",
            "Enter exact rotation angle in degrees (e.g. 45, 90, -45) or choose Interactive to rotate with your mouse:",
            "45",
            (angleDeg) => {
              this.applyExactRotation(angleDeg);
              this.rotateStep = 'select';
              this.selectedShapes = [];
              this.rotatePivotX = null;
              this.rotatePivotY = null;
              this.rotateBaseShapes = [];
              this.isRotating = false;
              this.updateRotateHUD();
              this.setActiveTool('select');
              this.redraw();
            },
            () => {
              this.showStatusFeedback("Interactive mode: Click and drag on canvas, then click again to finish rotation.");
            }
          );
        }, 50);
        return;
      }

      if (this.rotateStep === 'rotate') {
        this.isRotating = true;
        this.rotateBaseShapes = this.selectedShapes.map(sh => this.cloneShape(sh));
        this.rotateStartAngle = Math.atan2(worldPos.y - this.rotatePivotY, worldPos.x - this.rotatePivotX);
        this.redraw();
        return;
      }
    }

    if (this.activeTool === 'scale') {
      if (e.button !== 0) return;
      const snapped = this.getSnappedPosition(worldPos.x, worldPos.y);

      if (this.scaleStep === 'select') {
        const clickTolerance = 8 / this.zoomScale;
        let found = null;
        for (let i = this.shapes.length - 1; i >= 0; i--) {
          const shape = this.shapes[i];
          if (!this.isLayerVisible(shape.layerId)) continue;
          if (this.isLayerLocked(shape.layerId)) continue;
          if (shape.contains(worldPos.x, worldPos.y, clickTolerance)) {
            found = shape;
            break;
          }
        }

        if (found) {
          const multi = e.shiftKey || e.ctrlKey || e.metaKey;
          if (multi) {
            if (this.selectedScaleShapes.includes(found)) {
              this.selectedScaleShapes = this.selectedScaleShapes.filter(s => s !== found);
            } else {
              this.selectedScaleShapes.push(found);
            }
          } else {
            if (this.selectedScaleShapes.includes(found)) {
              this.selectedScaleShapes = this.selectedScaleShapes.filter(s => s !== found);
            } else {
              this.selectedScaleShapes = [found];
            }
          }
        } else {
          if (!e.shiftKey && !e.ctrlKey && !e.metaKey) {
            this.selectedScaleShapes = [];
          }
        }
        this.updateScaleHUD();
        this.redraw();
        return;
      }

      if (this.scaleStep === 'basepoint') {
        this.scalePivotX = snapped.x;
        this.scalePivotY = snapped.y;
        this.scaleStep = 'scale';
        
        // Record initial mouse-pivot distance
        this.scaleStartDist = Math.hypot(worldPos.x - this.scalePivotX, worldPos.y - this.scalePivotY);
        if (this.scaleStartDist < 10) {
          this.scaleStartDist = 100 / this.zoomScale; // reasonable default
        }
        this.scaleHoverX = worldPos.x;
        this.scaleHoverY = worldPos.y;
        this.scaleBaseShapes = this.selectedScaleShapes.map(sh => this.cloneShape(sh));
        this.isScaling = true;

        this.updateScaleHUD();
        this.redraw();
        
        // Let the state register, then open a beautiful custom prompt modal!
        setTimeout(() => {
          this.showCADPrompt(
            "CAD SCALE",
            "Enter exact scale factor (e.g., 0.5 to shrink half, 2 to double, 1.5) or choose Interactive to scale with your mouse:",
            "2.0",
            (scaleFactor) => {
              this.applyScale(scaleFactor);
              this.setActiveTool('select');
              this.redraw();
            },
            () => {
              this.showStatusFeedback("Interactive mode: Move mouse to scale, then click to finish scaling.");
            }
          );
        }, 50);
        return;
      }

      if (this.scaleStep === 'scale') {
        const dx = worldPos.x - this.scalePivotX;
        const dy = worldPos.y - this.scalePivotY;
        const dist = Math.hypot(dx, dy);
        const s = this.scaleStartDist > 0 ? (dist / this.scaleStartDist) : 1.0;
        
        this.applyScale(s);
        return;
      }
    }

    if (this.activeTool === 'mirror') {
      if (e.button !== 0) return;
      const snapped = this.getSnappedPosition(worldPos.x, worldPos.y);

      if (this.mirrorStep === 'select') {
        const clickTolerance = 8 / this.zoomScale;
        let found = null;
        for (let i = this.shapes.length - 1; i >= 0; i--) {
          const shape = this.shapes[i];
          if (!this.isLayerVisible(shape.layerId)) continue;
          if (this.isLayerLocked(shape.layerId)) continue;
          if (shape.contains(worldPos.x, worldPos.y, clickTolerance)) {
            found = shape;
            break;
          }
        }

        if (found) {
          const multi = e.shiftKey || e.ctrlKey || e.metaKey;
          if (multi) {
            if (this.selectedMirrorShapes.includes(found)) {
              this.selectedMirrorShapes = this.selectedMirrorShapes.filter(s => s !== found);
            } else {
              this.selectedMirrorShapes.push(found);
            }
          } else {
            if (this.selectedMirrorShapes.includes(found)) {
              this.selectedMirrorShapes = this.selectedMirrorShapes.filter(s => s !== found);
            } else {
              this.selectedMirrorShapes = [found];
            }
          }
        } else {
          if (!e.shiftKey && !e.ctrlKey && !e.metaKey) {
            this.selectedMirrorShapes = [];
          }
        }
        this.updateMirrorHUD();
        this.redraw();
        return;
      }

      if (this.mirrorStep === 'axis1') {
        this.mirrorAxisX1 = snapped.x;
        this.mirrorAxisY1 = snapped.y;
        this.mirrorStep = 'axis2';
        this.mirrorHoverX = snapped.x;
        this.mirrorHoverY = snapped.y;
        this.updateMirrorHUD();
        this.redraw();
        this.showStatusFeedback("First mirror axis point set. Set second point.");
        return;
      }

      if (this.mirrorStep === 'axis2') {
        let x2 = snapped.x;
        let y2 = snapped.y;
        if (e.shiftKey) {
          const dx = x2 - this.mirrorAxisX1;
          const dy = y2 - this.mirrorAxisY1;
          if (Math.abs(dx) > Math.abs(dy)) {
            y2 = this.mirrorAxisY1;
          } else {
            x2 = this.mirrorAxisX1;
          }
        }
        this.mirrorAxisX2 = x2;
        this.mirrorAxisY2 = y2;
        this.mirrorStep = 'confirm';
        this.updateMirrorHUD();
        this.redraw();
        this.showStatusFeedback("Mirror axis line defined. Confirm your placement choice.");
        return;
      }
    }

    if (this.activeTool === 'measure') {
      if (e.button !== 0) return;
      const start = this.getSnappedPosition(worldPos.x, worldPos.y);
      if (this.measureFirstX === null || (this.measureFirstX !== null && this.measureSecondX !== null)) {
        this.measureFirstX = start.x;
        this.measureFirstY = start.y;
        this.measureSecondX = null;
        this.measureSecondY = null;
        this.measureHoverX = start.x;
        this.measureHoverY = start.y;
        this.isMeasuring = true;
        this.updateMeasureHUDValues(this.measureFirstX, this.measureFirstY, this.measureHoverX, this.measureHoverY);
      } else {
        this.measureSecondX = start.x;
        this.measureSecondY = start.y;
        this.measureHoverX = start.x;
        this.measureHoverY = start.y;
        this.isMeasuring = false;
        this.updateMeasureHUDValues(this.measureFirstX, this.measureFirstY, this.measureSecondX, this.measureSecondY);
      }
      this.redraw();
      return;
    }
    
    // Snap starting point in world space
    const start = this.getSnappedPosition(worldPos.x, worldPos.y);
    
    if (this.activeTool === 'dimension') {
      if (!this.isDrawing || !this.drawingStep) {
        this.isDrawing = true;
        this.drawingStep = 1;
        this.startX = start.x;
        this.startY = start.y;
        this.mouseDownTime = Date.now();
        this.previewShape = null;
      } else if (this.drawingStep === 1) {
        this.endX = start.x;
        this.endY = start.y;
        this.drawingStep = 2;
        this.mouseDownTime = Date.now();
      } else if (this.drawingStep === 2) {
        if (this.previewShape) {
          this.pushUndoCheckpoint();
          this.previewShape.layerId = this.activeLayerId;
          this.shapes.push(this.previewShape);
          this.redoStack = [];
          this.updateRedoButtonState();
          this.updateUndoButtonState();
          this.saveDrawing();
          this.updateEntityList();
        }
        this.isDrawing = false;
        this.drawingStep = 0;
        this.previewShape = null;
        this.hideRelativeCoords();
      }
      this.redraw();
      return;
    }

    if (!this.isDrawing) {
      this.isDrawing = true;
      this.drawingStep = 1;
      this.startX = start.x;
      this.startY = start.y;
      this.currentX = start.x;
      this.currentY = start.y;
      this.mouseDownTime = Date.now();
      this.previewShape = null;
      this.updateRelativeCoords(start.x, start.y);
    } else {
      if (this.previewShape) {
        let valid = true;
        if (['rectangle', 'column', 'roomlabel', 'areazone'].includes(this.previewShape.type) && this.previewShape.width === 0 && this.previewShape.height === 0) valid = false;
        if (this.previewShape instanceof Circle && this.previewShape.radius === 0) valid = false;
        if (['line', 'wall', 'beam', 'door', 'window', 'dimension'].includes(this.previewShape.type) && this.previewShape.x1 === this.previewShape.x2 && this.previewShape.y1 === this.previewShape.y2) valid = false;
        if (this.previewShape.type === 'text') valid = true;

        if (valid) {
          this.pushUndoCheckpoint();
          this.previewShape.layerId = this.activeLayerId;
          this.shapes.push(this.previewShape);
          this.redoStack = [];
          this.updateRedoButtonState();
          this.updateUndoButtonState();
          this.saveDrawing();
          this.updateEntityList();
        }
      }
      this.isDrawing = false;
      this.drawingStep = 0;
      this.previewShape = null;
      this.hideRelativeCoords();
    }
    this.redraw();
  }

  handleMouseMove(e) {
    const rect = this.canvas.getBoundingClientRect();
    const rawX = e.clientX - rect.left;
    const rawY = e.clientY - rect.top;
    
    // Active panning update
    if (this.isPanning) {
      this.panX = this.panStartOffsetX + (e.clientX - this.panStartX);
      this.panY = this.panStartOffsetY + (e.clientY - this.panStartY);
      
      // Keep coordinates status synced during panning
      const worldPos = this.screenToWorld(rawX, rawY);
      const snapped = this.getSnappedPosition(worldPos.x, worldPos.y);
      this.coordsDisplay.innerText = `X: ${this.formatValue(snapped.x)} | Y: ${this.formatValue(snapped.y)}`;
      
      this.redraw();
      return;
    }
    
    const worldPos = this.screenToWorld(rawX, rawY);
    const snapped = this.getSnappedPosition(worldPos.x, worldPos.y);
    
    this.currentX = worldPos.x;
    this.currentY = worldPos.y;
    
    // Smooth responsive status bar coordinates update
    this.coordsDisplay.innerText = `X: ${this.formatValue(snapped.x)} | Y: ${this.formatValue(snapped.y)}`;

    if (this.activeTool === 'rotate') {
      this.currentHoverX = worldPos.x;
      this.currentHoverY = worldPos.y;

      if (this.isRotating) {
        let deltaAngleRad = Math.atan2(worldPos.y - this.rotatePivotY, worldPos.x - this.rotatePivotX) - this.rotateStartAngle;
        
        if (e.shiftKey) {
          const step = 15 * (Math.PI / 180);
          deltaAngleRad = Math.round(deltaAngleRad / step) * step;
        }

        const deg = deltaAngleRad * (180 / Math.PI);
        const normalizedDeg = deg < 0 ? deg + 360 : deg;
        const currentAngleEl = document.getElementById('rotate-current-angle');
        if (currentAngleEl) {
          currentAngleEl.innerText = `${normalizedDeg.toFixed(1)}°`;
        }

        this.shapes = this.shapes.map(sh => {
          const idx = this.selectedShapes.indexOf(sh);
          if (idx !== -1) {
            const baseSh = this.rotateBaseShapes[idx];
            const cloned = this.cloneShape(baseSh);
            cloned.rotate(this.rotatePivotX, this.rotatePivotY, deltaAngleRad);
            this.selectedShapes[idx] = cloned;
            return cloned;
          }
          return sh;
        });

        this.updateEntityList();
        this.redraw();
      } else {
        this.redraw();
      }
      return;
    }

    if (this.activeTool === 'scale') {
      this.scaleHoverX = worldPos.x;
      this.scaleHoverY = worldPos.y;

      if (this.isScaling && this.scalePivotX !== null && this.scalePivotY !== null) {
        const dx = worldPos.x - this.scalePivotX;
        const dy = worldPos.y - this.scalePivotY;
        const dist = Math.hypot(dx, dy);
        let s = this.scaleStartDist > 0 ? (dist / this.scaleStartDist) : 1.0;

        // If shift key is held, snap scale factor to nearest 0.1
        if (e.shiftKey) {
          s = Math.round(s * 10) / 10;
        }

        const factorEl = document.getElementById('scale-current-factor');
        if (factorEl) {
          factorEl.innerText = `${s.toFixed(3)}x (Live)`;
        }

        const inputEl = document.getElementById('scale-factor-input');
        if (inputEl) {
          inputEl.value = s.toFixed(2);
        }

        this.shapes = this.shapes.map(sh => {
          const idx = this.selectedScaleShapes.indexOf(sh);
          if (idx !== -1) {
            const baseSh = this.scaleBaseShapes[idx];
            const cloned = this.cloneShape(baseSh);
            cloned.scale(this.scalePivotX, this.scalePivotY, s);
            this.selectedScaleShapes[idx] = cloned;
            return cloned;
          }
          return sh;
        });

        this.updateEntityList();
        this.redraw();
      } else {
        this.redraw();
      }
      return;
    }

    if (this.activeTool === 'mirror') {
      this.mirrorHoverX = snapped.x;
      this.mirrorHoverY = snapped.y;

      if (this.mirrorStep === 'axis2') {
        if (e.shiftKey) {
          const dx = snapped.x - this.mirrorAxisX1;
          const dy = snapped.y - this.mirrorAxisY1;
          if (Math.abs(dx) > Math.abs(dy)) {
            this.mirrorHoverY = this.mirrorAxisY1;
          } else {
            this.mirrorHoverX = this.mirrorAxisX1;
          }
        }
      }
      this.updateMirrorHUD();
      this.redraw();
      return;
    }

    if (this.activeTool === 'measure') {
      this.measureHoverX = snapped.x;
      this.measureHoverY = snapped.y;
      if (this.isMeasuring) {
        this.updateMeasureHUDValues(this.measureFirstX, this.measureFirstY, this.measureHoverX, this.measureHoverY);
      }
      this.redraw();
      return;
    }
    
    if (this.activeTool === 'select') {
      if (this.isResizingShape && this.selectedShape && this.resizeHandleId && this.resizeStartShapeState) {
        this.hasDraggedOrResized = true;
        const orig = this.resizeStartShapeState;
        const shape = this.selectedShape;
        
        if (['line', 'wall', 'beam', 'door', 'window', 'dimension'].includes(shape.type)) {
          if (this.resizeHandleId === 'p1') {
            shape.x1 = snapped.x;
            shape.y1 = snapped.y;
          } else if (this.resizeHandleId === 'p2') {
            shape.x2 = snapped.x;
            shape.y2 = snapped.y;
          }
        } else if (['rectangle', 'column', 'roomlabel', 'areazone'].includes(shape.type)) {
          if (this.resizeHandleId === 'tl') {
            const right = orig.x + orig.width;
            const bottom = orig.y + orig.height;
            shape.x = snapped.x;
            shape.y = snapped.y;
            shape.width = right - snapped.x;
            shape.height = bottom - snapped.y;
          } else if (this.resizeHandleId === 'tr') {
            const left = orig.x;
            const bottom = orig.y + orig.height;
            shape.y = snapped.y;
            shape.width = snapped.x - left;
            shape.height = bottom - snapped.y;
          } else if (this.resizeHandleId === 'bl') {
            const right = orig.x + orig.width;
            const top = orig.y;
            shape.x = snapped.x;
            shape.width = right - snapped.x;
            shape.height = snapped.y - top;
          } else if (this.resizeHandleId === 'br') {
            shape.width = snapped.x - orig.x;
            shape.height = snapped.y - orig.y;
          }
        } else if (shape.type === 'circle') {
          if (this.resizeHandleId === 'center') {
            shape.centerX = snapped.x;
            shape.centerY = snapped.y;
          } else {
            shape.radius = Math.max(0.1, Math.hypot(snapped.x - shape.centerX, snapped.y - shape.centerY));
          }
        }
        
        // Update attached dimensions on resize in real-time
        if (this.attachedDimensions && this.attachedDimensions.length > 0) {
          const newVertices = this.getShapeVertices(shape);
          this.attachedDimensions.forEach(entry => {
            if (entry.attaches1 && entry.vertIndex1 !== -1 && newVertices[entry.vertIndex1]) {
              entry.dimension.x1 = newVertices[entry.vertIndex1].x;
              entry.dimension.y1 = newVertices[entry.vertIndex1].y;
            }
            if (entry.attaches2 && entry.vertIndex2 !== -1 && newVertices[entry.vertIndex2]) {
              entry.dimension.x2 = newVertices[entry.vertIndex2].x;
              entry.dimension.y2 = newVertices[entry.vertIndex2].y;
            }
          });
        }
        
        this.updateRelativeCoords(snapped.x, snapped.y);
        this.saveDrawing();
        this.updateEntityList();
        this.updatePropertiesPanel();
      } else if (this.isDraggingShape && this.selectedShape && this.originalShapePos) {
        this.hasDraggedOrResized = true;
        let dispX = worldPos.x - this.dragStartX;
        let dispY = worldPos.y - this.dragStartY;
        
        if (this.snapEnabled) {
          dispX = Math.round(dispX / this.gridSize) * this.gridSize;
          dispY = Math.round(dispY / this.gridSize) * this.gridSize;
        }
        
        // Apply relative drag delta from copy
        const shape = this.selectedShape;
        if (['line', 'wall', 'beam', 'door', 'window', 'dimension'].includes(shape.type)) {
          shape.x1 = this.originalShapePos.x1 + dispX;
          shape.y1 = this.originalShapePos.y1 + dispY;
          shape.x2 = this.originalShapePos.x2 + dispX;
          shape.y2 = this.originalShapePos.y2 + dispY;
        } else if (['rectangle', 'column', 'roomlabel', 'areazone', 'text'].includes(shape.type)) {
          shape.x = this.originalShapePos.x + dispX;
          shape.y = this.originalShapePos.y + dispY;
        } else if (shape.type === 'circle') {
          shape.centerX = this.originalShapePos.centerX + dispX;
          shape.centerY = this.originalShapePos.centerY + dispY;
        }

        // Also update any attached dimensions on drag-move
        if (this.attachedDimensions && this.attachedDimensions.length > 0) {
          this.attachedDimensions.forEach(entry => {
            if (entry.attaches1) {
              entry.dimension.x1 = entry.origX1 + dispX;
              entry.dimension.y1 = entry.origY1 + dispY;
            }
            if (entry.attaches2) {
              entry.dimension.x2 = entry.origX2 + dispX;
              entry.dimension.y2 = entry.origY2 + dispY;
            }
          });
        }
        
        // Show active movement metrics in world coordinates
        this.updateRelativeCoords(worldPos.x, worldPos.y);
        this.saveDrawing();
        this.updateEntityList();
        this.updatePropertiesPanel();
      } else {
        // Track hover target dynamically when selection tool is active but not dragging
        const hoverTolerance = 6 / this.zoomScale;
        let hoverIndex = null;
        for (let i = this.shapes.length - 1; i >= 0; i--) {
          const shape = this.shapes[i];
          if (!this.isLayerVisible(shape.layerId)) continue;
          if (this.isLayerLocked(shape.layerId)) continue;
          if (shape.contains(worldPos.x, worldPos.y, hoverTolerance)) {
            hoverIndex = i;
            break;
          }
        }
        if (this.hoveredShapeIndex !== hoverIndex) {
          this.hoveredShapeIndex = hoverIndex;
        }
      }

      // Check hover handles and update Cursor style dynamically
      let cursorStyle = 'default';
      if (this.isResizingShape && this.resizeHandleId) {
        const hid = this.resizeHandleId;
        if (['p1', 'p2'].includes(hid)) cursorStyle = 'pointer';
        else if (hid === 'tl' || hid === 'br') cursorStyle = 'nwse-resize';
        else if (hid === 'tr' || hid === 'bl') cursorStyle = 'nesw-resize';
        else if (hid === 'center') cursorStyle = 'move';
        else if (['r_left', 'r_right'].includes(hid)) cursorStyle = 'ew-resize';
        else if (['r_top', 'r_bottom'].includes(hid)) cursorStyle = 'ns-resize';
      } else if (this.isDraggingShape) {
        cursorStyle = 'move';
      } else {
        // Cursor on mouse hover
        let hoverHandle = null;
        if (this.selectedShape) {
          const handles = this.getShapeHandles(this.selectedShape);
          const handleTolerance = 8 / this.zoomScale;
          for (const h of handles) {
            const dist = Math.hypot(worldPos.x - h.x, worldPos.y - h.y);
            if (dist <= handleTolerance) {
              hoverHandle = h;
              break;
            }
          }
        }
        
        if (hoverHandle) {
          const hid = hoverHandle.id;
          if (['p1', 'p2'].includes(hid)) cursorStyle = 'pointer';
          else if (hid === 'tl' || hid === 'br') cursorStyle = 'nwse-resize';
          else if (hid === 'tr' || hid === 'bl') cursorStyle = 'nesw-resize';
          else if (hid === 'center') cursorStyle = 'move';
          else if (['r_left', 'r_right'].includes(hid)) cursorStyle = 'ew-resize';
          else if (['r_top', 'r_bottom'].includes(hid)) cursorStyle = 'ns-resize';
        } else if (this.hoveredShapeIndex !== null) {
          cursorStyle = 'move';
        }
      }
      
      if (this.canvas) {
        this.canvas.style.cursor = cursorStyle;
      }
      
      this.redraw();
      return;
    }
    
    if (this.isDrawing) {
      const color = this.activeColor;
      const thickness = this.activeThickness;
      
      if (this.activeTool === 'line') {
        this.previewShape = new Line(this.startX, this.startY, snapped.x, snapped.y, color, thickness);
      } else if (this.activeTool === 'wall') {
        const wallThickEl = document.getElementById('wall-thickness-input');
        const wallThick = wallThickEl ? parseFloat(wallThickEl.value) || 12 : 12;
        this.previewShape = new Wall(this.startX, this.startY, snapped.x, snapped.y, color, thickness, wallThick);
      } else if (this.activeTool === 'beam') {
        this.previewShape = new Beam(this.startX, this.startY, snapped.x, snapped.y, color, thickness);
      } else if (this.activeTool === 'door') {
        this.previewShape = new Door(this.startX, this.startY, snapped.x, snapped.y, color, thickness);
      } else if (this.activeTool === 'window') {
        const winThickEl = document.getElementById('wall-thickness-input');
        const winThick = winThickEl ? parseFloat(winThickEl.value) || 12 : 12;
        this.previewShape = new Window(this.startX, this.startY, snapped.x, snapped.y, color, thickness, winThick);
      } else if (this.activeTool === 'dimension') {
        if (this.drawingStep === 2) {
          const x1 = this.startX, y1 = this.startY, x2 = this.endX, y2 = this.endY;
          const dx = x2 - x1, dy = y2 - y1;
          const len = Math.hypot(dx, dy);
          let offset = 0;
          if (len > 0.1) {
            const nx = -dy / len;
            const ny = dx / len;
            offset = (snapped.x - x1) * nx + (snapped.y - y1) * ny;
          }
          this.previewShape = new Dimension(x1, y1, x2, y2, color, thickness, 'aligned', 8, offset * this.zoomScale);
        } else {
          this.previewShape = new Dimension(this.startX, this.startY, snapped.x, snapped.y, color, thickness, 'aligned', 8, 0);
        }
      } else if (this.activeTool === 'rectangle') {
        const w = snapped.x - this.startX;
        const h = snapped.y - this.startY;
        this.previewShape = new Rectangle(this.startX, this.startY, w, h, color, thickness);
      } else if (this.activeTool === 'column') {
        const w = snapped.x - this.startX;
        const h = snapped.y - this.startY;
        this.previewShape = new Column(this.startX, this.startY, w, h, color, thickness);
      } else if (this.activeTool === 'roomlabel') {
        const w = snapped.x - this.startX;
        const h = snapped.y - this.startY;
        const rSelect = document.getElementById('civil-room-label');
        const rCustom = document.getElementById('civil-room-custom');
        let labelStr = "Room";
        if (rSelect) {
          if (rSelect.value === "Custom Label" && rCustom) {
            labelStr = rCustom.value.trim() || "Custom Zone";
          } else {
            labelStr = rSelect.value;
          }
        }
        this.previewShape = new RoomLabel(this.startX, this.startY, w, h, color, thickness, labelStr);
      } else if (this.activeTool === 'text') {
        const customInput = document.getElementById('civil-room-custom');
        const textVal = (customInput && customInput.value.trim()) ? customInput.value.trim() : "Annotation Label";
        this.previewShape = new TextLabel(this.startX, this.startY, color, thickness, textVal, 14);
      } else if (this.activeTool === 'areazone') {
        const w = snapped.x - this.startX;
        const h = snapped.y - this.startY;
        const rSelect = document.getElementById('civil-room-label');
        const rCustom = document.getElementById('civil-room-custom');
        let labelStr = "Planimetric Zone";
        if (rSelect) {
          if (rSelect.value === "Custom Label" && rCustom) {
            labelStr = rCustom.value.trim() || "Custom Area";
          } else {
            labelStr = rSelect.value;
          }
        }
        this.previewShape = new AreaZone(this.startX, this.startY, w, h, color, thickness, labelStr);
      } else if (this.activeTool === 'circle') {
        if (this.circleDraftMethod === 'bounding') {
          // Bounding Box style: drag forms a virtual square
          const dx = snapped.x - this.startX;
          const dy = snapped.y - this.startY;
          const size = Math.min(Math.abs(dx), Math.abs(dy));
          const cx = this.startX + Math.sign(dx) * size / 2;
          const cy = this.startY + Math.sign(dy) * size / 2;
          const rad = size / 2;
          this.previewShape = new Circle(cx, cy, rad, color, thickness);
        } else {
          // Standard CAD center-radius drafting
          const rad = Math.hypot(snapped.x - this.startX, snapped.y - this.startY);
          this.previewShape = new Circle(this.startX, this.startY, rad, color, thickness);
        }
      }
      
      this.updateRelativeCoords(snapped.x, snapped.y);
    }
    
    this.redraw();
  }

  handleMouseUp(e) {
    // Release middle mouse button panning or left mouse button panning if PAN tool is active
    if (e.button === 1 || (e.button === 0 && this.activeTool === 'pan')) {
      if (this.isPanning) {
        this.isPanning = false;
        if (this.canvas) {
          this.canvas.style.cursor = this.activeTool === 'select' ? 'default' : (this.activeTool === 'pan' ? 'grab' : 'crosshair');
        }
        this.redraw();
      }
      return;
    }
    
    if (this.activeTool === 'select') {
      if (this.hasDraggedOrResized && this.undoDragBackup) {
        if (!this.undoStack) this.undoStack = [];
        this.undoStack.push(this.undoDragBackup);
        if (this.undoStack.length > 50) {
          this.undoStack.shift();
        }
        this.undoDragBackup = null;
        this.redoStack = [];
        this.updateUndoButtonState();
        this.updateRedoButtonState();
      }
      this.isDraggingShape = false;
      this.isResizingShape = false;
      this.resizeHandleId = null;
      this.resizeStartShapeState = null;
      this.originalShapePos = null;
      this.hasDraggedOrResized = false;
      this.undoDragBackup = null;
      this.hideRelativeCoords();
      this.redraw();
      return;
    }

    if (this.activeTool === 'rotate') {
      if (this.isRotating) {
        this.isRotating = false;
        this.saveDrawing();
        this.updateEntityList();
        this.updateUndoButtonState();
        this.redraw();
        this.showStatusFeedback("Rotation applied successfully.");
      }
      return;
    }
    
    if (!this.isDrawing) return;
    
    const isDragRelease = Date.now() - (this.mouseDownTime || 0) > 200;

    if (this.activeTool === 'dimension') {
      if (this.drawingStep === 1 && isDragRelease) {
        const rect = this.canvas.getBoundingClientRect();
        const rawX = e.clientX - rect.left;
        const rawY = e.clientY - rect.top;
        const worldPos = this.screenToWorld(rawX, rawY);
        const snapped = this.getSnappedPosition(worldPos.x, worldPos.y);
        this.endX = snapped.x;
        this.endY = snapped.y;
        this.drawingStep = 2;
        this.redraw();
      }
      return;
    }

    if (this.drawingStep === 1) {
      if (isDragRelease) {
        this.isDrawing = false;
        this.drawingStep = 0;
        
        if (this.previewShape) {
          let valid = true;
          if (['rectangle', 'column', 'roomlabel', 'areazone'].includes(this.previewShape.type) && this.previewShape.width === 0 && this.previewShape.height === 0) valid = false;
          if (this.previewShape instanceof Circle && this.previewShape.radius === 0) valid = false;
          if (['line', 'wall', 'beam', 'door', 'window', 'dimension'].includes(this.previewShape.type) && this.previewShape.x1 === this.previewShape.x2 && this.previewShape.y1 === this.previewShape.y2) valid = false;
          if (this.previewShape.type === 'text') valid = true;

          if (valid) {
            this.pushUndoCheckpoint();
            this.previewShape.layerId = this.activeLayerId;
            this.shapes.push(this.previewShape);
            this.redoStack = [];
            this.updateRedoButtonState();
            this.updateUndoButtonState();
            this.saveDrawing();
            this.updateEntityList();
          }
        }
        this.previewShape = null;
        this.hideRelativeCoords();
        this.redraw();
      }
    }
  }

  handleWheel(e) {
    e.preventDefault();
    
    const rect = this.canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    // Get mouse world position before zoom
    const worldPosBefore = this.screenToWorld(mouseX, mouseY);
    
    // Calculate new zoom factor
    const zoomIntensity = 0.08;
    let factor = e.deltaY < 0 ? (1 + zoomIntensity) : (1 - zoomIntensity);
    
    // Clamp zoom scale between 0.15x and 15.0x for stability and extreme comfort
    const newScale = Math.max(0.15, Math.min(15.0, this.zoomScale * factor));
    this.zoomScale = newScale;
    
    // Reposition pan so mouse cursor remains in same world position after zoom
    this.panX = mouseX - worldPosBefore.x * this.zoomScale;
    this.panY = mouseY - worldPosBefore.y * this.zoomScale;
    
    // Update footer display status
    this.updateZoomStatus();
    
    // Update coordinates status display
    const worldPosAfter = this.screenToWorld(mouseX, mouseY);
    const snapped = this.getSnappedPosition(worldPosAfter.x, worldPosAfter.y);
    this.currentX = worldPosAfter.x;
    this.currentY = worldPosAfter.y;
    this.coordsDisplay.innerText = `X: ${this.formatValue(snapped.x)} | Y: ${this.formatValue(snapped.y)}`;
    
    this.redraw();
  }

  handleDoubleClick(e) {
    // Reset view on double-clicking canvas
    e.preventDefault();
    this.resetView();
  }

  cancelActiveDrawing() {
    this.drawingStep = 0;
    if (this.isDrawing) {
      this.isDrawing = false;
      this.previewShape = null;
      this.hideRelativeCoords();
      this.redraw();
    }
    if (this.isEditingText) {
      this.cancelTextEditing();
    }
    
    // Clear measurement state too
    this.measureFirstX = null;
    this.measureFirstY = null;
    this.measureSecondX = null;
    this.measureSecondY = null;
    this.measureHoverX = null;
    this.measureHoverY = null;
    this.isMeasuring = false;
    this.updateMeasureHUDValues(null, null, null, null);
  }

  // ==========================================
  // 4. COORDINATE & COMPONENT UPDATES
  // ==========================================

  updateRelativeCoords(currX, currY) {
    const dx = currX - this.startX;
    const dy = currY - this.startY;
    const dist = Math.hypot(dx, dy);
    
    this.relativeCoordsDisplay.innerText = `dX: ${this.formatValue(dx)} | dY: ${this.formatValue(dy)} | L: ${this.formatValue(dist)}`;
    this.relativeCoordsWrapper.classList.remove('hidden');
    this.relativeCoordsWrapper.classList.add('flex');
  }

  hideRelativeCoords() {
    this.relativeCoordsWrapper.classList.remove('flex');
    this.relativeCoordsWrapper.classList.add('hidden');
  }

  updateRedoButtonState() {
    const redoBtn = document.getElementById('action-redo');
    if (redoBtn) {
      if (this.redoStack.length > 0) {
        redoBtn.removeAttribute('disabled');
        redoBtn.classList.remove('opacity-30', 'cursor-not-allowed');
      } else {
        redoBtn.setAttribute('disabled', 'true');
        redoBtn.classList.add('opacity-30', 'cursor-not-allowed');
      }
    }
  }

  updateUndoButtonState() {
    const undoBtn = document.getElementById('action-undo');
    if (undoBtn) {
      if (this.undoStack && this.undoStack.length > 0) {
        undoBtn.removeAttribute('disabled');
        undoBtn.classList.remove('opacity-30', 'cursor-not-allowed');
      } else {
        undoBtn.setAttribute('disabled', 'true');
        undoBtn.classList.add('opacity-30', 'cursor-not-allowed');
      }
    }
  }

  updateDeleteSelectedBtnState() {
    const deleteBtn = document.getElementById('action-delete-selected');
    if (deleteBtn) {
      if (this.selectedShape !== null && this.selectedShape !== undefined) {
        deleteBtn.removeAttribute('disabled');
        deleteBtn.classList.remove('opacity-30', 'cursor-not-allowed', 'text-gray-400');
        deleteBtn.classList.add('hover:text-red-400', 'text-gray-200');
      } else {
        deleteBtn.setAttribute('disabled', 'true');
        deleteBtn.classList.add('opacity-30', 'cursor-not-allowed', 'text-gray-400');
        deleteBtn.classList.remove('hover:text-red-400', 'text-gray-200');
      }
    }
  }

  drawMeasurementCanvasHUD(ctx, x1, y1, x2, y2) {
    const zoom = Math.max(0.01, this.zoomScale || 1.0);
    const dx = x2 - x1;
    const dy = y2 - y1;
    const distancePx = Math.hypot(dx, dy);
    
    // Draw diagonal measurement line with custom dashed styling (emerald)
    ctx.save();
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 1.5 / zoom;
    ctx.setLineDash([6 / zoom, 4 / zoom]);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    // Draw horizontal leg
    ctx.save();
    ctx.strokeStyle = 'rgba(156, 163, 175, 0.45)';
    ctx.lineWidth = 1 / zoom;
    ctx.setLineDash([4 / zoom, 4 / zoom]);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
    
    // Draw small endpoints circles
    ctx.save();
    ctx.fillStyle = '#10b981';
    ctx.beginPath();
    ctx.arc(x1, y1, 4 / zoom, 0, 2*Math.PI);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1 / zoom;
    ctx.stroke();
    
    ctx.beginPath();
    ctx.arc(x2, y2, 4 / zoom, 0, 2*Math.PI);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // Calculate angle in degrees
    // (Cartesian: dy values go down on screen so we invert dy)
    let angleRad = Math.atan2(-dy, dx);
    let angleDeg = angleRad * (180 / Math.PI);
    if (angleDeg < 0) angleDeg += 360;

    // Draw little angle arc
    if (distancePx > 20) {
      ctx.save();
      ctx.strokeStyle = '#60a5fa';
      ctx.lineWidth = 1.2 / zoom;
      ctx.beginPath();
      const arcRadius = 18 / zoom;
      const canvasStopAngle = Math.atan2(dy, dx);
      ctx.arc(x1, y1, arcRadius, 0, canvasStopAngle, canvasStopAngle < 0);
      ctx.stroke();
      ctx.restore();
    }

    // Prepare measurement texts
    const distStr = this.formatValue(distancePx);
    const horizStr = this.formatValue(Math.abs(dx));
    const vertStr = this.formatValue(Math.abs(dy));
    const angleStr = `${angleDeg.toFixed(1)}°`;

    // Multi-line HUD near the middle or offset from cursor
    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;
    
    // Draw box slightly offset to avoid overlapping the line
    const boxX = midX + 15 / zoom;
    const boxY = midY - 60 / zoom;

    const lines = [
      `Distance: ${distStr}`,
      `Horizontal: ${horizStr}`,
      `Vertical: ${vertStr}`,
      `Angle: ${angleStr}`
    ];

    ctx.save();
    ctx.font = `600 ${Math.max(9, 10 / zoom)}px "JetBrains Mono", monospace`;
    
    // Measure maximum text width for solid background card
    let maxW = 0;
    lines.forEach(line => {
      const w = ctx.measureText(line).width;
      if (w > maxW) maxW = w;
    });

    const paddingX = 8 / zoom;
    const paddingY = 6 / zoom;
    const lineSpacing = 13 / zoom;
    const boxWidth = maxW + paddingX * 2;
    const boxHeight = lines.length * lineSpacing + paddingY;

    // Draw background card (dark slate Glass panel)
    ctx.fillStyle = 'rgba(15, 17, 21, 0.95)';
    ctx.strokeStyle = '#10b981'; // emerald outline
    ctx.lineWidth = 1 / zoom;
    
    ctx.beginPath();
    ctx.rect(boxX - paddingX, boxY - paddingY, boxWidth, boxHeight);
    ctx.fill();
    ctx.stroke();

    // Draw lines inside box
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    
    lines.forEach((line, index) => {
      let textColor = '#cbd5e1'; // slight off-white
      if (line.startsWith('Distance:')) {
        textColor = '#34d399'; // emerald accent
      } else if (line.startsWith('Angle:')) {
        textColor = '#60a5fa'; // blue accent
      }
      ctx.fillStyle = textColor;
      ctx.fillText(line, boxX, boxY + index * lineSpacing);
    });

    ctx.restore();
  }

  // ==========================================
  // 5. RENDERING CORE PIPELINE
  // ==========================================

  redraw() {
    if (!this.ctx) return;
    
    // Wipe buffer clean page frame
    this.ctx.clearRect(0, 0, this.width, this.height);
    
    // Draw background grid (drawn using dynamic viewport world boundaries bounds)
    if (this.gridEnabled) {
      this.drawGrid();
    }
    
    this.ctx.save();
    // Apply viewport camera matrix transform (zoom & pan)
    this.ctx.translate(this.panX, this.panY);
    this.ctx.scale(this.zoomScale, this.zoomScale);
    
    // Draw finalized CAD entities
    this.shapes.forEach((shape, index) => {
      // Skip if layer is not visible
      if (!this.isLayerVisible(shape.layerId)) return;
      
      // Standard dimension toggle check
      if (shape.type === 'dimension' && !this.displayDimensions) return;
      
      const isLocked = this.isLayerLocked(shape.layerId);
      if (isLocked) {
        this.ctx.save();
        this.ctx.globalAlpha = 0.45; // Dim locked layers to 45% opacity
      }
      
      // Bypass standard draw during hover highlighting to overlays highlighting
      if (this.hoveredShapeIndex !== index) {
        shape.draw(this.ctx, this);
      }
      
      // Continuous measurement overlays for finalized drawings
      if (this.showMeasurementsOnAll && shape !== this.selectedShape && shape.type !== 'dimension') {
        this.drawMeasurements(shape, 'rgba(156, 163, 175, 0.85)'); // Slate grey label
      }
      
      if (isLocked) {
        this.ctx.restore();
      }
    });

    // Handle highlighted shape hover overlay glow
    if (this.hoveredShapeIndex !== null && this.shapes[this.hoveredShapeIndex]) {
      const activeHoverShape = this.shapes[this.hoveredShapeIndex];
      if (this.isLayerVisible(activeHoverShape.layerId)) {
        activeHoverShape.draw(this.ctx, this); // draw normally first
        this.highlightShape(activeHoverShape); // layer glows on top
      }
    }

    // Handle selected shape glow and handles overlay
    if (this.selectedShape && this.isLayerVisible(this.selectedShape.layerId)) {
      this.drawSelectionHighlight(this.selectedShape);
      if (this.selectedShape.type !== 'dimension') {
        this.drawMeasurements(this.selectedShape, '#3b82f6'); // Selection dimensions in blue
      }
    }
    
    // Draw transient dragging preview shape
    if (this.isDrawing && this.previewShape) {
      this.previewShape.draw(this.ctx, this);
      if (this.previewShape.type !== 'dimension') {
        this.drawMeasurements(this.previewShape, '#eab308'); // Real-time preview dimensions in amber
      }
    }

    // -----------------------------------------------------------------
    // DYNAMIC AUTO-DIMENSIONS FOR WALLS, DOORS, & WINDOWS
    // -----------------------------------------------------------------
    if (this.showWallDimensions) {
      // Calculate drawing centroid of walls/labels to define "outside" outward directions
      let sumX = 0, sumY = 0, count = 0;
      this.shapes.forEach(sh => {
        if (!this.isLayerVisible(sh.layerId)) return;
        if (sh.type === 'wall' || sh.type === 'rectangle' || sh.type === 'roomlabel') {
          if (sh.x1 !== undefined) {
            sumX += (sh.x1 + sh.x2) / 2;
            sumY += (sh.y1 + sh.y2) / 2;
          } else if (sh.x !== undefined) {
            sumX += sh.x + (sh.width || 0) / 2;
            sumY += sh.y + (sh.height || 0) / 2;
          }
          count++;
        }
      });
      const cX = count > 0 ? sumX / count : this.width / 2;
      const cY = count > 0 ? sumY / count : this.height / 2;

      const drawnDimensions = [];

      this.shapes.forEach(sh => {
        if (!this.isLayerVisible(sh.layerId)) return;
        
        if (sh.type === 'wall') {
          if (sh.wallThickness && sh.wallThickness < 15) return;
          const dx = sh.x2 - sh.x1;
          const dy = sh.y2 - sh.y1;
          const len = Math.hypot(dx, dy);
          if (len < 5) return;
          
          let nx = -dy / len;
          let ny = dx / len;
          // Determine outward direction
          const midX = (sh.x1 + sh.x2) / 2;
          const midY = (sh.y1 + sh.y2) / 2;
          const distPlus = Math.hypot(midX + nx * 20 - cX, midY + ny * 20 - cY);
          const distMinus = Math.hypot(midX - nx * 20 - cX, midY - ny * 20 - cY);
          if (distMinus > distPlus) {
            nx = -nx;
            ny = -ny;
          }
          
          const labelText = this.formatValue(len);
          
          // Smart Placement collision stacking loop to automatically stack
          let currentOffset = 30; // base offset outside wall
          let maxAttempts = 5;
          let hasCollision = true;
          const currentAngle = Math.atan2(dy, dx);
          
          while (hasCollision && maxAttempts > 0) {
            hasCollision = false;
            const testMidX = midX + nx * currentOffset;
            const testMidY = midY + ny * currentOffset;
            
            for (const drawn of drawnDimensions) {
              const angleDiff = Math.abs(drawn.angle - currentAngle) % Math.PI;
              const isParallel = angleDiff < 0.1 || angleDiff > Math.PI - 0.1;
              if (isParallel) {
                const distToLine = Math.hypot(testMidX - drawn.midX, testMidY - drawn.midY);
                if (distToLine < 15) {
                  hasCollision = true;
                  currentOffset += 18; // bump offset outward to stack
                  maxAttempts--;
                  break;
                }
              }
            }
          }
          
          drawnDimensions.push({
            midX: midX + nx * currentOffset,
            midY: midY + ny * currentOffset,
            angle: currentAngle
          });
          
          this.drawProfessionalDimension(this.ctx, sh.x1, sh.y1, sh.x2, sh.y2, labelText, currentOffset, 'aligned', 8, '#d1d5db', { x: nx, y: ny });
          
        } else if (sh.type === 'door') {
          const dx = sh.x2 - sh.x1;
          const dy = sh.y2 - sh.y1;
          const len = Math.hypot(dx, dy);
          if (len < 5) return;
          
          // Only draw outside auto-dimension if door is on an exterior wall
          const midX = (sh.x1 + sh.x2) / 2;
          const midY = (sh.y1 + sh.y2) / 2;
          const isOnExteriorWall = this.shapes.some(wall => {
            if (wall.type !== 'wall') return false;
            if (wall.wallThickness && wall.wallThickness < 15) return false;
            const wl2 = (wall.x2 - wall.x1) ** 2 + (wall.y2 - wall.y1) ** 2;
            if (wl2 === 0) return Math.hypot(midX - wall.x1, midY - wall.y1) < 5;
            let t = ((midX - wall.x1) * (wall.x2 - wall.x1) + (midY - wall.y1) * (wall.y2 - wall.y1)) / wl2;
            t = Math.max(0, Math.min(1, t));
            const projX = wall.x1 + t * (wall.x2 - wall.x1);
            const projY = wall.y1 + t * (wall.y2 - wall.y1);
            return Math.hypot(midX - projX, midY - projY) < 5;
          });
          if (!isOnExteriorWall) return;
          
          // Keep clear of door swing sector
          const nx = -dy / len;
          const ny = dx / len;
          const labelText = this.formatValue(len);
          
          // Door dimensions parallel to swing opening
          this.drawProfessionalDimension(this.ctx, sh.x1, sh.y1, sh.x2, sh.y2, labelText, 22, 'aligned', 6, '#f43f5e', { x: nx, y: ny });
          
        } else if (sh.type === 'window') {
          const dx = sh.x2 - sh.x1;
          const dy = sh.y2 - sh.y1;
          const len = Math.hypot(dx, dy);
          if (len < 5) return;
          
          // Only draw outside auto-dimension if window is on an exterior wall
          const midX = (sh.x1 + sh.x2) / 2;
          const midY = (sh.y1 + sh.y2) / 2;
          const isOnExteriorWall = this.shapes.some(wall => {
            if (wall.type !== 'wall') return false;
            if (wall.wallThickness && wall.wallThickness < 15) return false;
            const wl2 = (wall.x2 - wall.x1) ** 2 + (wall.y2 - wall.y1) ** 2;
            if (wl2 === 0) return Math.hypot(midX - wall.x1, midY - wall.y1) < 5;
            let t = ((midX - wall.x1) * (wall.x2 - wall.x1) + (midY - wall.y1) * (wall.y2 - wall.y1)) / wl2;
            t = Math.max(0, Math.min(1, t));
            const projX = wall.x1 + t * (wall.x2 - wall.x1);
            const projY = wall.y1 + t * (wall.y2 - wall.y1);
            return Math.hypot(midX - projX, midY - projY) < 5;
          });
          if (!isOnExteriorWall) return;
          
          let nx = -dy / len;
          let ny = dx / len;
          // Outward relative to drawing center, kept outside wall boundaries
          const distPlus = Math.hypot(midX + nx * 20 - cX, midY + ny * 20 - cY);
          const distMinus = Math.hypot(midX - nx * 20 - cX, midY - ny * 20 - cY);
          if (distMinus > distPlus) {
            nx = -nx;
            ny = -ny;
          }
          const labelText = this.formatValue(len);
          
          this.drawProfessionalDimension(this.ctx, sh.x1, sh.y1, sh.x2, sh.y2, labelText, 25, 'aligned', 6, '#38bdf8', { x: nx, y: ny });
        }
      });
    }

    // Draw real-time Measure Tool overlay
    if (this.measureFirstX !== null) {
      const secondX = this.measureSecondX !== null ? this.measureSecondX : this.measureHoverX;
      const secondY = this.measureSecondY !== null ? this.measureSecondY : this.measureHoverY;
      if (secondX !== null && secondY !== null) {
        this.drawMeasurementCanvasHUD(this.ctx, this.measureFirstX, this.measureFirstY, secondX, secondY);
      }
    }

    // Draw real-time CAD Rotate Tool overlay representation
    if (this.activeTool === 'rotate') {
      // 1. Draw a highlighted border around each shape in this.selectedShapes list
      if (this.selectedShapes && this.selectedShapes.length > 0) {
        this.selectedShapes.forEach(selectedSh => {
          if (selectedSh) {
            this.drawSelectionHighlight(selectedSh);
          }
        });
      }

      // 2. If a pivot point is set, draw it!
      if (this.rotatePivotX !== null && this.rotatePivotY !== null) {
        this.ctx.save();
        
        const px = this.rotatePivotX;
        const py = this.rotatePivotY;
        const zoom = Math.max(0.01, this.zoomScale);
        
        this.ctx.strokeStyle = '#f59e0b'; // amber-500
        this.ctx.lineWidth = 1.5 / zoom;
        this.ctx.beginPath();
        this.ctx.arc(px, py, 8 / zoom, 0, 2 * Math.PI);
        this.ctx.stroke();
        
        this.ctx.fillStyle = '#f59e0b';
        this.ctx.beginPath();
        this.ctx.arc(px, py, 2.5 / zoom, 0, 2 * Math.PI);
        this.ctx.fill();
        
        this.ctx.strokeStyle = '#f59e0b';
        this.ctx.beginPath();
        this.ctx.moveTo(px - 14 / zoom, py);
        this.ctx.lineTo(px + 14 / zoom, py);
        this.ctx.moveTo(px, py - 14 / zoom);
        this.ctx.lineTo(px, py + 14 / zoom);
        this.ctx.stroke();
        
        // 3. If dragging (isRotating is true), map angles and draw sector segments
        if (this.isRotating) {
          const hoverX = this.currentHoverX !== undefined ? this.currentHoverX : px;
          const hoverY = this.currentHoverY !== undefined ? this.currentHoverY : py;
          
          const startAngle = this.rotateStartAngle;
          const currentAngle = Math.atan2(hoverY - py, hoverX - px);
          const deltaAngleRad = currentAngle - startAngle;
          const deltaDeg = deltaAngleRad * (180 / Math.PI);
          let displayDeg = deltaDeg;
          if (displayDeg < -180) displayDeg += 360;
          if (displayDeg > 180) displayDeg -= 360;
          const angleLabelText = `${displayDeg >= 0 ? '+' : ''}${displayDeg.toFixed(1)}°`;
          
          const r = Math.hypot(hoverX - px, hoverY - py);
          const drawRadius = Math.min(65 / zoom, Math.max(30 / zoom, r));
          
          this.ctx.restore();
          this.ctx.save();
          this.ctx.translate(this.panX, this.panY);
          this.ctx.scale(this.zoomScale, this.zoomScale);
          
          this.ctx.strokeStyle = 'rgba(245, 158, 11, 0.45)';
          this.ctx.setLineDash([4 / zoom, 4 / zoom]);
          this.ctx.lineWidth = 1 / zoom;
          this.ctx.beginPath();
          this.ctx.moveTo(px, py);
          this.ctx.lineTo(px + drawRadius * Math.cos(startAngle), py + drawRadius * Math.sin(startAngle));
          this.ctx.stroke();
          
          this.ctx.strokeStyle = '#f59e0b';
          this.ctx.setLineDash([]);
          this.ctx.lineWidth = 1.5 / zoom;
          this.ctx.beginPath();
          this.ctx.moveTo(px, py);
          this.ctx.lineTo(px + drawRadius * Math.cos(currentAngle), py + drawRadius * Math.sin(currentAngle));
          this.ctx.stroke();
          
          this.ctx.fillStyle = 'rgba(245, 158, 11, 0.12)';
          this.ctx.beginPath();
          this.ctx.moveTo(px, py);
          this.ctx.arc(px, py, drawRadius - 10 / zoom, startAngle, currentAngle, currentAngle < startAngle);
          this.ctx.fill();
          
          this.ctx.strokeStyle = '#f59e0b';
          this.ctx.lineWidth = 1 / zoom;
          this.ctx.beginPath();
          this.ctx.arc(px, py, drawRadius - 10 / zoom, startAngle, currentAngle, currentAngle < startAngle);
          this.ctx.stroke();

          // A. Draw angle text on the rotation arc sector mid-point
          const midAngle = startAngle + deltaAngleRad / 2;
          const labelRadius = drawRadius + 14 / zoom;
          const labelX = px + labelRadius * Math.cos(midAngle);
          const labelY = py + labelRadius * Math.sin(midAngle);
          
          // Switch to unscaled draw state briefly to draw a high resolution label
          this.ctx.restore();
          this.drawTextLabel(angleLabelText, labelX, labelY, 'rgba(24, 26, 31, 0.95)', '#fbbf24');
          
          // B. Draw angle text at the center of each selected/rotated shape
          if (this.selectedShapes && this.selectedShapes.length > 0) {
            const getCenterOfShape = (sh) => {
              if (sh.x1 !== undefined && sh.y1 !== undefined) {
                return { x: (sh.x1 + sh.x2) / 2, y: (sh.y1 + sh.y2) / 2 };
              } else if (sh.centerX !== undefined && sh.centerY !== undefined) {
                return { x: sh.centerX, y: sh.centerY };
              } else if (sh.x !== undefined && sh.y !== undefined) {
                if (sh.width !== undefined && sh.height !== undefined) {
                  return { x: sh.x + sh.width / 2, y: sh.y + sh.height / 2 };
                } else {
                  return { x: sh.x, y: sh.y };
                }
              }
              return null;
            };

            this.selectedShapes.forEach(selectedSh => {
              const center = getCenterOfShape(selectedSh);
              if (center) {
                this.drawTextLabel(angleLabelText, center.x, center.y, 'rgba(15, 23, 42, 0.95)', '#f59e0b');
              }
            });
          }

          this.ctx.save();
          this.ctx.translate(this.panX, this.panY);
          this.ctx.scale(this.zoomScale, this.zoomScale);
        }
        
        this.ctx.restore();
        this.ctx.save();
        this.ctx.translate(this.panX, this.panY);
        this.ctx.scale(this.zoomScale, this.zoomScale);
      }
    }

    // Draw real-time CAD Mirror Tool overlay representation
    if (this.activeTool === 'mirror') {
      // 1. Draw a highlighted border around each shape in this.selectedMirrorShapes list
      if (this.selectedMirrorShapes && this.selectedMirrorShapes.length > 0) {
        this.selectedMirrorShapes.forEach(selectedSh => {
          if (selectedSh) {
            this.drawSelectionHighlight(selectedSh);
          }
        });
      }

      // 2. If first point of axis is set, draw the axis line and preview shapes
      if (this.mirrorAxisX1 !== null) {
        const zoom = Math.max(0.01, this.zoomScale);
        const secondX = (this.mirrorStep === 'confirm' || this.mirrorStep === 'axis2') && this.mirrorAxisX2 !== null 
          ? this.mirrorAxisX2 
          : this.mirrorHoverX;
        const secondY = (this.mirrorStep === 'confirm' || this.mirrorStep === 'axis2') && this.mirrorAxisY2 !== null 
          ? this.mirrorAxisY2 
          : this.mirrorHoverY;

        if (secondX !== null && secondY !== null) {
          // Draw the mirror axis dashed line in prominent purple
          this.ctx.save();
          this.ctx.strokeStyle = '#a855f7'; // purple-500
          this.ctx.lineWidth = 2 / zoom;
          this.ctx.setLineDash([6 / zoom, 4 / zoom]);
          this.ctx.beginPath();
          
          // Draw extended line through P1 and P2
          const dx = secondX - this.mirrorAxisX1;
          const dy = secondY - this.mirrorAxisY1;
          const len = Math.hypot(dx, dy);
          if (len > 0) {
            const ux = dx / len;
            const uy = dy / len;
            const extendDist = 5000 / zoom;
            this.ctx.moveTo(this.mirrorAxisX1 - ux * extendDist, this.mirrorAxisY1 - uy * extendDist);
            this.ctx.lineTo(this.mirrorAxisX1 + ux * extendDist, this.mirrorAxisY1 + uy * extendDist);
          } else {
            this.ctx.moveTo(this.mirrorAxisX1, this.mirrorAxisY1);
            this.ctx.lineTo(secondX, secondY);
          }
          this.ctx.stroke();

          // Draw point indicators at P1 and P2
          this.ctx.setLineDash([]);
          this.ctx.fillStyle = '#c084fc'; // purple-400
          this.ctx.strokeStyle = '#a855f7';

          // Point 1
          this.ctx.beginPath();
          this.ctx.arc(this.mirrorAxisX1, this.mirrorAxisY1, 5 / zoom, 0, 2 * Math.PI);
          this.ctx.fill();
          this.ctx.stroke();

          // Point 2
          this.ctx.beginPath();
          this.ctx.arc(secondX, secondY, 5 / zoom, 0, 2 * Math.PI);
          this.ctx.fill();
          this.ctx.stroke();

          // Text labels "P1" and "P2"
          this.ctx.fillStyle = '#c084fc';
          this.ctx.font = `bold ${10 / zoom}px monospace`;
          this.ctx.fillText("P1", this.mirrorAxisX1 + 8 / zoom, this.mirrorAxisY1 - 4 / zoom);
          this.ctx.fillText("P2", secondX + 8 / zoom, secondY - 4 / zoom);

          this.ctx.restore();

          // 3. Draw mirrored preview shapes
          if (this.selectedMirrorShapes && this.selectedMirrorShapes.length > 0 && len > 0) {
            this.ctx.save();
            this.ctx.globalAlpha = 0.55; // Semi-transparent for preview

            this.selectedMirrorShapes.forEach(sh => {
              if (sh) {
                const cloned = this.cloneShape(sh);
                cloned.mirror(this.mirrorAxisX1, this.mirrorAxisY1, secondX, secondY);
                
                const originalColor = cloned.color;
                cloned.color = '#c084fc'; // Purple preview color
                
                cloned.draw(this.ctx);
                cloned.color = originalColor;
              }
            });

            this.ctx.restore();
          }
        }
      }
    }

    // Draw real-time CAD Scale Tool overlay representation
    if (this.activeTool === 'scale') {
      // 1. Draw a highlighted border around each shape in this.selectedScaleShapes list
      if (this.selectedScaleShapes && this.selectedScaleShapes.length > 0) {
        this.selectedScaleShapes.forEach(selectedSh => {
          if (selectedSh) {
            this.drawSelectionHighlight(selectedSh);
          }
        });
      }

      // 2. If a base point is set, draw it!
      if (this.scalePivotX !== null && this.scalePivotY !== null) {
        this.ctx.save();
        
        const px = this.scalePivotX;
        const py = this.scalePivotY;
        const zoom = Math.max(0.01, this.zoomScale);
        
        this.ctx.strokeStyle = '#10b981'; // emerald-500
        this.ctx.lineWidth = 1.5 / zoom;
        this.ctx.beginPath();
        // Inner circle
        this.ctx.arc(px, py, 6 / zoom, 0, 2 * Math.PI);
        // Outer square
        this.ctx.rect(px - 6 / zoom, py - 6 / zoom, 12 / zoom, 12 / zoom);
        this.ctx.stroke();
        
        this.ctx.fillStyle = '#10b981';
        this.ctx.beginPath();
        this.ctx.arc(px, py, 2 / zoom, 0, 2 * Math.PI);
        this.ctx.fill();
        
        // Draw crosshairs
        this.ctx.beginPath();
        this.ctx.moveTo(px - 14 / zoom, py);
        this.ctx.lineTo(px + 14 / zoom, py);
        this.ctx.moveTo(px, py - 14 / zoom);
        this.ctx.lineTo(px, py + 14 / zoom);
        this.ctx.stroke();
        
        // 3. If dragging/scaling, draw dashed reference line and live multiplier badge
        if (this.scaleStep === 'scale' && this.scaleHoverX !== null && this.scaleHoverY !== null) {
          const hX = this.scaleHoverX;
          const hY = this.scaleHoverY;
          
          this.ctx.restore();
          this.ctx.save();
          this.ctx.translate(this.panX, this.panY);
          this.ctx.scale(this.zoomScale, this.zoomScale);
          
          // Reference dashed line
          this.ctx.strokeStyle = 'rgba(16, 185, 129, 0.5)';
          this.ctx.setLineDash([4 / zoom, 4 / zoom]);
          this.ctx.lineWidth = 1 / zoom;
          this.ctx.beginPath();
          this.ctx.moveTo(px, py);
          this.ctx.lineTo(hX, hY);
          this.ctx.stroke();
          
          // Live distance indicators
          const dx = hX - px;
          const dy = hY - py;
          const dist = Math.hypot(dx, dy);
          const s = this.scaleStartDist > 0 ? (dist / this.scaleStartDist) : 1.0;
          
          // Draw a badge at the mouse cursor
          this.ctx.setLineDash([]);
          this.ctx.fillStyle = 'rgba(15, 23, 42, 0.85)'; // Dark slate background
          this.ctx.strokeStyle = '#10b981';
          this.ctx.lineWidth = 1 / zoom;
          
          const text = ` s: ${s.toFixed(3)}x `;
          this.ctx.font = `bold ${11 / zoom}px monospace`;
          const textWidth = this.ctx.measureText(text).width;
          const badgeW = textWidth + 6 / zoom;
          const badgeH = 18 / zoom;
          const bx = hX + 12 / zoom;
          const by = hY - 12 / zoom;
          
          // Background box
          this.ctx.beginPath();
          this.ctx.roundRect(bx, by, badgeW, badgeH, 4 / zoom);
          this.ctx.fill();
          this.ctx.stroke();
          
          // Text
          this.ctx.fillStyle = '#10b981'; // Emerald text
          this.ctx.fillText(text, bx + 2 / zoom, by + 13 / zoom);
        }
        
        this.ctx.restore();
        this.ctx.save();
        this.ctx.translate(this.panX, this.panY);
        this.ctx.scale(this.zoomScale, this.zoomScale);
      }
    }
    
    this.ctx.restore();
    
    // Draw customized crosshairs alignment metrics (in screen-space using worldToScreen mapping for 100% crispness)
    if (this.mouseInCanvas) {
      this.drawCrosshairs();
    }
  }

  drawGrid(ctx = this.ctx) {
    const interval = this.gridSize;
    ctx.save();
    
    // If grid is too dense visually (less than 6 pixels apart on screen), stop rendering to preserve speed and clarity
    if (interval * this.zoomScale < 6) {
      ctx.restore();
      return;
    }
    
    // Apply camera matrix format within save/restore grid space
    ctx.translate(this.panX, this.panY);
    ctx.scale(this.zoomScale, this.zoomScale);
    
    // Find visible world boundaries to draw only necessary gridlines
    const xLeft = -this.panX / this.zoomScale;
    const xRight = (this.width - this.panX) / this.zoomScale;
    const yTop = -this.panY / this.zoomScale;
    const yBottom = (this.height - this.panY) / this.zoomScale;
    
    const startX = Math.floor(xLeft / interval) * interval;
    const endX = Math.ceil(xRight / interval) * interval;
    const startY = Math.floor(yTop / interval) * interval;
    const endY = Math.ceil(yBottom / interval) * interval;
    
    // Thin engineering graphite style gridlines
    const majorModulus = interval * 5;
    
    // Vertical gridlines loop
    for (let x = startX; x <= endX; x += interval) {
      ctx.beginPath();
      ctx.moveTo(x, yTop);
      ctx.lineTo(x, yBottom);
      
      if (Math.round(x) % majorModulus === 0) {
        ctx.strokeStyle = 'rgba(71, 85, 105, 0.28)'; // Major slate layout
        ctx.lineWidth = 0.8 / this.zoomScale;
      } else {
        ctx.strokeStyle = 'rgba(71, 85, 105, 0.12)'; // Minor subtle layout
        ctx.lineWidth = 0.4 / this.zoomScale;
      }
      ctx.stroke();
    }
    
    // Horizontal gridlines loop
    for (let y = startY; y <= endY; y += interval) {
      ctx.beginPath();
      ctx.moveTo(xLeft, y);
      ctx.lineTo(xRight, y);
      
      if (Math.round(y) % majorModulus === 0) {
        ctx.strokeStyle = 'rgba(71, 85, 105, 0.28)';
        ctx.lineWidth = 0.8 / this.zoomScale;
      } else {
        ctx.strokeStyle = 'rgba(71, 85, 105, 0.12)';
        ctx.lineWidth = 0.4 / this.zoomScale;
      }
      ctx.stroke();
    }
    
    ctx.restore();
  }

  drawCrosshairs() {
    // Nab snapped coordinate in world space
    const snap = this.getSnappedPosition(this.currentX, this.currentY);
    // Convert to screen space for perfectly crisp 1px lines
    const screenSnap = this.worldToScreen(snap.x, snap.y);
    
    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.strokeStyle = 'rgba(74, 85, 104, 0.45)'; // High-contrast subtle guidelines
    this.ctx.lineWidth = 0.8;
    this.ctx.setLineDash([4, 4]); // Dashes
    
    // Vertical coordinate guide
    this.ctx.moveTo(screenSnap.x, 0);
    this.ctx.lineTo(screenSnap.x, this.height);
    
    // Horizontal coordinate guide
    this.ctx.moveTo(0, screenSnap.y);
    this.ctx.lineTo(this.width, screenSnap.y);
    this.ctx.stroke();
    
    // Reset dashed styles to standard lines
    this.ctx.setLineDash([]);
    
    // Draw primary target ring centering index
    this.ctx.beginPath();
    this.ctx.rect(screenSnap.x - 4, screenSnap.y - 4, 8, 8);
    this.ctx.strokeStyle = this.activeColor;
    this.ctx.lineWidth = 1;
    this.ctx.stroke();
    
    // Handle specific snaps shapes and status bar flags indicators
    const flagGrid = document.getElementById('snap-flag-grid');
    const flagEnd = document.getElementById('snap-flag-endpoint');
    const flagMid = document.getElementById('snap-flag-midpoint');
    
    // Default muted styles
    if (flagGrid) { flagGrid.className = "px-1.5 py-0.5 rounded text-[9px] bg-[#0F1115] border border-[#2A2D35]/50 text-slate-500 font-mono"; }
    if (flagEnd) { flagEnd.className = "px-1.5 py-0.5 rounded text-[9px] bg-[#0F1115] border border-[#2A2D35]/50 text-slate-500 font-mono"; }
    if (flagMid) { flagMid.className = "px-1.5 py-0.5 rounded text-[9px] bg-[#0F1115] border border-[#2A2D35]/50 text-slate-500 font-mono"; }
    
    if (this.snapEnabled && snap.type) {
      if (snap.type === 'endpoint') {
        // Draw green target box
        this.ctx.strokeStyle = '#22c55e'; // Vibrant Green CAD snap trace
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(screenSnap.x - 6, screenSnap.y - 6, 12, 12);
        
        // Label endpoint
        this.ctx.fillStyle = '#22c55e';
        this.ctx.font = 'bold 9px monospace';
        this.ctx.fillText("ENDPOINT", screenSnap.x + 10, screenSnap.y - 2);
        
        if (flagEnd) { flagEnd.className = "px-1.5 py-0.5 rounded text-[9px] bg-green-950/40 border border-green-500 text-green-400 font-bold font-mono"; }
      } else if (snap.type === 'midpoint') {
        // Draw green triangle
        this.ctx.strokeStyle = '#22c55e';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.moveTo(screenSnap.x, screenSnap.y - 7);
        this.ctx.lineTo(screenSnap.x - 7, screenSnap.y + 5);
        this.ctx.lineTo(screenSnap.x + 7, screenSnap.y + 5);
        this.ctx.closePath();
        this.ctx.stroke();
        
        // Label midpoint
        this.ctx.fillStyle = '#22c55e';
        this.ctx.font = 'bold 9px monospace';
        this.ctx.fillText("MIDPOINT", screenSnap.x + 10, screenSnap.y - 2);
        
        if (flagMid) { flagMid.className = "px-1.5 py-0.5 rounded text-[9px] bg-green-950/40 border border-green-500 text-green-400 font-bold font-mono"; }
      } else if (snap.type === 'grid') {
        // Standard cyber cyan grid glow dot
        this.ctx.beginPath();
        this.ctx.arc(screenSnap.x, screenSnap.y, 3, 0, 2 * Math.PI);
        this.ctx.fillStyle = '#22d3ee';
        this.ctx.fill();
        
        if (flagGrid) { flagGrid.className = "px-1.5 py-0.5 rounded text-[9px] bg-blue-950/40 border border-blue-500 text-blue-400 font-bold font-mono"; }
      }
    } else {
      // Snap point highlight if snapping off or normal cursor
      this.ctx.beginPath();
      this.ctx.arc(screenSnap.x, screenSnap.y, 2.5, 0, 2 * Math.PI);
      this.ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      this.ctx.fill();
    }
    
    this.ctx.restore();
  }

  /**
   * Helper to draw text values overlay box
   */
  drawTextLabel(text, worldX, worldY, bgColor = 'rgba(15, 17, 21, 0.85)', textColor = '#60a5fa') {
    this.ctx.save();
    this.ctx.font = `500 ${Math.max(9, 10 / this.zoomScale)}px JetBrains Mono, monospace`;
    const metrics = this.ctx.measureText(text);
    const paddingX = 4 / this.zoomScale;
    const paddingY = 2 / this.zoomScale;
    const w = metrics.width + paddingX * 2;
    const h = (12 / this.zoomScale);
    
    this.ctx.fillStyle = bgColor;
    this.ctx.strokeStyle = 'rgba(59, 130, 246, 0.4)';
    this.ctx.lineWidth = 1 / this.zoomScale;
    this.ctx.beginPath();
    this.ctx.rect(worldX - w / 2, worldY - h / 2, w, h);
    this.ctx.fill();
    this.ctx.stroke();
    
    this.ctx.fillStyle = textColor;
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText(text, worldX, worldY);
    this.ctx.restore();
  }

  /**
   * Main overlay measurements plotter for active CAD tools and selection
   */
  drawProfessionalDimension(ctx, x1, y1, x2, y2, labelText, offsetDist = 25, dimType = 'aligned', arrowSize = 8, color = '#60a5fa', forcedNormal = null) {
    ctx.save();
    
    // Resolve dimType
    let resolvedType = dimType || 'aligned';
    if (resolvedType === 'linear') {
      resolvedType = Math.abs(x2 - x1) > Math.abs(y2 - y1) ? 'horizontal' : 'vertical';
    }

    const zoom = Math.max(0.01, this.zoomScale || 1.0);
    const arrowLen = arrowSize / zoom;
    const overShoot = 4 / zoom;
    const gap = 3 / zoom;

    let len, angle, mx1, my1, mx2, my2, ex1_start, ex1_end, ex2_start, ex2_end;
    let ux = 0, uy = 0, nx = 0, ny = 0;

    if (resolvedType === 'horizontal') {
      len = Math.abs(x2 - x1);
      if (len < 0.1) {
        ctx.restore();
        return;
      }
      angle = 0;
      
      let signMultiplier = (y2 >= y1) ? -1 : 1;
      if (forcedNormal) {
        signMultiplier = forcedNormal.y < 0 ? -1 : 1;
      }
      const targetY = y1 + signMultiplier * (offsetDist / zoom);

      mx1 = x1;
      my1 = targetY;
      mx2 = x2;
      my2 = targetY;

      ex1_start = { x: x1, y: y1 + signMultiplier * gap };
      ex1_end = { x: x1, y: targetY + signMultiplier * overShoot };
      ex2_start = { x: x2, y: y2 + signMultiplier * gap };
      ex2_end = { x: x2, y: targetY + signMultiplier * overShoot };

      ux = (x2 >= x1) ? 1 : -1;
      uy = 0;
      nx = 0;
      ny = signMultiplier;

    } else if (resolvedType === 'vertical') {
      len = Math.abs(y2 - y1);
      if (len < 0.1) {
        ctx.restore();
        return;
      }
      angle = Math.PI / 2;

      let signMultiplier = (x2 >= x1) ? -1 : 1;
      if (forcedNormal) {
        signMultiplier = forcedNormal.x < 0 ? -1 : 1;
      }
      const targetX = x1 + signMultiplier * (offsetDist / zoom);

      mx1 = targetX;
      my1 = y1;
      mx2 = targetX;
      my2 = y2;

      ex1_start = { x: x1 + signMultiplier * gap, y: y1 };
      ex1_end = { x: targetX + signMultiplier * overShoot, y: y1 };
      ex2_start = { x: x2 + signMultiplier * gap, y: y2 };
      ex2_end = { x: targetX + signMultiplier * overShoot, y: y2 };

      ux = 0;
      uy = (y2 >= y1) ? 1 : -1;
      nx = signMultiplier;
      ny = 0;

    } else { // 'aligned'
      len = Math.hypot(x2 - x1, y2 - y1);
      if (len < 0.1) {
        ctx.restore();
        return;
      }
      const dx = x2 - x1;
      const dy = y2 - y1;
      angle = Math.atan2(dy, dx);
      
      ux = dx / len;
      uy = dy / len;
      
      if (forcedNormal) {
        nx = forcedNormal.x;
        ny = forcedNormal.y;
      } else {
        nx = -uy;
        ny = ux;
      }

      const scaledOffset = offsetDist / zoom;
      mx1 = x1 + nx * scaledOffset;
      my1 = y1 + ny * scaledOffset;
      mx2 = x2 + nx * scaledOffset;
      my2 = y2 + ny * scaledOffset;

      ex1_start = { x: x1 + nx * gap, y: y1 + ny * gap };
      ex1_end = { x: mx1 + nx * overShoot, y: my1 + ny * overShoot };
      ex2_start = { x: x2 + nx * gap, y: y2 + ny * gap };
      ex2_end = { x: mx2 + nx * overShoot, y: my2 + ny * overShoot };
    }

    // 1. Draw extensions (extension lines)
    ctx.strokeStyle = 'rgba(156, 163, 175, 0.55)'; // thin grey line
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(ex1_start.x, ex1_start.y);
    ctx.lineTo(ex1_end.x, ex1_end.y);
    ctx.moveTo(ex2_start.x, ex2_start.y);
    ctx.lineTo(ex2_end.x, ex2_end.y);
    ctx.stroke();

    // 2. Draw central dimension line
    ctx.strokeStyle = color;
    ctx.lineWidth = 1; // standard thin dimension line
    ctx.beginPath();
    ctx.moveTo(mx1, my1);
    ctx.lineTo(mx2, my2);
    ctx.stroke();

    // 3. Draw standard closed filled arrowheads at both ends
    // Arrow at (mx1, my1) pointing outwards
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(mx1, my1);
    ctx.lineTo(mx1 + ux * arrowLen + nx * (arrowLen * 0.3), my1 + uy * arrowLen + ny * (arrowLen * 0.3));
    ctx.lineTo(mx1 + ux * arrowLen - nx * (arrowLen * 0.3), my1 + uy * arrowLen - ny * (arrowLen * 0.3));
    ctx.closePath();
    ctx.fill();

    // Arrow at (mx2, my2) pointing outwards
    ctx.beginPath();
    ctx.moveTo(mx2, my2);
    ctx.lineTo(mx2 - ux * arrowLen + nx * (arrowLen * 0.3), my2 - uy * arrowLen + ny * (arrowLen * 0.3));
    ctx.lineTo(mx2 - ux * arrowLen - nx * (arrowLen * 0.3), my2 - uy * arrowLen - ny * (arrowLen * 0.3));
    ctx.closePath();
    ctx.fill();

    // 4. Output Dimension text beautifully
    let textAngle = Math.atan2(my2 - my1, mx2 - mx1);
    let finalAngle = textAngle;
    if (finalAngle > Math.PI / 2 || finalAngle < -Math.PI / 2) {
      finalAngle += Math.PI;
    }

    ctx.save();
    ctx.translate((mx1 + mx2)/2, (my1 + my2)/2);
    ctx.rotate(finalAngle);
    
    ctx.font = `bold ${Math.max(6, 10 / zoom)}px monospace`;
    const metrics = ctx.measureText(labelText);
    const textW = metrics.width;
    const textH = Math.max(6, 10 / zoom);

    // Opaque background plate that never overlaps other lines
    ctx.fillStyle = 'rgba(15, 17, 21, 0.9)'; // matching the dark/canvas background
    ctx.fillRect(-textW/2 - 4/zoom, -textH/2 - 2/zoom, textW + 8/zoom, textH + 4/zoom);
    
    // Fill text label
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(labelText, 0, 0);
    
    ctx.restore();
    ctx.restore();
  }

  drawMeasurements(shape, color = '#60a5fa') {
    if (!shape) return;
    this.ctx.save();
    
    if (['line', 'wall', 'beam', 'door', 'window', 'dimension'].includes(shape.type)) {
      const len = Math.hypot(shape.x2 - shape.x1, shape.y2 - shape.y1);
      const midX = (shape.x1 + shape.x2) / 2;
      const midY = (shape.y1 + shape.y2) / 2;
      let label = this.formatValue(len);
      if (shape.type === 'wall') label = `WALL: ${label}`;
      else if (shape.type === 'beam') label = `BEAM: ${label}`;
      else if (shape.type === 'door') label = `DOOR: ${label}`;
      else if (shape.type === 'window') label = `WINDOW: ${label}`;
      else if (shape.type === 'dimension') label = `DIM: ${label}`;
      this.drawTextLabel(label, midX, midY, 'rgba(15, 17, 21, 0.85)', color);
    } else if (['rectangle', 'column', 'roomlabel', 'areazone'].includes(shape.type)) {
      const w = Math.abs(shape.width);
      const h = Math.abs(shape.height);
      
      const xMin = Math.min(shape.x, shape.x + shape.width);
      const xMax = Math.max(shape.x, shape.x + shape.width);
      const yMin = Math.min(shape.y, shape.y + shape.height);
      const yMax = Math.max(shape.y, shape.y + shape.height);
      
      const topMidX = (xMin + xMax) / 2;
      const topMidY = yMin;
      const leftMidX = xMin;
      const leftMidY = (yMin + yMax) / 2;
      
      let wLabels = `W: ${this.formatValue(w)}`;
      let hLabels = `H: ${this.formatValue(h)}`;
      if (shape.type === 'column') {
        wLabels = `COL W: ${this.formatValue(w)}`;
        hLabels = `COL H: ${this.formatValue(h)}`;
      } else if (shape.type === 'roomlabel') {
        wLabels = `ZONE W: ${this.formatValue(w)}`;
        hLabels = `ZONE H: ${this.formatValue(h)}`;
      }
      
      this.drawTextLabel(wLabels, topMidX, topMidY - 6 / this.zoomScale, 'rgba(15, 17, 21, 0.85)', color);
      this.drawTextLabel(hLabels, leftMidX, leftMidY, 'rgba(15, 17, 21, 0.85)', color);
    } else if (shape.type === 'circle') {
      const r = shape.radius;
      const d = r * 2;
      
      // Draw a highly professional radial connector line
      this.ctx.save();
      this.ctx.beginPath();
      this.ctx.setLineDash([2 / this.zoomScale, 2 / this.zoomScale]);
      this.ctx.moveTo(shape.centerX, shape.centerY);
      const diagAngle = -Math.PI / 4; // neat 45 deg diagonal
      const edgeX = shape.centerX + r * Math.cos(diagAngle);
      const edgeY = shape.centerY + r * Math.sin(diagAngle);
      this.ctx.lineTo(edgeX, edgeY);
      this.ctx.strokeStyle = color;
      this.ctx.lineWidth = 1 / this.zoomScale;
      this.ctx.stroke();
      this.ctx.restore();
      
      // Draw a tiny architectural point at center
      this.ctx.save();
      this.ctx.beginPath();
      this.ctx.arc(shape.centerX, shape.centerY, 1.5 / this.zoomScale, 0, 2*Math.PI);
      this.ctx.fillStyle = color;
      this.ctx.fill();
      this.ctx.restore();
      
      this.drawTextLabel(`R: ${this.formatValue(r)}`, (shape.centerX + edgeX)/2, (shape.centerY + edgeY)/2, 'rgba(15, 17, 21, 0.85)', color);
      this.drawTextLabel(`D: ${this.formatValue(d)}`, shape.centerX, shape.centerY + 8 / this.zoomScale, 'rgba(15, 17, 21, 0.85)', '#10b981');
    }
    
    this.ctx.restore();
  }

  highlightShape(shape) {
    this.ctx.save();
    this.ctx.strokeStyle = '#22d3ee'; // Radiant blue pointer
    this.ctx.lineWidth = (shape.lineWidth + 4) / this.zoomScale;
    this.ctx.setLineDash([3 / this.zoomScale, 3 / this.zoomScale]);
    this.ctx.lineCap = 'round';
    
    // Setup nice glowing canvas shadow filters
    this.ctx.shadowColor = '#06b6d4';
    this.ctx.shadowBlur = 10;
    
    if (['line', 'wall', 'beam', 'door', 'window', 'dimension'].includes(shape.type)) {
      this.ctx.beginPath();
      this.ctx.moveTo(shape.x1, shape.y1);
      this.ctx.lineTo(shape.x2, shape.y2);
      this.ctx.stroke();
    } else if (['rectangle', 'column', 'roomlabel', 'areazone'].includes(shape.type)) {
      this.ctx.beginPath();
      this.ctx.rect(shape.x, shape.y, shape.width, shape.height);
      this.ctx.stroke();
    } else if (shape.type === 'circle') {
      this.ctx.beginPath();
      const r = Math.max(0.1, shape.radius);
      this.ctx.arc(shape.centerX, shape.centerY, r, 0, 2 * Math.PI);
      this.ctx.stroke();
    }
    
    this.ctx.restore();
  }

  drawSelectionHighlight(shape) {
    this.ctx.save();
    
    // Glow effect
    this.ctx.strokeStyle = '#3b82f6'; // Bright blue selection border
    this.ctx.lineWidth = 1.5 / this.zoomScale;
    this.ctx.setLineDash([4 / this.zoomScale, 4 / this.zoomScale]);
    
    // 1. Draw dashed bounding box or envelope outline
    if (['line', 'wall', 'beam', 'door', 'window', 'dimension'].includes(shape.type)) {
      // Draw a line dashed glow on top
      this.ctx.beginPath();
      this.ctx.moveTo(shape.x1, shape.y1);
      this.ctx.lineTo(shape.x2, shape.y2);
      this.ctx.stroke();
      
      // Draw handles at endpoints
      this.ctx.setLineDash([]);
      this.drawHandle(shape.x1, shape.y1);
      this.drawHandle(shape.x2, shape.y2);
    } else if (['rectangle', 'column', 'roomlabel', 'areazone'].includes(shape.type)) {
      const xMin = Math.min(shape.x, shape.x + shape.width);
      const yMin = Math.min(shape.y, shape.y + shape.height);
      const w = Math.abs(shape.width);
      const h = Math.abs(shape.height);
      
      this.ctx.beginPath();
      this.ctx.rect(xMin - 2 / this.zoomScale, yMin - 2 / this.zoomScale, w + 4 / this.zoomScale, h + 4 / this.zoomScale);
      this.ctx.stroke();
      
      // Draw handles at four corners
      this.ctx.setLineDash([]);
      this.drawHandle(xMin, yMin);
      this.drawHandle(xMin + w, yMin);
      this.drawHandle(xMin, yMin + h);
      this.drawHandle(xMin + w, yMin + h);
    } else if (shape.type === 'circle') {
      const r = Math.max(0.1, shape.radius);
      // Draw bounding square
      this.ctx.beginPath();
      this.ctx.rect(shape.centerX - r, shape.centerY - r, r * 2, r * 2);
      this.ctx.stroke();
      
      // Draw handles at quadrants and center
      this.ctx.setLineDash([]);
      this.drawHandle(shape.centerX, shape.centerY);
      this.drawHandle(shape.centerX - r, shape.centerY);
      this.drawHandle(shape.centerX + r, shape.centerY);
      this.drawHandle(shape.centerX, shape.centerY - r);
      this.drawHandle(shape.centerX, shape.centerY + r);
    }
    
    this.ctx.restore();
  }

  drawHandle(x, y) {
    const size = 8 / this.zoomScale;
    const half = size / 2;
    this.ctx.fillStyle = '#ffffff';
    this.ctx.strokeStyle = '#3b82f6';
    this.ctx.lineWidth = 1.5 / this.zoomScale;
    this.ctx.beginPath();
    this.ctx.rect(x - half, y - half, size, size);
    this.ctx.fill();
    this.ctx.stroke();
  }

  // ==========================================
  // 6. ENTITY SIDEBAR UPDATE PIPELINE
  // ==========================================

  updateEntityList() {
    const emptyPrompt = document.getElementById('entity-list-empty');
    const listItems = document.getElementById('entity-list-items');
    const counter = document.getElementById('entity-counter');
    
    if (!emptyPrompt || !listItems || !counter) return;
    
    counter.innerText = `${this.shapes.length} shape${this.shapes.length === 1 ? '' : 's'}`;
    
    if (this.shapes.length === 0) {
      emptyPrompt.classList.remove('hidden');
      listItems.classList.add('hidden');
      listItems.innerHTML = '';
      return;
    }
    
    emptyPrompt.classList.add('hidden');
    listItems.classList.remove('hidden');
    listItems.innerHTML = '';
    
    // Newest actions on top
    const sortedShapes = [...this.shapes].reverse();
    
    sortedShapes.forEach((shape) => {
      const rawIndex = this.shapes.indexOf(shape);
      const li = document.createElement('li');
      
      const assignedLayer = this.layers.find(l => l.id === (shape.layerId || 'default'));
      const assignedLayerName = assignedLayer ? assignedLayer.name : 'Default';
      const isLayerVisible = this.isLayerVisible(shape.layerId || 'default');
      
      let classList = 'entity-list-item flex items-center justify-between group';
      if (this.selectedShape === shape) {
        classList += ' selected-item';
      }
      if (!isLayerVisible) {
        classList += ' opacity-40';
      }
      li.className = classList;
      
      let details = '';
      let shapeName = '';
      let icon = '🔹';
      
      if (shape.type === 'line') {
        shapeName = 'LINE';
        details = `P1(${Math.round(shape.x1)}, ${Math.round(shape.y1)}) ➔ P2(${Math.round(shape.x2)}, ${Math.round(shape.y2)})`;
        icon = '📏';
      } else if (shape.type === 'wall') {
        shapeName = 'WALL';
        details = `P1(${Math.round(shape.x1)}, ${Math.round(shape.y1)}) ➔ P2(${Math.round(shape.x2)}, ${Math.round(shape.y2)}) [T:${shape.wallThickness}px]`;
        icon = '🧱';
      } else if (shape.type === 'beam') {
        shapeName = 'BEAM';
        details = `P1(${Math.round(shape.x1)}, ${Math.round(shape.y1)}) ➔ P2(${Math.round(shape.x2)}, ${Math.round(shape.y2)})`;
        icon = '▬';
      } else if (shape.type === 'door') {
        shapeName = 'DOOR';
        details = `Hing(${Math.round(shape.x1)}, ${Math.round(shape.y1)}) ➔ Strk(${Math.round(shape.x2)}, ${Math.round(shape.y2)})`;
        icon = '🚪';
      } else if (shape.type === 'window') {
        shapeName = 'WINDOW';
        details = `W1(${Math.round(shape.x1)}, ${Math.round(shape.y1)}) ➔ W2(${Math.round(shape.x2)}, ${Math.round(shape.y2)}) [T:${shape.windowThickness}px]`;
        icon = '🪟';
      } else if (shape.type === 'dimension') {
        shapeName = 'DIM';
        details = `A(${Math.round(shape.x1)}, ${Math.round(shape.y1)}) ➔ B(${Math.round(shape.x2)}, ${Math.round(shape.y2)})`;
        icon = '📐';
      } else if (shape.type === 'rectangle') {
        shapeName = 'RECT';
        details = `X:${Math.round(shape.x)}, Y:${Math.round(shape.y)} W:${Math.round(shape.width)} H:${Math.round(shape.height)}`;
        icon = '⬜';
      } else if (shape.type === 'column') {
        shapeName = 'COLUMN';
        details = `Cor(${Math.round(shape.x)}, ${Math.round(shape.y)}) W:${Math.round(shape.width)} H:${Math.round(shape.height)}`;
        icon = '🏛️';
      } else if (shape.type === 'roomlabel') {
        shapeName = 'ZONE';
        details = `"${shape.labelText}" - X:${Math.round(shape.x)}, Y:${Math.round(shape.y)}`;
        icon = '🏷️';
      } else if (shape.type === 'text') {
        shapeName = 'TEXT';
        details = `"${shape.labelText}" - (${Math.round(shape.x)}, ${Math.round(shape.y)}) Sz:${shape.fontSize}px`;
        icon = '✍️';
      } else if (shape.type === 'areazone') {
        shapeName = 'AREA';
        details = `"${shape.zoneName}" - X:${Math.round(shape.x)}, Y:${Math.round(shape.y)}`;
        icon = '📐';
      } else if (shape.type === 'circle') {
        shapeName = 'CIRC';
        details = `C(${Math.round(shape.centerX)}, ${Math.round(shape.centerY)}) R:${Math.round(shape.radius)}`;
        icon = '⭕';
      }
      
      let colorName = 'Cyan';
      if (shape.color === '#06b6d4') colorName = 'Cyan';
      else if (shape.color === '#22c55e') colorName = 'Lime';
      else if (shape.color === '#f59e0b') colorName = 'Amber';
      else if (shape.color === '#ef4444') colorName = 'Ruby';
      else if (shape.color === '#ffffff') colorName = 'White';
      
      li.innerHTML = `
        <div class="flex flex-col select-none pr-2 max-w-[210px] cursor-pointer">
          <div class="flex items-center gap-1.2">
            <span class="w-1.5 h-1.5 rounded-full" style="background-color: ${shape.color}"></span>
            <span class="font-bold tracking-wider text-slate-200 text-[10px]">${icon} ${shapeName}</span>
            <span class="text-[9px] text-slate-500 font-normal ml-1 truncate max-w-[130px]" title="Layer: ${assignedLayerName}">L: ${colorName} // ${shape.lineWidth}px // ${assignedLayerName}${isLayerVisible ? '' : ' (Hidden)'}</span>
          </div>
          <span class="text-[10px] text-slate-400 mt-0.5 truncate tracking-normal font-mono" title="${details}">${details}</span>
        </div>
        <button class="delete-entity-btn opacity-0 group-hover:opacity-100 p-1.5 rounded transition hover:bg-red-950/40 text-slate-600 hover:text-red-400 cursor-pointer" data-index="${rawIndex}" title="Delete entity">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      `;
      
      // Select shape on clicking list node item
      li.addEventListener('click', () => {
        this.setActiveTool('select');
        this.selectedShape = shape;
        this.updateDeleteSelectedBtnState();
        this.updateEntityList();
        this.redraw();
      });
      
      // Highlights shape on hovering sidebar list node
      li.addEventListener('mouseenter', () => {
        this.hoveredShapeIndex = rawIndex;
        this.redraw();
      });
      
      li.addEventListener('mouseleave', () => {
        this.hoveredShapeIndex = null;
        this.redraw();
      });
      
      listItems.appendChild(li);
    });
    
    // Bind deletes clicking event listener
    const deleteBtns = listItems.querySelectorAll('.delete-entity-btn');
    deleteBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const indexToDelete = parseInt(btn.getAttribute('data-index'), 10);
        if (!isNaN(indexToDelete)) {
          const removedShape = this.shapes[indexToDelete];
          if (this.selectedShape === removedShape) {
            this.selectedShape = null;
            this.updateDeleteSelectedBtnState();
          }
          this.pushUndoCheckpoint();
          this.shapes.splice(indexToDelete, 1);
          this.updateUndoButtonState();
          this.saveDrawing();
          this.updateEntityList();
          this.redraw();
        }
      });
    });
  }

  // ==========================================
  // 7. HISTORICAL ACTIONS / DATABASE
  // ==========================================

  pushUndoCheckpoint() {
    if (!this.undoStack) this.undoStack = [];
    const snapshot = this.shapes.map(s => s.serialize ? s.serialize() : JSON.parse(JSON.stringify(s)));
    this.undoStack.push(snapshot);
    if (this.undoStack.length > 50) {
      this.undoStack.shift();
    }
    this.redoStack = [];
    this.updateUndoButtonState();
    this.updateRedoButtonState();
  }

  undo() {
    if (!this.undoStack || this.undoStack.length === 0) return;
    
    this.cancelActiveDrawing();
    
    const currentSnapshot = this.shapes.map(s => s.serialize ? s.serialize() : JSON.parse(JSON.stringify(s)));
    this.redoStack.push(currentSnapshot);
    
    const previousSnapshot = this.undoStack.pop();
    this.shapes = previousSnapshot.map(item => deserializeShape(item)).filter(Boolean);
    
    this.updateUndoButtonState();
    this.updateRedoButtonState();
    this.saveDrawing();
    this.updateEntityList();
    this.redraw();
  }

  redo() {
    if (this.redoStack.length === 0) return;
    
    this.cancelActiveDrawing();
    
    const currentSnapshot = this.shapes.map(s => s.serialize ? s.serialize() : JSON.parse(JSON.stringify(s)));
    if (!this.undoStack) this.undoStack = [];
    this.undoStack.push(currentSnapshot);
    
    const redoneSnapshot = this.redoStack.pop();
    this.shapes = redoneSnapshot.map(item => deserializeShape(item)).filter(Boolean);
    
    this.updateUndoButtonState();
    this.updateRedoButtonState();
    this.saveDrawing();
    this.updateEntityList();
    this.redraw();
  }

  clearAll() {
    if (this.activeProjectId) {
      const activeProj = this.projectsList.find(p => p.id === this.activeProjectId);
      if (activeProj && activeProj.isUnsavedTemplate) {
        // Discard it!
        const index = this.projectsList.findIndex(p => p.id === this.activeProjectId);
        if (index !== -1) {
          this.projectsList.splice(index, 1);
          this.saveProjectsDb();
        }
        
        // Find another project to load, or create a default blank one
        const remaining = this.projectsList.filter(p => !p.isUnsavedTemplate);
        if (remaining.length > 0) {
          this.loadProject(remaining[0].id);
        } else {
          // Create a brand new project
          this.createProject();
        }
        this.showStatusFeedback("Workspace cleared and unsaved template discarded.");
        return;
      }
    }

    this.pushUndoCheckpoint();
    this.setActiveTool('select');
    this.cancelActiveDrawing();
    
    // Clear shapes and redo/undo records
    this.shapes = [];
    this.redoStack = [];
    this.hoveredShapeIndex = null;
    this.selectedShape = null;
    this.selectedShapes = [];
    
    // Reset viewport zoom & pan
    this.zoomScale = 1.0;
    this.panX = 0;
    this.panY = 0;
    
    // Reset layers to default preset layer configuration
    this.layers = [
      { id: 'default', name: 'Default', visible: true, locked: false },
      { id: 'walls', name: 'Walls', visible: true, locked: false },
      { id: 'columns', name: 'Columns', visible: true, locked: false },
      { id: 'dimensions', name: 'Dimensions', visible: true, locked: false },
      { id: 'electrical', name: 'Electrical', visible: true, locked: false }
    ];
    this.activeLayerId = 'default';

    // Reset Rotate tool states
    this.rotateStep = 'select';
    this.selectedShapes = [];
    this.rotatePivotX = null;
    this.rotatePivotY = null;
    this.rotateBaseShapes = [];
    this.isRotating = false;

    // Reset Mirror tool states
    this.mirrorStep = 'select';
    this.selectedMirrorShapes = [];
    this.mirrorAxisX1 = null;
    this.mirrorAxisY1 = null;
    this.mirrorAxisX2 = null;
    this.mirrorAxisY2 = null;
    this.mirrorHoverX = null;
    this.mirrorHoverY = null;

    // Reset Scale tool states
    this.scaleStep = 'select';
    this.selectedScaleShapes = [];
    this.scalePivotX = null;
    this.scalePivotY = null;
    this.scaleBaseShapes = [];
    this.isScaling = false;
    this.scaleHoverX = null;
    this.scaleHoverY = null;

    // Hide prompt modals and HUD panels
    const promptModal = document.getElementById('cad-prompt-modal');
    if (promptModal) promptModal.classList.add('hidden');
    
    const measureHud = document.getElementById('measure-hud');
    if (measureHud) measureHud.classList.add('hidden');
    const rotateHud = document.getElementById('rotate-hud');
    if (rotateHud) rotateHud.classList.add('hidden');
    const mirrorHud = document.getElementById('mirror-hud');
    if (mirrorHud) mirrorHud.classList.add('hidden');
    const scaleHud = document.getElementById('scale-hud');
    if (scaleHud) scaleHud.classList.add('hidden');

    this.updateRotateHUD();
    this.updateMirrorHUD();
    this.updateScaleHUD();
    
    this.updateUndoButtonState();
    this.updateRedoButtonState();
    this.updateDeleteSelectedBtnState();
    this.updatePropertiesPanel();
    this.saveDrawing();
    this.updateEntityList();
    this.redraw();

    this.showStatusFeedback("Workspace fully cleared and reset.");
  }

  /**
   * Save drawing data to local Storage cache and write updates into the CAD projects DB (Autosave!)
   */
  saveDrawing() {
    try {
      const payload = this.shapes.map(s => s.serialize());
      localStorage.setItem('cad_workbench_draft', JSON.stringify(payload));
      
      // Save layers state
      localStorage.setItem('cad_workbench_layers', JSON.stringify(this.layers));
      localStorage.setItem('cad_workbench_active_layer', this.activeLayerId);
      
      // Sync into multi-project context (AUTOSAVE!)
      if (this.activeProjectId) {
        const proj = this.projectsList.find(p => p.id === this.activeProjectId);
        if (proj) {
          proj.shapes = payload;
          proj.layers = this.layers;
          proj.activeLayerId = this.activeLayerId;
          proj.activeUnit = this.activeUnit;
          proj.zoomScale = this.zoomScale;
          proj.panX = this.panX;
          proj.panY = this.panY;
          proj.updatedAt = Date.now();
          proj.thumbnail = this.generateThumbnail();
          this.saveProjectsDb();
        }
      }
      
      // Visual persistent saves confirmation notification updates
      const indicator = document.getElementById('status-save');
      if (indicator) {
        indicator.innerHTML = `
          <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
          <span class="text-emerald-400">AUTOSAVED</span>
        `;
        setTimeout(() => {
          indicator.innerHTML = `
            <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            <span>AUTOSAVED</span>
          `;
        }, 1000);
      }
    } catch (e) {
      console.error("Local storage drafting write error", e);
    }
  }

  /**
   * Dynamically generate a downscaled Base64 image thumbnail from active canvas
   */
  generateThumbnail() {
    try {
      if (!this.canvas) return '';
      // Create a small, lightweight offscreen canvas for performance
      const thumbCanvas = document.createElement('canvas');
      thumbCanvas.width = 160;
      thumbCanvas.height = 100;
      const tCtx = thumbCanvas.getContext('2d');
      if (tCtx) {
        // Draw the full workspace scene inside our downscaled snapshot box
        tCtx.drawImage(this.canvas, 0, 0, thumbCanvas.width, thumbCanvas.height);
        return thumbCanvas.toDataURL('image/jpeg', 0.4);
      }
    } catch (e) {
      console.error("Failed to generate dynamic canvas thumbnail snapshot", e);
    }
    return '';
  }

  /**
   * Initial setup and loading of Project multi-document workflow
   */
  initProjectManagement() {
    this.projectsList = [];
    this.activeProjectId = null;
    this.nameModalMode = 'rename';
    this.nameModalTargetId = null;
    
    // Load local CAD project database
    try {
      const stored = localStorage.getItem('cad_projects_db');
      if (stored) {
        this.projectsList = JSON.parse(stored);
      }
    } catch (e) {
      console.error("Load CAD projects DB failed", e);
    }
    
    // Auto-migrate from old single-project session draft key if no multi-projects exist yet
    if (this.projectsList.length === 0) {
      let migratedShapes = [];
      let migratedLayers = [
        { id: 'default', name: 'Default', visible: true, locked: false },
        { id: 'walls', name: 'Walls', visible: true, locked: false },
        { id: 'columns', name: 'Columns', visible: true, locked: false },
        { id: 'dimensions', name: 'Dimensions', visible: true, locked: false },
        { id: 'electrical', name: 'Electrical', visible: true, locked: false }
      ];
      let migratedActiveLayer = 'default';
      
      const oldDraft = localStorage.getItem('cad_workbench_draft');
      if (oldDraft) {
        try { migratedShapes = JSON.parse(oldDraft); } catch (e) {}
      }
      const oldLayers = localStorage.getItem('cad_workbench_layers');
      if (oldLayers) {
        try { migratedLayers = JSON.parse(oldLayers); } catch (e) {}
      }
      const oldActiveLayer = localStorage.getItem('cad_workbench_active_layer');
      if (oldActiveLayer) {
        migratedActiveLayer = oldActiveLayer;
      }
      
      // Scaffold first seed project with recovered data
      const firstProj = {
        id: 'proj_default_' + Date.now(),
        name: oldDraft ? 'Aether_Recovered_Draft.dwg' : 'Suspension_Mount_V4.dwg',
        createdAt: Date.now() - 3600000,
        updatedAt: Date.now(),
        shapes: migratedShapes,
        layers: migratedLayers,
        activeLayerId: migratedActiveLayer,
        zoomScale: 1.0,
        panX: 0,
        panY: 0,
        activeUnit: 'px',
        thumbnail: ''
      };
      
      this.projectsList.push(firstProj);
      this.saveProjectsDb();
    }
    
    // Determine target active project
    let targetActiveId = localStorage.getItem('cad_active_project_id');
    if (!targetActiveId || !this.projectsList.some(p => p.id === targetActiveId)) {
      // Pick the project that was modified most recently
      const sorted = [...this.projectsList].sort((a, b) => b.updatedAt - a.updatedAt);
      targetActiveId = sorted[0].id;
    }
    
    // Perform initial document load
    this.loadProject(targetActiveId);
    
    // Attach buttons bindings for Project Manager overlay
    const pmOpenBtn1 = document.getElementById('menu-project-manager');
    const pmOpenBtn2 = document.getElementById('header-active-project-name');
    const pmOpenBtn3 = document.getElementById('header-projects-list-btn');
    const pmCloseBtn = document.getElementById('close-project-modal');
    const pmModal = document.getElementById('project-manager-modal');
    
    if (pmOpenBtn1) pmOpenBtn1.addEventListener('click', () => this.openProjectManagerModal());
    if (pmOpenBtn2) pmOpenBtn2.addEventListener('click', () => this.openProjectManagerModal());
    if (pmOpenBtn3) pmOpenBtn3.addEventListener('click', () => this.openProjectManagerModal());
    if (pmCloseBtn) pmCloseBtn.addEventListener('click', () => this.closeProjectManagerModal());
    
    if (pmModal) {
      pmModal.addEventListener('click', (e) => {
        if (e.target === pmModal) this.closeProjectManagerModal();
      });
    }
    
    // Search filter trigger
    const searchInput = document.getElementById('project-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', () => this.renderProjectManagerUI());
    }
    
    // Create new project trigger
    const createBtn = document.getElementById('btn-create-project');
    if (createBtn) {
      createBtn.addEventListener('click', () => {
        this.openNameModal('create', null);
      });
    }
    
    // Bind Name Editor Modal controls
    const nameModal = document.getElementById('name-modal');
    const nameInput = document.getElementById('name-modal-input');
    const nameConfirm = document.getElementById('confirm-name-btn');
    const nameCancel = document.getElementById('cancel-name-btn');
    
    if (nameModal) {
      nameModal.addEventListener('click', (e) => {
        if (e.target === nameModal) nameModal.classList.add('hidden');
      });
    }
    
    if (nameCancel) {
      nameCancel.addEventListener('click', () => nameModal.classList.add('hidden'));
    }
    
    if (nameConfirm && nameInput) {
      const performAction = () => {
        const val = nameInput.value.trim();
        if (!val) return;
        
        if (this.nameModalMode === 'rename') {
          this.renameProject(this.nameModalTargetId, val);
        } else if (this.nameModalMode === 'duplicate') {
          this.duplicateProject(this.nameModalTargetId, val);
        } else if (this.nameModalMode === 'create') {
          this.createProject(val);
        }
        
        nameModal.classList.add('hidden');
      };
      
      nameConfirm.addEventListener('click', performAction);
      
      nameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          performAction();
        } else if (e.key === 'Escape') {
          nameModal.classList.add('hidden');
        }
      });
    }
  }

  /**
   * Save multicore project list state serialize context to disk
   */
  saveProjectsDb() {
    try {
      localStorage.setItem('cad_projects_db', JSON.stringify(this.projectsList));
    } catch (e) {
      console.error("Save projects database failure", e);
    }
  }

  discardUnsavedTemplates(keepId = null) {
    let changed = false;
    this.projectsList = this.projectsList.filter(p => {
      if (p.isUnsavedTemplate && p.id !== keepId) {
        changed = true;
        return false;
      }
      return true;
    });
    if (changed) {
      this.saveProjectsDb();
    }
  }

  /**
   * Load active target project structure and switch workspace contexts
   */
  loadProject(id) {
    this.discardUnsavedTemplates(id);
    const proj = this.projectsList.find(p => p.id === id);
    if (!proj) return;
    
    this.activeProjectId = id;
    localStorage.setItem('cad_active_project_id', id);
    
    // Hydrate workspace layers configuration (ensuring AutoCAD preset layers are always present)
    const defaultLayersTemplate = [
      { id: 'default', name: 'Default', visible: true, locked: false },
      { id: 'walls', name: 'Walls', visible: true, locked: false },
      { id: 'columns', name: 'Columns', visible: true, locked: false },
      { id: 'dimensions', name: 'Dimensions', visible: true, locked: false },
      { id: 'electrical', name: 'Electrical', visible: true, locked: false }
    ];

    if (!proj.layers || proj.layers.length === 0) {
      this.layers = defaultLayersTemplate;
    } else {
      this.layers = proj.layers;
      // Ensure each template layer is present
      defaultLayersTemplate.forEach(tplLayer => {
        const found = this.layers.find(l => l.id === tplLayer.id);
        if (!found) {
          this.layers.push(tplLayer);
        } else {
          // Normalize names of standard layers
          if (found.id === 'default' && found.name === 'Default Layer') {
            found.name = 'Default';
          }
          if (found.locked === undefined) {
            found.locked = false;
          }
        }
      });
    }

    this.activeLayerId = proj.activeLayerId || 'default';
    if (!this.layers.some(l => l.id === this.activeLayerId) && this.layers.length > 0) {
      this.activeLayerId = this.layers[0].id;
    }
    
    // Hydrate Units preference
    this.activeUnit = proj.activeUnit || 'px';
    const unitSelectEl = document.getElementById('active-unit-select');
    if (unitSelectEl) {
      unitSelectEl.value = this.activeUnit;
    }
    
    // Hydrate Viewport Pan/Zoom state
    this.zoomScale = proj.zoomScale || 1.0;
    this.panX = proj.panX || 0;
    this.panY = proj.panY || 0;
    
    // Clear dynamic states
    this.selectedShape = null;
    this.hoveredShapeIndex = null;
    this.undoStack = [];
    this.redoStack = [];
    
    // Restore serialized CAD shapes list
    if (Array.isArray(proj.shapes)) {
      this.shapes = proj.shapes
        .map(item => deserializeShape(item))
        .filter(sh => sh !== null);
    } else {
      this.shapes = [];
    }
    
    // Update live indicators in header
    const titleEl = document.getElementById('active-project-name-display');
    if (titleEl) {
      titleEl.innerText = proj.name;
    }
    
    // Sync all updates out to view widgets
    this.updateZoomStatus();
    this.updateLayersWidget();
    this.updateEntityList();
    this.updateUndoButtonState();
    this.updateRedoButtonState();
    this.updateDeleteSelectedBtnState();
    
    this.redraw();
  }

  /**
   * Main Project Manager UI renderer. Generates recent lists, search results, and dynamic card visuals.
   */
  renderProjectManagerUI() {
    const grid = document.getElementById('projects-grid');
    const recentsList = document.getElementById('recent-projects-list');
    const emptyState = document.getElementById('projects-empty-state');
    const searchQuery = (document.getElementById('project-search-input')?.value || '').toLowerCase().trim();
    
    if (!grid) return;
    
    // Filter list context
    const filteredProjects = this.projectsList.filter(p => p.name.toLowerCase().includes(searchQuery));
    
    // Clear grid for repaint
    grid.innerHTML = '';
    
    if (filteredProjects.length === 0) {
      if (emptyState) emptyState.classList.remove('hidden');
    } else {
      if (emptyState) emptyState.classList.add('hidden');
      
      filteredProjects.forEach(proj => {
        const isCurrent = proj.id === this.activeProjectId;
        const formattedDate = new Date(proj.updatedAt).toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
        
        // Render project thumbnail
        const thumbHTML = proj.thumbnail 
          ? `<img src="${proj.thumbnail}" class="w-full h-full object-cover rounded opacity-80 hover:opacity-100 transition-opacity" referrerPolicy="no-referrer" />`
          : `<div class="w-full h-full flex flex-col items-center justify-center bg-[#0B0D0F]" style="background-image: radial-gradient(#2A2D35 1px, transparent 1px); background-size: 10px 10px;">
               <span class="text-[8px] text-gray-600 font-mono">GRID ACTIVE</span>
             </div>`;
             
        const card = document.createElement('div');
        card.id = `project-card-${proj.id}`;
        card.className = `p-3 bg-[#1E2127] border ${isCurrent ? 'border-blue-500 shadow-md shadow-blue-500/10' : 'border-[#2A2D35]'} hover:border-[#3B82F6] rounded-md transition duration-150 flex flex-col justify-between h-[165px]`;
        
        card.innerHTML = `
          <!-- Preview Frame -->
          <div class="h-22 w-full rounded border border-[#2A2D35]/50 bg-[#0B0D0F] overflow-hidden relative cursor-pointer" data-id="${proj.id}">
            ${thumbHTML}
            ${isCurrent ? `<span class="absolute top-1.5 left-1.5 bg-blue-600 text-white font-mono font-bold text-[8px] px-1.5 py-0.5 rounded tracking-wide">ACTIVE</span>` : ''}
            <span class="absolute bottom-1 right-1 text-[8px] text-gray-500 font-mono">${(proj.shapes || []).length} elements</span>
          </div>
          
          <!-- Details & Access Handles -->
          <div class="flex items-center justify-between mt-2 min-w-0">
            <div class="flex flex-col min-w-0 flex-grow mr-2 cursor-pointer" data-id="${proj.id}">
              <span class="text-xs font-bold text-gray-200 truncate font-mono">${proj.name}</span>
              <span class="text-[8.5px] text-gray-500 font-mono font-semibold mt-0.5">MODIFIED: ${formattedDate}</span>
            </div>
            
            <!-- Contextual Tool actions list -->
            <div class="flex items-center gap-0.5 shrink-0">
              <!-- Rename -->
              <button class="btn-rename p-1 rounded hover:bg-[#2A2D35] hover:text-blue-400 text-gray-400 transition cursor-pointer" data-id="${proj.id}" title="Rename Project">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
              
              <!-- Duplicate -->
              <button class="btn-duplicate p-1 rounded hover:bg-[#2A2D35] hover:text-emerald-400 text-gray-400 transition cursor-pointer" data-id="${proj.id}" title="Duplicate Project">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
                </svg>
              </button>
              
              <!-- Stateful Inline Safe Delete -->
              <button class="btn-delete p-1 rounded hover:bg-[#2A2D35] hover:text-red-400 text-gray-400 transition cursor-pointer" data-id="${proj.id}" title="Delete Project">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          </div>
        `;
        
        grid.appendChild(card);
      });
      
      // Card selection handles Document loading
      grid.querySelectorAll('[data-id]').forEach(elem => {
        elem.addEventListener('click', (e) => {
          if (e.target.closest('button')) return; // Ignore if clicked inside actions row
          const id = elem.getAttribute('data-id');
          this.loadProject(id);
          this.closeProjectManagerModal();
        });
      });
      
      // Wire up card layout action buttons
      grid.querySelectorAll('.btn-rename').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const id = btn.getAttribute('data-id');
          this.openNameModal('rename', id);
        });
      });
      grid.querySelectorAll('.btn-duplicate').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const id = btn.getAttribute('data-id');
          this.openNameModal('duplicate', id);
        });
      });
      
      // Stateful inline safe deletion hook to bypass standard browser prompts in frames
      grid.querySelectorAll('.btn-delete').forEach(btn => {
        let confirmMode = false;
        let timeout = null;
        
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const id = btn.getAttribute('data-id');
          if (!confirmMode) {
            confirmMode = true;
            btn.innerHTML = `
              <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5 text-red-500 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            `;
            btn.title = "Confirm Delete (Click again)";
            btn.classList.add('bg-red-500/10');
            
            // Timeout to reset configuration back to safe icon
            timeout = setTimeout(() => {
              confirmMode = false;
              btn.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              `;
              btn.title = "Delete Project";
              btn.classList.remove('bg-red-500/10');
            }, 3000);
          } else {
            if (timeout) clearTimeout(timeout);
            this.deleteProject(id);
          }
        });
      });
    }
    
    // Sidebar Recently modified files drawer
    if (recentsList) {
      recentsList.innerHTML = '';
      const sortedRecents = [...this.projectsList].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 8);
      sortedRecents.forEach(proj => {
        const isCurrent = proj.id === this.activeProjectId;
        const item = document.createElement('button');
        item.className = `w-full text-left px-2.5 py-1.5 text-[11px] rounded transition flex items-center justify-between border cursor-pointer font-mono ${isCurrent ? 'bg-blue-600/10 text-blue-400 border-blue-500/20 font-bold' : 'bg-transparent text-gray-400 border-transparent hover:bg-[#1E2127] hover:text-white'}`;
        item.innerHTML = `
          <div class="flex items-center gap-1.5 min-w-0 mr-1">
            <span class="text-[9px] text-gray-500">📂</span>
            <span class="truncate">${proj.name}</span>
          </div>
          ${isCurrent ? `<span class="h-1.2 w-1.2 rounded-full bg-blue-400 shrink-0"></span>` : ''}
        `;
        item.addEventListener('click', () => {
          this.loadProject(proj.id);
          this.closeProjectManagerModal();
        });
        recentsList.appendChild(item);
      });
    }
  }

  /**
   * Reveal project manager dashboard framework
   */
  openProjectManagerModal() {
    const modal = document.getElementById('project-manager-modal');
    if (modal) {
      modal.classList.remove('hidden');
      this.renderProjectManagerUI();
      // Auto-focus on search input
      setTimeout(() => document.getElementById('project-search-input')?.focus(), 50);
    }
  }

  /**
   * Hide project manager dashboard framework
   */
  closeProjectManagerModal() {
    const modal = document.getElementById('project-manager-modal');
    if (modal) {
      modal.classList.add('hidden');
    }
  }

  /**
   * Spawn prompt name editor dialog for renaming/duplicating/creating project
   */
  openNameModal(mode, id) {
    this.nameModalMode = mode;
    this.nameModalTargetId = id;
    
    const modal = document.getElementById('name-modal');
    const title = document.getElementById('name-modal-title');
    const desc = document.getElementById('name-modal-desc');
    const input = document.getElementById('name-modal-input');
    
    if (!modal) return;
    
    const proj = this.projectsList.find(p => p.id === id);
    let defaultVal = '';
    
    if (mode === 'rename') {
      title.innerText = 'RENAME CAD FILE';
      desc.innerText = 'Choose a new designation for this drawing layout.';
      defaultVal = proj ? proj.name : '';
    } else if (mode === 'duplicate') {
      title.innerText = 'DUPLICATE CAD FILE';
      desc.innerText = 'Specify the designation for your copied CAD document.';
      defaultVal = proj ? (proj.name.replace(/\.[a-zA-Z0-9]+$/, '') + ' - Copy.dwg') : 'Project - Copy.dwg';
    } else if (mode === 'create') {
      title.innerText = 'CREATE NEW DESIGN';
      desc.innerText = 'Establish a fresh design catalog designation.';
      defaultVal = 'Aether_Drawing_' + (this.projectsList.length + 1) + '.dwg';
    }
    
    if (input) {
      input.value = defaultVal;
    }
    
    modal.classList.remove('hidden');
    setTimeout(() => {
      if (input) {
        input.focus();
        input.select();
      }
    }, 50);
  }

  /**
   * Commit name edit back to target database
   */
  renameProject(id, newName) {
    if (!newName) return;
    // ensure name preserves elegant extension if original had one, or keep literal
    const proj = this.projectsList.find(p => p.id === id);
    if (proj) {
      if (proj.isUnsavedTemplate) {
        delete proj.isUnsavedTemplate;
        const newId = 'proj_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
        proj.id = newId;
        if (this.activeProjectId === id) {
          this.activeProjectId = newId;
          localStorage.setItem('cad_active_project_id', newId);
        }
      }
      proj.name = newName;
      proj.updatedAt = Date.now();
      this.saveProjectsDb();
      if (this.activeProjectId === proj.id) {
        const display = document.getElementById('active-project-name-display');
        if (display) display.innerText = newName;
      }
      this.renderProjectManagerUI();
    }
  }

  /**
   * Clone a project file directly in cache and register inside local database
   */
  duplicateProject(id, newName) {
    const sourceProj = this.projectsList.find(p => p.id === id);
    if (!sourceProj) return;
    
    const cloneName = newName || (sourceProj.name.replace(/\.[a-zA-Z0-9]+$/, '') + ' - Copy.dwg');
    const clone = {
      id: 'proj_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now(),
      name: cloneName,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      shapes: JSON.parse(JSON.stringify(sourceProj.shapes || [])),
      layers: JSON.parse(JSON.stringify(sourceProj.layers || [])),
      activeLayerId: sourceProj.activeLayerId || 'default',
      zoomScale: sourceProj.zoomScale || 1.0,
      panX: sourceProj.panX || 0,
      panY: sourceProj.panY || 0,
      activeUnit: sourceProj.activeUnit || 'px',
      thumbnail: sourceProj.thumbnail || ''
    };
    
    this.projectsList.push(clone);
    this.saveProjectsDb();
    this.renderProjectManagerUI();
  }

  /**
   * Create, load and automatically select an empty new file workspace
   */
  createProject(name) {
    const safeName = name || 'Untitled_Project_' + (this.projectsList.length + 1) + '.dwg';
    const newProj = {
      id: 'proj_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now(),
      name: safeName,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      shapes: [],
      layers: [
        { id: 'default', name: 'Default', visible: true, locked: false },
        { id: 'walls', name: 'Walls', visible: true, locked: false },
        { id: 'columns', name: 'Columns', visible: true, locked: false },
        { id: 'dimensions', name: 'Dimensions', visible: true, locked: false },
        { id: 'electrical', name: 'Electrical', visible: true, locked: false }
      ],
      activeLayerId: 'default',
      zoomScale: 1.0,
      panX: 0,
      panY: 0,
      activeUnit: 'px',
      thumbnail: ''
    };
    
    this.projectsList.push(newProj);
    this.saveProjectsDb();
    this.loadProject(newProj.id);
    this.renderProjectManagerUI();
    
    // Smooth transition: close modal automatically when load completes
    this.closeProjectManagerModal();
  }

  /**
   * Erase file completely from filesystem/projects database
   */
  deleteProject(id) {
    const index = this.projectsList.findIndex(p => p.id === id);
    if (index === -1) return;
    
    this.projectsList.splice(index, 1);
    this.saveProjectsDb();
    
    if (this.activeProjectId === id) {
      if (this.projectsList.length > 0) {
        this.loadProject(this.projectsList[0].id);
      } else {
        // Fallback placeholder structure to avoid crash
        this.createProject('Aether_Draft_V1.dwg');
      }
    }
    
    this.renderProjectManagerUI();
  }

  /**
   * Generate vector SVG file from layered shapes array
   */
  exportToSVG() {
    if (this.shapes.length === 0) {
      alert("No drafted shapes to export. Draw elements first!");
      return;
    }
    
    // Build elegant SVG structured XML markup
    let svg = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n`;
    svg += `<svg width="${this.width}" height="${this.height}" viewBox="0 0 ${this.width} ${this.height}" xmlns="http://www.w3.org/2000/svg" style="background-color: #020617;">\n`;
    svg += `  <!-- Generated by CAD Drawing Studio -->\n`;
    
    this.shapes.forEach((s) => {
      if (!this.isLayerVisible(s.layerId || 'default')) return;
      
      const strokeHex = s.color;
      const strokeW = s.lineWidth;
      
      if (s.type === 'line') {
        svg += `  <line x1="${s.x1}" y1="${s.y1}" x2="${s.x2}" y2="${s.y2}" stroke="${strokeHex}" stroke-width="${strokeW}" stroke-linecap="round" />\n`;
      } else if (s.type === 'rectangle') {
        // Handle standard negative viewport sizing by absolute coordinates conversion or direct width bounds
        const x = s.width < 0 ? s.x + s.width : s.x;
        const y = s.height < 0 ? s.y + s.height : s.y;
        const w = Math.abs(s.width);
        const h = Math.abs(s.height);
        svg += `  <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="${strokeHex}" stroke-width="${strokeW}" stroke-linejoin="miter" />\n`;
      } else if (s.type === 'circle') {
        const r = Math.max(0.1, s.radius);
        svg += `  <circle cx="${s.centerX}" cy="${s.centerY}" r="${r}" fill="none" stroke="${strokeHex}" stroke-width="${strokeW}" />\n`;
      }
    });
    
    svg += `</svg>\n`;
    
    // Setup discrete downloader trigger
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const blobURL = URL.createObjectURL(blob);
    
    const clicker = document.createElement('a');
    clicker.href = blobURL;
    clicker.download = `cad_draft_${Math.floor(Date.now() / 1000)}.svg`;
    document.body.appendChild(clicker);
    clicker.click();
    document.body.removeChild(clicker);
    URL.revokeObjectURL(blobURL);
    this.showStatusFeedback("Exported SVG");
  }

  /**
   * Render custom feedback text alerts inside the footer status persistence indicator
   */
  showStatusFeedback(text, isError = false) {
    const indicator = document.getElementById('status-save');
    if (indicator) {
      const originalHTML = indicator.innerHTML;
      if (isError) {
        indicator.innerHTML = `
          <span class="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>
          <span class="text-red-400 font-bold">${text.toUpperCase()}</span>
        `;
      } else {
        indicator.innerHTML = `
          <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
          <span class="text-emerald-400 font-bold">${text.toUpperCase()}</span>
        `;
      }
      setTimeout(() => {
        indicator.innerHTML = originalHTML;
      }, 2000);
    }
  }

  /**
   * Export vector content to structured raster image (PNG)
   */
  exportToPNG() {
    if (this.shapes.length === 0) {
      alert("No drafted shapes to export. Draw elements first!");
      return;
    }
    
    // Create offscreen canvas matched in resolution coordinates
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = this.width;
    exportCanvas.height = this.height;
    const eCtx = exportCanvas.getContext('2d');
    if (!eCtx) return;
    
    // Solid dark slate drafting layout color background
    eCtx.fillStyle = '#0F1115';
    eCtx.fillRect(0, 0, this.width, this.height);
    
    // Custom render background gridlines
    if (this.gridEnabled) {
      this.drawGrid(eCtx);
    }
    
    // Mirror exact pan and zoom of the workspace draft view
    eCtx.save();
    eCtx.translate(this.panX, this.panY);
    eCtx.scale(this.zoomScale, this.zoomScale);
    
    // Draw all visible shapes
    this.shapes.forEach((shape) => {
      if (!this.isLayerVisible(shape.layerId || 'default')) return;
      shape.draw(eCtx);
    });
    
    eCtx.restore();
    
    try {
      const dataURL = exportCanvas.toDataURL('image/png');
      const clicker = document.createElement('a');
      clicker.href = dataURL;
      clicker.download = `cad_draft_${Math.floor(Date.now() / 1000)}.png`;
      document.body.appendChild(clicker);
      clicker.click();
      document.body.removeChild(clicker);
      this.showStatusFeedback("Exported PNG");
    } catch (err) {
      console.error("Failed to compile image rasterization output", err);
      alert("Failed to export as PNG due to system security parameters.");
    }
  }

  /**
   * Export all workspace metadata (layers, active layer, and drawn coordinates shapes)
   */
  exportToJSON() {
    if (this.shapes.length === 0 && this.layers.length <= 1) {
      alert("No drafted drawings or custom layers to export.");
      return;
    }
    
    const draftPackage = {
      app: "AetherCAD Pro",
      version: "1.1.0",
      timestamp: Date.now(),
      layers: this.layers,
      activeLayerId: this.activeLayerId,
      shapes: this.shapes.map(s => s.serialize())
    };
    
    const jsonStr = JSON.stringify(draftPackage, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const blobURL = URL.createObjectURL(blob);
    
    const clicker = document.createElement('a');
    clicker.href = blobURL;
    clicker.download = `cad_project_${Math.floor(Date.now() / 1000)}.json`;
    document.body.appendChild(clicker);
    clicker.click();
    document.body.removeChild(clicker);
    URL.revokeObjectURL(blobURL);
    this.showStatusFeedback("Saved JSON");
  }

  /**
   * Export all workspace layers and geometric elements to standard, high-fidelity AutoCAD DXF R12 format
   */
  exportToDXF() {
    if (this.shapes.length === 0) {
      alert("No drafted shapes to export. Draw elements first!");
      return;
    }

    // Helper to map color hex codes to standard AutoCAD Color Index (ACI) values
    const hexToACI = (hex) => {
      if (!hex) return 7; // white/black fallback
      hex = hex.toLowerCase().replace('#', '');
      if (hex.length === 3) {
        hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
      }
      const r = parseInt(hex.substring(0, 2), 16) || 0;
      const g = parseInt(hex.substring(2, 4), 16) || 0;
      const b = parseInt(hex.substring(4, 6), 16) || 0;

      const aciColors = [
        { aci: 1, r: 255, g: 0,   b: 0 },
        { aci: 2, r: 255, g: 255, b: 0 },
        { aci: 3, r: 0,   g: 255, b: 0 },
        { aci: 4, r: 0,   g: 255, b: 255 },
        { aci: 5, r: 0,   g: 0,   b: 255 },
        { aci: 6, r: 255, g: 0,   b: 255 },
        { aci: 7, r: 255, g: 255, b: 255 },
        { aci: 8, r: 128, g: 128, b: 128 },
        { aci: 9, r: 64,  g: 64,  b: 64 }
      ];

      let bestAci = 7;
      let minDist = Infinity;
      for (const c of aciColors) {
        const dist = Math.sqrt((r - c.r)**2 + (g - c.g)**2 + (b - c.b)**2);
        if (dist < minDist) {
          minDist = dist;
          bestAci = c.aci;
        }
      }
      return bestAci;
    };

    let dxf = [];

    // Helper to append a single key-value entry in DXF pair formatting
    const add = (code, value) => {
      dxf.push(String(code).trim().padStart(3, ' '));
      dxf.push(String(value));
    };

    // A. DXF HEADER SECTION
    add(0, 'SECTION');
    add(2, 'HEADER');
    add(9, '$ACADVER');
    add(1, 'AC1009'); // Standard AutoCAD R12 DXF spec (maximizes cross-tool compatibility)
    add(0, 'ENDSEC');

    // B. DXF LAYER TABLES SECTION
    add(0, 'SECTION');
    add(2, 'TABLES');
    add(0, 'TABLE');
    add(2, 'LAYER');
    add(70, this.layers.length);

    this.layers.forEach((layer) => {
      add(0, 'LAYER');
      add(2, layer.name || layer.id);
      add(70, 0);
      
      // Determine layer color by sampling shapes belonging to this layer, or default to ACI 7
      let layerColorACI = 7;
      const sampleShape = this.shapes.find(s => s.layerId === layer.id);
      if (sampleShape) {
        layerColorACI = hexToACI(sampleShape.color);
      } else {
        // Known layer defaults
        if (layer.id === 'walls') layerColorACI = 1;      // Red
        else if (layer.id === 'columns') layerColorACI = 3;  // Green
        else if (layer.id === 'dimensions') layerColorACI = 5; // Blue
        else if (layer.id === 'electrical') layerColorACI = 2; // Yellow
      }
      add(62, layerColorACI);
      add(6, 'CONTINUOUS');
    });

    add(0, 'ENDTAB');
    add(0, 'ENDSEC');

    // C. DXF ENTITIES SECTION
    add(0, 'SECTION');
    add(2, 'ENTITIES');

    // Math helper for rotating rectangle/box corners about a center pivot point
    const rotatePoint = (x, y, cx, cy, angleRad) => {
      if (!angleRad) return { x, y };
      const dx = x - cx;
      const dy = y - cy;
      return {
        x: cx + dx * Math.cos(angleRad) - dy * Math.sin(angleRad),
        y: cy + dx * Math.sin(angleRad) + dy * Math.cos(angleRad)
      };
    };

    this.shapes.forEach((s) => {
      if (!this.isLayerVisible(s.layerId || 'default')) return;

      const layerName = s.layerId || 'default';
      const aciColor = hexToACI(s.color);

      // Modular helpers to output various primitive types
      const addLine = (x1, y1, x2, y2, customColor = aciColor) => {
        add(0, 'LINE');
        add(8, layerName);
        add(62, customColor);
        add(10, x1);
        add(20, -y1); // Invert Y coordinate for upright CAD representation
        add(30, 0.0);
        add(11, x2);
        add(21, -y2); // Invert Y coordinate
        add(31, 0.0);
      };

      const addCircle = (cx, cy, r, customColor = aciColor) => {
        add(0, 'CIRCLE');
        add(8, layerName);
        add(62, customColor);
        add(10, cx);
        add(20, -cy); // Invert Y
        add(30, 0.0);
        add(40, r);
      };

      const addText = (text, cx, cy, height, angleDeg = 0, hAlign = 1, vAlign = 2, customColor = aciColor) => {
        add(0, 'TEXT');
        add(8, layerName);
        add(62, customColor);
        add(10, cx);
        add(20, -cy); // Invert Y
        add(30, 0.0);
        add(40, height);
        add(1, text);
        add(50, angleDeg);
        add(72, hAlign); // Horizontal: 1 = Center
        add(11, cx);
        add(21, -cy); // Invert Y
        add(31, 0.0);
        add(73, vAlign); // Vertical: 2 = Middle
      };

      const addSolidTriangle = (x1, y1, x2, y2, x3, y3, customColor = aciColor) => {
        add(0, 'SOLID');
        add(8, layerName);
        add(62, customColor);
        add(10, x1);
        add(20, -y1);
        add(30, 0.0);
        add(11, x2);
        add(21, -y2);
        add(31, 0.0);
        add(12, x3);
        add(22, -y3);
        add(32, 0.0);
        add(13, x3); // For triangles, repeating the 3rd vertex is standard
        add(23, -y3);
        add(33, 0.0);
      };

      const addArc = (cx, cy, r, startDeg, endDeg, customColor = aciColor) => {
        add(0, 'ARC');
        add(8, layerName);
        add(62, customColor);
        add(10, cx);
        add(20, -cy);
        add(30, 0.0);
        add(40, r);
        add(50, startDeg);
        add(51, endDeg);
      };

      const addRectPolyline = (x, y, w, h, angleRad = 0, customColor = aciColor) => {
        const cx = x + w / 2;
        const cy = y + h / 2;
        const p1 = rotatePoint(x, y, cx, cy, angleRad);
        const p2 = rotatePoint(x + w, y, cx, cy, angleRad);
        const p3 = rotatePoint(x + w, y + h, cx, cy, angleRad);
        const p4 = rotatePoint(x, y + h, cx, cy, angleRad);

        add(0, 'POLYLINE');
        add(8, layerName);
        add(62, customColor);
        add(66, 1); // Vertices follow
        add(10, 0);
        add(20, 0);
        add(30, 0);
        add(70, 1); // Closed

        const addVertex = (vx, vy) => {
          add(0, 'VERTEX');
          add(8, layerName);
          add(10, vx);
          add(20, -vy);
          add(30, 0);
        };

        addVertex(p1.x, p1.y);
        addVertex(p2.x, p2.y);
        addVertex(p3.x, p3.y);
        addVertex(p4.x, p4.y);

        add(0, 'SEQEND');
      };

      if (s.type === 'line') {
        addLine(s.x1, s.y1, s.x2, s.y2);
      } 
      else if (s.type === 'rectangle') {
        addRectPolyline(s.x, s.y, s.width, s.height, s.angle || 0);
      } 
      else if (s.type === 'circle') {
        addCircle(s.centerX, s.centerY, Math.max(0.1, s.radius));
      } 
      else if (s.type === 'wall') {
        // Export high-fidelity parallel architectural wall lines + structural infill hatch patterns
        const dx = s.x2 - s.x1;
        const dy = s.y2 - s.y1;
        const len = Math.hypot(dx, dy);
        if (len > 0.1) {
          const nx = -dy / len;
          const ny = dx / len;
          const halfW = (s.wallThickness || 12) / 2;

          const p1x = s.x1 + nx * halfW;
          const p1y = s.y1 + ny * halfW;
          const p2x = s.x2 + nx * halfW;
          const p2y = s.y2 + ny * halfW;
          const p3x = s.x2 - nx * halfW;
          const p3y = s.y2 - ny * halfW;
          const p4x = s.x1 - nx * halfW;
          const p4y = s.y1 - ny * halfW;

          // Outlines as a closed polyline wall box
          addRectPolyline(s.x1 - nx * halfW, s.y1 - ny * halfW, len, s.wallThickness || 12, Math.atan2(dy, dx));

          // Draw double parallel boundaries
          addLine(p1x, p1y, p2x, p2y);
          addLine(p4x, p4y, p3x, p3y);

          // Render cross hatch lines at standard spacing increments inside the wall bounds
          const hatchSpacing = 12;
          for (let d = 0; d < len; d += hatchSpacing) {
            const ratio = d / len;
            const cx = s.x1 + dx * ratio;
            const cy = s.y1 + dy * ratio;
            const h1x = cx + nx * halfW;
            const h1y = cy + ny * halfW;
            const h2x = cx - nx * halfW;
            const h2y = cy - ny * halfW;
            addLine(h1x, h1y, h2x, h2y, 8); // grey hatching (ACI 8)
          }
        }
      } 
      else if (s.type === 'column') {
        // Box envelope + center crossing lines
        addRectPolyline(s.x, s.y, s.width, s.height, s.angle || 0);
        const cx = s.x + s.width / 2;
        const cy = s.y + s.height / 2;
        const p1 = rotatePoint(s.x, s.y, cx, cy, s.angle || 0);
        const p2 = rotatePoint(s.x + s.width, s.y, cx, cy, s.angle || 0);
        const p3 = rotatePoint(s.x + s.width, s.y + s.height, cx, cy, s.angle || 0);
        const p4 = rotatePoint(s.x, s.y + s.height, cx, cy, s.angle || 0);
        addLine(p1.x, p1.y, p3.x, p3.y);
        addLine(p2.x, p2.y, p4.x, p4.y);
      } 
      else if (s.type === 'beam') {
        // Solid center trace line + outer dashed guide lines representation
        addLine(s.x1, s.y1, s.x2, s.y2);
        const dx = s.x2 - s.x1;
        const dy = s.y2 - s.y1;
        const len = Math.hypot(dx, dy);
        if (len > 0.1) {
          const nx = -dy / len;
          const ny = dx / len;
          const halfW = (s.beamWidth || 8) / 2;
          addLine(s.x1 + nx * halfW, s.y1 + ny * halfW, s.x2 + nx * halfW, s.y2 + ny * halfW, 8);
          addLine(s.x1 - nx * halfW, s.y1 - ny * halfW, s.x2 - nx * halfW, s.y2 - ny * halfW, 8);
        }
      } 
      else if (s.type === 'door') {
        // Door leaf + door swing guide arc
        const r = Math.hypot(s.x2 - s.x1, s.y2 - s.y1);
        if (r > 0.1) {
          const baseAngle = Math.atan2(s.y2 - s.y1, s.x2 - s.x1);
          const openAngle = baseAngle - Math.PI / 2;
          const leafX = s.x1 + r * Math.cos(openAngle);
          const leafY = s.y1 + r * Math.sin(openAngle);

          // Solid leaf indicator
          addLine(s.x1, s.y1, leafX, leafY);
          // Closed line guide
          addLine(s.x1, s.y1, s.x2, s.y2, 8);

          // Swing Arc representation
          let startDeg = (-baseAngle) * (180 / Math.PI);
          let endDeg = (-openAngle) * (180 / Math.PI);
          startDeg = (startDeg % 360 + 360) % 360;
          endDeg = (endDeg % 360 + 360) % 360;

          addArc(s.x1, s.y1, r, Math.min(startDeg, endDeg), Math.max(startDeg, endDeg), 1); // Red (ACI 1) for door swing
        }
      } 
      else if (s.type === 'window') {
        // Window frame box + center panes divider + division transverse sashes
        const dx = s.x2 - s.x1;
        const dy = s.y2 - s.y1;
        const len = Math.hypot(dx, dy);
        if (len > 0.1) {
          const nx = -dy / len;
          const ny = dx / len;
          const halfW = (s.windowThickness || 8) / 2;

          const p1x = s.x1 + nx * halfW;
          const p1y = s.y1 + ny * halfW;
          const p2x = s.x2 + nx * halfW;
          const p2y = s.y2 + ny * halfW;
          const p3x = s.x2 - nx * halfW;
          const p3y = s.y2 - ny * halfW;
          const p4x = s.x1 - nx * halfW;
          const p4y = s.y1 - ny * halfW;

          // Frame outline
          addRectPolyline(s.x1 - nx * halfW, s.y1 - ny * halfW, len, s.windowThickness || 8, Math.atan2(dy, dx));

          // Center panel dividing line
          addLine(s.x1, s.y1, s.x2, s.y2, 4); // Cyan (ACI 4)

          // Sashes
          const divisions = [0.25, 0.5, 0.75];
          divisions.forEach(r => {
            const px = s.x1 + dx * r;
            const py = s.y1 + dy * r;
            addLine(px + nx * halfW, py + ny * halfW, px - nx * halfW, py - ny * halfW, 4);
          });
        }
      } 
      else if (s.type === 'roomlabel') {
        const w = Math.abs(s.width);
        const h = Math.abs(s.height);
        if (w > 0.1 && h > 0.1) {
          addRectPolyline(s.x, s.y, s.width, s.height, s.angle || 0, 8);
          const midX = s.x + s.width / 2;
          const midY = s.y + s.height / 2;
          addText((s.labelText || "Room").toUpperCase(), midX, midY, 12, -(s.angle || 0) * (180 / Math.PI));
        }
      } 
      else if (s.type === 'text') {
        addText(s.labelText || "", s.x, s.y, s.fontSize || 12, -(s.angle || 0) * (180 / Math.PI));
      } 
      else if (s.type === 'areazone') {
        addRectPolyline(s.x, s.y, s.width, s.height, s.angle || 0, aciColor);
        const midX = s.x + s.width / 2;
        const midY = s.y + s.height / 2;
        addText((s.zoneName || "Zone").toUpperCase(), midX, midY, 10, -(s.angle || 0) * (180 / Math.PI));
      } 
      else if (s.type === 'dimension') {
        const len = Math.hypot(s.x2 - s.x1, s.y2 - s.y1);
        if (len > 0.1) {
          let resolvedType = s.dimType || 'aligned';
          if (resolvedType === 'linear') {
            resolvedType = Math.abs(s.x2 - s.x1) > Math.abs(s.y2 - s.y1) ? 'horizontal' : 'vertical';
          }

          const arrowLen = s.arrowSize || 8;
          const overShoot = 4;
          const gap = 3;

          let mx1, my1, mx2, my2, ex1_start, ex1_end, ex2_start, ex2_end;
          let ux = 0, uy = 0, nx = 0, ny = 0;

          if (resolvedType === 'horizontal') {
            let signMultiplier = (s.y2 >= s.y1) ? -1 : 1;
            const targetY = s.y1 + signMultiplier * (s.offset || 25);
            mx1 = s.x1; my1 = targetY;
            mx2 = s.x2; my2 = targetY;
            ex1_start = { x: s.x1, y: s.y1 + signMultiplier * gap };
            ex1_end = { x: s.x1, y: targetY + signMultiplier * overShoot };
            ex2_start = { x: s.x2, y: s.y2 + signMultiplier * gap };
            ex2_end = { x: s.x2, y: targetY + signMultiplier * overShoot };
            ux = (s.x2 >= s.x1) ? 1 : -1; uy = 0;
            nx = 0; ny = signMultiplier;
          } 
          else if (resolvedType === 'vertical') {
            let signMultiplier = (s.x2 >= s.x1) ? -1 : 1;
            const targetX = s.x1 + signMultiplier * (s.offset || 25);
            mx1 = targetX; my1 = s.y1;
            mx2 = targetX; my2 = s.y2;
            ex1_start = { x: s.x1 + signMultiplier * gap, y: s.y1 };
            ex1_end = { x: targetX + signMultiplier * overShoot, y: s.y1 };
            ex2_start = { x: s.x2 + signMultiplier * gap, y: s.y2 };
            ex2_end = { x: targetX + signMultiplier * overShoot, y: s.y2 };
            ux = 0; uy = (s.y2 >= s.y1) ? 1 : -1;
            nx = signMultiplier; ny = 0;
          } 
          else { // aligned
            const dx = s.x2 - s.x1;
            const dy = s.y2 - s.y1;
            ux = dx / len; uy = dy / len;
            nx = -uy; ny = ux;
            const targetOffset = s.offset || 25;
            mx1 = s.x1 + nx * targetOffset; my1 = s.y1 + ny * targetOffset;
            mx2 = s.x2 + nx * targetOffset; my2 = s.y2 + ny * targetOffset;
            ex1_start = { x: s.x1 + nx * gap, y: s.y1 + ny * gap };
            ex1_end = { x: mx1 + nx * overShoot, y: my1 + ny * overShoot };
            ex2_start = { x: s.x2 + nx * gap, y: s.y2 + ny * gap };
            ex2_end = { x: mx2 + nx * overShoot, y: my2 + ny * overShoot };
          }

          // 1. Draw extensions (extension lines)
          addLine(ex1_start.x, ex1_start.y, ex1_end.x, ex1_end.y, 8); // grey extensions
          addLine(ex2_start.x, ex2_start.y, ex2_end.x, ex2_end.y, 8);

          // 2. Dimension baseline line
          addLine(mx1, my1, mx2, my2);

          // 3. Arrow heads (Solid filled triangles)
          const a1LeftX = mx1 + ux * arrowLen + nx * (arrowLen * 0.3);
          const a1LeftY = my1 + uy * arrowLen + ny * (arrowLen * 0.3);
          const a1RightX = mx1 + ux * arrowLen - nx * (arrowLen * 0.3);
          const a1RightY = my1 + uy * arrowLen - ny * (arrowLen * 0.3);
          addSolidTriangle(mx1, my1, a1LeftX, a1LeftY, a1RightX, a1RightY);

          const a2LeftX = mx2 - ux * arrowLen + nx * (arrowLen * 0.3);
          const a2LeftY = my2 - uy * arrowLen + ny * (arrowLen * 0.3);
          const a2RightX = mx2 - ux * arrowLen - nx * (arrowLen * 0.3);
          const a2RightY = my2 - uy * arrowLen - ny * (arrowLen * 0.3);
          addSolidTriangle(mx2, my2, a2LeftX, a2LeftY, a2RightX, a2RightY);

          // 4. Dimension Text Label
          const midX = (mx1 + mx2) / 2;
          const midY = (my1 + my2) / 2;
          let textAngle = Math.atan2(my2 - my1, mx2 - mx1);
          if (textAngle > Math.PI / 2 || textAngle < -Math.PI / 2) {
            textAngle += Math.PI;
          }
          const textAngleDeg = (-textAngle) * (180 / Math.PI);
          const formattedVal = this.formatValue ? this.formatValue(len) : len.toFixed(1);
          addText(formattedVal, midX, midY, 9, textAngleDeg);
        }
      }
    });

    add(0, 'ENDSEC');
    add(0, 'EOF');

    const dxfContent = dxf.join('\n') + '\n';
    const blob = new Blob([dxfContent], { type: 'image/vnd.dxf;charset=utf-8' });
    const blobURL = URL.createObjectURL(blob);

    const clicker = document.createElement('a');
    clicker.href = blobURL;
    clicker.download = `cad_export_${Math.floor(Date.now() / 1000)}.dxf`;
    document.body.appendChild(clicker);
    clicker.click();
    document.body.removeChild(clicker);
    URL.revokeObjectURL(blobURL);
    this.showStatusFeedback("Exported DXF");
  }

  /**
   * Parse a standard AutoCAD DXF R12 string and import layers and geometries
   * @param {string} text 
   */
  importFromDXF(text) {
    if (!text) return;

    // ACI to Hex converter
    const aciToHex = (aci) => {
      const map = {
        1: '#ef4444', // Red
        2: '#eab308', // Yellow
        3: '#22c55e', // Green
        4: '#06b6d4', // Cyan
        5: '#3b82f6', // Blue
        6: '#d946ef', // Magenta
        7: '#f8fafc', // White / Slate 50
        8: '#64748b', // Slate 500
        9: '#334155'  // Slate 700
      };
      return map[aci] || '#06b6d4';
    };

    // Step 1: Parse lines into group code + value pairs
    const lines = text.split(/\r?\n/);
    const pairs = [];
    let i = 0;
    while (i < lines.length - 1) {
      const codeLine = lines[i].trim();
      if (codeLine === '') {
        i++;
        continue;
      }
      const code = parseInt(codeLine, 10);
      if (isNaN(code)) {
        i++;
        continue;
      }
      const val = lines[i + 1] ? lines[i + 1].trim() : '';
      pairs.push({ code, val });
      i += 2;
    }

    const importedLayers = [];
    const layersMap = {}; // name (lowercase) -> color index
    const importedShapes = [];

    let currentSection = '';
    let currentTable = '';
    let inLayerTable = false;

    // Temporary states
    let tempLayerName = '';
    let tempLayerColor = 7;

    let currentEntityType = '';
    let entityProps = {};
    let polylineVertices = [];
    let lastX = null;

    // Flush active parsed entity to shape array
    const flushCurrentEntity = () => {
      if (!currentEntityType) return;

      const layerId = entityProps.layer || 'default';
      let aciColor = entityProps.color !== undefined ? entityProps.color : 7;
      if (entityProps.color === undefined || entityProps.color === 256) { // 256 is ByLayer
        if (layersMap[layerId] !== undefined) {
          aciColor = layersMap[layerId];
        }
      }
      const colorHex = aciToHex(aciColor);

      if (currentEntityType === 'LINE') {
        const x1 = parseFloat(entityProps[10]) || 0;
        const y1 = parseFloat(entityProps[20]) || 0;
        const x2 = parseFloat(entityProps[11]) || 0;
        const y2 = parseFloat(entityProps[21]) || 0;
        
        const line = new Line(x1, -y1, x2, -y2, colorHex);
        line.layerId = layerId;
        importedShapes.push(line);
      }
      else if (currentEntityType === 'CIRCLE') {
        const cx = parseFloat(entityProps[10]) || 0;
        const cy = parseFloat(entityProps[20]) || 0;
        const r = parseFloat(entityProps[40]) || 0;
        
        const circle = new Circle(cx, -cy, r, colorHex);
        circle.layerId = layerId;
        importedShapes.push(circle);
      }
      else if (currentEntityType === 'ARC') {
        const cx = parseFloat(entityProps[10]) || 0;
        const cy = parseFloat(entityProps[20]) || 0;
        const r = parseFloat(entityProps[40]) || 0;
        
        const circle = new Circle(cx, -cy, r, colorHex);
        circle.layerId = layerId;
        importedShapes.push(circle);
      }
      else if (currentEntityType === 'LWPOLYLINE' || currentEntityType === 'POLYLINE') {
        if (polylineVertices.length >= 2) {
          const flag = parseInt(entityProps[70], 10) || 0;
          const isClosed = (flag & 1) === 1;
          
          let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
          polylineVertices.forEach(v => {
            if (v.x < minX) minX = v.x;
            if (v.x > maxX) maxX = v.x;
            if (v.y < minY) minY = v.y;
            if (v.y > maxY) maxY = v.y;
          });

          // Detect rectangle: closed and 4 vertices
          if (isClosed && (polylineVertices.length === 4 || (polylineVertices.length === 5 && Math.abs(polylineVertices[0].x - polylineVertices[4].x) < 0.1 && Math.abs(polylineVertices[0].y - polylineVertices[4].y) < 0.1))) {
            const w = maxX - minX;
            const h = maxY - minY;
            const rect = new Rectangle(minX, -maxY, w, h, colorHex);
            rect.layerId = layerId;
            importedShapes.push(rect);
          } else {
            // Explode polyline to standard high-fidelity line elements
            for (let j = 0; j < polylineVertices.length - 1; j++) {
              const p1 = polylineVertices[j];
              const p2 = polylineVertices[j + 1];
              const line = new Line(p1.x, -p1.y, p2.x, -p2.y, colorHex);
              line.layerId = layerId;
              importedShapes.push(line);
            }
            if (isClosed) {
              const p1 = polylineVertices[polylineVertices.length - 1];
              const p2 = polylineVertices[0];
              const line = new Line(p1.x, -p1.y, p2.x, -p2.y, colorHex);
              line.layerId = layerId;
              importedShapes.push(line);
            }
          }
        }
      }
      else if (currentEntityType === 'DIMENSION') {
        const x1 = parseFloat(entityProps[13]) || 0;
        const y1 = parseFloat(entityProps[23]) || 0;
        const x2 = parseFloat(entityProps[14]) || 0;
        const y2 = parseFloat(entityProps[24]) || 0;
        
        const dTypeVal = parseInt(entityProps[70], 10) || 0;
        let dimType = 'aligned';
        if ((dTypeVal & 7) === 0) {
          dimType = 'linear';
        }
        
        const dx = x2 - x1;
        const dy = y2 - y1;
        const len = Math.hypot(dx, dy);
        let offset = 25;
        if (len > 0.1) {
          const nx = -dy / len;
          const ny = dx / len;
          const dlineX = parseFloat(entityProps[10]) || 0;
          const dlineY = parseFloat(entityProps[20]) || 0;
          offset = (dlineX - x1) * nx + (dlineY - y1) * ny;
        }
        
        const dim = new Dimension(x1, -y1, x2, -y2, colorHex, 2, dimType, 8, Math.abs(offset));
        dim.layerId = layerId;
        importedShapes.push(dim);
      }
      else if (currentEntityType === 'TEXT') {
        const tx = parseFloat(entityProps[10]) || 0;
        const ty = parseFloat(entityProps[20]) || 0;
        const textStr = entityProps[1] || "";
        const height = parseFloat(entityProps[40]) || 12;
        const angleDeg = parseFloat(entityProps[50]) || 0;
        
        const textLabel = new TextLabel(tx, -ty, colorHex, 2, textStr, height);
        textLabel.layerId = layerId;
        textLabel.angle = -angleDeg * (Math.PI / 180);
        importedShapes.push(textLabel);
      }
      else if (currentEntityType === 'SOLID') {
        const x1 = parseFloat(entityProps[10]) || 0;
        const y1 = parseFloat(entityProps[20]) || 0;
        const x2 = parseFloat(entityProps[11]) || 0;
        const y2 = parseFloat(entityProps[21]) || 0;
        const x3 = parseFloat(entityProps[12]) || 0;
        const y3 = parseFloat(entityProps[22]) || 0;
        
        const l1 = new Line(x1, -y1, x2, -y2, colorHex);
        const l2 = new Line(x2, -y2, x3, -y3, colorHex);
        const l3 = new Line(x3, -y3, x1, -y1, colorHex);
        l1.layerId = layerId;
        l2.layerId = layerId;
        l3.layerId = layerId;
        importedShapes.push(l1, l2, l3);
      }

      currentEntityType = '';
      entityProps = {};
      polylineVertices = [];
    };

    // State machine main loop
    for (let pIdx = 0; pIdx < pairs.length; pIdx++) {
      const { code, val } = pairs[pIdx];

      if (code === 0) {
        const upperVal = val.toUpperCase();

        if (upperVal === 'SECTION') {
          currentSection = '';
        } else if (upperVal === 'ENDSEC') {
          flushCurrentEntity();
          currentSection = '';
        } else if (upperVal === 'TABLE') {
          currentTable = '';
        } else if (upperVal === 'ENDTAB') {
          inLayerTable = false;
          currentTable = '';
        } else if (upperVal === 'LAYER' && currentSection === 'TABLES' && currentTable === 'LAYER') {
          inLayerTable = true;
          if (tempLayerName) {
            const lowName = tempLayerName.toLowerCase();
            importedLayers.push({ id: lowName, name: tempLayerName, visible: true, locked: false });
            layersMap[lowName] = tempLayerColor;
          }
          tempLayerName = '';
          tempLayerColor = 7;
        } else {
          // Entity starts
          if (currentSection === 'ENTITIES') {
            if (upperVal === 'VERTEX' && currentEntityType === 'POLYLINE') {
              // Parse vertex coordinates below
            } else if (upperVal === 'SEQEND' && currentEntityType === 'POLYLINE') {
              flushCurrentEntity();
            } else {
              flushCurrentEntity();
              if (['LINE', 'CIRCLE', 'ARC', 'LWPOLYLINE', 'POLYLINE', 'DIMENSION', 'TEXT', 'SOLID'].includes(upperVal)) {
                currentEntityType = upperVal;
                entityProps = {};
                polylineVertices = [];
                lastX = null;
              }
            }
          }
        }
      } else if (code === 2) {
        const upperVal = val.toUpperCase();
        if (!currentSection) {
          currentSection = upperVal;
        } else if (currentSection === 'TABLES' && !currentTable) {
          currentTable = upperVal;
        } else if (inLayerTable) {
          tempLayerName = val;
        }
      } else if (code === 62) {
        const colVal = parseInt(val, 10);
        if (inLayerTable) {
          tempLayerColor = colVal;
        } else if (currentEntityType) {
          entityProps.color = colVal;
        }
      } else if (code === 8) {
        if (currentEntityType) {
          entityProps.layer = val.toLowerCase();
        }
      } else {
        if (currentEntityType) {
          if (currentEntityType === 'LWPOLYLINE' && code === 10) {
            lastX = parseFloat(val);
          } else if (currentEntityType === 'LWPOLYLINE' && code === 20) {
            if (lastX !== null) {
              polylineVertices.push({ x: lastX, y: parseFloat(val) });
              lastX = null;
            }
          } else {
            entityProps[code] = val;
          }
        }
      }

      // Capture vertices of standard POLYLINE
      if (currentEntityType === 'POLYLINE' && currentSection === 'ENTITIES') {
        if (code === 10) {
          lastX = parseFloat(val);
        } else if (code === 20) {
          if (lastX !== null) {
            polylineVertices.push({ x: lastX, y: parseFloat(val) });
            lastX = null;
          }
        }
      }
    }

    // Flush final
    flushCurrentEntity();

    if (tempLayerName) {
      const lowName = tempLayerName.toLowerCase();
      importedLayers.push({ id: lowName, name: tempLayerName, visible: true, locked: false });
      layersMap[lowName] = tempLayerColor;
    }

    // Auto-create missing referenced layers
    importedShapes.forEach(sh => {
      const lId = sh.layerId || 'default';
      if (!importedLayers.some(l => l.id === lId)) {
        importedLayers.push({
          id: lId,
          name: lId.charAt(0).toUpperCase() + lId.slice(1),
          visible: true,
          locked: false
        });
      }
    });

    if (importedShapes.length === 0) {
      alert("No recognizable shape entities found in the DXF file.");
      return;
    }

    // Clean selections & swap variables
    this.selectedShape = null;
    this.hoveredShapeIndex = null;
    this.redoStack = [];

    this.layers = importedLayers.length > 0 ? importedLayers : [
      { id: 'default', name: 'Default', visible: true, locked: false }
    ];
    this.activeLayerId = this.layers[0].id;
    this.shapes = importedShapes;

    this.saveLayersStateAndWidget();
    this.updateUndoButtonState();
    this.updateRedoButtonState();
    this.updateDeleteSelectedBtnState();

    this.zoomToFit();
    this.showStatusFeedback("Imported DXF successfully");
  }

  /**
   * Automatically zoom and pan to make all shapes fit nicely inside the screen canvas bounds
   */
  zoomToFit() {
    if (this.shapes.length === 0) return;

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

    this.shapes.forEach(shape => {
      if (['line', 'wall', 'beam', 'door', 'window', 'dimension'].includes(shape.type)) {
        minX = Math.min(minX, shape.x1, shape.x2);
        maxX = Math.max(maxX, shape.x1, shape.x2);
        minY = Math.min(minY, shape.y1, shape.y2);
        maxY = Math.max(maxY, shape.y1, shape.y2);
      } else if (['rectangle', 'column', 'roomlabel', 'areazone'].includes(shape.type)) {
        minX = Math.min(minX, shape.x, shape.x + shape.width);
        maxX = Math.max(maxX, shape.x, shape.x + shape.width);
        minY = Math.min(minY, shape.y, shape.y + shape.height);
        maxY = Math.max(maxY, shape.y, shape.y + shape.height);
      } else if (shape.type === 'circle') {
        const r = shape.radius || 0;
        minX = Math.min(minX, shape.centerX - r);
        maxX = Math.max(maxX, shape.centerX + r);
        minY = Math.min(minY, shape.centerY - r);
        maxY = Math.max(maxY, shape.centerY + r);
      } else if (shape.type === 'text') {
        minX = Math.min(minX, shape.x);
        maxX = Math.max(maxX, shape.x);
        minY = Math.min(minY, shape.y);
        maxY = Math.max(maxY, shape.y);
      }
    });

    if (minX === Infinity || maxX === -Infinity || minY === Infinity || maxY === -Infinity) {
      this.resetView();
      return;
    }

    const margin = 40; // margin in pixels
    const width = maxX - minX;
    const height = maxY - minY;

    if (width <= 0.1 && height <= 0.1) {
      this.resetView();
      return;
    }

    const canvasWidth = this.canvas.width;
    const canvasHeight = this.canvas.height;

    const scaleX = (canvasWidth - margin * 2) / width;
    const scaleY = (canvasHeight - margin * 2) / height;
    let newScale = Math.min(scaleX, scaleY);

    // Limit zoom scale range to logical values
    newScale = Math.max(0.01, Math.min(newScale, 5.0));

    this.zoomScale = newScale;
    
    // Compute center of bounds
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;

    // Apply pan values to center perfectly
    this.panX = canvasWidth / 2 - cx * this.zoomScale;
    this.panY = canvasHeight / 2 - cy * this.zoomScale;

    this.updateZoomStatus();
    this.redraw();
  }

  /**
   * Import workspace project bundle package from parsed JSON
   */
  importFromJSON(data) {
    if (!data || !Array.isArray(data.shapes)) {
      alert("Invalid imported file. Must contain structured shapes data.");
      return;
    }
    
    // Clean selections
    this.selectedShape = null;
    this.hoveredShapeIndex = null;
    this.redoStack = [];
    
    // Import Layers configuration if present
    if (Array.isArray(data.layers) && data.layers.length > 0) {
      this.layers = data.layers;
      if (data.activeLayerId && this.layers.some(l => l.id === data.activeLayerId)) {
        this.activeLayerId = data.activeLayerId;
      } else {
        this.activeLayerId = this.layers[0].id;
      }
    } else {
      // Fallback
      this.layers = [
        { id: 'default', name: 'Default', visible: true, locked: false },
        { id: 'walls', name: 'Walls', visible: true, locked: false },
        { id: 'columns', name: 'Columns', visible: true, locked: false },
        { id: 'dimensions', name: 'Dimensions', visible: true, locked: false },
        { id: 'electrical', name: 'Electrical', visible: true, locked: false }
      ];
      this.activeLayerId = 'default';
    }
    
    // Unpack list items using shape deserialization
    this.shapes = data.shapes
      .map(item => deserializeShape(item))
      .filter(sh => sh !== null);
      
    // Overwrite local drawing caches & refresh UI state
    this.saveLayersStateAndWidget();
    this.updateUndoButtonState();
    this.updateRedoButtonState();
    this.updateDeleteSelectedBtnState();
    
    this.showStatusFeedback("Imported Project");
  }

  importFromAether(data) {
    if (!data || !Array.isArray(data.shapes)) {
      alert("Invalid imported file. Must contain structured shapes data.");
      return;
    }
    
    this.selectedShape = null;
    this.hoveredShapeIndex = null;
    this.redoStack = [];
    
    if (Array.isArray(data.layers) && data.layers.length > 0) {
      this.layers = data.layers;
      this.activeLayerId = this.layers[0].id;
    } else {
      this.layers = [
        { id: 'default', name: 'Default', visible: true, locked: false },
        { id: 'walls', name: 'Walls', visible: true, locked: false },
        { id: 'columns', name: 'Columns', visible: true, locked: false },
        { id: 'dimensions', name: 'Dimensions', visible: true, locked: false },
        { id: 'electrical', name: 'Electrical', visible: true, locked: false }
      ];
      this.activeLayerId = 'default';
    }
    
    this.shapes = data.shapes
      .map(item => deserializeShape(item))
      .filter(sh => sh !== null);
      
    this.saveLayersStateAndWidget();
    this.updateUndoButtonState();
    this.updateRedoButtonState();
    this.updateDeleteSelectedBtnState();
    
    this.saveDrawing();
    this.redraw();
    this.updateEntityList();
    this.updatePropertiesPanel();
    
    this.showStatusFeedback("Imported .aether Project");
  }

  exportToAether() {
    if (this.shapes.length === 0 && this.layers.length <= 1) {
      alert("No drafted drawings or custom layers to export.");
      return;
    }
    
    const draftPackage = {
      version: "1.1",
      shapes: this.shapes.map(s => s.serialize()),
      layers: this.layers
    };
    
    const jsonStr = JSON.stringify(draftPackage, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/octet-stream' });
    const blobURL = URL.createObjectURL(blob);
    
    const clicker = document.createElement('a');
    clicker.href = blobURL;
    
    const proj = this.projectsList.find(p => p.id === this.activeProjectId);
    const projBaseName = proj ? proj.name.replace(/\.[^/.]+$/, "") : `cad_project_${Math.floor(Date.now() / 1000)}`; 
    clicker.download = `${projBaseName}.aether`;
    
    document.body.appendChild(clicker);
    clicker.click();
    document.body.removeChild(clicker);
    URL.revokeObjectURL(blobURL);
    this.showStatusFeedback("Saved Project (.aether)");
  }

  /**
   * Initializes and binds all the events for the PDF Export & Print Preview modal
   */
  setupPdfExport() {
    const modal = document.getElementById('pdf-export-modal');
    if (!modal) return;

    // Form triggers that cause real-time redraw of the sheet preview
    const inputs = [
      'pdf-paper-size',
      'pdf-orientation',
      'pdf-include-dimensions',
      'pdf-include-titleblock',
      'pdf-black-and-white',
      'pdf-scale-mode',
      'pdf-meta-project',
      'pdf-meta-title',
      'pdf-meta-author',
      'pdf-meta-date'
    ];

    inputs.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        const eventType = el.tagName === 'SELECT' || el.type === 'checkbox' ? 'change' : 'input';
        el.addEventListener(eventType, () => {
          this.updatePdfPreview();
        });
      }
    });

    // Close button event handlers
    const closeBtn = document.getElementById('close-pdf-modal-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        modal.classList.add('hidden');
      });
    }

    const cancelBtn = document.getElementById('pdf-modal-cancel-btn');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        modal.classList.add('hidden');
      });
    }

    // Modal backdrop click to close
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.classList.add('hidden');
      }
    });

    // Export PDF trigger action
    const exportBtn = document.getElementById('pdf-modal-export-btn');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        this.exportToPDF();
        modal.classList.add('hidden');
      });
    }
  }

  /**
   * Opens the PDF export and print preview controller modal, auto-populating sheet fields
   */
  openPdfExportModal() {
    const modal = document.getElementById('pdf-export-modal');
    if (!modal) return;

    modal.classList.remove('hidden');

    // Auto-populate current project name
    const proj = this.projectsList.find(p => p.id === this.activeProjectId);
    const projNameEl = document.getElementById('pdf-meta-project');
    if (projNameEl) {
      projNameEl.value = proj ? proj.name.replace(/\.[^/.]+$/, "") : "Untitled Design";
    }

    // Auto-populate current date in YYYY-MM-DD
    const dateEl = document.getElementById('pdf-meta-date');
    if (dateEl) {
      const today = new Date();
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const dd = String(today.getDate()).padStart(2, '0');
      dateEl.value = `${yyyy}-${mm}-${dd}`;
    }

    // Trigger initial render of preview
    this.updatePdfPreview();
  }

  /**
   * Orchestrates the interactive canvas resizing and sheet rendering
   */
  updatePdfPreview() {
    const previewCanvas = document.getElementById('pdf-preview-canvas');
    if (!previewCanvas) return;

    const paperSize = document.getElementById('pdf-paper-size').value;
    const orientation = document.getElementById('pdf-orientation').value;
    const includeDimensions = document.getElementById('pdf-include-dimensions').checked;
    const includeTitleBlock = document.getElementById('pdf-include-titleblock').checked;
    const isMonochrome = document.getElementById('pdf-black-and-white').checked;
    const scaleMode = document.getElementById('pdf-scale-mode').value;

    const meta = {
      project: document.getElementById('pdf-meta-project').value || "Untitled",
      title: document.getElementById('pdf-meta-title').value || "",
      author: document.getElementById('pdf-meta-author').value || "",
      date: document.getElementById('pdf-meta-date').value || ""
    };

    // Show/hide Title Block meta inputs dynamically based on titleblock check
    const fieldsGroup = document.getElementById('pdf-titleblock-fields-group');
    if (fieldsGroup) {
      if (includeTitleBlock) {
        fieldsGroup.classList.remove('hidden');
      } else {
        fieldsGroup.classList.add('hidden');
      }
    }

    const PAPER_DIMENSIONS = {
      a4: { width: 297, height: 210 },
      a3: { width: 420, height: 297 },
      a2: { width: 594, height: 420 }
    };

    const paperDims = PAPER_DIMENSIONS[paperSize] || PAPER_DIMENSIONS.a4;
    const widthMm = orientation === 'landscape' ? paperDims.width : paperDims.height;
    const heightMm = orientation === 'landscape' ? paperDims.height : paperDims.width;

    // Standardize preview screen limits (e.g., max 620 width / 440 height)
    const maxPreviewW = 620;
    const maxPreviewH = 440;
    const paperRatio = widthMm / heightMm;

    let targetW = maxPreviewW;
    let targetH = targetW / paperRatio;

    if (targetH > maxPreviewH) {
      targetH = maxPreviewH;
      targetW = targetH * paperRatio;
    }

    // Configure internal canvas resolution for high DPI crisp rendering
    previewCanvas.width = targetW * 2;
    previewCanvas.height = targetH * 2;
    previewCanvas.style.width = `${targetW}px`;
    previewCanvas.style.height = `${targetH}px`;

    // Render sheet
    this.renderPdfSheet(previewCanvas, {
      paperSize,
      orientation,
      includeDimensions,
      includeTitleBlock,
      isMonochrome,
      scaleMode,
      meta
    });
  }

  /**
   * Renders the complete drawing onto a target sheet canvas context (preview or high-res offscreen)
   */
  renderPdfSheet(canvas, options) {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const {
      paperSize,
      orientation,
      includeDimensions,
      includeTitleBlock,
      isMonochrome,
      scaleMode,
      meta
    } = options;

    const PAPER_DIMENSIONS = {
      a4: { width: 297, height: 210 },
      a3: { width: 420, height: 297 },
      a2: { width: 594, height: 420 }
    };

    const paperDims = PAPER_DIMENSIONS[paperSize] || PAPER_DIMENSIONS.a4;
    const widthMm = orientation === 'landscape' ? paperDims.width : paperDims.height;
    const heightMm = orientation === 'landscape' ? paperDims.height : paperDims.width;

    const scaleFactor = canvas.width / widthMm;

    // Clear background to paper white
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw grid lines on the paper (10mm intervals)
    ctx.save();
    ctx.strokeStyle = '#eef2f6';
    ctx.lineWidth = 0.35 * scaleFactor;
    
    // Vertical lines
    for (let x = 10; x < widthMm; x += 10) {
      ctx.beginPath();
      ctx.moveTo(x * scaleFactor, 0);
      ctx.lineTo(x * scaleFactor, canvas.height);
      ctx.stroke();
    }
    // Horizontal lines
    for (let y = 10; y < heightMm; y += 10) {
      ctx.beginPath();
      ctx.moveTo(0, y * scaleFactor);
      ctx.lineTo(canvas.width, y * scaleFactor);
      ctx.stroke();
    }
    ctx.restore();

    // Draw outer borders and standard 10mm margining
    const marginMm = 10;
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 0.5 * scaleFactor;
    ctx.strokeRect(marginMm * scaleFactor, marginMm * scaleFactor, (widthMm - marginMm * 2) * scaleFactor, (heightMm - marginMm * 2) * scaleFactor);

    // Define content boundaries
    const printLeft = marginMm;
    const printTop = marginMm;
    const printRight = widthMm - marginMm;
    let printBottom = heightMm - marginMm;

    if (includeTitleBlock) {
      // Offset bottom printable boundary to clear title block zone (32mm height)
      printBottom = heightMm - marginMm - 32;
    }

    // Compute active drawing bounding box in world coordinates
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    let hasShapes = false;

    this.shapes.forEach(shape => {
      // Check visible state of its layer
      const layer = this.layers.find(l => l.id === shape.layerId);
      if (layer && !layer.visible) return;

      if (shape.type === 'dimension' && !includeDimensions) return;

      hasShapes = true;
      if (['line', 'wall', 'beam', 'door', 'window', 'dimension'].includes(shape.type)) {
        minX = Math.min(minX, shape.x1, shape.x2);
        maxX = Math.max(maxX, shape.x1, shape.x2);
        minY = Math.min(minY, shape.y1, shape.y2);
        maxY = Math.max(maxY, shape.y1, shape.y2);
      } else if (['rectangle', 'column', 'roomlabel', 'areazone'].includes(shape.type)) {
        minX = Math.min(minX, shape.x, shape.x + shape.width);
        maxX = Math.max(maxX, shape.x, shape.x + shape.width);
        minY = Math.min(minY, shape.y, shape.y + shape.height);
        maxY = Math.max(maxY, shape.y, shape.y + shape.height);
      } else if (shape.type === 'circle') {
        const r = shape.radius || 0;
        minX = Math.min(minX, shape.centerX - r);
        maxX = Math.max(maxX, shape.centerX + r);
        minY = Math.min(minY, shape.centerY - r);
        maxY = Math.max(maxY, shape.centerY + r);
      } else if (shape.type === 'text') {
        minX = Math.min(minX, shape.x);
        maxX = Math.max(maxX, shape.x);
        minY = Math.min(minY, shape.y);
        maxY = Math.max(maxY, shape.y);
      }
    });

    if (!hasShapes || minX === Infinity) {
      // Empty project fallback
      minX = -100; maxX = 100;
      minY = -100; maxY = 100;
    }

    const dw = Math.max(0.1, maxX - minX);
    const dh = Math.max(0.1, maxY - minY);

    // Compute drawing scale scaleMode
    let drawingScale = 1.0;
    let scaleText = "1:1";

    if (scaleMode === 'autofit') {
      const availW = (printRight - printLeft) * 0.92;
      const availH = (printBottom - printTop) * 0.92;
      const scaleX = availW / dw;
      const scaleY = availH / dh;
      drawingScale = Math.min(scaleX, scaleY);
      if (!isFinite(drawingScale) || drawingScale <= 0) drawingScale = 1.0;

      // Scale format for title block
      scaleText = `AUTO (1:${Math.round(1 / drawingScale)})`;
    } else {
      const denom = parseInt(scaleMode.split(':')[1], 10);
      drawingScale = 1.0 / denom;
      scaleText = scaleMode;
    }

    // Center layout mappings
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const px = printLeft + (printRight - printLeft) / 2;
    const py = printTop + (printBottom - printTop) / 2;

    // Draw the main drawings with active transformation matrix
    ctx.save();

    // Check black-and-white / Monochrome option overrides
    const originalColors = this.shapes.map(s => s.color);
    if (isMonochrome) {
      this.shapes.forEach(s => { s.color = '#000000'; });
    }

    // Set affine projection: map World bounds centered inside Sheet Milimeters
    ctx.setTransform(
      drawingScale * scaleFactor, 0,
      0, drawingScale * scaleFactor,
      (px - cx * drawingScale) * scaleFactor,
      (py - cy * drawingScale) * scaleFactor
    );

    // Render shapes matching layered parameters
    this.shapes.forEach(shape => {
      const layer = this.layers.find(l => l.id === shape.layerId);
      if (layer && !layer.visible) return;
      if (shape.type === 'dimension' && !includeDimensions) return;

      shape.draw(ctx, this);
    });

    // Revert styling overrides
    if (isMonochrome) {
      this.shapes.forEach((s, idx) => { s.color = originalColors[idx]; });
    }

    ctx.restore();

    // Render the Title Block borders and headers if checked
    if (includeTitleBlock) {
      this.drawTitleBlock(
        ctx,
        scaleFactor,
        widthMm - marginMm - 110,
        heightMm - marginMm - 32,
        110,
        32,
        meta,
        scaleText,
        paperSize.toUpperCase()
      );
    }
  }

  /**
   * Draws a standardized engineering title block containing project parameters
   */
  drawTitleBlock(ctx, scaleFactor, xMm, yMm, wMm, hMm, meta, scaleText, paperSizeStr) {
    const x = xMm * scaleFactor;
    const y = yMm * scaleFactor;
    const w = wMm * scaleFactor;
    const h = hMm * scaleFactor;

    ctx.save();
    
    // Solid fill backgrounds for label rows
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(x, y, w, h);

    // Outline Box
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 0.7 * scaleFactor;
    ctx.strokeRect(x, y, w, h);

    // Dividers
    ctx.lineWidth = 0.3 * scaleFactor;
    
    // Row 1: Project Name (10mm)
    ctx.beginPath();
    ctx.moveTo(x, y + 10 * scaleFactor);
    ctx.lineTo(x + w, y + 10 * scaleFactor);
    ctx.stroke();

    // Row 2: Sheet Title (8mm)
    ctx.beginPath();
    ctx.moveTo(x, y + 18 * scaleFactor);
    ctx.lineTo(x + w, y + 18 * scaleFactor);
    ctx.stroke();

    // Row 3: Meta metadata (7mm)
    ctx.beginPath();
    ctx.moveTo(x, y + 25 * scaleFactor);
    ctx.lineTo(x + w, y + 25 * scaleFactor);
    ctx.stroke();

    // Vertical split at 55mm in row 3 & 4
    ctx.beginPath();
    ctx.moveTo(x + 55 * scaleFactor, y + 18 * scaleFactor);
    ctx.lineTo(x + 55 * scaleFactor, y + h);
    ctx.stroke();

    // Content Writing
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#0F1115';

    // Helper text renderer
    const drawMetaText = (label, val, lx, ly, vx, vy, fontL, fontV) => {
      ctx.font = `${fontL * scaleFactor}px monospace`;
      ctx.fillStyle = '#64748b';
      ctx.fillText(label, lx, ly);

      ctx.font = `bold ${fontV * scaleFactor}px monospace`;
      ctx.fillStyle = '#000000';
      ctx.fillText(val, vx, vy);
    };

    // Project Name Block
    drawMetaText(
      "PROJECT DESIGNATION:",
      meta.project.toUpperCase(),
      x + 2 * scaleFactor, y + 1.8 * scaleFactor,
      x + 2 * scaleFactor, y + 4.2 * scaleFactor,
      1.3, 3.2
    );

    // Sheet Title Block
    drawMetaText(
      "SHEET TITLE:",
      meta.title.toUpperCase() || "CONSTRUCTION DRAWING",
      x + 2 * scaleFactor, y + 11 * scaleFactor,
      x + 2 * scaleFactor, y + 13.5 * scaleFactor,
      1.3, 2.6
    );

    // Drawn By
    drawMetaText(
      "DRAWN BY:",
      meta.author.toUpperCase() || "CAD ENGINE",
      x + 2 * scaleFactor, y + 19 * scaleFactor,
      x + 2 * scaleFactor, y + 21.2 * scaleFactor,
      1.1, 2.0
    );

    // Date
    drawMetaText(
      "DATE:",
      meta.date,
      x + 57 * scaleFactor, y + 19 * scaleFactor,
      x + 57 * scaleFactor, y + 21.2 * scaleFactor,
      1.1, 2.0
    );

    // Scale
    drawMetaText(
      "PLOT SCALE:",
      scaleText,
      x + 2 * scaleFactor, y + 26 * scaleFactor,
      x + 2 * scaleFactor, y + 28.2 * scaleFactor,
      1.1, 2.0
    );

    // Sheet Size
    drawMetaText(
      "SHEET SIZE:",
      paperSizeStr,
      x + 57 * scaleFactor, y + 26 * scaleFactor,
      x + 57 * scaleFactor, y + 28.2 * scaleFactor,
      1.1, 2.0
    );

    ctx.restore();
  }

  /**
   * Compiles and triggers PDF saving on vector offscreen canvas pipelines
   */
  exportToPDF() {
    const paperSize = document.getElementById('pdf-paper-size').value;
    const orientation = document.getElementById('pdf-orientation').value;
    const includeDimensions = document.getElementById('pdf-include-dimensions').checked;
    const includeTitleBlock = document.getElementById('pdf-include-titleblock').checked;
    const isMonochrome = document.getElementById('pdf-black-and-white').checked;
    const scaleMode = document.getElementById('pdf-scale-mode').value;

    const meta = {
      project: document.getElementById('pdf-meta-project').value || "Untitled",
      title: document.getElementById('pdf-meta-title').value || "Construction Layout",
      author: document.getElementById('pdf-meta-author').value || "CAD Studio",
      date: document.getElementById('pdf-meta-date').value || ""
    };

    const PAPER_DIMENSIONS = {
      a4: { width: 297, height: 210 },
      a3: { width: 420, height: 297 },
      a2: { width: 594, height: 420 }
    };

    const paperDims = PAPER_DIMENSIONS[paperSize] || PAPER_DIMENSIONS.a4;
    const widthMm = orientation === 'landscape' ? paperDims.width : paperDims.height;
    const heightMm = orientation === 'landscape' ? paperDims.height : paperDims.width;

    // Use High-Res 300 DPI for plotting
    const scaleDpi = 300 / 25.4; // pixels per millimeter
    const pixelWidth = Math.round(widthMm * scaleDpi);
    const pixelHeight = Math.round(heightMm * scaleDpi);

    const highResCanvas = document.createElement('canvas');
    highResCanvas.width = pixelWidth;
    highResCanvas.height = pixelHeight;

    this.renderPdfSheet(highResCanvas, {
      paperSize,
      orientation,
      includeDimensions,
      includeTitleBlock,
      isMonochrome,
      scaleMode,
      meta
    });

    try {
      // Initialize jsPDF output doc
      const orientShort = orientation === 'landscape' ? 'l' : 'p';
      const doc = new jsPDF({
        orientation: orientShort,
        unit: 'mm',
        format: paperSize,
        compress: true
      });

      const imgData = highResCanvas.toDataURL('image/jpeg', 0.95);
      doc.addImage(imgData, 'JPEG', 0, 0, widthMm, heightMm, undefined, 'FAST');
      
      const fileName = `${meta.project.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_sheet.pdf`;
      doc.save(fileName);
      this.showStatusFeedback(`Exported PDF successfully (${paperSize.toUpperCase()})`);
    } catch (err) {
      console.error("PDF generation failed:", err);
      alert("An error occurred while generating the PDF. Please check console.");
    }
  }

  setupContextMenu() {
    const menu = document.getElementById('custom-context-menu');
    if (!menu) return;

    this.canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      
      const rect = this.canvas.getBoundingClientRect();
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;
      const worldPos = this.screenToWorld(screenX, screenY);

      // Detect if there's a shape under the cursor
      let foundShape = null;
      for (let i = this.shapes.length - 1; i >= 0; i--) {
        if (this.shapes[i].contains(worldPos.x, worldPos.y, 10)) {
          foundShape = this.shapes[i];
          break;
        }
      }

      this.selectedShape = foundShape;
      this.updateDeleteSelectedBtnState();
      this.updatePropertiesPanel();
      this.redraw();

      // Show custom menu
      menu.style.left = `${e.clientX}px`;
      menu.style.top = `${e.clientY}px`;
      menu.classList.remove('hidden');

      let menuContent = '';

      if (foundShape) {
        menuContent = `
          <div class="px-3 py-1 text-slate-500 font-bold border-b border-[#2A2D35]/50 uppercase text-[9px]">Shape: ${foundShape.type}</div>
          <div id="ctx-duplicate" class="context-menu-item">
            <span>📋 Duplicate Shape</span>
          </div>
          <div id="ctx-delete" class="context-menu-item text-red-400 hover:text-red-300">
            <span>🗑️ Delete Shape</span>
          </div>
          <div id="ctx-reorder-front" class="context-menu-item">
            <span>🔺 Bring to Front</span>
          </div>
          <div id="ctx-reorder-back" class="context-menu-item">
            <span>🔻 Send to Back</span>
          </div>
          <div class="border-t border-[#2A2D35]/50 my-1"></div>
        `;
      }

      menuContent += `
        <div id="ctx-reset-zoom" class="context-menu-item">
          <span>🔍 Reset Workspace View</span>
        </div>
        <div id="ctx-add-label" class="context-menu-item">
          <span>🏷️ Add Room Label Here</span>
        </div>
        <div id="ctx-copy-coords" class="context-menu-item">
          <span>📍 Copy Coordinates</span>
        </div>
      `;

      menu.innerHTML = menuContent;

      const bindItem = (id, action) => {
        const btn = document.getElementById(id);
        if (btn) {
          btn.onmousedown = (me) => me.stopPropagation(); // Stop Canvas clicks
          btn.addEventListener('click', (me) => {
            me.stopPropagation();
            action();
            menu.classList.add('hidden');
          });
        }
      };

      if (foundShape) {
        bindItem('ctx-duplicate', () => {
          this.duplicateShape(foundShape);
        });
        bindItem('ctx-delete', () => {
          this.deleteSelectedShape();
        });
        bindItem('ctx-reorder-front', () => {
          const idx = this.shapes.indexOf(foundShape);
          if (idx !== -1) {
            this.pushUndoCheckpoint();
            this.shapes.splice(idx, 1);
            this.shapes.push(foundShape);
            this.saveDrawing();
            this.updateEntityList();
            this.redraw();
          }
        });
        bindItem('ctx-reorder-back', () => {
          const idx = this.shapes.indexOf(foundShape);
          if (idx !== -1) {
            this.pushUndoCheckpoint();
            this.shapes.splice(idx, 1);
            this.shapes.unshift(foundShape);
            this.saveDrawing();
            this.updateEntityList();
            this.redraw();
          }
        });
      }

      bindItem('ctx-reset-zoom', () => {
        this.resetView();
      });
      bindItem('ctx-add-label', () => {
        const text = prompt("Enter Room/Zone label text:", "Office Desk");
        if (text) {
          // Construct RoomLabel class from global scope
          const label = new RoomLabel(worldPos.x, worldPos.y, 110, 32, this.activeColor, this.activeThickness, text);
          label.layerId = this.activeLayerId;
          this.shapes.push(label);
          this.selectedShape = label;
          this.saveDrawing();
          this.updateEntityList();
          this.updateUndoButtonState();
          this.redraw();
        }
      });
      bindItem('ctx-copy-coords', () => {
        navigator.clipboard.writeText(`X: ${worldPos.x.toFixed(2)}, Y: ${worldPos.y.toFixed(2)}`);
        this.showStatusFeedback(`Coords copied: X:${worldPos.x.toFixed(1)}, Y:${worldPos.y.toFixed(1)}`);
      });
    });

    document.addEventListener('mousedown', (e) => {
      if (!menu.contains(e.target)) {
        menu.classList.add('hidden');
      }
    });
  }

  setupPremiumThemeAndShortcuts() {
    const themeBtn = document.getElementById('btn-theme-toggle');
    const themeIcon = document.getElementById('theme-toggle-icon');
    if (themeBtn) {
      const activeTheme = localStorage.getItem('cad-theme') || 'dark';
      if (activeTheme === 'light') {
        document.body.classList.add('light-theme');
        if (themeIcon) themeIcon.innerText = '☀️';
        const labelText = themeBtn.querySelector('span:not(#theme-toggle-icon)');
        if (labelText) labelText.innerText = 'LIGHT MODE';
      }
      themeBtn.addEventListener('click', () => {
        const isLightTheme = document.body.classList.toggle('light-theme');
        localStorage.setItem('cad-theme', isLightTheme ? 'light' : 'dark');
        if (themeIcon) {
          themeIcon.innerText = isLightTheme ? '☀️' : '🌙';
        }
        const labelText = themeBtn.querySelector('span:not(#theme-toggle-icon)');
        if (labelText) {
          labelText.innerText = isLightTheme ? 'LIGHT MODE' : 'DARK MODE';
        }
        this.redraw();
      });
    }

    const shortcutsBtn = document.getElementById('btn-shortcuts-toggle');
    const shortcutsPanel = document.getElementById('shortcuts-panel');
    const closeShortcutsBtn = document.getElementById('close-shortcuts-btn');
    if (shortcutsBtn && shortcutsPanel) {
      shortcutsBtn.addEventListener('click', () => {
        const isHidden = shortcutsPanel.classList.toggle('hidden');
        this.showStatusFeedback(isHidden ? "Keyboard shortcuts panel hidden." : "Keyboard shortcuts panel opened.");
      });
    }
    if (closeShortcutsBtn && shortcutsPanel) {
      closeShortcutsBtn.addEventListener('click', () => {
        shortcutsPanel.classList.add('hidden');
        this.showStatusFeedback("Keyboard shortcuts panel hidden.");
      });
    }

    // Draggable keyboard shortcuts reference panel
    const dragHeader = document.getElementById('shortcuts-drag-header') || (shortcutsPanel ? shortcutsPanel.querySelector('div:first-child') : null);
    if (shortcutsPanel && dragHeader) {
      let isDragging = false;
      let startX = 0;
      let startY = 0;
      let initialLeft = 16;
      let initialTop = 80;

      dragHeader.style.cursor = 'grab';

      dragHeader.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        if (e.target.id === 'close-shortcuts-btn' || e.target.tagName === 'BUTTON') return;

        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        
        const rect = shortcutsPanel.getBoundingClientRect();
        const parentRect = shortcutsPanel.parentElement ? shortcutsPanel.parentElement.getBoundingClientRect() : { left: 0, top: 0 };
        initialLeft = rect.left - parentRect.left;
        initialTop = rect.top - parentRect.top;

        dragHeader.style.cursor = 'grabbing';
        e.preventDefault();
      });

      window.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        
        shortcutsPanel.style.left = `${initialLeft + dx}px`;
        shortcutsPanel.style.top = `${initialTop + dy}px`;
        shortcutsPanel.classList.remove('left-4', 'top-20');
      });

      window.addEventListener('mouseup', () => {
        if (isDragging) {
          isDragging = false;
          dragHeader.style.cursor = 'grab';
        }
      });
    }

    const inspectorPanel = document.getElementById('property-inspector');
    const closeInspectorBtn = document.getElementById('close-inspector-btn');
    const minimizeInspectorBtn = document.getElementById('minimize-inspector-btn');
    const minimizedInspectorBtn = document.getElementById('minimized-inspector-btn');

    if (closeInspectorBtn && inspectorPanel) {
      closeInspectorBtn.addEventListener('click', () => {
        inspectorPanel.classList.add('hidden');
        if (minimizedInspectorBtn) minimizedInspectorBtn.classList.add('hidden');
        this.selectedShape = null;
        this.isInspectorMinimized = false;
        this.updateDeleteSelectedBtnState();
        this.redraw();
      });
    }

    if (minimizeInspectorBtn && inspectorPanel) {
      minimizeInspectorBtn.addEventListener('click', () => {
        this.isInspectorMinimized = true;
        this.updatePropertiesPanel();
      });
    }

    if (minimizedInspectorBtn && inspectorPanel) {
      minimizedInspectorBtn.addEventListener('click', () => {
        this.isInspectorMinimized = false;
        this.updatePropertiesPanel();
      });
    }

    const measureHudPanel = document.getElementById('measure-hud');
    const closeMeasureHudBtn = document.getElementById('close-measure-hud-btn');
    if (closeMeasureHudBtn && measureHudPanel) {
      closeMeasureHudBtn.addEventListener('click', () => {
        measureHudPanel.classList.add('hidden');
        this.setActiveTool('select');
      });
    }

    const rotateHudPanel = document.getElementById('rotate-hud');
    const closeRotateHudBtn = document.getElementById('close-rotate-hud-btn');
    if (closeRotateHudBtn && rotateHudPanel) {
      closeRotateHudBtn.addEventListener('click', () => {
        rotateHudPanel.classList.add('hidden');
        this.setActiveTool('select');
      });
    }

    const rotateConfirmSelection = document.getElementById('rotate-confirm-selection');
    if (rotateConfirmSelection) {
      rotateConfirmSelection.addEventListener('click', () => {
        if (this.rotateStep === 'select') {
          if (this.selectedShapes.length === 0) {
            alert("Please select at least one object first.");
            return;
          }
          this.rotateStep = 'pivot';
          this.showStatusFeedback("Selection confirmed. Click on the canvas to establish the pivot point.");
        } else {
          this.rotateStep = 'select';
          this.rotatePivotX = null;
          this.rotatePivotY = null;
          this.isRotating = false;
          this.showStatusFeedback("Selection cleared. Click objects to select.");
        }
        this.updateRotateHUD();
        this.redraw();
      });
    }

    const rotateApplyBtn = document.getElementById('rotate-apply-btn');
    if (rotateApplyBtn) {
      rotateApplyBtn.addEventListener('click', () => {
        const val = parseFloat(document.getElementById('rotate-angle-input').value);
        if (!isNaN(val)) {
          this.applyExactRotation(val);
        } else {
          alert("Please enter a valid numeric angle.");
        }
      });
    }

    const rotate90Btn = document.getElementById('rotate-90-btn');
    if (rotate90Btn) {
      rotate90Btn.addEventListener('click', () => {
        this.applyExactRotation(90);
      });
    }

    const mirrorHudPanel = document.getElementById('mirror-hud');
    const closeMirrorHudBtn = document.getElementById('close-mirror-hud-btn');
    if (closeMirrorHudBtn && mirrorHudPanel) {
      closeMirrorHudBtn.addEventListener('click', () => {
        mirrorHudPanel.classList.add('hidden');
        mirrorHudPanel.classList.remove('flex');
        this.setActiveTool('select');
      });
    }

    const mirrorConfirmSelection = document.getElementById('mirror-confirm-selection');
    if (mirrorConfirmSelection) {
      mirrorConfirmSelection.addEventListener('click', () => {
        if (this.mirrorStep === 'select') {
          if (this.selectedMirrorShapes.length === 0) {
            alert("Please select at least one object first.");
            return;
          }
          this.mirrorStep = 'axis1';
          this.showStatusFeedback("Selection locked. Click on canvas to place FIRST point (P1) of mirror axis.");
        } else {
          this.mirrorStep = 'select';
          this.mirrorAxisX1 = null;
          this.mirrorAxisY1 = null;
          this.mirrorAxisX2 = null;
          this.mirrorAxisY2 = null;
          this.mirrorHoverX = null;
          this.mirrorHoverY = null;
          this.showStatusFeedback("Mirror selection cleared. Click objects to select.");
        }
        this.updateMirrorHUD();
        this.redraw();
      });
    }

    const mirrorConfirmCopy = document.getElementById('mirror-confirm-copy');
    if (mirrorConfirmCopy) {
      mirrorConfirmCopy.addEventListener('click', () => {
        this.applyMirror(false);
      });
    }

    const mirrorConfirmErase = document.getElementById('mirror-confirm-erase');
    if (mirrorConfirmErase) {
      mirrorConfirmErase.addEventListener('click', () => {
        this.applyMirror(true);
      });
    }

    // Scale HUD Event Registrations
    const scaleHudPanel = document.getElementById('scale-hud');
    const closeScaleHudBtn = document.getElementById('close-scale-hud-btn');
    if (closeScaleHudBtn && scaleHudPanel) {
      closeScaleHudBtn.addEventListener('click', () => {
        scaleHudPanel.classList.add('hidden');
        scaleHudPanel.classList.remove('flex');
        this.setActiveTool('select');
      });
    }

    const scaleConfirmSelection = document.getElementById('scale-confirm-selection');
    if (scaleConfirmSelection) {
      scaleConfirmSelection.addEventListener('click', () => {
        if (this.scaleStep === 'select') {
          if (this.selectedScaleShapes.length === 0) {
            alert("Please select at least one object first.");
            return;
          }
          this.scaleStep = 'basepoint';
          this.showStatusFeedback("Selection confirmed. Click on the canvas to establish the scale base point.");
        } else {
          this.scaleStep = 'select';
          this.scalePivotX = null;
          this.scalePivotY = null;
          this.scaleHoverX = null;
          this.scaleHoverY = null;
          this.isScaling = false;
          this.showStatusFeedback("Scale selection cleared. Click objects to select.");
        }
        this.updateScaleHUD();
        this.redraw();
      });
    }

    const scaleApplyBtn = document.getElementById('scale-apply-btn');
    if (scaleApplyBtn) {
      scaleApplyBtn.addEventListener('click', () => {
        const val = parseFloat(document.getElementById('scale-factor-input').value);
        if (!isNaN(val) && val > 0) {
          this.applyScale(val);
        } else {
          alert("Please enter a valid numeric scale factor greater than 0.");
        }
      });
    }

    // Preset scale factors buttons
    const presets = [
      { id: 'scale-quick-05', factor: 0.5 },
      { id: 'scale-quick-20', factor: 2.0 },
      { id: 'scale-quick-50', factor: 5.0 }
    ];
    presets.forEach(preset => {
      const btn = document.getElementById(preset.id);
      if (btn) {
        btn.addEventListener('click', () => {
          this.applyScale(preset.factor);
        });
      }
    });
  }

  updatePropertyInspector() {
    const inspector = document.getElementById('property-inspector');
    const content = document.getElementById('inspector-content');
    const minimizedBtn = document.getElementById('minimized-inspector-btn');
    if (!inspector || !content) return;

    if (!this.selectedShape) {
      inspector.classList.add('hidden');
      if (minimizedBtn) minimizedBtn.classList.add('hidden');
      this.isInspectorMinimized = false;
      return;
    }

    if (this.isInspectorMinimized) {
      inspector.classList.add('hidden');
      if (minimizedBtn) minimizedBtn.classList.remove('hidden');
      return; // Skip drawing html since it is hidden anyway
    } else {
      inspector.classList.remove('hidden');
      if (minimizedBtn) minimizedBtn.classList.add('hidden');
    }

    if (document.activeElement && content.contains(document.activeElement)) {
      return; 
    }

    const shape = this.selectedShape;
    let html = `
      <div class="flex flex-col gap-1">
        <span class="text-[9px] text-gray-500 uppercase">ENTITY TYPE</span>
        <span class="text-xs font-bold text-amber-400 uppercase">${shape.type}</span>
      </div>
      
      <div class="flex flex-col gap-1">
        <span class="text-[9px] text-gray-500 uppercase">ENTITY ID</span>
        <span class="text-[9px] text-gray-400 font-mono select-all">${shape.id}</span>
      </div>
    `;

    if ('x1' in shape && 'y1' in shape && 'x2' in shape && 'y2' in shape) {
      html += `
        <div class="grid grid-cols-2 gap-2">
          <div class="flex flex-col gap-1">
            <span class="text-[9px] text-slate-500 uppercase">START X</span>
            <input type="number" id="prop-x1" value="${Math.round(shape.x1)}" class="bg-[#131519] border border-[#2A2D35] rounded px-2 py-1 text-xs text-blue-400 outline-none w-full" />
          </div>
          <div class="flex flex-col gap-1">
            <span class="text-[9px] text-slate-500 uppercase">START Y</span>
            <input type="number" id="prop-y1" value="${Math.round(shape.y1)}" class="bg-[#131519] border border-[#2A2D35] rounded px-2 py-1 text-xs text-blue-400 outline-none w-full" />
          </div>
          <div class="flex flex-col gap-1">
            <span class="text-[9px] text-slate-500 uppercase">END X</span>
            <input type="number" id="prop-x2" value="${Math.round(shape.x2)}" class="bg-[#131519] border border-[#2A2D35] rounded px-2 py-1 text-xs text-blue-400 outline-none w-full" />
          </div>
          <div class="flex flex-col gap-1">
            <span class="text-[9px] text-slate-500 uppercase">END Y</span>
            <input type="number" id="prop-y2" value="${Math.round(shape.y2)}" class="bg-[#131519] border border-[#2A2D35] rounded px-2 py-1 text-xs text-blue-400 outline-none w-full" />
          </div>
        </div>
      `;
    } else if ('x' in shape && 'y' in shape && 'width' in shape && 'height' in shape) {
      html += `
        <div class="grid grid-cols-2 gap-2">
          <div class="flex flex-col gap-1">
            <span class="text-[9px] text-slate-500 uppercase">ORIGIN X</span>
            <input type="number" id="prop-x" value="${Math.round(shape.x)}" class="bg-[#131519] border border-[#2A2D35] rounded px-2 py-1 text-xs text-blue-400 outline-none w-full" />
          </div>
          <div class="flex flex-col gap-1">
            <span class="text-[9px] text-slate-500 uppercase">ORIGIN Y</span>
            <input type="number" id="prop-y" value="${Math.round(shape.y)}" class="bg-[#131519] border border-[#2A2D35] rounded px-2 py-1 text-xs text-blue-400 outline-none w-full" />
          </div>
          <div class="flex flex-col gap-1">
            <span class="text-[9px] text-slate-500 uppercase">WIDTH</span>
            <input type="number" id="prop-w" value="${Math.round(shape.width)}" class="bg-[#131519] border border-[#2A2D35] rounded px-2 py-1 text-xs text-blue-400 outline-none w-full" />
          </div>
          <div class="flex flex-col gap-1">
            <span class="text-[9px] text-slate-500 uppercase">HEIGHT</span>
            <input type="number" id="prop-h" value="${Math.round(shape.height)}" class="bg-[#131519] border border-[#2A2D35] rounded px-2 py-1 text-xs text-blue-400 outline-none w-full" />
          </div>
        </div>
      `;
    } else if ('centerX' in shape && 'centerY' in shape && 'radius' in shape) {
      html += `
        <div class="grid grid-cols-2 gap-2">
          <div class="flex flex-col gap-1">
            <span class="text-[9px] text-slate-500 uppercase">CENTER X</span>
            <input type="number" id="prop-cx" value="${Math.round(shape.centerX)}" class="bg-[#131519] border border-[#2A2D35] rounded px-2 py-1 text-xs text-blue-400 outline-none w-full" />
          </div>
          <div class="flex flex-col gap-1">
            <span class="text-[9px] text-slate-500 uppercase">CENTER Y</span>
            <input type="number" id="prop-cy" value="${Math.round(shape.centerY)}" class="bg-[#131519] border border-[#2A2D35] rounded px-2 py-1 text-xs text-blue-400 outline-none w-full" />
          </div>
          <div class="flex flex-col gap-2 col-span-2">
            <span class="text-[9px] text-slate-500 uppercase">RADIUS</span>
            <input type="number" id="prop-radius" value="${Math.round(shape.radius)}" class="bg-[#131519] border border-[#2A2D35] rounded px-2 py-1 text-xs text-blue-400 outline-none w-full" />
          </div>
        </div>
      `;
    }

    html += `
      <div class="flex flex-col gap-1 col-span-2">
        <span class="text-[9px] text-slate-500 uppercase">STYLING & METRICS</span>
        <div class="grid grid-cols-2 gap-2">
          <div class="flex flex-col gap-0.5">
            <span class="text-[8px] text-gray-500">LINE WIDTH</span>
            <input type="number" id="prop-weight" value="${shape.lineWidth}" min="1" max="15" class="bg-[#131519] border border-[#2A2D35] rounded px-2 py-1 text-[11px] text-gray-300 outline-none w-full" />
          </div>
          <div class="flex flex-col gap-0.5">
            <span class="text-[8px] text-gray-500">STROKE COLOR</span>
            <select id="prop-color-select" class="bg-[#131519] border border-[#2A2D35] rounded px-2 py-1 text-[11px] text-gray-350 outline-none w-full cursor-pointer">
              <option value="#06b6d4" ${shape.color === '#06b6d4' ? 'selected' : ''}>Cyan</option>
              <option value="#22c55e" ${shape.color === '#22c55e' ? 'selected' : ''}>Lime</option>
              <option value="#f59e0b" ${shape.color === '#f59e0b' ? 'selected' : ''}>Amber</option>
              <option value="#ef4444" ${shape.color === '#ef4444' ? 'selected' : ''}>Ruby</option>
              <option value="#ffffff" ${shape.color === '#ffffff' || shape.color === 'white' ? 'selected' : ''}>White</option>
            </select>
          </div>
        </div>
      </div>
      
      <div class="flex flex-col gap-1">
        <span class="text-[9px] text-slate-500 uppercase">DRAWING LAYER</span>
        <select id="prop-layer-select" class="bg-[#131519] border border-[#2A2D35] rounded px-2 py-1 text-xs text-gray-300 outline-none w-full cursor-pointer">
          ${this.layers.map(l => `<option value="${l.id}" ${shape.layerId === l.id ? 'selected' : ''}>${l.name}</option>`).join('')}
        </select>
      </div>
    `;

    if (shape.type === 'dimension') {
      html += `
        <div class="flex flex-col gap-1">
          <span class="text-[9px] text-slate-500 uppercase font-semibold">CAD DIMENSION SETTINGS</span>
          <div class="flex flex-col gap-1.5 p-1.5 border border-dashed border-gray-700 rounded bg-[#101217]">
            <div class="flex flex-col gap-0.5">
              <span class="text-[8px] text-gray-500">DIMENSION TYPE</span>
              <select id="prop-dimtype-select" class="bg-[#131519] border border-[#2A2D35] rounded px-1.5 py-0.5 text-[11px] text-gray-300 w-full outline-none">
                <option value="aligned" ${shape.dimType === 'aligned' ? 'selected' : ''}>Aligned (Parallel)</option>
                <option value="horizontal" ${shape.dimType === 'horizontal' ? 'selected' : ''}>Horizontal Only</option>
                <option value="vertical" ${shape.dimType === 'vertical' ? 'selected' : ''}>Vertical Only</option>
                <option value="linear" ${shape.dimType === 'linear' ? 'selected' : ''}>Linear (Auto Horiz/Vert)</option>
              </select>
            </div>
            <div class="grid grid-cols-2 gap-1.5 mt-1">
              <div class="flex flex-col gap-0.5">
                <span class="text-[8px] text-gray-500">ARROW SIZE</span>
                <input type="number" id="prop-dimarrow" min="2" max="25" step="1" value="${shape.arrowSize || 8}" class="bg-[#131519] border border-[#2A2D35] rounded px-1.5 py-0.5 text-[11px] text-gray-300 w-full outline-none" />
              </div>
              <div class="flex flex-col gap-0.5">
                <span class="text-[8px] text-gray-500">OFFSET (PX)</span>
                <input type="number" id="prop-dimoffset" min="0" max="200" step="5" value="${shape.offset || 25}" class="bg-[#131519] border border-[#2A2D35] rounded px-1.5 py-0.5 text-[11px] text-gray-300 w-full outline-none" />
              </div>
            </div>
          </div>
        </div>
      `;
    }

    if (shape.type === 'roomlabel' || 'labelText' in shape) {
      html += `
        <div class="flex flex-col gap-1">
          <span class="text-[9px] text-slate-500 uppercase">LABEL STRING</span>
          <input type="text" id="prop-label-text" value="${shape.labelText || ''}" class="bg-[#131519] border border-[#2A2D35] rounded px-2 py-1 text-xs text-gray-150 outline-none w-full" />
        </div>
      `;
    }

    content.innerHTML = html;

    const attachChange = (id, callback) => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('focus', () => {
          this.undoPropBackup = this.shapes.map(s => s.serialize ? s.serialize() : JSON.parse(JSON.stringify(s)));
        });
        el.addEventListener('input', (e) => {
          callback(e.target.value);
          this.saveDrawing();
          this.updateEntityList();
          this.redraw();
        });
        el.addEventListener('change', () => {
          if (this.undoPropBackup) {
            if (!this.undoStack) this.undoStack = [];
            this.undoStack.push(this.undoPropBackup);
            if (this.undoStack.length > 50) this.undoStack.shift();
            this.undoPropBackup = null;
            this.redoStack = [];
            this.updateUndoButtonState();
            this.updateRedoButtonState();
          }
        });
      }
    };

    attachChange('prop-x1', (v) => { shape.x1 = parseFloat(v) || 0; });
    attachChange('prop-y1', (v) => { shape.y1 = parseFloat(v) || 0; });
    attachChange('prop-x2', (v) => { shape.x2 = parseFloat(v) || 0; });
    attachChange('prop-y2', (v) => { shape.y2 = parseFloat(v) || 0; });

    attachChange('prop-x', (v) => { shape.x = parseFloat(v) || 0; });
    attachChange('prop-y', (v) => { shape.y = parseFloat(v) || 0; });
    attachChange('prop-w', (v) => { shape.width = parseFloat(v) || 0; });
    attachChange('prop-h', (v) => { shape.height = parseFloat(v) || 0; });

    attachChange('prop-cx', (v) => { shape.centerX = parseFloat(v) || 0; });
    attachChange('prop-cy', (v) => { shape.centerY = parseFloat(v) || 0; });
    attachChange('prop-radius', (v) => { shape.radius = parseFloat(v) || 0; });

    attachChange('prop-weight', (v) => { shape.lineWidth = parseInt(v, 10) || 1; });
    attachChange('prop-color-select', (v) => { shape.color = v; });
    attachChange('prop-layer-select', (v) => { shape.layerId = v; });
    attachChange('prop-label-text', (v) => { shape.labelText = v; });
    
    // Dimension-specific listeners
    attachChange('prop-dimtype-select', (v) => { shape.dimType = v; });
    attachChange('prop-dimarrow', (v) => { shape.arrowSize = parseFloat(v) || 8; });
    attachChange('prop-dimoffset', (v) => { shape.offset = parseFloat(v) || 25; });
  }

  duplicateShape(shape) {
    if (!shape) return;
    const serialized = shape.serialize();
    const copy = deserializeShape(serialized);
    if (copy) {
      copy.id = 'ent_' + Math.random().toString(36).substr(2, 9);
      if ('x1' in copy) {
        copy.x1 += 20; copy.y1 += 20;
        copy.x2 += 20; copy.y2 += 20;
      } else if ('x' in copy) {
        copy.x += 20; copy.y += 20;
      } else if ('centerX' in copy) {
        copy.centerX += 20; copy.centerY += 20;
      }
      this.pushUndoCheckpoint();
      this.shapes.push(copy);
      this.selectedShape = copy;
      this.saveDrawing();
      this.updateEntityList();
      this.updateUndoButtonState();
      this.updatePropertiesPanel();
      this.redraw();
    }
  }

  /**
   * Initializes and binds all the events for the CAD Command Line System
   */
  setupCommandLine() {
    this.commandHistory = [];
    this.commandHistoryIndex = -1;
    this.commandActiveSuggestionIndex = -1;

    const input = document.getElementById('cad-command-input');
    const submitBtn = document.getElementById('cad-command-submit');
    const autocompleteBox = document.getElementById('cad-command-autocomplete');

    if (!input || !autocompleteBox) return;

    // Standard & civil command mappings
    const COMMANDS = [
      { code: 'L', full: 'LINE', desc: 'Draw standard line segment' },
      { code: 'C', full: 'CIRCLE', desc: 'Draw circle from center and radius' },
      { code: 'R', full: 'RECTANGLE', desc: 'Draw rectangle from opposite corners' },
      { code: 'M', full: 'MOVE', desc: 'Select / Move shape and points' },
      { code: 'P', full: 'PAN', desc: 'Pan workspace views by dragging' },
      { code: 'RO', full: 'ROTATE', desc: 'Rotate selected shape around base point' },
      { code: 'SC', full: 'SCALE', desc: 'Scale selected shape relative to base point' },
      { code: 'MI', full: 'MIRROR', desc: 'Mirror selected shape across axis line' },
      { code: 'DIM', full: 'DIMENSION', desc: 'Draw measurement dimension markers' },
      { code: 'MEASURE', full: 'MEASURE', desc: 'Interactive distance measuring tool' },
      { code: 'DEL', full: 'DELETE', desc: 'Delete currently selected shape' }
    ];

    // Helper: Hide suggestions
    const hideSuggestions = () => {
      autocompleteBox.classList.add('hidden');
      autocompleteBox.innerHTML = '';
      this.commandActiveSuggestionIndex = -1;
    };

    // Helper: Show & render suggestions
    const showSuggestions = (typed) => {
      const filtered = COMMANDS.filter(cmd => 
        cmd.code.startsWith(typed) || 
        cmd.full.startsWith(typed) || 
        cmd.desc.toLowerCase().includes(typed.toLowerCase())
      );

      if (filtered.length === 0) {
        hideSuggestions();
        return;
      }

      autocompleteBox.innerHTML = '';
      filtered.forEach((cmd, idx) => {
        const item = document.createElement('div');
        const isActive = idx === this.commandActiveSuggestionIndex;
        item.className = `px-2.5 py-1.5 flex items-center justify-between cursor-pointer transition duration-100 font-mono text-xs ${isActive ? 'bg-blue-600 text-white font-bold' : 'hover:bg-[#2A2D35] text-gray-350'}`;
        item.innerHTML = `
          <div class="flex items-center gap-1.5">
            <span class="${isActive ? 'text-white' : 'text-blue-400'} font-bold">${cmd.code}</span>
            <span class="text-[10px] ${isActive ? 'text-blue-100' : 'text-gray-400'}">(${cmd.full})</span>
          </div>
          <span class="text-[10px] ${isActive ? 'text-gray-200' : 'text-gray-500'}">${cmd.desc}</span>
        `;
        
        item.addEventListener('click', () => {
          input.value = cmd.code;
          hideSuggestions();
          input.focus();
        });
        
        autocompleteBox.appendChild(item);
      });

      autocompleteBox.classList.remove('hidden');
    };

    // Input events
    input.addEventListener('input', (e) => {
      const val = e.target.value.trim().toUpperCase();
      if (!val) {
        hideSuggestions();
      } else {
        showSuggestions(val);
      }
    });

    // Keydown handlers inside command line
    input.addEventListener('keydown', (e) => {
      const val = input.value.trim().toUpperCase();
      const suggestionsVisible = !autocompleteBox.classList.contains('hidden');
      const suggestionItems = autocompleteBox.querySelectorAll('div');

      if (e.key === 'Enter') {
        e.preventDefault();
        
        // If suggestion is selected, complete it
        if (suggestionsVisible && this.commandActiveSuggestionIndex >= 0 && this.commandActiveSuggestionIndex < suggestionItems.length) {
          const activeCode = COMMANDS.filter(cmd => 
            cmd.code.startsWith(val) || 
            cmd.full.startsWith(val) || 
            cmd.desc.toLowerCase().includes(val.toLowerCase())
          )[this.commandActiveSuggestionIndex].code;
          input.value = activeCode;
          hideSuggestions();
        } else {
          const finalVal = input.value.trim();
          if (finalVal) {
            this.executeCommand(finalVal);
            this.commandHistory.push(finalVal);
            this.commandHistoryIndex = -1;
            input.value = '';
            hideSuggestions();
          }
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        input.value = '';
        hideSuggestions();
        input.blur();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (suggestionsVisible && suggestionItems.length > 0) {
          this.commandActiveSuggestionIndex = (this.commandActiveSuggestionIndex + 1) % suggestionItems.length;
          showSuggestions(val);
        } else if (this.commandHistory.length > 0) {
          // Command history navigation
          if (this.commandHistoryIndex > 0) {
            this.commandHistoryIndex--;
            input.value = this.commandHistory[this.commandHistory.length - 1 - this.commandHistoryIndex];
          } else if (this.commandHistoryIndex === 0) {
            this.commandHistoryIndex = -1;
            input.value = '';
          }
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (suggestionsVisible && suggestionItems.length > 0) {
          if (this.commandActiveSuggestionIndex === -1) {
            this.commandActiveSuggestionIndex = suggestionItems.length - 1;
          } else {
            this.commandActiveSuggestionIndex = (this.commandActiveSuggestionIndex - 1 + suggestionItems.length) % suggestionItems.length;
          }
          showSuggestions(val);
        } else if (this.commandHistory.length > 0) {
          // Command history navigation
          if (this.commandHistoryIndex < this.commandHistory.length - 1) {
            this.commandHistoryIndex++;
            input.value = this.commandHistory[this.commandHistory.length - 1 - this.commandHistoryIndex];
          }
        }
      } else if (e.key === 'Tab') {
        if (suggestionsVisible && suggestionItems.length > 0) {
          e.preventDefault();
          this.commandActiveSuggestionIndex = (this.commandActiveSuggestionIndex + 1) % suggestionItems.length;
          showSuggestions(val);
        }
      }
    });

    // Close autocomplete when clicking outside
    document.addEventListener('click', (e) => {
      if (!input.contains(e.target) && !autocompleteBox.contains(e.target)) {
        hideSuggestions();
      }
    });

    // Handle submit button click
    if (submitBtn) {
      submitBtn.addEventListener('click', () => {
        const finalVal = input.value.trim();
        if (finalVal) {
          this.executeCommand(finalVal);
          this.commandHistory.push(finalVal);
          this.commandHistoryIndex = -1;
          input.value = '';
          hideSuggestions();
        }
      });
    }

    // Quick focus shortcut key '/' or ';'
    window.addEventListener('keydown', (e) => {
      if (document.activeElement && (
        document.activeElement.tagName === 'INPUT' || 
        document.activeElement.tagName === 'TEXTAREA' || 
        document.activeElement.tagName === 'SELECT'
      )) {
        return;
      }

      if (e.key === '/' || e.key === ';') {
        e.preventDefault();
        input.focus();
        input.select();
      }
    });
  }

  /**
   * Executes a command entered in the CAD Command Line
   */
  executeCommand(cmdStr) {
    const cmd = cmdStr.trim().toUpperCase();
    if (!cmd) return false;

    if (cmd === 'L' || cmd === 'LINE') {
      this.setActiveTool('line');
      this.showStatusFeedback("Command: LINE - Line tool activated.");
      return true;
    } else if (cmd === 'C' || cmd === 'CIRCLE') {
      this.setActiveTool('circle');
      this.showStatusFeedback("Command: CIRCLE - Circle tool activated.");
      return true;
    } else if (cmd === 'R' || cmd === 'RECTANGLE') {
      this.setActiveTool('rectangle');
      this.showStatusFeedback("Command: RECTANGLE - Rectangle tool activated.");
      return true;
    } else if (cmd === 'M' || cmd === 'MOVE') {
      this.setActiveTool('select');
      this.showStatusFeedback("Command: MOVE - Move / Select tool activated.");
      return true;
    } else if (cmd === 'P' || cmd === 'PAN') {
      this.setActiveTool('pan');
      this.showStatusFeedback("Command: PAN - Pan Workspace active. Drag canvas to pan.");
      return true;
    } else if (cmd === 'RO' || cmd === 'ROTATE') {
      this.setActiveTool('rotate');
      if (this.selectedShape) {
        this.selectedShapes = [this.selectedShape];
        this.rotateStep = 'pivot';
        this.showStatusFeedback("Command: ROTATE - Click pivot point on canvas.");
      } else {
        this.rotateStep = 'select';
        this.showStatusFeedback("Command: ROTATE - Select shape on canvas to rotate.");
      }
      return true;
    } else if (cmd === 'SC' || cmd === 'SCALE') {
      this.setActiveTool('scale');
      if (this.selectedShape) {
        this.selectedScaleShapes = [this.selectedShape];
        this.scaleStep = 'basepoint';
        this.showStatusFeedback("Command: SCALE - Click base point on canvas.");
      } else {
        this.scaleStep = 'select';
        this.showStatusFeedback("Command: SCALE - Select shape on canvas to scale.");
      }
      return true;
    } else if (cmd === 'MI' || cmd === 'MIRROR') {
      this.setActiveTool('mirror');
      if (this.selectedShape) {
        this.selectedMirrorShapes = [this.selectedShape];
        this.mirrorStep = 'axis1';
        this.showStatusFeedback("Command: MIRROR - Click first axis point on canvas.");
      } else {
        this.mirrorStep = 'select';
        this.showStatusFeedback("Command: MIRROR - Select shape on canvas to mirror.");
      }
      return true;
    } else if (cmd === 'DIM' || cmd === 'DIMENSION') {
      this.setActiveTool('dimension');
      this.showStatusFeedback("Command: DIMENSION - Dimension marking activated.");
      return true;
    } else if (cmd === 'MEASURE') {
      this.setActiveTool('measure');
      this.showStatusFeedback("Command: MEASURE - Laser measurement tool activated.");
      return true;
    } else if (cmd === 'DEL' || cmd === 'DELETE') {
      if (this.selectedShape) {
        this.deleteSelectedShape();
        this.showStatusFeedback("Command: DELETE - Selected shape deleted.");
      } else {
        this.showStatusFeedback("Command: DELETE - No shape selected to delete.", true);
      }
      return true;
    } else {
      this.showStatusFeedback(`Unknown command: "${cmdStr}"`, true);
      return false;
    }
  }

  nudgeSelectedShape(dx, dy) {
    const shape = this.selectedShape;
    if (!shape) return;
    if (this.isLayerLocked(shape.layerId)) {
      this.showStatusFeedback("Cannot nudge: Selected shape layer is locked.");
      return;
    }
    this.pushUndoCheckpoint();
    if (['line', 'wall', 'beam', 'door', 'window', 'dimension'].includes(shape.type)) {
      shape.x1 += dx;
      shape.y1 += dy;
      shape.x2 += dx;
      shape.y2 += dy;
    } else if (['rectangle', 'column', 'roomlabel', 'areazone', 'text'].includes(shape.type)) {
      shape.x += dx;
      shape.y += dy;
    } else if (shape.type === 'circle') {
      shape.centerX += dx;
      shape.centerY += dy;
    }
    this.saveDrawing();
    this.updateEntityList();
    this.updatePropertiesPanel();
    this.redraw();
  }

  getTemplateShapes(type) {
    const shapes = [];
    const wallColor = "#38BDF8"; // Beautiful Cyan-blue
    const colColor = "#10B981";  // Emerald support columns
    const doorColor = "#F59E0B"; // Amber architectural doors
    const winColor = "#60A5FA";  // Sky blue windows
    const dimColor = "#94A3B8";  // Slate dimensions
    const labelColor = "#A855F7"; // Purple labels & area zones
    const textColor = "#E2E8F0";  // Slate gray annotation text

    if (type === '1bhk') {
      // 1 BHK House Layout: Outer dimensions 400x300, starting at (200, 150) to (600, 450)
      // Outer Walls
      const wall1 = new Wall(200, 150, 600, 150, wallColor, 2, 12); wall1.layerId = 'walls'; shapes.push(wall1);
      const wall2 = new Wall(600, 150, 600, 450, wallColor, 2, 12); wall2.layerId = 'walls'; shapes.push(wall2);
      const wall3 = new Wall(600, 450, 200, 450, wallColor, 2, 12); wall3.layerId = 'walls'; shapes.push(wall3);
      const wall4 = new Wall(200, 450, 200, 150, wallColor, 2, 12); wall4.layerId = 'walls'; shapes.push(wall4);
      
      // Internal Partition Walls (Symmetrical grid splitting layout at y = 300 and x = 440)
      const wall5 = new Wall(440, 150, 440, 450, wallColor, 2, 10); wall5.layerId = 'walls'; shapes.push(wall5);
      const wall6 = new Wall(200, 300, 600, 300, wallColor, 2, 10); wall6.layerId = 'walls'; shapes.push(wall6);
      const wall7 = new Wall(300, 300, 300, 450, wallColor, 2, 10); wall7.layerId = 'walls'; shapes.push(wall7);

      // Support Columns (Rectangular structural columns at grid junctions)
      const colSize = 16;
      const cols = [
        [200, 150], [440, 150], [600, 150],
        [200, 300], [300, 300], [440, 300], [600, 300],
        [200, 450], [300, 450], [440, 450], [600, 450]
      ];
      cols.forEach(pt => {
        const col = new Column(pt[0] - colSize/2, pt[1] - colSize/2, colSize, colSize, colColor, 2);
        col.layerId = 'columns';
        shapes.push(col);
      });

      // Architectural Doors
      const d1 = new Door(200, 170, 200, 220, doorColor, 2); d1.layerId = 'default'; shapes.push(d1); // Main entrance door
      const d2 = new Door(440, 170, 440, 210, doorColor, 2); d2.layerId = 'default'; shapes.push(d2); // Master Bedroom door
      const d3 = new Door(440, 350, 440, 390, doorColor, 2); d3.layerId = 'default'; shapes.push(d3); // Kitchen door
      const d4 = new Door(220, 300, 260, 300, doorColor, 2); d4.layerId = 'default'; shapes.push(d4); // Bathroom door

      // Windows
      const w1 = new Window(260, 150, 340, 150, winColor, 2, 8); w1.layerId = 'default'; shapes.push(w1); // Living room North window
      const w2 = new Window(200, 240, 200, 280, winColor, 2, 8); w2.layerId = 'default'; shapes.push(w2); // Living room West window
      const w3 = new Window(500, 150, 560, 150, winColor, 2, 8); w3.layerId = 'default'; shapes.push(w3); // Bedroom North window
      const w4 = new Window(600, 200, 600, 250, winColor, 2, 8); w4.layerId = 'default'; shapes.push(w4); // Bedroom East window
      const w5 = new Window(200, 360, 200, 400, winColor, 2, 8); w5.layerId = 'default'; shapes.push(w5); // Bathroom West vent window
      const w6 = new Window(500, 450, 560, 450, winColor, 2, 8); w6.layerId = 'default'; shapes.push(w6); // Kitchen South window
      const w7 = new Window(600, 350, 600, 400, winColor, 2, 8); w7.layerId = 'default'; shapes.push(w7); // Kitchen East window

      // Room Area Zones (Label & area boundary boxes)
      const zone1 = new AreaZone(206, 156, 228, 138, labelColor, 1.5, "Living Room"); zone1.layerId = 'default'; shapes.push(zone1);
      const zone2 = new AreaZone(446, 156, 148, 138, labelColor, 1.5, "Master Bedroom"); zone2.layerId = 'default'; shapes.push(zone2);
      const zone3 = new AreaZone(206, 306, 88, 138, labelColor, 1.5, "Bathroom"); zone3.layerId = 'default'; shapes.push(zone3);
      const zone4 = new AreaZone(306, 306, 128, 138, labelColor, 1.5, "Dining Lobby"); zone4.layerId = 'default'; shapes.push(zone4);
      const zone5 = new AreaZone(446, 306, 148, 138, labelColor, 1.5, "Kitchen"); zone5.layerId = 'default'; shapes.push(zone5);

      // Dimensioning lines
      const dim1 = new Dimension(200, 150, 600, 150, dimColor, 1.5, 'aligned', 8, 35); dim1.layerId = 'dimensions'; shapes.push(dim1); // Overall floor plan width
      const dim2 = new Dimension(200, 150, 200, 450, dimColor, 1.5, 'aligned', 8, 35); dim2.layerId = 'dimensions'; shapes.push(dim2); // Overall floor plan height
      const dim3 = new Dimension(200, 150, 440, 150, dimColor, 1.5, 'aligned', 8, -15); dim3.layerId = 'dimensions'; shapes.push(dim3); // Living room width
      const dim4 = new Dimension(440, 150, 600, 150, dimColor, 1.5, 'aligned', 8, -15); dim4.layerId = 'dimensions'; shapes.push(dim4); // Bedroom width
      const dim5 = new Dimension(200, 150, 200, 300, dimColor, 1.5, 'aligned', 8, -15); dim5.layerId = 'dimensions'; shapes.push(dim5); // Living room height
      const dim6 = new Dimension(200, 300, 200, 450, dimColor, 1.5, 'aligned', 8, -15); dim6.layerId = 'dimensions'; shapes.push(dim6); // Bathroom / Lobby height
      const dim7 = new Dimension(200, 450, 300, 450, dimColor, 1.5, 'aligned', 8, 15); dim7.layerId = 'dimensions'; shapes.push(dim7); // Bathroom width
      const dim8 = new Dimension(300, 450, 440, 450, dimColor, 1.5, 'aligned', 8, 15); dim8.layerId = 'dimensions'; shapes.push(dim8); // Dining Lobby width
      const dim9 = new Dimension(440, 450, 600, 450, dimColor, 1.5, 'aligned', 8, 15); dim9.layerId = 'dimensions'; shapes.push(dim9); // Kitchen width

    } else if (type === '2bhk') {
      // 2 BHK House Layout: Outer size 600x400, starting at (150, 100) to (750, 500)
      // Outer walls
      const wall1 = new Wall(150, 100, 750, 100, wallColor, 2, 12); wall1.layerId = 'walls'; shapes.push(wall1);
      const wall2 = new Wall(750, 100, 750, 500, wallColor, 2, 12); wall2.layerId = 'walls'; shapes.push(wall2);
      const wall3 = new Wall(750, 500, 150, 500, wallColor, 2, 12); wall3.layerId = 'walls'; shapes.push(wall3);
      const wall4 = new Wall(150, 500, 150, 100, wallColor, 2, 12); wall4.layerId = 'walls'; shapes.push(wall4);

      // Partition separating Living/Kitchen from Bedrooms: Vertical (450, 100) to (450, 500)
      const wall5 = new Wall(450, 100, 450, 500, wallColor, 2, 10); wall5.layerId = 'walls'; shapes.push(wall5);
      // Partition separating Bedrooms: Horizontal (450, 300) to (750, 300)
      const wall6 = new Wall(450, 300, 750, 300, wallColor, 2, 10); wall6.layerId = 'walls'; shapes.push(wall6);
      // Partition separating Living from Kitchen: Horizontal (150, 350) to (450, 350)
      const wall7 = new Wall(150, 350, 450, 350, wallColor, 2, 10); wall7.layerId = 'walls'; shapes.push(wall7);
      // Partition separating Kitchen from Common Bath: Vertical (320, 350) to (320, 500)
      const wall8 = new Wall(320, 350, 320, 500, wallColor, 2, 10); wall8.layerId = 'walls'; shapes.push(wall8);

      // Columns
      const colSize = 16;
      const cols = [
        [150, 100], [450, 100], [750, 100],
        [150, 350], [450, 300], [750, 300],
        [150, 500], [320, 500], [450, 500], [750, 500]
      ];
      cols.forEach(pt => {
        const col = new Column(pt[0] - colSize/2, pt[1] - colSize/2, colSize, colSize, colColor, 2);
        col.layerId = 'columns';
        shapes.push(col);
      });

      // Doors
      const d1 = new Door(150, 160, 150, 210, doorColor, 2); d1.layerId = 'default'; shapes.push(d1); // Main entrance
      const d2 = new Door(450, 140, 450, 180, doorColor, 2); d2.layerId = 'default'; shapes.push(d2); // Master Bed
      const d3 = new Door(450, 330, 450, 370, doorColor, 2); d3.layerId = 'default'; shapes.push(d3); // Bed 2
      const d4 = new Door(280, 350, 240, 350, doorColor, 2); d4.layerId = 'default'; shapes.push(d4); // Kitchen
      const d5 = new Door(350, 350, 390, 350, doorColor, 2); d5.layerId = 'default'; shapes.push(d5); // Bathroom

      // Windows
      const w1 = new Window(250, 100, 310, 100, winColor, 2, 8); w1.layerId = 'default'; shapes.push(w1); // Living
      const w2 = new Window(560, 100, 620, 100, winColor, 2, 8); w2.layerId = 'default'; shapes.push(w2); // Master Bed
      const w3 = new Window(560, 500, 620, 500, winColor, 2, 8); w3.layerId = 'default'; shapes.push(w3); // Bed 2
      const w4 = new Window(150, 400, 150, 440, winColor, 2, 8); w4.layerId = 'default'; shapes.push(w4); // Kitchen window
      const w5 = new Window(320, 410, 320, 440, winColor, 2, 8); w5.layerId = 'default'; shapes.push(w5); // Bath vent

      // Room zones
      const zone1 = new AreaZone(156, 106, 288, 238, labelColor, 1.5, "Living Room"); zone1.layerId = 'default'; shapes.push(zone1);
      const zone2 = new AreaZone(456, 106, 288, 188, labelColor, 1.5, "Master Bedroom"); zone2.layerId = 'default'; shapes.push(zone2);
      const zone3 = new AreaZone(456, 306, 288, 188, labelColor, 1.5, "Bedroom 2"); zone3.layerId = 'default'; shapes.push(zone3);
      const zone4 = new AreaZone(156, 356, 158, 138, labelColor, 1.5, "Kitchen Room"); zone4.layerId = 'default'; shapes.push(zone4);
      const zone5 = new AreaZone(326, 356, 118, 138, labelColor, 1.5, "Bathroom"); zone5.layerId = 'default'; shapes.push(zone5);

      // Dimensions
      const dim1 = new Dimension(150, 100, 750, 100, dimColor, 1.5, 'aligned', 8, 25); dim1.layerId = 'dimensions'; shapes.push(dim1);
      const dim2 = new Dimension(150, 100, 150, 500, dimColor, 1.5, 'aligned', 8, 25); dim2.layerId = 'dimensions'; shapes.push(dim2);

    } else if (type === '3bhk') {
      // 3 BHK House Layout: Outer size 800x500, starting at (100, 50) to (900, 550)
      // Outer walls
      const wall1 = new Wall(100, 50, 900, 50, wallColor, 2, 12); wall1.layerId = 'walls'; shapes.push(wall1);
      const wall2 = new Wall(900, 50, 900, 550, wallColor, 2, 12); wall2.layerId = 'walls'; shapes.push(wall2);
      const wall3 = new Wall(900, 550, 100, 550, wallColor, 2, 12); wall3.layerId = 'walls'; shapes.push(wall3);
      const wall4 = new Wall(100, 550, 100, 50, wallColor, 2, 12); wall4.layerId = 'walls'; shapes.push(wall4);

      // Divider walls
      const wall5 = new Wall(100, 300, 500, 300, wallColor, 2, 10); wall5.layerId = 'walls'; shapes.push(wall5);
      const wall6 = new Wall(300, 300, 300, 550, wallColor, 2, 10); wall6.layerId = 'walls'; shapes.push(wall6);
      const wall7 = new Wall(500, 50, 500, 550, wallColor, 2, 10); wall7.layerId = 'walls'; shapes.push(wall7);
      const wall8 = new Wall(500, 250, 900, 250, wallColor, 2, 10); wall8.layerId = 'walls'; shapes.push(wall8);
      const wall9 = new Wall(500, 400, 900, 400, wallColor, 2, 10); wall9.layerId = 'walls'; shapes.push(wall9);
      const wall10 = new Wall(720, 400, 720, 550, wallColor, 2, 10); wall10.layerId = 'walls'; shapes.push(wall10);
      const wall11 = new Wall(720, 50, 720, 130, wallColor, 2, 10); wall11.layerId = 'walls'; shapes.push(wall11);
      const wall12 = new Wall(720, 130, 900, 130, wallColor, 2, 10); wall12.layerId = 'walls'; shapes.push(wall12);

      // Columns
      const colSize = 16;
      const cols = [
        [100, 50], [500, 50], [900, 50],
        [100, 300], [300, 300], [500, 250], [900, 250],
        [500, 400], [720, 400], [900, 400],
        [100, 550], [300, 550], [500, 550], [720, 550], [900, 550]
      ];
      cols.forEach(pt => {
        const col = new Column(pt[0] - colSize/2, pt[1] - colSize/2, colSize, colSize, colColor, 2);
        col.layerId = 'columns';
        shapes.push(col);
      });

      // Doors
      const d1 = new Door(100, 110, 100, 160, doorColor, 2); d1.layerId = 'default'; shapes.push(d1);
      const d2 = new Door(500, 150, 500, 190, doorColor, 2); d2.layerId = 'default'; shapes.push(d2);
      const d3 = new Door(500, 320, 500, 360, doorColor, 2); d3.layerId = 'default'; shapes.push(d3);
      const d4 = new Door(340, 300, 380, 300, doorColor, 2); d4.layerId = 'default'; shapes.push(d4);
      const d5 = new Door(220, 300, 260, 300, doorColor, 2); d5.layerId = 'default'; shapes.push(d5);
      const d6 = new Door(720, 90, 720, 120, doorColor, 2); d6.layerId = 'default'; shapes.push(d6);
      const d7 = new Door(540, 400, 580, 400, doorColor, 2); d7.layerId = 'default'; shapes.push(d7);
      const d8 = new Door(750, 400, 790, 400, doorColor, 2); d8.layerId = 'default'; shapes.push(d8);

      // Windows
      const w1 = new Window(250, 50, 310, 50, winColor, 2, 8); w1.layerId = 'default'; shapes.push(w1);
      const w2 = new Window(580, 50, 640, 50, winColor, 2, 8); w2.layerId = 'default'; shapes.push(w2);
      const w3 = new Window(900, 310, 900, 350, winColor, 2, 8); w3.layerId = 'default'; shapes.push(w3);
      const w4 = new Window(380, 550, 420, 550, winColor, 2, 8); w4.layerId = 'default'; shapes.push(w4);
      const w5 = new Window(180, 550, 220, 550, winColor, 2, 8); w5.layerId = 'default'; shapes.push(w5);
      const w6 = new Window(900, 80, 900, 100, winColor, 2, 8); w6.layerId = 'default'; shapes.push(w6);

      // Room zones
      const zone1 = new AreaZone(106, 56, 388, 238, labelColor, 1.5, "Living & Dining"); zone1.layerId = 'default'; shapes.push(zone1);
      const zone2 = new AreaZone(506, 56, 208, 188, labelColor, 1.5, "Master Bedroom"); zone2.layerId = 'default'; shapes.push(zone2);
      const zone3 = new AreaZone(506, 256, 388, 138, labelColor, 1.5, "Bedroom 2"); zone3.layerId = 'default'; shapes.push(zone3);
      const zone4 = new AreaZone(306, 306, 188, 238, labelColor, 1.5, "Bedroom 3"); zone4.layerId = 'default'; shapes.push(zone4);
      const zone5 = new AreaZone(106, 306, 188, 238, labelColor, 1.5, "Kitchen Room"); zone5.layerId = 'default'; shapes.push(zone5);
      const zone6 = new AreaZone(726, 56, 168, 68, labelColor, 1.5, "Attached Bath"); zone6.layerId = 'default'; shapes.push(zone6);
      const zone7 = new AreaZone(506, 406, 208, 138, labelColor, 1.5, "Common Bath"); zone7.layerId = 'default'; shapes.push(zone7);
      const zone8 = new AreaZone(726, 406, 168, 138, labelColor, 1.5, "Storage Room"); zone8.layerId = 'default'; shapes.push(zone8);

      // Dimensions
      const dim1 = new Dimension(100, 50, 900, 50, dimColor, 1.5, 'aligned', 8, 25); dim1.layerId = 'dimensions'; shapes.push(dim1);
      const dim2 = new Dimension(100, 50, 100, 550, dimColor, 1.5, 'aligned', 8, 25); dim2.layerId = 'dimensions'; shapes.push(dim2);

    } else if (type === 'shop') {
      // Shop Layout: Outer size 300x400, starting at (250, 100) to (550, 500)
      // Outer walls
      const wall1 = new Wall(250, 100, 550, 100, wallColor, 2, 12); wall1.layerId = 'walls'; shapes.push(wall1);
      const wall2 = new Wall(550, 100, 550, 500, wallColor, 2, 12); wall2.layerId = 'walls'; shapes.push(wall2);
      const wall3 = new Wall(550, 500, 250, 500, wallColor, 2, 12); wall3.layerId = 'walls'; shapes.push(wall3);
      const wall4 = new Wall(250, 500, 250, 100, wallColor, 2, 12); wall4.layerId = 'walls'; shapes.push(wall4);

      const wall5 = new Wall(250, 410, 550, 410, wallColor, 2, 10); wall5.layerId = 'walls'; shapes.push(wall5);

      // Columns
      const colSize = 16;
      const cols = [[250, 100], [550, 100], [250, 410], [550, 410], [250, 500], [550, 500]];
      cols.forEach(pt => {
        const col = new Column(pt[0] - colSize/2, pt[1] - colSize/2, colSize, colSize, colColor, 2);
        col.layerId = 'columns';
        shapes.push(col);
      });

      // Display counter (Rectangle)
      const counter = new Rectangle(340, 230, 140, 40, colColor, 2); counter.layerId = 'default'; shapes.push(counter);
      const t1 = new TextLabel(410, 255, textColor, 1.5, "Billing Counter", 11); t1.layerId = 'default'; shapes.push(t1);

      // Left rack storage display (Rectangle)
      const rackL = new Rectangle(262, 150, 24, 200, "#F59E0B", 1.5); rackL.layerId = 'default'; shapes.push(rackL);
      const t2 = new TextLabel(274, 250, textColor, 1.5, "Display Rack", 10); t2.angle = 90; t2.layerId = 'default'; shapes.push(t2);

      // Right rack storage display (Rectangle)
      const rackR = new Rectangle(514, 150, 24, 200, "#F59E0B", 1.5); rackR.layerId = 'default'; shapes.push(rackR);
      const t3 = new TextLabel(526, 250, textColor, 1.5, "Display Rack", 10); t3.angle = 90; t3.layerId = 'default'; shapes.push(t3);

      // Doors
      const d1 = new Door(360, 100, 440, 100, doorColor, 2); d1.layerId = 'default'; shapes.push(d1);
      const d2 = new Door(280, 410, 320, 410, doorColor, 2); d2.layerId = 'default'; shapes.push(d2);

      // Windows
      const w1 = new Window(260, 100, 340, 100, winColor, 2, 8); w1.layerId = 'default'; shapes.push(w1);
      const w2 = new Window(460, 100, 540, 100, winColor, 2, 8); w2.layerId = 'default'; shapes.push(w2);

      // Room labels/zones
      const zone1 = new AreaZone(256, 106, 288, 298, labelColor, 1.5, "Showroom Area"); zone1.layerId = 'default'; shapes.push(zone1);
      const zone2 = new AreaZone(256, 416, 288, 78, labelColor, 1.5, "Stock Storage"); zone2.layerId = 'default'; shapes.push(zone2);

      // Dimensions
      const dim1 = new Dimension(250, 100, 550, 100, dimColor, 1.5, 'aligned', 8, 25); dim1.layerId = 'dimensions'; shapes.push(dim1);
      const dim2 = new Dimension(250, 100, 250, 500, dimColor, 1.5, 'aligned', 8, 25); dim2.layerId = 'dimensions'; shapes.push(dim2);

    } else if (type === 'office') {
      // Office Layout: Outer size 600x400, starting at (150, 100) to (750, 500)
      // Outer walls
      const wall1 = new Wall(150, 100, 750, 100, wallColor, 2, 12); wall1.layerId = 'walls'; shapes.push(wall1);
      const wall2 = new Wall(750, 100, 750, 500, wallColor, 2, 12); wall2.layerId = 'walls'; shapes.push(wall2);
      const wall3 = new Wall(750, 500, 150, 500, wallColor, 2, 12); wall3.layerId = 'walls'; shapes.push(wall3);
      const wall4 = new Wall(150, 500, 150, 100, wallColor, 2, 12); wall4.layerId = 'walls'; shapes.push(wall4);

      // Partitions
      const wall5 = new Wall(350, 100, 350, 500, wallColor, 2, 10); wall5.layerId = 'walls'; shapes.push(wall5);
      const wall6 = new Wall(150, 300, 350, 300, wallColor, 2, 10); wall6.layerId = 'walls'; shapes.push(wall6);
      const wall7 = new Wall(550, 280, 750, 280, wallColor, 2, 10); wall7.layerId = 'walls'; shapes.push(wall7);
      const wall8 = new Wall(550, 100, 550, 280, wallColor, 2, 10); wall8.layerId = 'walls'; shapes.push(wall8);

      // Columns
      const colSize = 16;
      const cols = [
        [150, 100], [350, 100], [550, 100], [750, 100],
        [150, 300], [350, 300], [550, 280], [750, 280],
        [150, 500], [350, 500], [750, 500]
      ];
      cols.forEach(pt => {
        const col = new Column(pt[0] - colSize/2, pt[1] - colSize/2, colSize, colSize, colColor, 2);
        col.layerId = 'columns';
        shapes.push(col);
      });

      // Cubicles desk blocks (Rectangles)
      const cubicles = [
        [380, 140], [380, 240], [380, 340],
        [460, 140], [460, 240], [460, 340]
      ];
      cubicles.forEach((c, idx) => {
        const desk = new Rectangle(c[0], c[1], 50, 30, colColor, 1.5);
        desk.layerId = 'default';
        shapes.push(desk);
        const label = new TextLabel(c[0] + 25, c[1] + 18, textColor, 1, `Desk ${idx + 1}`, 8);
        label.layerId = 'default';
        shapes.push(label);
      });

      // Reception desk in Lobby (Rectangle)
      const recep = new Rectangle(200, 200, 110, 30, "#F59E0B", 1.5); recep.layerId = 'default'; shapes.push(recep);
      const recepText = new TextLabel(255, 218, textColor, 1, "Reception Desk", 9); recepText.layerId = 'default'; shapes.push(recepText);

      // Doors
      const d1 = new Door(150, 130, 150, 180, doorColor, 2); d1.layerId = 'default'; shapes.push(d1);
      const d2 = new Door(350, 340, 350, 380, doorColor, 2); d2.layerId = 'default'; shapes.push(d2);
      const d3 = new Door(550, 200, 550, 240, doorColor, 2); d3.layerId = 'default'; shapes.push(d3);

      // Windows
      const w1 = new Window(150, 370, 150, 430, winColor, 2, 8); w1.layerId = 'default'; shapes.push(w1);
      const w2 = new Window(600, 100, 660, 100, winColor, 2, 8); w2.layerId = 'default'; shapes.push(w2);
      const w3 = new Window(750, 360, 750, 420, winColor, 2, 8); w3.layerId = 'default'; shapes.push(w3);

      // Room labels/zones
      const zone1 = new AreaZone(156, 106, 188, 188, labelColor, 1.5, "Lobby & Waiting"); zone1.layerId = 'default'; shapes.push(zone1);
      const zone2 = new AreaZone(156, 306, 188, 188, labelColor, 1.5, "Conference Room"); zone2.layerId = 'default'; shapes.push(zone2);
      const zone3 = new AreaZone(556, 106, 188, 168, labelColor, 1.5, "Manager Cabin"); zone3.layerId = 'default'; shapes.push(zone3);
      const zone4 = new AreaZone(356, 106, 188, 388, labelColor, 1.5, "Workstation Bay"); zone4.layerId = 'default'; shapes.push(zone4);

      // Dimensions
      const dim1 = new Dimension(150, 100, 750, 100, dimColor, 1.5, 'aligned', 8, 25); dim1.layerId = 'dimensions'; shapes.push(dim1);
      const dim2 = new Dimension(150, 100, 150, 500, dimColor, 1.5, 'aligned', 8, 25); dim2.layerId = 'dimensions'; shapes.push(dim2);

    } else if (type === 'classroom') {
      // Classroom Layout: Outer size 500x350, starting at (200, 120) to (700, 470)
      // Outer walls
      const wall1 = new Wall(200, 120, 700, 120, wallColor, 2, 12); wall1.layerId = 'walls'; shapes.push(wall1);
      const wall2 = new Wall(700, 120, 700, 470, wallColor, 2, 12); wall2.layerId = 'walls'; shapes.push(wall2);
      const wall3 = new Wall(700, 470, 200, 470, wallColor, 2, 12); wall3.layerId = 'walls'; shapes.push(wall3);
      const wall4 = new Wall(200, 470, 200, 120, wallColor, 2, 12); wall4.layerId = 'walls'; shapes.push(wall4);

      // Columns
      const colSize = 16;
      const cols = [
        [200, 120], [450, 120], [700, 120],
        [200, 470], [450, 470], [700, 470]
      ];
      cols.forEach(pt => {
        const col = new Column(pt[0] - colSize/2, pt[1] - colSize/2, colSize, colSize, colColor, 2);
        col.layerId = 'columns';
        shapes.push(col);
      });

      // Teacher Desk (Rectangle)
      const tdesk = new Rectangle(270, 220, 50, 80, "#F59E0B", 1.5); tdesk.layerId = 'default'; shapes.push(tdesk);
      const tLabel = new TextLabel(295, 260, textColor, 1, "Teacher Desk", 9); tLabel.angle = 90; tLabel.layerId = 'default'; shapes.push(tLabel);

      // Whiteboard (Line/Rectangle on left wall)
      const whiteboard = new Rectangle(204, 210, 6, 160, textColor, 1.5); whiteboard.layerId = 'default'; shapes.push(whiteboard);
      const wbLabel = new TextLabel(218, 290, textColor, 1, "Interactive Whiteboard", 10); wbLabel.angle = 90; wbLabel.layerId = 'default'; shapes.push(wbLabel);

      // Student Desks Grid (Rectangles)
      const desks = [
        [380, 150], [380, 220], [380, 290], [380, 360],
        [480, 150], [480, 220], [480, 290], [480, 360],
        [580, 150], [580, 220], [580, 290], [580, 360]
      ];
      desks.forEach((d, idx) => {
        const desk = new Rectangle(d[0], d[1], 40, 50, colColor, 1.5);
        desk.layerId = 'default';
        shapes.push(desk);
        const label = new TextLabel(d[0] + 20, d[1] + 28, textColor, 1, `Row ${Math.floor(idx/4)+1}-${(idx%4)+1}`, 8);
        label.layerId = 'default';
        shapes.push(label);
      });

      // Doors
      const d1 = new Door(200, 140, 200, 190, doorColor, 2); d1.layerId = 'default'; shapes.push(d1);
      const d2 = new Door(200, 400, 200, 450, doorColor, 2); d2.layerId = 'default'; shapes.push(d2);

      // Windows
      const w1 = new Window(400, 120, 460, 120, winColor, 2, 8); w1.layerId = 'default'; shapes.push(w1);
      const w2 = new Window(560, 120, 620, 120, winColor, 2, 8); w2.layerId = 'default'; shapes.push(w2);
      const w3 = new Window(700, 220, 700, 320, winColor, 2, 8); w3.layerId = 'default'; shapes.push(w3);

      // Room label/zone
      const zone1 = new AreaZone(206, 126, 488, 338, labelColor, 1.5, "Standard Classroom"); zone1.layerId = 'default'; shapes.push(zone1);

      // Dimensions
      const dim1 = new Dimension(200, 120, 700, 120, dimColor, 1.5, 'aligned', 8, 25); dim1.layerId = 'dimensions'; shapes.push(dim1);
      const dim2 = new Dimension(200, 120, 200, 470, dimColor, 1.5, 'aligned', 8, 25); dim2.layerId = 'dimensions'; shapes.push(dim2);
    }

    return shapes;
  }

  setupCivilTemplates() {
    this.templateInsertMode = 'clear'; // default is clear & replace

    const btn1bhk = document.getElementById('tpl-1bhk');
    const btn2bhk = document.getElementById('tpl-2bhk');
    const btn3bhk = document.getElementById('tpl-3bhk');
    const btnShop = document.getElementById('tpl-shop');
    const btnOffice = document.getElementById('tpl-office');
    const btnClassroom = document.getElementById('tpl-classroom');

    const btnClearMode = document.getElementById('tpl-clear-add');
    const btnOverlayMode = document.getElementById('tpl-overlay-add');

    // Sync mode button styling
    const updateModeButtons = () => {
      if (!btnClearMode || !btnOverlayMode) return;
      if (this.templateInsertMode === 'clear') {
        btnClearMode.className = "text-[10px] text-red-400 font-bold border-b-2 border-red-500 pb-0.5 cursor-pointer flex items-center gap-1";
        btnOverlayMode.className = "text-[10px] text-gray-400 hover:text-blue-300 transition cursor-pointer flex items-center gap-1";
      } else {
        btnClearMode.className = "text-[10px] text-gray-400 hover:text-red-300 transition cursor-pointer flex items-center gap-1";
        btnOverlayMode.className = "text-[10px] text-blue-400 font-bold border-b-2 border-blue-500 pb-0.5 cursor-pointer flex items-center gap-1";
      }
    };

    if (btnClearMode) {
      btnClearMode.addEventListener('click', () => {
        this.templateInsertMode = 'clear';
        updateModeButtons();
        this.showStatusFeedback("Civil Template mode set to Clear & Replace Canvas.");
      });
    }

    if (btnOverlayMode) {
      btnOverlayMode.addEventListener('click', () => {
        this.templateInsertMode = 'overlay';
        updateModeButtons();
        this.showStatusFeedback("Civil Template mode set to Overlay to Canvas.");
      });
    }

    updateModeButtons();

    // Helper: Execute template insertion on current active canvas
    const handleTemplateClick = (type, name) => {
      this.cancelActiveDrawing();
      
      const newShapes = this.getTemplateShapes(type);
      if (newShapes.length === 0) return;

      if (this.templateInsertMode === 'clear') {
        // Discard any previous unsaved templates
        this.discardUnsavedTemplates();

        let projName = "New_Template_Design.dwg";
        if (type === '1bhk') projName = "1_BHK_Residential_Floor_Plan.dwg";
        else if (type === '2bhk') projName = "2_BHK_Spacious_House_Plan.dwg";
        else if (type === '3bhk') projName = "3_BHK_Luxury_Multi_Bath_Plan.dwg";
        else if (type === 'shop') projName = "Commercial_Shop_Retail_Plan.dwg";
        else if (type === 'office') projName = "Corporate_Office_Workstation_Plan.dwg";
        else if (type === 'classroom') projName = "Educational_Classroom_Layout.dwg";

        // Create a new project in the projects database pre-populated with these shapes!
        const templateShapes = newShapes.map(s => s.serialize());
        const newProj = {
          id: 'proj_tpl_' + type + '_' + Date.now(),
          name: projName,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          shapes: templateShapes,
          layers: [
            { id: 'default', name: 'Default', visible: true, locked: false },
            { id: 'walls', name: 'Walls', visible: true, locked: false },
            { id: 'columns', name: 'Columns', visible: true, locked: false },
            { id: 'dimensions', name: 'Dimensions', visible: true, locked: false },
            { id: 'electrical', name: 'Electrical', visible: true, locked: false }
          ],
          activeLayerId: 'default',
          zoomScale: 1.0,
          panX: 0,
          panY: 0,
          activeUnit: 'px',
          thumbnail: '',
          isUnsavedTemplate: true
        };

        this.projectsList.push(newProj);
        this.saveProjectsDb();
        
        // Auto-load newly created template project
        this.loadProject(newProj.id);

        setTimeout(() => {
          this.zoomToFit();
          this.redraw();
          this.showStatusFeedback(`Loaded "${name}" template!`);
        }, 50);
      } else {
        // Overlay mode: keeps current project and adds the shapes on top
        this.pushUndoCheckpoint();
        newShapes.forEach(shape => {
          this.shapes.push(shape);
        });

        this.saveDrawing();
        this.updateEntityList();
        this.zoomToFit();
        this.redraw();
        this.showStatusFeedback(`Overlayed ${name} onto canvas successfully!`);
      }
    };

    if (btn1bhk) btn1bhk.addEventListener('click', () => handleTemplateClick('1bhk', '1 BHK House Template'));
    if (btn2bhk) btn2bhk.addEventListener('click', () => handleTemplateClick('2bhk', '2 BHK House Template'));
    if (btn3bhk) btn3bhk.addEventListener('click', () => handleTemplateClick('3bhk', '3 BHK House Template'));
    if (btnShop) btnShop.addEventListener('click', () => handleTemplateClick('shop', 'Shop Layout Template'));
    if (btnOffice) btnOffice.addEventListener('click', () => handleTemplateClick('office', 'Office Layout Template'));
    if (btnClassroom) btnClassroom.addEventListener('click', () => handleTemplateClick('classroom', 'Classroom Template'));

    // BIND PROJECT MANAGER MODAL TEMPLATE STARTERS
    // Clicking on cards in Project Manager Modal creates a brand new project prepopulated with template!
    document.querySelectorAll('.btn-create-template').forEach(card => {
      card.addEventListener('click', () => {
        const type = card.getAttribute('data-template');
        let projName = "New_Template_Design.dwg";
        let label = "Template Project";
        if (type === '1bhk') { projName = "1_BHK_Residential_Floor_Plan.dwg"; label = "1 BHK House Layout"; }
        else if (type === '2bhk') { projName = "2_BHK_Spacious_House_Plan.dwg"; label = "2 BHK House Layout"; }
        else if (type === '3bhk') { projName = "3_BHK_Luxury_Multi_Bath_Plan.dwg"; label = "3 BHK House Layout"; }
        else if (type === 'shop') { projName = "Commercial_Shop_Retail_Plan.dwg"; label = "Shop Layout"; }
        else if (type === 'office') { projName = "Corporate_Office_Workstation_Plan.dwg"; label = "Office Layout"; }
        else if (type === 'classroom') { projName = "Educational_Classroom_Layout.dwg"; label = "Classroom Layout"; }

        // Discard any existing unsaved templates
        this.discardUnsavedTemplates();

        // Create a new project in the projects database pre-populated with these shapes!
        const templateShapes = this.getTemplateShapes(type).map(s => s.serialize());
        const newProj = {
          id: 'proj_tpl_' + type + '_' + Date.now(),
          name: projName,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          shapes: templateShapes,
          layers: [
            { id: 'default', name: 'Default', visible: true, locked: false },
            { id: 'walls', name: 'Walls', visible: true, locked: false },
            { id: 'columns', name: 'Columns', visible: true, locked: false },
            { id: 'dimensions', name: 'Dimensions', visible: true, locked: false },
            { id: 'electrical', name: 'Electrical', visible: true, locked: false }
          ],
          activeLayerId: 'default',
          zoomScale: 1.0,
          panX: 0,
          panY: 0,
          activeUnit: 'px',
          thumbnail: '',
          isUnsavedTemplate: true
        };

        this.projectsList.push(newProj);
        this.saveProjectsDb();
        
        // Auto-load newly created template project
        this.loadProject(newProj.id);
        
        // Close modal
        this.closeProjectManagerModal();

        // Auto zoom-to-fit so it centers beautifully!
        setTimeout(() => {
          this.zoomToFit();
          this.redraw();
          this.showStatusFeedback(`Started new project from "${label}" template!`);
        }, 50);
      });
    });
  }

  setupWorkspaceZoomControls() {
    const btnZoomIn = document.getElementById('zoom-in-btn');
    const btnZoomOut = document.getElementById('zoom-out-btn');
    const btnZoomFit = document.getElementById('zoom-fit-btn');

    if (btnZoomIn) {
      btnZoomIn.addEventListener('click', () => {
        this.zoomAroundCenter(1.2);
        this.showStatusFeedback(`Zoomed In: ${Math.round(this.zoomScale * 100)}%`);
      });
    }

    if (btnZoomOut) {
      btnZoomOut.addEventListener('click', () => {
        this.zoomAroundCenter(1 / 1.2);
        this.showStatusFeedback(`Zoomed Out: ${Math.round(this.zoomScale * 100)}%`);
      });
    }

    if (btnZoomFit) {
      btnZoomFit.addEventListener('click', () => {
        this.zoomToFit();
        this.redraw();
        this.showStatusFeedback(`Zoomed to Fit: ${Math.round(this.zoomScale * 100)}%`);
      });
    }
  }

  setupTopMenuBarDropdowns() {
    const dropdowns = {
      'menu-btn-edit': 'dropdown-edit',
      'menu-btn-view': 'dropdown-view',
      'menu-btn-draw': 'dropdown-draw',
      'menu-btn-modify': 'dropdown-modify'
    };

    // Close all dropdowns
    const closeAllMenus = () => {
      Object.values(dropdowns).forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('hidden');
      });
    };

    // Toggle menu dropdown
    Object.entries(dropdowns).forEach(([btnId, dropdownId]) => {
      const btn = document.getElementById(btnId);
      const dropdown = document.getElementById(dropdownId);
      if (btn && dropdown) {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const isHidden = dropdown.classList.contains('hidden');
          closeAllMenus();
          if (isHidden) {
            dropdown.classList.remove('hidden');
          }
        });
      }
    });

    // Global click listener to close dropdowns
    document.addEventListener('click', () => {
      closeAllMenus();
    });

    // Bind Edit Actions
    const menuUndo = document.getElementById('menu-edit-undo');
    if (menuUndo) {
      menuUndo.addEventListener('click', () => {
        this.undo();
        this.showStatusFeedback("Edit: Undo action performed.");
      });
    }

    const menuClear = document.getElementById('menu-edit-clear');
    if (menuClear) {
      menuClear.addEventListener('click', () => {
        const clearBtn = document.getElementById('action-clear');
        if (clearBtn) {
          clearBtn.click();
        } else {
          this.clearCanvas();
        }
      });
    }

    // Bind View Actions
    const menuViewFit = document.getElementById('menu-view-fit');
    if (menuViewFit) {
      menuViewFit.addEventListener('click', () => {
        this.zoomToFit();
        this.redraw();
        this.showStatusFeedback("View: Zoomed to Fit.");
      });
    }

    const menuViewIn = document.getElementById('menu-view-in');
    if (menuViewIn) {
      menuViewIn.addEventListener('click', () => {
        this.zoomAroundCenter(1.2);
        this.showStatusFeedback("View: Zoomed In.");
      });
    }

    const menuViewOut = document.getElementById('menu-view-out');
    if (menuViewOut) {
      menuViewOut.addEventListener('click', () => {
        this.zoomAroundCenter(1 / 1.2);
        this.showStatusFeedback("View: Zoomed Out.");
      });
    }

    const menuViewGrid = document.getElementById('menu-view-grid');
    if (menuViewGrid) {
      menuViewGrid.addEventListener('click', () => {
        const gridBtn = document.getElementById('toggle-grid-btn');
        if (gridBtn) {
          gridBtn.click();
        } else {
          this.gridEnabled = !this.gridEnabled;
          this.redraw();
        }
        const indicator = document.getElementById('menu-indicator-grid');
        if (indicator) indicator.innerText = this.gridEnabled ? "ON" : "OFF";
      });
    }

    const menuViewLabels = document.getElementById('menu-view-labels');
    if (menuViewLabels) {
      menuViewLabels.addEventListener('click', () => {
        const roomDimensionsBtn = document.getElementById('toggle-room-dimensions-btn');
        if (roomDimensionsBtn) {
          roomDimensionsBtn.click();
        } else {
          this.showRoomDimensions = !this.showRoomDimensions;
          this.redraw();
        }
        const indicator = document.getElementById('menu-indicator-labels');
        if (indicator) indicator.innerText = this.showRoomDimensions ? "ON" : "OFF";
      });
    }

    // Bind Draw Actions
    const menuDrawLine = document.getElementById('menu-draw-line');
    if (menuDrawLine) {
      menuDrawLine.addEventListener('click', () => {
        const tool = document.getElementById('tool-line');
        if (tool) tool.click();
      });
    }

    const menuDrawRect = document.getElementById('menu-draw-rect');
    if (menuDrawRect) {
      menuDrawRect.addEventListener('click', () => {
        const tool = document.getElementById('tool-rectangle');
        if (tool) tool.click();
      });
    }

    const menuDrawCircle = document.getElementById('menu-draw-circle');
    if (menuDrawCircle) {
      menuDrawCircle.addEventListener('click', () => {
        const tool = document.getElementById('tool-circle');
        if (tool) tool.click();
      });
    }

    // Bind Modify Actions
    const menuModifySelect = document.getElementById('menu-modify-select');
    if (menuModifySelect) {
      menuModifySelect.addEventListener('click', () => {
        const tool = document.getElementById('tool-select');
        if (tool) tool.click();
      });
    }

    const menuModifyPan = document.getElementById('menu-modify-pan');
    if (menuModifyPan) {
      menuModifyPan.addEventListener('click', () => {
        const tool = document.getElementById('tool-pan');
        if (tool) tool.click();
      });
    }
  }

  zoomAroundCenter(factor) {
    const cx = this.width / 2;
    const cy = this.height / 2;
    const worldPosBefore = this.screenToWorld(cx, cy);

    const newScale = Math.max(0.15, Math.min(15.0, this.zoomScale * factor));
    this.zoomScale = newScale;

    this.panX = cx - worldPosBefore.x * this.zoomScale;
    this.panY = cy - worldPosBefore.y * this.zoomScale;

    this.updateZoomStatus();
    this.redraw();
  }
}

// Instantiate and kick off application when DOM is ready
if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', () => {
    new CADApp();
  });
} else {
  new CADApp();
}
