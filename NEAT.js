//Paper desribing the algorithm: http://nn.cs.utexas.edu/downloads/papers/stanley.ec02.pdf
//This project was created by Leo Gagnon on Nov 29, 2019
class NEAT {
    constructor(options) { //popSize, inpSize, outSize, constants, compatThresh) {
        this.consts = [options.disjointConst, options.excessConst, options.weightConst];
        this.mutateProbs = [
            options.shiftWeightProb,
            options.changeWeightProb,
            options.enabledDisableProb,
            options.splitConnectionProb,
            options.newConnectionProb
        ];
        this.desAmtOfSpecies = options.amtOfSpecies || 5;
        this.compatMod = options.compatThreshMod || 0.3;
        this.compatThreshold = options.defaultCompatThresh || 1.4;

        this.innovations = { //The innovation number is stored in an object to it can be used as a reference
            "num": 0,
            "innovations": {}
        };
        this.generation = 0;

        this.inpSize = options.inpSize;
        this.outSize = options.outSize;


        this.popSize = options.populationSize;
        this.pop = [];
        for (let i = 0; i < this.popSize; i++) { //Create an initial population
            const newMember = new NeuralNetwork(this.inpSize, this.outSize, this.innovations);
            this.pop.push(newMember);
        }
        this.speciId = -1; //The ID of the current speci. Starts at -1 so that the first speci is 0
        this.speciRepresentatives = {}; //A dict with all of the representative genomes. The key is the speci Id
        this.speciCounts = []; //An array of dicts that keeps track of how many members are in each speci each gen
    }
    /** //TODO!
        > SurvivalThreshold 0.2 [?]
        Only the top 20% of each species is allowed to reproduce. Controls greediness within species.

        > MutationPower 2.5 [?]
        Mutations of weight go up to 2.5 in a single mutation. You wouldn't want it over 5.0 or so.
     */

