class Course {
    constructor(json, popSize) {
        this.timeLimit = 250; //A limit of 500 frames
        this.frameCount = 0;

        this.barriers = [];
        this.checkpoints = [];
        this.start = createVector(json.courseStart.x, json.courseStart.y);

        this.cars = [];
        for (let i = 0; i < popSize; i++) {
            this.cars.push(new Car(this.start.x, this.start.y));
        }

        for (let i = 0; i < json.barriers.length; i++) {
            const barrier = json.barriers[i];
            this.barriers.push(new Barrier(barrier.start.x, barrier.start.y, barrier.end.x, barrier.end.y));
        }
        for (let i = 0; i < json.checkpoints.length; i++) {
            const checkpoint = json.checkpoints[i];
            this.checkpoints.push(new Barrier(checkpoint.start.x, checkpoint.start.y, checkpoint.end.x, checkpoint.end.y));
        }
    }

    update() {
        this.frameCount++;
        let shouldEvolve = true;
        for (let i = 0; i < this.cars.length; i++) {
            if (!this.cars[i].crashed) {
                shouldEvolve = false;

                const inps = this.cars[i].getInputs(this.barriers);
                const outs = neat.pop[i].predict([...inps, 1]);

                this.cars[i].accelerate(mapToDir(outs[0], 0.5));
                this.cars[i].turn(mapToDir(outs[1], 0.5));

                this.cars[i].move();
                this.hitCheckpoint(this.cars[i]);
                if (this.frameCount >= this.timeLimit || this.isCrashing(this.cars[i])) {
                    this.cars[i].crash();
                    neat.pop[i].fitness = this.cars[i].getFitness(this.checkpoints);
                }
            }
        }
        if (shouldEvolve) {
            console.log("Next gen");
            this.frameCount = 0;
            neat.nextGen();
            this.timeLimit += 5;
            this.cars = [];
            for (let i = 0; i < popSize; i++) {
                this.cars.push(new Car(this.start.x, this.start.y, i, 3));
            }
        }
    }

    showCars() {
        for (let i = 0; i < this.cars.length; i++) {
            this.cars[i].show();
        }
    }

    showCourse() {
        for (let i = 0; i < this.barriers.length; i++) {
            this.barriers[i].show();
        }

        for (let i = 0; i < this.checkpoints.length; i++) {
            stroke(0, 255, 0);
            strokeWeight(3);
            line(this.checkpoints[i].start.x, this.checkpoints[i].start.y, this.checkpoints[i].end.x, this.checkpoints[i].end.y);
            noStroke();
            fill(255, 255, 255);
            textSize(15);
            text(i, this.checkpoints[i].start.x, this.checkpoints[i].start.y);
        }
    }

    isCrashing(car) {
        for (let i = 0; i < this.barriers.length; i++) {
            if (this.barriers[i].isColliding(car)) {
                return true;
            }
        }
        return false;
    }

    hitCheckpoint(car) {
        if (this.checkpoints[car.nextCheckpoint].isColliding(car)) {
            car.hitCheckpoint(this.checkpoints.length);
        }
    }
}

function mapToDir(n, boundary) {
    if (n > boundary) return 1;
    if (n < boundary) return -1;
    return 0;
}

class Line {
    constructor(start, end) {
        this.start = start;
        this.end = end;
        this.mid = createVector((this.start.x + this.end.x) * 0.5, (this.start.y + this.end.y) * 0.5);
        this.m = (this.end.y - this.start.y) / (this.end.x - this.start.x);
        this.b = this.start.y - (this.m * this.start.x);
    }

    withinBounds(x, y) {
        return (
            x >= Math.min(this.start.x, this.end.x) &&
            x <= Math.max(this.start.x, this.end.x) &&
            y >= Math.min(this.start.y, this.end.y) &&
            y <= Math.max(this.start.y, this.end.y));
    }

    getIntersect(other) {
        let xIntersect;
        let yIntersect;
        if (this.m === Infinity && other.m === Infinity) {
            xIntersect = Infinity;
            yIntersect = Infinity;
        } else if (this.m === Infinity) {
            xIntersect = this.start.x;
            yIntersect = (other.m * xIntersect) + other.b;
        } else if (other.m === Infinity) {
            xIntersect = other.start.x;
            yIntersect = (this.m * xIntersect) + this.b;
        } else {
            xIntersect = (other.b - this.b) / (this.m - other.m);
            yIntersect = this.m * xIntersect + this.start.y - this.m * this.start.x;
        }
        if (this.withinBounds(xIntersect, yIntersect) && other.withinBounds(xIntersect, yIntersect)) {
            return {
                intersect: true,
                x: xIntersect,
                y: yIntersect
            };
        } else {
            return {
                intersect: false
            };
        }

    }

    show() {
        stroke(0);
        strokeWeight(3);
        line(this.start.x, this.start.y, this.end.x, this.end.y);
    }
}

class Barrier extends Line {
    constructor(x1, y1, x2, y2) {
        super(createVector(x1, y1), createVector(x2, y2));
    }

    isColliding(car) {
        const carEdges = car.getEdges();
        for (let i = 0; i < carEdges.length; i++) {
            const intersection = this.getIntersect(carEdges[i]);
            if (intersection.intersect) { //If there is an intersection
                return true;
            }
        }
        return false;
    }
}