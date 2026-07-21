/* =========================================================
   FluxReviews — Interactive Background Particle Engine
   ========================================================= */

class Particle {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.reset();
  }

  reset() {
    this.x = Math.random() * this.canvas.width;
    this.y = Math.random() * this.canvas.height;
    this.baseX = this.x;
    this.baseY = this.y;
    this.vx = (Math.random() - 0.5) * 0.4;
    this.vy = (Math.random() - 0.5) * 0.4;
    this.radius = Math.random() * 2 + 1; // 1px to 3px
    this.baseRadius = this.radius;
    this.color = 'rgba(255, 255, 255, 0.12)';
    this.activeColor = this.getRandomThemeColor();
  }

  getRandomThemeColor() {
    const colors = [
      'rgba(0, 229, 255, 0.6)',  // Cyan (#00e5ff)
      'rgba(181, 55, 242, 0.6)', // Violet (#b537f2)
      'rgba(255, 79, 154, 0.6)'  // Pink (#ff4f9a)
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  update(mouse) {
    // 1. Apply baseline organic drift
    this.baseX += this.vx;
    this.baseY += this.vy;

    // Wrap around screen boundaries
    if (this.baseX < 0) this.baseX = this.canvas.width;
    if (this.baseX > this.canvas.width) this.baseX = 0;
    if (this.baseY < 0) this.baseY = this.canvas.height;
    if (this.baseY > this.canvas.height) this.baseY = 0;

    // 2. Physics repulsion calculation
    const dx = this.baseX - mouse.x;
    const dy = this.baseY - mouse.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const forceRadius = mouse.radius;

    if (distance < forceRadius) {
      // Repulsion force (strongest near center, weakening near edge)
      const force = (forceRadius - distance) / forceRadius;
      const angle = Math.atan2(dy, dx);
      
      // Push particles outwards to the rim
      this.x = this.baseX + Math.cos(angle) * force * 35;
      this.y = this.baseY + Math.sin(angle) * force * 35;
      
      // Growth and color change near the rim
      this.radius = this.baseRadius + force * 2.5;
      this.color = this.activeColor;
    } else {
      // Return slowly to baseline positions
      this.x += (this.baseX - this.x) * 0.08;
      this.y += (this.baseY - this.y) * 0.08;
      this.radius += (this.baseRadius - this.radius) * 0.08;
      this.color = 'rgba(255, 255, 255, 0.12)';
    }
  }

  draw() {
    this.ctx.fillStyle = this.color;
    this.ctx.beginPath();
    this.ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    this.ctx.fill();
  }
}

class ParticleSystem {
  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.id = 'flux-particles';
    document.body.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');
    
    this.particles = [];
    this.mouse = { x: -1000, y: -1000, targetX: -1000, targetY: -1000, radius: 110 };

    this.init();
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('mousemove', (e) => this.onMouseMove(e));
    window.addEventListener('mouseout', () => this.onMouseLeave());
    
    // Support touch devices
    window.addEventListener('touchmove', (e) => this.onTouchMove(e));
    window.addEventListener('touchend', () => this.onMouseLeave());

    this.animate();
  }

  init() {
    this.resize();
    const density = window.innerWidth < 768 ? 45 : 120; // Fewer particles on mobile
    for (let i = 0; i < density; i++) {
      this.particles.push(new Particle(this.canvas));
    }
  }

  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  onMouseMove(e) {
    this.mouse.targetX = e.clientX;
    this.mouse.targetY = e.clientY;
  }

  onTouchMove(e) {
    if (e.touches.length > 0) {
      this.mouse.targetX = e.touches[0].clientX;
      this.mouse.targetY = e.touches[0].clientY;
    }
  }

  onMouseLeave() {
    this.mouse.targetX = -1000;
    this.mouse.targetY = -1000;
  }

  animate() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Apply linear interpolation (lerp) for smooth trailing delay (inertia)
    this.mouse.x += (this.mouse.targetX - this.mouse.x) * 0.08;
    this.mouse.y += (this.mouse.targetY - this.mouse.y) * 0.08;

    this.particles.forEach(p => {
      p.update(this.mouse);
      p.draw();
    });

    requestAnimationFrame(() => this.animate());
  }
}

// Auto-run on DOM load
window.addEventListener('DOMContentLoaded', () => {
  new ParticleSystem();
});