    nextGen() {
        //TODO Kill bottom 50% of each species?
        let species = {}; //Creates an array for each represented speci
        let amtOfSpecies = 0;
        for (const member of this.pop) { //For each member
            let foundSpeci = false;
            for (const speciId in this.speciRepresentatives) { //The singular and plural of species is the same, so I'm using speci as the singular
                const representative = this.speciRepresentatives[speciId];
                if (this.compatability(member.connections, representative) < this.compatThreshold) { //If it finds a compatible speci
                    if (!(speciId in species)) {
                        species[speciId] = new Speci();
                        amtOfSpecies++;
                    }
                    species[speciId].addMember(member);
                    foundSpeci = true;
                    break;
                }
            }
            if (!foundSpeci) { //TODO Should I only dynamically create species on the first gen?
                // if (this.generation === 0) { //On the first generation, create a representative. This avoids having each member in their own species the first generation (which would also mess up the representatives for the following generations)
                this.speciRepresentatives[++this.speciId] = member.connections;
                species[this.speciId] = new Speci();
                amtOfSpecies++;
                species[this.speciId].addMember(member);
                // } else {
                // species[++this.speciId] = new Speci(member);
            }
            // }
        }

        if (amtOfSpecies > this.desAmtOfSpecies) { //If there are too many species
            this.compatThreshold += this.compatMod; //Make more species
        } else if (amtOfSpecies < this.desAmtOfSpecies) { //If there are too few species
            this.compatThreshold -= this.compatMod; //Make less spcies
        }
        if (this.compatThreshold < this.compatMod) this.compatThreshold = this.compatMod; //Make sure it doesn't go too low

        //TODO Reset speci representatives??
        let totalAdjFit = 0;
        let newPop = [];
        this.speciCounts.push({});
        for (const speciId in species) {
            const speci = species[speciId];
            speci.keepBest(0.2); //Only keep the best 20% //TODO Make this a parameter
            // speci.calcFits();//TODO Instead of > 5, make it a percent of the total population
            if (speci.members.length > 5) newPop.push(speci.bestMember.copy()); //Copy the champion of each speci with more than 5 members
            this.speciCounts[this.speciCounts.length - 1][speciId] = speci.members.length;
            totalAdjFit += speci.getAdjFit();
        }
        for (let i = newPop.length; i < this.popSize; i++) {
            const speciId = this.getWeightedSpeciesIndex(species, totalAdjFit); //Gets a random speci, using a weighted probability based on the adj fit
            const speci = species[speciId];

            const parentAIndex = this.getWeightedSpeciIndex(speci.members, speci.fit);
            const parentA = speci.members[parentAIndex]; //Get the first parent

            let parentBIndex = this.getWeightedSpeciIndex(speci.members, speci.fit);
            let parentB;
            if (speci.members.length > 1) { //If there are multiple members in the speci
                for (let i = 0; i < 1000 && parentAIndex === parentBIndex; i++) { //Pick 2 different members (at least try to 1000 times)
                    parentBIndex = this.getWeightedSpeciIndex(speci.members, speci.fit);
                }
                parentB = speci.members[parentBIndex];
            } else { //If there is only 1 member in this speci, cross it with a member of another speci
                let otherSpeciId = this.getWeightedSpeciesIndex(species, totalAdjFit); //Pick another, different speci
                for (let i = 0; i < 1000 && speciId === otherSpeciId; i++) { //Make sure the species are different
                    otherSpeciId = this.getWeightedSpeciesIndex(species, totalAdjFit);
                }
                const otherSpeci = species[otherSpeciId]; //TODO TODO TODO IF EACH INDIVIDUAL IS IT'S OWN SPECIES, IT PERFORMS VERY WELL!
                parentBIndex = this.getWeightedSpeciIndex(otherSpeci.members, otherSpeci.fit);
                parentB = otherSpeci.members[parentBIndex];
            }
            let child;

            if (parentA.fitness > parentB.fitness) { //Crossover differently depending on the fitnesses
                child = this.crossover(parentA, parentB); //TODO When crossed between species, the fitness metric is not adjusted
            } else if (parentA.fitness < parentB.fitness) {
                child = this.crossover(parentB, parentA);
            } else {
                child = this.crossover(parentA, parentB, true); //If the fitness is equal, disjoint/excess should be inherited from both
            }
            //------------------------Mutation------------------------
            child.mutate(this.mutateProbs); //Mutate the child
            newPop.push(child); //Add to the new population
        }
        // console.log("Amt of Species: " + Object.keys(species).length);
        this.pop = newPop;
        this.generation++;
    }

    getWeightedSpeciIndex(arr, total) { //Uses a weighted probability (based on fitness) to pick a random member from a speci's arr
        let r = Math.random() * total;
        let index = Math.floor(Math.random() * arr.length) - 1; //Starts with a random member, to prevent a normal distribution
        do { //A do while loop is used because Math.random() is inclusive of 0, in which case -1 would be returned
            index = (index + 1) % arr.length;
            r -= arr[index].fitness;
        } while (r >= 0);
        return index;
    }

    getWeightedSpeciesIndex(dict, total) { //Uses a weighted probability (based on fitness) to pick a random speci from a dict of species
        let keys = Object.keys(dict);
        let r = Math.random() * total;
        let keysIndex = Math.floor(Math.random() * keys.length) - 1; //Starts with a random member, to prevent a normal distribution
        do { //A do while loop is used because Math.random() is inclusive of 0, in which case -1 would be returned
            keysIndex = (keysIndex + 1) % keys.length;
            r -= dict[keys[keysIndex]].adjFit;
        } while (r >= 0);
        return keys[keysIndex];
    }

