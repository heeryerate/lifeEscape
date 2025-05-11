class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.level = 1;
        this.levelElement = document.getElementById('level');
        
        // Player properties
        this.player = {
            x: 50,
            y: this.canvas.height / 2,
            radius: 20,
            color: '#87CEEB', // Light blue
            shape: 'circle',
            speed: 8,
            infected: false,
            infectionProgress: 0
        };

        // Shape types
        this.shapeTypes = ['triangle', 'square', 'rectangle', 'ellipse', 'star'];
        
        // Colors from red to green with their lighter variants
        this.obstacleColors = [
            { base: '#FF0000', light: '#FF6666' },    // Red
            { base: '#FF4500', light: '#FF8C66' },    // Orange red
            { base: '#FFA500', light: '#FFC266' },    // Orange
            { base: '#FFD700', light: '#FFE666' },    // Gold
            { base: '#FFFF00', light: '#FFFF66' },    // Yellow
            { base: '#9ACD32', light: '#B8E666' },    // Yellow green
            { base: '#32CD32', light: '#66E666' },    // Lime green
            { base: '#008000', light: '#66B866' }     // Green
        ];

        // Obstacle properties
        this.obstacles = [{
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

        // Game state
        this.gameOver = false;
        this.success = false;
        this.entrance = { x: 0, y: this.canvas.height / 2, width: 20, height: 100 };
        this.exit = { x: this.canvas.width - 20, y: this.canvas.height / 2, width: 20, height: 100 };

        // Event listeners
        this.setupEventListeners();
        
        // Start game loop
        this.gameLoop();
    }

    setupEventListeners() {
        window.addEventListener('keydown', (e) => {
            if (this.gameOver) return;
            
            switch(e.key) {
                case 'ArrowUp':
                    this.player.y -= this.player.speed;
                    break;
                case 'ArrowDown':
                    this.player.y += this.player.speed;
                    break;
                case 'ArrowLeft':
                    this.player.x -= this.player.speed;
                    break;
                case 'ArrowRight':
                    this.player.x += this.player.speed;
                    break;
            }
            
            // Keep player within canvas bounds
            this.player.x = Math.max(this.player.radius, Math.min(this.canvas.width - this.player.radius, this.player.x));
            this.player.y = Math.max(this.player.radius, Math.min(this.canvas.height - this.player.radius, this.player.y));
        });
    }

    getLighterColor(color) {
        // Convert hex to RGB
        const r = parseInt(color.slice(1, 3), 16);
        const g = parseInt(color.slice(3, 5), 16);
        const b = parseInt(color.slice(5, 7), 16);
        
        // Make color lighter by increasing RGB values
        const lighterR = Math.min(255, r + 100);
        const lighterG = Math.min(255, g + 100);
        const lighterB = Math.min(255, b + 100);
        
        // Convert back to hex
        const toHex = (n) => {
            const hex = n.toString(16);
            return hex.length === 1 ? '0' + hex : hex;
        };
        
        return `#${toHex(lighterR)}${toHex(lighterG)}${toHex(lighterB)}`;
    }

    calculateSizeBasedSpeed(size) {
        // Base speed is 2, decreases as size increases
        // Size range is 30-90, so we'll scale speed from 2 to 0.5
        const minSize = 30;
        const maxSize = 90;
        const minSpeed = 0.5;
        const maxSpeed = 2;
        
        // Calculate speed based on size (inverse relationship)
        const speed = maxSpeed - ((size - minSize) / (maxSize - minSize)) * (maxSpeed - minSpeed);
        return speed;
    }

    updateObstacles() {
        this.obstacles.forEach(obstacle => {
            // Update rotation
            obstacle.rotation += obstacle.rotationSpeed;
            
            // Update blind state
            const currentTime = Date.now();
            if (!obstacle.isBlind && currentTime - obstacle.lastBlindTime > 3000) {
                if (Math.random() < obstacle.blindChance) {
                    obstacle.isBlind = true;
                    obstacle.blindDuration = obstacle.blindDurationRange.min + 
                        Math.random() * (obstacle.blindDurationRange.max - obstacle.blindDurationRange.min);
                    obstacle.blindTimer = currentTime;
                }
            }

            if (obstacle.isBlind && currentTime - obstacle.blindTimer > obstacle.blindDuration) {
                obstacle.isBlind = false;
                obstacle.lastBlindTime = currentTime;
            }

            // Calculate size-based speed
            const sizeBasedSpeed = this.calculateSizeBasedSpeed(obstacle.size);
            obstacle.baseSpeed = sizeBasedSpeed;

            if (!obstacle.isBlind) {
                // Calculate direction to player with some randomness
                const dx = this.player.x - obstacle.x;
                const dy = this.player.y - obstacle.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                // Add randomness to the direction based on chase accuracy
                const randomAngle = (Math.random() - 0.5) * Math.PI * (1 - obstacle.chaseAccuracy);
                const targetX = this.player.x + Math.cos(randomAngle) * 50;
                const targetY = this.player.y + Math.sin(randomAngle) * 50;
                
                // Calculate direction to the random target
                const targetDx = targetX - obstacle.x;
                const targetDy = targetY - obstacle.y;
                const targetDistance = Math.sqrt(targetDx * targetDx + targetDy * targetDy);
                
                if (targetDistance > 0) {
                    const speedFactor = Math.min(1, distance / 200);
                    obstacle.speedX = (targetDx / targetDistance) * obstacle.baseSpeed * speedFactor;
                    obstacle.speedY = (targetDy / targetDistance) * obstacle.baseSpeed * speedFactor;
                }
            } else {
                // Random movement when blind
                obstacle.speedX += (Math.random() - 0.5) * 0.3;
                obstacle.speedY += (Math.random() - 0.5) * 0.3;
                
                const maxBlindSpeed = obstacle.baseSpeed * 0.3;
                obstacle.speedX = Math.max(-maxBlindSpeed, Math.min(maxBlindSpeed, obstacle.speedX));
                obstacle.speedY = Math.max(-maxBlindSpeed, Math.min(maxBlindSpeed, obstacle.speedY));
            }

            // Update position
            obstacle.x += obstacle.speedX;
            obstacle.y += obstacle.speedY;

            // Keep within bounds
            obstacle.x = Math.max(obstacle.size/2, Math.min(this.canvas.width - obstacle.size/2, obstacle.x));
            obstacle.y = Math.max(obstacle.size/2, Math.min(this.canvas.height - obstacle.size/2, obstacle.y));
        });
    }

    checkCollision() {
        // Check collision with obstacles
        this.obstacles.forEach(obstacle => {
            const dx = this.player.x - obstacle.x;
            const dy = this.player.y - obstacle.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < this.player.radius + obstacle.size / 2) {
                this.handleCollision();
            }
        });

        // Check if player reached exit
        if (this.player.x + this.player.radius >= this.exit.x &&
            this.player.y >= this.exit.y &&
            this.player.y <= this.exit.y + this.exit.height) {
            this.success = true;
            this.nextLevel();
        }
    }

    handleCollision() {
        if (!this.player.infected) {
            this.player.infected = true;
            this.player.infectionProgress = 0;
        }
    }

    getRandomColor() {
        const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEEAD'];
        return colors[Math.floor(Math.random() * colors.length)];
    }

    drawShape(ctx, obstacle) {
        const size = obstacle.size;
        const halfSize = size / 2;
        
        switch(obstacle.shape) {
            case 'triangle':
                ctx.beginPath();
                ctx.moveTo(0, -halfSize);
                ctx.lineTo(halfSize, halfSize);
                ctx.lineTo(-halfSize, halfSize);
                ctx.closePath();
                break;
                
            case 'square':
                ctx.beginPath();
                ctx.rect(-halfSize, -halfSize, size, size);
                break;
                
            case 'rectangle':
                ctx.beginPath();
                ctx.rect(-halfSize, -halfSize * 0.6, size, size * 0.6);
                break;
                
            case 'ellipse':
                ctx.beginPath();
                ctx.ellipse(0, 0, halfSize, halfSize * 0.6, 0, 0, Math.PI * 2);
                break;
                
            case 'star':
                ctx.beginPath();
                const spikes = 5;
                const outerRadius = halfSize;
                const innerRadius = halfSize * 0.4;
                
                for(let i = 0; i < spikes * 2; i++) {
                    const radius = i % 2 === 0 ? outerRadius : innerRadius;
                    const angle = (Math.PI * i) / spikes;
                    const x = Math.cos(angle) * radius;
                    const y = Math.sin(angle) * radius;
                    
                    if(i === 0) {
                        ctx.moveTo(x, y);
                    } else {
                        ctx.lineTo(x, y);
                    }
                }
                ctx.closePath();
                break;
        }
        
        ctx.fill();
    }

    nextLevel() {
        this.level++;
        this.levelElement.textContent = `Level: ${this.level}`;
        this.resetLevel();
        
        // Create new obstacle with random properties
        const colorIndex = Math.floor(Math.random() * this.obstacleColors.length);
        const newObstacle = {
            x: Math.random() * (this.canvas.width - 100) + 50,
            y: Math.random() * (this.canvas.height - 100) + 50,
            size: 30 + Math.random() * 60,
            color: this.obstacleColors[colorIndex].base,
            lightColor: this.obstacleColors[colorIndex].light,
            shape: this.shapeTypes[Math.floor(Math.random() * this.shapeTypes.length)],
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
        this.gameOver = false;
        this.success = false;
    }

    draw() {
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw entrance
        this.ctx.fillStyle = this.player.color; // Match circle color
        this.ctx.fillRect(this.entrance.x, this.entrance.y, this.entrance.width, this.entrance.height);

        // Draw exit
        this.ctx.fillStyle = this.player.color; // Match circle color
        this.ctx.fillRect(this.exit.x, this.exit.y, this.exit.width, this.exit.height);

        // Draw obstacles
        this.obstacles.forEach(obstacle => {
            this.ctx.save();
            this.ctx.translate(obstacle.x, obstacle.y);
            this.ctx.rotate(obstacle.rotation);
            
            // Draw shape with lighter color when blind
            this.ctx.fillStyle = obstacle.isBlind ? obstacle.lightColor : obstacle.color;
            this.drawShape(this.ctx, obstacle);
            
            this.ctx.restore();
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

        const r1 = parseInt(color1.slice(1, 3), 16);
        const g1 = parseInt(color1.slice(3, 5), 16);
        const b1 = parseInt(color1.slice(5, 7), 16);

        const r2 = parseInt(color2.slice(1, 3), 16);
        const g2 = parseInt(color2.slice(3, 5), 16);
        const b2 = parseInt(color2.slice(5, 7), 16);

        const r = Math.round(r1 * (1 - ratio) + r2 * ratio);
        const g = Math.round(g1 * (1 - ratio) + g2 * ratio);
        const b = Math.round(b1 * (1 - ratio) + b2 * ratio);

        return `#${hex(r)}${hex(g)}${hex(b)}`;
    }

    gameLoop() {
        this.updateObstacles();
        this.checkCollision();
        this.draw();
        requestAnimationFrame(() => this.gameLoop());
    }
}

// Start the game when the page loads
window.onload = () => {
    new Game();
}; 