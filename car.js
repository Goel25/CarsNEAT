class Car {
    constructor(x, y) {
        this.pos = createVector(x, y);
        this.facing = -Math.PI / 2;
        this.speed = 0;
        this.acc = 0;
        this.angAcc = 0;
        this.angSpeed = 0;

        this.dim = createVector(35, 20);
        this.halfDim = p5.Vector.mult(this.dim, 0.5);

        this.hasCalcedEdges = false; //Whether or not the edges must be calculated (saves time)
        this.edges = [];

        this.prevCpPos = this.pos.copy();
        this.nextCheckpoint = 0;
        this.currDist = 0;
        this.score = 0;

        this.crashed = false;

        this.maxSpeed = 5;
        this.maxAngSpeed = 0.4;
        this.accSpeed = 0.4;
        this.angAccSpeed = 0.2;
    }

    getEdges() {
        if (this.hasCalcedEdges) return this.edges;
        let verts = [
            createVector(this.halfDim.x, this.halfDim.y).rotate(this.facing).add(this.pos),
            createVector(this.halfDim.x, -this.halfDim.y).rotate(this.facing).add(this.pos),
            createVector(-this.halfDim.x, -this.halfDim.y).rotate(this.facing).add(this.pos),
            createVector(-this.halfDim.x, this.halfDim.y).rotate(this.facing).add(this.pos),
        ];
        this.edges = [
            new Line(verts[0], verts[1]),
            new Line(verts[1], verts[2]), //All of the edges of the car
            new Line(verts[2], verts[3]),
            new Line(verts[3], verts[0]),
        ];

        this.hasCalcedEdges = true;
        return this.edges;
    }

    crash() {
        this.crashed = true;
    }

    turn(dir) {
        // this.facing = (this.facing + dir) % (Math.PI * 2);
        this.angAcc = this.angAccSpeed * dir;
    }

    accelerate(dir) { //Move forward or backwards
        this.acc = this.accSpeed * dir;
    }

    getInputs(barriers) {
        let inputs = [];
        for (let ang = -PI / 4; ang <= PI / 4; ang += Math.PI * 0.5 / 4) {
            const rayX = 1000 * Math.cos(ang + this.facing);
            const rayY = 1000 * Math.sin(ang + this.facing);
            let ray = new Line(this.pos, createVector(rayX + this.pos.x, rayY + this.pos.y));
            // ray.show();
            let closestDistSq = Infinity;
            for (let i = 0; i < barriers.length; i++) {
                const intersect = barriers[i].getIntersect(ray);
                if (intersect.intersect) {
                    closestDistSq = Math.min(closestDistSq, Math.pow(intersect.x - this.pos.x, 2) + Math.pow(intersect.y - this.pos.y, 2));
                }
            }
            // stroke(0, 255, 0);
            // strokeWeight(2);
            // line(this.pos.x, this.pos.y, this.pos.x + Math.sqrt(closestDistSq) * Math.cos(ang + this.facing), this.pos.y + Math.sqrt(closestDistSq) * Math.sin(ang + this.facing));
            inputs.push(Math.sqrt(closestDistSq) / 700); //Normalize by 700, about the farthest dist in the course
        }
        return inputs;
    }

    hitCheckpoint(max) {
        this.prevCpPos = this.pos.copy();
        this.nextCheckpoint = (this.nextCheckpoint + 1) % max;
        this.score++;
    }

    getFitness(checkpoints) {
        let nextCP = checkpoints[this.nextCheckpoint].mid;
        const maxDist = dist(this.prevCpPos.x, this.prevCpPos.y, nextCP.x, nextCP.y);
        const currDist = dist(this.pos.x, this.pos.y, nextCP.x, nextCP.y);
        const percent = 1 - (currDist / maxDist);

        return Math.max(0.01, this.score + percent);
        //Calculate percentage ot next CP and add it to fitness
    }

    move() {
        this.speed += this.acc;
        if (this.speed > this.maxSpeed) this.speed = this.maxSpeed;
        else if (this.speed < -this.maxSpeed) this.speed = -this.maxSpeed;

        this.angSpeed += this.angAcc;
        if (this.angSpeed > this.maxAngSpeed) this.angSpeed = this.maxAngSpeed;
        else if (this.angSpeed < -this.maxAngSpeed) this.angSpeed = -this.maxAngSpeed;

        this.facing = (this.facing + this.angSpeed) % (Math.PI * 2);
        this.pos.add(this.speed * Math.cos(this.facing), this.speed * Math.sin(this.facing));
        this.hasCalcedEdges = false;

        this.acc = 0;
        this.angAcc = 0;
        this.angSpeed *= 0.95;
        this.speed *= 0.95;
    }

    show() {
        push();
        translate(this.pos.x, this.pos.y);
        rotate(this.facing);
        fill(50);
        noStroke();
        rect(-this.halfDim.x, -this.halfDim.y, this.dim.x, this.dim.y);
        pop();
    }
}