    compatability(aConnections, bConnections) { //How closely relate 2 organisms are. Used for speciation
        let amtDisjoint = 0; //The amount of disjoint genes (genes without a matching pair)
        let amtExcess = 0; //The amount of excess genes (extra genes from the individual w/ a larger genome)

        let totalWeightDiff = 0; //The avg difference of all of the matching genes weights
        let matchingGenes = 0; //The amount of matching genes (used to calc the avg)

        const innovNumsA = Object.keys(aConnections);
        const innovNumsB = Object.keys(bConnections);
        const maxInnovA = Math.max(...innovNumsA);
        const maxInnovB = Math.max(...innovNumsB);
        //TODO Readd not normalizing smaller gneomes?
        let biggerGenome = Math.max(innovNumsA.length, innovNumsB.length); //The amount of genes in the bigger genome (used for normalizing)
        // if (biggerGenome < 20) biggerGenome = 1; //Not necessary to normalize smaller genomes (recommended by the paper)
        let smallerGenome = Math.min(maxInnovA, maxInnovB); //The largest innovation number of the simplier (older innovations) individual (used for calculating excess genes)

        for (const innovNum in aConnections) {
            if (innovNum in bConnections) { //There is a matching pair
                totalWeightDiff += Math.abs(aConnections[innovNum].val - bConnections[innovNum].val); //Add the diff btwn the 2
                matchingGenes++; //Used for avg
            } else if (innovNum <= smallerGenome) { //If it's disjoint
                amtDisjoint++;
            } else { //If it's excess
                amtExcess++;
            }
        }
        for (const innovNum in bConnections) {
            if (!(innovNum in aConnections)) { //All the matching have been evaluated, so don't include thos
                if (innovNum <= smallerGenome) { //If it's disjoint
                    amtDisjoint++;
                } else {
                    amtExcess++;
                }
            }
        }
        return ((this.consts[0] * amtExcess) / biggerGenome) + ((this.consts[1] * amtDisjoint) / biggerGenome) + (this.consts[2] * (totalWeightDiff / matchingGenes));
    }

    crossover(a, b, equalFit = false) { //Crossover 2 organisms (a is the more fit parent)
        let childGenes = new Genes();
        for (const innovNum in a.connections) {
            if (innovNum in b.connections) { //If both parents have that gene
                if (Math.random() < 0.5) childGenes.add(innovNum, a.connections[innovNum].copy()); //Pick a random gene from each parent
                else childGenes.add(innovNum, b.connections[innovNum].copy());
            } else { //Only parent a has that gene
                childGenes.add(innovNum, a.connections[innovNum].copy());
            }
        }
        if (equalFit) { //If they are equally fit, dijoint/excess genes are added from both parents
            for (const innovNum in b.connections) {
                if (!(innovNum in childGenes)) { //Add disjoint genes from the other parent
                    childGenes.add(innovNum, b.connections[innovNum].copy());
                }
            }
        }

        let child = new NeuralNetwork(this.inpSize, this.outSize, this.innovations, childGenes);
        return child;
    }

    showSpeciGraph(x, y, w) {
        let speciHeight = w / this.speciCounts.length;
        push();
        translate(x, y);
        fill(0);
        stroke(0);
        strokeWeight(2);
        rect(0, 0, w, w);
        noStroke();
        // strokeWeight(2);
        for (let gen = 0; gen < this.speciCounts.length; gen++) {
            let percent = 0;
            let total = Object.values(this.speciCounts[gen]).reduce((total, curr) => total + curr);
            for (const speciId in this.speciCounts[gen]) {
                const count = this.speciCounts[gen][speciId];
                let thisPercent = count / total;
                const col = genSpeciCol(speciId);
                fill(col[0], col[1], col[2]);
                // stroke(col[0], col[1], col[2]);
                rect(percent * w, w - ((gen + 1) * speciHeight), thisPercent * w, speciHeight);
                percent += thisPercent;
            }
        }
        pop();
    }

    show() {
        let i = 0;
        for (let y = 25; y < height - 25; y += 100) {
            for (let x = 25; x < width - 225; x += 200) {
                if (i >= this.popSize) return;
                this.pop[i].show(x, y);
                i++;
            }
        }
    }
}

function genSpeciCol(id) { //Return an [r, g, b] that will be the same for the same id, but diff for diff ids (used to show speci graph)
    return [
        ((id + 57) * 431) % 255,
        ((id + 89) * 124) % 255,
        ((id + 173) * 956) % 255,
    ]
}

