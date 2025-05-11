export class GameEngine {
    constructor(canvas, callbacks) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.callbacks = callbacks;
        
        // Game state
        this.level = 1;
        this.gameOver = false;
        this.success = false;
        
        // Player properties
        this.player = {
            x: 50,
            y: this.canvas.height / 2,
            radius: 20,
            color: '#87CEEB',
            shape: 'circle',
            speed: 8,
            infected: false,
            infectionProgress: 0,
            trail: [] // For motion trail effect
        };

        // Shape types with their properties
        this.shapeTypes = [
            'triangle', 'square', 'rectangle', 'ellipse', 'star',
            'pentagon', 'hexagon', 'octagon', 'diamond', 'cross',
            'heart', 'moon', 'cloud', 'lightning', 'spiral'
        ];
        
        // Colors with their lighter variants
        this.obstacleColors = [
            { base: '#FF0000', light: '#FF6666' },
            { base: '#FF4500', light: '#FF8C66' },
            { base: '#FFA500', light: '#FFC266' },
            { base: '#FFD700', light: '#FFE666' },
            { base: '#FFFF00', light: '#FFFF66' },
            { base: '#9ACD32', light: '#B8E666' },
            { base: '#32CD32', light: '#66E666' },
            { base: '#008000', light: '#66B866' }
        ];

        // Initialize obstacles
        this.obstacles = this.createInitialObstacles();
        
        // Game boundaries with fancy entrance and exit
        this.entrance = {
            x: 0,
            y: this.canvas.height / 2 - 50,
            width: 20,
            height: 100,
            color: '#87CEEB',
            lightColor: '#B0E0E6'
        };
        
        this.exit = {
            x: this.canvas.width - 20,
            y: this.canvas.height / 2 - 50,
            width: 20,
            height: 100,
            color: '#87CEEB',
            lightColor: '#B0E0E6'
        };

        // Particle effects
        this.particles = [];
        
        // Event listeners
        this.setupEventListeners();
        
        // Start game loop
        this.lastTime = 0;
        this.accumulator = 0;
        this.timeStep = 1000 / 60; // 60 FPS
        this.gameLoop(0);

        // Add stuck detection properties
        this.stuckTimer = 0;
        this.stuckThreshold = 2000; // 2 seconds
        this.lastPlayerPosition = { x: 0, y: 0 };
        this.positionChangeThreshold = 5; // Minimum distance to consider movement

        // Add physics properties
        this.elasticity = 0.8; // Bounce factor
        this.friction = 0.99; // Friction factor

        // Add entrance protection properties
        this.entranceProtectionRadius = 150; // Protection zone radius
        this.entranceProtectionForce = 0.8; // Force to push obstacles away
    }

    createInitialObstacles() {
        return [{
            x: this.canvas.width / 2,
            y: this.canvas.height / 2,
            size: 40,
            color: this.obstacleColors[0].base,
            lightColor: this.obstacleColors[0].light,
            shape: this.shapeTypes[0],
            speedX: 0,
            speedY: 0,
            baseSpeed: 2,
            isBlind: false,
            blindTimer: 0,
            blindDuration: 0,
            lastBlindTime: 0,
            rotation: 0,
            rotationSpeed: (Math.random() - 0.5) * 0.02,
            blindChance: 0.3,
            blindDurationRange: { min: 1000, max: 3000 },
            chaseAccuracy: 0.5 + Math.random() * 0.5
        }];
    }

    setupEventListeners() {
        this.keys = {};
        window.addEventListener('keydown', (e) => this.keys[e.key] = true);
        window.addEventListener('keyup', (e) => this.keys[e.key] = false);
        
        // Touch controls for mobile
        this.canvas.addEventListener('touchstart', (e) => {
            const touch = e.touches[0];
            const rect = this.canvas.getBoundingClientRect();
            this.touchX = touch.clientX - rect.left;
            this.touchY = touch.clientY - rect.top;
        });
        
        this.canvas.addEventListener('touchmove', (e) => {
            const touch = e.touches[0];
            const rect = this.canvas.getBoundingClientRect();
            this.touchX = touch.clientX - rect.left;
            this.touchY = touch.clientY - rect.top;
        });
    }

    createParticles(x, y, color) {
        for (let i = 0; i < 10; i++) {
            this.particles.push({
                x,
                y,
                vx: (Math.random() - 0.5) * 4,
                vy: (Math.random() - 0.5) * 4,
                radius: Math.random() * 3,
                color,
                life: 1
            });
        }
    }

    updateParticles() {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.life -= 0.02;
            
            if (p.life <= 0) {
                this.particles.splice(i, 1);
            }
        }
    }

    drawParticles() {
        this.particles.forEach(p => {
            this.ctx.globalAlpha = p.life;
            this.ctx.fillStyle = p.color;
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            this.ctx.fill();
        });
        this.ctx.globalAlpha = 1;
    }

    updatePlayerTrail() {
        this.player.trail.unshift({ x: this.player.x, y: this.player.y });
        if (this.player.trail.length > 10) {
            this.player.trail.pop();
        }
    }

    drawPlayerTrail() {
        this.player.trail.forEach((pos, index) => {
            const alpha = 1 - (index / this.player.trail.length);
            this.ctx.globalAlpha = alpha * 0.5;
            this.ctx.fillStyle = this.player.color;
            this.ctx.beginPath();
            this.ctx.arc(pos.x, pos.y, this.player.radius * 0.8, 0, Math.PI * 2);
            this.ctx.fill();
        });
        this.ctx.globalAlpha = 1;
    }

    updatePlayer() {
        // Store previous position
        this.lastPlayerPosition.x = this.player.x;
        this.lastPlayerPosition.y = this.player.y;

        // Keyboard controls
        if (this.keys['ArrowUp'] || this.keys['w']) this.player.y -= this.player.speed;
        if (this.keys['ArrowDown'] || this.keys['s']) this.player.y += this.player.speed;
        if (this.keys['ArrowLeft'] || this.keys['a']) this.player.x -= this.player.speed;
        if (this.keys['ArrowRight'] || this.keys['d']) this.player.x += this.player.speed;

        // Touch controls
        if (this.touchX && this.touchY) {
            const dx = this.touchX - this.player.x;
            const dy = this.touchY - this.player.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance > 5) {
                this.player.x += (dx / distance) * this.player.speed;
                this.player.y += (dy / distance) * this.player.speed;
            }
        }

        // Keep player in bounds
        this.player.x = Math.max(this.player.radius, Math.min(this.canvas.width - this.player.radius, this.player.x));
        this.player.y = Math.max(this.player.radius, Math.min(this.canvas.height - this.player.radius, this.player.y));

        // Update trail
        this.updatePlayerTrail();

        // Check for exit collision
        if (this.checkExitCollision()) {
            this.success = true;
            this.callbacks.onSuccess();
        }

        // Check if player is stuck at entrance
        this.checkIfStuck();
    }

    checkIfStuck() {
        // Calculate distance moved
        const dx = this.player.x - this.lastPlayerPosition.x;
        const dy = this.player.y - this.lastPlayerPosition.y;
        const distanceMoved = Math.sqrt(dx * dx + dy * dy);

        // Check if player is near entrance
        const isNearEntrance = this.player.x < 100;

        if (isNearEntrance && distanceMoved < this.positionChangeThreshold) {
            this.stuckTimer += 16; // Assuming 60 FPS
            if (this.stuckTimer >= this.stuckThreshold) {
                this.resetLevel();
                this.stuckTimer = 0;
            }
        } else {
            this.stuckTimer = 0;
        }
    }

    updateObstacles() {
        this.obstacles.forEach(obstacle => {
            // Update rotation
            obstacle.rotation += obstacle.rotationSpeed;

            // Update blind state
            if (!obstacle.isBlind && Math.random() < obstacle.blindChance) {
                obstacle.isBlind = true;
                obstacle.blindDuration = obstacle.blindDurationRange.min + 
                    Math.random() * (obstacle.blindDurationRange.max - obstacle.blindDurationRange.min);
                obstacle.blindTimer = 0;
            }

            if (obstacle.isBlind) {
                obstacle.blindTimer += 16;
                if (obstacle.blindTimer >= obstacle.blindDuration) {
                    obstacle.isBlind = false;
                    obstacle.lastBlindTime = Date.now();
                }
            }

            // Calculate size-based speed
            const speed = this.calculateSizeBasedSpeed(obstacle.size);

            // Check if obstacle is in entrance protection zone
            const dxToEntrance = obstacle.x - this.entrance.x;
            const dyToEntrance = obstacle.y - (this.entrance.y + this.entrance.height/2);
            const distanceToEntrance = Math.sqrt(dxToEntrance * dxToEntrance + dyToEntrance * dyToEntrance);

            if (distanceToEntrance < this.entranceProtectionRadius) {
                // Calculate repulsion force
                const forceMagnitude = this.entranceProtectionForce * 
                    (1 - distanceToEntrance / this.entranceProtectionRadius);
                const forceX = (dxToEntrance / distanceToEntrance) * forceMagnitude;
                const forceY = (dyToEntrance / distanceToEntrance) * forceMagnitude;

                // Apply repulsion force
                obstacle.speedX += forceX;
                obstacle.speedY += forceY;
            }

            // Update position
            if (!obstacle.isBlind) {
                const dx = this.player.x - obstacle.x;
                const dy = this.player.y - obstacle.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance > 0) {
                    obstacle.speedX = (dx / distance) * speed * obstacle.chaseAccuracy;
                    obstacle.speedY = (dy / distance) * speed * obstacle.chaseAccuracy;
                }
            } else {
                // Random movement when blind
                obstacle.speedX += (Math.random() - 0.5) * 0.2;
                obstacle.speedY += (Math.random() - 0.5) * 0.2;
                
                // Limit speed
                const maxSpeed = speed * 0.5;
                obstacle.speedX = Math.max(-maxSpeed, Math.min(maxSpeed, obstacle.speedX));
                obstacle.speedY = Math.max(-maxSpeed, Math.min(maxSpeed, obstacle.speedY));
            }

            // Apply friction
            obstacle.speedX *= this.friction;
            obstacle.speedY *= this.friction;

            // Update position
            obstacle.x += obstacle.speedX;
            obstacle.y += obstacle.speedY;

            // Keep obstacle in bounds with bounce
            if (obstacle.x - obstacle.size < 0) {
                obstacle.x = obstacle.size;
                obstacle.speedX = -obstacle.speedX * this.elasticity;
            } else if (obstacle.x + obstacle.size > this.canvas.width) {
                obstacle.x = this.canvas.width - obstacle.size;
                obstacle.speedX = -obstacle.speedX * this.elasticity;
            }

            if (obstacle.y - obstacle.size < 0) {
                obstacle.y = obstacle.size;
                obstacle.speedY = -obstacle.speedY * this.elasticity;
            } else if (obstacle.y + obstacle.size > this.canvas.height) {
                obstacle.y = this.canvas.height - obstacle.size;
                obstacle.speedY = -obstacle.speedY * this.elasticity;
            }

            // Check collision with other obstacles
            this.obstacles.forEach(otherObstacle => {
                if (obstacle !== otherObstacle) {
                    this.handleObstacleCollision(obstacle, otherObstacle);
                }
            });

            // Check collision with player
            if (this.checkCollision(this.player, obstacle)) {
                this.handleCollision(obstacle);
            }
        });
    }

    calculateSizeBasedSpeed(size) {
        // Larger shapes move slower
        const minSize = 30;
        const maxSize = 90;
        const speedRange = 2.0 - 0.5; // Speed range from 2.0 to 0.5
        const sizeRatio = (size - minSize) / (maxSize - minSize);
        return 2.0 - (speedRange * sizeRatio);
    }

    handleCollision(obstacle) {
        // Only trigger game over if the player is not in the entrance protection zone
        const dxToEntrance = this.player.x - this.entrance.x;
        const dyToEntrance = this.player.y - (this.entrance.y + this.entrance.height/2);
        const distanceToEntrance = Math.sqrt(dxToEntrance * dxToEntrance + dyToEntrance * dyToEntrance);

        if (distanceToEntrance > this.entranceProtectionRadius) {
            this.player.infected = true;
            this.createParticles(this.player.x, this.player.y, obstacle.color);
            this.gameOver = true;
            this.callbacks.onGameOver();
        }
    }

    checkCollision(player, obstacle) {
        const dx = player.x - obstacle.x;
        const dy = player.y - obstacle.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // Get the actual collision radius based on the shape type
        let collisionRadius;
        switch (obstacle.shape) {
            case 'triangle':
                collisionRadius = obstacle.size * 0.8; // Triangle's inscribed circle
                break;
            case 'square':
                collisionRadius = obstacle.size * 0.7; // Square's inscribed circle
                break;
            case 'rectangle':
                collisionRadius = obstacle.size * 0.6; // Rectangle's inscribed circle
                break;
            case 'ellipse':
                collisionRadius = obstacle.size * 0.4; // Ellipse's average radius
                break;
            case 'star':
                collisionRadius = obstacle.size * 0.7; // Star's inscribed circle
                break;
            case 'pentagon':
                collisionRadius = obstacle.size * 0.8; // Pentagon's inscribed circle
                break;
            case 'hexagon':
                collisionRadius = obstacle.size * 0.85; // Hexagon's inscribed circle
                break;
            case 'octagon':
                collisionRadius = obstacle.size * 0.9; // Octagon's inscribed circle
                break;
            case 'diamond':
                collisionRadius = obstacle.size * 0.7; // Diamond's inscribed circle
                break;
            case 'cross':
                collisionRadius = obstacle.size * 0.5; // Cross's effective radius
                break;
            case 'heart':
                collisionRadius = obstacle.size * 0.6; // Heart's effective radius
                break;
            case 'moon':
                collisionRadius = obstacle.size * 0.7; // Moon's effective radius
                break;
            case 'cloud':
                collisionRadius = obstacle.size * 0.6; // Cloud's effective radius
                break;
            case 'lightning':
                collisionRadius = obstacle.size * 0.5; // Lightning's effective radius
                break;
            case 'spiral':
                collisionRadius = obstacle.size * 0.7; // Spiral's effective radius
                break;
            default:
                collisionRadius = obstacle.size * 0.8; // Default fallback
        }

        // Check if the distance is less than the sum of the player's radius and the obstacle's collision radius
        return distance < (player.radius + collisionRadius);
    }

    checkExitCollision() {
        return (
            this.player.x + this.player.radius > this.exit.x &&
            this.player.x - this.player.radius < this.exit.x + this.exit.width &&
            this.player.y + this.player.radius > this.exit.y &&
            this.player.y - this.player.radius < this.exit.y + this.exit.height
        );
    }

    nextLevel() {
        this.level++;
        this.callbacks.onLevelChange(this.level);
        this.resetLevel();
        
        // Create new obstacle with random properties
        const colorIndex = Math.floor(Math.random() * this.obstacleColors.length);
        const shapeIndex = Math.floor(Math.random() * this.shapeTypes.length);
        
        const newObstacle = {
            x: Math.random() * (this.canvas.width - 100) + 50,
            y: Math.random() * (this.canvas.height - 100) + 50,
            size: 30 + Math.random() * 60,
            color: this.obstacleColors[colorIndex].base,
            lightColor: this.obstacleColors[colorIndex].light,
            shape: this.shapeTypes[shapeIndex],
            speedX: 0,
            speedY: 0,
            baseSpeed: 2,
            isBlind: false,
            blindTimer: 0,
            blindDuration: 0,
            lastBlindTime: 0,
            rotation: Math.random() * Math.PI * 2,
            rotationSpeed: (Math.random() - 0.5) * 0.02,
            blindChance: 0.2 + Math.random() * 0.2,
            blindDurationRange: {
                min: 1000 + Math.random() * 1000,
                max: 2000 + Math.random() * 2000
            },
            chaseAccuracy: 0.3 + Math.random() * 0.7
        };
        
        this.obstacles.push(newObstacle);
    }

    resetLevel() {
        this.player.x = 50;
        this.player.y = this.canvas.height / 2;
        this.player.infected = false;
        this.player.infectionProgress = 0;
        this.player.trail = [];
        this.gameOver = false;
        this.success = false;
        this.particles = [];
        this.stuckTimer = 0;
    }

    drawShape(ctx, obstacle) {
        const size = obstacle.size;
        ctx.save();
        ctx.translate(obstacle.x, obstacle.y);
        ctx.rotate(obstacle.rotation);
        
        switch (obstacle.shape) {
            case 'triangle':
                ctx.beginPath();
                ctx.moveTo(0, -size);
                ctx.lineTo(size, size);
                ctx.lineTo(-size, size);
                ctx.closePath();
                break;
            case 'square':
                ctx.fillRect(-size/2, -size/2, size, size);
                break;
            case 'rectangle':
                ctx.fillRect(-size/2, -size/3, size, size * 2/3);
                break;
            case 'ellipse':
                ctx.beginPath();
                ctx.ellipse(0, 0, size/2, size/3, 0, 0, Math.PI * 2);
                break;
            case 'star':
                ctx.beginPath();
                for (let i = 0; i < 5; i++) {
                    const angle = (i * 4 * Math.PI) / 5;
                    const x = Math.cos(angle) * size;
                    const y = Math.sin(angle) * size;
                    if (i === 0) ctx.moveTo(x, y);
                    else ctx.lineTo(x, y);
                }
                ctx.closePath();
                break;
            case 'pentagon':
                ctx.beginPath();
                for (let i = 0; i < 5; i++) {
                    const angle = (i * 2 * Math.PI) / 5;
                    const x = Math.cos(angle) * size;
                    const y = Math.sin(angle) * size;
                    if (i === 0) ctx.moveTo(x, y);
                    else ctx.lineTo(x, y);
                }
                ctx.closePath();
                break;
            case 'hexagon':
                ctx.beginPath();
                for (let i = 0; i < 6; i++) {
                    const angle = (i * 2 * Math.PI) / 6;
                    const x = Math.cos(angle) * size;
                    const y = Math.sin(angle) * size;
                    if (i === 0) ctx.moveTo(x, y);
                    else ctx.lineTo(x, y);
                }
                ctx.closePath();
                break;
            case 'octagon':
                ctx.beginPath();
                for (let i = 0; i < 8; i++) {
                    const angle = (i * 2 * Math.PI) / 8;
                    const x = Math.cos(angle) * size;
                    const y = Math.sin(angle) * size;
                    if (i === 0) ctx.moveTo(x, y);
                    else ctx.lineTo(x, y);
                }
                ctx.closePath();
                break;
            case 'diamond':
                ctx.beginPath();
                ctx.moveTo(0, -size);
                ctx.lineTo(size, 0);
                ctx.lineTo(0, size);
                ctx.lineTo(-size, 0);
                ctx.closePath();
                break;
            case 'cross':
                ctx.beginPath();
                const crossSize = size * 0.7;
                ctx.fillRect(-crossSize/6, -crossSize/2, crossSize/3, crossSize);
                ctx.fillRect(-crossSize/2, -crossSize/6, crossSize, crossSize/3);
                break;
            case 'heart':
                ctx.beginPath();
                ctx.moveTo(0, size/4);
                ctx.bezierCurveTo(
                    size/2, -size/2,
                    size, size/4,
                    0, size
                );
                ctx.bezierCurveTo(
                    -size, size/4,
                    -size/2, -size/2,
                    0, size/4
                );
                break;
            case 'moon':
                ctx.beginPath();
                ctx.arc(0, 0, size, 0, Math.PI * 2);
                ctx.arc(size/2, 0, size * 0.8, 0, Math.PI * 2);
                break;
            case 'cloud':
                ctx.beginPath();
                ctx.arc(-size/2, 0, size/3, 0, Math.PI * 2);
                ctx.arc(0, 0, size/2, 0, Math.PI * 2);
                ctx.arc(size/2, 0, size/3, 0, Math.PI * 2);
                ctx.arc(0, -size/3, size/3, 0, Math.PI * 2);
                break;
            case 'lightning':
                ctx.beginPath();
                ctx.moveTo(0, -size);
                ctx.lineTo(size/2, 0);
                ctx.lineTo(-size/2, size/2);
                ctx.lineTo(0, size);
                ctx.lineTo(size/2, 0);
                ctx.closePath();
                break;
            case 'spiral':
                ctx.beginPath();
                for (let i = 0; i < 4; i++) {
                    const angle = i * Math.PI * 2;
                    const radius = size * (1 - i/4);
                    const x = Math.cos(angle) * radius;
                    const y = Math.sin(angle) * radius;
                    if (i === 0) ctx.moveTo(x, y);
                    else ctx.lineTo(x, y);
                }
                break;
        }
        
        ctx.fill();
        ctx.restore();
    }

    drawEntrance() {
        const { x, y, width, height, color, lightColor } = this.entrance;
        
        // Draw entrance portal
        this.ctx.save();
        
        // Draw outer glow
        const gradient = this.ctx.createLinearGradient(x, y, x + width, y);
        gradient.addColorStop(0, 'rgba(135, 206, 235, 0.3)');
        gradient.addColorStop(0.5, 'rgba(135, 206, 235, 0.1)');
        gradient.addColorStop(1, 'rgba(135, 206, 235, 0.3)');
        
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(x - 10, y - 10, width + 20, height + 20);
        
        // Draw main entrance
        this.ctx.fillStyle = color;
        this.ctx.fillRect(x, y, width, height);
        
        // Draw light effect
        this.ctx.fillStyle = lightColor;
        this.ctx.globalAlpha = 0.5;
        this.ctx.fillRect(x + width - 5, y, 5, height);
        
        this.ctx.restore();
    }

    drawExit() {
        const { x, y, width, height, color, lightColor } = this.exit;
        
        // Draw exit portal
        this.ctx.save();
        
        // Draw outer glow
        const gradient = this.ctx.createLinearGradient(x, y, x + width, y);
        gradient.addColorStop(0, 'rgba(135, 206, 235, 0.3)');
        gradient.addColorStop(0.5, 'rgba(135, 206, 235, 0.1)');
        gradient.addColorStop(1, 'rgba(135, 206, 235, 0.3)');
        
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(x - 10, y - 10, width + 20, height + 20);
        
        // Draw main exit
        this.ctx.fillStyle = color;
        this.ctx.fillRect(x, y, width, height);
        
        // Draw light effect
        this.ctx.fillStyle = lightColor;
        this.ctx.globalAlpha = 0.5;
        this.ctx.fillRect(x, y, 5, height);
        
        this.ctx.restore();
    }

    draw() {
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw entrance protection zone (subtle visual indicator)
        this.ctx.save();
        this.ctx.globalAlpha = 0.05;
        this.ctx.fillStyle = '#87CEEB';
        this.ctx.beginPath();
        this.ctx.arc(this.entrance.x, this.entrance.y + this.entrance.height/2, 
            this.entranceProtectionRadius, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.restore();

        // Draw entrance and exit
        this.drawEntrance();
        this.drawExit();

        // Draw particles
        this.drawParticles();

        // Draw player trail
        this.drawPlayerTrail();

        // Draw obstacles
        this.obstacles.forEach(obstacle => {
            this.ctx.fillStyle = obstacle.isBlind ? obstacle.lightColor : obstacle.color;
            this.drawShape(this.ctx, obstacle);
        });

        // Draw player
        if (this.player.infected) {
            this.player.infectionProgress = Math.min(1, this.player.infectionProgress + 0.02);
        }

        // Draw main circle
        this.ctx.fillStyle = this.player.color;
        this.ctx.beginPath();
        this.ctx.arc(this.player.x, this.player.y, this.player.radius, 0, Math.PI * 2);
        this.ctx.fill();

        // Draw infection effect
        if (this.player.infected) {
            const holeSize = this.player.radius * 0.5 * this.player.infectionProgress;
            const mixedColor = this.mixColors('#87CEEB', 'red', 0.5);
            
            // Draw the triangle hole
            this.ctx.fillStyle = mixedColor;
            this.ctx.beginPath();
            this.ctx.moveTo(this.player.x, this.player.y - holeSize);
            this.ctx.lineTo(this.player.x + holeSize, this.player.y + holeSize);
            this.ctx.lineTo(this.player.x - holeSize, this.player.y + holeSize);
            this.ctx.closePath();
            this.ctx.fill();

            // Draw the circle outline
            this.ctx.strokeStyle = this.player.color;
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.ctx.arc(this.player.x, this.player.y, this.player.radius, 0, Math.PI * 2);
            this.ctx.stroke();
        }
    }

    mixColors(color1, color2, ratio) {
        const hex = x => {
            x = x.toString(16);
            return (x.length === 1) ? '0' + x : x;
        };

        const r1 = parseInt(color1.substring(1, 3), 16);
        const g1 = parseInt(color1.substring(3, 5), 16);
        const b1 = parseInt(color1.substring(5, 7), 16);

        const r2 = parseInt(color2.substring(1, 3), 16);
        const g2 = parseInt(color2.substring(3, 5), 16);
        const b2 = parseInt(color2.substring(5, 7), 16);

        const r = Math.round(r1 * (1 - ratio) + r2 * ratio);
        const g = Math.round(g1 * (1 - ratio) + g2 * ratio);
        const b = Math.round(b1 * (1 - ratio) + b2 * ratio);

        return `#${hex(r)}${hex(g)}${hex(b)}`;
    }

    gameLoop(timestamp) {
        if (!this.lastTime) this.lastTime = timestamp;
        const deltaTime = timestamp - this.lastTime;
        this.lastTime = timestamp;

        this.accumulator += deltaTime;

        while (this.accumulator >= this.timeStep) {
            this.update();
            this.accumulator -= this.timeStep;
        }

        this.draw();
        requestAnimationFrame(this.gameLoop.bind(this));
    }

    update() {
        if (!this.gameOver && !this.success) {
            this.updatePlayer();
            this.updateObstacles();
            this.updateParticles();
        }
    }

    cleanup() {
        window.removeEventListener('keydown', this.keys);
        window.removeEventListener('keyup', this.keys);
        this.canvas.removeEventListener('touchstart', this.touchX);
        this.canvas.removeEventListener('touchmove', this.touchY);
    }

    handleObstacleCollision(obstacle1, obstacle2) {
        const dx = obstacle2.x - obstacle1.x;
        const dy = obstacle2.y - obstacle1.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const minDistance = obstacle1.size + obstacle2.size;

        if (distance < minDistance) {
            // Calculate collision normal
            const nx = dx / distance;
            const ny = dy / distance;

            // Calculate relative velocity
            const relativeVelocityX = obstacle2.speedX - obstacle1.speedX;
            const relativeVelocityY = obstacle2.speedY - obstacle1.speedY;
            const relativeVelocity = relativeVelocityX * nx + relativeVelocityY * ny;

            // Only resolve if objects are moving toward each other
            if (relativeVelocity < 0) {
                // Calculate impulse
                const impulse = -(1 + this.elasticity) * relativeVelocity;
                const impulseX = impulse * nx;
                const impulseY = impulse * ny;

                // Apply impulse
                obstacle1.speedX -= impulseX;
                obstacle1.speedY -= impulseY;
                obstacle2.speedX += impulseX;
                obstacle2.speedY += impulseY;

                // Separate objects to prevent sticking
                const overlap = minDistance - distance;
                const separationX = nx * overlap * 0.5;
                const separationY = ny * overlap * 0.5;

                obstacle1.x -= separationX;
                obstacle1.y -= separationY;
                obstacle2.x += separationX;
                obstacle2.y += separationY;
            }
        }
    }
} 