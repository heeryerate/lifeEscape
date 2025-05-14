export class GameEngine {
    constructor(canvas, callbacks) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.callbacks = callbacks;
        
        // Game state
        this.level = 1;
        this.gameOver = false;
        this.success = false;

        // Initialize displays first
        this.powerTimer = {
            x: 20,
            y: 40,
            width: 200,
            height: 30
        };

        this.powerLegend = {
            x: 20,
            y: this.canvas.height - 90,
            width: 150,
            height: 70,
            visible: true
        };

        this.gameOverDisplay = {
            visible: false,
            x: this.canvas.width / 2,
            y: this.canvas.height / 2,
            width: 300,
            height: 200,
            alpha: 0,
            targetAlpha: 0,
            fadeSpeed: 0.05,
            displayTime: 2000,
            startTime: 0,
            scale: 1.2
        };

        // Initialize player power state
        this.playerPower = {
            active: false,
            type: null,
            endTime: 0,
            timer: null,
            hasPower: false,
            affectedShapes: new Set() // Track shapes that have been affected by the power
        };
        
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
            trail: []
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

        // Superpower properties
        this.superPowers = {
            'star': {
                name: 'Shape Shifter',
                duration: 5000,
                color: '#FFD700', // Gold
                effect: (shape) => {
                    const now = Date.now();
                    if (!this.shapeShifterCooldown.active || 
                        now - this.shapeShifterCooldown.lastChange >= this.shapeShifterCooldown.cooldownTime) {
                        const newShape = this.shapeTypes[Math.floor(Math.random() * this.shapeTypes.length)];
                        shape.shape = newShape;
                        this.shapeShifterCooldown.lastChange = now;
                        this.shapeShifterCooldown.active = true;
                    }
                }
            },
            'star_eliminator': {
                name: 'Shape Eliminator',
                duration: 2000,
                color: '#FF69B4', // Pink
                effect: (shape) => {
                    // Remove the shape from the obstacles array
                    const index = this.obstacles.indexOf(shape);
                    if (index > -1) {
                        this.obstacles.splice(index, 1);
                    }
                }
            },
            'star_reducer': {
                name: 'Size Reducer',
                duration: 3000,
                color: '#00FFFF', // Cyan
                effect: (shape) => {
                    shape.size *= 0.9;
                    shape.size = Math.max(shape.size, this.minShapeSize);
                }
            }
        };

        // Add physics properties
        this.elasticity = 0.8; // Bounce factor
        this.friction = 0.99; // Friction factor

        // Add entrance protection properties
        this.entranceProtectionRadius = 150; // Protection zone radius
        this.entranceProtectionForce = 0.8; // Force to push obstacles away

        // Add shrink factor and minimum size for shapes
        this.shrinkFactor = 0.95; // Shapes will shrink to 95% of their size on collision
        this.minShapeSize = this.player.radius * 0.5; // Minimum size is half of player's radius

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

        // Initialize obstacles
        this.obstacles = this.createInitialObstacles();

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

        // Add cooldown for shape shifter
        this.shapeShifterCooldown = {
            active: false,
            lastChange: 0,
            cooldownTime: 1000 // 1 second cooldown
        };
    }

    createInitialObstacles() {
        const obstacles = [];
        
        // Start with one regular shape
        const regularShape = this.shapeTypes[Math.floor(Math.random() * this.shapeTypes.length)];
        const colorIndex = Math.floor(Math.random() * this.obstacleColors.length);
        
        const shape = {
            x: Math.random() * (this.canvas.width - 100) + 50,
            y: Math.random() * (this.canvas.height - 100) + 50,
            size: 40,
            color: this.obstacleColors[colorIndex].base,
            lightColor: this.obstacleColors[colorIndex].light,
            shape: regularShape,
            speedX: 0,
            speedY: 0,
            baseSpeed: 2,
            isBlind: false,
            blindTimer: 0,
            blindDuration: 0,
            lastBlindTime: 0,
            rotation: Math.random() * Math.PI * 2,
            rotationSpeed: (Math.random() - 0.5) * 0.02,
            blindChance: 0.3,
            blindDurationRange: { min: 1000, max: 3000 },
            chaseAccuracy: 0.5 + Math.random() * 0.5
        };
        obstacles.push(shape);
        
        // 30% chance to add a superpower shape
        if (Math.random() < 0.3) {
            const superPowerTypes = ['star', 'star_eliminator', 'star_reducer'];
            const powerType = superPowerTypes[Math.floor(Math.random() * superPowerTypes.length)];
            const colorIndex = Math.floor(Math.random() * this.obstacleColors.length);
            
            const superShape = {
                x: Math.random() * (this.canvas.width - 100) + 50,
                y: Math.random() * (this.canvas.height - 100) + 50,
                size: 40,
                color: this.obstacleColors[colorIndex].base,
                lightColor: this.obstacleColors[colorIndex].light,
                shape: powerType,
                speedX: 0,
                speedY: 0,
                baseSpeed: 2,
                isBlind: false,
                blindTimer: 0,
                blindDuration: 0,
                lastBlindTime: 0,
                rotation: Math.random() * Math.PI * 2,
                rotationSpeed: (Math.random() - 0.5) * 0.02,
                blindChance: 0.3,
                blindDurationRange: { min: 1000, max: 3000 },
                chaseAccuracy: 0.5 + Math.random() * 0.5
            };
            obstacles.push(superShape);
        }
        
        return obstacles;
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

            // Apply power effect if player has active power
            if (this.playerPower.active && 
                this.checkCollision(this.player, obstacle)) {
                this.superPowers[this.playerPower.type].effect(obstacle);
                this.createParticles(obstacle.x, obstacle.y, this.superPowers[this.playerPower.type].color);
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
        // Check if player is in entrance protection zone
        const dxToEntrance = this.player.x - this.entrance.x;
        const dyToEntrance = this.player.y - (this.entrance.y + this.entrance.height/2);
        const distanceToEntrance = Math.sqrt(dxToEntrance * dxToEntrance + dyToEntrance * dyToEntrance);

        if (distanceToEntrance > this.entranceProtectionRadius) {
            // Check if obstacle has a superpower and player doesn't have power
            if (this.superPowers[obstacle.shape] && !this.playerPower.hasPower) {
                // Steal the power
                this.activatePlayerPower(obstacle.shape);
                this.createParticles(this.player.x, this.player.y, this.superPowers[obstacle.shape].color);
                // Remove power from the shape permanently
                obstacle.shape = this.shapeTypes[Math.floor(Math.random() * this.shapeTypes.length)];
            } else if (!this.playerPower.active) {
                // Normal collision - show game over display and reset player immediately
                this.player.infected = true;
                this.createParticles(this.player.x, this.player.y, obstacle.color);
                this.gameOver = true;
                
                // Show game over display
                this.gameOverDisplay.visible = true;
                this.gameOverDisplay.targetAlpha = 1;
                this.gameOverDisplay.alpha = 0;
                this.gameOverDisplay.startTime = Date.now();
                
                // Reset player immediately
                this.resetPlayer();
            }
        }
    }

    resetPlayer() {
        // Reset player position and state
        this.player.x = 50;
        this.player.y = this.canvas.height / 2;
        this.player.infected = false;
        this.player.infectionProgress = 0;
        this.player.trail = [];
        
        // Reset game state
        this.gameOver = false;
        this.success = false;
        this.particles = [];
        this.stuckTimer = 0;

        // Reset power state
        this.deactivatePlayerPower();
        
        // Don't reset game over display here - let it fade out naturally
    }

    checkCollision(player, obstacle) {
        const dx = player.x - obstacle.x;
        const dy = player.y - obstacle.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // Get the actual collision radius based on the shape type
        let collisionRadius;
        switch (obstacle.shape) {
            case 'triangle':
                // Use inscribed circle radius for triangle
                collisionRadius = obstacle.size * 0.5;
                break;
            case 'square':
                // Use half of diagonal for square
                collisionRadius = obstacle.size * 0.707;
                break;
            case 'rectangle':
                // Use average of width and height
                collisionRadius = obstacle.size * 1.25;
                break;
            case 'ellipse':
                // Use average of major and minor axes
                collisionRadius = obstacle.size * 1.25;
                break;
            case 'star':
                // Use inscribed circle radius
                collisionRadius = obstacle.size * 0.5;
                break;
            case 'pentagon':
                // Use inscribed circle radius
                collisionRadius = obstacle.size * 0.688;
                break;
            case 'hexagon':
                // Use inscribed circle radius
                collisionRadius = obstacle.size * 0.866;
                break;
            case 'octagon':
                // Use inscribed circle radius
                collisionRadius = obstacle.size * 0.924;
                break;
            case 'diamond':
                // Use inscribed circle radius
                collisionRadius = obstacle.size * 0.707;
                break;
            case 'cross':
                // Use average of arms
                collisionRadius = obstacle.size * 0.65;
                break;
            case 'heart':
                // Use average of width and height
                collisionRadius = obstacle.size * 0.75;
                break;
            case 'moon':
                // Use average of outer and inner radius
                collisionRadius = obstacle.size * 0.85;
                break;
            case 'cloud':
                // Use average of cloud parts
                collisionRadius = obstacle.size * 0.6;
                break;
            case 'lightning':
                // Use average of width and height
                collisionRadius = obstacle.size * 0.5;
                break;
            case 'spiral':
                // Use average of spiral radius
                collisionRadius = obstacle.size * 0.6;
                break;
            default:
                collisionRadius = obstacle.size * 0.8;
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
        
        // Keep existing shapes but remove any superpower shapes
        this.obstacles = this.obstacles.filter(obstacle => 
            !this.superPowers[obstacle.shape]
        );
        
        // Add one new regular shape
        const regularShape = this.shapeTypes[Math.floor(Math.random() * this.shapeTypes.length)];
        const colorIndex = Math.floor(Math.random() * this.obstacleColors.length);
        
        const newObstacle = {
            x: Math.random() * (this.canvas.width - 100) + 50,
            y: Math.random() * (this.canvas.height - 100) + 50,
            size: Math.max(30 + Math.random() * 60, this.minShapeSize),
            color: this.obstacleColors[colorIndex].base,
            lightColor: this.obstacleColors[colorIndex].light,
            shape: regularShape,
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
        
        // 30% chance to add a superpower shape
        if (Math.random() < 0.3) {
            const superPowerTypes = ['star', 'star_eliminator', 'star_reducer'];
            const powerType = superPowerTypes[Math.floor(Math.random() * superPowerTypes.length)];
            const colorIndex = Math.floor(Math.random() * this.obstacleColors.length);
            
            const superShape = {
                x: Math.random() * (this.canvas.width - 100) + 50,
                y: Math.random() * (this.canvas.height - 100) + 50,
                size: Math.max(30 + Math.random() * 60, this.minShapeSize),
                color: this.obstacleColors[colorIndex].base,
                lightColor: this.obstacleColors[colorIndex].light,
                shape: powerType,
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
            this.obstacles.push(superShape);
        }
        
        // Reset player position
        this.resetPlayer();
    }

    resetLevel() {
        // Reset player position and state
        this.player.x = 50;
        this.player.y = this.canvas.height / 2;
        this.player.infected = false;
        this.player.infectionProgress = 0;
        this.player.trail = [];
        
        // Reset game state
        this.gameOver = false;
        this.success = false;
        this.particles = [];
        this.stuckTimer = 0;

        // Reset power state
        this.deactivatePlayerPower();
        
        // Reset game over display
        this.gameOverDisplay.visible = false;
        this.gameOverDisplay.targetAlpha = 0;
        this.gameOverDisplay.alpha = 0;

        // Create new random initial obstacles
        this.obstacles = this.createInitialObstacles();
    }

    drawShape(ctx, shape) {
        ctx.save();
        ctx.translate(shape.x, shape.y);
        ctx.rotate(shape.rotation);

        // Draw power indicator for superpower shapes
        if (shape.shape && this.superPowers && this.superPowers[shape.shape] && !this.playerPower.hasPower) {
            const power = this.superPowers[shape.shape];
            
            // Draw outer glow with pulsing effect
            const pulseScale = 1.3 + Math.sin(Date.now() / 200) * 0.1; // Pulsing effect
            ctx.beginPath();
            ctx.strokeStyle = power.color;
            ctx.lineWidth = 4;
            ctx.arc(0, 0, shape.size * pulseScale, 0, Math.PI * 2);
            ctx.stroke();

            // Draw power symbol based on type
            ctx.beginPath();
            ctx.fillStyle = power.color;
            switch (shape.shape) {
                case 'star':
                    // Draw shape change symbol (circular arrows)
                    ctx.beginPath();
                    ctx.arc(0, 0, shape.size * 0.3, 0, Math.PI * 2);
                    ctx.stroke();
                    ctx.beginPath();
                    ctx.arc(0, 0, shape.size * 0.2, 0, Math.PI * 2);
                    ctx.stroke();
                    ctx.beginPath();
                    ctx.moveTo(shape.size * 0.3, 0);
                    ctx.lineTo(shape.size * 0.4, -shape.size * 0.1);
                    ctx.lineTo(shape.size * 0.4, shape.size * 0.1);
                    ctx.fill();
                    break;
                case 'star_eliminator':
                    // Draw elimination symbol (X)
                    ctx.beginPath();
                    ctx.moveTo(-shape.size * 0.2, -shape.size * 0.2);
                    ctx.lineTo(shape.size * 0.2, shape.size * 0.2);
                    ctx.moveTo(shape.size * 0.2, -shape.size * 0.2);
                    ctx.lineTo(-shape.size * 0.2, shape.size * 0.2);
                    ctx.lineWidth = 3;
                    ctx.stroke();
                    break;
                case 'star_reducer':
                    // Draw size decrease symbol (-)
                    ctx.beginPath();
                    ctx.moveTo(-shape.size * 0.2, 0);
                    ctx.lineTo(shape.size * 0.2, 0);
                    ctx.lineWidth = 3;
                    ctx.stroke();
                    break;
            }
        }

        // Draw the shape
        ctx.beginPath();
        ctx.fillStyle = shape.color;
        
        switch(shape.shape) {
            case 'triangle':
                ctx.moveTo(0, -shape.size);
                ctx.lineTo(shape.size, shape.size);
                ctx.lineTo(-shape.size, shape.size);
                break;
            case 'square':
                ctx.rect(-shape.size, -shape.size, shape.size * 2, shape.size * 2);
                break;
            case 'rectangle':
                ctx.rect(-shape.size, -shape.size * 0.6, shape.size * 2, shape.size * 1.2);
                break;
            case 'ellipse':
                ctx.ellipse(0, 0, shape.size, shape.size * 0.6, 0, 0, Math.PI * 2);
                break;
            case 'star':
            case 'star_eliminator':
            case 'star_reducer':
                for (let i = 0; i < 5; i++) {
                    const angle = (i * 4 * Math.PI) / 5 - Math.PI / 2;
                    const x = Math.cos(angle) * shape.size;
                    const y = Math.sin(angle) * shape.size;
                    if (i === 0) ctx.moveTo(x, y);
                    else ctx.lineTo(x, y);
                }
                break;
            case 'pentagon':
                for (let i = 0; i < 5; i++) {
                    const angle = (i * 2 * Math.PI) / 5 - Math.PI / 2;
                    const x = Math.cos(angle) * shape.size;
                    const y = Math.sin(angle) * shape.size;
                    if (i === 0) ctx.moveTo(x, y);
                    else ctx.lineTo(x, y);
                }
                break;
            case 'hexagon':
                for (let i = 0; i < 6; i++) {
                    const angle = (i * 2 * Math.PI) / 6;
                    const x = Math.cos(angle) * shape.size;
                    const y = Math.sin(angle) * shape.size;
                    if (i === 0) ctx.moveTo(x, y);
                    else ctx.lineTo(x, y);
                }
                break;
            case 'octagon':
                for (let i = 0; i < 8; i++) {
                    const angle = (i * 2 * Math.PI) / 8;
                    const x = Math.cos(angle) * shape.size;
                    const y = Math.sin(angle) * shape.size;
                    if (i === 0) ctx.moveTo(x, y);
                    else ctx.lineTo(x, y);
                }
                break;
            case 'diamond':
                ctx.moveTo(0, -shape.size);
                ctx.lineTo(shape.size, 0);
                ctx.lineTo(0, shape.size);
                ctx.lineTo(-shape.size, 0);
                break;
            case 'cross':
                const arm = shape.size * 0.3;
                ctx.moveTo(-arm, -arm);
                ctx.lineTo(arm, -arm);
                ctx.lineTo(arm, arm);
                ctx.lineTo(-arm, arm);
                ctx.lineTo(-arm, -arm);
                break;
            case 'heart':
                const heartSize = shape.size * 0.8;
                ctx.moveTo(0, heartSize * 0.3);
                ctx.bezierCurveTo(
                    heartSize * 0.5, heartSize * 0.3,
                    heartSize * 0.5, -heartSize * 0.3,
                    0, -heartSize * 0.3
                );
                ctx.bezierCurveTo(
                    -heartSize * 0.5, -heartSize * 0.3,
                    -heartSize * 0.5, heartSize * 0.3,
                    0, heartSize * 0.3
                );
                break;
            case 'moon':
                const moonSize = shape.size * 0.8;
                ctx.arc(0, 0, moonSize, 0, Math.PI * 2);
                ctx.arc(moonSize * 0.3, 0, moonSize * 0.5, 0, Math.PI * 2, true);
                break;
            case 'cloud':
                const cloudSize = shape.size * 0.8;
                ctx.arc(-cloudSize * 0.3, 0, cloudSize * 0.3, 0, Math.PI * 2);
                ctx.arc(cloudSize * 0.3, 0, cloudSize * 0.3, 0, Math.PI * 2);
                ctx.arc(0, -cloudSize * 0.2, cloudSize * 0.3, 0, Math.PI * 2);
                break;
            case 'lightning':
                const lightningSize = shape.size * 0.8;
                ctx.moveTo(0, -lightningSize);
                ctx.lineTo(lightningSize * 0.3, 0);
                ctx.lineTo(-lightningSize * 0.3, lightningSize * 0.3);
                ctx.lineTo(0, lightningSize);
                ctx.lineTo(lightningSize * 0.3, 0);
                break;
            case 'spiral':
                const spiralSize = shape.size * 0.8;
                for (let i = 0; i < 4; i++) {
                    const angle = i * Math.PI / 2;
                    const radius = spiralSize * (1 - i * 0.2);
                    const x = Math.cos(angle) * radius;
                    const y = Math.sin(angle) * radius;
                    if (i === 0) ctx.moveTo(x, y);
                    else ctx.lineTo(x, y);
                }
                break;
        }
        
        ctx.closePath();
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

    drawPowerTimer() {
        if (this.playerPower.active) {
            const remainingTime = Math.max(0, this.playerPower.endTime - Date.now());
            const progress = remainingTime / this.superPowers[this.playerPower.type].duration;
            
            // Draw power timer background
            this.ctx.save();
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            this.ctx.fillRect(
                this.powerTimer.x,
                this.powerTimer.y,
                this.powerTimer.width,
                this.powerTimer.height
            );

            // Draw power timer progress
            this.ctx.fillStyle = this.superPowers[this.playerPower.type].color;
            this.ctx.fillRect(
                this.powerTimer.x,
                this.powerTimer.y,
                this.powerTimer.width * progress,
                this.powerTimer.height
            );

            // Draw remaining time in seconds
            this.ctx.fillStyle = '#FFFFFF';
            this.ctx.font = '16px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(
                `${Math.ceil(remainingTime / 1000)}s`,
                this.powerTimer.x + this.powerTimer.width / 2,
                this.powerTimer.y + this.powerTimer.height / 2
            );

            this.ctx.restore();
        }
    }

    drawPowerLegend() {
        if (!this.powerLegend.visible) return;

        this.ctx.save();
        
        // Draw legend background with rounded corners
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        this.roundRect(
            this.powerLegend.x,
            this.powerLegend.y,
            this.powerLegend.width,
            this.powerLegend.height,
            10
        );
        this.ctx.fill();

        // Draw each power type
        let yOffset = 15;
        Object.entries(this.superPowers).forEach(([shape, power]) => {
            // Draw color indicator
            this.ctx.beginPath();
            this.ctx.fillStyle = power.color;
            this.ctx.arc(this.powerLegend.x + 15, this.powerLegend.y + yOffset, 6, 0, Math.PI * 2);
            this.ctx.fill();

            // Draw power name
            this.ctx.fillStyle = '#FFFFFF';
            this.ctx.font = '14px Arial';
            this.ctx.fillText(
                power.name,
                this.powerLegend.x + 30,
                this.powerLegend.y + yOffset + 4
            );

            yOffset += 20;
        });

        this.ctx.restore();
    }

    roundRect(x, y, width, height, radius) {
        this.ctx.beginPath();
        this.ctx.moveTo(x + radius, y);
        this.ctx.lineTo(x + width - radius, y);
        this.ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
        this.ctx.lineTo(x + width, y + height - radius);
        this.ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        this.ctx.lineTo(x + radius, y + height);
        this.ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
        this.ctx.lineTo(x, y + radius);
        this.ctx.quadraticCurveTo(x, y, x + radius, y);
        this.ctx.closePath();
    }

    drawGameOverDisplay() {
        if (!this.gameOverDisplay.visible) return;

        // Check if display time has elapsed
        if (Date.now() - this.gameOverDisplay.startTime >= this.gameOverDisplay.displayTime) {
            this.gameOverDisplay.targetAlpha = 0;
            if (this.gameOverDisplay.alpha <= 0) {
                this.gameOverDisplay.visible = false;
                return;
            }
        }

        // Fade in/out effect
        if (this.gameOverDisplay.alpha < this.gameOverDisplay.targetAlpha) {
            this.gameOverDisplay.alpha = Math.min(
                this.gameOverDisplay.alpha + this.gameOverDisplay.fadeSpeed,
                this.gameOverDisplay.targetAlpha
            );
        } else if (this.gameOverDisplay.alpha > this.gameOverDisplay.targetAlpha) {
            this.gameOverDisplay.alpha = Math.max(
                this.gameOverDisplay.alpha - this.gameOverDisplay.fadeSpeed,
                this.gameOverDisplay.targetAlpha
            );
        }

        this.ctx.save();
        
        // Draw blur effect
        this.ctx.filter = `blur(8px)`;
        this.ctx.fillStyle = `rgba(0, 0, 0, ${this.gameOverDisplay.alpha * 0.3})`;
        this.roundRect(
            this.gameOverDisplay.x - this.gameOverDisplay.width / 2,
            this.gameOverDisplay.y - this.gameOverDisplay.height / 2,
            this.gameOverDisplay.width,
            this.gameOverDisplay.height,
            20
        );
        this.ctx.fill();
        this.ctx.filter = 'none';

        // Draw main background with gradient
        const gradient = this.ctx.createLinearGradient(
            this.gameOverDisplay.x - this.gameOverDisplay.width / 2,
            this.gameOverDisplay.y - this.gameOverDisplay.height / 2,
            this.gameOverDisplay.x + this.gameOverDisplay.width / 2,
            this.gameOverDisplay.y + this.gameOverDisplay.height / 2
        );
        gradient.addColorStop(0, `rgba(0, 0, 0, ${this.gameOverDisplay.alpha * 0.5})`);
        gradient.addColorStop(1, `rgba(0, 0, 0, ${this.gameOverDisplay.alpha * 0.3})`);
        
        this.ctx.fillStyle = gradient;
        this.roundRect(
            this.gameOverDisplay.x - this.gameOverDisplay.width / 2,
            this.gameOverDisplay.y - this.gameOverDisplay.height / 2,
            this.gameOverDisplay.width,
            this.gameOverDisplay.height,
            20
        );
        this.ctx.fill();

        // Draw border glow
        this.ctx.strokeStyle = `rgba(255, 255, 255, ${this.gameOverDisplay.alpha * 0.3})`;
        this.ctx.lineWidth = 2;
        this.roundRect(
            this.gameOverDisplay.x - this.gameOverDisplay.width / 2,
            this.gameOverDisplay.y - this.gameOverDisplay.height / 2,
            this.gameOverDisplay.width,
            this.gameOverDisplay.height,
            20
        );
        this.ctx.stroke();

        // Draw message with higher contrast and scale
        this.ctx.fillStyle = `rgba(255, 255, 255, ${this.gameOverDisplay.alpha})`;
        this.ctx.font = 'bold 48px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        
        // Add text shadow for better visibility
        this.ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
        this.ctx.shadowBlur = 10;
        this.ctx.shadowOffsetX = 2;
        this.ctx.shadowOffsetY = 2;

        // Draw "Oops!" text with gradient
        const textGradient = this.ctx.createLinearGradient(
            this.gameOverDisplay.x - 100,
            this.gameOverDisplay.y - 40,
            this.gameOverDisplay.x + 100,
            this.gameOverDisplay.y - 40
        );
        textGradient.addColorStop(0, `rgba(255, 255, 255, ${this.gameOverDisplay.alpha})`);
        textGradient.addColorStop(0.5, `rgba(255, 255, 255, ${this.gameOverDisplay.alpha * 0.8})`);
        textGradient.addColorStop(1, `rgba(255, 255, 255, ${this.gameOverDisplay.alpha})`);
        
        this.ctx.fillStyle = textGradient;
        this.ctx.fillText(
            'Oops!',
            this.gameOverDisplay.x,
            this.gameOverDisplay.y - 40
        );

        // Draw "You hit a shape!" with smaller font and glow
        this.ctx.font = '32px Arial';
        this.ctx.fillStyle = `rgba(255, 255, 255, ${this.gameOverDisplay.alpha * 0.8})`;
        this.ctx.fillText(
            'You hit a shape!',
            this.gameOverDisplay.x,
            this.gameOverDisplay.y + 20
        );

        // Reset shadow
        this.ctx.shadowColor = 'transparent';
        this.ctx.shadowBlur = 0;
        this.ctx.shadowOffsetX = 0;
        this.ctx.shadowOffsetY = 0;

        this.ctx.restore();
    }

    draw() {
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw entrance protection zone
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

        // Draw power legend
        this.drawPowerLegend();

        // Draw power timer
        this.drawPowerTimer();

        // Draw game over display
        this.drawGameOverDisplay();
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
        if (!this.success) {
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
        if (this.playerPower.timer) {
            clearInterval(this.playerPower.timer);
        }
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

    activatePlayerPower(powerType) {
        this.playerPower.active = true;
        this.playerPower.type = powerType;
        this.playerPower.hasPower = true;
        this.playerPower.endTime = Date.now() + this.superPowers[powerType].duration;
        
        // Start power timer
        if (this.playerPower.timer) {
            clearInterval(this.playerPower.timer);
        }
        this.playerPower.timer = setInterval(() => {
            if (Date.now() >= this.playerPower.endTime) {
                this.deactivatePlayerPower();
            }
        }, 100);
    }

    deactivatePlayerPower() {
        this.playerPower.active = false;
        this.playerPower.type = null;
        this.playerPower.hasPower = false;
        if (this.playerPower.timer) {
            clearInterval(this.playerPower.timer);
            this.playerPower.timer = null;
        }
    }
} 