class Speci {
    constructor() {
        this.fit = 0;
        this.adjFit = 0;
        this.bestMember = null;
        this.members = [];
    }

    keepBest(perc) {
        const amtToKeep = Math.ceil(this.members.length * perc); //TODO Just sort the array (maybe when adding members), and then remove most of the members below n%
        this.members = this.members.sort((a, b) => a.fitness - b.fitness);
        this.members = this.members.slice(0, amtToKeep);
        // for (let i = this.members.length - 1; i >= 0; i++) {
        //     if (i < amtToKeep && Math.random() < 0.1) {
        //         this.members.splice(i, 1);
        //     }
        //     if (i > amtToKeep && Math.random() < 0.95) {
        //         this.members.splice(i, 1);
        //     }
        // }
        //TODO TODO TODO TODO TODO TODO TODO
        // let keep = [];
        // let lowestKept = -Infinity;
        // for (let i = 0; i < this.members.length; i++) {
        //     if (keep.length < amtToKeep || this.members[i].fitness > lowestKept) {
        //         keep.push(this.members[i]);
        //         if (keep.length >= amtToKeep) lowestKept = this.members[i].fitness;
        //     }
        // }
        // return keep;
    }

    // getMin(arr) {

    // }

    getAdjFit() { //TODO MAYBE CHANGE THIS???? //Math.sqrt(this.fit);???
        this.adjFit = this.fit / this.members.length;
        return this.adjFit;
    }

    addMember(m) {
        this.members.push(m);
        this.fit += m.fitness;
        if (!this.bestMember || m.fitness > this.bestMember.fitness) this.bestMember = m;
    }

    // calcFits() {
    //     // this.fit = 0;
    //     for (const member of this.members) {
    //         this.fit += member.fitness;
    //     }
    //     this.adjFit = this.fit / this.members.length;
    // }

    // getBestMember() {
    //     let bestFit = -Infinity;
    //     let best = null;
    //     for (const member of this.members) {
    //         if (member.fitness > bestFit) {
    //             bestFit = member.fitness;
    //             best = member;
    //         }
    //     }
    //     return best.copy();
    // }


}

//OLD SPECIATION/NEXT GEN CODE
//------------------------Speciation------------------------
/**My Own Speciation method
 * 1. Divide into species
 * 2. For each speci, Calculate the total adjusted fit for the whole speci
 * 3. Each speci get a % of offspring, based on their total fit
 * 4. For each speci, use a weighted probability to choose the parents. Repeat this for however many offspring that speci was assigned
 * 
 * 
 * -------Psuedocode------
 * 
 * Create speci dict
 * 
 * newPop = []
 * remainingAmount = popSize
 * 
 * totalSpeciesFit = 0
 * speciFits = {}
 * for every speci
 *      speciFit = 0
 *      bestFit = -Inifinty
 *      bestMember = null;
 *      for every member
 *          member.adjFit = member.fit / speci.length
 *          speciFit += member.adjFit
 *          if (member.fit > bestFit) 
 *              bestFit = member.fit
 *              bestMember = member
 *      if (speci.length > 5)
 *          newPop.push(bestMember.copy())
 *          remainingAmount--
 *      totalSpeciesFit += speciFit
 *      speciFits[speciId] = speciFit
 * 
 * offSpringCounts = {} //A dictionary where each speci Id gets assigned an amount of offspring
 * for every speci
 *      amtOfOffspring = floor(speciFits[spciId] / totalSpeciesFit) * remainingAmount
 *      repeat amtOfOffspring times
 *          Pick parentA from speci //Maybe don't pick from the bottom (1-n)%
 *          Pick parentB from speci
 *          Make sure they are different
 *          child = crossover(parentA, parentB)
 *          child.mutate()
 *          newPop.push(child)
 * 
 * 
 * 
 * 
 */



