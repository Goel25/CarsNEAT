//Steering with NEAT by Leo Gagnon. Started March 2, 2020
/*const popSize = 500;
const options = {
    populationSize: popSize,
    inpSize: 3, //The amount of inputs to the networks
    outSize: 1, //The amount of outputs to the networks
    disjointConst: 2, //How important disjoint nodes are for the compatability fn
    excessConst: 2, //How important excess nodes are for the compatability fn
    weightConst: 1, //How important weight differences are for the compatability fn
    amtOfSpecies: 3, //The desired amount of species
    survivalThreshold: 0.2, //The top % of each speci that are allowed to reproduce
    compatThreshMod: 0.3, //How much the compatibility threshold changes to get the desired amt of species
    defaultCompatThresh: 1, //The initial amt of similarity individuals must have to be in the same species
    shiftWeightProb: 0.2,
    changeWeightProb: 0.1,
    enabledDisableProb: 0.05,
    splitConnectionProb: 0.03,
    newConnectionProb: 0.08,
}

const neat = new NEAT(options);
let population = [];*/

/*
Course
    Boundaries
    Checkpoints
Neat
    Brain[]

Population[] matches its index with brain[] to move, and sets fitness
*/

let courseJSON;
let course;
let neat;
let speed = 1;
let show = true;

const popSize = 500;
const inpSize = 5;
const options = {
    populationSize: popSize,
    inpSize: inpSize, //The amount of inputs to the networks
    outSize: 2, //The amount of outputs to the networks

    disjointConst: 2, //How important disjoint nodes are for the compatability fn
    excessConst: 2, //How important excess nodes are for the compatability fn
    weightConst: 1, //How important weight differences are for the compatability fn

    amtOfSpecies: 15, //The desired amount of species
    survivalThreshold: 0.5, //The top % of each speci that are allowed to reproduce
    compatThreshMod: 0.3, //How much the compatibility threshold changes to get the desired amt of species
    defaultCompatThresh: 1, //The initial amt of similarity individuals must have to be in the same species

    shiftWeightProb: 0.02,
    changeWeightProb: 0.01,
    enabledDisableProb: 0.005,
    splitConnectionProb: 0.003,
    newConnectionProb: 0.008,
}

function preload() {
    courseJSON = loadJSON("course.json");
}

function setup() {
    createCanvas(1000, 900);
    background(200);
    course = new Course(courseJSON, popSize);
    neat = new NEAT(options);
}

function draw() {
    background(200);
    neat.showSpeciGraph(500, 10, 300);
    for (let i = 0; i < speed; i++) {
        course.update();
    }
    if (show) {
        course.showCourse();
        course.showCars();
    }

    if (keyIsDown(78)) {
        neat.show();
    }

    // if (course.isColliding(car)) {
    //     background(255, 0, 0);
    // }
    // course.hitCheckpoint(car);

    // noStroke();
    // fill(0);
    // textSize(30);
    // text(Math.floor(car.getFitness(course.checkpoints) * 100) / 100, width / 2, height / 2);

    /*if (keyIsDown(LEFT_ARROW)) {
        car.turn(-0.1);
    }
    if (keyIsDown(RIGHT_ARROW)) {
        car.turn(0.1);
    }
    if (keyIsDown(UP_ARROW)) {
        car.accelerate(1);
    }
    if (keyIsDown(DOWN_ARROW)) {
        car.accelerate(-1);
    }*/

    // course.show();
    // car.update();
    // car.show();

}

function keyPressed() {
    if (key == 's') {
        show = !show;
    } else if (key == '=') {
        speed++;
    } else if (key == '-') {
        speed = Math.max(0, speed - 1);
    }
}