/*Speciation Steps
 * 1. Create Species
 * 2. Calculate sum of adjusted fitness for each speci
 * 3. Assign a diff. num of offspring to each speci according to the sum from step 2
 * 4. Eliminate lowest performing members from each speci
 * 5. Replace the entire population with offspring from the remaining organisms in each speci
 * 
 * 
 * 
 * Create species {}
 * 
 * for every speci
 *      totalSpeciFit = 0
 *      for every member
 *          member.adjFit = member.fit / speci.length
 *          totalSpeciFit += member.adjFit
 * 
 * 
 */







/*
        let species = {}; //Creates an array for each represented speci
        for (const member of this.pop) { //For each member
            let foundSpeci = false;
            for (const speciId in this.speciRepresentatives) { //The singular and plural of species is the same, so I'm using speci as the singular
                const representative = this.speciRepresentatives[speciId];
                if (this.compatability(member.connections, representative) < this.compatThreshold) { //If it finds a compatible speci
                    if (!(speciId in species)) species[speciId] = [];
                    species[speciId].push(member);
                    foundSpeci = true;
                    break;
                }
            }
            if (!foundSpeci) {
                if (this.generation === 0) { //On the first generation, create a representative. This avoids having each member in their own species the first generation (which would also mess up the representatives for the following generations)
                    this.speciRepresentatives[++this.speciId] = member.connections;
                    species[this.speciId] = [member];
                } else {
                    species[++this.speciId] = [member]; //If there is no existing compatible speci, create a new one
                }
            }
        }
        // this.speciRepresentatives = {}; //Recreate the representatives for the next generation
        // for (let speciId in species) {
        //     const speci = species[speciId];
        //     this.speciRepresentatives[speciId] = speci[Math.floor(Math.random() * speci.length)].connections; //Assign random new representatives for each speci
        // }

        let newPop = [];
        let remainingAmount = this.popSize;

        let totalSpeciesFit = 0;
        let speciFits = {};
        for (const speciId in species) {
            let speciFit = 0;
            let bestFit = -Infinity;
            let bestMember = null;
            for (const member of species[speciId]) {
                // member.adjustedFitness = member.fitness / species[speciId].length;
                speciFit += member.fitness;
                if (member.fitness > bestFit) {
                    bestFit = member.fitness;
                    bestMember = member;
                }
            }
            for (const member of species[speciId]) {
                member.prob = member.fitness / speciFit;
            }
            speciFit /= speci.length; //Prevents speci from getting too large and dominating
            if (species[speciId].length > 5) {
                newPop.push(bestMember.copy());
                remainingAmount--;
            }
            totalSpeciesFit += speciFit;
            speciFits[speciId] = speciFit;
        }
        for (const speciId in species) {
            const amtOfOffspring = Math.floor((speciFits[speciId] / totalSpeciesFit) * remainingAmount);
            const speci = species[speciId];
            for (let i = 0; i < amtOfOffspring; i++) {
                const parentAIndex = this.getRandIndex(speci);
                let parentBIndex = this.getRandIndex(speci); 
                for (let i = 0; i < 1000 && parentAIndex == parentBIndex; i++) { //Try at least 1000 times to make sure the parents are different
                    parentBIndex = this.getRandIndex(speci);
                }
                const parentA = speci[parentAIndex];
                const parentB = speci[parentBIndex];
                let child;
                if (parentA.adjustedFitness > parentB.adjustedFitness) {
                    child = this.crossover(parentA, parentB);
                } else if (parentA.adjustedFitness < parentB.adjustedFitness) {
                    child = this.crossover(parentB, parentA);
                } else {
                    child = this.crossover(parentA, parentB, true); //If the fitness is equal, disjoint/excess should be inherited from both
                }
                //------------------------Mutation------------------------
                child.mutate();
                newPop.push(child);
                //Maybe don't pick from the bottom (1-n)%
            }
        }*/
// for (let i = newPop.length; i < this.popSize; i++) { //Becuase the amt of offspring for each speci is floored, there may be extra spots
//     const parentAIndex = this.getRandIndex(this.pop);
//     let parentBIndex = this.getRandIndex(this.pop);
//     for (let i = 0; i < 1000 && parentAIndex == parentBIndex; i++) { //Try at least 1000 times to make sure the parents are different
//         parentBIndex = this.getRandIndex(this.pop);
//     }
//     const parentA = this.pop[parentAIndex];
//     const parentB = this.pop[parentBIndex];
//     let child;
//     if (parentA.adjustedFitness > parentB.adjustedFitness) {
//         child = this.crossover(parentA, parentB);
//     } else if (parentA.adjustedFitness < parentB.adjustedFitness) {
//         child = this.crossover(parentB, parentA);
//     } else {
//         child = this.crossover(parentA, parentB, true); //If the fitness is equal, disjoint/excess should be inherited from both
//     }
//     //------------------------Mutation------------------------
//     child.mutate();
//     newPop.push(child);
//     //Maybe don't pick from the bottom (1-n)%
// }
/* console.log("New Pop Size: " + newPop.length);
 console.log("Amt of Species: " + Object.keys(species).length);
 this.pop = newPop;
 this.generation++;*/

// let totalAdjFitness = 0;
// for (const speciId in species) {
//     const speci = species[speciId];
//     for (const member of speci) {
//         member.adjustedFitness = member.fitness / speci.length; //Adjusts the fitness depending on the amt of organisms in that speci (allows innovation to survive)
//         totalAdjFitness += member.adjustedFitness;
//     } 
// } 
// for (const member of this.pop) {
//     member.prob = member.adjustedFitness / totalAdjFitness; //Creates a weighted probability based on the adjusted fitness for each member
// }

// //------------------------Crossover------------------------
// let newPop = [];
// for (let i = 0; i < this.popSize; i++) {
//     //------------------------Selection------------------------
//     const parentAIndex = this.getRandMember();
//     let parentBIndex = this.getRandMember();
//     for (let i = 0; i < 1000 && parentAIndex == parentBIndex; i++) { //Try at least 1000 times to make sure the parents are different
//         parentBIndex = this.getRandMember();
//     }
//     const parentA = this.pop[parentAIndex];
//     const parentB = this.pop[parentBIndex];
//     let child;
//     if (parentA.adjustedFitness > parentB.adjustedFitness) {
//         child = this.crossover(parentA, parentB);
//     } else if (parentA.adjustedFitness < parentB.adjustedFitness) {
//         child = this.crossover(parentB, parentA);
//     } else {
//         child = this.crossover(parentA, parentB, true); //If the fitness is equal, disjoint/excess should be inherited from both
//     }
//     //------------------------Mutation------------------------
//     child.mutate();
//     newPop.push(child);
// }
// console.log("Amt of Species: " + Object.keys(species).length);
// this.pop = newPop;
// this.generation++;

/**
 * Take current pop, group into diff speci using representatives
 * 
 * let totalAdjFit = 0;
 * For each speci //Calculate the fitness for each speci, and the total adjusted fitness
 *      Speci.totalFit = total fitness of all members
 *      speci.adjFit += speci.fit / amount of members
 * For the population
 *      Pick a random speci using weighted probability with the adjusted fitnesses
 *      Pick 2 parents and crossover from that speci
 *      Add to new population
 */

// let neat = new NEAT(19, 1, 2, [1, 1, 0.4], 3);




















/*
If the max fitness of a species did not improve in 15 gens, the networks i nthe stagnant species were not allowed to reproduce
The champion of each species with more than 5 networks was copied into the next gen unchanged
There was an 80% chance of a genome having its connection weights mutated, in which case each weight had a 90% chance of being uniformly perturbed and a 10% chance of being assigned a new rand val
75% chance an inherited gene was disable if it was disabled in either parent
In each gen, 25% chance of offspring results from mutations without crossover
Interspecies mating rate was 0.001
In smaller populations, the prob of adding a new node was 0.03, and the prob of adding a new link was 0.05
In the larger population, the prob of new link was 0.3
Activation fn = 1/(1+e^(-4.9x))
*/